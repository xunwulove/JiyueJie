import { useAppConfig } from "@/core/appConfig";
import Theme from "@/core/theme";
import { useListenOrientationChange } from "@/hooks/useOrientation";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import bootstrapAtom from "./bootstrap.atom";

export function BootstrapComponent() {
    const bootstrapState = useAtomValue(bootstrapAtom);

    useListenOrientationChange();

    const followSystem = useAppConfig("theme.followSystem");

    const colorScheme = useColorScheme();

    useEffect(() => {
        if (followSystem) {
            if (colorScheme === "dark") {
                Theme.setTheme("p-dark");
            } else if (colorScheme === "light") {
                Theme.setTheme("p-light");
            }
        }
    }, [colorScheme, followSystem]);

    return null;
}
