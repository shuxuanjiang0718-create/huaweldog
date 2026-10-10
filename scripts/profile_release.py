"""Same-device release profiling, including WebGL work and input-to-feedback timing."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
url = os.environ.get('GAME_QA_URL', 'http://127.0.0.1:5179/')
label = os.environ.get('PROFILE_LABEL', 'after')
instrument = '''(() => {
  window.renderWork = {calls:0, triangles:0};
  for (const [method, countAt, instancesAt] of [
    ['drawElements',1,-1],['drawArrays',2,-1],
    ['drawElementsInstanced',1,4],['drawArraysInstanced',2,3]]) {
    const original = WebGL2RenderingContext.prototype[method];
    WebGL2RenderingContext.prototype[method] = function(...args) {
      renderWork.calls++;
      if(args[0] === 4) renderWork.triangles += args[countAt]/3*(instancesAt<0?1:args[instancesAt]);
      return original.apply(this,args);
    };
  }
  window.inputSamples = [];
  window.armInputAudit=()=>window.addEventListener('keydown', e => {
    if(e.code !== 'ArrowDown' || e.repeat)return;
    const start=performance.now(), el=document.getElementById('brake');
    queueMicrotask(()=>{
      const immediate=el.classList.contains('is-held');
      function next(){
        if(el.classList.contains('is-held'))inputSamples.push({handlerFeedback:immediate,nextPaintMs:performance.now()-start});
        else requestAnimationFrame(next);
      }
      requestAnimationFrame(next);
    });
  });
})();'''

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    try:
        page=browser.new_page(viewport={'width':1600,'height':900},device_scale_factor=1)
        page.add_init_script(instrument)
        page.goto(url,wait_until='networkidle')
        page.wait_for_selector('#game[data-phase="ready"]',timeout=30000)
        page.evaluate('armInputAudit()')
        cdp=page.context.new_cdp_session(page);cdp.send('Performance.enable')
        results=[]
        for mode in ['auto','high','low']:
            if mode!='auto':page.locator('#quality').click()
            page.wait_for_timeout(1200)
            before={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
            timing=page.evaluate('''async()=>{
              let start=performance.now(),intervals=[],previous=start;
              const work={...renderWork};
              await new Promise(resolve=>{function f(t){intervals.push(t-previous);previous=t;if(performance.now()-start>=3500)resolve();else requestAnimationFrame(f)}requestAnimationFrame(f)});
              let gl=document.querySelector('canvas').getContext('webgl2'), ext=gl.getExtension('WEBGL_debug_renderer_info');
              const sorted=intervals.slice(2).sort((a,b)=>a-b), frames=intervals.length;
              return {frames,elapsed:(performance.now()-start)/1000,frameP95Ms:sorted[Math.floor(sorted.length*.95)],gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,pixels:[gl.drawingBufferWidth,gl.drawingBufferHeight],drawCallsPerFrame:(renderWork.calls-work.calls)/frames,trianglesPerFrame:(renderWork.triangles-work.triangles)/frames};
            }''')
            after={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
            timing.update(mode=mode,fps=timing['frames']/timing['elapsed'],cpu_ms_per_frame=(after['TaskDuration']-before['TaskDuration'])*1000/timing['frames'],script_ms_per_frame=(after['ScriptDuration']-before['ScriptDuration'])*1000/timing['frames'])
            results.append(timing)
        page.locator('#quality').click()
        page.locator('#start').click();page.wait_for_selector('#game[data-phase="running"]')
        for _ in range(6):
            page.keyboard.down('ArrowDown');page.wait_for_timeout(180);page.keyboard.up('ArrowDown');page.wait_for_timeout(350)
        inputs=page.evaluate('inputSamples')
        running=page.evaluate('''async()=>{let frames=0,start=performance.now();await new Promise(r=>{function f(){frames++;performance.now()-start>2400?r():requestAnimationFrame(f)}requestAnimationFrame(f)});return {fps:frames/((performance.now()-start)/1000)}}''')
        page.keyboard.down('Space');page.wait_for_selector('#game[data-phase="broken"]',timeout=5000);page.keyboard.up('Space')
        crash=page.evaluate('''async()=>{let frames=0,start=performance.now(),previous=start,intervals=[];await new Promise(r=>{function f(t){frames++;intervals.push(t-previous);previous=t;document.querySelector('#game').dataset.phase==='wrecked'?r():requestAnimationFrame(f)}requestAnimationFrame(f)});const sorted=intervals.slice(2).sort((a,b)=>a-b);return {fps:frames/((performance.now()-start)/1000),frameP95Ms:sorted[Math.floor(sorted.length*.95)],seconds:(performance.now()-start)/1000,impacts:Number(document.querySelector('#game').dataset.impacts)}}''')
        page.wait_for_selector('#result:not([hidden])')
        page.close()
        phone=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1.5,is_mobile=True,has_touch=True)
        phone.goto(url,wait_until='networkidle');phone.wait_for_selector('#game[data-phase="ready"]');phone.wait_for_timeout(1000)
        mobile=phone.evaluate('''async()=>{let frames=0,start=performance.now();await new Promise(r=>{function f(){frames++;performance.now()-start>3000?r():requestAnimationFrame(f)}requestAnimationFrame(f)});let gl=document.querySelector('canvas').getContext('webgl2');return {fps:frames/((performance.now()-start)/1000),pixels:[gl.drawingBufferWidth,gl.drawingBufferHeight],emulated:true}}''')
        report={'label':label,'viewport':[1600,900],'modes':results,'input':inputs,'running':running,'crash':crash,'mobile':mobile}
        root.joinpath('artifacts',f'performance-{label}.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report,indent=2))
    finally:browser.close()
