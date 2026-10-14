import ListItem from "@/components/base/listItem";
import ThemeSwitch from "@/components/base/switch";
import React, { useEffect, useReducer } from "react";
import { ScrollView } from "react-native-gesture-handler";

import Dialog from "./base";
import { hideDialog } from "../useDialog";
import { IIconName } from "@/components/base/icon.tsx";
import { iconSizeConst } from "@/constants/uiConst";
import rpx from "@/utils/rpx";
import { useI18N } from "@/core/i18n";
import Config from "@/core/appConfig";
import { IAppConfigProperties } from "@/types/core/config";

export interface IMenuOption {
    icon?: IIconName;
    title: string;
    show?: boolean;
    /** 普通菜单项：点击关闭浮窗并触发 onPress */
    onPress?: () => void;
    /** 开关项：渲染右侧开关，点击不关闭浮窗 */
    type?: "default" | "switch";
    /** 开关值（外部快照传入；仅兼容非配置项场景） */
    value?: boolean;
    /** 开关配置 key：内部实时订阅配置存储（showDialog payload 是打开时快照，外部重渲染不会更新浮窗） */
    configKey?: keyof IAppConfigProperties;
    /** 开关默认值（配置未设置时展示） */
    defaultValue?: boolean;
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
 *
 * 开关实时性：showDialog 的 payload 是打开时快照，外部组件重渲染不会更新已打开的浮窗；
 * 因此开关项通过 configKey 订阅 configStore 变化（MMKV 监听 + 强制刷新），保证开关即时反馈。
 */
export default function MenuDialog(props: IMenuDialogProps) {
    const { t } = useI18N();
    const { title, options = [] } = props ?? {};

    // 配置存储变化（setConfig 写入）时强制刷新本浮窗，开关实时读取最新值
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    useEffect(() => {
        const listener = Config.onConfigChanged?.(() => forceUpdate());
        return () => listener?.remove?.();
    }, []);

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
                                    value={
                                        item.configKey
                                            ? ((Config.getConfig(
                                                  item.configKey,
                                              ) as boolean | undefined) ??
                                                item.defaultValue ??
                                                false)
                                            : item.value ?? false
                                    }
                                    onValueChange={v => {
                                        if (item.configKey) {
                                            Config.setConfig(
                                                item.configKey,
                                                v,
                                            );
                                        }
                                        item.onValueChange?.(v);
                                    }}
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
                    {
                        // 开关项已即改即生效，底部按钮仅作"完成并关闭"（2026-10-14 按用户规范：确认仅关闭 → 改为"完成"）
                        title: t("common.done"),
                        type: "primary",
                        onPress() {
                            hideDialog();
                        },
                    },
                ]}
            />
        </Dialog>
    );
}
