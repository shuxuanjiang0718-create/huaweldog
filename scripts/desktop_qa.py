"""Interact with an already-launched hidden, packaged EXE through its own CDP target."""
import json, os, time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'artifacts';out.mkdir(exist_ok=True)
mode=os.environ.get('DESKTOP_QA_MODE','offline');port=os.environ.get('DESKTOP_QA_PORT','9356')
checks=[];errors=[];warnings=[]
def check(name,condition,detail=None):
    checks.append({'name':name,'passed':bool(condition),'detail':detail});print(('PASS ' if condition else 'FAIL ')+name,flush=True);assert condition,name
def manifest(page):return page.evaluate("async()=>await(await fetch('/game-version.json')).json()")
def wait_ready(page):page.wait_for_selector('#game[data-phase="ready"]',timeout=60000)
def start(page,id='start'):
    page.locator('#'+id).click();page.wait_for_selector('#game[data-phase="running"]',timeout=15000)
def win(page):
    for _ in range(8):
        page.keyboard.down('Space');page.wait_for_function("document.querySelector('#game').dataset.phase==='stopped'||Number(document.querySelector('#force').textContent)>1120",timeout=4000);page.keyboard.up('Space')
        if page.locator('#game').get_attribute('data-phase')=='stopped':break
        page.wait_for_function("Number(document.querySelector('#force').textContent)<100",timeout=4000)
    page.wait_for_selector('#result:not([hidden])',timeout=4000)
