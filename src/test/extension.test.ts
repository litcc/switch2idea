import * as assert from 'assert';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

suite('Switch2IDEA Extension Test Suite', () => {
	// 在所有测试开始前激活扩展
	suiteSetup(async () => {
		// 等待扩展激活
		const extension = vscode.extensions.getExtension('qczone.switch2idea');
		if (extension) {
			if (!extension.isActive) {
				await extension.activate();
			}
		}
	});

	test('Extension should be present', async () => {
		// 获取扩展并等待激活
		const extension = vscode.extensions.getExtension('qczone.switch2idea');
		assert.ok(extension, 'Extension should be installed');
		
		if (!extension.isActive) {
			await extension.activate();
		}
		assert.ok(extension.isActive, 'Extension should be activated');
	});

	test('Should register openFileInIDEA command', () => {
		const commands = vscode.commands.getCommands(true);
		return commands.then((cmds) => {
			assert.ok(cmds.includes('Switch2IDEA.openFileInIDEA'), 'openFileInIDEA command should be registered');
		});
	});

	test('Should register openProjectInIDEA command', () => {
		const commands = vscode.commands.getCommands(true);
		return commands.then((cmds) => {
			assert.ok(cmds.includes('Switch2IDEA.openProjectInIDEA'), 'openProjectInIDEA command should be registered');
		});
	});

	test('Should have correct configuration', () => {
		const config = vscode.workspace.getConfiguration('switch2idea');
		assert.ok(config.has('ideaPath'), 'Configuration should have ideaPath setting');
	});

	test('Should handle file path with spaces and special characters', async () => {
		// Create a temporary file for testing
		const tmpDir = os.tmpdir();
		const testFileName = 'test file with spaces!.txt';
		const testFilePath = path.join(tmpDir, testFileName);
		
		try {
			// Create test file
			fs.writeFileSync(testFilePath, 'test content');

			// Open file
			const doc = await vscode.workspace.openTextDocument(testFilePath);
			const editor = await vscode.window.showTextDocument(doc);

			// Execute command - use the correct command name
			await vscode.commands.executeCommand('Switch2IDEA.openFileInIDEA');

			// Verify command execution completed without errors
			// Note: We cannot verify if IDEA actually opened the file as it's an external process
			assert.ok(true);
		} finally {
			// Cleanup test file
			try {
				fs.unlinkSync(testFilePath);
			} catch (e) {
				console.error('Failed to cleanup test file:', e);
			}
		}
	});

	test('Should handle editor selection', async () => {
		// Create a temporary file
		const tmpDir = os.tmpdir();
		const testFilePath = path.join(tmpDir, 'test.txt');
		
		try {
			// Create multi-line test file
			const content = 'line1\nline2\nline3\nline4\n';
			fs.writeFileSync(testFilePath, content);

			// Open file and set cursor position
			const doc = await vscode.workspace.openTextDocument(testFilePath);
			const editor = await vscode.window.showTextDocument(doc);
			
			// Move cursor to line 3, column 2
			const position = new vscode.Position(2, 1);
			editor.selection = new vscode.Selection(position, position);

			// Execute command - use the correct command name
			await vscode.commands.executeCommand('Switch2IDEA.openFileInIDEA');

			// Verify command execution completed without errors
			assert.ok(true);
		} finally {
			// Cleanup test file
			try {
				fs.unlinkSync(testFilePath);
			} catch (e) {
				console.error('Failed to cleanup test file:', e);
			}
		}
	});

	test('Should handle non-existent ideaPath gracefully', async () => {
		// Temporarily set a non-existent ideaPath
		const config = vscode.workspace.getConfiguration('switch2idea');
		const originalPath = config.get('ideaPath');
		
		try {
			await config.update('ideaPath', 'non-existent-path', vscode.ConfigurationTarget.Global);
			
			// Execute command - use the correct command name
			await vscode.commands.executeCommand('Switch2IDEA.openFileInIDEA');
			
			// Command should complete without crashing
			assert.ok(true);
		} finally {
			// Restore original settings
			await config.update('ideaPath', originalPath, vscode.ConfigurationTarget.Global);
		}
	});
});
