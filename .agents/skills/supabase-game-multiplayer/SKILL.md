---
name: supabase-game-multiplayer
description: Best practices for building turn-based multiplayer web games using Supabase (Postgres RPCs, Realtime, Presence, Broadcast) and Vite.
---

# Supabase Multiplayer Game Development Guide

## 1. Atomic Room Lifecycle (RPCs)
Always use PostgreSQL functions for room operations to prevent race conditions during concurrent user joins:
- `create_room_with_host`: Generates unique 6-character room code, inserts `rooms` row, adds host to `players` as `Player 1`, and initializes `game_states` in one transaction.
- `join_room_by_code`: Validates room status, calculates next available `player_index`, and adds user to `players`.

## 2. Realtime Synchronization Architecture
Combine three Supabase Realtime primitives:
1. **Postgres Changes (`UPDATE` on `game_states`)**: Synchronize authoritative game state (board matrix, active player turn, rolls).
2. **Realtime Broadcast (`hover` event)**: Send transient opponent mouse coordinates for drawing translucent hover previews without DB writes.
3. **Realtime Presence**: Track online/offline statuses of connected participants in lobby and match.

## 3. Modular Architecture (Vite + Vanilla JS)
Structure the frontend into dedicated ES6 modules:
- `src/audio.js` — Web Audio API synthesizer
- `src/canvas.js` — High-DPI Canvas rendering & animations
- `src/game.js` — Core game state & placement validation rules
- `src/db.js` — Supabase client, auth & Realtime channel management
- `src/ui.js` — DOM manipulation & screen/modal controllers
- `src/app.js` — Main entry coordinator

---

## 4. Key Edge Cases & Multi-Client Gotchas (Learnings)

### A. Session Re-Initialization Protection (`isGameSessionActive`)
- **Problem**: Supabase Realtime emits `postgres_changes` on `rooms` whenever room metadata or status changes (e.g., status `'playing'`, `updated_at`, `players_count`).
- **Gotcha**: If `onRoomStatusUpdate` triggers `startOnlineGameSession()` unconditionally, it resets the active turn and wipes out `state.hasRolled` or `state.currentRoll` in the middle of a live turn.
- **Remedy**: Guard match start with `state.isGameSessionActive = true`. Reset this flag only when leaving the room or resetting the match.

### B. Realtime Roll & Turn State Diffing
- **Turn Switch**: `newGameState.active_player !== state.activePlayer` indicates authoritative turn handover. Call `switchPlayer(newGameState.active_player, newGameState.has_rolled)`.
- **Roll Update**: If `newGameState.has_rolled` is true, check if `!prevHasRolled` or if `current_roll` values changed. Update dice alignment and only trigger auto-pass evaluation if `rollChanged` is true.

### C. First-Turn Starting Corner UX Signposting
- **Problem**: In asymmetric starting position games (e.g. P1 Top-Left `(0, 0)` vs P2 Bottom-Right `(N-1, N-1)`), players may hover anywhere on the board on turn 1 and assume the game is broken when placements are rejected.
- **Remedy**:
  1. Render prominent animated glowing beacons with corner bracket targets and labels (`P1 START`, `P2 START`) on the canvas.
  2. Display clear helper text on turn 1 (*"First Move: Place block covering your glowing Bottom-Right corner!"*).
  3. On invalid click, provide specific guidance instead of a generic rule violation error.

### D. Room Code Copying & Text Selection UX
- **Avoid Global `user-select: none` Blocking**: Ensure room code spans and inputs have `user-select: all !important` or `user-select: text !important`.
- **Dedicated 1-Click Copy**: Always provide an explicit "Copy Code" button with clipboard fallback (`navigator.clipboard.writeText` with `document.execCommand` fallback), icon swap animation (e.g. checkmark + "Copied!"), and toast notification.
- **In-Game Room Code Badge**: Include an active room badge in the game header so players can easily view and copy the room code mid-game.

