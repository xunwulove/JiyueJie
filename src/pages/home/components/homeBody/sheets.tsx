import IconButton from "@/components/base/iconButton";
import ThemeText from "@/components/base/themeText";
import PlaylistCard from "@/components/mediaItem/playlistCard";
import { showDialog } from "@/components/dialogs/useDialog";
import { localPluginPlatform } from "@/constants/commonConst";
import { useI18N } from "@/core/i18n";
import MusicSheet, {
    useSheetsBase,
    useStarredSheets,
} from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";

/**
 * "我的歌单" - 复刻 APlayer：横滑歌单卡
 * 本地歌单：渐变占位卡 + 歌名 + "x 首"；收藏歌单：封面卡 + 歌名 + 作者
 * 长按删除（保留原列表删除能力）
 */
export default function Sheets() {
    const [index, setIndex] = useState(0);
    const colors = useColors();
    const navigate = useNavigate();

    const allSheets = useSheetsBase();
    const staredSheets = useStarredSheets();
    const { t } = useI18N();

    const selectedTabTextStyle = [
        styles.selectTabText,
        { borderBottomColor: colors.primary },
    ];

    const renderCard = (sheet: IMusic.IMusicSheetItemBase) => {
        const isLocalSheet = !(
            sheet.platform && sheet.platform !== localPluginPlatform
        );
        const onPress = () => {
            if (isLocalSheet) {
                navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, {
                    id: sheet.id,
                });
            } else {
                navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
                    sheetInfo: sheet,
                });
            }
        };
        const onLongPress = () => {
            if (sheet.id === MusicSheet.defaultSheet.id) {
                return;
            }
            showDialog("SimpleDialog", {
                title: t("dialog.deleteSheetTitle"),
                content: t("dialog.deleteSheetContent", {
                    name: sheet.title,
                }),
                onOk: async () => {
                    if (isLocalSheet) {
                        await MusicSheet.removeSheet(sheet.id);
                        Toast.success(t("toast.deleteSuccess"));
                    } else {
                        await MusicSheet.unstarMusicSheet(sheet);
                        Toast.success(t("toast.hasUnstarred"));
                    }
                },
            });
        };
        return (
            <PlaylistCard
                key={`${sheet.id}`}
                title={sheet.title ?? ""}
                artwork={sheet.coverImg ?? sheet.artwork}
                subtitle={
                    isLocalSheet
                        ? t("home.songCount", { count: sheet.worksNum })
                        : `${sheet.artist ?? ""}`
                }
                placeholderIcon={
                    sheet.id === MusicSheet.defaultSheet.id ? "heart" : "playlist"
                }
                onPress={onPress}
                onLongPress={
                    sheet.id === MusicSheet.defaultSheet.id ? undefined : onLongPress
                }
            />
        );
    };

    return (
        <>
            <View style={styles.subTitleContainer}>
                <TouchableWithoutFeedback
                    style={styles.tabContainer}
                    onPress={() => setIndex(0)}>
                    <ThemeText
                        fontSize="content"
                        style={[
                            styles.tabText,
                            index === 0 ? selectedTabTextStyle : null,
                        ]}>
                        {t("home.myPlaylists")}
                    </ThemeText>
                    <ThemeText
                        fontColor="textSecondary"
                        fontSize="subTitle"
                        style={styles.tabText}>
                        {" "}({allSheets.length})
                    </ThemeText>
                </TouchableWithoutFeedback>
                <TouchableWithoutFeedback
                    style={styles.tabContainer}
                    onPress={() => setIndex(1)}>
                    <ThemeText
                        fontSize="content"
                        style={[
                            styles.tabText,
                            index === 1 ? selectedTabTextStyle : null,
                        ]}>
                        {t("home.starredPlaylists")}
                    </ThemeText>
                    <ThemeText
                        fontColor="textSecondary"
                        fontSize="subTitle"
                        style={styles.tabText}>
                        {" "}({staredSheets.length})
                    </ThemeText>
                </TouchableWithoutFeedback>
                <View style={styles.more}>
                    <IconButton
                        name="plus"
                        style={styles.newSheetButton}
                        sizeType="normal"
                        onPress={() => {
                            showDialog("CreateMusicSheetDialog");
                        }}
                    />
                    <IconButton
                        name="inbox-arrow-down"
                        sizeType="normal"
                        onPress={() => {
                            showDialog("ImportMusicSheetDialog");
                        }}
                    />
                </View>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardRow}>
                {(index === 0 ? allSheets : staredSheets)?.length ? (
                    (index === 0 ? allSheets : staredSheets).map(renderCard)
                ) : (
                    <ThemeText
                        fontColor="textSecondary"
                        style={styles.emptyText}>
                        {t("common.emptyList")}
                    </ThemeText>
                )}
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    subTitleContainer: {
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        marginTop: 20,
        marginBottom: 8,
    },
    tabContainer: {
        flexDirection: "row",
        marginRight: 32,
    },
    tabText: {},
    selectTabText: {
        borderBottomWidth: 6,
        fontWeight: "bold",
    },
    more: {
        height: 64,
        marginTop: 3,
        flexGrow: 1,
        flexDirection: "row",
        justifyContent: "flex-end",
    },
    newSheetButton: {
        marginRight: 24,
    },
    cardRow: {
        paddingHorizontal: 16,
        columnGap: 12,
        paddingBottom: 12,
    },
    emptyText: {
        paddingVertical: 30,
    },
});
