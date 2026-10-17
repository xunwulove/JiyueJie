import React, { useCallback, useEffect, useState } from "react";
import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { TabBar, TabView } from "react-native-tab-view";
import ThemeText from "@/components/base/themeText";
import Image from "@/components/base/image";
import Icon from "@/components/base/icon.tsx";
import { ImgAsset } from "@/constants/assetsConst";
import { RequestStateCode } from "@/constants/commonConst";
import { fontWeightConst } from "@/constants/uiConst";
import ListEmpty from "@/components/base/listEmpty";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { getCachedSheets } from "@/core/api/cache";
import useColors from "@/hooks/useColors";
import useOrientation from "@/hooks/useOrientation";
import rpx, { vw } from "@/utils/rpx";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import MusicSheet, { useSheetIsStarred } from "@/core/musicSheet";
import Toast from "@/utils/toast";

/**
 * 网易/QQ 双 tab 列表页（推荐歌单 / 排行榜共用）
 * 数据层：网易/QQ 公开接口（非插件歌单能力）
 * 兜底：默认网易，数据失败自动切换 QQ
 */
type ApiPageType = "recommend" | "toplist";
type ApiPlatform = "netease" | "qq";

const TABS: Array<{ key: ApiPlatform; title: string }> = [
    { key: "netease", title: "网易云" },
    { key: "qq", title: "QQ音乐" },
];

interface IApiSheetsPageProps {
    type: ApiPageType;
}

export default function ApiSheetsPage(props: IApiSheetsPageProps) {
    const { type } = props;
    const [index, setIndex] = useState(0);
    const colors = useColors();
    const navigate = useNavigate();

    const loaders: Record<
        ApiPlatform,
        () => Promise<IMusic.IMusicSheetItemBase[] | null>
    > = {
        netease: () => getCachedSheets(type, "netease"),
        qq: () => getCachedSheets(type, "qq"),
    };

    /** 兜底：网易失败自动切 QQ */
    const onNeteaseError = useCallback(() => {
        setIndex(1);
    }, []);

    const renderScene = ({ route }: { route: { key: string } }) => {
        const platform = route.key as ApiPlatform;
        return (
            <ApiSheetList
                type={type}
                loader={loaders[platform]}
                onError={platform === "netease" ? onNeteaseError : undefined}
                onPress={sheetInfo =>
                    navigate(ROUTE_PATH.API_SHEET_DETAIL, { sheetInfo })
                }
            />
        );
    };

    return (
        <TabView
            lazy
            navigationState={{ index, routes: TABS }}
            renderTabBar={p => (
                <TabBar
                    {...p}
                    style={{
                        backgroundColor: "transparent",
                        shadowColor: "transparent",
                        borderColor: "transparent",
                    }}
                    tabStyle={{ width: "auto" }}
                    pressColor="transparent"
                    inactiveColor={colors.text}
                    activeColor={colors.primary}
                    renderLabel={({ route, focused, color }) => (
                        <Text
                            numberOfLines={1}
                            style={{
                                width: 120,
                                fontWeight: focused
                                    ? fontWeightConst.bolder
                                    : fontWeightConst.medium,
                                color,
                                textAlign: "center",
                            }}>
                            {route.title}
                        </Text>
                    )}
                    indicatorStyle={{
                        backgroundColor: colors.primary,
                        height: rpx(4),
                    }}
                />
            )}
            renderScene={renderScene}
            onIndexChange={setIndex}
            initialLayout={{ width: vw(100) }}
        />
    );
}

interface IApiSheetListProps {
    type: ApiPageType;
    loader: () => Promise<IMusic.IMusicSheetItemBase[] | null>;
    onError?: () => void;
    onPress: (sheet: IMusic.IMusicSheetItemBase) => void;
}

