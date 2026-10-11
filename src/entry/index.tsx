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

/**
 * 字体颜色
 */

StatusBar.setBackgroundColor("transparent");
StatusBar.setTranslucent(true);

bootstrap();
const Stack = createNativeStackNavigator<any>();

export default function Pages() {
    const theme = Theme.useTheme();

    return (
        <ErrorBoundary>
            <BootstrapComponent />
            <ReducedMotionConfig mode={ReduceMotion.Never} />
            <GestureHandlerRootView style={globalStyle.flex1}>
                <SafeAreaProvider>
                    <NavigationContainer theme={theme}>
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
                        {/* 自绘启动页：原生渐变底之上，bootstrap 完成前覆盖全屏（图标占比/字标可控） */}
                        <BrandSplash />
                    </NavigationContainer>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}
