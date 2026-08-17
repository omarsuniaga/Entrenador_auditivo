import {
  createInitialRoom,
  joinRoom,
  canStartMatch,
  beginCountdown,
  startRound,
  submitGuess,
  allPlayersSubmitted,
  evaluateRoundResults,
  advanceOrFinish,
  restartGame,
  markPlayerDisconnected,
  leaveRoom,
  finalizeExpiredDisconnects,
  nextAlarmTime,
  getPublicRoomState,
  buildDuelPersistenceRows,
  DuelRoomState,
  DISCONNECT_GRACE_MS,
  SYNC_LEAD_MS,
  SAMPLE_AUDIO_MS,
  RETENTION_WAIT_MS
} from '../worker/duel/roomState.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const NOW = 1_000_000;

function freshRoom(now = NOW): DuelRoomState {
  return createInitialRoom(
    { roomId: 'ABCDE', name: 'Duelo de prueba', hostId: 'ana', hostName: 'Ana', hostAuthenticated: true, totalRounds: 3, now },
    'host-token'
  );
}

function withTwoPlayers(now = NOW): DuelRoomState {
  const room = freshRoom(now);
  joinRoom(room, { playerId: 'beto', name: 'Beto', authenticated: true }, 'beto-token');
  room.players.ana.isReady = true;
  room.players.beto.isReady = true;
  return room;
}

function playingRoom(now = NOW): DuelRoomState {
  const room = withTwoPlayers(now);
  startRound(room, now);
  return room;
}

