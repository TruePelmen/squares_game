/**
 * SQUARES - The Territory Capture Duel
 * Core Logic Engine & Premium Web UI controller (with Advanced Doubles Rules)
 */

(function () {
    // ==========================================================================
    // GAME STATE VARIABLES
    // ==========================================================================
    const state = {
        activePlayer: 1, // 1 through 6
        playersCount: 2, // 2 to 6
        mapType: "classic", // "classic", "asteroids", "cross", "quadrants", "blackhole"
        playerNames: { 
            1: "Cyber Blue", 2: "Neon Pink", 3: "Emerald Rogue",
            4: "Purple Monarch", 5: "Golden Sage", 6: "Orange Overlord" 
        },
        playerColors: { 
            1: "cyan", 2: "pink", 3: "emerald",
            4: "purple", 5: "gold", 6: "orange" 
        },
        // Colors mapping to Hex/HSL for canvas rendering
        colors: {
            cyan: { hex: "#00f0ff", hsl: "184, 100%, 50%", glow: "rgba(0, 240, 255, 0.45)", fill: "rgba(0, 240, 255, 0.15)" },
            emerald: { hex: "#00ffaa", hsl: "160, 100%, 50%", glow: "rgba(0, 255, 170, 0.45)", fill: "rgba(0, 255, 170, 0.15)" },
            gold: { hex: "#ffc400", hsl: "46, 100%, 50%", glow: "rgba(255, 196, 0, 0.45)", fill: "rgba(255, 196, 0, 0.15)" },
            pink: { hex: "#ff007f", hsl: "330, 100%, 50%", glow: "rgba(255, 0, 127, 0.45)", fill: "rgba(255, 0, 127, 0.15)" },
            purple: { hex: "#9d00ff", hsl: "277, 100%, 50%", glow: "rgba(157, 0, 255, 0.45)", fill: "rgba(157, 0, 255, 0.15)" },
            orange: { hex: "#ff5500", hsl: "20, 100%, 50%", glow: "rgba(255, 85, 0, 0.45)", fill: "rgba(255, 85, 0, 0.15)" }
        },
        gridSize: 20, // 15, 20, or 30
        board: [], // 2D grid matrix: 0 = empty, 1-6 = Player 1-6, 7 = WALL (Obstacle)
        currentRoll: [0, 0],
        hasRolled: false,
        isRotated: false,
        consecutivePasses: 0,
        isGameOver: false,
        rollsCount: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        soundMuted: false,
        animationFrameId: null,
        dashOffset: 0,
        
        // --- ADVANCED RULES STATE VARIABLES ---
        enableAdvancedRules: false,
        doubleSizeMultiplier: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, // growth scale for next turn (1, 2, or 0.5)
        consecutiveSkippedTurns: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, // Individual skips count for comeback rule
        activeSpecialMove: null, // '1x1-anywhere', 'wall-drawing', 'custom36-drawing', 'breach-overwriting'
        customCellsToPlace: 0,
        customCellsPlaced: [], // coordinate items in drawing mode [{r, c}]
        isDrawingDrag: false,
        isErasingDrag: false,
        debugNextRoll: null,
        
        // --- NEW FEATURES STATE ---
        autoRoll: false,
        enableTeamMode: false,
        teamModeType: "3v3",
        playerTeams: { 1: 1, 2: 2, 3: 1, 4: 2, 5: 1, 6: 2 }
    };

    // Current Hover Position on Grid
    const hoverState = {
        row: -1,
        col: -1,
        isValid: false
    };

    // ==========================================================================
    // DOM ELEMENT REFERENCES
    // ==========================================================================
    const DOM = {
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
        
        // --- ADVANCED RULES DOM ELEMENTS ---
        advancedRulesChk: document.getElementById("advanced-rules-chk"),
        doublesModal: document.getElementById("doubles-modal"),
        doublesTitle: document.getElementById("doubles-title"),
        doublesOptionsContainer: document.getElementById("doubles-options-container"),
        doublesSubtitle: document.getElementById("doubles-subtitle"),
        drawControlsBar: document.getElementById("draw-controls-bar"),
        drawStatusText: document.getElementById("draw-status-text"),
        drawConfirmBtn: document.getElementById("draw-confirm-btn"),
        drawResetBtn: document.getElementById("draw-reset-btn"),
        
        // --- NEW FEATURES DOM ELEMENTS ---
        autoRollChk: document.getElementById("auto-roll-chk"),
        gameAutoRollChk: document.getElementById("game-auto-roll-chk"),
        teamModeOption: document.getElementById("team-mode-option"),
        teamModeChk: document.getElementById("team-mode-chk")
    };

    // ==========================================================================
    // AUDIO ENGINE (WEB AUDIO API SYNTHESIS)
    // ==========================================================================
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    }

    function synthSound(freqs, durations, type = "sine", gainSequence = []) {
        if (state.soundMuted) return;
        initAudio();
        
        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = type;
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            const now = audioCtx.currentTime;
            
            // Frequency schedule
            if (freqs.length === 1) {
                osc.frequency.setValueAtTime(freqs[0], now);
            } else {
                osc.frequency.setValueAtTime(freqs[0], now);
                let currentT = now;
                for (let i = 1; i < freqs.length; i++) {
                    currentT += durations[i - 1];
                    osc.frequency.exponentialRampToValueAtTime(freqs[i], currentT);
                }
            }
            
            // Gain schedule
            if (gainSequence.length > 0) {
                gainNode.gain.setValueAtTime(gainSequence[0], now);
                let currentT = now;
                for (let i = 1; i < gainSequence.length; i++) {
                    currentT += durations[i - 1];
                    gainNode.gain.linearRampToValueAtTime(gainSequence[i], currentT);
                }
            } else {
                gainNode.gain.setValueAtTime(0.15, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + durations.reduce((a, b) => a + b, 0));
            }
            
            osc.start(now);
            osc.stop(now + durations.reduce((a, b) => a + b, 0));
        } catch (e) {
            console.error("Audio error:", e);
        }
    }

    function playRollTick() {
        synthSound([180, 80], [0.06], "triangle", [0.08, 0.001]);
    }

    function playPlaceBlockSound() {
        synthSound([220, 55], [0.1, 0.25], "sawtooth", [0.2, 0.1, 0.001]);
    }

    function playHoverTick() {
        synthSound([1200], [0.015], "sine", [0.03, 0.001]);
    }

    function playErrorTone() {
        // Soft, muted triangle sweep for non-irritating error feedback
        synthSound([150, 90], [0.15], "triangle", [0.12, 0.001]);
    }

    function playWallSound() {
        // Heavy carbon mechanical clank
        synthSound([140, 60, 45], [0.05, 0.2], "triangle", [0.25, 0.1, 0.001]);
    }

    function playBreachSound() {
        // High pitched laser sweep down
        synthSound([1500, 150], [0.05, 0.35], "sawtooth", [0.25, 0.15, 0.001]);
    }

    function playVictoryFanfare() {
        const tempo = 0.12;
        initAudio();
        const playNote = (freq, delay, dur) => {
            setTimeout(() => {
                if (state.soundMuted) return;
                synthSound([freq], [dur], "sine", [0.12, 0.001]);
            }, delay * 1000);
        };
        
        playNote(261.63, 0, 0.35); // C4
        playNote(329.63, tempo, 0.35); // E4
        playNote(392.00, tempo * 2, 0.35); // G4
        playNote(523.25, tempo * 3, 0.6); // C5
    }

    // ==========================================================================
    // INITIALIZATION & GRID BUILDER
    // ==========================================================================
    function init() {
        setupEventListeners();
        setupColorSelectors();
        setupTeamSelectors();
        resetBoard();
        resizeCanvas();
        
        // Start Canvas drawing loop
        requestAnimationFrame(canvasLoop);
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
                    updateThemeStyles();
                }
            });
        };
        for (let i = 1; i <= 6; i++) {
            registerGroup(`p${i}-colors`, i);
        }
    }

    function updateThemeStyles() {
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

    function updateTeamSelectorVisibility() {
        const showTeams = DOM.teamModeChk.checked && (state.playersCount === 4 || state.playersCount === 6);
        for (let i = 1; i <= 6; i++) {
            const card = document.getElementById(`p${i}-card`);
            if (card) {
                const selectorGroup = card.querySelector(".team-selector-group");
                if (selectorGroup) {
                    if (showTeams && i <= state.playersCount) {
                        selectorGroup.classList.remove("hidden");
                    } else {
                        selectorGroup.classList.add("hidden");
                    }
                }
            }
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

    // ==========================================================================
    // TEAM MODE UTILITY
    // ==========================================================================
    function getPlayerTeam(playerNum) {
        const p = Number(playerNum);
        if (p === 0 || p === 7) return p;
        if (!state.enableTeamMode) return p;
        
        return state.playerTeams[p] || 1;
    }

    function buildScoreboardUI() {
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
                const teamNum = getPlayerTeam(i);
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

    function generateMapObstacles() {
        if (state.mapType === "classic") return;
        
        const N = state.gridSize;
        const mid = Math.floor(N / 2);
        
        if (state.mapType === "asteroids") {
            const activeStarts = [];
            for (let i = 1; i <= state.playersCount; i++) {
                activeStarts.push(getStartingCorner(i));
            }
            
            const isSafe = (r, c) => {
                for (const start of activeStarts) {
                    if (Math.abs(start.r - r) <= 1 && Math.abs(start.c - c) <= 1) {
                        return true;
                    }
                }
                return false;
            };
            
            const wallCount = Math.floor(N * N * 0.05);
            let placed = 0;
            let attempts = 0;
            
            while (placed < wallCount && attempts < 1000) {
                attempts++;
                const r = Math.floor(Math.random() * N);
                const c = Math.floor(Math.random() * N);
                
                if (state.board[r][c] === 0 && !isSafe(r, c)) {
                    state.board[r][c] = 7; // WALL
                    placed++;
                }
            }
        } else if (state.mapType === "cross") {
            for (let i = 0; i < N; i++) {
                if (i > 5 && i < N - 6) {
                    state.board[mid][i] = 7; // Horizontal wall: clear starting edges for Players 5 & 6
                }
                if (i > 2 && i < N - 3) {
                    state.board[i][mid] = 7; // Vertical wall
                }
            }
            state.board[mid][mid] = 0;
            if (mid > 0) {
                state.board[mid-1][mid] = 0;
                state.board[mid+1][mid] = 0;
                state.board[mid][mid-1] = 0;
                state.board[mid][mid+1] = 0;
            }
        } else if (state.mapType === "quadrants") {
            const q1 = Math.floor(N / 4);
            const q2 = Math.floor((3 * N) / 4);
            
            const placePillar = (centerR, centerC) => {
                for (let r = centerR - 1; r <= centerR; r++) {
                    for (let c = centerC - 1; c <= centerC; c++) {
                        if (r >= 0 && r < N && c >= 0 && c < N) {
                            state.board[r][c] = 7;
                        }
                    }
                }
            };
            
            placePillar(q1, q1);
            placePillar(q1, q2);
            placePillar(q2, q1);
            placePillar(q2, q2);
        } else if (state.mapType === "blackhole") {
            for (let r = mid - 2; r <= mid + 1; r++) {
                for (let c = mid - 2; c <= mid + 1; c++) {
                    if (r >= 0 && r < N && c >= 0 && c < N) {
                        state.board[r][c] = 7;
                    }
                }
            }
        }
    }

    function resetBoard() {
        state.board = [];
        for (let r = 0; r < state.gridSize; r++) {
            const row = [];
            for (let c = 0; c < state.gridSize; c++) {
                row.push(0);
            }
            state.board.push(row);
        }
        
        state.hasRolled = false;
        state.isRotated = false;
        state.consecutivePasses = 0;
        state.isGameOver = false;
        
        state.rollsCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        state.doubleSizeMultiplier = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
        state.consecutiveSkippedTurns = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        
        for (let i = 1; i <= 6; i++) {
            state[`p${i}Cells`] = 0;
        }
        
        state.activeSpecialMove = null;
        state.customCellsToPlace = 0;
        state.customCellsPlaced = [];
        state.isDrawingDrag = false;
        state.isErasingDrag = false;
        
        // Remove active badges
        removeMultiplierBadges();
        
        // Reset dynamic scoreboards
        if (state.scoreCardElements) {
            for (let i = 1; i <= state.playersCount; i++) {
                const els = state.scoreCardElements[i];
                if (els) {
                    els.value.textContent = "0";
                    els.pct.textContent = "0% of board";
                }
            }
        }
        
        DOM.rotateBtn.disabled = true;
        DOM.passBtn.disabled = true;
        DOM.rotateBtn.classList.remove("active-ready");
        DOM.passBtn.classList.remove("active-ready");
        
        DOM.rollResultText.textContent = "Roll the dice to see your dimensions!";
        DOM.rollBtn.disabled = false;
        
        DOM.doublesModal.classList.remove("active");
        DOM.drawControlsBar.classList.remove("active");
        
        // Generate walls for selected map style
        generateMapObstacles();
        
        updateHelperBubble();
    }

    function removeMultiplierBadges() {
        for (let i = 1; i <= 6; i++) {
            const badge = document.getElementById(`p${i}-badge`);
            if (badge) badge.remove();
        }
    }

    function createMultiplierBadge(playerNum, typeStr, classStr) {
        // Remove existing badge
        const oldBadge = document.getElementById(`p${playerNum}-badge`);
        if (oldBadge) oldBadge.remove();
        
        const badge = document.createElement("div");
        badge.className = `multiplier-badge ${classStr}`;
        badge.id = `p${playerNum}-badge`;
        badge.textContent = typeStr;
        
        const parentCard = state.scoreCardElements[playerNum]?.card;
        if (parentCard) parentCard.appendChild(badge);
    }

    function switchPlayer(nextPlayer) {
        state.activePlayer = nextPlayer;
        state.hasRolled = false;
        state.isRotated = false;
        
        // Sync Auto-Roll controls
        if (DOM.gameAutoRollChk) {
            DOM.gameAutoRollChk.checked = state.autoRoll;
        }
        
        // Reset special moves unless they carry over
        state.activeSpecialMove = null;
        state.customCellsToPlace = 0;
        state.customCellsPlaced = [];
        state.isDrawingDrag = false;
        state.isErasingDrag = false;
        
        DOM.rollBtn.disabled = false;
        DOM.rotateBtn.disabled = true;
        DOM.passBtn.disabled = true;
        DOM.rotateBtn.classList.remove("active-ready");
        DOM.passBtn.classList.remove("active-ready");
        
        DOM.rollResultText.textContent = "Roll the dice to see your dimensions!";
        DOM.doublesModal.classList.remove("active");
        DOM.drawControlsBar.classList.remove("active");
        
        // Update UI Body Class for active indicator triggers
        document.body.className = `player-active-p${state.activePlayer}`;
        
        // Announce turn
        const activeName = state.playerNames[state.activePlayer];
        DOM.turnText.textContent = `${activeName}'s Turn`;
        
        // Update root themes dynamically and toggle score cards active-turn classes
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
                    els.card.style.borderColor = activeTheme.hex;
                    els.card.style.boxShadow = `0 0 15px ${activeTheme.glow}`;
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
            DOM.passBtn.disabled = false;
            DOM.passBtn.classList.add("active-ready");
            
            DOM.rollResultText.innerHTML = "<span style='color:var(--neon-emerald);font-weight:700;text-shadow:0 0 10px rgba(0,255,170,0.3);'>COSMIC COMEBACK ACTIVE!</span>";
            showToast("Cosmic Comeback! 1x1 Seed granted to break the blockade.");
            
            // Uplifting, hopeful major arpeggio
            setTimeout(() => {
                if (!state.soundMuted) {
                    synthSound([261.63, 329.63, 392.00, 523.25, 659.25], [0.06, 0.06, 0.06, 0.06, 0.2], "sine", [0.15, 0.15, 0.15, 0.15, 0.001]);
                }
            }, 100);
        }
        
        updateHelperBubble();
        
        // Sync gameplay checkbox style accent
        if (DOM.gameAutoRollChk && activeTheme) {
            DOM.gameAutoRollChk.style.accentColor = activeTheme.hex;
        }
        
        // --- AUTO-ROLL DICE ACTION ---
        if (state.autoRoll && !state.isGameOver && !state.hasRolled) {
            setTimeout(() => {
                if (state.autoRoll && !state.hasRolled && !state.isGameOver) {
                    triggerDiceRoll();
                }
            }, 800);
        }
    }

    function updateHelperBubble() {
        if (state.activeSpecialMove === 'wall-drawing') {
            DOM.helperText.innerHTML = `Construct Wall: Left click <strong>${state.customCellsToPlace}</strong> connected empty cells on the grid. They must be contiguous!`;
        } else if (state.activeSpecialMove === 'custom36-drawing') {
            DOM.helperText.innerHTML = `Draw contiguous custom territory: Click <strong>${state.customCellsToPlace}</strong> empty cells. First cell must touch your territory.`;
        } else if (!state.hasRolled) {
            DOM.helperText.textContent = "Roll the dice to begin your turn!";
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
            
            DOM.helperText.innerHTML = `You rolled a <strong>${sizeStr}</strong> rectangle.${specialLabel}<br>Hover and click to place. Press <strong>Spacebar</strong> to rotate.`;
        }
    }

    function getStartingCorner(playerNum) {
        const pNum = Number(playerNum);
        const size = state.gridSize - 1;
        switch (pNum) {
            case 1: return { r: 0, c: 0 };
            case 2: return { r: size, c: size };
            case 3: return { r: 0, c: size };
            case 4: return { r: size, c: 0 };
            case 5: return { r: Math.floor(size / 2), c: 0 };
            case 6: return { r: Math.floor(size / 2), c: size };
            default: return { r: 0, c: 0 };
        }
    }

    // ==========================================================================
    // STRICT PLACEMENT VALIDATION
    // ==========================================================================
    function isValidPlacement(r, c, width, height, player) {
        const pId = Number(player);
        
        // 1. Boundary check
        if (r < 0 || c < 0 || r + height > state.gridSize || c + width > state.gridSize) {
            return false;
        }
        
        // 2. Overlap & Breach checks
        let opponentCellsCovered = 0;
        
        for (let i = r; i < r + height; i++) {
            for (let j = c; j < c + width; j++) {
                const cell = state.board[i][j];
                
                // Walls or own cells are strictly impassable
                if (cell === 7 || cell === pId) {
                    return false;
                }
                
                // Teammate cells are also impassable (cannot overlap teammates)
                if (state.enableTeamMode && getPlayerTeam(cell) === getPlayerTeam(pId)) {
                    return false;
                }
                
                // Opponent cell check (belongs to any other player)
                if (cell !== 0) {
                    // In Tectonic Breach mode, we allow overwriting opponent cells
                    if (state.activeSpecialMove === 'breach-overwriting' && getPlayerTeam(cell) !== getPlayerTeam(pId)) {
                        opponentCellsCovered++;
                    } else {
                        // Standard mode: overlapping opponent is blocked
                        return false;
                    }
                }
            }
        }
        
        // 3. Adjacency rule checking
        // Count how many cells the player currently has on the board
        let playerCellsCount = 0;
        for (let i = 0; i < state.gridSize; i++) {
            for (let j = 0; j < state.gridSize; j++) {
                if (state.board[i][j] === pId) playerCellsCount++;
            }
        }
        
        // 4. First Move Corner Check (or Teammate Adjacency)
        if (playerCellsCount === 0 && state.activeSpecialMove !== '1x1-anywhere') {
            const start = getStartingCorner(pId);
            const coversCorner = (r <= start.r && r + height - 1 >= start.r &&
                                  c <= start.c && c + width - 1 >= start.c);
            if (coversCorner) return true;
            
            // In Team Mode, we also allow starting adjacent to teammates
            if (state.enableTeamMode) {
                const playerTeam = getPlayerTeam(pId);
                for (let i = r; i < r + height; i++) {
                    for (let j = c; j < c + width; j++) {
                        if (i > 0 && getPlayerTeam(state.board[i - 1][j]) === playerTeam) return true;
                        if (i < state.gridSize - 1 && getPlayerTeam(state.board[i + 1][j]) === playerTeam) return true;
                        if (j > 0 && getPlayerTeam(state.board[i][j - 1]) === playerTeam) return true;
                        if (j < state.gridSize - 1 && getPlayerTeam(state.board[i][j + 1]) === playerTeam) return true;
                    }
                }
            }
            return false;
        }
        
        // 5. Cosmic Seed bypass check
        if (state.activeSpecialMove === '1x1-anywhere') {
            return true;
        }
        
        // 6. Subsequent Moves: Team Edge Adjacency
        const playerTeam = getPlayerTeam(pId);
        for (let i = r; i < r + height; i++) {
            for (let j = c; j < c + width; j++) {
                if (i > 0 && getPlayerTeam(state.board[i - 1][j]) === playerTeam) return true;
                if (i < state.gridSize - 1 && getPlayerTeam(state.board[i + 1][j]) === playerTeam) return true;
                if (j > 0 && getPlayerTeam(state.board[i][j - 1]) === playerTeam) return true;
                if (j < state.gridSize - 1 && getPlayerTeam(state.board[i][j + 1]) === playerTeam) return true;
            }
        }
        
        return false;
    }

    function hasAnyValidMoves(player, roll) {
        const pId = Number(player);
        // Cosmic seed 1x1 anywhere is always valid as long as 1 empty cell exists
        if (state.activeSpecialMove === '1x1-anywhere') {
            return state.board.some(row => row.includes(0));
        }
        
        const A = roll[0];
        const B = roll[1];
        
        for (let r = 0; r < state.gridSize; r++) {
            for (let c = 0; c < state.gridSize; c++) {
                if (isValidPlacement(r, c, A, B, pId)) return true;
                if (isValidPlacement(r, c, B, A, pId)) return true;
            }
        }
        
        return false;
    }

    // ==========================================================================
    // 3D DICE ROLL TRIGGERS & ANIMATIONS
    // ==========================================================================
    function triggerDiceRoll() {
        if (state.hasRolled || state.isGameOver) return;
        
        initAudio();
        DOM.rollBtn.disabled = true;
        DOM.rotateBtn.disabled = true;
        DOM.passBtn.disabled = true;
        
        // Begin wild 3D shake animations
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
            
            // Save original face values before multipliers modify them
            const originalD1 = d1Val;
            const originalD2 = d2Val;
            
            playHoverTick();
            
            // Align dice elements using 3D transforms
            alignDie(DOM.die1, d1Val);
            alignDie(DOM.die2, d2Val);
            
            // Check active multipliers (growth/shrink)
            const activeMult = state.doubleSizeMultiplier[state.activePlayer];
            let multiplierAppliedText = "";
            
            if (activeMult === 2) {
                d1Val *= 2;
                d2Val *= 2;
                multiplierAppliedText = "<span style='color:var(--neon-emerald);font-weight:700;'> [GROWTH X2!]</span>";
                state.doubleSizeMultiplier[state.activePlayer] = 1;
                
                const badge = document.getElementById(`p${state.activePlayer}-badge`);
                if (badge) badge.remove();
            } else if (activeMult === 0.5) {
                d1Val = Math.max(1, Math.floor(d1Val * 0.5));
                d2Val = Math.max(1, Math.floor(d2Val * 0.5));
                multiplierAppliedText = "<span style='color:var(--neon-orange);font-weight:700;'> [SHRINK 1/2!]</span>";
                state.doubleSizeMultiplier[state.activePlayer] = 1;
                
                const badge = document.getElementById(`p${state.activePlayer}-badge`);
                if (badge) badge.remove();
            }
            
            state.currentRoll = [d1Val, d2Val];
            state.hasRolled = true;
            state.rollsCount[state.activePlayer]++;
            
            // Check if it's the player's first turn and they rolled a 1x1
            let activePlayerNum = Number(state.activePlayer);
            let playerCellsCount = 0;
            for (let i = 0; i < state.gridSize; i++) {
                for (let j = 0; j < state.gridSize; j++) {
                    if (state.board[i][j] === activePlayerNum) playerCellsCount++;
                }
            }
            if (playerCellsCount === 0 && d1Val === 1 && d2Val === 1) {
                state.activeSpecialMove = '1x1-anywhere';
                showToast("First Turn 1x1! Cosmic Seed: Place anywhere!");
            }
            
            DOM.rollResultText.innerHTML = `You rolled a <strong>${d1Val} x ${d2Val}</strong> block!${multiplierAppliedText}`;
            
            // ADVANCED DOUBLES RULES TRIGGERS (Triggered on original dice faces)
            if (state.enableAdvancedRules && originalD1 === originalD2) {
                handleDoubleRollSequence(originalD1);
            } else {
                // Normal roll checks
                DOM.rotateBtn.disabled = false;
                DOM.passBtn.disabled = false;
                DOM.rotateBtn.classList.add("active-ready");
                DOM.passBtn.classList.add("active-ready");
                
                updateHelperBubble();
                
                // check moves
                if (!hasAnyValidMoves(state.activePlayer, state.currentRoll)) {
                    triggerAutoPassSequence();
                }
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

    // ==========================================================================
    // ADVANCED MECHANICS HANDLERS
    // ==========================================================================
    function handleDoubleRollSequence(doubleVal) {
        playVictoryFanfare();
        
        switch (doubleVal) {
            case 1: // 1x1 anywhere
                state.activeSpecialMove = '1x1-anywhere';
                showToast("1x1 Double! Cosmic Seed: Place anywhere!");
                DOM.rotateBtn.disabled = true; // rotation unnecessary
                DOM.passBtn.disabled = false;
                DOM.passBtn.classList.add("active-ready");
                updateHelperBubble();
                break;
                
            case 2: // Growth 2x2
                // Normal placement, but triggers Growth badge for next turn
                showToast("2x2 Double! Size Doubled Next Turn!");
                createMultiplierBadge(state.activePlayer, "x2 Size Next!", "multiplier-grow");
                state.doubleSizeMultiplier[state.activePlayer] = 2;
                
                DOM.rotateBtn.disabled = false;
                DOM.passBtn.disabled = false;
                DOM.rotateBtn.classList.add("active-ready");
                DOM.passBtn.classList.add("active-ready");
                updateHelperBubble();
                
                if (!hasAnyValidMoves(state.activePlayer, state.currentRoll)) {
                    triggerAutoPassSequence();
                }
                break;
                
            case 3: // Shrink 3x3
                // Normal placement, triggers Shrink badge for next turn
                showToast("3x3 Double! Size Halved Next Turn!");
                createMultiplierBadge(state.activePlayer, "1/2 Size Next!", "multiplier-shrink");
                state.doubleSizeMultiplier[state.activePlayer] = 0.5;
                
                DOM.rotateBtn.disabled = false;
                DOM.passBtn.disabled = false;
                DOM.rotateBtn.classList.add("active-ready");
                DOM.passBtn.classList.add("active-ready");
                updateHelperBubble();
                
                if (!hasAnyValidMoves(state.activePlayer, state.currentRoll)) {
                    triggerAutoPassSequence();
                }
                break;
                
            case 4: // Choice: 4x4 Block vs Wall Drawing
                showDoublesModal(
                    "DOUBLE 4x4 ROLLED!",
                    "Would you like to claim territory normally or block your opponent by placing a Wall?",
                    [
                        { label: "Place 4x4 Territory", action: () => selectNormalDoublesMove() },
                        { label: "Build Contiguous Wall (4 cells)", action: () => selectWallDrawingMove() }
                    ]
                );
                break;
                
            case 5: // Unrestricted Overwriting Breach is automatically active!
                state.activeSpecialMove = 'breach-overwriting';
                showToast("5x5 Double! Tectonic Breach active: overwrite opponent cells!");
                
                DOM.rotateBtn.disabled = false;
                DOM.passBtn.disabled = false;
                DOM.rotateBtn.classList.add("active-ready");
                DOM.passBtn.classList.add("active-ready");
                updateHelperBubble();
                
                if (!hasAnyValidMoves(state.activePlayer, state.currentRoll)) {
                    triggerAutoPassSequence();
                }
                break;
                
            case 6: // Custom contiguous 36-cell shape
                if (!hasAnyDrawingMoves('custom36-drawing', 36)) {
                    triggerAutoPassSequence();
                    break;
                }
                
                state.activeSpecialMove = 'custom36-drawing';
                state.customCellsToPlace = 36;
                state.customCellsPlaced = [];
                
                DOM.drawStatusText.textContent = "Draw custom shape: 36 cells left";
                DOM.drawConfirmBtn.disabled = true;
                DOM.drawConfirmBtn.style.borderColor = "var(--text-dim)";
                DOM.drawConfirmBtn.style.color = "var(--text-muted)";
                
                DOM.drawControlsBar.classList.add("active");
                DOM.rotateBtn.disabled = true;
                DOM.passBtn.disabled = false;
                DOM.passBtn.classList.add("active-ready");
                
                updateHelperBubble();
                showToast("6x6 Double! Draw 36-cell custom shape!");
                break;
        }
    }

    function showDoublesModal(title, subtitle, options) {
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

    function selectNormalDoublesMove() {
        DOM.rotateBtn.disabled = false;
        DOM.passBtn.disabled = false;
        DOM.rotateBtn.classList.add("active-ready");
        DOM.passBtn.classList.add("active-ready");
        updateHelperBubble();
        
        if (!hasAnyValidMoves(state.activePlayer, state.currentRoll)) {
            triggerAutoPassSequence();
        }
    }

    function selectWallDrawingMove() {
        if (!hasAnyDrawingMoves('wall-drawing', 4)) {
            showToast("No room to place a Wall! Forced to place normal block.");
            selectNormalDoublesMove();
            return;
        }
        
        state.activeSpecialMove = 'wall-drawing';
        state.customCellsToPlace = 4;
        state.customCellsPlaced = [];
        
        DOM.drawStatusText.textContent = "Draw custom wall: 4 cells left";
        DOM.drawConfirmBtn.disabled = true;
        DOM.drawConfirmBtn.style.borderColor = "var(--text-dim)";
        DOM.drawConfirmBtn.style.color = "var(--text-muted)";
        
        DOM.drawControlsBar.classList.add("active");
        DOM.rotateBtn.disabled = true;
        DOM.passBtn.disabled = false;
        DOM.passBtn.classList.add("active-ready");
        
        updateHelperBubble();
        showToast("Select 4 connected grid cells to place a Wall!");
    }

    function selectBreachOverwriteMove() {
        state.activeSpecialMove = 'breach-overwriting';
        
        DOM.rotateBtn.disabled = false;
        DOM.passBtn.disabled = false;
        DOM.rotateBtn.classList.add("active-ready");
        DOM.passBtn.classList.add("active-ready");
        
        updateHelperBubble();
        showToast("Tectonic Breach: Overwrite any opponent cells!");
        
        if (!hasAnyValidMoves(state.activePlayer, state.currentRoll)) {
            triggerAutoPassSequence();
        }
    }

    // Drawing Mode Click Manager
    function handleDrawModeCellClick(r, c) {
        // 1. Overlap Check
        if (state.board[r][c] !== 0) {
            playErrorTone();
            showToast("Must select an empty cell!");
            return;
        }
        
        // 2. Already clicked in current draw check
        const idx = state.customCellsPlaced.findIndex(pos => pos.r === r && pos.c === c);
        if (idx !== -1) {
            // Remove click to allow undoing from the tail end of selection
            if (idx === state.customCellsPlaced.length - 1) {
                state.customCellsPlaced.pop();
                state.customCellsToPlace++;
                playHoverTick();
                updateDrawBarUI();
            } else {
                playErrorTone();
                showToast("Can only undo last selected cell!");
            }
            return;
        }
        
        if (state.customCellsToPlace === 0) {
            playErrorTone();
            return;
        }
        
        // 3. Adjacency Constraints checking
        if (state.activeSpecialMove === 'wall-drawing') {
            // Walls: first anywhere, subsequent must connect to current Wall draft
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
                    showToast("Wall cells must be connected contiguously!");
                    return;
                }
            }
        } else if (state.activeSpecialMove === 'custom36-drawing') {
            const player = Number(state.activePlayer);
            let playerCellsCount = 0;
            for (let i = 0; i < state.gridSize; i++) {
                for (let j = 0; j < state.gridSize; j++) {
                    if (state.board[i][j] === player) playerCellsCount++;
                }
            }
            const isFirstTurn = playerCellsCount === 0;

            // Custom shape: first cell must touch player territory (or start exactly at corner on first turn)
            if (state.customCellsPlaced.length === 0) {
                if (isFirstTurn) {
                    const start = getStartingCorner(player);
                    if (r !== start.r || c !== start.c) {
                        playErrorTone();
                        showToast(`First cell must start exactly in your corner (${start.c + 1}, ${start.r + 1})!`);
                        return;
                    }
                } else {
                    // Must touch territory
                    let touch = false;
                    if ((r > 0 && state.board[r - 1][c] === player) ||
                        (r < state.gridSize - 1 && state.board[r + 1][c] === player) ||
                        (c > 0 && state.board[r][c - 1] === player) ||
                        (c < state.gridSize - 1 && state.board[r][c + 1] === player)) {
                        touch = true;
                    }
                    if (!touch) {
                        playErrorTone();
                        showToast("First cell must touch your existing territory!");
                        return;
                    }
                }
            } else {
                // Must connect to current draft
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
                    showToast("Cells must connect contiguous shape!");
                    return;
                }
            }
        }
        
        // Push coordinate
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

    function isDraftContiguous() {
        if (state.customCellsPlaced.length <= 1) return true;
        
        const visited = new Set();
        const queue = [state.customCellsPlaced[0]];
        visited.add(`${state.customCellsPlaced[0].r},${state.customCellsPlaced[0].c}`);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            for (const pos of state.customCellsPlaced) {
                const key = `${pos.r},${pos.c}`;
                if (visited.has(key)) continue;
                
                if ((Math.abs(pos.r - current.r) === 1 && pos.c === current.c) ||
                    (Math.abs(pos.c - current.c) === 1 && pos.r === current.r)) {
                    visited.add(key);
                    queue.push(pos);
                }
            }
        }
        
        return visited.size === state.customCellsPlaced.length;
    }

    function validateFinalDraft() {
        if (state.customCellsPlaced.length === 0) return false;
        
        // 1. Check contiguity of draft
        if (!isDraftContiguous()) {
            showToast("Shape must be contiguous (connected)!");
            playErrorTone();
            return false;
        }
        
        // 2. For custom shape, at least one cell must touch player territory (or contain starting corner on first turn)
        if (state.activeSpecialMove === 'custom36-drawing') {
            const player = Number(state.activePlayer);
            let playerCellsCount = 0;
            for (let i = 0; i < state.gridSize; i++) {
                for (let j = 0; j < state.gridSize; j++) {
                    if (state.board[i][j] === player) playerCellsCount++;
                }
            }
            const isFirstTurn = playerCellsCount === 0;

            if (isFirstTurn) {
                const start = getStartingCorner(player);
                const hasCorner = state.customCellsPlaced.some(pos => pos.r === start.r && pos.c === start.c);
                if (!hasCorner) {
                    showToast("Your shape must start exactly at your starting corner!");
                    playErrorTone();
                    return false;
                }
            } else {
                let touchesTerritory = false;
                for (const pos of state.customCellsPlaced) {
                    const r = pos.r;
                    const c = pos.c;
                    if ((r > 0 && state.board[r - 1][c] === player) ||
                        (r < state.gridSize - 1 && state.board[r + 1][c] === player) ||
                        (c > 0 && state.board[r][c - 1] === player) ||
                        (c < state.gridSize - 1 && state.board[r][c + 1] === player)) {
                        touchesTerritory = true;
                        break;
                    }
                }
                if (!touchesTerritory) {
                    showToast("Shape must touch your existing territory!");
                    playErrorTone();
                    return false;
                }
            }
        }
        
        return true;
    }

    function countMaxConnectedEmptyCells(startPositions) {
        if (startPositions.length === 0) return 0;
        
        let maxCount = 0;
        
        for (const startPos of startPositions) {
            if (state.board[startPos.r][startPos.c] !== 0) continue;
            
            const visited = new Set();
            const queue = [startPos];
            visited.add(`${startPos.r},${startPos.c}`);
            
            let count = 0;
            while (queue.length > 0) {
                const current = queue.shift();
                count++;
                
                const neighbors = [
                    { r: current.r - 1, c: current.c },
                    { r: current.r + 1, c: current.c },
                    { r: current.r, c: current.c - 1 },
                    { r: current.r, c: current.c + 1 }
                ];
                
                for (const n of neighbors) {
                    if (n.r >= 0 && n.r < state.gridSize && n.c >= 0 && n.c < state.gridSize) {
                        if (state.board[n.r][n.c] === 0) {
                            const key = `${n.r},${n.c}`;
                            if (!visited.has(key)) {
                                visited.add(key);
                                queue.push(n);
                            }
                        }
                    }
                }
            }
            
            if (count > maxCount) {
                maxCount = count;
            }
        }
        
        return maxCount;
    }

    function hasAnyDrawingMoves(moveType, requiredCount) {
        if (moveType === 'wall-drawing') {
            const visited = new Set();
            for (let r = 0; r < state.gridSize; r++) {
                for (let c = 0; c < state.gridSize; c++) {
                    if (state.board[r][c] === 0 && !visited.has(`${r},${c}`)) {
                        let count = 0;
                        const queue = [{ r, c }];
                        visited.add(`${r},${c}`);
                        
                        while (queue.length > 0) {
                            const current = queue.shift();
                            count++;
                            if (count >= requiredCount) return true;
                            
                            const neighbors = [
                                { r: current.r - 1, c: current.c },
                                { r: current.r + 1, c: current.c },
                                { r: current.r, c: current.c - 1 },
                                { r: current.r, c: current.c + 1 }
                            ];
                            
                            for (const n of neighbors) {
                                if (n.r >= 0 && n.r < state.gridSize && n.c >= 0 && n.c < state.gridSize) {
                                    if (state.board[n.r][n.c] === 0 && !visited.has(`${n.r},${n.c}`)) {
                                        visited.add(`${n.r},${n.c}`);
                                        queue.push(n);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return false;
        }
        
        if (moveType === 'custom36-drawing') {
            const player = Number(state.activePlayer);
            let playerCellsCount = 0;
            for (let i = 0; i < state.gridSize; i++) {
                for (let j = 0; j < state.gridSize; j++) {
                    if (state.board[i][j] === player) playerCellsCount++;
                }
            }
            
            let startPositions = [];
            if (playerCellsCount === 0) {
                const start = getStartingCorner(player);
                startPositions.push({ r: start.r, c: start.c });
            } else {
                for (let r = 0; r < state.gridSize; r++) {
                    for (let c = 0; c < state.gridSize; c++) {
                        if (state.board[r][c] === 0) {
                            let adjacent = false;
                            if (r > 0 && state.board[r - 1][c] === player) adjacent = true;
                            if (r < state.gridSize - 1 && state.board[r + 1][c] === player) adjacent = true;
                            if (c > 0 && state.board[r][c - 1] === player) adjacent = true;
                            if (c < state.gridSize - 1 && state.board[r][c + 1] === player) adjacent = true;
                            
                            if (adjacent) {
                                startPositions.push({ r, c });
                            }
                        }
                    }
                }
            }
            
            const reachableCount = countMaxConnectedEmptyCells(startPositions);
            return reachableCount >= requiredCount;
        }
        
        return false;
    }

    function updateDrawBarUI() {
        const theme = state.colors[state.playerColors[state.activePlayer]];
        
        if (state.activeSpecialMove === 'wall-drawing') {
            DOM.drawStatusText.textContent = `Draw custom wall: ${state.customCellsToPlace} cells left`;
        } else {
            DOM.drawStatusText.textContent = `Draw custom shape: ${state.customCellsToPlace} cells left`;
        }
        
        if (state.customCellsToPlace === 0) {
            DOM.drawConfirmBtn.disabled = false;
            DOM.drawConfirmBtn.style.borderColor = theme.hex;
            DOM.drawConfirmBtn.style.color = theme.hex;
        } else {
            DOM.drawConfirmBtn.disabled = true;
            DOM.drawConfirmBtn.style.borderColor = "var(--text-dim)";
            DOM.drawConfirmBtn.style.color = "var(--text-muted)";
        }
        
        updateHelperBubble();
    }

    function confirmDrawShape() {
        if (state.customCellsToPlace !== 0) return;
        
        if (!validateFinalDraft()) {
            return;
        }
        
        if (state.activeSpecialMove === 'wall-drawing') {
            // Commit carbon blocks
            state.customCellsPlaced.forEach(pos => {
                state.board[pos.r][pos.c] = 7; // 7 = Wall
            });
            playWallSound();
            showToast("Carbon Wall secure!");
        } else if (state.activeSpecialMove === 'custom36-drawing') {
            // Commit territory blocks
            state.customCellsPlaced.forEach(pos => {
                state.board[pos.r][pos.c] = state.activePlayer;
            });
            playPlaceBlockSound();
            showToast("Custom territory secured!");
        }
        
        state.consecutiveSkippedTurns[state.activePlayer] = 0;
        tallyGridScores();
        
        // Reset pass counter
        state.consecutivePasses = 0;
        
        DOM.drawControlsBar.classList.remove("active");
        
        const next = (state.activePlayer % state.playersCount) + 1;
        switchPlayer(next);
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
        showToast("No valid placements available! Turn skipped.");
        
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
        
        // Tally score & check game end
        if (state.consecutivePasses >= state.playersCount) {
            endMatch();
        } else {
            // Hand over turn to next player
            const next = (state.activePlayer % state.playersCount) + 1;
            switchPlayer(next);
        }
    }

    // ==========================================================================
    // SCORE KEEPER & GAME OVER ENGINE
    // ==========================================================================
    function tallyGridScores() {
        const counts = {};
        for (let i = 1; i <= state.playersCount; i++) {
            counts[i] = 0;
        }
        const total = state.gridSize * state.gridSize;
        
        for (let r = 0; r < state.gridSize; r++) {
            for (let c = 0; c < state.gridSize; c++) {
                const cell = state.board[r][c];
                if (cell >= 1 && cell <= state.playersCount) {
                    counts[cell]++;
                }
            }
        }
        
        if (state.enableTeamMode) {
            const teamCounts = {};
            for (let i = 1; i <= state.playersCount; i++) {
                const teamNum = getPlayerTeam(i);
                teamCounts[teamNum] = (teamCounts[teamNum] || 0) + counts[i];
            }
            
            for (let i = 1; i <= state.playersCount; i++) {
                state[`p${i}Cells`] = counts[i];
                const els = state.scoreCardElements[i];
                if (els) {
                    const teamNum = getPlayerTeam(i);
                    const teamSum = teamCounts[teamNum];
                    els.value.textContent = counts[i].toString();
                    const pct = Math.round((teamSum / total) * 100);
                    els.pct.textContent = `TEAM ${teamNum}: ${teamSum} (${pct}%)`;
                }
            }
        } else {
            for (let i = 1; i <= state.playersCount; i++) {
                state[`p${i}Cells`] = counts[i];
                const els = state.scoreCardElements[i];
                if (els) {
                    els.value.textContent = counts[i].toString();
                    const pct = Math.round((counts[i] / total) * 100);
                    els.pct.textContent = `${pct}% of board`;
                }
            }
        }
    }

    function endMatch() {
        state.isGameOver = true;
        playVictoryFanfare();
        
        const totalCells = state.gridSize * state.gridSize;
        let totalClaimed = 0;
        
        const fillPct = Math.round((totalClaimed / totalCells) * 100);
        let rounds = 0;
        for (let i = 1; i <= state.playersCount; i++) {
            rounds += state.rollsCount[i] || 0;
        }

        if (state.enableTeamMode) {
            // Aggregate scores by team
            const teamMap = {};
            for (let i = 1; i <= state.playersCount; i++) {
                const cells = state[`p${i}Cells`] || 0;
                
                const teamNum = getPlayerTeam(i);
                if (!teamMap[teamNum]) {
                    teamMap[teamNum] = { teamNum, score: 0, members: [], colors: [] };
                }
                teamMap[teamNum].score += cells;
                teamMap[teamNum].members.push(state.playerNames[i]);
                teamMap[teamNum].colors.push(state.playerColors[i]);
                totalClaimed += cells;
            }
            
            const teamsList = Object.values(teamMap);
            teamsList.sort((a, b) => b.score - a.score);
            
            const winningTeam = teamsList[0];
            const runnerUpTeam = teamsList[1] || teamsList[0];
            
            const isDraw = teamsList.length > 1 && winningTeam.score === runnerUpTeam.score;
            
            let winnerName = "";
            let subText = "";
            
            if (isDraw) {
                winnerName = "DRAW MATCH";
                subText = "Stalemate! The top alliances claim equal ground.";
                DOM.victoryWinnerSubtitle.style.color = "var(--text-muted)";
                DOM.victoryTitle.style.color = "var(--text-primary)";
                DOM.victoryTitle.style.textShadow = "none";
            } else {
                winnerName = `Team ${winningTeam.teamNum}`;
                subText = `Team ${winningTeam.teamNum} (${winningTeam.members.join(", ")}) has secured victory!`;
                const primeColor = winningTeam.colors[0];
                const primeTheme = state.colors[primeColor];
                if (primeTheme) {
                    DOM.victoryWinnerSubtitle.style.color = primeTheme.hex;
                    DOM.victoryTitle.style.color = primeTheme.hex;
                    DOM.victoryTitle.style.textShadow = `0 0 20px ${primeTheme.glow}`;
                }
            }
            
            DOM.victoryTitle.textContent = isDraw ? "DRAW MATCH!" : `${winnerName.toUpperCase()} WINS!`;
            DOM.victoryWinnerSubtitle.textContent = subText;
            
            DOM.vStatWinnerScore.textContent = winningTeam.score.toString();
            DOM.vStatWinnerPct.textContent = `${Math.round((winningTeam.score / totalCells) * 100)}% of grid`;
            
            DOM.vStatLoserScore.textContent = runnerUpTeam.score.toString();
            DOM.vStatLoserPct.textContent = `${Math.round((runnerUpTeam.score / totalCells) * 100)}% of grid`;
            
            DOM.vMetaInfo.textContent = `Match concluded in ${rounds} rounds. ${Math.round((totalClaimed / totalCells) * 100)}% of the grid was claimed.`;
            DOM.victoryOverlay.classList.add("active");
        } else {
            const playerScores = [];
            for (let i = 1; i <= state.playersCount; i++) {
                const cells = state[`p${i}Cells`] || 0;
                totalClaimed += cells;
                playerScores.push({
                    id: i,
                    name: state.playerNames[i],
                    color: state.playerColors[i],
                    score: cells
                });
            }
            
            playerScores.sort((a, b) => b.score - a.score);
            
            const winner = playerScores[0];
            const runnerUp = playerScores[1] || playerScores[0];
            const winnerTheme = state.colors[winner.color];
            
            let winnerName = "";
            let subText = "";
            const isDraw = playerScores.length > 1 && winner.score === runnerUp.score;
            
            if (isDraw) {
                winnerName = "DRAW MATCH";
                subText = "Stalemate! The top commanders claim equal ground.";
                DOM.victoryWinnerSubtitle.style.color = "var(--text-muted)";
                DOM.victoryTitle.style.color = "var(--text-primary)";
                DOM.victoryTitle.style.textShadow = "none";
            } else {
                winnerName = winner.name;
                subText = `${winner.name} has secured dominating control of the grid!`;
                if (winnerTheme) {
                    DOM.victoryWinnerSubtitle.style.color = winnerTheme.hex;
                    DOM.victoryTitle.style.color = winnerTheme.hex;
                    DOM.victoryTitle.style.textShadow = `0 0 20px ${winnerTheme.glow}`;
                }
            }
            
            DOM.victoryTitle.textContent = isDraw ? "DRAW MATCH!" : `${winnerName.toUpperCase()} WINS!`;
            DOM.victoryWinnerSubtitle.textContent = subText;
            
            DOM.vStatWinnerScore.textContent = winner.score.toString();
            DOM.vStatWinnerPct.textContent = `${Math.round((winner.score / totalCells) * 100)}% of grid`;
            
            DOM.vStatLoserScore.textContent = runnerUp.score.toString();
            DOM.vStatLoserPct.textContent = `${Math.round((runnerUp.score / totalCells) * 100)}% of grid`;
            
            DOM.vMetaInfo.textContent = `Match concluded in ${rounds} rounds. ${Math.round((totalClaimed / totalCells) * 100)}% of the grid was claimed.`;
            DOM.victoryOverlay.classList.add("active");
        }
        
        startConfettiEffect();
    }

    // ==========================================================================
    // CANVAS RETINA GRID RENDERING & HOVER LOGIC
    // ==========================================================================
    let ctx = null;
    let gridCellSize = 0;
    let gridWidth = 0;
    
    function resizeCanvas() {
        const container = DOM.canvas.parentElement; // .board-inner-container
        const parent = container.parentElement; // .board-wrapper
        const maxCanvasSize = 660; // 680px max-width minus 20px padding
        
        const size = Math.min(maxCanvasSize, Math.min(parent.clientWidth, parent.clientHeight) - 40);
        
        const dpr = window.devicePixelRatio || 1;
        DOM.canvas.width = size * dpr;
        DOM.canvas.height = size * dpr;
        
        DOM.canvas.style.width = size + "px";
        DOM.canvas.style.height = size + "px";
        
        container.style.width = (size + 20) + "px";
        container.style.height = (size + 20) + "px";
        
        ctx = DOM.canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        
        gridWidth = size;
        gridCellSize = size / state.gridSize;
        
        drawBoard();
    }

    function drawBoard() {
        if (!ctx) return;
        
        ctx.clearRect(0, 0, gridWidth, gridWidth);
        
        // 1. Draw Player captured blocks & Carbon Walls
        for (let r = 0; r < state.gridSize; r++) {
            for (let c = 0; c < state.gridSize; c++) {
                const cell = state.board[r][c];
                
                if (cell >= 1 && cell <= state.playersCount) {
                    const theme = state.colors[state.playerColors[cell]];
                    if (theme) {
                        ctx.fillStyle = theme.fill;
                        ctx.fillRect(c * gridCellSize + 1.5, r * gridCellSize + 1.5, gridCellSize - 3, gridCellSize - 3);
                        
                        ctx.strokeStyle = theme.hex;
                        ctx.lineWidth = 2;
                        ctx.lineJoin = "round";
                        ctx.strokeRect(c * gridCellSize + 1.5, r * gridCellSize + 1.5, gridCellSize - 3, gridCellSize - 3);
                    }
                } else if (cell === 7) {
                    // Carbon Obstacle Wall
                    ctx.fillStyle = "#161622";
                    ctx.fillRect(c * gridCellSize + 1, r * gridCellSize + 1, gridCellSize - 2, gridCellSize - 2);
                    
                    ctx.strokeStyle = "#ff6600";
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(c * gridCellSize + 1, r * gridCellSize + 1, gridCellSize - 2, gridCellSize - 2);
                    
                    // Metallic Hazard Stripes
                    ctx.strokeStyle = "rgba(255, 102, 0, 0.4)";
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(c * gridCellSize + 2, r * gridCellSize + 2);
                    ctx.lineTo(c * gridCellSize + gridCellSize - 2, r * gridCellSize + gridCellSize - 2);
                    ctx.stroke();
                }
            }
        }
        
        // 2. Draw active drafting previews (Wall or 36-cell custom shape)
        const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
        if (isDrawingMode) {
            const activeTheme = state.colors[state.playerColors[state.activePlayer]];
            state.customCellsPlaced.forEach((pos, i) => {
                const activeColor = state.activeSpecialMove === 'wall-drawing' ? "#ff6600" : (activeTheme ? activeTheme.hex : "#00f0ff");
                const activeFill = state.activeSpecialMove === 'wall-drawing' ? "rgba(255, 102, 0, 0.25)" : (activeTheme ? activeTheme.fill : "rgba(0, 240, 255, 0.15)");
                
                ctx.fillStyle = activeFill;
                ctx.fillRect(pos.c * gridCellSize + 2, pos.r * gridCellSize + 2, gridCellSize - 4, gridCellSize - 4);
                
                ctx.strokeStyle = activeColor;
                ctx.lineWidth = 2;
                ctx.strokeRect(pos.c * gridCellSize + 2, pos.r * gridCellSize + 2, gridCellSize - 4, gridCellSize - 4);
                
                // Show index numbers for path tracking
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 9px Outfit";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText((i + 1).toString(), pos.c * gridCellSize + gridCellSize/2, pos.r * gridCellSize + gridCellSize/2);
            });
        }
        
        // 3. Draw background grid lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= state.gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gridCellSize, 0);
            ctx.lineTo(i * gridCellSize, gridWidth);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(0, i * gridCellSize);
            ctx.lineTo(gridWidth, i * gridCellSize);
            ctx.stroke();
        }
        
        // 4. Draw Starting Corners Indicators (hidden if Cosmic seed or drawing is active)
        if (state.activeSpecialMove !== '1x1-anywhere' && !isDrawingMode) {
            for (let i = 1; i <= state.playersCount; i++) {
                const hasPlayerPlayed = state.board.some(row => row.includes(i));
                if (!hasPlayerPlayed) {
                    const start = getStartingCorner(i);
                    const theme = state.colors[state.playerColors[i]];
                    if (theme) {
                        drawCornerIndicator(start.r, start.c, theme.hex, theme.glow);
                    }
                }
            }
        }
        
        // 5. Draw Hover Block Previews (if active player has rolled and not in drawing mode)
        if (state.hasRolled && hoverState.row !== -1 && hoverState.col !== -1 && !isDrawingMode) {
            let blockW = state.currentRoll[0];
            let blockH = state.currentRoll[1];
            if (state.isRotated) {
                blockW = state.currentRoll[1];
                blockH = state.currentRoll[0];
            }
            
            const r = hoverState.row;
            const c = hoverState.col;
            
            ctx.save();
            ctx.lineWidth = 2.5;
            ctx.lineDashOffset = state.dashOffset;
            ctx.setLineDash([6, 4]);
            
            const activeTheme = state.colors[state.playerColors[state.activePlayer]];
            
            if (hoverState.isValid) {
                ctx.strokeStyle = activeTheme ? activeTheme.hex : "#00f0ff";
                ctx.fillStyle = activeTheme ? activeTheme.fill : "rgba(0, 240, 255, 0.15)";
                ctx.shadowColor = activeTheme ? activeTheme.hex : "#00f0ff";
                ctx.shadowBlur = 10;
            } else {
                ctx.strokeStyle = "#ff3333";
                ctx.fillStyle = "rgba(255, 50, 50, 0.15)";
                ctx.shadowColor = "#ff3333";
                ctx.shadowBlur = 5;
            }
            
            ctx.fillRect(c * gridCellSize + 2, r * gridCellSize + 2, blockW * gridCellSize - 4, blockH * gridCellSize - 4);
            ctx.strokeRect(c * gridCellSize + 2, r * gridCellSize + 2, blockW * gridCellSize - 4, blockH * gridCellSize - 4);
            ctx.restore();
        }
        
        // 6. Draw Single cell preview in drawing mode
        if (isDrawingMode && hoverState.row !== -1 && hoverState.col !== -1) {
            ctx.save();
            ctx.lineWidth = 2;
            const activeTheme = state.colors[state.playerColors[state.activePlayer]];
            ctx.strokeStyle = state.activeSpecialMove === 'wall-drawing' ? "#ff6600" : (activeTheme ? activeTheme.hex : "#00f0ff");
            ctx.strokeRect(hoverState.col * gridCellSize + 2, hoverState.row * gridCellSize + 2, gridCellSize - 4, gridCellSize - 4);
            ctx.restore();
        }
    }

    function drawCornerIndicator(r, c, hex, glow) {
        ctx.save();
        ctx.strokeStyle = hex;
        ctx.lineWidth = 2;
        ctx.shadowColor = hex;
        ctx.shadowBlur = 8;
        
        const pad = 4;
        const x = c * gridCellSize + pad;
        const y = r * gridCellSize + pad;
        const size = gridCellSize - pad * 2;
        
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fillRect(x, y, size, size);
        ctx.strokeRect(x, y, size, size);
        
        const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
        ctx.fillStyle = hex;
        ctx.globalAlpha = 0.15 + pulse * 0.25;
        ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
        
        ctx.restore();
    }

    function canvasLoop() {
        state.dashOffset -= 0.2;
        if (state.dashOffset < -20) state.dashOffset = 0;
        
        drawBoard();
        state.animationFrameId = requestAnimationFrame(canvasLoop);
    }

    function handleMouseMove(e) {
        const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
        if ((!state.hasRolled && !isDrawingMode) || state.isGameOver) return;
        
        const rect = DOM.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const cellX = Math.floor(x / (rect.width / state.gridSize));
        const cellY = Math.floor(y / (rect.height / state.gridSize));
        
        // Drawing modes hover tracking
        if (isDrawingMode) {
            let c = Math.max(0, Math.min(cellX, state.gridSize - 1));
            let r = Math.max(0, Math.min(cellY, state.gridSize - 1));
            
            if (hoverState.row !== r || hoverState.col !== c) {
                hoverState.row = r;
                hoverState.col = c;
                playHoverTick();
                
                if (state.isDrawingDrag) {
                    handleDrawModeCellClick(r, c);
                } else if (state.isErasingDrag) {
                    handleDrawModeCellRemove(r, c);
                }
            }
            return;
        }
        
        // Standard placement modes hover tracking
        let blockW = state.currentRoll[0];
        let blockH = state.currentRoll[1];
        if (state.isRotated) {
            blockW = state.currentRoll[1];
            blockH = state.currentRoll[0];
        }
        
        let c = Math.max(0, Math.min(cellX - Math.floor(blockW / 2), state.gridSize - blockW));
        let r = Math.max(0, Math.min(cellY - Math.floor(blockH / 2), state.gridSize - blockH));
        
        const valid = isValidPlacement(r, c, blockW, blockH, state.activePlayer);
        
        if (hoverState.row !== r || hoverState.col !== c || hoverState.isValid !== valid) {
            hoverState.row = r;
            hoverState.col = c;
            hoverState.isValid = valid;
            
            if (valid) {
                playHoverTick();
            }
        }
    }

    function handleMouseLeave() {
        hoverState.row = -1;
        hoverState.col = -1;
        hoverState.isValid = false;
    }

    function handleGridClick() {
        const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
        if (hoverState.row === -1 || hoverState.col === -1 || state.isGameOver) return;
        
        // Click Router inside drawing modes
        if (isDrawingMode) {
            // Handled by mousedown/mousemove to allow drag-to-draw
            return;
        }
        
        if (!state.hasRolled) return;
        
        if (!hoverState.isValid) {
            playErrorTone();
            showToast("Invalid placement! Rule violation.");
            return;
        }
        
        // Execute block placement
        let blockW = state.currentRoll[0];
        let blockH = state.currentRoll[1];
        if (state.isRotated) {
            blockW = state.currentRoll[1];
            blockH = state.currentRoll[0];
        }
        
        const r = hoverState.row;
        const c = hoverState.col;
        
        // Detect and commit Tectonic Breach Overwrite
        if (state.activeSpecialMove === 'breach-overwriting') {
            playBreachSound();
            showToast("Tectonic Breach successful!");
        } else {
            playPlaceBlockSound();
        }
        
        for (let i = r; i < r + blockH; i++) {
            for (let j = c; j < c + blockW; j++) {
                state.board[i][j] = state.activePlayer;
            }
        }
        
        state.consecutiveSkippedTurns[state.activePlayer] = 0;
        tallyGridScores();
        state.consecutivePasses = 0;
        handleMouseLeave();
        
        // Switch players
        const next = (state.activePlayer % state.playersCount) + 1;
        switchPlayer(next);
    }

    function toggleRotation() {
        if (!state.hasRolled || state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing') return;
        state.isRotated = !state.isRotated;
        playHoverTick();
        
        updateHelperBubble();
        
        if (hoverState.row !== -1) {
            let blockW = state.currentRoll[0];
            let blockH = state.currentRoll[1];
            if (state.isRotated) {
                blockW = state.currentRoll[1];
                blockH = state.currentRoll[0];
            }
            
            hoverState.row = Math.max(0, Math.min(hoverState.row, state.gridSize - blockH));
            hoverState.col = Math.max(0, Math.min(hoverState.col, state.gridSize - blockW));
            hoverState.isValid = isValidPlacement(hoverState.row, hoverState.col, blockW, blockH, state.activePlayer);
        }
    }

    // ==========================================================================
    // TOAST SYSTEM
    // ==========================================================================
    let toastTimeout = null;
    function showToast(msg) {
        clearTimeout(toastTimeout);
        DOM.toastMsg.textContent = msg;
        DOM.toastNotif.classList.add("active");
        
        toastTimeout = setTimeout(() => {
            DOM.toastNotif.classList.remove("active");
        }, 2200);
    }

    // ==========================================================================
    // CONFETTI PHYSICS SYSTEM (WINNER SCREEN CELEBRATION)
    // ==========================================================================
    let confettiParticles = [];
    let confettiActive = false;
    let confettiCtx = null;
    
    function startConfettiEffect() {
        confettiCtx = DOM.confettiCanvas.getContext("2d");
        DOM.confettiCanvas.width = window.innerWidth;
        DOM.confettiCanvas.height = window.innerHeight;
        
        confettiParticles = [];
        confettiActive = true;
        
        let winnerIndex = 1;
        let maxCells = -1;
        for (let i = 1; i <= state.playersCount; i++) {
            const cells = state[`p${i}Cells`] || 0;
            if (cells > maxCells) {
                maxCells = cells;
                winnerIndex = i;
            }
        }
        const activeTheme = state.colors[state.playerColors[winnerIndex]];
        const colorHex = activeTheme ? activeTheme.hex : "#00f0ff";
        
        for (let i = 0; i < 110; i++) {
            confettiParticles.push({
                x: Math.random() * DOM.confettiCanvas.width,
                y: Math.random() * DOM.confettiCanvas.height - DOM.confettiCanvas.height,
                size: Math.random() * 8 + 4,
                color: Math.random() > 0.5 ? colorHex : "#ffffff",
                speedX: Math.random() * 4 - 2,
                speedY: Math.random() * 3 + 2,
                rotation: Math.random() * 360,
                spinSpeed: Math.random() * 2 - 1
            });
        }
        
        requestAnimationFrame(confettiLoop);
    }

    function confettiLoop() {
        if (!confettiActive || !confettiCtx) return;
        
        confettiCtx.clearRect(0, 0, DOM.confettiCanvas.width, DOM.confettiCanvas.height);
        
        for (let i = 0; i < confettiParticles.length; i++) {
            const p = confettiParticles[i];
            
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.spinSpeed;
            
            if (p.y > DOM.confettiCanvas.height) {
                p.y = -10;
                p.x = Math.random() * DOM.confettiCanvas.width;
            }
            
            confettiCtx.save();
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate((p.rotation * Math.PI) / 180);
            
            confettiCtx.fillStyle = p.color;
            confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            
            confettiCtx.restore();
        }
        
        requestAnimationFrame(confettiLoop);
    }

    // ==========================================================================
    // INTERACTIVE EVENT BINDINGS
    // ==========================================================================
    function setupEventListeners() {
        // Start Game Match Handler
        DOM.startGameBtn.addEventListener("click", () => {
            initAudio();
            
            const enableTeamModeVal = DOM.teamModeChk.checked && (state.playersCount === 4 || state.playersCount === 6);
            if (enableTeamModeVal) {
                const uniqueTeams = new Set();
                for (let i = 1; i <= state.playersCount; i++) {
                    uniqueTeams.add(state.playerTeams[i]);
                }
                if (uniqueTeams.size < 2) {
                    showToast("Must have at least 2 distinct teams to play!");
                    playErrorTone();
                    return;
                }
            }
            
            // Pull settings names dynamically for all active players (2 to 6)
            for (let i = 1; i <= state.playersCount; i++) {
                const nameInput = document.getElementById(`p${i}-name`);
                if (nameInput) {
                    state.playerNames[i] = nameInput.value.trim() || `Player ${i}`;
                }
            }
            
            // Build the scoreboard elements dynamically BEFORE resetting the board!
            buildScoreboardUI();
            
            // advanced settings state
            state.enableAdvancedRules = DOM.advancedRulesChk.checked;
            state.enableTeamMode = enableTeamModeVal;
            state.autoRoll = DOM.autoRollChk.checked;
            
            // Secure configs
            updateThemeStyles();
            resetBoard();
            
            // Transition screen
            DOM.setupScreen.classList.remove("active");
            DOM.gameScreen.classList.add("active");
            
            // Start turn
            switchPlayer(1);
            resizeCanvas();
            playPlaceBlockSound();
        });
        
        // Player Count Selector Handler
        DOM.playerCountButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                DOM.playerCountButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                state.playersCount = parseInt(btn.dataset.count);
                
                // Show/hide player setup cards
                for (let i = 1; i <= 6; i++) {
                    const card = document.getElementById(`p${i}-card`);
                    if (card) {
                        if (i <= state.playersCount) {
                            card.classList.remove("hidden");
                        } else {
                            card.classList.add("hidden");
                        }
                    }
                }
                
                // Show/hide Team Mode option (only available for 4 or 6 players)
                if (state.playersCount === 4 || state.playersCount === 6) {
                    DOM.teamModeOption.style.display = "block";
                } else {
                    DOM.teamModeOption.style.display = "none";
                    DOM.teamModeChk.checked = false;
                    state.enableTeamMode = false;
                }
                updateTeamSelectorVisibility();
            });
        });

        // Team Mode Checkbox Handler
        DOM.teamModeChk.addEventListener("change", () => {
            state.enableTeamMode = DOM.teamModeChk.checked;
            updateTeamSelectorVisibility();
        });

        // Auto-Roll Checkbox Setup sync
        DOM.autoRollChk.addEventListener("change", () => {
            state.autoRoll = DOM.autoRollChk.checked;
            DOM.gameAutoRollChk.checked = state.autoRoll;
        });

        // In-game Auto-Roll Checkbox Handler
        DOM.gameAutoRollChk.addEventListener("change", () => {
            state.autoRoll = DOM.gameAutoRollChk.checked;
            DOM.autoRollChk.checked = state.autoRoll;
            // If checked and we haven't rolled yet, trigger automatic roll
            if (state.autoRoll && !state.hasRolled && DOM.gameScreen.classList.contains("active") && !state.isGameOver) {
                triggerDiceRoll();
            }
        });
        
        // Map Selection Handler
        DOM.mapStyleButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                DOM.mapStyleButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                state.mapType = btn.dataset.map;
            });
        });
        
        // Grid Size Selector click toggles
        DOM.gridSelectors.forEach(btn => {
            btn.addEventListener("click", () => {
                DOM.gridSelectors.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                state.gridSize = parseInt(btn.dataset.size);
                DOM.customSizeInput.value = ""; // Clear custom input
            });
        });

        // Custom Grid Size Input listener
        DOM.customSizeInput.addEventListener("input", () => {
            const val = parseInt(DOM.customSizeInput.value);
            if (val >= 10 && val <= 80) {
                // Clear active states of preset buttons
                DOM.gridSelectors.forEach(b => b.classList.remove("active"));
                state.gridSize = val;
            } else if (DOM.customSizeInput.value === "") {
                // If cleared, default back to the active preset or 20
                const activeBtn = Array.from(DOM.gridSelectors).find(b => b.classList.contains("active"));
                if (activeBtn) {
                    state.gridSize = parseInt(activeBtn.dataset.size);
                } else {
                    state.gridSize = 20;
                }
            }
        });
        
        DOM.customSizeInput.addEventListener("change", () => {
            let val = parseInt(DOM.customSizeInput.value);
            if (isNaN(val)) return;
            // Clamp value on blur/change
            if (val < 10) val = 10;
            if (val > 80) val = 80;
            DOM.customSizeInput.value = val;
            DOM.gridSelectors.forEach(b => b.classList.remove("active"));
            state.gridSize = val;
        });
        
        // Roll Action
        DOM.rollBtn.addEventListener("click", triggerDiceRoll);
        
        // Keyboard listeners for Spacer rotational toggles & cheat keys
        window.addEventListener("keydown", (e) => {
            // Ignore key shortcuts if typing inside input fields
            if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
                return;
            }
            
            if (e.code === "Space") {
                e.preventDefault();
                if (state.hasRolled && !DOM.rotateBtn.disabled) {
                    toggleRotation();
                }
            }
            if (DOM.gameScreen.classList.contains("active") && !state.isGameOver) {
                if (e.key.toLowerCase() === "d" && !state.hasRolled) {
                    const input = prompt("Введіть значення двох кубиків через пробіл (наприклад, '6 6' або '3 5'):");
                    if (input) {
                        const parts = input.trim().split(/\s+/);
                        if (parts.length === 2) {
                            const d1 = parseInt(parts[0]);
                            const d2 = parseInt(parts[1]);
                            if (d1 >= 1 && d1 <= 6 && d2 >= 1 && d2 <= 6) {
                                state.debugNextRoll = [d1, d2];
                                alert(`Наступний кидок встановлено: ${d1} x ${d2}. Тепер натисніть кнопку 'Roll Dice'!`);
                            } else {
                                alert("Значення кубиків повинні бути від 1 до 6!");
                            }
                        } else {
                            alert("Введіть рівно два числа через пробіл!");
                        }
                    }
                }
            }
        });
        
        DOM.rotateBtn.addEventListener("click", toggleRotation);
        DOM.passBtn.addEventListener("click", passTurn);
        
        // Dynamic Grid hover and click mappings
        DOM.canvas.addEventListener("mousemove", handleMouseMove);
        DOM.canvas.addEventListener("mouseleave", handleMouseLeave);
        
        DOM.canvas.addEventListener("mousedown", (e) => {
            const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
            if (isDrawingMode && !state.isGameOver) {
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

        DOM.canvas.addEventListener("click", handleGridClick);
        DOM.canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault(); // Prevent standard browser context menu
            const isDrawingMode = state.activeSpecialMove === 'wall-drawing' || state.activeSpecialMove === 'custom36-drawing';
            if (!isDrawingMode && state.hasRolled && !DOM.rotateBtn.disabled) {
                toggleRotation();
            }
        });
        
        // Drawing control bar button bindings
        DOM.drawConfirmBtn.addEventListener("click", confirmDrawShape);
        DOM.drawResetBtn.addEventListener("click", resetDrawShape);
        
        // Rules drawers panel visibility
        DOM.toggleRulesBtn.addEventListener("click", () => DOM.rulesDrawer.classList.add("active"));
        DOM.helpBtn.addEventListener("click", () => DOM.rulesDrawer.classList.add("active"));
        DOM.closeRulesBtn.addEventListener("click", () => DOM.rulesDrawer.classList.remove("active"));
        DOM.rulesDrawer.addEventListener("click", (e) => {
            if (e.target === DOM.rulesDrawer) DOM.rulesDrawer.classList.remove("active");
        });
        
        // Mute sound effects
        DOM.muteBtn.addEventListener("click", () => {
            state.soundMuted = !state.soundMuted;
            if (state.soundMuted) {
                DOM.muteIcon.className = "fa-solid fa-volume-xmark";
                showToast("Sound effects muted.");
            } else {
                DOM.muteIcon.className = "fa-solid fa-volume-high";
                initAudio();
                playHoverTick();
                showToast("Sound effects enabled.");
            }
        });
        
        // Resets
        DOM.resetBtn.addEventListener("click", () => {
            if (confirm("Reset current match? Progress will be lost.")) {
                resetBoard();
                switchPlayer(1);
                resizeCanvas();
            }
        });
        
        DOM.rematchBtn.addEventListener("click", () => {
            confettiActive = false;
            DOM.victoryOverlay.classList.remove("active");
            resetBoard();
            switchPlayer(1);
            resizeCanvas();
        });
        
        // Handle window resizing smoothly
        window.addEventListener("resize", () => {
            if (DOM.gameScreen.classList.contains("active")) {
                resizeCanvas();
            }
        });
    }

    // Initialize core launch
    window.addEventListener("DOMContentLoaded", init);

})();
