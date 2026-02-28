'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { assignRoles } from '@/src/gameEngine';
import {
  lobbyRef,
  playersColRef,
  updateLobbySettings,
  writeRoleCard
} from '@/src/lib/firestoreHelpers';
import { parseLobbyPlayer, type GameSettings, type Lobby, type LobbyPlayer } from '@/src/lib/firestoreSchema';

export default function MainStagePage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [lobbyIdInput, setLobbyIdInput] = useState('');
  const [activeLobbyId, setActiveLobbyId] = useState('');
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [settings, setSettings] = useState<GameSettings>({ werewolves: 1, seer: true, doctor: true });
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!activeLobbyId) return;

    const unsubLobby = onSnapshot(lobbyRef(db, activeLobbyId), (snap) => {
      if (!snap.exists()) {
        setLobby(null);
        setPlayers([]);
        return;
      }
      const data = snap.data() as Lobby;
      setLobby(data);
      setSettings(data.settings);
    });

    const unsubPlayers = onSnapshot(playersColRef(db, activeLobbyId), (snaps) => {
      setPlayers(snaps.docs.map((d) => parseLobbyPlayer(d.data())));
    });

    return () => {
      unsubLobby();
      unsubPlayers();
    };
  }, [activeLobbyId]);

  const normalizedLobbyId = useMemo(() => lobbyIdInput.trim().toUpperCase(), [lobbyIdInput]);
  const isHost = useMemo(() => Boolean(user && lobby?.hostUid === user.uid), [lobby, user]);
  const readyCount = useMemo(() => players.filter((p) => p.isReady).length, [players]);
  const allReady = players.length > 0 && readyCount === players.length;

  async function ensureSignedIn() {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  }

  async function onConnectLobby() {
    setError(null);
    setStatus('');
    if (!normalizedLobbyId) {
      setError('Enter a lobby ID first.');
      return;
    }

    try {
      await ensureSignedIn();
      setActiveLobbyId(normalizedLobbyId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onSaveSettings() {
    if (!activeLobbyId) return;
    setError(null);
    setStatus('');
    setBusy(true);

    try {
      await ensureSignedIn();
      await updateLobbySettings(db, activeLobbyId, settings);
      setStatus('Lobby settings updated.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDealRoles() {
    if (!activeLobbyId || players.length === 0) return;
    setError(null);
    setStatus('');
    setBusy(true);

    try {
      await ensureSignedIn();

      const ids = players.map((p) => p.uid);
      const assigned = assignRoles(ids, settings.werewolves, settings.seer, settings.doctor);
      const assignedAt = Date.now();

      await Promise.all(
        players.map((p) =>
          writeRoleCard(db, activeLobbyId, {
            uid: p.uid,
            role: assigned[p.uid],
            assignedAt,
            viewedAt: null
          })
        )
      );

      setStatus('Role cards dealt privately. Players can reveal their own card in side panel.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif', display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Build-a-Werewolf (Main Stage)</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>1) Connect to lobby</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Lobby ID"
            value={lobbyIdInput}
            onChange={(e) => setLobbyIdInput(e.target.value.toUpperCase())}
          />
          <button onClick={onConnectLobby}>Connect</button>
        </div>
        <p style={{ marginBottom: 0 }}>Connected lobby: <strong>{activeLobbyId || 'none'}</strong></p>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>2) Players and readiness</h2>
        <p style={{ margin: '6px 0' }}>Phase: <strong>{lobby?.phase ?? 'unknown'}</strong></p>
        <p style={{ margin: '6px 0' }}>Ready: <strong>{readyCount}/{players.length}</strong></p>
        <ul>
          {players.map((p) => (
            <li key={p.uid}>
              {p.displayName} {p.isHost ? '(Host)' : ''} — {p.isReady ? '✅ Ready' : '⌛ Waiting'}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>3) Host controls</h2>
        {!isHost && <p>Only the host can change settings and deal role cards.</p>}

        <label>
          Werewolves:{' '}
          <input
            type="number"
            min={1}
            max={4}
            value={settings.werewolves}
            disabled={!isHost || busy}
            onChange={(e) => setSettings((prev) => ({ ...prev, werewolves: Number(e.target.value) || 1 }))}
          />
        </label>

        <div>
          <label>
            <input
              type="checkbox"
              checked={settings.seer}
              disabled={!isHost || busy}
              onChange={(e) => setSettings((prev) => ({ ...prev, seer: e.target.checked }))}
            />
            Include Seer
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              checked={settings.doctor}
              disabled={!isHost || busy}
              onChange={(e) => setSettings((prev) => ({ ...prev, doctor: e.target.checked }))}
            />
            Include Doctor
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button disabled={!isHost || !activeLobbyId || busy} onClick={onSaveSettings}>Save Settings</button>
          <button disabled={!isHost || !activeLobbyId || players.length === 0 || !allReady || busy} onClick={onDealRoles}>
            Deal Private Role Cards
          </button>
        </div>
        {!allReady && players.length > 0 ? <p>Wait for all players to be ready before dealing roles.</p> : null}
      </section>

      {status ? <p style={{ color: 'green', margin: 0 }}>{status}</p> : null}
      {error ? <p style={{ color: 'crimson', margin: 0 }}>{error}</p> : null}
    </main>
  );
}
