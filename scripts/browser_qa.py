"""Interact with the built game through real keyboard, mouse, and touch input."""
import json
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
output=root/'artifacts'
output.mkdir(exist_ok=True)
url=os.environ.get('GAME_QA_URL','http://127.0.0.1:5179/')
checks=[]
issues=[]
warnings=[]

def check(name,condition,detail=None):
    checks.append({'name':name,'passed':bool(condition),'detail':detail})
    print(('PASS ' if condition else 'FAIL ')+name,flush=True)
    assert condition,name

def attach(page,prefix):
    page.on('pageerror',lambda e:issues.append(prefix+': '+str(e)))
    page.on('console',lambda m:issues.append(prefix+': '+m.text) if m.type=='error' else warnings.append(prefix+': '+m.text) if m.type=='warning' else None)
    page.on('response',lambda r:issues.append(f'{prefix}: HTTP {r.status} {r.url}') if r.status>=400 else None)

def load(page):
    page.goto(url,wait_until='networkidle')
    page.wait_for_selector('#game[data-phase="ready"]',timeout=30000)
    page.wait_for_timeout(600)

def start(page,retry=False):
    page.locator('#restart' if retry else '#start').click()
    page.wait_for_selector('#game[data-phase="countdown"]',timeout=2000)
    if retry:
        values={id:number(page,id) for id in ['time','distance','force']}
        check('Retry resets distance, time and force before countdown ends',all(value==0 for value in values.values()),values)
    page.wait_for_selector('#game[data-phase="running"]',timeout=12000)

def number(page,id):
    return float(page.locator('#'+id).inner_text())

def frozen(page):
    before=[page.locator('#'+id).inner_text() for id in ['speed','time','distance','force']]
    page.wait_for_timeout(500)
    after=[page.locator('#'+id).inner_text() for id in ['speed','time','distance','force']]
    return before==after

def pulse_until_stopped(page,press,release):
    for _ in range(8):
        press()
        page.wait_for_function("document.querySelector('#game').dataset.phase==='stopped'||Number(document.querySelector('#force').textContent)>1120",timeout=4000)
        release()
        if page.locator('#game').get_attribute('data-phase')=='stopped':return
        page.wait_for_function("Number(document.querySelector('#force').textContent)<100",timeout=3000)
    raise AssertionError('Controlled braking did not stop the car')

