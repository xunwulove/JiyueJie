package `fun`.upup.musicfree.soundEffect

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.view.MotionEvent
import android.view.View

/**
 * 单 View 均衡器（参数 EQ 风格）：
 * 一个 View 一次性绘制 15 条频段竖线 + 0dB 中线 + 增益响应曲线（Catmull-Rom 平滑穿过各频段点）
 * + 可拖圆球 + 增益/频率标签，替代「15 个独立竖向滑块 + 下方 SVG 曲线」两个块。
 *
 * 设计与实现源自 Equalizer314 / EqGraphView.kt（GPL-3.0；本项目 AGPL-3.0，GPL→AGPL 兼容）：
 *  - init { setLayerType(LAYER_TYPE_SOFTWARE, null) }：一次性软件层，替代逐帧 canvas.saveLayer，
 *    消除"15 个 View 每帧各建一次离屏合成"的卡顿根因，同时保留防残影。
 *  - 单 View 一次 onDraw 绘制全部（网格/曲线/圆球/标签），触摸按 x 命中最近频段列 + 拖 y 改增益
 *    （对应 EqGraphView 的 findClosestPoint + yToGain 映射）。
 *  裁剪掉参数 EQ 的 X 频率拖动与 DSP 依赖（ParametricEqualizer/BiquadFilter/SpectrumAnalyzer），
 *  固定 15 段、频点固定、只拖增益。曲线用 Catmull-Rom 三次贝塞尔跨各频段增益点（与 JS 侧
 *  smoothEqPath 同款系数 /6），不引入 DSP，拖动即时、性能最佳。
 */
class EqCurveView(context: Context) : View(context) {

    /** 频段数量（默认 15） */
    var bandCount: Int = 15
        set(value) {
            field = if (value > 0) value else 15
            if (values.size != field) {
                values = IntArray(field) { if (it < oldValues.size) oldValues[it] else 0 }
            }
            invalidate()
        }

    /** 值范围（毫分贝），JS 侧 -1200..1200 = -12..+12 dB */
    var minValue: Int = -1200
    var maxValue: Int = 1200

    /** 各频段当前值（毫分贝），长度 = bandCount */
    private var values: IntArray = IntArray(15)
    private val oldValues: IntArray get() = values

    /** 用户拖动产生的值变化回调（index, value 毫分贝） */
    var onUserValue: ((Int, Int) -> Unit)? = null

    /** 是否可交互（EQ 关闭时禁拖 + 半透明）。命名 interactive 避免与 View.setEnabled 的 JVM 签名冲突 */
    var interactive: Boolean = true

    private var trackColorVal: Int = 0xFFE5E7EB.toInt()
    private var progressColorVal: Int = 0xFF4055D4.toInt()

    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val midLinePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val curvePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val thumbPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val activeRingPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    /** 当前拖动的频段下标，-1 = 无 */
    private var activeIndex: Int = -1

    companion object {
        /** 上下视觉留白 */
        const val TRACK_PAD_DP = 8
        /** 网格/轨道线宽 */
        const val GRID_DP = 1
        /** 曲线线宽 */
        const val CURVE_DP = 2
        /** 圆球直径 */
        const val THUMB_DP = 12
        /** 触摸命中半径（x 方向） */
        const val HIT_RADIUS_DP = 30
        /** 标签字号 */
        const val LABEL_SP_DP = 9
        /** 每列标签可见的最小列宽（dp）：小于则不画每列 dB/频率，避免重叠 */
        const val MIN_LABEL_COL_DP = 30
    }

    private val Int.dp: Float get() = this * resources.displayMetrics.density
    private val Float.dp: Float get() = this * resources.displayMetrics.density

    init {
        // 默认硬件加速层：onDraw 每帧全量重绘，天然防残影且性能优于软件层/逐帧 saveLayer。
        // 不用 setLayerType(SOFTWARE)：软件层 View 与卡片内硬件加速兄弟（开关/预设胶囊）合成时，
        // eqEnabled 切换触发 invalidate 会把兄弟刷成"可点但不可见"（图层合成 bug）。
        gridPaint.style = Paint.Style.STROKE
        gridPaint.strokeWidth = GRID_DP.dp
        midLinePaint.style = Paint.Style.STROKE
        midLinePaint.strokeWidth = GRID_DP.dp
        curvePaint.style = Paint.Style.STROKE
        curvePaint.strokeCap = Paint.Cap.ROUND
        curvePaint.strokeJoin = Paint.Join.ROUND
        curvePaint.strokeWidth = CURVE_DP.dp
        thumbPaint.style = Paint.Style.FILL
        activeRingPaint.style = Paint.Style.STROKE
        activeRingPaint.strokeWidth = 2.dp
        labelPaint.style = Paint.Style.FILL
        labelPaint.textSize = LABEL_SP_DP.dp
        setWillNotDraw(false)
    }

