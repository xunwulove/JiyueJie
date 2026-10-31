/**
 * 源鉴探测设置（独立 App「源鉴」）
 *
 * 关键词可配置：用户可为每个搜索类型自定义探测主关键词（覆盖默认词表主词，
 * 次词仍用默认兜底）。配置持久化于 MMKV「probe.setting」，探测时经
 * effectiveKeywords() 合并生效。
 */
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { SearchType, SEARCH_TYPES, SEARCH_KEYWORDS } from "./index";

const settingStore = getOrCreateMMKV("probe.setting");

const KEY_PREFIX = "kw.";

/** 读取某类型自定义主词（空/未配置 → null 表示用默认） */
export function loadKeywordOverride(type: SearchType): string | null {
    const raw = settingStore.getString(`${KEY_PREFIX}${type}`);
    const v = raw?.trim();
    return v ? v : null;
}

/** 保存某类型自定义主词（空串 = 恢复默认） */
export function saveKeywordOverride(type: SearchType, keyword: string) {
    const v = keyword.trim();
    if (v) {
        settingStore.set(`${KEY_PREFIX}${type}`, v);
    } else {
        settingStore.delete(`${KEY_PREFIX}${type}`);
    }
}

/** 恢复全部默认（清空所有自定义主词） */
export function resetKeywordOverrides() {
    SEARCH_TYPES.forEach(t => settingStore.delete(`${KEY_PREFIX}${t}`));
}

/** 当前生效的关键词表（自定义主词在前 + 默认兜底，去重） */
export function effectiveKeywords(type: SearchType): readonly string[] {
    const override = loadKeywordOverride(type);
    if (!override) {
        return SEARCH_KEYWORDS[type];
    }
    const defaults = SEARCH_KEYWORDS[type];
    const merged = [override, ...defaults.filter(k => k !== override)];
    return merged;
}

/** 当前生效的主词（UI 展示用：自定义或默认） */
export function currentPrimaryKeyword(type: SearchType): string {
    return loadKeywordOverride(type) ?? SEARCH_KEYWORDS[type][0];
}
