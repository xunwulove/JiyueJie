import ListItem from "@/components/base/listItem";
import ThemeSwitch from "@/components/base/switch";
import React from "react";
import { ScrollView } from "react-native-gesture-handler";

import Dialog from "./base";
import { hideDialog } from "../useDialog";
import { IIconName } from "@/components/base/icon.tsx";
import { iconSizeConst } from "@/constants/uiConst";
import rpx from "@/utils/rpx";
import { useI18N } from "@/core/i18n";

export interface IMenuOption {
    icon?: IIconName;
    title: string;
    show?: boolean;
    /** 普通菜单项：点击关闭浮窗并触发 onPress */
    onPress?: () => void;
    /** 开关项：渲染右侧开关，点击不关闭浮窗 */
    type?: "default" | "switch";
    value?: boolean;
    onValueChange?: (v: boolean) => void;
}

interface IMenuDialogProps {
    /** 标题（显示在渐变标题行） */
    title?: string;
    /** 菜单项 */
    options: IMenuOption[];
}

/**
 * 顶栏"三点(ellipsis-vertical)"通用菜单 - 三级浮窗（对话框体系：居中缩放 + 渐变标题行 + 底部等高同渐变按钮行）。
 * 对齐 AppBarMore 的条目样式（ListItem small + 图标 light + 标题 content），但载体为三级浮窗规范。
 */
export default function MenuDialog(props: IMenuDialogProps) {
    const { t } = useI18N();
    const { title, options = [] } = props ?? {};

    return (
        <Dialog onDismiss={hideDialog}>
            {title ? (
                <Dialog.Title withDivider>{title}</Dialog.Title>
            ) : null}
            <Dialog.Content needScroll>
                <ScrollView>
                    {options.map(item =>
                        item.show === false ? null : item.type ===
                          "switch" ? (
                            <ListItem
                                key={item.title}
                                withHorizontalPadding
                                heightType="small">
                                {item.icon ? (
                                    <ListItem.ListItemIcon
                                        icon={item.icon}
                                        iconSize={iconSizeConst.light}
                                    />
                                ) : null}
                                <ListItem.Content title={item.title} />
                                <ThemeSwitch
                                    value={item.value ?? false}
                                    onValueChange={v =>
                                        item.onValueChange?.(v)
                                    }
                                />
                            </ListItem>
                        ) : (
                            <ListItem
                                key={item.title}
                                withHorizontalPadding
                                heightType="small"
                                onPress={() => {
                                    hideDialog();
                                    item.onPress?.();
                                }}>
                                {item.icon ? (
                                    <ListItem.ListItemIcon
                                        icon={item.icon}
                                        iconSize={iconSizeConst.light}
                                    />
                                ) : null}
                                <ListItem.Content title={item.title} />
                            </ListItem>
                        ),
                    )}
                </ScrollView>
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
                ]}
            />
        </Dialog>
    );
}
