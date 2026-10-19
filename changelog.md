# 极悦界（MusicFree fork）变更记录

> 本段为 fork「极悦界」的版本记录；下方为上游 MusicFree 原版 changelog（未改动）。
> 版本源：`package.json` version（versionName 读取它），versionCode 见 `android/app/build.gradle`。
> 发版链路：gitee `xunwulove/jiyuejie` latest tag 固定附件（version.json + 两个 APK），见 PROJECT_HANDOVER.md §6。

`2026.10.19（未发版改动）`
1. 【变更】**自动搜索歌词默认开启**（`components/dialogs/components/lyricSettingDialog.tsx` + `core/lyricManager.ts`）：`lyric.autoSearchLyric` 默认值 false→true——设置开关初始值 `?? false` 改 `?? true`，歌词加载逻辑 `getConfig("lyric.autoSearchLyric")` 改 `?? true`（未显式配置时歌词缺失自动搜索）。语义：未设置过该键的用户默认开启（含老用户未手动关闭过的）；显式关闭过的用户存储 false、读取仍为关，不受影响
2. 【修复】**底部面板（Panel）弹出只显示一片阴影、菜单内容不可见**（`panels/base/panelBase.tsx`）：根因=ef2a839 给 Panel 补 elevation 时，面板容器 `kbContainer`（KeyboardAvoidingView 根）只设了 `zIndex/elevation:15310` 却**没有 position、没有尺寸（0×0）**——对照 Dialog 侧 `backContainer`（ef98369/717b872 同范式：`position:absolute + width/height:100%` 全屏容器才带 elevation），0×0 静态 View 的 elevation 在 Android 不生效，面板子树仍落回普通绘制序，被已 elevation 的全屏 Pressable 暗色拦截层（`maskWrapper` 15300）盖住；mask 不透明度（`snapPoint×0.5`）与面板 `translateY`（`(1-snapPoint)×base`）虽同源驱动、mask 已显示说明 snapPoint 动画走完，但面板被压在暗色层之下故"只见阴影"。修复=`kbContainer` 补齐 `position:absolute + width/height:100%`（与 Dialog `backContainer` 同构），elevation 15310 生效、把整个面板子树抬到拦截层 15300 之上；数值不变（仍 Panel 15300/15310 < Dialog 16300 层级语义）；kbContainer 补全屏后叠在 mask 之上，外层 KeyboardAvoidingView 设 `pointerEvents="box-none"`（自身不接触摸、子级面板正常接收，对齐 `panelFullscreen.tsx:162` 同款范式），面板外点击穿透到全屏拦截层仍可关闭浮窗
3. 【优化】**播放音质标识改 QQ 音乐式带框标签 + 点击循环切换音质**（`utils/qualities.ts` 新增 `getNextQuality`、`pages/musicDetail/index.tsx`、`components/musicBar/musicInfo.tsx`）：全屏播放页与迷你条的音质标识（低/标准/高/超高音质）加细边框圆角框（hairline 边框、borderRadius 4、paddingHorizontal 4、边框色=文字色 35% 透明度），点击**不再弹出音质面板**，改为自动切换到下一个音质（low→standard→high→super 循环回绕），无缝替换音源保持进度；`showPanel("MusicQuality")` 播放选择入口从这两处移除（`musicDetail/index.tsx` 的 showPanel import 一并清理），下载音质面板入口（musicItemOptions/lyricOperations）保留不动
4. 【修复】**歌单三点菜单面板仍只显示阴影（仅封面图漏出）——绕过 KeyboardAvoidingView**（`panels/types/musicItemOptions.tsx`）：kbContainer 补全屏后实测面板内容仍被压住、仅 Fresco 原生封面图绘制可见——音乐项选项面板无任何输入框、本不需要键盘避让，直接传 `keyboardAvoidBehavior="none"` 让面板本体（wrapper）不经 KeyboardAvoidingView 包裹直出，规避 KAV position 模式对绝对定位子视图的层级干扰；带输入框的面板（搜索歌词/WebDAV 等）保留 KAV 不动
5. 【修复】**全屏播放页三点菜单（MusicItemLyricOptions）点击后只变灰、菜单内容不可见 + 同类无输入框面板统一绕过 KAV**（`panels/types/musicItemLyricOptions.tsx`、`musicQuality.tsx`、`appBarMore.tsx`、`simpleSelect.tsx`、`sheetTags.tsx`）：歌单三点（MusicItemOptions）绕 KAV 修复后全屏播放页三点菜单仍"点击全屏变灰"——全屏播放页三点弹的是 `MusicItemLyricOptions`（navBar.tsx:48），未传 `keyboardAvoidBehavior="none"` 仍走 KAV 包裹分支，内容被压住只见遮罩暗色。同根因核查：`musicQuality`（音质/下载选择）、`appBarMore`（顶栏更多）、`simpleSelect`（通用选择）、`sheetTags`（歌单标签）均为无输入框纯列表面板且未绕 KAV，一并补 `keyboardAvoidBehavior="none"`；带输入框面板（associateLrc/simpleInput 传 "height"、searchLrc 传 "none"）不动
6. 【改动】**歌单歌曲列表三点菜单 + 全屏播放页三点菜单改为三级浮窗（Dialog）**：用户拍板放弃底部面板载体（面板在歌单/全屏播放等场景被 KeyboardAvoidingView/覆盖层压住的层级问题反复出现）——新增 `dialogs/components/musicItemOptionsDialog.tsx`（歌单版，选项：ID/作者/专辑/下一首播放/加入歌单/下载/已下载/删除/删除本地下载/关联歌词/取消关联歌词/定时关闭/清除缓存）与 `musicItemLyricOptionsDialog.tsx`（全屏版，选项：ID/作者/专辑/下一首播放/加入歌单/歌词翻译开关/字体大小/歌词设置/从播放列表移除/永久删除），选项逻辑与原面板一致、key 复用原 i18n；调用点 `musicItem.tsx`（通用歌曲行）、`sheetMusicList.tsx`（歌单歌曲行）、`navBar.tsx:48`（全屏播放页三点）改 `showDialog`；Dialog 内换弹其他浮窗统一"先 hideDialog 再 setTimeout showDialog"（避免同步清 store 竞态）；删除零引用旧面板 `panels/types/musicItemOptions.tsx` + `musicItemLyricOptions.tsx` 及注册
7. 【修复/规范】**全页面层级与功能核查问题批量修复（P1-P3 系列）**（依据多子代理只读核查报告逐项拍板）：P1-1 平板全屏播放页弹窗几何偏移修复——Dialog 平板分支引入 `useAtomValue(fullPlayingAtom)`，判定改 `tabletBound = isTablet && !fullPlaying`（`dialogs/components/base/index.tsx`，与 panelBase 对齐）：全屏播放层（FullPlayingLayer）激活时弹窗整屏居中，不再落进右 70% 盒（中心偏右约 15% 屏宽 + 顶部多 56dp）；非全屏时弹窗行为与其他弹窗完全一致；P1-2 本地歌单详情页补渲染 Header（`pages/sheetDetail/index.tsx`），"收藏歌单/批量加入/批量编辑"入口恢复可达（与插件歌单详情页对齐）；P2-1 全屏版复制失败 catch 改 `Toast.warn`（`musicItemLyricOptionsDialog.tsx`，与歌单版一致）；P2-2 全屏版 13 处硬编码中文全部替换为 `t()`（新增 `panel.musicItemLyricOptions.*` 9 个 key：showTranslation/showTranslationOn/showTranslationOff/lyricSettings/removeFromPlaylist/removedFromPlaylist/permanentDelete/permanentDeleteConfirm/unknownSong，zh-cn/zh-tw/index.d.ts 三处同步）；P2-3 Toast 根容器补 `elevation:16320`（`components/base/toast.tsx`，Android 绘制顺序按 elevation，此前浮窗打开期间 Toast 被 15300/16300 层遮住、"点了删除、弹窗关闭后才看到提示"）；P2-4 播放列表面板歌曲行加三点菜单（`panels/types/playList/body.tsx`，复用 MusicItemOptionsDialog、不传 musicSheet 故不显示"删除"选项，仅 x-mark 删除之外补下载/加入歌单等入口）；P3-1 歌单版删"定时关闭"选项与 `from` prop（只保留全屏播放页定时关闭入口）；P3-2 删除零引用 SimpleInput/SimpleSelect 面板文件与注册；P3-3 清理死 i18n key `panel.musicItemOptions.readComment`；P3-4 全屏版永久删除 onOk 冗余 `hideDialog()`（SimpleDialog 自动关）；P3-6 两个 Dialog 浮窗切换注释修正（"hideDialog/showDialog 同写 dialogInfoStore 单值，延迟一拍避免时序竞态"）；P3-8 `appBarMore.tsx` 注释更新为引用新版弹窗名；P3-9 歌单"删除"加 SimpleDialog 确认（新增 `panel.musicItemOptions.deleteConfirm` "确定从歌单中删除「{title}」？" 三处同步，本地音乐库移除不删文件仍确认防误触）；**P3-5/P3-10 按核查判定不动**（非响应式快照影响轻微；全屏页音质标识点击循环切换已实现、MusicQuality 为下载/设置列表式选择面板、保持现状）；死 key `panel.musicItemOptions.timingClose` 随 P3-1 一并三处删除。验证：tsc 0 错误、eslint 0 error（6 个 warning 均为既有 react-hooks/no-inline-styles）、JSON 合法
8. 【改动】**下载音质选择改三级浮窗（Dialog）+ 当前音质高亮**：MusicQuality 面板（Panel）改为 `dialogs/components/musicQualityDialog.tsx`——列表式选择（行高 48），当前音质高亮（primary 色 + bold + 对勾图标）：`type="play"` 高亮当前播放音质（`useMusicQuality`）、`type="download"` 高亮下载设置默认音质（`basic.defaultDownloadQuality`）；标题沿用 `panel.musicQuality.title`；调用点（歌单/全屏三点"下载"）改 `showDialog`（Dialog 内切换延迟一拍）；删除旧面板 `panels/types/musicQuality.tsx` 及注册（PlayList/AssociateLrc/SearchLrc/SheetTags/AppBarMore 五个 Panel 保留）。**附带修复：底部面板标题圆角处直角阴影**（`panels/base/panelBase.tsx` wrapper 补 `overflow:"hidden"`——标题 PanelHeader 为直角渐变矩形，不裁剪时直角边缘在面板顶部圆角处外露，视觉上呈"圆角处直角阴影/直角角块"；Android elevation 阴影基于 View outline、overflow hidden 不影响阴影与 15310 层级）
9. 【优化】**全屏播放页三点菜单缩短总高（按 UI 规范档位，非随意压缩）**（`dialogs/components/musicItemLyricOptionsDialog.tsx`）：行高 `heightType="small"`(48) → `"smallest"`(36)——ListItem 既有紧凑档位（规范 big64/normal56/small48/smallest36，见 docs/UI与适配核查记录.md），`ITEM_HEIGHT`(getItemLayout) 同步 36——选项撑满 10 项时总高从 ~662dp 降至 ~540dp；宽度（三级弹窗 Level3Dialog 规范：手机 86%/平板 60%）、头部封面 72、字号档位全部不动。验证：tsc 0、eslint 0 error（7 个 warning 均为既有 inline-style）
10. 【改动】**平板全屏播放页弹窗宽度跟随外面弹窗（60% 限定）**（`dialogs/components/base/index.tsx`）：宽度判定 `tabletBound`（平板非全屏 60% / 平板全屏+手机 86%）→ `isTablet`（平板一律 60%）——全屏播放层只改弹窗位置（整屏居中），宽度不再随 fullPlaying 放大为 86%，与平板非全屏时弹窗宽度一致（对齐 Level3Dialog 平板 60% 规范）；手机保持 86% 不变。验证：tsc 0、eslint 0 error（4 个 warning 均为既有 inline-style）
11. 【修复】**弹窗点击外部退出 + 本地音乐不显示音质切换**：
    - **弹窗外部点击退出**（`dialogs/components/base/index.tsx`）：根因=backContainer（position:absolute + elevation 16300 + 全屏容器）盖住 screenTouchBlock 拦截层——平板 tabletBound 时 backContainer 被裁剪为右 70%（左 30% 播放区命中拦截层可退出、右 70% 内容区命中 backContainer 空容器**不可退出**）；全屏播放/手机时 backContainer 整屏，点击任何弹窗外区域都不退出。修复=backContainer 内补全区域 `TouchableWithoutFeedback(onPress=onDismiss)`（`StyleSheet.absoluteFill` 垫在淡入层与弹窗本体之下）+ 视觉淡入层 `container` 补 `pointerEvents="none"`（避免全屏透明动画层拦截命中下方关闭层）；点击弹窗本体（dialogContainer 16310 在上）不触发、点击外部命中关闭层=退出。平板左 30% 播放区仍走 screenTouchBlock 关闭
    - **本地音乐不显示音质切换标识**（`pages/musicDetail/index.tsx` + `components/musicBar/musicInfo.tsx`）：本地文件无多音质，`changeQuality` 走插件 `getMediaSource` 返回同一本地 URL、切换无实际效果——本地音乐（`LocalMusicSheet.isLocalMusic`）隐藏音质标识（全屏播放页标题下方 + 迷你条"标题·音质"），不再出现可点击的"低/标准/高/超高音质"标签
    - 验证：tsc 0、eslint 0 error（7 个 warning 均为既有 inline-style/react-hooks）

