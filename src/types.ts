/**
 * 编辑器类型枚举
 * 用于区分不同的跳转逻辑
 */
export type EditorType = 'jetbrains' | 'custom';

/**
 * 单个编辑器配置
 */
export interface EditorConfig {
  /** 显示名称，如 "WebStorm", "PyCharm" */
  name: string;
  /** 编辑器类型，决定跳转逻辑 */
  type: EditorType;
  /** 可执行文件路径或应用名称 */
  path: string;
  /** macOS URL scheme，如 "webstorm", "pycharm"，可选 */
  urlScheme?: string;
}

/**
 * 跳转上下文，包含跳转所需的所有信息
 */
export interface JumpContext {
  /** 文件绝对路径 */
  filePath?: string;
  /** 项目根目录路径 */
  projectPath?: string;
  /** 行号（1-based） */
  line?: number;
  /** 列号（0-based） */
  column?: number;
}

/**
 * 跳转处理器接口
 */
export interface JumpHandler {
  /**
   * 执行跳转操作
   * @param config 编辑器配置
   * @param context 跳转上下文
   */
  jump(config: EditorConfig, context: JumpContext): Promise<void>;
}
