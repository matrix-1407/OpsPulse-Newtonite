import asyncio
import logging
import os
import sys
import time

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.pool import close_pool, get_db_connection, init_pool

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")


async def seed_database():
    """Seed the database with teams, personas, 15 showcase items, and 10,000 scale items in < 2s."""
    start_total = time.perf_counter()
    await init_pool()

    async with get_db_connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                logger.info("Applying schema DDL...")
                with open("backend/app/db/schema.sql", "r", encoding="utf-8") as f:
                    schema_sql = f.read()
                await cur.execute(schema_sql)

                logger.info("Clearing previous seed data...")
                await cur.execute(
                    """
                    TRUNCATE work_item_comments, audit_events, outbox_jobs, idempotency_keys, 
                             work_items, team_memberships, users, teams CASCADE;
                    """
                )

                logger.info("Seeding 4 operational teams...")
                await cur.execute(
                    """
                    INSERT INTO teams (id, name, description) VALUES
                    ('team_payments', 'Payments & Billing Operations', 'Monitors payment gateways, chargebacks, webhooks, and ledger consistency.'),
                    ('team_infra', 'Cloud Infrastructure & SRE', 'Maintains Kubernetes clusters, databases, networks, and production uptime.'),
                    ('team_compliance', 'Legal & Compliance', 'Oversees regulatory adherence, GDPR erasure, SOC2 audits, and security policies.'),
                    ('team_support', 'Tier-3 Customer Escalations', 'Handles VIP customer escalations, incident triage, and production bug coordination.');
                    """
                )

                logger.info("Seeding 6 built-in personas...")
                await cur.execute(
                    """
                    INSERT INTO users (id, email, name, avatar_url) VALUES
                    ('usr_aarav', 'aarav.mehta@opspulse.internal', 'Aarav Mehta', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aarav'),
                    ('usr_priya', 'priya.nair@opspulse.internal', 'Priya Nair', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya'),
                    ('usr_rohan', 'rohan.desai@opspulse.internal', 'Rohan Desai', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan'),
                    ('usr_sneha', 'sneha.kulkarni@opspulse.internal', 'Sneha Kulkarni', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha'),
                    ('usr_vikram', 'vikram.rao@opspulse.internal', 'Vikram Rao', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram'),
                    ('usr_ananya', 'ananya.sharma@opspulse.internal', 'Ananya Sharma', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya');
                    """
                )

                logger.info("Configuring resource-scoped RBAC memberships...")
                await cur.execute(
                    """
                    INSERT INTO team_memberships (team_id, user_id, role) VALUES
                    ('team_payments', 'usr_aarav', 'OPERATOR'),
                    ('team_infra', 'usr_aarav', 'REQUESTER'),

                    ('team_payments', 'usr_priya', 'APPROVER'),
                    ('team_compliance', 'usr_priya', 'LEAD'),

                    ('team_infra', 'usr_rohan', 'LEAD'),
                    ('team_payments', 'usr_rohan', 'OPERATOR'),

                    ('team_support', 'usr_sneha', 'OPERATOR'),
                    ('team_payments', 'usr_sneha', 'REQUESTER'),

                    ('team_compliance', 'usr_vikram', 'APPROVER'),
                    ('team_infra', 'usr_vikram', 'APPROVER'),

                    ('team_support', 'usr_ananya', 'LEAD');
                    """
                )

                logger.info("Seeding 15 curated high-priority showcase items...")
                await cur.execute(
                    """
                    INSERT INTO work_items (
                        id, title, description, status, priority, owning_team_id,
                        assignee_id, created_by_id, requires_approval, approval_status,
                        approved_by_id, approved_at, version, created_at, updated_at
                    ) VALUES
                    ('wi_showcase_01', 'Payment gateway 504 gateway timeout spike on Adyen', 'Intermittent HTTP 504 errors reported during APAC peak checkout hours. Needs immediate network routing inspection.', 'TRIAGE', 'CRITICAL', 'team_payments', NULL, 'usr_sneha', true, 'PENDING', NULL, NULL, 1, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes'),
                    ('wi_showcase_02', 'Stripe webhook signature reconciliation mismatch', 'Automated reconciliation script flagged 47 events where invoice.payment_succeeded did not match ledger balance.', 'INVESTIGATING', 'HIGH', 'team_payments', 'usr_aarav', 'usr_aarav', false, 'NOT_REQUIRED', NULL, NULL, 2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),
                    ('wi_showcase_03', 'Chargeback dispute batch #4092 evidence sign-off', 'High-value customer disputed $45,000 SaaS annual subscription. Requires lead review before submitting to merchant processor.', 'PENDING_APPROVAL', 'HIGH', 'team_payments', 'usr_rohan', 'usr_aarav', true, 'PENDING', NULL, NULL, 3, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '30 minutes'),
                    ('wi_showcase_04', 'Kubernetes node pool memory leak in prod-us-east-1', 'OOMKilled events triggering on billing worker pods. Memory cgroups steadily climbing over 24h cycle.', 'INVESTIGATING', 'CRITICAL', 'team_infra', 'usr_rohan', 'usr_aarav', true, 'PENDING', NULL, NULL, 4, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '45 minutes'),
                    ('wi_showcase_05', 'Redis cache cluster failover latency degradation', 'Primary cache node latency exceeded 25ms during replica sync. Investigate cluster replication buffers.', 'TRIAGE', 'HIGH', 'team_infra', NULL, 'usr_rohan', false, 'NOT_REQUIRED', NULL, NULL, 1, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),
                    ('wi_showcase_06', 'AWS IAM access key rotation policy breach in analytics env', 'Access key age exceeded 90-day compliance window for service account svc_data_export.', 'PENDING_APPROVAL', 'CRITICAL', 'team_infra', 'usr_vikram', 'usr_rohan', true, 'PENDING', NULL, NULL, 2, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '2 hours'),
                    ('wi_showcase_07', 'SOC2 Type II audit log retention evidence collection', 'Auditor requested tamper-evident export of database mutation logs and team access events for Q3.', 'INVESTIGATING', 'HIGH', 'team_compliance', 'usr_priya', 'usr_vikram', true, 'PENDING', NULL, NULL, 2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 hours'),
                    ('wi_showcase_08', 'GDPR right-to-erasure ticket #EU-99410 for enterprise account', 'Enterprise EU client cancelled contract and requested complete cryptographic erasure of PII across replicas.', 'TRIAGE', 'CRITICAL', 'team_compliance', NULL, 'usr_priya', true, 'PENDING', NULL, NULL, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
                    ('wi_showcase_09', 'PCI-DSS quarterly penetration testing vulnerability remediation', 'External security audit noted TLS 1.1 cipher suites active on legacy ingest load balancer.', 'APPROVED', 'MEDIUM', 'team_compliance', 'usr_vikram', 'usr_vikram', true, 'APPROVED', 'usr_priya', NOW() - INTERVAL '1 hour', 5, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 hour'),
                    ('wi_showcase_10', 'VIP Customer ticket escalation: checkout 500 error on renewal', 'Enterprise customer Acme Corp experiencing payment failure during annual seat upgrade.', 'INVESTIGATING', 'CRITICAL', 'team_support', 'usr_sneha', 'usr_ananya', false, 'NOT_REQUIRED', NULL, NULL, 2, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '20 minutes'),
                    ('wi_showcase_11', 'Intermittent SSO SAML authentication failure on Okta', 'Multiple users reporting 400 Bad Request on IdP redirection. Check certificate expiration timestamp.', 'TRIAGE', 'HIGH', 'team_support', NULL, 'usr_ananya', false, 'NOT_REQUIRED', NULL, NULL, 1, NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '40 minutes'),
                    ('wi_showcase_12', 'Duplicate billing complaint on enterprise annual invoice', 'Customer charged twice for invoice #INV-2026-901 due to duplicate retry during network outage.', 'BLOCKED', 'HIGH', 'team_support', 'usr_sneha', 'usr_sneha', true, 'PENDING', NULL, NULL, 3, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '4 hours'),
                    ('wi_showcase_13', 'PostgreSQL slow query alert on audit_events index scan', 'DB CPU alert triggered by unindexed sequential scan on actor_id. GIN/composite index migration required.', 'RESOLVED', 'MEDIUM', 'team_infra', 'usr_rohan', 'usr_rohan', false, 'NOT_REQUIRED', NULL, NULL, 4, NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 hours'),
                    ('wi_showcase_14', 'AML suspicious transaction alert #TX-883921 verification', 'Rapid velocity transactions detected on newly created account. AML hold initiated pending proof of identity.', 'TRIAGE', 'CRITICAL', 'team_payments', NULL, 'usr_aarav', true, 'PENDING', NULL, NULL, 1, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),
                    ('wi_showcase_15', 'Customer data retention lifecycle purge failure in cold storage', 'S3 Glacier retention lifecycle rule failed with access denied on historical transaction logs.', 'INVESTIGATING', 'HIGH', 'team_compliance', 'usr_priya', 'usr_vikram', true, 'PENDING', NULL, NULL, 2, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '1 hour');
                    """
                )

                logger.info("Inserting audit history and outbox jobs for showcase items...")
                await cur.execute(
                    """
                    INSERT INTO audit_events (work_item_id, actor_id, action, from_status, to_status, from_version, to_version, payload)
                    SELECT id, created_by_id, 'CREATED', NULL, 'TRIAGE', NULL, 1, '{"seed": true}'::jsonb
                    FROM work_items WHERE id LIKE 'wi_showcase_%';

                    INSERT INTO outbox_jobs (event_type, aggregate_type, aggregate_id, payload, status)
                    SELECT 'work_item.created', 'work_item', id, json_build_object('id', id, 'title', title), 'COMPLETED'
                    FROM work_items WHERE id LIKE 'wi_showcase_%';
                    """
                )

                logger.info("Fast bulk-seeding 10,000 realistic operational work items via SQL generate_series...")
                seed_10k_start = time.perf_counter()
                await cur.execute(
                    """
                    INSERT INTO work_items (
                        id, title, description, status, priority, owning_team_id,
                        assignee_id, created_by_id, requires_approval, approval_status,
                        version, created_at, updated_at
                    )
                    SELECT
                        'wi_scale_' || LPAD(i::text, 6, '0') AS id,
                        (ARRAY[
                            'High latency spike detected on',
                            'Automated reconciliation anomaly in',
                            'Certificate expiration warning for',
                            'Scheduled database maintenance on',
                            'Unusual API error rate spike in',
                            'Customer refund dispute review for',
                            'Network ingress packet drop alert on',
                            'Security policy audit checkpoint on',
                            'Database connection pool exhaustion on',
                            'Worker queue backpressure threshold reached on'
                        ])[1 + (i % 10)] || ' ' ||
                        (ARRAY[
                            'auth-service-v2', 'payment-gateway-proxy', 'k8s-ingress-controller',
                            'redis-cache-cluster', 'kafka-ingest-pipeline', 'billing-ledger-engine',
                            'customer-crm-sync', 'audit-log-shipper', 'storage-backup-daemon',
                            'notification-dispatch-queue'
                        ])[1 + ((i / 10) % 10)] || ' [Shard #' || (i % 128) || ']' AS title,

                        'Automated operational alert generated by monitoring system for node cluster #' || (i % 64) ||
                        '. Immediate inspection recommended if priority is HIGH or CRITICAL. Trace ID: trc-' || MD5(i::text) AS description,

                        (ARRAY[
                            'TRIAGE', 'INVESTIGATING', 'PENDING_APPROVAL', 'APPROVED', 'BLOCKED', 'RESOLVED', 'CLOSED'
                        ])[1 + (i % 7)] AS status,

                        (ARRAY['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])[1 + (i % 4)] AS priority,

                        (ARRAY['team_payments', 'team_infra', 'team_compliance', 'team_support'])[1 + (i % 4)] AS owning_team_id,

                        CASE WHEN (i % 3 = 0) THEN NULL 
                             ELSE (ARRAY['usr_aarav', 'usr_priya', 'usr_rohan', 'usr_sneha', 'usr_vikram', 'usr_ananya'])[1 + (i % 6)] 
                        END AS assignee_id,

                        (ARRAY['usr_aarav', 'usr_priya', 'usr_rohan', 'usr_sneha', 'usr_vikram', 'usr_ananya'])[1 + ((i + 2) % 6)] AS created_by_id,

                        (i % 5 = 0) AS requires_approval,

                        CASE 
                            WHEN (i % 5 != 0) THEN 'NOT_REQUIRED'
                            WHEN (i % 7 = 3) THEN 'APPROVED'
                            ELSE 'PENDING'
                        END AS approval_status,

                        1 + (i % 8) AS version,

                        NOW() - (i || ' minutes')::interval AS created_at,
                        NOW() - ((i % 120) || ' minutes')::interval AS updated_at

                    FROM generate_series(1, 10000) AS i;
                    """
                )
                seed_10k_duration = (time.perf_counter() - seed_10k_start) * 1000.0
                logger.info("Inserted 10,000 scale work items in %.2f ms!", seed_10k_duration)

                # Verify count
                await cur.execute("SELECT count(*) AS total FROM work_items;")
                total = (await cur.fetchone())["total"]
                logger.info("Total work items verified in database: %s", total)

    await close_pool()
    total_time = (time.perf_counter() - start_total) * 1000.0
    logger.info("Database seeding successfully completed in %.2f ms (%.2f seconds).", total_time, total_time / 1000.0)


if __name__ == "__main__":
    asyncio.run(seed_database())
