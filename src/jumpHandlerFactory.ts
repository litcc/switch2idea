import * as l10n from '@vscode/l10n';
import { EditorType, JumpHandler } from './types';
import { JetBrainsHandler } from './handlers/jetbrainsHandler';

/**
 * 错误消息定义
 */
export const errorMessages = {
  unsupportedType: (type: string) =>
    l10n.t('Unsupported editor type: {0}. Currently supported types: jetbrains', type)
};

/**
 * 跳转处理器工厂
 * 根据编辑器类型创建和管理对应的跳转处理器
 * 支持扩展机制，可以注册新的处理器类型
 */
export class JumpHandlerFactory {
  private handlers: Map<EditorType, JumpHandler> = new Map();

  constructor() {
    // 默认注册 JetBrains 处理器
    this.handlers.set('jetbrains', new JetBrainsHandler());
  }

  /**
   * 根据编辑器类型获取对应的跳转处理器
   * @param type 编辑器类型
   * @returns 对应的跳转处理器
   * @throws Error 如果类型不支持
   */
  getHandler(type: EditorType): JumpHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(errorMessages.unsupportedType(type));
    }
    return handler;
  }

  /**
   * 注册新的跳转处理器（用于扩展）
   * @param type 编辑器类型
   * @param handler 跳转处理器实例
   */
  registerHandler(type: EditorType, handler: JumpHandler): void {
    this.handlers.set(type, handler);
  }
}
