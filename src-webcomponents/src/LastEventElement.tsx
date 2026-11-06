/**
 * The newest event as a web component: `<iob-eventlist-last-event>` - the web component of the devices widget "Last
 * event" (`src-devices/src/EventlistLastEventComponent.tsx`).
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`eventlist-last-event.json`, written by the build from `manifest.ts`), so a host loads this module only
 * when it shows the element. The host sets `socket` and `settings`, and if it has them `theme`, `editMode` and
 * `dialogs`.
 *
 * The element subscribes to one state, `eventlist.<n>.eventJSONList`, newest event first. The tile shows the newest
 * event of the filter; a click shows the list in an element dialog that the host frames. It writes nothing.
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import { createRoot, type Root } from 'react-dom/client';

import { defineWebComponent, IobWebComponent } from '@iobroker/web-components/element';

import { getIdFilter, getNamespace, getTag, limit, type LastEventSettings } from './constants';
import {
    eventCache,
    exactTime,
    filterEvents,
    formatValue,
    getIconUrl,
    getSampleEvents,
    type FormattedEvent,
} from './data';
import { createDialogContent } from './dialog';
import { getWords } from './i18n';
import { LAST_EVENT_STYLES } from './styles';
import { EventTable, Hint, Tile } from './views';

/** Rows of the list in the dialog when the setting is missing, as in the devices widget */
const DEFAULT_ROWS = 30;

class EventlistLastEvent extends IobWebComponent<LastEventSettings> {
    readonly #root: Root;

    readonly #events = eventCache();

    /** Draws the open dialog again; null while none is open */
    #drawDialog: (() => void) | null = null;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = LAST_EVENT_STYLES;
        const mount = document.createElement('div');
        mount.className = 'mount';
        shadow.append(style, mount);
        this.#root = createRoot(mount);
    }

    protected override getStateIds(settings: LastEventSettings): string[] {
        const namespace = getNamespace(settings.instance);
        return namespace ? [`${namespace}.eventJSONList`] : [];
    }

    /** The events of the filter, newest first; null while the list is read */
    #getEvents(namespace: string): FormattedEvent[] | null {
        const events = this.#events.get(this.states[`${namespace}.eventJSONList`]);
        return events && filterEvents(events, getIdFilter(this.settings.filter));
    }

    #onOpen = (): void => {
        const namespace = getNamespace(this.settings.instance);
        if (namespace && !this.editMode && !this.#drawDialog) {
            void this.#openList(namespace);
        }
    };

    /** The list in an element dialog of the host, drawn again with every change of the list */
    async #openList(namespace: string): Promise<void> {
        const word = getWords<'eventlist-last-event'>(this.systemLang);
        const { element, root } = createDialogContent(this.theme);
        this.#drawDialog = () => {
            const settings = this.settings;
            const events = this.#getEvents(namespace);
            root.render(
                <div className="list">
                    <EventTable
                        events={events && limit(events, settings.maxRows ?? DEFAULT_ROWS)}
                        columns={{
                            time: true,
                            value: settings.showValue !== false,
                            duration: settings.showDuration === true,
                        }}
                        word={word}
                    />
                </div>,
            );
        };
        this.#drawDialog();
        try {
            await this.openDialog({ title: this.settings.name || word('evl_title'), element, width: 800 });
        } finally {
            this.#drawDialog = null;
            root.unmount();
        }
    }

    protected override render(): void {
        const settings = this.settings;
        const word = getWords<'eventlist-last-event'>(this.systemLang);
        const namespace = getNamespace(settings.instance);

        if (!namespace) {
            this.#root.render(
                <Hint
                    text={settings.instance ? `${word('noInstance')}: ${settings.instance}` : word('chooseInstance')}
                    editMode={this.editMode}
                />,
            );
            return;
        }
        if (this.objects[`${namespace}.eventJSONList`] === null) {
            this.#root.render(
                <Hint
                    text={`${word('noInstance')}: ${namespace}`}
                    editMode={this.editMode}
                />,
            );
            return;
        }

        let events = this.#getEvents(namespace);
        if (this.editMode && !events?.length) {
            events = getSampleEvents(word);
        }
        // the adapter writes the newest event first
        const event = events?.[0];
        const color = event?._style?.color;

        this.#root.render(
            <Tile
                icon={getIconUrl(event?.icon)}
                hint={word('evl_open_hint')}
                editMode={this.editMode}
                onOpen={this.#onOpen}
            >
                {settings.name ? <div className="name">{settings.name}</div> : null}
                {event ? (
                    <>
                        <div
                            className="text"
                            style={{ color }}
                            title={event.event}
                        >
                            {event.event}
                        </div>
                        {settings.showValue !== false && formatValue(event.val) ? (
                            <div
                                className="value"
                                style={{ color }}
                            >
                                {formatValue(event.val)}
                            </div>
                        ) : null}
                        <div
                            className="meta"
                            title={exactTime(event._id)}
                        >
                            {event.ts}
                        </div>
                    </>
                ) : null}
                {events && !event ? <div className="none">{word('no_events')}</div> : null}
            </Tile>,
        );
        this.#drawDialog?.();
    }
}

defineWebComponent(getTag('eventlist-last-event'), EventlistLastEvent);
