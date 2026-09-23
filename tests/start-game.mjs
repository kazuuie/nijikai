export async function enterGame(page){
  await page.waitForFunction(()=>window.rouletteSnapshot);
  await page.locator('#start').click();
  await page.waitForFunction(()=>rouletteSnapshot().audio.ready,undefined,{polling:100});
  await page.clock.fastForward(1100);
  await page.waitForFunction(()=>rouletteSnapshot().screenState==='game');
}
