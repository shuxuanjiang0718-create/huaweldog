# 本次技能选择与审查

检查日期：2026-10-10。

使用 `find-skills-collab`，检索词为 `threejs postprocessing`。注册表找到了直接匹配的 `CloudAI-X/threejs-skills@threejs-postprocessing`；没有执行 GitHub 搜索回退，随后通过 GitHub API 检查候选仓库与完整技能目录。

新增技能用于抗锯齿、泛光、输出色彩与自定义画面效果。仓库 README 声明 MIT；目标目录只有一个 `SKILL.md`，不存在脚本、二进制、安装钩子或依赖清单。未授予个人文件、账户或凭证访问权限。没有执行 README 中与候选仓库不一致的克隆示例。

安装命令：

```powershell
python C:\Users\Lenovo\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py --repo CloudAI-X/threejs-skills --path skills/threejs-postprocessing
```

全局位置：`C:\Users\Lenovo\.codex\skills\threejs-postprocessing\SKILL.md`。该技能可用于之后的对话，本文档内容已在当前任务中读取使用。

SHA-256：`570B86434C30AD9BDC30F4F6D4E8C04124A07DD4CCAA778D4717ECC211DC1D90`。

部分示例面向较旧版本。项目采用 Three.js 0.186.1，并依据官方当前文档使用 `HDRLoader`、`PCFShadowMap`、`OutputPass`；没有复制旧的 WebGPU 导入方式或重复应用 gamma 校正。

其余复用了已安装的 game-engine、game-architect、threejs-materials、threejs-lighting、webapp-testing 与 Sites。遇到浏览器帧率问题时使用 performance-optimization 进行分辨率与后期效果对照测量；调试遵循 systematic-debugging。

资料：[技能来源](https://github.com/CloudAI-X/threejs-skills)、[Three.js HDRLoader](https://threejs.org/docs/pages/HDRLoader.html)、[Three.js 迁移指南](https://github.com/mrdoob/three.js/wiki/Migration-Guide)、[OutputPass](https://threejs.org/docs/pages/OutputPass.html)。
