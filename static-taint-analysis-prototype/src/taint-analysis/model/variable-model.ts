import { SanitizerType } from '../service/sanitizer-service';

export interface VariableModel {
    variableName: string;
    status: 'clean'|'tainted';
    isDomElement: boolean;
    //TODO: Taint-source?
    sanitizersApplied: SanitizerType[];
}

