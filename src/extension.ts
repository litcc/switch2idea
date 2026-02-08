import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { ConfigManager } from './configManager';
import { JumpHandlerFactory } from './jumpHandlerFactory';
import { EditorSelector } from './editorSelector';
import { JumpContext, EditorConfig } from './types';
import { 
  EditorTreeDataProvider, 
  EditorConfigCommands, 
  EditorTreeItem 
} from './editorTreeView';

/**
 * 错误消息定义
 */
const errorMessages = {
  noActiveEditor: () => l10n.t('No active file! Please open a file first.'),
  noWorkspace: () => l10n.t('No workspace open! Please open a project folder first.'),
};

// 全局组件实例
let configManager: ConfigManager;
let jumpHandlerFactory: JumpHandlerFactory;
let editorSelector: EditorSelector;
let treeDataProvider: EditorTreeDataProvider;
let editorConfigCommands: EditorConfigCommands;

export function activate(context: vscode.ExtensionContext) {
  console.log('Switch2IDEA is now active!');

  // 实例化所有组件
  configManager = new ConfigManager();
  jumpHandlerFactory = new JumpHandlerFactory();
  editorSelector = new EditorSelector();

  // 初始化 TreeView
  treeDataProvider = new EditorTreeDataProvider(configManager);
  editorConfigCommands = new EditorConfigCommands(configManager, treeDataProvider);

  // 设置 TreeView 可见性 context key
  const updateTreeViewVisibility = () => {
    const showTreeView = vscode.workspace
      .getConfiguration('switch2idea')
      .get<boolean>('showTreeView', true);
    vscode.commands.executeCommand('setContext', 'switch2idea.showTreeView', showTreeView);
  };
  updateTreeViewVisibility();

  // 注册 TreeView
  const treeView = vscode.window.createTreeView('switch2idea.editors', {
    treeDataProvider,
    showCollapseAll: false
  });

  // 监听配置变化，自动刷新 TreeView 和可见性
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('switch2idea.editors')) {
      treeDataProvider.refresh();
    }
    if (e.affectsConfiguration('switch2idea.showTreeView')) {
      updateTreeViewVisibility();
    }
  });

  // 注册 TreeView 相关命令
  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand('switch2idea.addEditor', () => 
      editorConfigCommands.addEditor()
    ),
    vscode.commands.registerCommand('switch2idea.editEditor', (item: EditorTreeItem) => 
      editorConfigCommands.editEditor(item)
    ),
    vscode.commands.registerCommand('switch2idea.deleteEditor', (item: EditorTreeItem) => 
      editorConfigCommands.deleteEditor(item)
    ),
    vscode.commands.registerCommand('switch2idea.openJsonConfig', () => 
      editorConfigCommands.openJsonConfig()
    ),
    vscode.commands.registerCommand('switch2idea.refreshEditors', () => 
      treeDataProvider.refresh()
    ),
    vscode.commands.registerCommand('switch2idea.jumpToEditor', async (item: EditorTreeItem) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(errorMessages.noActiveEditor());
        return;
      }
      
      const jumpContext: JumpContext = {
        filePath: editor.document.uri.fsPath,
        line: editor.selection.active.line + 1,
        column: editor.selection.active.character,
      };
      
      await executeJumpToEditor(item.editor, jumpContext);
    })
  );

  // 注册 openFileInIDEA 命令
  // 需求 4.1: 保留现有的快捷键绑定 (Alt+Shift+O)
  let openFileDisposable = vscode.commands.registerCommand(
    'Switch2IDEA.openFileInIDEA',
    async (uri?: vscode.Uri) => {
      // 构建跳转上下文
      let filePath: string;
      let line = 1;
      let column = 0;

      if (uri) {
        // 从右键菜单触发，使用传入的 URI
        filePath = uri.fsPath;
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === filePath) {
          line = editor.selection.active.line + 1; // 转换为 1-based
          column = editor.selection.active.character; // 0-based
        }
      } else {
        // 从快捷键或命令面板触发
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage(errorMessages.noActiveEditor());
          return;
        }
        filePath = editor.document.uri.fsPath;
        line = editor.selection.active.line + 1; // 转换为 1-based
        column = editor.selection.active.character; // 0-based
      }

      const jumpContext: JumpContext = {
        filePath,
        line,
        column,
      };

      await executeJump(jumpContext);
    }
  );

  // 注册 openProjectInIDEA 命令
  // 需求 4.1: 保留现有的快捷键绑定 (Alt+Shift+P)
  let openProjectDisposable = vscode.commands.registerCommand(
    'Switch2IDEA.openProjectInIDEA',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(errorMessages.noWorkspace());
        return;
      }

      const projectPath = workspaceFolders[0].uri.fsPath;

      const jumpContext: JumpContext = {
        projectPath,
      };

      await executeJump(jumpContext);
    }
  );

  context.subscriptions.push(openFileDisposable);
  context.subscriptions.push(openProjectDisposable);
}

/**
 * 执行跳转操作
 * 新架构的核心流程：
 * 1. 从 ConfigManager 获取编辑器列表
 * 2. 通过 EditorSelector 让用户选择编辑器（或自动选择）
 * 3. 从 JumpHandlerFactory 获取对应的处理器
 * 4. 调用处理器执行跳转
 *
 * @param context 跳转上下文
 */
async function executeJump(context: JumpContext): Promise<void> {
  try {
    // 1. 获取编辑器列表
    const editors = configManager.getEditors();

    // 2. 让用户选择编辑器
    // 需求 4.2: 配置了多个编辑器时弹出 QuickPick 供用户选择
    // 需求 4.3: 只配置了一个编辑器时直接跳转
    const selectedEditor = await editorSelector.selectEditor(editors);

    // 用户取消选择
    if (!selectedEditor) {
      return;
    }

    // 3. 获取对应的跳转处理器
    const handler = jumpHandlerFactory.getHandler(selectedEditor.type);

    // 4. 执行跳转
    await handler.jump(selectedEditor, context);
  } catch (error) {
    const err = error as Error;
    vscode.window.showErrorMessage(err.message);
  }
}

/**
 * 直接跳转到指定编辑器
 * 用于 TreeView 中的快速跳转
 *
 * @param editor 目标编辑器配置
 * @param context 跳转上下文
 */
async function executeJumpToEditor(editor: EditorConfig, context: JumpContext): Promise<void> {
  try {
    const handler = jumpHandlerFactory.getHandler(editor.type);
    await handler.jump(editor, context);
  } catch (error) {
    const err = error as Error;
    vscode.window.showErrorMessage(err.message);
  }
}

export function deactivate() {}
