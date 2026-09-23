import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './start-game.mjs';

const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('http://localhost:8000/');await enterGame(page);
  await mkdir('artifacts',{recursive:true});
  const backgrounds=[];
  for(const tier of ['take','matsu','ume']){
    await page.locator(`button[data-tier="${tier}"]`).click();
    await new Promise(resolve=>setTimeout(resolve,700));
    const state=await page.evaluate(()=>({snapshot:rouletteSnapshot(),background:getComputedStyle(document.querySelector('#tier-atmosphere')).backgroundImage,frame:getComputedStyle(document.querySelector('main'),'::after').borderTopWidth}));
    assert.equal(state.snapshot.spinning,false);assert.equal(state.snapshot.round,0);
    assert.equal(state.snapshot.audio.surgeCount,0);
    if(tier!=='ume'){assert.notEqual(state.frame,'0px');backgrounds.push(state.background);}
    await page.screenshot({path:`artifacts/tier-${tier}-desktop.png`});
  }
  assert.notEqual(backgrounds[0],backgrounds[1]);
  await page.locator('button[data-tier="matsu"]').click();
  await page.setViewportSize({width:390,height:844});
  await page.clock.runFor(100);
  await page.screenshot({path:'artifacts/tier-matsu-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const before=await page.locator('#scene canvas').screenshot();
  const initial=await page.evaluate(()=>rouletteSnapshot());
  await page.locator('#spin').click();await page.clock.fastForward(1000);
  const moving=await page.evaluate(()=>rouletteSnapshot());
  assert.equal(moving.spinning,true);assert.notEqual(moving.wheel,initial.wheel);
  const after=await page.locator('#scene canvas').screenshot();
  assert.ok(before.length>5000&&after.length>5000);assert.notDeepEqual(before,after);
  await page.clock.fastForward(23600);
  const result=await page.evaluate(()=>rouletteSnapshot());
  assert.equal(result.spinning,false);assert.equal(result.number,result.pocket);
  await page.reload();await page.waitForFunction(()=>window.rouletteSnapshot);
  assert.equal(await page.locator('#tier-atmosphere').evaluate(e=>getComputedStyle(e).opacity),'0');
  await enterGame(page);
  assert.equal((await page.evaluate(()=>rouletteSnapshot())).effectTier,'matsu');
  assert.deepEqual(errors,[]);
  console.log('Tier backgrounds passed: immediate selection, distinct styles, no spin/audio triggers, mobile, saved setting, title isolation.');
}finally{await browser.close();}
