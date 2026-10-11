// Central tuning values. Simulation runs at a fixed 60 Hz; all frame counts below are sim frames.
export const CFG = {
  W: 1280, H: 720,
  FPS: 60,
  GROUND: 610,            // world-space y of the floor
  STAGE_W: 1900,          // world width
  WALL_PAD: 60,
  GRAVITY: 0.62,
  PUSH_W: 46,             // body push-box width (fighter separation)
  STAND_H: 178, CROUCH_H: 120, HURT_W: 58,
  MAX_GUARD: 100, GUARD_REGEN: 0.18, GUARD_REGEN_DELAY: 90,
  PARRY_WINDOW: 7, PARRY_COOLDOWN: 36, PARRY_PUNISH_STUN: 26,
  BUFFER: 7,
  METER_MAX: 100,
  CHIP_SPECIAL: 0.12,
  COMBO_SCALE_STEP: 0.1, COMBO_SCALE_MIN: 0.3,
  JUGGLE_MAX: 3,
  COMBO_HITSTUN_DECAY: 1.5, HITSTUN_MIN: 9,
  COUNTER_DMG: 1.2, PUNISH_DMG: 1.1,
  INTRO_FRAMES: 130, KO_FRAMES: 110, ROUND_END_FRAMES: 170,
  KNOCKDOWN_FRAMES: 52, GETUP_FRAMES: 24,
  THROW_TECH_WINDOW: 8, EX_METER_COST: 25, VEIL_BREAK_COST: 25,
  RAGE_HP_THRESHOLD: 0.25, RAGE_DMG_BOOST: 1.15,
  WALL_BOUNCE_VY: 7.0, WALL_BOUNCE_VX: 4.5, GROUND_BOUNCE_VY: 6.5,
  SIDESTEP_FRAMES: 14, AIR_DASH_SPEED: 8.5,
  DEFAULTS: { roundTime: 60, roundsToWin: 2, difficulty: 'normal' },
};
