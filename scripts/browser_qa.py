"""Production QA with page-targeted keyboard, mouse and touch input."""
import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]; output=root/'artifacts'; output.mkdir(exist_ok=True)
url=os.environ.get('GAME_QA_URL','http://127.0.0.1:5179/')
checks=[]; issues=[]; warnings=[]; build=None
def check(name,condition,detail=None):
    checks.append({'name':name,'passed':bool(condition),'detail':detail})
    print(('PASS ' if condition else 'FAIL ')+name,flush=True)
    assert condition,name
def attach(page,label):
    page.on('pageerror',lambda e:issues.append(label+': '+str(e)))
    page.on('console',lambda m:issues.append(label+': '+m.text) if m.type=='error' else warnings.append(label+': '+m.text) if m.type=='warning' else None)
    page.on('response',lambda r:issues.append(f'{label}: HTTP {r.status} {r.url}') if r.status>=400 else None)
def load(page):
    page.goto(url,wait_until='networkidle');page.wait_for_selector('#game[data-phase="ready"]',timeout=45000);page.wait_for_timeout(600)
def number(page,id):return float(page.locator('#'+id).inner_text())
def start(page,button='start'):
    page.locator('#'+button).click();page.wait_for_selector('#game[data-phase="countdown"]',timeout=2000)
    if button!='start':check('Restart clears time, distance and pressure',all(number(page,id)==0 for id in ['time','distance','force']))
    page.wait_for_selector('#game[data-phase="running"]',timeout=12000)
def frozen(page):
    page.wait_for_timeout(70)
    before=[page.locator('#'+id).inner_text() for id in ['speed','time','distance','force']];page.wait_for_timeout(450)
    return before==[page.locator('#'+id).inner_text() for id in ['speed','time','distance','force']]
def pulse_until_stopped(page,press,release):
    for _ in range(8):
        press();page.wait_for_function("document.querySelector('#game').dataset.phase==='stopped'||Number(document.querySelector('#force').textContent)>1120",timeout=4000);release()
        if page.locator('#game').get_attribute('data-phase')=='stopped':return
        page.wait_for_function("Number(document.querySelector('#force').textContent)<100",timeout=3000)
    raise AssertionError('Controlled braking did not stop the car')
