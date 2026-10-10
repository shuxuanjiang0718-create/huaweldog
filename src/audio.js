export class DriveAudio {
  constructor() { this.enabled=false; this.context=null; }
  async activate() {
    if (!this.enabled) return;
    if (!this.context) {
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)return;
      const ctx=new Context();this.context=ctx;
      this.master=ctx.createGain();this.master.gain.value=.18;this.master.connect(ctx.destination);
      this.motor=ctx.createOscillator();this.motor.type='triangle';
      this.motorGain=ctx.createGain();this.motorGain.gain.value=0;this.motor.connect(this.motorGain);this.motorGain.connect(this.master);this.motor.start();
      const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      this.noiseBuffer=buffer;
      this.wind=ctx.createBufferSource();this.wind.buffer=buffer;this.wind.loop=true;
      this.windFilter=ctx.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.frequency.value=420;
      this.windGain=ctx.createGain();this.windGain.gain.value=0;
      this.wind.connect(this.windFilter);this.windFilter.connect(this.windGain);this.windGain.connect(this.master);this.wind.start();
      this.brake=ctx.createOscillator();this.brake.type='sine';
      this.brakeGain=ctx.createGain();this.brakeGain.gain.value=0;this.brake.connect(this.brakeGain);this.brakeGain.connect(this.master);this.brake.start();
    }
    await this.context.resume();
    this.master.gain.setTargetAtTime(.18,this.context.currentTime,.06);
  }
  async toggle() {
    this.enabled=!this.enabled;
    if(this.enabled)await this.activate();
    else if(this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.06);
    return this.enabled;
  }
  update(state,paused) {
    if(!this.context)return;
    const t=this.context.currentTime,active=this.enabled&&!paused&&['running','countdown'].includes(state.phase);
    const speed=state.speed;
    this.motor.frequency.setTargetAtTime(37+speed*1.6,t,.12);
    this.motorGain.gain.setTargetAtTime(active?.18:0,t,.12);
    this.windFilter.frequency.setTargetAtTime(350+speed*17,t,.18);
    this.windGain.gain.setTargetAtTime(active?.15+Math.min(speed/170,.3):0,t,.15);
    this.brake.frequency.setTargetAtTime(175+speed*3,t,.1);
    this.brakeGain.gain.setTargetAtTime(active&&state.braking?.075:0,t,.06);
  }
  broken() {
    if(!this.context||!this.enabled)return;
    const ctx=this.context,t=ctx.currentTime;
    const noise=ctx.createBufferSource();noise.buffer=this.noiseBuffer;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=2000;filter.Q.value=.8;
    const gain=ctx.createGain();gain.gain.setValueAtTime(1.6,t);gain.gain.exponentialRampToValueAtTime(.001,t+.45);
    noise.connect(filter);filter.connect(gain);gain.connect(this.master);noise.start(t);noise.stop(t+.5);
    for(const frequency of [183,733,1679]) {
      const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='triangle';osc.frequency.value=frequency;
      g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.001,t+.7);
      osc.connect(g);g.connect(this.master);osc.start(t);osc.stop(t+.75);
    }
  }
  stopped() {
    if(!this.context||!this.enabled)return;
    const ctx=this.context,t=ctx.currentTime;
    [392,493.88,587.33].forEach((frequency,i)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=frequency;
      const start=t+i*.09;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.22,start+.025);gain.gain.exponentialRampToValueAtTime(.001,start+.65);
      osc.connect(gain);gain.connect(this.master);osc.start(start);osc.stop(start+.7);
    });
  }
}
