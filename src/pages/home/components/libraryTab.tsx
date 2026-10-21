import React, { useMemo, useState } from "react";
import {
    FlatList,
    Pressable,
    StyleSheet,
    View,
} from "react-native";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import ThemeText from "@/components/base/themeText";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import LocalMusicSheet from "@/core/localMusicSheet";
import { getLocalPath } from "@/utils/mediaUtils";
import { normalizeDurationSec } from "@/utils/durationUtil";
import TrackPlayer from "@/core/trackPlayer";
import LocalSongCover from "@/components/mediaItem/localSongCover";
import { showDialog } from "@/components/dialogs/useDialog";
import Toast from "@/utils/toast";
import { useI18N } from "@/core/i18n";
import { ListDivider } from "@/components/base/divider";
import appConfig from "@/core/appConfig";
import { useMusicHistory } from "@/core/musicHistory";
import mp3Util from "@/native/mp3Util";
import dayjs from "dayjs";

/** 音乐库列表排序维度（持久化键 basic.musicLibrarySort） */
type MusicLibrarySort =
    | "default"
    | "title"
    | "artist"
    | "album"
    | "duration"
    | "size"
    | "addTime"
    | "playCount";
type MusicLibraryDirection = "asc" | "desc";

const SORT_OPTIONS: Array<{
    label: string;
    value: MusicLibrarySort;
    icon?: IIconName;
}> = [
    { label: "默认顺序", value: "default" },
    { label: "歌曲名", value: "title", icon: "musical-note" },
    { label: "歌手", value: "artist", icon: "user" },
    { label: "专辑", value: "album", icon: "album-outline" },
    { label: "时长", value: "duration", icon: "clock-outline" },
    { label: "文件大小", value: "size", icon: "server" },
    { label: "添加时间", value: "addTime", icon: "calendar-days" },
    { label: "听歌频率", value: "playCount", icon: "chart-bar" },
];

// Bug: localeCompare is slow sometimes https://github.com/facebook/hermes/issues/867
const collator = new Intl.Collator("zh");

/** 读当前排序配置（未设置 → 默认顺序 + 降序展示习惯为升序） */
function readSortConfig(): {
    sort: MusicLibrarySort;
    direction: MusicLibraryDirection;
    } {
    return {
        sort:
            (appConfig.getConfig(
                "basic.musicLibrarySort",
            ) as MusicLibrarySort) ?? "default",
        direction:
            (appConfig.getConfig(
                "basic.musicLibrarySortDirection",
            ) as MusicLibraryDirection) ?? "asc",
    };
}

/**
 * 音乐库 tab - 对齐 APlayer LibraryPage：
 * 顶部四入口卡片（歌曲/专辑/歌手/扫描）→ 排序行（固定吸顶，不随列表滚动）→ 下方"扫描到的歌曲"列表
 * 歌曲行：44 封面 + 标题/副标题(歌手·专辑) + 时长 + 右端三点菜单
 * 菜单：下一首播放 / 加入歌单 / 歌曲信息 / 永久删除（编辑标签 fork 无标签能力暂缺）
 * 点击"歌曲"卡 = 随机播放全部本地歌曲并打开全屏播放页（对齐旧项目）
 */
