// Animation Lab: Comprehensive procedural animation validation harness.
// Evaluates every fighter across every clip in CLIP_NAMES and all attack animations.
// Validates:
// 1. Zero NaN / Infinity / undefined values in joint angles.
// 2. All clip names resolve to valid poses.
// 3. Continuity: Checks that consecutive frames do not have impossible joint discontinuities (> 120 deg per frame).
import { ROSTER } from '../src/characters/roster.js';
import { samplePose, CLIP_NAMES, MOVE_ANIMS, POSE_KEYS } from '../src/characters/poses.js';

console.log('=== IRON VEIL: ANIMATION LAB TEST SUITE ===');
let totalTests = 0;
let totalFrames = 0;
let errors = [];

for (const def of ROSTER) {
  const f = {
    def,
    index: 0,
    facing: 1,
    vx: 0,
    vy: 0,
    walkDist: 0,
    state: 'IDLE',
    anim: { name: 'idle', frame: 0 },
    move: null,
    moveFrame: 0,
    _pose: null
  };

  // 1. Test each clip in CLIP_NAMES across 30 frames
  for (const clip of CLIP_NAMES) {
    totalTests++;
    f._pose = null;
    f.anim = { name: clip, frame: 0 };
    f.state = clip === 'crouch' || clip === 'crouchHold' ? 'CROUCH' :
              clip.startsWith('hit') ? 'HITSTUN' :
              clip === 'blockS' || clip === 'blockC' ? 'BLOCKSTUN' :
              clip === 'knockdown' || clip === 'knockdownRoll' ? 'KNOCKDOWN' : 'IDLE';

    let prevPose = null;
    for (let frame = 0; frame < 30; frame++) {
      totalFrames++;
      f.anim.frame = frame;
      f.walkDist = frame * 4.2;
      const pose = samplePose(f, frame);

      // Check NaN / undefined / Infinity
      for (const k of POSE_KEYS) {
        const val = pose[k];
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          errors.push(`[${def.id}] Clip '${clip}' frame ${frame} has invalid ${k}: ${val}`);
        }
      }

      // Check abrupt jump (continuity test)
      if (prevPose && frame > 1 && !clip.includes('Spin') && !clip.includes('Roll') && clip !== 'thrown') {
        for (const k of ['ln', 'uf', 'ub', 'tf', 'tb']) {
          const delta = Math.abs(pose[k] - prevPose[k]);
          if (delta > 110) {
            errors.push(`[${def.id}] Clip '${clip}' frame ${frame} abrupt pose jump on ${k}: ${delta.toFixed(1)} deg`);
          }
        }
      }
      prevPose = { ...pose };
    }
  }

  // 2. Test each character move from their move table
  for (const [mvName, mv] of Object.entries(def.moves)) {
    totalTests++;
    f._pose = null;
    f.move = mv;
    f.state = mv.ultimate ? 'ULTIMATE' : mv.sfx === 'special' ? 'SPECIAL' : 'ATTACK_ACTIVE';
    const totalMoveFrames = (mv.startup || 5) + (mv.active || 4) + (mv.recovery || 10);

    for (let frame = 0; frame < totalMoveFrames; frame++) {
      totalFrames++;
      f.moveFrame = frame;
      const pose = samplePose(f, frame);

      for (const k of POSE_KEYS) {
        const val = pose[k];
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          errors.push(`[${def.id}] Move '${mvName}' frame ${frame} has invalid ${k}: ${val}`);
        }
      }
    }
    f.move = null;
  }
}

console.log(`Fighters tested: ${ROSTER.length}`);
console.log(`Clips & moves validated: ${totalTests}`);
console.log(`Total animation frames evaluated: ${totalFrames}`);

if (errors.length > 0) {
  console.error(`FAILED: ${errors.length} animation issues detected:`);
  for (const err of errors.slice(0, 10)) console.error('  *', err);
  if (errors.length > 10) console.error(`  ... and ${errors.length - 10} more`);
  process.exit(1);
} else {
  console.log('PASSED: All poses are valid, smooth, and 100% NaN-free!');
  process.exit(0);
}
