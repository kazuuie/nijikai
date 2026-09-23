import {CAPTURE_PROGRESS,BOUNCE_CONTACTS,EFFECTS} from './roulette.js';

// Relative level of rolling and bounce sounds only; wheel/master are independent.
export const BALL_SOUND_LEVEL = .8;
export function collisionSound(contact,index) {
  const nearCapture=Math.abs(contact.progress-CAPTURE_PROGRESS)<.012;
  return {gain:BALL_SOUND_LEVEL*.24*contact.strength*(nearCapture?.25:1),
    rate:.94+.12*contact.strength+(index%2?.012:-.012)};
}

const clamp = value => Math.max(0, Math.min(1, value));
export function soundAt(progress) {
  const t = clamp(progress);
  const wheelSpeed = (1-t)**2;
  const ballSpeed = Math.max(0, 1-t/CAPTURE_PROGRESS)**2;
  return {
    wheelRate:.32+1.08*wheelSpeed,
    wheelGain:.30*wheelSpeed**.65,
    ballRate:.28+1.42*ballSpeed,
    ballGain:t<CAPTURE_PROGRESS ? BALL_SOUND_LEVEL*.44*ballSpeed**.35 : 0,
  };
}

export class RouletteAudio {
  constructor(onError = () => {}) {
    this.onError=onError;
    this.volume=.5;
    this.muted=false;
    try {
      const settings=JSON.parse(localStorage.getItem('roulette-audio'));
      if(settings && Number.isFinite(settings.volume))this.volume=clamp(settings.volume);
      if(typeof settings?.muted==='boolean')this.muted=settings.muted;
    } catch {}
    this.sources=new Set();
    this.loops=[];
    this.collisions=[];
    this.progress=0;
    this.special=false;
    this.tier='ume';
    this.flourishCount=0;
    this.surgeCount=0;
    this.welcomeCount=0;
  }
  async prepare() {
    try {
      // Called inside the spin/control gesture to satisfy autoplay policies.
      if(!this.context){
        this.context=new AudioContext();
        this.master=this.context.createGain();
        this.master.gain.value=this.muted?0:this.volume**2;
        this.master.connect(this.context.destination);
      }
      const resumed=this.context.resume();
      if(!this.loading){
        this.loading=Promise.all(['wheel','ball','collision','suspense','celebration','surge','grand','welcome'].map(async name=>{
          const response=await fetch(`./audio/${name}.wav`);
          if(!response.ok)throw new Error(`Audio load failed: ${name}`);
          return [name,await this.context.decodeAudioData(await response.arrayBuffer())];
        })).then(entries=>{this.buffers=Object.fromEntries(entries);});
      }
      await Promise.all([resumed,this.loading]);
      this.onError(false);
      return true;
    }catch(error){
      this.loading=null;
      this.onError(true);
      return false;
    }
  }
  setSettings(volume,muted) {
    this.volume=clamp(volume);this.muted=muted;
    if(this.master){
      const now=this.context.currentTime;
      const gain=this.master.gain;
      const current=gain.value;
      gain.cancelScheduledValues(now);
      gain.value=muted?0:this.volume**2;
      gain.setValueAtTime(current,now);
      gain.linearRampToValueAtTime(muted?0:this.volume**2,now+.02);
    }
    try{localStorage.setItem('roulette-audio',JSON.stringify({volume:this.volume,muted}));}catch{}
  }
  playWelcome(){
    if(!this.buffers||this.context.state!=='running'||this.welcomeCount)return;
    const voice=this.source('welcome',false,.22);voice.source.start();this.welcomeCount++;
  }
  source(name,loop,gainValue) {
    const source=this.context.createBufferSource();
    const gain=this.context.createGain();
    source.buffer=this.buffers[name];source.loop=loop;gain.gain.value=gainValue;
    source.connect(gain);gain.connect(this.master);
    const voice={source,gain};this.sources.add(voice);
    source.onended=()=>{source.disconnect();gain.disconnect();this.sources.delete(voice);};
    return voice;
  }
  start(progress=0,tier=this.tier) {
    this.stop();
    this.tier=tier===true?'take':tier===false?'ume':tier;
    this.special=this.tier!=='ume';
    if(progress===0){this.collisions=[];this.flourishCount=0;this.surgeCount=0;}
    this.progress=progress;
    if(!this.buffers||this.context.state!=='running')return;
    this.loops=['wheel','ball'].map(name=>this.source(name,true,0));
    const state=soundAt(progress);
    this.loops[0].source.playbackRate.value=state.wheelRate;
    this.loops[1].source.playbackRate.value=state.ballRate;
    for(const voice of this.loops)voice.source.start();
    if(this.special){this.suspense=this.source('suspense',true,0);this.suspense.source.start();}
    this.update(progress);
  }
  update(progress) {
    const previous=this.progress;
    this.progress=clamp(progress);
    if(!this.loops.length)return;
    if(progress>=1){
      this.stop();
      if(this.special&&this.flourishCount===0){
        const voice=this.source(this.tier==='matsu'?'grand':'celebration',false,this.tier==='matsu'?.65:.45);voice.source.start();this.flourishCount++;
      }
      return;
    }
    const state=soundAt(progress),now=this.context.currentTime;
    if(this.special){
      EFFECTS[this.tier].surges.forEach((at,index)=>{
        if(previous<at&&progress>=at&&progress-at<.025){
          const voice=this.source('surge',false,Math.min(.65,.42+index*.045));
          voice.source.playbackRate.value=this.tier==='matsu'?Math.min(1.5,.92+index*.08):.92+index*.08;voice.source.start();this.surgeCount++;
        }
      });
    }
    if(this.suspense){
      const build=clamp((progress-.32)/.62);
      const hush=progress>.95?Math.max(0,(1-progress)/.05):1;
      this.suspense.gain.gain.setTargetAtTime((.025+.16*build)*hush,now,.04);
      this.suspense.source.playbackRate.setTargetAtTime(.72+.65*build,now,.04);
    }
    for(const [i,name] of ['wheel','ball'].entries()){
      this.loops[i].source.playbackRate.setTargetAtTime(state[`${name}Rate`],now,.025);
      this.loops[i].gain.gain.setTargetAtTime(state[`${name}Gain`],now,.025);
    }
    // These are the zero-height contacts of the exact bounce curve used on screen.
    // Skip old contacts after a stalled frame instead of playing a burst of catch-up sounds.
    BOUNCE_CONTACTS.forEach((contact,index)=>{
      if(contact.progress>previous&&contact.progress<=progress&&progress-contact.progress<.012){
        const {gain,rate}=collisionSound(contact,index);
        const impact=this.source('collision',false,gain);
        impact.source.playbackRate.value=rate;impact.source.start();
        this.collisions.push({progress:contact.progress,playedAt:progress,gain,rate});
      }
    });
  }
  stop() {
    if(!this.context)return;
    const now=this.context.currentTime;
    for(const voice of this.sources){
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0,now,.008);
      voice.source.stop(now+.04);
    }
    this.sources.clear();this.loops=[];this.suspense=null;
  }
  snapshot() {
    return {ready:!!this.buffers,state:this.context?.state,volume:this.volume,muted:this.muted,masterGain:this.master?.gain.value,
      welcomeCount:this.welcomeCount,tier:this.tier,special:this.special,flourishCount:this.flourishCount,surgeCount:this.surgeCount,suspense:!!this.suspense,
      loops:this.loops.length,collisions:[...this.collisions],progress:this.progress,...soundAt(this.progress)};
  }
}
