// ParallaxCamera: Smooth, responsive 3D-style multi-plane parallax camera.
// Supports mouse tracking, mobile gyro/accelerometer, cinematic fight sway,
// and respects accessibility / reduce-motion settings.

export class ParallaxCamera {
  constructor(game) {
    this.game = game;
    this.targetX = 0;
    this.targetY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.tiltX = 0;
    this.tiltY = 0;
    this.time = 0;
    this.hasGyro = false;

    // Maximum offsets in world/screen pixels
    this.maxMenuOffsetX = 90;
    this.maxMenuOffsetY = 45;
    this.maxFightOffsetX = 24;
    this.maxFightOffsetY = 12;

    this._bindEvents();
  }

  _bindEvents() {
    if (typeof window === 'undefined') return;

    // Mouse / Pointer tracking (normalized -1 to 1)
    window.addEventListener('pointermove', (e) => {
      if (this.hasGyro) return; // Prioritize gyro on mobile
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      this.targetX = Math.max(-1, Math.min(1, (e.clientX - cx) / cx));
      this.targetY = Math.max(-1, Math.min(1, (e.clientY - cy) / cy));
    }, { passive: true });

    // Mobile Gyro / Accelerometer
    if (typeof window.DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma != null && e.beta != null) {
          this.hasGyro = true;
          // gamma: left-to-right (-90 to 90), beta: front-to-back (-180 to 180)
          const gx = Math.max(-1, Math.min(1, e.gamma / 35));
          const gy = Math.max(-1, Math.min(1, (e.beta - 45) / 35));
          this.targetX = gx;
          this.targetY = gy;
        }
      }, { passive: true });
    }

    // Reset when cursor leaves window
    window.addEventListener('blur', () => {
      this.targetX = 0;
      this.targetY = 0;
    });
  }

  update(dt = 1 / 60) {
    this.time += dt;

    // Check motion settings
    const settings = this.game.save?.settings;
    const bgMotion = settings?.bgMotion != null ? settings.bgMotion : 1;
    const motion = settings?.motion != null ? settings.motion : 1;
    const prefersReduced = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (motion === 0 || prefersReduced) {
      this.currentX = 0;
      this.currentY = 0;
      this.swayX = 0;
      this.swayY = 0;
      this.tiltX = 0;
      this.tiltY = 0;
      this.applyToUI(0, 0);
      return;
    }

    // Smooth exponential easing
    const ease = 1 - Math.exp(-dt * 8.5);
    this.currentX += (this.targetX - this.currentX) * ease;
    this.currentY += (this.targetY - this.currentY) * ease;

    const isFight = this.game.view === 'fight';

    if (isFight) {
      // Gentle cinematic sway during fights
      const swayStrength = 0.5 * motion;
      this.swayX = Math.sin(this.time * 0.7) * 7 * swayStrength;
      this.swayY = Math.cos(this.time * 0.5) * 3.5 * swayStrength;

      this.tiltX = this.currentX * 0.35;
      this.tiltY = this.currentY * 0.35;
    } else {
      this.swayX = Math.sin(this.time * 0.4) * 12 * motion;
      this.swayY = Math.cos(this.time * 0.3) * 6 * motion;

      this.tiltX = this.currentX;
      this.tiltY = this.currentY;

      // In menus, float UI panels and title logo
      this.applyToUI(this.currentX * bgMotion, this.currentY * bgMotion);
    }
  }

  applyToUI(normX, normY) {
    if (typeof document === 'undefined') return;
    const ui = document.getElementById('ui');
    if (!ui) return;

    if (normX === 0 && normY === 0) {
      ui.style.transform = '';
      return;
    }

    // Subtle 3D perspective shift on UI
    const tx = (-normX * 8).toFixed(1);
    const ty = (-normY * 5).toFixed(1);
    const rotY = (normX * 1.5).toFixed(2);
    const rotX = (-normY * 1.2).toFixed(2);

    ui.style.transform = `perspective(1000px) translate3d(${tx}px, ${ty}px, 0) rotateY(${rotY}deg) rotateX(${rotX}deg)`;
  }

  // Returns { px, py } for a given layer depth (0 = static horizon, 1 = midground, 1.4 = foreground)
  getOffsets(depth = 1) {
    const isFight = this.game.view === 'fight';
    const settings = this.game.save?.settings;
    const bgMotion = settings?.bgMotion != null ? settings.bgMotion : 1;
    const motion = settings?.motion != null ? settings.motion : 1;

    if (motion === 0) return { x: 0, y: 0 };

    const maxW = (isFight ? this.maxFightOffsetX : this.maxMenuOffsetX) * bgMotion * motion;
    const maxH = (isFight ? this.maxFightOffsetY : this.maxMenuOffsetY) * bgMotion * motion;

    // Far layers (depth near 0) move very little; foreground layers (depth > 1) move significantly
    const factor = depth;
    const x = (this.currentX * maxW + this.swayX) * factor;
    const y = (this.currentY * maxH + this.swayY) * factor;

    return { x, y };
  }

  // Returns normalized mouse coordinates (-1 to 1) for stage reactive lighting/fog
  getMouseNorm() {
    return { x: this.currentX, y: this.currentY };
  }
}
