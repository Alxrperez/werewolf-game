'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { getMeetRuntimeContext } from '@/src/lib/meetContext';
import {
  dayVotesColRef,
  lobbyRef,
  nightActionsColRef,
  playersColRef,
  resolveDayPhase,
  resolveNightPhase,
  roleCardsColRef,
  startGameWithRoles,
  updateLobbySettings
} from '@/src/lib/firestoreHelpers';
import {
  parseLobbyPlayer,
  parseRoleCard,
  type GameSettings,
  type Lobby,
  type LobbyPlayer,
  type RoleCard
} from '@/src/lib/firestoreSchema';

export default function MainStagePage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [lobbyIdInput, setLobbyIdInput] = useState('');
  const [activeLobbyId, setActiveLobbyId] = useState('');
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [cards, setCards] = useState<RoleCard[]>([]);
  const [nightActionCount, setNightActionCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [settings, setSettings] = useState<GameSettings>({ werewolves: 1, seer: true, doctor: true });
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    getMeetRuntimeContext().then((ctx) => {
      if (ctx.meetingId) {
        setLobbyIdInput(ctx.meetingId.toUpperCase());
      }
    });
  }, []);

  useEffect(() => {
    if (!activeLobbyId) return;

    const unsubLobby = onSnapshot(lobbyRef(db, activeLobbyId), (snap) => {
      if (!snap.exists()) {
        setLobby(null);
        setPlayers([]);
        setCards([]);
        return;
      }
      const data = snap.data() as Lobby;
      setLobby(data);
      setSettings(data.settings);
    });

    const unsubPlayers = onSnapshot(playersColRef(db, activeLobbyId), (snaps) => {
      setPlayers(snaps.docs.map((d) => parseLobbyPlayer(d.data())));
    });

    const unsubCards = onSnapshot(roleCardsColRef(db, activeLobbyId), (snaps) => {
      setCards(snaps.docs.map((d) => parseRoleCard(d.data())));
    });

    const unsubNight = onSnapshot(nightActionsColRef(db, activeLobbyId), (snaps) => setNightActionCount(snaps.size));
    const unsubVotes = onSnapshot(dayVotesColRef(db, activeLobbyId), (snaps) => setVoteCount(snaps.size));

    return () => {
      unsubLobby();
      unsubPlayers();
      unsubCards();
      unsubNight();
      unsubVotes();
    };
  }, [activeLobbyId]);

  const normalizedLobbyId = useMemo(() => lobbyIdInput.trim().toUpperCase(), [lobbyIdInput]);
  const isHost = useMemo(() => Boolean(user && lobby?.hostUid === user.uid), [lobby, user]);
  const readyCount = useMemo(() => players.filter((p) => p.isReady).length, [players]);
  const aliveCount = useMemo(() => players.filter((p) => p.alive).length, [players]);
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

  async function onStartGame() {
    if (!activeLobbyId || players.length < 4) return;
    setError(null);
    setStatus('');
    setBusy(true);

    try {
      await ensureSignedIn();
      await startGameWithRoles(db, activeLobbyId);
      setStatus('Game started. Night phase is live and private roles are assigned.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onResolveNight() {
    if (!activeLobbyId) return;
    setBusy(true);
    setError(null);
    setStatus('');
    try {
      await resolveNightPhase(db, activeLobbyId);
      setStatus('Night resolved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onResolveDay() {
    if (!activeLobbyId) return;
    setBusy(true);
    setError(null);
    setStatus('');
    try {
      await resolveDayPhase(db, activeLobbyId);
      setStatus('Day vote resolved.');
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
        <h2 style={{ marginTop: 0 }}>2) Game state</h2>
        <p style={{ margin: '6px 0' }}>Phase: <strong>{lobby?.phase ?? 'unknown'}</strong></p>
        <p style={{ margin: '6px 0' }}>Day Number: <strong>{lobby?.dayNumber ?? '-'}</strong></p>
        <p style={{ margin: '6px 0' }}>Winner: <strong>{lobby?.winner ?? 'none'}</strong></p>
        <p style={{ margin: '6px 0' }}>Alive Players: <strong>{aliveCount}/{players.length}</strong></p>
        <p style={{ margin: '6px 0' }}>Night Actions Submitted: <strong>{nightActionCount}</strong></p>
        <p style={{ margin: '6px 0' }}>Day Votes Submitted: <strong>{voteCount}</strong></p>
        {lobby?.lastNight ? (
          <p style={{ margin: '6px 0' }}>
            Last Night: eliminated <strong>{lobby.lastNight.eliminatedUid ?? 'nobody'}</strong>
          </p>
        ) : null}
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>3) Players and readiness</h2>
        <p style={{ margin: '6px 0' }}>Ready: <strong>{readyCount}/{players.length}</strong></p>
        <ul>
          {players.map((p) => (
            <li key={p.uid}>
              {p.displayName} {p.isHost ? '(Host)' : ''} — {p.alive ? '🫀 Alive' : '💀 Out'} — {p.isReady ? '✅ Ready' : '⌛ Waiting'}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>4) Host controls</h2>
        {!isHost && <p>Only the host can change settings and resolve rounds.</p>}

        <label>
          Werewolves:{' '}
          <input
            type="number"
            min={1}
            max={4}
            value={settings.werewolves}
            disabled={!isHost || busy || lobby?.phase !== 'lobby'}
            onChange={(e) => setSettings((prev) => ({ ...prev, werewolves: Number(e.target.value) || 1 }))}
          />
        </label>

        <div>
          <label>
            <input
              type="checkbox"
              checked={settings.seer}
              disabled={!isHost || busy || lobby?.phase !== 'lobby'}
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
              disabled={!isHost || busy || lobby?.phase !== 'lobby'}
              onChange={(e) => setSettings((prev) => ({ ...prev, doctor: e.target.checked }))}
            />
            Include Doctor
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button disabled={!isHost || !activeLobbyId || busy || lobby?.phase !== 'lobby'} onClick={onSaveSettings}>Save Settings</button>
          <button disabled={!isHost || !activeLobbyId || players.length < 4 || !allReady || busy || lobby?.phase !== 'lobby'} onClick={onStartGame}>
            Start Game
          </button>
          <button disabled={!isHost || !activeLobbyId || busy || lobby?.phase !== 'night'} onClick={onResolveNight}>
            Resolve Night
          </button>
          <button disabled={!isHost || !activeLobbyId || busy || lobby?.phase !== 'day'} onClick={onResolveDay}>
            Resolve Day Vote
          </button>
        </div>
        {!allReady && players.length > 0 ? <p>Wait for all players to be ready before starting.</p> : null}
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>5) Role audit (host-only visibility in UI)</h2>
        {!isHost ? (
          <p>Hidden: role details are private for players.</p>
        ) : (
          <ul>
            {cards.map((c) => (
              <li key={c.uid}>{c.uid}: <strong>{c.role}</strong> {c.viewedAt ? '👁️ viewed' : '🙈 unrevealed'}</li>
            ))}
          </ul>
        )}
      </section>

      {status ? <p style={{ color: 'green', margin: 0 }}>{status}</p> : null}
      {error ? <p style={{ color: 'crimson', margin: 0 }}>{error}</p> : null}
    </main>
  );
}
