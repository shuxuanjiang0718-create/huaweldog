# 1612 · 临界刹停 1.2

电脑和手机可玩的实时 3D 高速公路刹车挑战。使用 Three.js / WebGL 2 渲染；Windows 版使用 Electron。车辆、道路、事故和法庭均为实时场景，没有车辆品牌名称或徽标。

## 开始玩

Windows 可直接双击 `release/1612-Critical-Stop-1.2.0-Windows-x64.exe`，不需要安装 Node.js、启动开发服务或登录网页账号。便携 EXE 带有完整游戏和运行环境，可以离线运行；首次启动会解压运行组件，等待数秒即可。

也可以双击 **启动游戏.cmd** 用浏览器打开本地构建。这种启动方式需要 Node.js 22 或更新版本；保留启动窗口，关闭窗口会停止本地服务。手机与电脑在同一 Wi-Fi 时，可访问启动窗口显示的电脑无线网卡地址。已发布的网址保持原有的个人账号访问范围。

你是 **懂车皇**，受邀测试车辆刹车。车从 110 km/h 起步，松开制动会继续加速，超过 100 km/h 显示“建议开始刹车”。电脑按住 **空格、↓ 或 B**，也可以用鼠标按住踏板；手机长按右下角踏板。松开卸力，再按下减速，分段制动可以停车。

踏板力度达到 **1612 N** 时，踏板断裂，车辆迅速偏航撞向护栏，反弹滑行并报废。镜头展示车身损伤后进入 **法庭**：起诉方 **卑界**、法官 **土不为**、被告 **懂车皇**。起诉方台词为“你这是恶意刹车！”。点“重新测试”可重新开始；成功刹停则停在成功画面。

右上角按钮切换 **白天 / 黄昏**。声音默认关闭，可点音量按钮开启；电脑 **Esc** 暂停/继续，切换窗口或进入后台自动暂停。没有 HD / SD 切换按钮，画面根据实际帧耗时自动适配高 DPI 设备。

## EXE 与源码联动

本机联动目录记录在 `desktop/workspace.json`，目前是 `D:\Lenovo\V800`。EXE 启动后会检查这个项目，并监听游戏源码、资源和构建配置。保存修改后，在后台生成新的游戏版本；开始画面可自动载入，正在进行的挑战会等本轮结束再更新。构建出错时继续使用已成功的版本。

游戏构建缓存在应用数据目录，原始 EXE 中始终保留一份离线游戏。带到没有这个项目的电脑上会读取缓存或内置版本。复制 EXE 本身不会把后续的本机修改同步到其他电脑；要带走修改后的内容，应重新运行 `npm run desktop:dist` 生成最新便携包。

`npm run dev` 启动 Vite 开发服务，通过浏览器运行 JavaScript 游戏，保存文件可热更新。EXE 使用同一套游戏代码的生产构建，另加 `desktop/main.cjs` 窗口与更新逻辑、`desktop/preload.cjs` 受限通信桥、Electron 运行环境。它不是另一套原生 3D 引擎，也不会绕过 GPU 或屏幕刷新率的限制。

解包目录 `release/win-unpacked` 中的 DLL 是运行环境的图形、音视频和系统接口等组件。需要完整保留该目录；便携 EXE 会把这些组件打包进去，运行时自动解压。修改游戏内容可本机联动；修改桌面窗口逻辑、Electron 版本或原生组件需要重新打包 EXE。

## 开发与验证

```powershell
npm install
npm run dev
npm test
npm run build
npm run desktop:run
npm run desktop:dist
```

生产版浏览器测试可先启动 `node scripts/serve.mjs --port 5179`，然后运行 `python scripts/browser_qa.py`。顺序运行 `python scripts/profile_release.py` 测量帧率，避免其他构建或 GPU 测试同时运行。`scripts/desktop_qa.py` 检查使用专用参数启动的隐藏成品 EXE，包括离线完整流程与隔离副本的源码更新；测试不向用户正在使用的窗口发送全局输入。实际结果和已知限制见 [验证记录](docs/verification.md)。

主要文件：`src/simulation.js` 管理固定步长规则和事故；`src/track.js` 管理连续弯道与分块地形；`src/atmosphere.js` 管理太阳、天空、白天和暖色黄昏；`src/scene.js` 管理公路场景与镜头；`src/vehicle.js` 管理车辆和局部碰撞变形；`src/courtroom.js` 管理法庭；`src/main.js` 连接输入和流程；`src/interface.css` 管理界面。

事故是为玩法编写的有限碰撞与变形模型，法庭人物为程序化模型。1612 N 是指定玩法阈值，游戏不提供真实车辆的技术测试结论。

## 素材与技能

车辆、公路设施、地形、法庭建筑、人物、路面修补纹理和音效由代码创建。真实 PBR 贴图来自 Poly Haven 的 [Asphalt 02](https://polyhaven.com/a/asphalt_02)、[Rocky Terrain](https://polyhaven.com/a/rocky_terrain)、[Wood Table 001](https://polyhaven.com/a/wood_table_001)，天空资源来自 [Kloofendal 48d Partly Cloudy](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)，均为 CC0。素材随构建包含，不依赖运行时 CDN；下载地址、字节数和 SHA-256 见 `public/assets/sources.json`。

本次使用已安装的 performance-optimization、game-architect、game-ui-ux、game-playtest 和 Sites 工作流，没有新增第三方技能。技能查找与审查记录见 [技能记录](docs/skills.md)。
