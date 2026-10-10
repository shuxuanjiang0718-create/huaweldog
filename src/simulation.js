export const RULES = Object.freeze({
  breakingForce: 1612,
  initialSpeed: 110 / 3.6,
  pressureRise: 580,
  pressureRelease: 1750,
  initialForce: 240,
  acceleration: 3.35,
  maxDeceleration: 12.1,
  guardrailX: 7.20,
});

export function createState() {
  return {
    phase: 'ready', speed: RULES.initialSpeed, pressure: 0, peakPressure: 0,
    time: 0, distance: 0, braking: false, countdown: 3, stoppedAt: null,
    failedAt: null, crashTime: 0, lateral: 0, lateralVelocity: 0,
    yaw: 0, yawVelocity: 0, impacts: 0, impactSide: 0, impactSpeed: 0,
    lastImpactAt: -100, damage: 0,
  };
}

export function startRun(state) {
  Object.assign(state, createState(), { phase: 'countdown' });
}

// Metres, seconds and newtons. Rendering and input never own game rules.
export function step(state, dt, held) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  if (state.phase === 'countdown') {
    state.countdown = Math.max(0, state.countdown - dt);
    if (state.countdown <= 1e-9) state.phase = 'running';
    return;
  }
  if (state.phase === 'broken') {
    stepCrash(state, dt);
    return;
  }
  if (state.phase !== 'running') {
    state.braking = false;
    return;
  }
  state.braking = held;
  state.time += dt;
  state.pressure = held
    ? Math.min(RULES.breakingForce, Math.max(RULES.initialForce, state.pressure) + RULES.pressureRise * dt)
    : Math.max(0, state.pressure - RULES.pressureRelease * dt);
  state.peakPressure = Math.max(state.peakPressure, state.pressure);

  if (state.pressure >= RULES.breakingForce) {
    state.pressure = RULES.breakingForce;
    state.phase = 'broken';
    state.braking = false;
    state.failedAt = state.time;
    state.lateralVelocity = 1.4;
    return;
  }

  const acceleration = RULES.acceleration + Math.min(state.time * 0.035, 1.2);
  // A press engages the brakes on this physics tick. Force buildup is the rupture risk,
  // not an artificial delay before braking begins.
  const deceleration = held ? RULES.maxDeceleration : 0;
  const before = state.speed;
  state.speed = Math.max(0, state.speed + (acceleration - deceleration) * dt);
  state.distance += (before + state.speed) * 0.5 * dt;
  if (state.speed === 0) {
    state.phase = 'stopped';
    state.braking = false;
    state.stoppedAt = state.time;
  }
}

function stepCrash(state, dt) {
  state.braking = false;
  state.crashTime += dt;
  state.time += dt;
  const before = state.speed;
  if (state.impacts === 0) {
    const targetYaw = -.42 + Math.sin(state.crashTime * 9) * .045;
    state.yaw += (targetYaw - state.yaw) * (1 - Math.exp(-dt * 4));
    const lateralTarget = 3.2 + state.speed * .27;
    state.lateralVelocity += (lateralTarget - state.lateralVelocity) * (1 - Math.exp(-dt * 3));
    state.speed += .65 * dt;
  } else {
    // Impact removes momentum; tyres scrub sideways and yaw settles as energy dissipates.
    state.speed = Math.max(0, state.speed - (4.5 + Math.abs(state.lateralVelocity) * .28) * dt);
    state.yaw += state.yawVelocity * dt;
    state.yawVelocity *= Math.exp(-dt * .8);
    state.lateralVelocity *= Math.exp(-dt * .40);
    if (state.speed < 2) state.lateralVelocity *= Math.exp(-dt * 3);
  }
  state.lateral += state.lateralVelocity * dt;
  const halfWidth = Math.abs(Math.cos(state.yaw)) * 1.12 + Math.abs(Math.sin(state.yaw)) * 2.72;
  const limit = RULES.guardrailX - halfWidth;
  if (Math.abs(state.lateral) >= limit && state.crashTime - state.lastImpactAt > .25) {
    const side = Math.sign(state.lateral);
    state.lateral = side * limit;
    state.impactSide = side;
    state.impactSpeed = Math.hypot(state.speed * .55, state.lateralVelocity);
    state.lastImpactAt = state.crashTime;
    state.impacts++;
    state.damage = Math.min(1, state.damage + .58 + state.impactSpeed / 90);
    state.speed *= state.impacts === 1 ? .66 : .40;
    state.lateralVelocity = -side * Math.min(11, 6.8 + state.speed * .24);
    state.yawVelocity = side * (state.impacts === 1 ? 1.55 : -.8);
  }
  state.distance += (before + state.speed) * .5 * dt * Math.max(.28, Math.abs(Math.cos(state.yaw)));
  if (state.impacts > 0 && (state.speed <= .05 || state.crashTime > 6.8)) {
    state.speed = 0; state.lateralVelocity = 0; state.yawVelocity = 0;
    state.phase = 'wrecked';
  }
}
