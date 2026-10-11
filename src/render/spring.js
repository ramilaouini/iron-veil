// Damped Harmonic Oscillator Spring Physics for secondary motion
// Used for flowing cloth, capes, sashes, hair, and armor plates.

export class SpringChain {
  constructor(length = 6, opts = {}) {
    this.length = length;
    this.mass = opts.mass || 1.0;
    this.stiffness = opts.stiffness || 210;
    this.damping = opts.damping || 18;
    this.gravity = opts.gravity || 90;
    this.segmentLen = opts.segmentLength || 16;
    this.points = Array.from({ length }, (_, i) => ({
      x: 0,
      y: i * this.segmentLen,
      vx: 0,
      vy: 0,
      oldX: 0,
      oldY: i * this.segmentLen,
    }));
  }

  reset(anchorX = 0, anchorY = 0) {
    for (let i = 0; i < this.points.length; i++) {
      this.points[i].x = anchorX;
      this.points[i].y = anchorY + i * this.segmentLen;
      this.points[i].vx = 0;
      this.points[i].vy = 0;
      this.points[i].oldX = this.points[i].x;
      this.points[i].oldY = this.points[i].y;
    }
  }

  update(anchorX, anchorY, dt = 1 / 60, facing = 1, externalVx = 0) {
    if (this.points.length === 0) return;
    this.points[0].x = anchorX;
    this.points[0].y = anchorY;
    this.points[0].vx = 0;
    this.points[0].vy = 0;

    const wind = -externalVx * 24 - facing * 18;

    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i];
      const parent = this.points[i - 1];

      // Spring force towards rest length
      const dx = p.x - parent.x;
      const dy = p.y - parent.y;
      const dist = Math.hypot(dx, dy) || 1e-4;
      const delta = dist - this.segmentLen;

      const fSpringX = -(dx / dist) * delta * this.stiffness;
      const fSpringY = -(dy / dist) * delta * this.stiffness;

      // Damping force
      const fDampX = -p.vx * this.damping;
      const fDampY = -p.vy * this.damping;

      // Accelerations
      const ax = (fSpringX + fDampX + wind) / this.mass;
      const ay = (fSpringY + fDampY + this.gravity) / this.mass;

      p.vx += ax * dt;
      p.vy += ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Distance constraint
      const cdx = p.x - parent.x;
      const cdy = p.y - parent.y;
      const curDist = Math.hypot(cdx, cdy) || 1e-4;
      const maxDist = this.segmentLen * 1.25;
      if (curDist > maxDist) {
        p.x = parent.x + (cdx / curDist) * maxDist;
        p.y = parent.y + (cdy / curDist) * maxDist;
        p.vx *= 0.8;
        p.vy *= 0.8;
      }
    }
  }

  getPoints() {
    return this.points;
  }
}
