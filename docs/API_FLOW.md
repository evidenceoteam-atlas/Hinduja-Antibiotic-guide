# Mobile API Flow

The mobile UI in the reference screens is supported by these calls without changing the screen order.

1. `POST /api/v1/auth/send-otp`
2. `POST /api/v1/auth/verify-otp`
3. `GET /api/v1/mobile/dashboard`
4. `GET /api/v1/protocols`
5. User selects `setting`: `ICU` or `Ward`
6. User selects `acquisition`: `Community-acquired` or `Hospital-acquired`
7. `POST /api/v1/protocols/evaluate`
8. `GET /api/v1/protocols/result/{case_id}`
9. `GET /api/v1/protocols/{infection_code}/details`
10. `POST /api/v1/cases`
11. `POST /api/v1/reports/pdf`
12. `POST /api/v1/share/qr`
13. `POST /api/v1/share/link`
14. `GET /api/v1/alerts`

All JSON endpoints return:

```json
{
  "success": true,
  "message": "Human readable status",
  "data": {},
  "meta": {}
}
```

## Risk Assessment Payload

```json
{
  "infection_code": "UTI",
  "setting": "ICU",
  "acquisition": "Community-acquired",
  "risk_factors": [
    { "key": "hospital_contact_90d", "value": false },
    { "key": "recent_antibiotics_90d", "value": true },
    { "key": "invasive_device_or_procedure_90d", "value": false },
    { "key": "more_than_two_antibiotics_90d", "value": false },
    { "key": "comorbidities_or_immunodeficiency", "value": false }
  ]
}
```

