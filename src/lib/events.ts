import moment from 'moment';

import type { EventListAdapterConfig } from '../types';

export const DEFAULT_TEMPLATE = 'default';
export const MIN_VALID_DATE = new Date(2019, 0, 1).getTime();
export const MAX_VALID_DATE = new Date(2050, 0, 1).getTime();

export interface StateSettings {
    enabled?: boolean;
    event?: string;
    color?: string;
    icon?: string | { icon: string; color: string };
    changesOnly?: boolean;
    alarmsOnly?: boolean;
    defaultMessengers?: boolean;
    messagesInAlarmsOnly?: boolean;
    whatsAppCMB?: string[];
    telegram?: string[];
    pushover?: string[];
    states?: Array<{ val: string; text: string; color: string; icon: string; disabled?: boolean }>;
    type?: string;
    originalStates?: Record<string, string>;
    unit?: string;
    min?: number;
    max?: number;
    name?: string;
    val?: any;
    ts?: number;
    durationUsed?: boolean;
    oldValueUsed?: boolean;
}

export interface EventItem {
    /** Time of the event in milliseconds */
    ts: number;
    event?: string;
    id?: string;
    _id?: string;
    val?: ioBroker.StateValue;
    oldVal?: ioBroker.StateValue;
    icon?: string;
    color?: string;
    duration?: number | null;
    diff?: number;
}

/**
 * An event on its way into the list.
 *
 * It may bring a parsable date string as time, e.g. `2020-09-25T16:11:00.000Z` from the `insert`
 * message or the value of a `datetime-local` input from the admin GUI. `buildEventItem` turns it
 * into the `EventItem` that is stored.
 */
export interface IncomingEvent extends Omit<EventItem, 'ts'> {
    ts?: number | string;
}

export interface FormattedEvent {
    _id: number;
    event: string;
    ts: string;
    _style?: { color: string };
    icon?: string;
    duration?: string;
    val?: any;
    id?: string;
    dr?: number;
}

/** Translated texts, that are used to build the duration string */
export interface DurationTexts {
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    ms: string;
}

/** All translated texts, that are used by the events engine */
export interface EventTexts extends DurationTexts {
    switchedOn: string;
    switchedOff: string;
    deviceChangedStatus: string;
}

/** Everything the formatting of one event depends on */
export interface EventEngineContext {
    config: EventListAdapterConfig;
    /** Settings of all monitored states, indexed by the state ID */
    states: Record<string, StateSettings>;
    /** If the numbers must be shown with a comma as a decimal separator */
    isFloatComma: boolean;
    texts: EventTexts;
    /** Called if the formatted event contains a time, that must be updated cyclically */
    onRelativeTimeUsed?: () => void;
}

/** Result of the analysis of the delete filter */
export interface DeleteResult {
    /** The event list without the deleted events */
    list: EventItem[];
    /** How many events were deleted */
    deleted: number;
    /** If the whole list was deleted */
    deleteAll: boolean;
}

/**
 * Extract the event list from the state `eventListRaw`
 *
 * @param state the state with the stored event list
 * @param onError called with the error text if the list cannot be parsed
 */
export function parseEventList(
    state: ioBroker.State | null | undefined,
    onError?: (text: string) => void,
): EventItem[] {
    state ||= {} as ioBroker.State;
    let table: EventItem[] | string = (state.val as string) || [];

    if (typeof table !== 'object') {
        try {
            table = JSON.parse(table) as EventItem[];
        } catch {
            onError?.(`Cannot parse event list: "${JSON.stringify(table)}"`);
            table = [];
        }
        table ||= [];
        return table;
    }

    return table || [];
}

/**
 * Format the duration in milliseconds as a human-readable text
 *
 * @param ms duration in milliseconds
 * @param isFloatComma if the comma must be used as a decimal separator
 * @param texts translated texts for days, hours, minutes, seconds and milliseconds
 * @param withSpaces if a space must be placed between the number and the unit
 */
