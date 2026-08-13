/**
 * Cosmic Synth & Soundtrack Audio Engine
 * Integrates "Chanakya By Rishabh Sharma" as background score for star plotting
 * along with atmospheric deep-space synthesizers and interactive UI sonification.
 */

export class CosmicAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.droneGain = null;
    this.oscillators = [];
    
    // Background music track state
    this.isMusicPlaying = false;
    this.isMuted = false;
    this.targetVolume = 0.75;
    this.fadeInterval = null;
    this.userInteracted = false;
    this.onStateChangeCallbacks = [];

    // Initialize HTML5 Audio with cross-origin & auto-path resolution
    try {
      const trackUrl = new URL('./Chanakya By Rishabh Sharma.mp3', import.meta.url).href;
      this.bgMusic = new Audio(trackUrl);
    } catch (e) {
      this.bgMusic = new Audio('./js/audio/Chanakya%20By%20Rishabh%20Sharma.mp3');
    }
    
    this.bgMusic.loop = true;
    this.bgMusic.preload = 'auto';
    this.bgMusic.volume = this.targetVolume;

    // Listen to user interaction to unlock audio context & media playback on restricted browsers
    this.setupAutoplayUnblocker();
  }

  setupAutoplayUnblocker() {
    const unlock = () => {
      this.userInteracted = true;
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.isMusicPlaying && this.bgMusic.paused) {
        this.bgMusic.play().catch(e => console.debug('Audio unlock play:', e));
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.push(cb);
  }

  notifyStateChange() {
    for (const cb of this.onStateChangeCallbacks) {
      cb({ isPlaying: this.isMusicPlaying, isMuted: this.isMuted, volume: this.targetVolume });
    }
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master volume
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Ambient Drone gain
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      this.droneGain.connect(this.masterGain);

      // Create subtle Ambient Space Harmonic Drone (55Hz A1, 110Hz A2, 164.81Hz E3)
      const freqs = [55.0, 110.0, 164.81];
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const oscGain = this.ctx.createGain();

        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, this.ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220 + i * 80, this.ctx.currentTime);

        oscGain.gain.setValueAtTime(0.12 / (i + 1), this.ctx.currentTime);

        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(this.droneGain);
        osc.start();

        this.oscillators.push(osc);
      });
    } catch (err) {
      console.warn("Web Audio API not fully available:", err);
    }
  }

  /**
   * Starts or resumes background soundtrack ("Chanakya By Rishabh Sharma")
   */
  playBackgroundMusic() {
    if (this.isMuted) return;
    this.isMusicPlaying = true;
    this.init();

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.droneGain && this.ctx) {
      this.droneGain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.5);
    }

    this.bgMusic.volume = this.targetVolume;
    const playPromise = this.bgMusic.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.notifyStateChange();
      }).catch(err => {
        // Autoplay policy prevented immediate playback; waiting for user interaction
        console.debug("Autoplay waiting for user gesture:", err.message);
        this.notifyStateChange();
      });
    }
  }

  /**
   * Pauses background soundtrack
   */
  pauseBackgroundMusic() {
    this.isMusicPlaying = false;
    this.bgMusic.pause();

    if (this.droneGain && this.ctx) {
      this.droneGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.4);
    }
    this.notifyStateChange();
  }

  /**
   * Resets track to start and plays
   */
  restartBackgroundMusic() {
    this.bgMusic.currentTime = 0;
    this.playBackgroundMusic();
  }

  /**
   * Toggles music on / off
   */
  toggleMusic() {
    if (this.isMusicPlaying) {
      this.pauseBackgroundMusic();
    } else {
      this.isMuted = false;
      this.playBackgroundMusic();
    }
    return this.isMusicPlaying;
  }

  /**
   * Toggles mute
   */
  toggleDrone() {
    return this.toggleMusic();
  }

  /**
   * Synchronize audio with star plotting lifecycle
   */
  syncWithPlotting(isPlaying, isReset = false) {
    if (isReset) {
      this.bgMusic.currentTime = 0;
    }
    if (isPlaying) {
      this.playBackgroundMusic();
    } else {
      this.pauseBackgroundMusic();
    }
  }

  /**
   * Play celestial chime upon clicking an object
   */
  playObjectInspectChime(isQSO = false) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isQSO ? 'sawtooth' : 'sine';
    const freq = isQSO ? 880 : 587.33;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }
}
