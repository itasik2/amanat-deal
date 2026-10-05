# Notify KZ integration

`/notifications` uses the authenticated account to create a short-lived hosted Notify connection.
Configure server-only NOTIFY_KZ_API_URL, NOTIFY_KZ_INTEGRATION_KEY and NOTIFY_DISPATCH_SECRET.
Do not expose these values to the web application or production credentials to preview deployments.

A trusted scheduler calls GET /api/v1/internal/automation/notifications with Bearer NOTIFY_DISPATCH_SECRET every 30 seconds.
There are no detached tasks and deal mutations never wait for Notify. DealEvent is the durable source journal.
Each pass processes up to 10 journal rows with a time budget; cursor advancement follows all recipient acknowledgments.
Notify deduplicates by integration + event ID + recipient. Network failure leaves the cursor unadvanced.
Copy is deliberately immutable and generic; no evidence, invitation tokens, or mutable deal terms are sent.
Mock payment events explicitly state that no real money moved.

For this pilot, the bounded scanner wraps to integration creation time when it reaches the end.
This catches late-committing transactions with old timestamps without losing events; replay is idempotent.
Consequently backlog size increases latency. Before high-volume rollout replace cyclic scanning with an
outbox row created in the same transaction as DealEvent and a leased delivery worker; do not simply remove
reconciliation and assume createdAt is commit order. Events before integration creation are excluded.
A recipient without opt-in is recorded as skipped and does not receive historical events after opting in.

Production scheduler: Supabase pg_cron/pg_net can call the endpoint; store the dispatch secret in Vault,
not in cron.job.command. Monitor net._http_response for HTTP failures and Notify IntegrationEvent for outcomes.
WhatsApp events require an approved utility template; a successful hello_world test alone is insufficient.

Verification: build API, then npm test -w apps/api. Tests mock HTTP and never send real notifications.
Manual pilot: two authenticated users opt in, test their own channels, create/join/accept a mock deal,
advance mock funding/shipment/inspection/completion, compare Notify history to the deal journal, then
replay the scheduler and verify no extra notifications. Unsubscribe and repeat a new event to verify skip.
