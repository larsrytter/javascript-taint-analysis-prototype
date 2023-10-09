import * as vscode from 'vscode';
import { VariableModel } from '../model/variable-model';
import { NotificationService } from './notification-service';

export type SanitizerType = 'HTMLSanitized' | 'JsSanitized' | 'UrlSanitized';

export class SanitizerService {

    private _notificationService: NotificationService;

    private _configForHtmlSanitizer: string = 'conf.settingsEditor.sanitizerPatterns.HTML';
    private _configForUrlSanitizer: string = 'conf.settingsEditor.sanitizerPatterns.Url';
    private _configForJsSanitizer: string = 'conf.settingsEditor.sanitizerPatterns.Javascript';

    constructor(notificationService: NotificationService) {
        this._notificationService = notificationService;
    }

    private _addSanitizedStatus(variable: VariableModel, sanitizerType: SanitizerType): void {
        if (!variable.sanitizersApplied.some(s => s === sanitizerType)) {
            variable.sanitizersApplied.push(sanitizerType);
        }
    }

    public updateVariableSanitizedStatus(variable: VariableModel, expression: string) {
        // TODO: expression might not be a string type
        if (this._isExpressionASanitizerForHtml(expression)) {
            // variable.sanitized.htmlSanitized = true;
            this._addSanitizedStatus(variable, 'HTMLSanitized');
            this._notificationService.showMessage(`Variable ${variable.variableName} was sanitized for HTML.`);
        }
        if(this._isExpressionASanitizerForUrl(expression)) {
            // variable.sanitized.urlSanitized = true;
            this._addSanitizedStatus(variable, 'UrlSanitized');
            this._notificationService.showMessage(`Variable ${variable.variableName} was sanitized for URL.`);
        }
        if(this._isExpressionASanitizerForJavascript(expression)) {
            // variable.sanitized.jsSanitized = true;
            this._addSanitizedStatus(variable, 'JsSanitized');
            this._notificationService.showMessage(`Variable ${variable.variableName} was sanitized for JS.`);
        }
    }

    /**
     * Detect if the input-expression is recognized as a sanitizer for HTML-context
     * @param input 
     * @returns 
     */
    private _isExpressionASanitizerForHtml(input: string): boolean {

        const sanitizerPatternsConfig = vscode.workspace.getConfiguration().get(this._configForHtmlSanitizer) as string;
        let isSanitizer = this._isExpressionASanitizer(input, sanitizerPatternsConfig);
        return isSanitizer;
    }

    /**
     * 
     * @param input Detect if the input expression is a recognized sanitizer for URL-context
     */
    private _isExpressionASanitizerForUrl(input: string): boolean {
        const sanitizerPatternsConfig = vscode.workspace.getConfiguration().get(this._configForUrlSanitizer) as string;
        let isSanitizer = this._isExpressionASanitizer(input, sanitizerPatternsConfig);
        return isSanitizer;
    }

    /**
     * 
     * @param input Detect if the input expression is a recognized sanitizer for Javascript-context
     */
    private _isExpressionASanitizerForJavascript(input: string): boolean {
        const sanitizerPatternsConfig = vscode.workspace.getConfiguration().get(this._configForJsSanitizer) as string;
        let isSanitizer = this._isExpressionASanitizer(input, sanitizerPatternsConfig);
        return isSanitizer;
    }

    private _isExpressionASanitizer(input: string, sanitizerPatternsConfig: string) {
        let isSanitizer = false;
        // const sanitizerPatternsConfig = vscode.workspace.getConfiguration().get(this._configForHtmlSanitizer) as string;

        if (sanitizerPatternsConfig) {
            const sanitizerPatterns = sanitizerPatternsConfig.split(/\r?\n/);
            // TODO: Better pattern-check...
            isSanitizer = sanitizerPatterns.some((pattern: string) => input.startsWith(pattern));
        }

        return isSanitizer;
    }
}
