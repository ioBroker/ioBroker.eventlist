/**
 * The alarms as a web component: `<iob-eventlist-alarms>` - the web component of the devices widget "Alarms"
 * (`src-devices/src/EventlistAlarmsComponent.tsx`) and the vis-2 widget "Alarms and events"
 * (`src-widgets/src/Alarms.tsx`).
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`eventlist-alarms.json`, written by the build from `manifest.ts`), so a host loads this module only when
 * it shows the element. The host sets `socket` and `settings`, and if it has them `theme`, `editMode` and `dialogs`.
 *
 * Two looks, as the setting `layout` says - `auto` takes the one that fits the box (container query, nothing is
 * measured):
 * - the tile of the devices widget: the worst standing alarm, how many are unacknowledged and how many more stand;
 *   a click shows the lists in an element dialog that the host frames
 * - the panel of the vis-2 widget: the counters, the standing alarms, the events and the alarm journal
 *
 * It subscribes to `eventlist.<n>.messages.list` (the standing alarms, most severe first), and as far as they are
 * shown to `eventlist.<n>.eventJSONList` and `eventlist.<n>.messages.journal`. With a click on an alarm it
 * acknowledges it (`eventlist.<n>.messages.ack`) if the setting allows it. The archived months of the journal and the
 * CSV export come from the adapter (`sendTo` `journal` and `journalCsv`).
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import type { JSX } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { defineWebComponent, IobWebComponent } from '@iobroker/web-components/element';

import { getIdFilter, getNamespace, getTag, limit, type AlarmsSettings } from './constants';
import {
    eventCache,
    filterEvents,
    formatValue,
    getIconUrl,
    getLevelText,
    getMessageColor,
    getSampleMessages,
    journalCache,
    messageCache,
    saveFile,
    TICK_MS,
    type AlarmCycle,
    type FormattedMessage,
} from './data';
import { createDialogContent } from './dialog';
import { getWords, type Word } from './i18n';
import type { ComponentWord } from './words';

/** The words of this element */
type AlarmsWord = Word<ComponentWord<'eventlist-alarms'>>;
import { ALARMS_STYLES } from './styles';
import { AlarmsPanel, Hint, OkIcon, Tile, type AlarmsView } from './views';

/** The byte order mark: in front of the CSV, so that a spreadsheet reads the umlauts */
const BOM = String.fromCharCode(0xfeff);

/** Rows of the journal when the setting is missing, as in the vis-2 widget */
const DEFAULT_JOURNAL_ROWS = 20;

/** What the settings show */
function getShown(settings: AlarmsSettings): {
    messages: boolean;
    events: boolean;
    journal: boolean;
    summary: boolean;
} {
    const show = settings.show || 'both';
    const messages = show === 'both' || show === 'messages';
    return {
        messages,
        events: show === 'both' || show === 'events',
        journal: show === 'journal' || !!settings.showJournal,
        summary: messages && settings.showSummary !== false,
    };
}

class EventlistAlarms extends IobWebComponent<AlarmsSettings> {
    readonly #root: Root;

    readonly #messages = messageCache();

    readonly #events = eventCache();

    readonly #journal = journalCache();

    /** The archived months of the journal of one instance; `cycles` is null while they are read */
    #archive: { namespace: string; cycles: AlarmCycle[] | null } | null = null;

    /** Draws the open dialog again; null while none is open */
    #drawDialog: (() => void) | null = null;