export function duration2text(ms: number, isFloatComma: boolean, texts: DurationTexts, withSpaces?: boolean): string {
    if (ms < 1000) {
        return `${ms}${withSpaces ? ' ' : ''}${texts.ms}`;
    }
    if (ms < 10000) {
        return `${isFloatComma ? (Math.round(ms / 100) / 10).toString().replace('.', ',') : (Math.round(ms / 100) / 10).toString()}${withSpaces ? ' ' : ''}${texts.seconds}`;
    }
    if (ms < 90000) {
        return `${
            isFloatComma
                ? Math.round(ms / 1000)
                      .toString()
                      .replace('.', ',')
                : Math.round(ms / 1000).toString()
        }${withSpaces ? ' ' : ''}${texts.seconds}`;
    }
    if (ms < 3600000) {
        return `${Math.floor(ms / 60000)}${withSpaces ? ' ' : ''}${texts.minutes} ${Math.round((ms % 60000) / 1000)}${withSpaces ? ' ' : ''}${texts.seconds}`;
    }
    let hours = Math.floor(ms / 3600000);
    const minutes = Math.floor(ms / 60000) % 60;
    const seconds = Math.round(Math.floor(ms % 60000) / 1000);
    if (hours > 24) {
        const days = Math.floor(hours / 24);
        hours %= 24;
        if (days > 2) {
            return `${days}${withSpaces ? ' ' : ''}${texts.days} ${hours}${withSpaces ? ' ' : ''}${texts.hours}`;
        }
        return `${days}${withSpaces ? ' ' : ''}${texts.days} ${hours}${withSpaces ? ' ' : ''}${texts.hours} ${minutes}${withSpaces ? ' ' : ''}${texts.minutes}`;
    }

    if (hours > 2) {
        return `${hours}${withSpaces ? ' ' : ''}${texts.hours} ${minutes}${withSpaces ? ' ' : ''}${texts.minutes}`;
    }
    return `${hours}${withSpaces ? ' ' : ''}${texts.hours} ${minutes}${withSpaces ? ' ' : ''}${texts.minutes} ${seconds}${withSpaces ? ' ' : ''}${texts.seconds}`;
}

/**
 * Build the JSON entry for one event of the raw event list
 *
 * @param state the raw event
 * @param allowRelative if the relative times, like "5 minutes ago", may be used
 * @param ctx configuration, state settings and translations of the engine
 */
