import * as THREE from './vendor/three.module.min.js';
import {ORDER,STEP,TAU,DURATION,colorOf,colorNames,randomNumber,createSpin,sampleSpin,pocketAt} from './roulette.js';
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
let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
} catch (error) {
  document.querySelector('#loading').textContent = '3D表示を開始できません。Chrome / Edge のハードウェア アクセラレーションを有効にして、再読み込みしてください。';
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

let active=null,wheelAngle=0,ballAngle=-.65,round=0,frame=0,contextLost=false;
let lastResult=null;
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
  const progress=(now-active.start)/DURATION;
  const state=sampleSpin(active.spin,progress);setBall(state);render();sound.update(progress);
  if(state.done){
    const n=active.spin.number;
    if(pocketAt(wheelAngle,ballAngle)!==n)throw new Error('Pocket/result mismatch');
    lastResult=n;active=null;round++;
    numberText.textContent=String(n);colorText.textContent=colorNames[colorOf(n)];
    dot.classList.remove('neutral');dot.style.setProperty('--result-color',{red:'#d2344a',black:'#121a20',green:'#39c59d'}[colorOf(n)]);
    status.textContent='おめでとうございます';
    document.body.classList.remove('spinning');document.body.classList.add('revealed');
    document.querySelector('#round').textContent=`ROUND ${String(round).padStart(2,'0')}`;
    footerState.textContent='A LUCKY MOMENT TO REMEMBER';
    spinButton.disabled=false;spinButton.querySelector('span').textContent='回す';
  }else{frame=requestAnimationFrame(tick);}
}
async function spin(){
  if(active||contextLost||spinButton.disabled)return;
  spinButton.disabled=true;
  spinButton.querySelector('span').textContent='準備中';
  await sound.prepare();
  if(contextLost)return;
  const n=randomNumber();
  const variation=new Uint32Array(1);crypto.getRandomValues(variation);
  const front=(variation[0]/2**32-.5)*.8;
  active={spin:createSpin(n,wheelAngle,ballAngle,front),start:performance.now()};
  sound.start();
  document.body.classList.remove('revealed');document.body.classList.add('spinning');
  spinButton.disabled=true;spinButton.querySelector('span').textContent='抽選中';
  numberText.textContent='?';colorText.textContent='';dot.classList.add('neutral');
  status.textContent='幸運の行方は…';footerState.textContent='FINDING YOUR LUCKY NUMBER';
  frame=requestAnimationFrame(tick);
  if(document.hidden)pauseSpin();
}
spinButton.addEventListener('click',spin);
window.addEventListener('keydown',event=>{
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
  status.textContent='3D表示が中断されました。再読み込みしてください。';
});
function pauseSpin(){
  if(active&&active.paused===undefined){active.paused=performance.now();cancelAnimationFrame(frame);sound.stop();}
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){pauseSpin();return;}
  if(active&&active.paused!==undefined&&!contextLost){
    active.start+=performance.now()-active.paused;delete active.paused;
    sound.start((performance.now()-active.start)/DURATION);
    frame=requestAnimationFrame(tick);
  }
});
window.addEventListener('pagehide',()=>sound.stop());
document.querySelector('#loading').remove();
new ResizeObserver(resize).observe(host);resize();spinButton.disabled=false;
// Read-only scene diagnostics used by the visual verification script.
window.rouletteSnapshot=()=>({number:lastResult,spinning:!!active,wheel:wheelAngle,ball:ballAngle,pocket:pocketAt(wheelAngle,ballAngle),ballPosition:ball.position.toArray(),round,audio:sound.snapshot()});
