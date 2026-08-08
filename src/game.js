/**
 * SQUARES - Core Game Logic & Rules Engine
 */

export const COLOR_PALETTES = {
    cyan: { hex: "#00f0ff", hsl: "184, 100%, 50%", glow: "rgba(0, 240, 255, 0.45)", fill: "rgba(0, 240, 255, 0.15)" },
    emerald: { hex: "#00ffaa", hsl: "160, 100%, 50%", glow: "rgba(0, 255, 170, 0.45)", fill: "rgba(0, 255, 170, 0.15)" },
    gold: { hex: "#ffc400", hsl: "46, 100%, 50%", glow: "rgba(255, 196, 0, 0.45)", fill: "rgba(255, 196, 0, 0.15)" },
    pink: { hex: "#ff007f", hsl: "330, 100%, 50%", glow: "rgba(255, 0, 127, 0.45)", fill: "rgba(255, 0, 127, 0.15)" },
    purple: { hex: "#9d00ff", hsl: "277, 100%, 50%", glow: "rgba(157, 0, 255, 0.45)", fill: "rgba(157, 0, 255, 0.15)" },
    orange: { hex: "#ff5500", hsl: "20, 100%, 50%", glow: "rgba(255, 85, 0, 0.45)", fill: "rgba(255, 85, 0, 0.15)" }
};

export function createInitialState() {
    return {
        activePlayer: 1,
        playersCount: 2,
        mapType: "classic",
        playerNames: { 
            1: "Cyber Blue", 2: "Neon Pink", 3: "Emerald Rogue",
            4: "Purple Monarch", 5: "Golden Sage", 6: "Orange Overlord" 
        },
        playerColors: { 
            1: "cyan", 2: "pink", 3: "emerald",
            4: "purple", 5: "gold", 6: "orange" 
        },
        colors: COLOR_PALETTES,
        gridSize: 20,
        board: [],
        currentRoll: [0, 0],
        hasRolled: false,
        isRotated: false,
        consecutivePasses: 0,
        isGameOver: false,
        rollsCount: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        soundMuted: false,
        dashOffset: 0,
        
        enableAdvancedRules: false,
        doubleSizeMultiplier: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
        consecutiveSkippedTurns: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        activeSpecialMove: null, // '1x1-anywhere', 'wall-drawing', 'custom36-drawing', 'breach-overwriting'
        customCellsToPlace: 0,
        customCellsPlaced: [],
        isDrawingDrag: false,
        isErasingDrag: false,
        debugNextRoll: null,
        
        autoRoll: false,
        enableTeamMode: false,
        teamModeType: "3v3",
        playerTeams: { 1: 1, 2: 2, 3: 1, 4: 2, 5: 1, 6: 2 },
        
        // Multiplayer Online State
        isOnline: false,
        roomId: null,
        roomCode: null,
        localPlayerIndex: 1, // Which player slot this client controls in online mode
        isHost: false
    };
}

export function getPlayerTeam(state, playerNum) {
    const p = Number(playerNum);
    if (p === 0 || p === 7) return p;
    if (!state.enableTeamMode) return p;
    return state.playerTeams[p] || 1;
}

