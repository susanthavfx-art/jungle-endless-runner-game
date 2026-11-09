import './style.css';
import { createIcons, Leaf, Trophy, VolumeX, Volume2, CircleHelp, Play, ArrowRight, ArrowLeft, ArrowUp, CirclePlay, Sparkles, Footprints, MoveHorizontal, MoveUp, Coins, Flag, Pause, RotateCcw, House, Route, X, Keyboard, Smartphone, Logs, Landmark, Waves, Skull } from 'lucide';
import { RunnerEngine, CONFIG } from './game/engine.js';
import { JungleWorld } from './game/world.js';
import { JungleAudio } from './game/audio.js';
import { bindInput } from './game/input.js';
import { readPreferences, writePreferences } from './game/storage.js';

const icons = { Leaf, Trophy, VolumeX, Volume2, CircleHelp, Play, ArrowRight, ArrowLeft, ArrowUp, CirclePlay, Sparkles, Footprints, MoveHorizontal, MoveUp, Coins, Flag, Pause, RotateCcw, House, Route, X, Keyboard, Smartphone, Logs, Landmark, Waves, Skull };
const refreshIcons = () => createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
refreshIcons();
const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const engine = new RunnerEngine(20261108);
const preferences = readPreferences();
const audio = new JungleAudio(preferences.sound);
let world;
let accumulator = 0;
let lastTime = 0;
let toastTimer;
let lastMilestone = 0;
let lastHud = '';
let initialized = false;

function setState(state) {
  app.dataset.state = state;
  $('#home-screen').hidden = state !== 'ready';
  $('#game-hud').hidden = state === 'ready' || state === 'loading';
  $('#pause-screen').hidden = state !== 'paused';
  $('#gameover-screen').hidden = state !== 'over';
  $('#loading-screen').hidden = state !== 'loading';
}

function announce(message) { $('#announcer').textContent = message; }
function toast(message, coins = false, duration = 1900) {
  clearTimeout(toastTimer);
  const element = $('#game-toast');
  element.textContent = message;
  element.classList.toggle('coin-toast', coins);
  element.classList.add('visible');
  toastTimer = setTimeout(() => element.classList.remove('visible'), duration);
}

function updateHud(force = false) {
  const key = `${engine.score}:${engine.coins}:${Math.floor(engine.distance)}`;
  if (!force && key === lastHud) return;
  lastHud = key;
  $('#score-value').textContent = String(engine.score).padStart(6, '0');
  $('#coin-value').textContent = engine.coins;
  $('#distance-value').textContent = `${Math.floor(engine.distance)} m`;
}

function updateSoundButtons() {
  document.querySelectorAll('.sound-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(audio.enabled));
    button.setAttribute('aria-label', audio.enabled ? 'Turn sound off' : 'Turn sound on');
    button.innerHTML = `<i data-lucide="${audio.enabled ? 'volume-2' : 'volume-x'}"></i>`;
  });
  refreshIcons();
}

function startRun() {
  if (!initialized) return;
  audio.unlock();
  engine.start();
  world.clearEntities();
  world.setMode('run');
  accumulator = 0;
  lastMilestone = 0;
  setState('running');
  updateHud(true);
  audio.start();
  toast('Follow the coins. You’ve got this!', false, 2400);
  announce('Run started. Use left and right to switch lanes. Up or Space to jump.');
  document.activeElement?.blur();
}

function pauseGame() {
  if (engine.state !== 'running') return;
  engine.pause();
  accumulator = 0;
  setState('paused');
  $('#resume-button').focus({ preventScroll: true });
  announce('Game paused.');
}

function resumeRun() {
  if (engine.state !== 'paused') return;
  audio.unlock();
  engine.resume();
  accumulator = 0;
  setState('running');
  document.activeElement?.blur();
  announce('Run resumed.');
}

function goHome() {
  engine.reset('ready');
  world.clearEntities();
  world.setMode('home');
  accumulator = 0;
  clearTimeout(toastTimer);
  $('#game-toast').classList.remove('visible');
  $('#home-best').textContent = preferences.best.toLocaleString();
  setState('ready');
  $('#start-button').focus({ preventScroll: true });
}

