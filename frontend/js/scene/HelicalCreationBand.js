/**
 * Helical Stellar Creation Band Engine
 * Generates an animated multi-scale 3D helical vortex of small and big stars
 * condensing into galaxies along cosmic spiral arms.
 */
import * as THREE from 'three';

export class HelicalCreationBand {
  constructor(scene, starCount = 42000) {
    this.scene = scene;
    this.starCount = starCount;
    this.createHelicalGeometry();
  }

  createHelicalGeometry() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.starCount * 3);
    const jitters = new Float32Array(this.starCount * 3);
    const colors = new Float32Array(this.starCount * 3);
    const sizes = new Float32Array(this.starCount);
    const curveParams = new Float32Array(this.starCount * 4); // [t (0..1), armId (0..2), isBigStar (0/1), twinkleSpeed]

    // Stellar lifecycle colors:
    // Electric Cyan, Diamond White, Supernova Gold, Sapphire Blue, Radiant Magenta
    const palette = [
      new THREE.Color(0x00f0ff), // Electric Cyan
      new THREE.Color(0xffffff), // Diamond White
      new THREE.Color(0xffaa33), // Stellar Gold
      new THREE.Color(0x3b82f6), // Sapphire Blue
      new THREE.Color(0xff2a6d), // Radiant Magenta
      new THREE.Color(0xa855f7)  // Cosmic Violet
    ];

    const numArms = 3;
    const turns = 4.0;

    for (let i = 0; i < this.starCount; i++) {
      const armId = i % numArms;
      const t = Math.random(); // Position along spiral arm [0, 1]

      const isBigStar = Math.random() < 0.10; // 10% massive radiant hypergiants
      const isMediumStar = !isBigStar && Math.random() < 0.30;
      const starScale = isBigStar ? (4.0 + Math.random() * 4.5) : (isMediumStar ? (2.0 + Math.random() * 1.6) : (0.9 + Math.random() * 0.9));

      // Dispersion jitter
      const dispersion = (20.0 + t * 260.0) * (isBigStar ? 0.35 : 1.0);
      const jx = (Math.random() - 0.5) * dispersion;
      const jy = (Math.random() - 0.5) * dispersion;
      const jz = (Math.random() - 0.5) * dispersion;

      const angle = t * turns * Math.PI * 2 + (armId * (Math.PI * 2 / numArms));
      const radius = 60.0 + Math.pow(t, 0.82) * 3800.0;
      const zHeight = (t - 0.5) * 2000.0 + Math.sin(t * Math.PI * 3) * 300.0;

      const x = radius * Math.cos(angle) + jx;
      const y = radius * Math.sin(angle) + jy;
      const z = zHeight + jz;

      const i3 = i * 3;
      positions[i3 + 0] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      jitters[i3 + 0] = jx;
      jitters[i3 + 1] = jy;
      jitters[i3 + 2] = jz;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i3 + 0] = col.r;
      colors[i3 + 1] = col.g;
      colors[i3 + 2] = col.b;

      sizes[i] = starScale;

      const i4 = i * 4;
      curveParams[i4 + 0] = t;
      curveParams[i4 + 1] = armId;
      curveParams[i4 + 2] = isBigStar ? 1.0 : 0.0;
      curveParams[i4 + 3] = 1.5 + Math.random() * 4.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aJitter', new THREE.BufferAttribute(jitters, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('curveParam', new THREE.BufferAttribute(curveParams, 4));

    const vert = /* glsl */ `
      attribute vec3 aJitter;
      attribute vec3 color;
      attribute float size;
      attribute vec4 curveParam;

      uniform float uTime;
      uniform float uSpeed;

      varying vec3 vColor;
      varying float vTwinkle;
      varying float vIsBigStar;

      void main() {
        vColor = color;
        float t0 = curveParam.x;
        float armId = curveParam.y;
        float isBig = curveParam.z;
        float twinkleSpeed = curveParam.w;
        vIsBigStar = isBig;

        // Flow along spiral helix over time
        float flowT = fract(t0 + uTime * 0.018 * uSpeed);

        float turns = 4.0;
        float angle = flowT * turns * 6.2831853 + (armId * (6.2831853 / 3.0));
        float radius = 60.0 + pow(flowT, 0.82) * 3800.0;
        float zHeight = (flowT - 0.5) * 2000.0 + sin(flowT * 9.42477) * 300.0;

        vec3 animatedPos = vec3(
          radius * cos(angle) + aJitter.x,
          radius * sin(angle) + aJitter.y,
          zHeight + aJitter.z
        );

        vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
        float dist = length(mvPosition.xyz);

        // Twinkle pulsating rhythm
        float twinkle = 0.8 + 0.35 * sin(uTime * twinkleSpeed + flowT * 25.0);
        vTwinkle = twinkle;

        float baseSize = size * 4.5 * twinkle;
        float sizeDistFactor = clamp(580.0 / max(dist, 10.0), 0.5, 6.5);
        gl_PointSize = clamp(baseSize * sizeDistFactor, 1.8, 72.0);

        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const frag = /* glsl */ `
      precision highp float;

      varying vec3 vColor;
      varying float vTwinkle;
      varying float vIsBigStar;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float distSq = dot(coord, coord);
        if (distSq > 0.25) discard;

        // Multi-tier Star Kernel (Sharp Core + Diffuse Halo)
        float core = exp(-distSq * 65.0);
        float inner = exp(-distSq * 22.0);
        float halo = exp(-distSq * 6.5);

        // Radiant 4-point Starburst Flare for massive stars
        float flare = 0.0;
        if (vIsBigStar > 0.5) {
          float crossH = exp(-abs(coord.y) * 45.0) * exp(-abs(coord.x) * 4.5);
          float crossV = exp(-abs(coord.x) * 45.0) * exp(-abs(coord.y) * 4.5);
          flare = (crossH + crossV) * 0.55;
        }

        float shape = max(core, mix(halo, inner, 0.72)) + flare;
        float alpha = clamp(shape * vTwinkle * 0.9, 0.0, 1.0);
        if (alpha < 0.008) discard;

        vec3 hdrColor = vColor * (1.15 + core * 1.0 + inner * 0.45);
        gl_FragColor = vec4(hdrColor, alpha);
      }
    `;

    this.uniforms = {
      uTime: { value: 0.0 },
      uSpeed: { value: 1.0 }
    };

    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(geo, this.mat);
    this.scene.add(this.points);
  }

  update(deltaTime) {
    if (this.uniforms) {
      this.uniforms.uTime.value += deltaTime;
    }
    if (this.points) {
      this.points.rotation.z += 0.02 * deltaTime;
    }
  }
}
