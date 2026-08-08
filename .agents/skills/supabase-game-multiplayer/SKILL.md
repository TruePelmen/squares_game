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
