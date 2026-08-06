# 0721 Ciallo 小按钮

一个带有音效播放、共享计数和倒计时功能的互动网页。访客点击两个角色图片按钮后，会播放对应音效，并将点击次数记录到服务端，所有访客看到的是同一份计数。

## 功能

- 0721 按钮：播放 `0721only.mp3`，使用 nene 系列图片。
- Ciallo 按钮：播放 `Ciallo～(∠・ω- )⌒☆.mp3`，使用 meguru 系列图片。
- 未播放时显示数字 1 图片，播放时切换为数字 2 图片。
- 两个按钮分别独立统计，并显示下一位访客编号。
- 点击后显示对应 toast：
  - 0721：`オナニー`
  - Ciallo：`Ciallo～(∠・ω- )⌒☆`
- 实时显示所有访客的总计数和分项计数。
- 显示距离下一次 7 月 21 日 00:00 的天、时、秒倒计时。
- 适配移动端，竖屏时两个按钮并排显示。
- 使用本地字体，不依赖 Google Fonts 等外部网络资源。

## 快速开始

需要安装 Node.js。项目不需要额外依赖，直接在项目目录运行：

```powershell
npm start
```

然后打开：

```text
http://localhost:7210
```

也可以直接运行：

```powershell
node server.js
```

默认端口是 `7210`，可以通过环境变量修改：

```powershell
$env:PORT = 8080
npm start
```

## 项目结构

```text
.
├─ data/
│  └─ counts.json          # 持久化保存的共享计数
├─ public/
│  ├─ index.html           # 页面结构
│  ├─ styles.css           # 页面样式与响应式布局
│  ├─ app.js               # 音效、计数、toast、倒计时逻辑
│  ├─ audio/
│  │  ├─ 0721only.mp3
│  │  └─ ciallo.mp3
│  └─ images/
│     ├─ background.jpg
│     ├─ icon.png
│     ├─ nene1.jpg / nene2.jpg
│     └─ meguru1.jpg / meguru2.jpg
├─ package.json
├─ server.js               # Node.js 静态文件服务器与计数 API
└─ README.md
```

## 计数接口

服务端使用本地 JSON 文件保存计数，不需要数据库。

```text
GET  /api/counts
POST /api/click/only
POST /api/click/ciallo
```

返回示例：

```json
{
  "only": 100,
  "ciallo": 99,
  "total": 199
}
```

计数会写入 [data/counts.json](data/counts.json)。如需清零，可停止服务后将三个数改为 `0`，再重新启动服务：

```json
{
  "only": 0,
  "ciallo": 0,
  "total": 0
}
```

## 修改素材

- 修改音效：替换 `public/audio/` 中对应的 MP3 文件，并同步检查 `public/app.js` 中的路径。
- 修改按钮默认图和按下图：替换 `public/images/nene1.jpg`、`nene2.jpg`、`meguru1.jpg`、`meguru2.jpg`。
- 修改页面背景：替换 `public/images/background.jpg`。
- 修改浏览器标签页和左上角图标：替换 `public/images/icon.png`。
- 修改标题：编辑 `public/index.html` 中的 `<title>` 和页面 `<h1>`。

## 部署提示

这是一个轻量的 Node.js 服务，部署时需要让服务器持续运行 `node server.js`，并将外部访问转发到对应端口。共享计数保存在服务器本地，因此部署平台必须提供可持久化的文件存储；如果平台会重置实例文件，计数也会被重置。

当前计数接口没有用户身份限制，任何能访问页面的人都可以提交点击。若公开部署，建议根据实际需要增加限流、来源校验或数据库存储。

## 开发检查

修改 JavaScript 后可以运行：

```powershell
node --check server.js
node --check public/app.js
```
