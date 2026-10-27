import React, { useCallback } from "react";
import { StyleSheet, View, BackHandler, DeviceEventEmitter } from "react-native";
import { useNavigation } from "@react-navigation/native";

import MusicBar from "@/components/musicBar";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBar from "@/components/base/statusBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import Theme from "@/core/theme";
import HomeBody from "./components/homeBody";
import TabBar, { SaltTab } from "./components/tabBar";
import MineTab from "./components/mineTab";
import LibraryTab from "./components/libraryTab";
import TabletPanel from "./components/tabletPanel";
import SearchPage from "@/pages/searchPage";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { fullPlayingAtom, tabletSubPagesAtom } from "@/core/tabletNav";
import { homeTabAtom } from "@/core/homeTab";
import { ROUTE_PATH } from "@/core/router";
import NativeUtils from "@/native/utils";
import { checkUpdateAndShowResult } from "@/hooks/useCheckUpdate";
import MusicDetail from "@/pages/musicDetail";
import useIsTablet from "@/hooks/useIsTablet";
import { useEffect } from "react";
import SubPageOverlay from "./components/subPageOverlay";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { vw } from "@/utils/rpx";

function renderTab(
    tab: SaltTab,
    setTab: (t: SaltTab) => void,
    isTablet: boolean,
): React.ReactElement {
    switch (tab) {
    case SaltTab.HOME:
        return (
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                {/* 2026-10-27 手机版 UI 精简：首页顶部搜索条去除（搜索入口在底部 Tab 栏"搜索" tab，
                    平板本来就不渲染页内搜索框，规范 11.7）；平板分支保持不变 */}
                <HomeBody />
            </HorizontalSafeAreaView>
        );
    case SaltTab.SEARCH:
        // 平板：搜索独占模式（输入框在顶栏 tab 栏），页内隐藏重复搜索框
        return isTablet ? (
            <SearchPage standalone hideNavBar />
        ) : (
            <SearchPage standalone />
        );
    case SaltTab.LIBRARY:
        return <LibraryTab />;
    case SaltTab.MINE:
        return (
            <MineTab
                onGoSheets={() => setTab(SaltTab.HOME)}
            />
        );
    }
}

