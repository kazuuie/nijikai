import * as THREE from './vendor/three.module.min.js';
import {ORDER,STEP,TAU,EFFECTS,colorOf,colorNames,randomNumber,createSpin,sampleSpin,pocketAt} from './roulette.js';
import {RouletteAudio} from './audio.js';

lucide.createIcons();
const host = document.querySelector('#scene');
const spinButton = document.querySelector('#spin');
const numberText = document.querySelector('#number');
const colorText = document.querySelector('#color-text');
const status = document.querySelector('#status');
const dot = document.querySelector('.color-dot');
const footerState = document.querySelector('#footer-state');
const sound=new RouletteAudio(failed=>{document.querySelector('#audio-error').hidden=!failed;});
let screenState='title';
let titleFrame=0;
const startButton=document.querySelector('#start');
const titleScreen=document.querySelector('#title-screen');
const muteButton=document.querySelector('#mute');
const volumeInput=document.querySelector('#volume');
function updateAudioControls(){
  const silent=sound.muted||sound.volume===0;
  muteButton.title=sound.muted?'ミュート解除':'ミュート';
  muteButton.setAttribute('aria-label',muteButton.title);
  muteButton.setAttribute('aria-pressed',String(sound.muted));
  muteButton.innerHTML=`<i data-lucide="${silent?'volume-x':'volume-2'}"></i>`;
  volumeInput.value=String(Math.round(sound.volume*100));
  volumeInput.setAttribute('aria-valuetext',`${volumeInput.value}%`);
  document.querySelector('#volume-value').value=`${volumeInput.value}%`;
  lucide.createIcons();
}
muteButton.addEventListener('click',()=>{
  sound.setSettings(sound.volume,!sound.muted);updateAudioControls();
  void sound.prepare();
});
volumeInput.addEventListener('input',()=>{
  sound.setSettings(Number(volumeInput.value)/100,sound.muted);updateAudioControls();
});
updateAudioControls();
let effectTier='ume';
try{const saved=localStorage.getItem('roulette-tier');effectTier=Object.hasOwn(EFFECTS,saved)?saved:localStorage.getItem('roulette-special')==='true'?'take':'ume';}catch{}
let specialEnabled=effectTier!=='ume';
const specialButton=document.createElement('fieldset');
specialButton.id='special';specialButton.className='effect-selector';
specialButton.setAttribute('aria-label','演出の強さ');
specialButton.innerHTML=Object.entries(EFFECTS).map(([id,mode])=>`<button type="button" data-tier="${id}" title="${mode.label}：${id==='ume'?'通常':id==='take'?'特別演出':id==='matsu'?'豪華演出':'黄金の神殿演出'}">${mode.label}</button>`).join('');
document.querySelector('.header-right').prepend(specialButton);
function updateSpecialControl(){
  specialEnabled=effectTier!=='ume';
  specialButton.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tier===effectTier)));
  document.body.dataset.tier=effectTier;
  document.body.classList.toggle('special-enabled',specialEnabled);
}
specialButton.addEventListener('click',event=>{
  const tier=event.target.closest('button')?.dataset.tier;
  if(!tier||specialButton.disabled||effectTier===tier)return;
  effectTier=tier;updateSpecialControl();
  sound.stop();document.body.classList.remove('special-result','special-round','special-suspense');clearCelebration();clearGrand();resetLighting();render();
  try{localStorage.setItem('roulette-tier',effectTier);}catch{}
});
updateSpecialControl();lucide.createIcons();
const atmosphere=document.createElement('div');
atmosphere.id='tier-atmosphere';atmosphere.setAttribute('aria-hidden','true');
for(let i=0;i<48;i++){
  const sparkle=document.createElement('i');
  sparkle.style.cssText=`--x:${(i*43+7)%100}%;--y:${(i*31+3)%100}%;--delay:${-(i%13)*.7}s;--size:${i%5===0?9:3}px;--duration:${4+i%5}s`;
  atmosphere.appendChild(sparkle);
}
document.body.prepend(atmosphere);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
} catch (error) {
  document.querySelector('#loading').textContent = '3D表示を開始できません。Chrome / Edge のハードウェア アクセラレーションを有効にして、再読み込みしてください。';
  const notice=document.querySelector('#title-error');notice.hidden=false;notice.textContent=document.querySelector('#loading').textContent;
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x000000,0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38,1,.1,100);
const wheel = new THREE.Group();
scene.add(wheel);

