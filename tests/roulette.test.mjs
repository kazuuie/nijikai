import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ORDER,RED,colorOf,createSpin,sampleSpin,pocketAt,randomNumber,TAU} from '../public/roulette.js';

test('European sequence and all 37 colors',()=>{
  assert.deepEqual(ORDER,[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]);
  assert.equal(new Set(ORDER).size,37);
  assert.equal(colorOf(0),'green');assert.equal(RED.size,18);
  for(let i=1;i<37;i++)assert.equal(colorOf(ORDER[i]),i%2?'red':'black');
  assert.equal(pocketAt(0,-TAU/37),32);
  assert.equal(pocketAt(0,TAU/37),26);
});
test('Every result lands inside its own pocket across repeated spins',()=>{
  let wheel=0,ball=-.65;
  for(let round=0;round<100;round++)for(const n of ORDER){
    const spin=createSpin(n,wheel,ball,(round%9-4)/10);
    const start=sampleSpin(spin,0);
    assert.equal(start.wheel,wheel);assert.equal(start.angle,ball);
    for(const t of [.84,.90,.95,1])assert.equal(pocketAt(sampleSpin(spin,t).wheel,sampleSpin(spin,t).angle),n);
    const end=sampleSpin(spin,1);
    assert.ok(Math.abs(end.radius-3.22)<1e-10);assert.ok(Math.abs(end.height-.46)<1e-10);
    assert.equal(end.done,true);assert.ok(end.wheel>wheel+5*TAU);
    wheel=end.wheel;ball=end.angle;
  }
});
test('Unbiased sampler rejects the incomplete tail of the uint32 range',()=>{
  const limit=Math.floor(2**32/37)*37;
  let calls=0;
  assert.equal(randomNumber(a=>{a[0]=calls++===0?limit:17;}),17);
  assert.equal(calls,2);
  for(let n=0;n<37;n++)assert.equal(randomNumber(a=>{a[0]=limit-37+n;}),n);
});
test('Special spins add rotations and settle into every selected pocket',()=>{
  for(const n of ORDER){
    const normal=createSpin(n,0,-.65,.15);
    for(const tier of [true,'matsu']){
      const special=createSpin(n,0,-.65,.15,tier);
      assert.ok(special.wheelEnd>normal.wheelEnd);
      const end=sampleSpin(special,1);
      assert.equal(pocketAt(end.wheel,end.angle),n);
    }
  }
});
