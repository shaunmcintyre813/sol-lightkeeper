import { LEVELS, initialSides, rotate, trace, unlockedFromProgress } from './core.mjs?v=1.0.3';

const $ = (id) => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const board = $('board');
const mirrorLayer = $('mirrorLayer');
const modals = [$('introModal'), $('winModal'), $('levelsModal'), $('helpModal')];
const storageKey = 'sol-lightkeeper-progress-v1';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const remembered = readProgress();

let levelIndex = Math.min(Math.max(Number(remembered.current) || 0, 0), LEVELS.length - 1);
let completed = Array.isArray(remembered.completed) ? remembered.completed.slice(0, LEVELS.length).map(Boolean) : [];
let unlocked = unlockedFromProgress(completed, remembered.unlocked);
let sides = Array.isArray(remembered.sides) && remembered.sides.length === LEVELS[levelIndex].mirrors.length
  ? remembered.sides.map(v => v === 1 ? 1 : 0) : initialSides(LEVELS[levelIndex]);
let ray = trace(LEVELS[levelIndex], sides);
let beamStart = performance.now() - 5000;
let winTimer = null;
let celebrated = false;
let soundEnabled = remembered.sound !== false;
let audioContext = null;
let deferredInstall = null;
let frameAt = 0;
let cssSize = 0;

function readProgress() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; }
  catch { return {}; }
}
function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify({ current: levelIndex, unlocked, completed, sides, sound: soundEnabled, visited: true })); }
  catch { /* The game still plays when storage is unavailable. */ }
}
function showModal(element) {
  modals.forEach(modal => modal.classList.toggle('hidden', modal !== element));
  requestAnimationFrame(() => element.querySelector('button')?.focus());
}
function hideModal(element) { element.classList.add('hidden'); }
function playTone(kind = 'turn') {
  if (!soundEnabled) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const notes = kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'hint' ? [392, 523.25] : [523.25];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = now + index * (kind === 'win' ? .12 : .08);
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(kind === 'win' ? .035 : .022, at + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, at + .3);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(at); oscillator.stop(at + .31);
    });
  } catch { /* Sound is optional. */ }
}
function haptic() { try { navigator.vibrate?.(8); } catch { /* Optional. */ } }

function updateHeader() {
  const level = LEVELS[levelIndex];
  $('chapterCount').textContent = `GARDEN ${String(levelIndex + 1).padStart(2, '0')} / ${LEVELS.length}`;
  $('chapterName').textContent = level.name;
  $('chapterLine').textContent = level.line;
  $('instruction').textContent = level.prisms.length
    ? 'Tap mirrors to turn them. Prisms split the beam in two.'
    : 'Tap a mirror to turn it. Wake every sleeping flower.';
  $('soundButton').textContent = soundEnabled ? '♫' : '♪̸';
  $('soundButton').classList.toggle('active', soundEnabled);
  $('soundButton').setAttribute('aria-label', soundEnabled ? 'Turn sound off' : 'Turn sound on');
  $('progress').innerHTML = LEVELS.map((_, index) => `<span class="progress-dot ${completed[index] ? 'done' : ''} ${index === levelIndex ? 'current' : ''}" aria-hidden="true"></span>`).join('');
  $('progress').setAttribute('aria-label', `${completed.filter(Boolean).length} of ${LEVELS.length} gardens awakened`);
  mirrorLayer.replaceChildren();
  level.mirrors.forEach(([x, y], index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'mirror-hit';
    button.style.left = `${(x + .5) / level.size * 100}%`;
    button.style.top = `${(y + .5) / level.size * 100}%`;
    button.setAttribute('aria-label', `Turn mirror ${index + 1} of ${level.mirrors.length}`);
    button.addEventListener('click', () => turnMirror(index));
    mirrorLayer.append(button);
  });
}

