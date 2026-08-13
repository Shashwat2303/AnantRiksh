"""
Planck 2018 Cosmological Distance & Lookback Time Engine
Implements flat Lambda-CDM model with Planck 2018 parameters.
"""
from dataclasses import dataclass
import math
import numpy as np

@dataclass(frozen=True)
class CosmologyParams:
    H0: float = 67.4          # Hubble constant in km / (s * Mpc)
    Omega_m: float = 0.315    # Matter density parameter
    Omega_lambda: float = 0.685  # Dark energy density parameter
    c: float = 299792.458     # Speed of light in km/s

    @property
    def DH(self) -> float:
        """Hubble Distance in Mpc = c / H0"""
        return self.c / self.H0

    @property
    def TH_Gyr(self) -> float:
        """Hubble Time in Gyr"""
        return (1.0 / self.H0) * 977.79222137


DEFAULT_PLANCK18 = CosmologyParams()

class Planck18Cosmology:
    """
    High-precision cosmological calculator with precomputed Simpson's rule lookup tables.
    """
    def __init__(self, params: CosmologyParams = DEFAULT_PLANCK18, table_size: int = 5000, max_z: float = 8.0):
        self.params = params
        self.table_size = table_size
        self.max_z = max_z
        self._init_lookup_table()

    def Ez(self, z: float | np.ndarray) -> float | np.ndarray:
        """Dimensionless expansion rate E(z) = sqrt(Omega_m * (1+z)^3 + Omega_lambda)"""
        opz = 1.0 + z
        return np.sqrt(self.params.Omega_m * (opz ** 3) + self.params.Omega_lambda)

    def _init_lookup_table(self):
        """Precomputes numerical integrals using Simpson's rule."""
        dz = self.max_z / (self.table_size - 1)
        z_grid = np.linspace(0.0, self.max_z, self.table_size)
        
        dist_grid = np.zeros(self.table_size, dtype=np.float64)
        time_grid = np.zeros(self.table_size, dtype=np.float64)
        
        acc_d = 0.0
        acc_t = 0.0
        
        for i in range(self.table_size - 1):
            z0 = z_grid[i]
            z1 = z0 + dz * 0.5
            z2 = z_grid[i + 1]
            
            # Comoving distance integrand: 1 / E(z)
            f0_d = 1.0 / self.Ez(z0)
            f1_d = 1.0 / self.Ez(z1)
            f2_d = 1.0 / self.Ez(z2)
            dDist = (dz / 6.0) * (f0_d + 4.0 * f1_d + f2_d) * self.params.DH
            
            # Lookback time integrand: 1 / ((1+z) * E(z))
            f0_t = 1.0 / ((1.0 + z0) * self.Ez(z0))
            f1_t = 1.0 / ((1.0 + z1) * self.Ez(z1))
            f2_t = 1.0 / ((1.0 + z2) * self.Ez(z2))
            dTime = (dz / 6.0) * (f0_t + 4.0 * f1_t + f2_t) * self.params.TH_Gyr
            
            acc_d += dDist
            acc_t += dTime
            dist_grid[i + 1] = acc_d
            time_grid[i + 1] = acc_t

        self.z_grid = z_grid
        self.dist_grid = dist_grid
        self.time_grid = time_grid

    def comoving_distance_mpc(self, z: float | np.ndarray) -> float | np.ndarray:
        """Returns comoving distance in Megaparsecs (Mpc) for redshift z."""
        return np.interp(z, self.z_grid, self.dist_grid)

    def lookback_time_gyr(self, z: float | np.ndarray) -> float | np.ndarray:
        """Returns cosmic lookback time in Billion Years (Gyr) for redshift z."""
        return np.interp(z, self.z_grid, self.time_grid)

    def luminosity_distance_mpc(self, z: float | np.ndarray) -> float | np.ndarray:
        """D_L = (1 + z) * D_C"""
        d_c = self.comoving_distance_mpc(z)
        return (1.0 + z) * d_c

    def angular_diameter_distance_mpc(self, z: float | np.ndarray) -> float | np.ndarray:
        """D_A = D_C / (1 + z)"""
        d_c = self.comoving_distance_mpc(z)
        return d_c / (1.0 + z)

    def radec_z_to_cartesian(
        self,
        ra_deg: np.ndarray,
        dec_deg: np.ndarray,
        z: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Transforms astronomical sky coordinates (RA, Dec, z) to 3D Cartesian coordinates (x, y, z in Mpc)
        along with comoving distance and lookback time.
        """
        ra_rad = np.radians(ra_deg)
        dec_rad = np.radians(dec_deg)
        d_mpc = self.comoving_distance_mpc(z)
        lookback = self.lookback_time_gyr(z)

        cos_dec = np.cos(dec_rad)
        x = d_mpc * cos_dec * np.cos(ra_rad)
        y = d_mpc * cos_dec * np.sin(ra_rad)
        z_coord = d_mpc * np.sin(dec_rad)

        return x, y, z_coord, d_mpc, lookback


# Global default instance
cosmology_engine = Planck18Cosmology()
