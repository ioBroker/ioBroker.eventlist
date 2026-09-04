import type { VisRxWidgetState } from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

/**
 * Base class of the eventlist widgets.
 *
 * `window.visRxWidget` is provided by the vis-2 runtime; it must not be imported, otherwise the
 * widget would carry its own copy of the base class and vis would not recognise it.
 */
export default class Generic<
    RxData extends Record<string, any>,
    State extends Partial<VisRxWidgetState> = VisRxWidgetState,
> extends (window.visRxWidget as typeof VisRxWidget)<RxData, State> {
    /** Prepended to every i18n key of these widgets, see `translations.ts` */
    static getI18nPrefix(): string {
        return 'eventlist_';
    }

    /** The instance the widget is bound to. The field is short, so it holds `0` and not `eventlist.0`. */
    getInstance(): number {
        return parseInt((this.state.rxData as { instance?: string | number }).instance as string, 10) || 0;
    }

    /** `eventlist.<instance>.<name>` */
    getStateId(name: string): string {
        return `eventlist.${this.getInstance()}.${name}`;
    }
}