def fit(page):
    return page.evaluate('''()=>{
      let ids=document.querySelector('#game').dataset.phase==='ready'?['start','quality','sound']:['brake','pressure','quality','sound'];
      return {overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,
       bounds:ids.map(id=>{let r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,fit:r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5}})};
    }''')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    try:
        context=browser.new_context(viewport={'width':1600,'height':900},device_scale_factor=1)
        page=context.new_page();attach(page,'desktop');load(page)
        page.screenshot(path=str(output/'desktop-ready.png'))
        check('No brand names in the rendered game',not any(x in page.locator('body').inner_text().lower() for x in ['华为','尊界','huawei','maextro']))
        check('Desktop interface stays within the viewport',all(x['fit'] for x in fit(page)['bounds']) and not fit(page)['overflow'])
        page.locator('#sound').click()
        check('Sound can be enabled',page.locator('#sound').get_attribute('aria-pressed')=='true')
        page.locator('#sound').click()
        check('Sound can be disabled',page.locator('#sound').get_attribute('aria-pressed')=='false')
        page.locator('#quality').click()
        check('High quality mode is selectable','高清' in page.locator('#quality').get_attribute('title'))
        page.locator('#quality').click();page.locator('#quality').click()
        check('Automatic quality can be restored','自动' in page.locator('#quality').get_attribute('title'))
        start(page);page.wait_for_timeout(600)
        check('Car accelerates when no brake is pressed',number(page,'speed')>110)
        check('Distance and timer advance',number(page,'distance')>0 and number(page,'time')>0)
        page.screenshot(path=str(output/'desktop-running.png'))
        initial_speed=number(page,'speed')
        page.evaluate("window.feedback=[];window.addEventListener('keydown',e=>{if(e.code==='ArrowDown')feedback.push(document.querySelector('#brake').classList.contains('is-held'));})")
        page.keyboard.down('ArrowDown')
        check('Brake feedback is immediate in the keyboard event',page.evaluate('feedback.at(-1)===true'))
        durations=page.locator('.pedal-pad').evaluate("el=>getComputedStyle(el).transitionDuration")
        check('Pedal press has no CSS transition delay',all(float(x.strip().removesuffix('s'))==0 for x in durations.split(',')),durations)
        page.wait_for_function("Number(document.querySelector('#force').textContent)>650")
        check('Keyboard braking reduces speed',number(page,'speed')<initial_speed)
        before=number(page,'force');page.keyboard.up('ArrowDown');page.wait_for_timeout(400)
        check('Releasing the key unloads the pedal',number(page,'force')<before-400)

        brake=page.locator('#brake').bounding_box();page.mouse.move(brake['x']+brake['width']/2,brake['y']+brake['height']/2)
        page.mouse.down();page.wait_for_timeout(280)
        held_force=number(page,'force');page.mouse.move(40,60);page.wait_for_timeout(350)
        check('Pointer capture retains braking outside the button',number(page,'force')>held_force+100)
        page.mouse.up();page.wait_for_timeout(400)
        check('Releasing outside the button clears the brake',not page.locator('#brake').evaluate("el=>el.classList.contains('is-held')"))

        page.keyboard.down('KeyB');page.wait_for_timeout(200);page.keyboard.press('Escape');page.keyboard.up('KeyB')
        check('Escape pauses the challenge',page.locator('#pause').is_visible() and frozen(page))
        page.locator('#resume').click();page.wait_for_timeout(120)
        check('Resume clears stale input',not page.locator('#brake').evaluate("el=>el.classList.contains('is-held')"))
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        check('Window blur automatically pauses',page.locator('#pause').is_visible() and frozen(page))
        page.locator('#resume').click()
        page.locator('#sound').click()
        check('Collision audio can run after a user gesture',page.locator('#sound').get_attribute('aria-pressed')=='true')
        page.keyboard.down('Space')
        page.wait_for_selector('#game[data-phase="broken"]',timeout=6000);page.keyboard.up('Space')
        check('Long press fails at exactly 1612 N',number(page,'force')==1612 and number(page,'speed')>0)
        check('Broken brake disables input while the crash continues',page.locator('#brake').is_disabled() and not page.locator('#result').is_visible() and not frozen(page))
        page.keyboard.press('Space')
        check('Space cannot reset an ongoing crash',page.locator('#game').get_attribute('data-phase')=='broken')
        page.keyboard.press('Escape')
        check('A crash pauses safely on Escape',page.locator('#pause').is_visible() and frozen(page))
        page.locator('#resume').click()
        check('Resuming a crash keeps the failed brake disabled',page.locator('#brake').is_disabled())
        page.screenshot(path=str(output/'desktop-pedal-broken.png'))
        page.wait_for_function("Number(document.querySelector('#game').dataset.impacts)>0",timeout=8000)
        check('A broken car actually collides with the guardrail',int(page.locator('#game').get_attribute('data-impacts'))>=1)
        page.screenshot(path=str(output/'desktop-collision.png'))
        page.wait_for_selector('#game[data-phase="wrecked"]',timeout=10000)
        check('Collision ends with a stationary wreck',number(page,'speed')==0 and number(page,'force')==1612)
        page.wait_for_timeout(160);page.screenshot(path=str(output/'desktop-v11-wreck.png'))
        page.wait_for_selector('#result:not([hidden])',timeout=5000)
        check('Failure shows the broken pedal and retry',page.locator('#brake').evaluate("el=>el.classList.contains('is-broken')") and page.locator('#restart').is_visible())
        check('Failed challenge freezes its telemetry',frozen(page))
        check('Failure explicitly reports vehicle destruction','报废' in page.locator('#result-title').inner_text())
        page.screenshot(path=str(output/'desktop-failure.png'))
        start(page,True)
        pulse_until_stopped(page,lambda:page.keyboard.down('Space'),lambda:page.keyboard.up('Space'))
        check('Controlled keyboard braking wins at zero speed',number(page,'speed')==0 and number(page,'force')<1612)
        page.wait_for_selector('#result:not([hidden])',timeout=3000)
        check('Winning shows the success result',page.locator('#result').evaluate("el=>el.classList.contains('is-win')"))
        check('Stopped car stays stopped',frozen(page))
        page.screenshot(path=str(output/'desktop-success.png'))
        context.close()

        mobile_context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1.5,is_mobile=True,has_touch=True)
        mobile=mobile_context.new_page();attach(mobile,'mobile');load(mobile)
        mobile.screenshot(path=str(output/'mobile-ready.png'))
        touch=mobile_context.new_cdp_session(mobile)
        def press_touch():
            r=mobile.locator('#brake').bounding_box()
            touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':r['x']+r['width']/2,'y':r['y']+r['height']/2}]})
        def release_touch():touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        start(mobile);mobile.wait_for_timeout(500)
        mobile.screenshot(path=str(output/'mobile-running.png'))
        check('Mobile controls fit and have touch targets',all(x['fit'] for x in fit(mobile)['bounds']) and mobile.locator('#brake').bounding_box()['width']>=100)
        check('1612 N threshold is readable on the phone',mobile.locator('.critical-line>span').evaluate("el=>parseFloat(getComputedStyle(el).fontSize)>=16"))
        mobile.evaluate("window.touchFeedback=[];document.querySelector('#brake').addEventListener('pointerdown',()=>touchFeedback.push(document.querySelector('#brake').classList.contains('is-held')))")
        press_touch();mobile.wait_for_function("Number(document.querySelector('#force').textContent)>600")
        check('Real touch input depresses the brake',mobile.locator('#brake').evaluate("el=>el.classList.contains('is-held')"))
        check('Touch feedback is immediate in the pointer handler',mobile.evaluate('touchFeedback.at(-1)===true'))
        force=number(mobile,'force');release_touch();mobile.wait_for_timeout(400)
        check('Touch release unloads the pedal',number(mobile,'force')<force-400)
        press_touch();mobile.wait_for_selector('#game[data-phase="broken"]',timeout=6000);release_touch()
        check('Touch long press breaks at the same threshold',number(mobile,'force')==1612)
        mobile.wait_for_selector('#game[data-phase="wrecked"]',timeout=12000)
        check('Phone crash collides and ends in a wreck',number(mobile,'speed')==0 and int(mobile.locator('#game').get_attribute('data-impacts'))>=1)
        mobile.wait_for_timeout(160);mobile.screenshot(path=str(output/'mobile-v11-wreck.png'))
        mobile.wait_for_selector('#result:not([hidden])',timeout=5000);mobile.screenshot(path=str(output/'mobile-failure.png'))
        start(mobile,True);pulse_until_stopped(mobile,press_touch,release_touch)
        check('Controlled touch braking can win',number(mobile,'speed')==0)
        mobile.wait_for_selector('#result:not([hidden])',timeout=3000);mobile.screenshot(path=str(output/'mobile-success.png'))
        check('Phone success also freezes the game',frozen(mobile))
        mobile_context.close()

        layout_context=browser.new_context(viewport={'width':1366,'height':768})
        layout=layout_context.new_page();attach(layout,'layouts');load(layout)
        for width,height in [(320,568),(360,640),(390,844),(430,932),(768,1024),(844,390),(1366,768),(1920,1080)]:
            layout.set_viewport_size({'width':width,'height':height});layout.wait_for_timeout(170)
            data=fit(layout);check(f'Responsive start controls at {width}x{height}',not data['overflow'] and all(x['fit'] for x in data['bounds']),data)
        layout.set_viewport_size({'width':390,'height':844});start(layout)
        for width,height in [(320,568),(360,640),(390,844),(430,932),(768,1024),(844,390),(1366,768),(1920,1080)]:
            layout.set_viewport_size({'width':width,'height':height});layout.wait_for_timeout(170)
            data=fit(layout);check(f'Responsive driving controls at {width}x{height}',not data['overflow'] and all(x['fit'] for x in data['bounds']),data)
        layout_context.close()
        check('No runtime errors or failed requests',not issues,issues)
    finally:
        report={'url':url,'checked_build':True,'checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks),'errors':issues,'warnings':warnings}
        (output/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        browser.close()
        print(json.dumps({'passed':report['passed'],'total':report['total'],'errors':issues},ensure_ascii=False),flush=True)
