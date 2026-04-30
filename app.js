/* ===========================
FOCOVIVO - script.js
Lógica: tarefas, foco, timer,
áreas, perfil, localStorage
=========================== */

'use strict';

// ============================
// ESTADO GLOBAL
// ============================
const AREAS_CONFIG = [
{ key: 'Estudos',  emoji: '📚' },
{ key: 'Trabalho', emoji: '💼' },
{ key: 'Saúde',    emoji: '🏃' },
{ key: 'Casa',     emoji: '🏠' },
{ key: 'Finanças', emoji: '💰' },
{ key: 'Projetos', emoji: '🚀' },
{ key: 'Família',  emoji: '❤️' },
{ key: 'Ideias',   emoji: '💡' },
];

const PHRASES = [
'Cada minuto de foco constrói o futuro.',
'Pequenas ações, grandes resultados.',
'Foco é a arte de dizer não ao que não importa.',
'Um passo de cada vez.',
'A disciplina de hoje é a liberdade de amanhã.',
'Presença plena, resultados reais.',
];

let state = loadState();

// Timer state
let timerInterval = null;
let timerRunning  = false;
let timerSeconds  = 25 * 60;
let timerTotal    = 25 * 60;
let selectedPomoMin = 25;
let activeTaskId  = null; // task focused in timer
let selectedTimeFilter = null;

// ============================
// PERSISTENCE
// ============================
function loadState() {
try {
const s = localStorage.getItem('focovivo_state');
if (s) return JSON.parse(s);
} catch(_) {}
return {
userName: 'Rangner',
tasks: [],
streak: 0,
totalFocusMin: 0,
pomodoros: 0,
lastActiveDate: null,
};
}

function saveState() {
localStorage.setItem('focovivo_state', JSON.stringify(state));
}

// ============================
// NAVIGATION
// ============================
function goTo(screenName) {
document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
document.querySelectorAll('.nav-btn[data-screen]').forEach(b => b.classList.remove('active'));
const screen = document.getElementById('screen-' + screenName);
if (screen) screen.classList.add('active');
const navBtn = document.querySelector(`.nav-btn[data-screen="${screenName}"]`);
if (navBtn) navBtn.classList.add('active');

if (screenName === 'hoje')   renderHome();
if (screenName === 'foco')   renderFocoScreen();
if (screenName === 'areas')  renderAreas();
if (screenName === 'perfil') renderPerfil();
}

// ============================
// GREETING & PHRASE
// ============================
function updateGreeting() {
const h = new Date().getHours();
let g = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
const name = state.userName || 'você';
document.getElementById('greeting-text').textContent = `${g}, ${name}!`;
document.getElementById('focus-phrase').textContent = PHRASES[Math.floor(Math.random() * PHRASES.length)];
// Update avatar letter
const letter = name.charAt(0).toUpperCase();
const avatarEls = document.querySelectorAll('#user-avatar, #profile-avatar');
avatarEls.forEach(el => el.textContent = letter);
}

// ============================
// HOME SCREEN
// ============================
function renderHome() {
updateGreeting();
updateStreak();
renderFocusCard();
renderTaskList();
renderSummary();
}

function renderFocusCard() {
const today = todayStr();
const todayTasks = state.tasks.filter(t => t.created_at === today || t.status === 'pendente');
const total = todayTasks.length;
const done  = todayTasks.filter(t => t.status === 'concluída').length;
const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

// Focus task = highest priority pending
const priority = ['alta','média','baixa'];
const pending = state.tasks.filter(t => t.status === 'pendente')
.sort((a,b) => priority.indexOf(a.priority) - priority.indexOf(b.priority));
const main = pending[0];

document.getElementById('focus-title-text').textContent = main ? main.title : 'Nenhum foco definido';
document.getElementById('focus-sub-text').textContent = main ? `${main.area} · ${main.duration_minutes} min` : 'Adicione uma tarefa principal';
document.getElementById('ring-pct').textContent = pct + '%';

// Update ring
const ring = document.getElementById('ring-fill');
const circ = 163.4;
ring.style.strokeDashoffset = circ - (circ * pct / 100);
}

function renderTaskList() {
const list = document.getElementById('task-list');
const emptyEl = document.getElementById('empty-tasks');
let tasks = [...state.tasks];

// Apply time filter
if (selectedTimeFilter && selectedTimeFilter < 999) {
tasks = tasks.filter(t => t.duration_minutes <= selectedTimeFilter);
}

// Sort: pending first, alta priority first
const pOrder = { alta: 0, média: 1, baixa: 2 };
tasks.sort((a, b) => {
if (a.status !== b.status) return a.status === 'pendente' ? -1 : 1;
return pOrder[a.priority] - pOrder[b.priority];
});

// Clear old items (keep empty-tasks)
list.querySelectorAll('.task-item').forEach(el => el.remove());

emptyEl.style.display = tasks.length === 0 ? 'block' : 'none';
document.getElementById('task-count').textContent = `${tasks.length} tarefa${tasks.length !== 1 ? 's' : ''}`;

tasks.forEach(task => {
const item = buildTaskItem(task);
list.appendChild(item);
});
}

