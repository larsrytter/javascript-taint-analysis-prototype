import * as vscode from 'vscode';
import { ParseResult } from '@babel/parser';
import * as babelParser from '@babel/parser';
import * as _babel_types from '@babel/types';
import { VariableModel } from '../model/variable-model';
import { NotificationService } from './notification-service';
import { FunctionModel } from '../model/function-model';
import { JSDOM } from 'jsdom';
import { CodePreAnalyzer } from './code-pre-analyzer';
import { EventModel } from './event-model';
import { SinkService } from './sink-service';
import { SanitizerService } from './sanitizer-service';
import { DomService } from './dom-service';

export class CodeLineReader {

    private _variables: VariableModel[] = [];
    private _functions: FunctionModel[] = [];
    private _jsDom: JSDOM;
    private _programAst!: ParseResult<_babel_types.File>;
    private _preAnalyzer: CodePreAnalyzer;
    private _domService: DomService;
    private _sinkService: SinkService;
    private _sanitizerService: SanitizerService;
    private _notificationService: NotificationService;

    constructor(jsDom: JSDOM) {
        this._jsDom = jsDom;
        this._preAnalyzer = new CodePreAnalyzer();
        this._notificationService = new NotificationService();
        this._sinkService = new SinkService(this._notificationService);
        this._sanitizerService = new SanitizerService(this._notificationService);
        this._domService = new DomService(jsDom);
    }

    public readProgramAst(programAst: ParseResult<_babel_types.File>): void {
        this._notificationService.showMessage('Starting taint analysis.');
        this._programAst = programAst;
        if (programAst.program) {
            this._functions = this._preAnalyzer.readProgramAst(programAst);

            this._readProgram(programAst.program);

            this.analyzeEvents();
            
        } else {
            console.warn('No program found.');
            this._notificationService.showMessage('No program-code found to analyze.');
        }
        this._notificationService.showMessage('Taint analysis done.');
    }

    public analyzeEvents(): void {
        
        const eventListeners: EventModel[] = this._domService.getAllDomEventListeners();
        this._notificationService.showMessage(`Number of event-listeners in DOM: ${eventListeners.length}`);

        const documentOnLoad = eventListeners.find(e => e.name === 'onload' && e.node.tagName === 'BODY');

        if (documentOnLoad) {
            this._notificationService.showMessage('Analyzing document.onLoad event handler');
            this._analyzeDomEventHandler(documentOnLoad);
        }

        const otherEvents = eventListeners.filter(e => e.name !== 'onload');
        otherEvents.forEach(eventModel => {
            this._analyzeDomEventHandler(eventModel);
        });
        // const reversed = otherEvents.reverse();
        // reversed.forEach(eventModel => {
        //     this._analyzeDomEventHandler(eventModel);
        // });
    }

    private _analyzeDomEventHandler(eventModel: EventModel) {
        const eventCode = babelParser.parseExpression(eventModel.value);
        if (eventCode.type === 'CallExpression'
            && eventCode.callee.type == 'Identifier') {
            const callee = eventCode.callee as _babel_types.Identifier;
            const functionModel = this._functions.find(f => f.functionName === callee.name);
            if (functionModel) {
                this._readFunction(functionModel.function);
            }                
        }
    }
    
    private _readProgram(program: _babel_types.Program): void {
        if (program.body && program.body.length > 0) {
            program.body.forEach((statement: _babel_types.Statement) => {
                this._readLine(statement);
            });
        } else {
            console.log('Program body is empty');
        }
    }

    // TODO: Consider adding parent-statement/parentContext as argument for scope info
    private _readLine(statement: _babel_types.Statement): void {
        
        if (statement.type === 'VariableDeclaration') {
            const variables: VariableModel[] = this._handleVariableDeclaration(statement);
            variables.forEach(variable => this._variables.push(variable));
        } else if (statement.type === 'IfStatement') {
            this._handleIfStatement(statement);
        } else if (statement.type === 'WhileStatement') {
            this._handleWhileStatement(statement);
        } else if (statement.type === 'ExpressionStatement') {
            this._handleExpressionStatement(statement);
        } else if (statement.type === 'FunctionDeclaration') {
            this._functions.push({
                function: statement, 
                functionName: statement.id?.name
            })
        } else {
            // TODO: Something else - handle

        }

    }

