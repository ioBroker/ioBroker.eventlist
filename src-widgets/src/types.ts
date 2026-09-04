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
