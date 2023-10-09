// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as parser from '@babel/parser';
import { JSDOM } from 'jsdom';
import { ParseResult } from '@babel/parser';
import * as _babel_types from '@babel/types';
import { CodeLineReader } from './taint-analysis/service/code-line-reader';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	let disposable = vscode.commands.registerCommand('lars-javascript-codeanalyzer.analyzeCode', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			if (document.languageId === 'typescript' || document.languageId === 'javascript') {
				const code = document.getText();
				const ast = parser.parse(code, {
					// sourceType: 'module', // or 'script' if using plain JavaScript
					sourceType: 'script', // or 'script' if using plain JavaScript
					plugins: ['jsx', 'typescript'],
				});
				console.log('Got a script file', ast);
				vscode.window.showInformationMessage('It looks like you opened a script-file. Make sure to open the HTML file.');
			} else if(document.languageId === 'html') {
				const code = document.getText();
				const dom = new JSDOM(code);
				
				const scriptCollection = dom.window.document.scripts;
				const scriptArray = Array.from(scriptCollection);
				let scriptString = '';

				// Load scripts from script-tags
				scriptString = await _loadCodeFromScriptElements(scriptArray, document);

				if (scriptString) {
					const codeLineReader = new CodeLineReader(dom);
					const ast: ParseResult<_babel_types.File> = _parseCodetoAst(scriptString, 'script');
					console.log('Script from html file', ast);
					codeLineReader.readProgramAst(ast);
				} else {
					console.warn('No scripts to load');
				}
				
			} else {
				vscode.window.showInformationMessage('Please open a TypeScript or JavaScript file.');
			}
		} else {
			vscode.window.showInformationMessage('No active editor found.');
		}

	});
	context.subscriptions.push(disposable);
}

async function _loadCodeFromScriptElements(scriptElements: HTMLScriptElement[], document: vscode.TextDocument) {
	let scriptString = '';

	for (let scriptElement of scriptElements) {
		const folderPath = document.fileName.substring(0, document.fileName.lastIndexOf('\\'));

		const scriptUri = `${folderPath}/${scriptElement.src}`;
		const scriptContent = await _readFileContent(scriptUri);

		scriptString += `${scriptContent}\r\n`;

		// TODO: Load inline-scripts
	}
	return scriptString;
}

async function _readFileContent(uri: string): Promise<string> {
	const doc = await vscode.workspace.openTextDocument(uri)
	return doc.getText();
}

const _parseCodetoAst = (code: string, sourceType: 'module'|'script'|'unambiguous') => {
	const ast: ParseResult<_babel_types.File> = parser.parse(code, {
		sourceType: sourceType, // or 'script' if using plain JavaScript
		plugins: ['jsx', 'typescript'],
	});
	return ast;
}



// This method is called when your extension is deactivated
export function deactivate() {}
