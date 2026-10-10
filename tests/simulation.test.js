import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, createState, startRun, step } from '../src/simulation.js';

function running() { const s = createState(); s.phase = 'running'; return s; }
function advance(s, seconds, input, dt = 1 / 120) {
  for (let i = 0; i < Math.round(seconds / dt); i++) step(s, dt, input(s));
}

test('car accelerates while the pedal is released', () => {
  const s = running(); advance(s, 3, () => false);
  assert.ok(s.speed > RULES.initialSpeed + 4);
  assert.equal(s.pressure, 0);
});
test('continuous press breaks the pedal at exactly 1612 N before stopping', () => {
  const s = running(); advance(s, 4, () => true);
  assert.equal(s.phase, 'broken'); assert.equal(s.pressure, 1612);
  assert.ok(s.speed > 0);
  const snapshot = { ...s }; advance(s, 8, () => false);
  assert.deepEqual(s, snapshot);
});
test('releasing unloads the pedal and pressing brakes again', () => {
  const s = running(); advance(s, 1.6, () => true);
  const speed = s.speed, pressure = s.pressure;
  advance(s, 0.4, () => false);
  assert.ok(s.pressure < pressure - 600); assert.ok(s.speed > speed);
  advance(s, 0.6, () => true); assert.ok(s.speed < speed);
});
test('controlled press / release cycles can stop the car without rupture', () => {
  const s = running(); advance(s, 20, s => s.time % 1.95 < 1.4);
  assert.equal(s.phase, 'stopped'); assert.equal(s.speed, 0);
  assert.ok(s.peakPressure < 1612); assert.ok(s.distance > 0);
  const snapshot = { ...s }; advance(s, 20, () => false);
  assert.deepEqual(s, snapshot);
});
test('countdown resets all data and ignores held input until the run', () => {
  const s = running(); advance(s, 1.5, () => true); startRun(s);
  advance(s, 3, () => true);
  assert.equal(s.phase, 'running'); assert.equal(s.time, 0); assert.equal(s.pressure, 0);
});
test('braking threshold takes precedence on the frame it is reached', () => {
  const s = running(); s.pressure = 1611; s.speed = 0.001; step(s, 1 / 60, true);
  assert.equal(s.phase, 'broken'); assert.equal(s.pressure, 1612);
});
