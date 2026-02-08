import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { EditorConfig, EditorType } from './types';
import { ConfigManager } from './configManager';

/**
 * JetBrains IDE 预设模板
 */
export const JETBRAINS_PRESETS: Omit<EditorConfig, 'path'>[] = [
  { name: 'IntelliJ IDEA', type: 'jetbrains', urlScheme: 'idea' },
  { name: 'WebStorm', type: 'jetbrains', urlScheme: 'webstorm' },
  { name: 'PyCharm', type: 'jetbrains', urlScheme: 'pycharm' },
  { name: 'RustRover', type: 'jetbrains', urlScheme: 'rustrover' },
  { name: 'GoLand', type: 'jetbrains', urlScheme: 'goland' },
  { name: 'CLion', type: 'jetbrains', urlScheme: 'clion' },
  { name: 'PhpStorm', type: 'jetbrains', urlScheme: 'phpstorm' },
  { name: 'Rider', type: 'jetbrains', urlScheme: 'rider' },
  { name: 'DataGrip', type: 'jetbrains', urlScheme: 'datagrip' },
  { name: 'Android Studio', type: 'jetbrains', urlScheme: 'studio' },
];

/**
 * 编辑器 TreeItem
 */
export class EditorTreeItem extends vscode.TreeItem {
  constructor(
    public readonly editor: EditorConfig,
    public readonly index: number
  ) {
    super(editor.name, vscode.TreeItemCollapsibleState.None);
    
    this.description = `(${editor.type})`;
    this.tooltip = new vscode.MarkdownString(
      `**${editor.name}**\n\n` +
      `- ${l10n.t('Type: {0}', editor.type)}\n` +
      `- ${l10n.t('Path: {0}', editor.path || l10n.t('Auto detect'))}\n` +
      `- ${l10n.t('URL Scheme: {0}', editor.urlScheme || l10n.t('None'))}`
    );
    this.contextValue = 'editorItem';
    this.iconPath = new vscode.ThemeIcon(
      editor.type === 'jetbrains' ? 'symbol-class' : 'symbol-misc'
    );
  }
}


/**
 * 添加编辑器占位项
 */
export class AddEditorTreeItem extends vscode.TreeItem {
  constructor() {
    super(l10n.t('Add editor...'), vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('add');
    this.command = {
      command: 'switch2idea.addEditor',
      title: l10n.t('Add Editor')
    };
    this.contextValue = 'addEditor';
  }
}

/**
 * 编辑器 TreeView 数据提供器
 */
export class EditorTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private configManager: ConfigManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    const editors = this.configManager.getEditors();
    const items: vscode.TreeItem[] = editors.map(
      (editor, index) => new EditorTreeItem(editor, index)
    );
    items.push(new AddEditorTreeItem());
    return items;
  }
}

/**
 * 编辑器配置管理命令
 */
export class EditorConfigCommands {
  constructor(
    private configManager: ConfigManager,
    private treeDataProvider: EditorTreeDataProvider
  ) {}

  async addEditor(): Promise<void> {
    const typeItems: vscode.QuickPickItem[] = [
      {
        label: `$(symbol-class) ${l10n.t('JetBrains IDE')}`,
        description: l10n.t('Select from preset list'),
        detail: l10n.t('WebStorm, PyCharm, IDEA, RustRover, etc.')
      },
      {
        label: `$(symbol-misc) ${l10n.t('Custom Editor')}`,
        description: l10n.t('Manual configuration'),
      },
    ];

    const typeChoice = await vscode.window.showQuickPick(typeItems, {
      placeHolder: l10n.t('Select editor type'),
      title: l10n.t('Add Editor ({0}/{1})', '1', '3')
    });

    if (!typeChoice) { return; }

    let editorConfig: EditorConfig;

    if (typeChoice.label.includes('JetBrains')) {
      const presetItems = JETBRAINS_PRESETS.map(preset => ({
        label: preset.name,
        description: preset.urlScheme,
        preset
      }));

      const presetChoice = await vscode.window.showQuickPick(presetItems, {
        placeHolder: l10n.t('Select JetBrains IDE'),
        title: l10n.t('Add Editor ({0}/{1})', '2', '3')
      });

      if (!presetChoice) { return; }

      const path = await this.selectEditorPath(presetChoice.preset.name);
      if (!path) { return; }

      editorConfig = { ...presetChoice.preset, path };
    } else {
      const name = await vscode.window.showInputBox({
        prompt: l10n.t('Enter editor name'),
        placeHolder: l10n.t('e.g. Sublime Text'),
        title: l10n.t('Add Editor ({0}/{1})', '2', '4')
      });

      if (!name) { return; }

      const path = await this.selectEditorPath(name);
      if (!path) { return; }

      const urlScheme = await vscode.window.showInputBox({
        prompt: l10n.t('macOS URL Scheme (optional, leave empty to skip)'),
        placeHolder: l10n.t('e.g. subl'),
        title: l10n.t('Add Editor ({0}/{1})', '4', '4')
      });

      editorConfig = {
        name,
        type: 'custom' as EditorType,
        path,
        urlScheme: urlScheme || undefined
      };
    }

    await this.saveEditor(editorConfig);
    vscode.window.showInformationMessage(l10n.t('Editor added: {0}', editorConfig.name));
  }

