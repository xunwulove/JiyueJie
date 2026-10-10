import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "@/components/base/listItem";
import ThemeSwitch from "@/components/base/switch";
import PanelBase from "../base/panelBase";
import PanelHeader from "../base/panelHeader";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hidePanel } from "../usePanel";
import { iconSizeConst } from "@/constants/uiConst";
import { IIconName } from "@/components/base/icon.tsx";

interface IOption {
    icon: IIconName;
    title: string;
    show?: boolean;
    /** 普通菜单项：点击收起面板并触发 onPress */
    onPress?: () => void;
    /** 开关项：渲染右侧开关，点击不收起面板 */
    type?: "default" | "switch";
    value?: boolean;
    onValueChange?: (v: boolean) => void;
}

interface IAppBarMoreProps {
    /** 面板标题（可选；不传则不渲染标题栏） */
    title?: string;
    /** 菜单项 */
    options: IOption[];
}

/**
 * 顶栏"三点(ellipsis-vertical)"通用三级菜单面板。
 * 与歌曲行三点（MusicItemOptions）/ 歌词三点（MusicItemLyricOptions）同款：
 * 手机底部上滑、平板右滑入且限内容区不盖 tab；行 = ListItem small(48) + 图标 light(20)
 * + Content 标题（ThemeText 默认 content 16sp regular）。替代旧 AppBar 内建锚定下拉气泡。
 */
export default function AppBarMore(props: IAppBarMoreProps) {
    const { title, options = [] } = props ?? {};
    const safeAreaInsets = useSafeAreaInsets();
    /** 开关本地受控值（初始取配置，切换即时跳变；key=选项标题） */
    const [switchValues, setSwitchValues] = useState<Record<string, boolean>>(
        {},
    );

    return (
        <PanelBase
            renderBody={() => (
                <>
                    {title ? (
                        <PanelHeader title={title} hideButtons />
                    ) : null}
                    <ScrollView
                        style={[
                            style.body,
                            { marginBottom: safeAreaInsets.bottom },
                        ]}>
                        {options.map(item =>
                            item.show === false ? null : item.type ===
                              "switch" ? (
                                <ListItem
                                    key={item.title}
                                    withHorizontalPadding
                                    heightType="small">
                                    <ListItem.ListItemIcon
                                        width={rpx(48)}
                                        icon={item.icon}
                                        iconSize={iconSizeConst.light}
                                    />
                                    <ListItem.Content title={item.title} />
                                    <ThemeSwitch
                                        value={
                                            switchValues[item.title] ??
                                            item.value ??
                                            false
                                        }
                                        onValueChange={v => {
                                            // 先本地更新（UI 即时跳变），再写配置
                                            setSwitchValues(prev => ({
                                                ...prev,
                                                [item.title]: v,
                                            }));
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
                                        // 先收起本面板，再执行动作（与旧气泡"先关菜单再触发"一致）
                                        hidePanel();
                                        item.onPress?.();
                                    }}>
                                    <ListItem.ListItemIcon
                                        width={rpx(48)}
                                        icon={item.icon}
                                        iconSize={iconSizeConst.light}
                                    />
                                    <ListItem.Content title={item.title} />
                                </ListItem>
                            ),
                        )}
                        <View style={style.footer} />
                    </ScrollView>
                </>
            )}
        />
    );
}

const style = StyleSheet.create({
    body: {
        flex: 1,
        paddingTop: rpx(12),
    },
    footer: {
        height: rpx(30),
    },
});
