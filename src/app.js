/**
 * SQUARES - Main Application Entry & Orchestrator
 * Integrates Engine, UI, Audio, Canvas & Supabase Multiplayer
 */

import { initAudio, synthSound, playRollTick, playPlaceBlockSound, playHoverTick, playErrorTone, playWallSound, playBreachSound, playVictoryFanfare, toggleMuted } from './audio.js';
import { createInitialState, resetBoardMatrix, isValidPlacement, hasAnyValidMoves, tallyScores, getPlayerTeam, getStartingCorner } from './game.js';
import { resizeCanvas, drawBoard, startConfettiEffect, stopConfettiEffect } from './canvas.js';
import { getDOMElements, showToast, buildScoreboardUI, updateThemeStyles, showDoublesModal, updateHelperBubble } from './ui.js';
import { supabase, getCurrentUser, signInWithGoogle, createOnlineRoom, joinOnlineRoomByCode, fetchRoomDetails, updateOnlineGameState, updateRoomStatus, subscribeToRoom, sendBroadcastHover, trackPresence, unsubscribeFromRoom } from './db.js';

let state = createInitialState();
let hoverState = { row: -1, col: -1, isValid: false };
let remoteHoverState = { row: -1, col: -1, width: 0, height: 0, playerIndex: 0 };
let DOM = {};
let animationFrameId = null;

function init() {
    DOM = getDOMElements();
    setupEventListeners();
    setupColorSelectors();
    setupTeamSelectors();
    checkCurrentUser();
    
    resetBoardMatrix(state);
    resizeCanvas(DOM.canvas, state);
    
    requestAnimationFrame(canvasLoop);
}

async function checkCurrentUser() {
    const user = await getCurrentUser();
    if (user && DOM.userProfileBadge) {
        DOM.googleAuthBtn?.classList.add("hidden");
        DOM.userProfileBadge.classList.remove("hidden");
        if (DOM.userName) {
            DOM.userName.textContent = user.user_metadata?.full_name || user.email;
        }
        if (DOM.userAvatar && user.user_metadata?.avatar_url) {
            DOM.userAvatar.src = user.user_metadata.avatar_url;
        }
    }
}

function setupColorSelectors() {
    const registerGroup = (containerId, playerNum) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.addEventListener("click", (e) => {
            if (e.target.classList.contains("color-btn")) {
                container.querySelectorAll(".color-btn").forEach(btn => btn.classList.remove("active"));
                e.target.classList.add("active");
                state.playerColors[playerNum] = e.target.dataset.color;
                updateThemeStyles(state);
            }
        });
    };
    for (let i = 1; i <= 6; i++) {
        registerGroup(`p${i}-colors`, i);
    }
}

function setupTeamSelectors() {
    const registerGroup = (containerId, playerNum) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.addEventListener("click", (e) => {
            const btn = e.target.closest(".team-btn");
            if (btn) {
                container.querySelectorAll(".team-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                state.playerTeams[playerNum] = parseInt(btn.dataset.team);
                playHoverTick();
            }
        });
    };
    for (let i = 1; i <= 6; i++) {
        registerGroup(`p${i}-teams`, i);
    }
}

