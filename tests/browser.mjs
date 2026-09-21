import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).hostname!=='localhost'){external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('http://localhost:8000');
  await page.waitForFunction(()=>window.rouletteSnapshot);
  await mkdir('artifacts',{recursive:true});
  const ready=await page.screenshot({path:'artifacts/desktop-ready.png'});
  const pixelStats=await page.evaluate(async encoded=>{
    const img=new Image();img.src='data:image/png;base64,'+encoded;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    const {data}=ctx.getImageData(250,270,900,650);let bright=0,red=0;
    for(let i=0;i<data.length;i+=4){if(data[i]>80&&data[i+1]>80&&data[i+2]>80)bright++;if(data[i]>data[i+1]*1.5&&data[i]>90)red++;}
    return {bright,red};
  },ready.toString('base64'));
  assert.ok(pixelStats.bright>10000&&pixelStats.red>10000,'3D canvas must contain lit surfaces and red pockets');
  const audioFiles=await page.evaluate(async()=>{
    const result=[];
    for(const name of ['wheel','ball','landing','collision']){
      const ctx=new OfflineAudioContext(1,44100,44100);
      const response=await fetch(`audio/${name}.wav`);
      const buffer=await ctx.decodeAudioData(await response.arrayBuffer());
      const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.start();
      const rendered=await ctx.startRendering();const pcm=rendered.getChannelData(0);
      result.push({name,duration:buffer.duration,rms:Math.sqrt(pcm.reduce((sum,v)=>sum+v*v,0)/pcm.length)});
    }
    return result;
  });
  assert.ok(audioFiles.every(file=>file.rms>.01));
  assert.ok(audioFiles.find(file=>file.name==='landing').duration<.3);
  console.log('Decoded and rendered local WAVs:',audioFiles);
  for(const [n,color] of [[17,'黒'],[0,'緑'],[32,'赤']]){
    await page.evaluate(n=>{crypto.getRandomValues=a=>{a.fill(n);return a;};},n);
    if(n===17)await page.keyboard.press('Space');else await page.locator('#spin').click();
    await page.waitForFunction(()=>rouletteSnapshot().spinning);
    assert.equal(await page.locator('#spin').isDisabled(),true);
    const initialAudio=await page.evaluate(()=>rouletteSnapshot().audio);
    assert.equal(initialAudio.ready,true);assert.equal(initialAudio.state,'running');assert.equal(initialAudio.loops,2);
    await page.keyboard.press('Space');
    await page.clock.fastForward(6000);
    const mid=await page.evaluate(()=>rouletteSnapshot());
    assert.equal(mid.spinning,true);
    assert.ok(mid.audio.wheelRate<initialAudio.wheelRate);assert.ok(mid.audio.ballGain<initialAudio.ballGain);
    if(n===17){
      await page.locator('#mute').click();
      assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');
      await new Promise(resolve=>setTimeout(resolve,180));
      assert.ok((await page.evaluate(()=>rouletteSnapshot().audio)).masterGain<.001);
      await page.locator('#mute').press('Space');
      assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'false');
      await page.locator('#volume').fill('27');
      assert.equal((await page.evaluate(()=>rouletteSnapshot().audio)).volume,.27);
      assert.equal((await page.evaluate(()=>rouletteSnapshot())).round,0);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
      await page.clock.fastForward(500);
      assert.equal((await page.evaluate(()=>rouletteSnapshot().audio)).loops,0);
      assert.equal((await page.evaluate(()=>rouletteSnapshot())).wheel,mid.wheel);
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal((await page.evaluate(()=>rouletteSnapshot().audio)).loops,2);
    }
    if(n===17){const moving=await page.screenshot({path:'artifacts/desktop-spinning.png'});assert.notDeepEqual(moving,ready);}
    await page.clock.fastForward(2900);
    assert.equal((await page.evaluate(()=>rouletteSnapshot().audio)).landingCount,1);
    if(n===17)await page.screenshot({path:'artifacts/desktop-landing.png'});
    await page.clock.fastForward(1800);
    const result=await page.evaluate(()=>rouletteSnapshot());
    assert.equal(result.number,n);assert.equal(result.pocket,n);assert.equal(result.spinning,false);
    assert.equal(result.audio.loops,0);assert.equal(result.audio.landingCount,1);
    assert.equal(await page.locator('#number').textContent(),String(n));
    assert.equal(await page.locator('#color-text').textContent(),color);
    assert.equal(await page.locator('#spin').isDisabled(),false);
    await page.screenshot({path:`artifacts/desktop-result-${n}.png`});
    console.log(JSON.stringify(result));
  }
  await page.locator('#spin').click();await page.waitForFunction(()=>rouletteSnapshot().spinning);
  const contacts=await page.evaluate(async()=>{const m=await import('./roulette.js');return m.BOUNCE_CONTACTS;});
  let elapsed=0;
  for(const [i,contact] of contacts.entries()){
    const before=Math.floor(contact.progress*10500)-35;
    await page.clock.fastForward(before-elapsed);elapsed=before;
    const airborne=await page.evaluate(()=>rouletteSnapshot());
    assert.equal(airborne.audio.collisions.length,i);
    if(i===4)await page.screenshot({path:'artifacts/bounce-before-contact.png'});
    await page.clock.fastForward(55);elapsed+=55;
    const touching=await page.evaluate(()=>rouletteSnapshot());
    assert.equal(touching.audio.collisions.length,i+1);
    assert.ok(touching.ballPosition[1]<airborne.ballPosition[1]);
    const impact=touching.audio.collisions.at(-1);
    assert.ok(impact.playedAt>=contact.progress&&impact.playedAt-contact.progress<.012);
    if(i===4)await page.screenshot({path:'artifacts/bounce-contact.png'});
  }
  await page.clock.fastForward(10600-elapsed);
  const collisionResult=await page.evaluate(()=>rouletteSnapshot().audio);
  assert.equal(collisionResult.collisions.length,8);assert.equal(collisionResult.loops,0);
  console.log('All 8 visible bounce contacts matched audio:',collisionResult.collisions);
  await page.locator('#fullscreen').click();
  assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
  await page.evaluate(()=>document.exitFullscreen());
  for(const [width,height] of [[390,844],[768,1024],[1366,768],[844,390]]){
    await page.setViewportSize({width,height});await page.clock.runFor(100);
    await page.waitForFunction(()=>{const c=document.querySelector('#scene canvas');return Math.abs(c.width-c.getBoundingClientRect().width)<1;});
    await page.screenshot({path:`artifacts/viewport-${width}x${height}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const selector of ['#spin','#number','#color-text','#mute','#volume','#fullscreen']){
      const rect=await page.locator(selector).boundingBox();
      assert.ok(rect.x>=0&&rect.x+rect.width<=width+.5&&rect.y>=0&&rect.y+rect.height<=height,`${selector} outside ${width}x${height}`);
    }
  }
  await page.reload();await page.waitForFunction(()=>window.rouletteSnapshot);
  assert.equal(await page.locator('#volume').inputValue(),'27');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('Browser checks passed: motion, 3 colors, pocket match, repeat guard, fullscreen, responsive, no external requests.');
}finally{await browser.close();}
