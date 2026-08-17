import { RoomManager, ServerRoom } from '../server/roomManager.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function createPlayingRoom(): { manager: RoomManager; room: ServerRoom } {
  const manager = new RoomManager();
  const room = manager.createRoom('Duelo de prueba', { id: 'ana', name: 'Ana', ws: {} }, 3);
  manager.joinRoom(room.id, { id: 'beto', name: 'Beto', ws: {} });
  room.status = 'playing';
  room.currentRound = {
    roundNumber: 1,
    targetHz: 440,
    durationMs: 15000,
    audioDurationMs: 2500,
    retentionWaitMs: 3000,
    scheduledPlayTime: Date.now() - 10000,
    tuningStartTime: Date.now() - 1000,
    tuningDurationMs: 15000,
    tuningDeadline: Date.now() + 10000,
    startedAt: Date.now() - 10000
  };
  return { manager, room };
}

const tests: Array<{ name: string; fn: () => void }> = [
  {
    name: 'Una frecuencia perfecta gana la ronda',
    fn: () => {
      const { manager, room } = createPlayingRoom();
      manager.submitGuess(room, 'ana', { userHz: 440, responseTimeMs: 50 });
      manager.submitGuess(room, 'beto', { userHz: 441, responseTimeMs: 50 });
      manager.evaluateRoundResults(room);
      assert(room.roundHistory[0].winnerPlayerId === 'ana', 'Una desviación de 0 Hz debe vencer a una de 1 Hz.');
    }
  },
  {
    name: 'El servidor no acepta el tiempo de respuesta declarado por el cliente',
    fn: () => {
      const { manager, room } = createPlayingRoom();
      manager.submitGuess(room, 'ana', { userHz: 440, responseTimeMs: 50 });
      const recorded = room.players.get('ana')?.currentRoundSubmission?.responseTimeMs ?? 0;
      assert(recorded >= 900, `El servidor debe medir ~1 s; registró ${recorded} ms.`);
    }
  },
  {
    name: 'Una ronda final primero publica su resultado detallado',
    fn: () => {
      const { manager, room } = createPlayingRoom();
      room.totalRounds = 1;
      room.currentRoundNumber = 1;
      manager.submitGuess(room, 'ana', { userHz: 440, responseTimeMs: 1000 });
      manager.submitGuess(room, 'beto', { userHz: 441, responseTimeMs: 1000 });
      manager.evaluateRoundResults(room);
      assert(room.status === 'round_result', 'La última ronda debe mostrar su modal antes de terminar el duelo.');
    }
  },
  {
    name: 'Una desconexión temporal no se declara abandono de inmediato',
    fn: () => {
      const manager = new RoomManager();
      const hostSocket = {};
      const room = manager.createRoom('Duelo de prueba', { id: 'ana', name: 'Ana', ws: hostSocket });
      manager.joinRoom(room.id, { id: 'beto', name: 'Beto', ws: {} });
      room.status = 'playing';
      const token = room.players.get('ana')!.sessionToken;
      manager.removePlayer(hostSocket);
      assert(room.status === 'playing', 'Una caída temporal debe conservar la sala durante la ventana de reconexión.');
      manager.joinRoom(room.id, { id: 'ana', name: 'Ana', ws: {}, sessionToken: token });
      assert(room.players.get('ana')!.connected, 'El jugador debe poder recuperar su asiento durante la ventana de reconexión.');
    }
  },
  {
    name: 'El servidor exige dos jugadores listos antes de iniciar',
    fn: () => {
      const manager = new RoomManager();
      const room = manager.createRoom('Duelo de prueba', { id: 'ana', name: 'Ana', ws: {} });
      assert(!manager.canStartMatch(room, 'ana'), 'No se puede iniciar un duelo con un jugador.');
      manager.joinRoom(room.id, { id: 'beto', name: 'Beto', ws: {} });
      assert(!manager.canStartMatch(room, 'ana'), 'No se puede iniciar mientras un jugador no está listo.');
      room.players.get('beto')!.isReady = true;
      assert(manager.canStartMatch(room, 'ana'), 'El anfitrión debe poder iniciar con dos jugadores listos.');
    }
  },
  {
    name: 'La ronda espera obligatoriamente a que ambos jugadores envíen su respuesta',
    fn: () => {
      const { manager, room } = createPlayingRoom();
      assert(room.status === 'playing', 'La sala debe estar en estado playing.');

      // Player 1 (Ana) submits
      const submittedAna = manager.submitGuess(room, 'ana', { userHz: 440, responseTimeMs: 1200 });
      assert(submittedAna, 'El envío de Ana debe ser aceptado.');
      assert(!manager.allPlayersSubmitted(room), 'No todos los jugadores han enviado aún.');
      assert(room.status === 'playing', 'El estado debe seguir en playing mientras falta Beto.');

      // Player 2 (Beto) submits
      const submittedBeto = manager.submitGuess(room, 'beto', { userHz: 445, responseTimeMs: 2500 });
      assert(submittedBeto, 'El envío de Beto debe ser aceptado.');
      assert(manager.allPlayersSubmitted(room), 'Ambos jugadores han enviado.');

      // Now evaluate
      manager.evaluateRoundResults(room);
      assert(room.status === 'round_result', 'La sala pasa a round_result solo cuando ambos enviaron.');
      assert(room.roundHistory[0].winnerPlayerId === 'ana', 'Ana gana con 0 Hz de desviación frente a 5 Hz.');
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
