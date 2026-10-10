import { isTabletScreen } from "@/utils/tablet";

/** 统一平板判断 hook（对齐 APlayer 11.2：禁止页面散落宽度判断，一律走统一工具） */
export default function useIsTablet(): boolean {
    return isTabletScreen();
}