function switchPlayer(nextPlayer) {
    state.activePlayer = nextPlayer;
    state.hasRolled = false;
    state.isRotated = false;
    
    if (DOM.gameAutoRollChk) {
        DOM.gameAutoRollChk.checked = state.autoRoll;
    }
    
    state.activeSpecialMove = null;
    state.customCellsToPlace = 0;
    state.customCellsPlaced = [];
    state.isDrawingDrag = false;
    state.isErasingDrag = false;
    
    // In Online mode, disable controls if it's not local player's turn
    const isMyTurn = !state.isOnline || (state.activePlayer === state.localPlayerIndex);
    
    DOM.rollBtn.disabled = !isMyTurn;
    DOM.rotateBtn.disabled = true;
    DOM.passBtn.disabled = true;
    DOM.rotateBtn.classList.remove("active-ready");
    DOM.passBtn.classList.remove("active-ready");
    
    const activeName = state.playerNames[state.activePlayer] || `Player ${state.activePlayer}`;
    DOM.turnText.textContent = isMyTurn ? "Your Turn!" : `${activeName}'s Turn`;
    DOM.rollResultText.textContent = isMyTurn ? "Roll the dice to see your dimensions!" : `Waiting for ${activeName} to roll...`;
    
    if (DOM.doublesModal) DOM.doublesModal.classList.remove("active");
    if (DOM.drawControlsBar) DOM.drawControlsBar.classList.remove("active");
    
    document.body.className = `player-active-p${state.activePlayer}`;
    
    const activeTheme = state.colors[state.playerColors[state.activePlayer]];
    const nextPlayerIndex = (nextPlayer % state.playersCount) || state.playersCount;
    const nextTheme = state.colors[state.playerColors[nextPlayerIndex]];
    
    if (activeTheme) {
        document.documentElement.style.setProperty("--p1-color", activeTheme.hex);
        document.documentElement.style.setProperty("--p1-glow", activeTheme.glow);
    }
    if (nextTheme) {
        document.documentElement.style.setProperty("--p2-color", nextTheme.hex);
        document.documentElement.style.setProperty("--p2-glow", nextTheme.glow);
    }
    
    for (let i = 1; i <= state.playersCount; i++) {
        const els = state.scoreCardElements[i];
        if (els) {
            if (i === state.activePlayer) {
                els.card.classList.add("active-turn");
                els.card.style.borderColor = activeTheme ? activeTheme.hex : "#00f0ff";
                els.card.style.boxShadow = `0 0 15px ${activeTheme ? activeTheme.glow : "rgba(0,240,255,0.45)"}`;
            } else {
                els.card.classList.remove("active-turn");
                els.card.style.borderColor = "var(--border-glass)";
                els.card.style.boxShadow = "none";
            }
        }
    }
    
    // --- COSMIC COMEBACK CATCH-UP MECHANIC ---
    if (state.enableAdvancedRules && state.consecutiveSkippedTurns[nextPlayer] >= 2) {
        state.hasRolled = true;
        state.activeSpecialMove = '1x1-anywhere';
        state.currentRoll = [1, 1];
        
        DOM.rollBtn.disabled = true;
        DOM.rotateBtn.disabled = true;
        DOM.passBtn.disabled = !isMyTurn;
        if (isMyTurn) DOM.passBtn.classList.add("active-ready");
        
        DOM.rollResultText.innerHTML = "<span style='color:var(--neon-emerald);font-weight:700;text-shadow:0 0 10px rgba(0,255,170,0.3);'>COSMIC COMEBACK ACTIVE!</span>";
        showToast(DOM, "Cosmic Comeback! 1x1 Seed granted to break the blockade.");
        
        setTimeout(() => {
            if (!state.soundMuted) {
                synthSound([261.63, 329.63, 392.00, 523.25, 659.25], [0.06, 0.06, 0.06, 0.06, 0.2], "sine", [0.15, 0.15, 0.15, 0.15, 0.001]);
            }
        }, 100);
    }
    
    updateHelperBubble(DOM, state);
    
    if (DOM.gameAutoRollChk && activeTheme) {
        DOM.gameAutoRollChk.style.accentColor = activeTheme.hex;
    }
    
    if (state.autoRoll && !state.isGameOver && !state.hasRolled && isMyTurn) {
        setTimeout(() => {
            if (state.autoRoll && !state.hasRolled && !state.isGameOver) {
                triggerDiceRoll();
            }
        }, 800);
    }
}

