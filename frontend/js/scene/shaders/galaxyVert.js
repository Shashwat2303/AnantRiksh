/**
 * Galaxy & Quasar Particle Vertex Shader
 */

export const galaxyVertShader = /* glsl */ `
attribute float aColorParam;
attribute float aSpawnOrder;
attribute float aRedshift;
attribute float aIsQSO;
attribute float aLandmarkId;

uniform float uPlotProgress;
uniform float uMinZ;
uniform float uMaxZ;
uniform float uPointSize;
uniform float uTime;
uniform float uHDRExposure;
uniform vec3 uHighlightCenter;
uniform float uHighlightRadius;
uniform float uHighlightActive;
uniform float uPlotSpeed;

varying float vColorParam;
varying float vAlpha;
varying float vSpawnFlash;
varying float vIsQSO;
varying float vIsHighlighted;
varying float vLandmarkId;

void main() {
  vColorParam = aColorParam;
  vIsQSO = aIsQSO;
  vLandmarkId = aLandmarkId;

  // 1. Progressive Stream Filter
  if (aSpawnOrder > uPlotProgress) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }

  // 2. Redshift Slice Filter (minZ .. maxZ)
  if (aRedshift < uMinZ || aRedshift > uMaxZ) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }

  // 3. Eye Space Transformation
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = length(mvPosition.xyz);

  // 4. Inverse Distance Scaling for Pinpoint Precision
  float baseSize = uPointSize * (aIsQSO > 0.5 ? 1.4 : 1.1);
  float sizeDistFactor = clamp(480.0 / max(dist, 8.0), 0.5, 4.5);
  float ptSize = baseSize * sizeDistFactor;

  // 5. Supernova Spawn Starburst Pulse
  float spawnWindow = clamp(3.0 / max(1.0, uPlotSpeed), 0.003, 0.07);
  float timeSinceSpawn = (uPlotProgress - aSpawnOrder);
  float flash = 0.0;
  if (timeSinceSpawn >= 0.0 && timeSinceSpawn < spawnWindow) {
    float normFlash = 1.0 - (timeSinceSpawn / spawnWindow);
    flash = pow(normFlash, 1.6);
    ptSize *= (1.0 + flash * 3.8);
  }
  vSpawnFlash = flash;

  // 6. Landmark Highlight Active
  float highlighted = 0.0;
  if (uHighlightActive > 0.5) {
    float dHighlight = distance(position, uHighlightCenter);
    if (dHighlight < uHighlightRadius) {
      highlighted = 1.0;
      ptSize *= 1.6;
    }
  }
  vIsHighlighted = highlighted;

  // 7. Distance Alpha Compensation
  float densityComp = clamp(dist / 380.0, 0.4, 1.0);
  vAlpha = densityComp * uHDRExposure;
  if (highlighted > 0.5) {
    vAlpha = min(1.0, vAlpha * 1.8);
  }

  gl_PointSize = clamp(ptSize, 1.5, 52.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;
