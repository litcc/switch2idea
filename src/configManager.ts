import * as vscode from 'vscode';
import { EditorConfig } from './types';

/**
 * 配置管理器
 * 负责读取和管理编辑器配置，支持向后兼容旧版配置
 */
export class ConfigManager {
  private static readonly CONFIG_KEY = 'switch2idea';
  private static readonly EDITORS_KEY = 'editors';
  private static readonly LEGACY_PATH_KEY = 'ideaPath';

  /**
   * 获取所有已配置的编辑器列表
   * 支持向后兼容旧版 ideaPath 配置
   * 
   * 优先级：
   * 1. 新版 editors 配置（如果存在且非空）
   * 2. 旧版 ideaPath 配置（向后兼容）
   * 3. 默认配置（IntelliJ IDEA）
   * 
   * @returns 编辑器配置数组
   */
  getEditors(): EditorConfig[] {
    const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_KEY);
    const editors = config.get<EditorConfig[]>(ConfigManager.EDITORS_KEY);
    
    // 优先使用新版 editors 配置 (需求 5.2)
    if (editors && editors.length > 0) {
      return editors;
    }
    
    // 向后兼容：检查旧版配置 (需求 5.1)
    const legacyPath = config.get<string>(ConfigManager.LEGACY_PATH_KEY);
    if (legacyPath) {
      return [{
        name: 'IntelliJ IDEA',
        type: 'jetbrains',
        path: legacyPath,
        urlScheme: 'idea'
      }];
    }
    
    // 返回默认配置 (需求 1.4)
    return this.getDefaultEditors();
  }

  /**
   * 获取默认编辑器配置
   * 当用户未配置任何编辑器时，提供 IntelliJ IDEA 作为默认配置
   * 
   * @returns 默认编辑器配置数组
   */
  private getDefaultEditors(): EditorConfig[] {
    return [{
      name: 'IntelliJ IDEA',
      type: 'jetbrains',
      path: '', // 空路径表示使用自动检测
      urlScheme: 'idea'
    }];
  }
}