function triggerDiceRoll() {
    if (state.hasRolled || state.isGameOver) return;
    if (state.isOnline && state.activePlayer !== state.localPlayerIndex) return;
    
    initAudio();
    DOM.rollBtn.disabled = true;
    DOM.rotateBtn.disabled = true;
    DOM.passBtn.disabled = true;
    
    DOM.die1.classList.add("rolling");
    DOM.die2.classList.add("rolling");
    DOM.rollResultText.textContent = "Rolling coordinates...";
    
    let soundInterval = setInterval(playRollTick, 90);
    
    setTimeout(() => {
        clearInterval(soundInterval);
        
        DOM.die1.classList.remove("rolling");
        DOM.die2.classList.remove("rolling");
        
        let d1Val, d2Val;
        if (state.debugNextRoll) {
            d1Val = state.debugNextRoll[0];
            d2Val = state.debugNextRoll[1];
            state.debugNextRoll = null;
        } else {
            d1Val = Math.floor(Math.random() * 6) + 1;
            d2Val = Math.floor(Math.random() * 6) + 1;
        }
        
        const originalD1 = d1Val;
        const originalD2 = d2Val;
        
        playHoverTick();
        alignDie(DOM.die1, d1Val);
        alignDie(DOM.die2, d2Val);
        
        const activeMult = state.doubleSizeMultiplier[state.activePlayer];
        let multiplierAppliedText = "";
        
        if (activeMult === 2) {
            d1Val *= 2;
            d2Val *= 2;
            multiplierAppliedText = "<span style='color:var(--neon-emerald);font-weight:700;'> [GROWTH X2!]</span>";
            state.doubleSizeMultiplier[state.activePlayer] = 1;
        } else if (activeMult === 0.5) {
            d1Val = Math.max(1, Math.floor(d1Val * 0.5));
            d2Val = Math.max(1, Math.floor(d2Val * 0.5));
            multiplierAppliedText = "<span style='color:var(--neon-orange);font-weight:700;'> [SHRINK 1/2!]</span>";
            state.doubleSizeMultiplier[state.activePlayer] = 1;
        }
        
        state.currentRoll = [d1Val, d2Val];
        state.hasRolled = true;
        state.rollsCount[state.activePlayer]++;
        
        let activePlayerNum = Number(state.activePlayer);
        let playerCellsCount = 0;
        for (let i = 0; i < state.gridSize; i++) {
            for (let j = 0; j < state.gridSize; j++) {
                if (state.board[i][j] === activePlayerNum) playerCellsCount++;
            }
        }
        if (playerCellsCount === 0 && d1Val === 1 && d2Val === 1) {
            state.activeSpecialMove = '1x1-anywhere';
            showToast(DOM, "First Turn 1x1! Cosmic Seed: Place anywhere!");
        }
        
        DOM.rollResultText.innerHTML = `You rolled a <strong>${d1Val} x ${d2Val}</strong> block!${multiplierAppliedText}`;
        
        if (state.enableAdvancedRules && originalD1 === originalD2) {
            handleDoubleRollSequence(originalD1);
        } else {
            DOM.rotateBtn.disabled = false;
            DOM.passBtn.disabled = false;
            DOM.rotateBtn.classList.add("active-ready");
            DOM.passBtn.classList.add("active-ready");
            
            updateHelperBubble(DOM, state);
            
            if (!hasAnyValidMoves(state, state.activePlayer, state.currentRoll)) {
                triggerAutoPassSequence();
            }
        }
        
        if (state.isOnline && state.roomId) {
            syncGameStateToSupabase();
        }
    }, 1200);
}

function alignDie(element, val) {
    let rx = 0, ry = 0;
    switch (val) {
        case 1: rx = 0; ry = 0; break;
        case 2: rx = 0; ry = -90; break;
        case 3: rx = 0; ry = -180; break;
        case 4: rx = 0; ry = 90; break;
        case 5: rx = -90; ry = 0; break;
        case 6: rx = 90; ry = 0; break;
    }
    element.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
}

function handleDoubleRollSequence(doubleVal) {
    playVictoryFanfare();
    
    switch (doubleVal) {
        case 1:
            state.activeSpecialMove = '1x1-anywhere';
            showToast(DOM, "1x1 Double! Cosmic Seed: Place anywhere!");
            DOM.rotateBtn.disabled = true;
            DOM.passBtn.disabled = false;
            DOM.passBtn.classList.add("active-ready");
            updateHelperBubble(DOM, state);
            break;
            
        case 2:
            showToast(DOM, "2x2 Double! Size Doubled Next Turn!");
            state.doubleSizeMultiplier[state.activePlayer] = 2;
            
            DOM.rotateBtn.disabled = false;
            DOM.passBtn.disabled = false;
            DOM.rotateBtn.classList.add("active-ready");
            DOM.passBtn.classList.add("active-ready");
            updateHelperBubble(DOM, state);
            
            if (!hasAnyValidMoves(state, state.activePlayer, state.currentRoll)) {
                triggerAutoPassSequence();
            }
            break;
            
        case 3:
            showToast(DOM, "3x3 Double! Size Halved Next Turn!");
            state.doubleSizeMultiplier[state.activePlayer] = 0.5;
            
            DOM.rotateBtn.disabled = false;
            DOM.passBtn.disabled = false;
            DOM.rotateBtn.classList.add("active-ready");
            DOM.passBtn.classList.add("active-ready");
            updateHelperBubble(DOM, state);
            
            if (!hasAnyValidMoves(state, state.activePlayer, state.currentRoll)) {
                triggerAutoPassSequence();
            }
            break;
            
        case 4:
            showDoublesModal(
                DOM,
                "DOUBLE 4x4 ROLLED!",
                "Would you like to claim territory normally or block your opponent by placing a Wall?",
                [
                    { label: "Place 4x4 Territory", action: () => selectNormalDoublesMove() },
                    { label: "Build Contiguous Wall (4 cells)", action: () => selectWallDrawingMove() }
                ]
            );
            break;
            
        case 5:
            state.activeSpecialMove = 'breach-overwriting';
            showToast(DOM, "5x5 Double! Tectonic Breach active: overwrite opponent cells!");
            DOM.rotateBtn.disabled = false;
            DOM.passBtn.disabled = false;
            DOM.rotateBtn.classList.add("active-ready");
            DOM.passBtn.classList.add("active-ready");
            updateHelperBubble(DOM, state);
            
            if (!hasAnyValidMoves(state, state.activePlayer, state.currentRoll)) {
                triggerAutoPassSequence();
            }
            break;
            
        case 6:
            state.activeSpecialMove = 'custom36-drawing';
            state.customCellsToPlace = 36;
            state.customCellsPlaced = [];
            
            if (DOM.drawControlsBar) {
                DOM.drawStatusText.textContent = "Draw custom shape: 36 cells left";
                DOM.drawConfirmBtn.disabled = true;
                DOM.drawControlsBar.classList.add("active");
            }
            DOM.rotateBtn.disabled = true;
            DOM.passBtn.disabled = false;
            DOM.passBtn.classList.add("active-ready");
            
            updateHelperBubble(DOM, state);
            showToast(DOM, "6x6 Double! Draw 36-cell custom shape!");
            break;
    }
}

