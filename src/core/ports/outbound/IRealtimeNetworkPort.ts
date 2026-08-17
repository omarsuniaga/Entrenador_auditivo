/**
 * Outbound Port: IRealtimeNetworkPort
 * Contract for real-time WebSocket communication, multiplayer matchmaking, and synchronized room events.
 */

import { MultiplayerRoom, PlayerState } from '../../entities/MultiplayerRoom';
import { TuningSystem, NoteScaleType } from '../../entities/MusicalNote';

export type MultiplayerEventCallback = (payload: any) => void;

export interface IRealtimeNetworkPort {
  connect(url?: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  createRoom(
    roomName: string,
    hostName: string,
    totalRounds: number,
    options?: {
      gameMode?: 'frequency' | 'notes';
      scaleType?: NoteScaleType;
      tuningSystem?: TuningSystem;
      a4Reference?: number;
    }
  ): Promise<string>;
  joinRoom(roomId: string, playerName: string): Promise<void>;
  leaveRoom(roomId: string): void;
  setReady(roomId: string, isReady: boolean): void;
  startMatch(roomId: string): void;
  submitGuess(
    roomId: string,
    submission: {
      userHz?: number;
      guessedNoteIndex?: number;
      guessedOctave?: number;
      responseTimeMs: number;
    }
  ): void;
  updateRoomSettings(
    roomId: string,
    settings: {
      gameMode?: 'frequency' | 'notes';
      scaleType?: NoteScaleType;
      tuningSystem?: TuningSystem;
      totalRounds?: number;
      a4Reference?: number;
    }
  ): void;
  requestNextRound(roomId: string): void;

  on(event: string, callback: MultiplayerEventCallback): void;
  off(event: string, callback: MultiplayerEventCallback): void;
}

