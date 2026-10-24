import { GlobalState } from "@/utils/stateMapper";
import { DeviceEventEmitter } from "react-native";
import panels from "./types";

type IPanel = typeof panels;
type IPanelkeys = keyof IPanel;

interface IPanelInfo {
    name: IPanelkeys | null;
    payload: any;
}

/** 浮层信息 */
export const panelInfoStore = new GlobalState<IPanelInfo>({
    name: null,
    payload: null,
});

export function showPanel<T extends IPanelkeys>(
    name: T,
    payload?: Parameters<IPanel[T]>[0],
) {
    if (panelInfoStore.getValue().name) {
        DeviceEventEmitter.emit("hidePanel", {
            callback: () => {
                panelInfoStore.setValue({
                    name,
                    payload,
                });
            },
        });
    } else {
        panelInfoStore.setValue({
            name,
            payload,
        });
    }
}

export interface IHidePanelOptions {
    /** 立即收起（跳过收起动画），用于"关闭菜单同时弹出三级浮窗"，避免黑色遮罩残留 */
    immediate?: boolean;
    /** 面板完全卸载后执行（如接着弹三级浮窗） */
    callback?: () => void;
}

export function hidePanel(options?: IHidePanelOptions) {
    DeviceEventEmitter.emit("hidePanel", options ?? {});
}
