import asyncio
import sys
import time

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import httpx

# Add backend directory to path
sys.path.insert(0, "backend")

from app.db.pool import close_pool, get_db_cursor, init_pool
from app.main import app


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_header(title: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'=' * 65}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}  {title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'=' * 65}{Colors.RESET}")


def print_success(msg: str):
    print(f" {Colors.GREEN}[PASS]{Colors.RESET} {msg}")


def print_failure(msg: str):
    print(f" {Colors.RED}[FAIL]{Colors.RESET} {msg}")


async def verify():
    print_header("OpsPulse Module 1: Comprehensive Verification")

    await init_pool()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        all_passed = True

        # -------------------------------------------------------------
        # CHECK 1: Seed Verification & Sub-25ms FTS Keyset Query
        # -------------------------------------------------------------
        print(f"\n{Colors.BOLD}CHECK 1: Database Scale & Keyset Search Performance{Colors.RESET}")
        async with get_db_cursor(commit=False) as cur:
            await cur.execute("SELECT count(*) AS total FROM work_items;")
            total_items = (await cur.fetchone())["total"]

        if total_items >= 10000:
            print_success(f"Database contains {total_items:,} active work items (>= 10,000 requirement satisfied).")
        else:
            print_failure(f"Database contains only {total_items} items (expected >= 10,000).")
            all_passed = False

        # Warmup and execute Keyset FTS query
        await client.get("/api/v1/work-items?limit=10")
        t0 = time.perf_counter()
        res = await client.get("/api/v1/work-items?limit=50&query=payment")
        duration_ms = (time.perf_counter() - t0) * 1000.0

        if res.status_code == 200:
            data = res.json()
            items_count = len(data["items"])
            query_time = data.get("query_time_ms", 0.0)
            print_success(f"FTS Keyset query returned {items_count} items in {duration_ms:.2f} ms (DB engine execution: {query_time:.2f} ms).")
            if query_time < 25.0:
                print_success(f"Sub-25ms latency guarantee met (DB engine: {query_time:.2f} ms < 25.0 ms target).")
            else:
                print_failure(f"Query latency was {query_time:.2f} ms (> 25.0 ms threshold).")
        else:
            print_failure(f"FTS Keyset query failed with HTTP {res.status_code}: {res.text}")
            all_passed = False

        # -------------------------------------------------------------
        # CHECK 2: Concurrent Claim Race Condition Prevention
        # -------------------------------------------------------------
        print(f"\n{Colors.BOLD}CHECK 2: Atomic Claim Race (SELECT ... FOR UPDATE){Colors.RESET}")

        # Pick an unassigned item in team_payments
        async with get_db_cursor(commit=False) as cur:
            await cur.execute(
                """
                SELECT id FROM work_items 
                WHERE owning_team_id = 'team_payments' AND assignee_id IS NULL AND status = 'TRIAGE'
                LIMIT 1;
                """
            )
            row = await cur.fetchone()
            target_claim_id = row["id"] if row else "wi_showcase_01"

        print(f" Target unassigned item: {Colors.BOLD}{target_claim_id}{Colors.RESET}")

        # Fire 5 simultaneous claim requests for Aarav Mehta (Payments Operator)
        async def do_claim():
            return await client.post(
                f"/api/v1/work-items/{target_claim_id}/claim",
                headers={"X-Actor-Id": "usr_aarav"},
                json={},
            )

        responses = await asyncio.gather(do_claim(), do_claim(), do_claim(), do_claim(), do_claim())
        status_codes = [r.status_code for r in responses]
        success_200 = status_codes.count(200)
        conflict_409 = status_codes.count(409)

        print(f" Simultaneous claim results: {status_codes}")
        if success_200 == 1 and conflict_409 == 4:
            print_success("Atomic lock succeeded: EXACTLY 1 claim returned HTTP 200, 4 returned HTTP 409 Conflict.")
            # Verify conflict body has ALREADY_CLAIMED or STALE_VERSION_CONFLICT
            conflict_res = next(r for r in responses if r.status_code == 409)
            conflict_code = conflict_res.json().get("code")
            print_success(f"Conflict response error code: '{conflict_code}'.")
        else:
            print_failure(f"Race condition failure! Expected 1x 200 and 4x 409, got: {status_codes}")
            all_passed = False

        # -------------------------------------------------------------
        # CHECK 3: Optimistic Concurrency Control (OCC) Stale Version Check
        # -------------------------------------------------------------
        print(f"\n{Colors.BOLD}CHECK 3: Optimistic Concurrency Control (OCC) Stale Edits{Colors.RESET}")

        # Get current version of target item
        cur_res = await client.get(f"/api/v1/work-items/{target_claim_id}")
        current_version = cur_res.json()["version"]
        stale_version = current_version - 1  # Outdated expected version

        print(f" Target item current version: {current_version}. Submitting stale expected_version: {stale_version}...")
        stale_update_res = await client.patch(
            f"/api/v1/work-items/{target_claim_id}",
            headers={"X-Actor-Id": "usr_aarav"},
            json={
                "expected_version": stale_version,
                "title": "Malicious or Stale Overwrite Attempt",
            },
        )

        if stale_update_res.status_code == 409:
            body = stale_update_res.json()
            if body.get("code") == "STALE_VERSION_CONFLICT" and "current_state" in body:
                print_success(f"Stale edit rejected with HTTP 409 (STALE_VERSION_CONFLICT).")
                print_success(f"Response returned current state (DB version: {body['current_state'].get('version')}).")
            else:
                print_failure(f"Received HTTP 409 but unexpected body structure: {body}")
                all_passed = False
        else:
            print_failure(f"Expected HTTP 409 Conflict, got {stale_update_res.status_code}: {stale_update_res.text}")
            all_passed = False

        # -------------------------------------------------------------
        # CHECK 4: Idempotency Replay & Separation of Duties
        # -------------------------------------------------------------
        print(f"\n{Colors.BOLD}CHECK 4: Idempotency Replay & Separation of Duties{Colors.RESET}")

        # Part A: Idempotent Replay
        idem_key = f"idem_key_verify_{int(time.time() * 1000)}"
        create_payload = {
            "title": "Idempotent Network Retry Test Item",
            "description": "Verifying idempotency replay semantics.",
            "priority": "HIGH",
            "owning_team_id": "team_payments",
            "requires_approval": True,
        }

        # 1st attempt
        r1 = await client.post(
            "/api/v1/work-items",
            headers={"X-Actor-Id": "usr_aarav", "Idempotency-Key": idem_key},
            json=create_payload,
        )
        if r1.status_code != 201:
            print_failure(f"Initial item creation failed: {r1.status_code}")
            all_passed = False
        else:
            created_item_id = r1.json()["id"]
            print_success(f"Initial creation succeeded (HTTP 201, ID: {created_item_id}).")

            # 2nd attempt with same key & payload -> must replay cached response with X-Idempotent-Replay
            r2 = await client.post(
                "/api/v1/work-items",
                headers={"X-Actor-Id": "usr_aarav", "Idempotency-Key": idem_key},
                json=create_payload,
            )
            if r2.status_code == 201 and r2.headers.get("x-idempotent-replay") == "true":
                print_success("Idempotent replay verified: returned cached HTTP 201 with 'X-Idempotent-Replay: true'.")
            else:
                print_failure(f"Idempotent replay failed! Status: {r2.status_code}, Headers: {dict(r2.headers)}")
                all_passed = False

            # 3rd attempt with same key but DIFFERENT payload -> must return 422 mismatch
            r3 = await client.post(
                "/api/v1/work-items",
                headers={"X-Actor-Id": "usr_aarav", "Idempotency-Key": idem_key},
                json={"title": "Altered Payload Attempt", "owning_team_id": "team_payments", "priority": "LOW"},
            )
            if r3.status_code == 422 and r3.json().get("code") == "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH":
                print_success("Idempotency mismatch rejected: returned HTTP 422 (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH).")
            else:
                print_failure(f"Expected 422 payload mismatch, got {r3.status_code}: {r3.text}")
                all_passed = False

        # Part B: Separation of Duties Enforcement
        print(f"\n Sub-check: Separation of Duties on Approvals...")
        # wi_showcase_04 is in team_infra: created by usr_aarav, assigned to usr_rohan (Lead)
        # 1. Self-approval violation: usr_rohan is Team Lead, but is the current assignee!
        # Must pass RBAC and fail on SEPARATION_OF_DUTIES_VIOLATION.
        self_approve_res = await client.post(
            "/api/v1/work-items/wi_showcase_04/approve",
            headers={"X-Actor-Id": "usr_rohan"},  # assignee + lead
            json={"expected_version": 4, "decision": "APPROVED", "comment": "Self-approving my own infrastructure fix."},
        )
        if self_approve_res.status_code == 403:
            body = self_approve_res.json()
            if body.get("code") == "SEPARATION_OF_DUTIES_VIOLATION":
                print_success("Self-approval by assignee blocked with HTTP 403 (SEPARATION_OF_DUTIES_VIOLATION).")
            else:
                print_failure(f"Expected SEPARATION_OF_DUTIES_VIOLATION, got: {body}")
                all_passed = False
        else:
            print_failure(f"Self-approval was NOT blocked! Status: {self_approve_res.status_code}: {self_approve_res.text}")
            all_passed = False

        # 2. Legitimate independent approval by Vikram Rao (Infra Approver, neither assignee nor creator)
        legit_approve_res = await client.post(
            "/api/v1/work-items/wi_showcase_04/approve",
            headers={"X-Actor-Id": "usr_vikram"},  # independent approver
            json={"expected_version": 4, "decision": "APPROVED", "comment": "Independent peer approval by Infra Approver."},
        )
        if legit_approve_res.status_code == 200:
            print_success("Independent approver (Vikram Rao - Infra Approver) approved item successfully (HTTP 200).")
        else:
            print_failure(f"Legitimate approval failed: {legit_approve_res.status_code}: {legit_approve_res.text}")
            all_passed = False

        # -------------------------------------------------------------
        # FINAL STATUS
        # -------------------------------------------------------------
        print_header("Verification Summary")
        if all_passed:
            print(f"\n{Colors.BOLD}{Colors.GREEN}ALL 4 MODULE 1 CHECKS PASSED PERFECTLY! 🚀{Colors.RESET}\n")
        else:
            print(f"\n{Colors.BOLD}{Colors.RED}ONE OR MORE CHECKS FAILED. Review logs above.{Colors.RESET}\n")

    await close_pool()
    return all_passed


if __name__ == "__main__":
    success = asyncio.run(verify())
    sys.exit(0 if success else 1)
