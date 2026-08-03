'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const LS_HIGHSCORES = 'tetris.highscores';
const LS_STATS = 'tetris.stats';
const LS_START_LEVEL = 'tetris.startLevel';
const LS_THEME = 'tetris.theme';
const MAX_HIGHSCORES = 5;
const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 15;

const PASTEL_COLORS = [
  null,
  '#a7d8de', // I
  '#fde9a8', // O
  '#d9b3e6', // T
  '#b8e0bb', // S
  '#f2b3b3', // Z
  '#b7c0ea', // J
  '#f6cfa0', // L
];

const THEME_ORDER = ['retro', 'neon', 'pastel', 'pixel'];
const THEMES = {
  retro: {
    label: 'Retro', bg: '#1a1a25', gridColor: '#22222e', bodyBg: '#0f0f17',
    accent: '#7aa2f7', colors: COLORS, radius: 0, glow: false, pattern: false,
  },
  neon: {
    label: 'Neon', bg: '#000000', gridColor: '#0d1a10', bodyBg: '#000000',
    accent: '#39ff14', colors: COLORS, radius: 0, glow: true, pattern: false,
  },
  pastel: {
    label: 'Pastel', bg: '#f3ecff', gridColor: 'rgba(80,60,100,0.15)', bodyBg: '#26243a',
    accent: '#d9b3e6', colors: PASTEL_COLORS, radius: 6, glow: false, pattern: false,
  },
  pixel: {
    label: 'Pixel art', bg: '#1a1a25', gridColor: '#22222e', bodyBg: '#0f0f17',
    accent: '#ffb74d', colors: COLORS, radius: 0, glow: false, pattern: true,
  },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');

const overlay = document.getElementById('overlay');
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const controlsScreen = document.getElementById('controls-screen');
const gameoverScreen = document.getElementById('gameover-screen');

const playBtn = document.getElementById('play-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const startHighscoresEl = document.getElementById('start-highscores');
const startStatsEl = document.getElementById('start-stats');

const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelDecBtn = document.getElementById('level-dec');
const levelIncBtn = document.getElementById('level-inc');
const startLevelValueEl = document.getElementById('start-level-value');
const themePrevBtn = document.getElementById('theme-prev');
const themeNextBtn = document.getElementById('theme-next');
const themeValueEl = document.getElementById('theme-value');

const overlayScoreEl = document.getElementById('overlay-score');
const overlayStatsEl = document.getElementById('overlay-stats');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const gameoverHighscoresEl = document.getElementById('gameover-highscores');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let started, pauseView, combo, maxCombo, startLevel, highScores, stats, themeName;
let currentTheme = THEMES.retro;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawRoundedRect(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = currentTheme.colors[colorIndex] || COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;

  context.save();
  context.globalAlpha = alpha ?? 1;

  if (currentTheme.glow) {
    context.shadowColor = color;
    context.shadowBlur = size * 0.6;
  }

  context.fillStyle = color;
  if (currentTheme.radius) {
    drawRoundedRect(context, px, py, s, s, currentTheme.radius);
    context.fill();
  } else {
    context.fillRect(px, py, s, s);
  }
  context.shadowBlur = 0;

  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  if (currentTheme.radius) {
    drawRoundedRect(context, px, py, s, Math.max(4, s * 0.25), currentTheme.radius);
    context.fill();
  } else {
    context.fillRect(px, py, s, 4);
  }

  if (currentTheme.pattern) {
    context.fillStyle = 'rgba(0,0,0,0.18)';
    const step = Math.max(4, Math.floor(size / 5));
    for (let ry = 0; ry < s; ry += step) {
      const rowEven = Math.floor(ry / step) % 2 === 0;
      for (let rx = rowEven ? 0 : step; rx < s; rx += step * 2) {
        context.fillRect(px + rx, py + ry, step, step);
      }
    }
  }

  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = currentTheme.gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = currentTheme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = currentTheme.bg;
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updateStats(maxCombo, lines);

  const qualifies = highScores.length < MAX_HIGHSCORES || score > highScores[highScores.length - 1].score;
  overlayScoreEl.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayStatsEl.textContent = `Combo máx: ${maxCombo} · Líneas: ${lines}`;

  if (qualifies) {
    nameEntry.classList.remove('hidden');
    nameInput.value = '';
  } else {
    nameEntry.classList.add('hidden');
  }
  renderHighScores(gameoverHighscoresEl, null);
  showOverlayScreen(gameoverScreen);
  if (qualifies) nameInput.focus();
}

function showOverlayScreen(screenEl) {
  overlay.classList.remove('hidden');
  [pauseScreen, controlsScreen, gameoverScreen].forEach(s => s.classList.add('hidden'));
  screenEl.classList.remove('hidden');
}

function hideAllScreens() {
  [pauseScreen, controlsScreen, gameoverScreen].forEach(s => s.classList.add('hidden'));
}

function openPauseMenu() {
  paused = true;
  cancelAnimationFrame(animId);
  pauseView = 'menu';
  startLevelValueEl.textContent = String(startLevel);
  themeValueEl.textContent = currentTheme.label;
  showOverlayScreen(pauseScreen);
}

function showControls() {
  pauseView = 'controls';
  showOverlayScreen(controlsScreen);
}

function backToPauseMenu() {
  pauseView = 'menu';
  showOverlayScreen(pauseScreen);
}

function resumeGame() {
  paused = false;
  overlay.classList.add('hidden');
  hideAllScreens();
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (gameOver || !started) return;
  if (!paused) {
    openPauseMenu();
  } else if (pauseView === 'controls') {
    backToPauseMenu();
  } else {
    resumeGame();
  }
}

function setStartLevel(v) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, v));
  startLevelValueEl.textContent = String(startLevel);
  localStorage.setItem(LS_START_LEVEL, String(startLevel));
}