`2026.10.19 0.6.2.16（已发版）`
> 本次为 **0.6.2.16 正式发版**（versionName 0.6.2.15→0.6.2.16，versionCode 400026→400027）：并入此前「未发版改动」25 项——含平板浮窗穿透彻底根治（交互层全屏覆盖、暗色层限右 70% 内容区、Dialog 全屏拦截层）、音源订阅清单修复（plugins.json 99→98）、音质标识、JamesDSP 竞态加锁等。已装 0.6.2.15 的用户会收到更新提示。
1. 【变更】去掉算法混响预设列表首项"关闭"胶囊（`src/core/jamesdsp.ts` `REVERB_PRESETS` 20→19 项，UI 索引 0 从此即"小房间"）：UI 与存储的 **UI 索引语义不变**（`jdsp.reverbPreset` 0=小房间），选中态比较与 `applyReverb(true, 0, idx)` 调用处逻辑未动；**底层映射**在 `applyReverb` 算法引擎分支与启动恢复（`applyAllConfig`）下发原生预设号 = UI 索引 + 1（跳过原生 None/0，点"小房间"下发 1、点"水下"下发 19），卷积混响映射不受影响。**老用户数据偏移说明**：同版本号重发、无版本迁移钩子，本地历史 `jdsp.reverbPreset` 读取时整体偏移一格（旧 0=关闭→新 0=小房间；旧 1=小房间→新 1=中房间……），无法区分新旧值，按接受偏移处理；旧值 19（水下）在新 19 项列表越界，读取时 clamp 到 18（水下）兜底，避免无高亮/原生预设越界
2. 【优化】音效页大胶囊**平板档改固定 dp 小尺寸**（`soundEffectSetting.tsx` `chipLarge`）：rpx 按屏幕短边等比放大，平板短边 600→高 40.5dp、900→64.8dp 导致胶囊过大而文字 15sp 不缩放；平板（`src/utils/tablet` `isTabletScreen()`，对齐 sw600dp）时改用固定 height 36dp / paddingHorizontal 16dp / borderRadius 18dp，文字仍 15sp 不变；手机端保持 rpx(54/24/27) 原状；`importChip` 虚线框叠加关系不变，各胶囊选中态逻辑未动
3. 【优化】**首页推荐歌单胶囊与音效页统一**（`homeBody/recommendSection.tsx` `tag`、`recommendSheets/index.tsx` `tagCapsule`）：此前为全设备固定 dp 54/24/27（手机上偏大、平板比音效胶囊 36 还大），改为与 `chipLarge` 同一套逻辑——手机档 rpx(54)/rpx(24)/rpx(27) 随屏缩放、平板档固定 height 36dp / paddingHorizontal 16dp / borderRadius 18dp；文字仍 body(15sp) 不变，`tag` 的 marginRight:8 与 `tagCapsule` 的 alignItems/justifyContent 等其余属性照旧
4. 【优化】耳机补偿导入浮窗提示补充 **IR 来源网站**（`soundEffectSetting.tsx` `onImportDdc` 说明文字）：注明可从 AutoEQ（https://github.com/jaakkopasanen/AutoEq）下载对应耳机的频响补偿 IR
5. 【修复】**浮窗遮罩点击穿透**（`dialogs/components/base/index.tsx`）：Android 原生绘制顺序由 elevation 决定（RN zIndex 不跨父容器生效），页面内带 elevation 的元素（如播放条 MusicBar elevation=6）会盖过无 elevation 的遮罩，导致浮窗打开时点击播放条区域穿透——误进全屏播放器且浮窗不关闭；遮罩层 `backContainer` 补 `elevation: 16300` 把整个浮窗层压到最上，点击浮窗外任意区域均先命中遮罩关闭浮窗（含平板限右内容区布局）
6. 【修复】**WebDAV 设置改为三级浮窗**（新增 `dialogs/components/webdavSettingDialog.tsx`，替换原底部面板 `SetUserVariables`）：原面板在 RNGH ScrollView 内嵌 RN 原生 TextInput，Android 上手势抢占导致用户名/密码输入框点击弹不出键盘；三级浮窗内容区无手势滚动冲突，输入恢复正常（密码行掩码显示；url/用户名/密码三项 + 取消/确定）。原 `SetUserVariables` 面板改后零引用，按死代码惯例删除（含 `panels/types/index.ts` 注册）
7. 【删除】均衡器下方说明文案（i18n `soundEffect.eqDesc`）：删除"调一调高低音和人声的强弱，让歌听着更顺耳"提示行（渲染处 + zh-cn/zh-tw + 类型声明三处联动），均衡器组标题与其余 soundEffect.*Desc 说明保留，功能逻辑不变
8. 【规范】**全部文字胶囊统一固定 dp 36/16/18**，彻底消除 rpx 缩放导致的 600dp 临界跳变：此前音效页 `chipLarge`、首页推荐 `tag`、推荐歌单 `tagCapsule` 均为「手机 rpx(54)/rpx(24)/rpx(27) 随短边缩放 + 平板固定 36/16/18」双档（短边 600dp 临界瞬间胶囊由 ~43dp 跳回 36dp），统计页维度 `chip`、搜索历史 `chip` 为固定 54/24/27（手机上偏大）；现全部合并为单一固定样式 height 36dp / paddingHorizontal 16dp / borderRadius 18dp，删除 `chipLargeTablet`/`tagTablet`/`tagCapsuleTablet` 三档平板样式与 `isTabletScreen()` 三元切换（相应 import 一并清理）。手机端胶囊尺寸从 rpx 缩放值变为固定 36dp——短边 360dp 时原高 ≈25.9dp/内边距 ≈11.5dp/圆角 ≈13dp、400dp 时 ≈28.8/12.8/14.4dp、600dp 临界切换前 ≈43.2/19.2/21.6dp，现统一 36/16/18。文字仍 body(15sp) 不变，选中态逻辑、`tag` 的 marginRight:8、`importChip` 虚线框叠加、各胶囊 alignItems/justifyContent 等外加属性照旧
9. 【删除】音效页顶部提示文案（i18n `soundEffect.hint`）：删除"音效实时作用于当前播放，需播放过歌曲后生效；换歌不重置设置"提示行（渲染处 `hintRow` View + zh-cn/zh-tw JSON + `index.d.ts` 类型声明三处联动，连同 `hintRow` 样式一并清理），外层 AppBar 标题与均衡器组、其余 soundEffect.*Desc 术语说明及功能逻辑一律不动
10. 【优化】混响区说明文字重构：混响 ListItem 加 `description={t("soundEffect.reverbHint")}`（"给声音加一点回音和空间感，像在房间里唱歌"，与电子管模拟等其他 ListItem 同一 description 写法）；删除开启混响后引擎分段胶囊（算法/卷积）下方的 `reverbDesc`/`convolverDesc` 说明行与卷积预设胶囊下硬编码"真实空间录音"说明（i18n 键 `soundEffect.reverbDesc`/`soundEffect.convolverDesc` 一并从 zh-cn/zh-tw/index.d.ts 删除，新增 `soundEffect.reverbHint` 三处同步）；`descLine` 样式删除后零引用，按死代码惯例一并清理
11. 【修复】**播放补充信息 artwork 空串闪退**（`core/trackPlayer/index.ts`）：设置补充信息路径（`getMusicInfo` 补充信息中 artwork 为空串时，`mergeTrackSource` 用空串覆盖 `track.artwork`）直接 `updateMetadataForTrack(0, mergedTrack)` 传给 RNTP，其 `getUri` 对空串抛 `RuntimeException: artwork: The URL cannot be empty` 导致 Java 层闪退（bugreport 00:49，PID 22060）；修复：合并后过 `patchMediaArtwork`（与 915 播放入口同款兜底，空 artwork 换 `ImgAsset.albumDefault` 默认封面）。242 处 `getActiveTrack()` 读回的 currentTrack 写入播放器前已 patch，判定安全未改；getFakeNextTrack 假曲目自带默认封面未改
13. 【优化】搜索失败音源改进（`searchPage/hooks/useSearch.ts`）：① 翻页（加载更多）时对上次失败（ERROR）的音源**从失败页码重试**——此前跳"失败页+1"，失败在第 1 页时翻页直接请求第 2 页丢第 1 页数据；② 同轮搜索失败（异常/空结果）**自动重试一次**，仍失败才置 ERROR（可用率按最终结果判定）。正常音源翻页 +1 行为不变；失败页重试无旧数据时按整页加载显示；并发搜索各音源独立、音源排序不受影响
14. 【修复】**底部面板（Panel）遮罩/面板补 elevation 压过页面元素**（`panels/base/panelBase.tsx`）：对称 ef98369 的 Dialog 侧修复——Panel 遮罩（zIndex 15000）与面板（zIndex 15010）原无 elevation，Android 绘制顺序按 elevation 决定（RN zIndex 不跨父容器），页面内带 elevation 的元素（播放条 MusicBar=6）会画在面板之上，导致搜索结果列表三点菜单等 Panel 浮窗"唤不出来"（只见遮罩阴影）；遮罩补 elevation 15300、面板（含 KeyboardAvoidingView 容器）补 15310，保持 Panel < Dialog(16300) 层级语义
15. 【新增】**播放页与迷你播放条显示当前音质标识**（`pages/musicDetail/index.tsx` + `components/musicBar/musicInfo.tsx`）：全屏播放页标题区歌手行下方加居中音质小标签（`qualityText`：低音质/标准音质/高音质/超高音质，description 级次级色，手机/平板/矮横屏三档字号适配，无歌曲时隐藏）；迷你播放条标题后加 `·高音质` 小标签（description 级、musicBarText 半透明与 artist 同款，不破坏滑动切歌手势）。数据源 `useMusicQuality()`（jotai 原子，切音质实时刷新）
16. 【修复】**平板浮窗弹出时左 30% 播放区点击穿透进全屏播放页**（`panels/base/panelBase.tsx` + `dialogs/components/base/index.tsx`）：根因=平板遮罩按 tabletBound 限定右 70% 内容区（左播放区 + 顶部 tab 设计不遮），**左 30% 播放区完全无拦截层**——点击播放区/播放条会直接命中 MusicBar tapGesture（`setFullPlaying(true)`/navigate MUSIC_DETAIL）进全屏播放页；修复=平板遮罩时在左 30% 播放区补**透明触摸拦截层**（不显示暗色、不遮挡播放区视觉，onPress 同遮罩语义=关闭浮窗），Panel 与 Dialog 两级体系（含三级浮窗/嵌套 Dialog）同步修复；手机遮罩本全屏无此问题，fullPlaying 全屏播放层下遮罩仍全屏不变。不破坏既有 elevation 层级（Panel 15300/15310、Dialog 16300）
17. 【修复】**平板浮窗穿透修复改版：交互拦截层统一 100% 全屏，视觉暗色层仍限右内容区**（`panels/base/panelBase.tsx` + `dialogs/components/base/index.tsx`）：上条补丁实测仍穿透——根因=Dialog 拦截层误嵌 `backContainer`（平板时 left:30% width:70%）**内部**，其 `left:0/width:30%` 相对父容器偏移到屏幕 **30%~51%**，左 0~30% 播放区依然无拦截（Panel 侧拦截层为兄弟级全屏定位、位置正确，故 Panel 浮窗有效而 Dialog/三级浮窗失效）；本次根治=不再"额外补一层"，改为**交互层本身覆盖 100% 整屏**（含左播放区与顶部）：Panel 的 `maskWrapper` Pressable 不再按 tabletBound 裁剪（全屏可交互、点击任意面板外区域关闭），视觉暗色子层单独保留 tabletBound（右内容区，不压暗播放区）；Dialog 新增与 backContainer 同级同 elevation（16300）的 `screenTouchBlock` 全屏 TouchableWithoutFeedback、渲染在前（backContainer 弹窗本体触摸优先），原 container 去 Touchable 包裹变为纯视觉淡入层；删除两侧 `tabletLeftBlocker`/`screenLeftBlocker` 拦截层。层级语义不变（Panel 15300/15310、Dialog 16300），手机端交互层本就全屏、行为不变
18. 【修复】**音源订阅清单 plugins.json 修复**（gitee `xunwulove/jiyuejie` sources/plugins.json，仅线上清单，无 App 代码改动）：全量核查 99 个音源发现 8 个 hebijunge.github.io 源 URL 为**过时版本号**（作者只保留最近 2 版，旧文件 404，App"检查更新"按 name+version 比较判定"已是最新"导致永远更新不到新版本）+ 1 个不可达源；修复=8 个死链更新到仓库实际最新版本（QQ音乐→1.9.22、酷我音乐→1.9.20、网易云音乐→1.9.22、DJ串烧集→1.0.1、djuu DJ→1.1.2、皮狗DJ→1.1.2、DJKK→1.1.2、聚合→1.9.18，URL 与 version 字段同步），移除持续超时不可达的腾讯音乐源（nairocy 域该文件两次握手超时、同域其他文件正常，腾讯系已有 QQ音乐/QQ音乐非VIP 覆盖）；清单 99→98 个，PUT 后直链验证 8 个新 URL 全部可取到插件内容。本地 `defaultPluginSubscription.ts` 注释同步 98 个
12. 【修复】**JamesDSP nativeInit 重初始化与 setEqualizer 并发竞态闪退**（`android/app/src/main/cpp/jdsp_jni.c`）：启动恢复均衡器设置时 `nativeSetEqualizer` 与 `nativeInit`（re-init 分支先 JamesDSPFree+free 置空再重新 malloc/Init，全程无锁）并发——RN native 模块线程（mqt_native_modu）vs 播放器 configure 链路，参数方法可读到旧 `g_initialized=1` 但 `g_jdsp` 已被释放/置空 → 空指针崩溃（tombstone_23 10-18 00:36:15，pid 6078，fault addr 0x0，栈 FFTConvolver2x2RefreshImpulseResponse→MultimodalEqualizerAxisInterpolation→nativeSetEqualizer）；修复：引入 `pthread_mutex_t g_lock`，除音频热路径 `nativeProcess` 外的全部 JNI 入口（nativeInit/nativeFree/nativeSetSampleRate/nativeSetEqualizer/nativeSetPostGain/nativeSetLimiter/nativeSetBassBoost/nativeSetStereoEnhancement/nativeSetReverb/nativeSetCompressor/nativeSetVacuumTube/nativeSetCrossfeed/nativeSetConvolver/nativeLoadIR）加锁保护 `g_jdsp`/`g_initialized` 读写（低频配置调用，性能无影响；`g_initialized` 读写均在锁内）；`nativeProcess` 不加锁（避免音频回调锁开销，其与 init/free 主要经播放器 configure 链路串行，注释说明）。NDK 编译验证：`:app:externalNativeBuildRelease` BUILD SUCCESSFUL（2m6s，28 个 warning 均为原有 JNI unused-parameter）。核心库层防护（FFTConvolver 入口 fft==NULL/segCount==0 防御、nativeSetEqualizer 前置确保 Constructor）评估为防御纵深：加锁已根治本次竞态（锁内 setEqualizer 必见完整构造的 g_jdsp），本轮不实施，留待后续如需更强防护再评估

