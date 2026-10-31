// 国际化语言数据接口定义
export interface ILanguageData {
    // 通用词汇
    "common.cancel": string; // 取消
    "common.save": string; // 保存
    "common.done": string; // 完成
    "common.confirm": string; // 确认
    "common.view": string; // 查看
    "common.open": string; // 打开
    "common.emptyList": string; // 空列表
    "common.loading": string; // 加载中
    "common.error": string; // 出错
    "common.clickToRetry": string; // 点击重试
    "common.failToLoad": string; // 加载失败
    "common.listReachEnd": string; // 列表到底

    // 侧边栏相关

    // 检查更新相关
    "checkUpdate.error.latestVersion": string; // 当前已是最新版本

    // 首页相关

    // 对话框相关


    // 提示消息相关
    "toast.saveSuccess": string; // 保存成功

    // 本地音乐相关

    // 歌词相关

    // 音乐列表编辑器相关

    // 权限设置相关

    // 推荐歌单相关

    // 搜索音乐列表相关

    // 搜索页面相关

    // 榜单相关

    // 歌单详情相关

    // 历史记录相关

    // 下载相关

    // 艺术家详情相关

    // 插件设置相关
    "pluginSetting.pluginItem.options.updatePlugin": string; // 更新插件
    "pluginSetting.pluginItem.options.sharePlugin": string; // 分享插件
    "pluginSetting.pluginItem.options.uninstallPlugin": string; // 卸载插件
    "pluginSetting.pluginItem.options.uninstallPluginContent": string; // 确定卸载该插件吗？
    "pluginSetting.pluginItem.alternativePlugin": string; // 该插件实际使用的插件
    "pluginSetting.pluginItem.versionHint": string; // 版本提示
    "pluginSetting.pluginItem.author": string; // 作者
    "pluginSetting.pluginSetting.title": string; // 插件设置
    "pluginSetting.pluginSetting.empty": string; // 插件无设置项提示
    "pluginSetting.menu.sort": string; // 排序
    "pluginSetting.menu.uninstallAll": string; // 卸载所有
    "pluginSetting.menu.uninstallAllContent": string; // 确定卸载所有插件吗？
    "pluginSetting.menu.installPlugin": string; // 安装插件
    "pluginSetting.menu.installPluginDialogPlaceholder": string; // 插件安装对话框占位符
    "pluginSetting.menu.pluginInstallFailedDialogTitle": string; // 插件安装失败对话框标题
    "pluginSetting.menu.pluginUpdateFailedDialogTitle": string; // 插件更新失败对话框标题
    "pluginSetting.fabOptions.installFromLocal": string; // 从本地安装
    "pluginSetting.fabOptions.installFromNetwork": string; // 从网络安装
    "pluginSetting.fabOptions.updateAllPlugins": string; // 更新所有插件
    "pluginSetting.failReason": string; // 失败原因
    "pluginSetting.pluginInstallFailedDialogContent": string; // 插件安装失败对话框内容
    "pluginSetting.pluginUpdateFailedDialogContent": string; // 插件更新失败对话框内容
    "pluginSetting.installProgressDownload": string; // 批量安装下载进度
    "pluginSetting.installProgressMount": string; // 批量安装挂载进度
    "pluginSetting.installSummaryTitle": string; // 安装完成汇总标题
    "pluginSetting.installSummaryContent": string; // 安装完成汇总（成功/跳过/失败）
    "pluginSetting.largePluginSection": string; // 未挂载的大插件区块标题
    "pluginSetting.largePluginSize": string; // 大插件大小提示
    "pluginSetting.installLargePlugin": string; // 手动安装大插件按钮