export function getStartingCorner(gridSize, playerNum) {
    const pNum = Number(playerNum);
    const size = gridSize - 1;
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

export function generateMapObstacles(board, gridSize, mapType, playersCount) {
    if (mapType === "classic") return;
    
    const N = gridSize;
    const mid = Math.floor(N / 2);
    
    if (mapType === "asteroids") {
        const activeStarts = [];
        for (let i = 1; i <= playersCount; i++) {
            activeStarts.push(getStartingCorner(N, i));
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
            
            if (board[r][c] === 0 && !isSafe(r, c)) {
                board[r][c] = 7; // WALL
                placed++;
            }
        }
    } else if (mapType === "cross") {
        for (let i = 0; i < N; i++) {
            if (i > 5 && i < N - 6) {
                board[mid][i] = 7;
            }
            if (i > 2 && i < N - 3) {
                board[i][mid] = 7;
            }
        }
        board[mid][mid] = 0;
        if (mid > 0) {
            board[mid-1][mid] = 0;
            board[mid+1][mid] = 0;
            board[mid][mid-1] = 0;
            board[mid][mid+1] = 0;
        }
    } else if (mapType === "quadrants") {
        const q1 = Math.floor(N / 4);
        const q2 = Math.floor((3 * N) / 4);
        
        const placePillar = (centerR, centerC) => {
            for (let r = centerR - 1; r <= centerR; r++) {
                for (let c = centerC - 1; c <= centerC; c++) {
                    if (r >= 0 && r < N && c >= 0 && c < N) {
                        board[r][c] = 7;
                    }
                }
            }
        };
        
        placePillar(q1, q1);
        placePillar(q1, q2);
        placePillar(q2, q1);
        placePillar(q2, q2);
    } else if (mapType === "blackhole") {
        for (let r = mid - 2; r <= mid + 1; r++) {
            for (let c = mid - 2; c <= mid + 1; c++) {
                if (r >= 0 && r < N && c >= 0 && c < N) {
                    board[r][c] = 7;
                }
            }
        }
    }
}

export function resetBoardMatrix(state) {
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
    
    generateMapObstacles(state.board, state.gridSize, state.mapType, state.playersCount);
}

export function isValidPlacement(state, r, c, width, height, player) {
    const pId = Number(player);
    const N = state.gridSize;
    
    if (r < 0 || c < 0 || r + height > N || c + width > N) {
        return false;
    }
    
    let opponentCellsCovered = 0;
    
    for (let i = r; i < r + height; i++) {
        for (let j = c; j < c + width; j++) {
            const cell = state.board[i][j];
            
            if (cell === 7 || cell === pId) {
                return false;
            }
            
            if (state.enableTeamMode && getPlayerTeam(state, cell) === getPlayerTeam(state, pId)) {
                return false;
            }
            
            if (cell !== 0) {
                if (state.activeSpecialMove === 'breach-overwriting' && getPlayerTeam(state, cell) !== getPlayerTeam(state, pId)) {
                    opponentCellsCovered++;
                } else {
                    return false;
                }
            }
        }
    }
    
    let playerCellsCount = 0;
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (state.board[i][j] === pId) playerCellsCount++;
        }
    }
    
    if (playerCellsCount === 0 && state.activeSpecialMove !== '1x1-anywhere') {
        const start = getStartingCorner(N, pId);
        const coversCorner = (r <= start.r && r + height - 1 >= start.r &&
                              c <= start.c && c + width - 1 >= start.c);
        if (coversCorner) return true;
        
        if (state.enableTeamMode) {
            const playerTeam = getPlayerTeam(state, pId);
            for (let i = r; i < r + height; i++) {
                for (let j = c; j < c + width; j++) {
                    if (i > 0 && getPlayerTeam(state, state.board[i - 1][j]) === playerTeam) return true;
                    if (i < N - 1 && getPlayerTeam(state, state.board[i + 1][j]) === playerTeam) return true;
                    if (j > 0 && getPlayerTeam(state, state.board[i][j - 1]) === playerTeam) return true;
                    if (j < N - 1 && getPlayerTeam(state, state.board[i][j + 1]) === playerTeam) return true;
                }
            }
        }
        return false;
    }
    
    if (state.activeSpecialMove === '1x1-anywhere') {
        return true;
    }
    
    const playerTeam = getPlayerTeam(state, pId);
    for (let i = r; i < r + height; i++) {
        for (let j = c; j < c + width; j++) {
            if (i > 0 && getPlayerTeam(state, state.board[i - 1][j]) === playerTeam) return true;
            if (i < N - 1 && getPlayerTeam(state, state.board[i + 1][j]) === playerTeam) return true;
            if (j > 0 && getPlayerTeam(state, state.board[i][j - 1]) === playerTeam) return true;
            if (j < N - 1 && getPlayerTeam(state, state.board[i][j + 1]) === playerTeam) return true;
        }
    }
    
    return false;
}

export function hasAnyValidMoves(state, player, roll) {
    const pId = Number(player);
    if (state.activeSpecialMove === '1x1-anywhere') {
        return state.board.some(row => row.includes(0));
    }
    
    const A = roll[0];
    const B = roll[1];
    
    for (let r = 0; r < state.gridSize; r++) {
        for (let c = 0; c < state.gridSize; c++) {
            if (isValidPlacement(state, r, c, A, B, pId)) return true;
            if (isValidPlacement(state, r, c, B, A, pId)) return true;
        }
    }
    
    return false;
}

export function tallyScores(state) {
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
    
    for (let i = 1; i <= state.playersCount; i++) {
        state[`p${i}Cells`] = counts[i];
    }
    
    return { counts, total };
}
