import { musicHistorySheetId } from "@/constants/commonConst";
import { isSameMediaItem } from "@/utils/mediaUtils";
import { getStorage } from "@/utils/storage";
import { atom, getDefaultStore, useAtomValue } from "jotai";

import type { IAppConfig } from "@/types/core/config";
import type { IMusicHistory } from "@/types/core/musicHistory.js";
import type { IInjectable } from "@/types/infra";
import appMeta from "./appMeta";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { safeParse, safeStringify } from "@/utils/jsonUtil";


const musicHistoryAtom = atom<IMusic.IMusicItem[]>([]);
const musicHistoryStore = getOrCreateMMKV("music.MusicHistory");

/** 播放历史条目（含统计字段：最近播放时间/累计播放次数，向后兼容旧数据） */
export type IMusicHistoryItem = IMusic.IMusicItem & {
    /** 最近一次播放时间戳（旧数据无此字段则不计入"今日"） */
    playedAt?: number;
    /** 累计播放次数（旧数据无此字段默认 0） */
    playCount?: number;
};

class MusicHistory implements IMusicHistory, IInjectable {
    private configService!: IAppConfig;

    injectDependencies(configService: IAppConfig): void {
        this.configService = configService;
    }

    get history() {
        return getDefaultStore().get(
            musicHistoryAtom,
        ) as IMusicHistoryItem[];
    }

    async setup() {
        if (appMeta.historySheetVersion < 1) {
            await this.migrateToMMKV();
        }

        const history = safeParse(musicHistoryStore.getString("history") ?? "[]") as IMusic.IMusicItem[];
        getDefaultStore().set(musicHistoryAtom, history ?? []);
    }

    async addMusic(musicItem: IMusic.IMusicItem) {
        const prev = this.history.find(item =>
            isSameMediaItem(item, musicItem),
        );
        const enriched: IMusicHistoryItem = {
            ...musicItem,
            playedAt: Date.now(),
            playCount: (prev?.playCount ?? 0) + 1,
        };
        const newMusicHistory: IMusicHistoryItem[] = [
            enriched,
            ...this.history.filter(
                item => !isSameMediaItem(item, musicItem),
            ),
        ].slice(0, this.configService.getConfig("basic.maxHistoryLen") ?? 50);

        musicHistoryStore.set("history", safeStringify(newMusicHistory));
        getDefaultStore().set(musicHistoryAtom, newMusicHistory);
    }

    async removeMusic(musicItem: IMusic.IMusicItem) {
        const newMusicHistory = this.history
            .filter(item => !isSameMediaItem(item, musicItem));
        
        musicHistoryStore.set("history", safeStringify(newMusicHistory));
        getDefaultStore().set(musicHistoryAtom, newMusicHistory);
    }

    async clearMusic() {
        musicHistoryStore.set("history", safeStringify([]));
        getDefaultStore().set(musicHistoryAtom, []);
    }

    async setHistory(newHistory: IMusic.IMusicItem[]) {
        musicHistoryStore.set("history", safeStringify(newHistory));
        getDefaultStore().set(musicHistoryAtom, newHistory);
    }

    async migrateToMMKV() {
        const history = await getStorage(musicHistorySheetId);
        if (history?.length) {
            musicHistoryStore.set("history", safeStringify(history));
        }
        appMeta.setHistorySheetVersion(1);
    }
}


export function useMusicHistory() {
    return useAtomValue(musicHistoryAtom) as IMusicHistoryItem[];
}

const musicHistory = new MusicHistory();
export default musicHistory;

