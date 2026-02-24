# Backend Services API Reference

All services run as Docker containers orchestrated by `docker-compose.yml`. Each service exposes a REST API on its configured port.

## Common

### Health Check

Every service exposes:

```
GET /health
```

**Response (200):**

```json
{
  "status": "ok",
  "service": "indexer",
  "timestamp": "2026-02-24T12:00:00.000Z",
  "uptime": 86400000
}
```

### Error Response Format

All error responses follow:

```json
{
  "error": "Human-readable error message"
}
```

---

## Indexer Service

**Port:** 3001 (configurable via `PORT_INDEXER`)

The indexer subscribes to on-chain program logs and stores parsed events. It provides a query API for event retrieval.

### GET /events

Query indexed on-chain events.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | - | Filter by event name (e.g., `MintEvent`, `BlacklistAddEvent`) |
| `limit` | number | 100 | Max results to return |
| `offset` | number | 0 | Pagination offset |

**Example:**

```bash
# All events, most recent first
curl http://localhost:3001/events

# Filter by event type
curl "http://localhost:3001/events?name=MintEvent&limit=10"

# Paginate
curl "http://localhost:3001/events?offset=100&limit=50"
```

**Response (200):**

```json
[
  {
    "id": 42,
    "name": "MintEvent",
    "signature": "5KjR...abc",
    "slot": 123456789,
    "authority": "Fg6P...xyz",
    "timestamp": 1709049600,
    "data": {
      "minter": "Fg6P...xyz",
      "recipient": "Hk9Q...def",
      "amount": "100000000",
      "remaining_quota": "900000000"
    },
    "created_at": "2026-02-24T12:00:00.000Z"
  }
]
```

**Event Names:**

| Name | Description |
|------|-------------|
| `InitializeEvent` | Stablecoin initialized |
| `MintEvent` | Tokens minted |
| `BurnEvent` | Tokens burned |
| `FreezeEvent` | Account frozen |
| `ThawEvent` | Account thawed |
| `PauseEvent` | System paused |
| `UnpauseEvent` | System unpaused |
| `MinterUpdatedEvent` | Minter added/removed/updated |
| `RoleUpdatedEvent` | Role assigned/revoked |
| `AuthorityProposedEvent` | Authority transfer proposed |
| `AuthorityAcceptedEvent` | Authority transfer accepted |
| `BlacklistAddEvent` | Address blacklisted |
| `BlacklistRemoveEvent` | Address removed from blacklist |
| `SeizeEvent` | Tokens seized |

---

## Mint-Burn Service

**Port:** 3002 (configurable via `PORT_MINT_BURN`)

Coordinates mint and burn operations via a request queue. Requests are stored in PostgreSQL and processed by a background executor. Uses Redis for job queuing.

### POST /mint

Create a mint request.

**Request Body:**

```json
{
  "amount": "100000000",
  "recipient": "Hk9Q...def",
  "configPda": "Abc1...xyz"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | string | Yes | Amount in base units (e.g., `"100000000"` for 100 tokens with 6 decimals) |
| `recipient` | string | Yes | Recipient token account address (base58) |
| `configPda` | string | Yes | StablecoinConfig PDA address (base58) |

**Response (201):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "pending"
}
```

**Error (400):**

```json
{
  "error": "Missing amount, recipient, or configPda"
}
```

### POST /burn

Create a burn request.

**Request Body:**

```json
{
  "amount": "50000000",
  "tokenAccount": "Xyz9...abc",
  "configPda": "Abc1...xyz"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | string | Yes | Amount in base units |
| `tokenAccount` | string | Yes | Token account to burn from (base58) |
| `configPda` | string | Yes | StablecoinConfig PDA address (base58) |

**Response (201):**

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "status": "pending"
}
```

### GET /requests/:id

Get the status of a specific mint/burn request.

**Response (200):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "action": "mint",
  "amount": "100000000",
  "recipient": "Hk9Q...def",
  "token_account": null,
  "status": "completed",
  "signature": "3xKr...sig",
  "error": null,
  "created_at": "2026-02-24T12:00:00.000Z",
  "updated_at": "2026-02-24T12:00:05.000Z"
}
```

**Status values:**

| Status | Description |
|--------|-------------|
| `pending` | Request queued, not yet processed |
| `processing` | Executor is building and sending the transaction |
| `completed` | Transaction confirmed on-chain |
| `failed` | Transaction failed; `error` field contains details |

**Error (404):**

```json
{
  "error": "Request not found"
}
```

### GET /requests

List all mint/burn requests with pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max results |
| `offset` | number | 0 | Pagination offset |

**Response (200):**

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "action": "mint",
    "amount": "100000000",
    "status": "completed",
    "signature": "3xKr...sig",
    "created_at": "2026-02-24T12:00:00.000Z"
  }
]
```

---

## Compliance Service

**Port:** 3003 (configurable via `PORT_COMPLIANCE`)

Manages the off-chain blacklist database, provides sanctions screening, and maintains the compliance audit log.

### POST /blacklist

Add an address to the blacklist.

**Request Body:**

