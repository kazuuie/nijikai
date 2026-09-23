import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './start-game.mjs';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('http://localhost:8000/?v=special');await page.waitForFunction(()=>window.rouletteSnapshot);
  await enterGame(page);
  await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/title-to-game.png'});
  assert.equal(await page.locator('button[data-tier="ume"]').getAttribute('aria-pressed'),'true');
  await page.locator('button[data-tier="take"]').click();await page.reload();await page.waitForFunction(()=>window.rouletteSnapshot);
  await enterGame(page);
  assert.equal(await page.locator('button[data-tier="take"]').getAttribute('aria-pressed'),'true');
  const levels=await page.evaluate(async()=>{
    const out=[];
    for(const name of ['suspense','celebration','surge','grand']){
      const ctx=new OfflineAudioContext(1,44100*3,44100);
      const buffer=await ctx.decodeAudioData(await (await fetch(`audio/${name}.wav`)).arrayBuffer());
      const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.start();
      const pcm=(await ctx.startRendering()).getChannelData(0);out.push(pcm.reduce((s,v)=>s+v*v,0));
    }
    return out;
  });assert.ok(levels.every(v=>v>1));
  await page.locator('#spin').click();await page.waitForFunction(()=>rouletteSnapshot().spinning);
  assert.equal(await page.locator('button[data-tier="matsu"]').isDisabled(),true);
  assert.equal((await page.evaluate(()=>rouletteSnapshot())).duration,18500);
  await page.clock.fastForward(10600);assert.equal((await page.evaluate(()=>rouletteSnapshot())).spinning,true);
  let elapsed=10600;
  for(const [i,at] of [.64,.70,.76].entries()){
    const target=Math.ceil(at*18500)+25;
    await page.clock.fastForward(target-elapsed);elapsed=target;
    assert.equal((await page.evaluate(()=>rouletteSnapshot().audio)).surgeCount,i+1);
    assert.equal(await page.locator('#special-banner i.lit').count(),i+1);
    assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('special-kick')),true);
  }
  await page.clock.fastForward(15300-elapsed);assert.equal(await page.locator('#status').textContent(),'運命の一球…');
  assert.equal((await page.evaluate(()=>rouletteSnapshot().audio)).suspense,true);
  await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/special-suspense.png'});
  await page.locator('#mute').click();await new Promise(r=>setTimeout(r,160));
  assert.ok((await page.evaluate(()=>rouletteSnapshot().audio)).masterGain<.001);
  await page.locator('#mute').click();await page.clock.fastForward(3300);
  const result=await page.evaluate(()=>rouletteSnapshot());
  assert.equal(result.spinning,false);assert.equal(result.pocket,result.number);
  assert.equal(result.audio.flourishCount,1);assert.equal(result.audio.suspense,false);
  assert.equal(await page.locator('#status').textContent(),'結果は');assert.equal(await page.locator('#celebration span').count(),108);
  assert.equal(result.audio.surgeCount,3);
  await page.clock.runFor(500);await page.screenshot({path:'artifacts/special-result.png'});
  for(const [width,height] of [[390,844],[320,720],[844,390]]){
    await page.setViewportSize({width,height});await page.clock.runFor(50);
    await page.waitForFunction(()=>{const c=document.querySelector('#scene canvas');return Math.abs(c.width-c.getBoundingClientRect().width)<1;});
    for(const selector of ['#special','#mute','#volume','#fullscreen','#number','#color-text','#spin']){
      const b=await page.locator(selector).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height,`${selector}: ${width}x${height}`);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`artifacts/special-${width}.png`});
  }
  await page.locator('button[data-tier="ume"]').click();assert.equal(await page.locator('#celebration span').count(),0);
  await page.locator('#spin').click();await page.waitForFunction(()=>rouletteSnapshot().spinning);
  assert.equal((await page.evaluate(()=>rouletteSnapshot())).duration,10500);await page.clock.fastForward(10600);
  const normal=await page.evaluate(()=>rouletteSnapshot());assert.equal(normal.spinning,false);assert.equal(normal.audio.flourishCount,0);assert.equal(normal.audio.surgeCount,0);
  assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('special-result')),false);
  await page.setViewportSize({width:1920,height:1080});
  await page.locator('button[data-tier="matsu"]').click();await page.reload();await page.waitForFunction(()=>window.rouletteSnapshot);
  await enterGame(page);
  assert.equal((await page.evaluate(()=>rouletteSnapshot())).effectTier,'matsu');
  await page.evaluate(()=>{crypto.getRandomValues=a=>{a.fill(17);return a;};});
  await page.locator('#spin').click();await page.waitForFunction(()=>rouletteSnapshot().spinning);
  assert.equal((await page.evaluate(()=>rouletteSnapshot())).duration,24500);
  let matsuTime=0;
  for(const [i,at] of [.46,.53,.60,.67,.74].entries()){
    const target=Math.ceil(at*24500)+25;
    await page.clock.fastForward(target-matsuTime);matsuTime=target;
    assert.equal((await page.evaluate(()=>rouletteSnapshot().audio)).surgeCount,i+1);
    assert.equal(await page.locator('#special-banner i.lit').count(),i+1);
  }
  assert.equal(await page.locator('#grand-stage').isVisible(),false);
  await page.clock.fastForward(24600-matsuTime);
  const matsu=await page.evaluate(()=>rouletteSnapshot());
  assert.equal(matsu.number,17);assert.equal(matsu.pocket,17);assert.equal(matsu.audio.tier,'matsu');
  assert.equal(matsu.audio.flourishCount,1);assert.equal(await page.locator('#grand-stage').isVisible(),true);
  assert.deepEqual(await page.locator('.grand-numbers span').allTextContents(),['17','17','17']);
  assert.equal(await page.locator('.grand-color').textContent(),'黒');
  assert.equal(await page.locator('#celebration span').count(),180);
  await page.locator('#mute').click();
  assert.equal((await page.evaluate(()=>rouletteSnapshot().audio)).muted,true);
  await page.waitForFunction(()=>rouletteSnapshot().audio.masterGain<.001,undefined,{polling:100,timeout:5000});
  await page.locator('#mute').click();
  await page.clock.runFor(950);
  for(const [width,height] of [[1920,1080],[390,844],[320,720],[844,390]]){
    await page.setViewportSize({width,height});await page.clock.runFor(50);
    await page.evaluate(()=>document.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=1000;}));
    for(const selector of ['.grand-content','.grand-numbers','#special','#mute']){
      const b=await page.locator(selector).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height,`${selector}: ${width}x${height}`);
    }
    await page.screenshot({path:`artifacts/matsu-${width}.png`});
  }
  await page.clock.fastForward(4500);assert.equal(await page.locator('#grand-stage').isVisible(),false);
  await page.locator('button[data-tier="ume"]').click();
  assert.equal((await page.evaluate(()=>rouletteSnapshot())).effectTier,'ume');
  assert.deepEqual(errors,[]);console.log('Special mode passed: duration, exact pocket, sound, mute, toggle, persistence, desktop/mobile.');
}finally{await browser.close();}
