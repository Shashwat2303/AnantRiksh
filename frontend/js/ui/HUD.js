/**
 * Video-Centric HUD & Single-Corner Command Deck Manager
 */
import { comovingDistanceMpc, lookbackTimeGyr, importCSVToAPI } from '../cosmologyClient.js';

export class HUD {
  constructor(controller, scene, audio, spectrumModal) {
    this.controller = controller;
    this.scene = scene;
    this.audio = audio;
    this.spectrumModal = spectrumModal;

    this.minZFilter = 0.00;
    this.maxZFilter = 0.30;
    this.uiHidden = false;

    this.bindEvents();
    this.bindKeyboardShortcuts();
    this.bindCanvasInteractions();

    this.controller.onProgress(stats => this.updateTelemetry(stats));
  }

  bindEvents() {
    // 1. Play / Pause
    const playPauseBtn = document.getElementById('btn-play-pause');
    const playPauseIcon = document.getElementById('play-pause-icon');
    const playPauseLabel = document.getElementById('play-pause-label');
    const dockPlayPause = document.getElementById('dock-play-pause');

    const togglePlay = () => {
      const isPlaying = this.controller.togglePlay();
      if (playPauseIcon) playPauseIcon.textContent = isPlaying ? '⏸' : '▶';
      if (playPauseLabel) playPauseLabel.textContent = isPlaying ? 'Pause' : 'Play';
      if (dockPlayPause) dockPlayPause.textContent = isPlaying ? '⏸' : '▶';
      if (playPauseBtn) playPauseBtn.classList.toggle('paused', !isPlaying);
    };

    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
    if (dockPlayPause) dockPlayPause.addEventListener('click', togglePlay);

    // 2. Step & Reset
    const stepBtn = document.getElementById('btn-step');
    if (stepBtn) {
      stepBtn.addEventListener('click', () => {
        this.controller.step(1);
        if (playPauseIcon) playPauseIcon.textContent = '▶';
        if (playPauseLabel) playPauseLabel.textContent = 'Play';
        if (dockPlayPause) dockPlayPause.textContent = '▶';
      });
    }

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.controller.reset();
        if (playPauseIcon) playPauseIcon.textContent = '▶';
        if (playPauseLabel) playPauseLabel.textContent = 'Play';
        if (dockPlayPause) dockPlayPause.textContent = '▶';
      });
    }

    // 3. Scrubber
    const scrubber = document.getElementById('slider-scrubber');
    if (scrubber) {
      scrubber.addEventListener('input', e => {
        const val = parseFloat(e.target.value);
        const targetCount = (val / 1000.0) * this.controller.totalCount;
        this.controller.setCount(targetCount);
      });
    }

    // 4. Speed pills
    const speedPills = document.querySelectorAll('.speed-pill');
    speedPills.forEach(pill => {
      pill.addEventListener('click', () => {
        speedPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const spdStr = pill.getAttribute('data-speed');
        const spd = spdStr === 'Infinity' ? Infinity : parseFloat(spdStr);
        this.controller.setSpeed(spd);
      });
    });

    // 5. Order selector
    const orderSelect = document.getElementById('select-order');
    if (orderSelect) {
      orderSelect.addEventListener('change', e => {
        this.controller.setOrder(e.target.value);
      });
    }

    // 6. Landmark travel pills
    const landmarkBtns = document.querySelectorAll('[data-landmark]');
    landmarkBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        landmarkBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const name = btn.getAttribute('data-landmark');
        this.scene.flyToLandmark(name);
      });
    });

    // 7. Auto-Orbit
    const orbitBtn = document.getElementById('btn-auto-orbit');
    const dockOrbit = document.getElementById('dock-orbit');
    const toggleOrbit = () => {
      const isOrbiting = this.scene.toggleAutoOrbit();
      if (orbitBtn) orbitBtn.classList.toggle('active', isOrbiting);
      if (dockOrbit) dockOrbit.classList.toggle('active', isOrbiting);
    };
    if (orbitBtn) orbitBtn.addEventListener('click', toggleOrbit);
    if (dockOrbit) dockOrbit.addEventListener('click', toggleOrbit);

    // 8. Transparent Background
    const bgTransBtn = document.getElementById('btn-transparent-bg');
    const dockTransBtn = document.getElementById('dock-transparent');
    const toggleTrans = () => {
      const isTrans = this.scene.toggleTransparentBackground();
      if (bgTransBtn) bgTransBtn.classList.toggle('active', isTrans);
      if (dockTransBtn) dockTransBtn.classList.toggle('active', isTrans);
    };
    if (bgTransBtn) bgTransBtn.addEventListener('click', toggleTrans);
    if (dockTransBtn) dockTransBtn.addEventListener('click', toggleTrans);

    // 9. Fullscreen
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) fsBtn.addEventListener('click', () => this.toggleFullscreen());

    // 10. Hide UI / Screen Recording Mode
    const btnHideUI = document.getElementById('btn-hide-ui');
    const dockExit = document.getElementById('dock-exit');
    if (btnHideUI) btnHideUI.addEventListener('click', () => this.toggleUIVisibility());
    if (dockExit) dockExit.addEventListener('click', () => this.toggleUIVisibility());

    // 11. Audio Toggle (Background Music: Chanakya By Rishabh Sharma)
    const audioBtn = document.getElementById('btn-audio-toggle');
    const audioIcon = document.getElementById('audio-icon');

    const syncAudioButton = (state) => {
      const isPlaying = state ? state.isPlaying : (this.audio && this.audio.isMusicPlaying);
      if (audioBtn) audioBtn.classList.toggle('active', isPlaying);
      if (audioIcon) audioIcon.textContent = isPlaying ? '🔊' : '🔇';
    };

    if (this.audio && this.audio.onStateChange) {
      this.audio.onStateChange(syncAudioButton);
    }

    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isAudioOn = this.audio.toggleMusic();
        syncAudioButton({ isPlaying: isAudioOn });
      });
    }

    // 12. Toggle Histogram Drawer
    const histDrawerBtn = document.getElementById('btn-toggle-histogram');
    const histDrawer = document.getElementById('card-histogram');
    if (histDrawerBtn && histDrawer) {
      histDrawerBtn.addEventListener('click', () => {
        histDrawer.classList.toggle('hidden');
        histDrawerBtn.classList.toggle('active', !histDrawer.classList.contains('hidden'));
        if (!histDrawer.classList.contains('hidden')) {
          this.drawHistogram();
        }
      });
    }

    // 13. Redshift Slice Filter
    const applyFilterBtn = document.getElementById('btn-apply-filter');
    if (applyFilterBtn) {
      applyFilterBtn.addEventListener('click', () => {
        const minInput = document.getElementById('input-min-z').value;
        const minVal = minInput !== '' ? parseFloat(minInput) : 0.00;
        const maxVal = parseFloat(document.getElementById('input-max-z').value) || 0.30;
        this.minZFilter = minVal;
        this.maxZFilter = maxVal;
        this.scene.setRedshiftRange(minVal, maxVal);
        this.drawHistogram();
      });
    }

    const resetFilterBtn = document.getElementById('btn-reset-filter');
    if (resetFilterBtn) {
      resetFilterBtn.addEventListener('click', () => {
        this.minZFilter = 0.00;
        this.maxZFilter = 7.0;
        document.getElementById('input-min-z').value = '0.00';
        document.getElementById('input-max-z').value = '7.0';
        this.scene.setRedshiftRange(0.00, 7.0);
        this.drawHistogram();
      });
    }

    // 14. CSV Modal
    const csvModal = document.getElementById('csv-modal');
    const importBtn = document.getElementById('btn-import-csv');
    const closeCsvBtn = document.getElementById('btn-close-csv');
    const cancelCsvBtn = document.getElementById('btn-cancel-import');
    const confirmCsvBtn = document.getElementById('btn-confirm-import');

    if (importBtn && csvModal) importBtn.addEventListener('click', () => csvModal.classList.remove('hidden'));
    if (closeCsvBtn && csvModal) closeCsvBtn.addEventListener('click', () => csvModal.classList.add('hidden'));
    if (cancelCsvBtn && csvModal) cancelCsvBtn.addEventListener('click', () => csvModal.classList.add('hidden'));

    if (confirmCsvBtn) {
      confirmCsvBtn.addEventListener('click', async () => {
        const csvText = document.getElementById('csv-textarea').value;
        try {
          const importedData = await importCSVToAPI(csvText);
          this.scene.loadDataset(importedData);
          this.controller.setDataset(importedData);
          csvModal.classList.add('hidden');
        } catch (err) {
          alert("Error importing CSV: " + err.message);
        }
      });
    }
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const key = e.key.toLowerCase();
      if (key === 'f') {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (key === 'h') {
        e.preventDefault();
        this.toggleUIVisibility();
      } else if (key === 'o') {
        e.preventDefault();
        const isOrbiting = this.scene.toggleAutoOrbit();
        const orbitBtn = document.getElementById('btn-auto-orbit');
        const dockOrbit = document.getElementById('dock-orbit');
        if (orbitBtn) orbitBtn.classList.toggle('active', isOrbiting);
        if (dockOrbit) dockOrbit.classList.toggle('active', isOrbiting);
      } else if (key === 't') {
        e.preventDefault();
        const isTrans = this.scene.toggleTransparentBackground();
        const bgTransBtn = document.getElementById('btn-transparent-bg');
        const dockTransBtn = document.getElementById('dock-transparent');
        if (bgTransBtn) bgTransBtn.classList.toggle('active', isTrans);
        if (dockTransBtn) dockTransBtn.classList.toggle('active', isTrans);
      } else if (key === 'm') {
        e.preventDefault();
        const isAudioOn = this.audio.toggleMusic();
        const audioBtn = document.getElementById('btn-audio-toggle');
        const audioIcon = document.getElementById('audio-icon');
        if (audioBtn) audioBtn.classList.toggle('active', isAudioOn);
        if (audioIcon) audioIcon.textContent = isAudioOn ? '🔊' : '🔇';
      } else if (e.code === 'Space') {
        e.preventDefault();
        const isPlaying = this.controller.togglePlay();
        const playPauseIcon = document.getElementById('play-pause-icon');
        const playPauseLabel = document.getElementById('play-pause-label');
        const dockPlayPause = document.getElementById('dock-play-pause');
        const playPauseBtn = document.getElementById('btn-play-pause');
        if (playPauseIcon) playPauseIcon.textContent = isPlaying ? '⏸' : '▶';
        if (playPauseLabel) playPauseLabel.textContent = isPlaying ? 'Pause' : 'Play';
        if (dockPlayPause) dockPlayPause.textContent = isPlaying ? '⏸' : '▶';
        if (playPauseBtn) playPauseBtn.classList.toggle('paused', !isPlaying);
      } else if (key === 'r') {
        e.preventDefault();
        this.controller.reset();
        const playPauseIcon = document.getElementById('play-pause-icon');
        const playPauseLabel = document.getElementById('play-pause-label');
        const dockPlayPause = document.getElementById('dock-play-pause');
        if (playPauseIcon) playPauseIcon.textContent = '▶';
        if (playPauseLabel) playPauseLabel.textContent = 'Play';
        if (dockPlayPause) dockPlayPause.textContent = '▶';
      }
    });
  }

  bindCanvasInteractions() {
    window.addEventListener('dblclick', e => {
      if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(e.target.tagName)) return;
      if (e.target.closest('.glass-card')) return;
      e.preventDefault();

      const hitIdx = this.scene.zoomAtScreenPoint(e.clientX, e.clientY, 'in');
      if (hitIdx !== null) {
        const isQSO = this.controller.isQSOArray ? this.controller.isQSOArray[hitIdx] === 1 : false;
        this.audio.playObjectInspectChime(isQSO);
        this.spectrumModal.inspectObject(hitIdx);
      }
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  toggleUIVisibility() {
    this.uiHidden = !this.uiHidden;
    const elementsToHide = ['card-telemetry', 'card-controller', 'brand-watermark'];
    elementsToHide.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden-hud', this.uiHidden);
    });
    const dock = document.getElementById('recording-dock');
    if (dock) dock.classList.toggle('hidden', !this.uiHidden);
  }

  updateTelemetry(stats) {
    const countEl = document.getElementById('stat-count');
    if (countEl) {
      countEl.textContent = stats.currentCount.toLocaleString();
    }

    const galEl = document.getElementById('stat-galaxies');
    if (galEl) galEl.textContent = stats.galaxiesCount.toLocaleString();

    const qsoEl = document.getElementById('stat-qsos');
    if (qsoEl) qsoEl.textContent = stats.qsosCount.toLocaleString();

    const progressEl = document.getElementById('stat-progress-bar');
    if (progressEl) progressEl.style.width = `${(stats.progressNorm * 100).toFixed(1)}%`;

    const scrubber = document.getElementById('slider-scrubber');
    if (scrubber && document.activeElement !== scrubber) {
      scrubber.value = Math.round(stats.progressNorm * 1000);
    }

    // Sync play / pause UI controls with stream state
    const playPauseIcon = document.getElementById('play-pause-icon');
    const playPauseLabel = document.getElementById('play-pause-label');
    const dockPlayPause = document.getElementById('dock-play-pause');
    const playPauseBtn = document.getElementById('btn-play-pause');
    if (playPauseIcon) playPauseIcon.textContent = stats.isPlaying ? '⏸' : '▶';
    if (playPauseLabel) playPauseLabel.textContent = stats.isPlaying ? 'Pause' : 'Play';
    if (dockPlayPause) dockPlayPause.textContent = stats.isPlaying ? '⏸' : '▶';
    if (playPauseBtn) playPauseBtn.classList.toggle('paused', !stats.isPlaying);

    const pctLabel = document.getElementById('scrubber-pct-label');
    if (pctLabel) pctLabel.textContent = `${(stats.progressNorm * 100).toFixed(1)}%`;

    const redshiftEl = document.getElementById('stat-redshift');
    if (redshiftEl) redshiftEl.textContent = `z = 0.00 — ${stats.currentMaxZ.toFixed(2)}`;

    const distEl = document.getElementById('stat-distance');
    if (distEl) {
      distEl.textContent = stats.distanceMpc > 1000
        ? `${(stats.distanceMpc / 1000).toFixed(2)} Gpc`
        : `${stats.distanceMpc.toFixed(0)} Mpc`;
    }

    const lookbackEl = document.getElementById('stat-lookback');
    if (lookbackEl) lookbackEl.textContent = `${stats.lookbackGyr.toFixed(2)} Gyr ago`;

    const dockCount = document.getElementById('dock-count');
    if (dockCount) {
      dockCount.textContent = `${stats.currentCount.toLocaleString()} / ${stats.totalCount.toLocaleString()}`;
    }

    const histDrawer = document.getElementById('card-histogram');
    if (histDrawer && !histDrawer.classList.contains('hidden')) {
      this.drawHistogram(stats.currentCount);
    }
  }

  drawHistogram(plottedLimit = null) {
    const svg = document.getElementById('histogram-svg');
    if (!svg || !this.controller.redshifts) return;

    const limit = plottedLimit !== null ? plottedLimit : this.controller.currentCount;
    const numBins = 40;
    const dz = (this.maxZFilter - this.minZFilter) / numBins;
    const galBins = new Int32Array(numBins);
    const qsoBins = new Int32Array(numBins);

    const redshifts = this.controller.redshifts;
    const isQSO = this.controller.isQSOArray;

    for (let i = 0; i < limit; i++) {
      const z = redshifts[i];
      if (z >= this.minZFilter && z <= this.maxZFilter) {
        const b = Math.min(Math.floor((z - this.minZFilter) / dz), numBins - 1);
        if (isQSO[i] === 0) galBins[b]++;
        else qsoBins[b]++;
      }
    }

    const maxVal = Math.max(10, ...Array.from(galBins).map((v, i) => v + qsoBins[i]));
    const width = 400;
    const height = 90;
    const bw = width / numBins;

    let svgHTML = '';
    for (let i = 0; i < numBins; i++) {
      const gH = (galBins[i] / maxVal) * (height - 16);
      const qH = (qsoBins[i] / maxVal) * (height - 16);
      const x = i * bw;
      const yG = height - gH;
      const yQ = yG - qH;

      if (gH > 0) svgHTML += `<rect x="${x + 0.5}" y="${yG}" width="${bw - 1}" height="${gH}" class="hist-bar-gal" />`;
      if (qH > 0) svgHTML += `<rect x="${x + 0.5}" y="${yQ}" width="${bw - 1}" height="${qH}" class="hist-bar-qso" />`;
    }

    svgHTML += `<line x1="0" y1="${height - 1}" x2="${width}" y2="${height - 1}" stroke="#223355" stroke-width="1" />`;
    svgHTML += `<text x="4" y="${height - 4}" class="hist-label">z=${this.minZFilter.toFixed(2)}</text>`;
    svgHTML += `<text x="${width - 45}" y="${height - 4}" class="hist-label">z=${this.maxZFilter.toFixed(2)}</text>`;

    svg.innerHTML = svgHTML;
  }
}