function finishRun(obstacle) {
  accumulator = 0;
  const isBest = engine.score > preferences.best;
  if (isBest) {
    preferences.best = engine.score;
    writePreferences(preferences);
  }
  $('#new-best').hidden = !isBest;
  $('#result-score').textContent = engine.score.toLocaleString();
  $('#result-coins').textContent = engine.coins;
  $('#result-distance').textContent = `${Math.floor(engine.distance)} m`;
  $('#result-best').textContent = preferences.best.toLocaleString();
  const messages = {
    ruins: 'Those ruins are too tall to jump. Try a clear lane!',
    rock: 'That rock came up fast. Jump a little earlier!',
    crocodile: 'Snap! A crocodile caught you. Jump over it or switch lanes.',
    gap: 'The bridge gave way beneath you. Jump the broken span or take a safe lane!',
  };
  $('#result-message').textContent = messages[obstacle] || 'A fallen log caught you. Time your next jump!';
  setState('over');
  $('#retry-button').focus({ preventScroll: true });
  announce(`Run finished. Score ${engine.score}, ${engine.coins} coins, ${Math.floor(engine.distance)} metres.${isBest ? ' New personal best!' : ''}`);
}

function processEvents() {
  for (const event of engine.drainEvents()) {
    if (event.type === 'coin') {
      audio.coin();
      world.burst(event.lane, event.at, event.height, engine.distance);
      const counter = $('#coin-value');
      counter.classList.remove('coin-pop');
      void counter.offsetWidth;
      counter.classList.add('coin-pop');
      if (engine.coins % 10 === 0) toast(`${engine.coins} coins! Keep the gold coming.`, true);
    } else if (event.type === 'jump') audio.jump();
    else if (event.type === 'move') audio.move();
    else if (event.type === 'hit') { audio.hit(); finishRun(event.obstacle); }
  }
}

function frame(time) {
  const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
  lastTime = time;
  if (engine.state === 'running') {
    accumulator += dt;
    while (accumulator >= CONFIG.fixedStep && engine.state === 'running') {
      engine.step(CONFIG.fixedStep);
      accumulator -= CONFIG.fixedStep;
    }
    processEvents();
    updateHud();
    const milestone = Math.floor(engine.distance / 100);
    if (milestone > lastMilestone && engine.state === 'running') {
      lastMilestone = milestone;
      toast(`${milestone * 100} m — into the wild!`);
    }
  }
  world.update(dt, engine);
  requestAnimationFrame(frame);
}

$('#start-button').addEventListener('click', startRun);
$('#retry-button').addEventListener('click', startRun);
$('#pause-restart-button').addEventListener('click', startRun);
$('#pause-button').addEventListener('click', pauseGame);
$('#resume-button').addEventListener('click', resumeRun);
$('#pause-home-button').addEventListener('click', goHome);
$('#result-home-button').addEventListener('click', goHome);
document.querySelectorAll('.sound-toggle').forEach((button) => button.addEventListener('click', () => {
  audio.setEnabled(!audio.enabled);
  preferences.sound = audio.enabled;
  writePreferences(preferences);
  updateSoundButtons();
  if (audio.enabled) audio.coin();
}));
const help = $('#help-dialog');
document.querySelectorAll('.help-button').forEach((button) => button.addEventListener('click', () => help.showModal()));
$('#close-help-button').addEventListener('click', () => help.close());
$('#got-it-button').addEventListener('click', () => help.close());
help.addEventListener('click', (event) => {
  const rect = help.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) help.close();
});
$('#reload-button').addEventListener('click', () => location.reload());
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', () => { if (!help.open) pauseGame(); });
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || help.open || !['paused', 'over'].includes(engine.state)) return;
  const layer = engine.state === 'paused' ? $('#pause-screen') : $('#gameover-screen');
  const buttons = [...layer.querySelectorAll('button')];
  const first = buttons[0], last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

bindInput({
  surface: $('#world'),
  left: () => engine.move(-1),
  right: () => engine.move(1),
  jump: () => engine.jump(),
  pause: pauseGame,
  action: () => engine.state,
  pauseToggle: () => engine.state === 'running' ? pauseGame() : engine.state === 'paused' ? resumeRun() : undefined,
});
updateSoundButtons();
$('#home-best').textContent = preferences.best.toLocaleString();

async function init() {
  try {
    world = new JungleWorld($('#world'), (percent, message) => {
      $('#loading-progress').style.width = `${percent}%`;
      $('#loading-message').textContent = message;
    });
    await world.loadRunner();
    initialized = true;
    setState('ready');
    world.update(0.016, engine);
    requestAnimationFrame(frame);
    if (import.meta.env.DEV) window.__jungle = { engine, world, startRun, pauseGame, resumeRun, goHome, preferences };
  } catch (error) {
    console.error('Jungle Run could not initialize:', error);
    setState('loading');
    $('#loading-message').textContent = 'The 3D trail couldn’t load. Please use a browser with WebGL enabled, then try again.';
    $('#reload-button').hidden = false;
    $('#loading-progress').style.width = '0%';
  }
}
init();
