import asyncio
import os
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.pool import close_pool, get_db_cursor, init_pool

REALISTIC_SHOWCASE_UPDATES = [
    ("wi_showcase_01", "UPI Settlement Webhook Latency Spike on Axis Gateway", "Intermittent HTTP 504 errors reported during peak checkout hours. Needs immediate network routing inspection on Axis bank integration."),
    ("wi_showcase_02", "Merchant Payout Batch #4092 Reconciliation Mismatch", "Automated reconciliation script flagged 47 ledger transactions where invoice payments did not balance ledger entries."),
    ("wi_showcase_03", "SEBI Quarterly Compliance Audit Ledger Export Sign-off", "High-volume transactional audit export requiring designated compliance lead approval before regulatory submission."),
    ("wi_showcase_04", "Kubernetes Node Pool Memory Pressure in ap-south-1", "OOMKilled events triggering on billing worker daemonsets. Memory cgroups steadily climbing over 24h cycle."),
    ("wi_showcase_05", "PostgreSQL Connection Pool Exhaustion on Read Replica 2", "PgBouncer client pool saturating during end-of-month reporting queries. Maximum client connection limit reached."),
    ("wi_showcase_06", "PCI-DSS Tokenization Vault HSM Encryption Key Rotation", "Annual Hardware Security Module symmetric key rotation procedure. Requires dual-operator sign-off and audit log pinning."),
    ("wi_showcase_07", "Tier-1 Customer Data Erasure Request (GDPR Article 17)", "Verified customer data deletion request across operational databases, S3 archives, and analytical data warehouse."),
    ("wi_showcase_08", "Tier-3 Escalation: Enterprise SSO SAML Assertion Failure", "Okta IdP federation rejecting SAML assertions for enterprise tenant acme-corp after certificate renewal."),
    ("wi_showcase_09", "Stripe Chargeback Fraud Ring Pattern Detection", "Automated anomaly detection identified synchronized card testing attack across 320 newly registered consumer accounts."),
    ("wi_showcase_10", "Production Redis Cluster Split-Brain Incident Triage", "Network partition between availability zones az-1a and az-1b caused transient failover storm on session cache."),
    ("wi_showcase_11", "OFAC Sanctions Screening Sanity Check on High-Value Wire", "Cross-border wire of $1.2M flagged fuzzy sanction match on beneficiary name. Awaiting compliance officer review."),
    ("wi_showcase_12", "Tier-3 VIP Escalation: Double Billing on Subscription Renewals", "28 annual enterprise accounts charged twice due to retry storm on payment webhook listener."),
    ("wi_showcase_13", "Kafka Ingestion Lag Exceeding 100k Messages on telemetry-in", "Consumer group opspulse-events lagging by 45 minutes on partitioned transaction stream."),
    ("wi_showcase_14", "SOC2 Type II Trust Services Criteria Evidence Gathering", "Collecting automated configuration snapshots and access control proofs for annual auditor review."),
    ("wi_showcase_15", "Tier-3 Escalation: B2B API Rate Limiting False Positives", "High-frequency partner integration hitting 429 Too Many Requests due to misconfigured bucket window."),
]

async def cleanup():
    await init_pool()
    async with get_db_cursor(commit=True) as cur:
        # 1. Count and delete test pollution rows
        await cur.execute("""
            SELECT count(*) as cnt FROM work_items
            WHERE title ILIKE 'Test Item%'
               OR title ILIKE 'Mismatch Test%'
               OR title ILIKE 'Idempotency Test%'
               OR title ILIKE 'First Edit Wins%'
               OR title ILIKE 'Idempotent Network Retry%'
               OR title ILIKE 'Stale Edit Attempt%'
               OR title ILIKE 'Benchmark Concurrent Claim Test Item%'
               OR title ILIKE 'Malicious or Stale Overwrite Attempt%';
        """)
        res = await cur.fetchone()
        count = res["cnt"] if res else 0
        print(f"Found {count} leftover test artifacts.")

        if count > 0:
            await cur.execute("""
                DELETE FROM outbox_jobs WHERE aggregate_id IN (
                    SELECT id FROM work_items
                    WHERE title ILIKE 'Test Item%'
                       OR title ILIKE 'Mismatch Test%'
                       OR title ILIKE 'Idempotency Test%'
                       OR title ILIKE 'First Edit Wins%'
                       OR title ILIKE 'Idempotent Network Retry%'
                       OR title ILIKE 'Stale Edit Attempt%'
                       OR title ILIKE 'Benchmark Concurrent Claim Test Item%'
                       OR title ILIKE 'Malicious or Stale Overwrite Attempt%'
                );
                DELETE FROM work_items
                WHERE title ILIKE 'Test Item%'
                   OR title ILIKE 'Mismatch Test%'
                   OR title ILIKE 'Idempotency Test%'
                   OR title ILIKE 'First Edit Wins%'
                   OR title ILIKE 'Idempotent Network Retry%'
                   OR title ILIKE 'Stale Edit Attempt%'
                   OR title ILIKE 'Benchmark Concurrent Claim Test Item%'
                   OR title ILIKE 'Malicious or Stale Overwrite Attempt%';
            """)
            print(f"Successfully deleted {count} test artifacts from work_items and related tables.")

        # 2. Update curated showcase items to high-craft realistic titles
        for item_id, title, desc in REALISTIC_SHOWCASE_UPDATES:
            await cur.execute("""
                UPDATE work_items
                SET title = %s, description = %s
                WHERE id = %s;
            """, (title, desc, item_id))
        print("Updated all 15 curated showcase items with realistic enterprise operations scenarios.")

    await close_pool()

if __name__ == "__main__":
    asyncio.run(cleanup())
