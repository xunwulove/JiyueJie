import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { safeParse, safeStringify } from "@/utils/jsonUtil";

/**
 * 播放事件流 - 听歌时长统计的数据源（重构后口径）：
 * 每次"有效收听"记一条事件（含实际收听秒数），不按歌聚合、不覆盖，
 * 时段统计 = 按事件 ts 过滤求和，精确归属今日/本周/今年（修复旧实现
 * "最近播放时间 × 累计次数"导致跨时段虚大的问题）。
 */
export interface IPlayEvent {
    /** platform-id 去重主键 */
    key: string;
    /** 歌曲标题（快照） */
    title?: string;
    /** 歌手 */
    artist?: string;
    /** 封面（快照） */
    artwork?: string;
    /** 歌曲时长（秒，可缺省/0） */
    duration?: number;
    /** 事件提交时间戳（毫秒），用于时段归属 */
    ts: number;
    /** 实际收听秒数（播放器 currentTime 增量累计） */
    listenedSec: number;
}

const playEventsAtom = atom<IPlayEvent[]>([]);
const playEventsStore = getOrCreateMMKV("music.PlayEvents");

/** 事件流上限：滚动截断，防 MMKV 单 key 无限膨胀（约 3 万条 ≈ 数 MB） */
const MAX_EVENTS = 30000;

class PlayEvents {
    get all(): IPlayEvent[] {
        return getDefaultStore().get(playEventsAtom);
    }

    async setup() {
        const events = safeParse(
            playEventsStore.getString("events") ?? "[]",
        ) as IPlayEvent[];
        getDefaultStore().set(
            playEventsAtom,
            Array.isArray(events) ? events : [],
        );
    }

    /** 追加一条有效收听事件（最新在前，超限从尾部裁剪） */
    add(event: IPlayEvent) {
        const next = [event, ...this.all].slice(0, MAX_EVENTS);
        playEventsStore.set("events", safeStringify(next));
        getDefaultStore().set(playEventsAtom, next);
    }

    /** 清空（调试用） */
    clear() {
        playEventsStore.set("events", safeStringify([]));
        getDefaultStore().set(playEventsAtom, []);
    }

    /** 按时段过滤（[fromMs, toMs) 毫秒，含 from 不含 to；端点为空不限） */
    getEvents(fromMs?: number, toMs?: number): IPlayEvent[] {
        return this.all.filter(
            it =>
                (fromMs === undefined || it.ts >= fromMs) &&
                (toMs === undefined || it.ts < toMs),
        );
    }
}

const playEvents = new PlayEvents();
export default playEvents;

export function usePlayEvents() {
    return useAtomValue(playEventsAtom) as IPlayEvent[];
}
