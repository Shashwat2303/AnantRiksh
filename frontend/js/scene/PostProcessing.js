/**
 * Post-Processing Pipeline: UnrealBloomPass & RenderPass
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PostProcessingManager {
  constructor(renderer, scene, camera, width, height) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.width = width;
    this.height = height;

    this.enabled = true;
    this.initComposer();
  }

  initComposer() {
    const renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      samples: 4
    });

    this.composer = new EffectComposer(this.renderer, renderTarget);

    // 1. Base Render Pass
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // 2. Unreal Bloom Pass
    const bloomParams = {
      threshold: 0.15,
      strength: 1.25,
      radius: 0.65
    };
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      bloomParams.strength,
      bloomParams.radius,
      bloomParams.threshold
    );
    this.composer.addPass(this.bloomPass);

    // 3. Output Pass (sRGB / Tone mapping)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.composer.setSize(width, height);
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  }

  setBloomStrength(val) {
    if (this.bloomPass) this.bloomPass.strength = val;
  }

  toggleBloom() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  render() {
    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