def shot(page,name):page.screenshot(path=str(out/(name+'.jpg')),type='jpeg',quality=94)
with sync_playwright() as p:
    # Bypass machine HTTP proxies for our dedicated local debugging endpoint.
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}));deadline=time.monotonic()+45
    while True:
        try:
            with opener.open('http://127.0.0.1:'+port+'/json/version',timeout=3) as response:endpoint=json.load(response)['webSocketDebuggerUrl']
            break
        except Exception:
            if time.monotonic()>deadline:raise
            time.sleep(.2)
    browser=p.chromium.connect_over_cdp(endpoint,timeout=45000)
    page=next(page for context in browser.contexts for page in context.pages if page.url.startswith('game://local/'))
    focus=page.context.new_cdp_session(page)
    focus.send('Emulation.setFocusEmulationEnabled',{'enabled':True})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else warnings.append(m.text) if m.type=='warning' else None)
    page.on('response',lambda r:errors.append(f'HTTP {r.status} {r.url}') if r.status>=400 else None)
    initial=None;fps=None;sync_result=None
    try:
        wait_ready(page);initial=manifest(page)
        check('Packaged application uses its own local game protocol',page.url=='game://local/index.html')
        check('Only the limited update bridge is exposed',page.evaluate("typeof window.require==='undefined'&&typeof window.process==='undefined'&&typeof window.desktopGame?.applyUpdate==='function'"))
        check('Production debug state is absent',page.evaluate("typeof window.__highway==='undefined'"))
        if mode=='offline':
            expected=json.loads((root/'dist'/'game-version.json').read_text())
            check('Offline EXE matches the current built game',initial['sourceHash']==expected['sourceHash'],initial)
            cdp=page.context.new_cdp_session(page);cdp.send('Network.enable');cdp.send('Network.emulateNetworkConditions',{'offline':True,'latency':0,'downloadThroughput':0,'uploadThroughput':0})
            page.reload();wait_ready(page)
            check('Bundled game loads with network completely offline',manifest(page)['sourceHash']==expected['sourceHash'])
            shot(page,'exe-v12-day');page.locator('#appearance').click();page.wait_for_timeout(1500);shot(page,'exe-v12-dusk')
            check('Day / dusk toggles in EXE',page.locator('#appearance-label').inner_text()=='黄昏')
            page.locator('#appearance').click();start(page);page.wait_for_timeout(300)
            check('EXE shows advice above 100',page.locator('#braking-advice').is_visible())
            page.evaluate("window.feedback=[];window.addEventListener('keydown',e=>{if(e.code==='ArrowDown')feedback.push(document.querySelector('#brake').classList.contains('is-held'));})")
            page.keyboard.down('ArrowDown');check('Native game input has immediate brake feedback',page.evaluate('feedback.at(-1)===true'));page.wait_for_timeout(250);page.keyboard.up('ArrowDown')
            page.keyboard.press('Escape');check('Native Escape pauses',page.locator('#pause').is_visible());page.locator('#resume').click()
            fps=page.evaluate('''async()=>{let frames=0,start=performance.now(),last=start,intervals=[];await new Promise(r=>{function f(t){frames++;intervals.push(t-last);last=t;performance.now()-start>3500?r():requestAnimationFrame(f)}requestAnimationFrame(f)});let gl=document.querySelector('#world').getContext('webgl2');return {fps:frames/((performance.now()-start)/1000),frameP95Ms:intervals.slice(2).sort((a,b)=>a-b)[Math.floor((intervals.length-2)*.95)],pixels:[gl.drawingBufferWidth,gl.drawingBufferHeight]}}''')
            shot(page,'exe-v12-running');page.keyboard.down('Space');page.wait_for_selector('#game[data-phase="broken"]',timeout=6000);page.keyboard.up('Space')
            check('Native long press breaks at 1612 N',page.locator('#force').inner_text()=='1612')
            page.wait_for_function("Number(document.querySelector('#game').dataset.impacts)>0",timeout=1500)
            check('Native crash collides with guardrail',int(page.locator('#game').get_attribute('data-impacts'))>=1)
            page.wait_for_selector('#game[data-phase="wrecked"]',timeout=20000);page.wait_for_timeout(600);shot(page,'exe-v12-wreck')
            page.wait_for_selector('#game[data-phase="court"]',timeout=7000);page.wait_for_timeout(1000);shot(page,'exe-v12-court')
            check('Native court has the requested title and characters',page.locator('#court-title').inner_text()=='法庭' and all(x in page.locator('#court').inner_text() for x in ['卑界','土不为','懂车皇']))
            page.wait_for_function("document.querySelector('#court-line').textContent==='你这是恶意刹车！'",timeout=7000);page.wait_for_timeout(400);shot(page,'exe-v12-charge')
            check('Native plaintiff speaks the requested line',page.locator('#court-line').inner_text()=='你这是恶意刹车！')
            start(page,'court-restart');win(page)
            check('Native controlled braking wins',page.locator('#speed').inner_text()=='0' and page.locator('#result').evaluate("el=>el.classList.contains('is-win')"));shot(page,'exe-v12-success')
        else:
            workspace=Path(os.environ['DESKTOP_QA_WORKSPACE']);source=workspace/'index.html';original=source.read_bytes().decode('utf-8')
            source.write_bytes(original.replace('刹停它<span>','联动成功<span>').encode('utf-8'))
            page.wait_for_function("document.querySelector('#intro-title').textContent.includes('联动成功')",timeout=60000);wait_ready(page)
            first=manifest(page);check('Saving source refreshes the linked EXE',first['sourceHash']!=initial['sourceHash']);shot(page,'exe-v12-sync-ready')
            start(page);source.write_bytes(original.replace('刹停它<span>','本轮更新<span>').encode('utf-8'))
            page.wait_for_selector('#desktop-sync:not([hidden])',timeout=60000)
            check('Updates wait until the active round ends',page.locator('#game').get_attribute('data-phase')=='running' and manifest(page)['sourceHash']==first['sourceHash'])
            # Pause while using the normal restart-independent inputs to finish this round.
            page.keyboard.down('Space');page.wait_for_selector('#game[data-phase="broken"]',timeout=6000);page.keyboard.up('Space')
            page.wait_for_selector('#game[data-phase="court"]',timeout=25000)
            page.wait_for_function("document.querySelector('#intro-title').textContent.includes('本轮更新')",timeout=30000);wait_ready(page)
            second=manifest(page);check('Queued update applies after the court scene',second['sourceHash']!=first['sourceHash'])
            broken=workspace/'src'/'main.js';good=broken.read_bytes().decode('utf-8');log=Path(os.environ['DESKTOP_QA_DATA'])/'sync-build.log'
            broken.write_bytes((good+'\nconst invalidSyntax = ;\n').encode('utf-8'))
            deadline=time.monotonic()+45
            while time.monotonic()<deadline:
                page.wait_for_timeout(200)
                if log.exists() and 'Build failed' in log.read_text(encoding='utf-8',errors='replace'):break
            check('Failed rebuild preserves the working version',log.exists() and 'Build failed' in log.read_text(encoding='utf-8',errors='replace') and manifest(page)['sourceHash']==second['sourceHash'] and page.locator('#game').get_attribute('data-phase')=='ready')
            broken.write_bytes(good.encode('utf-8'));source.write_bytes(original.replace('刹停它<span>','恢复成功<span>').encode('utf-8'))
            page.wait_for_function("document.querySelector('#intro-title').textContent.includes('恢复成功')",timeout=60000);wait_ready(page)
            check('Sync recovers after fixing the source',manifest(page)['sourceHash']!=second['sourceHash']);shot(page,'exe-v12-sync-recovered')
            source.write_bytes(original.encode('utf-8'));page.wait_for_function("document.querySelector('#intro-title').textContent.includes('刹停它')",timeout=60000);wait_ready(page)
            sync_result={'initial':initial['sourceHash'],'first':first['sourceHash'],'second':second['sourceHash'],'restored':manifest(page)['sourceHash']}
            check('Isolated source is restored and EXE updates again',sync_result['restored']==initial['sourceHash'])
        check('No native renderer errors or failed requests',not errors,errors)
    finally:
        report={'mode':mode,'renderingMode':'offscreen GPU rendering with bitmap output and virtual focus','build':initial,'performance':fps,'sync':sync_result,'checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks),'errors':errors,'warnings':warnings,'diagnostics':page.evaluate("({phase:document.querySelector('#game').dataset.phase,pauseVisible:!document.querySelector('#pause').hidden,visibility:document.visibilityState,focused:document.hasFocus()})")}
        (out/('desktop-'+mode+'-report-v12.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'passed':report['passed'],'total':report['total'],'performance':fps,'errors':errors},ensure_ascii=False),flush=True)
        # This is the dedicated hidden EXE target, never a user's active browser/window.
        try:page.close()
        except Exception:pass
