/**
 * SQUARES - Main Application Entry & Orchestrator
 * Integrates Engine, UI, Audio, Canvas & Supabase Multiplayer
 */

import { initAudio, synthSound, playRollTick, playPlaceBlockSound, playHoverTick, playErrorTone, playWallSound, playBreachSound, playVictoryFanfare, toggleMuted } from './audio.js';
import { createInitialState, resetBoardMatrix, isValidPlacement, hasAnyValidMoves, tallyScores, getPlayerTeam, getStartingCorner, isDraftContiguous, validateFinalDraft, hasAnyDrawingMoves } from './game.js';
import { resizeCanvas, drawBoard, startConfettiEffect, stopConfettiEffect } from './canvas.js';
import { getDOMElements, showToast, buildScoreboardUI, updateThemeStyles, showDoublesModal, updateHelperBubble, getCornerName } from './ui.js';
import { supabase, getCurrentUser, signInWithGoogle, signOutUser, onAuthChange, createOnlineRoom, joinOnlineRoomByCode, fetchRoomDetails, updateOnlineGameState, updateRoomStatus, subscribeToRoom, sendBroadcastHover, trackPresence, unsubscribeFromRoom } from './db.js';

let state = createInitialState();
let hoverState = { row: -1, col: -1, isValid: false };
let remoteHoverState = { row: -1, col: -1, width: 0, height: 0, playerIndex: 0 };
let DOM = {};
let animationFrameId = null;
let currentAuthUser = null;

function getPlayerStats() {
    try {
        const data = localStorage.getItem("squares_player_stats");
        return data ? JSON.parse(data) : { matches: 0, wins: 0 };
    } catch (e) {
        return { matches: 0, wins: 0 };
    }
}

function updatePlayerStats(didWin) {
    const stats = getPlayerStats();
    stats.matches = (stats.matches || 0) + 1;
    if (didWin) stats.wins = (stats.wins || 0) + 1;
    try {
        localStorage.setItem("squares_player_stats", JSON.stringify(stats));
    } catch (e) {}
}

function refreshProfileModalUI() {
    const stats = getPlayerStats();
    if (DOM.pStatMatches) DOM.pStatMatches.textContent = stats.matches.toString();
    if (DOM.pStatWins) DOM.pStatWins.textContent = stats.wins.toString();
    const rate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
    if (DOM.pStatWinrate) DOM.pStatWinrate.textContent = `${rate}%`;
    
    if (currentAuthUser) {
        const fullName = currentAuthUser.user_metadata?.full_name || currentAuthUser.email?.split("@")[0] || "Player";
        if (DOM.profileModalName) DOM.profileModalName.textContent = fullName;
        if (DOM.profileModalEmail) DOM.profileModalEmail.textContent = currentAuthUser.email || "";
        if (DOM.profileModalAvatar && currentAuthUser.user_metadata?.avatar_url) {
            DOM.profileModalAvatar.src = currentAuthUser.user_metadata.avatar_url;
        }
    }
}

function init() {
    DOM = getDOMElements();
    setupEventListeners();
    setupColorSelectors();
    setupTeamSelectors();
    checkCurrentUser();
    checkUrlRoomCode();
    
    onAuthChange((event, session) => {
        checkCurrentUser(session?.user || null);
    });
    
    resetBoardMatrix(state);
    resizeCanvas(DOM.canvas, state);
    
    requestAnimationFrame(canvasLoop);
}

function checkUrlRoomCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    if (roomCode) {
        DOM.modeOnlineBtn?.click();
        if (DOM.roomCodeInput) DOM.roomCodeInput.value = roomCode.toUpperCase();
        DOM.joinModal?.classList.add("active");
        showToast(DOM, `Invite link detected! Click Join to enter room ${roomCode.toUpperCase()}`);
    }
}

