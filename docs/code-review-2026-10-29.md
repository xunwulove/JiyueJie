# 极悦界 RN 项目 — 最近 10 提交代码审查报告

- 审查范围：`8062b24~1..ff68afa`（10 个提交，从新到旧）
- 仓库：`E:\xunwu\Deepseek\jiyuejie`
- 审查日期：2026-10-29
- 审查方式：仅审查，未修改任何代码/文件。逐条对照 `git show <sha>` diff 与工作区源码核实。

## 提交清单与定性

| # | SHA | 主题 | 定性 |
|---|-----|------|------|
| 1 | ff68afa | 探测多样本 + 排序样本保护 | 核心逻辑，重点审查 |
| 2 | e5220b0 | 弹窗百分号不折行 + 计数样式 + 每维度平均耗时 | UI 微调 |
| 3 | 4371a85 | 版本号 0.6.4 / versionCode 400035 | 仅版本号，略过 |
| 4 | f04a7a5 | 排序按能力切口径 + 探测耗时 tie-breaker | 核心逻辑，重点审查 |
| 5 | 1348163 | 可用率展示口径改为能力强弱决定 | 核心+卡片，重点审查 |
| 6 | b6f3879 | 弹窗重构：维度行两行布局 + 每维度平均耗时 | UI+探测耗时，重点审查 |
| 7 | f34729f | 普通源推荐歌单可用率并入维度进度条行 | UI |
| 8 | 2c3336d | 可用率统计变更实时同步卡片与弹窗 | 状态同步，重点审查 |
| 9 | bc71fa1 | 弹窗标题栏恢复标准左右内边距 | UI 修复 |
| 10 | 8062b24 | 沉浸层封面容器改外层 View 定尺寸 | UI 修复 |

> 说明：任务清单中提及的 `src/pages/topListDetail/index.tsx` 经 `git diff --stat 8062b24~1..ff68afa -- src/pages/topListDetail/` 核实**本次范围无任何改动**，未纳入审查。

---

## 缺陷清单（按优先级排序）

### P0（崩溃 / 数据错误 / 严重回归）

**未发现 P0。**
- 所有除零点均有守卫：弹窗 `count.success/(count.success+count.fail)` 仅在 `dim()`（要求 `success+fail>0`，pluginReliabilityDialog.tsx:144）或 `getRecommendRecordSync`（要求 `ok+fail>0`，pluginReliability.ts:428）非空时执行。
- 可选链 `?.`、`?? []`/`?? null` 覆盖了 search/getMediaSource/Sheet 等异步返回，未发现裸 `undefined` 访问。
- 样本保护、空数组、`!platform` 分支均已显式处理。

---

### P1（重要功能缺陷 / 明显问题）

#### P1-1 排序比较器：可用率“恰好相等”时完全跳过耗时 tie-breaker，与提交声明口径不一致
- **位置**：`src/core/pluginManager/index.ts` `getSortedPluginsWithAbility`（f04a7a5 引入）
- **代码**：
  ```js
  if (sa.rate !== sb.rate) {
      if (Math.abs(sa.rate - sb.rate) > 0.05) {
          return sb.rate - sa.rate;
      }
      const la = sa.latencyMs ?? Number.MAX_SAFE_INTEGER;
      const lb = sb.latencyMs ?? Number.MAX_SAFE_INTEGER;
      if (la !== lb) { return la - lb; }
  }
  return Math.sign((order[a.name] ?? Infinity) - (order[b.name] ?? Infinity));
  ```
- **问题**：耗时 tie-breaker 分支被包在 `if (sa.rate !== sb.rate)` 内部。当两源可用率**完全相等**（`sa.rate === sb.rate`）时，整个 `if` 被跳过，直接落到手动 order，**根本不会比较耗时**。
- **影响**：提交说明明确写“可用率差 ≤5% 时探测耗时短者优先”。差值为 0（≤5%）本应比较耗时，实际却被跳过。最常见的场景恰好就是“同分”——例如两个新源样本都 <3 被 `calcReliabilitySafe` 压到同为 0.5（pluginReliability.ts:497），此时耗时优势完全不参与排序，回退到手动 order，tie-breaker 在最需要它的同分校验场景失效。
- **修复建议**：把耗时比较移出 `sa.rate !== sb.rate` 门控，改为“先按可用率：差 >5% 才按 rate 排序；否则（含相等）进入耗时比较；耗时也相等再回退手动 order”。

