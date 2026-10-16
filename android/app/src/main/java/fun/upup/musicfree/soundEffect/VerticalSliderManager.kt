package `fun`.upup.musicfree.soundEffect

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * 竖向滑块 ViewManager（自绘版，无 SeekBar）。
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
 */
class VerticalSliderManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<VerticalSliderView>() {

    companion object {
        const val REACT_CLASS = "RCTVerticalSlider"
        const val EVENT_CHANGE = "topChange"
    }

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): VerticalSliderView {
        val view = VerticalSliderView(reactContext)
        // 触摸由 VerticalSliderView 自处理（竖直 y → value），拖动时回调转发到 JS
        view.onUserValue = { value ->
            val event: WritableMap = Arguments.createMap()
            event.putInt("value", value)
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, EVENT_CHANGE, event)
        }
        return view
    }

    @ReactProp(name = "value")
    fun setValue(view: VerticalSliderView, value: Int) {
        view.setValue(value)
    }

    @ReactProp(name = "minimumValue")
    fun setMinimumValue(view: VerticalSliderView, value: Int) {
        view.minValue = value
        view.setValue(view.currentValue)
    }

    @ReactProp(name = "maximumValue")
    fun setMaximumValue(view: VerticalSliderView, value: Int) {
        view.maxValue = value
        view.setValue(view.currentValue)
    }

    @ReactProp(name = "step")
    fun setStep(view: VerticalSliderView, value: Int) {
        view.stepValue = value.coerceAtLeast(1)
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
