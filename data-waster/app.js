// app.js (final fixed)
'use strict';

const statusText = document.getElementById('statusText');
const threadCount = document.getElementById('threadCount');
const threadsRange = document.getElementById('threadsRange');
const threadsDisplay = document.getElementById('threadsDisplay');
const controlBtn = document.getElementById('controlBtn');
const stopFab = document.getElementById('stopFab');
const downValue = document.getElementById('downValue');
const upValue = document.getElementById('upValue');
const totalValue = document.getElementById('totalValue');
const logsEl = document.getElementById('logs');
const navBtns = document.querySelectorAll('.nav-item');
const pages = {
  home: document.getElementById('page-home'),
  console: document.getElementById('page-console'),
  settings: document.getElementById('page-settings'),
  about: document.getElementById('page-about')
};

// Navigation
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const p = btn.dataset.page;
    Object.values(pages).forEach(pg => pg.hidden = true);
    pages[p].hidden = false;
    document.getElementById('page-title').textContent = p === 'home' ? 'Beranda' : p.charAt(0).toUpperCase() + p.slice(1);
  });
});

// Chart setup
const ctx = document.getElementById('netChart').getContext('2d');
const labels = Array.from({ length: 15 }, (_, i) => i);
const data = {
  labels,
  datasets: [
    { label: 'Unduh', data: Array(15).fill(0), borderColor: getComputedStyle(document.documentElement).getPropertyValue('--green').trim() || '#39b54a', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0 },
    { label: 'Unggah', data: Array(15).fill(0), borderColor: getComputedStyle(document.documentElement).getPropertyValue('--orange').trim() || '#ff6b35', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0 }
  ]
};
const netChart = new Chart(ctx, { type: 'line', data, options: { animation: false, maintainAspectRatio: false, scales: { x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.02)' } } }, plugins: { legend: { display: false } } } });

// State
let running = false;
let totalBytes = 0;
let intervalId = null;

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function persistLog(payload) {
  try {
    await fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (e) {
    // ignore when offline
  }
}

function renderLogLine({ timestamp, type, title, msg }, toTop = true) {
  const el = document.createElement('div');
  const cls = type === 'net' ? 'log-net' : type === 'error' ? 'log-error' : 'log-service';
  el.className = `log-line ${cls}`;
  const timeText = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  el.innerText = `${timeText} ${title || ''}\n${msg || ''}`;
  if (toTop) logsEl.prepend(el); else logsEl.appendChild(el);
  return el;
}

function parseServerLogsAndRender(text) {
  if (!text) return;
  const lines = text.split(/\r?\n/).filter(Boolean);
  logsEl.innerHTML = '';
  lines.forEach(line => {
    const m = line.match(/^\s*\[([^\]]+)\]\s*([A-Z]+)?\s*([^-]*)-\s*(.*)$/);
    if (m) {
      const [, ts, TYPE, titleRaw, msg] = m;
      const typeLower = (TYPE || 'INFO').toLowerCase();
      let type = 'service';
      if (typeLower.includes('net')) type = 'net';
      else if (typeLower.includes('err') || typeLower.includes('error') || typeLower.includes('warn')) type = 'error';
      else type = 'service';
      renderLogLine({ timestamp: ts, type, title: titleRaw.trim(), msg: msg.trim() }, false);
    } else {
      renderLogLine({ timestamp: null, type: 'service', title: '', msg: line }, false);
    }
  });
}

async function loadPersistedLogs() {
  try {
    // ask server not to serve cached copy
    const res = await fetch('/api/logs', { cache: 'no-store' });
    if (!res.ok) return;
    const text = await res.text();
    parseServerLogsAndRender(text);
  } catch (e) {
    // ignore
  }
}

function setupFilterPills() {
  const pillContainer = document.querySelector('.filters');
  if (!pillContainer) return;
  const pills = Array.from(pillContainer.querySelectorAll('.pill'));
  let activeFilter = 'semua';

  pills.forEach(p => {
    p.addEventListener('click', () => {
      pills.forEach(x => x.classList.remove('active'));
      p.classList.add('active');

      const txt = p.textContent.trim().toLowerCase();
      if (txt === 'semua') activeFilter = 'semua';
      else if (txt === 'info' || txt === 'berhasil') activeFilter = 'service';
      else if (txt === 'peringatan' || txt === 'kesalahan') activeFilter = 'error';
      else activeFilter = 'semua';

      Array.from(logsEl.children).forEach(lineEl => {
        if (activeFilter === 'semua') {
          lineEl.style.display = '';
        } else if (activeFilter === 'service') {
          lineEl.style.display = lineEl.classList.contains('log-service') ? '' : 'none';
        } else if (activeFilter === 'error') {
          lineEl.style.display = lineEl.classList.contains('log-error') ? '' : 'none';
        } else {
          lineEl.style.display = '';
        }
      });
    });
  });
}

async function clearLogsBoth() {
  logsEl.innerHTML = '';
  try {
    const res = await fetch('/api/clear-logs', { method: 'POST' });
    if (!res.ok) console.warn('Clear logs returned non-ok', res.status);
  } catch (e) {
    console.warn('Clear logs failed', e);
  }
}

function addLog(type, title, msg) {
  const payload = { type, title, msg, timestamp: new Date().toISOString() };
  renderLogLine(payload, true);
  persistLog(payload);
}

function pushData(downKB, upKB) {
  const ds0 = netChart.data.datasets[0].data;
  const ds1 = netChart.data.datasets[1].data;
  ds0.push(downKB); ds1.push(upKB);
  if (ds0.length > 15) { ds0.shift(); ds1.shift(); }
  netChart.update();
}

function startSim() {
  running = true;
  statusText.classList.remove('stopped'); statusText.classList.add('running'); statusText.textContent = 'Berjalan';
  controlBtn.textContent = 'Hentikan ■'; controlBtn.setAttribute('aria-pressed', 'true');
  stopFab.hidden = false;
  addLog('service', 'Service', 'Data wasting started');
  intervalId = setInterval(() => {
    const threads = parseInt(threadsRange.value, 10);
    const downKBs = Math.max(0, Math.round((Math.random() * 900 + threads * 90)));
    const upKBs = Math.max(0, Math.round((Math.random() * 150 + threads * 15)));
    pushData(downKBs, upKBs);
    downValue.textContent = downKBs >= 1024 ? (downKBs / 1024).toFixed(2) + ' MB/s' : downKBs + ' KB/s';
    upValue.textContent = upKBs >= 1024 ? (upKBs / 1024).toFixed(2) + ' MB/s' : upKBs + ' KB/s';
    totalBytes += (downKBs + upKBs) * 1024;
    totalValue.textContent = formatBytes(totalBytes);
    addLog('net', 'Network', `Down=${downValue.textContent} Up=${upValue.textContent}\nTotal=${formatBytes(totalBytes)}`);
  }, 1000);
}

function stopSim() {
  running = false;
  statusText.classList.remove('running'); statusText.classList.add('stopped'); statusText.textContent = 'Berhenti';
  controlBtn.textContent = 'Mulai ▶'; controlBtn.setAttribute('aria-pressed', 'false');
  stopFab.hidden = true; addLog('service', 'Service', 'Data wasting stopped');
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

controlBtn.addEventListener('click', () => running ? stopSim() : startSim());
stopFab.addEventListener('click', stopSim);

threadsRange && threadsRange.addEventListener('input', () => {
  threadsDisplay.textContent = threadsRange.value;
  threadCount.textContent = threadsRange.value;
});

document.getElementById('clearLog').addEventListener('click', () => clearLogsBoth());
document.getElementById('exportLog').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/logs', { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal fetch logs');
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'logs.txt'; a.click(); URL.revokeObjectURL(url);
  } catch (e) {
    const lines = Array.from(logsEl.querySelectorAll('.log-line')).map(n => n.innerText).join('\n\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'logs-fallback.txt'; a.click(); URL.revokeObjectURL(url);
  }
});

// initial sample
setTimeout(() => {
  const sampleDown = [0,0,0,0,0,1100,0,1100,1100,0,90,0,0,1100,1100];
  const sampleUp   = [0,0,0,0,0,60,10,90,80,10,60,10,20,60,70];
  netChart.data.datasets[0].data = sampleDown;
  netChart.data.datasets[1].data = sampleUp;
  netChart.update();
  downValue.textContent = '1,11 MB/s';
  upValue.textContent = '60,66 KB/s';
  totalBytes = 2.79 * 1024 * 1024;
  totalValue.textContent = formatBytes(totalBytes);
  addLog('net','Network', `Down=1,11 MB/s Up=60,66 KB/s\nTotal=2,79 MB`);
}, 600);

// errors
setInterval(() => {
  if (intervalId && Math.random() < 0.08) addLog('error', 'Upload', 'io: InterruptedIOException');
  if (intervalId && Math.random() < 0.05) addLog('error', 'Download', 'io: interrupted');
}, 3000);

// init filters and load persisted logs
setupFilterPills();
loadPersistedLogs();

// register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => console.warn('sw register failed'));
}
/* -------------------------
   Simple i18n / Language switcher
   ------------------------- */
