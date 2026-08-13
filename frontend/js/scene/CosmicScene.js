/**
 * Three.js 3D Cosmic Visualization Scene Engine
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { galaxyVertShader } from './shaders/galaxyVert.js';
import { galaxyFragShader } from './shaders/galaxyFrag.js';
import { PostProcessingManager } from './PostProcessing.js';
import { DustNebula } from './DustNebula.js';
import { HelicalCreationBand } from './HelicalCreationBand.js';

export class CosmicScene {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth || window.innerWidth;
    this.height = container.clientHeight || window.innerHeight;

    // 1. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.setClearColor(0x030307, 1.0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 1.0, 35000.0);
    this.camera.position.set(220, 380, 1150);

    // 3. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 25000.0;
    this.controls.minDistance = 4.0;
    this.controls.target.set(0, 0, 0);

    // 4. Uniforms
    this.uniforms = {
      uPlotProgress: { value: 1.0 },
      uMinZ: { value: 0.00 },
      uMaxZ: { value: 0.30 },
      uPointSize: { value: 3.8 },
      uTime: { value: 0.0 },
      uHDRExposure: { value: 1.4 },
      uHighlightActive: { value: 0.0 },
      uHighlightCenter: { value: new THREE.Vector3(0, 0, 0) },
      uHighlightRadius: { value: 45.0 },
      uPlotSpeed: { value: 4500.0 }
    };

    // 5. Post Processing & Background Nebula
    this.postProcessing = new PostProcessingManager(
      this.renderer,
      this.scene,
      this.camera,
      this.width,
      this.height
    );
    this.dustNebula = new DustNebula(this.scene, 14000);

    // 6. Helical Star & Galaxy Creation Band (Multi-scale big & small stars)
    this.helicalBand = new HelicalCreationBand(this.scene, 36000);

    // 6. Cosmic Beacons & Landmark Centers
    this.createCosmicLandmarkBeacons();

    // 7. Interactive State & Auto-Orbit
    this.cameraFlight = null;
    this.autoOrbit = false;
    this.orbitSpeedRadPerSec = 0.055;
    this.isTransparentBg = false;

    // 8. Event Listeners
    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onResize(), 150);
    });
    this.onResize();
  }

  createCosmicLandmarkBeacons() {
    // Earth origin beacon (z=0)
    const earthGroup = new THREE.Group();
    const earthGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const earthMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);

    const haloGeo = new THREE.SphereGeometry(2.0, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.BackSide
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    earthGroup.add(earthMesh, haloMesh);
    this.earthMarker = earthGroup;
    this.scene.add(this.earthMarker);

    // Coordinate Distance Rings (100 Mpc, 500 Mpc, 1000 Mpc, 5000 Mpc)
    const ringGroup = new THREE.Group();
    [100, 500, 1000, 5000].forEach(r => {
      const ringGeo = new THREE.RingGeometry(r - 0.8, r, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x223355,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.22
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ringGroup.add(ring);
    });
    this.scene.add(ringGroup);

    // Boötes Void Center (~250 Mpc, RA 218°, Dec 46°)
    const bDist = 250.0;
    const bDecRad = (46.0 * Math.PI) / 180;
    const bRaRad = (218.0 * Math.PI) / 180;
    const bx = bDist * Math.cos(bDecRad) * Math.cos(bRaRad);
    const by = bDist * Math.cos(bDecRad) * Math.sin(bRaRad);
    const bz = bDist * Math.sin(bDecRad);
    this.bootesCenter = new THREE.Vector3(bx, by, bz);

    const voidGeo = new THREE.SphereGeometry(32.0, 24, 18);
    const voidMat = new THREE.MeshBasicMaterial({
      color: 0xff2a6d,
      wireframe: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    this.bootesSphere = new THREE.Mesh(voidGeo, voidMat);
    this.bootesSphere.position.copy(this.bootesCenter);
    this.scene.add(this.bootesSphere);

    // Sloan Great Wall Center (~325 Mpc, RA 175°, Dec 5°)
    const sDist = 325.0;
    const sDecRad = (5.0 * Math.PI) / 180;
    const sRaRad = (175.0 * Math.PI) / 180;
    const sx = sDist * Math.cos(sDecRad) * Math.cos(sRaRad);
    const sy = sDist * Math.cos(sDecRad) * Math.sin(sRaRad);
    const sz = sDist * Math.sin(sDecRad);
    this.sloanCenter = new THREE.Vector3(sx, sy, sz);
  }

  loadDataset(catalogData) {
    if (this.pointsMesh) {
      this.scene.remove(this.pointsMesh);
      this.pointsMesh.geometry.dispose();
    }

    this.catalogData = catalogData;
    const geo = new THREE.BufferGeometry();

    const posArray = catalogData.positions instanceof Float32Array
      ? catalogData.positions
      : new Float32Array(catalogData.positions);

    const colorArray = catalogData.color_params instanceof Float32Array
      ? catalogData.color_params
      : new Float32Array(catalogData.color_params);

    const redshiftArray = catalogData.redshifts instanceof Float32Array
      ? catalogData.redshifts
      : new Float32Array(catalogData.redshifts);

    const qsoArray = catalogData.is_qso instanceof Uint8Array
      ? catalogData.is_qso
      : new Uint8Array(catalogData.is_qso);

    const landmarkArray = catalogData.landmark_ids instanceof Uint8Array
      ? catalogData.landmark_ids
      : new Uint8Array(catalogData.landmark_ids);

    const spawnArray = catalogData.orders.redshift instanceof Float32Array
      ? catalogData.orders.redshift
      : new Float32Array(catalogData.orders.redshift);

    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geo.setAttribute('aColorParam', new THREE.BufferAttribute(colorArray, 1));
    geo.setAttribute('aRedshift', new THREE.BufferAttribute(redshiftArray, 1));
    geo.setAttribute('aIsQSO', new THREE.BufferAttribute(qsoArray, 1));
    geo.setAttribute('aLandmarkId', new THREE.BufferAttribute(landmarkArray, 1));
    geo.setAttribute('aSpawnOrder', new THREE.BufferAttribute(spawnArray, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: galaxyVertShader,
      fragmentShader: galaxyFragShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.pointsMesh = new THREE.Points(geo, mat);
    this.scene.add(this.pointsMesh);

    this.flyToLandmark('overview', true);
  }

  setPlottingOrder(orderKey) {
    if (!this.catalogData || !this.catalogData.orders[orderKey] || !this.pointsMesh) return;
    const attr = this.pointsMesh.geometry.getAttribute('aSpawnOrder');
    const orderData = this.catalogData.orders[orderKey];
    attr.array.set(orderData);
    attr.needsUpdate = true;
  }

  setRedshiftRange(minZ, maxZ) {
    this.uniforms.uMinZ.value = minZ;
    this.uniforms.uMaxZ.value = maxZ;
  }

  setPlotProgress(progress) {
    this.uniforms.uPlotProgress.value = Math.max(0.0, Math.min(1.0, progress));
  }

  setPlotSpeed(speed) {
    this.uniforms.uPlotSpeed.value = speed;
  }

  toggleAutoOrbit() {
    this.autoOrbit = !this.autoOrbit;
    return this.autoOrbit;
  }

  toggleTransparentBackground() {
    this.isTransparentBg = !this.isTransparentBg;
    if (this.isTransparentBg) {
      this.renderer.setClearColor(0x000000, 0.0);
    } else {
      this.renderer.setClearColor(0x030307, 1.0);
    }
    return this.isTransparentBg;
  }

  highlightLandmark(name) {
    if (name === 'bootes') {
      this.uniforms.uHighlightActive.value = 1.0;
      this.uniforms.uHighlightCenter.value.copy(this.bootesCenter);
      this.uniforms.uHighlightRadius.value = 38.0;
      this.bootesSphere.material.opacity = 0.4;
    } else {
      this.uniforms.uHighlightActive.value = 0.0;
      this.bootesSphere.material.opacity = 0.0;
    }
  }

  flyToLandmark(landmark, immediate = false) {
    let targetPos = new THREE.Vector3(0, 0, 0);
    let camPos = new THREE.Vector3(220, 380, 1150);

    if (landmark === 'earth') {
      targetPos.set(0, 0, 0);
      camPos.set(45, 65, 160);
      this.highlightLandmark('none');
    } else if (landmark === 'bootes') {
      targetPos.copy(this.bootesCenter);
      camPos.copy(this.bootesCenter).add(new THREE.Vector3(130, 90, 160));
      this.highlightLandmark('bootes');
    } else if (landmark === 'sloan_wall') {
      targetPos.copy(this.sloanCenter);
      camPos.copy(this.sloanCenter).add(new THREE.Vector3(-160, 130, 210));
      this.highlightLandmark('none');
    } else if (landmark === 'quasar_dawn') {
      targetPos.set(0, 0, 0);
      camPos.set(1400, 2600, 5200);
      this.highlightLandmark('none');
    } else {
      targetPos.set(0, 0, 0);
      camPos.set(220, 520, 1400);
      this.highlightLandmark('none');
    }

    if (immediate) {
      this.camera.position.copy(camPos);
      this.controls.target.copy(targetPos);
      this.controls.update();
      return;
    }

    this.cameraFlight = {
      startCam: this.camera.position.clone(),
      endCam: camPos,
      startTarget: this.controls.target.clone(),
      endTarget: targetPos,
      startTime: performance.now(),
      duration: 1800
    };
  }

  raycastObjectAtScreen(screenX, screenY) {
    if (!this.pointsMesh) return null;

    const mouse = new THREE.Vector2(
      (screenX / this.width) * 2 - 1,
      -(screenY / this.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 18.0;
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObject(this.pointsMesh);
    if (intersects.length > 0) {
      const hit = intersects[0];
      return {
        index: hit.index,
        point: hit.point
      };
    }
    return null;
  }

  zoomAtScreenPoint(screenX, screenY, direction = 'in') {
    const hit = this.raycastObjectAtScreen(screenX, screenY);
    let targetPoint = hit ? hit.point : this.controls.target;

    const currentOffset = this.camera.position.clone().sub(this.controls.target);
    const currentDist = currentOffset.length();
    const newDist = direction === 'in'
      ? Math.max(12.0, currentDist * 0.35)
      : Math.min(22000.0, currentDist * 2.5);

    const newCamPos = targetPoint.clone().add(
      currentOffset.clone().normalize().multiplyScalar(newDist)
    );

    this.cameraFlight = {
      startCam: this.camera.position.clone(),
      endCam: newCamPos,
      startTarget: this.controls.target.clone(),
      endTarget: targetPoint,
      startTime: performance.now(),
      duration: 1500
    };

    return hit ? hit.index : null;
  }

  onResize() {
    if (!this.container) return;
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    const aspect = this.width / this.height;
    this.camera.aspect = aspect;

    if (aspect < 1.0) {
      this.camera.fov = Math.min(75, 50 / aspect);
    } else {
      this.camera.fov = 50;
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.postProcessing.setSize(this.width, this.height);
  }

  update(deltaTime) {
    this.uniforms.uTime.value += deltaTime;
    this.dustNebula.update(deltaTime);
    if (this.helicalBand) {
      this.helicalBand.update(deltaTime);
    }

    // Auto-Orbit
    if (this.autoOrbit && !this.cameraFlight) {
      const angle = this.orbitSpeedRadPerSec * deltaTime;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const x = this.camera.position.x - this.controls.target.x;
      const z = this.camera.position.z - this.controls.target.z;
      this.camera.position.x = this.controls.target.x + (x * cosA - z * sinA);
      this.camera.position.z = this.controls.target.z + (x * sinA + z * cosA);
    }

    // Camera Flight
    if (this.cameraFlight) {
      const now = performance.now();
      const elapsed = now - this.cameraFlight.startTime;
      let t = Math.min(1.0, elapsed / this.cameraFlight.duration);
      t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.camera.position.lerpVectors(this.cameraFlight.startCam, this.cameraFlight.endCam, t);
      this.controls.target.lerpVectors(this.cameraFlight.startTarget, this.cameraFlight.endTarget, t);

      if (t >= 1.0) {
        this.cameraFlight = null;
      }
    }

    this.controls.update();
    this.postProcessing.render();
  }
}
