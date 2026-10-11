// Cinematics System: Ultimate cinematics and "Veil Fatality" finishers.
// Pure Canvas 2D procedural effects: camera choreography, speed lines,
// split-screen flashes, dark vignettes, and per-character cinematic set pieces.

export class CinematicsManager {
  constructor(game) {
    this.game = game;
    this.activeCinematic = null;
    this.timer = 0;
    this.duration = 0;
    this.owner = null;
    this.target = null;
    this.type = 'ultimate'; // 'ultimate' | 'finisher'
  }

  startUltimate(owner, target) {
    this.type = 'ultimate';
    this.owner = owner;
    this.target = target;
    this.timer = 0;
    this.duration = 45; // 45 frames cinematic
    this.activeCinematic = owner.def.id;
  }

  startFinisher(winner, loser) {
    this.type = 'finisher';
    this.owner = winner;
    this.target = loser;
    this.timer = 0;
    this.duration = 120; // 2 seconds cinematic finale
    this.activeCinematic = winner.def.id;
  }

  update() {
    if (!this.activeCinematic) return false;
    this.timer++;
    if (this.timer >= this.duration) {
      this.activeCinematic = null;
      return false;
    }
    return true;
  }

  draw(ctx, cam) {
    if (!this.activeCinematic) return;
    const t = this.timer;
    const dur = this.duration;
    const prog = t / dur;
    const id = this.activeCinematic;
    const owner = this.owner;
    const pal = owner?.pal || { glow: '#ff3a3a' };

    ctx.save();

    if (this.type === 'finisher') {
      this._drawFinisher(ctx, id, prog, pal, cam);
    } else {
      this._drawUltimate(ctx, id, prog, pal, cam);
    }

    ctx.restore();
  }

  _drawUltimate(ctx, id, prog, pal, cam) {
    // 1. Dark Vignette & Cinematic Screen Dimming
    const dimAlpha = Math.sin(prog * Math.PI) * 0.75;
    ctx.fillStyle = `rgba(3, 4, 8, ${dimAlpha})`;
    ctx.fillRect(0, 0, 1280, 720);

    // 2. High-speed lines radiating from character center
    if (prog > 0.1 && prog < 0.85) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = pal.glow;
      ctx.lineWidth = 2.5;
      const count = 18;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + prog * 1.5;
        const r1 = 120 + Math.random() * 80;
        const r2 = 720;
        ctx.globalAlpha = (0.2 + Math.random() * 0.4) * Math.sin(prog * Math.PI);
        ctx.beginPath();
        ctx.moveTo(640 + Math.cos(ang) * r1, 360 + Math.sin(ang) * r1);
        ctx.lineTo(640 + Math.cos(ang) * r2, 360 + Math.sin(ang) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Split-screen flash at impact frame
    if (prog > 0.45 && prog < 0.55) {
      ctx.save();
      ctx.globalAlpha = (1 - Math.abs(prog - 0.5) / 0.05) * 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1280, 720);
      ctx.restore();
    }

    // 4. Per-character unique visual flourish
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flareAlpha = Math.sin(prog * Math.PI);
    ctx.globalAlpha = flareAlpha * 0.8;

    switch (id) {
      case 'kael': {
        // Dual crescent blood slashes cutting the screen
        ctx.strokeStyle = '#ff3a3a';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(100, 100);
        ctx.quadraticCurveTo(640, 360, 1180, 620);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(1180, 100);
        ctx.quadraticCurveTo(640, 360, 100, 620);
        ctx.stroke();
        break;
      }
      case 'nyra': {
        // Spiral phantom vortex
        ctx.strokeStyle = '#b46bff';
        ctx.lineWidth = 6;
        for (let ring = 0; ring < 4; ring++) {
          ctx.beginPath();
          ctx.ellipse(640, 360, 150 + ring * 80, 60 + ring * 35, prog * 4 + ring * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'bram': {
        // Ground-shattering shockwave rings
        ctx.strokeStyle = '#ff9a3a';
        ctx.lineWidth = 10;
        const waveR = prog * 800;
        ctx.beginPath();
        ctx.ellipse(640, 560, waveR, waveR * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'sora': {
        // Heavenly lightning pillars
        ctx.strokeStyle = '#7ff3ff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(640, 0); ctx.lineTo(640, 720);
        ctx.moveTo(480, 0); ctx.lineTo(520, 720);
        ctx.moveTo(800, 0); ctx.lineTo(760, 720);
        ctx.stroke();
        break;
      }
      case 'vex': {
        // Digital cyber glitch slice bars
        ctx.fillStyle = '#ff2d3d';
        for (let b = 0; b < 6; b++) {
          const y = 80 + b * 100 + Math.sin(prog * 20 + b) * 30;
          ctx.fillRect(0, y, 1280, 8);
        }
        break;
      }
      case 'sera': {
        // Solar glyph mandala
        ctx.strokeStyle = '#ffe08a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(640, 320, 180, 0, Math.PI * 2);
        ctx.stroke();
        for (let ray = 0; ray < 8; ray++) {
          const ang = (ray / 8) * Math.PI * 2 + prog * 2;
          ctx.beginPath();
          ctx.moveTo(640 + Math.cos(ang) * 190, 320 + Math.sin(ang) * 190);
          ctx.lineTo(640 + Math.cos(ang) * 320, 320 + Math.sin(ang) * 320);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  _drawFinisher(ctx, id, prog, pal, cam) {
    // Letterbox bars (cinematic widescreen 21:9 format)
    const barH = 68;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 1280, barH);
    ctx.fillRect(0, 720 - barH, 1280, barH);

    // Dynamic contrast glow
    if (prog > 0.2 && prog < 0.7) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.sin((prog - 0.2) / 0.5 * Math.PI) * 0.35;
      ctx.fillStyle = pal.glow;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.restore();
    }

    // "VEIL EXTINGUISHED" Announcement banner
    if (prog > 0.35) {
      const alpha = Math.min(1, (prog - 0.35) * 4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = '900 64px "Bahnschrift", "Segoe UI", Arial, sans-serif';
      ctx.letterSpacing = '0.2em';

      // Drop shadow / glow
      ctx.shadowColor = pal.glow;
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('VEIL EXTINGUISHED', 640, 240);

      // Subtitle with character title
      ctx.font = '700 22px "Bahnschrift", "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pal.glow;
      ctx.shadowBlur = 12;
      ctx.fillText(`${(this.owner?.def?.name || '').toUpperCase()} — VICTORY ASSURED`, 640, 280);
      ctx.restore();
    }
  }
}