function applyTheme(name) {
  currentTheme = THEMES[name] || THEMES.retro;
  themeName = THEMES[name] ? name : 'retro';
  document.documentElement.style.setProperty('--accent', currentTheme.accent);
  document.documentElement.style.setProperty('--body-bg', currentTheme.bodyBg);
  themeValueEl.textContent = currentTheme.label;
  localStorage.setItem(LS_THEME, themeName);
}

function cycleTheme(dir) {
  const idx = THEME_ORDER.indexOf(themeName);
  const nextIdx = (idx + dir + THEME_ORDER.length) % THEME_ORDER.length;
  applyTheme(THEME_ORDER[nextIdx]);
  if (next) drawNext();
}

function loadHighScores() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_HIGHSCORES));
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HIGHSCORES) : [];
  } catch {
    return [];
  }
}

function loadStats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_STATS));
    if (parsed && typeof parsed.bestCombo === 'number' && typeof parsed.maxLines === 'number') {
      return parsed;
    }
  } catch {
    // fall through to default
  }
  return { bestCombo: 0, maxLines: 0 };
}

function loadStartLevel() {
  const raw = parseInt(localStorage.getItem(LS_START_LEVEL), 10);
  if (Number.isNaN(raw)) return 1;
  return Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, raw));
}

function loadThemeName() {
  const raw = localStorage.getItem(LS_THEME);
  return THEME_ORDER.includes(raw) ? raw : 'retro';
}

function updateStats(comboThisGame, linesThisGame) {
  let changed = false;
  if (comboThisGame > stats.bestCombo) { stats.bestCombo = comboThisGame; changed = true; }
  if (linesThisGame > stats.maxLines) { stats.maxLines = linesThisGame; changed = true; }
  if (changed) localStorage.setItem(LS_STATS, JSON.stringify(stats));
}

function renderStats(el) {
  el.textContent = `Mejor combo: ${stats.bestCombo} · Líneas máx: ${stats.maxLines}`;
}

function renderHighScores(container, highlightEntry) {
  container.innerHTML = '';
  if (!highScores.length) {
    const li = document.createElement('li');
    li.textContent = 'Sin puntuaciones aún';
    li.className = 'highscore-empty';
    container.appendChild(li);
    return;
  }
  highScores.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.name} — ${entry.score.toLocaleString()} (Lv ${entry.level})`;
    if (entry === highlightEntry) li.classList.add('highscore-current');
    container.appendChild(li);
  });
}

function saveScore() {
  const name = nameInput.value.trim().slice(0, 10) || 'JUGADOR';
  const entry = { name, score, lines, level };
  highScores = [...highScores, entry].sort((a, b) => b.score - a.score).slice(0, MAX_HIGHSCORES);
  localStorage.setItem(LS_HIGHSCORES, JSON.stringify(highScores));
  nameEntry.classList.add('hidden');
  renderHighScores(gameoverHighscoresEl, entry);
}

function resetRecords() {
  highScores = [];
  stats = { bestCombo: 0, maxLines: 0 };
  localStorage.removeItem(LS_HIGHSCORES);
  localStorage.removeItem(LS_STATS);
  renderHighScores(startHighscoresEl, null);
  renderStats(startStatsEl);
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function startGame() {
  started = true;
  startScreen.classList.add('hidden');
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hideAllScreens();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function boot() {
  started = false;
  highScores = loadHighScores();
  stats = loadStats();
  startLevel = loadStartLevel();
  applyTheme(loadThemeName());
  startLevelValueEl.textContent = String(startLevel);
  renderHighScores(startHighscoresEl, null);
  renderStats(startStatsEl);
  overlay.classList.add('hidden');
  startScreen.classList.remove('hidden');
}

document.addEventListener('keydown', e => {
  if (!started) {
    if (e.code === 'Enter') startGame();
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.stopPropagation();
    saveScore();
  }
});

playBtn.addEventListener('click', startGame);
resetScoresBtn.addEventListener('click', resetRecords);

resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', startGame);
controlsBtn.addEventListener('click', showControls);
controlsBackBtn.addEventListener('click', backToPauseMenu);
levelDecBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelIncBtn.addEventListener('click', () => setStartLevel(startLevel + 1));
themePrevBtn.addEventListener('click', () => cycleTheme(-1));
themeNextBtn.addEventListener('click', () => cycleTheme(1));

saveScoreBtn.addEventListener('click', saveScore);
restartBtn.addEventListener('click', startGame);

boot();
