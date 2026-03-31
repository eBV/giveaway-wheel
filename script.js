(() => {
  const canvas = document.getElementById('wheelCanvas');
  const ctx = canvas.getContext('2d');
  const spinBtn = document.getElementById('spinBtn');
  const nameInput = document.getElementById('nameInput');
  const addBtn = document.getElementById('addBtn');
  const entryListEl = document.getElementById('entryList');
  const winnerDisplay = document.getElementById('winnerDisplay');
  const removeWinnerCheckbox = document.getElementById('removeWinner');
  const giveawayLabel = document.getElementById('giveawayLabel');
  const cmd1Input = document.getElementById('cmd1Input');
  const cmd2Input = document.getElementById('cmd2Input');
  const panelsContainer = document.getElementById('panelsContainer');
  const toggleAdminBtn = document.getElementById('toggleAdminBtn');
  const showControlsFloat = document.getElementById('showControlsFloat');
  const entriesPanel = document.getElementById('entriesPanel');
  const twitchPanel = document.getElementById('twitchPanel');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const celebrationOverlay = document.getElementById('celebrationOverlay');
  const celebrationName = document.getElementById('celebrationName');
  const confettiCanvas = document.getElementById('confettiCanvas');
  const confettiCtx = confettiCanvas.getContext('2d');

  const COLORS = [
    '#7c3aed', '#9b59b6', '#6c3483', '#a569bd', '#8e44ad',
    '#5b21b6', '#7e22ce', '#6d28d9', '#9333ea', '#a855f7'
  ];

  // Named CSS colors chatters can use
  const NAMED_COLORS = {
    red:'#e74c3c', blue:'#3498db', green:'#2ecc71', yellow:'#f1c40f',
    orange:'#e67e22', pink:'#e91e63', purple:'#9b59b6', cyan:'#00bcd4',
    lime:'#8bc34a', teal:'#009688', gold:'#ffd700', coral:'#ff6b6b',
    salmon:'#fa8072', violet:'#ee82ee', magenta:'#ff00ff', indigo:'#4b0082',
    crimson:'#dc143c', turquoise:'#40e0d0', lavender:'#b57edc', mint:'#98ff98',
    maroon:'#800000', navy:'#000080', olive:'#808000', white:'#ffffff',
    hotpink:'#ff69b4', skyblue:'#87ceeb', tomato:'#ff6347', plum:'#dda0dd'
  };

  // entries: [{name: string, color: string|null}, ...]
  let entries = [];
  let currentAngle = 0;
  let spinning = false;
  let adminVisible = true;

  // Spin durations: short is current (4-6s), long is 2x, medium is halfway
  const SPIN_DURATIONS = {
    short:  { base: 4000, variance: 2000 },
    medium: { base: 6000, variance: 3000 },
    long:   { base: 8000, variance: 4000 }
  };
  let spinSpeed = 'short';

  // Speed buttons
  const speedBtns = document.querySelectorAll('.speed-btns button');
  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      spinSpeed = btn.dataset.speed;
      speedBtns.forEach(b => b.classList.toggle('active', b === btn));
      localStorage.setItem('gw_spinSpeed', spinSpeed);
    });
  });

  // --- Admin Toggle ---
  function updateAdminVisibility() {
    panelsContainer.style.display = adminVisible ? '' : 'none';
    showControlsFloat.style.display = adminVisible ? 'none' : '';
    toggleAdminBtn.textContent = adminVisible ? 'Hide Controls' : 'Show Controls';
    localStorage.setItem('gw_adminVisible', adminVisible);
  }

  toggleAdminBtn.addEventListener('click', () => {
    adminVisible = !adminVisible;
    updateAdminVisibility();
  });

  showControlsFloat.addEventListener('click', () => {
    adminVisible = true;
    updateAdminVisibility();
  });

  // --- Clear All (with confirm) ---
  clearAllBtn.addEventListener('click', () => {
    if (!entries.length) return;
    clearAllBtn.textContent = 'Are you sure?';
    clearAllBtn.style.background = '#dc2626';
    let confirmed = false;

    function onConfirm() {
      entries = [];
      save();
      renderEntries();
      drawWheel();
      winnerDisplay.innerHTML = '';
      resetBtn();
    }

    function resetBtn() {
      clearAllBtn.textContent = 'Clear All Entries';
      clearAllBtn.style.background = '#ef4444';
      clearAllBtn.removeEventListener('click', onConfirm);
      document.removeEventListener('click', onOutside, true);
    }

    function onOutside(e) {
      if (e.target !== clearAllBtn) resetBtn();
    }

    // Next click on the button confirms, click elsewhere cancels
    setTimeout(() => {
      clearAllBtn.addEventListener('click', onConfirm, { once: true });
      document.addEventListener('click', onOutside, { capture: true, once: true });
    }, 0);
  });

  // --- LocalStorage ---
  function save() {
    localStorage.setItem('gw_entries', JSON.stringify(entries));
    localStorage.setItem('gw_removeWinner', removeWinnerCheckbox.checked);
    localStorage.setItem('gw_label', giveawayLabel.value);
    localStorage.setItem('gw_cmd1', cmd1Input.value);
    localStorage.setItem('gw_cmd2', cmd2Input.value);
  }

  function load() {
    try {
      const stored = localStorage.getItem('gw_entries');
      if (stored) {
        const parsed = JSON.parse(stored);
        entries = parsed.map(e => typeof e === 'string' ? { name: e, color: null } : e);
      }
    } catch { /* ignore */ }
    removeWinnerCheckbox.checked = localStorage.getItem('gw_removeWinner') === 'true';
    giveawayLabel.value = localStorage.getItem('gw_label') || '';
    cmd1Input.value = localStorage.getItem('gw_cmd1') || '!enter';
    cmd2Input.value = localStorage.getItem('gw_cmd2') || '';
    adminVisible = localStorage.getItem('gw_adminVisible') !== 'false';
    const savedSpeed = localStorage.getItem('gw_spinSpeed');
    if (savedSpeed && SPIN_DURATIONS[savedSpeed]) {
      spinSpeed = savedSpeed;
      speedBtns.forEach(b => b.classList.toggle('active', b.dataset.speed === spinSpeed));
    }
  }

  function getSegmentColor(entry, index) {
    return entry.color || COLORS[index % COLORS.length];
  }

  // --- Parse user color from chat command ---
  function parseUserColor(message) {
    // !enter blue  or  !enter #ff00aa
    const parts = message.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const colorArg = parts.slice(1).join('').toLowerCase();
    // Hex color
    if (/^#[0-9a-f]{6}$/.test(colorArg)) return colorArg;
    // Named color
    if (NAMED_COLORS[colorArg]) return NAMED_COLORS[colorArg];
    return null;
  }

  // --- Draw Wheel ---
  function drawWheel() {
    // Draw at 3× logical resolution (2520px buffer, 420px CSS display).
    // At maxZoom 2.8× the canvas still has 2520/(420*2.8) ≈ 2.1× density — stays sharp.
    const LOGICAL = 840;
    const scale = canvas.width / LOGICAL; // 3
    const cx = LOGICAL / 2;  // 420 in logical units
    const cy = LOGICAL / 2;
    const r  = cx - 20;      // 400

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);

    if (entries.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#2d1b4e';
      ctx.fill();
      ctx.fillStyle = '#6b5b8a';
      ctx.font = '600 32px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Add entries to spin!', cx, cy);
      ctx.restore();
      return;
    }

    const sliceAngle = (Math.PI * 2) / entries.length;

    entries.forEach((entry, i) => {
      const start = currentAngle + i * sliceAngle;
      const end = start + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = getSegmentColor(entry, i);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      const fontSize = Math.min(28, Math.max(14, 400 / entries.length));
      ctx.font = `600 ${fontSize}px "Segoe UI", sans-serif`;
      const maxTextWidth = r * 0.65;
      let displayName = entry.name;
      while (ctx.measureText(displayName).width > maxTextWidth && displayName.length > 1) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== entry.name) displayName += '...';
      ctx.fillText(displayName, r - 24, 0);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }

  // --- Render Entry List ---
  function renderEntries() {
    entryListEl.innerHTML = '';
    if (entries.length === 0) {
      entryListEl.innerHTML = '<li class="empty-msg">No entries yet</li>';
      return;
    }
    entries.forEach((entry, i) => {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;flex-shrink:0;background:${getSegmentColor(entry, i)}`;
      const span = document.createElement('span');
      span.style.flex = '1';
      span.textContent = entry.name;
      const btn = document.createElement('button');
      btn.className = 'remove-btn';
      btn.textContent = '\u00d7';
      btn.title = 'Remove';
      btn.addEventListener('click', () => {
        entries.splice(i, 1);
        save();
        renderEntries();
        drawWheel();
      });
      li.appendChild(dot);
      li.appendChild(span);
      li.appendChild(btn);
      entryListEl.appendChild(li);
    });
  }

  // --- Add Entry ---
  function addEntry() {
    const name = nameInput.value.trim();
    if (!name) return;
    entries.push({ name, color: null });
    nameInput.value = '';
    nameInput.focus();
    save();
    renderEntries();
    drawWheel();
  }

  addBtn.addEventListener('click', addEntry);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addEntry();
  });
  removeWinnerCheckbox.addEventListener('change', save);
  giveawayLabel.addEventListener('input', save);
  cmd1Input.addEventListener('input', save);
  cmd2Input.addEventListener('input', save);

  // ========== CONFETTI ==========
  let confettiPieces = [];
  let confettiAnimId = null;

  function launchConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiCanvas.classList.add('active');
    confettiPieces = [];

    const colors = ['#a855f7','#c084fc','#7c3aed','#f59e0b','#ec4899','#22c55e','#3b82f6','#ef4444','#fbbf24','#e879f9'];

    for (let i = 0; i < 250; i++) {
      confettiPieces.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * -confettiCanvas.height - 50,
        w: Math.random() * 10 + 5,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.1 + 0.03
      });
    }

    function drawConfetti() {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;

      for (const p of confettiPieces) {
        if (p.y > confettiCanvas.height + 50) continue;
        alive = true;

        p.x += p.vx + Math.sin(p.wobble) * 1.5;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.wobble += p.wobbleSpeed;
        p.vy += 0.03;

        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate((p.rotation * Math.PI) / 180);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        confettiCtx.restore();
      }

      if (alive) {
        confettiAnimId = requestAnimationFrame(drawConfetti);
      } else {
        stopConfetti();
      }
    }

    confettiAnimId = requestAnimationFrame(drawConfetti);
  }

  function stopConfetti() {
    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
    confettiAnimId = null;
    confettiCanvas.classList.remove('active');
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }

  // ========== CELEBRATION ==========
  function showCelebration(winnerName) {
    celebrationName.textContent = winnerName;
    celebrationOverlay.classList.add('active');
    launchConfetti();

    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      SOUND_THEMES[currentSound].fanfare(ac);
    } catch { /* no audio */ }
  }

  function hideCelebration() {
    celebrationOverlay.classList.remove('active');
    stopConfetti();
  }

  celebrationOverlay.addEventListener('click', hideCelebration);

  // ========== SOUND ENGINE ==========
  let currentSound = 'classic';
  let spinTickCount = 0;

  // ---- helpers ----
  function makeNoise(ac) {
    const bufSize = Math.ceil(ac.sampleRate * 0.1);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    return src;
  }

  function makeDistortion(ac, amount = 80) {
    const ws = ac.createWaveShaper();
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    ws.curve = curve;
    ws.oversample = '4x';
    return ws;
  }

  function schedNote(ac, freq, type, startT, endT, vol) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, startT);
    gain.gain.exponentialRampToValueAtTime(0.0001, endT);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(startT);
    osc.stop(endT + 0.01);
  }

  function schedNoise(ac, hpFreq, startT, endT, vol) {
    const noise = makeNoise(ac);
    const filter = ac.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hpFreq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, startT);
    gain.gain.exponentialRampToValueAtTime(0.0001, endT);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    noise.start(startT);
    noise.stop(endT + 0.01);
  }

  // ---- themes ----
  const SOUND_THEMES = {

    classic: {
      label: 'Classic',
      tick(ac, n) {
        const t = ac.currentTime;
        schedNote(ac, 600 + Math.random() * 200, 'sine', t, t + 0.06, 0.06);
      },
      fanfare(ac) {
        const t = ac.currentTime;
        [523, 659, 784, 1047].forEach((f, i) =>
          schedNote(ac, f, 'sine', t + i * 0.15, t + i * 0.15 + 0.4, 0.12));
      },
      previewDuration: 2.5
    },

    afrorock: {
      label: 'Afro Rock',
      tick(ac, n) {
        const t = ac.currentTime;
        if (n % 2 === 0) {
          // Low drum punch
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(120, t);
          osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
          gain.gain.setValueAtTime(0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          osc.connect(gain); gain.connect(ac.destination);
          osc.start(t); osc.stop(t + 0.14);
        } else {
          // Distorted guitar chunk
          const osc = ac.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = 220;
          const dist = makeDistortion(ac, 100);
          const gain = ac.createGain();
          gain.gain.setValueAtTime(0.06, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
          osc.connect(dist); dist.connect(gain); gain.connect(ac.destination);
          osc.start(t); osc.stop(t + 0.09);
        }
      },
      fanfare(ac) {
        const t = ac.currentTime;
        [[82,123,165],[110,165,220],[123,185,247]].forEach((chord, si) => {
          const start = t + si * 0.42;
          const end = start + (si === 2 ? 0.55 : 0.3);
          chord.forEach(freq => {
            const osc = ac.createOscillator();
            const dist = makeDistortion(ac, 60);
            const gain = ac.createGain();
            osc.type = 'sawtooth'; osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.09, start);
            gain.gain.exponentialRampToValueAtTime(0.0001, end);
            osc.connect(dist); dist.connect(gain); gain.connect(ac.destination);
            osc.start(start); osc.stop(end + 0.05);
          });
        });
      },
      previewDuration: 3.0
    },

    trap: {
      label: 'Trap / Hip-Hop',
      tick(ac, n) {
        const t = ac.currentTime;
        if (n % 4 === 0) {
          // 808 kick
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(180, t);
          osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
          gain.gain.setValueAtTime(0.5, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
          osc.connect(gain); gain.connect(ac.destination);
          osc.start(t); osc.stop(t + 0.22);
        } else {
          schedNoise(ac, 7000, t, t + 0.04, 0.15);
        }
      },
      fanfare(ac) {
        const t = ac.currentTime;
        // Sub swell
        const sub = ac.createOscillator();
        const subGain = ac.createGain();
        sub.type = 'sine'; sub.frequency.value = 60;
        subGain.gain.setValueAtTime(0.0001, t);
        subGain.gain.linearRampToValueAtTime(0.5, t + 0.3);
        subGain.gain.linearRampToValueAtTime(0.4, t + 0.7);
        subGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
        sub.connect(subGain); subGain.connect(ac.destination);
        sub.start(t); sub.stop(t + 1.1);
        // Hi-hat roll
        for (let i = 0; i < 6; i++) schedNoise(ac, 8000, t + 0.2 + i * 0.07, t + 0.25 + i * 0.07, 0.2);
        // Melody G4 C5 D5 G5
        [392, 523, 587, 784].forEach((f, i) =>
          schedNote(ac, f, 'square', t + 0.7 + i * 0.18, t + 0.85 + i * 0.18, 0.08));
      },
      previewDuration: 2.8
    },

    afrobeats: {
      label: 'Afrobeats Pop',
      tick(ac, n) {
        const t = ac.currentTime;
        const freq = n % 3 === 0 ? 380 : (n % 3 === 1 ? 700 : 500);
        const dur = freq < 500 ? 0.1 : 0.07;
        schedNote(ac, freq, 'triangle', t, t + dur, 0.15);
        if (n % 3 === 0) schedNote(ac, 2200, 'triangle', t, t + 0.015, 0.06);
      },
      fanfare(ac) {
        const t = ac.currentTime;
        [523, 587, 659, 784, 880, 1047].forEach((f, i) =>
          schedNote(ac, f, 'triangle', t + i * 0.1, t + i * 0.1 + 0.15, 0.12));
        [880, 1047, 880, 1047].forEach((f, i) =>
          schedNote(ac, f, 'triangle', t + 0.7 + i * 0.08, t + 0.77 + i * 0.08, 0.09));
      },
      previewDuration: 2.5
    },

    mariachi: {
      label: 'Mariachi Salsa',
      tick(ac, n) {
        const t = ac.currentTime;
        if (n % 3 === 0) {
          schedNote(ac, 1200, 'square', t, t + 0.03, 0.08);
          schedNote(ac, 600,  'square', t, t + 0.03, 0.04);
        } else if (n % 3 === 1) {
          schedNote(ac, 900, 'square', t, t + 0.04, 0.07);
        } else {
          schedNote(ac, 800,  'square', t, t + 0.06, 0.05);
          schedNote(ac, 1600, 'square', t, t + 0.04, 0.03);
        }
      },
      fanfare(ac) {
        const t = ac.currentTime;
        function trumpet(freq, s, e, vol) {
          [1, 2, 3].forEach((h, hi) => schedNote(ac, freq * h, 'sawtooth', s, e, vol / (hi + 1)));
        }
        trumpet(262, t,       t + 0.15, 0.08);
        trumpet(262, t + 0.18, t + 0.33, 0.08);
        trumpet(330, t + 0.36, t + 0.51, 0.08);
        trumpet(392, t + 0.54, t + 0.69, 0.10);
        trumpet(523, t + 0.72, t + 1.25, 0.12);
      },
      previewDuration: 3.0
    },

    eightbit: {
      label: 'Retro 8-bit',
      tick(ac, n) {
        const scale = [262, 330, 392, 523];
        const t = ac.currentTime;
        schedNote(ac, scale[n % scale.length], 'square', t, t + 0.05, 0.07);
      },
      fanfare(ac) {
        const t = ac.currentTime;
        // C E G C E G C6 C6 C6
        [[523,0],[659,0.09],[784,0.18],[523,0.27],[659,0.36],[784,0.45],[1047,0.54],[1047,0.66],[1047,0.80]]
          .forEach(([f, off], i) =>
            schedNote(ac, f, 'square', t + off, t + off + (i >= 6 ? 0.2 : 0.08), 0.1));
      },
      previewDuration: 2.5
    }
  };

  // ---- sound UI ----
  function initSoundUI() {
    const container = document.getElementById('soundOptions');
    const saved = localStorage.getItem('gw_sound');
    if (saved && SOUND_THEMES[saved]) currentSound = saved;

    Object.entries(SOUND_THEMES).forEach(([key, theme]) => {
      const row = document.createElement('div');
      row.className = 'sound-option';

      const radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'sound';
      radio.id = 'snd-' + key; radio.value = key;
      radio.checked = key === currentSound;
      radio.addEventListener('change', () => {
        currentSound = key;
        localStorage.setItem('gw_sound', key);
      });

      const lbl = document.createElement('label');
      lbl.htmlFor = 'snd-' + key;
      lbl.textContent = theme.label;

      const btn = document.createElement('button');
      btn.className = 'preview-btn';
      btn.textContent = '▶';
      btn.title = 'Preview ' + theme.label;
      btn.addEventListener('click', () => {
        try {
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          // Play 8 ticks then fanfare
          const tmpCount = { n: 0 };
          for (let i = 0; i < 8; i++) {
            const tickAc = ac;
            const delay = i * 0.13;
            setTimeout(() => { theme.tick(tickAc, tmpCount.n++); }, delay * 1000);
          }
          setTimeout(() => { theme.fanfare(ac); }, 1200);
          btn.classList.add('playing'); btn.textContent = '♪';
          setTimeout(() => { btn.classList.remove('playing'); btn.textContent = '▶'; },
            (theme.previewDuration + 0.2) * 1000);
        } catch { /* no audio */ }
      });

      row.appendChild(radio);
      row.appendChild(lbl);
      row.appendChild(btn);
      container.appendChild(row);
    });
  }
  initSoundUI();

  // --- Spin ---
  const wheelWrapper = document.querySelector('.wheel-wrapper');

  function resetZoom() {
    wheelWrapper.style.transition = 'none';
    wheelWrapper.style.transform = 'scale(1)';
    wheelWrapper.style.transformOrigin = 'center top';
  }

  function spin() {
    if (spinning || entries.length < 2) return;
    spinning = true;
    spinBtn.disabled = true;
    winnerDisplay.innerHTML = '';
    hideCelebration();
    resetZoom();
    spinTickCount = 0;

    const spd = SPIN_DURATIONS[spinSpeed];
    const totalRotation = Math.PI * 2 * (5 + Math.random() * 5);
    const duration = spd.base + Math.random() * spd.variance;
    const startAngle = currentAngle;
    const startTime = performance.now();
    const zoomStart = 0.5; // start zooming at halfway through
    const maxZoom = 2.8;
    let zoomStarted = false;

    let audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ }

    let lastSegment = -1;

    function tick() {
      if (!audioCtx) return;
      SOUND_THEMES[currentSound].tick(audioCtx, spinTickCount++);
    }

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    // Smooth ease-in for the zoom (slow start, accelerates)
    function easeInCubic(t) {
      return t * t * t * t * t; // quintic — stays slow longer then rockets at the end
    }

    function animate(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOut(t);

      currentAngle = startAngle + totalRotation * eased;

      if (entries.length > 0) {
        const sliceAngle = (Math.PI * 2) / entries.length;
        const normalizedAngle = ((Math.PI * 2 - (currentAngle % (Math.PI * 2))) + Math.PI * 2) % (Math.PI * 2);
        const seg = Math.floor(normalizedAngle / sliceAngle) % entries.length;
        if (seg !== lastSegment) {
          tick();
          lastSegment = seg;
        }
      }

      // Zoom in during last 1/3 of spin
      if (t >= zoomStart) {
        const zoomT = (t - zoomStart) / (1 - zoomStart); // 0 to 1 over last third
        const zoomEased = easeInCubic(zoomT);
        const scale = 1 + (maxZoom - 1) * zoomEased;
        wheelWrapper.style.transition = 'none';
        wheelWrapper.style.transform = `scale(${scale})`;
      }

      drawWheel();

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        spinning = false;
        spinBtn.disabled = false;

        const sliceAngle = (Math.PI * 2) / entries.length;
        const pointerAngle = ((-Math.PI / 2 - currentAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const winnerIndex = Math.floor(pointerAngle / sliceAngle) % entries.length;
        const winner = entries[winnerIndex];

        // Show big celebration
        showCelebration(winner.name);

        // Zoom back out smoothly
        wheelWrapper.style.transition = 'transform 0.12s ease-in';
        wheelWrapper.style.transform = 'scale(1)';

        if (removeWinnerCheckbox.checked) {
          entries.splice(winnerIndex, 1);
          save();
          renderEntries();
          setTimeout(() => drawWheel(), 1500);
        }
      }
    }

    requestAnimationFrame(animate);
  }

  spinBtn.addEventListener('click', spin);

  // --- Twitch Chat Integration ---
  const channelInput = document.getElementById('channelInput');
  const twitchConnectBtn = document.getElementById('twitchConnectBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const preventDupes = document.getElementById('preventDupes');
  const twitchLog = document.getElementById('twitchLog');

  let ws = null;
  let twitchConnected = false;

  function setTwitchStatus(connected, text) {
    twitchConnected = connected;
    statusDot.className = 'status-dot ' + (connected ? 'on' : 'off');
    statusText.textContent = text;
    twitchConnectBtn.textContent = connected ? 'Disconnect' : 'Connect';
    twitchConnectBtn.className = connected ? 'connected' : '';
    channelInput.disabled = connected;
  }

  function logTwitch(msg, className) {
    const div = document.createElement('div');
    div.textContent = msg;
    if (className) div.className = className;
    twitchLog.appendChild(div);
    twitchLog.scrollTop = twitchLog.scrollHeight;
    while (twitchLog.children.length > 50) twitchLog.removeChild(twitchLog.firstChild);
  }

  function connectTwitch() {
    const channel = channelInput.value.trim().toLowerCase().replace(/^#/, '');
    if (!channel) return;

    localStorage.setItem('gw_channel', channel);
    twitchLog.innerHTML = '';
    logTwitch('Connecting to #' + channel + '...');

    ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    ws.onopen = () => {
      ws.send('CAP REQ :twitch.tv/tags');
      ws.send('NICK justinfan' + Math.floor(Math.random() * 99999));
      ws.send('JOIN #' + channel);
    };

    ws.onmessage = (event) => {
      const lines = event.data.split('\r\n');
      for (const line of lines) {
        if (!line) continue;

        if (line.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv');
          continue;
        }

        if (line.includes('366') || line.includes('JOIN')) {
          if (!twitchConnected && line.includes('JOIN')) {
            setTwitchStatus(true, 'Connected to #' + channel);
            logTwitch('Connected! Listening for !enter...');
          }
          continue;
        }

        // Parse PRIVMSG
        const privmsgMatch = line.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG #\w+ :(.+)/);
        if (privmsgMatch) {
          const username = privmsgMatch[1];
          const message = privmsgMatch[2].trim();

          // Match cmd1 or cmd2 (both support optional color arg)
          const cmd1 = cmd1Input.value.trim().toLowerCase();
          const cmd2 = cmd2Input.value.trim().toLowerCase();
          const msgLower = message.toLowerCase();
          const matchedCmd = (cmd1 && (msgLower === cmd1 || msgLower.startsWith(cmd1 + ' ')))
                          || (cmd2 && (msgLower === cmd2 || msgLower.startsWith(cmd2 + ' ')));
          if (matchedCmd) {
            const customColor = parseUserColor(message);

            // Extract Twitch name color from IRC tags
            let twitchColor = null;
            const colorMatch = line.match(/color=(#[0-9A-Fa-f]{6})/);
            if (colorMatch) twitchColor = colorMatch[1];

            // Priority: custom arg > twitch name color > fallback
            const chosenColor = customColor || twitchColor || null;

            // Check if already entered
            const existingIndex = entries.findIndex(e => e.name.toLowerCase() === username.toLowerCase());

            if (existingIndex !== -1) {
              // Already entered — update their color if they provided one
              if (customColor) {
                entries[existingIndex].color = customColor;
                save();
                renderEntries();
                drawWheel();
                logTwitch(username + ' updated color to ' + customColor, 'entry-added');
              } else if (preventDupes.checked) {
                logTwitch(username + ' already entered');
              }
              continue;
            }

            entries.push({ name: username, color: chosenColor });
            save();
            renderEntries();
            drawWheel();
            logTwitch('+ ' + username + ' entered!' + (customColor ? ' (color: ' + customColor + ')' : ''), 'entry-added');
          }
        }
      }
    };

    ws.onclose = () => {
      setTwitchStatus(false, 'Disconnected');
      logTwitch('Disconnected.');
      ws = null;
    };

    ws.onerror = () => {
      setTwitchStatus(false, 'Connection error');
      logTwitch('Connection error. Try again.');
      ws = null;
    };
  }

  function disconnectTwitch() {
    if (ws) { ws.close(); ws = null; }
  }

  twitchConnectBtn.addEventListener('click', () => {
    if (twitchConnected) disconnectTwitch();
    else connectTwitch();
  });

  channelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !twitchConnected) connectTwitch();
  });

  // Preload channel — saved preference wins, otherwise default to jadynviolet
  channelInput.value = localStorage.getItem('gw_channel') || 'jadynviolet';
  // Auto-connect on load
  connectTwitch();

  // --- Init ---
  load();
  updateAdminVisibility();
  renderEntries();
  drawWheel();

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
