'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import {
  createLobby,
  getLobby,
  joinLobby,
  lobbyRef,
  playerRef,
  revealRoleCard,
  setReady
} from '@/src/lib/firestoreHelpers';
import type { Lobby, LobbyPlayer, RoleCard } from '@/src/lib/firestoreSchema';

export default function SidePanelPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [name, setName] = useState('');
  const [lobbyId, setLobbyId] = useState('');
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [me, setMe] = useState<LobbyPlayer | null>(null);
  const [roleCard, setRoleCard] = useState<RoleCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const canAct = useMemo(() => Boolean(user && name.trim() && lobbyId.trim()), [user, name, lobbyId]);

  useEffect(() => {
    if (!lobbyId.trim() || !user) return;

    const unsubLobby = onSnapshot(lobbyRef(db, lobbyId.trim()), (snap) => {
      if (!snap.exists()) {
        setActiveLobby(null);
        return;
      }
      setActiveLobby(snap.data() as Lobby);
    });

    const unsubMe = onSnapshot(playerRef(db, lobbyId.trim(), user.uid), (snap) => {
      if (!snap.exists()) {
        setMe(null);
        return;
      }
      setMe(snap.data() as LobbyPlayer);
    });

    return () => {
      unsubLobby();
      unsubMe();
    };
  }, [lobbyId, user]);

  async function ensureSignedIn() {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  }

  async function onCreateLobby() {
    setError(null);
    try {
      await ensureSignedIn();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Could not authenticate');
      await createLobby(db, lobbyId.trim(), uid, name.trim());
      const lobby = await getLobby(db, lobbyId.trim());
      setActiveLobby(lobby);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onJoinLobby() {
    setError(null);
    try {
      await ensureSignedIn();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Could not authenticate');
      await joinLobby(db, lobbyId.trim(), uid, name.trim());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onToggleReady() {
    if (!user || !me) return;
    await setReady(db, lobbyId.trim(), user.uid, !me.isReady);
  }

  async function onRevealRole() {
    if (!user) return;
    const card = await revealRoleCard(db, lobbyId.trim(), user.uid);
    setRoleCard(card);
  }

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1>Build-a-Werewolf (Side Panel)</h1>

      <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
        <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Lobby ID" value={lobbyId} onChange={(e) => setLobbyId(e.target.value.toUpperCase())} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={!canAct} onClick={onCreateLobby}>Create Lobby</button>
          <button disabled={!canAct} onClick={onJoinLobby}>Join Lobby</button>
          <button disabled={!me} onClick={onToggleReady}>{me?.isReady ? 'Set Not Ready' : 'Set Ready'}</button>
        </div>
      </div>

      {activeLobby && (
        <section style={{ marginTop: 16 }}>
          <h2>Lobby</h2>
          <p>Phase: {activeLobby.phase}</p>
          <p>Host UID: {activeLobby.hostUid}</p>
        </section>
      )}

      <section style={{ marginTop: 16 }}>
        <h2>Private Role Card</h2>
        <p>Your role stays hidden until you reveal it yourself.</p>
        <button disabled={!me} onClick={onRevealRole}>Reveal My Role Card</button>
        {roleCard ? (
          <p>
            Role: <strong>{roleCard.role}</strong>{' '}
            {roleCard.viewedAt ? `(viewed at ${new Date(roleCard.viewedAt).toLocaleTimeString()})` : ''}
          </p>
        ) : (
          <p>No role assigned yet.</p>
        )}
      </section>

      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
    </main>
  );
}
