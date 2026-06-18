export interface WsEnvelope {
  type: string;
  payload: Record<string, unknown>;
  ts: number;
}

export interface ControlMessage {
  op: 'subscribe' | 'unsubscribe' | 'ping';
  topics?: string[];
}

export interface ClientData {
  role: 'producer' | 'consumer';
  topics: Set<string>;
  lastPong: number;
}
