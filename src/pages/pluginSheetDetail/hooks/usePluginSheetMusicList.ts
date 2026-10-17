import { RequestStateCode } from "@/constants/commonConst";
import PluginManager from "@/core/pluginManager";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 解析歌单详情：先尝试来源插件（推荐歌单等场景由该插件返回的歌单，
 * 其 getMusicSheetInfo 最可能成功）；失败再遍历其余具备
 * getMusicSheetInfo 能力的已启用插件逐个尝试。
 * 返回解析结果及对应插件；全部失败返回 null。
 * 注意：成功判定要求音乐列表非空，避免某插件对异平台歌单返回
 * 空 musicList（不抛错）时被误判为成功，导致详情页显示无歌曲。
 */
async function resolveSheetDetail(
    sheetItem: IMusic.IMusicSheetItem,
    page: number,
    pluginHash?: string,
): Promise<{
    pluginHash: string;
    result: IPlugin.ISheetInfoResult;
} | null> {
    // 判定：第一页必须拿到歌曲；后续页有数据即视为有用（合法中间页），
    // 空列表且未结束说明是异平台源，继续试下一个；空列表且已结束视为正常收尾。
    function isUseful(result: IPlugin.ISheetInfoResult | null | undefined) {
        if (!result) return false;
        const listLen =
            result?.musicList?.length ??
            result?.sheetItem?.musicList?.length ??
            0;
        if (page === 1) {
            return listLen > 0;
        }
        return listLen > 0 || result?.isEnd === true;
    }

    const candidates =
        PluginManager.getSortedPluginsWithAbility("getMusicSheetInfo");
    // 来源插件优先
    const ordered =
        pluginHash && candidates.some(p => p.hash === pluginHash)
            ? [
                  ...candidates.filter(p => p.hash === pluginHash),
                  ...candidates.filter(p => p.hash !== pluginHash),
              ]
            : candidates;
    for (const plugin of ordered) {
        try {
            const result = await plugin.methods?.getMusicSheetInfo?.(
                sheetItem,
                page,
            );
            if (isUseful(result) && result) {
                return { pluginHash: plugin.hash, result };
            }
        } catch {
            // 该插件解析失败，尝试下一个
        }
    }
    return null;
}

export default function usePluginSheetMusicList(
    originalSheetItem: IMusic.IMusicSheetItem | null,
    pluginHash?: string,
) {
    const currentPageRef = useRef(1);

    const [requestState, setRequestState] = useState<RequestStateCode>(RequestStateCode.IDLE);
    const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem | null>(
        originalSheetItem,
    );
    const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>(
        originalSheetItem?.musicList ?? [],
    );

    const getSheetDetail = useCallback(
        async function () {
            // 加载中：直接退出
            if (originalSheetItem === null ||
                requestState === RequestStateCode.FINISHED ||
                requestState === RequestStateCode.PENDING_FIRST_PAGE ||
                requestState === RequestStateCode.PENDING_REST_PAGE) {
                return;
            }
            try {
                if (currentPageRef.current === 1) {
                    setRequestState(RequestStateCode.PENDING_FIRST_PAGE);
                } else {
                    setRequestState(RequestStateCode.PENDING_REST_PAGE);
                }
                const resolved = await resolveSheetDetail(
                    originalSheetItem,
                    currentPageRef.current,
                    pluginHash,
                );
                if (!resolved) {
                    throw new Error();
                }
                const { result } = resolved;
                if (result?.sheetItem) {
                    setSheetItem(prev => ({
                        ...(prev ?? {}),
                        ...(result.sheetItem as IMusic.IMusicSheetItem),
                        platform: originalSheetItem.platform,
                    }));
                }
                if (result?.musicList) {
                    setMusicList(prev => {
                        if (currentPageRef.current === 1) {
                            return result?.musicList ?? prev;
                        } else {
                            return [...prev, ...(result.musicList ?? [])];
                        }
                    });
                }
                if (result.isEnd) {
                    setRequestState(RequestStateCode.FINISHED);
                } else {
                    setRequestState(RequestStateCode.PARTLY_DONE);
                }
                currentPageRef.current += 1;
            } catch {
                setRequestState(RequestStateCode.ERROR);
            }
        },
        [requestState],
    );

    useEffect(() => {
        getSheetDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return [requestState, sheetItem, musicList, getSheetDetail] as const;
}
