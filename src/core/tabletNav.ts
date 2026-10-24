import { useNavigation } from "@react-navigation/native";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

/** 平板二级页覆盖层栈：从右内容区滑入覆盖（不盖 tab 栏与左播放区） */
export interface ITabletSubPage {
    /** 路由 path（对应 ROUTE_PATH / routes 注册表） */
    path: string;
    /** 路由参数 */
    params?: any;
    /** 唯一 key（用于 React 渲染） */
    key: string;
}

export const tabletSubPagesAtom = atom<ITabletSubPage[]>([]);

/** 平板全屏播放层状态：true 时覆盖整个界面（含左播放区与 tab 栏，全项目唯一全屏操作） */
export const fullPlayingAtom = atom(false);

/** 栈顶（当前显示的二级页） */
export const tabletTopSubPageAtom = atom(get => {
    const pages = get(tabletSubPagesAtom);
    return pages[pages.length - 1] ?? null;
});

/** 关闭栈顶（返回上一级/回到 tab 内容） */
export function popTabletSubPage(
    pages: ITabletSubPage[],
): ITabletSubPage[] {
    return pages.slice(0, -1);
}

/**
 * 通用返回：全屏播放层打开时先关全屏层；平板覆盖层激活时 pop 覆盖层栈；否则走 React Navigation goBack
 * （AppBar / 各二级页 navBar 的返回按钮统一使用）
 */
export function useGoBack() {
    const navigation = useNavigation<any>();
    const setSubPages = useSetAtom(tabletSubPagesAtom);
    const subPages = useAtomValue(tabletSubPagesAtom);
    const fullPlaying = useAtomValue(fullPlayingAtom);
    const setFullPlaying = useSetAtom(fullPlayingAtom);

    return useCallback(() => {
        if (fullPlaying) {
            // 全屏播放层（唯一全屏操作）优先关闭，返回上一层级
            setFullPlaying(false);
            return;
        }
        if (subPages.length > 0) {
            setSubPages(prev => popTabletSubPage(prev));
        } else {
            navigation.goBack();
        }
    }, [fullPlaying, subPages.length, navigation, setSubPages, setFullPlaying]);
}
