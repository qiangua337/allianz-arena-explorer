@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 18 或更新版本，然后重新运行此文件。
  echo Node.js 官方网站: https://nodejs.org/
  pause
  exit /b 1
)
echo 安联球场即将启动，请保持此窗口开启。
echo 在浏览器打开 http://localhost:4173
start "" "http://localhost:4173"
node server.mjs
pause
