import React from "react";
import { View } from "react-native";
import Dialog from "./base";
import { hideDialog, showDialog } from "../useDialog";
import ListItem from "@/components/base/listItem";
import { ImgAsset } from "@/constants/assetsConst";
import Toast from "@/utils/toast";
import MusicSheet, { useSheetsBase } from "@/core/musicSheet";
import { useI18N } from "@/core/i18n";

interface IAddToMusicSheetDialogProps {
    musicItem: IMusic.IMusicItem | IMusic.IMusicItem[];
    // 新建歌单的默认名称
    newSheetDefaultName?: string;
}

/** 加入歌单（对齐 APlayer LibraryPage Level3Dialog：歌单列表点击即加入 + 新建歌单入口 + 取消） */
export default function AddToMusicSheetDialog(
    props: IAddToMusicSheetDialogProps,
) {
    const sheets = useSheetsBase();
    const { musicItem = [], newSheetDefaultName } = props ?? {};
    const { t } = useI18N();

    const items = Array.isArray(musicItem) ? musicItem : [musicItem];

    const onAdd = async (sheetId: string) => {
        try {
            await MusicSheet.addMusic(sheetId, items);
            hideDialog();
            Toast.success(t("panel.addToMusicSheet.toast.success"));
        } catch {
            Toast.warn(t("panel.addToMusicSheet.toast.fail"));
        }
    };

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title withDivider>
                {t("panel.addToMusicSheet.title", { count: items.length })}
            </Dialog.Title>
            <Dialog.Content needScroll>
                <View>
                    {!sheets?.length ? (
                        <ListItem withHorizontalPadding heightType="small">
                            <ListItem.Content
                                title={t("panel.addToMusicSheet.empty")}
                            />
                        </ListItem>
                    ) : null}
                    <ListItem
                        withHorizontalPadding
                        heightType="small"
                        onPress={() => {
                            // 关闭加入歌单 → 打开新建歌单（对齐旧项目：弹窗内新建后直接加入）
                            hideDialog();
                            showDialog("CreateMusicSheetDialog", {
                                defaultName: newSheetDefaultName,
                                async onSheetCreated(sheetId) {
                                    await onAdd(sheetId);
                                },
                                // 新建歌单取消/返回：回弹加入歌单浮窗（链式逐级回退，保留原选择）
                                onCancel() {
                                    showDialog("AddToMusicSheetDialog", {
                                        musicItem,
                                        newSheetDefaultName,
                                    });
                                },
                            });
                        }}>
                        <ListItem.ListItemImage
                            fallbackImg={ImgAsset.add}
                        />
                        <ListItem.Content
                            title={t("panel.addToMusicSheet.newMusicSheet")}
                        />
                    </ListItem>
                    {(sheets ?? []).map(sheet => (
                        <ListItem
                            withHorizontalPadding
                            key={sheet.id}
                            heightType="small"
                            onPress={() => onAdd(sheet.id)}>
                            <ListItem.ListItemImage
                                uri={sheet.coverImg}
                                fallbackImg={ImgAsset.albumDefault}
                            />
                            <ListItem.Content
                                title={sheet.title}
                                description={t("panel.addToMusicSheet.count", {
                                    count: sheet.worksNum ?? "-",
                                })}
                            />
                        </ListItem>
                    ))}
                </View>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.done"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                ]}
            />
        </Dialog>
    );
}
