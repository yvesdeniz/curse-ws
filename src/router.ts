import type { ServerWebSocket } from 'bun';
import type { ClientData, WsEnvelope } from './types';

const consumers = new Set<ServerWebSocket<ClientData>>();

export function addConsumer(ws: ServerWebSocket<ClientData>): void {
  consumers.add(ws);
}

export function removeConsumer(ws: ServerWebSocket<ClientData>): void {
  consumers.delete(ws);
}

export function allConsumers(): IterableIterator<ServerWebSocket<ClientData>> {
  return consumers.values();
}

export function fanOut(envelope: WsEnvelope): void {
  const guildId = typeof envelope.payload?.guildId === 'string' ? envelope.payload.guildId : null;
  const raw = JSON.stringify(envelope);

  for (const ws of consumers) {
    const { topics } = ws.data;
    if (
      topics.has('all') ||
      (guildId !== null && topics.has(`guild:${guildId}`)) ||
      topics.has(`type:${envelope.type}`)
    ) {
      ws.send(raw);
    }
  }
}
