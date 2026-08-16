/**
 * SQUARES - UI Controller & DOM Binding Engine
 */

export function getDOMElements() {
    return {
        setupScreen: document.getElementById("setup-screen"),
        gameScreen: document.getElementById("game-screen"),
        rulesDrawer: document.getElementById("rules-drawer"),
        victoryOverlay: document.getElementById("victory-overlay"),
        
        gridSelectors: document.querySelectorAll("#grid-size-selector .size-btn"),
        customSizeInput: document.getElementById("custom-size-input"),
        startGameBtn: document.getElementById("start-game-btn"),
        toggleRulesBtn: document.getElementById("toggle-rules-btn"),
        closeRulesBtn: document.getElementById("close-rules-btn"),
        helpBtn: document.getElementById("help-btn"),
        muteBtn: document.getElementById("mute-btn"),
        muteIcon: document.getElementById("mute-icon"),
        
        turnText: document.getElementById("turn-text"),
        
        scoreboardContainer: document.getElementById("scoreboard-container"),
        playerCountButtons: document.querySelectorAll("#player-count-selector .size-btn"),
        mapStyleButtons: document.querySelectorAll("#map-style-selector .size-btn"),
        
        die1: document.getElementById("die-1"),
        die2: document.getElementById("die-2"),
        rollResultText: document.getElementById("roll-result-text"),
        rollBtn: document.getElementById("roll-btn"),
        rotateBtn: document.getElementById("rotate-btn"),
        passBtn: document.getElementById("pass-btn"),
        resetBtn: document.getElementById("reset-btn"),
        rematchBtn: document.getElementById("rematch-btn"),
        
        helperText: document.getElementById("helper-text"),
        toastNotif: document.getElementById("toast-notif"),
        toastMsg: document.getElementById("toast-msg"),
        
        canvas: document.getElementById("game-canvas"),
        victoryTitle: document.getElementById("victory-title"),
        victoryWinnerSubtitle: document.getElementById("victory-winner-subtitle"),
        vStatWinnerScore: document.getElementById("v-stat-winner-score"),
        vStatWinnerPct: document.getElementById("v-stat-winner-pct"),
        vStatLoserScore: document.getElementById("v-stat-loser-score"),
        vStatLoserPct: document.getElementById("v-stat-loser-pct"),
        vMetaInfo: document.getElementById("victory-meta-info"),
        confettiCanvas: document.getElementById("victory-confetti-canvas"),
        
        advancedRulesChk: document.getElementById("advanced-rules-chk"),
        doublesModal: document.getElementById("doubles-modal"),
        doublesTitle: document.getElementById("doubles-title"),
        doublesOptionsContainer: document.getElementById("doubles-options-container"),
        doublesSubtitle: document.getElementById("doubles-subtitle"),
        drawControlsBar: document.getElementById("draw-controls-bar"),
        drawStatusText: document.getElementById("draw-status-text"),
        drawConfirmBtn: document.getElementById("draw-confirm-btn"),
        drawResetBtn: document.getElementById("draw-reset-btn"),
        
        autoRollChk: document.getElementById("auto-roll-chk"),
        gameAutoRollChk: document.getElementById("game-auto-roll-chk"),
        teamModeOption: document.getElementById("team-mode-option"),
        teamModeChk: document.getElementById("team-mode-chk"),
        
        // --- ONLINE MULTIPLAYER DOM ELEMENTS ---
        modeLocalBtn: document.getElementById("mode-local-btn"),
        modeOnlineBtn: document.getElementById("mode-online-btn"),
        onlineControlsGroup: document.getElementById("online-controls-group"),
        createRoomBtn: document.getElementById("create-room-btn"),
        joinRoomBtn: document.getElementById("join-room-btn"),
        googleAuthBtn: document.getElementById("google-auth-btn"),
        userProfileBadge: document.getElementById("user-profile-badge"),
        userAvatar: document.getElementById("user-avatar"),
        userName: document.getElementById("user-name"),
        
        lobbyModal: document.getElementById("lobby-modal"),
        lobbyRoomCode: document.getElementById("lobby-room-code"),
        copyRoomCodeBtn: document.getElementById("copy-room-code-btn"),
        lobbyPlayersList: document.getElementById("lobby-players-list"),
        lobbyStartBtn: document.getElementById("lobby-start-btn"),
        lobbyLeaveBtn: document.getElementById("lobby-leave-btn"),
        shareLinkBtn: document.getElementById("share-link-btn"),
        
        onlineRoomBadge: document.getElementById("online-room-badge"),
        onlineRoomCode: document.getElementById("online-room-code"),
        
        joinModal: document.getElementById("join-modal"),
        roomCodeInput: document.getElementById("room-code-input"),
        joinConfirmBtn: document.getElementById("join-confirm-btn"),
        joinCancelBtn: document.getElementById("join-cancel-btn")
    };
}

