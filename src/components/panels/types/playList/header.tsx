import PanelHeader from "../../base/panelHeader";
import { usePlayList } from "@/core/trackPlayer";
import { useI18N } from "@/core/i18n";
import React from "react";

/**
 * 播放队列标题栏 - 与其他右侧浮出层统一（PanelHeader 规格：56dp 行高 + 对角渐变 + 标题 title(18)/bold 居中）。
 * 循环模式/清空按钮已移至列表底部工具条（body.tsx）。
 */
export default function Header() {
    const playList = usePlayList();
    const { t } = useI18N();

    return (
        <PanelHeader
            hideButtons
            title={`${t("panel.playList.title")}${t("panel.playList.count", {
                count: playList.length,
            })}`}
        />
    );
}
