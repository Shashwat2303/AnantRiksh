"""
Pydantic API Schemas for AnantRiksh
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class CosmologyParamsSchema(BaseModel):
    H0: float = Field(67.4, description="Hubble constant in km/s/Mpc", ge=40.0, le=100.0)
    Omega_m: float = Field(0.315, description="Matter density parameter", ge=0.01, le=1.0)
    Omega_lambda: float = Field(0.685, description="Dark energy density parameter", ge=0.0, le=1.0)

class CosmologyQueryRequest(BaseModel):
    redshift: float = Field(..., description="Redshift z", ge=0.0, le=15.0)
    params: Optional[CosmologyParamsSchema] = None

class CosmologyQueryResponse(BaseModel):
    redshift: float
    comoving_distance_mpc: float
    comoving_distance_gpc: float
    lookback_time_gyr: float
    luminosity_distance_mpc: float
    angular_diameter_distance_mpc: float
    scale_factor_a: float
    universe_age_fraction: float

class LandmarkItem(BaseModel):
    id: str
    name: str
    ra: float
    dec: float
    z: float
    distance_mpc: float
    radius_mpc: float
    description: str

class CSVImportRequest(BaseModel):
    csv_text: str

class SpectrumResponse(BaseModel):
    object_id: int
    redshift: float
    is_qso: bool
    spectral_class: str
    temperature_k: int
    apparent_mag_r: float
    apparent_mag_g: float
    wavelengths_nm: List[float]
    flux_densities: List[float]
    emission_lines: List[Dict[str, Any]]
