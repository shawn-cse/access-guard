const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

const STORAGE_KEYS = {
  logs: 'accessguard.logs.v2',
  stats: 'accessguard.stats.v2',
  settings: 'accessguard.settings.v2'
};

const methods = {
  C: { name: 'Card swipe', detail: 'RFID / NFC credential' },
  F: { name: 'Fingerprint', detail: 'Biometric fingerprint scan' },
  R: { name: 'Retina scan', detail: 'Optical retina signature' },
  S: { name: 'Face recognition', detail: 'Facial biometric match' },
  V: { name: 'Voice recognition', detail: 'Voiceprint verification' },
  P: { name: 'PIN entry', detail: 'Personal security code' },
  B: { name: 'Biometric combo', detail: 'Multi-biometric fusion' },
  A: { name: 'Admin override', detail: 'Privileged administrator key' }
};

const zones = {
  Lobby: ['C', 'F'],
  ServerRoom: ['C', 'P', 'R'],
  Laboratory: ['C', 'F', 'S'],
  ExecutiveLounge: ['C', 'V', 'P'],
  ResearchWing: ['C', 'F', 'R', 'B'],
  ConferenceHall: ['C', 'S'],
  DataCenter: ['C', 'P', 'F', 'R'],
  AdminOffice: ['C', 'P', 'A']
};

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* localStorage may be blocked */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
};

const settings = store.get(STORAGE_KEYS.settings, { persistLogs: true, compactMode: false });
let logs = settings.persistLogs ? store.get(STORAGE_KEYS.logs, []) : [];
let stats = settings.persistLogs ? store.get(STORAGE_KEYS.stats, { granted: 0, denied: 0 }) : { granted: 0, denied: 0 };
let entered = [];
let toastTimer;

function humanZone(zone) {
  return zone.replace(/([A-Z])/g, ' $1').trim();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2200);
}

function saveState() {
  store.set(STORAGE_KEYS.settings, settings);
  if (settings.persistLogs) {
    store.set(STORAGE_KEYS.logs, logs);
    store.set(STORAGE_KEYS.stats, stats);
  }
}

function renderStats() {
  $('#zoneCount').textContent = Object.keys(zones).length;
  $('#methodCount').textContent = Object.keys(methods).length;
  $('#grantedCount').textContent = stats.granted;
  $('#deniedCount').textContent = stats.denied;
}

function renderZoneOptions() {
  $('#zoneSelect').innerHTML = Object.keys(zones)
    .map(zone => `<option value="${zone}">${humanZone(zone)}</option>`)
    .join('');
}

function renderMethods() {
  $('#authButtons').innerHTML = Object.entries(methods).map(([code, method], index) => `
    <button class="auth-method" type="button" data-method="${code}" title="${method.name}">
      <span class="method-code">${code}</span>
      <span><strong>${method.name}</strong><small>${method.detail}</small></span>
      <span class="key-number">${index + 1}</span>
    </button>
  `).join('');

  $('#methodLegend').innerHTML = Object.entries(methods).map(([code, method], index) => `
    <div class="legend-item">
      <span class="legend-code">${code}</span>
      <span><strong>${method.name}</strong><small>Key ${index + 1}</small></span>
    </div>
  `).join('');
}

function renderZone() {
  const zone = $('#zoneSelect').value;
  const sequence = zones[zone];
  $('#zoneInfo').innerHTML = `<strong>${humanZone(zone)}</strong> requires <strong>${sequence.length}</strong> signals in exact order. Any extra, missing, or out-of-order signal is denied.`;
  $('#sequenceCount').textContent = `${sequence.length} ${sequence.length === 1 ? 'step' : 'steps'}`;
  $('#requiredSteps').innerHTML = sequence.map((code, index) => `
    <div class="path-step">
      <div class="path-node"><strong>${code}</strong><small>${methods[code].name}</small></div>
      ${index < sequence.length - 1 ? '<span class="path-arrow">→</span>' : ''}
    </div>
  `).join('');
  entered = [];
  resetResult();
  renderEntered();
}

