# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris implemented in vanilla JavaScript with HTML5 Canvas. No build process, no package manager, no external dependencies — three files: `index.html`, `style.css`, `game.js`.

## Running the game

Open `index.html` directly in a browser, or serve it statically:

```bash
npx serve .
# or
python3 -m http.server 8000
```

There is no build, lint, or test step — there is no `package.json` in this repo.

## Architecture

Everything lives in `game.js` as top-level functions operating on module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.). There are no classes and no modules — this is intentional for the project's "vanilla, no framework" scope.

Key pieces, in the order data flows through them:

- **Board model**: `ROWS × COLS` matrix (`createBoard`). Each cell is `0` (empty) or `1–7` (a color index identifying which piece locked there).
- **Piece shapes** (`PIECES`): defined as square matrices. Rotation is computed on the fly via `rotateCW` (transpose + row reverse) — there are no pre-rotated states stored.
- **Collision** (`collide`): the single source of truth for "can a shape occupy position (ox, oy)". Every movement, rotation, and the ghost-piece projection all route through this function — modify it carefully since it's load-bearing for the whole game.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns until one doesn't collide, then commits.
- **Game loop** (`loop`): driven by `requestAnimationFrame`, accumulates elapsed time in `dropAccum` and advances the piece one row once `dropInterval` is exceeded, otherwise just redraws.
- **Line clearing** (`clearLines`): scans bottom-up; a full row is spliced out and an empty row unshifted at the top. Re-checks the same row index after a splice (`r++` inside the loop) since rows shift down.
- **Scoring/leveling**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 points/row dropped, soft drop adds 1 point/row. Level increases every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Ghost piece** (`ghostY`): simulates dropping the current piece to its resting row via repeated `collide` checks, drawn at `globalAlpha = 0.2`.
- **Rendering** (`draw`, `drawNext`, `drawBlock`, `drawGrid`): plain Canvas 2D calls, redrawn in full every frame — no dirty-rect optimization.

Control flow: `init()` builds a fresh board and state, spawns the first two pieces, and starts the RAF loop. `spawn()` promotes `next` into `current` and generates a new `next`; if the newly spawned piece immediately collides, `endGame()` fires. Keyboard input (`keydown` listener) is ignored while `paused` or `gameOver` are true, except `KeyP` which always toggles pause.

## Tunable constants

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, and the initial `dropInterval` are all defined at the top of `game.js`. If `COLS`, `ROWS`, or `BLOCK` change, the `<canvas id="board">` `width`/`height` in `index.html` must be updated to match (`COLS × BLOCK` and `ROWS × BLOCK`).