export default function LibraryTab() {
    const navigate = useNavigate();
    const colors = useColors();
    const { t } = useI18N();
    const isTablet = useIsTablet();
    const primary = colors.primary;

    const localMusicList = LocalMusicSheet.useMusicList();
    const history = useMusicHistory();

    // 排序状态：读配置初始化，变更即持久化
    const [{ sort, direction }, setSortState] = useState(readSortConfig);
    const setSort = (next: MusicLibrarySort, dir: MusicLibraryDirection) => {
        setSortState({ sort: next, direction: dir });
        appConfig.setConfig("basic.musicLibrarySort", next);
        appConfig.setConfig("basic.musicLibrarySortDirection", dir);
    };

    // 听歌频率：全量播放历史按 platform-id 聚合播放次数
    const playCountMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const item of history ?? []) {
            const key = `${item.platform}-${item.id}`;
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return map;
    }, [history]);

    // 排序后的列表
    const sortedList = useMemo(() => {
        const list = localMusicList ?? [];
        if (sort === "default") {
            return list;
        }
        const sorted = [...list];
        sorted.sort((a, b) => {
            let cmp = 0;
            switch (sort) {
            case "title":
                cmp = collator.compare(a.title ?? "", b.title ?? "");
                break;
            case "artist":
                cmp = collator.compare(a.artist ?? "", b.artist ?? "");
                break;
            case "album":
                cmp = collator.compare(a.album ?? "", b.album ?? "");
                break;
            case "duration":
                cmp = (a.duration ?? 0) - (b.duration ?? 0);
                break;
            case "size":
                cmp =
                        (Number(a.size) || 0) - (Number(b.size) || 0);
                break;
            case "addTime":
                cmp =
                        (a.$timestamp ?? 0) - (b.$timestamp ?? 0);
                break;
            case "playCount":
                cmp =
                        (playCountMap.get(`${a.platform}-${a.id}`) ??
                            0) -
                        (playCountMap.get(`${b.platform}-${b.id}`) ??
                            0);
                break;
            }
            return direction === "asc" ? cmp : -cmp;
        });
        return sorted;
    }, [localMusicList, sort, direction, playCountMap]);

    const stats = useMemo(() => {
        const albums = new Set<string>();
        const artists = new Set<string>();
        const folders = new Set<string>();
        (localMusicList ?? []).forEach(m => {
            if (m.album) albums.add(m.album);
            if (m.artist) artists.add(m.artist);
            const p = getLocalPath(m);
            const dir = p?.split("/").slice(0, -1).join("/");
            if (dir) folders.add(dir);
        });
        return {
            songs: (localMusicList ?? []).length,
            albums: albums.size,
            artists: artists.size,
            folders: folders.size,
        };
    }, [localMusicList]);

    const entries: Array<{
        icon: IIconName;
        title: string;
        subtitle: string;
        action: () => void;
    }> = [
        {
            icon: "musical-note",
            title: "歌曲",
            subtitle: `${stats.songs} 首`,
            // 对齐 APlayer：随机播放全部本地歌曲（仅播放，留在播放区；全屏只能由点击播放区进入）
            action: () => {
                const list = sortedList;
                if (!list.length) {
                    Toast.warn(
                        t("toast.noLocalMusic"),
                    );
                    return;
                }
                TrackPlayer.playWithReplacePlayList(
                    list[Math.floor(Math.random() * list.length)],
                    list,
                );
            },
        },
        {
            icon: "album-outline",
            title: "专辑",
            subtitle: `${stats.albums} 张`,
            action: () =>
                navigate(ROUTE_PATH.LOCAL_GROUP, {
                    groupType: "album",
                }),
        },
        {
            icon: "user",
            title: "歌手",
            subtitle: `${stats.artists} 位`,
            action: () =>
                navigate(ROUTE_PATH.LOCAL_GROUP, {
                    groupType: "artist",
                }),
        },
        {
            // 对齐 APlayer 第 4 卡 = "扫描/媒体来源"（旧图标 Refresh 刷新箭头，fork 用 arrow-path 同语义）
            icon: "arrow-path",
            title: "扫描",
            subtitle: "媒体来源",
            action: () => navigate(ROUTE_PATH.SCAN_SETTINGS),
        },
    ];

    const openSortDialog = () => {
        const current = readSortConfig();
        showDialog("SortDialog", {
            title: "排序方式",
            options: SORT_OPTIONS,
            defaultSelected: current.sort,
            direction: current.direction,
            onOk: (value, dir) => {
                setSort(value as MusicLibrarySort, dir);
            },
        });
    };

    return (
        <View style={styles.page}>
            {/* 固定头部：卡片 + 排序行（歌曲列表表头，不随列表滚动） */}
            <View style={styles.headerArea}>
                <View style={styles.cardRow}>
                    {entries.map(entry => (
                        <Pressable
                            key={entry.title}
                            style={({ pressed }) => [
                                styles.card,
                                {
                                    flex: isTablet ? 1 : undefined,
                                },
                                {
                                    width: isTablet
                                        ? undefined
                                        : "48%",
                                },
                                {
                                    borderRadius: isTablet ? 18 : 16,
                                },
                                pressed
                                    ? {
                                        backgroundColor: Color(
                                            primary,
                                        )
                                            .alpha(0.06)
                                            .toString(),
                                    }
                                    : null,
                            ]}
                            onPress={entry.action}>
                            <LinearGradient
                                colors={[
                                    Color(primary)
                                        .alpha(0.14)
                                        .toString(),
                                    Color(primary)
                                        .alpha(0.03)
                                        .toString(),
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[
                                    styles.cardBg,
                                    isTablet
                                        ? styles.cardBgTablet
                                        : null,
                                    {
                                        borderColor: Color(
                                            (colors as any).divider ??
                                                    "#E2E8F0",
                                        )
                                            .alpha(0.35)
                                            .toString(),
                                    },
                                ]}>
                                {isTablet ? (
                                    <Icon
                                        name={entry.icon}
                                        size={52}
                                        color={Color("#808080")
                                            .alpha(0.35)
                                            .toString()}
                                        style={styles.watermark}
                                    />
                                ) : null}
                                {isTablet ? (
                                    <View style={styles.rowTablet}>
                                        <LinearGradient
                                            colors={[
                                                primary,
                                                Color(primary)
                                                    .alpha(0.75)
                                                    .toString(),
                                            ]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={
                                                styles.iconBoxTablet
                                            }>
                                            <Icon
                                                name={entry.icon}
                                                size={46}
                                                color="#FFFFFF"
                                            />
                                        </LinearGradient>
                                        <View
                                            style={
                                                styles.textBlockTablet
                                            }>
                                            <ThemeText
                                                fontSize="large"
                                                fontWeight="bold"
                                                numberOfLines={1}
                                                style={
                                                    styles.titleTablet
                                                }>
                                                {entry.title}
                                            </ThemeText>
                                            <ThemeText
                                                fontSize="subTitle"
                                                fontColor="textSecondary"
                                                numberOfLines={1}>
                                                {entry.subtitle}
                                            </ThemeText>
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        <LinearGradient
                                            colors={[
                                                primary,
                                                Color(primary)
                                                    .alpha(0.75)
                                                    .toString(),
                                            ]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.iconBox}>
                                            <Icon
                                                name={entry.icon}
                                                size={17}
                                                color="#FFFFFF"
                                            />
                                        </LinearGradient>
                                        <ThemeText
                                            fontSize="title"
                                            fontWeight="bold"
                                            numberOfLines={1}
                                            style={styles.titlePhone}>
                                            {entry.title}
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="caption"
                                            fontColor="textSecondary"
                                            numberOfLines={1}>
                                            {entry.subtitle}
                                        </ThemeText>
                                    </>
                                )}
                            </LinearGradient>
                        </Pressable>
                    ))}
                </View>
                {/* 排序行：位于卡片下方、歌曲列表上方，随列表滚动 */}
                <View style={styles.sortRow}>
                    <ThemeText
                        fontSize="content"
                        fontWeight="bold">
                            本地歌曲
                    </ThemeText>
                    <View style={styles.sortRight}>
                        {sort !== "default" ? (
                            <ThemeText
                                fontSize="normal"
                                fontColor="textSecondary"
                                numberOfLines={1}
                                style={styles.sortCurrent}>
                                {SORT_OPTIONS.find(
                                    o => o.value === sort,
                                )?.label ?? ""}
                                {direction === "asc" ? " ↑" : " ↓"}
                            </ThemeText>
                        ) : null}
                        <Icon
                            name="sort-outline"
                            size={20}
                            color={primary}
                            style={styles.sortIcon}
                            onPress={openSortDialog}
                        />
                    </View>
                </View>
            </View>

            <FlatList
                style={styles.container}
                data={sortedList}
                keyExtractor={(item, index) =>
                    `${item.platform}-${item.id}-${index}`
                }
                ListEmptyComponent={
                    <ThemeText
                        fontColor="textSecondary"
                        fontSize="subTitle"
                        style={styles.emptyText}>
                        暂无本地音乐，可通过「扫描」添加媒体来源
                    </ThemeText>
                }
                ItemSeparatorComponent={() => (
                    // 行内封面 48 + 间距 12 = 60，与歌名文字左缘对齐
                    <ListDivider marginLeft={60} />
                )}
                renderItem={({ item }) => (
                    <LocalSongItem item={item} list={sortedList} />
                )}
            />
        </View>
    );
}

/** 歌曲行 - 对齐 APlayer LocalSongItem：44 封面 + 标题/副标题 + 时长 + 三点菜单 */
function LocalSongItem({
    item,
    list,
}: {
    item: IMusic.IMusicItem;
    list: IMusic.IMusicItem[];
}) {
    const { t } = useI18N();
    const colors = useColors();
    const primary = colors.primary;

    const onPress = () => {
        TrackPlayer.playWithReplacePlayList(item, list);
    };

    const onMore = () => {
        showDialog("RadioDialog", {
            title: item.title ?? "未知歌曲",
            content: [
                {
                    label: "下一首播放",
                    value: "next",
                    icon: "play",
                },
                {
                    label: "加入歌单",
                    value: "playlist",
                    icon: "playlist",
                },
                {
                    label: "歌曲信息",
                    value: "info",
                    icon: "information-circle",
                },
                {
                    label: "永久删除",
                    value: "delete",
                    icon: "trash-outline",
                },
            ],
            onOk: value => {
                switch (value) {
                case "next":
                    TrackPlayer.addNext(item);
                    Toast.success(t("toast.addToNextPlay"));
                    break;
                case "playlist":
                    showDialog("AddToMusicSheetDialog", {
                        musicItem: [item],
                    });
                    break;
                case "info": {
                    void (async () => {
                        const path = getLocalPath(item) ?? "";
                        // 码率：原生 bitrate 为 bps（如 320000 → 320 kbps）；读取失败/无数据显示 "-"
                        let bitrateStr = "-";
                        if (path) {
                            try {
                                const meta = await mp3Util.getBasicMeta(
                                    path,
                                );
                                const bps = parseInt(
                                    meta?.bitrate ?? "",
                                    10,
                                );
                                if (!isNaN(bps) && bps > 0) {
                                    bitrateStr = `${Math.round(
                                        bps / 1000,
                                    )} kbps`;
                                }
                            } catch {}
                        }
                        const sizeStr = item.size
                            ? `${(item.size / 1048576).toFixed(1)} MB`
                            : "-";
                        const extMatch = path.match(
                            /\.([a-zA-Z0-9]+)$/,
                        );
                        const ext = extMatch
                            ? extMatch[1].toUpperCase()
                            : "-";
                        showDialog("SimpleDialog", {
                            title: "歌曲信息",
                            content: [
                                `歌曲：${item.title ?? "-"}`,
                                `歌手：${item.artist || "-"}`,
                                `专辑：${item.album || "-"}`,
                                `时长：${formatDuration(
                                    normalizeDurationSec(item.duration),
                                )}`,
                                `大小：${sizeStr}`,
                                `格式：${ext}`,
                                `码率：${bitrateStr}`,
                                `入库时间：${
                                    item.$timestamp
                                        ? dayjs(
                                            item.$timestamp,
                                        ).format("YYYY-MM-DD HH:mm")
                                        : "-"
                                }`,
                                `路径：${path || "-"}`,
                            ].join("\n"),
                        });
                    })();
                    break;
                }
                case "delete":
                    showDialog("SimpleDialog", {
                        title: "永久删除",
                        content: `确定永久删除「${
                            item.title ?? "未知歌曲"
                        }」？\n将从设备中删除文件，并从本地音乐列表移除，此操作不可恢复。`,
                        okText: "删除",
                        onOk: async () => {
                            try {
                                await LocalMusicSheet.removeMusic(
                                    item,
                                    true,
                                );
                                Toast.success(t("toast.deleteSuccess"));
                            } catch (e: any) {
                                Toast.warn(
                                    e?.message ?? t("toast.deleteFail"),
                                );
                            }
                        },
                    });
                    break;
                }
            },
        });
    };

    return (
        <Pressable
            style={({ pressed }) => [
                styles.songRow,
                pressed
                    ? {
                        backgroundColor: Color(primary)
                            .alpha(0.06)
                            .toString(),
                    }
                    : null,
            ]}
            onPress={onPress}>
            <LocalSongCover musicItem={item} size={48} borderRadius={8} />
            <View style={styles.songInfo}>
                <ThemeText
                    fontSize="content"
                    fontWeight="medium"
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {item.title ?? "未知歌曲"}
                </ThemeText>
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.songSubtitle}>
                    {`${item.artist || "未知歌手"} · ${
                        item.album || "未知专辑"
                    }`}
                </ThemeText>
            </View>
            <ThemeText
                fontSize="normal"
                fontColor="textSecondary"
                style={styles.songDuration}>
                {formatDuration(normalizeDurationSec(item.duration))}
            </ThemeText>
            <Icon
                name="ellipsis-vertical"
                size={20}
                color={colors.textSecondary ?? "rgba(0,0,0,0.6)"}
                style={styles.songMore}
                onPress={onMore}
            />
        </Pressable>
    );
}

