# 图标迁移对照：Heroicons → Lucide

日期：2026-10-31
工程：极悦界（`E:\xunwu\Deepseek\jiyuejie`，源鉴同体系）
方案：路线 A——保留自建 SVG 资产体系（`src/assets/icons/*.svg` + `generate-assets.mjs` 生成 `icon.tsx`），仅将图标源从 Heroicons 换成 Lucide（ISC 许可，lucide.dev / lucide-static）。

## 统计

- 现有图标：82 个
- 同名直迁：23
- 去 `-outline` 后缀直迁：12
- 语义映射（Heroicons → Lucide 不同名）：43
- 特制图标替换：3（motion-play→list-start、lyric→text-quote、strategy→sliders-horizontal）
- 死图标删除：1（javascript，全工程 0 引用）
- 迁移后图标：**75 个**（82 − 删除 1 − 合并重复目标名）

## 一、同名直迁（23）

| 现名 | Lucide 名 |
|---|---|
| arrow-left | arrow-left |
| calendar-days | calendar-days |
| check | check |
| crosshair | crosshair |
| ellipsis-vertical | ellipsis-vertical |
| folder-plus | folder-plus |
| heart | heart |
| heart-outline | heart |
| link | link |
| minus | minus |
| moon | moon |
| pause | pause |
| play | play |
| plus | plus |
| server | server |
| shuffle | shuffle |
| signal | signal |
| trophy | trophy |
| user | user |
| wifi | wifi |
| folder-outline | folder |
| home-outline | home |
| language | languages |

## 二、去 -outline 后缀直迁（12）

Heroicons 的 `-outline` 与 Lucide 默认线条风格对应，去掉后缀即 Lucide 名。

| 现名 | Lucide 名 |
|---|---|
| alarm-outline | alarm-clock |
| clock-outline | clock |
| document-outline | file-text |
| fire-outline | flame |
| pause-circle-outline | circle-pause |
| play-circle-outline | circle-play |
| power-outline | power |
| question-mark-circle | circle-help |
| shield-keyhole-outline | shield |
| sort-outline | arrow-up-down |
| t-shirt-outline | shirt |
| trash-outline | trash-2 |

## 三、语义映射（43）

Heroicons 命名 → Lucide 最贴切图标（已验证存在）。

| 现名 | Lucide 名 | 说明 |
|---|---|---|
| archive-box-x-mark | archive-x | 归档删除 |
| arrow-down-tray | download | 下载 |
| arrow-long-left | arrow-left-to-line | 长左箭头（返回列表顶） |
| arrow-path | refresh-cw | 环形刷新 |
| arrow-right-end-on-rectangle | log-in | 进入 |
| arrow-up-tray | upload | 上传 |
| arrow-uturn-left | rotate-ccw | U 形回转 |
| arrows-left-right | arrow-left-right | 左右交换 |
| bars-3 | menu | 三线菜单 |
| bookmark-square | square-bookmark | 方形书签 |
| chat-bubble-oval-left-ellipsis | message-circle | 对话气泡 |
| check-circle | circle-check | 实心需 fill 属性 |
| check-circle-outline | circle-check | 线条默认 |
| circle-stack | layers | 数据层叠 |
| code-bracket-square | square-code | 代码方块 |
| cog-8-tooth | settings-2 | 齿轮设置 |
| exclamation-circle | circle-alert | 圆形警示 |
| fire | flame | 火焰（实心需 fill） |
| folder-music-outline | folder-heart | Lucide 无 folder-music；语义最贴近"音乐收藏夹"；如需朴素可用 folder-open |
| font-size | a-large-small | 字号（A/a） |
| hand-thumb-up | thumbs-up | 点赞 |
| identification | id-card | 身份卡 |
| inbox-arrow-down | inbox | 收件箱 |
| information-circle | info | 信息 |
| link-slash | unlink | 断开链接 |
| magnifying-glass | search | 搜索 |
| musical-note | music | 音符 |
| pencil-outline | pencil | 铅笔 |
| pencil-square | square-pen | 编辑方块 |
| playlist | list-music | 播放列表 |
| repeat-song | repeat | 单曲循环（列表） |
| repeat-song-1 | repeat-1 | 单曲循环 1 |
| server-stack | server | 服务器栈 |
| skip-left | skip-back | 上一首（注意：Lucide 方向语义为 back/forward） |
| skip-right | skip-forward | 下一首 |
| speaker-wave | volume-2 | 音量 |
| speedometer | gauge | 仪表盘 |
| translation | languages | 翻译/语言 |