`2026.10.17 0.6.2.15（已发版·同版本号重新发布）`
> 本次为 **0.6.2.15 同版本号重新发布**（versionName/versionCode 均不变）：在首版基础上并入此前「未发版改动」25 项——P1 修复批次 16 项（播放失败重试链路/下载队列失败卡死/听歌统计/歌单删除刷新/60s 过滤放行损坏文件/切歌换采样率 DSP 静默重置/IR 采样率重采样/插件歌单分页/插件损坏与不兼容状态展示/NoPlugin 引导/平板面板遮挡等）、下载**断点续传与队列持久化**、全项目 **lint 欠账清零**与死代码删除。同版本号重发原因：修复集中在同一维护窗口，保持版本号稳定。**影响**：已装 0.6.2.15 的用户软件内「检查更新」按版本号比较会判定已是最新、收不到新包提示，需手动下载覆盖安装。
1. 【修复】混响/卷积预设胶囊点击后**选中高亮不切换**（`applyReverb` 未把 preset 写回 `jdsp.reverbPreset` / `jdsp.convolverPreset`，而选中态读取它们）
2. 【规范】全软件**文字胶囊统一为音效页大胶囊格式**（高54 / 左右内边距24 / 圆角27 / 文字15sp）：混响页引擎分段与算法/卷积预设、交叉反馈、ViPER-DDC 耳机补偿（内置/自定义/导入）、均衡器预设、统计页维度、搜索历史、首页推荐分类、歌单页标签
3. 【变更】通知中心播放图标由旧网易云音符（`logo-transparent.png`）换为**新版加大音符**（`splash-icon.png`）
4. 【修复】**播放失败链路**（`src/core/trackPlayer/index.ts`）：音源解析异常/未知播放错误不再静默吞掉——先重试当前曲一次（延迟 2.5s，重试前校验仍是同一首，`reset()` 强制重新取源），仍失败弹"播放失败"提示后切下一首；整队列失效时连跳不再无声（不做熔断停队）
5. 【修复】**下载队列失败不再卡死**（`src/core/downloader.ts`）：获取媒体源失败路径补调度下一个 pending 任务（计数已在失败处理内递减，与正常路径对称）；启动时清理 `downloadCachePath` 残留半截临时文件（后台执行，断点续传/任务持久化不做）
6. 【修复】**听歌统计失真**（`src/pages/statistics/index.tsx`）：历史已按歌去重导致"播放 N 次"恒为 1，countMap 改取行内 `playCount` 全量累计，总时长/排行随之修正
7. 【修复】**歌单删除歌曲后数量/封面立即刷新**（`src/core/musicSheet/index.ts`）：`removeMusic` 落盘完整 `patchData`（worksNum + 条件 coverImg），不再丢弃
8. 【修复】**60s 过滤放行损坏文件**（`src/core/localMusicSheet.ts`）：开启"不扫描 60s 以下"时 `duration<=0` 的损坏/无法解析文件不再放行入库
9. 【修复】**切歌换采样率 DSP 静默重置**（`android/kotlinaudio/.../jamesdsp/JamesDSPProcessor.kt` + `android/app/.../jamesdsp/JamesDSPModule.kt` + `src/core/soundEffect.ts`）：原生检测输入采样率/编码/启用态变化，发 `JamesDspConfigChanged` 事件，JS 收到后 `applyAllConfig()` 重放全部 jdsp 配置
10. 【修复】**非 16bit 输入静默旁路可见化**（同上 + `src/pages/setting/settingTypes/soundEffectSetting.tsx`）：原生暴露输入编码与旁路原因（`getDspDiagnostics`），音效页新增 **DSP 状态诊断行**显示"已激活（编码·采样率）"或"已旁路（原因）"
11. 【修复】**IR 按当前引擎采样率重采样**（`android/app/src/main/cpp/jdsp_jni.c` + `android/kotlinaudio/.../jamesdsp/JamesDSPBridge.kt`）：`nativeLoadIR` 增传 IR 自带采样率，与 `g_jdsp->fs` 不一致时用 `JamesDSPOfflineResampling` 重采样后再装载——44.1kHz 歌曲用 48kHz IR 不再混响变慢/时间补偿错位（失败降级装载原始 IR）
12. 【修复】**导入 IR 失败不再静默吞**（`JamesDSPModule.kt` loadIR/loadBuiltinIR 改 Promise + `soundEffect.ts` applyDdc/applyReverb/applyAllConfig 按加载结果使能）：失败弹"IR 加载失败，请使用 16bit/48kHz WAV"提示且不使能无效卷积器
13. 【修复】**"重置全部 JamesDSP"只修 eqEnabled 未复位**（`soundEffectSetting.tsx`）：reset 前补 `Config.setConfig("sound.eqEnabled", false)`，消除 UI 开关与原生不一致（不加确认弹窗）
14. 【修复】**插件歌单详情第 2 页起必进错误态**（`src/pages/pluginSheetDetail/hooks/usePluginSheetMusicList.ts`）：`isUseful` 对后续页改判"有数据即视为合法中间页"（`listLen > 0 || isEnd`），空列表且未结束才换源
15. 【修复】**音源管理卡片不显示损坏/不兼容状态**（`src/pages/setting/settingTypes/pluginSetting/components/pluginItem.tsx`）：渲染 `plugin.state/errorReason`——"插件已损坏，无法解析 / 插件版本与 App 不兼容 / 插件异常，请尝试更新"，可更新时追加"点击更新/重试"
16. 【修复】**NoPlugin 引导指向不存在的"侧边栏"**（`src/core/i18n/languages/zh-cn.json` + `zh-tw.json`）：改为「先去『我的 → 音源管理』里安装音源，再来搜索吧~」
17. 【修复】**平板横屏弹出面板盖住顶部 tab 栏**（`src/components/panels/base/panelBase.tsx`）：平板横屏时面板本体 `top` 改为 `TAB_BAR_HEIGHT`（56，与遮罩同一常量）+ `bottom:0`，不再用整屏高（几何修复，真机目视留待）
18. 【优化】**播放模式切换弹 toast 反馈**（`src/pages/musicDetail/components/bottom/playControl.tsx`）：用 `repeatModeConst` 现成文案提示"已切换为：列表循环/单曲循环/随机播放"
19. 【优化】**音效页术语通俗说明**（`soundEffectSetting.tsx` + i18n 新增 9 个 `soundEffect.*Desc` key，两语种同步）：均衡器/输出增益/动态低音/立体声/混响/卷积/电子管/交叉馈送/ViPER-DDC 各加一句大白话；同时渲染此前从未显示的 `soundEffect.hint`（"音效实时作用于当前播放…"）
20. 【功能】**下载队列与任务持久化**（`src/core/downloader.ts`）：队列顺序（`download-queue-v1`）与任务表（`download-tasks-v1`，含状态/文件名/音质/进度/错误原因/临时文件路径）经 `@/utils/storage`（AsyncStorage）落盘；App 重启后恢复未完成任务与队列顺序并自动续跑（Preparing/Downloading 回落 Pending 重调度、Error 保持可重试、Completed 不入恢复范围）；进度按 500ms+64KB 节流写盘、状态/临时路径即时写盘
21. 【功能】**下载断点续传**（`src/core/downloader.ts`）：缓存临时文件改确定性命名 `<uniqueKey>.<ext>.part`；RNFS Android `downloadFile` 原生为截断写（源码确认无 Range/追加能力），改带 `Range: bytes=N-` 头把尾部下载到独立侧车 `.part.tail` 再 base64 拼回（206 续传拼接 / 200 全量替换），进度按续传偏移显示；成品仅在 `.part → 下载目录` 拷贝后出现，半截文件不会冒充成品
22. 【变更】**启动清理只删孤儿半截文件**（`cleanupDownloadCache`）：保留有任务引用的 `.part` 供续传；仅删除无任务引用的 `.part`/`.tail`（被取消任务残留、上轮未拼完的侧车）与旧版 nanoid 随机名残留
23. 【规范】**lint 欠账清零**：全项目此前 pre-commit `npm run lint` 2712 问题（src 1117 error）导致 commit 只能 `--no-verify`；`.eslintignore` 新增排除 `MusicFree-upstream/`（上游对照副本）、`jiyuejie-resources/`（音源插件脚本，tsconfig exclude 同步），src 经 `eslint --fix` + 手工清理后 **error 归零**（剩 145 个非阻断 warning），`npm run lint` exit 0，pre-commit 钩子恢复正常
24. 【规范】**死代码删除**（grep 确认零引用后）：`soundEffect.ts` 删 7 个废弃 AudioEffect 遗留导出（applyEqToJamesDsp/applyBassBoost/applyVirtualizer/applyLoudnessEnhancer/applyReverbPreset/applyEnvironmentalReverbPreset/applyDynamicsProcessing）；`soundEffectSetting.tsx` 删对应 7 个 import、6 个旧能力位变量、7 个未用 useAppConfig 解构；`rules-of-hooks` 违规结构性修复（平台早退下移到全部 Hook 调用之后）；另清 30 余处未使用 import/变量（rpx/View/colors/useRef/showPanel 等）
25. 【规范】**全项目 src 格式统一**（eslint --fix：indent 2→4、brace-style、object-curly-spacing、comma-dangle、quotes 等，约 70 文件、无业务逻辑改动）

