import React, { useCallback, useEffect, useState } from "react";
import MusicSheetPage from "@/components/musicSheetPage";
import { useParams } from "@/core/router";
import i18n from "@/core/i18n";
import { getCachedSheetDetail } from "@/core/api/cache";
import { RequestStateCode } from "@/constants/commonConst";

/**
 * 网易/QQ 接口歌单·榜单详情（二级页）
 * - 网易：榜单/歌单详情统一走 /api/v3/playlist/detail
 * - QQ：榜单走 fcg_v8_toplist_cp；歌单详情因直连接口反爬，走 QQ 系插件 getMusicSheetInfo
 * - 数据每日缓存，拉取失败回退上一次数据
 * - 歌曲为接口元数据（apiSource 标记），播放时由 playMatcher 统一匹配"我们的源"
 */
export default function ApiSheetDetail() {
    const { sheetInfo } = useParams<"api-sheet-detail">();

    const [state, setState] = useState(RequestStateCode.PENDING_FIRST_PAGE);
    const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>([]);

    const getDetail = useCallback(async () => {
        if (!sheetInfo) {
            setState(RequestStateCode.ERROR);
            return;
        }
        setState(RequestStateCode.PENDING_FIRST_PAGE);
        const list = await getCachedSheetDetail(sheetInfo);
        if (list && list.length) {
            setMusicList(list);
            setState(RequestStateCode.FINISHED);
        } else {
            setState(RequestStateCode.ERROR);
        }
    }, [sheetInfo]);

    useEffect(() => {
        getDetail();
    }, [getDetail]);

    return (
        <MusicSheetPage
            canStar
            showNavActions={false}
            sheetInfo={sheetInfo ?? null}
            navTitle={sheetInfo?.title ?? i18n.t("common.sheet")}
            musicList={musicList}
            state={state}
            onRetry={getDetail}
        />
    );
}
