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
  roleCardRef,
  setReady
} from '@/src/lib/firestoreHelpers';
import type { Lobby, LobbyPlayer, RoleCard } from '@/src/lib/firestoreSchema';

export default function SidePanelPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [name, setName] = useState('');
  const [lobbyInput, setLobbyInput] = useState('');
  const [activeLobbyId, setActiveLobbyId] = useState('');
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [me, setMe] = useState<LobbyPlayer | null>(null);
  const [roleCard, setRoleCard] = useState<RoleCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const normalizedLobbyId = useMemo(() => lobbyInput.trim().toUpperCase(), [lobbyInput]);
  const canSubmitLobby = useMemo(() => Boolean(name.trim() && normalizedLobbyId), [name, normalizedLobbyId]);
  const isHost = Boolean(user && activeLobby?.hostUid === user.uid);

  useEffect(() => {
    if (!activeLobbyId || !user) return;

    const unsubLobby = onSnapshot(lobbyRef(db, activeLobbyId), (snap) => {
      if (!snap.exists()) {
        setActiveLobby(null);
        return;
      }
      setActiveLobby(snap.data() as Lobby);
    });

    const unsubMe = onSnapshot(playerRef(db, activeLobbyId, user.uid), (snap) => {
      if (!snap.exists()) {
        setMe(null);
        return;
      }
      setMe(snap.data() as LobbyPlayer);
    });

    const unsubRole = onSnapshot(roleCardRef(db, activeLobbyId, user.uid), (snap) => {
      if (!snap.exists()) {
        setRoleCard(null);
        return;
      }
      setRoleCard(snap.data() as RoleCard);
    });

    return () => {
      unsubLobby();
      unsubMe();
      unsubRole();
    };
  }, [activeLobbyId, user]);

  async function ensureSignedIn() {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  }

  async function onCreateLobby() {
    setError(null);
    setBusy(true);
    try {
      await ensureSignedIn();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Could not authenticate');
      await createLobby(db, normalizedLobbyId, uid, name.trim());
      const lobby = await getLobby(db, normalizedLobbyId);
      setActiveLobby(lobby);
      setActiveLobbyId(normalizedLobbyId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onJoinLobby() {
    setError(null);
    setBusy(true);
    try {
      await ensureSignedIn();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Could not authenticate');
      await joinLobby(db, normalizedLobbyId, uid, name.trim());
      setActiveLobbyId(normalizedLobbyId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onToggleReady() {
    if (!user || !me || !activeLobbyId) return;
    setError(null);
    try {
      await setReady(db, activeLobbyId, user.uid, !me.isReady);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onRevealRole() {
    if (!user || !activeLobbyId) return;
    setError(null);
    try {
      const card = await revealRoleCard(db, activeLobbyId, user.uid);
      setRoleCard(card);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif', display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Build-a-Werewolf (Side Panel)</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>1) Join a lobby</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            placeholder="Lobby ID"
            value={lobbyInput}
            onChange={(e) => setLobbyInput(e.target.value.toUpperCase())}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={!canSubmitLobby || busy} onClick={onCreateLobby}>Create Lobby</button>
            <button disabled={!canSubmitLobby || busy} onClick={onJoinLobby}>Join Lobby</button>
          </div>
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>2) Your status</h2>
        {!activeLobbyId ? (
          <p>Not connected to a lobby yet.</p>
        ) : (
          <>
            <p style={{ margin: '6px 0' }}>Lobby: <strong>{activeLobbyId}</strong></p>
            <p style={{ margin: '6px 0' }}>Phase: <strong>{activeLobby?.phase ?? 'loading...'}</strong></p>
            <p style={{ margin: '6px 0' }}>
              You: <strong>{me?.displayName || name || 'loading...'}</strong>{' '}
              {isHost ? '(Host)' : '(Player)'}
            </p>
            <button disabled={!me} onClick={onToggleReady}>{me?.isReady ? 'Set Not Ready' : 'Set Ready'}</button>
          </>
        )}
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>3) Private role card</h2>
        <p style={{ marginTop: 0 }}>Only you can reveal your card from this panel.</p>
        <button disabled={!me} onClick={onRevealRole}>Reveal My Role Card</button>
        {roleCard ? (
          <p>
            Role: <strong>{roleCard.role}</strong>{' '}
            {roleCard.viewedAt ? `(revealed at ${new Date(roleCard.viewedAt).toLocaleTimeString()})` : ''}
          </p>
        ) : (
          <p>No role assigned yet (host will deal cards from the main stage).</p>
        )}
      </section>

      {error ? <p style={{ color: 'crimson', margin: 0 }}>{error}</p> : null}
    </main>
  );
}
