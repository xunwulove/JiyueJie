package com.jiyuejie.music.soundEffect

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * 单 View 均衡器（参数 EQ 曲线）ViewManager。
 *
 * Props:
 * - values: 各频段当前值（IntArray，毫分贝 -1200..1200），长度=频段数
 * - minimumValue / maximumValue: 值范围（毫分贝）
 * - trackColor: 网格/轨道颜色（String，#RRGGBB）
 * - progressColor: 曲线/圆球颜色（String）
 *
 * Events:
 * - onUserValue: 拖动某频段时触发，payload { index: Int, value: Int（毫分贝） }
 */
class EqCurveManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<EqCurveView>() {

    companion object {
        const val REACT_CLASS = "RCTEqCurve"
        const val EVENT_USER = "topUserValue"
    }

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): EqCurveView {
        val view = EqCurveView(reactContext)
        // 拖动某频段 → 转发 index + 毫分贝值 到 JS
        view.onUserValue = { index, value ->
            val event: WritableMap = Arguments.createMap()
            event.putInt("index", index)
            event.putInt("value", value)
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, EVENT_USER, event)
        }
        return view
    }

    @ReactProp(name = "values")
    fun setValues(view: EqCurveView, values: ReadableArray?) {
        if (values == null) return
        val arr = IntArray(values.size())
        for (i in 0 until values.size()) arr[i] = values.getInt(i)
        view.setValues(arr)
    }

    @ReactProp(name = "minimumValue")
    fun setMinimumValue(view: EqCurveView, value: Int) {
        view.minValue = value
        view.invalidate()
    }

    @ReactProp(name = "maximumValue")
    fun setMaximumValue(view: EqCurveView, value: Int) {
        view.maxValue = value
        view.invalidate()
    }

    @ReactProp(name = "trackColor")
    fun setTrackColor(view: EqCurveView, color: String?) {
        view.setTrackColor(color)
    }

    @ReactProp(name = "disabled")
    fun setDisabled(view: EqCurveView, disabled: Boolean) {
        view.setEqEnabled(!disabled)
    }

    @ReactProp(name = "progressColor")
    fun setProgressColor(view: EqCurveView, color: String?) {
        view.setProgressColor(color)
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any>? {
        return MapBuilder.builder<String, Any>()
            .put(EVENT_USER, MapBuilder.of("registrationName", "onUserValue"))
            .build()
    }
}
