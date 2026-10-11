// The Master Adventure/Story Mode Engine for IRON VEIL.
// Controls player platforming, fighting-game combat in free-scrolling levels,
// enemy waves, mini-bosses, cinematic bosses, quests, loot, and interactive guide terminals.
import { CFG } from '../config.js';
import { Fighter, EMPTY_INPUT, S } from '../combat/fighter.js';
import { BY_ID, ROSTER } from '../characters/roster.js';
import { Enemy } from './enemies.js';
import { getLevelData } from './levels.js';
import { HERO_LORE, GUIDES, SECTOR_LORE } from './lore.js';

export class AdventureMode {
  constructor(game, opts = {}) {
    this.game = game;
    this.heroId = opts.heroId || 'kael';
    this.sectorId = opts.sectorId || 1;
    this.heroDef = BY_ID[this.heroId] || ROSTER[0];
    this.heroSkin = opts.skin || 0;

    // Load persistent upgrades from save
    this.upgrades = game.save.data.storyUpgrades || {
      maxHpLvl: 0,
      atkLvl: 0,
      doubleJump: false,
      meterRegen: false,
      vampire: false,
    };

    // Hero fighter instance
    this.hero = new Fighter(0, this.heroDef, this.heroSkin);
    this._applyHeroUpgrades();

    // Load Level
    this.level = getLevelData(this.sectorId);
    this.enemies = [];
    this.projectiles = [];
    this.floatingTexts = [];
    this.floatingLoot = [];

    // Player position & state
    this.pX = 140;
    this.pY = 0;
    this.pVx = 0;
    this.pVy = 0;
    this.facing = 1;
    this.grounded = true;
    this.jumpCount = 0;
    this.lastCheckpoint = { x: 140, y: 0 };

    // Camera
    this.cam = { x: this.pX, y: 0, zoom: 1.05 };
    this.camTargetX = this.pX;

    // Active Arena
    this.activeArena = null;
    this.activeBoss = null;

    // Stats & Quests
    this.stats = {
      time: 0,
      shards: 0,
      kills: 0,
      dealt: 0,
      taken: 0,
      maxCombo: 0,
    };
    this.combo = 0;
    this.comboTimer = 0;
    this.comboDamage = 0;

    // Dialogue / Guide interaction
    this.dialogue = null; // { speaker, text, timer }
    this.talkPrompt = null; // { x, y, text }

    // State
    this.paused = false;
    this.cleared = false;
    this.gameOver = false;
    this.frame = 0;

    // Callbacks
    this.onLevelVictory = null;
    this.onGameOver = null;

    // Init Level Entities
    this._initLevel();
  }

  _applyHeroUpgrades() {
    const extraHp = (this.upgrades.maxHpLvl || 0) * 100;
    this.hero.hpMul = 1.0 + (this.upgrades.maxHpLvl || 0) * 0.12;
    this.hero.reset(0, 1);
    this.hero.hp = this.hero.maxHp + extraHp;
    this.maxHp = this.hero.hp;
  }

  _initLevel() {
    // Play Sector Music
    if (this.game.audio && this.game.audio.ready) {
      this.game.audio.music.play(this.level.song);
    }

    // Spawn initial roaming mobs
    this.enemies = this.level.initialEnemies.map(def => new Enemy(def.kind, def.x, def.y, def));

    // Show opening sector transmission
    const lore = SECTOR_LORE.find(s => s.id === this.sectorId);
    if (lore && lore.intro && lore.intro.length) {
      this.showDialogue(lore.intro[0][0] === 'orin' ? 'Orin the Tech-Monk' : 'Transmission', lore.intro[0][1], 240);
    }
  }

  showDialogue(speaker, text, duration = 180) {
    this.dialogue = { speaker, text, timer: duration, max: duration };
    if (this.game.audio) this.game.audio.play('terminal');
  }

  // ---------------------------------------------------------------- Main Loop
  step() {
    if (this.paused) return;
    this.frame++;
    this.stats.time += 1 / 60;

    // Hero passive meter regen upgrade
    if (this.upgrades.meterRegen && this.frame % 30 === 0 && this.hero.meter < 100) {
      this.hero.meter = Math.min(100, this.hero.meter + 1);
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboDamage = 0;
      }
    }

    // Dialogue timer
    if (this.dialogue) {
      this.dialogue.timer--;
      if (this.dialogue.timer <= 0) this.dialogue = null;
    }

    // Update Moving Platforms
    this._updateMovingPlatforms();

    // Update Player
    this._stepPlayer();

    // Update Enemies
    this._stepEnemies();

    // Update Projectiles
    this._stepProjectiles();

    // Update Arenas
    this._stepArenas();

    // Update Floating Items & Particles
    this._stepLoot();

    // Update Camera
    this._updateCamera();

