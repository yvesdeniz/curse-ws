import type { ServerWebSocket } from 'bun';
import type { ClientData, ControlMessage, WsEnvelope } from './types';
import { addConsumer, allConsumers, fanOut, removeConsumer } from './router';

const HEARTBEAT_INTERVAL_MS = 30_000;

export function open(ws: ServerWebSocket<ClientData>): void {
  ws.data.lastPong = Date.now();
  if (ws.data.role === 'consumer') {
    addConsumer(ws);
  }
}

export function message(ws: ServerWebSocket<ClientData>, raw: string | Buffer): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
  } catch {
    return;
  }

  if (typeof parsed !== 'object' || parsed === null) return;
  const msg = parsed as Record<string, unknown>;

  if (ws.data.role === 'producer') {
    // Control frames from producers are ignored; only accept event envelopes
    if ('op' in msg) return;
    if (typeof msg.type !== 'string' || typeof msg.ts !== 'number') return;
    fanOut(msg as unknown as WsEnvelope);
    return;
  }

  // Consumer: only handle control frames
  if (!('op' in msg)) return;
  const ctrl = msg as unknown as ControlMessage;

  if (ctrl.op === 'subscribe' && Array.isArray(ctrl.topics)) {
    for (const t of ctrl.topics) {
      if (typeof t === 'string') ws.data.topics.add(t);
    }
    return;
  }

  if (ctrl.op === 'unsubscribe' && Array.isArray(ctrl.topics)) {
    for (const t of ctrl.topics) {
      if (typeof t === 'string') ws.data.topics.delete(t);
    }
    return;
  }

  if (ctrl.op === 'ping') {
    ws.data.lastPong = Date.now();
    ws.send(JSON.stringify({ op: 'pong', ts: Date.now() }));
    return;
  }
}

export function close(ws: ServerWebSocket<ClientData>): void {
  if (ws.data.role === 'consumer') {
    removeConsumer(ws);
  }
}

export function startHeartbeat(): void {
  setInterval(() => {
    const now = Date.now();
    for (const ws of allConsumers()) {
      if (now - ws.data.lastPong > HEARTBEAT_INTERVAL_MS * 2) {
        ws.close(1001, 'heartbeat timeout');
        continue;
      }
      ws.send(JSON.stringify({ op: 'ping', ts: now }));
    }
  }, HEARTBEAT_INTERVAL_MS);
}