`2026.10.17 0.6.2.15（已发版）`
1. 【功能】DDC 耳机补偿：内置 5 款真实 AutoEQ 频响补偿 IR（QCY T13 / AirPods Pro 2 / Sony WH-1000XM4 / Bose QC45 / Sennheiser HD 650），与卷积混响互斥、复用卷积器
2. 【功能】耳机补偿预设**导入**：三级文件选择器导入 48kHz WAV，支持长按删除，内置款不可删；启动恢复兼容内置/导入款
3. 【功能】混响 5 预设替换为**真实空间 IR**（48kHz 立体声：小房间/音乐厅/教堂/板式/洞穴），消除剩余全部占位资源
4. 【变更】移除英文界面，仅提供中文版
5. 【修复】补全启动恢复 DDC（applyAllConfig）

`2026.10.16 0.6.2.14（JamesDSP 音效引擎，已发版）`
1. 【功能】音效引擎从系统 AudioEffect 切换为 **JamesDSP 核心算法库**（NDK 编译 `libjiyuejie_dsp`，ExoPlayer AudioProcessor 注入）：均衡器升级为 **15 段**（标准频率点 25Hz–16kHz），并新增进阶音效：输出增益、限幅器、动态低音(DBB)、立体声增强、混响(Progenitor2)、电子管模拟、交叉馈送(Crossfeed)、卷积器(5 内置 IR 预设)
2. 【功能】均衡器 15 段竖向滑块**自绘重写**（弃用系统 SeekBar）：轨道 2dp / 圆球 12dp，竖直 y→value 触摸映射，saveLayer 隔离防残影与黑屏
3. 【修复】均衡器滑块整块消失、轨道过粗/不能拖动、拖动残影、开启均衡器整窗变黑 等系列 bug；进阶音效滑块圆球统一主题色（不再系统默认绿）

