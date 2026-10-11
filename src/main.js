import './interface.css';
import { createState, startRun, step, RULES } from './simulation.js';
import { HighwayScene } from './scene.js';
import { DriveAudio } from './audio.js';
import { CourtroomScene } from './courtroom.js';

const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['game','world','intro','start','start-label','countdown','drive-hint','braking-advice','crash-status','brake','brake-label','brake-subtitle','pressure','pressure-fill','force','speed','speed-caption','speed-arc-value','time','distance','system-status','result','result-title','result-code','result-description','result-time','result-distance','result-force','result-tip','restart','pause','resume','appearance','appearance-label','sound','sound-waves','fullscreen','impact','loading-note','error','error-message','reload','scene-transition','court','court-restart','court-speaker','court-line','court-detail','desktop-sync'].map(id=>[id,$(id)]));
const state=createState(),audio=new DriveAudio(),keys=new Set(),pointers=new Set();
let scene,paused=false,loaded=false,resultDelay=0,accumulator=0,previous=performance.now(),lastPhase='ready',lastCount='',resultScheduled=false,lastImpact=0,lastHUD=0;
let courtroom,courtActive=false,courtTransition=0,courtStage='',timeOfDay='day',pendingUpdate=false;
const hudCache=new Map();
const fixedStep=1/120;
function held(){return keys.size>0||pointers.size>0;}
function clearInput(){keys.clear();pointers.clear();ui.brake.classList.remove('is-held');}
function inputFeedback(){ui.brake.classList.toggle('is-held',held()&&!paused&&['running','countdown'].includes(state.phase));}
function text(id,value){if(hudCache.get(id)!==value){ui[id].textContent=value;hudCache.set(id,value);}}
function startChallenge() {
  if(!loaded||!scene)return;
  clearInput();paused=false;accumulator=0;resultDelay=0;resultScheduled=false;lastImpact=0;hudCache.clear();
  startRun(state);lastPhase='countdown';lastCount='';ui.game.dataset.phase='countdown';
  courtActive=false;courtTransition=0;courtStage='';ui.court.hidden=true;ui.appearance.disabled=false;ui['scene-transition'].classList.remove('is-active');
  ui.intro.hidden=true;ui.result.hidden=true;ui.pause.hidden=true;ui.countdown.hidden=false;ui['drive-hint'].hidden=true;ui['braking-advice'].hidden=true;ui['crash-status'].hidden=true;ui.game.dataset.impacts='0';
  ui.brake.disabled=false;ui.brake.classList.remove('is-broken','is-danger');ui.impact.classList.remove('is-active');
  ui['brake-label'].textContent='按住刹车';ui['brake-subtitle'].textContent='HOLD TO BRAKE';
  ui['system-status'].textContent='试验路段 / 准备发车';ui['speed-caption'].textContent='准备发车';
  scene.reset();audio.activate().catch(()=>{});updateHUD();
}

function pauseGame() {
  if((!courtActive&&!['running','countdown','broken'].includes(state.phase))||paused)return;
  clearInput();paused=true;accumulator=0;ui.pause.hidden=false;ui['system-status'].textContent=courtActive?'法庭 / 已暂停':'试验路段 / 已暂停';
  ui.brake.disabled=true;updateHUD();ui.resume.focus({preventScroll:true});
}
function resumeGame() {
  paused=false;accumulator=0;previous=performance.now();ui.pause.hidden=true;
  ui.brake.disabled=!['running','countdown'].includes(state.phase);ui['system-status'].textContent=courtActive?'案件移送 / 法庭':state.phase==='broken'?'车辆失控 / 制动失效':state.phase==='running'?'试验路段 / 制动测试中':'试验路段 / 准备发车';
  audio.activate().catch(()=>{});ui.resume.blur();
}

function showResult() {
  if(state.phase==='wrecked'){courtTransition=.001;ui['scene-transition'].classList.add('is-active');return;}
  const success=state.phase==='stopped';
  ui.result.classList.toggle('is-win',success);
  ui['result-code'].textContent=success?'TEST COMPLETE / 00 KM/H':'VEHICLE WRECKED / 1612 N';
  ui['result-title'].textContent=success?'终于，停下来了。':'这次，车也报废了。';
  ui['result-description'].textContent=success?'车停了。踏板也还在。分寸拿捏得不错。':'踏板断裂后车辆失控，撞击护栏并报废。';
  ui['result-time'].innerHTML=`${state.time.toFixed(2)} <small>s</small>`;
  ui['result-distance'].innerHTML=`${state.distance.toFixed(1)} <small>m</small>`;
  ui['result-force'].innerHTML=`${Math.floor(state.peakPressure)} <small>N</small>`;
  ui['result-tip'].textContent=success?'这次的安全感，是你一松一踩挣来的。':'试试短按减速，松开卸力，再继续制动。';
  ui.result.hidden=false;ui.restart.focus({preventScroll:true});
}

