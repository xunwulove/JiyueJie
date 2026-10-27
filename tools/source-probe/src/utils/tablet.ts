import { Dimensions, PixelRatio } from "react-native";

/** 平板判断（对齐 Android 官方 sw600dp：最小边 ≥ 600dp 视为平板，等价 APlayer WindowSize.isTablet()）
 *  短边法避免手机横屏（宽 > 600 但高仅 ~390dp）误判为平板 → 走手机布局
 *  大屏兜底：1280×720 等 720p 大屏（车机/大屏模拟器，density ≤1.75 时 dp 短边仅 480）
 *  也视为平板；720p 手机（@2x → 640×360dp）density=2 不命中，仍走手机布局 */
export function isTabletScreen(): boolean {
    const { width, height } = Dimensions.get("window");
    const minDp = Math.min(width, height);
    if (minDp >= 600) {
        return true;
    }
    // 物理像素短边 ≥ 720 且 density ≤ 1.75 → 720p 大屏（车机/平板），算平板
    const density = PixelRatio.get();
    const minPx = minDp * density;
    return minPx >= 720 && density <= 1.75;
}