(function() {
  const LANG_KEY = 'dw_lang';

  // translation dictionary (extendable)
  const T = {
    id: {
      nav_home: 'Beranda',
      nav_console: 'Konsol',
      nav_settings: 'Pengaturan',
      nav_about: 'Tentang',
      title_main: 'Data Waster',
      subtitle: 'Konsumsi Data Jaringan',
      status: 'Status',
      stopped: 'Berhenti',
      running: 'Berjalan',
      threads: 'Threads',
      net_title: 'Kecepatan Jaringan',
      download: 'Unduh',
      upload: 'Unggah',
      total_label: 'Total Data yang Dikonsumsi',
      start_btn: 'Mulai ▶',
      stop_btn: 'Hentikan ■',
      console_title: 'Konsol',
      pill_all: 'Semua',
      pill_info: 'Info',
      pill_warn: 'Peringatan',
      pill_error: 'Kesalahan',
      pill_success: 'Berhasil',
      clear_log: 'Hapus Log',
      export_log: 'Ekspor Log',
      settings_title: 'Pengaturan',
      network_settings: 'Pengaturan Jaringan',
      threads_label: 'Jumlah Thread',
      app_settings: 'Pengaturan Aplikasi',
      auto_start: 'Mulai Otomatis',
      keep_on: 'Layar Selalu Aktif',
      theme: 'Tema',
      language: 'Bahasa',
      about_text: 'Demo tampilan aplikasi Data Waster. Versi PWA & responsif untuk desktop & mobile.'
    },
    en: {
      nav_home: 'Home',
      nav_console: 'Console',
      nav_settings: 'Settings',
      nav_about: 'About',
      title_main: 'Data Waster',
      subtitle: 'Network Data Consumption',
      status: 'Status',
      stopped: 'Stopped',
      running: 'Running',
      threads: 'Threads',
      net_title: 'Network Speed',
      download: 'Download',
      upload: 'Upload',
      total_label: 'Total Data Consumed',
      start_btn: 'Start ▶',
      stop_btn: 'Stop ■',
      console_title: 'Console',
      pill_all: 'All',
      pill_info: 'Info',
      pill_warn: 'Warning',
      pill_error: 'Error',
      pill_success: 'Success',
      clear_log: 'Clear Logs',
      export_log: 'Export Logs',
      settings_title: 'Settings',
      network_settings: 'Network Settings',
      threads_label: 'Thread Count',
      app_settings: 'App Settings',
      auto_start: 'Auto Start',
      keep_on: 'Keep Screen On',
      theme: 'Theme',
      language: 'Language',
      about_text: 'Demo UI for Data Waster. PWA-ready & responsive for desktop & mobile.'
    }
    // add { es: {...}, pt: {...}, zh: {...} } here if needed
  };

  // elements mapping: selector -> translation key (set textContent)
  const map = [
    ['#page-title', 'nav_home'],                // header title (will be overridden by nav selection)
    ['.title-main', 'title_main'],
    ['.subtitle', 'subtitle'],
    ['#statusText', 'stopped'],
    ['.thread-count', 'threads'],
    ['.card-title', 'net_title'],
    ['.chart-legend div:nth-child(1) small', 'download'],
    ['.chart-legend div:nth-child(2) small', 'upload'],
    ['.total-label', 'total_label'],
    ['#controlBtn', 'start_btn'],
    ['#page-console h2', 'console_title'],
    ['.filters .pill:nth-child(1)', 'pill_all'],
    ['.filters .pill:nth-child(2)', 'pill_info'],
    ['.filters .pill:nth-child(3)', 'pill_warn'],
    ['.filters .pill:nth-child(4)', 'pill_error'],
    ['.filters .pill:nth-child(5)', 'pill_success'],
    ['#clearLog', 'clear_log'],
    ['#exportLog', 'export_log'],
    ['#page-settings h2', 'settings_title'],
    ['#page-settings .label', 'network_settings'], // first .label in settings
    ['#page-settings .slider-row + .threadsDisplay', 'threads_label'], // fallback not always used
    ['#page-about .muted', 'about_text']
  ];

  function detectSystemLang() {
    const nav = navigator.language || navigator.userLanguage || 'en';
    if (nav.startsWith('id') || nav.startsWith('ms')) return 'id';
    if (nav.startsWith('zh')) return 'zh';
    if (nav.startsWith('es')) return 'es';
    if (nav.startsWith('pt')) return 'pt';
    return 'en';
  }

  function applyTranslations(lang) {
    const dict = T[lang] || T['en'];
    // apply mapped elements
    map.forEach(([sel, key]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      // special: if element is a button, set value/textContent appropriately
      if (el.tagName.toLowerCase() === 'input' && el.type === 'button') {
        el.value = dict[key] || '';
      } else {
        el.textContent = dict[key] || el.textContent;
      }
    });

    // nav items separately (they have spans)
    const navs = document.querySelectorAll('.nav-item');
    if (navs && navs.length >= 4) {
      navs[0].querySelector('span').textContent = dict['nav_home'];
      navs[1].querySelector('span').textContent = dict['nav_console'];
      navs[2].querySelector('span').textContent = dict['nav_settings'];
      navs[3].querySelector('span').textContent = dict['nav_about'];
    }

    // settings labels more granular (if present)
    // update start/stop button labels (depending on running state)
    if (running) {
      controlBtn.textContent = dict['stop_btn'];
    } else {
      controlBtn.textContent = dict['start_btn'];
    }

    // update some static labels by class names
    document.querySelectorAll('.label').forEach((el) => {
      // only replace the first occurrence (we already mapped network_settings to first .label)
      // keep others untouched
    });
  }

  function setLanguage(lang) {
    if (lang === 'system') lang = detectSystemLang();
    // fallback to en if not available
    if (!T[lang]) lang = 'en';
    localStorage.setItem(LANG_KEY, lang);
    applyTranslations(lang);
    // ensure checkboxes reflect selection (only one checked)
    const checkboxLabels = document.querySelectorAll('.checkbox-list label');
    checkboxLabels.forEach(label => {
      const txt = label.textContent.trim().toLowerCase();
      const input = label.querySelector('input[type="checkbox"]');
      if (!input) return;
      // normalize label to language code
      if (txt === 'sistem' || txt === 'sistem') {
        input.checked = (localStorage.getItem(LANG_KEY) === null && detectSystemLang() === lang) || label.textContent.trim().toLowerCase() === 'sistem' && (lang === detectSystemLang());
      } else if (txt === 'english' || txt === 'english') {
        input.checked = (lang === 'en');
      } else if (txt === 'indonesia' || txt === 'indonesia') {
        input.checked = (lang === 'id');
      } else if (txt === 'español' || txt === 'español') {
        input.checked = (lang === 'es');
      } else if (txt === 'português' || txt === 'português') {
        input.checked = (lang === 'pt');
      } else if (txt === '中文' || txt === '中文') {
        input.checked = (lang === 'zh');
      } else {
        // fallback: uncheck
        input.checked = false;
      }
      // ensure only one is checked — if multiple, the last matching will remain
    });
  }

  // wire up checkbox clicks (make them behave like radio)
  (function wireLanguageCheckboxes() {
    const labels = Array.from(document.querySelectorAll('.checkbox-list label'));
    if (!labels.length) return;
    labels.forEach(label => {
      const input = label.querySelector('input[type="checkbox"]');
      if (!input) return;
      label.addEventListener('click', (e) => {
        e.preventDefault();
        // uncheck all
        labels.forEach(l => {
          const i = l.querySelector('input[type="checkbox"]');
          if (i) i.checked = false;
        });
        // check this one
        input.checked = true;
        const txt = label.textContent.trim().toLowerCase();
        if (txt.includes('sistem')) setLanguage('system');
        else if (txt.includes('english')) setLanguage('en');
        else if (txt.includes('indonesia')) setLanguage('id');
        else if (txt.includes('español') || txt.includes('espanol')) setLanguage('es');
        else if (txt.includes('portugu')) setLanguage('pt');
        else if (txt.includes('中文')) setLanguage('zh');
        else setLanguage('en');
      });
    });
  })();

  // initialize language on load (use saved preference or system)
  (function initLang() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved) setLanguage(saved);
    else setLanguage('system');
  })();

})(); // end i18n IIFE
