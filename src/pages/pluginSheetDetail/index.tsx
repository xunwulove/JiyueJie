import React from "react";
import MusicSheetPage from "@/components/musicSheetPage";
import { useParams } from "@/core/router";
import usePluginSheetMusicList from "./hooks/usePluginSheetMusicList";
import i18n from "@/core/i18n";
import PluginManager from "@/core/pluginManager";

export default function PluginSheetDetail() {
    const { sheetInfo, pluginHash } = useParams<"plugin-sheet-detail">();

    const [requestState, sheetItem, musicList, getSheetDetail] =
        usePluginSheetMusicList(
            sheetInfo as IMusic.IMusicSheetItem,
            pluginHash,
        );

    // 歌单来源音源：进入时携带的插件 hash → 插件名（用于详情页头部展示来源）
    const plugin = PluginManager.getByHash(pluginHash ?? "");
    const sourcePluginName = plugin?.name;

    return (
        <MusicSheetPage
            canStar
            sheetInfo={sheetItem}
            navTitle={sheetInfo?.title ?? i18n.t("common.sheet")}
            musicList={musicList}
            state={requestState}
            onRetry={getSheetDetail}
            onLoadMore={getSheetDetail}
            sourcePluginName={sourcePluginName}
        />
    );
}
