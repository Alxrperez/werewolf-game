# Build-a-Werewolf — Project Status

## Current Status (MVP)

**Phase:** Foundation complete, core gameplay implementation in progress.

### ✅ Completed
- Next.js + TypeScript scaffold created
- Meet app route scaffolding:
  - Side panel route
  - Main stage route
- Firebase client initialization wired
- Firestore rules file scaffolded
- Initial game engine module created
- First unit test added (role assignment)
- Repository connected and pushed to GitHub

### 🔄 In Progress
- Chunk 2: Core app plumbing + gameplay flow
  - Meet add-on context wiring (meeting ID binding)
  - Firestore schema helpers for all required collections
  - Lobby + host controls
  - Role secrecy enforcement end-to-end

### ⏳ Missing / Next
- Full game loop implementation:
  - Night actions (wolf kill / seer check / doctor protect)
  - Resolve night/day/vote/reveal transitions
  - Win-condition checks
- Wolves-only chat with proper role gates
- Theme editor + Storage upload + live theme sync + lock toggle
- Hardened Firestore rules matching all phase/role constraints
- Full game-engine pure functions + unit tests:
  - resolveNight
  - resolveSeerCheck
  - tallyVotes
  - checkWin
- Meet add-on deployment assets and private testing setup docs
- Firebase Hosting deployment config and final README

## Active Workstream
1. Data model helpers + typed schema
2. Lobby and player state synchronization
3. Host-authoritative phase controls
4. Security hardening pass for Firestore rules

## Decisions Locked
- Vote mode default: **secret**
- Day timer default: **360s**
- Tie handling: **no elimination**
- MVP roles: **Werewolf, Villager, Seer, Doctor**

## Risks / Blockers
- Google Meet add-on registration and Marketplace private distribution setup still pending
- Final verification depends on private tester accounts in Meet

_Last updated: 2026-02-26 (EST)_
