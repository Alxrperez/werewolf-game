# Build-a-Werewolf (MVP)

Google Meet add-on style MVP with:
- Side panel player flow (create/join lobby, ready-up, reveal private role, submit actions/votes)
- Main stage host flow (settings, start game, resolve night/day, winner detection)
- Firestore-backed lobby state and strict role secrecy rules
- Type-safe game engine + unit tests

## Routes
- `/meet/side` — player private panel
- `/meet/stage` — host control stage

## Runtime context binding
Both routes try to bind Meet session context from:
1. `window.meet.addon.getContext()` (if available)
2. URL params fallback (`meetingId`, `lobby`, `displayName`, `role=host`)
3. Local cache (`localStorage`) for continuity

## Firestore model
`/lobbies/{lobbyId}`
- document: `hostUid`, `phase`, `settings`, `dayNumber`, `winner`, `lastNight`, timestamps
- subcollections:
  - `players/{uid}`
  - `roleCards/{uid}` (private role ownership)
  - `nightActions/{uid}`
  - `dayVotes/{uid}`

## Local development
```bash
npm install
npm run dev
```

## Verification
```bash
npm test
npx tsc --noEmit
npm run build
```
