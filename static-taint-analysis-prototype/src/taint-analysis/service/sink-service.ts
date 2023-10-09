import * as _babel_types from '@babel/types';
import { VariableModel } from '../model/variable-model';
import { SanitizerService, SanitizerType } from './sanitizer-service';
import { NotificationService } from './notification-service';

export class SinkService {
    private _notificationService: NotificationService;
    private _sanitizerService: SanitizerService;
    private _htmlSinkPropertyNames: string[] = ['innerHTML', 'outerHTML']; // TODO: Other sinks
    private _javascriptSinkPropertyNames: string[] = ['eval', 'setTimeout'];
    
    private _renderingContexts: RenderingContext[] = [];

    private _htmlSinkMethodPatterns: { [pattern:string]: RenderingContextType } = {
        'addEventListener': 'EventHandler',
        'setAttributes': 'Attribute'
    }

    constructor(notificationService: NotificationService) {
        this._notificationService = notificationService;
        this._setupRenderingContexts();
        this._sanitizerService = new SanitizerService(notificationService);
    }

    public checkForSinkOnCallExpression(calleeVariable: VariableModel, calleeExpression: _babel_types.MemberExpression, functionArguments: VariableModel[]): VariableModel[] {
        // TODO: Does not handle deeply nested object-property-chains
        const taintedVarsPassed: VariableModel[] = [];
        const propCalled = calleeExpression.property as _babel_types.Identifier;
        const renderingContextType: RenderingContextType = this._htmlSinkMethodPatterns[propCalled.name];
        if (calleeVariable.isDomElement && renderingContextType) {
            const renderingContext: RenderingContext = this._renderingContexts.find(x => x.contextType === renderingContextType)!;
            if (renderingContext) {
                functionArguments.filter(arg => arg.status === 'tainted').forEach(arg => {
                    const isSanitized = renderingContext.requiredSanitizers
                                                        .every(sr => arg.sanitizersApplied.some(sa => sa === sr));
                    if (!isSanitized) {
                        taintedVarsPassed.push(arg);
                    }
                });
            }
        }
        return taintedVarsPassed;
    }

    public isVariableCleanOrSanitizedForSinkType(updatedObject: VariableModel, destinationProperty: _babel_types.Expression | _babel_types.PrivateName, assignedVariable: VariableModel ): boolean {
        const sinkType: RenderingContextType = this._getSinkTypeOnUpdate(updatedObject, destinationProperty);

        if (assignedVariable.status === 'clean') {
            this._notificationService.showMessage(`Clean variable ${assignedVariable.variableName} sent to sink ${updatedObject.variableName}.${(destinationProperty as _babel_types.Identifier).name}`);
            return true;
        }
        let isSanitized = false

        const renderingContext: RenderingContext = this._renderingContexts.find(x => x.contextType === sinkType)!;
        if (renderingContext) {
            isSanitized = renderingContext.requiredSanitizers.every(sr => assignedVariable.sanitizersApplied.some(sa => sa === sr));

            const outputMsg = isSanitized ? 'OK - sanitized output.' : 'Warning unsanitized output!';
            this._notificationService
                .showMessage(`${outputMsg} Variable ${assignedVariable.variableName} is output to sink ${(destinationProperty as _babel_types.Identifier).name}`);
        } 
        return isSanitized;
    }

    private _getSinkTypeOnUpdate(updatedObject: VariableModel, property: _babel_types.Expression | _babel_types.PrivateName): RenderingContextType {
        if (updatedObject.isDomElement && property.type == 'Identifier' && this._htmlSinkPropertyNames.indexOf(property.name) !== -1) {
            // Updating DOM element .value attribute
            return 'HTMLElement';
        }
        // TODO: Checks for other sink-types
        // TODO: Consider pattern based check
        
        return 'None';
    }

    private _setupRenderingContexts(): void {
        this._renderingContexts = [
            {
                contextType: 'HTMLElement',
                requiredSanitizers: ['HTMLSanitized']
            }, 
            {
                contextType: 'Attribute',
                requiredSanitizers: ['HTMLSanitized']
            },
            {
                contextType: 'URL',
                requiredSanitizers: ['UrlSanitized','HTMLSanitized']
            },
            {
                contextType: 'EventHandler',
                requiredSanitizers: ['Uncleanable']
            },
            {
                contextType: 'JS',
                requiredSanitizers: ['Uncleanable']
            }
        ];
    }

    // DOMPurify.sanitize(dirty)
}

export interface RenderingContext {
    contextType: RenderingContextType;
    requiredSanitizers: (SanitizerType | 'Uncleanable')[];
}

export type RenderingContextType = 'None'|'HTMLElement'|'Attribute'|'EventHandler'|'URL'|'JS';