function getSequenceState() {
  const required = zones[$('#zoneSelect').value];
  let invalidAt = -1;
  for (let index = 0; index < entered.length; index += 1) {
    if (entered[index] !== required[index]) {
      invalidAt = index + 1;
      break;
    }
  }
  return { required, invalidAt };
}

function renderDfa() {
  const { required, invalidAt } = getSequenceState();
  const activeIndex = invalidAt > -1 ? invalidAt : Math.min(entered.length, required.length);
  const states = Array.from({ length: required.length + 1 }, (_, index) => {
    const classes = ['dfa-state'];
    if (index === activeIndex) classes.push(invalidAt > -1 ? 'invalid' : 'active');
    const state = `<span class="${classes.join(' ')}">q${index}</span>`;
    if (index === required.length) return state;
    const edgeClass = invalidAt === -1 && index < entered.length ? 'dfa-edge complete' : 'dfa-edge';
    return `${state}<span class="${edgeClass}"></span>`;
  }).join('');
  $('#dfaTrack').innerHTML = states;

  if (invalidAt > -1) {
    $('#dfaStateLabel').textContent = `q${invalidAt} · Invalid transition`;
  } else if (entered.length === required.length) {
    $('#dfaStateLabel').textContent = `q${required.length} · Accept state`;
  } else {
    $('#dfaStateLabel').textContent = `q${entered.length} · ${entered.length ? 'Transition accepted' : 'Waiting'}`;
  }
}

function renderEntered() {
  const { required } = getSequenceState();
  $('#enteredSteps').innerHTML = entered.length
    ? entered.map((code, index) => `<span class="entered-step" title="${methods[code].name}">${code}<span class="sr-only"> ${index + 1}</span></span>`).join('')
    : '<div class="empty-state compact">No signals entered yet.</div>';

  $('#undoAccess').disabled = entered.length === 0;
  const ratio = required.length ? Math.min(entered.length / required.length, 1) * 100 : 0;
  $('#sequenceProgress').style.width = `${ratio}%`;
  $('#progressLabel').textContent = `${entered.length} of ${required.length} signals`;
  renderDfa();
}

function resetResult() {
  const result = $('#accessResult');
  result.className = 'verify-status';
  result.innerHTML = '<span class="status-dot neutral"></span><span>Ready for authentication</span>';
}

function setResult(valid) {
  const result = $('#accessResult');
  result.className = `verify-status ${valid ? 'success' : 'danger'}`;
  result.innerHTML = valid
    ? '<span class="status-dot"></span><span>Access granted · policy accepted</span>'
    : '<span class="status-dot danger"></span><span>Access denied · sequence mismatch</span>';
}

function renderLogs() {
  const rows = $('#accessRows');
  const empty = $('#tableEmpty');
  rows.innerHTML = logs.map(log => `
    <tr>
      <td>${escapeHtml(log.time)}</td>
      <td>${escapeHtml(log.zone)}</td>
      <td><code>${escapeHtml(log.sequence) || '—'}</code></td>
      <td><span class="result-pill ${log.valid ? 'success' : 'danger'}">${log.valid ? '● Granted' : '● Denied'}</span></td>
    </tr>
  `).join('');

  empty.classList.toggle('hidden', logs.length > 0);
  $('#logSummary').textContent = logs.length ? `${logs.length} verification ${logs.length === 1 ? 'event' : 'events'} recorded` : 'No verification attempts yet';
  $('#lastAttempt').textContent = logs.length ? `Last attempt · ${logs[0].time}` : 'Waiting for activity';
}

