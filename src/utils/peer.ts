import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';

/**
 * Protocol version — bump when the message shape changes incompatibly.
 * Both peers must agree or the connection is dropped.
 */
export const PROTOCOL_VERSION = 1;

export type Role = 'host' | 'guest';
export type Color = 'black' | 'white';

export type Message =
  | { type: 'hello'; role: Role; version: number }
  | { type: 'start'; startingRole: Role }
  | { type: 'pick'; tile: number }
  | { type: 'result-flavor'; text: string }
  | { type: 'rematch' }
  | { type: 'bye' }
  | { type: 'ping' }
  | { type: 'pong' };

export type PeerStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

export interface PeerSession {
  role: Role;
  peerId: string;
  /** The peer ID of the OTHER side. For a host, known after guest connects. */
  remoteId: string | null;
  send: (msg: Message) => void;
  destroy: () => void;
  onMessage: (cb: (msg: Message) => void) => () => void;
  onStatus: (cb: (status: PeerStatus) => void) => () => void;
}

function makeShortId(): string {
  const hex = '0123456789abcdef';
  let s = 'mm-';
  for (let i = 0; i < 8; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

/**
 * Singleton registry keyed by session key. Survives React StrictMode double-mount
 * by reusing the same session for the same key.
 */
const sessions = new Map<string, PeerSession>();

interface InternalSession {
  peer: Peer;
  conn: DataConnection | null;
  status: PeerStatus;
  role: Role;
  peerId: string;
  remoteId: string | null;
  messageCallbacks: Set<(msg: Message) => void>;
  statusCallbacks: Set<(s: PeerStatus) => void>;
  pingTimer: ReturnType<typeof setInterval> | null;
  lastPongAt: number;
}

function attachConnection(internal: InternalSession, conn: DataConnection) {
  internal.conn = conn;
  internal.remoteId = conn.peer;

  conn.on('open', () => {
    setStatus(internal, 'connected');
    startHeartbeat(internal);
  });

  conn.on('data', (raw) => {
    let msg: Message | null = null;
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : (raw as Message);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'pong') {
      internal.lastPongAt = Date.now();
      return;
    }
    if (msg.type === 'ping') {
      sendRaw(internal, { type: 'pong' });
      return;
    }
    for (const cb of internal.messageCallbacks) cb(msg);
  });

  conn.on('close', () => setStatus(internal, 'disconnected'));
  conn.on('error', () => setStatus(internal, 'disconnected'));
}

function setStatus(internal: InternalSession, status: PeerStatus) {
  if (internal.status === status) return;
  internal.status = status;
  for (const cb of internal.statusCallbacks) cb(status);
  if (status === 'disconnected') stopHeartbeat(internal);
}

function sendRaw(internal: InternalSession, msg: Message) {
  if (internal.conn && internal.conn.open) internal.conn.send(msg);
}

function startHeartbeat(internal: InternalSession) {
  if (internal.pingTimer) return;
  internal.lastPongAt = Date.now();
  internal.pingTimer = setInterval(() => {
    if (!internal.conn || !internal.conn.open) return;
    sendRaw(internal, { type: 'ping' });
    // If we haven't heard a pong in 15s, consider the peer gone.
    if (Date.now() - internal.lastPongAt > 15000) {
      setStatus(internal, 'disconnected');
      try { internal.conn?.close(); } catch { /* ignore */ }
    }
  }, 5000);
}

function stopHeartbeat(internal: InternalSession) {
  if (internal.pingTimer) {
    clearInterval(internal.pingTimer);
    internal.pingTimer = null;
  }
}

function buildSession(internal: InternalSession, sessionKey: string): PeerSession {
  const session: PeerSession = {
    get role() { return internal.role; },
    get peerId() { return internal.peerId; },
    get remoteId() { return internal.remoteId; },
    send: (msg) => sendRaw(internal, msg),
    onMessage: (cb) => {
      internal.messageCallbacks.add(cb);
      return () => internal.messageCallbacks.delete(cb);
    },
    onStatus: (cb) => {
      internal.statusCallbacks.add(cb);
      // Replay current status so new subscribers aren't blind.
      cb(internal.status);
      return () => internal.statusCallbacks.delete(cb);
    },
    destroy: () => {
      stopHeartbeat(internal);
      try { internal.conn?.close(); } catch { /* ignore */ }
      try { internal.peer.destroy(); } catch { /* ignore */ }
      sessions.delete(sessionKey);
    },
  };
  return session;
}

/** Host: create a Peer, wait for an incoming connection.
 *  Keyed by just 'host' so React StrictMode double-mount reuses the same session. */
export function createHost(): PeerSession {
  const sessionKey = 'host';
  const existing = sessions.get(sessionKey);
  if (existing) return existing;
  const peerId = makeShortId();

  const peer = new Peer(peerId);
  const internal: InternalSession = {
    peer,
    conn: null,
    status: 'connecting',
    role: 'host',
    peerId,
    remoteId: null,
    messageCallbacks: new Set(),
    statusCallbacks: new Set(),
    pingTimer: null,
    lastPongAt: 0,
  };

  peer.on('open', () => {
    // Broker assigned our ID. Waiting for guest to connect.
  });

  peer.on('connection', (conn) => {
    // Only accept the first connection.
    if (internal.conn) {
      try { conn.close(); } catch { /* ignore */ }
      return;
    }
    attachConnection(internal, conn);
  });

  peer.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[peer:host] error', err);
    setStatus(internal, 'disconnected');
  });

  const session = buildSession(internal, sessionKey);
  sessions.set(sessionKey, session);
  return session;
}

/** Guest: create a Peer with a random ID, then dial the host. */
export function joinAsGuest(hostId: string): PeerSession {
  const sessionKey = `guest:${hostId}`;
  const existing = sessions.get(sessionKey);
  if (existing) return existing;

  const peer = new Peer();
  const internal: InternalSession = {
    peer,
    conn: null,
    status: 'connecting',
    role: 'guest',
    peerId: '', // assigned on 'open'
    remoteId: hostId,
    messageCallbacks: new Set(),
    statusCallbacks: new Set(),
    pingTimer: null,
    lastPongAt: 0,
  };

  peer.on('open', (id) => {
    internal.peerId = id;
    const conn = peer.connect(hostId, { reliable: true });
    attachConnection(internal, conn);
  });

  peer.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[peer:guest] error', err);
    setStatus(internal, 'disconnected');
  });

  const session = buildSession(internal, sessionKey);
  sessions.set(sessionKey, session);
  return session;
}

/** Debug / test helper: clear all sessions (e.g. in a beforeEach). */
export function __resetPeerSessions() {
  for (const s of sessions.values()) s.destroy();
  sessions.clear();
}