    /** Computes "since 5 min" again */
    #ticker: ReturnType<typeof setInterval> | null = null;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = ALARMS_STYLES;
        const mount = document.createElement('div');
        mount.className = 'mount';
        shadow.append(style, mount);
        this.#root = createRoot(mount);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.#ticker ||= setInterval(() => this.render(), TICK_MS);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.#ticker) {
            clearInterval(this.#ticker);
            this.#ticker = null;
        }
    }

    /** The standing alarms always - the tile shows them; the events for the counters too */
    protected override getStateIds(settings: AlarmsSettings): string[] {
        const namespace = getNamespace(settings.instance);
        if (!namespace) {
            return [];
        }
        const shown = getShown(settings);
        const ids = [`${namespace}.messages.list`];
        if (shown.events || shown.summary) {
            ids.push(`${namespace}.eventJSONList`);
        }
        if (shown.journal) {
            ids.push(`${namespace}.messages.journal`);
        }
        return ids;
    }

    /** The standing alarms of the level filter, most severe first; null while they are read */
    #getMessages(namespace: string): FormattedMessage[] | null {
        const messages = this.#messages.get(this.states[`${namespace}.messages.list`]);
        const level = this.settings.filterLevel;
        return messages && level ? messages.filter(message => message.level === level) : messages;
    }

    /**
     * The months out of the file storage of the adapter, read once per instance. The state holds the last cycles
     * only; the monthly files do not change any more.
     */
    #readArchive(namespace: string): void {
        const socket = this.socket;
        if (!socket || this.#archive?.namespace === namespace) {
            return;
        }
        const archive: { namespace: string; cycles: AlarmCycle[] | null } = { namespace, cycles: null };
        this.#archive = archive;
        socket
            .sendTo<AlarmCycle[]>(namespace, 'journal', { archive: true })
            .then(cycles => {
                archive.cycles = Array.isArray(cycles) ? cycles : [];
                if (this.#archive === archive && this.isConnected) {
                    this.render();
                }
            })
            .catch((e: unknown) => console.warn(`<${this.localName}>: cannot read the alarm archive: ${String(e)}`));
    }

    /** The alarm cycles, oldest first: the archive in front of what the state holds */
    #getCycles(namespace: string): AlarmCycle[] {
        const live = this.#journal.get(this.states[`${namespace}.messages.journal`]) || [];
        const archived = this.settings.journalArchive && this.#archive?.namespace === namespace && this.#archive.cycles;
        if (!archived || !archived.length) {
            return live;
        }
        // the same cycle can stand in both: what the state holds is the newer one
        const byId = new Map<string, AlarmCycle>();
        for (const cycle of [...archived, ...live]) {
            byId.set(cycle.id, cycle);
        }
        return [...byId.values()].sort((a, b) => a.activatedAt - b.activatedAt);
    }

    /** Write the id of the alarm into `messages.ack`; nothing in edit mode */
    #acknowledge(namespace: string, message: FormattedMessage): void {
        if (!this.settings.allowAck || !message.ackable || this.editMode) {
            return;
        }
        this.setState(`${namespace}.messages.ack`, message.id).catch((e: unknown) =>
            console.warn(`<${this.localName}>: cannot acknowledge ${message.id}: ${String(e)}`),
        );
    }

    /** Let the browser save what the journal shows, as the adapter writes it as CSV */
    #exportCsv(namespace: string, cycles: AlarmCycle[]): void {
        if (!this.socket || this.editMode) {
            return;
        }
        this.socket
            .sendTo<{ csv?: string; fileName?: string }>(namespace, 'journalCsv', {
                archive: !!this.settings.journalArchive,
                ids: cycles.map(cycle => cycle.id),
            })
            .then(answer => {
                if (answer?.csv) {
                    saveFile(`${BOM}${answer.csv}`, answer.fileName || 'alarm-journal.csv', 'text/csv;charset=utf-8');
                }
            })
            .catch((e: unknown) => console.warn(`<${this.localName}>: cannot export the alarm journal: ${String(e)}`));
    }

    /** What the panel shows: the lists of the settings, filtered and cut */
    #getView(namespace: string, word: AlarmsWord): AlarmsView {
        const settings = this.settings;
        const shown = getShown(settings);
        const editMode = this.editMode;

        let messages = this.#getMessages(namespace);
        if (editMode && !messages?.length) {
            messages = getSampleMessages(word);
        }
        const allEvents = this.#events.get(this.states[`${namespace}.eventJSONList`]);
        const events = allEvents && filterEvents(allEvents, getIdFilter(settings.filterById));
        const cycles = shown.journal ? this.#getCycles(namespace) : [];
        const journal = limit(
            [...cycles].reverse(),
            settings.maxJournal === undefined ? DEFAULT_JOURNAL_ROWS : settings.maxJournal,
        );

        return {
            messages: shown.messages ? messages && limit(messages, settings.maxMessages) : null,
            messageColumns: {
                since: settings.showSince !== false,
                value: settings.showMessageValue !== false,
                count: !!settings.showCount,
                group: !!settings.showGroup,
            },
            events: shown.events ? events && limit(events, settings.maxEvents) : null,
            eventColumns: {
                time: settings.showTime !== false,
                value: settings.showValue !== false,
                duration: !!settings.showDuration,
            },
            journal: shown.journal ? journal : null,
            summary: shown.summary
                ? {
                      unacknowledged: (messages || []).filter(message => message.ackable).length,
                      active: (messages || []).filter(message => message.active).length,
                      events: (events || []).length,
                  }
                : null,
            ratio: Math.min(90, Math.max(10, settings.messagesRatio || 50)),
            titles: settings.showTitles !== false,
            onExport:
                shown.journal && settings.allowExport && !editMode ? () => this.#exportCsv(namespace, cycles) : null,
            onAck:
                settings.allowAck && !editMode
                    ? (message: FormattedMessage) => this.#acknowledge(namespace, message)
                    : undefined,
            now: Date.now(),
        };
    }

    #onOpen = (): void => {
        const namespace = getNamespace(this.settings.instance);
        if (namespace && !this.editMode && !this.#drawDialog) {
            void this.#openLists(namespace);
        }
    };

    /** The lists in an element dialog of the host, drawn again with every change */
    async #openLists(namespace: string): Promise<void> {
        const word = getWords<'eventlist-alarms'>(this.systemLang);
        const { element, root } = createDialogContent(this.theme);
        this.#drawDialog = () =>
            root.render(
                <AlarmsPanel
                    view={this.#getView(namespace, word)}
                    dialog
                    word={word}
                />,
            );
        this.#drawDialog();
        try {
            await this.openDialog({ title: this.settings.name || word('evl_alarms_title'), element, width: 900 });
        } finally {
            this.#drawDialog = null;
            root.unmount();
        }
    }

    /** The tile: the worst alarm, how many are unacknowledged and how many more stand */
    #renderTile(namespace: string, word: AlarmsWord): JSX.Element {
        const settings = this.settings;
        let messages = this.#getMessages(namespace);
        if (this.editMode && !messages?.length) {
            messages = getSampleMessages(word);
        }
        // the adapter sorts by severity: the worst alarm is the first one
        const worst = messages?.[0];
        const color = worst ? getMessageColor(worst) : undefined;
        const unacknowledged = (messages || []).filter(message => message.ackable).length;
        const standing = (messages || []).length;
        const value = worst && settings.showMessageValue !== false ? formatValue(worst.val, worst.unit) : '';
        const meta = [
            unacknowledged ? word('evl_unacknowledged_count').replace('%s', unacknowledged.toString()) : '',
            standing > 1 ? word('evl_more_alarms').replace('%s', (standing - 1).toString()) : '',
        ]
            .filter(text => text)
            .join(' · ');

        return (
            <Tile
                icon={getIconUrl(worst?.icon)}
                accent={color}
                hint={word('evl_open_alarms_hint')}
                editMode={this.editMode}
                onOpen={this.#onOpen}
            >
                {settings.name ? <div className="name">{settings.name}</div> : null}
                {worst ? (
                    <>
                        <span
                            className="chip"
                            style={{ backgroundColor: color }}
                        >
                            {getLevelText(worst, word)}
                        </span>
                        <div
                            className="text"
                            style={{ color }}
                            title={worst.text}
                        >
                            {worst.text}
                        </div>
                        {value ? (
                            <div
                                className="value"
                                style={{ color }}
                            >
                                {value}
                            </div>
                        ) : null}
                        {meta ? <div className="meta">{meta}</div> : null}
                    </>
                ) : null}
                {messages && !worst ? (
                    <>
                        <OkIcon />
                        <div className="none">{word('no_messages')}</div>
                    </>
                ) : null}
            </Tile>
        );
    }

    protected override render(): void {
        const settings = this.settings;
        const word = getWords<'eventlist-alarms'>(this.systemLang);
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
        if (this.objects[`${namespace}.messages.list`] === null) {
            this.#root.render(
                <Hint
                    text={`${word('noInstance')}: ${namespace}`}
                    editMode={this.editMode}
                />,
            );
            return;
        }
        if (getShown(settings).journal && settings.journalArchive) {
            this.#readArchive(namespace);
        }

        const layout = settings.layout || 'auto';
        let className = 'alarms auto';
        if (layout === 'tile') {
            className = 'alarms tile-only';
        } else if (layout === 'panel') {
            className = 'alarms panel-only';
        }

        this.#root.render(
            <div className={className}>
                {layout !== 'panel' ? this.#renderTile(namespace, word) : null}
                {layout !== 'tile' ? (
                    <AlarmsPanel
                        view={this.#getView(namespace, word)}
                        editMode={this.editMode}
                        word={word}
                    />
                ) : null}
            </div>,
        );
        this.#drawDialog?.();
    }
}

defineWebComponent(getTag('eventlist-alarms'), EventlistAlarms);