function buildTaskItem(task) {
const div = document.createElement('div');
div.className = 'task-item' + (task.status === 'concluída' ? ' done' : '');
if (activeTaskId === task.id) div.classList.add('selected');
div.dataset.id = task.id;

const check = document.createElement('div');
check.className = 'task-check' + (task.status === 'concluída' ? ' checked' : '');
check.addEventListener('click', e => { e.stopPropagation(); toggleTaskDone(task.id); });

const body = document.createElement('div');
body.className = 'task-body';

const name = document.createElement('div');
name.className = 'task-name';
name.textContent = task.title;

const meta = document.createElement('div');
meta.className = 'task-meta';
meta.innerHTML = `<span class="task-area">${areaEmoji(task.area)} ${task.area}</span><span class="task-dur">⏱ ${task.duration_minutes} min</span>`;

body.appendChild(name);
body.appendChild(meta);

const dot = document.createElement('div');
dot.className = `prio-dot prio-${task.priority}`;

const del = document.createElement('button');
del.className = 'task-delete';
del.textContent = '×';
del.title = 'Remover';
del.addEventListener('click', e => { e.stopPropagation(); deleteTask(task.id); });

div.appendChild(check);
div.appendChild(body);
div.appendChild(dot);
div.appendChild(del);

// Click to select for focus
div.addEventListener('click', () => selectFocusTask(task.id));

return div;
}

function toggleTaskDone(id) {
const task = state.tasks.find(t => t.id === id);
if (!task) return;
if (task.status === 'pendente') {
task.status = 'concluída';
task.completed_at = todayStr();
showToast('✅ Tarefa concluída!');
checkStreak();
} else {
task.status = 'pendente';
task.completed_at = null;
}
saveState();
renderHome();
}

function deleteTask(id) {
state.tasks = state.tasks.filter(t => t.id !== id);
if (activeTaskId === id) activeTaskId = null;
saveState();
renderHome();
renderFocoScreen();
}

function selectFocusTask(id) {
activeTaskId = id;
renderHome();
// also update foco if visible
const focoScreen = document.getElementById('screen-foco');
if (focoScreen.classList.contains('active')) renderFocoScreen();
}

function renderSummary() {
const today = todayStr();
const todayTasks = state.tasks.filter(t => t.created_at === today || true); // all tasks
const done = state.tasks.filter(t => t.status === 'concluída').length;
const pending = state.tasks.filter(t => t.status === 'pendente').length;
document.getElementById('sum-done').textContent = done;
document.getElementById('sum-pending').textContent = pending;
document.getElementById('sum-mins').textContent = state.totalFocusMin;
}

// ============================
// FOCO SCREEN
// ============================
function renderFocoScreen() {
const task = state.tasks.find(t => t.id === activeTaskId) || null;
document.getElementById('foco-task-title').textContent = task ? task.title : 'Selecione uma tarefa';
document.getElementById('foco-step').textContent = task?.next_step || (task ? task.area : '-');

// Build pick list
const pickList = document.getElementById('focus-pick-list');
pickList.innerHTML = '';
const pending = state.tasks.filter(t => t.status === 'pendente');
if (pending.length === 0) {
pickList.innerHTML = '<p class="hint-text">Sem tarefas pendentes.</p>';
} else {
pending.forEach(t => {
const btn = document.createElement('button');
btn.className = 'focus-pick-item' + (t.id === activeTaskId ? ' active' : '');
btn.textContent = `${areaEmoji(t.area)} ${t.title} · ${t.duration_minutes} min`;
btn.addEventListener('click', () => {
activeTaskId = t.id;
renderFocoScreen();
});
pickList.appendChild(btn);
});
}
}

// ============================
// TIMER
// ============================
function setPomoTime(min) {
if (timerRunning) return;
selectedPomoMin = min;
timerTotal   = min * 60;
timerSeconds = timerTotal;
updateTimerDisplay();
// update pomo chips
document.querySelectorAll('[data-pomo]').forEach(b => {
b.classList.toggle('active', parseInt(b.dataset.pomo) === min);
});
}

