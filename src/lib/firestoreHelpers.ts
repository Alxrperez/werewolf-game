import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
  type Firestore
} from 'firebase/firestore';
import {
  createGameState,
  resolveDayVote,
  resolveNight,
  type GameState,
  type NightActions
} from '@/src/gameEngine';
import {
  type DayVote,
  type GameSettings,
  type Lobby,
  type LobbyPlayer,
  type NightAction,
  type RoleCard,
  parseLobby,
  parseLobbyPlayer,
  parseRoleCard
} from './firestoreSchema';

const now = () => Date.now();

export const lobbyRef = (db: Firestore, lobbyId: string) => doc(db, 'lobbies', lobbyId);
export const playersColRef = (db: Firestore, lobbyId: string) => collection(db, 'lobbies', lobbyId, 'players');
export const playerRef = (db: Firestore, lobbyId: string, uid: string) => doc(db, 'lobbies', lobbyId, 'players', uid);
export const roleCardsColRef = (db: Firestore, lobbyId: string) => collection(db, 'lobbies', lobbyId, 'roleCards');
export const roleCardRef = (db: Firestore, lobbyId: string, uid: string) => doc(db, 'lobbies', lobbyId, 'roleCards', uid);
export const nightActionsColRef = (db: Firestore, lobbyId: string) => collection(db, 'lobbies', lobbyId, 'nightActions');
export const nightActionRef = (db: Firestore, lobbyId: string, uid: string) => doc(db, 'lobbies', lobbyId, 'nightActions', uid);
export const dayVotesColRef = (db: Firestore, lobbyId: string) => collection(db, 'lobbies', lobbyId, 'dayVotes');
export const dayVoteRef = (db: Firestore, lobbyId: string, uid: string) => doc(db, 'lobbies', lobbyId, 'dayVotes', uid);

