import * as os from 'os';
import { exec } from 'child_process';
import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { JumpHandler, EditorConfig, JumpContext } from '../types';

/**
 * 错误消息定义
 */
export const errorMessages = {
  noFileOrProject: () => l10n.t('No file or project path provided!'),
  editorNotFound: (name: string, path: string) => 
    l10n.t('Cannot launch {0}: "{1}" not found. Please check the editor path config.', name, path),
  executionFailed: (name: string, error: string) =>
    l10n.t('Failed to launch {0}: {1}', name, error)
};

/**
 * JetBrains 系列编辑器的跳转处理器
 * 支持 macOS 使用 URL scheme 方式，Windows/Linux 使用命令行参数方式
 */
export class JetBrainsHandler implements JumpHandler {
  /**
   * 执行跳转操作
   * @param config 编辑器配置
   * @param context 跳转上下文
   */
  async jump(config: EditorConfig, context: JumpContext): Promise<void> {
    const command = this.buildCommand(config, context);
    await this.executeCommand(command, config);
  }

  /**
   * 根据平台构建跳转命令
   * @param config 编辑器配置
   * @param context 跳转上下文
   * @returns 构建的命令字符串
   */
  buildCommand(config: EditorConfig, context: JumpContext): string {
    const platform = os.platform();
    const path = config.path || this.getDefaultPath(platform, config.name);
    
    if (platform === 'darwin') {
      return this.buildMacCommand(config, context, path);
    } else {
      return this.buildCliCommand(context, path);
    }
  }

  /**
   * 构建 macOS 平台的 URL scheme 命令
   * @param config 编辑器配置
   * @param context 跳转上下文
   * @param appPath 应用路径
   * @returns macOS 命令字符串
   */
  buildMacCommand(
    config: EditorConfig, 
    context: JumpContext, 
    appPath: string
  ): string {
    const scheme = config.urlScheme || 'idea';
    let url: string;
    
    if (context.filePath) {
      url = `${scheme}://open?file=${encodeURIComponent(context.filePath)}`;
      if (context.line) {
        url += `&line=${context.line}`;
      }
      if (context.column !== undefined) {
        url += `&column=${context.column}`;
      }
    } else if (context.projectPath) {
      url = `${scheme}://open?file=${encodeURIComponent(context.projectPath)}`;
    } else {
      throw new Error(errorMessages.noFileOrProject());
    }
    
    return `open -a "${appPath}" "${url}"`;
  }

  /**
   * 构建 Windows/Linux 平台的命令行命令
   * @param context 跳转上下文
   * @param execPath 可执行文件路径
   * @returns 命令行命令字符串
   */
  buildCliCommand(context: JumpContext, execPath: string): string {
    if (context.filePath) {
      let cmd = `"${execPath}"`;
      if (context.line) {
        cmd += ` --line ${context.line}`;
      }
      if (context.column !== undefined) {
        cmd += ` --column ${context.column}`;
      }
      cmd += ` "${context.filePath}"`;
      return cmd;
    } else if (context.projectPath) {
      return `"${execPath}" "${context.projectPath}"`;
    }
    throw new Error(errorMessages.noFileOrProject());
  }

  /**
   * 获取平台特定的默认编辑器路径
   * @param platform 操作系统平台
   * @param editorName 编辑器名称（用于匹配）
   * @returns 默认路径
   */
  getDefaultPath(platform: string, editorName?: string): string {
    const name = editorName?.toLowerCase() || 'intellij idea';
    
    // JetBrains 编辑器名称到应用名称的映射
    const appNameMap: Record<string, { mac: string; win: string; linux: string }> = {
      'intellij idea': {
        mac: 'IntelliJ IDEA',
        win: 'idea64.exe',
        linux: 'idea.sh'
      },
      'webstorm': {
        mac: 'WebStorm',
        win: 'webstorm64.exe',
        linux: 'webstorm.sh'
      },
      'pycharm': {
        mac: 'PyCharm',
        win: 'pycharm64.exe',
        linux: 'pycharm.sh'
      },
      'goland': {
        mac: 'GoLand',
        win: 'goland64.exe',
        linux: 'goland.sh'
      },
      'phpstorm': {
        mac: 'PhpStorm',
        win: 'phpstorm64.exe',
        linux: 'phpstorm.sh'
      },
      'rider': {
        mac: 'Rider',
        win: 'rider64.exe',
        linux: 'rider.sh'
      },
      'clion': {
        mac: 'CLion',
        win: 'clion64.exe',
        linux: 'clion.sh'
      },
      'rubymine': {
        mac: 'RubyMine',
        win: 'rubymine64.exe',
        linux: 'rubymine.sh'
      },
      'datagrip': {
        mac: 'DataGrip',
        win: 'datagrip64.exe',
        linux: 'datagrip.sh'
      },
      'android studio': {
        mac: 'Android Studio',
        win: 'studio64.exe',
        linux: 'studio.sh'
      }
    };

    // 查找匹配的编辑器
    let appInfo = appNameMap['intellij idea']; // 默认使用 IDEA
    for (const [key, value] of Object.entries(appNameMap)) {
      if (name.includes(key)) {
        appInfo = value;
        break;
      }
    }

    switch (platform) {
      case 'darwin':
        // macOS: 返回应用名称，open -a 命令会自动查找
        return appInfo.mac;
      
      case 'win32':
        // Windows: 尝试常见的安装路径
        // JetBrains Toolbox 安装路径（优先使用，因为更常用）
        // 标准安装路径: C:\Program Files\JetBrains\{AppName}\bin\{exe}
        return `${process.env.LOCALAPPDATA}\\JetBrains\\Toolbox\\scripts\\${appInfo.win.replace('64.exe', '')}`;
      
      case 'linux':
        // Linux: 尝试常见的安装路径
        // JetBrains Toolbox 安装路径（优先使用）
        // 其他可能路径: /snap/bin/{app}
        return `${os.homedir()}/.local/share/JetBrains/Toolbox/scripts/${appInfo.linux.replace('.sh', '')}`;
      
      default:
        // 未知平台，返回通用名称
        return appInfo.mac;
    }
  }

  /**
   * 执行跳转命令
   * @param command 要执行的命令
   * @param config 编辑器配置（用于错误提示）
   * @returns Promise，成功时 resolve，失败时 reject
   */
  private executeCommand(command: string, config: EditorConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(command, (error, _stdout, stderr) => {
        if (error) {
          // 判断错误类型，提供更友好的错误提示
          let errorMessage: string;
          
          // 检查是否是找不到编辑器的错误
          if (error.message.includes('ENOENT') || 
              error.message.includes('not found') ||
              error.message.includes('找不到') ||
              error.code === 127) {
            const path = config.path || this.getDefaultPath(os.platform(), config.name);
            errorMessage = errorMessages.editorNotFound(config.name, path);
          } else {
            errorMessage = errorMessages.executionFailed(config.name, error.message);
          }
          
          vscode.window.showErrorMessage(errorMessage);
          reject(new Error(errorMessage));
          return;
        }
        
        // 如果有 stderr 输出但没有错误，可能是警告信息
        if (stderr && stderr.trim()) {
          console.warn(`[JetBrainsHandler] stderr: ${stderr}`);
        }
        
        resolve();
      });
    });
  }
}
