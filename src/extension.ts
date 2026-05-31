import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "copilot-custom-bridge" is now active!');

	const disposable = vscode.commands.registerCommand('copilot-custom-bridge.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Copilot Custom Bridge!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
