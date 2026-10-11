import Icon, { IIconName } from "@/components/base/icon.tsx";
import IconButton from "@/components/base/iconButton";
import Input from "@/components/base/input";
import Button from "@/components/base/textButton.tsx";
import ThemeText from "@/components/base/themeText";
import { fontWeightConst, iconSizeConst } from "@/constants/uiConst";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { tabletSubPagesAtom } from "@/core/tabletNav";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { addHistory } from "@/pages/searchPage/common/historySearch";
import useSearch from "@/pages/searchPage/hooks/useSearch";
import {
    PageStatus,
    initSearchResults,
    pageStatusAtom,
    queryAtom,
    searchResultsAtom,
} from "@/pages/searchPage/store/atoms";

/** 盐音 4 Tab（对齐 APlayer SaltTab：首页/搜索/音乐库/我的） */
export enum SaltTab {
    HOME = 0,
    SEARCH = 1,
    LIBRARY = 2,
    MINE = 3,
}

const TABS: Array<{ key: SaltTab; icon: IIconName; title: string }> = [
    { key: SaltTab.HOME, icon: "home-outline", title: "首页" },
    { key: SaltTab.SEARCH, icon: "magnifying-glass", title: "搜索" },
    { key: SaltTab.LIBRARY, icon: "folder-music-outline", title: "音乐库" },
    { key: SaltTab.MINE, icon: "user", title: "我的" },
];

interface ITabBarProps {
    selectedTab: SaltTab;
    onSelect: (tab: SaltTab) => void;
    /** 平板：顶部 tab 行（品牌渐变底） */
    horizontal?: boolean;
    /** 平板搜索独占态：顶栏切换为 返回+搜索输入框+搜索按钮，隐藏 4 tab */
    searchMode?: boolean;
    onExitSearch?: () => void;
}

