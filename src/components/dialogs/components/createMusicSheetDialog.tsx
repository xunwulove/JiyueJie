import React, { useState } from "react";
import { StyleSheet } from "react-native";
import Dialog from "./base";
import { hideDialog } from "../useDialog";
import MusicSheet from "@/core/musicSheet";
import Input from "@/components/base/input";
import { useI18N } from "@/core/i18n";
import { fontSizeConst } from "@/constants/uiConst";
interface ICreateMusicSheetDialogProps {
    defaultName?: string;
    onSheetCreated?: (sheetId: string) => void;
    onCancel?: () => void;
}
/** 新建歌单（对齐 APlayer PlaylistManagePage Level3Dialog：输入框 + 取消/确定） */
export default function CreateMusicSheetDialog(
    props: ICreateMusicSheetDialogProps,
) {
    const { t } = useI18N();
    const {
        onSheetCreated,
        onCancel,
        defaultName = t("panel.createMusicSheet.title"),
    } = props;
    const [input, setInput] = useState("");
    return (
        <Dialog
            onDismiss={() => {
                // 返回键/遮罩与"取消"按钮一致：触发 onCancel（供上游浮窗链式回弹）后关闭
                onCancel?.();
                hideDialog();
            }}>
            <Dialog.Title>{t("panel.createMusicSheet.title")}</Dialog.Title>
            <Dialog.Content>
                <Input
                    value={input}
                    onChangeText={setInput}
                    autoFocus
                    placeholder={defaultName}
                    maxLength={200}
                    style={styles.input}
                />
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress() {
                            onCancel?.();
                            hideDialog();
                        },
                    },
                    {
                        title: t("common.confirm"),
                        type: "primary",
                        async onPress() {
                            const sheetId = await MusicSheet.addSheet(
                                input || defaultName,
                            );
                            onSheetCreated?.(sheetId);
                            hideDialog();
                        },
                    },
                ]}
            />
        </Dialog>
    );
}
const styles = StyleSheet.create({
    input: {
        borderRadius: 12,
        fontSize: fontSizeConst.content,
        lineHeight: fontSizeConst.content * 1.5,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: "rgba(128,128,128,0.08)",
    },
});