export function formatEvent(state: EventItem, allowRelative: boolean, ctx: EventEngineContext): FormattedEvent | null {
    const event: Partial<FormattedEvent> = {};
    let eventTemplate = '';
    let val: string | undefined;
    let valWithUnit: string | undefined;
    let color = state.color || '';
    let icon: string | undefined = '';

    const date = new Date(state.ts);
    let time: string;

    if (allowRelative && Date.now() - date.getTime() < ctx.config.relativeTime * 1000) {
        ctx.onRelativeTimeUsed?.();
        time = moment(date).fromNow();
    } else {
        time = moment(date).format(ctx.config.dateFormat);
    }

    event._id = date.getTime();

    if (!state.event) {
        const id = state.id || (state as any)._id;
        if (!id || !ctx.states[id]) {
            return null;
        }
        if (ctx.states[id].type === 'boolean') {
            val = state.val ? 'true' : 'false';

            const item = ctx.states[id].states?.find(item => item.val === val);

            if (item && item.disabled) {
                return null;
            }

            if (!ctx.states[id].event && state.val && item && item.text) {
                eventTemplate =
                    item.text === DEFAULT_TEMPLATE
                        ? ctx.config.defaultBooleanTextTrue || ctx.texts.switchedOn
                        : item.text;
                color = item.color || ctx.config.defaultBooleanColorTrue || ctx.states[id].color || '';
                icon =
                    item.icon ||
                    (typeof ctx.states[id].icon === 'string' ? ctx.states[id].icon : undefined) ||
                    undefined;
            } else if (!ctx.states[id].event && !state.val && item && item.text) {
                eventTemplate =
                    item.text === DEFAULT_TEMPLATE
                        ? ctx.config.defaultBooleanTextFalse || ctx.texts.switchedOff
                        : item.text;
                color = item.color || ctx.config.defaultBooleanColorFalse || ctx.states[id].color || '';
                icon =
                    item.icon ||
                    (typeof ctx.states[id].icon === 'string' ? ctx.states[id].icon : undefined) ||
                    undefined;
            } else {
                if (ctx.states[id].event === DEFAULT_TEMPLATE) {
                    eventTemplate = ctx.config.defaultBooleanText || ctx.texts.deviceChangedStatus;
                } else {
                    eventTemplate = (ctx.states[id].event as any) || '';
                }

                if (eventTemplate === null || eventTemplate === undefined) {
                    eventTemplate = '';
                } else if (typeof eventTemplate !== 'string') {
                    eventTemplate = (eventTemplate as any).toString();
                }

                eventTemplate = eventTemplate.replace(/%u/g, ctx.states[id].unit || '');
                eventTemplate = eventTemplate.replace(/%n/g, ctx.states[id].name || id);
                if (item) {
                    val = state.val
                        ? item.text === DEFAULT_TEMPLATE
                            ? ctx.config.defaultBooleanTextTrue || ctx.texts.switchedOn
                            : item.text || ctx.texts.switchedOn
                        : item.text === DEFAULT_TEMPLATE
                          ? ctx.config.defaultBooleanTextFalse || ctx.texts.switchedOff
                          : item.text || ctx.texts.switchedOff;

                    const iconStr = typeof ctx.states[id].icon === 'string' ? ctx.states[id].icon : '';
                    icon = state.val
                        ? item.icon === DEFAULT_TEMPLATE
                            ? ctx.config.defaultBooleanIconTrue || iconStr || ''
                            : item.icon || iconStr || ''
                        : item.icon === DEFAULT_TEMPLATE
                          ? ctx.config.defaultBooleanIconFalse || iconStr || ''
                          : item.icon || iconStr || '';

                    color = state.val
                        ? item.color === DEFAULT_TEMPLATE
                            ? ctx.config.defaultBooleanColorTrue || ctx.states[id].color || ''
                            : item.color || ctx.states[id].color || ''
                        : item.color === DEFAULT_TEMPLATE
                          ? ctx.config.defaultBooleanColorFalse || ctx.states[id].color || ''
                          : item.color || ctx.states[id].color || '';
                } else {
                    val = state.val
                        ? ctx.config.defaultBooleanTextTrue || ctx.texts.switchedOn
                        : ctx.config.defaultBooleanTextFalse || ctx.texts.switchedOff;

                    const iconStr = typeof ctx.states[id].icon === 'string' ? ctx.states[id].icon : '';
                    icon = state.val
                        ? ctx.config.defaultBooleanIconTrue || iconStr || ''
                        : ctx.config.defaultBooleanIconFalse || iconStr || '';

                    color = state.val
                        ? ctx.config.defaultBooleanColorTrue || ctx.states[id].color || ''
                        : ctx.config.defaultBooleanColorFalse || ctx.states[id].color || '';
                }

                valWithUnit = val;
            }
        } else {
            eventTemplate =
                ctx.states[id].event === DEFAULT_TEMPLATE
                    ? ctx.config.defaultNonBooleanText || ctx.texts.deviceChangedStatus
                    : ctx.states[id].event || ctx.texts.deviceChangedStatus;
            eventTemplate = eventTemplate.replace(/%u/g, ctx.states[id].unit || '');
            eventTemplate = eventTemplate.replace(/%n/g, ctx.states[id].name || id);

            const tempVal: any = state.val !== undefined ? state.val : '';

            if (tempVal === null) {
                val = 'null';
            } else if (typeof tempVal === 'number') {
                val = tempVal.toString();
                if (ctx.isFloatComma) {
                    val = val.replace('.', ',');
                }
            } else {
                val = tempVal.toString();
            }

            if (ctx.states[id].states) {
                // try to find text for value in states
                const item = ctx.states[id].states?.find(item => item.val === val);
                const stateText = item?.val && ctx.states[id].originalStates?.[item.val];
                const def =
                    ctx.config.defaultStringTexts &&
                    ctx.config.defaultStringTexts.find((it: any) => it.value === stateText || it.value === val);

                if (item) {
                    if (item.disabled) {
                        return null;
                    }
                    if (item.text) {
                        val = item.text;
                        if (val === DEFAULT_TEMPLATE && def) {
                            val = def.text;
                        }
                    }
                    if (item.color) {
                        color = item.color;
                        if (color === DEFAULT_TEMPLATE && def) {
                            color = def.color;
                        }
                    }
                    if (item.icon) {
                        icon = item.icon;
                        if (icon === DEFAULT_TEMPLATE && def) {
                            icon = def.icon;
                        }
                    }
                } else if (ctx.states[id].originalStates && val !== undefined) {
                    val =
                        ctx.states[id].originalStates?.[val] === undefined
                            ? val
                            : ctx.states[id].originalStates?.[val] || '';
                }

                if (!ctx.states[id].event && val) {
                    eventTemplate = val;
                    val = '';
                }
            } else if (ctx.states[id].originalStates && val !== undefined) {
                val =
                    ctx.states[id].originalStates?.[val] === undefined
                        ? val
                        : ctx.states[id].originalStates?.[val] || '';
                const def =
                    ctx.config.defaultStringTexts && ctx.config.defaultStringTexts.find((it: any) => it.value === val);
                if (def) {
                    val = def.text;
                    color = def.color;
                    icon = def.icon;
                }
            } else {
                const def =
                    ctx.config.defaultStringTexts && ctx.config.defaultStringTexts.find((it: any) => it.value === val);
                if (def) {
                    val = def.text;
                    color = def.color;
                    icon = def.icon;
                }
            }

            if (val !== '' && ctx.states[id].unit) {
                valWithUnit = val + ctx.states[id].unit;
            } else {
                valWithUnit = val;
            }

            icon = icon || (typeof ctx.states[id].icon === 'string' ? ctx.states[id].icon : undefined);
            color = color || ctx.states[id].color || '';
            // todo => change bright of icon depends on value and min/max
        }
    } else {
        eventTemplate = state.event;
        icon = state.icon || undefined;
        color = state.color || '';

        if (state.val !== undefined) {
            const tempVal2: any = state.val;
            if (tempVal2 === null) {
                val = 'null';
            } else if (typeof tempVal2 === 'number') {
                val = tempVal2.toString();
                if (ctx.isFloatComma) {
                    val = val.replace('.', ',');
                }
            } else {
                val = tempVal2.toString();
            }
        }
    }

    if (icon) {
        color = color || (typeof icon === 'object' ? (icon as any).color : '');
        icon = typeof icon === 'object' ? (icon as any).icon : icon;
    }

    let durationText: string;
    if (state.duration != null) {
        durationText = duration2text(state.duration, ctx.isFloatComma, ctx.texts);
    } else {
        durationText = duration2text(Date.now() - state.ts, ctx.isFloatComma, ctx.texts);
        event.dr = 1; // duration running
        ctx.onRelativeTimeUsed?.();
    }

    if (eventTemplate.includes('%d')) {
        eventTemplate = eventTemplate.replace(/%d/g, durationText);
    }

    if (eventTemplate.includes('%g')) {
        eventTemplate = eventTemplate.replace(
            /%g/g,
            ctx.isFloatComma ? (state.diff || 0).toString().replace('.', ',') : (state.diff || 0).toString(),
        );
    }

    if (eventTemplate.includes('%o')) {
        eventTemplate = eventTemplate.replace(
            /%o/g,
            ctx.isFloatComma
                ? (state.oldVal == null ? '_' : state.oldVal).toString().replace('.', ',')
                : state.oldVal == null
                  ? '_'
                  : state.oldVal.toString(),
        );
    }

    if (eventTemplate.includes('%s')) {
        eventTemplate = eventTemplate.replace(/%s/g, val === undefined ? '' : val);
        valWithUnit = '';
    }

    if (eventTemplate.includes('%t')) {
        eventTemplate = eventTemplate.replace(/%t/g, moment(new Date(state.ts)).format(ctx.config.dateFormat));
    }

    if (eventTemplate.includes('%r')) {
        eventTemplate = eventTemplate.replace(/%r/g, moment(new Date(state.ts)).fromNow());
    }

    event.event = eventTemplate;
    event.ts = time;

    if (color) {
        event._style = { color };
    }
    if (icon && ctx.config.icons) {
        event.icon = icon;
    }
    if (durationText && ctx.config.duration) {
        event.duration = durationText;
    }

    if (valWithUnit !== '' && valWithUnit !== undefined) {
        event.val = valWithUnit;
    } else {
        event.val = val;
    }
    // because of filter add event.id
    if (state.id) {
        event.id = state.id;
    }

    return event as FormattedEvent;
}