    private _readFunction(functionDeclaration: _babel_types.FunctionDeclaration) {
        functionDeclaration.body.body.forEach(line => {
            this._readLine(line);
        });
    }

    private _handleExpressionStatement(statement: _babel_types.ExpressionStatement): void {
        //
        if (statement.expression.type === 'UpdateExpression') {
            // TODO: Ensure I dont need to do anything here - I probably don't
            // Statement like count++
        } else if (statement.expression.type === 'CallExpression') {
            const tmpCallee = statement.expression.callee as _babel_types.MemberExpression;
            const tmpCalleeObject = tmpCallee.object as _babel_types.Identifier;
            const functionArguments = statement.expression.arguments;
            const calleeVariableModel: VariableModel|undefined = this._variables.find(v => v.variableName == tmpCalleeObject.name);
            if (calleeVariableModel) {
                const argumentVariables: VariableModel[] = [];
                functionArguments.forEach((argExp) => {
                    const argAsIdentifer = argExp as _babel_types.Identifier;
                    const variableModel = this._variables.find(v => v.variableName === argAsIdentifer.name);
                    if (variableModel) argumentVariables.push(variableModel);
                });
                const taintedVarsPassed = this._sinkService
                                            .checkForSinkOnCallExpression(calleeVariableModel, tmpCallee, argumentVariables);
                if (taintedVarsPassed) {
                    argumentVariables.forEach(taintedVar => {
                        this._notificationService.showTaintedOutputInfo(taintedVar, statement.loc?.start.line as number);
                    })
                    
                }
                // this._sanitizerService.updateVariableSanitizedStatus()
            }
        } else if (statement.expression.type === 'AssignmentExpression') {

            let updatedVariable: VariableModel;
            let taintedVar: VariableModel|null = null;

            if (statement.expression.left.type === 'Identifier') {
                const leftSide = statement.expression.left as _babel_types.Identifier;
                updatedVariable = this._variables.find(v => v.variableName === leftSide.name)!; 
            } else if (statement.expression.left.type === 'MemberExpression'
                    && statement.expression.left.object.type === 'Identifier') {
                const varName = statement.expression.left.object.name;
                updatedVariable = this._variables.find(v => v.variableName === varName)!; 
            } else {
                // TODO: 
                throw new Error('Not implemented');
            }

            const rightSide = statement.expression.right;
            switch (rightSide.type) {
                case 'BinaryExpression': {
                    // Eg. 'some text' + someValue
                    const expressionLeft = rightSide.left;
                    const expressionRight = rightSide.right;
                }
                case 'TemplateLiteral': {
                    const template = rightSide as _babel_types.TemplateLiteral;
                    const expressions = template.expressions;
                    expressions.forEach(exp => {
                        if (exp.type === 'Identifier') {
                            const rightSideVar = this._variables.find(v => v.variableName === exp.name);
                            if (rightSideVar && rightSideVar.status === 'tainted') {
                                taintedVar = rightSideVar;
                            }
                        }
                    });
                    break;
                }
                case 'Identifier': {
                    const variableName = (rightSide as _babel_types.Identifier).name;
                    const rightSideVar = this._variables.find(v => v.variableName === variableName);
                                        
                    if (rightSideVar && rightSideVar.status === 'tainted') {
                        taintedVar = rightSideVar;
                    }
                    break;
                }
                case 'CallExpression': {
                    const functionCalled = rightSide.callee;
                    const functionArguments = rightSide.arguments;
                    if (updatedVariable){
                        this._sanitizerService.updateVariableSanitizedStatus(updatedVariable, `${(functionCalled as any).name}(`)
                    }
                    break;
                }
                default: {

                    break;
                }
            }

            // Find affected variable in this._variables
            let variableName: string;
            if (statement.expression.left.type === 'Identifier') {
                // Assignment to variable

                const leftSide = statement.expression.left as _babel_types.Identifier;
                variableName = leftSide.name;

                // TODO: Needs refactoring - this does not take sanitization into account.
                if (updatedVariable && taintedVar != null) {
                    updatedVariable.status = 'tainted';
                    // Update sanitized status
                    updatedVariable.sanitizersApplied = updatedVariable
                                                        .sanitizersApplied
                                                        .filter(s => taintedVar?.sanitizersApplied.includes(s));
                    
                    this._notificationService.showMessage(`Variable ${variableName} is tainted by ${taintedVar?.variableName} on line ${statement.loc?.start.line}.`);
                }

            } else if (statement.expression.left.type === 'MemberExpression'
                    && statement.expression.left.object.type === 'Identifier'
                    && taintedVar) {
                // Assignment to object
                
                const isCleanOrSanitized = this._sinkService.isVariableCleanOrSanitizedForSinkType(updatedVariable!, statement.expression.left.property, taintedVar);
                if (!isCleanOrSanitized) {
                    this._notificationService.showTaintedOutputInfo(updatedVariable, statement.loc?.start.line as number);
                }
                
            }

        } else {
            // TODO: Other options??
        }

    }