async function checkCurrentUser(passedUser = null) {
    const user = passedUser !== null ? passedUser : await getCurrentUser();
    currentAuthUser = user;
    
    if (user) {
        DOM.googleAuthBtn?.classList.add("hidden");
        DOM.userProfileBadge?.classList.remove("hidden");
        
        const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Player";
        if (DOM.userName) {
            DOM.userName.textContent = displayName;
        }
        if (DOM.userAvatar && user.user_metadata?.avatar_url) {
            DOM.userAvatar.src = user.user_metadata.avatar_url;
        }
        
        const p1Input = document.getElementById("p1-name");
        const joinInput = document.getElementById("join-player-name");
        const nickname = user.user_metadata?.full_name?.split(" ")[0] || user.user_metadata?.name || user.email?.split("@")[0];
        if (nickname) {
            if (p1Input && p1Input.value === "Cyber Blue") p1Input.value = nickname;
            if (joinInput && joinInput.value === "Neon Pink") joinInput.value = nickname;
        }
        refreshProfileModalUI();
    } else {
        DOM.googleAuthBtn?.classList.remove("hidden");
        DOM.userProfileBadge?.classList.add("hidden");
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
    registerGroup("join-colors", 2);
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

function switchPlayer(nextPlayer, preserveRollState = false) {
    state.activePlayer = nextPlayer;
    hoverState.row = -1;
    hoverState.col = -1;
    hoverState.isValid = false;
    remoteHoverState = { row: -1, col: -1, width: 0, height: 0, playerIndex: 0 };
    
    if (!preserveRollState) {
        state.hasRolled = false;
        state.isRotated = false;
        state.currentRoll = [0, 0];
        state.activeSpecialMove = null;
        state.customCellsToPlace = 0;
        state.customCellsPlaced = [];
        state.isDrawingDrag = false;
        state.isErasingDrag = false;
    }
    
    if (DOM.gameAutoRollChk) {
        DOM.gameAutoRollChk.checked = state.autoRoll;
    }
    
    // In Online mode, determine if current player controls this turn
    const isMyTurn = !state.isOnline || (state.activePlayer === state.localPlayerIndex);
    const activeName = state.playerNames[state.activePlayer] || `Player ${state.activePlayer}`;
    
    if (!state.hasRolled) {
        DOM.rollBtn.disabled = !isMyTurn;
        DOM.rotateBtn.disabled = true;
        DOM.passBtn.disabled = true;
        DOM.rotateBtn.classList.remove("active-ready");
        DOM.passBtn.classList.remove("active-ready");
        
        DOM.turnText.textContent = isMyTurn ? "Your Turn!" : `${activeName}'s Turn`;
        DOM.rollResultText.textContent = isMyTurn ? "Roll the dice to see your dimensions!" : `Waiting for ${activeName} to roll...`;
    } else {
        DOM.rollBtn.disabled = true;
        DOM.rotateBtn.disabled = !isMyTurn;
        DOM.passBtn.disabled = !isMyTurn;
        if (isMyTurn) {
            DOM.rotateBtn.classList.add("active-ready");
            DOM.passBtn.classList.add("active-ready");
            DOM.turnText.textContent = "Your Turn!";
            DOM.rollResultText.innerHTML = `You rolled a <strong>${state.currentRoll[0]} x ${state.currentRoll[1]}</strong> block!`;
        } else {
            DOM.rotateBtn.classList.remove("active-ready");
            DOM.passBtn.classList.remove("active-ready");
            DOM.turnText.textContent = `${activeName}'s Turn`;
            DOM.rollResultText.innerHTML = `<strong>${activeName}</strong> rolled a <strong>${state.currentRoll[0]} x ${state.currentRoll[1]}</strong> block!`;
        }
        
        if (state.currentRoll[0] > 0 && state.currentRoll[1] > 0) {
            alignDie(DOM.die1, state.currentRoll[0]);
            alignDie(DOM.die2, state.currentRoll[1]);
        }
    }
    
    if (DOM.doublesModal) DOM.doublesModal.classList.remove("active");
    if (DOM.drawControlsBar && !state.activeSpecialMove) DOM.drawControlsBar.classList.remove("active");
    
    document.body.className = `player-active-p${state.activePlayer}`;
    
    const activeTheme = state.colors[state.playerColors[state.activePlayer]];
    const otherPlayerIndex = (state.activePlayer % state.playersCount) + 1;
    const otherTheme = state.colors[state.playerColors[otherPlayerIndex]];
    
    if (activeTheme) {
        document.documentElement.style.setProperty("--p1-color", activeTheme.hex);
        document.documentElement.style.setProperty("--p1-glow", activeTheme.glow);
    }
    if (otherTheme) {
        document.documentElement.style.setProperty("--p2-color", otherTheme.hex);
        document.documentElement.style.setProperty("--p2-glow", otherTheme.glow);
    }
    
    if (state.scoreCardElements) {
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
        
        const activeMult = state.doubleSizeMultiplier[state.activePlayer] || 1;
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
        state.rollsCount[state.activePlayer] = (state.rollsCount[state.activePlayer] || 0) + 1;
        
        let activePlayerNum = Number(state.activePlayer);
        let playerCellsCount = 0;
        for (let i = 0; i < state.gridSize; i++) {
            for (let j = 0; j < state.gridSize; j++) {
                if (state.board[i]?.[j] === activePlayerNum) playerCellsCount++;
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
    if (!element) return;
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

// Drawing Mode Handlers
function handleDrawModeCellClick(r, c) {
    if (r < 0 || r >= state.gridSize || c < 0 || c >= state.gridSize) return;
    
    if (state.board[r][c] !== 0) {
        playErrorTone();
        showToast(DOM, "Must select an empty cell!");
        return;
    }
    
    const idx = state.customCellsPlaced.findIndex(pos => pos.r === r && pos.c === c);
    if (idx !== -1) {
        if (idx === state.customCellsPlaced.length - 1) {
            state.customCellsPlaced.pop();
            state.customCellsToPlace++;
            playHoverTick();
            updateDrawBarUI();
        } else {
            playErrorTone();
            showToast(DOM, "Can only undo last selected cell!");
        }
        return;
    }
    
    if (state.customCellsToPlace === 0) {
        playErrorTone();
        return;
    }
    
    if (state.activeSpecialMove === 'wall-drawing') {
        if (state.customCellsPlaced.length > 0) {
            let adjacent = false;
            for (const pos of state.customCellsPlaced) {
                if ((Math.abs(pos.r - r) === 1 && pos.c === c) || 
                    (Math.abs(pos.c - c) === 1 && pos.r === r)) {
                    adjacent = true;
                    break;
                }
            }
            if (!adjacent) {
                playErrorTone();
                showToast(DOM, "Wall cells must be connected contiguously!");
                return;
            }
        }
    } else if (state.activeSpecialMove === 'custom36-drawing') {
        const player = Number(state.activePlayer);
        let playerCellsCount = 0;
        for (let i = 0; i < state.gridSize; i++) {
            for (let j = 0; j < state.gridSize; j++) {
                if (state.board[i]?.[j] === player) playerCellsCount++;
            }
        }
        const isFirstTurn = playerCellsCount === 0;

        if (state.customCellsPlaced.length === 0) {
            if (isFirstTurn) {
                const start = getStartingCorner(state.gridSize, player);
                if (r !== start.r || c !== start.c) {
                    playErrorTone();
                    showToast(DOM, `First cell must start exactly in your corner (${start.c + 1}, ${start.r + 1})!`);
                    return;
                }
            } else {
                let touch = false;
                if ((r > 0 && state.board[r - 1]?.[c] === player) ||
                    (r < state.gridSize - 1 && state.board[r + 1]?.[c] === player) ||
                    (c > 0 && state.board[r]?.[c - 1] === player) ||
                    (c < state.gridSize - 1 && state.board[r]?.[c + 1] === player)) {
                    touch = true;
                }
                if (!touch) {
                    playErrorTone();
                    showToast(DOM, "First cell must touch your existing territory!");
                    return;
                }
            }
        } else {
            let adjacent = false;
            for (const pos of state.customCellsPlaced) {
                if ((Math.abs(pos.r - r) === 1 && pos.c === c) || 
                    (Math.abs(pos.c - c) === 1 && pos.r === r)) {
                    adjacent = true;
                    break;
                }
            }
            if (!adjacent) {
                playErrorTone();
                showToast(DOM, "Cells must connect contiguous shape!");
                return;
            }
        }
    }
    
    state.customCellsPlaced.push({ r, c });
    state.customCellsToPlace--;
    playHoverTick();
    updateDrawBarUI();
}

function handleDrawModeCellRemove(r, c) {
    const idx = state.customCellsPlaced.findIndex(pos => pos.r === r && pos.c === c);
    if (idx !== -1) {
        state.customCellsPlaced.splice(idx, 1);
        state.customCellsToPlace++;
        playHoverTick();
        updateDrawBarUI();
        return true;
    }
    return false;
}

function updateDrawBarUI() {
    if (!DOM.drawControlsBar) return;
    const theme = state.colors[state.playerColors[state.activePlayer]];
    
    if (state.activeSpecialMove === 'wall-drawing') {
        DOM.drawStatusText.textContent = `Draw custom wall: ${state.customCellsToPlace} cells left`;
    } else {
        DOM.drawStatusText.textContent = `Draw custom shape: ${state.customCellsToPlace} cells left`;
    }
    
    if (state.customCellsToPlace === 0) {
        DOM.drawConfirmBtn.disabled = false;
        if (theme) {
            DOM.drawConfirmBtn.style.borderColor = theme.hex;
            DOM.drawConfirmBtn.style.color = theme.hex;
        }
    } else {
        DOM.drawConfirmBtn.disabled = true;
        DOM.drawConfirmBtn.style.borderColor = "var(--text-dim)";
        DOM.drawConfirmBtn.style.color = "var(--text-muted)";
    }
    
    updateHelperBubble(DOM, state);
}

function confirmDrawShape() {
    if (state.customCellsToPlace !== 0) return;
    if (state.isOnline && state.activePlayer !== state.localPlayerIndex) return;
    
    const check = validateFinalDraft(state, state.customCellsPlaced, state.activeSpecialMove, state.activePlayer);
    if (!check.valid) {
        showToast(DOM, check.reason);
        playErrorTone();
        return;
    }
    
    if (state.activeSpecialMove === 'wall-drawing') {
        state.customCellsPlaced.forEach(pos => {
            state.board[pos.r][pos.c] = 7;
        });
        playWallSound();
        showToast(DOM, "Carbon Wall secure!");
    } else if (state.activeSpecialMove === 'custom36-drawing') {
        state.customCellsPlaced.forEach(pos => {
            state.board[pos.r][pos.c] = state.activePlayer;
        });
        playPlaceBlockSound();
        showToast(DOM, "Custom territory secured!");
    }
    
    state.consecutiveSkippedTurns[state.activePlayer] = 0;
    const { counts } = tallyScores(state);
    updateScoreboardValues(counts);
    state.consecutivePasses = 0;
    
    handleMouseLeave();
    remoteHoverState = { row: -1, col: -1, width: 0, height: 0, playerIndex: 0 };
    
    if (DOM.drawControlsBar) DOM.drawControlsBar.classList.remove("active");
    
    const next = (state.activePlayer % state.playersCount) + 1;
    switchPlayer(next, false);
    
    if (state.isOnline && state.roomId) {
        syncGameStateToSupabase();
    }
}

function resetDrawShape() {
    if (state.activeSpecialMove === 'wall-drawing') {
        state.customCellsToPlace = 4;
    } else {
        state.customCellsToPlace = 36;
    }
    state.customCellsPlaced = [];
    playHoverTick();
    updateDrawBarUI();
}

function triggerAutoPassSequence() {
    DOM.rotateBtn.disabled = true;
    DOM.rotateBtn.classList.remove("active-ready");
    
    playErrorTone();
    showToast(DOM, "No valid placements available! Turn skipped.");
    
    DOM.rollResultText.innerHTML = `<span style="color: var(--neon-pink); font-weight:700;">No valid placements!</span>`;
    DOM.helperText.innerHTML = `<span style="color: var(--neon-pink);">There are no legal spots to fit this block. Your turn is passed.</span>`;
    
    setTimeout(() => {
        if (state.hasRolled && (!state.isOnline || state.activePlayer === state.localPlayerIndex)) {
            passTurn();
        }
    }, 2800);
}

function passTurn() {
    if (!state.hasRolled) return;
    if (state.isOnline && state.activePlayer !== state.localPlayerIndex) return;
    
    handleMouseLeave();
    remoteHoverState = { row: -1, col: -1, width: 0, height: 0, playerIndex: 0 };
    
    state.consecutivePasses++;
    state.consecutiveSkippedTurns[state.activePlayer] = (state.consecutiveSkippedTurns[state.activePlayer] || 0) + 1;
    
    const { counts } = tallyScores(state);
    updateScoreboardValues(counts);
    
    if (state.consecutivePasses >= state.playersCount) {
        endMatch();
        if (state.isOnline && state.roomId) {
            syncGameStateToSupabase();
        }
    } else {
        const next = (state.activePlayer % state.playersCount) + 1;
        switchPlayer(next, false);
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
    
    const isWinner = winner.id === (state.isOnline ? state.localPlayerIndex : 1);
    updatePlayerStats(isWinner);
    
    startConfettiEffect(DOM.confettiCanvas, winnerTheme ? winnerTheme.hex : "#00f0ff");
}

function canvasLoop() {
    state.dashOffset -= 0.2;
    if (state.dashOffset < -20) state.dashOffset = 0;
    
    drawBoard(DOM.canvas, state, hoverState, remoteHoverState);
    animationFrameId = requestAnimationFrame(canvasLoop);
}

function handleMouseMove(e) {
    if (state.isGameOver) return;
    
    const rect = DOM.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const cellX = Math.floor(x / (rect.width / state.gridSize));
    const cellY = Math.floor(y / (rect.height / state.gridSize));
    
    const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
    const isMyTurn = !state.isOnline || (state.activePlayer === state.localPlayerIndex);
    
    if (isDrawingMode) {
        if (!isMyTurn) return;
        if (state.isDrawingDrag) {
            handleDrawModeCellClick(cellY, cellX);
        } else if (state.isErasingDrag) {
            handleDrawModeCellRemove(cellY, cellX);
        }
        hoverState.row = cellY;
        hoverState.col = cellX;
        hoverState.isValid = (cellY >= 0 && cellY < state.gridSize && cellX >= 0 && cellX < state.gridSize && state.board[cellY]?.[cellX] === 0);
        return;
    }
    
    if (!state.hasRolled || !isMyTurn) return;
    
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
    
    if (state.isOnline && state.roomId) {
        sendBroadcastHover({
            row: -1,
            col: -1,
            width: 0,
            height: 0,
            playerIndex: state.localPlayerIndex
        });
    }
}

function handleGridClick() {
    if (state.isOnline && state.activePlayer !== state.localPlayerIndex) return;
    if (state.isGameOver) return;
    
    const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
    if (isDrawingMode) {
        if (hoverState.row !== -1 && hoverState.col !== -1) {
            handleDrawModeCellClick(hoverState.row, hoverState.col);
        }
        return;
    }
    
    if (!state.hasRolled) return;
    if (hoverState.row === -1 || hoverState.col === -1) return;
    
    if (!hoverState.isValid) {
        playErrorTone();
        let playerCellsCount = 0;
        for (let i = 0; i < state.gridSize; i++) {
            for (let j = 0; j < state.gridSize; j++) {
                if (state.board[i]?.[j] === Number(state.activePlayer)) playerCellsCount++;
            }
        }
        if (playerCellsCount === 0) {
            const cornerName = getCornerName(state.activePlayer);
            showToast(DOM, `First move must cover your glowing ${cornerName}!`);
        } else {
            showToast(DOM, "Invalid placement! Must attach to your territory along a flat edge.");
        }
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
    remoteHoverState = { row: -1, col: -1, width: 0, height: 0, playerIndex: 0 };
    
    const next = (state.activePlayer % state.playersCount) + 1;
    switchPlayer(next, false);
    
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
        is_game_over: state.isGameOver,
        active_special_move: state.activeSpecialMove,
        double_size_multiplier: state.doubleSizeMultiplier,
        consecutive_skipped_turns: state.consecutiveSkippedTurns
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
        const joinNameInput = document.getElementById('join-player-name');
        const pName = joinNameInput?.value.trim() || document.getElementById('p2-name')?.value.trim() || "Neon Pink";
        const joinColorBtn = document.querySelector('#join-colors .color-btn.active');
        const pColor = joinColorBtn?.dataset.color || state.playerColors[2] || "pink";
        
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
        
        state.playerNames[result.player_index] = pName;
        state.playerColors[result.player_index] = pColor;
        
        DOM.joinModal?.classList.remove("active");
        openLobbyModal(result.room_code);
        subscribeAndTrackRoom(result.room_id);
    } catch (e) {
        playErrorTone();
        showToast(DOM, `Error joining room: ${e.message}`);
    }
}

function copyRoomCode(code, btnElement = null) {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
        showToast(DOM, `Room code ${code} copied!`);
        if (btnElement) {
            btnElement.classList.add("copied");
            const orig = btnElement.innerHTML;
            btnElement.innerHTML = `<i class="fa-solid fa-check"></i> <span>Copied!</span>`;
            setTimeout(() => {
                btnElement.classList.remove("copied");
                btnElement.innerHTML = orig;
            }, 2000);
        }
    }).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(DOM, `Room code ${code} copied!`);
    });
}

function openLobbyModal(code) {
    if (!DOM.lobbyModal) return;
    if (DOM.lobbyRoomCode) {
        DOM.lobbyRoomCode.textContent = code;
        DOM.lobbyRoomCode.onclick = () => {
            copyRoomCode(code, DOM.copyRoomCodeBtn);
        };
    }
    
    if (DOM.copyRoomCodeBtn) {
        DOM.copyRoomCodeBtn.onclick = (e) => {
            e.stopPropagation();
            copyRoomCode(code, DOM.copyRoomCodeBtn);
        };
    }
    
    if (DOM.lobbyStartBtn) {
        if (state.isHost) {
            DOM.lobbyStartBtn.style.display = "block";
            DOM.lobbyStartBtn.disabled = false;
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
            if (!newGameState) return;
            
            const prevActivePlayer = state.activePlayer;
            const prevHasRolled = state.hasRolled;
            
            if (newGameState.board && Array.isArray(newGameState.board) && newGameState.board.length === state.gridSize) {
                state.board = newGameState.board;
            }
            
            state.consecutivePasses = newGameState.consecutive_passes ?? state.consecutivePasses;
            state.isGameOver = newGameState.is_game_over ?? state.isGameOver;
            state.activeSpecialMove = newGameState.active_special_move || null;
            if (newGameState.double_size_multiplier) {
                state.doubleSizeMultiplier = newGameState.double_size_multiplier;
            }
            if (newGameState.consecutive_skipped_turns) {
                state.consecutiveSkippedTurns = newGameState.consecutive_skipped_turns;
            }
            
            const { counts } = tallyScores(state);
            updateScoreboardValues(counts);
            
            if (state.isGameOver) {
                endMatch();
                return;
            }
            
            // Case 1: Active player changed (turn handed over)
            if (newGameState.active_player !== prevActivePlayer) {
                remoteHoverState = { row: -1, col: -1, width: 0, height: 0, playerIndex: 0 };
                state.activePlayer = newGameState.active_player;
                state.currentRoll = newGameState.current_roll || [0, 0];
                state.hasRolled = newGameState.has_rolled || false;
                switchPlayer(newGameState.active_player, state.hasRolled);
                playPlaceBlockSound();
                return;
            }
            
            // Case 2: Same active player, roll state changed or updated
            if (newGameState.has_rolled) {
                const rollChanged = !prevHasRolled || (state.currentRoll[0] !== newGameState.current_roll[0] || state.currentRoll[1] !== newGameState.current_roll[1]);
                state.currentRoll = newGameState.current_roll || [0, 0];
                state.hasRolled = true;
                
                alignDie(DOM.die1, state.currentRoll[0]);
                alignDie(DOM.die2, state.currentRoll[1]);
                
                const isMyTurn = !state.isOnline || (state.activePlayer === state.localPlayerIndex);
                const activeName = state.playerNames[state.activePlayer] || `Player ${state.activePlayer}`;
                
                if (isMyTurn) {
                    DOM.rollBtn.disabled = true;
                    DOM.rotateBtn.disabled = false;
                    DOM.passBtn.disabled = false;
                    DOM.rotateBtn.classList.add("active-ready");
                    DOM.passBtn.classList.add("active-ready");
                    DOM.turnText.textContent = "Your Turn!";
                    DOM.rollResultText.innerHTML = `You rolled a <strong>${state.currentRoll[0]} x ${state.currentRoll[1]}</strong> block!`;
                    updateHelperBubble(DOM, state);
                    
                    if (rollChanged && !hasAnyValidMoves(state, state.activePlayer, state.currentRoll)) {
                        triggerAutoPassSequence();
                    }
                } else {
                    DOM.rollBtn.disabled = true;
                    DOM.rotateBtn.disabled = true;
                    DOM.passBtn.disabled = true;
                    DOM.rotateBtn.classList.remove("active-ready");
                    DOM.passBtn.classList.remove("active-ready");
                    DOM.turnText.textContent = `${activeName}'s Turn`;
                    DOM.rollResultText.innerHTML = `<strong>${activeName}</strong> rolled a <strong>${state.currentRoll[0]} x ${state.currentRoll[1]}</strong> block! Placing block...`;
                    updateHelperBubble(DOM, state);
                }
            } else if (!newGameState.has_rolled && prevHasRolled) {
                state.hasRolled = false;
                state.currentRoll = [0, 0];
                switchPlayer(state.activePlayer, false);
            }
        },
        onPlayersUpdate: async () => {
            refreshLobbyPlayers(roomId);
        },
        onRoomStatusUpdate: (updatedRoom) => {
            if (updatedRoom.status === 'playing' && !state.isGameSessionActive) {
                state.isGameSessionActive = true;
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
            state.enableAdvancedRules = room.enable_advanced_rules;
            state.enableTeamMode = room.enable_team_mode;
            
            players.forEach(p => {
                state.playerNames[p.player_index] = p.name;
                state.playerColors[p.player_index] = p.color;
                state.playerTeams[p.player_index] = p.team || p.player_index;
                
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
    try {
        const { room: fetchedRoom, players, gameState } = await fetchRoomDetails(state.roomId);
        const activeRoom = fetchedRoom || room;
        
        state.gridSize = activeRoom.grid_size || state.gridSize || 20;
        state.mapType = activeRoom.map_type || state.mapType || "classic";
        state.playersCount = activeRoom.players_count || players.length || 2;
        state.enableAdvancedRules = !!activeRoom.enable_advanced_rules;
        state.enableTeamMode = !!activeRoom.enable_team_mode;
        
        players.forEach(p => {
            state.playerNames[p.player_index] = p.name;
            state.playerColors[p.player_index] = p.color;
            state.playerTeams[p.player_index] = p.team || p.player_index;
        });
        
        // Ensure valid board matrix exists
        if (Array.isArray(gameState.board) && gameState.board.length === state.gridSize && Array.isArray(gameState.board[0]) && gameState.board[0].length === state.gridSize) {
            state.board = gameState.board;
        } else {
            resetBoardMatrix(state);
        }
        
        state.activePlayer = gameState.active_player || 1;
        state.currentRoll = gameState.current_roll || [0, 0];
        state.hasRolled = gameState.has_rolled || false;
        state.consecutivePasses = gameState.consecutive_passes || 0;
        state.isGameOver = gameState.is_game_over || false;
        state.activeSpecialMove = gameState.active_special_move || null;
        
        buildScoreboardUI(DOM, state);
        updateThemeStyles(state);
        
        DOM.setupScreen.classList.remove("active");
        DOM.gameScreen.classList.add("active");
        
        resizeCanvas(DOM.canvas, state);
        switchPlayer(state.activePlayer, state.hasRolled);
        playPlaceBlockSound();
        
        if (DOM.onlineRoomBadge && DOM.onlineRoomCode) {
            DOM.onlineRoomBadge.classList.remove("hidden");
            DOM.onlineRoomCode.textContent = state.roomCode || activeRoom.code || "ONLINE";
            DOM.onlineRoomBadge.onclick = () => {
                copyRoomCode(state.roomCode || activeRoom.code, null);
            };
        }
        
        showToast(DOM, `Match started! You are Player ${state.localPlayerIndex} (${state.playerNames[state.localPlayerIndex]}).`);
    } catch (e) {
        console.error("Error starting online session:", e);
        showToast(DOM, "Failed to load game session: " + e.message);
    }
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
    DOM.googleAuthBtn?.addEventListener("click", async () => {
        try {
            await signInWithGoogle();
        } catch (err) {
            playErrorTone();
            showToast(DOM, `Google Login error: ${err.message || "Provider not configured yet in Supabase."}`);
        }
    });
    
    DOM.userProfileBadge?.addEventListener("click", () => {
        refreshProfileModalUI();
        DOM.profileModal?.classList.add("active");
    });
    
    DOM.closeProfileBtn?.addEventListener("click", () => {
        DOM.profileModal?.classList.remove("active");
    });
    
    DOM.profileSignOutBtn?.addEventListener("click", async () => {
        try {
            await signOutUser();
            DOM.profileModal?.classList.remove("active");
            DOM.googleAuthBtn?.classList.remove("hidden");
            DOM.userProfileBadge?.classList.add("hidden");
            showToast(DOM, "Signed out successfully.");
        } catch (e) {
            showToast(DOM, "Failed to sign out.");
        }
    });
    
    DOM.signOutBtn?.addEventListener("click", async () => {
        try {
            await signOutUser();
            DOM.googleAuthBtn?.classList.remove("hidden");
            DOM.userProfileBadge?.classList.add("hidden");
            showToast(DOM, "Signed out successfully.");
        } catch (e) {
            showToast(DOM, "Failed to sign out.");
        }
    });

    DOM.createRoomBtn?.addEventListener("click", handleCreateRoom);
    DOM.joinRoomBtn?.addEventListener("click", () => DOM.joinModal?.classList.add("active"));
    DOM.joinCancelBtn?.addEventListener("click", () => DOM.joinModal?.classList.remove("active"));
    DOM.joinConfirmBtn?.addEventListener("click", handleJoinRoom);
    
    DOM.shareLinkBtn?.addEventListener("click", () => {
        if (state.roomCode) {
            const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
            navigator.clipboard.writeText(inviteUrl);
            showToast(DOM, "Direct invite link copied to clipboard!");
        }
    });

    DOM.lobbyStartBtn?.addEventListener("click", async () => {
        if (!state.isHost) return;
        try {
            DOM.lobbyStartBtn.disabled = true;
            DOM.lobbyStartBtn.textContent = "Starting Match...";
            
            const { players, room } = await fetchRoomDetails(state.roomId);
            const actualPlayersCount = players.length;
            state.playersCount = actualPlayersCount;
            state.gridSize = room.grid_size || state.gridSize;
            state.mapType = room.map_type || state.mapType;
            state.enableAdvancedRules = room.enable_advanced_rules ?? state.enableAdvancedRules;
            state.enableTeamMode = room.enable_team_mode ?? state.enableTeamMode;
            
            // 1. Initialize clean 2D board matrix with map obstacles
            resetBoardMatrix(state);
            
            // 2. Initialize database game state with clean 2D board
            await updateOnlineGameState(state.roomId, {
                board: state.board,
                active_player: 1,
                current_roll: [0, 0],
                has_rolled: false,
                consecutive_passes: 0,
                is_game_over: false,
                double_size_multiplier: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
                consecutive_skipped_turns: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
                active_special_move: null,
                custom_cells_to_place: 0,
                custom_cells_placed: []
            });
            
            // 3. Update room status to 'playing'
            await supabase
                .from('rooms')
                .update({
                    status: 'playing',
                    players_count: actualPlayersCount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', state.roomId);
                
        } catch (err) {
            console.error("Error starting match:", err);
            showToast(DOM, "Failed to start match: " + err.message);
            DOM.lobbyStartBtn.disabled = false;
            DOM.lobbyStartBtn.textContent = "Start Match";
        }
    });
    
    DOM.lobbyLeaveBtn?.addEventListener("click", () => {
        unsubscribeFromRoom();
        DOM.lobbyModal?.classList.remove("active");
        state.isOnline = false;
        state.roomId = null;
        state.isGameSessionActive = false;
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
        if (DOM.onlineRoomBadge) {
            DOM.onlineRoomBadge.classList.add("hidden");
        }
        
        switchPlayer(1, false);
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

    DOM.customSizeInput?.addEventListener("input", () => {
        const val = parseInt(DOM.customSizeInput.value);
        if (val >= 10 && val <= 80) {
            DOM.gridSelectors.forEach(b => b.classList.remove("active"));
            state.gridSize = val;
        } else if (DOM.customSizeInput.value === "") {
            const activeBtn = Array.from(DOM.gridSelectors).find(b => b.classList.contains("active"));
            state.gridSize = activeBtn ? parseInt(activeBtn.dataset.size) : 20;
        }
    });
    
    DOM.customSizeInput?.addEventListener("change", () => {
        let val = parseInt(DOM.customSizeInput.value);
        if (isNaN(val)) return;
        if (val < 10) val = 10;
        if (val > 80) val = 80;
        DOM.customSizeInput.value = val;
        DOM.gridSelectors.forEach(b => b.classList.remove("active"));
        state.gridSize = val;
    });
    
    DOM.rollBtn?.addEventListener("click", triggerDiceRoll);
    DOM.rotateBtn?.addEventListener("click", toggleRotation);
    DOM.passBtn?.addEventListener("click", passTurn);
    
    DOM.canvas?.addEventListener("mousemove", handleMouseMove);
    DOM.canvas?.addEventListener("mouseleave", handleMouseLeave);
    
    DOM.canvas?.addEventListener("mousedown", (e) => {
        const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
        if (isDrawingMode && !state.isGameOver) {
            if (state.isOnline && state.activePlayer !== state.localPlayerIndex) return;
            if (e.button === 0) {
                state.isDrawingDrag = true;
                if (hoverState.row !== -1 && hoverState.col !== -1) {
                    handleDrawModeCellClick(hoverState.row, hoverState.col);
                }
            } else if (e.button === 2) {
                state.isErasingDrag = true;
                if (hoverState.row !== -1 && hoverState.col !== -1) {
                    handleDrawModeCellRemove(hoverState.row, hoverState.col);
                }
            }
        }
    });
    
    window.addEventListener("mouseup", () => {
        state.isDrawingDrag = false;
        state.isErasingDrag = false;
    });
    
    DOM.canvas?.addEventListener("click", handleGridClick);
    DOM.canvas?.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
        if (!isDrawingMode && state.hasRolled && !DOM.rotateBtn.disabled) {
            toggleRotation();
        }
    });
    
    DOM.drawConfirmBtn?.addEventListener("click", confirmDrawShape);
    DOM.drawResetBtn?.addEventListener("click", resetDrawShape);
    
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
    
    DOM.resetBtn?.addEventListener("click", async () => {
        if (confirm("Reset current match? Progress will be lost.")) {
            if (state.isOnline && state.roomId) {
                if (!state.isHost) {
                    showToast(DOM, "Only the host can reset an online match.");
                    return;
                }
                resetBoardMatrix(state);
                switchPlayer(1, false);
                resizeCanvas(DOM.canvas, state);
                await syncGameStateToSupabase();
                showToast(DOM, "Match reset.");
            } else {
                resetBoardMatrix(state);
                switchPlayer(1, false);
                resizeCanvas(DOM.canvas, state);
            }
        }
    });
    
    DOM.rematchBtn?.addEventListener("click", async () => {
        stopConfettiEffect();
        DOM.victoryOverlay.classList.remove("active");
        if (state.isOnline && state.roomId) {
            if (state.isHost) {
                resetBoardMatrix(state);
                switchPlayer(1, false);
                resizeCanvas(DOM.canvas, state);
                await syncGameStateToSupabase();
            } else {
                showToast(DOM, "Waiting for host to restart match...");
            }
        } else {
            resetBoardMatrix(state);
            switchPlayer(1, false);
            resizeCanvas(DOM.canvas, state);
        }
    });
    
    window.addEventListener("resize", () => {
        if (DOM.gameScreen.classList.contains("active")) {
            resizeCanvas(DOM.canvas, state);
        }
    });
}

window.addEventListener("DOMContentLoaded", init);
