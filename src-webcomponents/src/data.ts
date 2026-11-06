/**
 * What the elements read from the states of the eventlist adapter, and the helpers around it. The parsing and the
 * types are those of the vis-2 widgets (`src-widgets/src/types.ts`, no MUI in it), compiled in.
 *
 * The adapter writes everything already formatted:
 *
 *     eventlist.<n>.eventJSONList        the event list, newest first
 *     eventlist.<n>.messages.list        the standing alarms, most severe first
 *     eventlist.<n>.messages.journal     one entry per alarm cycle, oldest first
 */
import {
    LEVEL_COLORS,
    parseEventList,
    parseJournal,
    parseMessageList,
    type AlarmCycle,
    type FormattedEvent,
    type FormattedMessage,
    type MessageLevel,
} from '../../src-widgets/src/types';
import type { Word } from './i18n';
import type { LEVEL_WORDS } from './words';

export {
    ageText,
    exactTime,
    LEVEL_COLORS,
    LEVELS,
    type AlarmCycle,
    type FormattedEvent,
    type FormattedMessage,
    type MessageLevel,
} from '../../src-widgets/src/types';

/** How often relative times ("5 min") are computed again */
export const TICK_MS = 30_000;

/**
 * The base of the URLs of ioBroker: the module lies in `<base>/adapter/eventlist/webcomponents/`, so this is
 * `<base>/` - also behind a reverse proxy with a path prefix
 */
export function getBaseUrl(): URL {
    // resolved at runtime, from where the module was loaded
    return new URL(/* @vite-ignore */ '../../../', import.meta.url);
}

/**
 * Parses a state value once per state: the element draws again on every change of any state, and the lists can
 * be long
 */
class ParseCache<T> {
    readonly #parse: (value: unknown) => T[];
    #state: ioBroker.State | null | undefined;
    #list: T[] = [];

    constructor(parse: (value: unknown) => T[]) {
        this.#parse = parse;
    }

    /**
     * The list in this state; null while the state has not arrived yet
     *
     * @param state the state, `undefined` while it is read
     */
    get(state: ioBroker.State | null | undefined): T[] | null {
        if (state === undefined) {
            return null;
        }
        if (state !== this.#state) {
            this.#state = state;
            this.#list = this.#parse(state?.val);
        }
        return this.#list;
    }
}

export function eventCache(): ParseCache<FormattedEvent> {
    return new ParseCache(parseEventList);
}

export function messageCache(): ParseCache<FormattedMessage> {
    return new ParseCache(parseMessageList);
}

export function journalCache(): ParseCache<AlarmCycle> {
    return new ParseCache(parseJournal);
}

/**
 * The events of the filter
 *
 * @param events the whole list
 * @param ids the state IDs to show, null for all of them
 */
export function filterEvents(events: FormattedEvent[], ids: string[] | null): FormattedEvent[] {
    return ids ? events.filter(event => ids.includes(event.id || '')) : events;
}

/** One line for the editor, so an empty list does not look broken */
export function getSampleEvents(word: Word<'sample_event'>): FormattedEvent[] {
    const now = Date.now();
    return [
        {
            _id: now,
            ts: new Date(now).toLocaleTimeString(),
            event: word('sample_event'),
            val: '5°C',
            duration: '1h 2s',
        },
    ];
}

/** One alarm for the editor, so an empty list does not look broken */
export function getSampleMessages(word: Word<'sample_message'>): FormattedMessage[] {
    const ts = Date.now() - 300_000;
    return [
        {
            id: 'sample',
            level: 'alarm',
            text: word('sample_message'),
            state: 'K',
            active: true,
            acked: false,
            requiresAck: true,
            ackable: true,
            ts,
            lastTs: ts,
            count: 1,
            priority: 50,
            val: 92,
            unit: '%',
            color: LEVEL_COLORS.alarm,
        },
    ];
}

/** The color of an alarm: its own, else the one of its level */
export function getMessageColor(message: Pick<FormattedMessage, 'color' | 'level'>): string {
    return message.color || LEVEL_COLORS[message.level] || LEVEL_COLORS.info;
}

/** The name of the level of an alarm, or of its alarm class */
export function getLevelText(
    item: { alarmName?: string; level: MessageLevel },
    word: Word<(typeof LEVEL_WORDS)[number]>,
): string {
    return (item.alarmName || word(`level_${item.level}`)).toUpperCase();
}

/** A value with its unit, empty if there is none */
export function formatValue(val: string | number | boolean | null | undefined, unit?: string): string {
    return val === undefined || val === null ? '' : `${val.toString()}${unit || ''}`;
}

/**
 * The URL of the icon of an event or an alarm, or null if the browser cannot load it from here.
 *
 * The adapter takes the icon of the state, its channel or its device: a `data:` URL, an absolute URL, or a file in
 * the admin folder of an adapter (`hm-rpc.admin/icons/1.png`), which web and admin serve as `/adapter/hm-rpc/...`.
 *
 * @param icon the `icon` of the entry
 */
export function getIconUrl(icon: string | undefined): string | null {
    if (!icon || icon.endsWith('default')) {
        return null;
    }
    if (/^(data:image\/|https?:\/\/)/.test(icon)) {
        return icon;
    }
    const match = icon.match(/^\/?([a-z0-9_-]+)\.admin\/(.+)$/i);
    return match ? new URL(`adapter/${match[1]}/${match[2]}`, getBaseUrl()).href : null;
}

/**
 * The places where the PDF of an instance may be loaded from, the most likely first. The adapter writes it into its
 * file storage, `eventlist/report.pdf` (`report-<n>.pdf` for every instance but 0). web serves that as
 * `/eventlist/report.pdf` - vis-2 and Aura - and admin as `/files/eventlist/report.pdf` - admin and devices in admin.
 *
 * @param namespace e.g. `eventlist.0`
 */
export function getPdfUrls(namespace: string): string[] {
    const instance = parseInt(namespace.split('.').pop() || '0', 10) || 0;
    const file = instance ? `report-${instance}.pdf` : 'report.pdf';
    const base = getBaseUrl();
    // the query keeps web from answering with the file it has in its cache
    const query = `?q=${Date.now()}`;
    return [new URL(`eventlist/${file}${query}`, base).href, new URL(`files/eventlist/${file}${query}`, base).href];
}

/**
 * Where the PDF is, asked without loading it: the first of the URLs that answers with a PDF. A server that does not
 * have the path may answer with a page of its own, so the type is checked, not only the status
 *
 * @param urls the places to ask, the most likely first
 * @returns the URL, the first one if none answered
 */
export async function findPdf(urls: string[]): Promise<string> {
    for (const url of urls) {
        try {
            const response = await fetch(url, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
            if (response.ok && (response.headers.get('content-type') || '').includes('pdf')) {
                return url;
            }
        } catch {
            // try the next one
        }
    }
    return urls[0];
}

/**
 * Lets the browser save a text file
 *
 * @param text the content
 * @param fileName the name of the file
 * @param type the media type
 */
export function saveFile(text: string, fileName: string, type: string): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