function updateRay() {
  ray = trace(LEVELS[levelIndex], sides);
  beamStart = performance.now();
  saveProgress();
  clearTimeout(winTimer);
  if (ray.won && !celebrated) {
    winTimer = setTimeout(() => {
      if (!ray.won || celebrated) return;
      celebrated = true;
      completed[levelIndex] = true;
      unlocked = Math.max(unlocked, Math.min(levelIndex + 1, LEVELS.length - 1));
      saveProgress(); updateHeader(); playTone('win'); haptic();
      const last = levelIndex === LEVELS.length - 1;
      $('winEyebrow').textContent = last ? 'THE WHOLE WORLD IS AWAKE' : 'GARDEN AWAKENED';
      $('winTitle').textContent = last ? 'The light found its way home.' : 'The light found its way.';
      $('winText').textContent = last ? 'Every little garden is glowing. Wander back whenever you like.' : 'A new little corner of the world is glowing.';
      $('nextButton').firstChild.textContent = last ? 'Visit the first garden ' : 'Next garden ';
      showModal($('winModal'));
    }, reduceMotion.matches ? 300 : Math.min(1600, ray.segments.length * 45 + 280));
  }
}
function turnMirror(index) {
  sides = rotate(sides, index);
  if (!ray.won) celebrated = false;
  updateRay(); playTone(); haptic();
}
function loadLevel(index, useSaved = false) {
  if (index < 0 || index > unlocked) return;
  clearTimeout(winTimer);
  levelIndex = index;
  sides = useSaved ? sides : initialSides(LEVELS[index]);
  celebrated = false;
  ray = trace(LEVELS[index], sides);
  beamStart = performance.now() - 5000;
  saveProgress(); updateHeader();
}
function resetLevel() {
  sides = initialSides(LEVELS[levelIndex]);
  celebrated = false;
  updateRay(); playTone();
}
function nudge() {
  const index = LEVELS[levelIndex].mirrors.findIndex((mirror, i) => sides[i] !== mirror[2]);
  if (index < 0) { $('instruction').textContent = 'Every mirror is facing the right way. Follow the light!'; return; }
  sides = rotate(sides, index);
  celebrated = false;
  updateRay(); playTone('hint'); haptic();
  mirrorLayer.children[index]?.focus();
}
function openLevels() {
  $('levelList').replaceChildren();
  LEVELS.forEach((level, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `level-item ${index === levelIndex ? 'selected' : ''}`;
    button.disabled = index > unlocked;
    const number = document.createElement('span'); number.className = 'level-number'; number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span');
    const strong = document.createElement('strong'); strong.textContent = level.name;
    const small = document.createElement('small'); small.textContent = index > unlocked ? 'Sleeping' : completed[index] ? 'Awake' : 'Ready to explore';
    label.append(strong, small);
    const check = document.createElement('span'); check.className = 'level-check'; check.textContent = completed[index] ? '✺' : index > unlocked ? '○' : '→';
    button.append(number, label, check);
    button.addEventListener('click', () => { loadLevel(index, index === levelIndex); hideModal($('levelsModal')); });
    $('levelList').append(button);
  });
  showModal($('levelsModal'));
}

