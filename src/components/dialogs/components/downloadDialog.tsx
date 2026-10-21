import React, { useState } from "react";
import ThemeText from "@/components/base/themeText";
import { StyleSheet, View } from "react-native";
import rpx, { vh } from "@/utils/rpx";
import openUrl from "@/utils/openUrl";
import Clipboard from "@react-native-clipboard/clipboard";
import { ScrollView, TouchableOpacity } from "react-native-gesture-handler";
import { hideDialog, showDialog } from "../useDialog";
import Checkbox from "@/components/base/checkbox";
import Dialog from "./base";
import PersistStatus from "@/utils/persistStatus";
import { useI18N } from "@/core/i18n";
interface IDownloadDialogProps {
    version: string;
    content: string[];
    fromUrl: string;
    backUrl?: string;
}
export default function DownloadDialog(props: IDownloadDialogProps) {
    const { content, fromUrl, backUrl, version } = props;
    const [skipState, setSkipState] = useState(false);
    const { t } = useI18N();
    return (
        <Dialog
            onDismiss={() => {
                if (skipState) {
                    PersistStatus.set("app.skipVersion", version);
                }
                hideDialog();
            }}>
            <Dialog.Title stringContent>{t("dialog.downloadDialog.title", {
                version: version,
            })}</Dialog.Title>
            <ScrollView style={style.scrollView}>
                {content?.map?.(_ => (
                    <ThemeText key={_} style={style.item} fontColor="textSecondary">
                        {_}
                    </ThemeText>
                ))}
            </ScrollView>
            <TouchableOpacity
                style={style.checkboxRow}
                onPress={() => {
                    setSkipState(state => !state);
                }}>
                <View style={style.checkboxGroup}>
                    <Checkbox checked={skipState} />
                    <ThemeText style={style.checkboxHint} fontSize="subTitle">
                        {t("dialog.downloadDialog.skipThisVersion")}
                    </ThemeText>
                </View>
            </TouchableOpacity>
            <Dialog.Actions>
                <View style={style.buttonGroup}>
                    <TouchableOpacity
                        style={style.button}
                        onPress={() => {
                            hideDialog();
                            if (skipState) {
                                PersistStatus.set("app.skipVersion", version);
                            }
                        }}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="textSecondary">
                            {t("common.cancel")}
                        </ThemeText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={style.button}
                        onPress={() => {
                            PersistStatus.set("app.skipVersion", undefined);
                            // 软件内下载更新（三级浮窗，进度条）；先关当前窗再开新窗（单槽时序）
                            hideDialog();
                            setTimeout(() => {
                                showDialog("UpdateDownloadDialog", {
                                    version,
                                    fromUrl,
                                    backUrl,
                                });
                            }, 0);
                        }}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="primary">
                            {t("dialog.downloadDialog.downloadInApp")}
                        </ThemeText>
                    </TouchableOpacity>
                    {backUrl && (
                        <TouchableOpacity
                            style={style.button}
                            onPress={async () => {
                                PersistStatus.set("app.skipVersion", undefined);
                                openUrl(backUrl);
                                Clipboard.setString(backUrl);
                            }}>
                            <ThemeText
                                fontSize="subTitle"
                                fontWeight="medium"
                                fontColor="primary">
                                {t("dialog.downloadDialog.backupUrl")}
                            </ThemeText>
                        </TouchableOpacity>
                    )}
                </View>
            </Dialog.Actions>
        </Dialog>
    );
}
const style = StyleSheet.create({
    item: {
        marginBottom: 8,
        fontSize: 13, // 对齐 Dialog.Content 正文 13sp（Level3Dialog）
        lineHeight: 21, // 对齐 Dialog.Content 正文行高 21
    },
    content: {
        flex: 1,
        maxHeight: vh(50),
    },
    scrollView: {
        maxHeight: vh(40),
        paddingHorizontal: 13,
        paddingTop: 12, // 2026-10-21 统一：正文首行距标题分割线 12
        paddingBottom: 12, // 2026-10-21 统一：正文末行与下方区域间距 12
    },
    checkboxRow: {
        paddingTop: 12,
        paddingBottom: 4,
    },
    checkboxGroup: {
        flexDirection: "row",
        alignItems: "center",
    },
    buttonGroup: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        height: 52, // 对齐 Dialog 按钮行 52dp
        justifyContent: "flex-end",
    },
    checkboxHint: {
        marginLeft: rpx(12),
    },
    button: {
        paddingLeft: 14,
        paddingVertical: 8,
        marginLeft: rpx(16),
        alignItems: "flex-end",
        justifyContent: "center",
    },
});
