/**
 * 全局持久化的状态
 */

import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { useEffect, useState } from "react";
import { safeParse } from "./jsonUtil";

// Internal Method
const getStore = () => {
    return getOrCreateMMKV("App.PersistStatus");
};

interface IPersistStatus {
    /** 当前的音乐 */
    "music.musicItem": IMusic.IMusicItem;
    /** 进度 */
    "music.progress": number;
    /** 模式 */
    "music.repeatMode": string;
    /** 列表 */
    "music.playList": IMusic.IMusicItem[];
    /** 速度 */
    "music.rate": number;
    /** 音质 */
    "music.quality": IMusic.IQualityKey;
    /** app */
    "app.skipVersion": string;
    /** 开屏弹窗 */
    "app.skipBootstrapStorageDialog": boolean;
    /** 首次启动引导页是否已完成（true 后不再展示；false/未设置则首启展示） */
    "app.onboardingDone": boolean;
    /** 语言设置 */
    "app.language": string;
    /** 上次更新插件的时间 */
    "app.pluginUpdateTime": number;
    /** 上次自动检查 app 更新的时间（用于每日节流） */
    "app.lastUpdateCheckTime": number;
    /** 推荐歌单"每日勘探"日期（yyyy-mm-dd；当天已勘探则跳过，每天最多一轮） */
    "app.recommendExploreDate": string;
    /** 最近一次检查更新的结果（我的页版本卡动态显示） */
    "app.updateCheckResult": {
        checkedAt: number;
        latestVersion: string | null;
        needUpdate: boolean;
    };
    /** 缓存的定时关闭自定义时间（分钟） */
    "app.scheduleCloseTime": number;
    /** 歌词-是否启用翻译 */
    "lyric.showTranslation": boolean;
    /** 歌词-详情页字体大小 */
    "lyric.detailFontSize": number;
}

function set<K extends keyof IPersistStatus>(
    key: K,
    value: IPersistStatus[K] | undefined,
) {
    const store = getStore();
    if (value === undefined) {
        store.delete(key);
    } else {
        store.set(key, JSON.stringify(value));
    }
}

function get<K extends keyof IPersistStatus>(key: K): IPersistStatus[K] | null {
    const store = getStore();
    const raw = store.getString(key);
    if (raw) {
        return safeParse(raw) as IPersistStatus[K];
    }
    return null;
}

function useValue<K extends keyof IPersistStatus>(
    key: K,
    defaultValue?: IPersistStatus[K],
): IPersistStatus[K] | null {
    const [state, setState] = useState<IPersistStatus[K] | null>(
        get(key) ?? defaultValue ?? null,
    );

    useEffect(() => {
        const store = getStore();
        const sub = store.addOnValueChangedListener(changedKey => {
            if (key === changedKey) {
                setState(get(key));
            }
        });

        return () => {
            sub.remove();
        };
    }, []);

    return state;
}

const PersistStatus = {
    get,
    set,
    useValue,
};

export default PersistStatus;
