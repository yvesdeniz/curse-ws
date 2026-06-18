import type { ClientData } from './types';
import { close, message, open, startHeartbeat } from './server';

const port = Number(process.env.WS_PORT ?? 3010);
const producerSecret = process.env.WS_PRODUCER_SECRET;
const consumerSecret = process.env.WS_CONSUMER_SECRET;

if (!producerSecret || !consumerSecret) {
  console.error('WS_PRODUCER_SECRET and WS_CONSUMER_SECRET must be set.');
  process.exit(1);
}

Bun.serve<ClientData>({
  port,
  hostname: '127.0.0.1',

  fetch(req, server) {
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    let role: 'producer' | 'consumer';
    if (token === producerSecret) {
      role = 'producer';
    } else if (token === consumerSecret) {
      role = 'consumer';
    } else {
      return new Response('Unauthorized', { status: 401 });
    }

    const data: ClientData = { role, topics: new Set(), lastPong: Date.now() };
    const upgraded = server.upgrade(req, { data });
    if (upgraded) return undefined;
    return new Response('Expected WebSocket upgrade', { status: 426 });
  },

  websocket: { open, message, close },
});

startHeartbeat();

console.log(`curse-ws relay listening on 127.0.0.1:${port}`);
