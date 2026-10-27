import { Linking } from "react-native";
import Toast from "./toast";
import i18n from "@/core/i18n";

export default async function (url: string) {
    try {
        await Linking.canOpenURL(url);
        return Linking.openURL(url);
    } catch {
        Toast.warn(i18n.t("toast.cannotOpenLink"));
    }
}