```json
{
  "address": "Bad1...actor",
  "reason": "OFAC SDN match - Entity XYZ",
  "operator": "compliance-admin"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | string | Yes | Wallet address to blacklist (base58) |
| `reason` | string | Yes | Reason for blacklisting |
| `operator` | string | No | Operator identifier (default: `"system"`) |

**Response (201):**

```json
{
  "address": "Bad1...actor",
  "status": "blacklisted"
}
```

**Note:** This endpoint manages the off-chain database only. To enforce on-chain, call `add_to_blacklist` via the SDK or CLI separately. The compliance service can be extended to automate the on-chain call.

### DELETE /blacklist/:address

Remove an address from the blacklist (soft delete -- sets `active = false`).

**Response (200):**

```json
{
  "address": "Bad1...actor",
  "status": "removed"
}
```

### GET /blacklist

List blacklist entries.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max results |
| `offset` | number | 0 | Pagination offset |

**Response (200):**

```json
[
  {
    "address": "Bad1...actor",
    "reason": "OFAC SDN match - Entity XYZ",
    "blacklisted_by": "compliance-admin",
    "blacklisted_at": "2026-02-24T12:00:00.000Z",
    "active": true
  }
]
```

### POST /screen

Screen an address against configured screening providers.

**Request Body:**

```json
{
  "address": "New1...user"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | string | Yes | Wallet address to screen (base58) |

**Response (200):**

```json
{
  "address": "New1...user",
  "flagged": false,
  "source": "OFAC_SDN"
}
```

Flagged response:

```json
{
  "address": "Bad1...actor",
  "flagged": true,
  "source": "OFAC_SDN",
  "matchType": "exact",
  "details": "Matched against SDN list entry #12345"
}
```

### GET /audit-log

Query the compliance audit log.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `action` | string | - | Filter by action type (`blacklist_add`, `blacklist_remove`, `screen`, `seize`) |
| `limit` | number | 100 | Max results |
| `offset` | number | 0 | Pagination offset |

**Examples:**

```bash
# All audit entries
curl http://localhost:3003/audit-log

# Filter by action
curl "http://localhost:3003/audit-log?action=blacklist_add&limit=50"
```

**Response (200):**

```json
[
  {
    "id": 1,
    "action": "blacklist_add",
    "address": "Bad1...actor",
    "operator": "compliance-admin",
    "reason": "OFAC SDN match",
    "result": null,
    "created_at": "2026-02-24T12:00:00.000Z"
  },
  {
    "id": 2,
    "action": "screen",
    "address": "New1...user",
    "operator": null,
    "reason": null,
    "result": { "flagged": false, "source": "OFAC_SDN" },
    "created_at": "2026-02-24T12:05:00.000Z"
  }
]
```

---

## Webhook Service

**Port:** 3004 (configurable via `PORT_WEBHOOK`)

Manages webhook subscriptions and dispatches event payloads to registered endpoints.

### POST /subscriptions

Create a webhook subscription.

**Request Body:**

```json
{
  "url": "https://example.com/webhook",
  "events": ["MintEvent", "BlacklistAddEvent", "SeizeEvent"],
  "secret": "whsec_abc123..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Webhook delivery endpoint URL |
| `events` | string[] | No | Event types to subscribe to (default: all events) |
| `secret` | string | No | Shared secret for HMAC signature verification |

**Response (201):**

```json
{
  "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "url": "https://example.com/webhook",
  "events": ["MintEvent", "BlacklistAddEvent", "SeizeEvent"],
  "active": true
}
```

### GET /subscriptions

List all webhook subscriptions.

**Response (200):**

```json
[
  {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "url": "https://example.com/webhook",
    "events": ["MintEvent", "BlacklistAddEvent", "SeizeEvent"],
    "active": true,
    "created_at": "2026-02-24T12:00:00.000Z"
  }
]
```

### DELETE /subscriptions/:id

Delete a webhook subscription.

**Response (200):**

```json
{
  "deleted": true
}
```

**Error (404):**

```json
{
  "error": "Subscription not found"
}
```

### Webhook Payload Format

When an event matches a subscription, the service delivers a POST request to the subscribed URL:

```
POST https://example.com/webhook
Content-Type: application/json
X-SSS-Signature: sha256=abc123...  (if secret configured)
X-SSS-Event: MintEvent
X-SSS-Delivery: d4e5f6a7-b8c9-0123-def0-123456789abc
```

**Body:**

```json
{
  "id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
  "event": "MintEvent",
  "timestamp": "2026-02-24T12:00:00.000Z",
  "signature": "5KjR...abc",
  "data": {
    "authority": "Fg6P...xyz",
    "minter": "Fg6P...xyz",
    "recipient": "Hk9Q...def",
    "amount": "100000000",
    "remaining_quota": "900000000",
    "timestamp": 1709049600
  }
}
```

### Signature Verification

If a `secret` is provided during subscription creation, each delivery includes an `X-SSS-Signature` header computed as:

```
HMAC-SHA256(secret, request_body)
```

Verify on your end:

```typescript
import { createHmac } from "crypto";

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}
```

### Retry Policy

Failed deliveries (non-2xx response or timeout) are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 2 minutes |
| 4 | 10 minutes |
| 5 | 1 hour |

After 5 failed attempts, the delivery is marked as failed and the subscription is deactivated. Reactivate by creating a new subscription.

---

## Service Dependencies

```
                    +----------+
                    | postgres |
                    +----+-----+
                         |
         +---------------+---------------+
         |               |               |
    +----+----+    +-----+------+   +----+-----+
    | indexer  |    | mint-burn  |   |compliance|
    +----+----+    +-----+------+   +----+-----+
         |               |               |
         |          +----+----+          |
         |          |  redis  |          |
         |          +---------+          |
         |                               |
         +-------+-----------+-----------+
                 |           |
            +----+----+ +---+----+
            | webhook | |  RPC   |
            +---------+ +--------+
```

All services share the PostgreSQL database. Redis is used only by the mint-burn service for job queuing. The indexer connects directly to the Solana RPC node for log subscription.
