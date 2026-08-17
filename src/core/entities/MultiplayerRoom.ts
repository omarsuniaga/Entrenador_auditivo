/**
 * Domain Entity: MultiplayerRoom
 * Represents real-time synchronized pitch duel competition.
 */

import { NoteApproximationAnalysis, TuningSystem, NoteScaleType } from './MusicalNote';

export interface PlayerState {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  score: number;
  totalAccuracy: number;
  roundsPlayed: number;
  roundsWon?: number;
  averageDeviationHz?: number;
  currentRoundSubmission?: {
    userHz?: number;
    deviationHz?: number;
    deviationCents?: number;
    accuracyPercentage: number;
    responseTimeMs: number;
    pointsEarned: number;
    isRoundWinner?: boolean;
    guessedNoteIndex?: number;
    guessedOctave?: number;
    guessedFullName?: string;
    isExactNoteMatch?: boolean;
    isCorrectPitchClass?: boolean;
    feedbackMessage?: string;
  };
  isReady: boolean;
  connected: boolean;
  hasSubmitted?: boolean;
}

export type RoomStatus = 'lobby' | 'countdown' | 'playing' | 'round_result' | 'game_over';

export interface MultiplayerRoundData {
  roundNumber: number;
  targetHz?: number;
  theoreticalHz?: number;
  noteAnalysis?: NoteApproximationAnalysis;
  durationMs: number;
  audioDurationMs?: number;
  scheduledPlayTime?: number;
  startedAt: number;
}

export class MultiplayerRoom {
  public readonly id: string;
  public readonly name: string;
  public hostId: string;
  public gameMode: 'frequency' | 'notes';
  public scaleType: NoteScaleType;
  public tuningSystem: TuningSystem;
  public a4Reference: number;
  public players: Map<string, PlayerState> = new Map();
  public totalRounds: number;
  public currentRoundNumber: number = 0;
  public currentRound?: MultiplayerRoundData;
  public status: RoomStatus = 'lobby';
  public roundHistory: Array<{
    roundNumber: number;
    targetHz: number;
    noteAnalysis?: NoteApproximationAnalysis;
    winnerPlayerId?: string;
    winnerPlayerName?: string;
    submissions: Array<{
      playerId: string;
      playerName: string;
      userHz?: number;
      guessedFullName?: string;
      deviationHz?: number;
      deviationCents?: number;
      accuracyPercentage: number;
      pointsEarned: number;
      isRoundWinner: boolean;
      isExactNoteMatch?: boolean;
    }>;
  }> = [];

  constructor(
    id: string,
    name: string,
    hostId: string,
    totalRounds: number = 5,
    options: {
      gameMode?: 'frequency' | 'notes';
      scaleType?: NoteScaleType;
      tuningSystem?: TuningSystem;
      a4Reference?: number;
    } = {}
  ) {
    this.id = id;
    this.name = name;
    this.hostId = hostId;
    this.totalRounds = totalRounds;
    this.gameMode = options.gameMode || 'frequency';
    this.scaleType = options.scaleType || 'chromatic';
    this.tuningSystem = options.tuningSystem || '12tet';
    this.a4Reference = options.a4Reference || 440;
  }


  addPlayer(player: PlayerState): void {
    this.players.set(player.id, player);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    if (this.hostId === playerId && this.players.size > 0) {
      // Reassign host to next player
      const nextHost = this.players.keys().next().value;
      if (nextHost) {
        this.hostId = nextHost;
        const player = this.players.get(nextHost);
        if (player) player.isHost = true;
      }
    }
  }

  getPlayer(playerId: string): PlayerState | undefined {
    return this.players.get(playerId);
  }

  get playersList(): PlayerState[] {
    return Array.from(this.players.values()).sort((a, b) => b.score - a.score);
  }

  allPlayersSubmitted(): boolean {
    if (this.players.size === 0) return false;
    for (const player of this.players.values()) {
      if (player.connected && !player.currentRoundSubmission) {
        return false;
      }
    }
    return true;
  }

  calculateRoundPoints(accuracyPercentage: number, responseTimeMs: number): number {
    // Base points on accuracy: 0-1000
    const accuracyPoints = Math.round((accuracyPercentage / 100) * 1000);
    // Speed bonus: up to 300 points if answered within 5 seconds
    const speedBonus = Math.max(0, Math.round(300 * (1 - responseTimeMs / 10000)));
    return accuracyPoints + speedBonus;
  }

  toClientJSON() {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      players: this.playersList,
      totalRounds: this.totalRounds,
      currentRoundNumber: this.currentRoundNumber,
      currentRound: this.currentRound ? {
        roundNumber: this.currentRound.roundNumber,
        durationMs: this.currentRound.durationMs,
        startedAt: this.currentRound.startedAt
        // Note: targetHz is purposefully omitted or revealed only at round_result!
      } : null,
      status: this.status,
      roundHistory: this.roundHistory
    };
  }
}