// A local studio environment gives the machined surfaces broad reflections.
const envCanvas = document.createElement('canvas');
envCanvas.width=1024; envCanvas.height=512;
const ec = envCanvas.getContext('2d');
ec.fillStyle='#172027'; ec.fillRect(0,0,1024,512);
const strip = (x,y,w,h,color) => {ec.fillStyle=color;ec.fillRect(x,y,w,h);};
strip(30,50,320,120,'#b6cdd0');strip(560,100,140,210,'#f4e2bc');strip(820,180,160,80,'#718f96');strip(0,350,1024,162,'#080a0d');
const env = new THREE.CanvasTexture(envCanvas);
env.mapping = THREE.EquirectangularReflectionMapping;
env.colorSpace = THREE.SRGBColorSpace;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromEquirectangular(env).texture;
env.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xc2e6e8,0x172025,2.0));
const key = new THREE.DirectionalLight(0xffedce,4.2);
key.position.set(-5,12,6);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:30});
key.shadow.bias=-.0003;key.shadow.normalBias=.025;
scene.add(key);
const fill = new THREE.PointLight(0x70ffeb,35,22,2);fill.position.set(4,4,-5);scene.add(fill);
const warm = new THREE.PointLight(0xffb876,14,20,2);warm.position.set(-6,3,1);scene.add(warm);
const mat = (color,metalness,roughness,extra={}) => new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
const blackMetal=mat('#202a2d',.78,.32);
const chrome=mat('#b8c6c5',.92,.23);
const gold=mat('#b4a079',.85,.27);
const dark=mat('#131b1e',.48,.35);
const colors={red:mat('#a81732',.48,.29),black:mat('#10191c',.42,.31),green:mat('#138c72',.5,.3)};
const teal=mat('#0a8579',.1,.4,{emissive:'#16cbb1',emissiveIntensity:.8});
function mesh(geometry,material,parent=scene){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function lathe(points,material,parent=scene){return mesh(new THREE.LatheGeometry(points.map(([x,y])=>new THREE.Vector2(x,y)),160),material,parent);}
function ring(radius,tube,y,material,parent=scene){const m=mesh(new THREE.TorusGeometry(radius,tube,10,180),material,parent);m.rotation.x=Math.PI/2;m.position.y=y;return m;}
function cylinder(rt,rb,height,y,material,parent=scene){const m=mesh(new THREE.CylinderGeometry(rt,rb,height,96),material,parent);m.position.y=y;return m;}
function sector(inner,outer,start,end,y,material,parent=wheel){
  const vertices=[],segments=6;
  for(let i=0;i<segments;i++){
    const a=start+(end-start)*i/segments,b=start+(end-start)*(i+1)/segments;
    const p=(r,t)=>[r*Math.sin(t),y,r*Math.cos(t)];
    vertices.push(...p(inner,a),...p(outer,a),...p(outer,b),...p(inner,a),...p(outer,b),...p(inner,b));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
  return mesh(g,material,parent);
}

// Thick fixed bowl, sloping ball race, and restrained illuminated inlay.
lathe([[0,-.65],[4.65,-.65],[5.03,-.48],[5.23,-.22],[5.3,.14],[5.27,.55],[5.1,.84],[4.96,.93],[4.87,.89],[4.74,.71],[4.48,.48],[4.13,.27],[0,.27]],blackMetal);
ring(5.25,.027,.2,teal);ring(5.18,.034,.69,chrome);ring(4.91,.025,.89,gold);
ring(4.75,.018,.71,teal);ring(5.05,.028,-.47,dark);
lathe([[4.12,.275],[4.25,.31],[4.47,.49],[4.65,.62],[4.74,.71]],mat('#253438',.75,.3));
for(let i=0;i<12;i++){
  const a=i*TAU/12;
  const bolt=mesh(new THREE.SphereGeometry(.037,8,6),chrome);
  bolt.scale.y=.3;bolt.position.set(5.02*Math.sin(a),.882,5.02*Math.cos(a));
}
cylinder(4.13,4.15,.27,.16,dark,wheel);
ring(4.11,.04,.32,gold,wheel);
const slotBase=.31;
ORDER.forEach((n,i)=>{
  const a=-i*STEP;
  sector(2.89,4.06,a-STEP/2+.005,a+STEP/2-.005,slotBase,colors[colorOf(n)]);
  sector(2.94,3.57,a-STEP/2+.012,a+STEP/2-.012,slotBase+.004,colors[colorOf(n)]);
  const fin=mesh(new THREE.BoxGeometry(.029,.18,.67),chrome,wheel);
  const edge=a+STEP/2;fin.position.set(3.245*Math.sin(edge),.40,3.245*Math.cos(edge));fin.rotation.y=edge;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff6e8';ctx.font='bold 76px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(n),64,67);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const label=mesh(new THREE.PlaneGeometry(.40,.40),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),wheel);
  label.position.set(3.82*Math.sin(a),.325,3.82*Math.cos(a));label.rotation.set(-Math.PI/2,0,-a);label.castShadow=false;
});
ring(3.60,.019,.34,gold,wheel);ring(2.9,.046,.39,chrome,wheel);
lathe([[0,.43],[.65,.69],[1.02,.67],[2.82,.33],[2.91,.32]],mat('#18282c',.65,.37),wheel);
for(let i=0;i<37;i++){
  const a=(i+.5)*STEP;
  const spoke=mesh(new THREE.BoxGeometry(.016,.018,1.81),mat('#6b7774',.7,.32),wheel);
  spoke.position.set(1.91*Math.sin(a),.50,1.91*Math.cos(a));spoke.rotation.y=a;spoke.rotateX(-.188);
}
ring(1.03,.022,.665,gold,wheel);
cylinder(.81,.98,.15,.69,blackMetal,wheel);ring(.80,.032,.78,chrome,wheel);
cylinder(.51,.73,.22,.87,chrome,wheel);ring(.52,.03,.99,teal,wheel);
lathe([[0,.97],[.43,.97],[.32,1.07],[.20,1.40],[.16,1.63],[.22,1.69],[.22,1.77],[0,1.81]],chrome,wheel);
const cap=mesh(new THREE.SphereGeometry(.22,32,20),gold,wheel);cap.position.y=1.83;cap.scale.y=.62;
for(let i=0;i<4;i++){
  const a=i*TAU/4;
  const arm=mesh(new THREE.CylinderGeometry(.047,.047,.85,12),chrome,wheel);
  arm.rotation.z=Math.PI/2;arm.rotation.y=a;arm.position.set(.40*Math.cos(a),1.45,-.40*Math.sin(a));
  const knob=mesh(new THREE.SphereGeometry(.095,16,12),chrome,wheel);knob.position.set(.83*Math.cos(a),1.45,-.83*Math.sin(a));
}
const ball=mesh(new THREE.SphereGeometry(.139,32,24),mat('#fff8e8',.28,.16));
ball.position.set(4.57*Math.sin(-.65),.91,4.57*Math.cos(-.65));
const floor=mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.32}));floor.rotation.x=-Math.PI/2;floor.position.y=-.69;floor.castShadow=false;
const specialHalo=new THREE.Group();scene.add(specialHalo);specialHalo.visible=false;
const haloMaterial=mat('#b88927',.65,.25,{emissive:'#ff9e21',emissiveIntensity:1.2});
ring(5.43,.042,.08,haloMaterial,specialHalo);ring(5.62,.022,.08,haloMaterial,specialHalo);
for(let i=0;i<48;i++){
  const a=i*TAU/48;
  const gem=mesh(new THREE.OctahedronGeometry(.067),haloMaterial,specialHalo);
  gem.position.set(5.53*Math.sin(a),.08,5.53*Math.cos(a));gem.castShadow=false;
}

