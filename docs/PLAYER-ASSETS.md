# 比赛日人物资源

人物参考真实人体比例与足球游戏的入场呈现方式，使用 MakeHuman 通用人体拓扑、皮肤和骨骼权重。脸部不代表对应球星的扫描肖像；未提取《实况足球》、eFootball 或 EA Sports FC 的模型、动作、贴图与音乐。

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

脚本将衣服、短发与眼睛按 MHCLO 的人体表面锚点和偏移重新贴合，手指预置为放松弯曲姿态。输出共享二进制网格、布局清单与 WebP 贴图，运行时使用 18 根骨骼。衣摆保持与短裤重叠，鞋子有完整前后封口。近处保留完整网格，远处通过保持 UV 分区和骨骼权重的顶点聚类降低细节；每个人的身体合成一个图集材质，手机图集为 512 像素。

资源在主动开启比赛日后加载。拜仁号码共用 `roster.js`；对手、首发、替补和岗位来自 `matchday-roster.js`，号码核对俱乐部官网，首发为展示安排。52 人共用网格，拥有独立动画相位和世界位置；队列在通道按双方各 11 人排列，3 名裁判领队，第 4 官员在场边，替补与助教使用坐姿。

动作重定向脚本：将 `AnimationLibrary_Godot_Standard.glb` 保存为缓存中的 `Quaternius-Standard.glb`，运行 `node scripts/build-walk-cycle.mjs /absolute/path/to/cache`。脚本采样作者动画，在世界空间转换骨骼方向和绑定姿态后写出 `walk-cycle.json`；运行时按实际位移推进行走周期，并在真实台阶上修正落脚高度。普通地面不再使用手写摆腿周期。

## 检查

`npm run check` 覆盖权重归一化、人体与衣服位置、鞋封口朝向及闭合性、实际蒙皮鞋底落地、独立人物路线、入场路线与建筑地面和碰撞、音频加载 / 静音 / 暂停 / 退出 / 失败重试。视觉仍需要检查通道近景、正面、侧面、步行动作和手机尺寸。


版本 2.2 从同一份 Standard 包增加 `Jog_Fwd_Loop` 与 `Sprint_Loop`，由相同脚本重新采样与重定向。运行时按实际移动速度平滑混合三档步态，循环相位按位移推进。足球传射与出脚的小幅骨骼叠加位于 `football-action-pose.js`，保留支撑腿和根节点的原始落地姿势；它是本项目制作的动作反馈，不是从商业游戏提取的动画。
