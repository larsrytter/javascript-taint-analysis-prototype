import { JSDOM } from 'jsdom';
import { EventModel } from './event-model';

export class DomService {

    private _jsDom: JSDOM;

    constructor(jsDom: JSDOM) {
        this._jsDom = jsDom;
    }

    public getAllDomEventListeners(): EventModel[] {
        const events: EventModel[] = [];

        const allElements = Array.prototype.slice.call(this._jsDom.window.document.querySelectorAll('*'));
        allElements.push(this._jsDom.window.document);
        allElements.push(this._jsDom.window);

        const types: any = [];

        for (let ev in this._jsDom.window) {
            if (ev.startsWith('on')) types[types.length] = ev;
        }
        
        allElements.forEach(currentElement => {
            if (currentElement.attributes && currentElement.attributes.length > 0) {
                for (let i = 0; i < currentElement.attributes.length; i++) {
                    let attrElem = currentElement.attributes[i];
                    if (attrElem.name.startsWith('on')) {
                        events.push({
                            name: attrElem.name,
                            node: currentElement,
                            type: '',
                            value: attrElem.value
                        });
                    }
                }
            }
        });

        return events;
    }
}