function updateTimerDisplay() {
const m = Math.floor(timerSeconds / 60).toString().padStart(2,'0');
const s = (timerSeconds % 60).toString().padStart(2,'0');
document.getElementById('timer-display').textContent = `${m}:${s}`;

// Update ring
const fill = document.getElementById('timer-fill');
const circ = 553;
const ratio = timerSeconds / timerTotal;
fill.style.strokeDashoffset = circ * (1 - ratio);
}

function startTimer() {
if (timerRunning) {
// Pause
clearInterval(timerInterval);
timerRunning = false;
const btn = document.getElementById('btn-start-timer');
btn.textContent = '▶ Continuar';
btn.classList.add('paused');
} else {
// Start / Resume
timerRunning = true;
const btn = document.getElementById('btn-start-timer');
btn.textContent = '⏸ Pausar';
btn.classList.remove('paused');
timerInterval = setInterval(() => {
if (timerSeconds > 0) {
timerSeconds--;
updateTimerDisplay();
// accumulate focus time every 60s
if (timerSeconds % 60 === 0 && timerSeconds < timerTotal) {
state.totalFocusMin++;
saveState();
}
} else {
// Timer done
clearInterval(timerInterval);
timerRunning = false;
state.pomodoros++;
state.totalFocusMin += Math.round(selectedPomoMin);
saveState();
showToast('🎉 Pomodoro concluído!');
const btn = document.getElementById('btn-start-timer');
btn.textContent = '▶ Iniciar';
btn.classList.remove('paused');
timerSeconds = timerTotal;
updateTimerDisplay();
}
}, 1000);
}
}

function resetTimer() {
clearInterval(timerInterval);
timerRunning = false;
timerSeconds = timerTotal;
updateTimerDisplay();
const btn = document.getElementById('btn-start-timer');
btn.textContent = '▶ Iniciar';
btn.classList.remove('paused');
}

function completeTaskFromFocus() {
if (!activeTaskId) { showToast('Selecione uma tarefa primeiro'); return; }
toggleTaskDone(activeTaskId);
resetTimer();
activeTaskId = null;
renderFocoScreen();
renderHome();
}

// ============================
// AREAS SCREEN
// ============================
function renderAreas() {
const grid = document.getElementById('areas-grid');
grid.innerHTML = '';
AREAS_CONFIG.forEach(area => {
const cnt = state.tasks.filter(t => t.area === area.key && t.status === 'pendente').length;
const card = document.createElement('div');
card.className = 'area-card';
card.innerHTML = ` <span class="area-emoji">${area.emoji}</span> <span class="area-name">${area.key}</span> <span class="area-cnt">${cnt} pendente${cnt !== 1 ? 's' : ''}</span>`;
card.addEventListener('click', () => {
// Filter home by area (go to hoje with area filter)
showToast(`📂 Área: ${area.key}`);
});
grid.appendChild(card);
});
}

// ============================
// PERFIL SCREEN
// ============================
function renderPerfil() {
document.getElementById('profile-name').textContent = state.userName;
document.getElementById('input-name').value = state.userName;
const letter = (state.userName || 'R').charAt(0).toUpperCase();
document.getElementById('profile-avatar').textContent = letter;
document.getElementById('user-avatar').textContent = letter;
document.getElementById('stat-streak').textContent = state.streak;
document.getElementById('stat-total-min').textContent = state.totalFocusMin;
document.getElementById('stat-done').textContent = state.tasks.filter(t => t.status === 'concluída').length;
document.getElementById('stat-pomos').textContent = state.pomodoros;
}

// ============================
// STREAK
// ============================
function updateStreak() {
const today = todayStr();
if (state.lastActiveDate !== today) {
// Check if yesterday was active (not resetting if first use)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yStr = yesterday.toISOString().slice(0,10);
if (state.lastActiveDate === yStr) {
state.streak++;
} else if (state.lastActiveDate && state.lastActiveDate !== today) {
// Streak broken
state.streak = 1;
} else if (!state.lastActiveDate) {
state.streak = 1;
}
state.lastActiveDate = today;
saveState();
}
}

function checkStreak() {
updateStreak();
}

// ============================
// ADD TASK MODAL
// ============================
let selectedArea     = 'Estudos';
let selectedDuration = 15;
let selectedPriority = 'alta';

function openAddModal() {
document.getElementById('task-title-input').value = '';
document.getElementById('task-step-input').value = '';
selectedArea     = 'Estudos';
selectedDuration = 15;
selectedPriority = 'alta';
syncChips('area-chip',  selectedArea,     'data-area');
syncChips('dur-chip',   selectedDuration, 'data-min',  true);
syncChips('prio-chip',  selectedPriority, 'data-prio');
const overlay = document.getElementById('modal-overlay');
overlay.classList.remove('hidden');
overlay.classList.add('show');
setTimeout(() => document.getElementById('task-title-input').focus(), 100);
}

