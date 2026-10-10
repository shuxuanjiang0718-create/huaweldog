import json
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    page=browser.new_page(viewport={"width":1600,"height":900})
    page.goto('http://127.0.0.1:5178',wait_until='networkidle')
    page.wait_for_selector('#game[data-phase="ready"]')
    cdp=page.context.new_cdp_session(page);cdp.send('Performance.enable')
    results=[]
    for mode in ['auto','high','low']:
        if mode!='auto':page.locator('#quality').click()
        page.wait_for_timeout(350)
        before={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
        timing=page.evaluate('''async()=>{let start=performance.now(),frames=0;await new Promise(resolve=>{function f(){frames++;if(performance.now()-start>=2400)resolve();else requestAnimationFrame(f)}requestAnimationFrame(f)});let gl=document.querySelector('canvas').getContext('webgl2');let ext=gl.getExtension('WEBGL_debug_renderer_info');return {frames,elapsed:(performance.now()-start)/1000,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,pixels:[gl.drawingBufferWidth,gl.drawingBufferHeight]}}''')
        after={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
        timing.update(mode=mode,fps=timing['frames']/timing['elapsed'],cpu_ms_per_frame=(after['TaskDuration']-before['TaskDuration'])*1000/timing['frames'],script_ms_per_frame=(after['ScriptDuration']-before['ScriptDuration'])*1000/timing['frames'])
        results.append(timing)
    root.joinpath('artifacts','performance.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(results,indent=2));browser.close()