    // ===== 外部设置 =====

    /** JS 下发各频段值（毫分贝数组），长度不足补 0 */
    fun setValues(newValues: IntArray?) {
        val src = newValues ?: IntArray(0)
        values = IntArray(bandCount) { i -> if (i < src.size) src[i] else 0 }
        invalidate()
    }

    /** 设置轨道/网格颜色 */
    fun setTrackColor(color: String?) {
        if (color == null) return
        try { trackColorVal = android.graphics.Color.parseColor(color); invalidate() } catch (_: Exception) {}
    }

    /** 设置曲线/圆球（主题色） */
    fun setProgressColor(color: String?) {
        if (color == null) return
        try { progressColorVal = android.graphics.Color.parseColor(color); invalidate() } catch (_: Exception) {}
    }

    // ===== 坐标映射（绘制与触摸共用，保证一致） =====

    private fun colWidth(pad: Float): Float {
        val w = width.toFloat()
        return ((w - 2 * pad) / bandCount).coerceAtLeast(1f)
    }

    private fun xForColumn(i: Int, pad: Float, colW: Float): Float = pad + i * colW + colW / 2f

    private fun graphHeight(pad: Float): Float {
        val h = height.toFloat()
        return (h - 2 * pad).coerceAtLeast(1f)
    }

    private fun yForValue(v: Int, pad: Float, graphH: Float): Float {
        val range = (maxValue - minValue).toFloat().coerceAtLeast(1f)
        val t = ((v - minValue).toFloat() / range).coerceIn(0f, 1f)
        return pad + (1f - t) * graphH
    }

    private fun valueForY(y: Float, pad: Float, graphH: Float): Int {
        val range = (maxValue - minValue).toFloat().coerceAtLeast(1f)
        val clamped = y.coerceIn(pad, pad + graphH)
        val t = 1f - (clamped - pad) / graphH
        return (minValue + t * range).toInt()
    }

    // ===== 绘制 =====

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return
        val pad = TRACK_PAD_DP.dp
        val graphH = graphHeight(pad)
        val graphW = w - 2 * pad
        val colW = colWidth(pad)
        if (graphW <= 0f || graphH <= 1f) return
        val density = resources.displayMetrics.density
        val top = pad
        val bottom = pad + graphH
        val drawLabels = colW >= MIN_LABEL_COL_DP.dp
        // 交互态用主题色，关闭态用灰色（不设 alpha，避免图层切换）
        val activeColor = if (interactive) progressColorVal else 0xFF9AA0A6.toInt()

        // 0dB 中线
        val zeroY = yForValue(0, pad, graphH)
        midLinePaint.color = 0xFFD5D9E0.toInt()
        canvas.drawLine(pad, zeroY, w - pad, zeroY, midLinePaint)

        // 频段竖线（细网格，居中列线）
        gridPaint.color = 0x1F000000.toInt()
        for (i in 0 until bandCount) {
            val x = xForColumn(i, pad, colW)
            canvas.drawLine(x, top, x, bottom, gridPaint)
        }

        // 增益响应曲线（Catmull-Rom 平滑穿过各频段点）
        val curvePath = buildCurvePath(pad, colW, graphH)
        if (curvePath != null) {
            curvePaint.color = activeColor
            canvas.drawPath(curvePath, curvePaint)
        }

        // 圆球 + 顶部 dB 标签
        for (i in 0 until bandCount) {
            val x = xForColumn(i, pad, colW)
            val v = if (i < values.size) values[i] else 0
            val y = yForValue(v, pad, graphH)
            // 轨道未激活竖线提示（缩在圆球下方到中线，弱化）
            thumbPaint.color = activeColor
            val r = (THUMB_DP.dp) / 2f
            canvas.drawCircle(x, y, r, thumbPaint)
            if (i == activeIndex) {
                activeRingPaint.color = progressColorVal
                canvas.drawCircle(x, y, r + 3.dp, activeRingPaint)
            }
            // 每列 dB 标签（列宽足够才画，避免重叠）
            if (drawLabels) {
                val db = v / 100f
                val text = if (db > 0) "+${fmt(db)}" else fmt(db)
                labelPaint.color = if (i == activeIndex) progressColorVal else 0xFF8A8F98.toInt()
                labelPaint.textAlign = Paint.Align.CENTER
                canvas.drawText(text, x, top - 2.dp, labelPaint)
            }
        }

