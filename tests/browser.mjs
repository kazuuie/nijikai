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
  for(const [n,color] of [[17,'黒'],[0,'緑'],[32,'赤']]){
    await page.evaluate(n=>{crypto.getRandomValues=a=>{a.fill(n);return a;};},n);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#spin').isDisabled(),true);
    await page.keyboard.press('Space');
    await page.clock.fastForward(6000);
    const mid=await page.evaluate(()=>rouletteSnapshot());
    assert.equal(mid.spinning,true);
    if(n===17){const moving=await page.screenshot({path:'artifacts/desktop-spinning.png'});assert.notDeepEqual(moving,ready);}
    await page.clock.fastForward(2800);
    if(n===17)await page.screenshot({path:'artifacts/desktop-landing.png'});
    await page.clock.fastForward(1800);
    const result=await page.evaluate(()=>rouletteSnapshot());
    assert.equal(result.number,n);assert.equal(result.pocket,n);assert.equal(result.spinning,false);
    assert.equal(await page.locator('#number').textContent(),String(n));
    assert.equal(await page.locator('#color-text').textContent(),color);
    assert.equal(await page.locator('#spin').isDisabled(),false);
    await page.screenshot({path:`artifacts/desktop-result-${n}.png`});
    console.log(JSON.stringify(result));
  }
  await page.locator('#fullscreen').click();
  assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
  await page.evaluate(()=>document.exitFullscreen());
  for(const [width,height] of [[390,844],[768,1024],[1366,768],[844,390]]){
    await page.setViewportSize({width,height});await page.clock.runFor(100);
    await page.waitForFunction(()=>{const c=document.querySelector('#scene canvas');return Math.abs(c.width-c.getBoundingClientRect().width)<1;});
    await page.screenshot({path:`artifacts/viewport-${width}x${height}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const selector of ['#spin','#number','#color-text']){
      const rect=await page.locator(selector).boundingBox();
      assert.ok(rect.x>=0&&rect.x+rect.width<=width+.5&&rect.y>=0&&rect.y+rect.height<=height,`${selector} outside ${width}x${height}`);
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('Browser checks passed: motion, 3 colors, pocket match, repeat guard, fullscreen, responsive, no external requests.');
}finally{await browser.close();}
