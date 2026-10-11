"""Brief measurement of the normal packaged window, without global desktop input."""
import json, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}));deadline=time.monotonic()+45
while True:
    try:
        with opener.open('http://127.0.0.1:9358/json/version',timeout=3) as response:endpoint=json.load(response)['webSocketDebuggerUrl']
        break
    except Exception:
        if time.monotonic()>deadline:raise
        time.sleep(.2)
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp(endpoint)
    page=next(page for ctx in browser.contexts for page in ctx.pages if page.url.startswith('game://local/'))
    page.context.new_cdp_session(page).send('Emulation.setFocusEmulationEnabled',{'enabled':True})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        page.wait_for_selector('#game[data-phase="ready"]',timeout=45000);page.wait_for_timeout(1500)
        build=page.evaluate("async()=>await(await fetch('/game-version.json')).json()")
        page.locator('#start').click();page.wait_for_selector('#game[data-phase="running"]',timeout=12000);page.wait_for_timeout(800)
        timing=page.evaluate('''async()=>{
          let start=performance.now(),previous=start,intervals=[];
          await new Promise(resolve=>{function f(t){intervals.push(t-previous);previous=t;if(performance.now()-start>5000)resolve();else requestAnimationFrame(f)}requestAnimationFrame(f)});
          const sorted=intervals.slice(2).sort((a,b)=>a-b),gl=document.querySelector('#world').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
          return {fps:intervals.length/((performance.now()-start)/1000),frameP95Ms:sorted[Math.floor(sorted.length*.95)],frameMaxMs:sorted.at(-1),pixels:[gl.drawingBufferWidth,gl.drawingBufferHeight],viewport:[innerWidth,innerHeight],gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,paused:!document.querySelector('#pause').hidden};
        }''')
        page.screenshot(path=str(root/'artifacts'/'exe-v12-normal-running.jpg'),type='jpeg',quality=94)
        assert not timing['paused'],'Normal window lost focus during measurement'
        assert not errors,errors
        (root/'artifacts'/'desktop-normal-performance-v12.json').write_text(json.dumps({'renderingMode':'normal visible window','focusEmulated':True,'backgroundThrottlingDisabledForMeasurement':True,'build':build,'measurement':timing,'errors':errors},indent=2),encoding='utf-8')
        print(json.dumps(timing),flush=True)
    finally:
        print(page.evaluate("({phase:document.querySelector('#game').dataset.phase,pauseVisible:!document.querySelector('#pause').hidden,visibility:document.visibilityState,focused:document.hasFocus(),countdown:document.querySelector('#countdown').textContent})"),flush=True)
        page.close()