function enterCourt() {
  courtActive=true;courtTransition=0;courtStage='';clearInput();courtroom.reset();
  ui.game.dataset.phase='court';ui.court.hidden=false;ui['crash-status'].hidden=true;ui['braking-advice'].hidden=true;
  ui.appearance.disabled=true;ui['system-status'].textContent='案件移送 / 法庭';
  ui['scene-transition'].classList.remove('is-active');ui['court-restart'].focus({preventScroll:true});
}

function updateCourtCaption(stage) {
  if(stage===courtStage)return;courtStage=stage;ui.court.dataset.stage=stage;
  if(stage==='opening'){
    text('court-speaker','法庭记录 / 案件移送');text('court-line','车辆已报废。刹车测试，变成了庭审。');
    text('court-detail',`测试记录：${state.distance.toFixed(1)} m · 踏板力度 ${Math.floor(state.peakPressure)} N`);
  }else if(stage==='judge'){
    text('court-speaker','土不为 / 法官');text('court-line','现在开庭。');text('court-detail','起诉方：卑界　被告：懂车皇');
  }else{
    text('court-speaker','卑界 / 起诉方');text('court-line','你这是恶意刹车！');text('court-detail','本次测试以车辆撞毁告终。你可以重新测试。');
  }
}

function onPhaseChange() {
  if(state.phase===lastPhase)return;
  lastPhase=state.phase;ui.game.dataset.phase=state.phase;
  if(state.phase==='running') {
    ui.countdown.hidden=true;ui['drive-hint'].hidden=false;
    ui['system-status'].textContent='试验路段 / 制动测试中';ui['speed-caption'].textContent='持续加速中';
  }
  if(['broken','stopped','wrecked'].includes(state.phase)) {
    clearInput();ui.countdown.hidden=true;ui['drive-hint'].hidden=true;ui.brake.disabled=true;
    ui['braking-advice'].hidden=true;
    resultDelay=0;resultScheduled=state.phase!=='broken';
    if(state.phase==='broken') {
      ui.brake.classList.add('is-broken','is-danger');ui.impact.classList.add('is-active');scene.breakPedal();audio.broken();
      ui['brake-label'].textContent='踏板断裂';ui['brake-subtitle'].textContent='1612 N / FAILED';
      ui['system-status'].textContent='车辆失控 / 制动失效';text('speed-caption','制动失效');
      ui['crash-status'].hidden=false;ui['crash-status'].textContent='踏板断裂 · 车辆失控';
      if(navigator.vibrate)navigator.vibrate([55,40,90]);
    } else if(state.phase==='stopped') {
      audio.stopped();ui['brake-label'].textContent='已刹停';ui['brake-subtitle'].textContent='0 KM/H / COMPLETE';
      ui['system-status'].textContent='制动测试 / 成功刹停';text('speed-caption','安全停车');
    } else {
      ui['system-status'].textContent='碰撞结束 / 车辆报废';text('speed-caption','车辆报废');
      ui['crash-status'].textContent='碰撞结束 · 车辆报废';
    }
  }
  updateHUD();
}

function updateHUD() {
  text('speed',String(Math.round(state.speed*3.6)));
  text('time',state.time.toFixed(2));text('distance',String(Math.floor(state.distance)));
  text('force',String(Math.floor(state.pressure)));
  ui.pressure.style.setProperty('--pressure',String(state.pressure/RULES.breakingForce));
  const danger=state.pressure>1330,color=danger?'#ff755c':state.pressure>1080?'#edbf71':'#e6f28b';
  ui.pressure.style.setProperty('--force-color',color);ui.pressure.setAttribute('aria-valuenow',String(Math.floor(state.pressure)));
  ui['speed-arc-value'].style.strokeDashoffset=String(100-Math.min(state.speed*3.6/240,1)*100);
  ui.pressure.classList.toggle('is-critical',state.pressure>1250);
  if(!['broken','wrecked'].includes(state.phase))ui.brake.classList.toggle('is-danger',danger);
  if(state.phase==='countdown') {
    const count=String(Math.max(1,Math.ceil(state.countdown)));
    if(count!==lastCount){lastCount=count;const span=ui.countdown.querySelector('span');span.textContent=count;span.style.animation='none';void span.offsetWidth;span.style.animation='';}
  }
  if(state.phase==='running') {
    text('speed-caption',state.braking?'正在减速':'持续加速中');
    ui['drive-hint'].style.opacity=state.time>12?'0':'1';
    ui['drive-hint'].querySelector('span').textContent=danger?'接近临界点 · 松开卸力':'长按减速 · 松开卸力';
    ui['braking-advice'].hidden=state.speed*3.6<=100;
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
    if(state.impacts>lastImpact){
      lastImpact=state.impacts;ui.game.dataset.impacts=String(state.impacts);audio.crash(state.impactSpeed);
      ui['crash-status'].textContent=state.impacts>1?'再次撞击 · 车身严重损毁':'撞击护栏 · 车身损毁';
      ui.impact.classList.remove('is-active');void ui.impact.offsetWidth;ui.impact.classList.add('is-active');
      if(navigator.vibrate)navigator.vibrate([100,40,75]);
    }
    if(resultScheduled){resultDelay+=dt;if(resultDelay>1.35){resultScheduled=false;showResult();}}
    if(courtTransition>0){courtTransition+=dt;if(courtTransition>.52)enterCourt();}
  }
  if(now-lastHUD>=33||lastHUD===0){updateHUD();lastHUD=now;}
  if(!paused&&!document.hidden){
    if(courtActive){const info=courtroom.update(dt);updateCourtCaption(info.stage);if(info.gavel)audio.gavel();}
    else if(ui.result.hidden)scene.update(state,dt,false);
  }
  audio.update(state,paused||courtActive);
  if(pendingUpdate&&!paused&&(state.phase==='ready'||(state.phase==='stopped'&&!ui.result.hidden)||(courtActive&&courtroom.elapsed>8)))window.desktopGame?.applyUpdate();
}

