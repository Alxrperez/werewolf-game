'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { assignRoles } from '@/src/gameEngine';
import {
  listPlayers,
  lobbyRef,
  updateLobbySettings,
  writeRoleCard
} from '@/src/lib/firestoreHelpers';
import type { GameSettings, Lobby, LobbyPlayer } from '@/src/lib/firestoreSchema';

export default function MainStagePage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [lobbyId, setLobbyId] = useState('');
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [settings, setSettings] = useState<GameSettings>({ werewolves: 1, seer: true, doctor: true });
  const [status, setStatus] = useState('');

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!lobbyId.trim()) return;
    const unsub = onSnapshot(lobbyRef(db, lobbyId.trim()), (snap) => {
      if (!snap.exists()) {
        setLobby(null);
        setPlayers([]);
        return;
      }
      const data = snap.data() as Lobby;
      setLobby(data);
      setSettings(data.settings);
      void listPlayers(db, lobbyId.trim()).then(setPlayers);
    });

    return () => unsub();
  }, [lobbyId]);

  const isHost = useMemo(() => Boolean(user && lobby?.hostUid === user.uid), [lobby, user]);

  async function ensureSignedIn() {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  }

  async function onSaveSettings() {
    if (!lobbyId.trim()) return;
    await ensureSignedIn();
    await updateLobbySettings(db, lobbyId.trim(), settings);
    setStatus('Lobby settings updated');
  }

  async function onDealRoles() {
    if (!lobbyId.trim() || players.length === 0) return;
    await ensureSignedIn();

    const ids = players.map((p) => p.uid);
    const assigned = assignRoles(ids, settings.werewolves, settings.seer, settings.doctor);
    const assignedAt = Date.now();

    await Promise.all(
      players.map((p) =>
        writeRoleCard(db, lobbyId.trim(), {
          uid: p.uid,
          role: assigned[p.uid],
          assignedAt,
          viewedAt: null
        })
      )
    );

    setStatus('Role cards dealt privately. Players must reveal their own card in side panel.');
  }

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1>Build-a-Werewolf (Main Stage)</h1>
      <input
        placeholder="Lobby ID"
        value={lobbyId}
        onChange={(e) => setLobbyId(e.target.value.toUpperCase())}
        style={{ marginBottom: 12 }}
      />

      <section>
        <h2>Players ({players.length})</h2>
        <ul>
          {players.map((p) => (
            <li key={p.uid}>
              {p.displayName} {p.isReady ? '✅ ready' : '⌛ waiting'}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Host Controls</h2>
        {!isHost && <p>Only the host can change settings and deal role cards.</p>}

        <label>
          Werewolves:{' '}
          <input
            type="number"
            min={1}
            max={4}
            value={settings.werewolves}
            disabled={!isHost}
            onChange={(e) => setSettings((prev) => ({ ...prev, werewolves: Number(e.target.value) || 1 }))}
          />
        </label>
        <div>
          <label>
            <input
              type="checkbox"
              checked={settings.seer}
              disabled={!isHost}
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
              disabled={!isHost}
              onChange={(e) => setSettings((prev) => ({ ...prev, doctor: e.target.checked }))}
            />
            Include Doctor
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button disabled={!isHost} onClick={onSaveSettings}>Save Settings</button>
          <button disabled={!isHost || players.length === 0} onClick={onDealRoles}>Deal Private Role Cards</button>
        </div>
      </section>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}