        // 底部频率标签（列宽足够才逐列画；否则挑稀疏显示）
        labelPaint.color = 0xFF8A8F98.toInt()
        labelPaint.textAlign = Paint.Align.CENTER
        if (drawLabels) {
            for (i in 0 until bandCount) {
                val x = xForColumn(i, pad, colW)
                canvas.drawText(freqLabel(i), x, bottom + LABEL_SP_DP.dp + 4.dp, labelPaint)
            }
        } else {
            // 窄列：按对数稀疏显示 25/63/160/400/1k/2.5k/6.3k/16k
            val sparse = intArrayOf(0, 2, 4, 6, 8, 10, 12, 14)
            for (i in sparse) {
                if (i >= bandCount) continue
                val x = xForColumn(i, pad, colW)
                canvas.drawText(freqLabel(i), x, bottom + LABEL_SP_DP.dp + 4.dp, labelPaint)
            }
        }
    }

    /** 由频段下标生成频率标签文本（Hz / kHz） */
    private fun freqLabel(i: Int): String {
        // 频率表与 jamesdsp.ts EQ_BANDS 一致
        val freq = intArrayOf(25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000)
        val f = if (i < freq.size) freq[i] else 0
        return if (f >= 1000) "${(f / 1000)}k" else "$f"
    }

    private fun fmt(db: Float): String {
        val v = Math.round(db * 10) / 10f
        return if (v == v.toInt().toFloat()) "${v.toInt()}" else "$v"
    }

    /** Catmull-Rom 平滑曲线（系数 /6，与 JS smoothEqPath 一致），穿过各频段增益点 */
    private fun buildCurvePath(pad: Float, colW: Float, graphH: Float): Path? {
        if (bandCount < 2) return null
        fun px(i: Int): Float = xForColumn(i, pad, colW)
        fun py(i: Int): Float = yForValue(if (i < values.size) values[i] else 0, pad, graphH)
        val path = Path()
        path.moveTo(px(0), py(0))
        for (i in 0 until bandCount - 1) {
            val ax = px(Math.max(0, i - 1)); val ay = py(Math.max(0, i - 1))
            val bx = px(i); val by = py(i)
            val cx = px(i + 1); val cy = py(i + 1)
            val dx = px(Math.min(bandCount - 1, i + 2)); val dy = py(Math.min(bandCount - 1, i + 2))
            val c1x = bx + (cx - ax) / 6f; val c1y = by + (cy - ay) / 6f
            val c2x = cx - (dx - bx) / 6f; val c2y = cy - (dy - by) / 6f
            path.cubicTo(c1x, c1y, c2x, c2y, cx, cy)
        }
        return path
    }

    /** 设置是否可交互（EQ 关闭：禁拖 + 灰色）。不设 alpha，避免图层合成切换触发兄弟绘制缺失 */
    fun setEqEnabled(value: Boolean) {
        interactive = value
        invalidate()
    }

    // ===== 触摸：按 x 命中最近列 + 拖 y 改增益 =====

    override fun onTouchEvent(ev: MotionEvent): Boolean {
        if (!interactive) return false
        val pad = TRACK_PAD_DP.dp
        val graphH = graphHeight(pad)
        val colW = colWidth(pad)
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val idx = findColumn(ev.x, pad, colW)
                if (idx >= 0) {
                    activeIndex = idx
                    parent?.requestDisallowInterceptTouchEvent(true)
                    updateFromTouch(ev.y, pad, graphH)
                    return true
                }
                return false
            }
            MotionEvent.ACTION_MOVE -> {
                if (activeIndex >= 0) {
                    updateFromTouch(ev.y, pad, graphH)
                    return true
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (activeIndex >= 0) {
                    parent?.requestDisallowInterceptTouchEvent(false)
                    updateFromTouch(ev.y, pad, graphH)
                    activeIndex = -1
                    invalidate()
                    return true
                }
            }
        }
        return super.onTouchEvent(ev)
    }

    /** 按 x 命中最近频段列（命中半径 HIT_RADIUS_DP），未命中返回 -1 */
    private fun findColumn(x: Float, pad: Float, colW: Float): Int {
        if (colW <= 0f) return -1
        val raw = (x - pad) / colW
        val col = raw.toInt().coerceIn(0, bandCount - 1)
        val centerX = pad + col * colW + colW / 2f
        return if (Math.abs(x - centerX) <= HIT_RADIUS_DP.dp) col else -1
    }

    /** 竖直触摸坐标 → 毫分贝值，更新自绘并回调 */
    private fun updateFromTouch(y: Float, pad: Float, graphH: Float) {
        if (activeIndex < 0) return
        val v = valueForY(y, pad, graphH)
        if (activeIndex < values.size) {
            values[activeIndex] = v
            invalidate()
            onUserValue?.invoke(activeIndex, v)
        }
    }
}