def shot(page,name):page.screenshot(path=str(output/(name+'.jpg')),type='jpeg',quality=94)
def layouts(page,phase):
    for w,h in [(320,568),(360,640),(390,844),(430,932),(768,1024),(844,390),(1366,768),(1920,1080)]:
        page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
        ids=['intro','start','appearance','sound'] if phase=='ready' else ['court-title','court-restart','court-line','sound'] if phase=='court' else ['brake','pressure','appearance','sound']
        data=page.evaluate('''ids=>({overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,bounds:ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,fit:r.x>=-.5&&r.y>=-.5&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5}})})''',ids)
        check(f'{phase} layout at {w}x{h}',not data['overflow'] and all(r['fit'] for r in data['bounds']),data)
    page.set_viewport_size({'width':1600,'height':900})
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',args=['--mute-audio'])
    try:
        ctx=browser.new_context(viewport={'width':1600,'height':900},device_scale_factor=1);page=ctx.new_page();attach(page,'desktop');load(page)
        build=page.evaluate("async()=>await(await fetch('/game-version.json')).json()")
        shot(page,'desktop-v12-day');body=page.locator('body').inner_text().lower()
        check('No vehicle brand names in rendered game',not any(x in body for x in ['华为','尊界','huawei','maextro']))
        check('Intro explains the tester and court consequence','懂车皇' in body and '送上法庭' in body)
        check('HD / SD control removed',page.locator('#quality').count()==0);layouts(page,'ready')
        page.locator('#sound').click();check('Sound can be enabled',page.locator('#sound').get_attribute('aria-pressed')=='true')
        page.locator('#sound').click();check('Sound can be disabled',page.locator('#sound').get_attribute('aria-pressed')=='false')
        page.locator('#appearance').click();page.wait_for_timeout(1600)
        check('Dusk toggle changes state and text',page.locator('#game').get_attribute('data-appearance')=='dusk' and page.locator('#appearance-label').inner_text()=='黄昏');shot(page,'desktop-v12-dusk')
        page.locator('#appearance').click();page.wait_for_timeout(1400);check('Day toggle returns to daylight',page.locator('#appearance-label').inner_text()=='白天')
        start(page);page.wait_for_timeout(500);shot(page,'desktop-v12-running')
        check('Unbraked car accelerates',number(page,'speed')>110);check('Timer and distance advance',number(page,'time')>0 and number(page,'distance')>0)
        check('Above 100 shows braking advice',page.locator('#braking-advice').is_visible() and '建议开始刹车' in page.locator('#braking-advice').inner_text())
        initial=number(page,'speed');page.evaluate("window.feedback=[];window.addEventListener('keydown',e=>{if(e.code==='ArrowDown')feedback.push(document.querySelector('#brake').classList.contains('is-held'));})")
        page.keyboard.down('ArrowDown');check('Brake feedback is immediate in input handler',page.evaluate('feedback.at(-1)===true'))
        durations=page.locator('.pedal-pad').evaluate('el=>getComputedStyle(el).transitionDuration')
        check('Pedal press has no CSS animation delay',all(float(x.strip().removesuffix('s'))==0 for x in durations.split(',')))
        page.wait_for_function("Number(document.querySelector('#force').textContent)>650");check('Keyboard braking slows the car',number(page,'speed')<initial)
        page.wait_for_function("Number(document.querySelector('#speed').textContent)<99",timeout=1800)
        check('Advice hides at or below 100',number(page,'speed')<=100 and page.locator('#braking-advice').is_hidden())
        force=number(page,'force');page.keyboard.up('ArrowDown');page.wait_for_timeout(400);check('Key release unloads pressure',number(page,'force')<force-400)
        r=page.locator('#brake').bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.wait_for_timeout(200)
        force=number(page,'force');page.mouse.move(40,60);page.wait_for_timeout(300);check('Pointer capture holds brake outside button',number(page,'force')>force+100)
        page.mouse.up();page.wait_for_timeout(350);check('Outside release clears brake',not page.locator('#brake').evaluate("el=>el.classList.contains('is-held')"))
        page.keyboard.down('KeyB');page.wait_for_timeout(150);page.keyboard.press('Escape');page.keyboard.up('KeyB')
        check('Escape pauses and freezes physics',page.locator('#pause').is_visible() and frozen(page));page.locator('#resume').click()
        check('Resume clears stale input',not page.locator('#brake').evaluate("el=>el.classList.contains('is-held')"))
        page.evaluate("window.dispatchEvent(new Event('blur'))");check('Window blur automatically pauses',page.locator('#pause').is_visible() and frozen(page));page.locator('#resume').click()
        layouts(page,'running')
        page.keyboard.down('Space');page.wait_for_selector('#game[data-phase="broken"]',timeout=6000);page.keyboard.up('Space');broken_at=time.monotonic()
        check('Long press fractures at exactly 1612 N',number(page,'force')==1612 and page.locator('#brake').is_disabled())
        page.wait_for_function("Number(document.querySelector('#game').dataset.impacts)>0",timeout=2000);delay=time.monotonic()-broken_at
        check('Fracture rapidly reaches a guardrail',delay<.8,{'seconds_after_observing_fracture':round(delay,3)});shot(page,'desktop-v12-collision')
        page.keyboard.press('Escape');check('Crash can pause safely',page.locator('#pause').is_visible() and frozen(page));page.locator('#resume').click()
        check('Crash resume keeps brake disabled',page.locator('#brake').is_disabled());page.wait_for_selector('#game[data-phase="wrecked"]',timeout=12000)
        check('Collision leaves a stationary wreck',number(page,'speed')==0 and int(page.locator('#game').get_attribute('data-impacts'))>=1)
        page.wait_for_timeout(550);shot(page,'desktop-v12-wreck');page.wait_for_selector('#game[data-phase="court"]',timeout=5000);page.wait_for_timeout(1000);shot(page,'desktop-v12-court')
        check('Court title is 法庭',page.locator('#court-title').inner_text()=='法庭' and '模拟法庭' not in page.locator('body').inner_text())
        check('Court has all requested roles',all(x in page.locator('#court').inner_text() for x in ['卑界','土不为','懂车皇']))
        page.wait_for_function("document.querySelector('#court-line').textContent==='你这是恶意刹车！'",timeout=7000);page.wait_for_timeout(450);shot(page,'desktop-v12-charge')
        check('Plaintiff speaks the exact accusation',page.locator('#court-line').inner_text()=='你这是恶意刹车！')
        page.keyboard.press('Escape');check('Court pauses on Escape',page.locator('#pause').is_visible());page.locator('#resume').click()
        check('Court status remains correct after resume','法庭' in page.locator('#system-status').inner_text());layouts(page,'court')
        start(page,'court-restart');check('Restart restores an intact pedal',not page.locator('#brake').evaluate("el=>el.classList.contains('is-broken')"))
        pulse_until_stopped(page,lambda:page.keyboard.down('Space'),lambda:page.keyboard.up('Space'));check('Controlled keyboard braking wins',number(page,'speed')==0 and number(page,'force')<1612)
        page.wait_for_selector('#result:not([hidden])',timeout=4000);check('Success freezes the stopped car',page.locator('#result').evaluate("el=>el.classList.contains('is-win')") and frozen(page));shot(page,'desktop-v12-success');ctx.close()
        ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1.5,is_mobile=True,has_touch=True);page=ctx.new_page();attach(page,'touch');load(page);shot(page,'mobile-v12-ready')
        touch=ctx.new_cdp_session(page)
        def press_touch():
            r=page.locator('#brake').bounding_box();touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':r['x']+r['width']/2,'y':r['y']+r['height']/2}]})
        def release_touch():touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        page.locator('#appearance').tap();page.wait_for_timeout(1500);shot(page,'mobile-v12-dusk');start(page);page.wait_for_timeout(450);shot(page,'mobile-v12-running')
        check('Touch pedal has a large target',page.locator('#brake').bounding_box()['width']>=100)
        check('1612 N text is readable on phones',page.locator('.critical-line>span').evaluate('el=>parseFloat(getComputedStyle(el).fontSize)>=16'))
        page.evaluate("window.touchFeedback=[];document.querySelector('#brake').addEventListener('pointerdown',()=>touchFeedback.push(document.querySelector('#brake').classList.contains('is-held')))")
        press_touch();page.wait_for_function("Number(document.querySelector('#force').textContent)>600");check('Touch feedback is immediate',page.evaluate('touchFeedback.at(-1)===true'))
        force=number(page,'force');release_touch();page.wait_for_timeout(400);check('Touch release unloads pressure',number(page,'force')<force-400)
        press_touch();page.wait_for_selector('#game[data-phase="broken"]',timeout=6000);release_touch();check('Touch also fractures at 1612 N',number(page,'force')==1612)
        page.wait_for_selector('#game[data-phase="wrecked"]',timeout=12000);page.wait_for_timeout(550);shot(page,'mobile-v12-wreck');check('Phone crash collides and stops',number(page,'speed')==0 and int(page.locator('#game').get_attribute('data-impacts'))>=1)
        page.wait_for_selector('#game[data-phase="court"]',timeout=5000);page.wait_for_timeout(1000);shot(page,'mobile-v12-court')
        page.wait_for_function("document.querySelector('#court-line').textContent==='你这是恶意刹车！'",timeout=7000);page.wait_for_timeout(450);shot(page,'mobile-v12-charge')
        check('Phone reaches the same court accusation',page.locator('#court-line').inner_text()=='你这是恶意刹车！')
        start(page,'court-restart');pulse_until_stopped(page,press_touch,release_touch);page.wait_for_selector('#result:not([hidden])',timeout=4000)
        check('Controlled touch braking can win',number(page,'speed')==0 and frozen(page));shot(page,'mobile-v12-success');ctx.close()
        check('No JavaScript errors or failed requests',not issues,issues)
    finally:
        report={'url':url,'build':build,'checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks),'errors':issues,'warnings':warnings}
        (output/'browser-report-v12.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
        print(json.dumps({'passed':report['passed'],'total':report['total'],'errors':issues},ensure_ascii=False),flush=True)
