import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  await mkdir('artifacts',{recursive:true});
  for(const action of ['click','tap','Space','Enter']){
    const context=await browser.newContext({viewport:action==='tap'?{width:390,height:844}:{width:1920,height:1080},hasTouch:true});
    const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
    if(action==='Enter')await page.addInitScript(()=>localStorage.setItem('roulette-audio',JSON.stringify({muted:true,volume:.21})));
    await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
    await page.goto('http://localhost:8000/?v=title');await page.waitForFunction(()=>window.rouletteSnapshot);
    const initial=await page.evaluate(()=>rouletteSnapshot());
    assert.equal(initial.screenState,'title');assert.equal(initial.round,0);assert.equal(initial.audio.state,undefined);
    assert.equal(await page.locator('main').evaluate(e=>e.inert),true);
    await page.locator('#spin').dispatchEvent('click');assert.equal((await page.evaluate(()=>rouletteSnapshot())).spinning,false);
    if(action==='click'||action==='tap'){
      await page.clock.fastForward(1500);
      await page.screenshot({path:`artifacts/title-${action==='click'?'desktop':'mobile'}.png`});
      for(const s of ['.title-monogram','.title-subtitle','.title-prompt']){
        const b=await page.locator(s).boundingBox();const v=page.viewportSize();assert.ok(b.x>=0&&b.x+b.width<=v.width&&b.y>=0&&b.y+b.height<=v.height);
      }
    }
    if(action==='click')await page.mouse.click(30,30);
    else if(action==='tap')await page.touchscreen.tap(30,30);
    else await page.keyboard.press(action);
    await page.waitForFunction(()=>rouletteSnapshot().audio.ready,undefined,{polling:100});
    for(let i=0;i<4;i++){await page.keyboard.press('Space');await page.keyboard.press('Enter');}
    await page.clock.fastForward(500);
    assert.equal((await page.evaluate(()=>rouletteSnapshot())).screenState,'entering');
    await page.clock.fastForward(600);
    const entered=await page.evaluate(()=>rouletteSnapshot());
    assert.equal(entered.screenState,'game');assert.equal(entered.round,0);assert.equal(entered.spinning,false);
    assert.equal(entered.audio.state,'running');assert.equal(entered.audio.welcomeCount,1);assert.equal(entered.audio.loops,0);
    assert.equal(await page.locator('#title-screen').isVisible(),false);
    assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
    if(action==='Enter'){assert.equal(entered.audio.muted,true);assert.equal(entered.audio.masterGain,0);assert.equal(entered.audio.volume,.21);}
    if(action==='click'){
      await page.screenshot({path:'artifacts/title-to-game.png'});
      await page.locator('#spin').click();await page.waitForFunction(()=>rouletteSnapshot().spinning);
      await page.clock.fastForward(10600);
      const result=await page.evaluate(()=>rouletteSnapshot());assert.equal(result.round,1);assert.equal(result.number,result.pocket);
      await page.reload();await page.waitForFunction(()=>window.rouletteSnapshot);
      assert.equal((await page.evaluate(()=>rouletteSnapshot())).screenState,'title');
    }
    assert.deepEqual(errors,[]);console.log(`${action}: title, silence, one transition, audio unlock, no accidental spin passed`);
    await context.close();
  }
}finally{await browser.close();}
