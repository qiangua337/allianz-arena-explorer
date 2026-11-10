# 比赛日人物资源

人物参考真实人体比例与足球游戏的入场呈现方式，使用 MakeHuman 通用人体拓扑、皮肤和骨骼权重。脸部不代表对应球星的扫描肖像；未提取《实况足球》、eFootball 或 EA Sports FC 的模型、动作、贴图与音乐。

## 当前版本 9.1.0

当前运行资源为 `dist/assets/players/footballer-910.json/bin`。门将手套由本项目生成，掌面、掌背、四指与拇指构成有真实厚度的闭合表面，手指之间保留间隙；护垫和腕带合入原人物图集。两只手各为连续封闭网格，不用贴片遮挡代替掌面体积。

门将使用单独的 `keeperWrists`：裁去腕带下原有裸皮，腕带后缘按网格切口重叠，并继承前臂与手腕蒙皮，减少侧扑和转腕时腕口露皮。外场球员继续使用原有裸手和手腕；装备仅改变模型外观，不扩大门将物理扑救范围。

| 项目 | 9.1.0 资源与预算 |
| --- | --- |
| 骨架与人物材质 | 沿用原 18 骨骼、单图集材质及一次人物主体绘制 |
| 完整 short02 外场 / 门将网格 | 27,092 / 27,016 个三角形；门将净少 76 面 |
| 共享二进制 | 1,432,728 B；相对 850 的 1,128,488 B 增加 304,240 B，约 27% |
| 共享方式 | 两种发型 × 外场 / 门将装备，共四种基础网格，复用于人物；中远距离继续简化 |
| 旧资源 | 850、840 与最初版本保持原字节，供旧页面加载 |

外场慢速侧移和斜移在原行走片段上平滑转髋，最大约 60°，由脊柱与颈部共同分摊回看；落脚窗口依据实际 `Walk_Loop` 调整，过零反向时连续释放和重新落脚，不清空仍在支撑的脚。不移动模拟中的人物世界坐标，也不改变服务器与预测共用的移动公式。这层修正随慢跑混合淡出，门将、裁判和坐席保持原动作轴线。低频落地 / 离地边界仍有采样限制；手套尚无逐指抓握和随球高精确贴球，人物也没有球星肖像扫描或商业足球游戏的动作捕捉库。

以下记录说明保留的基模、来源与再生成方法。

8.5 使用 `footballer-850.json/bin`，从实际短裤腰口的 40 条开边补出连续同色封片，继承原腰口蒙皮权重。新增 40 个三角形与 41 个顶点，二进制只增加 2,864 B；骨骼仍为 18，封片合并进原短裤部分和图集，不增加人物材质或绘制调用。旧 `footballer-840.json/bin` 与 `footballer.json/bin` 保持原字节，供尚未刷新的旧页面继续加载。

沿用 8.4 的面部独立 UV 区域，原有位置、法线与权重保持，512 像素图集内的面部像素面积约为原来的 2.36 倍。眉毛保留原透明度，不先填不透明灰底。球鞋补圆头、鞋底和六颗鞋钉；共享鞋底相对脚踝的真实边界写入 `bootBounds`，供接触动作约束使用。放松手形预烘焙于模型。

3.1 看台观众另用八组生成的虚构球迷图集和本项目编写的简化坐姿实例几何，不使用场内球员的骨骼系统。完整提示词、图集文件与远近数量预算见 [CROWD-ASSETS.md](CROWD-ASSETS.md)。

3.0 沿用同一套通用人体，运行时按可选对手更换首发、替补、球衣配色和号码图集；新增皇马、巴萨与曼城使用自绘配色及字母标记，巴萨采用蓝红条纹。远景网格使用较疏的纹理坐标聚类与位置聚类，仍保留各材质区域及归一化骨骼权重。远处人物以较低频率更新骨骼，暂停不重复计算。门将接球增加原创抬臂动作，传射与抢断仍由现有 CC0 移动片段叠加原创小幅动作实现。

## 来源及许可

