/**
 * 极悦界 内置音源订阅源
 *
 * 发布在 gitee 公开仓库 jiyuejie（软件更新 + 音源订阅同仓）的 sources 目录（raw 直链），
 * 更新方式 = git push 覆盖 sources/plugins.json（URL 不变，无需重建 release）。
 * 内容：98 个 MusicFree 音源插件清单（极悦界音源整合版；2026-10-19 移除不可达的腾讯音乐源）。
 *
 * 目录结构：updates/（软件更新 version.json + APK）、sources/（音源订阅 plugins.json + 验证脚本）。
 * 历史：原音源仓库 jishijie-release 已废弃；仓库 jiyuejie-updates 已改名为 jiyuejie。
 * 备用 CDN：https://raw.giteeusercontent.com/xunwulove/jiyuejie/raw/master/sources/plugins.json
 */
export const DEFAULT_PLUGIN_SUBSCRIPTION_URL =
    "https://gitee.com/xunwulove/jiyuejie/raw/master/sources/plugins.json";