let toastTimeout = null;

export function showToast(DOM, msg) {
    if (!DOM.toastMsg || !DOM.toastNotif) return;
    clearTimeout(toastTimeout);
    DOM.toastMsg.textContent = msg;
    DOM.toastNotif.classList.add("active");
    
    toastTimeout = setTimeout(() => {
        DOM.toastNotif.classList.remove("active");
    }, 2200);
}

export function buildScoreboardUI(DOM, state) {
    if (!DOM.scoreboardContainer) return;
    DOM.scoreboardContainer.innerHTML = "";
    state.scoreCardElements = {};
    
    for (let i = 1; i <= state.playersCount; i++) {
        const pColor = state.playerColors[i];
        const theme = state.colors[pColor];
        
        const card = document.createElement("div");
        card.className = "score-card glow-border";
        card.id = `p${i}-score-card`;
        card.style.borderLeft = `4px solid ${theme.hex}`;
        
        const header = document.createElement("div");
        header.className = "score-header";
        
        const dot = document.createElement("div");
        dot.className = "score-dot";
        dot.style.backgroundColor = theme.hex;
        dot.style.boxShadow = `0 0 8px ${theme.hex}`;
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "score-name";
        nameSpan.id = `p${i}-score-name`;
        nameSpan.textContent = state.playerNames[i];
        
        header.appendChild(dot);
        header.appendChild(nameSpan);
        
        if (state.enableTeamMode) {
            const teamNum = state.playerTeams[i] || 1;
            const teamLabel = document.createElement("span");
            teamLabel.className = "team-label-badge";
            teamLabel.textContent = `T${teamNum}`;
            teamLabel.style.fontSize = "0.65rem";
            teamLabel.style.fontWeight = "800";
            teamLabel.style.padding = "1px 5px";
            teamLabel.style.borderRadius = "4px";
            teamLabel.style.background = "rgba(255,255,255,0.08)";
            teamLabel.style.color = theme.hex;
            teamLabel.style.border = `1px solid ${theme.hex}33`;
            teamLabel.style.marginLeft = "auto";
            header.appendChild(teamLabel);
        }
        
        const valueDiv = document.createElement("div");
        valueDiv.className = "score-value";
        valueDiv.id = `p${i}-score-val`;
        valueDiv.textContent = "0";
        
        const metaDiv = document.createElement("div");
        metaDiv.className = "score-meta";
        metaDiv.id = `p${i}-score-pct`;
        metaDiv.textContent = "0% OF BOARD";
        
        card.appendChild(header);
        card.appendChild(valueDiv);
        card.appendChild(metaDiv);
        
        DOM.scoreboardContainer.appendChild(card);
        
        state.scoreCardElements[i] = {
            card: card,
            name: nameSpan,
            value: valueDiv,
            pct: metaDiv
        };
    }
}

export function updateThemeStyles(state) {
    const p1Theme = state.colors[state.playerColors[1]];
    const p2Theme = state.colors[state.playerColors[2]];
    
    if (p1Theme) {
        document.documentElement.style.setProperty("--p1-color", p1Theme.hex);
        document.documentElement.style.setProperty("--p1-glow", p1Theme.glow);
    }
    if (p2Theme) {
        document.documentElement.style.setProperty("--p2-color", p2Theme.hex);
        document.documentElement.style.setProperty("--p2-glow", p2Theme.glow);
    }
    
    for (let i = 1; i <= 6; i++) {
        const card = document.getElementById(`p${i}-card`);
        const pTheme = state.colors[state.playerColors[i]];
        if (card && pTheme) {
            card.style.borderLeftColor = pTheme.hex;
        }
    }
}

