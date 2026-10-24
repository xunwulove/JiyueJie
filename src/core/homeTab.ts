import { atom } from "jotai";

/**
 * 主页当前 tab（对齐 tabBar SaltTab 枚举值：0 首页 / 1 搜索 / 2 音乐库 / 3 我的）。
 * 从 Home 组件内 useState 提升为全局原子，以便桌面快捷方式（App Shortcuts）、
 * 深链等外部入口驱动 tab 切换。用 number 而非枚举类型，避免 core → pages 依赖。
 */
export const homeTabAtom = atom<number>(0);
