import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import bootstrap from "./bootstrap/bootstrap";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Dialogs from "@/components/dialogs";
import Panels from "@/components/panels";
import PageBackground from "@/components/base/pageBackground";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@/components/base/portal";
import globalStyle from "@/constants/globalStyle";
import Theme from "@/core/theme";
import { BootstrapComponent } from "./bootstrap/BootstrapComponent";
import { ToastBaseComponent } from "@/components/base/toast";
import { StatusBar } from "react-native";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";
import { routes } from "@/core/router/routes.tsx";
import ErrorBoundary from "@/components/errorBoundary";
import BrandSplash from "./bootstrap/BrandSplash";
import Onboarding from "./onboarding/Onboarding";
import PersistStatus from "@/utils/persistStatus";

/**
 * 字体颜色
 */

StatusBar.setBackgroundColor("transparent");
StatusBar.setTranslucent(true);

bootstrap();
const Stack = createNativeStackNavigator<any>();

export default function Pages() {
    const theme = Theme.useTheme();
    // 首次启动（引导页未完成）时不挂主界面：只显示品牌启动页 + 引导页，
    // 避免"主界面先渲染一帧再被覆盖"的闪现；引导完成（写 app.onboardingDone）后自动切换完整界面
    const onboardingDone = PersistStatus.useValue("app.onboardingDone");

    return (
        <ErrorBoundary>
            <BootstrapComponent />
            <ReducedMotionConfig mode={ReduceMotion.Never} />
            <GestureHandlerRootView style={globalStyle.flex1}>
                <SafeAreaProvider>
                    <PageBackground />
                    {onboardingDone ? (
                        <NavigationContainer theme={theme}>
                            <Stack.Navigator
                                initialRouteName={routes[0].path}
                                screenOptions={{
                                    headerShown: false,
                                    animation: "slide_from_right",
                                    animationDuration: 100,
                                }}>
                                {routes.map(route => {
                                    const ScreenComponent = route.component;
                                    // 按屏局部 ErrorBoundary：单页崩溃不拖垮整个 App，
                                    // 全局 ErrorBoundary 仍作最外层兜底
                                    const WrappedScreen = (props: any) => (
                                        <ErrorBoundary>
                                            <ScreenComponent {...props} />
                                        </ErrorBoundary>
                                    );
                                    return (
                                        <Stack.Screen
                                            key={route.path}
                                            name={route.path}
                                            component={WrappedScreen}
                                        />
                                    );
                                })}
                            </Stack.Navigator>
                            <Panels />
                            <Dialogs />
                            <ToastBaseComponent />
                            <PortalHost />
                            {/* 代码层启动页：窗口背景（纯色+图标）之上，bootstrap 完成前显示 图标+行楷文字，
                                尺寸按屏幕弹性计算（对齐网易云/QQ），完成后立即淡出，无强制停留 */}
                            <BrandSplash />
                        </NavigationContainer>
                    ) : (
                        <>
                            {/* 首次启动：启动页 + 引导页（无主界面，杜绝闪现） */}
                            <BrandSplash />
                            <Onboarding />
                        </>
                    )}
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}