#### P1-2 统计变更全局广播，探测期间所有插件卡片 O(N) 次重渲染
- **位置**：`src/core/pluginReliability.ts:89` `notifyReliability()`；订阅方 `src/pages/setting/settingTypes/pluginSetting/components/pluginItem.tsx:66`、`pluginReliabilityDialog.tsx:114`（2c3336d 引入）
- **问题**：`recordResult`/`recordRecommendResult` 每次写入都 `notifyReliability()`，无 platform 过滤。手动深度探测一轮，每个源写 search/parse/play/lyric 共约 4~5 次统计 → 每轮约 4~5N 次广播。而每个 `PluginItem` 的 `refresh()` 都 `setBest(getBestDimensionSync(...))`，**每次返回新对象引用**，即便数值未变也会触发本卡片重渲染。
- **影响**：N 个插件卡片在一轮探测内被调度约 4~5N 次 setState（O(N²) 量级的渲染压力）。探测是串行 + 1.5s 间隔，虽不致崩溃，但在插件较多时设置页会有可感知的重渲染抖动；`PluginItem` 的 `memo` 自定义比较器（pluginItem.tsx:331 仅比较 `prev.plugin`）挡不住内部 `setBest` 触发的更新。
- **修复建议**：`subscribeReliability(listener, platform?)` 增加 platform 过滤，只通知对应源的卡片；或在 `refresh` 内对旧/新 `best` 做浅比较（type+rate 都相同才 `setBest`），避免无变化的对象引用更新。

---

### P2（优化建议 / 需验证）

#### P2-1 dimMs 跨轮“合并”而非“替换”，UI 平均耗时与排序耗时混入不同轮次的维度
- **位置**：`src/core/probeService.ts:589-597`；镜像 `pluginReliability.ts:467 setDimMs`（b6f3879 / f04a7a5 引入）
- **问题**：`rec.dimMs = { ...(rec.dimMs ?? {}), ...item.dimMs }` 与 `setDimMs` 都是合并语义。自动探测是**按维度补探**（`expiredByPlatform`，probeService.ts:656-676），本轮只补 search，就会把新 search 耗时和上轮（可能 3 天前）的 parse/play 耗时合并在一起。
- **影响**：①弹窗某维度行的“平均 X.X s”实际是“该维度最近一次（跨轮）耗时”，并非同轮耗时；②排序 tie-breaker 的 `latencyMs`（pluginReliability.ts:551-560 对 play/parse/search 取均值）混合了不同时间点的耗时样本，统计口径不干净。
- **修复建议**：要么每轮用本轮 `item.dimMs` 整体替换对应维度（天然就是“该维度最近一次”），要么在 UI 文案改为“该维度最近一次耗时”以对齐实际语义。

#### P2-2 “最近探测：统一一行”的前提被部分自动探测打破，可能显示过期维度时间
- **位置**：`pluginReliabilityDialog.tsx:196-209 probeTime`（b6f3879 引入）
- **问题**：注释声称“探测时间全维度同轮一致，取任一有值维度”。但自动探测只刷新过期维度（probeService.ts:661-664），各维度时间戳本就来自不同轮次。`probeTime` 按 `[search,parse,play,lyric,sheet]` 顺序取第一个有值者，取到的可能是 3 天前的 search 时间，而非“最近一次探测”。
- **影响**：弹窗顶部“最近探测”时间可能偏旧，误导用户认为探测很久没跑。
- **修复建议**：取所有维度时间戳的 **max** 作为“最近探测”，而非顺序取首个。

