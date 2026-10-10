import React from "react";
import NavBar from "./components/navBar";
import MusicBar from "@/components/musicBar";
import SheetMusicList from "./components/sheetMusicList";
import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import VerticalSafeAreaView from "../base/verticalSafeAreaView";
import { RequestStateCode } from "@/constants/commonConst";

interface IMusicSheetPageProps {
    navTitle: string;
    sheetInfo: ICommon.WithMusicList<IMusic.IMusicSheetItemBase> | null;
    musicList?: IMusic.IMusicItem[] | null;
    // 是否可收藏
    canStar?: boolean;
    // 是否显示顶部右侧操作图标（搜索/三点菜单；接口歌单详情默认关闭）
    showNavActions?: boolean;
    // 状态
    state: RequestStateCode;
    onRetry?: () => void;
    onLoadMore?: () => void;
}

export default function MusicSheetPage(props: IMusicSheetPageProps) {
    const { navTitle, sheetInfo, musicList, canStar, onLoadMore, onRetry, state, showNavActions } =
        props;

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <NavBar
                musicList={musicList ?? sheetInfo?.musicList ?? []}
                navTitle={navTitle}
                showActions={showNavActions}
                musicSheet={
                    (sheetInfo as { id?: string })?.id
                        ? { title: navTitle, id: (sheetInfo as { id?: string })?.id }
                        : { title: navTitle }
                }
            />
            <SheetMusicList
                canStar={canStar}
                sheetInfo={sheetInfo as any}
                musicList={musicList ?? sheetInfo?.musicList}
                state={state}
                onRetry={onRetry}
                onLoadMore={onLoadMore}
            />
            <MusicBar />
        </VerticalSafeAreaView>
    );
}
