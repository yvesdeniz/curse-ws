# curse-ws

A lightweight WebSocket relay that bridges the Discord bot ([curse](https://github.com/yvesdeniz/curse)) to real-time consumers such as dashboards.

## How It Works

The relay distinguishes two client roles, authenticated on the WebSocket upgrade:

- **Producer** — the bot. Sends event envelopes; cannot subscribe to topics.
- **Consumer** — dashboards or other clients. Subscribe to topics and receive matching events.

```
[curse bot] ---(WS, Bearer producer-secret)---> [curse-ws] ---(fan-out)---> [consumers]
```

### Connection & Auth

1. Client opens a WebSocket connection with an `Authorization: Bearer <secret>` header.
2. The relay checks the token against `WS_PRODUCER_SECRET` and `WS_CONSUMER_SECRET`.
3. Wrong or missing token → `401 Unauthorized` (HTTP, upgrade rejected).
4. On successful upgrade the client is assigned a role (`producer` or `consumer`).

---

## Protocol

### Producers

After connecting, producers send event envelopes as JSON:

```json
{
  "type": "member.join",
  "payload": { "guildId": "123456789", "userId": "987654321" },
  "ts": 1718000000000
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `string` | Event category, used for `type:` topic routing |
| `payload` | `object` | Arbitrary data; `payload.guildId` is used for `guild:` topic routing if present |
| `ts` | `number` | Unix timestamp in milliseconds |

Frames containing an `op` field are silently ignored (reserved for consumer control frames).

### Consumers

After connecting, consumers send control frames to manage their subscriptions:

**Subscribe**
```json
{ "op": "subscribe", "topics": ["guild:123456789", "type:member.join"] }
```

**Unsubscribe**
```json
{ "op": "unsubscribe", "topics": ["guild:123456789"] }
```

**Ping** (keep-alive response)
```json
{ "op": "ping" }
```
The server replies with `{ "op": "pong", "ts": <timestamp> }`.

### Topics

| Topic | Receives |
|---|---|
| `all` | Every event from every producer |
| `guild:<id>` | Events where `payload.guildId === id` |
| `type:<eventType>` | Events where `type === eventType` |

### Heartbeat

The server pings every consumer every **30 seconds**. Consumers should respond with `{ "op": "ping" }` to reset their liveness timer. Any consumer that hasn't responded within **60 seconds** is disconnected with close code `1001`.

---

## Setup

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0

### Environment Variables

Copy `.env.example` to `.env`:

```env
# Port the relay listens on (nginx proxies wss://websocket.cvrse.lol → this)
WS_PORT=3010

# Secret the bot sends as: Authorization: Bearer <WS_PRODUCER_SECRET>
WS_PRODUCER_SECRET=

# Secret dashboards/consumers send on upgrade
WS_CONSUMER_SECRET=
```

Both secrets are required — the process exits on startup if either is missing.

### Running

```bash
bun install
bun run start
```

The relay binds to `127.0.0.1:<WS_PORT>` and is intended to sit behind an nginx proxy.

### Type-checking

```bash
bun run typecheck
```

---

## Project Structure

```
src/
  index.ts   — Entry point; Bun.serve, auth, role assignment on upgrade
  server.ts  — WebSocket lifecycle handlers (open/message/close) and heartbeat
  router.ts  — Consumer registry and topic-based fan-out logic
  types.ts   — Shared TypeScript interfaces (WsEnvelope, ControlMessage, ClientData)
```
