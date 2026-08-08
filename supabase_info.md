# Supabase Project Credentials & Information

Цей файл містить дані підключення та структуру бази даних в Supabase для гри **Squares Multiplayer**.

## 📡 Деталі проекту
- **Назва проекту:** SquaresGame
- **Project Ref ID:** `umwiskijzmthbmnqtdzq`
- **Регіон:** `eu-central-1` (Франкфурт, Німеччина)
- **Project URL:** `https://umwiskijzmthbmnqtdzq.supabase.co`
- **Статус:** `ACTIVE_HEALTHY` 🟢

## 🔑 API Ключі
- **Modern Publishable Key:** `sb_publishable_pPc8LNoswEvj2cfv8v-_Vw_VWeSeCQo`
- **Legacy Anon Key (JWT):** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtd2lza2lqem10aGJtbnF0ZHpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NDY2NDYsImV4cCI6MjA5OTQyMjY0Nn0.seXU_n-OqJe2bW-G-FJHwq0eMGad8z-qevKQrj2gExs`

---

## 🗄️ Розгорнута база даних (Database Schema)

Усі 4 таблиці розгорнуто в схему `public` з увімкненими Row Level Security (RLS) та підпискою Realtime:

1. **`public.profiles`**:
   - `id` (UUID, PK, References `auth.users.id`)
   - `username`, `avatar_url`, `games_played`, `games_won`, `total_cells_captured`, `created_at`, `updated_at`.
   - Автоматичний тригер `handle_new_user()` створює профіль при реєстрації через Google Auth.

2. **`public.rooms`**:
   - `id` (UUID, PK), `code` (VARCHAR(10), Unique Code, e.g. `XF4G8A`), `host_id` (UUID).
   - `grid_size` (15, 20, 30), `map_type`, `players_count` (2-6), `enable_advanced_rules`, `enable_team_mode`, `status` (`'waiting'`, `'playing'`, `'finished'`).

3. **`public.players`**:
   - `id` (UUID, PK), `user_id` (UUID), `room_id` (UUID, FK -> `rooms.id`), `player_index` (1-6).
   - `name`, `color`, `team`, `is_ready`, `joined_at`.

4. **`public.game_states`**:
   - `room_id` (UUID, PK, FK -> `rooms.id`), `board` (JSONB 2D array).
   - `active_player` (1-6), `current_roll` (INT[]), `has_rolled` (BOOL), `consecutive_passes` (INT).
   - `double_size_multiplier` (JSONB), `consecutive_skipped_turns` (JSONB), `active_special_move` (VARCHAR).
   - `custom_cells_to_place`, `custom_cells_placed`, `is_game_over`, `winner_index`.

---

## ⚡ Розгорнуті RPC Процедури (PostgreSQL Functions)

1. **`public.generate_room_code()`**:
   - Генерує випадковий 6-значний код кімнати з унікальних символів.

2. **`public.create_room_with_host(...)`**:
   - Атомарно створює запис у `rooms`, додає творця у `players` як Player 1 та ініціалізує `game_states`.

3. **`public.join_room_by_code(...)`**:
   - Атомарно знаходить кімнату за кодом, визначає наступний номер гравця (`player_index`), додає його у `players` та повертає статус.

---
> [!IMPORTANT]
> **Примітка щодо безпеки:** Публічні ключі (Anon/Publishable) безпечно використовувати безпосередньо у фронтенд-коді браузера. Проте, якщо ми будемо генерувати Service Role Key або паролі до бази даних, їх потрібно тримати в таємниці.

