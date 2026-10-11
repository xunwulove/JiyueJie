import { Dimensions } from "react-native";
import { useEffect, useState } from "react";
import { isTabletScreen } from "@/utils/tablet";

/** 统一平板判断 hook（对齐 APlayer 11.2：禁止页面散落宽度判断，一律走统一工具）
 *  响应式：监听 Dimensions change，旋转/折叠屏后自动重算 */
export default function useIsTablet(): boolean {
    const [isTablet, setIsTablet] = useState(() => isTabletScreen());

    useEffect(() => {
        const onChange = () => {
            setIsTablet(isTabletScreen());
        };
        const subscription = Dimensions.addEventListener("change", onChange);
        return () => {
            subscription.remove();
        };
    }, []);

    return isTablet;
}
