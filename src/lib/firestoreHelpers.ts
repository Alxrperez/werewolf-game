import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore
} from 'firebase/firestore';
import {
  type GameSettings,
  type Lobby,
  type LobbyPlayer,
  type RoleCard,
  parseLobby,
  parseLobbyPlayer,
  parseRoleCard
} from './firestoreSchema';

const now = () => Date.now();

export const lobbyRef = (db: Firestore, lobbyId: string) => doc(db, 'lobbies', lobbyId);
export const playersColRef = (db: Firestore, lobbyId: string) => collection(db, 'lobbies', lobbyId, 'players');
export const playerRef = (db: Firestore, lobbyId: string, uid: string) => doc(db, 'lobbies', lobbyId, 'players', uid);
export const roleCardRef = (db: Firestore, lobbyId: string, uid: string) => doc(db, 'lobbies', lobbyId, 'roleCards', uid);

export async function createLobby(db: Firestore, lobbyId: string, hostUid: string, hostName: string): Promise<void> {
  const timestamp = now();
  const lobby: Lobby = {
    hostUid,
    phase: 'lobby',
    settings: { werewolves: 1, seer: true, doctor: true },
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const host: LobbyPlayer = {
    uid: hostUid,
    displayName: hostName,
    isHost: true,
    isReady: false,
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
    await updateDoc(ref, { viewedAt: now() });
    return { ...parsed, viewedAt: now() };
  }
  return parsed;
}
