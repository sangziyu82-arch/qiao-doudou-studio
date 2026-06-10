# 敲豆豆工作台

一个面向“敲豆豆 / 拼豆 / 像素底板”的网页工具。它可以把图片转换成可编辑的小格子色块，配合 STL 方块模型生成排布方案，并导出图纸或已经排好位置的 STL 模型。

## 功能亮点

- 图片上传后先裁剪，再按选区生成像素底板。
- 自动识别图片颜色，并统计每种 RGB 色块数量。
- 支持画笔、橡皮、吸管工具，直接在网格上修改颜色。
- 支持显示原图叠加层，并调节透明度，方便对照轮廓修色块。
- 支持 `Ctrl + 1` 显示或隐藏原图叠加层。
- 点击右侧颜色表时，同色格子会发光定位；按 `Esc` 可取消发光。
- 支持读取本地 STL 模型尺寸，把单格尺寸设置为模型真实尺寸。
- 支持下载原始 STL 模型、复制模型链接、导出排布后的 STL 文件。
- 支持局域网访问，方便同一网络内其他设备打开使用。
- 内置“打赏支持”弹窗，展示微信和支付宝二维码。

## 技术栈

- React 19
- Vite 7
- lucide-react
- GitHub Pages

## 本地启动

```bash
npm install
npm run dev
```

默认会以局域网可访问方式启动：

```text
http://localhost:5173/
```

同一局域网设备可以访问你的电脑 IP，例如：

```text
http://192.168.1.190:5173/
```

实际 IP 以你当前电脑网络为准。

## 扫描 STL 模型

项目默认从下面路径扫描 STL 文件：

```text
D:\下载\3dmox
```

把 STL 模型放进去后运行：

```bash
npm run scan-models
```

脚本会：

- 读取 STL 模型尺寸。
- 复制模型到 `public/models/`。
- 生成 `public/stl-models.json`。
- 让网页里的“3D STL 模型”下拉框可以选择模型。

## 构建

```bash
npm run build
```

构建产物会输出到：

```text
dist/
```

## GitHub Pages 部署

仓库地址：

[https://github.com/sangziyu82-arch/qiao-doudou-studio](https://github.com/sangziyu82-arch/qiao-doudou-studio)

如果已经启用 GitHub Pages，可以访问：

[https://sangziyu82-arch.github.io/qiao-doudou-studio/](https://sangziyu82-arch.github.io/qiao-doudou-studio/)

如果页面还是 404，需要在 GitHub 仓库中开启 Pages：

1. 打开仓库 `Settings`。
2. 进入 `Pages`。
3. `Source` 选择 `Deploy from a branch`。
4. `Branch` 选择 `gh-pages`，目录选择 `/ (root)`。
5. 保存后等待几分钟。

## 常用操作

1. 上传图片。
2. 拖动裁剪框，确认要生成的区域。
3. 调整横向格数、颜色数量、背景阈值。
4. 在右侧颜色表点击颜色，定位所有同色格子。
5. 用原图叠加层辅助修色块。
6. 选择 STL 模型并应用尺寸。
7. 导出 PNG 图纸或排布后的 STL 模型。

## 项目结构

```text
.
├─ public/
│  ├─ models/              # 可下载和引用的 STL 模型
│  ├─ reference.jpg        # 默认示例图
│  └─ stl-models.json      # STL 模型清单
├─ scripts/
│  └─ scan-stl-models.mjs  # 扫描本地 STL 模型并生成清单
├─ src/
│  ├─ main.jsx             # 应用主逻辑
│  └─ styles.css           # 界面样式
├─ vite.config.js          # Vite 与 GitHub Pages 路径配置
└─ .github/workflows/      # GitHub Pages 自动部署工作流
```

## 说明

STL 模型只负责真实尺寸和排布位置；最终生成哪些方块、每个方块是什么颜色，由网页中的网格图案决定。
