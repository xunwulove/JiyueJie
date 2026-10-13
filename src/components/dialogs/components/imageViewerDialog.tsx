import React from "react";
import { Image, StyleSheet } from "react-native";
import { vh } from "@/utils/rpx";
import Toast from "@/utils/toast";
import { saveToGallery } from "@/utils/fileUtils.ts";
import { errorLog } from "@/utils/log.ts";
import Dialog from "./base";
import { hideDialog } from "../useDialog";
import { useI18N } from "@/core/i18n";

interface IImageViewerDialogProps {
    // 图片路径
    url: string;
}

/**
 * 图片查看 - 三级弹窗（居中对话框体系）。
 * 原为 PanelFullscreen 全屏面板（ImageViewer），按用户拍板改为三级弹窗页面：
 * Dialog.Title + 图片 Content + 取消/保存图片 Actions。
 */
export default function ImageViewerDialog(props: IImageViewerDialogProps) {
    const { url } = props;
    const { t } = useI18N();

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title withDivider>
                {t("panel.imageViewer.title")}
            </Dialog.Title>
            <Dialog.Content>
                <Image
                    style={styles.image}
                    source={{
                        uri: url,
                    }}
                    resizeMode="contain"
                />
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress() {
                            hideDialog();
                        },
                    },
                    {
                        title: t("panel.imageViewer.saveImage"),
                        type: "primary",
                        onPress() {
                            saveToGallery(url)
                                .then((resultPath) => {
                                    Toast.success(t("panel.imageViewer.saveImageSuccess", {
                                        path: resultPath,
                                    }));
                                })
                                .catch(e => {
                                    errorLog("Save failed", e?.message ?? e);
                                    Toast.warn(t("panel.imageViewer.saveImageFail", {
                                        reason: e?.message ?? e,
                                    }));
                                });
                        },
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    image: {
        width: "100%",
        height: vh(55),
        maxHeight: vh(55),
        borderRadius: 12,
    },
});
