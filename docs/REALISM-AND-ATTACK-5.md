# 5.0 — 真实展陈参考、设施修订与射门扑救

核对日期：2026-10-27。在线版本：[安联球场](https://allianz-arena-explorer.pages.dev/?place=museum&night=1)。

## 这一版解决什么

荣誉展厅此前只有八组球队奖杯，缺少个人成就和展陈内容。本版增加十组个人荣誉，把不同奖项分开标明；同时根据真实拜仁博物馆的照片调整展台和室内设施。比赛部分修正门将即时预测、大范围自动接球的问题，允许正常射门、扑救脱手和跟进补射。

## 实景依据和模型范围

这仍是程序化、米制的场馆体验作品，不是施工图、测绘或摄影扫描。设备的形制参考公开实景，未取得厂商 CAD、完整室内测量或博物馆施工平面。不得把估算尺寸和示意陈列当成已测量的现实设施。

| 区域 / 对象 | 本版采用的实际依据 | 实现与简化 |
| --- | --- | --- |
| 博物馆奖杯大道 | [拜仁 2026 年改造说明与照片](https://fcbayern.com/museum/de/news/2026/06/update-umbau-mit-einer-allee-der-erfolge-und-vielem-mehr) | 双排透光展台、深色裸露设备顶、红黑历史展板；现有 15 × 25 m 房间中压缩展示八组球队奖杯，不是整馆复刻 |
| 凯恩个人展柜 | [官方展柜报道](https://fcbayern.com/museum/en/news/2024/12/display-case-from-and-for-harry-kane-in-the-museum)、[官方照片集](https://fcbayern.com/museum/en/galleries/2024/gallery-harry-kane-exhibition) | 参考球衣、比赛用球、金靴、射手炮和纪念物组合；球衣纹样与物件为原创示意，非实物扫描 |
| 博物馆规模与内容 | [官方展览介绍](https://fcbayern.com/museum/en/exhibition) | 实馆展览面积 3,300 m²。本作未包含其全部空间、历史藏品或特殊展览，个人奖项不等同于实物馆藏清单 |
| 欧冠奖杯 | [UEFA 奖杯资料](https://www.uefa.com/uefachampionsleague/thetrophy/) | 有杯腹、双耳、底座、刻字，按官方 73.5 cm 高度校准整体缩放；细部为程序化近似 |
| 新闻发布设施 | [场馆官方发布厅资料](https://allianz-arena.com/en/event-venue/rooms/presseclub--foyer)、[拜仁发布会照片](https://fcbayern.com/en/news/2024/05/live-blog-the-unveiling-of-new-fc-bayern-coach-vincent-kompany) | 180 席布局、鹅颈麦克风、镜头 / 寻像器 / 云台 / 三脚架 / 线缆、吊装灯架；房间与座椅间距按现有可通行空间估算 |
| 替补席与康复台 | 官方场馆图库及参观照片中的设备形制 | 高背侧翼座椅、弧面靠背、扶手与基座；康复台加入分段软垫、剪式升降支架、脚控与脚轮。没有冒称厂商型号或认证尺寸 |
| 球员通道 | [场馆官方 LED 通道改造](https://allianz-arena.com/de/news/2019/09/spielertunnel-der-allianz-arena-renoviert-und-umgestaltet) | 保留红色媒体墙与连续扶手；视频内容和精确连接仍为简化 |
| 球场及看台 | [官方事实资料](https://allianz-arena.com/en/arena/facts/general-information)、[官方楼层与座位图](https://allianz-arena.com/en/arena/site-seatmaps) | 草坪 105 × 68 m，使用共享行走楼层与三层看台几何。模型座椅数量不等于真实容量 |

官方照片只用作观察和来源链接，未将其作为本项目贴图重新发布。

## 个人荣誉

数据、展柜位置、目录、交互和家具碰撞共用 `dist/personal-honours.js`。共十组展柜、九位球员，凯恩的金球与金靴分别展示。

| 球员 | 记录 |
| --- | --- |
| 盖德·穆勒 | 1970 金球；1970、1972 欧洲金靴 |
| 贝肯鲍尔 | 1972、1976 金球 |
| 鲁梅尼格 | 1980、1981 金球 |
| 凯恩 | 2026 金球、盖德·穆勒奖；2024、2026 欧洲金靴 |
| 莱万多夫斯基 | 2020、2021 The Best FIFA 男足球员；2020/21、2021/22 欧洲金靴 |
| 卡恩 | 2002 世界杯金球，属于世界杯最佳球员奖 |
| 诺伊尔 | 2014 世界杯金手套 |
| 托马斯·穆勒 | 2010 世界杯金靴 |
| 里贝里 | 2012/13 UEFA 欧洲最佳球员 |

每组详情均有对应的俱乐部、FIFA、UEFA 或 France Football 原始资料链接。目录可搜中文 / 外文姓名、奖项或年份；金靴分类也会找到同时拥有其他奖项的球员。展柜靠近后按 F / 点击互动按钮即可查看，目录不改变玩家位置。手机使用可滚动内容和独立关闭按钮。

代表性资料：

- [France Football 历届金球](https://app.francefootball.fr/ballon-d-or/palmares/)
- [拜仁：凯恩 2026 金球](https://fcbayern.com/en/news/2026/10/fc-bayern-congratulates-harry-kane-on-ballon-dor)
- [拜仁：凯恩及历届欧洲金靴](https://app.fcbayern.com/en/news/2026/08/harry-kane-to-receive-golden-shoe)
- [FIFA：莱万再次获得 The Best](https://www.fifa.com/en/articles/lewandowski-winning-again-means-a-lot-to-me)
- [拜仁：卡恩的世界杯金球](https://fcbayern.com/en/club/hall-of-fame/oliver-kahn)
- [FIFA：诺伊尔世界杯之旅](https://www.fifa.com/en/tournaments/mens/worldcup/articles/neuer-germany-world-cup-journey)
- [FIFA：世界杯最佳射手](https://www.fifa.com/en/articles/fontaine-mbappe-ronaldo-and-more-every-world-cup-top-scorer)
- [UEFA：里贝里赛季最佳](https://www.uefa.com/uefachampionsleague/news/0250-0c50fe103b73-0fcc5456ac81-1000--ribery-is-crowned-uefa-best-player-in-europe/)

## 门将和射门

旧版门将会立即读取精确未来球路，并在约三米宽的范围内直接取得高速球所有权。本版改为：

- 根据已飞行的球，在反应时间后判断；角度站位、横移、一次性扑救与恢复分开处理。扑出后不能瞬间变向或立即再抱球。
- 球必须实际扫过手部或身体的有限体积，才算接触；速度、触球部位和扑倒状态决定抱住或脱手。脱手球仍参加正常物理、争抢和补射。
- 增加劲射、搓射、挑射，速度、高度和曲率不同。Z 或球员卡按钮切换，按住 K / F / 手机射门蓄力。预览显示弧线和球门目标，反馈显示抱住、脱手、门框、偏出等真实结果。
- 正常射门有弹道高度，不再主要在门前弹跳滚行。终场增加射正与扑救数据；回放复制门将和射门状态，避免修改比赛历史。

### 可重复对照

运行 `node scripts/audit-shots.mjs report.json`。540 个场景覆盖三种难度、8 / 12 / 18 / 24 / 30 米、三个方向、两档力度、六个种子。球员和门将只在释放球之前布置，之后完全运行实际模拟。

| 相同测试矩阵 | 进球 | 扑救 |
| --- | ---: | ---: |
| 4.0 原逻辑 | 14 | 526 |
| 5.0 新逻辑 | 271 | 269 |

新逻辑在标准难度的 18 米场景有 11 / 36 次进球，24 米有 8 / 36 次进球；旧版这两个距离均为零。此次矩阵中高速触球均为脱手；低速居中来球可以抱住。

这只是**无人盯防的受控射门对照**，不能当作完整比赛的射门转化率。防守、选位、角度和力度仍会影响结果，未通过直接增减比分来调整难度。

原始数据：[修改前](data/shot-audit-before-5000.json)、[修改后](data/shot-audit-after-5000.json)。

## 通行、手机与性能

- 展台位置保持在原有主要占地内；新增侧墙个人展柜同步纳入家具碰撞。入口、中央通道和两侧通道保持开放。
- 发布厅增加座席后，后排横向通道一起调整；踏步渲染、行走楼层和座席共用排距 / 高度数据。自动化测试会逐段检查现有全部参观路径及房间出口，避免只在地图上连通。
- 展柜图文使用共享图集，金属共享环境贴图，静态设备合并绘制；新增顶灯主要以发光面呈现，不添加几十个实时阴影光源。比赛期间仍剔除室内绘制。
- 手机保留射门方式切换、蓄力、半自动换人和全部动作键。目录、详情、关闭按钮与比赛 HUD 检查横竖屏边界；模拟视口检查不能代替所有真实手机 GPU 的性能保证。

验证命令：`npm run check`；包含语法、模拟、回放、模型、家具、楼层、门、碰撞与连续通行检查。浏览器还需检查实际加载、荣誉目录 / 展柜交互、比赛新按钮以及 390 × 844 和 844 × 390 视口。

本版结果：86 个应用模块语法检查通过，182 项自动化测试通过。浏览器已实走展厅并打开靠近展柜后的交互，检查目录检索、实际挑射出球、390 × 844 竖屏与 844 × 390 横屏。未观察到脚本 / 着色器错误或资源加载失败。