export default function TabBar(props: ITabBarProps) {
    const { selectedTab, onSelect, horizontal, searchMode, onExitSearch } =
        props;
    const colors = useColors();
    const { t } = useI18N();

    if (horizontal && searchMode) {
        return (
            <SearchBar
                onBack={onExitSearch}
                colors={colors}
                searchPlaceholder={t("searchPage.searchPlaceHolder")}
            />
        );
    }

    if (horizontal) {
        return (
            <HorizontalBar
                selectedTab={selectedTab}
                onSelect={onSelect}
                colors={colors}
            />
        );
    }

    return (
        <View style={[styles.bContainer, { backgroundColor: colors.tabBar }]}>
            {TABS.map(tab => {
                const selected = tab.key === selectedTab;
                return (
                    <Pressable
                        key={tab.key}
                        style={styles.bTab}
                        onPress={() => onSelect(tab.key)}>
                        <Icon
                            name={tab.icon}
                            size={24}
                            color={selected ? colors.primary : colors.textSecondary}
                        />
                        <ThemeText
                            fontSize="subTitle"
                            style={{
                                marginTop: rpx(4),
                                color: selected
                                    ? colors.primary
                                    : colors.textSecondary,
                                fontWeight: selected
                                    ? fontWeightConst.semibold
                                    : fontWeightConst.regular,
                            }}>
                            {tab.title}
                        </ThemeText>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** 平板顶栏 - 对齐 APlayer TabletTopBar：surface 背景 + 4 tab（选中 primary α12% 圆角底 + primary 文字）+ 右端设置齿轮 */
function HorizontalBar({
    selectedTab,
    onSelect,
    colors,
}: {
    selectedTab: SaltTab;
    onSelect: (tab: SaltTab) => void;
    colors: ReturnType<typeof useColors>;
}) {
    const navigate = useNavigate();
    const setSubPages = useSetAtom(tabletSubPagesAtom);
    const subPages = useAtomValue(tabletSubPagesAtom);
    /* 设置页激活时：4 tab 取消高亮，齿轮高亮（表示当前处于设置层级） */
    const inSetting = subPages.some(
        p => p.path === ROUTE_PATH.SETTING,
    );
    return (
        <View
            style={[
                styles.hContainer,
                { backgroundColor: colors.background },
            ]}>
            {/* 4 tab 整体居中（中心与内容区中心水平对齐）；齿轮绝对定位右端不参与布局 */}
            <View style={styles.hTabGroup}>
                {TABS.map(tab => {
                    const selected =
                        !inSetting && tab.key === selectedTab;
                    const activeColor = colors.primary;
                    const idleColor =
                        colors.textSecondary ?? "rgba(0,0,0,0.6)";
                    return (
                        <Pressable
                            key={tab.key}
                            style={[
                                styles.hTab,
                                selected
                                    ? {
                                          backgroundColor: Color(
                                              colors.primary,
                                          )
                                              .alpha(0.12)
                                              .toString(),
                                      }
                                    : null,
                            ]}
                            onPress={() => onSelect(tab.key)}>
                            <Icon
                                name={tab.icon}
                                size={32}
                                color={
                                    selected ? activeColor : idleColor
                                }
                            />
                            <ThemeText
                                fontSize="title"
                                style={{
                                    marginLeft: rpx(8),
                                    fontSize: 32,
                                    color: selected
                                        ? activeColor
                                        : idleColor,
                                    fontWeight: selected
                                        ? fontWeightConst.semibold
                                        : fontWeightConst.regular,
                                }}>
                                {tab.title}
                            </ThemeText>
                        </Pressable>
                    );
                })}
            </View>
            <IconButton
                name="cog-8-tooth"
                size={32}
                color={
                    inSetting
                        ? colors.primary
                        : colors.textSecondary ??
                          "rgba(0,0,0,0.6)"
                }
                accessibilityLabel="设置"
                style={styles.gearBtn}
                onPress={() => {
                    // 已在设置页：重复点击不做"清空→重开"（避免覆盖层卸载/重挂载竞态导致黑屏蓝条）
                    if (
                        subPages.some(
                            p => p.path === ROUTE_PATH.SETTING,
                        )
                    ) {
                        return;
                    }
                    // 齿轮属于一级层操作：先清空覆盖层栈（避免在设置页上再叠设置页），再进入设置页
                    setSubPages([]);
                    navigate(ROUTE_PATH.SETTING, { type: "basic" });
                }}
            />
        </View>
    );
}

/** 平板搜索独占态顶栏：返回箭头 + 渐变底 + 输入框 + 搜索按钮（与搜索页 NavBar 同款渐变） */
function SearchBar({
    onBack,
    searchPlaceholder,
}: {
    onBack?: () => void;
    colors: ReturnType<typeof useColors>;
    searchPlaceholder: string;
}) {
    const search = useSearch();
    const [query, setQuery] = useAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const colors = useColors();

    const onSearchSubmit = async () => {
        if (query === "") {
            return;
        }
        setSearchResultsState(initSearchResults);
        setPageStatus(prev =>
            prev === PageStatus.EDITING ? PageStatus.SEARCHING : prev,
        );
        await search(query, 1);
        await addHistory(query);
    };

    const isDark = (colors as any).dark === true;
    const searchBg =
        (colors as any).placeholder ??
        (isDark ? "rgba(128,128,128,0.15)" : "rgba(128,128,128,0.12)");
    const searchIconColor =
        (colors as any).placeholder
            ? "rgba(128,128,128,0.8)"
            : (isDark ? "rgba(226,232,240,0.7)" : "rgba(30,41,59,0.7)");

    return (
        <View
            style={[
                styles.hContainer,
                { backgroundColor: colors.background },
            ]}>
            <IconButton
                name="arrow-left"
                sizeType="normal"
                color={searchIconColor}
                style={styles.backBtn}
                onPress={onBack}
            />
            <View style={styles.searchBarContainer}>
                <Icon
                    name="magnifying-glass"
                    color={searchIconColor}
                    size={iconSizeConst.small}
                    style={styles.magnify}
                />
                <Input
                    autoFocus
                    style={[
                        styles.searchBar,
                        {
                            color: colors.text,
                            backgroundColor: searchBg,
                        },
                    ]}
                    onFocus={() => {
                        setPageStatus(PageStatus.EDITING);
                    }}
                    placeholderTextColor={
                        (colors as any).placeholder
                            ? "rgba(128,128,128,0.6)"
                            : (isDark
                                  ? "rgba(226,232,240,0.5)"
                                  : "rgba(30,41,59,0.5)")
                    }
                    placeholder={searchPlaceholder}
                    onSubmitEditing={onSearchSubmit}
                    onChangeText={_ => {
                        if (_ === "") {
                            setPageStatus(PageStatus.EDITING);
                        }
                        setQuery(_);
                    }}
                    value={query}
                />
                {query.length ? (
                    <IconButton
                        style={styles.close}
                        sizeType="light"
                        onPress={() => {
                            setQuery("");
                            setPageStatus(PageStatus.EDITING);
                        }}
                        color={searchIconColor}
                        name="x-mark"
                    />
                ) : null}
            </View>
            <Button
                style={styles.button}
                hitSlop={0}
                fontColor={"primary"}
                onPress={onSearchSubmit}>
                搜索
            </Button>
        </View>
    );
}

const styles = StyleSheet.create({
    hContainer: {
        height: 56, // 一级页顶栏高度（对齐 APlayer 56dp，固定值）
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(16),
    },
    hTabGroup: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    hTab: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: rpx(6),
        paddingHorizontal: rpx(14),
        paddingVertical: rpx(6),
        borderRadius: rpx(16),
    },
    gearBtn: {
        position: "absolute",
        right: rpx(8),
        zIndex: 2,
    },
    bContainer: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(0,0,0,0.05)",
        paddingBottom: rpx(8),
    },
    bTab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: rpx(12),
    },
    backBtn: {
        marginRight: rpx(8),
    },
    searchBarContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    searchBar: {
        minWidth: rpx(375),
        flex: 1,
        paddingHorizontal: rpx(64),
        borderRadius: rpx(64),
        height: 40,
        maxHeight: 40,
        alignItems: "center",
    },
    magnify: {
        position: "absolute",
        left: rpx(16),
        zIndex: 100,
    },
    close: {
        position: "absolute",
        right: rpx(16),
    },
    button: {
        paddingHorizontal: rpx(24),
        height: "100%",
        justifyContent: "center",
        flexDirection: "row",
        alignItems: "center",
    },
});
