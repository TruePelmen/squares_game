# SQUARES (Territory capture duel) - Comprehensive Project Summary

This document provides a highly detailed, comprehensive architectural and feature summary of the developed digital version of the paper-and-pencil strategic board game **Squares** (also known as *Territory*). It describes the game rules, advanced mechanics, premium quality-of-life additions, aesthetic updates, and the precise bug fixes implemented to deliver a flawless, high-end strategic pass-and-play experience.

---

## 🎮 Game Architecture & Core Mechanics

The game is built as a highly responsive, premium-grade single-page application using a modern and visually striking **Dark Cosmic** aesthetic. The technology stack consists of raw **HTML5 Semantic Structure**, **Vanilla CSS** with advanced flex/grid layouts and HSL color design systems, and a **Vanilla JavaScript** game engine driving a custom high-performance HTML5 Canvas rendering loop.

### 1. Board Grid Representation
- **Grid Configuration:** Configurable grid sizes of **15x15**, **20x20**, or **30x30** cells, selectable on the launch screen.
- **Board Matrix:** Represented inside the Javascript engine as a 2D array `state.board[row][col]`, with values representing cell occupancy:
  - `0` = Empty space (rendered as deep space black with sub-grid borders).
  - `1` = Cyber Blue / Emerald / Gold player-captured cells (with harmonized glowing borders and light translucent fills).
  - `2` = Neon Pink / Purple / Orange player-captured cells.
  - `3` = Solid Carbon Gray mechanical obstacle walls (rendered with neon orange hazard warning stripes).

### 2. Standard Placement Rules
- **First Placement:**
  - **Player 1** starts strictly at the top-left corner `(0, 0)`.
  - **Player 2** starts strictly at the bottom-right corner `(N-1, N-1)`.
- **Subsequent Placements:**
  - Placed blocks must connect strictly along at least **one flat side/edge** of that player's existing captured cells.
  - Diagonal-only corner touching is **strictly forbidden**.
  - Blocks cannot overlap any existing cells (captured by either player or containing gray obstacle walls) under standard rules.
- **Block Rotation:**
  - Pending blocks can be rotated (swapping width and height) by pressing the **Spacebar**, clicking the sidebar **Rotate Shape** button, or **Right-Clicking** anywhere inside the grid canvas.

---

## ⚡ Advanced Doubles Rules (Togglable Feature)

When **Advanced Rules** are enabled, rolling matching values on both dice (Doubles) triggers specialized high-tier strategic abilities:

| Double Roll | Special Ability | Footprint | Next-Turn Multiplier | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Double 1s** | **Cosmic Seed** | $1 \times 1$ | None | Bypasses all adjacency rules; can be placed **anywhere** on empty grid cells. |
| **Double 2s** | **Growth Spurt** | $2 \times 2$ | **x2 Size** | Places a $2\times2$ block. Your rolled coordinates on your next turn will be doubled. Triggers a glowing green scorecard badge. |
| **Double 3s** | **Shrink Wave** | $3 \times 3$ | **1/2 Size** | Places a $3\times3$ block. Your rolled coordinates on your next turn will be halved (floor-divided, clamped to min size 1). Triggers a glowing orange scorecard badge. |
| **Double 4s** | **The Great Wall** | Choice | None | Triggers a modal popup giving a choice: place a standard $4\times4$ block OR draw a contiguous Wall of exactly 4 carbon-gray obstacle blocks anywhere. |
| **Double 5s** | **Tectonic Breach** | $5 \times 5$ | None | **Automated Action:** The block is automatically granted **Unrestricted Overwriting**! Clicking it automatically breaches and converts *any* covered opponent cells into your own territory. |
| **Double 6s** | **Architect's Freedom** | Draw 36 | None | Enters Free Shape Drawing Mode. The player clicks exactly 36 connected empty cells. The first cell must touch their territory; subsequent cells must touch the drawn draft. |

---

## 🛡️ Special Catch-Up: Cosmic Comeback

