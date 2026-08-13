# 🌌 AnantRiksh (अनन्तरिक्ष)

**AnantRiksh** (*Infinite Space & Cosmos*) is a high-performance 3D WebGL astrophysical visualization platform rendering **250,000+ SDSS DR18 galaxies, quasars, and celestial structures** using precision **Planck 2018 ($\Lambda\text{CDM}$)** redshift cosmology.

---

## ✨ Features

- **250,000 Celestial Objects**: Full 3D rendering of SDSS DR18 spectroscopic galaxies, quasars, helical star creation bands, and cosmic web filaments.
- **Planck 2018 Cosmological Engine**: Real-time computation of comoving distance ($D_C$), lookback time ($t_L$), luminosity distance ($D_L$), and angular diameter distance ($D_A$) with Simpson's rule integration.
- **Interactive 3D Navigation**: Orbit, pan, zoom, cinematic auto-orbit, redshift fly-through, and focal tracking to major cosmic landmarks (Sloan Great Wall, Virgo Cluster, Shapley Supercluster, Boötes Void, etc.).
- **Object Inspector & Spectral Analysis**: Click any galaxy/quasar to inspect celestial coordinates ($\alpha, \delta$), redshift ($z$), distance, and simulated SED emission line spectra ($\text{H}\alpha, [\text{O III}], \text{Ly}\alpha, \text{C IV}$).
- **Video-Centric Glassmorphism UI**: Sleek futuristic HUD with real-time celestial telemetry, playback scrubbing, speed controls, and interactive cosmology calculator.
- **Synthesized Cosmic Audio**: Web Audio API ambient hum and Doppler redshift soundscapes mapped dynamically to camera velocity and lookback epoch.

---

## 🚀 Quickstart

### 1. Backend (FastAPI + NumPy)
```bash
cd backend
pip install -r requirements.txt
python run.py
```
*The FastAPI backend will start at `http://localhost:8000` and automatically serve the interactive 3D frontend.*

### 2. Frontend Only (Static Web Server)
```bash
cd frontend
# Serve with any static web server (e.g. Python http.server, Live Server, Netlify, Vercel)
python -m http.server 3000
```
*The frontend includes a fully self-contained client-side Planck 2018 cosmology engine and SDSS generator fallback if running standalone.*

---

## 🪐 Architecture

```
AnantRiksh/
├── backend/
│   ├── app/
│   │   ├── cosmology.py       # Planck 2018 Simpson's Rule integration engine
│   │   ├── sdss_generator.py  # SDSS DR18 astrophysical distribution generator
│   │   ├── models.py          # Pydantic schemas & landmark definitions
│   │   └── server.py          # FastAPI REST API & static file server
│   ├── requirements.txt
│   └── run.py                 # Backend server entry point
├── frontend/
│   ├── index.html             # Main entry point with glassmorphic HUD
│   ├── css/
│   │   └── style.css          # Sci-Fi glassmorphism design system
│   └── js/
│       ├── app.js             # Client lifecycle & animation controller
│       ├── cosmologyClient.js # Client cosmology engine & API bridge
│       ├── scene/             # Three.js 3D rendering (stars, galaxies, helical bands)
│       ├── audio/             # Web Audio API cosmic synthesizer
│       └── ui/                # HUD telemetry, inspector, spectrum modals
└── netlify.toml               # Single-command zero-config deployment
```