/**
 * Format the whole raw event list
 *
 * @param table the raw event list
 * @param allowRelative if the relative times, like "5 minutes ago", may be used
 * @param ctx configuration, state settings and translations of the engine
 */
export function formatEventList(table: EventItem[], allowRelative: boolean, ctx: EventEngineContext): FormattedEvent[] {
    return table.map(ev => formatEvent(ev, allowRelative, ctx)).filter((ev): ev is FormattedEvent => ev !== null);
}

/**
 * Apply the delete filter on the event list.
 * - an empty filter or `*` deletes the whole list
 * - a number or an ISO timestamp string deletes exactly one event
 * - anything else is interpreted as a state ID
 *
 * @param eventList the raw event list
 * @param filter the filter, that was provided by the user
 */
export function applyDeleteFilter(eventList: EventItem[], filter: number | string): DeleteResult {
    const count = eventList.length;

    if (!filter || filter === '*') {
        // delete all
        return { list: [], deleted: count, deleteAll: true };
    }

    if (
        typeof filter === 'number' ||
        (filter.toString()[0] === '2' && filter.length === new Date().toISOString().length)
    ) {
        // Delete it by timestamp
        // Attention: this will stop work in 3000.01.01 :)
        const ts = new Date(filter).getTime();
        const list = eventList.filter(item => item.ts !== ts);
        return { list, deleted: count - list.length, deleteAll: false };
    }

    // Delete it by State ID
    const list = eventList.filter(item => item.id !== filter);
    return { list, deleted: count - list.length, deleteAll: false };
}