ui.start.addEventListener('click',startChallenge);ui.restart.addEventListener('click',startChallenge);
ui['court-restart'].addEventListener('click',startChallenge);
ui.resume.addEventListener('click',resumeGame);ui.reload.addEventListener('click',()=>location.reload());
ui.brake.addEventListener('contextmenu',e=>e.preventDefault());
ui.brake.addEventListener('pointerdown',e=>{
  if(ui.brake.disabled||paused||!['running','countdown'].includes(state.phase))return;
  e.preventDefault();pointers.add(e.pointerId);
  inputFeedback();
  try{ui.brake.setPointerCapture(e.pointerId);}catch{}
  audio.activate().catch(()=>{});
});
function releasePointer(e){pointers.delete(e.pointerId);inputFeedback();}
for(const type of ['pointerup','pointercancel','lostpointercapture'])ui.brake.addEventListener(type,releasePointer);
window.addEventListener('pointerup',releasePointer,true);window.addEventListener('pointercancel',releasePointer,true);
window.addEventListener('keydown',e=>{
  if(['Space','ArrowDown','KeyB'].includes(e.code)) {
    e.preventDefault();if(e.repeat)return;
    if(state.phase==='ready'||courtActive||(ui.result.hidden===false&&['wrecked','stopped'].includes(state.phase))){startChallenge();}
    if(!paused&&['running','countdown'].includes(state.phase)){keys.add(e.code);inputFeedback();}
  }
  if(e.code==='Escape'){e.preventDefault();paused?resumeGame():pauseGame();}
});
window.addEventListener('keyup',e=>{
  if(['Space','ArrowDown','KeyB'].includes(e.code)){e.preventDefault();keys.delete(e.code);inputFeedback();}
});
window.addEventListener('blur',()=>{clearInput();pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pauseGame();}});
window.addEventListener('resize',()=>{scene?.resize();courtroom?.resize();});
ui.appearance.addEventListener('click',()=>{
  if(!scene)return;timeOfDay=timeOfDay==='day'?'dusk':'day';scene.setTime(timeOfDay);ui.game.dataset.appearance=timeOfDay;
  text('appearance-label',timeOfDay==='day'?'白天':'黄昏');ui.appearance.setAttribute('aria-pressed',String(timeOfDay==='dusk'));
  const description=timeOfDay==='day'?'切换到黄昏':'切换到白天';ui.appearance.title=description;ui.appearance.setAttribute('aria-label',description);
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
    scene=new HighwayScene(ui.world);courtroom=new CourtroomScene(scene.renderer);requestAnimationFrame(frame);
    if(import.meta.env.DEV&&new URLSearchParams(location.search).has('profile'))window.__highway={scene,state,courtroom};
    const failures=(await Promise.all([scene.loadAssets(),courtroom.loadAssets()])).flat();
    if(failures.length)console.warn('Some scene assets used procedural fallbacks:',failures);
    courtroom.prepare(scene.atmosphere.dayEnvironment?.texture);await scene.renderer.compileAsync(courtroom.scene,courtroom.camera);
    scene.update(state,1/60);await scene.renderer.compileAsync(scene.scene,scene.camera);loaded=true;ui.game.dataset.phase='ready';ui.game.dataset.appearance='day';ui.start.disabled=false;
    ui['start-label'].textContent='开始测试';ui['loading-note'].hidden=true;
    window.desktopGame?.onUpdateReady(()=>{pendingUpdate=true;ui['desktop-sync'].hidden=false;});
  }catch(error){
    ui.error.hidden=false;ui['error-message'].textContent='请使用支持 WebGL 2 的最新版 Chrome、Edge、Safari 或 Firefox。';
    console.error('Unable to initialize highway scene:',error);
  }
}
boot();