/** 时长 m:ss（对齐 APlayer formatDuration） */
function formatDuration(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 16,
    },
    /* 固定头部：卡片 + 排序行（不随歌曲列表滚动） */
    headerArea: {
        paddingHorizontal: 16,
    },
    /* 排序行：歌曲列表表头，位于卡片下方、不随列表滚动 */
    sortRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 8,
    },
    sortRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    sortCurrent: {
        marginRight: 10,
        maxWidth: 120,
    },
    sortIcon: {
        padding: 4,
    },
    cardRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 10, // 对齐 APlayer Arrangement.spacedBy(10.dp) / 首页金刚区 10
        rowGap: 10,
        marginBottom: 8, // 卡片与下方排序行的间距
    },
    card: {
        borderRadius: 18,
        overflow: "hidden",
    },
    cardBg: {
        borderRadius: 16,
        paddingVertical: 13,
        paddingHorizontal: 10,
        minHeight: 96, // 4 卡手机竖排布局保持 96（上图标+两行文字所需）
        justifyContent: "center",
        borderWidth: 0.5, // 椒盐细边框（outline α0.35，颜色动态随主题）
    },
    cardBgTablet: {
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 12,
        minHeight: 96, // 4 卡纵横比方案：平板 96（横排，与金刚区统一）
        justifyContent: "center",
    },
    rowTablet: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconBoxTablet: {
        width: 50,
        height: 50,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    textBlockTablet: {
        flex: 1,
    },
    titleTablet: {
        marginBottom: 4,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    titlePhone: {
        marginBottom: 2,
    },
    watermark: {
        position: "absolute",
        right: 8,
        bottom: 6,
    },
    emptyText: {
        paddingVertical: 40,
        textAlign: "center",
    },
    songRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 2,
    },
    songCover: {
        width: 44,
        height: 44,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    songInfo: {
        flex: 1,
        marginLeft: 12,
    },
    songSubtitle: {
        marginTop: 2,
    },
    songDuration: {
        marginLeft: 8,
    },
    songMore: {
        marginLeft: 8,
        padding: 4,
    },
});