`2026.10.11 0.6.2.9+（未发版改动）`
1. 【功能】三处歌词区（全屏/沉浸/左侧播放区）卡拉OK进度染色（逐字已唱段/未唱段双色）+ 歌词边缘渐隐滚动（FlatList fadingEdgeLength）
2. 【功能】白天背景微渐变（方案A：顶部品牌蓝 `#F2F5FC` → 底部 `#F8F9FA`）+ 播放封面氛围取色（方案B：跟随当前播放封面主色 α0.05 极浅着色，失败回退 A；深色模式不受影响）
3. 【规范】"数据与设置"卡片统一品牌渐变；全屏歌词页 9 处与歌单详情头部 6 处 rpx 残留固定化（固定 dp 跨屏稳定）；沉浸页歌词区底部与右封面精确齐平（去除重复 paddingBottom）
4. 【修复】音量图标暗色模式不可见（svg stroke 硬编码色改 currentColor）

`2026.10.11 v0.6.2.9`
1. 【功能】排行榜每日持久缓存；推荐歌单来源选择三级浮窗（含恢复默认）；歌单详情封面兜底（歌单无封面时取首曲封面）
2. 【规范】列表行样式统一修复（radioDialog 行高错位、三处选源/变量行漏传 heightType、图标档位等）；设置页清理（P0 死代码 6 项、调试能力、debug 面板删除）；沉浸层打磨（歌词区扩大、字号调整、底部对齐）
3. 【修复】推荐歌单标签字号；首页推荐区首屏不阻塞；每日推荐改真实歌单链路