/**
 * Interpret the value, that was written into the state `insert`.
 * It can be a simple text or a JSON string with the event description.
 *
 * @param val the value of the state `insert`
 */
export function normalizeInsertValue(val: ioBroker.StateValue): string | EventItem {
    if (typeof val === 'string' && val.startsWith('{')) {
        try {
            return JSON.parse(val) as EventItem;
        } catch {
            // ignore and use the text as it is
            return val;
        }
    }

    return val!.toString();
}

/**
 * The event could be provided as a simple text or as an object
 *
 * @param event the incoming event
 * @param now the current time
 */
export function normalizeEvent(event: string | IncomingEvent, now: number): IncomingEvent {
    return typeof event === 'string' ? { event, ts: now } : event;
}

/**
 * Check if this value of the state must not be logged.
 *
 * `settings.states` is a list, so it has to be searched. Indexing it with the value would always
 * yield `undefined`.
 *
 * @param settings the settings of the state
 * @param val the new value
 */
export function isValueDisabled(settings: StateSettings, val: ioBroker.StateValue): boolean {
    if (!settings.states || val === null || val === undefined) {
        return false;
    }
    return !!settings.states.find(item => item.val === val.toString())?.disabled;
}

/**
 * Read the alarm mode out of the value of the state `alarm`.
 *
 * The state is declared as boolean, but it is written by the users from scripts and from other
 * adapters, so the usual spellings of "on" are accepted as well.
 *
 * @param val value of the state `alarm`
 */
export function isAlarmModeOn(val: ioBroker.StateValue | undefined): boolean {
    return val === true || val === 1 || val === 'true' || val === '1' || val === 'ON' || val === 'on';
}

