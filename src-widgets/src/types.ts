/** One line of the formatted event list, state `eventlist.<instance>.eventJSONList` */
export type FormattedEvent = {
    /** Timestamp in ms, used as unique key */
    _id: number;
    /** Formatted time */
    ts: string;
    event: string;
    val?: string | number | boolean | null;
    /** Formatted duration */
    duration?: string;
    /** Style of the line, e.g. the colour of the event */
    _style?: Record<string, string>;
    icon?: string;
    /** State ID the event belongs to */
    id?: string;
    /** Duration is still running */
    dr?: number;
};

/** Parses the JSON list out of a state value. The adapter writes a string, but it may already be parsed. */
export function parseEventList(value: unknown): FormattedEvent[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value as FormattedEvent[];
    }
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            return Array.isArray(parsed) ? (parsed as FormattedEvent[]) : [];
        } catch {
            console.warn(`Cannot parse event list: "${value}"`);
            return [];
        }
    }
    return [];
}

/** Levels of a message, ordered from the most to the least severe */
export const LEVELS = ['fatal', 'alarm', 'warning', 'info'] as const;

export type MessageLevel = (typeof LEVELS)[number];

/** Colour of a level, the same one the adapter uses */
export const LEVEL_COLORS: Record<MessageLevel, string> = {
    fatal: '#B3122B',
    alarm: '#D9601A',
    warning: '#E0A800',
    info: '#4A7FA5',
};

/** One standing message, state `eventlist.<instance>.messages.list` */
export type FormattedMessage = {
    id: string;
    level: MessageLevel;
    /** Name of the alarm class, empty for one of the twelve built-in ones */
    alarmName?: string;
    severity?: number;
    text: string;
    /** K = came, KQ = came and acknowledged, KG = gone and not acknowledged */
    state: 'K' | 'KQ' | 'KG' | 'KGQ';
    active: boolean;
    acked: boolean;
    requiresAck: boolean;
    /** True while the user can still acknowledge it */
    ackable: boolean;
    /** When it came the first time in the current standing period */
    ts: number;
    lastTs: number;
    goneTs?: number;
    count: number;
    priority: number;
    stateId?: string;
    val?: string | number | boolean | null;
    unit?: string;
    icon?: string;
    color: string;
    group?: string;
    /** The first message of its group, the one that probably caused the others */
    first?: boolean;
    /** It changes too often, its transitions are not written any more */
    flapping?: boolean;
};

/** Parses the standing messages out of a state value */
export function parseMessageList(value: unknown): FormattedMessage[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value as FormattedMessage[];
    }
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            return Array.isArray(parsed) ? (parsed as FormattedMessage[]) : [];
        } catch {
            console.warn(`Cannot parse message list: "${value}"`);
            return [];
        }
    }
    return [];
}

/** How long ago that was, in the words the widget has */
export function ageText(ms: number, t: (word: string) => string): string {
    if (ms < 60000) {
        return t('just_now');
    }
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) {
        return `${minutes} ${t('minutes')}`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        const rest = minutes % 60;
        return `${hours} ${t('hours')}${rest ? ` ${rest} ${t('minutes')}` : ''}`;
    }
    const days = Math.floor(hours / 24);
    return `${days} ${t('days')}${hours % 24 ? ` ${hours % 24} ${t('hours')}` : ''}`;
}

/** Where one alarm cycle stands */
export type CycleState = 'ACTIVE' | 'ACK' | 'CLEARED' | 'CLOSED';

/** One alarm cycle, state `eventlist.<instance>.messages.journal` */
export type AlarmCycle = {
    id: string;
    messageId: string;
    stateId?: string;
    alarmClass?: string;
    alarmName?: string;
    level: MessageLevel;
    severity: number;
    text: string;
    val?: string | number | boolean | null;
    unit?: string;
    group?: string;
    state: CycleState;
    activatedAt: number;
    acknowledgedAt?: number;
    ackUser?: string;
    clearedAt?: number;
    closedAt?: number;
    count: number;
    flapping?: boolean;
};

/** Parses the alarm journal out of a state value */
export function parseJournal(value: unknown): AlarmCycle[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value as AlarmCycle[];
    }
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            return Array.isArray(parsed) ? (parsed as AlarmCycle[]) : [];
        } catch {
            console.warn(`Cannot parse the alarm journal: "${value}"`);
            return [];
        }
    }
    return [];
}

/**
 * The exact time behind a relative one like `5 minutes ago`, for the tooltip of a cell
 *
 * @param ts the timestamp of the row in ms
 */
export function exactTime(ts: number | undefined): string | undefined {
    return ts ? new Date(ts).toLocaleString() : undefined;
}
