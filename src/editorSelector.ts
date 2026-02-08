import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { EditorConfig } from './types';

/**
 * 编辑器选择器
 * 负责显示 QuickPick 让用户选择目标编辑器
 */
export class EditorSelector {
  async selectEditor(editors: EditorConfig[]): Promise<EditorConfig | undefined> {
    if (editors.length === 1) {
      return editors[0];
    }

    const items: vscode.QuickPickItem[] = editors.map(editor => ({
      label: editor.name,
      description: `(${editor.type})`,
      detail: editor.path || l10n.t('Use default path')
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: l10n.t('Select editor to jump to'),
      title: l10n.t('Jump to...')
    });

    if (!selected) {
      return undefined;
    }

    return editors.find(e => e.name === selected.label);
  }
}
