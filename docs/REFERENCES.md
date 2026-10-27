# 参考资料与复原判断

研究日期：2026-10-20 至 2026-10-26。主要采用场馆、俱乐部、建筑事务所的公开资料，以及用户提供的可播放视频画面。并未取得施工图、完整室内尺寸或测绘数据。

## 3.0 可选对手

2026-10-26 核对以下官方资料，姓名与号码成对保存在 `dist/football-teams.js`，拜仁及原多特名单沿用共享文件并复核。首发和替补为本作品选配，不代表真实当场首发、伤停或能力评级。角色保持通用人体，新增三队使用独立绘制的球队配色及字母标记；没有提取商业游戏资源。

| 球队 | 官方资料 |
| --- | --- |
| 皇家马德里 | [2026/27 球衣号码，2026-08-10](https://www.realmadrid.com/en-US/news/football/first-team/latest-news/dorsales-del-real-madrid-para-la-temporada-2026-27-10-08-2026) |
| 巴塞罗那 | [2026/27 球衣号码，2026-09-02](https://www.fcbarcelona.com/en/football/first-team/news/4570894/202627-first-team-jersey-numbers-confirmed) |
| 曼彻斯特城 | [男子队球员与号码](https://www.mancity.com/players) |
| 多特蒙德 | [官方 Shop by Player，姓名与号码](https://shop.bvb.de/pages/shop-by-player) |
| 拜仁慕尼黑 | [官方一线队](https://fcbayern.com/en/teams/first-team) |

## 建筑与场馆

| 来源 | 用途及已核实内容 |
| --- | --- |
| [FC Bayern — 当前一线队](https://fcbayern.com/en/teams/first-team) | 2026-10-20 核对当前赛季球衣姓名和号码。更衣室、商店共用 dist/roster.js；号码不明者不编造号码。 |
| [FC Bayern — 官网](https://fcbayern.com/en) | 使用页面正式队徽 SVG，保持圆形原始比例，出处及权利见 THIRD_PARTY_NOTICES.md。 |
| [Allianz Arena — 2025/26 场馆改造](https://allianz-arena.com/en/news/2025/07/allianz-arena-refurbishments-summer-2025) | 南侧主要入口经 Esplanade 到达；增设入口检查区雨棚。以此补建可见南入口与开放通行中央通道，具体门数与位置仍为近似。 |
| [Allianz Arena — Facts & Figures](https://allianz-arena.com/en/arena/facts/general-information) | 当前页面列出外廓 258 × 227 × 52 米；外壳与屋顶共 2,784 个气枕；场地 105 × 68 米；草坪总区域 111 × 72 米；三层看台坡度约 24°、30°、34°；南广场长 543 米、宽 136 米。采用这些尺寸控制比例。 |
| [Allianz Arena — FAQ](https://allianz-arena.com/en/faq) | 国内赛事容量 75,024，国际赛形式与站席转换不同。没有将场景座椅数量冒充售票座位数。 |
| [Herzog & de Meuron — 205 Allianz Arena](https://www.herzogdemeuron.com/projects/205-allianz-arena/) | 发光菱形 ETFE 外壳、停车场上方的起伏绿色景观、步道、三层陡升看台与火山口般的空间关系。用于外壳轮廓与广场组织。 |
| [Allianz Arena — 官方航拍照片页面](https://allianz-arena.com/de/news/2019/einsatzuebung-zur-europameisterschaft-2020) | 实际查看航拍图，识别球场下部柱列、南广场步道、停车场采光口、邻近道路、轨道与维护设施。周边建筑采用近似体块，未逐栋测量。 |
| [Allianz Arena — Team areas open again for tours，2022-10-05](https://allianz-arena.com/en/news/2022/10/fc-bayern-team-areas-open-again-for-tours) | 实际查看页面所用更衣室图像。红色柜体、木质连续长凳、上层收纳格、挂衣杆、球衣、球鞋、水瓶、顶面白色带状照明与电子时钟是主要视觉依据。 |
| [Allianz Arena — 更衣室整修公告，2026-05](https://allianz-arena.com/en/news/2026/05/renovation-work-in-fc-bayern-dressing-room) | 官方公告说明 2026 年 5 月 18 日至 6 月 5 日更衣室整修。2022 年照片可参考材质与构件关系，不能据此宣称精确代表整修后现状。 |
| [FC Bayern — Die Allianz Arena im neuen Gewand，2018-08-04](https://fcbayern.com/de/bilder/2018/08/galerie-die-allianz-arena-im-neuen-gewand) | 内场红白座椅改造、俱乐部色彩与装饰。使用红色为主的看台，并程序化生成字样。 |
| [FC Bayern — Hospitality general information](https://fcbayern.com/en/tickets/fc-bayern-hospitality-tickets/general-information) | 官方楼层图与场地地图入口，用于理解公共、接待、商店及不同楼层的功能关系。精确柜台位置及房间尺寸仍作近似。 |
| [FC Bayern — Level 2 map](https://fcbayern.com/binaries/content/assets/downloads/allianz-arena/events/logenkunden-portal/lageplaene/englisch/location-map-level-2) | 分区、Welcome Zones、球迷商店、餐饮、FC Bayern Store、Arena Tour / Museum 等设施的存在与环形组织。 |
| [Allianz Arena — Level 2 visitor plan, 2025/26](https://allianz-arena.com/binaries/content/assets/downloads/allianz-arena/fantreffs/englisch/25_26_allar_e02_297x210_w_en.pdf) | 补充入口、WC、餐饮、球迷设施及 T1–T8 方位参考。模型中的八组楼梯使用便于导航的 T1–T8 标识；不将其解释为官方完整楼梯编号或电梯复原。 |
| [FC Bayern — Level 6 map](https://fcbayern.com/binaries/content/assets/downloads/allianz-arena/events/logenkunden-portal/lageplaene/englisch/location-map-level-6) | 外围停车、公共交通、入口和公共设施的参照。 |
| [Zumtobel / FC Bayern — 2019 interior lighting PDF](https://fcbayern.com/binaries/content/assets/downloads/homepage/club/2019_09_19_pm_zumtobel_group_illuminates_allianz_arena_fc_bayern_en.pdf) | 屋顶内圈与径向接缝的红色照明设计。加入红色内圈与可见灯具；实际照度未做工程模拟。 |
| [NancyChoU — 球员入场通道，用户提供](https://www.douyin.com/video/7491434777543806266) | 浏览器可播放。实际查看约 00:10 的通道画面：深色顶面、双白色长灯带、红色几何墙、扶手、上行台阶和两侧队徽。模型据此修改。 |
| [凯罗同学 — 安联球场参观，用户提供](https://www.douyin.com/video/7222491675401243904) | 浏览器可播放。实际查看约 01:35 的新闻发布厅画面：红色阶梯座椅、后墙大队徽与柱框、台上麦克风及瓶装饮品。用于修正发布厅。 |
| [🌈把爱留在阿根廷 — 球场视频，用户提供](https://www.douyin.com/video/7215270235572653327) | 浏览器可播放。实际查看外部夜间航拍：红色外立面、偏暗的屋顶、亮着的入口与道路、周边建筑体量。用于对照夜景。 |
| [Three.js 官方 GitHub 仓库](https://github.com/mrdoob/three.js) | 通过用户选用的 GitHub 连接器读取官方仓库，确认项目来源；从 npm 官方发行资源获取并固定 0.186.1。仓库与随附许可采用 MIT。 |

## 资料差异的处理

模型新增的大厅至草坪参观连接，是为连续探索设计的近似通路，不是官方完整游览线路或实际球迷入场路线。其入口、长度、踏步与看台开口位置未经施工图核实。步行导航只说明本三维模型内的路线，不可作为实际场馆导航。

入口层更新参考建筑师介绍的连续混凝土结构、外壳下的到达空间和阶梯式入场路线；场馆现行 Facts & Figures 列出七个公共入口区域、32 个餐饮亭。模型采用七组开放入口与代表性服务设施表达这一组织，不把 66 跨柱梁、八组 84 级楼梯或柜台间距当作实测数量。服务窗口、门、信息板、家具和设备的尺寸与布置均为按人尺度设计的近似。场馆示意图是本模型的导览图，不可作为现场疏散图。

一些较旧的俱乐部介绍写有 50 米建筑高度、2,760 个气枕及较早的视频屏和灯具数量。当前场馆 Facts & Figures 写有 52 米、2,784 个气枕及更新的设施统计。本项目采用场馆当前页面的外廓和气枕统计，不混用旧页的计数。

更衣室参考照片有明确年份，不能据此声称它就是 2026 年完整现状。衣柜与房间布局仍参考该时期照片，球衣名单已独立更新为 2026-10-20 官网数据。视频只用于其中实际看到的画面，不将未播放完的片段当作完整测绘证据。

## 需要进一步实测才能逐处 1:1 的部分

外壳每个真实气枕的裁切、接缝、厚度及节点；看台每一块座位表与踏步构造；各室内房间的精确尺寸、灯具、门窗、吊顶及连接动线；所有公共设施与设备间；场外逐栋建筑与地形。现有场景提供这些重点空间的可探索视觉复原，不作工程精度承诺。

## 版本 1.5 的材质与室内细化

再次查看官方 2022 年更衣室照片，细化柜体凹槽与侧板、连续木质座面及支撑、低处鞋格、上部折叠装备和毛巾、白色顶面带与暗藏灯带。球衣增加衣服轮廓、薄厚与褶皱，空余装备位展示无号码训练服，不虚构新球员姓名或号码。

木纹、织物微纹、橡胶地面、柜体倒角、通风口、探测器、接待台及通道收口为程序化艺术化表达。材质纹理与 PMREM 金属反射由代码生成；没有把官方照片作为可再分发的场景纹理。接触阴影为静态近似，非完整光线追踪。

## 版本 1.8 的入场体验

版本 1.9 增补：以 [EA FC 26 Gameplay Deep Dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive) 的场地可读性和呈现为视觉方向参考；实际采用可再分发的 [Quaternius 动画](https://quaternius.com/packs/universalanimationlibrary.html)。双方各 11 人的构成参照 [IFAB Law 3](https://www.theifab.com/laws/latest/the-players/)，姓名号码来自 [拜仁一线队](https://fcbayern.com/en/teams/first-team) 及 [多特蒙德官方球员商店](https://shop.bvb.de/pages/shop-by-player)。这是展示阵容与场边岗位配置，并非某场真实比赛名单，亦未实现完整足球比赛规则与 AI。

入场体验使用现有西侧球员通道、逐级台阶和场边地面，增加 36 秒的连续第一人称入场、独立队友路线、看台观众、旗帜、灯光及声景。队列、队友最终站位、观众服色与动画为艺术化组织，不是某场真实比赛的同步复刻。

人物研究参考 [EA Sports FC 官方 Gameplay Deep Dive](https://www.ea.com/en-au/games/ea-sports-fc/pitch-notes/news/fc-24-gameplay-deepdive) 对身体移动的介绍，及 [Konami 官方对 Motion Matching 的说明](https://www.konami.com/games/us/en/topics/1756/)。这些页面仅用于理解动作与画面方向，没有提取游戏资产或声轨。人物基于可再分发的 MakeHuman 通用人体；来源、许可与生成过程见 [PLAYER-ASSETS.md](PLAYER-ASSETS.md)。人物并非球星扫描脸模，骨骼动作与布料细节也未达到这些商业游戏的制作精度。

看台声音采用 Work With Sounds / Torsten Nilsson 的 [足球现场录音](https://commons.wikimedia.org/wiki/File:WWS_FootballAustriavs.Sweden.ogg)，CC BY 4.0，截取并重新混音为通用球场声景；原场地为恩斯特·哈佩尔球场，不能当作安联球场或拜仁比赛的实录。详细归属和修改声明见根目录第三方说明以及随音频附带的 README。

## 版本 1.12 的照明与材质更新

补查 [官方 Press Club & Foyer 资料](https://allianz-arena.com/en/event-venue/rooms/presseclub--foyer) 的会议设施与空间信息，以及 [Zumtobel 场外照明升级资料](https://allianz-arena.com/binaries/content/assets/downloads/homepage/club/2021_05_28_pr_zg_esplanade_allianz_arena_shines_in_a_new_light_en.pdf?v=1622186962994)。保留此前官网更衣室和用户视频中确认的红色柜体、浅色顶面、灯带与深色通道关系。程序化生成草地、铺装、橡胶地面微纹、墙角遮蔽和夜间地面光池；未复制网页照片作为可再分发贴图。房间灯光分配按本模型的边界计算，灯光强度和色温是视觉调整，不能作为实际场馆照明参数。

## 版本 1.13 的近景模型

更衣室继续参考前述官网照片中的红色柜体、挂衣杆、折叠装备、长凳与衣物关系；看台采用代表性弧形塑料壳、座面与金属支架。发布厅软包、缝线和 84 个代表性座席为模型自身的细化布局，未取得实测座位表，不能据此宣称现场数量。赞助背景板改为与可见屏幕一致的 5:1 比例；除来自正式素材的俱乐部队徽之外，其他品牌采用程序绘制的简化视觉示意。织物、软包、衣物褶皱、吊顶接缝与漆面反光均由代码生成，没有引入商业足球游戏模型或扫描资产。近处座位替换与远处模型使用同一份座位坐标。


## 2.0 材质与荣誉展厅

- [Poly Haven CC0 许可](https://polyhaven.com/license)；资源清单见 `dist/assets/pbr/manifest.json`，可运行 `scripts/fetch-surfaces.py` 重新下载并校验。仅使用木纹颜色贴图，其余表面保留场馆配色并叠加扫描的法线与粗糙度。HDR 用于通用环境光和纯天空，不代表真实场馆拍摄。
- [拜仁官方荣誉](https://fcbayern.com/en/club/honours)：六次欧洲冠军年份，德甲与德国杯荣誉。
- [拜仁官方 2013 欧冠](https://fcbayern.com/en/club/honours/champions-league/champions-league-winner-2013)：温布利 2–1，多特蒙德、罗本第 89 分钟进球。
- [拜仁官方 2020 决赛报道](https://fcbayern.com/en/news/matchreports/2020/08/match-report-champions-league-final-paris-saint-german-v-fc-bayern-230820)：巴黎 0–1 拜仁，科曼第 59 分钟进球。
- 其余展品资料链接与简述分别保存在 `dist/honours.js`。奖杯形态与布展为程序化代表性建模，未使用官方扫描、比赛照片或商业游戏模型。
- 客队更衣室按 `matchday-roster.js` 的多特蒙德示范名单布置；不新增或声称真实赛程、首发或场馆内部实际陈设。


## 2.2 操作与动作参考

- [KONAMI 操作说明](https://www.konami.com/efootball/en/page/mobile_controller) 与 [2023 v2.2.0 更新说明](https://www.konami.com/efootball/en-us/page/2023/season2_patch-notes_v2-20)：了解手动选人、半自动 / 辅助换人与逼抢等常见机制。本项目自行实现并明确自己的辅助范围，未使用其代码或资产。
- [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html)：CC0 慢跑与冲刺动作，同原有行走资源一起使用与重定向。
- 本项目仍采用人机体验赛的简化规则；不声称复刻 eFootball 的全部操作、物理、AI 或动画系统。

## 4.0 场馆精修核对

2026-10-27 重新核对 [安联官方 Facts & Figures](https://allianz-arena.com/en/arena/facts/general-information) 与 [官方 FAQ](https://allianz-arena.com/en/faq)。参考其中 296 盏泛光灯、两块约 200 平方米主屏、42.5 米安装高度及背侧 36.8 平方米屏幕信息，补齐模型的灯具单元和背屏。草皮、门前磨损、摄像设备、补水医护用品、室内小件与照明配平为本项目制作的代表性设计；地图使用本模型的共享布局，未新增或声称取得官方室内施工图。