    // 提示消息相关 - 插件操作
    "toast.pluginUpdateSuccess": string; // 插件更新成功
    "toast.failToUpdatePlugin": string; // 插件更新失败
    "toast.copiedToClipboard": string; // 已复制到剪贴板
    "toast.failToSharePlugin": string; // 插件分享失败
    "toast.pluginUninstalled": string; // 插件已卸载
    "toast.pluginSettingSaved": string; // 插件设置已保存
    "toast.scanFailOnboard": string; // 扫描失败，可稍后到音乐库重试
    "toast.pluginInstallSuccess": string; // 安装成功
    "toast.pluginInstallSuccessNamed": string; // 插件「{name}」安装成功
    "toast.pluginInstallFail": string; // 安装失败: {message}
    "toast.unknownPlugin": string; // 无法识别此插件
    "toast.irLoadFail": string; // IR 加载失败，请使用 16bit/48kHz WAV
    "toast.scanComplete": string; // 扫描完成，共 {count} 首歌曲
    "toast.cannotOpenLink": string; // 无法打开链接
    "toast.floatLyricPermissionFail": string; // 状态栏歌词开启失败，请到手机系统设置打开悬浮窗权限
    "toast.needInputPluginUrl": string; // 请输入插件链接
    "toast.noExportablePlugin": string; // 没有可导出的插件（仅支持导出有来源 URL 的插件）
    "toast.shareNotSupported": string; // 当前设备不支持系统分享，无法导出
    "toast.exportFail": string; // 导出失败：{reason}
    "toast.subscriptionUrlInput": string; // 请输入订阅链接
    "toast.subscriptionExists": string; // 该订阅已存在
    "toast.subscriptionAdded": string; // 已添加订阅
    "toast.subscriptionDeleted": string; // 已删除订阅
    "toast.subscriptionRestored": string; // 已恢复默认订阅
    "toast.installPluginSuccess": string; // 插件安装成功
    "toast.updatePluginSuccess": string; // 插件更新成功
    "toast.installPluginFail": string; // 插件安装失败
    "toast.allPluginInstallFailed": string; // 所有插件安装失败
    "toast.partialPluginInstallFailed": string; // 部分插件安装失败
    "toast.partialPluginInstallFailedWithReason": string; // 部分插件安装失败，原因：
    "toast.allPluginUpdateFailed": string; // 所有插件更新失败
    "toast.partialPluginUpdateFailed": string; // 部分插件更新失败
    "toast.subscriptionInvalid": string; // 订阅无效
    "toast.unknownError": string; // 未知错误

    // 主题设置相关


    // 自定义主题相关

    // 备份与恢复相关

    // 基本设置相关
    
    
    "basicSettings.autoUpdatePlugin": string; // 软件启动时自动更新插件
    "basicSettings.notCheckPluginVersion": string; // 安装插件时不校验版本
    "basicSettings.lazyLoadPlugin": string; // 启用插件懒加载（实验性功能）
    
    "basicSettings.sortPluginByReliability": string; // 音源可用率自动排序
    
    
    

    
    
    
    // 对话框相关 - 缓存设置
    "dialog.errorLogKnow": string; // 我知道了
    
    // 提示消息相关 - 缓存和日志
    
    // 音质相关

    // 播放全部栏相关

    // 无插件相关
    "noPlugin.title": string; // 还没有安装插件
    "noPlugin.titleWithType": string; // 还没有安装支持类型的插件
    "noPlugin.description": string; // 无插件描述

    // 对话框相关 - 存储权限
    "dialog.checkStorage.title": string; // 存储权限
    "dialog.checkStorage.content.0": string; // 存储权限内容0
    "dialog.checkStorage.content.1": string; // 存储权限内容1
    "dialog.checkStorage.content.2": string; // 存储权限内容2
    "dialog.checkStorage.content.3": string; // 存储权限内容3
    "dialog.checkStorage.button.doNotShowAgain": string; // 不再提示

    // 对话框相关 - 下载
    "dialog.markdownDialog.openExternalLink": string; // Markdown对话框打开外部链接
    "dialog.markdownDialog.clickToShowImage": string; // 点击展示图片
    "dialog.markdownDialog.loadFailed": string; // 图片加载失败

    // 面板相关 - 播放列表

    // 面板相关 - 添加到歌单

    // 面板相关 - 颜色选择器

    // 面板相关 - 音乐项歌词选项

    // 面板相关 - 音乐项选项    

    // 面板相关 - 音质设置

    // 面板相关 - 搜索歌词

    // 面板相关 - 字体大小设置

    // 面板相关 - 简单输入

    // 面板相关 - 定时关闭

    // 面板相关 - 播放速度

    // 面板相关 - 歌单标签

    // 播放模式相关

    // 音效设置（均衡器/低音增强/环绕声）
}

// 语言接口定义
export interface ILanguage {
    locale: string; // 语言代码
    name: string; // 语言名称
    languageData: ILanguageData; // 语言数据
}