function selectNormalDoublesMove() {
    DOM.rotateBtn.disabled = false;
    DOM.passBtn.disabled = false;
    DOM.rotateBtn.classList.add("active-ready");
    DOM.passBtn.classList.add("active-ready");
    updateHelperBubble(DOM, state);
    
    if (!hasAnyValidMoves(state, state.activePlayer, state.currentRoll)) {
        triggerAutoPassSequence();
    }
}

function selectWallDrawingMove() {
    state.activeSpecialMove = 'wall-drawing';
    state.customCellsToPlace = 4;
    state.customCellsPlaced = [];
    
    if (DOM.drawControlsBar) {
        DOM.drawStatusText.textContent = "Draw custom wall: 4 cells left";
        DOM.drawConfirmBtn.disabled = true;
        DOM.drawControlsBar.classList.add("active");
    }
    DOM.rotateBtn.disabled = true;
    DOM.passBtn.disabled = false;
    DOM.passBtn.classList.add("active-ready");
    
    updateHelperBubble(DOM, state);
    showToast(DOM, "Select 4 connected grid cells to place a Wall!");
}

function triggerAutoPassSequence() {
    DOM.rotateBtn.disabled = true;
    DOM.rotateBtn.classList.remove("active-ready");
    
    playErrorTone();
    showToast(DOM, "No valid placements available! Turn skipped.");
    
    DOM.rollResultText.innerHTML = `<span style="color: var(--neon-pink); font-weight:700;">No valid placements!</span>`;
    DOM.helperText.innerHTML = `<span style="color: var(--neon-pink);">There are no legal spots to fit this block. Your turn is passed.</span>`;
    
    setTimeout(() => {
        if (state.hasRolled) {
            passTurn();
        }
    }, 2800);
}

function passTurn() {
    if (!state.hasRolled) return;
    
    state.consecutivePasses++;
    state.consecutiveSkippedTurns[state.activePlayer]++;
    
    const { counts } = tallyScores(state);
    updateScoreboardValues(counts);
    
    if (state.consecutivePasses >= state.playersCount) {
        endMatch();
    } else {
        const next = (state.activePlayer % state.playersCount) + 1;
        switchPlayer(next);
        if (state.isOnline && state.roomId) {
            syncGameStateToSupabase();
        }
    }
}

function updateScoreboardValues(counts) {
    const total = state.gridSize * state.gridSize;
    if (state.scoreCardElements) {
        for (let i = 1; i <= state.playersCount; i++) {
            const els = state.scoreCardElements[i];
            if (els) {
                els.value.textContent = (counts[i] || 0).toString();
                const pct = Math.round(((counts[i] || 0) / total) * 100);
                els.pct.textContent = `${pct}% of board`;
            }
        }
    }
}