`2026.10.10 v0.6.2.8`
1. 【功能】推荐歌单择优：**独立歌单可用率**（键 `plugin-recommend-reliability`，与通用可用率分开统计）自动排序优先；歌单详情显示来源音源
2. 【功能】音源管理三列布局、可用率仅显示百分比；可用率排序按钮
3. 【修复】沉浸页触发条件（仅播放中 15s 无操作进入、暂停不计时、有操作重置）；排序页空白问题

`2026.10.10 v0.6.2.7`
1. 【功能】推荐歌单每日缓存 + 标题行刷新按钮；软件更新下载缓存复用（下载完成未安装，再进不重复下载）
2. 【修复】沉浸计时修复（播放 15s 自动进入、暂停不进）；播放列表对齐规范；全屏页顶栏与标题居中

`2026.10.09 v0.6.2.6`
1. 【功能】下载文件命名设置（歌名/作者在前）；音乐库返回手势回首页
2. 【修复】封面链路：网络歌曲真实封面 + 品牌蓝占位图

`2026.10.09 v0.6.2.5`
1. 【功能】设置页缓存大小**惰性统计**（进页不再遍历缓存目录，点击缓存行才统计对应单目录，消除挂载卡顿）；左侧播放面板歌词接入
2. 【规范】标题行统一；音乐库排序行移至卡片下方（固定表头不随列表滚动）；设置页分组标题统一 primary；齿轮设置选中态
3. 【修复】我的页返回手势回首页

`2026.10.08 v0.6.2.4（fork 基线）`
1. 基于 MusicFree 官方源码 fork，UI 全面迁移对齐旧项目 APlayer（盐音）：平板左播放区 30% / 右内容区 70%、一级/二级/三级页面层级规范、卡片渐变/字体档位体系
2. 沉浸歌词样式 A；音源管理（导出/排序/可用率）；gitee 更新链路（软件内下载更新）

---

# 上游 MusicFree 原版 changelog

`2025.10.9 v0.6.2`
1. 【优化】优化了软件启动速度

`2025.8.3 v0.6.1`
1. 修复进入软件时播放进度丢失的问题
2. 修复某些情况下无法添加到歌单的问题

`2025.7.24 v0.6.0`
一大波优化和问题修复~
1. 【功能】优化了倒计时功能，支持倒计时结束后，歌曲播放完成后再退出应用
2. 【功能】支持多语言
3. 【功能】新增音源重定向功能
4. 【功能】自定义主题中，选择颜色弹窗支持直接输入颜色代码
5. 【功能】新增配置，音频被暂时打断时可调节降低音量的幅度（感谢@eastcukt）
6. 【功能】本地歌单中，高亮正在播放的歌曲
7. 【功能】本地歌单中，新增定位按钮，点击定位按钮可跳转到正在播放的音乐
8. 【优化】略微调大了歌词页的播放按钮
9. 【优化】首页-推荐歌单支持左右滑动
10. 【优化】优化播放器的稳定性，减少出现闪退/播放自动暂停的情况
11. 【修复】修复了一批样式bug
12. 【修复】修复了点击更新订阅插件后，插件页始终展示加载中的问题
13. 【修复】修复部分情况下歌词页高亮混乱的问题
14. 【插件】插件获取评论支持分页（需要插件配合）
15. 【插件】修复移动端axios库中读取的cookie和桌面版不一致的问题
16. 【插件】插件新增description字段，可嵌入markdown格式的插件说明
17. 【其他】重构了核心部分代码逻辑，后续维护起来成本会小一些

`2025.4.4 v0.5.1`
1. 【修复】修复插件开关点击无效的问题
2. 【修复】修复开屏图片消失的问题
3. 【优化】增加新建歌单名称的长度限制
4. 【优化】优化插件安装失败的提示样式

`2025.2.9 v0.5.0`
1. 【升级】升级ReactNative到0.76.5（注意：升级后只支持安卓7.0及以上设备，低于此版本的设备请不要升级）
2. 【修复】修复了运行应用一段时间后容易闪退的问题
3. 【修复】修复了插件网络请求无法传递cookie的问题
4. 【修复】新增了设置本地歌单封面的功能（在0.4版本暂时下线了）
5. 【修复】修复了部分情况下，播放本地音乐提示 “当前非Wifi环境” 的问题
6. 【优化】优化了一些代码逻辑

`2024.11.10 v0.4.4`  
【修复】修复了部分系统上弹窗、浮层等无法出现，或动画表现异常的问题

`2024.10.27 v0.4.3`  
【修复】修复了部分系统上文字显示不全的问题

`2024.9.18 v0.4.2`
1. 【修复】修复本地音乐无法播放的问题

`2024.9.8 v0.4.1`
安装包上传到了飞书云文档，浏览器打开链接后有个下载说明，可以根据这个指引安装apk
1. 【修复】修复桌面歌词无法开启的问题
2. 【修复】修复了修改桌面歌词颜色会导致闪退的问题
3. 【修复】回滚了本地音乐部分读取文件的逻辑
4. 【修复】修复了点击【编辑歌单信息】按钮无效的问题

`2024.9.1 v0.4.0`
本次更新修改了歌单的存储机制，建议谨慎更新
安装包上传到了飞书云文档，浏览器打开链接后有个下载说明，可以根据这个指引安装apk
1. 【升级】ReactNative升级到0.74.4
2. 【功能】换了个logo和开屏页
3. 【功能】播放列表的歌曲限制从1500首调整到10000首
4. 【功能】重写了歌曲排序机制
5. 【功能】插件新增评论区功能（需要插件实现getMusicComments方法）
6. 【优化】调整部分样式，优化删除歌曲时的性能
7. 【修复】修复歌词翻译错位的问题
8. 【修复】修复部分情况下无法复制作者/专辑的问题
9. 【修复】修复在歌单详情页删除歌单会导致白屏的问题
10. 【修复】修复搜索框在部分情况下自动触发搜索的问题
11. 【修复】修复右上角菜单位置跳变的问题
12. 【修复】修复在预览专辑封面时触发返回不会关闭预览弹窗的问题
13. 【修复】下载文件时转移文件中的保留字符（感谢@GuGuMur）
14. 【其他】分架构打包，更新开源协议为 AGPL 3.0

