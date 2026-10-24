package `fun`.upup.musicfree.soundEffect

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.MotionEvent
import android.widget.FrameLayout

/**
 * 竖向滑块（自绘版）：FrameLayout 固定触控区域（TOUCH_W 宽），onDraw 直接绘制
 * 轨道（1dp 竖线）+ 进度填充 + 圆球（THUMB_DP）。
 *
 * 不用 SeekBar 显示轨道：SeekBar 会把 progressDrawable 拉伸到自身高度，
 * 旋转 270° 后轨道视觉宽度=SeekBar 高度=触控宽，导致轨道严重变粗（30dp）远超圆球。
 * 因此改为外层自绘，轨道精确 1dp、圆球 THUMB_DP，不受 SeekBar 拉伸影响。
 *
 * 触摸：外层 FrameLayout 拦截全部触摸，竖直坐标 y 直接映射到 value 并触发 JS onChange。
 */
class VerticalSliderView(context: Context) : FrameLayout(context) {

    /** 值范围与步长（由 Manager 同步），触摸映射用 */
    var minValue: Int = 0
    var maxValue: Int = 100
    var stepValue: Int = 1

    /** 用户拖动产生的值变化回调（Manager 注册，转发到 JS） */
    var onUserValue: ((Int) -> Unit)? = null

    /** 当前值（公开只读，Manager 用于范围变更后重映射） */
    val currentValue: Int
        get() = curValue

    private var trackColorVal: Int = 0xFFE5E7EB.toInt()
    private var progressColorVal: Int = 0xFF4055D4.toInt()
    private var curValue: Int = 0

    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val thumbPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        trackPaint.style = Paint.Style.STROKE
        trackPaint.strokeCap = Paint.Cap.ROUND
        thumbPaint.style = Paint.Style.FILL
        setWillNotDraw(false)
    }

    companion object {
        /** 视觉宽度（触控热区宽度），由 JS 侧 EQ_TOUCH_W 同步 */
        const val TOUCH_W = 30
        /** 轨道/圆球相对容器的视觉上下留白 */
        const val TRACK_PAD_DP = 10
        /** 轨道粗细（视觉宽度，竖直方向） */
        const val TRACK_DP = 2
        /** 圆球直径 */
        const val THUMB_DP = 12
    }

    private val Int.dp: Float
        get() = this * resources.displayMetrics.density

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val density = resources.displayMetrics.density
        val touchPx = (TOUCH_W * density).toInt()
        val hMode = MeasureSpec.getMode(heightMeasureSpec)
        val hSize = MeasureSpec.getSize(heightMeasureSpec)
        val wSize = MeasureSpec.getSize(widthMeasureSpec)
        val finalH = when (hMode) {
            MeasureSpec.EXACTLY, MeasureSpec.AT_MOST -> if (hSize > 0) hSize else (150 * density).toInt()
            else -> (150 * density).toInt() // UNSPECIFIED：用默认高度
        }
        val finalW = if (wSize > 0) wSize else touchPx
        // 强制外层尺寸，不调用 super.onMeasure（避免其覆盖为 0）
        setMeasuredDimension(finalW, finalH)
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val pad = TRACK_PAD_DP.dp
        val top = pad
        val bottom = h - pad
        if (h <= 0f || bottom <= top) {
            super.onDraw(canvas)
            return
        }
        // saveLayer 建立独立绘制层：restore 时整层合成，圆球/进度移动后旧像素不会残留（防残影），
        // 且不会像 CLEAR 那样把视图区域清成黑屏
        val saveCount = canvas.saveLayer(
            0f, 0f, w, h, null, android.graphics.Canvas.ALL_SAVE_FLAG
        )
        super.onDraw(canvas)
        val cx = w / 2f

        // 当前进度位置（视觉底部=min、顶部=max）
        val range = (maxValue - minValue).toFloat().coerceAtLeast(1f)
        val t = ((curValue - minValue).toFloat() / range).coerceIn(0f, 1f)
        val progY = bottom - t * (bottom - top)

        // 背景轨道（未选中）：1dp 竖线，从 top 到 bottom
        trackPaint.color = trackColorVal
        trackPaint.strokeWidth = TRACK_DP.dp
        canvas.drawLine(cx, top, cx, bottom, trackPaint)

        // 进度填充：从 progY 到 bottom（选中部分，主题色）
        if (progY < bottom) {
            trackPaint.color = progressColorVal
            canvas.drawLine(cx, progY, cx, bottom, trackPaint)
        }

        // 圆球：12dp，圆心在进度位置
        thumbPaint.color = progressColorVal
        val r = (THUMB_DP.dp) / 2f
        canvas.drawCircle(cx, progY, r, thumbPaint)

        // 结束 saveLayer：整层一次性合成，旧内容不残留
        canvas.restoreToCount(saveCount)
    }

    // ===== 触摸：外层拦截，竖直 y → value =====

    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        if (ev.actionMasked == MotionEvent.ACTION_DOWN) return true
        return super.onInterceptTouchEvent(ev)
    }

    override fun onTouchEvent(ev: MotionEvent): Boolean {
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                updateFromTouch(ev.y)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                updateFromTouch(ev.y)
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                updateFromTouch(ev.y)
                return true
            }
        }
        return super.onTouchEvent(ev)
    }

    /** 把竖直触摸坐标映射到 value（视觉顶部=max、底部=min），更新自绘并回调 */
    private fun updateFromTouch(y: Float) {
        val h = height.toFloat()
        if (h <= 0f) return
        val pad = TRACK_PAD_DP.dp
        val top = pad
        val bottom = h - pad
        if (bottom <= top) return
        val clampedY = y.coerceIn(top, bottom)
        val t = 1f - (clampedY - top) / (bottom - top)
        var value = minValue + (t * (maxValue - minValue).toFloat()).toInt()
        if (stepValue > 1) {
            val stepped = Math.round(value.toFloat() / stepValue) * stepValue
            value = stepped.coerceIn(minValue, maxValue)
        }
        curValue = value
        invalidate()
        onUserValue?.invoke(value)
    }

    /** 外部（JS setValue）设置当前值并刷新自绘 */
    fun setValue(value: Int) {
        if (curValue != value) {
            curValue = value.coerceIn(minValue, maxValue)
            invalidate()
        }
    }

    /** 设置轨道背景颜色（未选中部分） */
    fun setTrackColor(color: String?) {
        if (color == null) return
        try {
            trackColorVal = Color.parseColor(color)
            invalidate()
        } catch (_: Exception) {
        }
    }

    /** 设置进度/圆球颜色（选中部分 + thumb） */
    fun setProgressColor(color: String?) {
        if (color == null) return
        try {
            progressColorVal = Color.parseColor(color)
            invalidate()
        } catch (_: Exception) {
        }
    }
}
