/**
 * 字幕样式配置文件
 * 修改此文件可自定义字幕的外观样式
 */

export const captionerConfig = {
  // 字体设置
  font: {
    family: "Inter",                    // 字体名称
    size: 52,                           // 字体大小 (px)
    lineHeight: 1.5,                    // 行高
  },

  // 颜色设置
  colors: {
    text: "#6EE7B7",                    // 文字颜色 - 薄荷绿/青绿色
    stroke: "rgba(0, 0, 0, 0.9)",       // 描边颜色 - 加深对比
    background: "rgba(0, 0, 0, 0.98)",  // 背景颜色 - 几乎纯黑
  },

  // 描边设置
  stroke: {
    width: 2,                           // 描边宽度 (px) - 细描边
  },

  // 位置设置
  position: {
    bottom: 20,                         // 距离底部距离 (px) - 向上调整
    height: 100,                        // 容器高度 (px)
    maxWidthRatio: 1.0,                 // 最大宽度占视频宽度的比例 - 全宽
  },

  // 容器样式
  container: {
    paddingVertical: 20,                // 垂直内边距 (px) - 增加上下空间
    paddingHorizontal: 40,              // 水平内边距 (px)
    borderRadius: 16,                   // 圆角 (px) - 顶部圆角
  },

  // 动画设置
  animation: {
    enterDuration: 10,                  // 入场动画时长 (帧)
    damping: 150,                       // 弹簧阻尼
    initialScale: 0.95,                 // 初始缩放
    initialTranslateY: 20,              // 初始 Y 偏移 (px)
  },

  // 字幕处理设置
  processing: {
    maxCharsPerLine: 42,                // 每行最大字符数
  },

  // 高级样式选项
  advanced: {
    textShadow: "none",                            // 文字阴影 - 不需要
    backgroundBlur: "0px",                         // 背景模糊 - 不需要
    border: "none",                                // 边框 - 不需要
    borderTopLeftRadius: 16,                       // 左上角圆角
    borderTopRightRadius: 16,                      // 右上角圆角
    borderBottomLeftRadius: 0,                     // 左下角直角
    borderBottomRightRadius: 0,                    // 右下角直角
  },
};