- [MakeHuman 核心资产许可](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)：网格、目标形变、材质及衣物数据为 CC0；不包含 MakeHuman 的 AGPL 程序代码。
- [MakeHuman system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)：young_caucasian_male、young_african_male 皮肤，short02 短发、low-poly 眼睛、brown_eye、eyebrow002。
- [Shirts 01](https://static.makehumancommunity.org/assets/assetpacks/shirts01.html)：MargaretToigo / MRT 的 T-shirt_basic_tucked，CC0。
- [Quaternius Universal Animation Library Standard](https://quaternius.com/packs/universalanimationlibrary.html)：CC0 行走、慢跑、冲刺、站立、坐姿与交谈动画。原包由作者发布在 [OpenGameArt](https://opengameart.org/content/universal-animation-library)，原始 License.txt 随项目附带。
- CC0 全文位于 `dist/assets/players/LICENSE.CC0.txt`。俱乐部队徽权利单独保留，见根目录第三方声明。

## 再生成资源

正常启动或部署无需 Python；已生成的资源随仓库附带。更改人体网格时使用 Python、numpy 和 Pillow，运行：

```sh
python scripts/build-players.py /absolute/path/to/makehuman-source-cache
```

仅重新生成几何、保留现有贴图时加 `--geometry-only`。

9.1.0 的原创手套与门将腕口构建由 `scripts/keeper_glove.py` 配合 `scripts/build-players.py` 完成，仍只需 numpy 和 Pillow。默认生成 910 资源，不覆盖已有 850、840 或最初版本文件；原 CC0 来源及许可继续保留。

缓存包含以下文件；保留 ZIP 里的相对目录：

| 缓存路径 | 上游来源 |
| --- | --- |
| `base.obj` | makehumancommunity/makehuman 的 `makehuman/data/3dobjs/base.obj` |
| `male.target` | 同仓库 `makehuman/data/targets/macrodetails/caucasian-male-young.target` |
| `average.target` | 同目录 `universal-male-young-averagemuscle-averageweight.target` |
| `muscle.target` | 同目录 `universal-male-young-maxmuscle-averageweight.target` |
| `default.mhskel`、`default_weights.mhw` | 同仓库 `makehuman/data/rigs/` |
| `skins/young_caucasian_male/`、`skins/young_african_male/` | system assets 包 |
| `hair/short02/`、`eyes/low-poly/`、`eyes/materials/brown_eye.png`、`eyebrows/eyebrow002/` | system assets 包 |
| `clothes/toigo_basic_tucked_t-shirt/` | shirts01 包 |

脚本将衣服、短发与眼睛按 MHCLO 的人体表面锚点和偏移重新贴合，手指预置为放松弯曲姿态。输出共享二进制网格、布局清单与 WebP 贴图，运行时使用 18 根骨骼。衣摆与短裤重叠，短裤腰口有连续封片，鞋子有完整前后封口。近处保留完整网格，远处通过保持 UV 分区和骨骼权重的顶点聚类降低细节；每个人的身体合成一个图集材质，手机图集为 512 像素。

资源在主动开启比赛日或训练后加载。拜仁号码共用 `roster.js`；对手、首发、替补和岗位来自 `matchday-roster.js`，号码核对俱乐部官网，首发为展示安排。52 人按发型与装备复用共享网格，拥有独立动画相位和世界位置；队列在通道按双方各 11 人排列，3 名裁判领队，第 4 官员在场边，替补与助教使用坐姿。训练只显示当前课程的参与者。

动作重定向脚本：将 `AnimationLibrary_Godot_Standard.glb` 保存为缓存中的 `Quaternius-Standard.glb`，运行 `node scripts/build-walk-cycle.mjs /absolute/path/to/cache`。脚本采样作者动画，在世界空间转换骨骼方向和绑定姿态后写出 `walk-cycle.json`；运行时按实际位移推进行走周期，并在真实台阶上修正落脚高度。普通地面不再使用手写摆腿周期。

## 检查

`npm run check` 覆盖权重归一化、人体与衣服位置、鞋封口朝向及闭合性、实际蒙皮鞋底落地、独立人物路线、入场路线与建筑地面和碰撞、音频加载 / 静音 / 暂停 / 退出 / 失败重试。9.1 增加实际手套厚度、闭合拓扑、手指间隙、腕带下表皮遮挡和低细节网格装备保留检查，以及低频侧移支撑、停步、反向与传射触球回归。视觉仍需要检查通道近景、正面、侧面、步行动作和手机尺寸；这些模块与几何检查不能替代实体手机帧率测量。


版本 2.2 从同一份 Standard 包增加 `Jog_Fwd_Loop` 与 `Sprint_Loop`，由相同脚本重新采样与重定向。运行时按实际移动速度平滑混合三档步态，循环相位按位移推进。足球传射与出脚的小幅骨骼叠加位于 `football-action-pose.js`，保留支撑腿和根节点的原始落地姿势；它是本项目制作的动作反馈，不是从商业游戏提取的动画。