function Home() {
    const [selectedTab, setSelectedTab] = useAtom(homeTabAtom);
    const isTablet = useIsTablet();
    const setSubPages = useSetAtom(tabletSubPagesAtom);
    const subPages = useAtomValue(tabletSubPagesAtom);
    const setFullPlaying = useSetAtom(fullPlayingAtom);
    const navigation = useNavigation<any>();

    // 共享轴转场：二级页从右滑入时，一级内容同向左移被"推走"（tab 栏与左播放区固定不动）。
    // 位移量 = 12% 屏宽：视觉可见但绝不越过左播放区右缘（30% 屏宽），
    // 遵守"左播放区严禁任何界面内容遮挡"的硬约束（原 28% 会越界进播放区，已修正）
    const shiftDistance = vw(100) * 0.12;
    const contentShift = useSharedValue(0);
    useEffect(() => {
        contentShift.value = withTiming(
            subPages.length > 0 ? -shiftDistance : 0,
            { duration: 240 },
        );
    }, [subPages.length, shiftDistance]);
    const contentAnimStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: contentShift.value }],
    }));

    // 任何界面（含二级页/三级浮窗）点击 tab：清空覆盖层栈 + 切换到对应一级页
    const switchTab = useCallback(
        (tab: SaltTab) => {
            setSubPages([]);
            setSelectedTab(tab);
        },
        [setSubPages, setSelectedTab],
    );

    // ===== 桌面快捷方式（App Shortcuts）=====
    // 原生 MainActivity 解析 shortcuts.xml 的 action 后：热启动 emit "AppShortcut" 事件；
    // 冷启动写 pending，由 NativeUtils.consumePendingShortcutAction() 兜底读取
    const handleShortcut = useCallback(
        (action: string | null) => {
            if (!action) {
                return;
            }
            switch (action) {
            case "play":
                // 打开播放页：平板切全屏播放层，手机走 MUSIC_DETAIL 路由（先清覆盖层）
                setSubPages([]);
                if (isTablet) {
                    setFullPlaying(true);
                } else {
                    navigation.navigate(ROUTE_PATH.MUSIC_DETAIL);
                }
                break;
            case "local":
                switchTab(SaltTab.LIBRARY);
                break;
            case "search":
                switchTab(SaltTab.SEARCH);
                break;
            case "update":
                checkUpdateAndShowResult(true);
                break;
            default:
                break;
            }
        },
        [
            isTablet,
            navigation,
            setSubPages,
            setFullPlaying,
            switchTab,
        ],
    );

    useEffect(() => {
        // 冷启动兜底：消费原生 pending action（JS 未加载时事件可能丢失）
        handleShortcut(NativeUtils.consumePendingShortcutAction());
        // 热启动：事件直达
        const sub = DeviceEventEmitter.addListener(
            "AppShortcut",
            handleShortcut,
        );
        return () => sub.remove();
    }, [handleShortcut]);

    // 搜索 tab（平板独占态 / 手机端整 tab 页）、音乐库与我的 tab：硬件返回键回首页 tab（避免直接退出 App）
    // 优先级低于 SubPageOverlay/全屏层（覆盖层激活时仍先逐级 pop，随后才落到本监听）
    useEffect(() => {
        if (
            selectedTab !== SaltTab.SEARCH &&
            selectedTab !== SaltTab.LIBRARY &&
            selectedTab !== SaltTab.MINE
        ) {
            return;
        }
        const sub = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                // 原生栈 push 了二级页时先交还给原生栈 pop，避免本监听吞掉首个返回键导致落点错误
                if (navigation.canGoBack()) {
                    return false;
                }
                switchTab(SaltTab.HOME);
                return true;
            },
        );
        return () => sub.remove();
    }, [selectedTab, switchTab, navigation]);

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.appWrapper}>
            <HomeStatusBar />
            {isTablet ? (
                // 平板：左播放区（严禁遮挡）+ 右内容区（顶端 4 tab）
                <View style={styles.tabletRow}>
                    <View style={styles.leftPanel}>
                        <TabletPanel />
                    </View>
                    <View style={styles.rightContent}>
                        <TabBar
                            horizontal
                            selectedTab={selectedTab}
                            onSelect={switchTab}
                            searchMode={
                                isTablet &&
                                selectedTab === SaltTab.SEARCH
                            }
                            onExitSearch={() =>
                                switchTab(SaltTab.HOME)
                            }
                        />
                        <View
                            style={[
                                globalStyle.flex1,
                                { overflow: "hidden" },
                            ]}>
                            {/* 共享轴：一级内容随二级页滑入同向左移；tab 栏在其上方保持固定。
                                overflow:hidden 裁剪左移越出内容区边界的部分——
                                一级页面绝不侵占左播放区（硬约束），右侧空隙由二级页滑入填充 */}
                            <Animated.View
                                style={[
                                    globalStyle.flex1,
                                    contentAnimStyle,
                                ]}>
                                {renderTab(
                                    selectedTab,
                                    switchTab,
                                    isTablet,
                                )}
                            </Animated.View>
                            {/* 平板二级页覆盖层：从右滑入，不盖 tab 与左播放区 */}
                            {isTablet ? <SubPageOverlay /> : null}
                        </View>
                    </View>
                </View>
            ) : (
                <View style={globalStyle.flex1}>
                    <View style={globalStyle.flex1}>
                        {renderTab(
                            selectedTab,
                            switchTab,
                            isTablet,
                        )}
                    </View>
                    <MusicBar />
                    <TabBar
                        selectedTab={selectedTab}
                        onSelect={switchTab}
                    />
                </View>
            )}
            {/* 平板全屏播放层：覆盖整个界面（含左播放区与 tab 栏，全项目唯一全屏操作） */}
            {isTablet ? <FullPlayingLayer /> : null}
        </SafeAreaView>
    );
}

/** 平板全屏播放层：fullPlaying 时整屏覆盖，返回键/返回按钮逐级关闭 */
function FullPlayingLayer() {
    const fullPlaying = useAtomValue(fullPlayingAtom);
    const setFullPlaying = useSetAtom(fullPlayingAtom);

    // Android 返回键：关闭全屏层（后注册，优先级高于覆盖层/面板监听）
    useEffect(() => {
        if (!fullPlaying) {
            return;
        }
        const sub = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                setFullPlaying(false);
                return true;
            },
        );
        return () => sub.remove();
    }, [fullPlaying, setFullPlaying]);

    if (!fullPlaying) {
        return null;
    }

    return (
        <View style={styles.fullPlayingLayer}>
            <MusicDetail />
        </View>
    );
}

function HomeStatusBar() {
    const theme = Theme.useTheme();

    return (
        <StatusBar
            backgroundColor="transparent"
            barStyle={theme.dark ? undefined : "dark-content"}
        />
    );
}

export default function App() {
    return <Home />;
}

const styles = StyleSheet.create({
    appWrapper: {
        flexDirection: "column",
        flex: 1,
    },
    tabletRow: {
        flex: 1,
        flexDirection: "row",
    },
    leftPanel: {
        width: "30%",
    },
    rightContent: {
        flex: 1,
        width: "70%",
    },
    fullPlayingLayer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // 层级编码规范：主层 05 次级界面层、近似 0505（沉浸播放/全屏播放页）。
        // 语义上全屏播放页与播放区/内容区互斥替换（同档内容），但渲染上必须盖过二级页面(0501)，
        // 否则平板右 70% 二级页面会压在全屏播放页上；无 elevation，低于所有浮窗（Panel 0509+/Dialog 0901+）
        zIndex: 505, // 概念编码 0505（JS 数值去前导零）
    },
});
