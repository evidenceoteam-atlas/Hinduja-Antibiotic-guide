# System Architecture

Hinduja Antibiotic Guide is scaffolded as independently scalable FastAPI services behind an NGINX or ingress gateway.

## Services

- Auth Service: OTP login, JWT issuance, refresh token rotation, device tracking, audit hooks.
- User Service: RBAC, departments, hospital mapping, permission matrix.
- Protocol Engine: JSON-driven decision tree, weighted risk scoring, recommendation reasoning, stewardship events.
- Antibiogram Service: organism, antibiotic, sensitivity, and resistance trend APIs.
- Guideline Service: draft/publish workflow and future OpenSearch indexing.
- Case Service: save, reopen, and share clinical recommendations.
- Report Service: PDF export with QR-friendly case links.
- Share Service: QR and deep-link generation.
- Alert Service: stewardship alert queues and acknowledgement.

## Production Notes

- PostgreSQL is the source of record. All clinical entities use UUIDs, timestamps, soft-delete fields, indexes, and foreign-key-ready models.
- Redis backs OTPs, rate limits, cache, and the event stream. Kafka can replace `EventBus` behind the same interface.
- OpenTelemetry, structured JSON logs, and Prometheus metrics are built into the service pattern.
- Rules live outside code in `rules/hinduja_protocols.json` so clinical governance can version protocols without code changes.
- `shared/ml/adapter.py` is the future handoff point for resistance prediction, ranking, NLP, or LLM-based ID assistance.

## Security Posture

The scaffold includes JWT auth, RBAC dependencies, rate-limit hooks, secure gateway headers, audit-log models, PHI-minimizing case records, and environment-based secrets. Production rollout should add managed secrets, mTLS between services, WAF policies, encrypted backups, and full audit retention policies.

