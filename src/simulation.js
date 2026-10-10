export const RULES = Object.freeze({
  breakingForce: 1612,
  initialSpeed: 110 / 3.6,
  pressureRise: 580,
  pressureRelease: 1750,
  initialForce: 240,
  acceleration: 1.65,
  maxDeceleration: 10.1,
});

export function createState() {
  return {
    phase: 'ready', speed: RULES.initialSpeed, pressure: 0, peakPressure: 0,
    time: 0, distance: 0, braking: false, countdown: 3, stoppedAt: null,
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
    return;
  }

  const acceleration = RULES.acceleration + Math.min(state.time * 0.015, 0.8);
  const deceleration = held ? RULES.maxDeceleration * Math.min(state.pressure / 560, 1) : 0;
  const before = state.speed;
  state.speed = Math.max(0, state.speed + (acceleration - deceleration) * dt);
  state.distance += (before + state.speed) * 0.5 * dt;
  if (state.speed === 0) {
    state.phase = 'stopped';
    state.braking = false;
    state.stoppedAt = state.time;
  }
}
