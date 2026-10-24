import type { IInjectable } from "@/types/infra";

export interface IMusicHistory extends IInjectable {
    /**
     * Get current music history
     */
    readonly history: IMusic.IMusicItem[];
    
    /**
     * Initialize music history from storage
     */
    setup(): Promise<void>;
    
    /**
     * Add a music item to history
     */
    addMusic(musicItem: IMusic.IMusicItem): Promise<void>;

    /**
     * 用播放器实际解析出的时长回填历史条目（第三方音源常缺 duration，
     * 导致"听歌时长"统计为 0；播放后播放器能解析出真实时长）
     */
    updateDuration(musicItem: IMusic.IMusicItem, durationSec: number): Promise<void>;
    
    /**
     * Remove a music item from history
     */
    removeMusic(musicItem: IMusic.IMusicItem): Promise<void>;
    
    /**
     * Clear all music history
     */
    clearMusic(): Promise<void>;
    
    /**
     * Set new music history
     */
    setHistory(newHistory: IMusic.IMusicItem[]): Promise<void>;
}
