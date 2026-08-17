/**
 * Infrastructure Adapter: WebSocketClientAdapter
 * Implements IRealtimeNetworkPort connecting the React UI to the server WebSocket engine.
 */

import { IRealtimeNetworkPort, MultiplayerEventCallback } from '../../core/ports/outbound/IRealtimeNetworkPort';

export class WebSocketClientAdapter implements IRealtimeNetworkPort {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<MultiplayerEventCallback>> = new Map();
  private isConnecting: boolean = false;
  private reconnectTimer: any = null;
  private activeRoomId: string | null = null;
  private activePlayerName: string | null = null;

  constructor() {
    // Persist the server-issued session token whenever we (re)join a room, so a later
    // reconnect can prove ownership of the seat instead of relying on the playerId alone.
    this.on('ROOM_CREATED', (data: any) => this.persistSessionToken(data));
    this.on('JOINED_ROOM', (data: any) => this.persistSessionToken(data));
    try {
      this.activeRoomId = sessionStorage.getItem('audiofit_active_room_id');
      this.activePlayerName = sessionStorage.getItem('audiofit_active_player_name');
    } catch {}
  }

  private persistSessionToken(data: any) {
    if (data?.sessionToken) {
      try {
        sessionStorage.setItem('audiofit_session_token', data.sessionToken);
      } catch {
        // Ignored — storage unavailable (private mode, quota); reconnect will just re-join as a new seat.
      }
    }
  }

  private getSessionToken(): string | undefined {
    try {
      return sessionStorage.getItem('audiofit_session_token') || undefined;
    } catch {
      return undefined;
    }
  }

  async connect(url?: string): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url || `${protocol}//${window.location.host}/ws`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.emitLocal('CONNECTED', {});
          if (this.activeRoomId && this.activePlayerName) {
            this.send('JOIN_ROOM', {
              roomId: this.activeRoomId,
              playerName: this.activePlayerName,
              playerId: this.getOrCreatePlayerId(),
              sessionToken: this.getSessionToken()
            });
          }
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type) {
              this.emitLocal(parsed.type, parsed.data || parsed);
            }
          } catch (e) {
            console.error('Failed to parse WS payload:', e);
          }
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.emitLocal('DISCONNECTED', {});
          this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
          this.isConnecting = false;
          this.emitLocal('ERROR', { error: err });
          reject(err);
        };
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // will retry on next schedule
      });
    }, 3000);
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private send(type: string, data: any = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn('Cannot send WS message: not connected');
    }
  }

  async createRoom(
    roomName: string,
    hostName: string,
    totalRounds: number,
    options: {
      gameMode?: 'frequency' | 'notes';
      scaleType?: 'chromatic' | 'diatonic';
      tuningSystem?: '12tet' | 'pythagorean' | 'just';
      a4Reference?: number;
    } = {}
  ): Promise<string> {
    await this.ensureConnected();
    const playerId = this.getOrCreatePlayerId();
    this.send('CREATE_ROOM', {
      roomName,
      hostName,
      totalRounds,
      playerId,
      gameMode: options.gameMode || 'frequency',
      scaleType: options.scaleType || 'chromatic',
      tuningSystem: options.tuningSystem || '12tet',
      a4Reference: options.a4Reference || 440
    });

    return new Promise((resolve) => {
      const handler = (data: any) => {
        this.off('ROOM_CREATED', handler);
        this.setActiveRoom(data.roomId, hostName);
        resolve(data.roomId);
      };
      this.on('ROOM_CREATED', handler);
    });
  }

  updateRoomSettings(
    roomId: string,
    settings: {
      gameMode?: 'frequency' | 'notes';
      scaleType?: 'chromatic' | 'diatonic';
      tuningSystem?: '12tet' | 'pythagorean' | 'just';
      totalRounds?: number;
      a4Reference?: number;
    }
  ): void {
    this.send('UPDATE_ROOM_SETTINGS', { roomId, ...settings });
  }

  async joinRoom(roomId: string, playerName: string): Promise<void> {
    await this.ensureConnected();
    const playerId = this.getOrCreatePlayerId();
    this.send('JOIN_ROOM', { roomId, playerName, playerId, sessionToken: this.getSessionToken() });
    this.setActiveRoom(roomId, playerName);
  }

  leaveRoom(roomId: string): void {
    this.send('LEAVE_ROOM', { roomId });
    this.clearActiveRoom();
  }

  setReady(roomId: string, isReady: boolean): void {
    this.send('SET_READY', { roomId, isReady });
  }

  startMatch(roomId: string): void {
    this.send('START_MATCH', { roomId });
  }

  submitGuess(
    roomId: string,
    submission: {
      userHz?: number;
      guessedNoteIndex?: number;
      guessedOctave?: number;
      responseTimeMs: number;
    }
  ): void {
    this.send('SUBMIT_GUESS', { roomId, ...submission });
  }

  requestNextRound(roomId: string): void {
    this.send('NEXT_ROUND', { roomId });
  }

  restartGame(roomId: string): void {
    this.send('RESTART_GAME', { roomId });
  }

  playSyncTarget(roomId: string): void {
    this.send('PLAY_SYNC_TARGET', { roomId });
  }

  sendPing(clientTimestamp: number): void {
    this.send('PING', { clientTimestamp });
  }

  on(event: string, callback: MultiplayerEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: MultiplayerEventCallback): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emitLocal(event: string, payload: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(cb => cb(payload));
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }
  }

  private getOrCreatePlayerId(): string {
    let pid = sessionStorage.getItem('audiofit_player_id');
    if (!pid) {
      pid = `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      sessionStorage.setItem('audiofit_player_id', pid);
    }
    return pid;
  }

  private setActiveRoom(roomId: string, playerName: string): void {
    this.activeRoomId = roomId;
    this.activePlayerName = playerName;
    try {
      sessionStorage.setItem('audiofit_active_room_id', roomId);
      sessionStorage.setItem('audiofit_active_player_name', playerName);
    } catch {}
  }

  private clearActiveRoom(): void {
    this.activeRoomId = null;
    this.activePlayerName = null;
    try {
      sessionStorage.removeItem('audiofit_active_room_id');
      sessionStorage.removeItem('audiofit_active_player_name');
    } catch {}
  }
}

export const realtimeNetworkAdapter = new WebSocketClientAdapter();
