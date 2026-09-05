import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA_PRESETS, type CameraPresetId } from './cameraPresets';

interface Transition {
  from: THREE.Vector3;
  fromTarget: THREE.Vector3;
  to: THREE.Vector3;
  toTarget: THREE.Vector3;
  startMs: number;
  durationMs: number;
}

function easeInOutCubic(u: number): number {
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
}

/**
 * Free-orbit camera with damped OrbitControls, plus tweened transitions to
 * named presets. Since OrbitControls recomputes its internal spherical
 * coordinates from the camera's actual position/target every update(), we
 * can lerp position/target directly during a transition and the user
 * regains normal drag/zoom control the instant it finishes.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private transition: Transition | null = null;

  constructor(domElement: HTMLElement, aspect: number, initial: CameraPresetId = 'angledA') {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
    const preset = CAMERA_PRESETS[initial];
    this.camera.position.set(preset.position.x, preset.position.y, preset.position.z);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(preset.target.x, preset.target.y, preset.target.z);
    this.controls.minDistance = 3;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.499; // stop the camera from diving under the floor
    this.controls.update();
  }

  goToPreset(id: CameraPresetId, durationMs = 600): void {
    const preset = CAMERA_PRESETS[id];
    this.transition = {
      from: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      to: new THREE.Vector3(preset.position.x, preset.position.y, preset.position.z),
      toTarget: new THREE.Vector3(preset.target.x, preset.target.y, preset.target.z),
      startMs: performance.now(),
      durationMs,
    };
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(): void {
    if (this.transition) {
      const raw = (performance.now() - this.transition.startMs) / this.transition.durationMs;
      const t = raw >= 1 ? 1 : raw;
      const u = easeInOutCubic(t);
      this.camera.position.lerpVectors(this.transition.from, this.transition.to, u);
      this.controls.target.lerpVectors(this.transition.fromTarget, this.transition.toTarget, u);
      if (t >= 1) this.transition = null;
    }
    this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
