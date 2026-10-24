import deviceInfoModule from "react-native-device-info";
import AboutSetting from "./aboutSetting";
import BasicSetting from "./basicSetting";

const settingTypes: Record<
    string,
    {
        title: string;
        component: (...args: any) => JSX.Element;
        showNav?: boolean;
        i18nKey: string;
    }
> = {
    basic: {
        title: "基本设置",
        i18nKey: "sidebar.basicSettings",
        component: BasicSetting,
    },
    // 备份已迁出为独立二级页（ROUTE_PATH.BACKUP），不再作为设置类型注册
    // 主题设置已改为三级浮窗（basicSetting → ThemeSettingDialog），不再注册二级设置页
    about: {
        title: `关于${deviceInfoModule.getApplicationName()}`,
        i18nKey: "common.about",
        component: AboutSetting,
    },
};

export default settingTypes;
