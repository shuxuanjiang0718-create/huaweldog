import './style.css';
import { createState, startRun, step, RULES } from './simulation.js';
import { HighwayScene } from './scene.js';
import { DriveAudio } from './audio.js';

const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['game','world','intro','start','start-label','countdown','drive-hint','brake','brake-label','brake-subtitle','pressure','pressure-fill','force','speed','speed-caption','speed-arc-value','time','distance','system-status','result','result-title','result-code','result-description','result-time','result-distance','result-force','result-tip','restart','pause','resume','quality','sound','sound-waves','fullscreen','impact','loading-note','error','error-message','reload'].map(id=>[id,$(id)]));
const state=createState(),audio=new DriveAudio(),keys=new Set(),pointers=new Set();
let scene,paused=false,loaded=false,resultDelay=0,accumulator=0,previous=performance.now(),lastPhase='ready',lastCount='',resultScheduled=false;
const fixedStep=1/120;
function held(){return keys.size>0||pointers.size>0;}
function clearInput(){keys.clear();pointers.clear();ui.brake.classList.remove('is-held');}
function startChallenge() {
  if(!loaded||!scene)return;
  clearInput();paused=false;accumulator=0;resultDelay=0;resultScheduled=false;
  startRun(state);lastPhase='countdown';lastCount='';ui.game.dataset.phase='countdown';
  ui.intro.hidden=true;ui.result.hidden=true;ui.pause.hidden=true;ui.countdown.hidden=false;ui['drive-hint'].hidden=true;
  ui.brake.disabled=false;ui.brake.classList.remove('is-broken','is-danger');ui.impact.classList.remove('is-active');
  ui['brake-label'].textContent='按住刹车';ui['brake-subtitle'].textContent='HOLD TO BRAKE';
  ui['system-status'].textContent='试验路段 / 准备发车';ui['speed-caption'].textContent='准备发车';
  scene.worldDistance=0;audio.activate().catch(()=>{});updateHUD();
}

function pauseGame() {
  if(!['running','countdown'].includes(state.phase)||paused)return;
  clearInput();paused=true;accumulator=0;ui.pause.hidden=false;ui['system-status'].textContent='试验路段 / 已暂停';
  ui.brake.disabled=true;ui.resume.focus({preventScroll:true});
}
function resumeGame() {
  paused=false;accumulator=0;previous=performance.now();ui.pause.hidden=true;
  ui.brake.disabled=false;ui['system-status'].textContent=state.phase==='running'?'试验路段 / 制动测试中':'试验路段 / 准备发车';
  audio.activate().catch(()=>{});ui.resume.blur();
}

function showResult() {
  const success=state.phase==='stopped';
  ui.result.classList.toggle('is-win',success);
  ui['result-code'].textContent=success?'TEST COMPLETE / 00 KM/H':'TEST FAILED / 1612 N';
  ui['result-title'].textContent=success?'终于，停下来了。':'踏板先停了。';
  ui['result-description'].textContent=success?'车停了。踏板也还在。分寸拿捏得不错。':'车还没停，踏板已经下班。';
  ui['result-time'].innerHTML=`${state.time.toFixed(2)} <small>s</small>`;
  ui['result-distance'].innerHTML=`${state.distance.toFixed(1)} <small>m</small>`;
  ui['result-force'].innerHTML=`${Math.floor(state.peakPressure)} <small>N</small>`;
  ui['result-tip'].textContent=success?'这次的安全感，是你一松一踩挣来的。':'试试短按减速，松开卸力，再继续制动。';
  ui.result.hidden=false;ui.restart.focus({preventScroll:true});
}

function onPhaseChange() {
  if(state.phase===lastPhase)return;
  lastPhase=state.phase;ui.game.dataset.phase=state.phase;
  if(state.phase==='running') {
    ui.countdown.hidden=true;ui['drive-hint'].hidden=false;
    ui['system-status'].textContent='试验路段 / 制动测试中';ui['speed-caption'].textContent='持续加速中';
  }
  if(state.phase==='broken'||state.phase==='stopped') {
    clearInput();ui.countdown.hidden=true;ui['drive-hint'].hidden=true;ui.brake.disabled=true;
    resultDelay=0;resultScheduled=true;
    if(state.phase==='broken') {
      ui.brake.classList.add('is-broken','is-danger');ui.impact.classList.add('is-active');scene.breakPedal();audio.broken();
      ui['brake-label'].textContent='踏板断裂';ui['brake-subtitle'].textContent='1612 N / FAILED';
      ui['system-status'].textContent='制动系统 / 踏板断裂';ui['speed-caption'].textContent='未能刹停';
      if(navigator.vibrate)navigator.vibrate([55,40,90]);
    } else {
      audio.stopped();ui['brake-label'].textContent='已刹停';ui['brake-subtitle'].textContent='0 KM/H / COMPLETE';
      ui['system-status'].textContent='制动测试 / 成功刹停';ui['speed-caption'].textContent='安全停车';
    }
  }
}

