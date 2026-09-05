import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import type { CameraPresetId } from './cameraPresets';

/**
 * Owns the WebGL renderer, scene, camera rig, and the requestAnimationFrame
 * loop. This is the one place per-frame rendering happens — React never
 * runs inside this loop; it only reads/writes state that SceneBridge
 * consumes between frames.
 */
export class SceneRenderer {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly cameraRig: CameraRig;

  private container: HTMLElement;
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, backgroundColor: string, initialPreset: CameraPresetId = 'angledA') {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(backgroundColor);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    this.cameraRig = new CameraRig(this.renderer.domElement, aspect, initialPreset);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  setBackground(color: string): void {
    (this.scene.background as THREE.Color).set(color);
  }

  private handleResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.cameraRig.setAspect(w / h);
  }

  start(): void {
    const loop = (): void => {
      this.cameraRig.update();
      this.renderer.render(this.scene, this.cameraRig.camera);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.cameraRig.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