#### P2-3 首绘竞态：refresh 只 await `ensureLoaded`，未 await `ensureRecommendLoaded`
- **位置**：`pluginReliabilityDialog.tsx:110` `getReliabilityRecord(...).then(refresh)`；`pluginItem.tsx:59`（2c3336d）
- **问题**：`refresh` 内会同步读 `getRecommendRecordSync`/`getBestDimensionSync`（读 `recommendMap`），但 `then` 只等了 `ensureLoaded`（reliabilityMap）。模块底部虽同时 fire-and-forget 了 `ensureRecommendLoaded()`（pluginReliability.ts:690），但若 recommend 存储加载更慢，首绘时 `recommendMap` 为空 → sheet 维度/sheet 口径标签暂缺；而 recommendMap 加载完成时**不会发 notify**，因此不会自纠正，要等下一次 `recordRecommendResult` 才刷新。
- **影响**：歌单类音源在冷启动后立即打开详情弹窗/卡片，可能短暂显示错口径（应显示“歌单”却显示合成百分比），且不自纠。历史既有模式，非本范围新引入，但本次把实时订阅做实后更值得一并修。
- **修复建议**：`refresh` 前 `await Promise.all([ensureLoaded(), ensureRecommendLoaded()])`，或 recommendMap 加载完成后补发一次 notify。

#### P2-4 展示口径与排序口径对“小样本”处理不一致：卡片显示 100%，排序却按 0.5
- **位置**：展示 `pluginReliability.ts:280-293 getBestDimensionSync`（单一口径有数据时不受样本下限限制）；排序 `pluginReliability.ts:486-501 calcReliabilitySafe`（<3 样本一律 0.5）（ff68afa 引入）
- **问题**：一个源只跑了 1 轮且成功（1/1=100%），卡片/弹窗大字会显示“100%”（单一口径时不做样本保护），但排序主分 `calcReliabilitySafe` 因样本<3 回退 0.5。
- **影响**：用户看到徽章“100%”，但该源在换源/排序时并不被优先，观感与实际排序行为不一致。代码注释已说明这是有意为之（展示要“有数据即显示”，排序要“防虚高”），属口径设计而非 bug，但建议在底部说明里补一句“样本<3 时排序暂按中性值”。
- **修复建议**：纯文案对齐，无需改逻辑。

#### P2-5 卡片 badge 语义变化：可搜索源若歌词维度最高，徽章从“%”变“歌词”
- **位置**：`pluginItem.tsx:86-97 tagText/tagBg`（1348163 引入）
- **问题**：旧逻辑按静态 `supportedMethods` 判定“纯歌词源/纯歌单源”。新逻辑按 `getBestDimensionSync().type`（三口径取最高）决定 badge。于是一个**同时具备 search+getMediaSource 的完整源**，若其歌词维度样本更多/成功率更高（例如歌词 3/3=100% > 合成 60%），卡片徽章会显示“歌词”，但它其实是可搜索可播放的常规源。
- **影响**：badge 从“源类型标签”变成了“当前最强维度标签”，可能误导用户以为这是纯歌词插件。提交说明确为“能力强弱决定”，属预期行为，但 UX 副作用需确认。
- **修复建议**：若希望 badge 仍表达“源类型”，可在 type 为 lyric/sheet 时额外要求该源**不具备** search/getMediaSource（恢复旧的纯能力判定作为 badge 条件，展示口径仍用 best）。

#### P2-6 历史遗留硬编码色 / 硬编码字号（非本次引入，但违反本项目强制 UI 规范）
- **位置**：
  - `pluginReliabilityDialog.tsx:136,139,274,277,282` 硬编码 `"#4CAF50"` / `"#E53935"`；`:280` `colors.divider ?? "#EEF1F4"`；`:403` 进度条轨道 `backgroundColor:"#EEF1F4"`；`:383` `syntheticValue: { fontSize: 34 }` 未走 fontSizeConst。
  - `pluginItem.tsx:80,83` `"#4CAF50"`/`"#E53935"`；`:374` 徽章文字 `color:"#FFFFFF"`。
- **核实结论**：经与基线 `249961d` 对比，以上硬编码色/字号**在本次 10 提交之前已存在**，本范围未新增（仅 f34729f 删除了 `recommendBox` 的 `"#F6F9FB"`）。但它们确实违反“颜色必须走 useColors() token、字号必须走 uiConst/fontSizeConst”的硬性规范，建议借机收敛。
- **修复建议**：把高/中/低可用率的绿/红抽到 `useColors()` 主题 token（如 `colors.success`/`colors.error`），`fontSize:34` 换成 fontSizeConst 档位。