`2024.3.31 v0.3.0`
本次更新优化了存储方式，更新到此版本后，歌单会自动转化为新的存储方式；安装新版本后再回退到老版本会导致歌单清空，虽然测试下来没啥问题，但是请谨慎升级Orz
备用链接：https://pan.baidu.com/s/1HmbHlh3vTcSyVXcOs-7kTA?pwd=saku 提取码: saku
1. 【功能】历史播放记录支持批量编辑
2. 【功能】歌单内支持按照加入时间排序
3. 【功能】新增设置“本地歌单添加歌曲顺序”，在歌单内添加歌曲时可以加到歌单开头
4. 【功能】首页新建歌单旁边新增“导入歌单”按钮，点击时会自动寻找具有导入歌单功能的插件，并拉起导入浮层
5. 【功能】设置项中新增“自动换源”功能，当插件失效/无法获取播放链接时，会自动尝试更换其他源的同名歌曲
6. 【优化】尝试优化了软件启动时间，应该有点作用
7. 【优化】更新了存储方式，现在单个歌单可以存储大于10000首歌曲；
8. 【优化】调整未开启“允许使用移动网络播放”开关时的样式表现
9. 【优化】优化了设置页的样式
10. 【优化】微调歌词详情页的布局
11. 【修复】修复打开弹窗时，点击返回按钮不关闭弹窗的问题
12. 【修复】修复启动软件时播放模式错误的问题
13. 【修复】修复搜索结果页特定情况下白屏的问题

`2024.1.21 v0.2.0`
1. 【功能】支持 Webdav 备份 & 播放
2. 【功能】插件支持显示作者
3. 【功能】插件榜单详情支持分页
4. 【功能】首页&歌词页样式改版：新增歌词进度调整、歌词大小调整、歌词翻译、自动搜索歌词
5. 【功能】新增收藏歌单功能
6. 【功能】侧边栏新增“权限管理”设置
7. 【功能】音乐播放栏支持左右滑动切歌（可能会闪一下，后续修掉）
8. 【功能】新增 “通知栏显示关闭按钮” 设置
9. 【优化】重构播放、数据存储逻辑
10. 【优化】统一浮层、toast样式
11. 【优化】去除插件URL必须以.js结尾的限制
12. 【修复】修改无限列表到底不触发onEndReached的问题 (感谢 @282931)
13. 【修复】修复标题栏背景色透明度不生效的问题
14. 【修复】修复播放记录退出后被清空的问题
15. 【修复】修复部分情况下深色模式异常的问题
16. 【其他】这次安装包备用链接发到百度网盘了：https://pan.baidu.com/s/1H360C0MqejKXS67XwMqgPw?pwd=6666 提取码6666


`2023.11.24 v0.1.2-alpha.0`
1. 【功能】新增桌面歌词功能，可在设置页开启（开启之前需要去手机设置授予悬浮窗权限）
2. 【功能】可以使用 MusicFree 打开本地 .js 或 .mp3 文件；其中 .js 文件会被当作插件安装； .mp3 文件会直接播放
3. 【功能】新增插件设置：打开软件时自动更新插件、安装插件时不校验版本
4. 【功能】新增播放设置：打开软件时自动播放歌曲
5. 【功能】插件页新增开关，可以控制是否在榜单、热门歌单、搜索结果中展示对应插件的结果
6. 【功能】插件协议新增 “用户变量” ，可以在插件中获取 APP 输入的配置（可以由此实现自建音乐源的插件/webdav源插件，但是还没写）
7. 【优化】下载单曲支持选择音质
8. 【优化】新增“关联歌词方式”设置，如果设置为“输入歌曲ID”，则会恢复老版本关联歌词，即输入ID关联歌词
9. 【优化】侧边栏新增“返回桌面”按钮
10. 【修复】修复榜单、推荐歌单、搜索歌词页白屏闪退的问题 (感谢 @282931)
11. 【修复】修复自定义背景模糊度和透明度无法设置为 0 的问题 (感谢 @282931)
12. 【修复】修复浅色主题状态栏表现错误的问题
13. 【修复】修复歌单批量编辑无法删除的问题
14. 【修复】修复无法恢复桌面版导出的歌单的问题

`2023.10.15 v0.1.1-alpha.0`
1. 【功能】音源支持m3u8 (桌面版下个版本支持m3u8)
2. 【功能】增加歌曲详情页屏幕常亮的设置
3. 【功能】重构主题相关功能，增加「跟随系统深色设置」选项；调整大部分样式，移除第三方UI库
4. 【功能】插件页增加「插件批量更新」的功能
5. 【功能】取消原「歌词关联」的逻辑，修改为拉起「歌词搜索」浮层
6. 【优化】增加了一些无障碍属性
7. 【修复】修复部分场景下无法保存歌单的问题
8. 【修复】修复部分场景下重启之后无法播放歌曲的问题
9. 【插件】部分插件更新，侧边栏更新插件即可

`2023.8.13 v0.1.0-alpha.10`
1. 【功能】当前音乐无歌词时可以在歌词页搜索歌词
2. 【优化】调整右上角弹出气泡的位置
3. 【优化】增加打开歌曲详情页时的默认表现设置
4. 【优化】修复进入歌词页时候显示跳变的问题
5. 【插件】插件协议更新，更新后可以配置某插件不出现在特定的搜索结果页下
6. 【插件】部分插件更新，侧边栏更新插件即可

`2023.6.26 v0.1.0-alpha.9`
1. 【功能】新增搜索歌单功能
2. 【功能】新增播放记录功能
3. 【优化】加了一些无障碍适配
4. 【插件】部分插件更新，侧边栏更新插件即可

`2023.6.4 v0.1.0-alpha.8`
1. 【功能】新增“推荐歌单”功能，需要配合支持该功能的插件使用
2. 【功能】导入本地文件时增加“全选”按钮
3. 【优化】修改“保存专辑封面”时的提示文案
4. 【修复】修复当目标歌曲在播放列表内时，添加到下一首播放无效的问题
5. 【插件】部分插件更新，侧边栏更新插件即可

`2023.5.21 v0.1.0-alpha.7`
1. 【功能】歌单页新增“播放全部”按钮
2. 【功能】歌曲播放页中，长按专辑封面可保存到本地
3. 【功能】歌单页新增“歌单排序”功能
4. 【插件】b站插件作者页API变动，侧边栏更新插件即可

`2023.5.3 v0.1.0-alpha.6`
小小拖更一下~
1. 【功能】歌单内搜索时支持英文大小写模糊搜索
2. 【修复】修复首次进入时歌曲可能无法正常播放的问题

`2023.3.26 v0.1.0-alpha.5`
1. 【功能】更新弹窗新增“跳过此版本”的复选框
2. 【功能】侧边栏-基本设置-开发选项中新增“查看错误日志”的选项，点击会弹出错误日志的弹窗
3. 【修复】修复输入框被软键盘遮挡的问题
4. 【优化】优化了定时关闭的样式
5. 【文档】文档中更新了插件的制作教程。文档地址：http://musicfree.upup.fun

`2023.3.19 v0.1.0-alpha.4`
1. 【功能】适配横屏设备
2. 【功能】新建歌单时添加默认歌单名；从专辑/榜单批量添加到新歌单时，默认以专辑名/榜单名为新歌单名
3. 【修复】修复设备有虚拟按键时，浮层会被遮挡的问题
4. 【修复】修复拖拽歌词时部分情况下时间异常的问题
5. 【修复】调整下载失败时的提示文案
6. 【插件】部分插件有更新，可以从侧边栏更新

