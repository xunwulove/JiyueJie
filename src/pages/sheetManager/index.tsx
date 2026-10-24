import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import StatusBar from "@/components/base/statusBar";
import AppBar from "@/components/base/appBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import ThemeText from "@/components/base/themeText";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import { showDialog } from "@/components/dialogs/useDialog";
import { useI18N } from "@/core/i18n";
import MusicSheet, {
    useSheetsBase,
    useStarredSheets,
} from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import Color from "color";

/**
 * 我的歌单（二级页） - 对齐 APlayer PlaylistManagePage：
 * 顶部 56 标题栏（返回 + 标题 + 右上"新建歌单"图标）
 * 单列行卡列表：最近播放 → 我喜欢的音乐 → 自建歌单（右侧删除）→ 收藏歌单（右侧取消收藏）
 * 行卡：圆角14 背景 surfaceVariant；48dp 圆角10 图标块（primary 12% 底 + primary 图标）；
 *      标题 16sp Medium + 副标题 13sp textSecondary
 */
export default function SheetManager() {
    const { t } = useI18N();
    const navigate = useNavigate();
    const colors = useColors();

    const allSheets = useSheetsBase();
    const starredSheets = useStarredSheets();

    const favorite = allSheets.find(
        s => s.id === MusicSheet.defaultSheet.id,
    );
    const customSheets = allSheets.filter(
        s => s.id !== MusicSheet.defaultSheet.id,
    );

    const renderRow = (
        icon: IIconName,
        title: string,
        subtitle: string,
        onClick: () => void,
        onDelete?: () => void,
    ) => (
        <Pressable
            style={({ pressed }) => [
                styles.rowCard,
                {
                    backgroundColor:
                        colors.surfaceVariant ?? colors.card,
                },
                pressed
                    ? {
                        backgroundColor: Color(
                            colors.primary,
                        )
                            .alpha(0.06)
                            .toString(),
                    }
                    : null,
            ]}
            onPress={onClick}>
            <View
                style={[
                    styles.rowIcon,
                    { backgroundColor: Color(colors.primary).alpha(0.12).toString() },
                ]}>
                <Icon name={icon} size={24} color={colors.primary} />
            </View>
            <View style={styles.rowInfo}>
                <ThemeText
                    fontSize="content"
                    fontWeight="medium"
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {title}
                </ThemeText>
                <ThemeText
                    fontSize="normal"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.rowSubtitle}>
                    {subtitle}
                </ThemeText>
            </View>
            {onDelete ? (
                <Icon
                    name="trash-outline"
                    size={20}
                    color={colors.textSecondary ?? "rgba(0,0,0,0.6)"}
                    style={styles.rowDelete}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={onDelete}
                />
            ) : null}
        </Pressable>
    );

    const confirmDelete = (sheet: { id: string; title?: string }) => {
        showDialog("SimpleDialog", {
            title: t("dialog.deleteSheetTitle"),
            content: t("dialog.deleteSheetContent", {
                name: sheet.title ?? "",
            }),
            onOk: async () => {
                await MusicSheet.removeSheet(sheet.id);
                Toast.success(t("toast.deleteSuccess"));
            },
        });
    };

    const confirmUnstar = (sheet: IMusic.IMusicSheetItemBase) => {
        showDialog("SimpleDialog", {
            title: "取消收藏",
            content: `确认取消收藏「${sheet.title ?? ""}」吗？`,
            onOk: async () => {
                await MusicSheet.unstarMusicSheet(sheet);
                Toast.success(t("toast.hasUnstarred"));
            },
        });
    };

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar
                actions={[
                    {
                        icon: "plus",
                        onPress: () =>
                            showDialog("CreateMusicSheetDialog"),
                    },
                    {
                        icon: "inbox-arrow-down",
                        onPress: () =>
                            showDialog("ImportMusicSheetDialog"),
                    },
                ]}>
                我的歌单
            </AppBar>
            <HorizontalSafeAreaView style={styles.wrapper}>
                <ScrollView contentContainerStyle={styles.listContent}>
                    {/* 最近播放 */}
                    {renderRow(
                        "clock-outline",
                        "最近播放",
                        "查看播放历史",
                        () => navigate(ROUTE_PATH.HISTORY),
                    )}
                    {/* 我喜欢的音乐（固定收藏歌单） */}
                    {favorite
                        ? renderRow(
                            "heart",
                            favorite.title ?? "我喜欢的音乐",
                            `${favorite.worksNum ?? 0} 首歌曲`,
                            () =>
                                navigate(
                                    ROUTE_PATH.LOCAL_SHEET_DETAIL,
                                    { id: favorite.id },
                                ),
                        )
                        : null}
                    {/* 自建歌单 */}
                    {customSheets.map(sheet => (
                        <View key={`local-${sheet.id}`}>
                            {renderRow(
                                "playlist",
                                sheet.title ?? "未知歌单",
                                `${sheet.worksNum ?? 0} 首歌曲`,
                                () =>
                                    navigate(
                                        ROUTE_PATH.LOCAL_SHEET_DETAIL,
                                        { id: sheet.id },
                                    ),
                                () => confirmDelete(sheet),
                            )}
                        </View>
                    ))}
                    {/* 收藏歌单（来自插件） */}
                    {starredSheets.map(sheet => (
                        <View key={`star-${sheet.id}`}>
                            {renderRow(
                                "heart-outline",
                                sheet.title ?? "未知歌单",
                                `${sheet.worksNum ?? 0} 首歌曲`,
                                () =>
                                    navigate(
                                        ROUTE_PATH.PLUGIN_SHEET_DETAIL,
                                        { sheetInfo: sheet },
                                    ),
                                () => confirmUnstar(sheet),
                            )}
                        </View>
                    ))}
                </ScrollView>
            </HorizontalSafeAreaView>
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    rowCard: {
        width: "100%",
        borderRadius: 14,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    rowIcon: {
        width: 48,
        height: 48,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    rowInfo: {
        flex: 1,
        marginLeft: 12,
    },
    rowSubtitle: {
        marginTop: 2,
    },
    rowDelete: {
        marginLeft: 12,
        padding: 4,
    },
});
