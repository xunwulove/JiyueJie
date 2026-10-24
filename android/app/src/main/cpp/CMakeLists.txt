cmake_minimum_required(VERSION 3.22.1)
project(jiyuejie_dsp)

# 递归收集 libjamesdsp 所有 .c 源文件
file(GLOB_RECURSE JDSP_SOURCES
    "${CMAKE_CURRENT_SOURCE_DIR}/jamesdsp/*.c"
)

# 排除系统级 AudioEffect 插件入口（依赖 Android audio effect 框架，应用内集成不需要）
list(FILTER JDSP_SOURCES EXCLUDE REGEX ".*/jamesdsp\\.c$")

# 我们的 JNI 桥接层
set(JNI_SOURCES
    "${CMAKE_CURRENT_SOURCE_DIR}/jdsp_jni.c"
)

add_library(jiyuejie_dsp SHARED
    ${JDSP_SOURCES}
    ${JNI_SOURCES}
)

# 递归收集所有头文件目录
file(GLOB_RECURSE JDSP_HEADERS
    "${CMAKE_CURRENT_SOURCE_DIR}/jamesdsp/*.h"
)
set(JDSP_INCLUDE_DIRS "")
foreach(_header ${JDSP_HEADERS})
    get_filename_component(_dir ${_header} DIRECTORY)
    list(APPEND JDSP_INCLUDE_DIRS ${_dir})
endforeach()
list(REMOVE_DUPLICATES JDSP_INCLUDE_DIRS)

target_include_directories(jiyuejie_dsp PRIVATE
    ${JDSP_INCLUDE_DIRS}
    "${CMAKE_CURRENT_SOURCE_DIR}/jamesdsp"
)

# 编译选项：对齐 Android.mk 的优化级别
target_compile_options(jiyuejie_dsp PRIVATE
    -Wall
    -Wextra
    -Wno-incompatible-function-pointer-types
    -Wno-implicit-int
    -ffunction-sections
    -fdata-sections
    -Ofast
    -ftree-vectorize
    -fvisibility=hidden
    -DJAMESDSP_REFERENCE_IMPL
)

# 仅 arm64 启用 NEON
if(${ANDROID_ABI} STREQUAL "arm64-v8a")
    target_compile_options(jiyuejie_dsp PRIVATE -march=armv8-a)
elseif(${ANDROID_ABI} STREQUAL "armeabi-v7a")
    target_compile_options(jiyuejie_dsp PRIVATE -march=armv7-a -mfpu=neon)
endif()

# 链接系统库
target_link_libraries(jiyuejie_dsp
    android
    log
    m
)
