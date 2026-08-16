/**
 * SQUARES - Supabase Integration Module
 * Handles Authentication, Realtime DB Sync, Presence (Online status), and Broadcast (Cursor hover)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://umwiskijzmthbmnqtdzq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_pPc8LNoswEvj2cfv8v-_Vw_VWeSeCQo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let activeChannel = null;

export async function getCurrentUser() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (e) {
        console.error("Error fetching current user:", e);
        return null;
    }
}

export async function signInWithGoogle() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Google auth error:", e);
        throw e;
    }
}

export async function signOutUser() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (e) {
        console.error("Sign out error:", e);
        throw e;
    }
}

export function onAuthChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
        if (callback) callback(event, session);
    });
}

export async function createOnlineRoom({ hostName, hostColor, gridSize, mapType, playersCount, enableAdvancedRules, enableTeamMode }) {
    try {
        const user = await getCurrentUser();
        const userId = user ? user.id : null;

        const { data, error } = await supabase.rpc('create_room_with_host', {
            p_host_id: userId,
            p_host_name: hostName,
            p_host_color: hostColor,
            p_grid_size: gridSize,
            p_map_type: mapType,
            p_players_count: playersCount,
            p_enable_advanced_rules: enableAdvancedRules,
            p_enable_team_mode: enableTeamMode
        });

        if (error) throw error;
        return data; // returns { room_id, room_code, player_id, player_index }
    } catch (e) {
        console.error("Error creating online room:", e);
        throw e;
    }
}

export async function joinOnlineRoomByCode({ roomCode, playerName, playerColor }) {
    try {
        const user = await getCurrentUser();
        const userId = user ? user.id : null;

        const { data, error } = await supabase.rpc('join_room_by_code', {
            p_room_code: roomCode,
            p_user_id: userId,
            p_player_name: playerName,
            p_player_color: playerColor
        });

        if (error) throw error;
        return data; // returns { room_id, room_code, player_id, player_index, already_joined }
    } catch (e) {
        console.error("Error joining online room:", e);
        throw e;
    }
}

export async function fetchRoomDetails(roomId) {
    try {
        const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();

        if (roomErr) throw roomErr;

        const { data: players, error: playersErr } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomId)
            .order('player_index', { ascending: true });

        if (playersErr) throw playersErr;

        const { data: gameState, error: stateErr } = await supabase
            .from('game_states')
            .select('*')
            .eq('room_id', roomId)
            .single();

        if (stateErr) throw stateErr;

        return { room, players, gameState };
    } catch (e) {
        console.error("Error fetching room details:", e);
        throw e;
    }
}

export async function updateOnlineGameState(roomId, stateUpdates) {
    try {
        const { data, error } = await supabase
            .from('game_states')
            .update({
                ...stateUpdates,
                updated_at: new Date().toISOString()
            })
            .eq('room_id', roomId);

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error updating game state:", e);
        throw e;
    }
}

export async function updateRoomStatus(roomId, newStatus) {
    try {
        const { data, error } = await supabase
            .from('rooms')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', roomId);

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error updating room status:", e);
        throw e;
    }
}

export function subscribeToRoom(roomId, callbacks) {
    if (activeChannel) {
        supabase.removeChannel(activeChannel);
    }

    activeChannel = supabase.channel(`room_${roomId}`, {
        config: {
            broadcast: { self: false },
            presence: { key: roomId }
        }
    });

    // 1. Listen to DB changes on game_states
    activeChannel
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'game_states',
            filter: `room_id=eq.${roomId}`
        }, (payload) => {
            if (callbacks.onGameStateUpdate) {
                callbacks.onGameStateUpdate(payload.new);
            }
        })
        // 2. Listen to DB changes on players (joined/left/ready)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'players',
            filter: `room_id=eq.${roomId}`
        }, (payload) => {
            if (callbacks.onPlayersUpdate) {
                callbacks.onPlayersUpdate(payload);
            }
        })
        // 3. Listen to DB changes on room status
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`
        }, (payload) => {
            if (callbacks.onRoomStatusUpdate) {
                callbacks.onRoomStatusUpdate(payload.new);
            }
        })
        // 4. Listen to Realtime Broadcast for Cursor Hover
        .on('broadcast', { event: 'hover' }, (payload) => {
            if (callbacks.onBroadcastHover) {
                callbacks.onBroadcastHover(payload.payload);
            }
        })
        // 5. Presence sync
        .on('presence', { event: 'sync' }, () => {
            const state = activeChannel.presenceState();
            if (callbacks.onPresenceSync) {
                callbacks.onPresenceSync(state);
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Subscribed to room channel: ${roomId}`);
            }
        });

    return activeChannel;
}

export function sendBroadcastHover(hoverData) {
    if (activeChannel) {
        activeChannel.send({
            type: 'broadcast',
            event: 'hover',
            payload: hoverData
        });
    }
}

export function trackPresence(playerData) {
    if (activeChannel) {
        activeChannel.track(playerData);
    }
}

export function unsubscribeFromRoom() {
    if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
    }
}