function updateHUD() {
  ui.speed.textContent=String(Math.round(state.speed*3.6));
  ui.time.textContent=state.time.toFixed(2);ui.distance.textContent=String(Math.floor(state.distance));
  ui.force.textContent=String(Math.floor(state.pressure));
  ui.pressure.style.setProperty('--pressure',String(state.pressure/RULES.breakingForce));
  const danger=state.pressure>1330,color=danger?'#ff755c':state.pressure>1080?'#edbf71':'#e6f28b';
  ui.pressure.style.setProperty('--force-color',color);ui.pressure.setAttribute('aria-valuenow',String(Math.floor(state.pressure)));
  ui['speed-arc-value'].style.strokeDashoffset=String(100-Math.min(state.speed*3.6/240,1)*100);
  ui.brake.classList.toggle('is-held',state.braking&&!paused);
  if(state.phase!=='broken')ui.brake.classList.toggle('is-danger',danger);
  if(state.phase==='countdown') {
    const count=String(Math.max(1,Math.ceil(state.countdown)));
    if(count!==lastCount){lastCount=count;const span=ui.countdown.querySelector('span');span.textContent=count;span.style.animation='none';void span.offsetWidth;span.style.animation='';}
  }
  if(state.phase==='running') {
    ui['speed-caption'].textContent=state.braking?'正在减速':'持续加速中';
    ui['drive-hint'].style.opacity=state.time>12?'0':'1';
    ui['drive-hint'].querySelector('span').textContent=danger?'接近临界点 · 松开卸力':'长按减速 · 松开卸力';
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt=Math.min(Math.max((now-previous)/1000,0),.16);previous=now;
  if(!scene)return;
  if(!paused) {
    accumulator+=dt;
    while(accumulator>=fixedStep) {step(state,fixedStep,held());accumulator-=fixedStep;}
    onPhaseChange();
    if(resultScheduled){resultDelay+=dt;if(resultDelay>.9){resultScheduled=false;showResult();}}
  }
  updateHUD();
  if(!paused&&ui.result.hidden&&!document.hidden)scene.update(state,dt,false);
  audio.update(state,paused);
}

ui.start.addEventListener('click',startChallenge);ui.restart.addEventListener('click',startChallenge);
ui.resume.addEventListener('click',resumeGame);ui.reload.addEventListener('click',()=>location.reload());
ui.brake.addEventListener('contextmenu',e=>e.preventDefault());
ui.brake.addEventListener('pointerdown',e=>{
  if(ui.brake.disabled||paused||!['running','countdown'].includes(state.phase))return;
  e.preventDefault();pointers.add(e.pointerId);
  try{ui.brake.setPointerCapture(e.pointerId);}catch{}
  audio.activate().catch(()=>{});
});
function releasePointer(e){pointers.delete(e.pointerId);}
for(const type of ['pointerup','pointercancel','lostpointercapture'])ui.brake.addEventListener(type,releasePointer);
window.addEventListener('pointerup',releasePointer,true);window.addEventListener('pointercancel',releasePointer,true);
window.addEventListener('keydown',e=>{
  if(['Space','ArrowDown','KeyB'].includes(e.code)) {
    e.preventDefault();if(e.repeat)return;
    if(state.phase==='ready'||state.phase==='broken'||state.phase==='stopped'){startChallenge();}
    if(!paused&&['running','countdown'].includes(state.phase))keys.add(e.code);
  }
  if(e.code==='Escape'){e.preventDefault();paused?resumeGame():pauseGame();}
});
window.addEventListener('keyup',e=>{
  if(['Space','ArrowDown','KeyB'].includes(e.code)){e.preventDefault();keys.delete(e.code);}
});
window.addEventListener('blur',()=>{clearInput();pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pauseGame();}});
window.addEventListener('resize',()=>scene?.resize());
ui.quality.addEventListener('click',()=>{
  if(!scene)return;
  const modes=['auto','high','low'],names={auto:'自动',high:'高清',low:'流畅'};
  const next=modes[(modes.indexOf(scene.mode)+1)%3];scene.setQuality(next);
  ui.quality.title=`画质：${names[next]}`;ui.quality.setAttribute('aria-label',`画质：${names[next]}，点击切换`);
  ui.quality.querySelector('span').textContent=next==='low'?'SD':'HD';
});
ui.sound.addEventListener('click',async()=>{
  try{
    const enabled=await audio.toggle();ui.sound.setAttribute('aria-pressed',String(enabled));ui.sound.setAttribute('aria-label',enabled?'关闭声音':'打开声音');
    ui.sound.title=enabled?'关闭声音':'打开声音';ui['sound-waves'].setAttribute('d',enabled?'M17 8a6 6 0 0 1 0 8m2-11a10 10 0 0 1 0 14':'m17 9 4 6m0-6-4 6');
  }catch{ui.sound.title='当前浏览器无法启动声音';}
});
ui.fullscreen.addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await ui.game.requestFullscreen();}catch{}
});
ui.world.addEventListener('webglcontextlost',e=>{
  e.preventDefault();pauseGame();ui.error.hidden=false;ui['error-message'].textContent='图形连接中断，请重新载入继续挑战。';
});

async function boot() {
  try{
    scene=new HighwayScene(ui.world);requestAnimationFrame(frame);
    const failures=await scene.loadAssets();
    if(failures.length)console.warn('Some scene assets used procedural fallbacks:',failures);
    scene.update(state,1/60);loaded=true;ui.game.dataset.phase='ready';ui.start.disabled=false;
    ui['start-label'].textContent='开始挑战';ui['loading-note'].hidden=true;
  }catch(error){
    ui.error.hidden=false;ui['error-message'].textContent='请使用支持 WebGL 2 的最新版 Chrome、Edge、Safari 或 Firefox。';
    console.error('Unable to initialize highway scene:',error);
  }
}
boot();
