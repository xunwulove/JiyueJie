package `fun`.upup.musicfree.soundEffect

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * 竖向滑块 ViewManager。
 *
 * Props:
 * - value: 当前值（Int）
 * - minimumValue: 最小值（Int，可为负数）
 * - maximumValue: 最大值（Int）
 * - step: 步长（Int，默认1）
 * - disabled: 是否禁用（Bool）
 * - trackColor: 轨道颜色（String，#RRGGBB）
 * - progressColor: 进度/拇指颜色（String）
 *
 * Events:
 * - onChange: 值变化时触发，payload { value: Int }
 *
 * 兼容性：minSdk=24，SeekBar.setMin 需 API 26+。
 * 低版本（24/25）用 offset 映射：内部 progress = value - minValue，0..(max-min)。
 */
class VerticalSliderManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<VerticalSliderView>() {

    companion object {
        const val REACT_CLASS = "RCTVerticalSlider"
        const val EVENT_CHANGE = "topChange"
    }

    // 每个 view 维护自己的 min/step（低版本 offset 映射用）
    private val minMap = mutableMapOf<Int, Int>()
    private val stepMap = mutableMapOf<Int, Int>()

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): VerticalSliderView {
        val view = VerticalSliderView(reactContext)
        view.setOnSeekBarChangeListener(object : android.widget.SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(
                seekBar: android.widget.SeekBar?,
                progress: Int,
                fromUser: Boolean
            ) {
                if (!fromUser) return
                val id = view.id
                val min = minMap[id] ?: 0
                val step = (stepMap[id] ?: 1).coerceAtLeast(1)
                // 低版本 offset 还原 + step 取整
                var value = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) progress else progress + min
                value = Math.round(value.toFloat() / step) * step
                val event: WritableMap = Arguments.createMap()
                event.putInt("value", value)
                reactContext.getJSModule(RCTEventEmitter::class.java)
                    .receiveEvent(id, EVENT_CHANGE, event)
            }

            override fun onStartTrackingTouch(seekBar: android.widget.SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: android.widget.SeekBar?) {}
        })
        return view
    }

    @ReactProp(name = "value")
    fun setValue(view: VerticalSliderView, value: Int) {
        val min = minMap[view.id] ?: 0
        val progress = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) value else value - min
        if (view.progress != progress) {
            view.progress = progress
        }
    }

    @ReactProp(name = "minimumValue")
    fun setMinimumValue(view: VerticalSliderView, value: Int) {
        minMap[view.id] = value
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            view.min = value
        }
    }

    @ReactProp(name = "maximumValue")
    fun setMaximumValue(view: VerticalSliderView, value: Int) {
        val min = minMap[view.id] ?: 0
        val max = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) value else value - min
        view.max = max
    }

    @ReactProp(name = "step")
    fun setStep(view: VerticalSliderView, value: Int) {
        stepMap[view.id] = value.coerceAtLeast(1)
    }

    @ReactProp(name = "disabled")
    fun setDisabled(view: VerticalSliderView, disabled: Boolean) {
        view.isEnabled = !disabled
        view.alpha = if (disabled) 0.4f else 1f
    }

    @ReactProp(name = "trackColor")
    fun setTrackColor(view: VerticalSliderView, color: String?) {
        view.setTrackColor(color)
    }

    @ReactProp(name = "progressColor")
    fun setProgressColor(view: VerticalSliderView, color: String?) {
        view.setProgressColor(color)
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any>? {
        return MapBuilder.builder<String, Any>()
            .put(
                EVENT_CHANGE,
                MapBuilder.of("registrationName", "onChange")
            )
            .build()
    }
}
