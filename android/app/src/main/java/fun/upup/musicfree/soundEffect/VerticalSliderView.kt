package `fun`.upup.musicfree.soundEffect

import android.content.Context
import android.graphics.Color
import androidx.appcompat.widget.AppCompatSeekBar
import `fun`.upup.musicfree.R

/**
 * 竖向滑块：原生 SeekBar 旋转 270 度，系统级手势处理，跟手度与横向 Slider 一致。
 *
 * 规范：
 * - 轨道线宽：4dp（自定义 eq_slider_track.xml，圆角 2dp）
 * - Thumb 圆形按钮：20dp 直径（自定义 eq_slider_thumb.xml）
 * - 触摸热区：由 RN 侧设置宽度（44dp）
 * - Padding：左右各 10dp（thumb 半径），旋转270度后变为上下 padding，防止 thumb 被裁剪
 *
 * 实现要点：
 * - rotation=270 后视觉宽高互换，onMeasure 交换测量维度使布局正确
 * - 旋转由 View 属性驱动，触摸事件系统自动转换坐标，无需手动映射
 * - 轨道/thumb 颜色通过 progressTintList / thumbTintList 动态染色（覆盖 drawable 默认色）
 */
class VerticalSliderView(context: Context) : AppCompatSeekBar(context) {

    init {
        // 自定义轨道（4dp）和 thumb（20dp 圆形），跨设备尺寸一致
        progressDrawable = context.getDrawable(R.drawable.eq_slider_track)
        thumb = context.getDrawable(R.drawable.eq_slider_thumb)
        // thumb 半径 10dp，左右各留 10dp 防止旋转后上下边缘被裁剪
        setPadding(10.dp, 0, 10.dp, 0)
        rotation = 270f
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        // 旋转270度后视觉宽=原高、视觉高=原宽，交换测量维度
        super.onMeasure(heightMeasureSpec, widthMeasureSpec)
        setMeasuredDimension(measuredHeight, measuredWidth)
    }

    /** 设置轨道颜色（未选中部分） */
    fun setTrackColor(color: String?) {
        if (color == null) return
        try {
            val c = Color.parseColor(color)
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(c)
        } catch (_: Exception) {
        }
    }

    /** 设置进度颜色（已选中部分 + thumb） */
    fun setProgressColor(color: String?) {
        if (color == null) return
        try {
            val c = Color.parseColor(color)
            progressTintList = android.content.res.ColorStateList.valueOf(c)
            thumbTintList = android.content.res.ColorStateList.valueOf(c)
        } catch (_: Exception) {
        }
    }
}
