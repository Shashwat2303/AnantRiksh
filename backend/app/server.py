"""
FastAPI Server for AnantRiksh
Serves Planck 2018 cosmological calculations, SDSS DR18 datasets, and the 3D Frontend.
"""
import os
import json
import time
from typing import Dict, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import numpy as np

from app.cosmology import Planck18Cosmology, CosmologyParams, cosmology_engine
from app.sdss_generator import generate_sdss_catalog, parse_custom_sdss_csv, LANDMARKS
from app.models import (
    CosmologyQueryRequest,
    CosmologyQueryResponse,
    CosmologyParamsSchema,
    LandmarkItem,
    CSVImportRequest,
    SpectrumResponse
)

app = FastAPI(
    title="AnantRiksh API",
    description="Planck 2018 Cosmological Engine & SDSS DR18 Galaxy Map",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cached dataset (generated on startup)
CATALOG_CACHE: Dict[str, Any] = {}

def get_or_create_catalog():
    global CATALOG_CACHE
    if not CATALOG_CACHE:
        print("[AnantRiksh] Generating 250,000 SDSS DR18 celestial points...")
        t0 = time.perf_counter()
        raw_catalog = generate_sdss_catalog(250000)
        dt = time.perf_counter() - t0
        print(f"[AnantRiksh] Generated {raw_catalog['count']:,} objects in {dt:.2f}s.")
        
        # Serialize arrays to native lists or base64 for fast JSON streaming
        CATALOG_CACHE = {
            "count": raw_catalog["count"],
            "positions": raw_catalog["positions"].tolist(),
            "color_params": raw_catalog["color_params"].tolist(),
            "redshifts": raw_catalog["redshifts"].tolist(),
            "is_qso": raw_catalog["is_qso"].tolist(),
            "landmark_ids": raw_catalog["landmark_ids"].tolist(),
            "mags_r": raw_catalog["mags_r"].tolist(),
            "mags_g": raw_catalog["mags_g"].tolist(),
            "orders": {
                "redshift": raw_catalog["orders"]["redshift"].tolist(),
                "scan": raw_catalog["orders"]["scan"].tolist(),
                "filaments": raw_catalog["orders"]["filaments"].tolist(),
                "random": raw_catalog["orders"]["random"].tolist(),
            }
        }
    return CATALOG_CACHE


@app.on_event("startup")
def startup_event():
    # Warm up catalog on server launch
    get_or_create_catalog()


@app.get("/api/catalog")
def get_catalog():
    """Returns the full 250,000 SDSS DR18 dataset."""
    catalog = get_or_create_catalog()
    return JSONResponse(content=catalog)


@app.get("/api/landmarks", response_model=list[LandmarkItem])
def get_landmarks():
    """Returns curated astronomical landmark beacons."""
    result = []
    for key, l in LANDMARKS.items():
        result.append(LandmarkItem(
            id=key,
            name=l.name,
            ra=l.ra,
            dec=l.dec,
            z=l.z,
            distance_mpc=l.distance_mpc,
            radius_mpc=l.radius_mpc,
            description=l.description
        ))
    return result


@app.post("/api/cosmology/calculate", response_model=CosmologyQueryResponse)
def calculate_cosmology(req: CosmologyQueryRequest):
    """Dynamically computes cosmological distances and times for a given redshift."""
    engine = cosmology_engine
    if req.params:
        p = CosmologyParams(
            H0=req.params.H0,
            Omega_m=req.params.Omega_m,
            Omega_lambda=req.params.Omega_lambda
        )
        engine = Planck18Cosmology(params=p)

    z = req.redshift
    d_mpc = float(engine.comoving_distance_mpc(z))
    t_gyr = float(engine.lookback_time_gyr(z))
    d_lum = float(engine.luminosity_distance_mpc(z))
    d_ang = float(engine.angular_diameter_distance_mpc(z))
    scale_a = 1.0 / (1.0 + z)
    total_age = float(engine.lookback_time_gyr(20.0))  # approx age of universe
    age_frac = max(0.0, 1.0 - (t_gyr / total_age))

    return CosmologyQueryResponse(
        redshift=z,
        comoving_distance_mpc=round(d_mpc, 2),
        comoving_distance_gpc=round(d_mpc / 1000.0, 3),
        lookback_time_gyr=round(t_gyr, 3),
        luminosity_distance_mpc=round(d_lum, 2),
        angular_diameter_distance_mpc=round(d_ang, 2),
        scale_factor_a=round(scale_a, 4),
        universe_age_fraction=round(age_frac, 4)
    )


@app.post("/api/sdss/import")
def import_csv(req: CSVImportRequest):
    """Parses custom SDSS DR18 SQL CSV export."""
    try:
        data = parse_custom_sdss_csv(req.csv_text, cosmology_engine)
        return {
            "count": data["count"],
            "positions": data["positions"].tolist(),
            "color_params": data["color_params"].tolist(),
            "redshifts": data["redshifts"].tolist(),
            "is_qso": data["is_qso"].tolist(),
            "landmark_ids": data["landmark_ids"].tolist(),
            "orders": {
                "redshift": data["orders"]["redshift"].tolist(),
                "scan": data["orders"]["scan"].tolist(),
                "filaments": data["orders"]["filaments"].tolist(),
                "random": data["orders"]["random"].tolist(),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/spectrum/{object_id}", response_model=SpectrumResponse)
def get_object_spectrum(object_id: int):
    """Generates synthetic emission & absorption spectrum for any clicked object."""
    cat = get_or_create_catalog()
    count = cat["count"]
    obj_id = max(0, min(count - 1, object_id))

    z = cat["redshifts"][obj_id]
    is_qso = bool(cat["is_qso"][obj_id])
    r_mag = cat["mags_r"][obj_id]
    g_mag = cat["mags_g"][obj_id]

    # Generate synthetic rest-frame wavelengths (350 nm to 900 nm)
    num_pts = 120
    rest_wl = np.linspace(340.0, 920.0, num_pts)
    obs_wl = rest_wl * (1.0 + z)

    # Blackbody continuum approximation
    temp = 4200 if not is_qso else 18500
    temp += int((obj_id % 3500) - 1750)
    
    # Planck blackbody law normalized
    wl_m = rest_wl * 1e-9
    c1, c2 = 3.74177185e-16, 1.43877687e-2
    flux = (c1 / (wl_m ** 5)) / (np.exp(c2 / (wl_m * temp)) - 1.0)
    flux = flux / np.max(flux) * 100.0

    # Add realistic spectral emission / absorption lines
    emission_lines = []
    if not is_qso:
        # Galaxy lines: H-alpha (656.3nm), H-beta (486.1nm), [O III] (500.7nm), Ca H&K (393.4, 396.8)
        spec_class = "Early Spiral Galaxy (Sbc)" if (obj_id % 2 == 0) else "Elliptical Galaxy (E2)"
        lines = [
            ("H-alpha (656.3 nm)", 656.3, 35.0, 4.0),
            ("[O III] (500.7 nm)", 500.7, 25.0, 3.5),
            ("H-beta (486.1 nm)", 486.1, 18.0, 3.0),
            ("Ca II K (393.4 nm)", 393.4, -20.0, 3.0),
            ("Ca II H (396.8 nm)", 396.8, -18.0, 3.0),
            ("Na I D (589.0 nm)", 589.0, -12.0, 2.5),
        ]
    else:
        # QSO broad lines: Ly-alpha (121.6nm), C IV (154.9nm), Mg II (279.8nm), H-beta, H-alpha
        spec_class = "Broad-Line Quasar (Type 1 QSO)" if (obj_id % 3 != 0) else "Radio-Loud AGN Quasar"
        lines = [
            ("H-alpha Broad (656.3 nm)", 656.3, 75.0, 18.0),
            ("H-beta Broad (486.1 nm)", 486.1, 45.0, 14.0),
            ("[O III] (500.7 nm)", 500.7, 30.0, 5.0),
            ("Mg II (279.8 nm)", 420.0, 50.0, 12.0),
            ("Continuum Blue Excess", 400.0, 20.0, 40.0)
        ]

    for name, center_wl, amp, width in lines:
        flux += amp * np.exp(-((rest_wl - center_wl) ** 2) / (2 * (width ** 2)))
        obs_center = center_wl * (1.0 + z)
        emission_lines.append({
            "name": name,
            "rest_wavelength_nm": round(center_wl, 1),
            "observed_wavelength_nm": round(obs_center, 1),
            "relative_strength": round(amp, 1)
        })

    flux = np.clip(flux + np.random.normal(0, 1.8, num_pts), 0.0, None)

    return SpectrumResponse(
        object_id=obj_id,
        redshift=round(float(z), 4),
        is_qso=is_qso,
        spectral_class=spec_class,
        temperature_k=int(temp),
        apparent_mag_r=round(float(r_mag), 2),
        apparent_mag_g=round(float(g_mag), 2),
        wavelengths_nm=[round(float(w), 1) for w in obs_wl],
        flux_densities=[round(float(f), 2) for f in flux],
        emission_lines=emission_lines
    )


# Mount Static Frontend
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

@app.get("/")
def serve_index():
    index_file = frontend_dir / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "AnantRiksh API Running. Frontend directory not found."}
