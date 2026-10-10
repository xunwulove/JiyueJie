import React from "react";

import { ROUTE_PATH, useNavigate } from "@/core/router";
import AppBar from "@/components/base/appBar";
import { showPanel } from "@/components/panels/usePanel";
import { showDialog } from "@/components/dialogs/useDialog";

interface INavBarProps {
    navTitle: string;
    musicList: IMusic.IMusicItem[] | null;
    /** 是否显示右侧操作图标（搜索 + 三点菜单；接口歌单详情等场景关闭） */
    showActions?: boolean;
    /** 歌单元信息（批量编辑三级浮窗标题用） */
    musicSheet?: { title?: string; id?: string };
}

export default function (props: INavBarProps) {
    const navigate = useNavigate();
    const { navTitle, musicList = [], showActions = true, musicSheet } = props;

    if (!showActions) {
        return <AppBar>{navTitle}</AppBar>;
    }

    return (
        <AppBar
            actions={[
                {
                    icon: "magnifying-glass",
                    onPress() {
                        navigate(ROUTE_PATH.SEARCH_MUSIC_LIST, {
                            musicList: musicList,
                        });
                    },
                },
                {
                    icon: "ellipsis-vertical",
                    onPress() {
                        showPanel("AppBarMore", {
                            title: navTitle,
                            options: [
                                {
                                    icon: "pencil-square",
                                    title: "批量编辑",
                                    onPress() {
                                        // 三级浮窗（不再从二级页压二级页；接口/插件歌单无本地 id，删除/保存不适用）
                                        showDialog("MusicListEditorDialog", {
                                            musicSheet,
                                            musicList: musicList ?? [],
                                        });
                                    },
                                },
                            ],
                        });
                    },
                },
            ]}>
            {navTitle}
        </AppBar>
    );
}
