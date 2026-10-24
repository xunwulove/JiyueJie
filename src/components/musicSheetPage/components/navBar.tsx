import React from "react";

import { ROUTE_PATH, useNavigate } from "@/core/router";
import AppBar from "@/components/base/appBar";

interface INavBarProps {
    navTitle: string;
    musicList: IMusic.IMusicItem[] | null;
    /** 是否显示右侧操作图标（搜索 + 三点菜单；接口歌单详情等场景关闭） */
    showActions?: boolean;
    /** 歌单元信息（已迁移：批量编辑入口改在 PlayAllBar 编辑按钮，弹 MusicListEditorDialog） */
    musicSheet?: { title?: string; id?: string };
}

export default function (props: INavBarProps) {
    const navigate = useNavigate();
    const { navTitle, musicList = [], showActions = true } = props;

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
            ]}>
            {navTitle}
        </AppBar>
    );
}