function resizeCanvas() {
  const rect = board.getBoundingClientRect();
  cssSize = Math.max(1, rect.width);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw(performance.now());
}
function rounded(x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function flower(x, y, cell, lit, now) {
  const px = (x + .5) * cell, py = (y + .5) * cell;
  ctx.save(); ctx.translate(px, py);
  if (lit) {
    const pulse = reduceMotion.matches ? 1 : 1 + Math.sin(now / 480 + x + y) * .04;
    ctx.scale(pulse, pulse); ctx.shadowColor = '#ffca7e'; ctx.shadowBlur = cell * .5;
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 3);
      ctx.fillStyle = i % 2 ? '#f7a78f' : '#ffcf9b';
      ctx.beginPath(); ctx.ellipse(0, -cell * .16, cell * .095, cell * .17, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffe9a9'; ctx.beginPath(); ctx.arc(0, 0, cell * .105, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#a27c84'; ctx.strokeStyle = '#d6a9a2'; ctx.lineWidth = Math.max(1, cell * .025);
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 2);
      ctx.beginPath(); ctx.ellipse(0, -cell * .095, cell * .065, cell * .13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#e6bdab'; ctx.beginPath(); ctx.arc(0, 0, cell * .07, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function draw(now) {
  const level = LEVELS[levelIndex];
  const size = cssSize, cell = size / level.size;
  if (!size) return;
  ctx.clearRect(0, 0, size, size);
  const ground = ctx.createRadialGradient(size * .5, size * .4, size * .03, size * .5, size * .5, size * .78);
  ground.addColorStop(0, '#294847'); ground.addColorStop(.56, '#1b3942'); ground.addColorStop(1, '#112837');
  ctx.fillStyle = ground; ctx.fillRect(0, 0, size, size);
  // Contour rings and flecks give the board a tiny, hand-drawn landscape.
  ctx.save(); ctx.strokeStyle = 'rgba(189,218,187,.065)'; ctx.lineWidth = cell * .018;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(size * .42, size * .56, cell * (2.1 + i * .45), cell * (1.2 + i * .35), -.27, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 46; i++) {
    const x = ((i * 73 + 17) % 101) / 101 * size, y = ((i * 41 + 53) % 103) / 103 * size;
    ctx.fillStyle = i % 4 === 0 ? 'rgba(248,213,147,.28)' : 'rgba(200,225,205,.15)';
    ctx.beginPath(); ctx.arc(x, y, i % 5 === 0 ? 1.4 : .8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(215,222,198,.075)'; ctx.lineWidth = 1;
  for (let i = 1; i < level.size; i++) { const at = i * cell; ctx.beginPath(); ctx.moveTo(at, 0); ctx.lineTo(at, size); ctx.moveTo(0, at); ctx.lineTo(size, at); ctx.stroke(); }
  level.rocks.forEach(([x, y], i) => {
    const px = (x + .5) * cell, py = (y + .5) * cell;
    ctx.save(); ctx.translate(px, py); ctx.rotate(i * .8); ctx.fillStyle = '#3b5357'; ctx.strokeStyle = '#667872'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-cell * .22, cell * .08); ctx.lineTo(-cell * .12, -cell * .21); ctx.lineTo(cell * .13, -cell * .19); ctx.lineTo(cell * .24, cell * .13); ctx.lineTo(cell * .03, cell * .24); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-cell * .1, -cell * .12); ctx.lineTo(cell * .07, -cell * .14); ctx.strokeStyle = 'rgba(197,216,194,.35)'; ctx.stroke(); ctx.restore();
  });

  const elapsed = now - beamStart;
  const visible = reduceMotion.matches ? ray.segments.length : Math.min(ray.segments.length, Math.max(0, elapsed / 44));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ray.segments.forEach((segment, i) => {
    if (i >= visible) return;
    const fraction = Math.min(1, visible - i);
    const x1 = (segment.x1 + .5) * cell, y1 = (segment.y1 + .5) * cell;
    const x2 = (segment.x1 + (segment.x2 - segment.x1) * fraction + .5) * cell;
    const y2 = (segment.y1 + (segment.y2 - segment.y1) * fraction + .5) * cell;
    ctx.save(); ctx.shadowColor = '#ffd787'; ctx.shadowBlur = cell * .3;
    ctx.strokeStyle = segment.depth ? 'rgba(255,211,139,.72)' : 'rgba(255,221,153,.8)'; ctx.lineWidth = cell * .15;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = segment.fade ? 'rgba(255,244,196,.35)' : '#fff2c5'; ctx.lineWidth = cell * .045;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  });

  level.prisms.forEach(([x, y]) => {
    const px = (x + .5) * cell, py = (y + .5) * cell;
    ctx.save(); ctx.translate(px, py); ctx.shadowColor = '#9fded7'; ctx.shadowBlur = cell * .22;
    ctx.fillStyle = '#1d5961'; ctx.strokeStyle = '#b9ebe2'; ctx.lineWidth = Math.max(1.5, cell * .04);
    ctx.beginPath(); ctx.moveTo(0, -cell * .29); ctx.lineTo(cell * .27, 0); ctx.lineTo(0, cell * .29); ctx.lineTo(-cell * .27, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.beginPath(); ctx.moveTo(-cell * .27, 0); ctx.lineTo(cell * .27, 0); ctx.moveTo(0, -cell * .29); ctx.lineTo(0, cell * .29); ctx.strokeStyle = 'rgba(225,255,246,.5)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  });
  level.flowers.forEach(([x, y]) => {
    const hitIndex = ray.segments.findIndex(s => s.x2 === x && s.y2 === y);
    flower(x, y, cell, ray.reached.has(`${x},${y}`) && hitIndex < visible, now);
  });
  level.mirrors.forEach(([x, y], index) => {
    const px = (x + .5) * cell, py = (y + .5) * cell;
    ctx.save(); ctx.translate(px, py);
    ctx.fillStyle = 'rgba(9,30,41,.91)'; ctx.strokeStyle = 'rgba(247,210,147,.56)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, cell * .32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowColor = '#fff1ce'; ctx.shadowBlur = cell * .14; ctx.strokeStyle = '#fff0cf'; ctx.lineWidth = cell * .07;
    ctx.beginPath(); const sign = sides[index] === 0 ? -1 : 1;
    ctx.moveTo(-cell * .18, -cell * .18 * sign); ctx.lineTo(cell * .18, cell * .18 * sign); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = '#f9c57d';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * cell * .2, side * cell * .2 * sign, cell * .025, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
  const [sx, sy, sd] = level.source;
  ctx.save(); ctx.translate((sx + .5) * cell, (sy + .5) * cell);
  ctx.shadowColor = '#ffc971'; ctx.shadowBlur = cell * .42;
  const sun = ctx.createRadialGradient(-cell * .05, -cell * .08, 0, 0, 0, cell * .3);
  sun.addColorStop(0, '#fff6cc'); sun.addColorStop(.6, '#ffcd7d'); sun.addColorStop(1, '#e18d57');
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(0, 0, cell * .23, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.strokeStyle = '#ffe2a3'; ctx.lineWidth = cell * .025;
  for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4 + now / 20000; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * cell * .29, Math.sin(angle) * cell * .29); ctx.lineTo(Math.cos(angle) * cell * .37, Math.sin(angle) * cell * .37); ctx.stroke(); }
  ctx.rotate(sd * Math.PI / 2); ctx.fillStyle = '#71523d'; ctx.beginPath(); ctx.moveTo(cell * .12, 0); ctx.lineTo(0, -cell * .065); ctx.lineTo(0, cell * .065); ctx.fill(); ctx.restore();
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * .32, size / 2, size / 2, size * .73);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(2,13,25,.45)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, size, size);
}
function animate(now) {
  if (now - frameAt > 30 && !document.hidden) { draw(now); frameAt = now; }
  requestAnimationFrame(animate);
}

canvas.addEventListener('pointerdown', event => {
  const rect = canvas.getBoundingClientRect();
  const cell = rect.width / LEVELS[levelIndex].size;
  const x = (event.clientX - rect.left) / cell - .5;
  const y = (event.clientY - rect.top) / cell - .5;
  let nearest = -1, distance = .69;
  LEVELS[levelIndex].mirrors.forEach(([mx, my], index) => {
    const d = Math.hypot(mx - x, my - y);
    if (d < distance) { nearest = index; distance = d; }
  });
  if (nearest >= 0) { event.preventDefault(); turnMirror(nearest); }
});
$('soundButton').addEventListener('click', () => { soundEnabled = !soundEnabled; saveProgress(); updateHeader(); if (soundEnabled) playTone(); });
$('helpButton').addEventListener('click', () => showModal($('helpModal')));
$('closeHelp').addEventListener('click', () => hideModal($('helpModal')));
$('gotItButton').addEventListener('click', () => hideModal($('helpModal')));
$('levelsButton').addEventListener('click', openLevels);
$('closeLevels').addEventListener('click', () => hideModal($('levelsModal')));
$('resetButton').addEventListener('click', resetLevel);
$('hintButton').addEventListener('click', nudge);
$('startButton').addEventListener('click', () => { hideModal($('introModal')); saveProgress(); playTone(); });
$('nextButton').addEventListener('click', () => { hideModal($('winModal')); loadLevel(levelIndex === LEVELS.length - 1 ? 0 : levelIndex + 1); });
$('stayButton').addEventListener('click', () => hideModal($('winModal')));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const open = modals.find(modal => !modal.classList.contains('hidden'));
    if (open && open !== $('introModal')) hideModal(open);
  }
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); deferredInstall = event; $('installButton').classList.remove('hidden');
});
$('installButton').addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt(); await deferredInstall.userChoice;
  deferredInstall = null; $('installButton').classList.add('hidden');
});
window.addEventListener('appinstalled', () => { deferredInstall = null; $('installButton').classList.add('hidden'); });
const bundledAndroid = location.hostname === 'appassets.androidplatform.net';
if (bundledAndroid) $('installText').closest('.install-note').classList.add('hidden');
else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) $('installText').textContent = 'In Safari, tap Share, then “Add to Home Screen.” Open it once online and it will work offline afterward.';
else if (/Android/.test(navigator.userAgent)) $('installText').textContent = 'In Chrome, tap the menu (⋮), then “Add to Home screen” or “Install app.” If Install says it is already installed but no icon appears, choose “Create shortcut.”';

new ResizeObserver(resizeCanvas).observe(board);
updateHeader(); resizeCanvas(); requestAnimationFrame(animate);
if (!remembered.visited) showModal($('introModal'));
// The Android shell keeps this exact origin, so the existing progress key and
// every saved field survive the one-time APK upgrade without a storage move.
window.SolAndroid?.ready?.();
if (!bundledAndroid && 'serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
