import { ParseResult } from '@babel/parser';
import { FunctionModel } from '../model/function-model';
import * as _babel_types from '@babel/types';

export class CodePreAnalyzer {
    private _functions: FunctionModel[] = [];

    public readProgramAst(programAst: ParseResult<_babel_types.File>): FunctionModel[] {
        if (programAst.program) {
            programAst.program.body.forEach(line => {
                this._readLine(line);
            });
        }
        return this._functions;
    }

    private _readLine(statement: _babel_types.Statement, parentContext?: _babel_types.FunctionDeclaration | _babel_types.FunctionParent): void {
        if (statement.type === 'FunctionDeclaration') {
            const functionModel: FunctionModel = {
                functionName: statement.id?.name,
                function: statement,
                parent: parentContext
            };
            this._functions.push(functionModel);

            if (statement?.body.body) {
                statement.body.body.forEach(functionLine => {
                    this._readLine(functionLine, statement);
                });
            }
        }
    }
}