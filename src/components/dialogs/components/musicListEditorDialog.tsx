import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import Button from "@/components/base/textButton.tsx";
import { useAtom, useSetAtom } from "jotai";
import { editingMusicListAtom, musicListChangedAtom } from "@/pages/musicListEditor/store/atom";
import Toast from "@/utils/toast";
import MusicList from "@/pages/musicListEditor/components/musicList";
import { useI18N } from "@/core/i18n";
import downloader from "@/core/downloader";
import TrackPlayer from "@/core/trackPlayer";

import Dialog from "./base";
import { hideDialog, showDialog } from "../useDialog";

interface IMusicListEditorDialogProps {
    /** 歌单标题（接口/插件歌单无本地 id，删除/保存不适用） */
    musicSheet?: { title?: string; id?: string };
    musicList: IMusic.IMusicItem[];
}

/**
 * 批量编辑 - 三级浮窗（对齐 Level3Dialog 规范：渐变标题行 + 内容区 + 底部等高同渐变操作行）。
 * 原为二级页面跳转（二级页内再压二级页），按"二级再进则为三级"规范改为浮窗。
 * 适用于接口/插件歌单：多选后 下一首播放 / 加入歌单 / 下载。
 */
export default function MusicListEditorDialog(
    props: IMusicListEditorDialogProps,
) {
    const { t } = useI18N();
    const { musicSheet, musicList } = props ?? {};

    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);

    useEffect(() => {
        setEditingMusicList(
            (musicList ?? []).map(_ => ({ musicItem: _, checked: false })),
        );
        return () => {
            setEditingMusicList([]);
            setMusicListChanged(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedItems = useMemo(
        () => editingMusicList.filter(_ => _.checked).map(_ => _.musicItem),
        [editingMusicList],
    );

    function resetChecked() {
        setEditingMusicList(
            editingMusicList.map(_ => ({
                musicItem: _.musicItem,
                checked: false,
            })),
        );
    }

    const allChecked = editingMusicList.length > 0 &&
        selectedItems.length === editingMusicList.length;

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title withDivider>
                {musicSheet?.title ?? "批量编辑"}
            </Dialog.Title>
            <Dialog.Content needScroll>
                <View style={style.header}>
                    <Button
                        onPress={() => {
                            if (allChecked) {
                                setEditingMusicList(
                                    editingMusicList.map(_ => ({
                                        musicItem: _.musicItem,
                                        checked: false,
                                    })),
                                );
                            } else {
                                setEditingMusicList(
                                    editingMusicList.map(_ => ({
                                        musicItem: _.musicItem,
                                        checked: true,
                                    })),
                                );
                            }
                        }}>
                        {`${allChecked
                            ? t("common.unselectAll")
                            : t("common.selectAll")
                        } (${t("musicListEditor.selectMusicCount", {
                            count: selectedItems.length,
                        })})`}
                    </Button>
                </View>
                <MusicList marginTop={0} />
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("musicListEditor.addToNextPlay"),
                        type: "normal",
                        onPress() {
                            if (selectedItems.length) {
                                TrackPlayer.addNext(selectedItems);
                                resetChecked();
                                Toast.success(t("toast.addToNextPlay"));
                            }
                        },
                    },
                    {
                        title: t("musicListEditor.addToSheet"),
                        type: "normal",
                        onPress() {
                            if (selectedItems.length) {
                                showDialog("AddToMusicSheetDialog", {
                                    musicItem: selectedItems,
                                });
                                resetChecked();
                            }
                        },
                    },
                    {
                        title: t("common.download"),
                        type: "primary",
                        onPress() {
                            if (selectedItems.length) {
                                downloader.download(selectedItems);
                                Toast.success(t("toast.beginDownload"));
                                resetChecked();
                            }
                        },
                    },
                ]}
            />
        </Dialog>
    );
}

const style = StyleSheet.create({
    header: {
        flexDirection: "row",
        height: rpx(64),
        paddingHorizontal: rpx(8),
        alignItems: "center",
        justifyContent: "space-between",
    },
});