/**
 * Check if the event must be ignored, because its state is only monitored in the alarm mode
 *
 * @param event the incoming event
 * @param alarmMode if the alarm mode is active
 * @param states settings of all monitored states
 */
export function isSkippedByAlarmMode(
    event: IncomingEvent,
    alarmMode: boolean,
    states: Record<string, StateSettings>,
): boolean {
    return !alarmMode && !!event.id && !!states[event.id] && !!states[event.id].alarmsOnly;
}

/**
 * Remove all events of the states, that are only monitored in the alarm mode
 *
 * @param eventList the raw event list
 * @param states settings of all monitored states
 */
export function removeAlarmEvents(eventList: EventItem[], states: Record<string, StateSettings>): EventItem[] {
    const alarmIds = Object.keys(states).filter(id => states[id].alarmsOnly);
    return eventList.filter(item => !alarmIds.includes(item.id || ''));
}

/**
 * Build the entry of the raw event list from the incoming event
 *
 * @param event the incoming event
 * @param now the current time
 * @param onWarn called with the warning text if the timestamp is invalid
 */
export function buildEventItem(event: IncomingEvent, now: number, onWarn?: (text: string) => void): EventItem {
    const eventItem: EventItem = {} as EventItem;

    // The event may bring its own time, as milliseconds or as a parsable date string
    let ts: number;
    if (event.ts === undefined || event.ts === null || event.ts === '') {
        ts = now;
    } else if (typeof event.ts === 'number') {
        ts = event.ts;
    } else {
        ts = new Date(event.ts).getTime();
    }

    if (Number.isNaN(ts) || ts < MIN_VALID_DATE || ts > MAX_VALID_DATE) {
        onWarn?.(`Invalid date provided in event: ${JSON.stringify(event.ts)}. The current time is used.`);
        ts = now;
    }
    eventItem.ts = ts;

    if (event.event) {
        eventItem.event = event.event;
    }

    if (event.id || event._id) {
        eventItem.id = event.id || event._id;
    }

    if (event.val !== undefined) {
        eventItem.val = event.val;
    }

    if (event.oldVal !== undefined) {
        eventItem.oldVal = event.oldVal;
    }

    if (event.icon) {
        eventItem.icon = event.icon;
    }

    if (event.color) {
        eventItem.color = event.color;
    }

    return eventItem;
}

/**
 * The duration always belongs to the previous event of the same state, so write it there
 *
 * @param eventList the raw event list
 * @param event the incoming event
 */
export function applyDurationToPreviousEvent(eventList: EventItem[], event: IncomingEvent): void {
    if (event.duration != null) {
        // This is duration of previous event
        const prevEvent = eventList.find(item => item.id === event.id);
        if (prevEvent) {
            prevEvent.duration = event.duration;
        }
    }
}

/**
 * Add the event to the raw event list: the timestamps must be unique, the newest event is the first
 * one and the list may not be longer than `maxLength`. The list is modified in place.
 *
 * @param eventList the raw event list
 * @param eventItem the new entry
 * @param maxLength the maximal number of entries in the list
 */
export function insertEventItem(eventList: EventItem[], eventItem: EventItem, maxLength: number): EventItem[] {
    // time must be unique
    while (eventList.find(item => item.ts === eventItem.ts)) {
        eventItem.ts++;
    }

    eventList.unshift(eventItem);
    eventList.sort((a, b) => (a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0));

    if (eventList.length > maxLength) {
        eventList.splice(maxLength, eventList.length - maxLength);
    }

    return eventList;
}

/**
 * Build the event from the changed state and update the stored value and time of the state.
 * `settings` is modified in place.
 *
 * @param state the new state
 * @param settings the settings of this state
 * @returns the event or null if the event must be ignored
 */
