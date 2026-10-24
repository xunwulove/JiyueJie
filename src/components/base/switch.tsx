import React, { useEffect } from "react";
import {
    StyleSheet,
    SwitchProps,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import useColors from "@/hooks/useColors";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { timingConfig } from "@/constants/commonConst";

interface ISwitchProps extends SwitchProps {}

const fixedWidth = 20;

export default function ThemeSwitch(props: ISwitchProps) {
    const { value, onValueChange } = props;
    const colors = useColors();

    const sharedValue = useSharedValue(value ? 1 : 0);

    useEffect(() => {
        sharedValue.value = value ? 1 : 0;
    }, [value]);

    const thumbStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: withTiming(
                        sharedValue.value * fixedWidth,
                        timingConfig.animationNormal,
                    ),
                },
            ],
        };
    });

    return (
        <TouchableWithoutFeedback
            hitSlop={{ top: 12, bottom: 12 }}
            onPress={() => {
                onValueChange?.(!value);
            }}>
            <View
                style={[
                    styles.container,
                    {
                        backgroundColor: value
                            ? colors.primary
                            : colors.textSecondary,
                    },
                    props?.style,
                ]}>
                <Animated.View style={[styles.thumb, thumbStyle]} />
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 52,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
    },
    thumb: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "white",
        left: 5,
    },
});
