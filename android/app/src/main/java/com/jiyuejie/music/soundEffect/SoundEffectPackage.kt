package com.jiyuejie.music.soundEffect

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager
import com.jiyuejie.music.jamesdsp.JamesDSPModule

class SoundEffectPackage : ReactPackage {

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): MutableList<ViewManager<View, ReactShadowNode<*>>> =
        mutableListOf(
            VerticalSliderManager(reactContext) as ViewManager<View, ReactShadowNode<*>>,
            EqCurveManager(reactContext) as ViewManager<View, ReactShadowNode<*>>
        )

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): MutableList<NativeModule> = listOf(
        SoundEffectModule(reactContext),
        JamesDSPModule(reactContext)
    ).toMutableList()
}