To prevent players from being early-eliminated or locked out due to grid blockades:
- **Trigger:** If a player is forced to skip/pass their turn **2 consecutive times** because they have zero valid moves on the board.
- **Reward:** On their very next turn, the dice roll stage is completely bypassed, and they are automatically awarded a **1x1 Cosmic Seed** (which can be planted anywhere on the board).
- **Aesthetic Cue:** Triggers an uplifting major scale synthesized run to build player hope and confidence.

---

## 💎 Premium Quality-of-Life (QoL) & Aesthetic Polish

1. **Right-Click Grid Canvas Rotation:**
   - Players can simply right-click anywhere on the grid canvas to instantly rotate their pending shape.
   - Swaps width and height seamlessly. It prevents players from having to drag their mouse to the sidebar or press the Spacebar key, enabling a **100% mouse-driven gameplay workflow**.
2. **Retina Canvas Scaling:**
   - The grid rendering system automatically detects high-DPI screens and scales the canvas rendering using `devicePixelRatio`.
   - Prevents grid lines and text from looking blurry on modern laptops and mobile screens.
3. **Harmonized Badge Layout:**
   - Corrected scorecard container padding (`padding-top: 12px` on `.scores-container`) to accommodate active Growth/Shrink badges.
   - Prevents the absolute positioned badges from being clipped by scorecard container borders.
4. **Soft Audio Feedback:**
   - Softened standard error/invalid move buzzers by shifting from harsh square-waves to a gentle, low-pitched triangle-wave pitch sweep (`[150, 90]` Hz), producing a pleasant "thud" effect.
   - Created heavy clanks for Wall placements, high-pitched sweeps for Tectonic Breaches, and beautiful C-major arpeggios for victories.

---

## 🛠️ Complete History of Bug Fixes

Throughout the optimization and testing cycles, several bugs were caught and resolved:

### 1. Auto-Pass Blockade Hang for Double 2x2 and 3x3 Rolls (Newest Fix)
- **The Issue:** When a player rolled a Double 2x2 or Double 3x3, the game setup the buttons and visual state but **never checked** if the player actually had any valid spaces remaining on the board to place a 2x2 or 3x3 block. If they were completely blocked, the game would hang on their turn with no valid placements, never triggering the automatic turn pass.
- **The Fix:** Integrated `hasAnyValidMoves` checks inside both `case 2` and `case 3` in `handleDoubleRollSequence()`. Now, if a player rolls these doubles but is entirely blockaded, the game engine correctly detects this and automatically triggers the auto-pass sequence.

### 2. Multiplier-Doubles Mode Bypass
- **The Issue:** If a player rolled Double 6s while a **Growth Multiplier (x2)** was active, the engine multiplied the dimensions to a $12 \times 12$ block before checking for doubles. Because the doubles checker matched final dimensions (`12 === 12`) instead of physical dice faces (`6 === 6`), the game bypassed the custom 36-cell shape drawing mode and forced the placement of a rigid $12\times 12$ block.
- **The Fix:** Configured the doubles checking engine to track original face values (`originalD1` and `originalD2` before multiplier scaling is applied).
  - Double 6s now properly triggers the 36-cell Free Drawing Mode.
  - The Growth multiplier remains securely saved for the player's very next normal turn.

### 3. Doubles Modal Title DOM Reference Error
- **The Issue:** When rolling 4x4 or 5x5 doubles, the game crashed with a `TypeError` due to a typo in the `DOM` elements mapping (`doublesTitle` was mapped incorrectly in `app.js`).
- **The Fix:** Corrected the reference to match the ID of the title element (`#doubles-title`), resolving the crash.

### 4. Tectonic Breach Choice Removal & Unrestricted Overwriting
- **The Issue:** The Double 5x5 modal formerly asked players if they wanted a standard placement or a limited 3-cell overwrite. In tight board matches, this choice was redundant and did not allow a true breakout.
- **The Fix:** Removed the Double 5x5 modal entirely. The 5x5 Tectonic Overwrite is now **100% automated** and allows **unrestricted overwriting** of any covered opponent cells within its $5\times5$ footprint. This creates a powerful and dramatic breakthrough mechanic.