    // Check Victory
    if (this.cleared && !this.victoryReported) {
      this.victoryReported = true;
      this._handleVictory();
    }
  }

  _updateMovingPlatforms() {
    this.level.platforms.forEach(p => {
      if (p.moving) {
        const m = p.moving;
        const offset = Math.sin(this.frame * 0.02 * m.speed) * m.range;
        if (m.axis === 'x') {
          p.currentX = (p.baseX || (p.baseX = p.x)) + offset;
          p.x = p.currentX;
        } else {
          p.currentY = (p.baseY || (p.baseY = p.y)) + offset;
          p.y = p.currentY;
        }
      }
    });
  }

  // ---------------------------------------------------------------- Player Step
  _stepPlayer() {
    const inp = this.game.input.read(0);
    const fx = this.game.fx;
    const a = this.game.audio;

    // Directional movement
    const left = inp.left;
    const right = inp.right;
    const up = inp.up;
    const down = inp.down;
    const prevUp = this.hero.prev.up;

    // Speed bonus from traits / upgrades
    const speed = 4.8 * (this.heroId === 'nyra' ? 1.15 : 1.0);

    // Horizontal acceleration
    if (left) {
      this.pVx = -speed;
      this.facing = -1;
    } else if (right) {
      this.pVx = speed;
      this.facing = 1;
    } else {
      this.pVx *= 0.72; // Ground friction
    }

    // Jumping & Double Jump
    if (up && !prevUp) {
      // Check drop-through one-way platform
      if (down) {
        this.pY -= 6;
        this.grounded = false;
      } else if (this.grounded) {
        this.pVy = 15.5;
        this.grounded = false;
        this.jumpCount = 1;
        if (a) a.play('jump');
        if (fx) fx.dust(this.pX, -(this.pY), 6, 22);
      } else if (this.upgrades.doubleJump && this.jumpCount === 1) {
        // Double jump air boost!
        this.pVy = 14.5;
        this.jumpCount = 2;
        if (a) a.play('dash');
        if (fx) {
          fx.ring(this.pX, -(this.pY + 20), '#00f0ff', 6, 70, 10, 1, 4);
          fx.dust(this.pX, -(this.pY), 8, 30);
        }
      }
    }

    // Gravity
    this.pVy -= 0.64;
    this.pX += this.pVx;
    this.pY += this.pVy;

    // Arena boundary clamp
    if (this.activeArena && this.activeArena.locked) {
      this.pX = Math.max(this.activeArena.gateL + 30, Math.min(this.activeArena.gateR - 30, this.pX));
    } else {
      this.pX = Math.max(20, Math.min(this.level.width - 40, this.pX));
    }

    // Platform collision
    const floorY = this.getFloorY(this.pX, this.pY, this.pVy);
    if (this.pY <= floorY && this.pVy <= 0) {
      this.pY = floorY;
      this.pVy = 0;
      this.grounded = true;
      this.jumpCount = 0;
    } else {
      this.grounded = false;
    }

    // Jump pads (Springs)
    this.level.springs.forEach(sp => {
      if (Math.abs(this.pX - sp.x) < 36 && Math.abs(this.pY - sp.y) < 25 && this.pVy <= 0) {
        this.pVy = sp.power || 18;
        this.grounded = false;
        if (a) a.play('spring');
        if (fx) {
          fx.ring(sp.x, -(sp.y), '#ffd466', 10, 100, 14, 1, 5);
          fx.burst(sp.x, -(sp.y + 10), '#fff', 12, 10);
        }
      }
    });

    // Environmental Hazards (Acid/Lava/Electric)
    this.level.hazards.forEach(hz => {
      if (this.pX >= hz.x && this.pX <= hz.x + hz.w && this.pY <= hz.y + hz.h && this.pY >= hz.y - 40) {
        this._takeHazardDamage(hz.damage);
      }
    });

    // Collect Shards
    this.level.shards.forEach(sh => {
      if (!sh.collected && Math.hypot(this.pX - sh.x, this.pY - sh.y) < 42) {
        sh.collected = true;
        this.stats.shards += 10;
        if (a) a.play('shard');
        if (fx) fx.ember(sh.x, -sh.y, '#ffd700', 2);
        this._checkQuestProgress('shards', 1);
      }
    });

    // Relics (Secret quest collectibles)
    this.level.relics.forEach(r => {
      if (!r.found && Math.hypot(this.pX - r.x, this.pY - r.y) < 48) {
        r.found = true;
        this.stats.shards += 50;
        this._checkQuestProgress('relics', 1);
        if (a) a.play('unlock');
        if (fx) {
          fx.star(r.x, -r.y, '#ffd700', 80, 8);
          fx.flash('#ffd700', 0.25);
        }
        this.showDialogue('Ancient Archive', 'Discovered a Hidden Veil Relic! (+50 Shards)', 120);
      }
    });

    // Checkpoints
    this.level.checkpoints.forEach(cp => {
      if (!cp.active && Math.abs(this.pX - cp.x) < 50 && Math.abs(this.pY - cp.y) < 60) {
        this.level.checkpoints.forEach(c => c.active = false);
        cp.active = true;
        this.lastCheckpoint = { x: cp.x, y: cp.y };
        if (a) a.play('checkpoint');
        if (fx) fx.ring(cp.x, -cp.y, '#4fd18b', 12, 120, 16, 1, 6);
        this.showDialogue('Checkpoint', 'Sector relay aligned. Spawn point saved.', 100);
      }
    });

    // Interactive Terminals (Orin the Guide)
    this.talkPrompt = null;
    this.level.terminals.forEach(tm => {
      if (Math.abs(this.pX - tm.x) < 60 && Math.abs(this.pY - tm.y) < 60) {
        this.talkPrompt = { x: tm.x, y: tm.y + 90, text: '[UP / E] Speak with Orin' };
        if ((inp.up && !prevUp) || inp.sp) {
          tm.visited = true;
          const quote = GUIDES.orin.quotes[tm.quoteIdx % GUIDES.orin.quotes.length];
          this.showDialogue('Orin the Tech-Monk', quote, 220);
          // Restore 25% health when visiting Orin
          this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + Math.round(this.hero.maxHp * 0.25));
          if (fx) fx.pulse('#4fd18b', 0.2);
        }
      }
    });

    // Sync position to Fighter instance
    this.hero.x = this.pX;
    this.hero.y = this.pY;
    this.hero.facing = this.facing;

    // Step Fighter combat state machine (moves, specials, meter, hitboxes)
    const dummyOpponent = this.enemies.find(e => !e.dead && Math.abs(e.x - this.pX) < 180) || null;
    this.hero.tick(inp, dummyOpponent, null);

    // Resolve Player Attack Hits against Enemies, Crates, Nodes & Cages
    this._resolvePlayerAttacks();
  }

  // ---------------------------------------------------------------- Player Attacks & Combat
  _resolvePlayerAttacks() {
    const atk = this.hero.attackBox();
    if (!atk || this.hero.attackHitResolved) return;

    const fx = this.game.fx;
    const a = this.game.audio;
    const move = this.hero.move;
    const isHeavy = move && (move.rank >= 2 || move.ultimate);
    const baseDamage = Math.round((move ? move.damage || 14 : 12) * (1.0 + (this.upgrades.atkLvl || 0) * 0.15));

    let hitAny = false;

    // Hit Enemies
    this.enemies.forEach(en => {
      if (en.dead) return;
      const hb = en.hurtBox();
      if (this._boxesOverlap(atk, hb)) {
        hitAny = true;
        const dealt = en.takeDamage(baseDamage, this.pX, isHeavy, fx, a);
        if (dealt > 0) {
          this.stats.dealt += dealt;
          this.hero.meter = Math.min(100, this.hero.meter + (isHeavy ? 12 : 6));
          this.combo++;
          this.comboTimer = 90;
          this.comboDamage += dealt;
          if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;

          // Vampire perk: heal on combo
          if (this.upgrades.vampire && this.combo % 4 === 0) {
            this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 6);
          }

          // Check combo quest
          this._checkQuestProgress('combo', this.combo);

          // Screen freeze & shake
          if (fx) fx.shake(isHeavy ? 6 : 2.5, isHeavy ? 8 : 4);
        }
      }
    });

    // Hit Breakable Crates
    this.level.crates.forEach(cr => {
      if (cr.hp > 0 && Math.abs(this.pX - cr.x) < 55 && Math.abs(this.pY - cr.y) < 45) {
        cr.hp = 0;
        hitAny = true;
        if (a) a.play('crateBreak');
        if (fx) fx.dust(cr.x, -cr.y, 10, 40);
        this._spawnCrateDrop(cr);
      }
    });

    // Hit Rebel Cages
    this.level.cages.forEach(cg => {
      if (!cg.freed && Math.abs(this.pX - cg.x) < 65 && Math.abs(this.pY - cg.y) < 55) {
        cg.hp -= baseDamage;
        hitAny = true;
        if (cg.hp <= 0) {
          cg.freed = true;
          this._checkQuestProgress('rescue', 1);
          if (a) a.play('cageBreak');
          if (fx) {
            fx.ring(cg.x, -cg.y, '#ffd700', 14, 130, 16, 1, 6);
            fx.flash('#ffd700', 0.2);
          }
          this.showDialogue('Ciela the Scout', 'Thank you! You saved me! Grab these Veil supplies!', 160);
          this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 80);
          this.hero.meter = 100;
        }
      }
    });

    // Hit Circuit Nodes
    this.level.nodes.forEach(nd => {
      if (!nd.destroyed && Math.abs(this.pX - nd.x) < 60 && Math.abs(this.pY - nd.y) < 50) {
        nd.hp -= baseDamage;
        hitAny = true;
        if (nd.hp <= 0) {
          nd.destroyed = true;
          this._checkQuestProgress('nodes', 1);
          this._checkQuestProgress('valves', 1);
          if (a) a.play('heavyImpact');
          if (fx) fx.burst(nd.x, -nd.y, '#00f0ff', 16, 10);
        }
      }
    });

    if (hitAny) {
      this.hero.attackHitResolved = true;
    }
  }

  _spawnCrateDrop(cr) {
    if (cr.type === 'health') {
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 60);
      if (this.game.fx) this.game.fx.text(cr.x, -cr.y, '+60 HP', '#4fd18b', 24, 40);
    } else if (cr.type === 'meter') {
      this.hero.meter = Math.min(100, this.hero.meter + 35);
      if (this.game.fx) this.game.fx.text(cr.x, -cr.y, '+35% METER', '#00f0ff', 24, 40);
    } else {
      this.stats.shards += 25;
      if (this.game.fx) this.game.fx.text(cr.x, -cr.y, '+25 SHARDS', '#ffd700', 24, 40);
    }
  }

  // ---------------------------------------------------------------- Enemies Step
  _stepEnemies() {
    const fx = this.game.fx;
    const a = this.game.audio;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      en.step(this.hero, this, fx, a);

      // Check Enemy Attacks hitting Player
      const eAtk = en.attackBox();
      if (eAtk && !en.attackUsed) {
        const pHurt = this.hero.hurtBox();
        if (this._boxesOverlap(eAtk, pHurt)) {
          en.attackUsed = true;
          this._takePlayerDamage(eAtk.damage, en.x, eAtk.knockback);
        }
      }

      // Enemy death cleanup & drops
      if (en.dead && en.remove) {
        this.enemies.splice(i, 1);
        this.stats.kills++;
        this.stats.shards += en.isBoss ? 200 : 15;
        this._checkQuestProgress('drones', en.kind === 'drone' ? 1 : 0);

        if (en.isBoss) {
          this._checkQuestProgress('boss', 1);
          this._checkQuestProgress('sentinels', 1);
          if (en.isFinalBoss || en.kind === 'boss') {
            this.cleared = true;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- Projectiles Step
  _stepProjectiles() {
    const fx = this.game.fx;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Hit Player
      if (p.fromEnemy) {
        const pHurt = this.hero.hurtBox();
        if (p.x >= pHurt.l && p.x <= pHurt.r && p.y >= pHurt.bottom && p.y <= pHurt.top) {
          this._takePlayerDamage(p.damage, p.x, 4);
          this.projectiles.splice(i, 1);
          if (fx) fx.burst(p.x, -p.y, p.color, 8, 6);
          continue;
        }
      }

      // Hit Ground or Expired
      if (p.y <= 0 || p.life <= 0) {
        this.projectiles.splice(i, 1);
        if (fx) fx.ember(p.x, -p.y, p.color, 1.2);
      }
    }
  }

  _takePlayerDamage(dmg, fromX, knockback = 5) {
    const a = this.game.audio;
    const fx = this.game.fx;

    // Parry check
    if (this.hero.parryWindow > 0) {
      if (a) a.play('parry');
      if (fx) {
        fx.star(this.pX, -(this.pY + 40), '#7ff3ff', 80, 8);
        fx.flash('#bdf8ff', 0.2);
      }
      this.hero.meter = Math.min(100, this.hero.meter + 15);
      this.hero.parryWindow = 0;
      return;
    }

    // Blocking check
    if (this.hero.state === S.BLOCKING) {
      dmg = Math.round(dmg * 0.2);
      if (a) a.play('block');
      if (fx) fx.shield(this.pX + this.facing * 16, -(this.pY + 40), this.facing, '#bcd8ff', false);
    }

    this.hero.hp -= dmg;
    this.stats.taken += dmg;
    this.hero.hurtFlash = 10;
    this.pVx = (this.pX >= fromX ? 1 : -1) * knockback;
    this.pVy = 3.5;

    if (a) a.play('hit');
    if (fx) {
      fx.shake(5, 7);
      fx.burst(this.pX, -(this.pY + 40), '#ff3a3a', 10, 6);
    }

    if (this.hero.hp <= 0) {
      this.hero.hp = 0;
      this._handlePlayerDeath();
    }
  }

  _takeHazardDamage(dmg) {
    this.hero.hp -= dmg;
    this.stats.taken += dmg;
    if (this.game.audio) this.game.audio.play('laserZap');
    if (this.game.fx) {
      this.game.fx.flash('#ff3a3a', 0.3);
      this.game.fx.shake(8, 12);
    }

    if (this.hero.hp <= 0) {
      this._handlePlayerDeath();
    } else {
      // Teleport back to checkpoint safely
      this.pX = this.lastCheckpoint.x;
      this.pY = this.lastCheckpoint.y + 10;
      this.pVx = 0;
      this.pVy = 0;
    }
  }

  _handlePlayerDeath() {
    this.gameOver = true;
    if (this.game.audio) this.game.audio.play('roundLoss');
    if (this.onGameOver) this.onGameOver(this.stats);
  }

  _handleVictory() {
    if (this.game.audio) {
      this.game.audio.music.stop(0.3);
      this.game.audio.play('victoryFanfare');
    }
    // Calculate Letter Grade
    const timeSec = this.stats.time;
    let grade = 'B';
    if (timeSec < 150 && this.stats.taken < 200) grade = 'S';
    else if (timeSec < 220 && this.stats.taken < 400) grade = 'A';

    this._checkQuestProgress('grade', (grade === 'S' || grade === 'A') ? 1 : 0);

    // Save progression
    const s = this.game.save;
    if (s) {
      s.data.storyUnlocked = Math.max(s.data.storyUnlocked || 1, this.sectorId + 1);
      s.data.storyShards = (s.data.storyShards || 0) + this.stats.shards;
      s.data.storyScores = s.data.storyScores || {};
      s.data.storyScores[this.sectorId] = { grade, time: timeSec, shards: this.stats.shards };
      s.save();
    }

    if (this.onLevelVictory) {
      this.onLevelVictory({
        sectorId: this.sectorId,
        grade,
        time: Math.round(timeSec),
        shards: this.stats.shards,
        kills: this.stats.kills,
        questsDone: this.level.quests.filter(q => q.done).length,
      });
    }
  }

  // ---------------------------------------------------------------- Arenas Step
  _stepArenas() {
    this.level.arenas.forEach(ar => {
      // Player crosses arena threshold
      if (!ar.cleared && !ar.locked && this.pX >= ar.x0 && this.pX <= ar.x1) {
        ar.locked = true;
        this.activeArena = ar;
        if (!ar.spawned) {
          ar.spawned = true;
          // Spawn arena wave
          ar.spawnEnemyDefs.forEach(def => {
            const en = new Enemy(def.kind, def.x, def.y, def);
            this.enemies.push(en);
            if (en.isBoss) {
              this.activeBoss = en;
              if (this.game.audio) {
                this.game.audio.music.play('story_boss');
                this.game.audio.play('bossAlarm');
              }
              const lore = SECTOR_LORE.find(s => s.id === this.sectorId);
              if (lore && lore.preBoss) {
                this.showDialogue(en.bossName, lore.preBoss[0][1], 240);
              }
            }
          });
        }
      }

      // Check arena cleared
      if (ar.locked && !ar.cleared) {
        const remaining = this.enemies.filter(e => !e.dead && e.x >= ar.x0 - 100 && e.x <= ar.x1 + 100);
        if (remaining.length === 0) {
          ar.cleared = true;
          ar.locked = false;
          this.activeArena = null;
          this.activeBoss = null;
          if (this.game.audio) {
            this.game.audio.play('questComplete');
            this.game.audio.music.play(this.level.song);
          }
          if (this.game.fx) {
            this.game.fx.pulse('#4fd18b', 0.3);
            this.game.fx.flash('#fff', 0.2);
          }
          this.showDialogue('Sector Alert', 'Hostiles neutralized. Energy gates lowered.', 140);
        }
      }
    });
  }

  _stepLoot() {
    // Floating particles & loot
  }

  _checkQuestProgress(questId, amount) {
    const q = this.level.quests.find(item => item.id === questId);
    if (q && !q.done) {
      q.current = Math.min(q.target, q.current + amount);
      if (q.current >= q.target) {
        q.done = true;
        if (this.game.audio) this.game.audio.play('questComplete');
        this.showDialogue('Quest Completed', q.text, 140);
      }
    }
  }

  // ---------------------------------------------------------------- Camera & Geometry
  getFloorY(x, y, vy) {
    let bestY = 0; // Default ground level
    for (const p of this.level.platforms) {
      if (x >= p.x && x <= p.x + p.w) {
        if (p.ground) {
          if (bestY < p.y) bestY = p.y;
        } else if (p.oneWay) {
          // One-way platform: only catch feet if falling through the top
          if (y >= p.y - 6 && y + vy <= p.y + 12) {
            if (p.y > bestY) bestY = p.y;
          }
        } else {
          if (y >= p.y && p.y > bestY) bestY = p.y;
        }
      }
    }
    return bestY;
  }

  _updateCamera() {
    // Camera smoothly follows player with lookahead
    const lookAhead = this.facing * 140;
    this.camTargetX = this.pX + lookAhead;

    // Clamp camera within active arena or level bounds
    const minCam = this.activeArena && this.activeArena.locked ? this.activeArena.gateL + 640 : 640;
    const maxCam = this.activeArena && this.activeArena.locked ? this.activeArena.gateR - 640 : this.level.width - 640;

    const clampedX = Math.max(minCam, Math.min(maxCam, this.camTargetX));
    this.cam.x += (clampedX - this.cam.x) * 0.1;
  }

  _boxesOverlap(a, b) {
    if (!a || !b) return false;
    return a.l < b.r && a.r > b.l && a.top > b.bottom && a.bottom < b.top;
  }

  // ---------------------------------------------------------------- Rendering
  render(ctx) {
    const cam = this.cam;
    const zl = cam.zoom;
    const fx = this.game.fx;

    // 1. Draw Parallax Background
    this._drawBackground(ctx, cam);

    // 2. Draw World Entities (Platforms, Hazards, Collectibles, NPCs)
    this._drawPlatforms(ctx, cam);
    this._drawHazards(ctx, cam);
    this._drawCollectibles(ctx, cam);
    this._drawTerminalsAndCages(ctx, cam);

    // 3. Draw Arena Energy Gates
    this._drawArenaGates(ctx, cam);

    // 4. Draw Enemies
    this.enemies.forEach(en => en.draw(ctx, cam, this.frame));

    // 5. Draw Projectiles
    this._drawProjectiles(ctx, cam);

    // 6. Draw Player Fighter (Using the exquisite procedural FighterRenderer!)
    this._drawPlayer(ctx, cam);

    // 7. World-space Particle FX
    ctx.save();
    const gy = 360 + (610 - 360) * zl;
    ctx.translate(640 - cam.x * zl, gy);
    ctx.scale(zl, zl);
    fx.draw(ctx);
    ctx.restore();

    // 8. Screen Flash & Grade
    if (fx.flashA > 0.01) {
      ctx.save();
      ctx.globalAlpha = fx.flashA;
      ctx.fillStyle = fx.flashCol;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.restore();
    }

    // 9. Draw Adventure HUD (Health bar, Shards, Quests, Boss Bar, Dialogue)
    this._drawHUD(ctx);
  }

  _drawBackground(ctx, cam) {
    const t = this.frame;
    const zl = cam.zoom;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, 720);
    if (this.sectorId === 1) {
      sky.addColorStop(0, '#040711');
      sky.addColorStop(0.5, '#0b1020');
      sky.addColorStop(1, '#1b1226');
    } else if (this.sectorId === 2) {
      sky.addColorStop(0, '#020d12');
      sky.addColorStop(0.5, '#051f26');
      sky.addColorStop(1, '#0e3436');
    } else if (this.sectorId === 3) {
      sky.addColorStop(0, '#150604');
      sky.addColorStop(0.5, '#280c06');
      sky.addColorStop(1, '#421608');
    } else {
      sky.addColorStop(0, '#070514');
      sky.addColorStop(0.5, '#150d32');
      sky.addColorStop(1, '#2f1b4a');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1280, 720);

    // Distant Neon Skyline / Parallax Layer (f = 0.2)
    ctx.save();
    const offX = -(cam.x * 0.15) % 800;
    ctx.fillStyle = 'rgba(10, 16, 30, 0.6)';
    for (let i = -1; i < 4; i++) {
      const bx = i * 400 + offX;
      ctx.fillRect(bx, 280, 120, 440);
      ctx.fillRect(bx + 140, 220, 160, 500);
      ctx.fillRect(bx + 320, 310, 90, 410);
    }

    // Neon Billboards & Lights
    if (this.sectorId === 1) {
      ctx.fillStyle = 'rgba(255, 32, 64, 0.4)';
      ctx.fillRect(offX + 160, 260, 80, 24);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.fillRect(offX + 540, 290, 90, 26);
    } else if (this.sectorId === 3) {
      // Lava glow in background
      const lavaGlow = ctx.createLinearGradient(0, 500, 0, 720);
      lavaGlow.addColorStop(0, 'rgba(255, 60, 0, 0)');
      lavaGlow.addColorStop(1, 'rgba(255, 80, 0, 0.4)');
      ctx.fillStyle = lavaGlow;
      ctx.fillRect(0, 500, 1280, 220);
    }
    ctx.restore();
  }

  _drawPlatforms(ctx, cam) {
    const zl = cam.zoom;
    const gy = 360 + (610 - 360) * zl;

    this.level.platforms.forEach(p => {
      const sx = (p.x - cam.x) * zl + 640;
      const sy = gy - p.y * zl;
      const sw = p.w * zl;
      const sh = (p.h || 20) * zl;

      if (sx + sw < -50 || sx > 1330) return; // Frustum culling

      ctx.save();
      if (p.ground) {
        // Ground slab
        ctx.fillStyle = '#0f131a';
        ctx.fillRect(sx, sy, sw, 200);

        // Top edge glow border
        ctx.fillStyle = '#252e3d';
        ctx.fillRect(sx, sy, sw, 4);

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx, sy, sw, 200);
      } else {
        // Floating cyber girder platform
        ctx.fillStyle = '#141a24';
        ctx.fillRect(sx, sy, sw, sh);

        // Neon edge strip
        ctx.fillStyle = this.sectorId === 3 ? '#ff6a20' : this.sectorId === 2 ? '#00e0a0' : '#00e5ff';
        ctx.fillRect(sx, sy, sw, 3);

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, sw, sh);
      }
      ctx.restore();
    });

    // Jump pads (Springs)
    this.level.springs.forEach(sp => {
      const sx = (sp.x - cam.x) * zl + 640;
      const sy = gy - sp.y * zl;
      ctx.save();
      ctx.fillStyle = '#ffd466';
      ctx.fillRect(sx - 18 * zl, sy - 6 * zl, 36 * zl, 6 * zl);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 18 * zl, sy - 6 * zl, 36 * zl, 6 * zl);
      ctx.restore();
    });
  }

  _drawHazards(ctx, cam) {
    const zl = cam.zoom;
    const gy = 360 + (610 - 360) * zl;

    this.level.hazards.forEach(hz => {
      const sx = (hz.x - cam.x) * zl + 640;
      const sy = gy - hz.y * zl;
      const sw = hz.w * zl;

      ctx.save();
      if (hz.type === 'acid') {
        ctx.fillStyle = 'rgba(0, 255, 128, 0.4)';
        ctx.fillRect(sx, sy, sw, 60);
      } else if (hz.type === 'lava') {
        ctx.fillStyle = 'rgba(255, 64, 0, 0.6)';
        ctx.fillRect(sx, sy, sw, 60);
      } else {
        ctx.fillStyle = 'rgba(0, 200, 255, 0.5)';
        ctx.fillRect(sx, sy, sw, 60);
      }
      ctx.restore();
    });
  }

  _drawCollectibles(ctx, cam) {
    const zl = cam.zoom;
    const gy = 360 + (610 - 360) * zl;

    // Veil Shards
    this.level.shards.forEach(sh => {
      if (sh.collected) return;
      const sx = (sh.x - cam.x) * zl + 640;
      const sy = gy - sh.y * zl;
      const bob = Math.sin(this.frame * 0.08 + sh.x * 0.02) * 5;

      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.rotate((this.frame * 0.04) % (Math.PI * 2));
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -9 * zl);
      ctx.lineTo(7 * zl, 0);
      ctx.lineTo(0, 9 * zl);
      ctx.lineTo(-7 * zl, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Hidden Relics
    this.level.relics.forEach(r => {
      if (r.found) return;
      const sx = (r.x - cam.x) * zl + 640;
      const sy = gy - r.y * zl;
      ctx.save();
      ctx.fillStyle = '#e0b84a';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 14 * zl, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  _drawTerminalsAndCages(ctx, cam) {
    const zl = cam.zoom;
    const gy = 360 + (610 - 360) * zl;

    // Orin Hologram Terminals
    this.level.terminals.forEach(tm => {
      const sx = (tm.x - cam.x) * zl + 640;
      const sy = gy - tm.y * zl;

      ctx.save();
      // Base pedestal
      ctx.fillStyle = '#181e28';
      ctx.fillRect(sx - 16 * zl, sy - 10 * zl, 32 * zl, 10 * zl);

      // Hologram Monk beam
      const flicker = 0.5 + Math.sin(this.frame * 0.15) * 0.2;
      ctx.fillStyle = `rgba(0, 240, 255, ${flicker})`;
      ctx.beginPath();
      ctx.arc(sx, sy - 38 * zl, 10 * zl, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sx - 8 * zl, sy - 28 * zl, 16 * zl, 18 * zl);

      ctx.restore();
    });

    // Rebel Cages
    this.level.cages.forEach(cg => {
      if (cg.freed) return;
      const sx = (cg.x - cam.x) * zl + 640;
      const sy = gy - cg.y * zl;

      ctx.save();
      ctx.strokeStyle = '#ffd466';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx - 20 * zl, sy - 50 * zl, 40 * zl, 50 * zl);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sx - 20 * zl + i * 10 * zl, sy);
        ctx.lineTo(sx - 20 * zl + i * 10 * zl, sy - 50 * zl);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  _drawArenaGates(ctx, cam) {
    const zl = cam.zoom;
    const gy = 360 + (610 - 360) * zl;

    if (this.activeArena && this.activeArena.locked) {
      [this.activeArena.gateL, this.activeArena.gateR].forEach(gx => {
        const sx = (gx - cam.x) * zl + 640;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 58, 58, 0.35)';
        ctx.fillRect(sx - 10 * zl, 0, 20 * zl, 720);
        ctx.strokeStyle = '#ff3a3a';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - 10 * zl, 0, 20 * zl, 720);
        ctx.restore();
      });
    }
  }

  _drawProjectiles(ctx, cam) {
    const zl = cam.zoom;
    const gy = 360 + (610 - 360) * zl;

    this.projectiles.forEach(p => {
      const sx = (p.x - cam.x) * zl + 640;
      const sy = gy - p.y * zl;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 6 * zl, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  _drawPlayer(ctx, cam) {
    const zl = cam.zoom;
    const sx = (this.pX - cam.x) * zl + 640;
    const gy = 360 + (610 - 360) * zl;

    // Draw shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(sx, gy - this.getFloorY(this.pX, this.pY, 0) * zl, 30 * zl, 8 * zl, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Use game's layered FighterRenderer!
    ctx.save();
    ctx.translate(sx, gy - this.pY * zl);
    ctx.scale(zl, zl);
    this.game.renderer.draw(ctx, this.hero, 0, 0, this.frame, {
      facing: this.facing,
    });
    ctx.restore();
  }

  // ---------------------------------------------------------------- Top HUD Overlay
  _drawHUD(ctx) {
    // 1. Player Health & Meter (Top Left)
    ctx.save();
    ctx.fillStyle = 'rgba(8, 9, 13, 0.88)';
    ctx.fillRect(30, 24, 320, 80);
    ctx.strokeStyle = 'rgba(200, 206, 216, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(30, 24, 320, 80);

    // Hero Name & Level Sub
    ctx.fillStyle = '#fff';
    ctx.font = '800 16px "Bahnschrift", sans-serif';
    ctx.fillText(`${this.heroDef.name.toUpperCase()}  -  ${HERO_LORE[this.heroId]?.title || 'HERO'}`, 44, 48);

    // HP Bar
    const hpPct = Math.max(0, this.hero.hp / this.hero.maxHp);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(44, 56, 290, 14);
    const hpGrad = ctx.createLinearGradient(44, 0, 334, 0);
    hpGrad.addColorStop(0, '#ff3a3a');
    hpGrad.addColorStop(1, '#ff6a4a');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(44, 56, 290 * hpPct, 14);
    ctx.fillStyle = '#fff';
    ctx.font = '700 11px sans-serif';
    ctx.fillText(`${Math.round(this.hero.hp)} / ${this.hero.maxHp}`, 160, 68);

    // Veil Meter Bar (Ultimate)
    const meterPct = Math.min(1, this.hero.meter / 100);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(44, 76, 290, 8);
    ctx.fillStyle = meterPct >= 1 ? '#ffd700' : '#00e5ff';
    ctx.fillRect(44, 76, 290 * meterPct, 8);
    ctx.restore();

    // 2. Veil Shard Bank (Top Center-Left)
    ctx.save();
    ctx.fillStyle = 'rgba(8, 9, 13, 0.85)';
    ctx.fillRect(365, 24, 150, 36);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(365, 24, 150, 36);
    ctx.fillStyle = '#ffd700';
    ctx.font = '800 16px "Bahnschrift", sans-serif';
    ctx.fillText(`◆ ${this.stats.shards} SHARDS`, 380, 48);
    ctx.restore();

    // 3. Sector Progress Minimap Bar (Top Center)
    ctx.save();
    ctx.fillStyle = 'rgba(8, 9, 13, 0.7)';
    ctx.fillRect(530, 24, 380, 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(530, 24, 380, 14);

    const progPct = Math.min(1, this.pX / this.level.width);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(530, 24, 380 * progPct, 14);

    // Pin
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(530 + 380 * progPct, 31, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Quests Checklist (Top Right)
    ctx.save();
    ctx.fillStyle = 'rgba(8, 9, 13, 0.88)';
    ctx.fillRect(930, 24, 320, 110);
    ctx.strokeStyle = 'rgba(200, 206, 216, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(930, 24, 320, 110);

    ctx.fillStyle = '#ffd700';
    ctx.font = '800 13px "Bahnschrift", sans-serif';
    ctx.fillText('SECTOR OBJECTIVES', 944, 44);

    this.level.quests.forEach((q, idx) => {
      ctx.fillStyle = q.done ? '#4fd18b' : '#c3c9d6';
      ctx.font = '600 12px sans-serif';
      const mark = q.done ? '✓ ' : '○ ';
      ctx.fillText(`${mark}${q.text} (${q.current}/${q.target})`, 944, 64 + idx * 18);
    });
    ctx.restore();

    // 5. Active Boss Bar (Top Center, when boss engaged)
    if (this.activeBoss && !this.activeBoss.dead) {
      const b = this.activeBoss;
      ctx.save();
      ctx.fillStyle = 'rgba(8, 9, 13, 0.95)';
      ctx.fillRect(340, 70, 600, 48);
      ctx.strokeStyle = '#ff3a3a';
      ctx.lineWidth = 2;
      ctx.strokeRect(340, 70, 600, 48);

      ctx.fillStyle = '#ff3a3a';
      ctx.font = '800 14px "Bahnschrift", sans-serif';
      ctx.fillText(`${b.bossName.toUpperCase()} - ${b.bossTitle.toUpperCase()}`, 354, 88);

      const bPct = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(354, 94, 572, 14);
      ctx.fillStyle = b.phase === 2 ? '#ff2040' : '#ffd466';
      ctx.fillRect(354, 94, 572 * bPct, 14);
      ctx.restore();
    }

    // 6. Combo Counter (Left Center)
    if (this.combo >= 2) {
      ctx.save();
      ctx.font = '900 36px "Bahnschrift", sans-serif';
      ctx.fillStyle = '#ff3a3a';
      ctx.fillText(`${this.combo} HITS`, 44, 180);
      ctx.font = '700 18px sans-serif';
      ctx.fillStyle = '#ffd700';
      const rank = this.combo >= 15 ? 'GODLIKE!' : this.combo >= 10 ? 'SAVAGE!' : this.combo >= 6 ? 'GREAT!' : 'COOL!';
      ctx.fillText(rank, 44, 206);
      ctx.restore();
    }

    // 7. Dialogue Transmission Box (Bottom Center)
    if (this.dialogue) {
      ctx.save();
      ctx.fillStyle = 'rgba(8, 9, 13, 0.94)';
      ctx.fillRect(180, 560, 920, 110);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(180, 560, 920, 110);

      ctx.fillStyle = '#00f0ff';
      ctx.font = '800 16px "Bahnschrift", sans-serif';
      ctx.fillText(this.dialogue.speaker.toUpperCase(), 205, 588);

      ctx.fillStyle = '#fff';
      ctx.font = '500 18px sans-serif';
      ctx.fillText(this.dialogue.text, 205, 622);
      ctx.restore();
    }

    // 8. Talk Prompt
    if (this.talkPrompt) {
      const zl = this.cam.zoom;
      const sx = (this.talkPrompt.x - this.cam.x) * zl + 640;
      const gy = 360 + (610 - 360) * zl;
      const sy = gy - this.talkPrompt.y * zl;
      ctx.save();
      ctx.fillStyle = '#ffd700';
      ctx.font = '800 14px "Bahnschrift", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.talkPrompt.text, sx, sy);
      ctx.restore();
    }
  }
}