function endMatch() {
    state.isGameOver = true;
    playVictoryFanfare();
    
    const { counts, total } = tallyScores(state);
    let totalClaimed = 0;
    for (let i = 1; i <= state.playersCount; i++) {
        totalClaimed += counts[i] || 0;
    }
    
    const playerScores = [];
    for (let i = 1; i <= state.playersCount; i++) {
        playerScores.push({
            id: i,
            name: state.playerNames[i] || `Player ${i}`,
            color: state.playerColors[i] || "cyan",
            score: counts[i] || 0
        });
    }
    playerScores.sort((a, b) => b.score - a.score);
    
    const winner = playerScores[0];
    const winnerTheme = state.colors[winner.color];
    
    DOM.victoryTitle.textContent = `${winner.name.toUpperCase()} WINS!`;
    DOM.victoryWinnerSubtitle.textContent = `${winner.name} has secured dominating control of the grid!`;
    if (winnerTheme) {
        DOM.victoryWinnerSubtitle.style.color = winnerTheme.hex;
        DOM.victoryTitle.style.color = winnerTheme.hex;
        DOM.victoryTitle.style.textShadow = `0 0 20px ${winnerTheme.glow}`;
    }
    
    DOM.vStatWinnerScore.textContent = winner.score.toString();
    DOM.vStatWinnerPct.textContent = `${Math.round((winner.score / total) * 100)}% of grid`;
    DOM.victoryOverlay.classList.add("active");
    
    startConfettiEffect(DOM.confettiCanvas, winnerTheme ? winnerTheme.hex : "#00f0ff");
}

function canvasLoop() {
    state.dashOffset -= 0.2;
    if (state.dashOffset < -20) state.dashOffset = 0;
    
    drawBoard(DOM.canvas, state, hoverState, remoteHoverState);
    animationFrameId = requestAnimationFrame(canvasLoop);
}

function handleMouseMove(e) {
    if (state.isOnline && state.activePlayer !== state.localPlayerIndex) return;
    
    const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
    if ((!state.hasRolled && !isDrawingMode) || state.isGameOver) return;
    
    const rect = DOM.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const cellX = Math.floor(x / (rect.width / state.gridSize));
    const cellY = Math.floor(y / (rect.height / state.gridSize));
    
    let blockW = state.currentRoll[0];
    let blockH = state.currentRoll[1];
    if (state.isRotated) {
        blockW = state.currentRoll[1];
        blockH = state.currentRoll[0];
    }
    
    let c = Math.max(0, Math.min(cellX - Math.floor(blockW / 2), state.gridSize - blockW));
    let r = Math.max(0, Math.min(cellY - Math.floor(blockH / 2), state.gridSize - blockH));
    
    const valid = isValidPlacement(state, r, c, blockW, blockH, state.activePlayer);
    
    if (hoverState.row !== r || hoverState.col !== c || hoverState.isValid !== valid) {
        hoverState.row = r;
        hoverState.col = c;
        hoverState.isValid = valid;
        
        if (valid) {
            playHoverTick();
        }
        
        if (state.isOnline && state.roomId) {
            sendBroadcastHover({
                row: r,
                col: c,
                width: blockW,
                height: blockH,
                playerIndex: state.localPlayerIndex
            });
        }
    }
}

function handleMouseLeave() {
    hoverState.row = -1;
    hoverState.col = -1;
    hoverState.isValid = false;
}

function handleGridClick() {
    if (state.isOnline && state.activePlayer !== state.localPlayerIndex) return;
    if (hoverState.row === -1 || hoverState.col === -1 || state.isGameOver) return;
    if (!state.hasRolled) return;
    
    if (!hoverState.isValid) {
        playErrorTone();
        showToast(DOM, "Invalid placement! Rule violation.");
        return;
    }
    
    let blockW = state.currentRoll[0];
    let blockH = state.currentRoll[1];
    if (state.isRotated) {
        blockW = state.currentRoll[1];
        blockH = state.currentRoll[0];
    }
    
    const r = hoverState.row;
    const c = hoverState.col;
    
    if (state.activeSpecialMove === 'breach-overwriting') {
        playBreachSound();
        showToast(DOM, "Tectonic Breach successful!");
    } else {
        playPlaceBlockSound();
    }
    
    for (let i = r; i < r + blockH; i++) {
        for (let j = c; j < c + blockW; j++) {
            state.board[i][j] = state.activePlayer;
        }
    }
    
    state.consecutiveSkippedTurns[state.activePlayer] = 0;
    const { counts } = tallyScores(state);
    updateScoreboardValues(counts);
    state.consecutivePasses = 0;
    handleMouseLeave();
    
    const next = (state.activePlayer % state.playersCount) + 1;
    switchPlayer(next);
    
    if (state.isOnline && state.roomId) {
        syncGameStateToSupabase();
    }
}

