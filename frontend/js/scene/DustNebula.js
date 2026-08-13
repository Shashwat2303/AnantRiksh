/**
 * Ambient Cosmic Nebula & Deep-Space Dust Particle Cloud
 */
import * as THREE from 'three';

export class DustNebula {
  constructor(scene, count = 12000) {
    this.scene = scene;
    this.count = count;
    this.createDustField();
  }

  createDustField() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);
    const sizes = new Float32Array(this.count);

    const colorPalette = [
      new THREE.Color(0x00f0ff), // Cyan
      new THREE.Color(0x3b82f6), // Deep Blue
      new THREE.Color(0x8b5cf6), // Violet
      new THREE.Color(0xff2a6d), // Magenta
      new THREE.Color(0xffaa33)  // Amber
    ];

    for (let i = 0; i < this.count; i++) {
      // Distribute in huge spherical shell surrounding the SDSS survey volume (radius 500 to 14000 Mpc)
      const radius = 600 + Math.pow(Math.random(), 0.5) * 12000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const i3 = i * 3;
      positions[i3 + 0] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i3 + 0] = col.r;
      colors[i3 + 1] = col.g;
      colors[i3 + 2] = col.b;

      sizes[i] = 1.0 + Math.random() * 2.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for soft nebula glow
    const vert = /* glsl */ `
      attribute vec3 color;
      attribute float size;
      varying vec3 vColor;
      varying float vDistAlpha;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float d = length(mvPosition.xyz);
        vDistAlpha = clamp(d / 4000.0, 0.15, 0.65);
        gl_PointSize = size * (400.0 / max(d, 50.0));
        gl_PointSize = clamp(gl_PointSize, 1.0, 16.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const frag = /* glsl */ `
      precision highp float;
      varying vec3 vColor;
      varying float vDistAlpha;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float distSq = dot(coord, coord);
        if (distSq > 0.25) discard;
        float alpha = exp(-distSq * 12.0) * vDistAlpha * 0.35;
        gl_FragColor = vec4(vColor, alpha);
      }
    `;

    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(geo, this.mat);
    this.scene.add(this.points);
  }

  update(deltaTime) {
    if (this.points) {
      // Extremely slow graceful rotation
      this.points.rotation.y += 0.005 * deltaTime;
    }
  }
}
