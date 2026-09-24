import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {enterGame} from './start-game.mjs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/home/kazu/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.goto('http://localhost:8000');await page.waitForFunction(()=>window.rouletteSnapshot);await enterGame(page);
 await page.locator('[data-tier="royal"]').click();await page.reload();await page.waitForFunction(()=>window.rouletteSnapshot);await enterGame(page);
 assert.equal((await page.evaluate(()=>rouletteSnapshot())).effectTier,'royal');
 // Load the same clip in memory for deterministic seeks: the local Python server has no Range support.
 await page.locator('#fourth-video').evaluate(async v=>{
  const blob=await (await fetch(v.src)).blob();
  await new Promise((resolve,reject)=>{v.addEventListener('loadeddata',resolve,{once:true});v.addEventListener('error',reject,{once:true});v.src=URL.createObjectURL(blob);v.load();});
 });
 await page.evaluate(()=>{crypto.getRandomValues=a=>{a.fill(17);return a;};});
 await page.locator('#spin').click();await page.waitForFunction(()=>rouletteSnapshot().spinning);
 assert.equal((await page.evaluate(()=>rouletteSnapshot())).duration,31000);
 assert.equal(await page.locator('[data-tier="ume"]').isDisabled(),true);
 await page.clock.fastForward(16300);assert.equal(await page.locator('body').getAttribute('data-fourth-phase'),'gate');
 assert.equal(await page.locator('.fourth-meter').count(),0);
 const wheelBefore=(await page.evaluate(()=>rouletteSnapshot())).wheel;
 await page.clock.fastForward(300);assert.notEqual((await page.evaluate(()=>rouletteSnapshot())).wheel,wheelBefore);
 await page.screenshot({path:'artifacts/fourth-gate.png'});
 await page.clock.fastForward(1700);
 assert.equal(await page.locator('body').getAttribute('data-fourth-phase'),'gate');
 assert.equal((await page.evaluate(()=>rouletteSnapshot())).audio.temple,false);
 let elapsed=18300;
 const beats=[19.55,20.75,21.8,22.75,23.6,24.3];
 for(const seconds of beats){
  const target=seconds*1000+25;const before=(await page.evaluate(()=>rouletteSnapshot())).audio.surgeCount;
  await page.clock.fastForward(target-elapsed);elapsed=target;
  assert.equal((await page.evaluate(()=>rouletteSnapshot())).audio.surgeCount,before+1);
  assert.equal(await page.locator('#special-banner').isVisible(),true);
  assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('special-kick')),true);
 }
 await page.clock.fastForward(25300-elapsed);assert.equal(await page.locator('body').getAttribute('data-fourth-phase'),'ascent');
 await page.locator('#fourth-video').evaluate(v=>v.pause());
 await page.locator('#fourth-video').evaluate(v=>v.readyState>=2?Promise.resolve():new Promise((resolve,reject)=>{v.addEventListener('loadeddata',resolve,{once:true});v.addEventListener('error',()=>reject(new Error('Video decode failed')),{once:true});}));
 await page.locator('#fourth-video').evaluate(v=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=.05;}));
 await page.clock.fastForward(20);
 assert.equal(await page.locator('#summit-number').isVisible(),false);
 assert.equal((await page.evaluate(()=>rouletteSnapshot())).audio.wheelGain,.12);
 await page.locator('#fourth-video').evaluate(v=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=v.duration*.65;}));
 assert.equal(await page.locator('#summit-number').isVisible(),false);
 await page.locator('#fourth-video').evaluate(v=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=v.duration*.8;}));
 await page.clock.fastForward(2100);
 assert.equal(await page.locator('#summit-number').isVisible(),true);
 assert.deepEqual(await page.locator('#summit-number span').allTextContents(),['17','17','17']);
 const approaching=await page.locator('#summit-number').boundingBox();
 assert.ok(approaching.y<1080*.4);
 await page.screenshot({path:'artifacts/fourth-ascent.png'});
 await page.locator('#fourth-video').evaluate(v=>new Promise(resolve=>{v.pause();v.addEventListener('seeked',resolve,{once:true});v.currentTime=1;}));
 await page.clock.fastForward(3700);
 assert.equal((await page.evaluate(()=>rouletteSnapshot())).spinning,true);
 assert.equal(await page.locator('#grand-stage').isVisible(),false);
 assert.equal(await page.locator('#fourth-video').evaluate(v=>v.loop),false);
 assert.equal(await page.locator('#fourth-video').evaluate(v=>v.playbackRate),1.2);
 assert.equal((await page.evaluate(()=>rouletteSnapshot())).audio.temple,true);
 await page.locator('#fourth-video').evaluate(v=>new Promise((resolve,reject)=>{v.addEventListener('ended',resolve,{once:true});v.currentTime=v.duration-.05;v.play().catch(reject);}));
 await page.clock.fastForward(100);
 const result=await page.evaluate(()=>rouletteSnapshot());assert.equal(result.number,17);assert.equal(result.pocket,17);assert.equal(result.spinning,false);assert.equal(result.audio.flourishCount,1);
 assert.deepEqual(await page.locator('#summit-number span').allTextContents(),Array(3).fill(String(result.number)));
 assert.deepEqual(await page.locator('.grand-numbers span').allTextContents(),['17','17','17']);assert.equal(await page.locator('#celebration span').count(),260);
 await page.locator('#mute').click();assert.equal((await page.evaluate(()=>rouletteSnapshot())).audio.muted,true);
 for(const [width,height] of [[1920,1080],[390,844],[320,720],[844,390]]){
  await page.setViewportSize({width,height});await page.clock.runFor(100);
  await page.evaluate(()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=1500;}));
  for(const selector of ['.grand-content','#summit-number','#special','#mute','#fullscreen']){
   const b=await page.locator(selector).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height,`${selector} ${width}x${height}: ${JSON.stringify(b)}`);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`artifacts/fourth-${width}.png`});
 }
 await page.clock.fastForward(7100);assert.equal(await page.locator('#grand-stage').isVisible(),false);assert.equal(await page.locator('#fourth-stage').isVisible(),false);assert.equal(await page.locator('#fourth-video').evaluate(v=>v.paused),true);
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#spin').click();await page.waitForFunction(()=>rouletteSnapshot().spinning);await page.clock.fastForward(25500);assert.equal(await page.locator('#fourth-video').isVisible(),false);assert.equal(await page.locator('#fourth-video').evaluate(v=>v.paused),true);
 await page.clock.fastForward(5600);assert.equal(await page.locator('#celebration span').count(),0);
 await page.locator('[data-tier="ume"]').click();assert.equal(await page.locator('#fourth-stage').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('4th passed: video decode, phases, persistence, exact result, audio, mute, responsive layout, cleanup, reduced motion.');
}finally{await browser.close();}