let active=null,wheelAngle=0,ballAngle=-.65,round=0,frame=0,contextLost=false;
let lastResult=null;
const celebration=document.querySelector('#celebration');
const specialBanner=document.querySelector('#special-banner');
const grandStage=document.querySelector('#grand-stage');
const fourthStage=document.querySelector('#fourth-stage');
const fourthVideo=document.querySelector('#fourth-video');
const summitNumber=document.querySelector('#summit-number');
function approachNumber(travel){
  const t=Math.max(0,Math.min(1,travel));
  // Hidden behind the summit until the last part of the climb.
  const arrival=Math.max(0,Math.min(1,(t-.72)/.28));
  summitNumber.style.visibility=t<=.72?'hidden':'visible';
  summitNumber.style.opacity=String(Math.min(1,arrival*5));
  summitNumber.style.setProperty('--scale',String(reducedMotion.matches?1:1/(8-7*arrival)));
  summitNumber.style.setProperty('--height',`${31+20*arrival}%`);
  summitNumber.style.setProperty('--haze',`${(1-arrival)*.65}px`);
}
// The clip ends at the summit: 7.2 seconds at 1.2x takes six seconds.
fourthVideo.defaultPlaybackRate=1.2;
fourthVideo.playbackRate=1.2;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let fourthPhase='';
let fourthVideoFailed=false;
function syncSummitNumber(){
  if(fourthPhase==='ascent'&&Number.isFinite(fourthVideo.duration)&&fourthVideo.duration>0)approachNumber(fourthVideo.currentTime/fourthVideo.duration);
}
fourthVideo.addEventListener('seeked',syncSummitNumber);
fourthVideo.addEventListener('timeupdate',syncSummitNumber);
if(fourthVideo.requestVideoFrameCallback){
  const followFrame=()=>{syncSummitNumber();fourthVideo.requestVideoFrameCallback(followFrame);};
  fourthVideo.requestVideoFrameCallback(followFrame);
}
fourthVideo.addEventListener('error',()=>{fourthVideoFailed=true;});
fourthVideo.addEventListener('ended',()=>{
  if(active?.tier==='royal'&&fourthPhase==='ascent'&&!document.hidden){cancelAnimationFrame(frame);tick(performance.now());}
});
function clearFourth(){fourthPhase='';delete document.body.dataset.fourthPhase;fourthVideo.pause();fourthVideo.currentTime=0;summitNumber.querySelectorAll('span').forEach(span=>{span.textContent='';});}
function fourthLighting(progress){
  const elapsed=progress*EFFECTS.royal.duration;
  const phase=elapsed<EFFECTS.royal.gateAt?'':elapsed<EFFECTS.royal.templeAt?'gate':'ascent';
  if(phase==='ascent'){
    const travel=!fourthVideoFailed&&!reducedMotion.matches&&fourthVideo.duration>0
      ?fourthVideo.currentTime/fourthVideo.duration
      :(elapsed-EFFECTS.royal.templeAt)/(EFFECTS.royal.duration-EFFECTS.royal.templeAt);
    approachNumber(travel);
  }
  if(phase===fourthPhase)return;
  fourthPhase=phase;document.body.dataset.fourthPhase=phase;
  fourthStage.querySelector('b').textContent=phase==='gate'?'運命の扉が、開く。':phase==='destiny'?'さあ、最高の瞬間へ。':'幸運は、頂点へ。';
  if(phase==='ascent'&&!reducedMotion.matches&&!document.hidden&&!fourthVideoFailed)void fourthVideo.play().catch(()=>{fourthVideoFailed=true;});
}
let grandTimer;
function clearGrand(){clearTimeout(grandTimer);document.body.classList.remove('grand-reveal');clearFourth();}
function grandReveal(number){
  clearTimeout(grandTimer);
  grandStage.querySelectorAll('.grand-numbers span').forEach(span=>{span.textContent=String(number);});
  grandStage.querySelector('.grand-color').textContent=colorNames[colorOf(number)];
  document.body.classList.add('grand-reveal');
  grandStage.querySelector('.grand-title').textContent=effectTier==='royal'?'GOLDEN FINALE':'PREMIUM CELEBRATION';
  if(effectTier==='royal'){document.body.dataset.fourthPhase='finale';fourthVideo.pause();approachNumber(1);}
  grandTimer=setTimeout(clearGrand,effectTier==='royal'?7000:4400);
}
let celebrationTimer;
function clearCelebration(){clearTimeout(celebrationTimer);celebration.replaceChildren();}
function celebrate(){
  clearCelebration();
  (effectTier==='royal'?fourthStage:effectTier==='matsu'?grandStage:document.querySelector('main')).appendChild(celebration);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    for(let i=0;i<(effectTier==='royal'?260:effectTier==='matsu'?180:108);i++){
      const ribbon=document.createElement('span');
      ribbon.style.setProperty('--x',`${(i*37)%100}%`);
      ribbon.style.setProperty('--drift',`${(i%7-3)*35}px`);
      ribbon.style.setProperty('--delay',`${(i%9)*.045}s`);
      ribbon.style.setProperty('--turn',`${180+i*31}deg`);
      ribbon.style.background=['#f1d480','#ee778d','#67e6d3','#f9f4da'][i%4];
      celebration.appendChild(ribbon);
    }
    celebrationTimer=setTimeout(clearCelebration,effectTier==='royal'?6500:4000);
  }
}
function resetLighting(){teal.color.set('#0a8579');teal.emissive.set('#16cbb1');teal.emissiveIntensity=.8;fill.color.set(0x70ffeb);fill.intensity=35;specialHalo.visible=false;document.body.classList.remove('special-kick');specialBanner.querySelector('b').textContent='CHANCE';if(specialEnabled&&screenState!=='title')specialLighting(0);}
function specialLighting(progress){
  const pulse=.5+.5*Math.sin(progress*TAU*12);
  specialHalo.visible=true;specialHalo.rotation.y=progress*TAU*.8;
  const surges=EFFECTS[effectTier].surges;
  const surge=surges.filter(at=>at<=progress).length;
  const since=surge?progress-surges[surge-1]:1;
  const kick=since<(['matsu','royal'].includes(effectTier)?300/EFFECTS[effectTier].duration:.04);
  document.body.classList.toggle('special-kick',kick);
  const lights=specialBanner.querySelectorAll('i');
  lights.forEach((light,i)=>light.classList.toggle('lit',i<Math.ceil(surge*lights.length/surges.length)));
  haloMaterial.emissiveIntensity=kick?2.8:1.1+pulse*.5;
  teal.color.set('#c29b3f');teal.emissive.set('#ffc65a');
  teal.emissiveIntensity=kick?2.5:.8+pulse*.9;
  fill.color.set(kick?'#ff6957':'#ffd79a');fill.intensity=kick?65:25+pulse*15;
  if(['matsu','royal'].includes(effectTier)){
    haloMaterial.emissive.setHSL((progress*1.8)%1,.85,.55);
    haloMaterial.emissiveIntensity=kick?3.5:1.8;
    teal.emissiveIntensity=kick?3:1.5+pulse;
    specialHalo.rotation.y=progress*TAU*1.5;
  }else haloMaterial.emissive.set('#ff9e21');
}
function resize(){
  const {width,height}=host.getBoundingClientRect();
  renderer.setSize(width,height);camera.aspect=width/height;
  const distance=Math.max(15.4,11.7/(2*Math.tan(THREE.MathUtils.degToRad(19))*camera.aspect));
  camera.position.set(0,distance*.67,distance*.742);camera.lookAt(0,.1,0);camera.updateProjectionMatrix();
  render();
}
function render(){if(!contextLost)renderer.render(scene,camera);}
function setBall(state){wheelAngle=state.wheel;ballAngle=state.angle;wheel.rotation.y=wheelAngle;ball.position.set(state.radius*Math.sin(ballAngle),state.height,state.radius*Math.cos(ballAngle));}
function tick(now){
  if(!active)return;
  let progress=(now-active.start)/active.duration;
  if(active.tier==='royal'&&fourthPhase==='ascent'&&fourthVideo.ended)progress=1;
  // A slow decoder must finish the stairs before revealing the result.
  if(active.tier==='royal'&&progress>=1&&!reducedMotion.matches&&!fourthVideoFailed&&!fourthVideo.ended){
    if(progress<1.5)progress=.999;
    else fourthVideoFailed=true; // Unavailable/stalled media falls back to the poster.
  }
  if(active.special){
    specialLighting(progress);
    if(active.tier==='royal')fourthLighting(progress);
    document.body.classList.toggle('special-suspense',progress>(['matsu','royal'].includes(active.tier)?EFFECTS[active.tier].surges[0]-.02:.60)&&progress<1);
    if(progress>.82)status.textContent='運命の一球…';
    else if(progress>.60)status.textContent='まだ、まだ…';
  }
  const state=sampleSpin(active.spin,progress);setBall(state);render();sound.update(progress);
  if(state.done){
    const n=active.spin.number;
    const special=active.special;
    if(pocketAt(wheelAngle,ballAngle)!==n)throw new Error('Pocket/result mismatch');
    lastResult=n;active=null;round++;
    numberText.textContent=String(n);colorText.textContent=colorNames[colorOf(n)];
    dot.classList.remove('neutral');dot.style.setProperty('--result-color',{red:'#d2344a',black:'#121a20',green:'#39c59d'}[colorOf(n)]);
    status.textContent='結果は';
    document.body.classList.remove('spinning');document.body.classList.add('revealed');
    document.body.classList.remove('special-suspense','special-kick');
    document.body.classList.toggle('special-result',special);
    if(special){specialBanner.querySelector('b').textContent=effectTier==='matsu'?'GLORIOUS!':'LUCKY!';celebrate();if(['matsu','royal'].includes(effectTier))grandReveal(n);}
    document.querySelector('#round').textContent=`ROUND ${String(round).padStart(2,'0')}`;
    footerState.textContent='A LUCKY MOMENT TO REMEMBER';
    spinButton.disabled=false;spinButton.querySelector('span').textContent='回す';
    specialButton.disabled=false;
  }else{frame=requestAnimationFrame(tick);}
}
async function spin(){
  if(screenState!=='game'||active||contextLost||spinButton.disabled)return;
  spinButton.disabled=true;
  specialButton.disabled=true;
  spinButton.querySelector('span').textContent='準備中';
  await sound.prepare();
  if(contextLost)return;
  const n=randomNumber();
  const variation=new Uint32Array(1);crypto.getRandomValues(variation);
  const front=(variation[0]/2**32-.5)*.8;
  clearCelebration();clearGrand();resetLighting();
  specialBanner.querySelector('div').innerHTML=EFFECTS[effectTier].surges.slice(0,5).map(()=>'<i></i>').join('');
  active={spin:createSpin(n,wheelAngle,ballAngle,front,['matsu','royal'].includes(effectTier)?effectTier:specialEnabled),start:performance.now(),special:specialEnabled,tier:effectTier,duration:EFFECTS[effectTier].duration};
  if(effectTier==='royal'){summitNumber.querySelectorAll('span').forEach(span=>{span.textContent=String(n);});approachNumber(0);}
  sound.start(0,effectTier);
  document.body.classList.remove('special-result','special-suspense');
  document.body.classList.toggle('special-round',specialEnabled);
  document.body.classList.remove('revealed');document.body.classList.add('spinning');
  spinButton.disabled=true;spinButton.querySelector('span').textContent='抽選中';
  numberText.textContent='?';colorText.textContent='';dot.classList.add('neutral');
  status.textContent='幸運の行方は…';footerState.textContent='FINDING YOUR LUCKY NUMBER';
  frame=requestAnimationFrame(tick);
  if(document.hidden)pauseSpin();
}
spinButton.addEventListener('click',spin);
window.addEventListener('keydown',event=>{
  if(screenState!=='game'){
    if(event.code==='Space'||event.code==='Enter'){event.preventDefault();if(!event.repeat)startGame();}
    return;
  }
  if(event.code==='Space'&&!event.repeat&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)&&(!event.target.closest('button')||event.target.closest('button')===spinButton)){
    event.preventDefault();spin();
  }
});
const fullscreen=document.querySelector('#fullscreen');
fullscreen.addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{fullscreen.title='ブラウザの F11 キーでも全画面表示できます';}
});
document.addEventListener('fullscreenchange',()=>{
  const label=document.fullscreenElement?'全画面表示を終了':'フルスクリーン';
  fullscreen.title=label;fullscreen.setAttribute('aria-label',label);
  fullscreen.innerHTML=`<i data-lucide="${document.fullscreenElement?'minimize':'maximize'}"></i>`;lucide.createIcons();
});
renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();contextLost=true;cancelAnimationFrame(frame);spinButton.disabled=true;sound.stop();
  cancelAnimationFrame(titleFrame);
  if(screenState==='title'){const notice=document.querySelector('#title-error');notice.hidden=false;notice.textContent='3D表示が中断されました。再読み込みしてください。';startButton.disabled=true;}
  status.textContent='3D表示が中断されました。再読み込みしてください。';
});
function pauseSpin(){
  if(active&&active.paused===undefined){active.paused=performance.now();cancelAnimationFrame(frame);sound.stop();}
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){pauseSpin();fourthVideo.pause();return;}
  if(fourthPhase==='ascent'&&active&&!reducedMotion.matches&&!fourthVideoFailed)void fourthVideo.play().catch(()=>{fourthVideoFailed=true;});
  if(active&&active.paused!==undefined&&!contextLost){
    active.start+=performance.now()-active.paused;delete active.paused;
    sound.start((performance.now()-active.start)/active.duration);
    frame=requestAnimationFrame(tick);
  }
});
window.addEventListener('pagehide',()=>sound.stop());
document.querySelector('#loading').remove();
new ResizeObserver(resize).observe(host);resize();spinButton.disabled=false;
let lastTitleDraw=0;
function animateTitle(now){
  if(screenState!=='title')return;
  if(now-lastTitleDraw>50){
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)wheel.rotation.y=now*.000035;
    render();lastTitleDraw=now;
  }
  titleFrame=requestAnimationFrame(animateTitle);
}
function startGame(){
  if(screenState!=='title'||startButton.disabled||contextLost)return;
  screenState='entering';startButton.disabled=true;cancelAnimationFrame(titleFrame);
  document.body.dataset.screen='entering';
  void sound.prepare().then(ready=>{if(ready&&screenState==='entering')sound.playWelcome();});
  wheel.rotation.y=wheelAngle;resetLighting();resize();
  setTimeout(()=>{
    screenState='game';document.body.dataset.screen='game';titleScreen.hidden=true;
    document.querySelectorAll('header,main,footer').forEach(element=>{element.inert=false;});
    document.querySelector('main').focus({preventScroll:true});resize();
  },1000);
}
startButton.disabled=false;startButton.addEventListener('click',startGame);
titleFrame=requestAnimationFrame(animateTitle);
// Read-only scene diagnostics used by the visual verification script.
window.rouletteSnapshot=()=>({screenState,number:lastResult,spinning:!!active,effectTier,specialEnabled,duration:active?.duration,wheel:wheelAngle,ball:ballAngle,pocket:pocketAt(wheelAngle,ballAngle),ballPosition:ball.position.toArray(),round,audio:sound.snapshot()});
