import json
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
output=root/'artifacts'
output.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    page=browser.new_page(viewport={"width":1600,"height":900},device_scale_factor=1)
    issues=[]
    page.on('pageerror',lambda e:issues.append(str(e)))
    page.on('console',lambda m:issues.append(m.type+': '+m.text) if m.type in ['error','warning'] else None)
    page.goto('http://127.0.0.1:5178',wait_until='networkidle')
    page.wait_for_selector('#game[data-phase="ready"]',timeout=30000)
    page.wait_for_timeout(1200)
    page.screenshot(path=str(output/'desktop-ready.png'))
    performance=page.evaluate('''async()=>{
      let start=performance.now(),frames=0;
      await new Promise(resolve=>{function count(){frames++;if(performance.now()-start>2000)resolve();else requestAnimationFrame(count)}requestAnimationFrame(count)});
      return {fps:frames/((performance.now()-start)/1000),gpu:document.querySelector('canvas').getContext('webgl2')?.getParameter(7937),
        overflow:document.documentElement.scrollWidth>innerWidth};
    }''')
    page.locator('#start').click()
    page.wait_for_selector('#game[data-phase="running"]',timeout=10000)
    page.wait_for_timeout(300)
    page.screenshot(path=str(output/'desktop-running.png'))
    page.keyboard.press('Escape')
    phone=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1.5,is_mobile=True,has_touch=True)
    mobile=phone.new_page()
    mobile.on('pageerror',lambda e:issues.append('mobile: '+str(e)))
    mobile.goto('http://127.0.0.1:5178',wait_until='networkidle')
    mobile.wait_for_selector('#game[data-phase="ready"]',timeout=30000)
    mobile.wait_for_timeout(700)
    mobile.screenshot(path=str(output/'mobile-ready.png'))
    mobile.locator('#start').tap()
    mobile.wait_for_selector('#game[data-phase="running"]',timeout=12000)
    mobile.screenshot(path=str(output/'mobile-running.png'))
    mobile.keyboard.press('Escape')
    result={"issues":issues,"performance":performance}
    (output/'inspection.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    browser.close()
