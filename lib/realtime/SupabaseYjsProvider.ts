import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { toBase64, fromBase64 } from "./encoding";
import type { ConnectionState } from "@/store/slices/collaborationSlice";

const REMOTE_ORIGIN = Symbol("orbit-remote-update");
const AWARENESS_THROTTLE_MS = 120;
const SYNC_TIMEOUT_MS = 1200;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

export interface LocalUser {
  id: string;
  name: string;
  color: string;
}

interface SupabaseYjsProviderOptions {
  supabase: SupabaseClient;
  fileId: string;
  doc: Y.Doc;
  awareness: Awareness;
  localUser: LocalUser;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onInitialSyncSettled?: (receivedPeerState: boolean) => void;
}

export class SupabaseYjsProvider {
  private supabase: SupabaseClient;
  private fileId: string;
  private doc: Y.Doc;
  private awareness: Awareness;
  private localUser: LocalUser;
  private onConnectionStateChange?: (state: ConnectionState) => void;
  private onInitialSyncSettled?: (receivedPeerState: boolean) => void;
  private initialSyncSettledFired = false;

  private channel: RealtimeChannel | null = null;
  private destroyed = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private awarenessThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAwarenessClients = new Set<number>();

  constructor(options: SupabaseYjsProviderOptions) {
    this.supabase = options.supabase;
    this.fileId = options.fileId;
    this.doc = options.doc;
    this.awareness = options.awareness;
    this.localUser = options.localUser;
    this.onConnectionStateChange = options.onConnectionStateChange;
    this.onInitialSyncSettled = options.onInitialSyncSettled;

    this.handleDocUpdate = this.handleDocUpdate.bind(this);
    this.handleAwarenessUpdate = this.handleAwarenessUpdate.bind(this);

    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);
    this.awareness.setLocalStateField("user", this.localUser);

    this.connect();
  }

  private setConnectionState(state: ConnectionState) {
    this.onConnectionStateChange?.(state);
  }

  private connect() {
    if (this.destroyed) return;
    this.setConnectionState(this.reconnectAttempt > 0 ? "reconnecting" : "syncing");

    const channel = this.supabase.channel(`file-${this.fileId}`, {
      config: {
        private: true,
        broadcast: { self: false, ack: false },
      },
    });

    channel.on("broadcast", { event: "yjs-update" }, ({ payload }) => {
      if (!payload?.update) return;
      Y.applyUpdate(this.doc, fromBase64(payload.update), REMOTE_ORIGIN);
    });

    channel.on("broadcast", { event: "awareness-update" }, ({ payload }) => {
      if (!payload?.update) return;
      applyAwarenessUpdate(this.awareness, fromBase64(payload.update), REMOTE_ORIGIN);
    });

    channel.on("broadcast", { event: "sync-request" }, ({ payload }) => {
      if (!payload?.stateVector) return;
      const theirSv = fromBase64(payload.stateVector);
      const diff = Y.encodeStateAsUpdate(this.doc, theirSv);
      if (diff.length > 0) {
        channel.send({
          type: "broadcast",
          event: "sync-reply",
          payload: { update: toBase64(diff) },
        });
      }
    });

    channel.on("broadcast", { event: "sync-reply" }, ({ payload }) => {
      if (!payload?.update) return;
      Y.applyUpdate(this.doc, fromBase64(payload.update), REMOTE_ORIGIN);
      this.fireInitialSyncSettled(true);
      this.markSynced();
    });

    channel.subscribe((status) => {
      if (this.destroyed) return;

      if (status === "SUBSCRIBED") {
        this.reconnectAttempt = 0;
        this.requestSync();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.setConnectionState("offline");
        this.scheduleReconnect();
      }
    });

    this.channel = channel;
  }

  private requestSync() {
    if (!this.channel) return;
    this.channel.send({
      type: "broadcast",
      event: "sync-request",
      payload: { stateVector: toBase64(Y.encodeStateVector(this.doc)) },
    });

    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.fireInitialSyncSettled(false);
      this.markSynced();
    }, SYNC_TIMEOUT_MS);
  }

  private fireInitialSyncSettled(receivedPeerState: boolean) {
    if (this.initialSyncSettledFired) return;
    this.initialSyncSettledFired = true;
    this.onInitialSyncSettled?.(receivedPeerState);
  }

  private markSynced() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.setConnectionState("synced");
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed) return;
      this.teardownChannel();
      this.connect();
    }, delay);
  }

  private handleDocUpdate(update: Uint8Array, origin: unknown) {
    if (origin === REMOTE_ORIGIN || !this.channel) return;
    this.channel.send({
      type: "broadcast",
      event: "yjs-update",
      payload: { update: toBase64(update) },
    });
  }

  private handleAwarenessUpdate(
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) {
    if (origin === REMOTE_ORIGIN) return;
    for (const clientId of [...added, ...updated, ...removed]) {
      this.pendingAwarenessClients.add(clientId);
    }
    if (this.awarenessThrottleTimer) return;
    this.awarenessThrottleTimer = setTimeout(() => {
      this.awarenessThrottleTimer = null;
      this.flushAwareness();
    }, AWARENESS_THROTTLE_MS);
  }

  private flushAwareness() {
    if (!this.channel || this.pendingAwarenessClients.size === 0) return;
    const clientIds = Array.from(this.pendingAwarenessClients);
    this.pendingAwarenessClients.clear();
    const update = encodeAwarenessUpdate(this.awareness, clientIds);
    this.channel.send({
      type: "broadcast",
      event: "awareness-update",
      payload: { update: toBase64(update) },
    });
  }

  private teardownChannel() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  destroy() {
    this.destroyed = true;

    if (this.syncTimer) clearTimeout(this.syncTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.awarenessThrottleTimer) clearTimeout(this.awarenessThrottleTimer);

    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.awareness.setLocalState(null);

    this.teardownChannel();
  }
}