## 四、特制图标处理（4）

用户拍板："特制图标如果可以替换的话也尽量替换"。3 个替换 + 1 个删除：

| 现名 | 处理 | Lucide 名 | 用途 |
|---|---|---|---|
| motion-play | 替换 | list-start | "添加到下一首播放"（列表+播放箭头，语义最贴） |
| lyric | 替换 | text-quote | "查看歌词"（引号文本，Lucide 无歌词专属图标） |
| strategy | 替换 | sliders-horizontal | "按可用率排序"开关（调节/排序语义） |
| javascript | 删除 | — | 全工程 0 引用，死图标 |

## 五、执行注意点

1. **下载源**：lucide.dev（每个图标一个 24x24 SVG，stroke 2px）或 lucide-static npm 包
2. **命名**：SVG 文件名 = Lucide 名（如 `clock.svg`），替换同名旧文件；`generate-assets.mjs` 自动生成 `icon.tsx`，**代码层 `<Icon name="...">` 的 name 需要全工程同步改**（直接改旧名会 TS 报错——generate-assets 会重新生成 IIconName 类型）
3. **solid 图标**：`check` / `play` / `circle-check` / `flame` 等实心用途需在 Lucide SVG 上加 fill（Lucide 线条图标默认 fill="none"；实心版可下载 `-fill` 后缀变体或代码层加 fill 属性）
4. **skip-back / skip-forward**：原 `skip-left`/`skip-right` 语义是"上一首/下一首"，Lucide 的 back/forward 方向一致，无需翻转
5. **视觉核查**：迁移后全 App 抽查图标粗细/圆角观感（Lucide 线条更锐利）
6. **源鉴**：fork 自极悦界同体系，若本工程确认迁移，源鉴用同一套映射即可

## 待用户确认项（已拍板 ✓）

- [x] `folder-music-outline` → `folder-heart`（已选）
- [x] solid 图标接受线条版（Lucide 默认，统一线条风格）
- [x] 特制图标尽量替换（3 替换 + javascript 删除）

## 六、执行记录（2026-10-31）

1. **下载**：`E:\Temp\lucide_migrate_download.py` — 从 unpkg `lucide-static@latest/icons/<name>.svg` 下载 75 个唯一目标名（踩坑：SVG 带 `<!-- @license lucide-static ... -->` 注释头，`startswith(b"<svg")` 校验误判 → 放宽为 `b"<svg" in raw` + 正则剥离注释；arrow-up-down 偶发超时，重试补下成功）
2. **资产**：`lucide_migrate_assets.py` — 清理（去 `class`、压缩单行）→ 清空 `src/assets/icons`（REMOVED_OLD 82）→ 拷入 75 新 SVG
3. **生成**：`npm run generate-assets` → "Generate Succeed. 75 assets."（icon.tsx 重新生成，IIconName=75）
4. **代码改名**：`lucide_migrate_rename.py` — 正则覆盖 `name="x"`/`icon: "x"`/`icon="x"` 等 → 45 文件 140 处；tsc 报 16 处残留（三元表达式、`name={...}` 花括号内联、函数裸参数、类型声明联合等正则未覆盖写法）→ 手工逐行精修 19 处
5. **验证**：`npx tsc --noEmit` **TSC_EXIT=0**；反查残留仅剩 `lyric` 领域字符串（ProbeDim/缓存类型，合理保留），图标旧名全部清零
6. **打包**：assembleRelease（版本号保持 0.6.4 / versionCode 400035 不变）→ aapt 验证
