import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import Dialog from "./base";
import { hideDialog } from "../useDialog";
import Input from "@/components/base/input";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { fontSizeConst } from "@/constants/uiConst";

interface ISimpleInputDialogProps {
    title?: string;
    placeholder?: string;
    hints?: string[];
    maxLength?: number;
    autoFocus?: boolean;
    /** 确认回调：text 为当前输入；close 为关闭浮窗函数（与底部 SimpleInput 面板 onOk(text, closePanel) 同语义，校验不通过可不调 close） */
    onOk: (text: string, close: () => void) => void;
    onCancel?: () => void;
}

/** 通用输入三级浮窗（对齐 APlayer Level3Dialog：输入框 + 取消/确定）。
 * 由底部 SimpleInput 面板同语义迁移：设置项点输入类操作（如音乐缓存上限）应弹三级浮窗而非底部面板 */
export default function SimpleInputDialog(props: ISimpleInputDialogProps) {
    const { t } = useI18N();
    const {
        title,
        placeholder,
        hints,
        maxLength = 80,
        autoFocus = true,
        onOk,
        onCancel,
    } = props;

    const [input, setInput] = useState("");

    return (
        <Dialog
            onDismiss={() => {
                // 返回键/遮罩与"取消"按钮一致：触发 onCancel（供上游浮窗链式回弹）后关闭
                onCancel?.();
                hideDialog();
            }}>
            <Dialog.Title withDivider>{title ?? ""}</Dialog.Title>
            <Dialog.Content>
                <Input
                    value={input}
                    onChangeText={setInput}
                    autoFocus={autoFocus}
                    placeholder={placeholder ?? ""}
                    maxLength={maxLength}
                    style={styles.input}
                />
                {hints?.length ? (
                    <View style={styles.hints}>
                        {hints.map((_, index) => (
                            <ThemeText
                                key={`hint-index-${index}`}
                                fontSize="subTitle"
                                fontColor="textSecondary"
                                style={styles.hintLine}>
                                ￮ {_}
                            </ThemeText>
                        ))}
                    </View>
                ) : null}
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
                        onPress() {
                            onOk(input, hideDialog);
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
    hints: {
        marginTop: 12,
    },
    hintLine: {
        marginBottom: 6,
    },
});
