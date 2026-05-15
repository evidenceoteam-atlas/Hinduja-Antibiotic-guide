# Hinduja Antibiotic Guide

Production-oriented backend scaffold for the Hinduja Antibiotic Guide clinical decision support platform. The API supports the exact reference mobile flow: OTP login, dashboard metadata, infection selection, setting/acquisition/risk assessment, auto-classification, protocol result, details, save/export/share, and stewardship alerts.

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

Gateway URL:

```text
http://localhost:8080/api/v1
```

Key docs:

- [Architecture](docs/ARCHITECTURE.md)
- [Mobile API Flow](docs/API_FLOW.md)
- [Seed Data](docs/SEED_DATA.md)

## Example Evaluation

```bash
curl -X POST http://localhost:8080/api/v1/protocols/evaluate \
  -H 'Content-Type: application/json' \
  -d '{
    "infection_code": "UTI",
    "setting": "ICU",
    "acquisition": "Community-acquired",
    "risk_factors": [
      {"key": "hospital_contact_90d", "value": false},
      {"key": "recent_antibiotics_90d", "value": true},
      {"key": "invasive_device_or_procedure_90d", "value": false},
      {"key": "more_than_two_antibiotics_90d", "value": false},
      {"key": "comorbidities_or_immunodeficiency", "value": false}
    ]
  }'
```

## Repository Layout

```text
services/       Independently deployable FastAPI services
shared/         Database, auth, schemas, event bus, clinical rules, ML/search adapters
rules/          JSON-driven clinical protocol configuration
infra/          Docker, NGINX, Kubernetes, Helm, monitoring
docs/           Integration and architecture notes
tests/          Unit and integration-style tests
```

Clinical note: seeded recommendations are implementation examples and must be clinically reviewed and approved before production use.