function verify() {
  const zone = $('#zoneSelect').value;
  const required = zones[zone];
  const valid = entered.length === required.length && entered.every((code, index) => code === required[index]);

  if (valid) stats.granted += 1;
  else stats.denied += 1;

  const now = new Date();
  logs.unshift({
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    zone: humanZone(zone),
    sequence: entered.join(' '),
    valid,
    iso: now.toISOString()
  });
  logs = logs.slice(0, 100);

  setResult(valid);
  renderStats();
  renderLogs();
  saveState();
  toast(valid ? `Access granted: ${humanZone(zone)}` : `Access denied: ${humanZone(zone)}`);
}

function addMethod(code) {
  entered.push(code);
  resetResult();
  renderEntered();
}

function undoMethod() {
  if (!entered.length) return;
  entered.pop();
  resetResult();
  renderEntered();
}

function clearEntered() {
  entered = [];
  resetResult();
  renderEntered();
}

function clearLogs() {
  if (!logs.length && !stats.granted && !stats.denied) return;
  logs = [];
  stats = { granted: 0, denied: 0 };
  store.remove(STORAGE_KEYS.logs);
  store.remove(STORAGE_KEYS.stats);
  renderStats();
  renderLogs();
  toast('Audit history cleared');
}

function exportLogs() {
  if (!logs.length) {
    toast('No audit events to export');
    return;
  }
  const csv = [
    ['Time', 'Zone', 'Sequence', 'Result'],
    ...logs.map(log => [log.time, log.zone, log.sequence, log.valid ? 'Granted' : 'Denied'])
  ].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'accessguard-audit-log.csv';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  toast('Audit log exported');
}

function setupSettings() {
  $('#persistLogs').checked = settings.persistLogs;
  $('#compactMode').checked = settings.compactMode;
  document.body.classList.toggle('compact', settings.compactMode);

  $('#persistLogs').addEventListener('change', event => {
    settings.persistLogs = event.target.checked;
    if (!settings.persistLogs) {
      store.remove(STORAGE_KEYS.logs);
      store.remove(STORAGE_KEYS.stats);
    }
    saveState();
    toast(settings.persistLogs ? 'Audit persistence enabled' : 'Audit persistence disabled');
  });

  $('#compactMode').addEventListener('change', event => {
    settings.compactMode = event.target.checked;
    document.body.classList.toggle('compact', settings.compactMode);
    saveState();
    toast(settings.compactMode ? 'Compact interface enabled' : 'Comfortable spacing restored');
  });
}

function setupNavigation() {
  const menuButton = $('#menuBtn');
  const overlay = $('#mobileOverlay');
  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
  };

  menuButton.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
  overlay.addEventListener('click', closeMenu);
  $$('.nav a').forEach(link => link.addEventListener('click', closeMenu));

  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    $$('.nav a').forEach(link => link.classList.toggle('active', link.dataset.section === visible.target.id));
  }, { rootMargin: '-25% 0px -58% 0px', threshold: [0.05, 0.3] });

  ['dashboard', 'workspace', 'reports', 'settings'].forEach(id => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

function setupKeyboard() {
  const codes = Object.keys(methods);
  document.addEventListener('keydown', event => {
    const target = event.target;
    if (target instanceof HTMLSelectElement || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (event.key >= '1' && event.key <= '8') addMethod(codes[Number(event.key) - 1]);
    if (event.key === 'Enter') verify();
    if (event.key === 'Backspace') {
      event.preventDefault();
      undoMethod();
    }
    if (event.key === 'Escape') clearEntered();
  });
}

renderZoneOptions();
renderMethods();
renderStats();
renderLogs();
setupSettings();
setupNavigation();
setupKeyboard();

$('#zoneSelect').addEventListener('change', renderZone);
$('#authButtons').addEventListener('click', event => {
  const button = event.target.closest('[data-method]');
  if (button) addMethod(button.dataset.method);
});
$('#verifyAccess').addEventListener('click', verify);
$('#clearAccess').addEventListener('click', clearEntered);
$('#undoAccess').addEventListener('click', undoMethod);
$('#clearLogs').addEventListener('click', clearLogs);
$('#exportLogs').addEventListener('click', exportLogs);

renderZone();