function closeModal() {
document.getElementById('modal-overlay').classList.add('hidden');
document.getElementById('modal-overlay').classList.remove('show');
}

function syncChips(cls, val, attr, isNum = false) {
document.querySelectorAll('.' + cls).forEach(b => {
const bVal = isNum ? parseInt(b.dataset.min) : b.getAttribute(attr);
b.classList.toggle('active', isNum ? bVal === val : bVal === val);
});
}

function saveNewTask() {
const title = document.getElementById('task-title-input').value.trim();
if (!title) { showToast('⚠️ Digite um título'); return; }
const step = document.getElementById('task-step-input').value.trim();
const task = {
id: 'task_' + Date.now(),
title,
area: selectedArea,
duration_minutes: selectedDuration,
priority: selectedPriority,
energy: 'média',
status: 'pendente',
next_step: step || '',
created_at: todayStr(),
completed_at: null,
};
state.tasks.unshift(task);
saveState();
closeModal();
showToast('✅ Tarefa adicionada!');
renderHome();
}

// ============================
// TOAST
// ============================
let toastTimer = null;
function showToast(msg) {
const t = document.getElementById('toast');
t.textContent = msg;
t.classList.remove('hidden');
clearTimeout(toastTimer);
toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

// ============================
// HELPERS
// ============================
function todayStr() {
return new Date().toISOString().slice(0, 10);
}

function areaEmoji(area) {
const a = AREAS_CONFIG.find(x => x.key === area);
return a ? a.emoji : '📌';
}

// ============================
// EVENT LISTENERS
// ============================
function init() {
// Nav buttons
document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
btn.addEventListener('click', () => goTo(btn.dataset.screen));
});

// Add task button (center nav)
document.getElementById('btn-add-task').addEventListener('click', openAddModal);

// Modal chips
document.querySelectorAll('.area-chip').forEach(b => {
b.addEventListener('click', () => {
selectedArea = b.dataset.area;
syncChips('area-chip', selectedArea, 'data-area');
});
});
document.querySelectorAll('.dur-chip').forEach(b => {
b.addEventListener('click', () => {
selectedDuration = parseInt(b.dataset.min);
syncChips('dur-chip', selectedDuration, 'data-min', true);
});
});
document.querySelectorAll('.prio-chip').forEach(b => {
b.addEventListener('click', () => {
selectedPriority = b.dataset.prio;
syncChips('prio-chip', selectedPriority, 'data-prio');
});
});

// Modal actions
document.getElementById('btn-save-task').addEventListener('click', saveNewTask);
document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// Time chips (home)
document.querySelectorAll('#time-chips .chip').forEach(chip => {
chip.addEventListener('click', () => {
const min = parseInt(chip.dataset.min);
if (selectedTimeFilter === min) {
selectedTimeFilter = null;
chip.classList.remove('active');
} else {
selectedTimeFilter = min;
document.querySelectorAll('#time-chips .chip').forEach(c => c.classList.remove('active'));
chip.classList.add('active');
}
renderTaskList();
});
});

// Timer controls
document.getElementById('btn-start-timer').addEventListener('click', startTimer);
document.getElementById('btn-reset').addEventListener('click', resetTimer);
document.getElementById('btn-done-task').addEventListener('click', completeTaskFromFocus);

// Pomo selector
document.querySelectorAll('[data-pomo]').forEach(b => {
b.addEventListener('click', () => setPomoTime(parseInt(b.dataset.pomo)));
});

// Profile save name
document.getElementById('btn-save-name').addEventListener('click', () => {
const val = document.getElementById('input-name').value.trim();
if (!val) return;
state.userName = val;
saveState();
renderPerfil();
updateGreeting();
showToast('✅ Nome salvo!');
});

// Profile avatar click -> go perfil
document.getElementById('user-avatar').addEventListener('click', () => goTo('perfil'));

// Clear data
document.getElementById('btn-clear-data').addEventListener('click', () => {
if (confirm('Apagar todos os dados do FocoVivo?')) {
localStorage.removeItem('focovivo_state');
state = loadState();
renderHome();
renderPerfil();
showToast('🗑️ Dados apagados');
}
});

// Enter to save task
document.getElementById('task-title-input').addEventListener('keydown', e => {
if (e.key === 'Enter') saveNewTask();
});

// Init timer display
updateTimerDisplay();

// Render initial screen
goTo('hoje');
}

document.addEventListener('DOMContentLoaded', init);

// ============================
// PWA / SERVICE WORKER
// ============================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
