import { Dimensions } from "react-native";

/** 平板判断（对齐 APlayer WindowSize.isTablet()：宽度 ≥ 600dp 为平板）——非组件场景使用 */
export function isTabletScreen(): boolean {
    return Dimensions.get("window").width >= 600;
}
