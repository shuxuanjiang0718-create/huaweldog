import json
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path(__file__).resolve().parents[1]/'artifacts'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    for name,width,height,mobile in [('desktop',1600,900,False),('mobile',390,844,True)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1.5 if mobile else 1,is_mobile=mobile,has_touch=mobile)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.goto('http://127.0.0.1:5179/',wait_until='networkidle');page.wait_for_selector('#game[data-phase="ready"]',timeout=30000)
        page.screenshot(path=str(out/f'{name}-v11-ready.png'))
        page.locator('#start').click();page.wait_for_selector('#game[data-phase="running"]')
        page.wait_for_timeout(750);page.screenshot(path=str(out/f'{name}-v11-running.png'))
        page.keyboard.down('Space');page.wait_for_function("Number(document.querySelector('#force').textContent)>1300")
        page.screenshot(path=str(out/f'{name}-v11-critical.png'))
        page.wait_for_selector('#game[data-phase="broken"]');page.keyboard.up('Space');page.wait_for_timeout(160)
        page.screenshot(path=str(out/f'{name}-v11-fracture.png'))
        page.wait_for_function("Number(document.querySelector('#game').dataset.impacts)>0");page.wait_for_timeout(100)
        page.screenshot(path=str(out/f'{name}-v11-impact.png'))
        page.wait_for_selector('#game[data-phase="wrecked"]',timeout=10000);page.wait_for_timeout(220)
        page.screenshot(path=str(out/f'{name}-v11-wreck.png'))
        page.wait_for_selector('#result:not([hidden])');page.screenshot(path=str(out/f'{name}-v11-result.png'))
        print(json.dumps({'name':name,'errors':errors,'impacts':page.locator('#game').get_attribute('data-impacts')},ensure_ascii=False),flush=True)
        page.close()
    browser.close()
