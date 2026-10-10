# 1612 · 临界刹停

一个支持电脑和手机的实时 3D 高速公路刹停挑战。没有车辆品牌名称、徽标或商标素材。

## 开始玩

Windows 双击 **启动游戏.cmd**，浏览器会打开游戏。保留启动窗口，关闭窗口会停止本地服务。本机已安装 Node.js，打包成品可离线使用。

电脑按住 **空格、↓ 或 B**，也可以用鼠标按住刹车踏板。手机长按右下角的踏板，松开卸力。车辆从 110 km/h 起步，不制动会继续加速。持续按压会使力度上升，到 **1612 N** 时踏板断裂、刹车失效；车辆随后偏航撞向护栏，反弹滑行并报废。合理分段制动，可以把速度降到 0，成功停车后游戏停止。

电脑 **Esc** 暂停/继续，切换窗口或把页面切到后台会自动暂停。支持声音开关、全屏与自动/高清/流畅画质。声音默认关闭。

手机可通过已发布的游戏网页游玩，也可在与电脑相同的 Wi-Fi 下访问启动窗口显示的电脑无线网卡地址。不要用手机上的 localhost 访问电脑。

## 开发与验证

```powershell
npm install
npm run dev
npm test
npm run build
node scripts/serve.mjs
```

本地服务默认端口 5178；可以通过 `node scripts/serve.mjs --port 5179` 指定其他端口。

`src/simulation.js` 管理固定时间步长的规则、失控碰撞与胜负；`src/scene.js` 管理道路、地形、灯光和镜头；`src/vehicle.js` 创建无品牌车辆与碰撞变形；`src/crash-effects.js` 管理复用的碎片、火花、烟尘和连续胎痕；`src/main.js` 连接键盘、触摸与界面。素材都随构建打包，不依赖运行时外部 CDN。

`npm test` 验证即时制动、加速、断裂阈值、松开卸力、可成功的制动策略、护栏碰撞、反弹、复位和胜负优先级。`scripts/browser_qa.py` 对生产版进行真实浏览器交互，包含键盘、指针捕获、触摸、完整事故、声音、暂停与响应式布局。

1.1 版提高了加速度，去掉踏板动画的 140 ms 过渡与制动力爬升等待，按下即制动。1612 N 红色临界标牌在手机上也保持醒目；踏板会从金属支架处撕裂、掉落并弹跳。

画面改用硬件 MSAA 抗锯齿与直接渲染，保持 PBR 车漆和实时阴影；路面法线与 HDR 天空提高到 2K。静态车身与轮毂按材质合并，复用事故粒子，并减少重复 HUD 更新。自动档按帧时长调整高 DPI 设备的渲染比例。实测与限制见 `docs/verification.md`。

这是一款虚构娱乐游戏。1612 N 是指定的玩法阈值，游戏制动力、累积方式与断裂动画不是实际车辆参数或技术测试结论。

## 素材与技能

车身、公路设施、地形和音效由代码创建。沥青 PBR 贴图来自 [Poly Haven Asphalt 02](https://polyhaven.com/a/asphalt_02)，地表贴图来自 [Rocky Terrain](https://polyhaven.com/a/rocky_terrain)，天空与环境光来自 [Kloofendal 48d Partly Cloudy](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)，均为 CC0。下载链接、字节数与 SHA-256 见 `public/assets/sources.json`，可用 `powershell -File scripts/fetch-assets.ps1` 重新核验。

初版额外安装了 [threejs-postprocessing](https://github.com/CloudAI-X/threejs-skills/tree/main/skills/threejs-postprocessing)。1.1 性能优化复用 performance-optimization、game-feel、Three.js 与浏览器测试技能，没有再安装重复技能。选择与审查记录见 `docs/skills.md`。
