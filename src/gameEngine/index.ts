export type Role = 'werewolf' | 'villager' | 'seer' | 'doctor';
export type Phase = 'lobby' | 'night' | 'day' | 'ended';
export type Team = 'villagers' | 'werewolves';

export interface EngineSettings {
  werewolves: number;
  seer: boolean;
  doctor: boolean;
}

export interface PlayerState {
  uid: string;
  role: Role;
  alive: boolean;
}

export interface NightActions {
  wolfTargetUid?: string;
  doctorSaveUid?: string;
  seerCheckUid?: string;
}

export interface NightResolution {
  eliminatedUid: string | null;
  seerResult: { uid: string; isWerewolf: boolean } | null;
}

export interface VoteResolution {
  eliminatedUid: string | null;
  tiedUids: string[];
}

export interface GameState {
  phase: Phase;
  dayNumber: number;
  winner: Team | null;
  players: Record<string, PlayerState>;
  lastNight: NightResolution | null;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function assignRoles(players: string[], werewolves: number, seer: boolean, doctor: boolean): Record<string, Role> {
  const roleBag: Role[] = [];
  for (let i = 0; i < werewolves; i++) roleBag.push('werewolf');
  if (seer) roleBag.push('seer');
  if (doctor) roleBag.push('doctor');
  while (roleBag.length < players.length) roleBag.push('villager');

  const shuffledRoles = shuffle(roleBag);
  const out: Record<string, Role> = {};
  players.forEach((playerId, i) => {
    out[playerId] = shuffledRoles[i] ?? 'villager';
  });
  return out;
}

export function createGameState(players: string[], settings: EngineSettings): GameState {
  if (players.length < 4) throw new Error('At least 4 players are required.');
  if (settings.werewolves < 1) throw new Error('At least 1 werewolf is required.');

  const roles = assignRoles(players, settings.werewolves, settings.seer, settings.doctor);
  const playerStates: Record<string, PlayerState> = {};

  for (const uid of players) {
    playerStates[uid] = {
      uid,
      role: roles[uid] ?? 'villager',
      alive: true
    };
  }

  return {
    phase: 'night',
    dayNumber: 1,
    winner: null,
    players: playerStates,
    lastNight: null
  };
}

export function getAlivePlayers(state: GameState): PlayerState[] {
  return Object.values(state.players).filter((p) => p.alive);
}

export function evaluateWin(state: GameState): Team | null {
  const alive = getAlivePlayers(state);
  const wolves = alive.filter((p) => p.role === 'werewolf').length;
  const villagers = alive.length - wolves;

  if (wolves === 0) return 'villagers';
  if (wolves >= villagers) return 'werewolves';
  return null;
}

export function resolveNight(state: GameState, actions: NightActions): GameState {
  if (state.phase !== 'night') throw new Error('resolveNight can only run during night phase.');
  if (state.winner) return state;

  const next: GameState = {
    ...state,
    players: { ...state.players },
    lastNight: null
  };

  const wolfTarget = actions.wolfTargetUid ? next.players[actions.wolfTargetUid] : undefined;
  const doctorSave = actions.doctorSaveUid ? next.players[actions.doctorSaveUid] : undefined;
  const seerTarget = actions.seerCheckUid ? next.players[actions.seerCheckUid] : undefined;

  const validWolfTarget = wolfTarget?.alive ? wolfTarget : undefined;
  const validDoctorSave = doctorSave?.alive ? doctorSave : undefined;
  const validSeerTarget = seerTarget?.alive ? seerTarget : undefined;

  let eliminatedUid: string | null = null;
  if (validWolfTarget && validWolfTarget.uid !== validDoctorSave?.uid) {
    next.players[validWolfTarget.uid] = {
      ...validWolfTarget,
      alive: false
    };
    eliminatedUid = validWolfTarget.uid;
  }

  next.lastNight = {
    eliminatedUid,
    seerResult: validSeerTarget
      ? {
          uid: validSeerTarget.uid,
          isWerewolf: validSeerTarget.role === 'werewolf'
        }
      : null
  };

  const winner = evaluateWin(next);
  next.winner = winner;

  if (winner) {
    next.phase = 'ended';
    return next;
  }

  next.phase = 'day';
  return next;
}

export function resolveDayVote(state: GameState, votes: Record<string, string>): { state: GameState; result: VoteResolution } {
  if (state.phase !== 'day') throw new Error('resolveDayVote can only run during day phase.');
  if (state.winner) return { state, result: { eliminatedUid: null, tiedUids: [] } };

  const counts = new Map<string, number>();
  const aliveSet = new Set(getAlivePlayers(state).map((p) => p.uid));

  for (const voterUid of Object.keys(votes)) {
    if (!aliveSet.has(voterUid)) continue;
    const targetUid = votes[voterUid];
    if (!targetUid || !aliveSet.has(targetUid)) continue;
    counts.set(targetUid, (counts.get(targetUid) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return {
      state: { ...state, phase: 'night', dayNumber: state.dayNumber + 1 },
      result: { eliminatedUid: null, tiedUids: [] }
    };
  }

  let maxVotes = 0;
  for (const [, count] of counts) {
    if (count > maxVotes) maxVotes = count;
  }

  const leaders = [...counts.entries()].filter(([, count]) => count === maxVotes).map(([uid]) => uid);

  const next: GameState = {
    ...state,
    players: { ...state.players }
  };

  let eliminatedUid: string | null = null;
  if (leaders.length === 1) {
    const eliminated = next.players[leaders[0]];
    if (eliminated?.alive) {
      next.players[leaders[0]] = {
        ...eliminated,
        alive: false
      };
      eliminatedUid = leaders[0];
    }
  }

  const winner = evaluateWin(next);
  next.winner = winner;
  next.phase = winner ? 'ended' : 'night';
  next.dayNumber = state.dayNumber + 1;

  return {
    state: next,
    result: {
      eliminatedUid,
      tiedUids: leaders.length > 1 ? leaders : []
    }
  };
}
