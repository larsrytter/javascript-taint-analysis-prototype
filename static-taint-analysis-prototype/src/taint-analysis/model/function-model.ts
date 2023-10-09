import * as _babel_types from '@babel/types';

export interface FunctionModel {
    functionName?: string;
    function: _babel_types.FunctionDeclaration;
    parent?: _babel_types.FunctionDeclaration | _babel_types.FunctionParent
}