export async function createLobby(db: Firestore, lobbyId: string, hostUid: string, hostName: string): Promise<void> {
  const timestamp = now();
  const lobby: Lobby = {
    hostUid,
    phase: 'lobby',
    settings: { werewolves: 1, seer: true, doctor: true },
    dayNumber: 1,
    winner: null,
    lastNight: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const host: LobbyPlayer = {
    uid: hostUid,
    displayName: hostName,
    isHost: true,
    isReady: false,
    alive: true,
    joinedAt: timestamp
  };

  await setDoc(lobbyRef(db, lobbyId), lobby);
  await setDoc(playerRef(db, lobbyId, hostUid), host);
}

export async function joinLobby(db: Firestore, lobbyId: string, uid: string, displayName: string): Promise<void> {
  const player: LobbyPlayer = {
    uid,
    displayName,
    isHost: false,
    isReady: false,
    alive: true,
    joinedAt: now()
  };
  await setDoc(playerRef(db, lobbyId, uid), player, { merge: true });
}

export async function setReady(db: Firestore, lobbyId: string, uid: string, isReady: boolean): Promise<void> {
  await updateDoc(playerRef(db, lobbyId, uid), { isReady });
}

export async function updateLobbySettings(db: Firestore, lobbyId: string, settings: GameSettings): Promise<void> {
  await updateDoc(lobbyRef(db, lobbyId), {
    settings,
    updatedAt: now()
  });
}

export async function getLobby(db: Firestore, lobbyId: string): Promise<Lobby | null> {
  const snap = await getDoc(lobbyRef(db, lobbyId));
  if (!snap.exists()) return null;
  return parseLobby(snap.data());
}

export async function listPlayers(db: Firestore, lobbyId: string): Promise<LobbyPlayer[]> {
  const snaps = await getDocs(playersColRef(db, lobbyId));
  return snaps.docs.map((d) => parseLobbyPlayer(d.data()));
}

export async function writeRoleCard(db: Firestore, lobbyId: string, card: RoleCard): Promise<void> {
  await setDoc(roleCardRef(db, lobbyId, card.uid), card);
}

export async function revealRoleCard(db: Firestore, lobbyId: string, uid: string): Promise<RoleCard | null> {
  const ref = roleCardRef(db, lobbyId, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const parsed = parseRoleCard(snap.data());
  if (!parsed.viewedAt) {
    const viewedAt = now();
    await updateDoc(ref, { viewedAt });
    return { ...parsed, viewedAt };
  }
  return parsed;
}

function toEngineState(lobby: Lobby, players: LobbyPlayer[], cards: RoleCard[]): GameState {
  const roleByUid = Object.fromEntries(cards.map((c) => [c.uid, c.role]));
  return {
    phase: lobby.phase,
    dayNumber: lobby.dayNumber,
    winner: lobby.winner,
    lastNight: lobby.lastNight
      ? {
          eliminatedUid: lobby.lastNight.eliminatedUid,
          seerResult: lobby.lastNight.seerTargetUid
            ? {
                uid: lobby.lastNight.seerTargetUid,
                isWerewolf: Boolean(lobby.lastNight.seerSawWerewolf)
              }
            : null
        }
      : null,
    players: Object.fromEntries(
      players.map((p) => [
        p.uid,
        {
          uid: p.uid,
          alive: p.alive,
          role: roleByUid[p.uid] ?? 'villager'
        }
      ])
    )
  };
}

export async function startGameWithRoles(db: Firestore, lobbyId: string): Promise<void> {
  const players = await listPlayers(db, lobbyId);
  const lobby = await getLobby(db, lobbyId);
  if (!lobby) throw new Error('Lobby not found');
  if (players.length < 4) throw new Error('Need at least 4 players to start.');

  const state = createGameState(
    players.map((p) => p.uid),
    lobby.settings
  );

  const assignedAt = now();
  await Promise.all(
    Object.values(state.players).map((p) =>
      setDoc(roleCardRef(db, lobbyId, p.uid), {
        uid: p.uid,
        role: p.role,
        assignedAt,
        viewedAt: null
      } as RoleCard)
    )
  );

  await Promise.all(
    players.map((p) =>
      updateDoc(playerRef(db, lobbyId, p.uid), {
        alive: true,
        isReady: false
      })
    )
  );

  await updateDoc(lobbyRef(db, lobbyId), {
    phase: 'night',
    dayNumber: 1,
    winner: null,
    lastNight: null,
    updatedAt: now()
  });
}

export async function submitNightAction(
  db: Firestore,
  lobbyId: string,
  uid: string,
  actionType: NightAction['actionType'],
  targetUid: string,
  dayNumber: number
): Promise<void> {
  const action: NightAction = {
    actorUid: uid,
    actionType,
    targetUid,
    dayNumber,
    createdAt: now()
  };
  await setDoc(nightActionRef(db, lobbyId, uid), action);
}

export async function submitDayVote(
  db: Firestore,
  lobbyId: string,
  uid: string,
  targetUid: string,
  dayNumber: number
): Promise<void> {
  const vote: DayVote = {
    voterUid: uid,
    targetUid,
    dayNumber,
    createdAt: now()
  };
  await setDoc(dayVoteRef(db, lobbyId, uid), vote);
}

export async function resolveNightPhase(db: Firestore, lobbyId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const lobbySnap = await tx.get(lobbyRef(db, lobbyId));
    if (!lobbySnap.exists()) throw new Error('Lobby not found');
    const lobby = parseLobby(lobbySnap.data());
    if (lobby.phase !== 'night') throw new Error('Night resolution only allowed during night phase.');

    const playerSnaps = await getDocs(playersColRef(db, lobbyId));
    const players = playerSnaps.docs.map((d) => parseLobbyPlayer(d.data()));

    const cardSnaps = await getDocs(roleCardsColRef(db, lobbyId));
    const cards = cardSnaps.docs.map((d) => parseRoleCard(d.data()));

    const actionSnaps = await getDocs(nightActionsColRef(db, lobbyId));
    const actions = actionSnaps.docs.map((d) => d.data() as NightAction).filter((a) => a.dayNumber === lobby.dayNumber);

    const aliveIds = new Set(players.filter((p) => p.alive).map((p) => p.uid));
    const roleByUid = Object.fromEntries(cards.map((c) => [c.uid, c.role]));

    const night: NightActions = {};
    for (const action of actions) {
      if (!aliveIds.has(action.actorUid) || !aliveIds.has(action.targetUid)) continue;
      const actorRole = roleByUid[action.actorUid];
      if (action.actionType === 'wolfKill' && actorRole === 'werewolf') night.wolfTargetUid = action.targetUid;
      if (action.actionType === 'doctorSave' && actorRole === 'doctor') night.doctorSaveUid = action.targetUid;
      if (action.actionType === 'seerCheck' && actorRole === 'seer') night.seerCheckUid = action.targetUid;
    }

    const nextState = resolveNight(toEngineState(lobby, players, cards), night);

    tx.update(lobbyRef(db, lobbyId), {
      phase: nextState.phase,
      winner: nextState.winner,
      dayNumber: nextState.dayNumber,
      lastNight: nextState.lastNight
        ? {
            eliminatedUid: nextState.lastNight.eliminatedUid,
            seerTargetUid: nextState.lastNight.seerResult?.uid ?? null,
            seerSawWerewolf: nextState.lastNight.seerResult?.isWerewolf ?? null
          }
        : null,
      updatedAt: now()
    });

    for (const p of players) {
      tx.update(playerRef(db, lobbyId, p.uid), { alive: nextState.players[p.uid]?.alive ?? false });
    }
  });

  const actionSnaps = await getDocs(nightActionsColRef(db, lobbyId));
  await Promise.all(actionSnaps.docs.map((d) => deleteDoc(d.ref)));
}

export async function resolveDayPhase(db: Firestore, lobbyId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const lobbySnap = await tx.get(lobbyRef(db, lobbyId));
    if (!lobbySnap.exists()) throw new Error('Lobby not found');
    const lobby = parseLobby(lobbySnap.data());
    if (lobby.phase !== 'day') throw new Error('Vote resolution only allowed during day phase.');

    const playerSnaps = await getDocs(playersColRef(db, lobbyId));
    const players = playerSnaps.docs.map((d) => parseLobbyPlayer(d.data()));
    const cardSnaps = await getDocs(roleCardsColRef(db, lobbyId));
    const cards = cardSnaps.docs.map((d) => parseRoleCard(d.data()));
    const voteSnaps = await getDocs(dayVotesColRef(db, lobbyId));

    const votes: Record<string, string> = {};
    for (const v of voteSnaps.docs.map((d) => d.data() as DayVote)) {
      if (v.dayNumber !== lobby.dayNumber) continue;
      votes[v.voterUid] = v.targetUid;
    }

    const { state: nextState } = resolveDayVote(toEngineState(lobby, players, cards), votes);

    tx.update(lobbyRef(db, lobbyId), {
      phase: nextState.phase,
      winner: nextState.winner,
      dayNumber: nextState.dayNumber,
      updatedAt: now()
    });

    for (const p of players) {
      tx.update(playerRef(db, lobbyId, p.uid), { alive: nextState.players[p.uid]?.alive ?? false });
    }
  });

  const voteSnaps = await getDocs(dayVotesColRef(db, lobbyId));
  await Promise.all(voteSnaps.docs.map((d) => deleteDoc(d.ref)));
}
