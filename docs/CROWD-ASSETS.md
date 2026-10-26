# 比赛日观众 · 3.1

旧版看台使用过窄的程序绘制人形，红色衣服与红座椅混在一起，从草坪看像重复花纹。3.1 保留分区实例绘制，更新人物轮廓、衣服和肤色，增加有距离与数量限制的坐姿立体观众。普通参观默认空场；开启比赛日自由参观、跟队入场或亲自上场后显示观众。

## 资源与生成记录

- 文件：[`dist/assets/crowd/supporters-atlas-3100.png`](../dist/assets/crowd/supporters-atlas-3100.png)，1254 × 1254，RGBA，1,721,568 字节。
- 由 Codex 内置 **imagegen** 工具生成，没有使用 CLI，没有复制足球游戏的观众或真实人物照片。
- 八名虚构成年球迷，包含不同肤色、服装、围巾与手势。它是生成的写实风格图集，不是现场摄影、真人扫描或某位球迷的肖像。
- 保留工具原图，没有后期裁改。生成位置没有严格落入等宽网格，因此 `crowd-layout.js` 为八个人分别记录 UV 边界，按像素比例确定宽度，避免裁头或横向拉伸。
- 近景人物和旗帜为本项目代码生成；没有为每位观众加载骨骼、材质或独立网格。图集随项目提供，俱乐部标识权利仍见根目录第三方声明。

实际使用的完整提示词：

```text
Use case: photorealistic-natural. Asset type: transparent crowd sprite atlas for a Three.js football stadium. Create exactly EIGHT distinct fictional adult football supporters in a strict evenly spaced 4-column by 2-row grid on a square canvas. Each of the eight equal rectangular cells contains exactly ONE isolated complete seated person, from head to shoes, facing forward toward the camera, seated on an invisible stadium chair, feet aligned near the bottom of their cell. Use a consistent eye-level camera and consistent scale, with the whole figure filling about 88% of cell height and 75% of cell width, leaving clear transparent gutters. Realistic adult proportions with broad readable shoulders, natural heads and hands; no skinny stick figures. Diverse men and women, different adult ages, skin tones and hair. Clothing is a varied Munich football crowd palette: red jerseys, burgundy tops, dark charcoal jackets with red-white scarves, cream sweatshirt, gray hoodie and navy jacket. Four fans clap or rest hands on knees; four lift a red-white scarf or hands in support, with all hands kept inside their own cell. Photographic detailed fabric and believable faces, neutral soft frontal stadium lighting with subtle shadows on the bodies, consistent clean cutout edges. Absolutely transparent background, NO chairs, NO stadium scenery, NO ground plane, NO grid lines, NO labels, NO letters, NO logos, NO watermark. Do not overlap cells, do not crop heads, hands or feet. This image is a technical atlas: regular 4 by 2 placement and generous transparent separation are essential.
```

## 显示与性能

观众只从实际生成的座椅记录中选位，确定性保留约 93.5% 的座位；当前场景生成 74,765 名观众，其中 2,456 名在示范客队区。数量是模型输出，不作为安联球场真实容量的证据。手机和桌面使用同一份占座布局，不再跳过整排来省性能。

远景最多 24 组实例平面，每人两个三角形，共用一张透明图集。近景为一个实例网格，桌面最多 384 人、手机最多 128 人，选择半径分别为 34 / 27 米；切换时隐藏对应平面，避免一张座位重复出现两个人。空间索引限制附近搜索，站定不重建全部实例矩阵。

立体人形为简化的坐姿几何，不是可近距离识别的球迷脸部模型。手臂、围巾和轻微身体摆动使用独立相位；八面旗帜与六幅栏杆横幅补充看台氛围。客队区按可选对手更换红色衣物的配色，但区位、服饰、旗帜及横幅均为演示布置，不是具体比赛的真实球迷分区或现场布置。

比赛右上「助威」或 G 会触发声浪和动作，1.5 秒内防止重复触发；主队射门、抢断、扑救和进球产生不同强度反应。降低动态效果时停止人物和旗帜的摆动。贴图下载失败时保留轻量人形，重新开球可以重试。

## 验证

`crowd.test.js` 检查图集尺寸、帧边界、确定性占座、近景数量预算、平面替换、静止时不重建矩阵、失败重试、坐姿落地及降低动态效果。`playable-match.test.js` 检查助威不改变比分和球权，加载、暂停与退出后不能触发。真实着色器和画面另经浏览器检查。

3.1 发布前共通过 162 项自动检查，并检查了默认桌面、390 × 844 竖屏及 844 × 390 横屏中的观众显示、助威按钮、比赛镜头和退出恢复。手机尺寸使用浏览器视口模拟，不代表实体手机的性能测试。

![中层看台实测：近景坐姿观众与远景人群](images/crowd-3100.png)
