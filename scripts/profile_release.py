"""Sequential release profiling on the same desktop GPU, using real gameplay input."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
url=os.environ.get('GAME_QA_URL','http://127.0.0.1:5179/')
instrument='''(()=>{
  window.renderWork={calls:0,triangles:0};
  for(const [method,countAt,instancesAt] of [['drawElements',1,-1],['drawArrays',2,-1],['drawElementsInstanced',1,4],['drawArraysInstanced',2,3]]){
    const original=WebGL2RenderingContext.prototype[method];
    WebGL2RenderingContext.prototype[method]=function(...args){renderWork.calls++;if(args[0]===4)renderWork.triangles+=args[countAt]/3*(instancesAt<0?1:args[instancesAt]);return original.apply(this,args);};
  }
  window.inputSamples=[];window.armInputAudit=()=>window.addEventListener('keydown',e=>{
    if(e.code!=='ArrowDown'||e.repeat)return;const start=performance.now();
    queueMicrotask(()=>{const immediate=document.querySelector('#brake').classList.contains('is-held');requestAnimationFrame(()=>inputSamples.push({handlerFeedback:immediate,nextAnimationFrameMs:performance.now()-start}));});
  });
})();'''

def measure(page,cdp,label,milliseconds):
    before={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    data=page.evaluate('''async ms=>{
      const start=performance.now(),work={...renderWork},intervals=[];let previous=start;
      await new Promise(resolve=>{function f(t){intervals.push(t-previous);previous=t;if(performance.now()-start>=ms)resolve();else requestAnimationFrame(f);}requestAnimationFrame(f);});
      const sorted=intervals.slice(2).sort((a,b)=>a-b),frames=intervals.length;
      const gl=document.querySelector('#world').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {frames,seconds:(performance.now()-start)/1000,frameP95Ms:sorted[Math.floor(sorted.length*.95)],frameMaxMs:sorted.at(-1),framesAbove50Ms:sorted.filter(x=>x>50).length,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,pixels:[gl.drawingBufferWidth,gl.drawingBufferHeight],drawCallsPerFrame:(renderWork.calls-work.calls)/frames,trianglesPerFrame:(renderWork.triangles-work.triangles)/frames,distance:Number(document.querySelector('#distance').textContent)};
    }''',milliseconds)
    after={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    data.update(label=label,fps=data['frames']/data['seconds'],cpuMsPerFrame=(after['TaskDuration']-before['TaskDuration'])*1000/data['frames'],scriptMsPerFrame=(after['ScriptDuration']-before['ScriptDuration'])*1000/data['frames'])
    print(json.dumps(data),flush=True);return data

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',args=['--mute-audio'])
        results=[];errors=[]
        try:
            page=browser.new_page(viewport={'width':1600,'height':900},device_scale_factor=1)
            page.add_init_script(instrument);page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(url,wait_until='networkidle');page.wait_for_selector('#game[data-phase="ready"]',timeout=45000);page.wait_for_timeout(1500)
            build=page.evaluate("async()=>await(await fetch('/game-version.json')).json()")
            cdp=page.context.new_cdp_session(page);cdp.send('Performance.enable')
            results.append(measure(page,cdp,'day-ready',5000))
            page.locator('#appearance').click();page.wait_for_timeout(1600);results.append(measure(page,cdp,'dusk-ready',5000))
            page.locator('#appearance').click();page.wait_for_timeout(1500);page.locator('#start').click();page.wait_for_selector('#game[data-phase="running"]',timeout=10000)
            # More than 1360 metres: terrain tiles, individual trees and the gantry recycle.
            results.append(measure(page,cdp,'continuous-bends-and-streaming',23500))
            page.evaluate('armInputAudit()')
            for _ in range(6):
                page.keyboard.down('ArrowDown');page.wait_for_timeout(120);page.keyboard.up('ArrowDown');page.wait_for_timeout(180)
            inputs=page.evaluate('inputSamples');page.keyboard.down('Space');page.wait_for_selector('#game[data-phase="broken"]',timeout=6000);page.keyboard.up('Space')
            results.append(measure(page,cdp,'crash-sequence',3300))
            page.wait_for_selector('#game[data-phase="court"]',timeout=20000);page.wait_for_timeout(7500)
            results.append(measure(page,cdp,'court',4000));page.close()
            phone=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1.5,is_mobile=True,has_touch=True)
            phone.add_init_script(instrument);phone.on('pageerror',lambda e:errors.append(str(e)))
            phone.goto(url,wait_until='networkidle');phone.wait_for_selector('#game[data-phase="ready"]',timeout=45000);phone.wait_for_timeout(1500)
            phone_cdp=phone.context.new_cdp_session(phone);phone_cdp.send('Performance.enable')
            mobile=measure(phone,phone_cdp,'mobile-viewport-emulated',5000);mobile['physicalPhone']=False
            report={'url':url,'build':build,'desktopViewport':[1600,900],'devicePixelRatio':1,'measurements':results,'input':inputs,'mobile':mobile,'errors':errors}
            (root/'artifacts'/'performance-v12.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
            assert not errors,errors
        finally:browser.close()

if __name__=='__main__':main()
