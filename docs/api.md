# API draft v0.1

## Deals

```http
POST /api/v1/deals
GET /api/v1/deals/:id
POST /api/v1/deals/:id/accept
POST /api/v1/deals/:id/mock-payment
POST /api/v1/deals/:id/shipment
POST /api/v1/deals/:id/mark-delivered
POST /api/v1/deals/:id/confirm-receipt
POST /api/v1/deals/:id/report-problem
GET /api/v1/deals/:id/events
```

## Admin

```http
GET /api/v1/admin/deals
GET /api/v1/admin/deals/:id
```

## Webhooks, later

```http
POST /api/v1/webhooks/bank
POST /api/v1/webhooks/delivery
```
