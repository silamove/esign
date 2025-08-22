# Docker and Operations

Services:
- nginx: reverse proxy, TLS, headers
- backend: Node API (uses Postgres, TSA)
- tsa: sigstore timestamp-server (dev default signer)
- postgres: optional local container (profile: db)

Configuration:
- Set UPLOADS_DIR for file storage path
- DB env vars (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)
- TSA_URL and TSA_PROVIDER

Commands:
- docker compose up -d --build
- docker compose --profile db up -d