function toggleRotation() {
    if (!state.hasRolled) return;
    if (state.isOnline && state.activePlayer !== state.localPlayerIndex) return;
    
    state.isRotated = !state.isRotated;
    playHoverTick();
    
    updateHelperBubble(DOM, state);
    
    if (hoverState.row !== -1) {
        let blockW = state.currentRoll[0];
        let blockH = state.currentRoll[1];
        if (state.isRotated) {
            blockW = state.currentRoll[1];
            blockH = state.currentRoll[0];
        }
        
        hoverState.row = Math.max(0, Math.min(hoverState.row, state.gridSize - blockH));
        hoverState.col = Math.max(0, Math.min(hoverState.col, state.gridSize - blockW));
        hoverState.isValid = isValidPlacement(state, hoverState.row, hoverState.col, blockW, blockH, state.activePlayer);
    }
}

async function syncGameStateToSupabase() {
    if (!state.roomId) return;
    await updateOnlineGameState(state.roomId, {
        board: state.board,
        active_player: state.activePlayer,
        current_roll: state.currentRoll,
        has_rolled: state.hasRolled,
        consecutive_passes: state.consecutivePasses,
        is_game_over: state.isGameOver
    });
}

// --- ONLINE MULTIPLAYER HANDLERS ---
async function handleCreateRoom() {
    try {
        const p1Name = document.getElementById('p1-name')?.value.trim() || "Host Player";
        const p1Color = state.playerColors[1] || "cyan";
        
        showToast(DOM, "Creating room in Supabase...");
        
        const result = await createOnlineRoom({
            hostName: p1Name,
            hostColor: p1Color,
            gridSize: state.gridSize,
            mapType: state.mapType,
            playersCount: state.playersCount,
            enableAdvancedRules: DOM.advancedRulesChk?.checked || false,
            enableTeamMode: DOM.teamModeChk?.checked || false
        });
        
        state.isOnline = true;
        state.roomId = result.room_id;
        state.roomCode = result.room_code;
        state.localPlayerIndex = 1;
        state.isHost = true;
        
        openLobbyModal(result.room_code);
        subscribeAndTrackRoom(result.room_id);
    } catch (e) {
        playErrorTone();
        showToast(DOM, `Error creating room: ${e.message}`);
    }
}

async function handleJoinRoom() {
    const code = DOM.roomCodeInput?.value.trim().toUpperCase();
    if (!code || code.length !== 6) {
        playErrorTone();
        showToast(DOM, "Please enter a valid 6-character room code!");
        return;
    }
    
    try {
        const pName = document.getElementById('p1-name')?.value.trim() || "Guest Player";
        const pColor = state.playerColors[2] || "pink";
        
        showToast(DOM, `Joining room ${code}...`);
        
        const result = await joinOnlineRoomByCode({
            roomCode: code,
            playerName: pName,
            playerColor: pColor
        });
        
        state.isOnline = true;
        state.roomId = result.room_id;
        state.roomCode = result.room_code;
        state.localPlayerIndex = result.player_index;
        state.isHost = false;
        
        DOM.joinModal?.classList.remove("active");
        openLobbyModal(result.room_code);
        subscribeAndTrackRoom(result.room_id);
    } catch (e) {
        playErrorTone();
        showToast(DOM, `Error joining room: ${e.message}`);
    }
}

function openLobbyModal(code) {
    if (!DOM.lobbyModal) return;
    if (DOM.lobbyRoomCode) {
        DOM.lobbyRoomCode.textContent = code;
        DOM.lobbyRoomCode.onclick = () => {
            navigator.clipboard.writeText(code);
            showToast(DOM, "Room code copied to clipboard!");
        };
    }
    
    if (DOM.lobbyStartBtn) {
        if (state.isHost) {
            DOM.lobbyStartBtn.style.display = "block";
            DOM.lobbyStartBtn.textContent = "Start Match";
        } else {
            DOM.lobbyStartBtn.style.display = "none";
        }
    }
    
    DOM.lobbyModal.classList.add("active");
}