    private _handleIfStatement(statement: _babel_types.IfStatement): void {
        // Handle if comparisson
        // statement.test
        
        const consequentBlock: _babel_types.BlockStatement = statement.consequent as _babel_types.BlockStatement;
        consequentBlock.body.forEach(statement => {
            this._readLine(statement);
        });

        if (statement.alternate && statement.alternate.type === 'BlockStatement') {
            statement.alternate.body.forEach(statement => {
                this._readLine(statement);
            });
        }
    }

    private _handleWhileStatement (statement: _babel_types.WhileStatement): void {
        // Handle test
        // statement.test
        const bodyBlock: _babel_types.BlockStatement = statement.body as _babel_types.BlockStatement;
        bodyBlock.body.forEach(line => {
            this._readLine(line);
        });

    }

    private _handleVariableDeclaration(statement: _babel_types.VariableDeclaration): VariableModel[] {
        const varsDeclared: VariableModel[] = [];
        statement.declarations.forEach((declaration: _babel_types.VariableDeclarator) => {
            const variableName = (declaration.id as _babel_types.Identifier).name;
            let isTainted = false;
            let isBasedOnDocument = false;
            let isDomElement = false;
            if (declaration.init) {
                if (declaration.init.type === 'CallExpression') {
                    const sourceType: SourceType = this._getExpressionInfo(declaration.init);
                    isTainted = sourceType.isTainted;
                    isBasedOnDocument = sourceType.isBasedOnDocument;
                    isDomElement = sourceType.isDOMElementReturned;
                    // TODO: Enrich variable with info about document or DOMElement??
                } else if(declaration.init.type === 'MemberExpression') {
                    // TODO: Check object and property for sinks and tainted variables 
                    const memberExpressionInfo = this._analyzeMemberExpression(declaration.init);
                    isTainted = memberExpressionInfo.isTainted;
                    isBasedOnDocument = memberExpressionInfo.isBasedOnDocument;
                    isDomElement = memberExpressionInfo.isDOMElementReturned;
                } else if (declaration.init.type === 'StringLiteral') {
                    // Should be safe - no updates needed
                } else if (declaration.init.type === 'BinaryExpression') {
                    const taintedExpVariables = this._analyzeBinaryExpression(declaration.init);
                    if (taintedExpVariables.length > 0) {
                        isTainted = true;
                    }
                }
            }
            
            const declaredVariable: VariableModel = {
                variableName: variableName,
                status: isTainted ? 'tainted' : 'clean',
                isDomElement: isDomElement,
                sanitizersApplied: []
            };
            varsDeclared.push(declaredVariable);
            if (declaredVariable.status === 'tainted') {
                this._notificationService.showMessage(`Variable ${declaredVariable.variableName} was tainted on line ${statement.loc?.start.line as number}.`);
            }
        });
        return varsDeclared;
    }

