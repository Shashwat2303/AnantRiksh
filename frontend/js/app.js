/**
 * AnantRiksh Main Client Entry Point
 */
import { CosmicScene } from './scene/CosmicScene.js';
import { CosmicAudio } from './audio/CosmicAudio.js';
import { SpectrumModal } from './ui/SpectrumModal.js';
import { HUD } from './ui/HUD.js';
import { fetchCatalogFromAPI, comovingDistanceMpc, lookbackTimeGyr } from './cosmologyClient.js';

class PlottingController {
  constructor(scene, audio = null) {
    this.scene = scene;
    this.audio = audio;
    this.totalCount = 0;
    this.currentCount = 0;
    this.speedPtsPerSec = 25000;
    this.isPlaying = true;
    this.plottingOrder = 'redshift';
    this.onProgressCallbacks = [];

    this.redshifts = null;
    this.isQSOArray = null;
  }

  setDataset(catalogData) {
    this.catalogData = catalogData;
    this.totalCount = catalogData.count;
    this.redshifts = catalogData.redshifts instanceof Float32Array
      ? catalogData.redshifts
      : new Float32Array(catalogData.redshifts);
    this.isQSOArray = catalogData.is_qso instanceof Uint8Array
      ? catalogData.is_qso
      : new Uint8Array(catalogData.is_qso);
    
    // Start progressive stream plotting from 0 up to 250,000 celestial objects
    this.currentCount = 0;
    this.isPlaying = true;

    this.scene.setPlottingOrder(this.plottingOrder);
    this.scene.setPlotProgress(0.0);
    this.scene.setPlotSpeed(this.speedPtsPerSec);
    this.notifyProgress();

    // Start background music as stars start getting plotted
    if (this.audio) {
      this.audio.playBackgroundMusic();
    }
  }

  onProgress(cb) {
    this.onProgressCallbacks.push(cb);
  }

  notifyProgress() {
    if (!this.totalCount) return;
    const norm = Math.min(1.0, this.currentCount / this.totalCount);
    const intCount = Math.floor(this.currentCount);

    let currentMaxZ = 0.02;
    if (this.plottingOrder === 'redshift') {
      const idx = Math.min(Math.max(0, intCount - 1), this.totalCount - 1);
      currentMaxZ = this.redshifts ? this.redshifts[idx] : 0.02;
    } else {
      currentMaxZ = Math.min(7.0, 0.02 + norm * 6.98);
    }

    const galaxiesCount = Math.round(intCount * 0.78);
    const qsosCount = intCount - galaxiesCount;
    const distMpc = comovingDistanceMpc(currentMaxZ);
    const lookbackGyr = lookbackTimeGyr(currentMaxZ);

    const stats = {
      currentCount: intCount,
      totalCount: this.totalCount,
      progressNorm: norm,
      galaxiesCount,
      qsosCount,
      currentMaxZ,
      distanceMpc: distMpc,
      lookbackGyr,
      isPlaying: this.isPlaying,
      speedPtsPerSec: this.speedPtsPerSec,
      order: this.plottingOrder
    };

    for (const cb of this.onProgressCallbacks) {
      cb(stats);
    }
  }

  setSpeed(ptsPerSec) {
    this.speedPtsPerSec = ptsPerSec;
    if (this.scene) this.scene.setPlotSpeed(ptsPerSec);
    this.notifyProgress();
  }

  setOrder(orderKey) {
    if (orderKey === this.plottingOrder) return;
    this.plottingOrder = orderKey;
    if (this.scene) this.scene.setPlottingOrder(orderKey);
    this.notifyProgress();
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.audio) {
      this.audio.syncWithPlotting(this.isPlaying);
    }
    this.notifyProgress();
    return this.isPlaying;
  }

  play() {
    this.isPlaying = true;
    if (this.audio) {
      this.audio.playBackgroundMusic();
    }
    this.notifyProgress();
  }

  pause() {
    this.isPlaying = false;
    if (this.audio) {
      this.audio.pauseBackgroundMusic();
    }
    this.notifyProgress();
  }

  reset() {
    this.currentCount = 0;
    this.isPlaying = false;
    if (this.scene) this.scene.setPlotProgress(0.0);
    if (this.audio) {
      this.audio.syncWithPlotting(false, true);
    }
    this.notifyProgress();
  }

  step(num = 1) {
    this.isPlaying = false;
    this.currentCount = Math.min(this.totalCount, this.currentCount + num);
    if (this.scene) this.scene.setPlotProgress(this.currentCount / this.totalCount);
    if (this.audio) {
      this.audio.playBackgroundMusic();
    }
    this.notifyProgress();
  }

  setCount(cnt) {
    this.currentCount = Math.max(0, Math.min(this.totalCount, cnt));
    if (this.scene) this.scene.setPlotProgress(this.currentCount / this.totalCount);
    this.notifyProgress();
  }

  update(deltaTime) {
    if (!this.isPlaying || this.totalCount === 0) return;

    if (this.currentCount >= this.totalCount) {
      this.isPlaying = false;
      this.currentCount = this.totalCount;
      this.notifyProgress();
      return;
    }

    if (this.speedPtsPerSec === Infinity) {
      this.currentCount = this.totalCount;
      this.isPlaying = false;
    } else {
      this.currentCount += this.speedPtsPerSec * deltaTime;
      if (this.currentCount > this.totalCount) {
        this.currentCount = this.totalCount;
        this.isPlaying = false;
      }
    }

    const progress = this.currentCount / this.totalCount;
    if (this.scene) this.scene.setPlotProgress(progress);
    this.notifyProgress();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // 1. Initialize 3D Engine & Scene
  const scene = new CosmicScene(container);

  // 2. Initialize Audio & Modals
  const audio = new CosmicAudio();
  const spectrumModal = new SpectrumModal();

  // 3. Initialize Controller & HUD
  const controller = new PlottingController(scene, audio);
  const hud = new HUD(controller, scene, audio, spectrumModal);

  // 4. Fetch 250,000 SDSS DR18 Catalog from Python 3.12 Backend API
  try {
    console.log("🌌 Fetching SDSS DR18 catalog from Python 3.12 FastAPI backend...");
    const t0 = performance.now();
    const catalog = await fetchCatalogFromAPI();
    console.log(`✨ Loaded ${catalog.count.toLocaleString()} objects in ${(performance.now() - t0).toFixed(1)} ms.`);

    scene.loadDataset(catalog);
    controller.setDataset(catalog);
  } catch (err) {
    console.error("Failed to load catalog from backend API:", err);
  }

  // 5. High-Precision Animation & Render Loop
  let lastTime = performance.now();
  let frameCount = 0;
  let lastFpsTime = performance.now();
  const fpsDisplay = document.getElementById('fps-display');

  function animate(now) {
    requestAnimationFrame(animate);

    const deltaMs = now - lastTime;
    lastTime = now;
    const deltaTime = Math.min(deltaMs * 0.001, 0.1);

    // Update FPS Counter
    frameCount++;
    if (now - lastFpsTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
      if (fpsDisplay) fpsDisplay.textContent = `${fps} FPS`;
      frameCount = 0;
      lastFpsTime = now;
    }

    // Advance progressive stream & 3D render
    controller.update(deltaTime);
    scene.update(deltaTime);
  }

  requestAnimationFrame(animate);

  window.__ANANTRIKSH__ = {
    scene,
    controller,
    hud,
    audio,
    spectrumModal
  };
  window.__COSMOVERSE__ = window.__ANANTRIKSH__;
});
