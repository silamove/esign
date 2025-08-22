# Migration Guide: SQLite to PostgreSQL

- Apply migrations 001..012
- Validate with backend/scripts/validate-migration.js
- Use compatibility views during transition
- Update models (Envelope.js, Document.js, Template*)
- Run seeders (seed-users, seed-documents, seed-envelope-e2e)
- Verify signature_evidences and audit_events populated
