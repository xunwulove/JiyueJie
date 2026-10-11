import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import NavBar from "./components/navBar";
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
import { useSetAtom, useAtomValue } from "jotai";
import { fullPlayingAtom, tabletSubPagesAtom } from "@/core/tabletNav";
import MusicDetail from "@/pages/musicDetail";
import useIsTablet from "@/hooks/useIsTablet";
import { BackHandler } from "react-native";
import { useEffect } from "react";
import SubPageOverlay from "./components/subPageOverlay";

function renderTab(
    tab: SaltTab,
    setTab: (t: SaltTab) => void,
    isTablet: boolean,
): React.ReactElement {
    switch (tab) {
        case SaltTab.HOME:
            return (
                <HorizontalSafeAreaView style={globalStyle.flex1}>
                    <>
                        {/* 平板：隐藏页内搜索框/标题（搜索入口在 tab 栏搜索 tab，规范 11.7） */}
                        {isTablet ? null : (
                            <NavBar
                                onSearchPress={() =>
                                    setTab(SaltTab.SEARCH)
                                }
                            />
                        )}
                        <HomeBody />
                    </>
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
    const [selectedTab, setSelectedTab] = useState<SaltTab>(SaltTab.HOME);
    const isTablet = useIsTablet();
    const setSubPages = useSetAtom(tabletSubPagesAtom);
    const navigation = useNavigation<any>();

    // 任何界面（含二级页/三级浮窗）点击 tab：清空覆盖层栈 + 切换到对应一级页
    const switchTab = useCallback(
        (tab: SaltTab) => {
            setSubPages([]);
            setSelectedTab(tab);
        },
        [setSubPages],
    );

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
                        <View style={globalStyle.flex1}>
                            {renderTab(
                                selectedTab,
                                switchTab,
                                isTablet,
                            )}
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
        zIndex: 2000,
    },
});