`2023.2.26 v0.1.0-alpha.3`
1. 【功能】专辑列表支持分页，需要配合插件更新；
2. 【优化】去掉了全面屏手机界面下方的小白条；
3. 【优化】调整拖拽歌词时标识线的对齐范围；调整歌词拖到最底端时的逻辑；
4. 【优化】调整下载歌曲时的文件名；
5. 【优化】导入歌曲时的提示文案增加滚动；
6. 【修复】修复特殊情况下歌曲中断后可能恢复到错误状态的问题（未验证）；
7. 【插件】个别插件有更新，可以去侧边栏更新订阅。

`2023.2.13 v0.1.0-alpha.2`
1. 【功能】备份&恢复：可以把本地的歌单和插件备份到一个json文件中，也可以从本地文件或网络上恢复插件和歌单。
2. 【修复】修复部分情况下后台播放切换歌曲时暂停的问题
3. 【修复】修复部分场景无法下载的问题
4. 【修复】修复部分场景无法删除本地文件的问题
5. 【优化】简单优化了下歌单列表
6. 【调试】调试面板现在可以打印出插件中的console语句

`2023.1.27 v0.1.0-alpha.1`
1. !!!【功能】插件更新，升级到新版本之后原有插件完全不兼容；更新后卸载原有插件，然后更新订阅即可（具体看公众号示例）
2. 【功能】新增功能“倍速播放”
3. 【功能】重写了插件订阅的逻辑，现在应该会更合理一点点
4. 【功能】删除本地文件之前增加二次确认提醒
5. 【功能】增加了一些无关紧要的分享
6. 【样式】换了个logo，丑的更直白一些
7. 【样式】调整了一些样式（如播放页的模糊和透明度、歌词样式等）
8. 【样式】专辑描述文字默认6行，点击可以展开或折叠
9. 【修复】修复部分情况下无法下载的问题
10. 【插件】大量插件有更新，更新到此版本后更新订阅即可

`2023.1.8 v0.0.1-alpha.13`
1. 【功能】主页入口增加“榜单”
2. 【功能】歌单页新增“编辑歌单信息”，可以修改歌单名称和歌单封面
3. 【修复】修复了一个会导致播放音乐时拖拽排序卡顿的问题，做了一些其他优化
4. 【插件】部分插件有更新，可以在侧边栏更新

`2022.12.25 v0.0.1-alpha.12`
1. 【功能】增加“单击搜索结果中单曲tab”时的行为配置
2. 【功能】增加调试配置及调试面板，可用于查看插件的错误信息
3. 【修复】修复部分情况下本地音乐中断时无法继续播放的问题
4. 【修复】尝试修复扫描本地音乐，音乐文件太多时可能卡死的问题

`2022.12.11 v0.0.1-alpha.11`
1. 【功能】完善音质功能
2. 【功能】更新下载功能，支持根据音质下载文件；修复一些小问题
3. 【功能】新增播放时被打断的设置，可设置为暂停或者暂时降低音量
4. 【优化】调整侧边栏样式，侧边栏新增“定时关闭”功能
5. 【优化】本地音乐读取歌词时，会自动读取同目录下的同名lrc文件作为歌词
6. 【修复】修复安装插件时误弹安装失败提示的问题
7. 【修复】修复部分情况下本地文件删除失败的问题
8. 【修复】修复本地音乐在通知栏不显示音乐标题的问题
9. 【插件】示例插件仓库中migu有更新（支持音质），需要可自行更新

`2022.12.4 v0.0.1-alpha.10`
1. 【功能】支持自定义下载路径
2. 【功能】支持插件排序（也就是搜索结果的排序）
3. 【功能】增加音质相关的配置
4. 【优化】弹窗、浮层的性能优化，页面嵌套较深时卡顿的情况应该会好一点
5. 【优化】拖拽排序，比上个版本手感应该会好一点
6. 【修复】修复在歌词页清空播放列表时白屏的问题

`2022.11.20  v0.0.1-alpha.9`
1. 【功能】本地音乐读取内嵌歌词
2. 【功能】批量编辑页新增了凑合能用的拖拽排序
3. 【功能】歌曲详情浮层新增凑合能用的定时关闭
4. 【功能】添加到歌单时可以新建歌单
5. 【功能】本地音乐扫描支持外置sd卡；支持导入aac格式
6. 【优化】优化播放列表浮层拉起时的锚定
7. 【修复】修复更新弹窗无法滚动的问题
8. 【修复】修复安卓12状态栏概率不沉浸的问题
9. 【修复】修复安卓12、13播一首就停的问题
10. 【插件】示例插件有更新，可以删掉原有插件重新导入

`2022.11.13  v0.0.1-alpha.8`
1. 【功能】侧边栏插件设置新增“订阅插件”功能，订阅之后直接点击“更新插件”即可更新，不需要清空重装了
2. 【功能】本地音乐读取内置封面
3. 【功能】本地音乐歌单支持批量删除（不删除源文件）
4. 【优化】重写导入本地音乐的逻辑，支持多选文件夹；修复部分机型重启应用时本地音乐消失的问题（可能需要删除后重新导入）；支持导入flac,wav,wav,m4a,ogg等格式
5. 【优化】重写播放列表浮层，拉起时会锚定到当前正在播放的歌曲
6. 【优化】调整部分逻辑，可能会减少音频卡顿时卡死的情况
7. 【修复】修复歌曲详情页进度条不连续的问题
8. 【修复】修复某些情况下无法关联歌词的问题
9. 【修复】修复正在播放的歌曲无歌词时，进入歌词页白屏的问题
10. 【插件】示例插件有更新，可以删掉原有插件重新导入

`2022.10.30  v0.0.1-alpha.7`
1. 新增功能：历史记录一键清空
2. 新增功能：歌手页、本地歌单页支持批量编辑
3. 修复移动网络下无法播放本地音乐的问题
4. 样式优化&修复：toast提示显示异常、侧边栏样式优化、歌单内序号显示不全、【关于】页无法滑动
5. 之前使用的拖拽排序组件在列表较大时有很严重的性能问题，会导致卡顿甚至白屏，因此批量编辑页暂时去掉了拖拽排序，后续会重新加上

`2022.10.22  v0.0.1-alpha.6`
1. 重要!! v0.0.1-alpha.5以前的版本无法通过app正常更新，请在gitee/github发布页下载最新版本(v0.0.1-alpha.6)，或QQ群自取；
2. 导入本地音乐时，如果未识别本地音乐文件，则会使用文件名作为音乐名；
3. 自建歌单、专辑详情页增加批量选择功能，可点击右上角查看(歌曲较多时可能有点卡，后续优化)；使用方式：选中歌曲可进行下一首播放/加入歌单/下载/删除，长按拖动进行排序；删除/排序后点击保存按钮方可生效
4. 调整歌单内歌曲编号字体大小；

`2022.10.16  v0.0.1-alpha.5`
1. 新增功能：导入本地音乐文件
2. 从网络源安装的插件可在插件页直接更新
3. 调整下载逻辑

`2022.10.06  v0.0.1-alpha.4`
1. 修复专辑详情页没有loading的问题
2. 为插件新增Cookie管理器
3. 优化播放页的显示
4. 新增一键卸载全部插件的功能

`2022.10.04  v0.0.1-alpha.3`
1. 修复设置页无法滚动的问题
2. 修复播放结束时可能暂停的问题

`2022.10.03  v0.0.1-alpha.2`
1. 插件协议更新，需要重新安装插件
2. 支持批量导入插件
3. 新增清空播放列表功能
4. 优化搜索结果面板和播放专辑逻辑

`2022.10.02`
测试版本出现啦！撒花