const tests: Array<{ name: string; fn: () => void }> = [
  {
    name: 'createInitialRoom seeds a lobby with the host as the only ready player',
    fn: () => {
      const room = freshRoom();
      assert(room.status === 'lobby', 'A new room starts in lobby.');
      assert(Object.keys(room.players).length === 1, 'Only the host is seated at creation.');
      assert(room.players.ana.isHost && room.players.ana.isReady, 'The host starts ready.');
      assert(room.totalRounds === 3, 'totalRounds is clamped/kept as requested.');
    }
  },
  {
    name: 'joinRoom seats a second player and rejects a full room',
    fn: () => {
      const room = freshRoom();
      const result = joinRoom(room, { playerId: 'beto', name: 'Beto', authenticated: false }, 'beto-token');
      assert(result.ok && result.player?.id === 'beto', 'A free seat must be granted.');

      const third = joinRoom(room, { playerId: 'caro', name: 'Caro', authenticated: false }, 'caro-token');
      assert(!third.ok && third.reason === 'room-full', 'A third player cannot join a 2-seat duel.');
    }
  },
  {
    name: 'joinRoom reconnection requires the original session token',
    fn: () => {
      const room = withTwoPlayers();
      room.players.beto.connected = false;

      const wrongToken = joinRoom(room, { playerId: 'beto', name: 'Beto', sessionToken: 'not-the-token', authenticated: true }, 'ignored');
      assert(!wrongToken.ok && wrongToken.reason === 'seat-taken', 'A mismatched token must not reclaim the seat.');

      const rightToken = joinRoom(room, { playerId: 'beto', name: 'Beto', sessionToken: 'beto-token', authenticated: true }, 'ignored');
      assert(rightToken.ok && rightToken.player?.connected === true, 'The original token must reconnect the seat.');
    }
  },
  {
    name: 'joinRoom refuses a brand-new player once the duel is in progress',
    fn: () => {
      const room = playingRoom();
      const result = joinRoom(room, { playerId: 'stranger', name: 'Nadie', authenticated: false }, 'token');
      assert(!result.ok && result.reason === 'room-in-progress', 'A new seat cannot appear mid-duel.');
    }
  },
  {
    name: 'canStartMatch requires the host, two connected players, and everyone ready',
    fn: () => {
      const room = freshRoom();
      assert(!canStartMatch(room, 'ana'), 'One player cannot start a duel.');
      joinRoom(room, { playerId: 'beto', name: 'Beto', authenticated: false }, 'beto-token');
      assert(!canStartMatch(room, 'ana'), 'A not-ready second player blocks the start.');
      room.players.beto.isReady = true;
      assert(canStartMatch(room, 'ana'), 'Two ready connected players lets the host start.');
      assert(!canStartMatch(room, 'beto'), 'Only the host may start the match.');
    }
  },
  {
    name: 'startRound schedules SYNCING -> SAMPLE -> RETENTION -> TUNING as one absolute timeline',
    fn: () => {
      const room = withTwoPlayers();
      startRound(room, NOW);
      const round = room.currentRound!;
      assert(round.scheduledPlayTime === NOW + SYNC_LEAD_MS, 'Sync lead must precede tone playback.');
      assert(round.tuningStartTime === round.scheduledPlayTime + SAMPLE_AUDIO_MS + RETENTION_WAIT_MS, 'Tuning opens only after sample + retention.');
      assert(round.tuningDeadline === round.tuningStartTime + round.tuningDurationMs, 'Deadline is tuningStart + tuning duration.');
      assert(room.status === 'playing', 'startRound moves the room into playing.');
    }
  },
  {
    name: 'submitGuess rejects answers sent before tuning unlocks and measures from tuningStartTime',
    fn: () => {
      const room = playingRoom();
      const tooEarly = submitGuess(room, 'ana', { userHz: 440 }, room.currentRound!.tuningStartTime - 1);
      assert(!tooEarly, 'A guess before tuningStartTime must be rejected.');

      const submitAt = room.currentRound!.tuningStartTime + 1200;
      const ok = submitGuess(room, 'ana', { userHz: 440 }, submitAt);
      assert(ok, 'A guess after tuning opens must be accepted.');
      assert(room.players.ana.currentRoundSubmission!.responseTimeMs === 1200, 'Response time is measured from tuningStartTime, not round start.');

      const duplicate = submitGuess(room, 'ana', { userHz: 441 }, submitAt + 10);
      assert(!duplicate, 'A player cannot submit twice in the same round.');
    }
  },
  {
    name: 'evaluateRoundResults picks the closest frequency and records score history',
    fn: () => {
      const room = playingRoom();
      const t = room.currentRound!.tuningStartTime + 1000;
      submitGuess(room, 'ana', { userHz: room.currentRound!.targetHz }, t);
      submitGuess(room, 'beto', { userHz: room.currentRound!.targetHz + 50 }, t);
      evaluateRoundResults(room);
      assert(room.status === 'round_result', 'Evaluating a round moves the room to round_result.');
      assert(room.roundHistory[0].winnerPlayerId === 'ana', 'An exact match must beat a 50 Hz miss.');
      assert(room.players.ana.roundsWon === 1, 'The winner tally increments.');
    }
  },
  {
    name: 'advanceOrFinish starts the next round or ends the duel on the final one',
    fn: () => {
      const room = playingRoom();
      room.totalRounds = 1;
      const t = room.currentRound!.tuningStartTime + 500;
      submitGuess(room, 'ana', { userHz: 440 }, t);
      submitGuess(room, 'beto', { userHz: 445 }, t);
      evaluateRoundResults(room);
      advanceOrFinish(room, t + 100);
      assert(room.status === 'game_over', 'The last round must end the duel, not start another.');
    }
  },
  {
    name: 'markPlayerDisconnected frees the seat instantly in the lobby but grants a grace window mid-duel',
    fn: () => {
      const lobby = withTwoPlayers();
      lobby.status = 'lobby';
      const lobbyOutcome = markPlayerDisconnected(lobby, 'beto', NOW);
      assert(lobbyOutcome === 'removed-lobby', 'Leaving the lobby frees the seat immediately.');
      assert(!lobby.players.beto, 'The seat is gone from the lobby roster.');

      const duel = playingRoom();
      const outcome = markPlayerDisconnected(duel, 'beto', NOW);
      assert(outcome === 'grace-started', 'A mid-duel drop starts a grace window instead of ending the match.');
      assert(duel.status === 'playing', 'The duel must not end while the grace window is open.');
      assert(duel.players.beto.disconnectGraceExpiresAt === NOW + DISCONNECT_GRACE_MS, 'The grace window must last DISCONNECT_GRACE_MS.');
    }
  },
  {
    name: 'finalizeExpiredDisconnects only declares a walkover once the grace window has actually elapsed',
    fn: () => {
      const room = playingRoom();
      markPlayerDisconnected(room, 'beto', NOW);

      const tooSoon = finalizeExpiredDisconnects(room, NOW + DISCONNECT_GRACE_MS - 1);
      assert(!tooSoon, 'Nothing should finalize before the grace window elapses.');
      assert(room.status === 'playing', 'The room stays live during the grace window.');

      const expired = finalizeExpiredDisconnects(room, NOW + DISCONNECT_GRACE_MS + 1);
      assert(expired, 'An elapsed grace window must finalize the departure.');
      assert(room.status === 'game_over' && room.winnerByAbandonmentId === 'ana', 'The remaining player wins by walkover.');
    }
  },
  {
    name: 'leaveRoom is an explicit surrender with no grace window',
    fn: () => {
      const room = playingRoom();
      leaveRoom(room, 'beto');
      assert(room.status === 'game_over', 'An explicit leave ends the duel immediately, unlike a dropped connection.');
      assert(room.abandonedByName === 'Beto' && room.winnerByAbandonmentId === 'ana', 'The leaver is recorded and the other player wins.');
    }
  },
  {
    name: 'nextAlarmTime always returns the single earliest pending deadline',
    fn: () => {
      const room = playingRoom();
      assert(nextAlarmTime(room) === room.currentRound!.tuningDeadline, 'With no disconnects, the round deadline is the only deadline.');

      room.players.beto.disconnectGraceExpiresAt = room.currentRound!.tuningDeadline - 5000;
      assert(nextAlarmTime(room) === room.currentRound!.tuningDeadline - 5000, 'An earlier grace expiry must win over a later round deadline.');

      const countdown = withTwoPlayers();
      beginCountdown(countdown, NOW);
      assert(nextAlarmTime(countdown) === countdown.countdownEndsAt, 'During countdown, the alarm targets the countdown end.');
    }
  },
  {
    name: 'getPublicRoomState never leaks the target frequency while tuning is open',
    fn: () => {
      const room = playingRoom();
      const state = getPublicRoomState(room, false);
      assert(state.currentRound?.targetHz === undefined, 'targetHz must be hidden while status is playing.');

      const t = room.currentRound!.tuningStartTime + 500;
      submitGuess(room, 'ana', { userHz: 440 }, t);
      submitGuess(room, 'beto', { userHz: 441 }, t);
      evaluateRoundResults(room);
      const revealed = getPublicRoomState(room, false);
      assert(revealed.currentRound?.targetHz === room.currentRound!.targetHz, 'targetHz is revealed once the round is scored.');
    }
  },
  {
    name: 'getPublicRoomState reports a draw when score and rounds won are tied at game over',
    fn: () => {
      const room = playingRoom();
      room.status = 'game_over';
      room.players.ana.score = 100;
      room.players.ana.roundsWon = 1;
      room.players.beto.score = 100;
      room.players.beto.roundsWon = 1;
      const state = getPublicRoomState(room, false);
      assert(state.finalResult?.isDraw === true, 'Equal score and rounds won must report a draw.');
    }
  },
  {
    name: 'buildDuelPersistenceRows skips guests-only duels (no players.id to satisfy the D1 foreign key)',
    fn: () => {
      const room = createInitialRoom(
        { roomId: 'GUEST', name: 'Duelo invitado', hostId: 'g1', hostName: 'G1', hostAuthenticated: false, totalRounds: 3, now: NOW },
        'token'
      );
      joinRoom(room, { playerId: 'g2', name: 'G2', authenticated: false }, 'token2');
      room.status = 'game_over';
      const rows = buildDuelPersistenceRows(room, 'match-1', NOW);
      assert(rows === null, 'A duel with no authenticated participant must not be persisted.');
    }
  },
  {
    name: 'buildDuelPersistenceRows records a completed duel with one row per authenticated participant',
    fn: () => {
      const room = playingRoom();
      const t = room.currentRound!.tuningStartTime + 500;
      submitGuess(room, 'ana', { userHz: room.currentRound!.targetHz }, t);
      submitGuess(room, 'beto', { userHz: room.currentRound!.targetHz + 100 }, t);
      evaluateRoundResults(room);
      room.totalRounds = 1;
      advanceOrFinish(room, t + 100);

      const rows = buildDuelPersistenceRows(room, 'match-2', NOW + 5000)!;
      assert(rows.match.status === 'completed' && rows.match.endedReason === 'completed', 'A normal finish is recorded as completed.');
      assert(rows.match.winnerPlayerId === 'ana', 'The scoring winner is recorded on the match row.');
      assert(rows.participants.length === 2, 'Both authenticated players get a participant row.');
      const anaRow = rows.participants.find((p) => p.playerId === 'ana')!;
      assert(anaRow.result === 'win', "The winner's participant row must say win.");
    }
  },
  {
    name: 'buildDuelPersistenceRows records an abandonment as a walkover, not a draw',
    fn: () => {
      const room = playingRoom();
      leaveRoom(room, 'beto');
      const rows = buildDuelPersistenceRows(room, 'match-3', NOW + 1000)!;
      assert(rows.match.status === 'abandoned' && rows.match.endedReason === 'abandoned', 'Abandonment must be tagged distinctly from a normal finish.');
      assert(rows.match.winnerPlayerId === 'ana', 'The remaining player is the recorded winner.');
      const betoRow = rows.participants.find((p) => p.playerId === 'beto')!;
      assert(betoRow.result === 'abandoned', "The leaver's row must say abandoned, not loss.");
    }
  },
  {
    name: 'restartGame clears round history and score but keeps both players seated',
    fn: () => {
      const room = playingRoom();
      submitGuess(room, 'ana', { userHz: 440 }, room.currentRound!.tuningStartTime + 100);
      submitGuess(room, 'beto', { userHz: 441 }, room.currentRound!.tuningStartTime + 100);
      evaluateRoundResults(room);
      restartGame(room);
      assert(room.status === 'lobby' && room.roundHistory.length === 0, 'A restart returns to a clean lobby.');
      assert(room.players.ana.score === 0 && room.players.beto.score === 0, 'Scores reset on restart.');
      assert(Object.keys(room.players).length === 2, 'Both seats survive a restart (no re-join needed).');
    }
  },
  {
    name: 'allPlayersSubmitted ignores disconnected players so a solo-remaining player can close the round',
    fn: () => {
      const room = playingRoom();
      markPlayerDisconnected(room, 'beto', NOW);
      assert(!allPlayersSubmitted(room), 'Ana still needs to answer even if Beto is gone.');
      submitGuess(room, 'ana', { userHz: 440 }, room.currentRound!.tuningStartTime + 100);
      assert(allPlayersSubmitted(room), 'Once every connected player has answered, the round can close.');
    }
  }
];

let failures = 0;
for (const test of tests) {
  try {
    test.fn();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${test.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) process.exit(1);
