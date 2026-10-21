# 参考资料与复原判断

研究日期：2026-10-20 至 2026-10-21。主要采用场馆、俱乐部、建筑事务所的公开资料，以及用户提供的可播放视频画面。并未取得施工图、完整室内尺寸或测绘数据。

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