    private _analyzeBinaryExpression(expression: _babel_types.BinaryExpression): VariableModel[] {
        let taintedVars: VariableModel[] = [];
        if (expression.left.type === 'BinaryExpression') {
            const leftTaintedVars = this._analyzeBinaryExpression(expression.left);
            taintedVars = taintedVars.concat(leftTaintedVars);
        } else if(expression.left.type === 'Identifier') {
            const tmpExp = expression.left as _babel_types.Identifier;
            let variableModel = this._variables.find(v => v.variableName === tmpExp.name && v.status === 'tainted');
            if(variableModel) {
                taintedVars.push(variableModel);
            }
        }
        
        if (expression.right.type === 'Identifier') {
            const tmpExp = expression.right as _babel_types.Identifier;
            let variableModel = this._variables.find(v => v.variableName === tmpExp.name && v.status === 'tainted');
            if(variableModel) {
                taintedVars.push(variableModel);
            }
        }
        // StringLiterals and numberLiterals etc should be safe. No action needed
        // TODO: MemberExpressions?

        return taintedVars;
    }

    private _analyzeMemberExpression(memberExp: _babel_types.MemberExpression, parentObjectPath?: string): SourceType {
        let isTainted = false;
        let isBasedOnDocument = false;
        let isDomElement = false;
        const documentPatterns = this._getDocumentPatterns();
        const taintedSourcePatterns = this._getTaintedSourcePatterns();
        
        if (memberExp.object.type === 'Identifier'
            && documentPatterns.some(p => p === (memberExp.object as _babel_types.Identifier).name)) {
            isBasedOnDocument = true;
        } else if(memberExp.object.type === 'Identifier') {
            const variableName = memberExp.object.name;
            const variable = this._variables.find(v => v.variableName === variableName);
            if (variable) {
                isBasedOnDocument = variable.isDomElement;
                isTainted = variable.status === 'tainted';
                // TODO: AppliedSanitizers...
            }
        } else if (memberExp.object.type === 'MemberExpression') {            
            const objExp = this._analyzeMemberExpression(memberExp.object, parentObjectPath);
            isTainted = objExp.isTainted;
            isBasedOnDocument = objExp.isBasedOnDocument;
            // Probably not set isDomElement based on this...
        } else {
            console.log('Did not catch member of type ' + memberExp.object.type);
        }

        if (isBasedOnDocument 
            && memberExp.property 
            && memberExp.property.type === 'Identifier') {
            const propName = memberExp.property.name;
            const propReturningDomElements = this._getDomElementReturnPatterns();
            isDomElement = propReturningDomElements.some(x => x === propName);
            const objName = (memberExp.object as _babel_types.Identifier).name;
            let objectProperty = `${objName}.${propName}`;
            if (parentObjectPath) {
                objectProperty = `${parentObjectPath}.${objectProperty}`;
            }
            isTainted = isTainted || taintedSourcePatterns.some(p => objectProperty.indexOf(p) !== -1);
        }

        const sourceType: SourceType = {
            isBasedOnDocument: isBasedOnDocument,
            isDOMElementReturned: isDomElement,
            isTainted: isTainted,
            expression: memberExp
        }
        return sourceType;
    }

    private _getExpressionInfo(expression: _babel_types.CallExpression): SourceType {
        const callee = expression.callee as _babel_types.MemberExpression;

        let memberExpressionInfo: SourceType = this._analyzeMemberExpression(callee);

        const sourceType: SourceType = {
            isBasedOnDocument: memberExpressionInfo.isBasedOnDocument,
            isDOMElementReturned: memberExpressionInfo.isDOMElementReturned,
            isTainted: memberExpressionInfo.isTainted,
            expression: expression
        }
        return sourceType;
    }

    private _getDocumentPatterns(): string[] {
        const patterns: string[] = [
            'document',
            'window.document'
        ];
        return patterns;
    }

    private _getTaintedSourcePatterns(): string[] {
        const patterns: string[] = [
            'document.location',
            'location.href',
            'location.hash',
            'value'
        ];
        return patterns;
    }

    private _getDomElementReturnPatterns(): string[] {
        const patterns: string[] = [
            'getElementById',
            'createElement'
        ];
        return patterns;
    }
}

// TODO: Source-context??
interface SourceType {
    isBasedOnDocument: boolean;
    isDOMElementReturned: boolean;
    isTainted: boolean;
    expression: _babel_types.CallExpression | _babel_types.MemberExpression;
}
