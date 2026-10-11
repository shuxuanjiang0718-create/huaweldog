import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, createState, startRun, step } from '../src/simulation.js';

function running() { const s = createState(); s.phase = 'running'; return s; }
function advance(s, seconds, input, dt = 1 / 120) {
  for (let i = 0; i < Math.round(seconds / dt); i++) step(s, dt, input(s));
}

test('car accelerates while the pedal is released', () => {
  const s = running(); advance(s, 3, () => false);
  assert.ok(s.speed > RULES.initialSpeed + 10);
  assert.equal(s.pressure, 0);
});
test('continuous press breaks the pedal at exactly 1612 N before stopping', () => {
  const s = running();
  for(let i=0;i<500&&s.phase==='running';i++)step(s,1/120,true);
  assert.equal(s.phase, 'broken'); assert.equal(s.pressure, 1612);
  assert.ok(s.speed > 0);
  assert.ok(s.failedAt>0);assert.equal(s.impacts,0);
  const speed=s.speed,distance=s.distance;advance(s,.6,()=>true);
  assert.ok(s.lateral>0&&s.distance>distance);
  assert.ok(s.impacts>=1,'the failed pedal must lead to a prompt guardrail collision');
  assert.ok(s.lastImpactAt<.65,'the car must reach the guardrail in less than 650 ms');
  assert.ok(s.speed<speed,'collision must dissipate speed');
  assert.equal(s.pressure,1612);assert.equal(s.braking,false);
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

test('a fresh press reduces speed on the first physics tick', () => {
  const s=running(),before=s.speed;step(s,1/120,true);
  assert.ok(s.speed<before);assert.equal(s.braking,true);
  assert.ok(s.pressure>0&&s.pressure<300);
});

test('rupture produces guardrail collision, damage, and a stationary wreck', () => {
  const s=running();advance(s,12,()=>true);
  assert.equal(s.phase,'wrecked');assert.equal(s.speed,0);
  assert.ok(s.impacts>=1);assert.ok(s.damage>.5);assert.ok(Math.abs(s.lateral)>0);
  assert.equal(s.pressure,1612);assert.equal(s.braking,false);
  const snapshot={...s};advance(s,8,()=>true);assert.deepEqual(s,snapshot);
});

test('fast crashes rebound and cannot escape through the guardrails', () => {
  const s=running();s.speed=230/3.6;s.pressure=1611;step(s,1/120,true);
  let sawRebound=false;
  for(let i=0;i<1200&&s.phase!=='wrecked';i++){
    step(s,1/120,false);
    if(s.impacts>0&&s.lateralVelocity<0)sawRebound=true;
    const halfWidth=Math.abs(Math.cos(s.yaw))*1.12+Math.abs(Math.sin(s.yaw))*2.72;
    assert.ok(Math.abs(s.lateral)+halfWidth<=RULES.guardrailX+.15);
  }
  assert.ok(sawRebound);assert.ok(s.impacts>=2);assert.equal(s.phase,'wrecked');
});

test('the crash and restart remain deterministic at 60 and 120 physics ticks', () => {
  const a=running(),b=running();advance(a,12,()=>true,1/60);advance(b,12,()=>true,1/120);
  assert.equal(a.phase,b.phase);assert.equal(a.impacts,b.impacts);assert.ok(Math.abs(a.distance-b.distance)<2);
  startRun(a);const reset=createState();reset.phase='countdown';assert.deepEqual(a,reset);
});
