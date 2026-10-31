import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Loading from "@/components/base/loading";
import ThemeText from "@/components/base/themeText";
import Button from "@/components/base/textButton.tsx";
import Empty from "@/components/base/empty";
import Icon from "@/components/base/icon.tsx";
import useColors from "@/hooks/useColors";
import Color from "color";
import { useSetAtom } from "jotai";
import {
    PageStatus,
    initSearchResults,
    pageStatusAtom,
    queryAtom,
    searchResultsAtom,
} from "../store/atoms";
import {
    addHistory,
    getHistory,
    removeAllHistory,
    removeHistory,
} from "../common/historySearch";
import { getHotWords } from "../common/hotSearch";
import useSearch from "../hooks/useSearch";
import { useI18N } from "@/core/i18n";

/**
 * 空搜索状态 - 复刻 APlayer SearchPage：
 * 搜索历史（History 图标标题行 + 圆角标签带叉号）+ 热门搜索（火焰图标标题行 + 两列网格，
 * QQ 热搜主/网易云降级，24h 缓存；加载失败显示提示文案）
 */
export default function HistoryPanel() {
    const [history, setHistory] = useState<string[] | null>(null);
    const [hotWords, setHotWords] = useState<string[]>([]);
    const [hotLoading, setHotLoading] = useState(true);
    const [hotError, setHotError] = useState(false);
    const search = useSearch();
    const colors = useColors();

    const setQuery = useSetAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const { t } = useI18N();

    useEffect(() => {
        getHistory().then(setHistory);
        getHotWords()
            .then(words => {
                setHotWords(words);
                setHotError(false);
            })
            .catch(() => {
                setHotWords([]);
                setHotError(true);
            })
            .finally(() => setHotLoading(false));
    }, []);

    const triggerSearch = (word: string) => {
        if (!word) {
            return;
        }
        setSearchResultsState(initSearchResults);
        setPageStatus(PageStatus.SEARCHING);
        search(word, 1);
        addHistory(word);
        setQuery(word);
    };

    return (
        <View style={style.wrapper}>
            {history === null || hotLoading ? (
                <Loading />
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={style.scrollContent}>
                    {/* 搜索历史 */}
                    {history.length ? (
                        <>
                            <View style={style.header}>
                                <Icon
                                    name="clock"
                                    size={16}
                                    color={colors.primary}
                                />
                                <ThemeText
                                    fontSize="content"
                                    fontWeight="bold"
                                    style={style.headerText}>
                                    {t("searchPage.history")}
                                </ThemeText>
                                <Button
                                    style={style.clearBtn}
                                    fontColor="textSecondary"
                                    onPress={async () => {
                                        await removeAllHistory();
                                        getHistory().then(setHistory);
                                    }}>
                                    {t("common.clear")}
                                </Button>
                            </View>
                            <View style={style.chipRow}>
                                {history.map(_ => (
                                    <Pressable
                                        key={`search-history-${_}`}
                                        style={[
                                            style.chip,
                                            {
                                                backgroundColor: Color(
                                                    colors.surfaceVariant ??
                                                        colors.placeholder,
                                                )
                                                    .alpha(0.6)
                                                    .toString(),
                                            },
                                        ]}
                                        onPress={() => triggerSearch(_)}>
                                        <ThemeText
                                            fontSize="body"
                                            fontColor="textSecondary"
                                            numberOfLines={1}>
                                            {_}
                                        </ThemeText>
                                        <Pressable
                                            hitSlop={6}
                                            style={style.chipClose}
                                            onPress={async () => {
                                                await removeHistory(_);
                                                getHistory().then(setHistory);
                                            }}>
                                            <Icon
                                                name="x"
                                                size={14}
                                                color={colors.textSecondary}
                                            />
                                        </Pressable>
                                    </Pressable>
                                ))}
                            </View>
                        </>
                    ) : null}

                    {/* 热门搜索 */}
                    <View style={[style.header, history.length ? style.hotHeader : null]}>
                        <Icon
                            name="flame"
                            size={16}
                            color={Color(colors.primary)
                                .alpha(0.8)
                                .toString()}
                        />
                        <ThemeText
                            fontSize="body"
                            fontWeight="bold"
                            style={style.headerText}>
                            热门搜索
                        </ThemeText>
                    </View>
                    {hotError ? (
                        <ThemeText
                            fontSize="normal"
                            fontColor="textSecondary"
                            opacity={0.6}
                            style={style.hotError}>
                            热门搜索加载失败，请稍后重试
                        </ThemeText>
                    ) : (
                        <View style={style.hotGrid}>
                            {hotWords.map(word => (
                                <Pressable
                                    key={`hot-${word}`}
                                    style={({ pressed }) => [
                                        style.hotItem,
                                        {
                                            backgroundColor: pressed
                                                ? Color(
                                                    colors.primary,
                                                )
                                                    .alpha(0.1)
                                                    .toString()
                                                : Color(
                                                    colors.surfaceVariant ??
                                                          colors.placeholder,
                                                )
                                                    .alpha(0.6)
                                                    .toString(),
                                        },
                                    ]}
                                    onPress={() => triggerSearch(word)}>
                                    <ThemeText
                                        fontSize="body"
                                        fontWeight="medium"
                                        fontColor="textSecondary"
                                        numberOfLines={1}
                                        ellipsizeMode="tail">
                                        {word}
                                    </ThemeText>
                                </Pressable>
                            ))}
                            {!hotError && hotWords.length === 0 ? <Empty /> : null}
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        maxWidth: "100%",
        flexDirection: "column",
        padding: 16,
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    header: {
        width: "100%",
        flexDirection: "row",
        paddingVertical: 12,
        alignItems: "center",
    },
    headerText: {
        marginLeft: 6,
        flex: 1,
    },
    clearBtn: {
        paddingHorizontal: 8,
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 8,
        rowGap: 8,
    },
    chip: {
        flexGrow: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 18,
    },
    chipClose: {
        marginLeft: 6,
        paddingHorizontal: 6,
    },
    hotHeader: {
        marginTop: 12,
    },
    hotError: {
        paddingVertical: 8,
    },
    hotGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        /* 不用负 margin + 子项百分比 margin：wrap 下换行计算易出歧义（宽屏单列）。
           改为 space-between 分布，两列各 48.5%，任意宽度稳定两列 */
    },
    hotItem: {
        width: "48.5%",
        marginBottom: 10,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        alignItems: "flex-start",
    },
});
