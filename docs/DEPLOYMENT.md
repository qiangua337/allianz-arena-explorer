# Cloudflare Pages 发布

这是纯静态网站。生产资源位于 `dist/`，没有构建步骤、服务端数据库或运行时密钥。
`server.mjs` 仅用于本地预览，不需要上传到 Cloudflare。

## 更新当前网站

当前网站连接 GitHub 的 `main` 分支。将改动提交并推送后，Cloudflare Pages
会运行 `npm run check`，检查通过后发布 `dist/`。无需填写环境变量或安装 npm 依赖。

```sh
npm run check
git add .
git commit -m "Update arena"
git push origin main
```

Cloudflare 配置：框架预设 `None`，构建命令 `npm run check`，输出目录 `dist`，
根目录使用仓库根目录，生产分支 `main`。

## 手动发布

也可以使用 Node.js 22 或更新版本，在项目根目录运行 `npm run deploy`。
命令使用固定版本 Wrangler 4.151.2，上传 `dist/` 至 Pages 项目
`allianz-arena-explorer` 的生产分支 `main`。首次运行会通过 npm 获取官方 Wrangler。
账号需已登录并拥有对应项目的 Pages 写入权限；登录命令：

```sh
npx --yes wrangler@4.151.2 login
```

手动发布前也应提交并推送同一份源码，确保生产版本与源码对应：

```sh
npm run deploy
```

## 在自己的 Cloudflare 账号发布

1. Fork 仓库，在 Cloudflare 控制台选择 Workers 和 Pages → 创建 → Pages → 导入 Git 仓库。
2. 选择自己的仓库与 `main` 分支，框架选 `None`，构建命令 `npm run check`，输出目录 `dist`。
3. 将 `wrangler.jsonc` 中的 `name` 改成自己的 Pages 项目名，保存并部署。

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
