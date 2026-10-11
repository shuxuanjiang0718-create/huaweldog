"""Package the verified static build and validate every payload against its source."""
import hashlib
import json
import zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
out=root/'artifacts';out.mkdir(exist_ok=True)
version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
archive=out/f'1612-临界刹停-{version}-离线版.zip'
prefix='1612-临界刹停/'
payload={prefix+'dist/'+str(p.relative_to(root/'dist')).replace('\\','/'):p for p in sorted((root/'dist').rglob('*')) if p.is_file()}
payload[prefix+'scripts/serve.mjs']=root/'scripts'/'serve.mjs'
payload[prefix+'启动游戏.cmd']=root/'启动游戏.cmd'
instructions=f'''1612 · 临界刹停 {version}

先完整解压，再双击“启动游戏.cmd”。需要 Node.js 22 或更新版本及支持 WebGL 2 的现代浏览器。
本机已有 Node.js；游戏图片与代码全部包含在本包，运行不需要外部网络。
保留启动窗口；关闭窗口会停止服务。

电脑：空格、↓、B 或鼠标按住右下角踏板。手机：长按屏幕踏板，松开卸力。
110 km/h 起步，松开刹车会继续加速。分段制动可成功停车。
长按到 1612 N，踏板撕裂并掉落，车辆失控、撞击护栏、反弹滑行并报废。
Esc 暂停/继续。切换窗口、进入后台会自动暂停。声音默认关闭，可点音量图标打开。
超过 100 km/h 会显示建议开始刹车。点右上角“白天 / 黄昏”切换光照；画面自动适配设备。
撞毁后进入法庭：起诉方卑界、法官土不为、被告懂车皇。可点“重新测试”再来一轮。

手机与电脑连接同一 Wi-Fi 后，可访问启动窗口显示的电脑无线网卡地址。
也可以直接打开已发布的游戏网址：https://critical-stop-1612.shuxuanjiang0718.chatgpt.site

这是一款虚构娱乐游戏。1612 N 是玩法阈值，游戏参数和事故动画不是实际车辆测试结论。
'''
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for name,path in payload.items():z.write(path,name)
    z.writestr(prefix+'使用说明.txt',instructions.encode('utf-8-sig'))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(payload)+1
    for name,path in payload.items():assert hashlib.sha256(z.read(name)).digest()==hashlib.sha256(path.read_bytes()).digest(),name
report={'version':version,'archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'entries':len(payload)+1,'payload_hashes_verified':True}
(out/'package-report-v12.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