function subscribeAndTrackRoom(roomId) {
    subscribeToRoom(roomId, {
        onGameStateUpdate: (newGameState) => {
            state.board = newGameState.board || state.board;
            state.activePlayer = newGameState.active_player;
            state.currentRoll = newGameState.current_roll || [0, 0];
            state.hasRolled = newGameState.has_rolled;
            state.consecutivePasses = newGameState.consecutive_passes;
            state.isGameOver = newGameState.is_game_over;
            
            if (state.hasRolled && state.currentRoll[0] > 0) {
                alignDie(DOM.die1, state.currentRoll[0]);
                alignDie(DOM.die2, state.currentRoll[1]);
                DOM.rollResultText.innerHTML = `Player ${state.activePlayer} rolled a <strong>${state.currentRoll[0]} x ${state.currentRoll[1]}</strong> block!`;
            }
            
            switchPlayer(state.activePlayer);
        },
        onPlayersUpdate: async () => {
            refreshLobbyPlayers(roomId);
        },
        onRoomStatusUpdate: (updatedRoom) => {
            if (updatedRoom.status === 'playing') {
                DOM.lobbyModal?.classList.remove("active");
                startOnlineGameSession(updatedRoom);
            }
        },
        onBroadcastHover: (hoverData) => {
            if (hoverData.playerIndex !== state.localPlayerIndex) {
                remoteHoverState = hoverData;
            }
        },
        onPresenceSync: (presenceState) => {
            refreshLobbyPresence(presenceState);
        }
    });
    
    trackPresence({
        player_index: state.localPlayerIndex,
        name: state.playerNames[state.localPlayerIndex] || `Player ${state.localPlayerIndex}`,
        online_at: new Date().toISOString()
    });
    
    refreshLobbyPlayers(roomId);
}

async function refreshLobbyPlayers(roomId) {
    try {
        const { room, players } = await fetchRoomDetails(roomId);
        if (DOM.lobbyPlayersList) {
            DOM.lobbyPlayersList.innerHTML = "";
            
            state.playersCount = room.players_count;
            state.gridSize = room.grid_size;
            state.mapType = room.map_type;
            
            players.forEach(p => {
                state.playerNames[p.player_index] = p.name;
                state.playerColors[p.player_index] = p.color;
                
                const slot = document.createElement("div");
                slot.className = `lobby-player-slot ${p.player_index === state.localPlayerIndex ? 'active-slot' : ''}`;
                
                const info = document.createElement("div");
                info.className = "lobby-player-info";
                
                const dot = document.createElement("div");
                dot.className = "presence-dot online";
                
                const name = document.createElement("span");
                name.style.fontWeight = "700";
                name.textContent = `P${p.player_index}: ${p.name} ${p.player_index === 1 ? '(Host)' : ''}`;
                
                info.appendChild(dot);
                info.appendChild(name);
                
                slot.appendChild(info);
                DOM.lobbyPlayersList.appendChild(slot);
            });
        }
    } catch (e) {
        console.error("Error refreshing lobby players:", e);
    }
}

function refreshLobbyPresence(presenceState) {
    // Sync online presence indicators
    console.log("Presence sync:", presenceState);
}

async function startOnlineGameSession(room) {
    const { players, gameState } = await fetchRoomDetails(state.roomId);
    
    players.forEach(p => {
        state.playerNames[p.player_index] = p.name;
        state.playerColors[p.player_index] = p.color;
    });
    
    state.board = gameState.board || state.board;
    state.activePlayer = gameState.active_player || 1;
    
    buildScoreboardUI(DOM, state);
    updateThemeStyles(state);
    
    DOM.setupScreen.classList.remove("active");
    DOM.gameScreen.classList.add("active");
    
    switchPlayer(state.activePlayer);
    resizeCanvas(DOM.canvas, state);
    playPlaceBlockSound();
    
    showToast(DOM, `Match started! You are Player ${state.localPlayerIndex}.`);
}

