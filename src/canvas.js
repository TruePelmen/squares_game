/**
 * SQUARES - Canvas Rendering Engine & Confetti System
 */

let ctx = null;
let gridCellSize = 0;
let gridWidth = 0;

let confettiParticles = [];
let confettiActive = false;
let confettiCtx = null;

export function resizeCanvas(canvasElement, state) {
    if (!canvasElement) return { gridCellSize: 0, gridWidth: 0 };
    
    const container = canvasElement.parentElement;
    const parent = container.parentElement;
    const maxCanvasSize = 660;
    
    const size = Math.min(maxCanvasSize, Math.min(parent.clientWidth, parent.clientHeight) - 40);
    
    const dpr = window.devicePixelRatio || 1;
    canvasElement.width = size * dpr;
    canvasElement.height = size * dpr;
    
    canvasElement.style.width = size + "px";
    canvasElement.style.height = size + "px";
    
    container.style.width = (size + 20) + "px";
    container.style.height = (size + 20) + "px";
    
    ctx = canvasElement.getContext("2d");
    ctx.scale(dpr, dpr);
    
    gridWidth = size;
    gridCellSize = size / state.gridSize;
    
    return { gridCellSize, gridWidth };
}

export function drawBoard(canvasElement, state, hoverState, remoteHoverState = null) {
    if (!canvasElement) return;
    if (!ctx) {
        ctx = canvasElement.getContext("2d");
    }
    
    ctx.clearRect(0, 0, gridWidth, gridWidth);
    
    // 1. Draw Player captured blocks & Carbon Walls
    for (let r = 0; r < state.gridSize; r++) {
        for (let c = 0; c < state.gridSize; c++) {
            const cell = state.board[r]?.[c] || 0;
            
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
            
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 9px Outfit, sans-serif";
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
    
    // 4. Draw Starting Corners Indicators
    if (state.activeSpecialMove !== '1x1-anywhere' && !isDrawingMode) {
        for (let i = 1; i <= state.playersCount; i++) {
            const hasPlayerPlayed = state.board.some(row => row.includes(i));
            if (!hasPlayerPlayed) {
                const start = getCornerCoord(state.gridSize, i);
                const theme = state.colors[state.playerColors[i]];
                if (theme) {
                    drawCornerIndicator(start.r, start.c, theme.hex);
                }
            }
        }
    }
    
    // 5. Draw Local Hover Block Preview
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
    
    // 6. Draw Remote Opponent Hover Preview (Broadcast in Multiplayer)
    if (remoteHoverState && remoteHoverState.row !== -1 && remoteHoverState.col !== -1) {
        const remotePlayer = remoteHoverState.playerIndex;
        const remoteTheme = state.colors[state.playerColors[remotePlayer]];
        if (remoteTheme) {
            ctx.save();
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = remoteTheme.hex;
            ctx.fillStyle = remoteTheme.fill;
            const w = remoteHoverState.width;
            const h = remoteHoverState.height;
            ctx.fillRect(remoteHoverState.col * gridCellSize + 2, remoteHoverState.row * gridCellSize + 2, w * gridCellSize - 4, h * gridCellSize - 4);
            ctx.strokeRect(remoteHoverState.col * gridCellSize + 2, remoteHoverState.row * gridCellSize + 2, w * gridCellSize - 4, h * gridCellSize - 4);
            ctx.restore();
        }
    }
    
    // 7. Single cell preview in drawing mode
    if (isDrawingMode && hoverState.row !== -1 && hoverState.col !== -1) {
        ctx.save();
        ctx.lineWidth = 2;
        const activeTheme = state.colors[state.playerColors[state.activePlayer]];
        ctx.strokeStyle = state.activeSpecialMove === 'wall-drawing' ? "#ff6600" : (activeTheme ? activeTheme.hex : "#00f0ff");
        ctx.strokeRect(hoverState.col * gridCellSize + 2, hoverState.row * gridCellSize + 2, gridCellSize - 4, gridCellSize - 4);
        ctx.restore();
    }
}

function getCornerCoord(gridSize, pNum) {
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

function drawCornerIndicator(r, c, hex) {
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

export function startConfettiEffect(confettiCanvas, winnerColorHex = "#00f0ff") {
    if (!confettiCanvas) return;
    confettiCtx = confettiCanvas.getContext("2d");
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    
    confettiParticles = [];
    confettiActive = true;
    
    for (let i = 0; i < 110; i++) {
        confettiParticles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * confettiCanvas.height - confettiCanvas.height,
            size: Math.random() * 8 + 4,
            color: Math.random() > 0.5 ? winnerColorHex : "#ffffff",
            speedX: Math.random() * 4 - 2,
            speedY: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            spinSpeed: Math.random() * 2 - 1
        });
    }
    
    requestAnimationFrame(() => confettiLoop(confettiCanvas));
}

function confettiLoop(confettiCanvas) {
    if (!confettiActive || !confettiCtx) return;
    
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    
    for (let i = 0; i < confettiParticles.length; i++) {
        const p = confettiParticles[i];
        
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.spinSpeed;
        
        if (p.y > confettiCanvas.height) {
            p.y = -10;
            p.x = Math.random() * confettiCanvas.width;
        }
        
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate((p.rotation * Math.PI) / 180);
        
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        
        confettiCtx.restore();
    }
    
    requestAnimationFrame(() => confettiLoop(confettiCanvas));
}

export function stopConfettiEffect() {
    confettiActive = false;
}
