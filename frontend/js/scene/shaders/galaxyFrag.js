/**
 * Galaxy & Quasar Particle Fragment Shader
 */

export const galaxyFragShader = /* glsl */ `
precision highp float;

varying float vColorParam;
varying float vAlpha;
varying float vSpawnFlash;
varying float vIsQSO;
varying float vIsHighlighted;
varying float vLandmarkId;

// Scientific SDSS Galaxy Redshift Palette
vec3 getGalaxyColor(float t) {
  vec3 c0 = vec3(1.00, 0.99, 0.96); // Nearby Warm Diamond White
  vec3 c1 = vec3(1.00, 0.76, 0.32); // Intermediate Amber Gold
  vec3 c2 = vec3(0.96, 0.22, 0.14); // Distant Crimson Red

  if (t < 0.5) {
    return mix(c0, c1, t * 2.0);
  } else {
    return mix(c1, c2, (t - 0.5) * 2.0);
  }
}

// Scientific SDSS Quasar / Active Galactic Nuclei Palette
vec3 getQSOColor(float t) {
  vec3 c0 = vec3(0.12, 0.95, 1.00); // Electric Cyan
  vec3 c1 = vec3(0.22, 0.52, 1.00); // Sapphire Blue
  vec3 c2 = vec3(0.85, 0.30, 0.95); // Magenta Violet
  vec3 c3 = vec3(0.98, 0.18, 0.32); // Deep Primordial Red

  if (t < 0.33) {
    return mix(c0, c1, t * 3.03);
  } else if (t < 0.66) {
    return mix(c1, c2, (t - 0.33) * 3.03);
  } else {
    return mix(c2, c3, (t - 0.66) * 2.94);
  }
}

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float distSq = dot(coord, coord);
  float r = sqrt(distSq);

  if (distSq > 0.25) {
    discard;
  }

  // Crystal Core + Diffuse Halo for Ultra-HD Bloom
  float core = exp(-distSq * 55.0);
  float innerGlow = exp(-distSq * 20.0);
  float outerHalo = exp(-distSq * 6.5);
  float shape = max(core, mix(outerHalo, innerGlow, 0.72));

  vec3 baseColor;
  if (vColorParam < 0.5) {
    float t = clamp(vColorParam * 2.0, 0.0, 1.0);
    baseColor = getGalaxyColor(t);
  } else {
    float t = clamp((vColorParam - 0.5) * 2.0, 0.0, 1.0);
    baseColor = getQSOColor(t);
  }

  // Landmark Highlight Boost (e.g. Boötes Void or Sloan Wall)
  if (vIsHighlighted > 0.5) {
    baseColor = mix(baseColor, vec3(0.2, 1.0, 0.85), 0.55);
    shape = max(shape, outerHalo * 1.6);
  }

  // Supernova Birth Shockwave Flash
  if (vSpawnFlash > 0.005) {
    float ringRadius = 0.38 * (1.0 - vSpawnFlash);
    float ring = exp(-pow(r - ringRadius, 2.0) * 130.0) * vSpawnFlash * 2.0;

    vec3 flashColor = vec3(1.0, 1.0, 0.98);
    baseColor = mix(baseColor, flashColor, vSpawnFlash * 0.85);
    shape = min(1.0, shape * (1.0 + vSpawnFlash * 3.2) + ring);
  }

  float alpha = clamp(shape * vAlpha, 0.0, 1.0);
  if (alpha < 0.008) {
    discard;
  }

  // HDR Bloom Boost
  vec3 hdrColor = baseColor * (0.9 + 0.75 * core + 0.35 * innerGlow);

  gl_FragColor = vec4(hdrColor, alpha);
}
`;
