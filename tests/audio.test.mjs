import {test} from 'node:test';
import assert from 'node:assert/strict';
import {soundAt,RouletteAudio,BALL_SOUND_LEVEL,collisionSound} from '../public/audio.js';
import {CAPTURE_PROGRESS,BOUNCE_CONTACTS,bounceHeight} from '../public/roulette.js';

test('Only rolling and bounce levels receive the 80% adjustment',()=>{
  assert.equal(BALL_SOUND_LEVEL,.8);
  for(const t of [0,.2,.6,.8]){
    assert.equal(soundAt(t).ballGain,.8*.44*(1-t/CAPTURE_PROGRESS)**.7);
    assert.equal(soundAt(t).wheelGain,.30*((1-t)**2)**.65);
  }
});

test('All visual contacts trigger once, with strength-dependent gain and pitch',()=>{
  const engine=new RouletteAudio();
  const param=()=>({value:0,setTargetAtTime(){},cancelScheduledValues(){}});
  engine.context={state:'running',currentTime:0};engine.buffers={};
  const played=[];
  engine.source=(name,loop,gain)=>{
    const voice={source:{playbackRate:param(),start(){played.push({name,gain,rate:this.playbackRate.value});},stop(){}},gain:{gain:param()}};
    engine.sources.add(voice);return voice;
  };
  engine.start();
  for(const [i,contact] of BOUNCE_CONTACTS.entries()){
    assert.ok(bounceHeight(contact.progress)<1e-12);
    assert.ok(bounceHeight(contact.progress-.001)>bounceHeight(contact.progress));
    assert.ok(bounceHeight(contact.progress+.001)>bounceHeight(contact.progress));
    engine.update(contact.progress-.001);assert.equal(engine.collisions.length,i);
    engine.update(contact.progress);engine.update(contact.progress+.001);
    assert.equal(engine.collisions.length,i+1);
    assert.deepEqual(played.filter(v=>v.name==='collision').at(-1),{name:'collision',...collisionSound(contact,i)});
  }
  assert.equal(engine.collisions.length,8);
  assert.ok(new Set(engine.collisions.map(c=>c.rate)).size>1);
  engine.start();engine.update(.95);assert.equal(engine.collisions.length,0);
});

test('Both layers slow down and fade with animation; rolling ends at capture',()=>{
  let previous=soundAt(0);
  for(let i=1;i<=1000;i++){
    const current=soundAt(i/1000);
    for(const key of Object.keys(current)){assert.ok(current[key]<=previous[key]);assert.ok(current[key]>=0);}
    previous=current;
  }
  assert.equal(soundAt(CAPTURE_PROGRESS).ballGain,0);
  assert.equal(soundAt(1).wheelGain,0);
});

test('Impact fires once at capture, stops cleanly, and is not replayed after a skipped finish',()=>{
  const engine=new RouletteAudio();
  const param=()=>({value:0,setTargetAtTime(){},cancelScheduledValues(){}});
  engine.context={state:'running',currentTime:0};engine.buffers={};
  engine.source=()=>{
    const voice={source:{playbackRate:param(),start(){},stop(){}},gain:{gain:param()}};
    engine.sources.add(voice);return voice;
  };
  engine.start();engine.update(CAPTURE_PROGRESS-.001);assert.equal(engine.landingCount,0);
  engine.update(CAPTURE_PROGRESS);engine.update(CAPTURE_PROGRESS+.01);assert.equal(engine.landingCount,1);
  engine.stop();engine.start(CAPTURE_PROGRESS+.02);assert.equal(engine.landingCount,1);
  engine.update(1);assert.equal(engine.sources.size,0);assert.equal(engine.loops.length,0);
  engine.start();engine.update(1);assert.equal(engine.landingCount,0);
});