export function prepareStateChangeEvent(state: ioBroker.State, settings: StateSettings): EventItem | null {
    const eventItem: EventItem = state;

    if (settings.oldValueUsed) {
        eventItem.oldVal = settings.val;
    }

    // ignore non-changed states
    if (settings.changesOnly) {
        if (settings.val === state.val) {
            return null;
        }
        // calculate duration
        if (settings.durationUsed) {
            applyDurationAndDiff(state, settings, eventItem);
        }
        settings.val = state.val;
    } else if (settings.durationUsed) {
        // calculate duration
        applyDurationAndDiff(state, settings, eventItem);
        settings.val = state.val;
    }

    return eventItem;
}

/**
 * Calculate the duration of the previous value and the difference to the previous value
 *
 * @param state the new state
 * @param settings the settings of this state
 * @param eventItem the event, that will be extended
 */
function applyDurationAndDiff(state: ioBroker.State, settings: StateSettings, eventItem: EventItem): void {
    // this event is only started, and we must update the duration of the previous event
    if (settings.ts && state.ts >= (settings.ts || 0)) {
        eventItem.duration = state.ts - (settings.ts || 0);
    } else {
        eventItem.duration = null;
    }
    settings.ts = state.ts;

    if (
        settings.type === 'number' &&
        settings.val !== null &&
        settings.val !== undefined &&
        state.val !== null &&
        state.val !== undefined
    ) {
        eventItem.diff = (state.val as number) - (settings.val as number);
    }
}

/**
 * Detect if the duration or the difference of the values is used in one of the texts of this state
 *
 * @param settings the settings of the state
 * @param config the adapter configuration
 */
export function isDurationUsed(settings: StateSettings, config: EventListAdapterConfig): boolean {
    let durationUsed = config.duration;

    if (!durationUsed && settings.states) {
        if (settings.type === 'boolean') {
            durationUsed =
                (settings.event || config.defaultBooleanText).includes('%d') ||
                (settings.event || config.defaultBooleanText).includes('%g');

            if (!durationUsed) {
                const item = settings.states?.find(item => item.val === 'true');

                durationUsed =
                    ((item && item.text) || config.defaultBooleanTextTrue).includes('%d') ||
                    ((item && item.text) || config.defaultBooleanTextTrue).includes('%g');
            }
            if (!durationUsed) {
                const item = settings.states?.find(item => item.val === 'false');

                durationUsed =
                    ((item && item.text) || config.defaultBooleanTextFalse).includes('%d') ||
                    ((item && item.text) || config.defaultBooleanTextFalse).includes('%g');
            }
        } else {
            durationUsed =
                (settings.event || config.defaultNonBooleanText).includes('%d') ||
                (settings.event || config.defaultNonBooleanText).includes('%g');

            if (!durationUsed) {
                durationUsed = !!settings.states?.find(item => item.text.includes('%d') || item.text.includes('%g'));
            }
        }
    } else if (!durationUsed) {
        durationUsed =
            (settings.event || config.defaultNonBooleanText).includes('%d') ||
            (settings.event || config.defaultNonBooleanText).includes('%g');
    }

    return durationUsed;
}

/**
 * Detect if the previous value is used in one of the texts of this state
 *
 * @param settings the settings of the state
 * @param config the adapter configuration
 */
export function isOldValueUsed(settings: StateSettings, config: EventListAdapterConfig): boolean {
    let oldValueUsed = false;

    if (settings.states) {
        if (settings.type === 'boolean') {
            oldValueUsed = (settings.event || config.defaultBooleanText).includes('%o');

            if (!oldValueUsed) {
                const item = settings.states?.find(item => item.val === 'true');

                oldValueUsed = ((item && item.text) || config.defaultBooleanTextTrue).includes('%o');
            }
            if (!oldValueUsed) {
                const item = settings.states?.find(item => item.val === 'false');

                oldValueUsed = ((item && item.text) || config.defaultBooleanTextFalse).includes('%o');
            }
        } else {
            oldValueUsed = (settings.event || config.defaultNonBooleanText).includes('%o');
            oldValueUsed = oldValueUsed || !!settings.states?.find(item => item.text.includes('%o'));
        }
    } else {
        oldValueUsed = oldValueUsed || (settings.event || config.defaultNonBooleanText).includes('%o');
    }

    return oldValueUsed;
}
