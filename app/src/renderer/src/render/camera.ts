import type { Container } from 'pixi.js';

// Camera controller for the combat view: wheel zoom, middle/right-drag pan,
// WASD keyboard pan. Maintains `scale` + `position` on the worldLayer and
// exposes the current viewport rect in world space for culling.

export type CameraBounds = {
  worldWidth: number;
  worldHeight: number;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;
const KEYBOARD_PAN_SPEED = 12; // world units per frame

export class Camera {
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private dragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private keys = new Set<string>();
  private onChange: () => void;
  private host: HTMLElement;
  private worldLayer: Container;
  private bounds: CameraBounds;

  constructor(
    host: HTMLElement,
    worldLayer: Container,
    bounds: CameraBounds,
    onChange: () => void,
  ) {
    this.host = host;
    this.worldLayer = worldLayer;
    this.bounds = bounds;
    this.onChange = onChange;
    this.attach();
  }

  setBounds(bounds: CameraBounds): void {
    this.bounds = bounds;
  }

  fitToWorld(viewW: number, viewH: number): void {
    if (this.bounds.worldWidth <= 0 || this.bounds.worldHeight <= 0) return;
    const sx = viewW / this.bounds.worldWidth;
    const sy = viewH / this.bounds.worldHeight;
    this.scale = Math.max(MIN_SCALE, Math.min(sx, sy) * 0.95);
    this.tx = (viewW - this.bounds.worldWidth * this.scale) / 2;
    this.ty = (viewH - this.bounds.worldHeight * this.scale) / 2;
    this.apply();
  }

  // Current viewport in world coordinates.
  viewportRect(
    viewW: number,
    viewH: number,
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    const minX = -this.tx / this.scale;
    const minY = -this.ty / this.scale;
    const maxX = (viewW - this.tx) / this.scale;
    const maxY = (viewH - this.ty) / this.scale;
    return { minX, minY, maxX, maxY };
  }

  tick(viewW: number, viewH: number): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) dy -= KEYBOARD_PAN_SPEED;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) dy += KEYBOARD_PAN_SPEED;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) dx -= KEYBOARD_PAN_SPEED;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) dx += KEYBOARD_PAN_SPEED;
    if (dx !== 0 || dy !== 0) {
      this.tx -= dx * this.scale;
      this.ty -= dy * this.scale;
      this.apply();
      this.onChange();
    }
    // Keep bounds aware on resize too.
    void viewW;
    void viewH;
  }

  private attach(): void {
    this.host.addEventListener('wheel', this.onWheel, { passive: false });
    this.host.addEventListener('pointerdown', this.onPointerDown);
    this.host.addEventListener('pointermove', this.onPointerMove);
    this.host.addEventListener('pointerup', this.onPointerUp);
    this.host.addEventListener('pointerleave', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // Prevent the browser context menu on right-drag pan.
    this.host.addEventListener('contextmenu', this.preventContextMenu);
  }

  dispose(): void {
    this.host.removeEventListener('wheel', this.onWheel);
    this.host.removeEventListener('pointerdown', this.onPointerDown);
    this.host.removeEventListener('pointermove', this.onPointerMove);
    this.host.removeEventListener('pointerup', this.onPointerUp);
    this.host.removeEventListener('pointerleave', this.onPointerUp);
    this.host.removeEventListener('contextmenu', this.preventContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }

  private apply(): void {
    this.worldLayer.position.set(this.tx, this.ty);
    this.worldLayer.scale.set(this.scale);
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.host.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zoom = Math.exp(-e.deltaY * 0.001);
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * zoom));
    const k = nextScale / this.scale;
    // Zoom around cursor position so it stays anchored under the mouse.
    this.tx = mx - (mx - this.tx) * k;
    this.ty = my - (my - this.ty) * k;
    this.scale = nextScale;
    this.apply();
    this.onChange();
  };

  private onPointerDown = (e: PointerEvent): void => {
    // Middle button or right button triggers pan (left is reserved for
    // future unit-selection UX).
    if (e.button !== 1 && e.button !== 2) return;
    this.dragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.host.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.tx += dx;
    this.ty += dy;
    this.apply();
    this.onChange();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    try {
      this.host.releasePointerCapture(e.pointerId);
    } catch {
      // releasePointerCapture throws if the capture was already released.
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key);
  };

  private preventContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
