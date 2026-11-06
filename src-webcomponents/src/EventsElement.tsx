/**
 * The event list as a web component: `<iob-eventlist-events>` - the web component of the vis-2 widget "Events"
 * (`src-widgets/src/Events.tsx`).
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`eventlist-events.json`, written by the build from `manifest.ts`), so a host loads this module only when
 * it shows the element. The host sets `socket` and `settings`, and if it has them `theme` and `editMode`.
 *
 * The element subscribes to one state, `eventlist.<n>.eventJSONList`: the adapter keeps the list there, newest
 * first and already formatted. It writes nothing.
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import { createRoot, type Root } from 'react-dom/client';

import { defineWebComponent, IobWebComponent } from '@iobroker/web-components/element';

import { getIdFilter, getNamespace, getTag, limit, type EventsSettings } from './constants';
import { eventCache, filterEvents, getSampleEvents } from './data';
import { getWords } from './i18n';
import { EVENTS_STYLES } from './styles';
import { EventTable, Hint } from './views';

class EventlistEvents extends IobWebComponent<EventsSettings> {
    readonly #root: Root;

    readonly #events = eventCache();

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = EVENTS_STYLES;
        const mount = document.createElement('div');
        mount.className = 'mount';
        shadow.append(style, mount);
        this.#root = createRoot(mount);
    }

    protected override getStateIds(settings: EventsSettings): string[] {
        const namespace = getNamespace(settings.instance);
        return namespace ? [`${namespace}.eventJSONList`] : [];
    }

    protected override render(): void {
        const settings = this.settings;
        const word = getWords<'eventlist-events'>(this.systemLang);
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
        const id = `${namespace}.eventJSONList`;
        if (this.objects[id] === null) {
            this.#root.render(
                <Hint
                    text={`${word('noInstance')}: ${namespace}`}
                    editMode={this.editMode}
                />,
            );
            return;
        }

        // null while the list is read: no "No events" before it is there
        const all = this.#events.get(this.states[id]);
        let events = all && filterEvents(all, getIdFilter(settings.filterById));
        if (this.editMode && !events?.length) {
            events = getSampleEvents(word);
        }
        events = events && limit(events, settings.maxRows);

        this.#root.render(
            <div className={`list${this.editMode ? ' edit' : ''}`}>
                <EventTable
                    events={events}
                    columns={{
                        time: settings.showTime !== false,
                        value: settings.showValue !== false,
                        duration: settings.showDuration !== false,
                        titles: {
                            time: settings.textTime,
                            event: settings.textEvent,
                            value: settings.textValue,
                            duration: settings.textDuration,
                        },
                    }}
                    word={word}
                />
            </div>,
        );
    }
}

defineWebComponent(getTag('eventlist-events'), EventlistEvents);
