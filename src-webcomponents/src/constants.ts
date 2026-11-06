/**
 * The web components of the eventlist adapter. Each one is built on its own (`vite build --mode <name>`, see
 * `vite.config.ts`), so that each is ONE module file: a host imports exactly one URL per component.
 *
 * Nothing here imports anything: `vite.config.ts` reads this file as well.
 */

/** Name of a component: the mode of its build and the base name of its files */
export type ComponentName = 'eventlist-events' | 'eventlist-last-event' | 'eventlist-alarms' | 'eventlist-pdf';

export const COMPONENT_NAMES: ComponentName[] = [
    'eventlist-events',
    'eventlist-last-event',
    'eventlist-alarms',
    'eventlist-pdf',
];

/** Tag of a component: `iob-` and its name */
export function getTag(name: ComponentName): string {
    return `iob-${name}`;
}

/** The built module, next to its manifest */
export function getModuleFile(name: ComponentName): string {
    return `${name}.js`;
}

/** The manifest the build writes next to the module; `common.webComponents` names this one */
export function getManifestFile(name: ComponentName): string {
    return `${name}.json`;
}

/** Where `tasks.js` puts the module in the admin folder; the React import is relative to it */
export function getModulePath(name: ComponentName): string {
    return `webcomponents/${getModuleFile(name)}`;
}

/** The values of the settings of `<iob-eventlist-events>`; a setting without a value is missing */
export type EventsSettings = {
    /** `eventlist.0`, or `0` as the vis-2 widget stores it */
    instance?: string;
    /** 0 or missing: all of them */
    maxRows?: number;
    /** State IDs, separated by commas; empty: every event */
    filterById?: string;
    showTime?: boolean;
    showValue?: boolean;
    showDuration?: boolean;
    /** The titles of the columns; empty: the default one */
    textTime?: string;
    textEvent?: string;
    textValue?: string;
    textDuration?: string;
};

/** The values of the settings of `<iob-eventlist-last-event>`; a setting without a value is missing */
export type LastEventSettings = {
    instance?: string;
    /** State IDs, separated by commas; empty: every event */
    filter?: string;
    /** Rows of the list in the dialog; 0: all of them */
    maxRows?: number;
    showValue?: boolean;
    showDuration?: boolean;
    /** Above the event and as the title of the dialog */
    name?: string;
};

/** How `<iob-eventlist-alarms>` lays itself out */
export type AlarmsLayout = 'auto' | 'tile' | 'panel';

/** What the lists of `<iob-eventlist-alarms>` show */
export type AlarmsShown = 'both' | 'messages' | 'events' | 'journal';

/** The values of the settings of `<iob-eventlist-alarms>`; a setting without a value is missing */
export type AlarmsSettings = {
    instance?: string;
    /** `auto`: the tile in a small box, the lists in a large one */
    layout?: AlarmsLayout;
    /** Above the worst alarm of the tile and as the title of the dialog */
    name?: string;
    show?: AlarmsShown;
    /** Share of the height the alarms get when both lists are shown, in percent */
    messagesRatio?: number;
    showTitles?: boolean;
    showSummary?: boolean;
    allowAck?: boolean;

    maxMessages?: number;
    filterLevel?: string;
    showSince?: boolean;
    showMessageValue?: boolean;
    showCount?: boolean;
    showGroup?: boolean;

    maxEvents?: number;
    filterById?: string;
    showTime?: boolean;
    showValue?: boolean;
    showDuration?: boolean;

    showJournal?: boolean;
    maxJournal?: number;
    journalArchive?: boolean;
    allowExport?: boolean;
};

/** The values of the settings of `<iob-eventlist-pdf>`; a setting without a value is missing */
export type PdfSettings = {
    instance?: string;
    /** The text of the button */
    text?: string;
};

/**
 * The namespace of the instance of a setting
 *
 * @param instance `eventlist.0` as JSON-Config stores it, or `0` as the vis-2 widgets do
 * @returns `eventlist.0`, or null if it names no instance of the eventlist adapter
 */
export function getNamespace(instance: string | undefined): string | null {
    const match = (instance || '').trim().match(/^(?:eventlist\.)?(\d+)$/);
    return match ? `eventlist.${match[1]}` : null;
}

/**
 * The IDs of a filter setting
 *
 * @param filter state IDs, separated by commas
 * @returns the IDs, or null if the filter is empty and everything is shown
 */
export function getIdFilter(filter: string | undefined): string[] | null {
    const ids = (filter || '')
        .split(',')
        .map(id => id.trim())
        .filter(id => id);
    return ids.length ? ids : null;
}

/**
 * The first rows of a list
 *
 * @param list the whole list
 * @param max 0, missing or negative: all of them
 */
export function limit<T>(list: T[], max: number | undefined): T[] {
    return max && max > 0 ? list.slice(0, max) : list;
}