export function showDoublesModal(DOM, title, subtitle, options) {
    DOM.doublesTitle.textContent = title;
    DOM.doublesSubtitle.textContent = subtitle;
    DOM.doublesOptionsContainer.innerHTML = "";
    
    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "doubles-opt-btn glow-border";
        btn.innerHTML = `<span>${opt.label}</span> <i class="fa-solid fa-chevron-right"></i>`;
        btn.addEventListener("click", () => {
            DOM.doublesModal.classList.remove("active");
            opt.action();
        });
        DOM.doublesOptionsContainer.appendChild(btn);
    });
    
    DOM.doublesModal.classList.add("active");
}

export function getCornerName(playerNum) {
    const p = Number(playerNum);
    switch (p) {
        case 1: return "Top-Left Corner";
        case 2: return "Bottom-Right Corner";
        case 3: return "Top-Right Corner";
        case 4: return "Bottom-Left Corner";
        case 5: return "Middle-Left";
        case 6: return "Middle-Right";
        default: return "designated starting corner";
    }
}

export function updateHelperBubble(DOM, state) {
    if (!DOM.helperText) return;
    
    // Check if active player is on their first turn
    let playerCellsCount = 0;
    if (state.board && Array.isArray(state.board)) {
        for (let i = 0; i < state.board.length; i++) {
            if (Array.isArray(state.board[i])) {
                for (let j = 0; j < state.board[i].length; j++) {
                    if (state.board[i][j] === Number(state.activePlayer)) playerCellsCount++;
                }
            }
        }
    }
    
    if (state.activeSpecialMove === 'wall-drawing') {
        DOM.helperText.innerHTML = `Construct Wall: Left click <strong>${state.customCellsToPlace}</strong> connected empty cells on the grid. They must be contiguous!`;
    } else if (state.activeSpecialMove === 'custom36-drawing') {
        DOM.helperText.innerHTML = `Draw custom territory: Click <strong>${state.customCellsToPlace}</strong> empty cells. First cell must touch your territory.`;
    } else if (!state.hasRolled) {
        if (playerCellsCount === 0) {
            const cornerStr = getCornerName(state.activePlayer);
            DOM.helperText.innerHTML = `⭐ <strong>First Turn:</strong> Roll dice, then place starting at your <strong>${cornerStr}</strong>!`;
        } else {
            DOM.helperText.textContent = "Roll the dice to begin your turn!";
        }
    } else {
        const sizeStr = state.isRotated ? 
            `${state.currentRoll[1]} x ${state.currentRoll[0]}` : 
            `${state.currentRoll[0]} x ${state.currentRoll[1]}`;
        
        let specialLabel = "";
        if (state.activeSpecialMove === '1x1-anywhere') {
            specialLabel = "<br><span style='color: var(--neon-cyan); font-weight:700;'>COSMIC SEED: Place this cell anywhere!</span>";
        } else if (state.activeSpecialMove === 'breach-overwriting') {
            specialLabel = "<br><span style='color: var(--neon-pink); font-weight:700;'>TECTONIC BREACH: Overwrite any opponent cells covered by this block!</span>";
        }
        
        if (playerCellsCount === 0 && state.activeSpecialMove !== '1x1-anywhere') {
            const cornerStr = getCornerName(state.activePlayer);
            DOM.helperText.innerHTML = `You rolled <strong>${sizeStr}</strong>.<br><span style="color: var(--neon-gold); font-weight: 700;">First move must cover your glowing ${cornerStr}!</span> Press <strong>Spacebar</strong> to rotate.`;
        } else {
            DOM.helperText.innerHTML = `You rolled a <strong>${sizeStr}</strong> rectangle.${specialLabel}<br>Hover and click to place. Press <strong>Spacebar</strong> to rotate.`;
        }
    }
}
