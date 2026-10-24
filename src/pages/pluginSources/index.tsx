import React from "react";
import StatusBar from "@/components/base/statusBar";
import PluginList from "@/pages/setting/settingTypes/pluginSetting/views/pluginList";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";

/**
 * 音源管理（独立二级页）- 直接复用插件列表（不再嵌套原生 Stack：
 * 嵌套原生栈在平板覆盖层内会渲染成全屏、盖住顶部 tab；订阅/排序改为覆盖层二级页）
 */
export default function PluginSources() {
    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <PluginList />
        </VerticalSafeAreaView>
    );
}
