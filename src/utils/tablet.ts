import { Dimensions, PixelRatio } from "react-native";

/** 平板判定（手机永远手机布局 / 平板与车机横放才平板）：
 *  1. 竖屏（高>宽）：一律手机布局（内容全宽）——含平板竖屏、比亚迪旋转屏竖屏，
 *     避免竖屏左右分栏挤压内容区。
 *  2. 横屏（宽>高）：
 *     - 短边(高) ≥ 600dp → 平板（720P@160、2K 车机、常规平板横屏）
 *     - 或 车机档：宽≥800dp 且 高≥450dp 且 density≤2.5 → 平板
 *       （1080P 车机 1280×450dp、720P@240 853×480dp、720P@213 960×540dp）
 *     - 其余（手机横屏：640×360 / 932×430@3x / 1040×480@3x 等）→ 手机
 *  手机界定：竖屏天然不命中；横屏时高<450 或宽<800 或 density>2.5 即手机。 */
export function isTabletScreen(): boolean {
    const { width, height } = Dimensions.get("window");
    if (height > width) {
        return false;
    }
    if (height >= 600) {
        return true;
    }
    const density = PixelRatio.get();
    return width >= 800 && height >= 450 && density <= 2.5;
}
