# 比赛日人物资源

人物参考真实人体比例与足球游戏的入场呈现方式，使用 MakeHuman 通用人体拓扑、皮肤和骨骼权重。脸部不代表对应球星的扫描肖像；未提取《实况足球》、eFootball 或 EA Sports FC 的模型、动作、贴图与音乐。

## 来源及许可

- [MakeHuman 核心资产许可](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)：网格、目标形变、材质及衣物数据为 CC0；不包含 MakeHuman 的 AGPL 程序代码。
- [MakeHuman system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)：young_caucasian_male、young_african_male 皮肤，short02 短发、low-poly 眼睛、brown_eye、eyebrow002。
- [Shirts 01](https://static.makehumancommunity.org/assets/assetpacks/shirts01.html)：MargaretToigo / MRT 的 T-shirt_basic_tucked，CC0。
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

脚本将衣服、短发与眼睛按 MHCLO 的人体表面锚点和偏移重新贴合。输出共享二进制网格、布局清单及最长边为 1024 / 512 / 256 像素的 WebP 贴图。近距离使用连续人体网格和 18 根骨骼，手指与面部静态，腿部使用两段式落脚求解；台阶减小步幅。衣摆保持与短裤重叠，鞋子有完整前后封口。

资源在选择入场体验后按需加载，六人共用几何和皮肤、头发、眼睛贴图；球衣姓名和号码来自现有 `roster.js`。队友沿独立世界路线行走，访客的倒退、平移或停步不会改变队友的位置。到达场内各自站位后停止前进。

## 检查

`npm run check` 覆盖权重归一化、人体与衣服位置、鞋封口朝向及闭合性、实际蒙皮鞋底落地、独立人物路线、入场路线与建筑地面和碰撞、音频加载 / 静音 / 暂停 / 退出 / 失败重试。视觉仍需要检查通道近景、正面、侧面、步行动作和手机尺寸。
