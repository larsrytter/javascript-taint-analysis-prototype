import { VariableModel } from '../model/variable-model';
import * as vscode from 'vscode';

export class NotificationService {
    private _channel: vscode.OutputChannel;
    private readonly channelName = 'taint-info';

    constructor() {
        this._channel = vscode.window.createOutputChannel(this.channelName);
        this._channel.show();
    }

    public showTaintedOutputInfo(variable: VariableModel, outputLine: number): void {
        this._channel.appendLine(`Passing tainted variable to sink: ${variable.variableName} on line ${outputLine}`);

        vscode.window.showInformationMessage('Unsanitized tainted variable in output. See taint-info in output-window for details.');
    }

    public showMessage(message: string): void {
        this._channel.appendLine(message);
    }
}
