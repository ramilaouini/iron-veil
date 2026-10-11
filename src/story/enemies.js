// Enemy AI, states, hitboxes and procedural rendering for IRON VEIL Story Mode.
// Mobs: Grunts, Drones, Shield Brutes, Shadow Ninjas.
// Mini-Bosses: RX-9, Ren, Molten Juggernaut, Chrono Sentinel.
// Level Bosses: Vex, Nyra, Bram, and Sovereign Malakor.

const D2R = Math.PI / 180;

export class Enemy {
  constructor(kind, x, y, opts = {}) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = opts.facing || -1;
    this.t = 0;
    this.frame = 0;
    this.state = 'idle'; // idle | walk | windup | attack | recovery | hitstun | knockdown | dead
    this.timer = 0;
    this.hurtFlash = 0;
    this.dead = false;
    this.remove = false;
    this.grounded = true;
    this.onPlatform = false;

    // Type-specific setup
    this._initStats(opts);
  }

  _initStats(opts) {
    switch (this.kind) {
      case 'drone':
        this.w = 40; this.h = 30;
        this.maxHp = opts.hp || 60;
        this.hp = this.maxHp;
        this.speed = 2.4;
        this.flying = true;
        this.targetY = this.y;
        this.hoverOffset = Math.random() * Math.PI * 2;
        this.shootCooldown = 90 + (Math.random() * 60) | 0;
        this.glowColor = '#00f0ff';
        break;

      case 'brute':
        this.w = 54; this.h = 88;
        this.maxHp = opts.hp || 260;
        this.hp = this.maxHp;
        this.speed = 1.8;
        this.shieldActive = true;
        this.glowColor = '#ffb020';
        break;

      case 'ninja':
        this.w = 36; this.h = 76;
        this.maxHp = opts.hp || 110;
        this.hp = this.maxHp;
        this.speed = 4.2;
        this.jumpCooldown = 60;
        this.glowColor = '#c040ff';
        break;

      case 'miniboss':
        this.w = 64; this.h = 104;
        this.maxHp = opts.hp || 750;
        this.hp = this.maxHp;
        this.speed = 2.6;
        this.isBoss = true;
        this.bossName = opts.name || 'Vanguard RX-9';
        this.bossTitle = opts.title || 'Sector Enforcer';
        this.glowColor = opts.glow || '#ff3a3a';
        break;

      case 'boss':
        this.w = 56; this.h = 96;
        this.maxHp = opts.hp || 1200;
        this.hp = this.maxHp;
        this.speed = 3.2;
        this.isBoss = true;
        this.isFinalBoss = !!opts.isFinalBoss;
        this.bossName = opts.name || 'Sector Boss';
        this.bossTitle = opts.title || 'Grand Master';
        this.bossId = opts.bossId || 'vex';
        this.phase = 1;
        this.glowColor = opts.glow || '#ff2040';
        break;

      case 'grunt':
      default:
        this.kind = 'grunt';
        this.w = 38; this.h = 78;
        this.maxHp = opts.hp || 85;
        this.hp = this.maxHp;
        this.speed = 2.6;
        this.glowColor = '#ff3a3a';
        break;
    }
  }

  hurtBox() {
    return {
      l: this.x - this.w / 2,
      r: this.x + this.w / 2,
      bottom: this.y,
      top: this.y + this.h,
    };
  }

  attackBox() {
    if (this.state !== 'attack' || this.attackUsed) return null;
    const reach = this.kind === 'brute' ? 65 : this.kind === 'miniboss' ? 85 : this.kind === 'boss' ? 75 : 50;
    const h = this.kind === 'brute' ? 60 : this.kind === 'miniboss' ? 80 : 50;
    const l = this.facing === 1 ? this.x : this.x - reach;
    return {
      l,
      r: l + reach,
      bottom: this.y,
      top: this.y + h,
      damage: this.attackDamage || 12,
      knockback: this.attackKnockback || 6,
    };
  }

  takeDamage(dmg, fromX = 0, isHeavy = false, fx = null, audio = null) {
    if (this.dead) return 0;

    // Shield check for Brute
    if (this.kind === 'brute' && this.shieldActive && this.state !== 'hitstun') {
      const hitFromFront = (fromX > this.x && this.facing === 1) || (fromX < this.x && this.facing === -1);
      if (hitFromFront && !isHeavy) {
        if (fx) fx.shield(this.x + this.facing * 20, -(this.y + 40), this.facing, '#ffd040', false);
        if (audio) audio.play('block');
        this.vx = this.facing * -2;
        return 0; // Blocked!
      }
    }

    this.hp -= dmg;
    this.hurtFlash = 8;
    this.vx = (this.x >= fromX ? 1 : -1) * (isHeavy ? 7 : 3.5);

    if (fx) {
      const cy = -(this.y + this.h * 0.55);
      fx.burst(this.x, cy, this.glowColor, isHeavy ? 14 : 7, isHeavy ? 8 : 5);
      fx.text(this.x + (Math.random() - 0.5) * 30, cy - 20, String(dmg), isHeavy ? '#ffd466' : '#fff', isHeavy ? 26 : 20, 30);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.state = 'dead';
      this.timer = 40;
      this.vy = isHeavy ? 9 : 6;
      if (audio) audio.play(this.isBoss ? 'ko' : 'heavyImpact');
      if (fx) {
        fx.flash('#fff', this.isBoss ? 0.35 : 0.15);
        fx.pulse(this.glowColor, 0.25);
        fx.ring(this.x, -(this.y + 40), this.glowColor, 10, this.isBoss ? 160 : 90, 16, 1, 6);
      }
      return dmg;
    }

    // Bosses resist light hitstun
    if (!this.isBoss || isHeavy) {
      this.state = 'hitstun';
      this.timer = isHeavy ? 20 : 12;
      if (isHeavy) this.vy = 4;
    }

    return dmg;
  }

  // ---------------------------------------------------------------- AI Step
  step(player, level, fx, audio) {
    this.frame++;
    this.t++;
    if (this.hurtFlash > 0) this.hurtFlash--;

    if (this.dead) {
      this.timer--;
      if (!this.flying) {
        this.vy -= 0.6;
        this.y += this.vy;
        this.x += this.vx;
        this.vx *= 0.9;
        if (this.y <= 0) { this.y = 0; this.vy = 0; }
      }
      if (this.timer <= 0) this.remove = true;
      return;
    }

    const dist = player ? player.x - this.x : 0;
    const absDist = Math.abs(dist);
    const pYDist = player ? Math.abs(player.y - this.y) : 0;

    // Face player if not in locked action
    if (['idle', 'walk'].includes(this.state)) {
      if (absDist > 15) this.facing = dist > 0 ? 1 : -1;
    }

    // --------------------------------- Physics & Gravity
    if (!this.flying) {
      this.vy -= 0.62; // Gravity
      this.y += this.vy;
      this.x += this.vx;
      this.vx *= 0.82;

      // Platform & ground collision
      const ground = level.getFloorY(this.x, this.y, this.vy);
      if (this.y <= ground) {
        this.y = ground;
        this.vy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    } else {
      // Flying drone smooth physics
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.88;
      this.vy *= 0.88;
    }

    // --------------------------------- States
    switch (this.state) {
      case 'hitstun':
        this.timer--;
        if (this.timer <= 0) {
          this.state = 'idle';
          this.timer = 10;
        }
        return;

      case 'windup':
        this.timer--;
        if (this.timer <= 0) {
          this.state = 'attack';
          this.timer = this.attackDuration || 16;
          this.attackUsed = false;
          if (audio) audio.play('whoosh');
        }
        return;

      case 'attack':
        this.timer--;
        if (this.timer <= 0) {
          this.state = 'recovery';
          this.timer = this.recoveryDuration || 22;
        }
        return;

      case 'recovery':
        this.timer--;
        if (this.timer <= 0) {
          this.state = 'idle';
          this.timer = 15 + ((Math.random() * 20) | 0);
        }
        return;
    }

    // --------------------------------- Archetype Specific AI
    switch (this.kind) {
      case 'drone':
        this._stepDrone(player, level, fx, audio, dist, absDist);
        break;
      case 'brute':
        this._stepBrute(player, level, fx, audio, dist, absDist, pYDist);
        break;
      case 'ninja':
        this._stepNinja(player, level, fx, audio, dist, absDist, pYDist);
        break;
      case 'miniboss':
        this._stepMiniBoss(player, level, fx, audio, dist, absDist, pYDist);
        break;
      case 'boss':
        this._stepBoss(player, level, fx, audio, dist, absDist, pYDist);
        break;
      case 'grunt':
      default:
        this._stepGrunt(player, level, fx, audio, dist, absDist, pYDist);
        break;
    }
  }

  // ---------------------------------------------------------------- Grunt AI
  _stepGrunt(player, level, fx, audio, dist, absDist, pYDist) {
    if (absDist > 650) {
      this.state = 'idle';
      return;
    }

    if (absDist < 58 && pYDist < 40) {
      // Wind up attack
      this.state = 'windup';
      this.timer = 16;
      this.attackDamage = 10;
      this.attackDuration = 14;
      this.recoveryDuration = 24;
      return;
    }

    // Move toward player
    this.state = 'walk';
    this.vx = this.facing * this.speed;
  }

  // ---------------------------------------------------------------- Drone AI
  _stepDrone(player, level, fx, audio, dist, absDist) {
    if (absDist > 750) return;

    // Hover bobbing
    const desiredY = player.y + 160 + Math.sin(this.t * 0.05 + this.hoverOffset) * 25;
    const dy = desiredY - this.y;
    this.vy += Math.sign(dy) * 0.3;

    // Keep distance around 150-250px
    const desiredX = player.x - this.facing * 180;
    const dx = desiredX - this.x;
    this.vx += Math.sign(dx) * 0.25;

    // Aim and shoot laser
    this.shootCooldown--;
    if (this.shootCooldown <= 30 && this.shootCooldown > 0) {
      // Laser charging telegraph
      if (fx && this.shootCooldown % 6 === 0) {
        fx.ember(this.x + this.facing * 16, -(this.y + 8), '#00f0ff', 1.5);
      }
    } else if (this.shootCooldown <= 0) {
      this.shootCooldown = 110 + (Math.random() * 50) | 0;
      if (audio) audio.play('laserZap');
      // Spawn downward angled projectile
      level.projectiles.push({
        x: this.x + this.facing * 16,
        y: this.y,
        vx: this.facing * 5.5,
        vy: -3.5,
        damage: 14,
        color: '#00f0ff',
        fromEnemy: true,
        life: 120,
      });
    }
  }

  // ---------------------------------------------------------------- Brute AI
  _stepBrute(player, level, fx, audio, dist, absDist, pYDist) {
    if (absDist > 650) return;

    if (absDist < 80 && pYDist < 50) {
      // Heavy hammer ground slam
      this.state = 'windup';
      this.timer = 24;
      this.attackDamage = 22;
      this.attackDuration = 18;
      this.recoveryDuration = 38;
      this.attackKnockback = 12;
      return;
    }

    this.state = 'walk';
    this.vx = this.facing * this.speed;
  }

  // ---------------------------------------------------------------- Ninja AI
  _stepNinja(player, level, fx, audio, dist, absDist, pYDist) {
    if (absDist > 700) return;

    this.jumpCooldown--;
    if (this.jumpCooldown <= 0 && this.grounded && absDist > 140) {
      this.jumpCooldown = 90;
      this.vy = 13;
      this.vx = this.facing * 6;
      this.grounded = false;
      if (audio) audio.play('jump');
      return;
    }

    if (absDist < 60 && pYDist < 40) {
      this.state = 'windup';
      this.timer = 12;
      this.attackDamage = 12;
      this.attackDuration = 12;
      this.recoveryDuration = 18;
      return;
    }

    this.state = 'walk';
    this.vx = this.facing * this.speed;
  }

  // ---------------------------------------------------------------- Mini-Boss AI
  _stepMiniBoss(player, level, fx, audio, dist, absDist, pYDist) {
    if (absDist > 800) return;

    // Special moves cycle
    if (absDist < 95 && pYDist < 60 && this.state === 'idle') {
      const pick = Math.random();
      if (pick < 0.5) {
        // Leaping ground slam
        this.state = 'windup';
        this.timer = 22;
        this.attackDamage = 28;
        this.attackDuration = 20;
        this.recoveryDuration = 32;
        this.attackKnockback = 14;
        this.vy = 8;
        this.vx = this.facing * 5;
      } else {
        // Whirlwind cleave
        this.state = 'windup';
        this.timer = 18;
        this.attackDamage = 20;
        this.attackDuration = 28;
        this.recoveryDuration = 26;
      }
      return;
    }

    this.state = 'walk';
    this.vx = this.facing * this.speed;
  }

  // ---------------------------------------------------------------- Boss AI
  _stepBoss(player, level, fx, audio, dist, absDist, pYDist) {
    // Check phase transition
    if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.speed *= 1.3;
      if (fx) {
        fx.flash('#fff', 0.4);
        fx.pulse('#ff2040', 0.4);
        fx.ring(this.x, -(this.y + 50), '#ff2040', 20, 200, 22, 1, 8);
      }
      if (audio) {
        audio.play('ultStart');
        audio.play('bossAlarm');
      }
    }

    if (absDist < 85 && pYDist < 50 && this.state === 'idle') {
      this.state = 'windup';
      this.timer = 14;
      this.attackDamage = this.phase === 2 ? 26 : 18;
      this.attackDuration = 16;
      this.recoveryDuration = 18;
      this.attackKnockback = 10;
      return;
    }

    // Phase 2 special: ranged blood projectile or gap close dash
    if (this.phase === 2 && absDist > 160 && this.frame % 90 === 0 && this.state === 'idle') {
      if (Math.random() < 0.5) {
        // Dash attack
        this.vx = this.facing * 12;
        this.state = 'attack';
        this.timer = 16;
        this.attackDamage = 22;
        if (audio) audio.play('dash');
        if (fx) fx.speedLines(this.x, -(this.y + 40), this.facing, this.glowColor, 3);
        return;
      } else {
        // Projectile burst
        if (audio) audio.play('projectile');
        level.projectiles.push({
          x: this.x + this.facing * 25,
          y: this.y + 45,
          vx: this.facing * 8,
          vy: 0,
          damage: 18,
          color: this.glowColor,
          fromEnemy: true,
          life: 90,
        });
      }
    }

    this.state = 'walk';
    this.vx = this.facing * this.speed;
  }

  // ---------------------------------------------------------------- Drawing
  draw(ctx, cam, frame) {
    const zl = cam.zoom;
    const sx = (this.x - cam.x) * zl + 640;
    const gy = 360 + (610 - 360) * zl; // floor Screen Y
    const sy = gy - this.y * zl;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(zl * this.facing, zl);

    // Flash white on hit
    const flash = this.hurtFlash > 0;

    switch (this.kind) {
      case 'drone':
        this._drawDrone(ctx, flash);
        break;
      case 'brute':
        this._drawBrute(ctx, flash);
        break;
      case 'ninja':
        this._drawNinja(ctx, flash);
        break;
      case 'miniboss':
      case 'boss':
        this._drawBoss(ctx, flash);
        break;
      case 'grunt':
      default:
        this._drawGrunt(ctx, flash);
        break;
    }

    ctx.restore();

    // Draw health bar for living enemies (and big boss bar at top)
    if (!this.dead && !this.isBoss && this.hp < this.maxHp) {
      this._drawMiniHealthBar(ctx, sx, sy);
    }
  }

  _drawGrunt(ctx, flash) {
    const col = flash ? '#ffffff' : '#14161f';
    const glow = flash ? '#ffffff' : this.glowColor;

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = col;

    // Legs
    const walkBob = this.state === 'walk' ? Math.sin(this.t * 0.25) * 12 : 0;
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(-10, -20);
    ctx.lineTo(-8 + walkBob, 0);
    ctx.moveTo(0, -38);
    ctx.lineTo(10, -20);
    ctx.lineTo(8 - walkBob, 0);
    ctx.stroke();

    // Torso
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(0, -64);
    ctx.stroke();

    // Head
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, -72, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing visor
    ctx.strokeStyle = glow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(2, -73);
    ctx.lineTo(8, -73);
    ctx.stroke();

    // Arm & Weapon
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -60);
    const windupOffset = this.state === 'windup' ? -20 : this.state === 'attack' ? 24 : 8;
    ctx.lineTo(12 + windupOffset, -50);
    ctx.stroke();

    // Stun Baton
    ctx.strokeStyle = glow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12 + windupOffset, -50);
    ctx.lineTo(26 + windupOffset * 1.3, -56);
    ctx.stroke();
  }

  _drawDrone(ctx, flash) {
    const col = flash ? '#fff' : '#10141d';
    const glow = flash ? '#fff' : this.glowColor;

    // Outer shell
    ctx.fillStyle = col;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -18, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Core eye
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(4, -18, 5, 0, Math.PI * 2);
    ctx.fill();

    // Hover thruster flames
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(-6, -2);
    ctx.lineTo(-2, -8);
    ctx.fill();
  }

  _drawBrute(ctx, flash) {
    const col = flash ? '#fff' : '#181b24';
    const glow = flash ? '#fff' : this.glowColor;

    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = col;

    // Heavy legs
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(-14, -22);
    ctx.lineTo(-12, 0);
    ctx.moveTo(0, -42);
    ctx.lineTo(14, -22);
    ctx.lineTo(12, 0);
    ctx.stroke();

    // Bulky torso
    ctx.fillStyle = col;
    ctx.fillRect(-14, -76, 28, 36);

    // Head with armor plate
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(-8, -88, 16, 14);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 3;
    ctx.strokeRect(-8, -88, 16, 14);

    // Giant Riot Shield
    ctx.fillStyle = flash ? '#fff' : 'rgba(255, 176, 32, 0.4)';
    ctx.strokeStyle = glow;
    ctx.lineWidth = 4;
    ctx.fillRect(16, -82, 14, 76);
    ctx.strokeRect(16, -82, 14, 76);
  }

  _drawNinja(ctx, flash) {
    const col = flash ? '#fff' : '#140c20';
    const glow = flash ? '#fff' : this.glowColor;

    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = col;

    // Agile crouched legs
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.lineTo(-14, -18);
    ctx.lineTo(-10, 0);
    ctx.moveTo(0, -36);
    ctx.lineTo(12, -20);
    ctx.lineTo(16, 0);
    ctx.stroke();

    // Torso
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.lineTo(0, -62);
    ctx.stroke();

    // Scarf / trail
    ctx.strokeStyle = glow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.quadraticCurveTo(-14, -58, -26 - Math.sin(this.t * 0.3) * 6, -50);
    ctx.stroke();

    // Head
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, -70, 8, 0, Math.PI * 2);
    ctx.fill();

    // Dual daggers
    ctx.strokeStyle = glow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(6, -52);
    ctx.lineTo(24, -48);
    ctx.moveTo(-4, -50);
    ctx.lineTo(-18, -46);
    ctx.stroke();
  }

  _drawBoss(ctx, flash) {
    const col = flash ? '#fff' : '#12141c';
    const glow = flash ? '#fff' : this.glowColor;

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = col;

    // Armored legs
    const walkBob = Math.sin(this.t * 0.2) * 8;
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(-16, -24);
    ctx.lineTo(-14 + walkBob, 0);
    ctx.moveTo(0, -46);
    ctx.lineTo(16, -24);
    ctx.lineTo(14 - walkBob, 0);
    ctx.stroke();

    // Cape
    ctx.fillStyle = this.phase === 2 ? 'rgba(255, 32, 64, 0.45)' : 'rgba(20, 22, 30, 0.7)';
    ctx.beginPath();
    ctx.moveTo(0, -78);
    ctx.lineTo(-24, -20);
    ctx.lineTo(-10, -10);
    ctx.lineTo(0, -46);
    ctx.fill();

    // Heavy torso with chest core
    ctx.fillStyle = col;
    ctx.fillRect(-16, -82, 32, 38);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 2;
    ctx.strokeRect(-16, -82, 32, 38);

    // Glowing core
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -64, 7, 0, Math.PI * 2);
    ctx.fill();

    // Head & Horns/Crown
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, -94, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sovereign Crown / Horns
    ctx.strokeStyle = glow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -102);
    ctx.lineTo(-16, -114);
    ctx.moveTo(8, -102);
    ctx.lineTo(16, -114);
    ctx.stroke();

    // Giant Sovereign Greatsword
    const attackReach = this.state === 'windup' ? -25 : this.state === 'attack' ? 45 : 15;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(14, -70);
    ctx.lineTo(35 + attackReach, -85);
    ctx.lineTo(55 + attackReach * 1.2, -65);
    ctx.stroke();
  }

  _drawMiniHealthBar(ctx, sx, sy) {
    const w = 46;
    const h = 5;
    const pct = Math.max(0, this.hp / this.maxHp);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(sx - w / 2, sy - this.h - 14, w, h);
    ctx.fillStyle = this.glowColor;
    ctx.fillRect(sx - w / 2, sy - this.h - 14, w * pct, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - this.h - 14, w, h);
    ctx.restore();
  }
}
