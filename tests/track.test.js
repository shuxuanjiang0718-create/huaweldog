import test from 'node:test';
import assert from 'node:assert/strict';
import {trackCenter,trackSlope,trackPoint,terrainHeight} from '../src/track.js';

test('the centreline has gentle changing bends and a continuous derivative',()=>{
  const slopes=[];
  for(let s=-100;s<=10000;s+=37){
    const numerical=(trackCenter(s+.001)-trackCenter(s-.001))/.002;
    assert.ok(Math.abs(numerical-trackSlope(s))<1e-7);assert.ok(Math.abs(trackSlope(s))<.26);slopes.push(trackSlope(s));
  }
  assert.ok(Math.min(...slopes)<-.1&&Math.max(...slopes)>.1);
});
test('car-relative coordinates do not jump across old scenery reset points',()=>{
  for(const boundary of [320,640,1360,2720,10000]) {
    const s=boundary+80;
    const a=trackPoint(s,8,boundary-.001),b=trackPoint(s,8,boundary+.001);
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.005);
    const car=trackPoint(boundary,0,boundary);assert.ok(Math.hypot(car.x,car.z)<1e-9);
  }
});
test('both carriageways stay level and streamed ground is deterministic',()=>{
  for(let s=0;s<3000;s+=53){
    for(const x of [-23,-16,-8,0,7])assert.equal(terrainHeight(x,s),-.13);
    for(const x of [-250,80,560]) {
      assert.equal(terrainHeight(x,s),terrainHeight(x,s));
      assert.ok(Math.abs(terrainHeight(x,s+.001)-terrainHeight(x,s-.001))<.03);
    }
  }
});
