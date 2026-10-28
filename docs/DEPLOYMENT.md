# Cloudflare Pages 发布

公开网站：<https://allianz-arena-explorer.pages.dev/>

公开源码：<https://github.com/qiangua337/allianz-arena-explorer>

6.0 起，场景资源仍在 `dist/`，联机 API 位于 `functions/api/online/`，比赛服务器位于 `multiplayer/worker.js`。前端不需要密钥；房间使用 SQLite Durable Objects。
`server.mjs` 仅预览静态参观和人机赛；本地联机使用 `npm run dev:online`，默认地址为 `http://127.0.0.1:51736/`。

发布联机前必须先运行 `npm run deploy:multiplayer`，将同名 Worker 部署到当前 Cloudflare 账号。根目录 `wrangler.jsonc` 的 `ARENA_MULTIPLAYER` 服务绑定必须保留，随后再发布 Pages。该 Worker 关闭 workers.dev 和独立预览 URL，通过 Pages 私有服务绑定调用；只有 `/api/online/*` 进入 Functions，其他资源继续使用静态 CDN。

首次 Worker 部署按 `multiplayer/wrangler.jsonc` 创建 SQLite Durable Object 类；更新时保留原迁移标记。需要账号读取、Pages 和 Workers Scripts 写入权限，仅有 Pages 权限不能发布联机服务器。不修改账号套餐。

## 更新当前网站

当前网站连接 GitHub 的 `main` 分支。将改动提交并推送后，Cloudflare Pages
会运行 `npm run check`，检查通过后发布 `dist/` 与根目录 Functions。联机依赖的同名 Worker 需要先单独部署。

```sh
npm run check
npm run deploy:multiplayer
git add .
git commit -m "Update arena"
git push origin main
```

Cloudflare 配置：框架预设 `None`，构建命令 `npm run check`，输出目录 `dist`，
根目录使用仓库根目录，生产分支 `main`。

## 手动发布

也可以使用 Node.js 24 或更新版本，在项目根目录运行 `npm run deploy`。
命令使用固定版本 Wrangler 4.151.2，上传 `dist/` 至 Pages 项目
`allianz-arena-explorer` 的生产分支 `main`。首次运行会通过 npm 获取官方 Wrangler。
账号需已登录并拥有对应项目的 Pages 与 Workers Scripts 写入权限；登录命令：

```sh
npx --yes wrangler@4.151.2 login
```

手动发布前也应提交并推送同一份源码，确保生产版本与源码对应：

```sh
npm run deploy
```

发布后运行 `node scripts/audit-online.mjs https://allianz-arena-explorer.pages.dev`，以真实 HTTP 和两条 WebSocket 检查房间、同步、暂停与重连，结束时自动清理测试房间。手机布局和实际按键另需浏览器验证。

## 在自己的 Cloudflare 账号发布

1. Fork 仓库，在 Cloudflare 控制台选择 Workers 和 Pages → 创建 → Pages → 导入 Git 仓库。
2. 选择自己的仓库与 `main` 分支，框架选 `None`，构建命令 `npm run check`，输出目录 `dist`。
3. 将 `wrangler.jsonc` 中的 `name` 改成自己的 Pages 项目名。先部署 `multiplayer/wrangler.jsonc`，再发布 Pages；如修改 Worker 名称，同时修改服务绑定的 `service`。

也可以使用 Wrangler 登录自己的账号，以 Direct Upload 方式创建独立项目：

```sh
npx --yes wrangler@4.151.2 pages project create YOUR_PROJECT_NAME --production-branch main
npx --yes wrangler@4.151.2 pages deploy dist --project-name YOUR_PROJECT_NAME --branch main
```

部署完成后，Wrangler 会返回 HTTPS 网址。Pages 项目默认提供公开的 `pages.dev` 地址。
使用 Git 集成创建的项目会在推送后自动部署；仅使用 Direct Upload 创建的项目需要手动发布。

不要将登录凭据、`.env` 或本地配置加入仓库和 `dist/`。本项目无需填写或提交 API Token。

官方说明：[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)、
[Wrangler 配置](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)。

## 早期 Sites 入口

早期 Sites 地址保留原访问范围，入口页会保留查询参数和 URL 片段，自动跳转到上面的 Cloudflare 生产地址。后续版本以公开 GitHub main 和 Cloudflare 为准，避免两份站点版本混淆。Sites 私有部署身份与配置不写入此开源仓库。
