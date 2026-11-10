# 第三方许可与标识

界面字体 `dist/assets/fonts/arena-sans-sc-500.woff2` 与 `arena-sans-sc-800.woff2` 由 Google Fonts 上游 Noto Sans SC 制作：按当前界面字集子集化、实例化字重并改名为 Arena Sans SC，原始版权为 Copyright 2014–2021 Adobe，保留字体名 Source。`arena-condensed-600.woff2` 由 Barlow Condensed SemiBold 制作并改名为 Arena Condensed，Copyright 2017 The Barlow Project Authors。两者采用 SIL OFL 1.1，完整原始许可与固定源版本、SHA-256 及处理方法在 `dist/assets/fonts/`，不适用代码 MIT 许可。

首页照片 `dist/assets/editorial/kane.webp`：Harry Kane，2025-01-06，摄影 Werner100359 / Wikimedia Commons，[原文件页](https://commons.wikimedia.org/wiki/File:FC_Red_Bull_Salzburg_gegen_Bayern_M%C3%BCnchen_(2025-01-06_Testspiel)_28.jpg)。`musiala.webp`：Jamal Musiala，厄瓜多尔对德国，2026-06-25，摄影署名 Bryan Berlin / WikiPortraits / Wikimedia Commons，[原文件页](https://commons.wikimedia.org/wiki/File:Jamal_Musiala_Ecuador_v_Germany_25_June_2026-174.jpg)。两张采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)，经缩放、WebP 编码，并在页面中以 CSS 裁切、渐变及颜色调整展示；照片及相关衍生展示保留 CC BY-SA 4.0，不纳入 MIT。完整可访问的署名和修改声明见 `dist/visual-credits.html`，照片不表示任何个人或机构对网站的认可。

Quaternius Universal Animation Library Standard：行走、站立、坐姿和交谈动作，作者 Quaternius，CC0 1.0。项目对动作进行取样和骨架适配，未使用任何足球商业游戏的资产。来源：<https://quaternius.com/packs/universalanimationlibrary.html>、<https://opengameart.org/content/universal-animation-library>。原始声明保存在 `dist/assets/players/LICENSE.ANIMATIONS.txt`。

Borussia Dortmund 队徽：`dist/assets/borussia-dortmund.svg`，来源 <https://commons.wikimedia.org/wiki/File:Borussia_Dortmund_logo.svg>，2023-08-26 从 bvb.de 更新的 SVG。Commons 标为 PD-textlogo；商标权仍属于俱乐部，不属于本项目 MIT 许可的授权范围。

Three.js 0.186.1 及 OrbitControls 采用 MIT 许可证，版权属于 Three.js authors。
原始许可保存在 [dist/vendor/LICENSE.three.txt](dist/vendor/LICENSE.three.txt)。
上游项目：<https://github.com/mrdoob/three.js>。

本项目原创代码使用根目录的 MIT 许可证。FC Bayern、Allianz、Allianz Arena
等名称及相关队徽、商标的权利仍属于各自权利人，MIT 许可证不授予这些商标的权利。
这是非官方球迷项目，与俱乐部、赞助商和场馆运营方无隶属或认可关系。

建筑几何体与大部分建筑贴图由代码生成，仓库不包含研究时观看的视频、商业游戏模型、音乐或官方照片。

观众图集 `dist/assets/crowd/supporters-atlas-3100.png` 使用内置 imagegen 工具生成，人物为虚构成年球迷，不是官方照片、真人扫描或商业游戏素材。坐姿观众几何与实例动画由本项目代码生成；完整生成提示词与资源记录见 [docs/CROWD-ASSETS.md](docs/CROWD-ASSETS.md)。

`dist/assets/fc-bayern.svg` 是 FC Bayern 官网使用的俱乐部队徽，下载核对日期为 2026-10-20。该资源及其商标权属于 FC Bayern，不属于本项目原创代码的 MIT 授权范围。

来源页面：<https://fcbayern.com/en>。原始资源：
<https://img.fcbayern.com/image/upload/v1779947813/cms/public/images/fcbayern-com/logos/fcbayern.svg>。
公开资料来源及近似建模范围见 [docs/REFERENCES.md](docs/REFERENCES.md)。

比赛日人群声音 `dist/assets/audio/stadium-crowd.mp3` 来自 Work With Sounds / Torsten Nilsson 的 [WWS FootballAustriavs.Sweden.ogg](https://commons.wikimedia.org/wiki/File:WWS_FootballAustriavs.Sweden.ogg)，采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。原录音于 2014-09-08 在恩斯特·哈佩尔球场录制；本项目截取约 30–70 秒，运行时加入首尾淡化、滤波、混响及欢呼混音。它是通用足球人群声景，非拜仁或安联球场比赛同期声。来源与修改声明随音频保存在 `dist/assets/audio/README.txt`；该录音不适用本项目的 MIT 授权。

比赛日人物使用 [MakeHuman 核心网格、形变目标、蒙皮权重和系统资产](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)，以及 [Shirts 01](https://static.makehumancommunity.org/assets/assetpacks/shirts01.html) 中 MargaretToigo / MRT 的基础 T 恤，均为 CC0。经过人体形变、衣物贴合、骨骼简化、网格裁切、球衣和足球装备制作、贴图尺寸及格式转换。CC0 全文与来源保存在 `dist/assets/players/`，再生成说明见 [docs/PLAYER-ASSETS.md](docs/PLAYER-ASSETS.md)。未包含 MakeHuman 的程序代码。人物面部为通用模型，未复制 eFootball 或 EA Sports FC 的资产。


表面材质与环境光资源由 [Poly Haven](https://polyhaven.com/) 提供（Powered by Poly Haven），按 [CC0 1.0](https://polyhaven.com/license) 发布。随仓库附带 `smooth_concrete_floor`、`wood_table_001`、`fabric_pattern_07`、`rubber_tiles`、`painted_plaster_wall`、`grass_ground` 的 1K 部分贴图，以及 `autumn_field_puresky`、`qwantani_night_puresky`、`studio_small_08` 的 1K HDR；完整资产页面、原始下载链接、文件大小与 MD5 保存在 `dist/assets/pbr/manifest.json`。运行时可缩小纹理、调整 UV、颜色、法线强度与反射亮度。它们是通用表面和天空，并非在安联球场采集。原始贴图未被作为商业游戏资产使用。

`dist/vendor/HDRLoader.js` 同样来自 Three.js 0.186.1，适用随仓库附带的 Three.js MIT 许可。