  private async selectEditorPath(editorName: string): Promise<string | undefined> {
    const options: vscode.QuickPickItem[] = [
      { label: `$(folder-opened) ${l10n.t('Browse...')}`, description: l10n.t('Open file picker') },
      { label: `$(edit) ${l10n.t('Enter path manually')}`, description: l10n.t('Type path directly') },
    ];

    const choice = await vscode.window.showQuickPick(options, {
      placeHolder: l10n.t('Select {0} path', editorName),
      title: l10n.t('Add Editor ({0}/{1})', '3', '3')
    });

    if (!choice) { return undefined; }

    if (choice.label.includes('$(folder-opened)')) {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: false,
        title: l10n.t('Select {0} path to open', editorName),
        openLabel: l10n.t('Select')
      });
      return uris?.[0]?.fsPath;
    } else {
      return vscode.window.showInputBox({
        prompt: l10n.t('Enter editor path'),
        placeHolder: l10n.t('/Applications/WebStorm.app or C:\\Program Files\\...'),
        title: l10n.t('Add Editor')
      });
    }
  }

  async editEditor(item: EditorTreeItem): Promise<void> {
    const editor = item.editor;
    
    const fieldItems: vscode.QuickPickItem[] = [
      { label: l10n.t('Name'), description: editor.name },
      { label: l10n.t('Path'), description: editor.path || l10n.t('Auto detect') },
      { label: l10n.t('URL Scheme'), description: editor.urlScheme || l10n.t('None') },
    ];

    const fieldChoice = await vscode.window.showQuickPick(fieldItems, {
      placeHolder: l10n.t('Select field to edit'),
      title: l10n.t('Edit {0}', editor.name)
    });

    if (!fieldChoice) { return; }

    let newValue: string | undefined;

    switch (fieldChoice.label) {
      case l10n.t('Name'):
        newValue = await vscode.window.showInputBox({
          prompt: l10n.t('Enter new name'),
          value: editor.name
        });
        if (newValue) { editor.name = newValue; }
        break;

      case l10n.t('Path'):
        newValue = await this.selectEditorPath(editor.name);
        if (newValue) { editor.path = newValue; }
        break;

      case l10n.t('URL Scheme'):
        newValue = await vscode.window.showInputBox({
          prompt: l10n.t('Enter URL Scheme (leave empty to clear)'),
          value: editor.urlScheme || ''
        });
        editor.urlScheme = newValue || undefined;
        break;
    }

    if (newValue !== undefined) {
      await this.updateEditor(item.index, editor);
      vscode.window.showInformationMessage(l10n.t('Editor updated: {0}', editor.name));
    }
  }

  async deleteEditor(item: EditorTreeItem): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      l10n.t('Are you sure you want to delete "{0}"?', item.editor.name),
      { modal: true },
      l10n.t('Delete')
    );

    if (confirm === l10n.t('Delete')) {
      await this.removeEditor(item.index);
      vscode.window.showInformationMessage(l10n.t('Editor deleted: {0}', item.editor.name));
    }
  }

  async openJsonConfig(): Promise<void> {
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      'switch2idea.editors'
    );
  }

  private async saveEditor(editor: EditorConfig): Promise<void> {
    const config = vscode.workspace.getConfiguration('switch2idea');
    const editors = config.get<EditorConfig[]>('editors') || [];
    editors.push(editor);
    await config.update('editors', editors, vscode.ConfigurationTarget.Global);
    this.treeDataProvider.refresh();
  }

  private async updateEditor(index: number, editor: EditorConfig): Promise<void> {
    const config = vscode.workspace.getConfiguration('switch2idea');
    const editors = config.get<EditorConfig[]>('editors') || [];
    editors[index] = editor;
    await config.update('editors', editors, vscode.ConfigurationTarget.Global);
    this.treeDataProvider.refresh();
  }

  private async removeEditor(index: number): Promise<void> {
    const config = vscode.workspace.getConfiguration('switch2idea');
    const editors = config.get<EditorConfig[]>('editors') || [];
    editors.splice(index, 1);
    await config.update('editors', editors, vscode.ConfigurationTarget.Global);
    this.treeDataProvider.refresh();
  }
}