function ApiSheetList(props: IApiSheetListProps) {
    const { type, loader, onError, onPress } = props;
    const [sheets, setSheets] = useState<IMusic.IMusicSheetItemBase[]>([]);
    const [state, setState] = useState(RequestStateCode.PENDING_FIRST_PAGE);
    const orientation = useOrientation();

    const load = useCallback(async () => {
        setState(RequestStateCode.PENDING_FIRST_PAGE);
        const result = await loader();
        if (result?.length) {
            setSheets(result);
            setState(RequestStateCode.FINISHED);
        } else {
            setState(RequestStateCode.ERROR);
            onError?.();
        }
    }, [loader, onError]);

    useEffect(() => {
        load();
    }, [load]);

    const renderItem = ({
        item,
        index,
    }: {
        item: IMusic.IMusicSheetItemBase;
        index: number;
    }) => (
        <SheetCard
            item={item}
            index={index}
            type={type}
            onPress={() => onPress(item)}
        />
    );

    return (
        <FlatList
            data={sheets}
            keyExtractor={(item, i) => `${i}-${item.platform}-${item.id}`}
            numColumns={orientation === "vertical" ? 3 : 4}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            ListEmptyComponent={
                <ListEmpty state={state} onRetry={load} />
            }
            renderItem={renderItem}
        />
    );
}

const styles = StyleSheet.create({
    gridRow: {
        paddingHorizontal: rpx(24),
        columnGap: rpx(16),
    },
    gridContent: {
        paddingTop: rpx(24),
        paddingBottom: rpx(48),
    },
    card: {
        flex: 1,
        marginBottom: rpx(24),
    },
    coverBox: {
        position: "relative",
        marginBottom: 6,
    },
    cover: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 14,
    },
    rankBadge: {
        position: "absolute",
        right: 6,
        bottom: 6,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 6,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
    },
    starButton: {
        position: "absolute",
        right: 6,
        top: 6,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    title: {
        marginTop: 2,
    },
});

/**
 * 推荐歌单/排行榜卡片（封面右上角收藏按钮）
 */
function SheetCard({
    item,
    index,
    type,
    onPress,
}: {
    item: IMusic.IMusicSheetItemBase;
    index: number;
    type: ApiPageType;
    onPress: () => void;
}) {
    const starred = useSheetIsStarred(item as IMusic.IMusicSheetItem);

    const toggleStar = async () => {
        if (!starred) {
            await MusicSheet.starMusicSheet(
                item as IMusic.IMusicSheetItem,
            );
            Toast.success("已收藏");
        } else {
            await MusicSheet.unstarMusicSheet(item);
            Toast.success("已取消收藏");
        }
    };

    return (
        <Pressable style={styles.card} onPress={onPress}>
            <View style={styles.coverBox}>
                {item.coverImg ? (
                    <Image
                        style={styles.cover}
                        uri={item.coverImg}
                        emptySrc={ImgAsset.albumDefault}
                    />
                ) : (
                    <LinearGradient
                        colors={[
                            "#5B8DEF",
                            Color("#5B8DEF").alpha(0.7).toString(),
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cover}
                    />
                )}
                <Pressable
                    style={({ pressed }) => [
                        styles.starButton,
                        pressed ? { opacity: 0.7 } : null,
                    ]}
                    hitSlop={11}
                    onPress={e => {
                        e.stopPropagation();
                        toggleStar();
                    }}>
                    <Icon
                        name={starred ? "heart" : "heart-outline"}
                        size={14}
                        color={
                            starred ? "#e31639" : "rgba(255,255,255,0.95)"
                        }
                    />
                </Pressable>
                {type === "toplist" ? (
                    <View style={styles.rankBadge}>
                        <ThemeText
                            fontSize="caption"
                            fontColor="textSecondary">
                            {index + 1}
                        </ThemeText>
                    </View>
                ) : null}
            </View>
            <ThemeText
                fontSize="normal"
                fontWeight="medium"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.title}>
                {item.title ?? "未知"}
            </ThemeText>
            <ThemeText
                fontSize="caption"
                fontColor="textSecondary"
                numberOfLines={1}
                ellipsizeMode="tail">
                {type === "toplist"
                    ? item.updateFrequency
                        ? `更新：${item.updateFrequency}`
                        : item.worksNum
                            ? `${item.worksNum} 首`
                            : ""
                    : item.worksNum
                        ? `${item.worksNum} 首`
                        : ""}
            </ThemeText>
        </Pressable>
    );
}
