import { describe, expect, it } from 'vitest';
import {
  assignRoles,
  createGameState,
  evaluateWin,
  getAlivePlayers,
  resolveDayVote,
  resolveNight,
  type GameState,
  type Role
} from '../src/gameEngine';

function stateFromRoles(roles: Record<string, Role>, phase: GameState['phase'] = 'night'): GameState {
  return {
    phase,
    dayNumber: 1,
    winner: null,
    lastNight: null,
    players: Object.fromEntries(
      Object.entries(roles).map(([uid, role]) => [uid, { uid, role, alive: true }])
    )
  };
}

describe('assignRoles', () => {
  it('assigns expected count', () => {
    const roles = assignRoles(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 2, true, true);
    const vals = Object.values(roles);
    expect(vals.filter((v) => v === 'werewolf')).toHaveLength(2);
    expect(vals.filter((v) => v === 'seer')).toHaveLength(1);
    expect(vals.filter((v) => v === 'doctor')).toHaveLength(1);
  });
});

describe('game-state engine', () => {
  it('creates a night-phase state with all players alive', () => {
    const state = createGameState(['a', 'b', 'c', 'd', 'e'], {
      werewolves: 1,
      seer: true,
      doctor: true
    });

    expect(state.phase).toBe('night');
    expect(getAlivePlayers(state)).toHaveLength(5);
  });

  it('night kill is prevented when doctor saves target', () => {
    const state = stateFromRoles({ a: 'werewolf', b: 'doctor', c: 'seer', d: 'villager' });
    const next = resolveNight(state, {
      wolfTargetUid: 'd',
      doctorSaveUid: 'd',
      seerCheckUid: 'a'
    });

    expect(next.players.d.alive).toBe(true);
    expect(next.lastNight?.eliminatedUid).toBeNull();
    expect(next.lastNight?.seerResult).toEqual({ uid: 'a', isWerewolf: true });
    expect(next.phase).toBe('day');
  });

  it('night kill can end game when wolves reach parity', () => {
    const state = stateFromRoles({ a: 'werewolf', b: 'villager', c: 'villager', d: 'villager' });
    state.players.d.alive = false;

    const next = resolveNight(state, { wolfTargetUid: 'b' });

    expect(next.players.b.alive).toBe(false);
    expect(next.winner).toBe('werewolves');
    expect(next.phase).toBe('ended');
  });

  it('day vote eliminates top target and advances round', () => {
    const state = stateFromRoles({ a: 'werewolf', b: 'villager', c: 'villager', d: 'villager' }, 'day');
    const { state: next, result } = resolveDayVote(state, {
      a: 'b',
      b: 'a',
      c: 'a',
      d: 'a'
    });

    expect(result.eliminatedUid).toBe('a');
    expect(next.players.a.alive).toBe(false);
    expect(next.winner).toBe('villagers');
    expect(next.phase).toBe('ended');
    expect(next.dayNumber).toBe(2);
  });

  it('day tie causes no elimination', () => {
    const state = stateFromRoles({ a: 'werewolf', b: 'villager', c: 'villager', d: 'villager' }, 'day');
    const { state: next, result } = resolveDayVote(state, {
      a: 'b',
      b: 'a',
      c: 'a',
      d: 'b'
    });

    expect(result.eliminatedUid).toBeNull();
    expect(result.tiedUids.sort()).toEqual(['a', 'b']);
    expect(next.phase).toBe('night');
    expect(next.winner).toBeNull();
    expect(next.dayNumber).toBe(2);
  });

  it('evaluateWin returns villagers when all wolves are dead', () => {
    const state = stateFromRoles({ a: 'werewolf', b: 'villager', c: 'villager', d: 'villager' });
    state.players.a.alive = false;
    expect(evaluateWin(state)).toBe('villagers');
  });
});
