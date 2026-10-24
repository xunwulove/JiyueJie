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
                    {onboardingDone ? (
                        <NavigationContainer theme={theme}>
                            {/* 全局背景：必须在 NavigationContainer 内（useTheme 才能拿到当前主题），
                                与二级页面（SubPageOverlay 复用同款）渐变一致；所有页面透明透出此层 */}
                            <PageBackground />
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
                            {/* 2026-10-14 决策：启动页只用系统 splash（原生 windowBackground 承接），
                                移除 RN 自制 BrandSplash——代码层背景页有启动时间长、背景错位问题 */}
                        </NavigationContainer>
                    ) : (
                        <>
                            {/* 首次启动：引导页（启动画面由系统 splash / 窗口背景承接） */}
                            <Onboarding />
                        </>
                    )}
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}