#### P2-7 第二行元信息长文本在窄屏被 `numberOfLines={1}` 截断
- **位置**：`pluginReliabilityDialog.tsx:326-341 dimMetaRow/dimMetaText`（e5220b0）
- **问题**：文案为“成功 N · 失败 M · 平均 X.X s”且 `numberOfLines={1}`、整行 `justifyContent:flex-end`。在小屏/车机窄宽下，计数 + 耗时拼起来可能超过一行宽度，尾部“平均耗时”被省略号截断。
- **影响**：窄屏下平均耗时可能看不到。
- **修复建议**：窄屏允许换行，或把“平均耗时”移到第一行进度条右侧，或在宽度不足时隐藏耗时。

#### P2-8 其它轻微项
- `dimMsMap`（pluginReliability.ts:464）只增不减，每个曾探测过的 platform 永久驻留内存，量小可忽略；如需可在 `resetReliability` 时一并清空。
- `setDimMs` 为纯内存镜像，App 重启后 tie-breaker 在首次探测前失效（代码注释已说明），属预期。
- 排序比较器存在 5% 带宽下的非传递性可能（A-B 比耗时、B-C 比耗时、A-C 超带宽比 rate），V8 TimSort 对非一致比较器不报错但顺序不确定；影响仅为插件顺序跨次运行可能轻微抖动，建议见“整体建议 1”一次性消除。

---

## 整体优化建议（附证据位置）

1. **排序改为“预计算 key + 单一稳定比较”，一次性消除 P1-1 同分漏耗时与 P2-8 非传递性。**
   在 `getSortedPluginsWithAbility` 内先为每个插件算出 `{ rate, latencyMs, manualOrder }`，再用一个一致的比较函数：`rate 差>0.05 → rate 降序；否则 latency 升序（缺失视为最大）；再否则 manualOrder 升序`。证据：pluginManager/index.ts:1137-1160。

2. **统计订阅增加 platform 作用域，消除探测期 O(N²) 重渲染（P1-2）。**
   `subscribeReliability(listener, platform?)`，`notifyReliability(platform?)` 只回调同源订阅者；卡片再叠一层“type+rate 未变则不 setState”的浅比较。证据：pluginReliability.ts:89-95、pluginItem.tsx:53-58。

3. **dimMs 改为“每维度最近一次”语义并与 UI 文案对齐，避免跨轮混用（P2-1）。**
   合并改为按维度覆盖（`rec.dimMs[dim] = item.dimMs[dim]` 逐维赋值即可天然得到“最近一次”），UI 标注“该维度最近一次耗时”。证据：probeService.ts:589-597。

4. **弹窗/卡片首绘统一等待 recommendMap 就绪，消除歌单维度首帧竞态（P2-3）。**
   `refresh` 入口 `await ensureRecommendLoaded()` 后再读 sheet；或 recommend 加载完成补发 notify。证据：pluginReliabilityDialog.tsx:110-112、pluginItem.tsx:59-63。

5. **借机收敛硬编码色与字号到主题 token（P2-6）。**
   高/低可用率色与 `fontSize:34`、徽章 `#FFFFFF` 统一走 useColors/fontSizeConst，避免后续新代码继续沿用这些非法常量。证据：pluginReliabilityDialog.tsx:136-139,383,403；pluginItem.tsx:80-83,374。

---

## 回归核查结论
- `bc71fa1`（弹窗标题栏 paddingHorizontal:0 移除）与 `8062b24`（沉浸层封面外层 View 定尺寸）为纯样式修复：immersiveLayer 已无 `styles.cover` 残留引用（grep 确认仅 coverPane/coverImage），尺寸由外层 View `aspectRatio:1` + 内层 100% 填充，方案合理，未见回归。
- `f04a7a5` 修复了弹窗歌单平均耗时单位 bug（`sheetRecord.latency` 毫秒未除 1000，pluginReliabilityDialog.tsx:219 已修）。
- `ff68afa` 多样本改造（搜索多关键词 fallback、解析/歌词/歌单前 3 样本顺延）均为“任一成功即可用”的宽松判定，避免单样本系统性误判，逻辑闭环；成功/失败仍按“每轮每维度记 1 次”，口径一致，未见计数错乱。
- 样本保护（`BEST_DIM_MIN_SAMPLES`/`SORT_MIN_SAMPLES`）在展示与排序两侧逻辑自洽，除 P2-4 所述“展示 vs 排序口径差”为有意设计外，无逻辑错误。
