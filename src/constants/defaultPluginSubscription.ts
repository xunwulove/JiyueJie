/**
 * 极悦界 内置音源订阅源
 *
 * 发布在 gitee 公开仓库 jishijie-release 的 master 分支（raw 直链），
 * 更新方式 = git push 覆盖 plugins.json（URL 不变，无需重建 release）。
 * 内容：28 个可用 MusicFree 音源插件清单（源自 music.nairocy.com 收集站，
 * 已剔除 gitee 风控/法律失效的源）。
 *
 * 历史：最初放 jiyuejie-updates release 附件（/latest/ 下载稳定），
 * 后按"覆盖更新"需求切到 jishijie-release raw（已验证 200 + push 覆盖生效）。
 * 备用 CDN：https://raw.giteeusercontent.com/xunwulove/jishijie-release/raw/master/plugins.json
 */
export const DEFAULT_PLUGIN_SUBSCRIPTION_URL =
    "https://gitee.com/xunwulove/jishijie-release/raw/master/plugins.json";
