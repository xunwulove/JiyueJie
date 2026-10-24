import Color from "color";

export function grayRate(color: string | Color) {
    let _color = typeof color === "string" ? Color(color) : color;

    return (
        ((0.299 * _color.red() +
            0.587 * _color.green() +
            0.114 * _color.blue()) *
            2 -
            255) /
        255
    );
}

export function grayLevelCode(color: string | Color) {
    // grayRate 输出范围为 [-1, 1]：-1 纯黑，1 纯白。
    // 原阈值 96/160 是按 0~255 亮度写的，与当前输出范围不匹配（恒返回 "dark"）。
    // 换算：亮度 96 → (2*96-255)/255 ≈ -0.25；亮度 160 → (2*160-255)/255 ≈ 0.25。
    const gray = grayRate(color);
    if (gray < -0.25) {
        return "dark";
    } else if (gray > 0.25) {
        return "light";
    } else {
        return "mid";
    }
}