function setupEventListeners() {
    // Mode Switcher Tabs
    DOM.modeLocalBtn?.addEventListener("click", () => {
        DOM.modeLocalBtn.classList.add("active");
        DOM.modeOnlineBtn?.classList.remove("active");
        DOM.startGameBtn?.classList.remove("hidden");
        DOM.onlineControlsGroup?.classList.add("hidden");
        state.isOnline = false;
    });
    
    DOM.modeOnlineBtn?.addEventListener("click", () => {
        DOM.modeOnlineBtn.classList.add("active");
        DOM.modeLocalBtn?.classList.remove("active");
        DOM.startGameBtn?.classList.add("hidden");
        DOM.onlineControlsGroup?.classList.remove("hidden");
        state.isOnline = true;
    });
    
    // Auth & Room Buttons
    DOM.googleAuthBtn?.addEventListener("click", signInWithGoogle);
    DOM.createRoomBtn?.addEventListener("click", handleCreateRoom);
    DOM.joinRoomBtn?.addEventListener("click", () => DOM.joinModal?.classList.add("active"));
    DOM.joinCancelBtn?.addEventListener("click", () => DOM.joinModal?.classList.remove("active"));
    DOM.joinConfirmBtn?.addEventListener("click", handleJoinRoom);
    
    DOM.lobbyStartBtn?.addEventListener("click", async () => {
        if (!state.isHost) return;
        await updateRoomStatus(state.roomId, 'playing');
    });
    
    DOM.lobbyLeaveBtn?.addEventListener("click", () => {
        unsubscribeFromRoom();
        DOM.lobbyModal?.classList.remove("active");
        state.isOnline = false;
        state.roomId = null;
        showToast(DOM, "Left the room.");
    });
    
    DOM.startGameBtn?.addEventListener("click", async () => {
        initAudio();
        
        for (let i = 1; i <= state.playersCount; i++) {
            const nameInput = document.getElementById(`p${i}-name`);
            if (nameInput) {
                state.playerNames[i] = nameInput.value.trim() || `Player ${i}`;
            }
        }
        
        buildScoreboardUI(DOM, state);
        state.enableAdvancedRules = DOM.advancedRulesChk?.checked || false;
        state.enableTeamMode = DOM.teamModeChk?.checked || false;
        state.autoRoll = DOM.autoRollChk?.checked || false;
        
        updateThemeStyles(state);
        resetBoardMatrix(state);
        
        DOM.setupScreen.classList.remove("active");
        DOM.gameScreen.classList.add("active");
        
        switchPlayer(1);
        resizeCanvas(DOM.canvas, state);
        playPlaceBlockSound();
    });
    
    DOM.playerCountButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            DOM.playerCountButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.playersCount = parseInt(btn.dataset.count);
            
            for (let i = 1; i <= 6; i++) {
                const card = document.getElementById(`p${i}-card`);
                if (card) {
                    if (i <= state.playersCount) card.classList.remove("hidden");
                    else card.classList.add("hidden");
                }
            }
        });
    });
    
    DOM.mapStyleButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            DOM.mapStyleButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.mapType = btn.dataset.map;
        });
    });
    
    DOM.gridSelectors.forEach(btn => {
        btn.addEventListener("click", () => {
            DOM.gridSelectors.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.gridSize = parseInt(btn.dataset.size);
            if (DOM.customSizeInput) DOM.customSizeInput.value = "";
        });
    });
    
    DOM.rollBtn?.addEventListener("click", triggerDiceRoll);
    DOM.rotateBtn?.addEventListener("click", toggleRotation);
    DOM.passBtn?.addEventListener("click", passTurn);
    
    DOM.canvas?.addEventListener("mousemove", handleMouseMove);
    DOM.canvas?.addEventListener("mouseleave", handleMouseLeave);
    DOM.canvas?.addEventListener("click", handleGridClick);
    DOM.canvas?.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (state.hasRolled && !DOM.rotateBtn.disabled) {
            toggleRotation();
        }
    });
    
    window.addEventListener("keydown", (e) => {
        if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) return;
        if (e.code === "Space") {
            e.preventDefault();
            if (state.hasRolled && !DOM.rotateBtn.disabled) {
                toggleRotation();
            }
        }
    });
    
    DOM.toggleRulesBtn?.addEventListener("click", () => DOM.rulesDrawer.classList.add("active"));
    DOM.closeRulesBtn?.addEventListener("click", () => DOM.rulesDrawer.classList.remove("active"));
    DOM.muteBtn?.addEventListener("click", () => {
        const muted = toggleMuted();
        if (DOM.muteIcon) {
            DOM.muteIcon.className = muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
        }
        showToast(DOM, muted ? "Sound effects muted." : "Sound effects enabled.");
    });
    
    DOM.resetBtn?.addEventListener("click", () => {
        if (confirm("Reset current match? Progress will be lost.")) {
            resetBoardMatrix(state);
            switchPlayer(1);
            resizeCanvas(DOM.canvas, state);
        }
    });
    
    DOM.rematchBtn?.addEventListener("click", () => {
        stopConfettiEffect();
        DOM.victoryOverlay.classList.remove("active");
        resetBoardMatrix(state);
        switchPlayer(1);
        resizeCanvas(DOM.canvas, state);
    });
    
    window.addEventListener("resize", () => {
        if (DOM.gameScreen.classList.contains("active")) {
            resizeCanvas(DOM.canvas, state);
        }
    });
}

window.addEventListener("DOMContentLoaded", init);
