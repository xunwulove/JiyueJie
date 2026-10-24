/**
 * TabletPanel 空间预算常量（集中管理，避免散落魔法数）
 *
 * 设计目标：面板内部全部"固定预算可数、歌词行数稳定"——
 * 歌词区按固定行高（LYRIC_ROW_H）× 自适应行数（3~7 行）预算高度，
 * 高屏稳定 7 行、边界小屏自动减少但不下于 3 行（用户确认方案 B）；
 * 封面按剩余高度弹性（96~200dp），多余高度给封面，永不溢出重叠。
 *
 * 高度预算公式：
 *   playContentH = panelH - HEADER_H - HEADER_MB - BOTTOM_H
 *   lyricRows    = clamp(floor((playContentH - COVER_MIN - COVER_MB - TITLE_H - TITLE_MB - ARTIST_H - LYRIC_MARGIN_TOP) / LYRIC_ROW_H), 1, LYRIC_MAX_ROWS)
 *   lyricAreaH   = lyricRows * LYRIC_ROW_H
 *   coverBudget  = playContentH - TITLE_H - TITLE_MB - ARTIST_H - lyricAreaH - COVER_MB - LYRIC_MARGIN_TOP
 *   coverSize    = clamp(min(panelInnerW, coverBudget), COVER_MIN, COVER_MAX)
 */
export const TP_HEADER_H = 56; // 品牌行：与内容区 4 tab 栏同高齐平（用户硬约束，勿改）
export const TP_HEADER_MB = 16;

/** 封面 */
export const TP_COVER_MAX = 200; // 上限 = APlayer 200dp（高屏视觉不变）
export const TP_COVER_MIN = 96; // 下限：矮屏也保留可点击区域
export const TP_COVER_RADIUS = 24;
export const TP_COVER_MB = 12;

/** 歌名 / 歌手固定行高（行高固定使高度预算可精确计算） */
export const TP_TITLE_H = 28; // 歌名 20sp 行高
export const TP_TITLE_MB = 4;
export const TP_ARTIST_H = 22; // 歌手 15sp 行高

/** 歌词区：固定行高 × 自适应行数（3~7 行），保证各屏幕行数稳定 */
export const TP_LYRIC_ROW_H = 40; // 歌词行高（38→40，行距更舒适）
export const TP_LYRIC_MIN_ROWS = 3; // 行数下限（边界小屏也不少于 3 行）
export const TP_LYRIC_MAX_ROWS = 7; // 行数上限（大屏稳定 7 行：当前行 + 上 3 下 3）
export const TP_LYRIC_MARGIN_TOP = 8; // 歌词区与歌手行的间距

/**
 * 按可用高度计算歌词行数（方案 B）：
 * 先保证封面最小 COVER_MIN 与歌名/歌手固定预算，剩余高度除以行高取整，
 * 限制在 [1, TP_LYRIC_MAX_ROWS]（用户确认：大屏 7 行、边界屏自动减少、不溢出）。
 * 说明：常规平板（600dp+ 高）结果 ≥3；极端矮窗兜底 1 行不重叠。
 */
export function calcLyricRows(playContentH: number): number {
    const usable =
        playContentH -
        TP_COVER_MIN -
        TP_COVER_MB -
        TP_TITLE_H -
        TP_TITLE_MB -
        TP_ARTIST_H -
        TP_LYRIC_MARGIN_TOP;
    const rows = Math.floor(usable / TP_LYRIC_ROW_H);
    return Math.max(1, Math.min(rows, TP_LYRIC_MAX_ROWS));
}

/** 底部区（进度条 + 控制栏）固定预算 */
export const TP_BOTTOM_H = 108; // padding 12×2 + slider 28 + controlBar(4×2+44) + marginTop 4

/** 面板左右 padding（对齐 APlayer padding horizontal 20） */
export const TP_PAD_H = 20;
