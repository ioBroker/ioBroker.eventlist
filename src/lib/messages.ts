/**
 * The message engine: standing messages with levels, coming and going, and acknowledgement.
 *
 * A message is not an event. An event is a point in time and drops out of the list at some point, a
 * message is a condition with a duration: it comes, it stands, it goes, and it only leaves the list
 * once somebody has taken note of it. Everything in here is pure, so it can be tested without an
 * adapter; `main.ts` does the reading and writing of states around it.
 *
 * The four combined states of a message are the ones used in control rooms:
 *
 * | code | active | acknowledged | in the list |
 * |------|--------|--------------|-------------|
 * | K    | yes    | no           | yes         |
 * | KQ   | yes    | yes          | yes         |
 * | KG   | no     | no           | yes         |
 * | KGQ  | no     | yes          | no          |
 *
 * So the rule is: a message stands as long as it is active OR still unacknowledged.
 */

/** Levels, ordered from the most to the least severe */
export const LEVELS = ['fatal', 'error', 'warning', 'info'] as const;

export type MessageLevel = (typeof LEVELS)[number];

/** Colour of a level, used for the event entry when the message brings no colour of its own */
export const LEVEL_COLORS: Record<MessageLevel, string> = {
    fatal: '#B3122B',
    error: '#D9601A',
    warning: '#E0A800',
    info: '#4A7FA5',
};

/** Levels that have to be acknowledged unless the message says otherwise */
const ACK_BY_DEFAULT: Record<MessageLevel, boolean> = {
    fatal: true,
    error: true,
    warning: false,
    info: false,
};

/**
 * Transition of a message, written into the event list.
 *
 * `flapping` and `settled` do not belong to the life cycle of the message, they say that the adapter
 * stopped and started writing its transitions.
 */
export type MessageTransition = 'came' | 'gone' | 'ack' | 'flapping' | 'settled';

/** When a state raises a message */
export interface MessageCondition {
    /** Comparison for numbers */
    operator?: '>' | '>=' | '<' | '<=' | '==' | '!=';
    /** Limit for the comparison */
    limit?: number;
    /** The value that raises the message. For booleans, strings and single values of an enumeration. */
    value?: string | number | boolean;
}

/** Message settings of one state, stored in `common.custom[<namespace>].message` */
export interface MessageSettings {
    level?: MessageLevel;
    /** 0 to 100, only sorts inside the level */
    priority?: number;
    requiresAck?: boolean;
    /** Text of the message, may use the patterns %s %u %n %l */
    text?: string;
    condition?: MessageCondition;
    /**
     * Only for numbers: how far the value has to come back over the limit before the message goes.
     * Against a value that trembles around the limit.
     */
    hysteresis?: number;
    /** The condition has to hold that many milliseconds before the message comes */
    delay?: number;
    /** The condition has to be false that many milliseconds before the message goes */
    delayGone?: number;
    /** Free name of a group, for the collective acknowledgement and for the first message of a group */
    group?: string;
}

/**
 * When a message counts as flapping.
 *
 * A contact that comes and goes ten times in five minutes says nothing about the plant, it only
 * fills the list. Such a message stays standing, is marked and writes no further events until it
 * has calmed down.
 */
export interface FlappingConfig {
    /** More transitions than this inside the window count as flapping. 0 switches it off. */
    count: number;
    /** Length of the window in milliseconds */
    interval: number;
}

/**
 * A suppressed target, for a maintenance where everything reports.
 *
 * The end is part of it on purpose: a message that is suppressed for ever is a fault nobody knows
 * about any more.
 */
export interface Suppression {
    /** Message id, group name or `*` for everything */
    target: string;
    /** Time at which the suppression ends */
    until: number;
}

/** A message on its way into the list */
export interface IncomingMessage {
    /** Identifies the message over its whole life cycle */
    id: string;
    level?: MessageLevel;
    /** Severity of a foreign system, 1 to 1000. Used only if no level is given. */
    severity?: number;
    text?: string;
    priority?: number;
    requiresAck?: boolean;
    /** The ioBroker state that raised it, if any */
    stateId?: string;
    val?: ioBroker.StateValue;
    icon?: string;
    color?: string;
    /** Name of the group */
    group?: string;
    /** How long the condition has to hold before it comes. Handled by the adapter, not in here. */
    delay?: number;
    /** How long the condition has to be false before it goes. Handled by the adapter, not in here. */
    delayGone?: number;
    /**
     * The transitions of the previous standing period.
     *
     * A message that does not have to be acknowledged leaves the list when it goes and would take
     * its history with it. Then a contact could toggle for ever without ever counting as flapping,
     * so the adapter hands the times back in.
     */
    changes?: number[];
}

/** What a script sends with the `message` command */
export interface ScriptMessage {
    id: string;
    /** `gone` lets the message go, everything else lets it come */
    state?: 'came' | 'gone';
    level?: MessageLevel;
    severity?: number;
    text?: string;
    priority?: number;
    requiresAck?: boolean;
    val?: ioBroker.StateValue;
    icon?: string;
    color?: string;
    group?: string;
}

/** A message as it is stored and shown */
export interface PendingMessage {
    id: string;
    level: MessageLevel;
    priority: number;
    text: string;
    /** The condition is currently true */
    active: boolean;
    acked: boolean;
    requiresAck: boolean;
    /** When the message came the first time in the current standing period */
    ts: number;
    /** When it came the last time */
    lastTs: number;
    /** When it went, as long as it is still in the list */
    goneTs?: number;
    ackTs?: number;
    ackUser?: string;
    /** How often it came in the current standing period */
    count: number;
    stateId?: string;
    val?: ioBroker.StateValue;
    icon?: string;
    color?: string;
    severity?: number;
    /** Name of the group, for the collective acknowledgement and the first message of a group */
    group?: string;
    /** Times of the last transitions, only kept while the flapping protection is switched on */
    changes?: number[];
    /** It comes and goes too often. It stays in the list and writes no more events. */
    flapping?: boolean;
}

/** The message as the GUI shows it */
export interface FormattedMessage {
    id: string;
    level: MessageLevel;
    text: string;
    /** K, KQ, KG or KGQ. The last one only for a message that stays because it flaps. */
    state: 'K' | 'KQ' | 'KG' | 'KGQ';
    active: boolean;
    acked: boolean;
    requiresAck: boolean;
    /** True while the user can still acknowledge it */
    ackable: boolean;
    ts: number;
    lastTs: number;
    goneTs?: number;
    count: number;
    priority: number;
    stateId?: string;
    val?: ioBroker.StateValue;
    icon?: string;
    color: string;
    group?: string;
    /** The first message of its group, the one that probably caused the others */
    first?: boolean;
    /** It changes too often, its transitions are not written any more */
    flapping?: boolean;
}

export interface MessageSummary {
    total: number;
    unacknowledged: number;
    byLevel: Record<MessageLevel, number>;
    /** The most severe level that stands, empty if nothing stands */
    highest: MessageLevel | '';
}

/** Result of a change on the list */
export interface MessageChange {
    /** The list after the change */
    list: PendingMessage[];
    /** What happened, empty if nothing did */
    transitions: { transition: MessageTransition; message: PendingMessage }[];
}

/** Everything the text of a message can refer to */
export interface MessageTextContext {
    val?: ioBroker.StateValue;
    unit?: string;
    name?: string;
    level: MessageLevel;
    isFloatComma?: boolean;
}

export function isLevel(value: unknown): value is MessageLevel {
    return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

/**
 * Whether a message of this level has to be acknowledged if the message does not say
 *
 * @param level level of the message
 */
export function requiresAckByDefault(level: MessageLevel): boolean {
    return ACK_BY_DEFAULT[level];
}

/**
 * Map the severity of a foreign system onto a level.
 *
 * Fixed bands and not configurable on purpose: the same number has to mean the same thing in every
 * installation. The range 1 to 1000 is the one OPC UA uses.
 *
 * @param severity severity of the foreign system
 */
export function severityToLevel(severity: number): MessageLevel {
    if (severity > 800) {
        return 'fatal';
    }
    if (severity > 500) {
        return 'error';
    }
    if (severity > 200) {
        return 'warning';
    }
    return 'info';
}

/**
 * Check if the value raises the message.
 *
 * With a hysteresis the limit is not the same in both directions: a message that already stands
 * goes only once the value has come back over the limit by that amount. A pressure that trembles
 * around its limit then produces one message and not fifty.
 *
 * @param condition the configured condition
 * @param val the current value of the state
 * @param options what the answer depends on besides the value
 * @param options.standing the message of this condition stands at the moment
 * @param options.hysteresis how far the value has to come back before the message goes
 */
export function isConditionMet(
    condition: MessageCondition | undefined,
    val: ioBroker.StateValue,
    options?: { standing?: boolean; hysteresis?: number },
): boolean {
    if (!condition) {
        return false;
    }

    // a comparison wins over an equality, so a wrongly filled form does not silently do both
    if (condition.operator && condition.limit !== undefined && condition.limit !== null) {
        const num = typeof val === 'number' ? val : parseFloat(val as string);
        if (!isFinite(num)) {
            return false;
        }

        // the hysteresis only widens the range in which the message keeps standing
        const hysteresis = options?.standing && options.hysteresis ? Math.abs(options.hysteresis) : 0;
        let limit = condition.limit;
        if (hysteresis) {
            if (condition.operator === '>' || condition.operator === '>=') {
                limit -= hysteresis;
            } else if (condition.operator === '<' || condition.operator === '<=') {
                limit += hysteresis;
            }
        }

        switch (condition.operator) {
            case '>':
                return num > limit;
            case '>=':
                return num >= limit;
            case '<':
                return num < limit;
            case '<=':
                return num <= limit;
            case '==':
                return num === limit;
            case '!=':
                return num !== limit;
            default:
                return false;
        }
    }

    if (condition.value === undefined) {
        return false;
    }
    if (val === null || val === undefined) {
        return false;
    }
    // compared as text, so "true" from a script and true from a state mean the same
    return val.toString() === condition.value.toString();
}

/**
 * Replace the patterns in the text of a message.
 *
 * Only the patterns that make sense without an event: value, unit, name and level. The event list
 * keeps its own, larger set, which also knows the duration and the previous value.
 *
 * @param text the configured text
 * @param ctx value, unit, name and level of the message
 */
export function formatMessageText(text: string, ctx: MessageTextContext): string {
    let result = text;

    if (result.includes('%s')) {
        let val = ctx.val === null || ctx.val === undefined ? '' : ctx.val.toString();
        if (ctx.isFloatComma && typeof ctx.val === 'number') {
            val = val.replace('.', ',');
        }
        result = result.replace(/%s/g, val);
    }
    if (result.includes('%u')) {
        result = result.replace(/%u/g, ctx.unit || '');
    }
    if (result.includes('%n')) {
        result = result.replace(/%n/g, ctx.name || '');
    }
    if (result.includes('%l')) {
        result = result.replace(/%l/g, ctx.level);
    }

    return result;
}

/**
 * A message stands in the list as long as it is active or still unacknowledged.
 *
 * A flapping message stays as well, even when it has just gone: it will come back within the next
 * minutes anyway, and letting it appear and disappear is exactly the restlessness the flapping
 * protection is there to stop.
 */
export function isPending(message: PendingMessage): boolean {
    return message.active || (message.requiresAck && !message.acked) || !!message.flapping;
}

/**
 * Note the transition and decide whether the message flaps from now on.
 *
 * Changes the message, which is a fresh copy in every caller.
 *
 * @param message the message that just came or went
 * @param now the current time
 * @param flapping when a message counts as flapping, undefined switches the protection off
 * @returns true if the message starts flapping with this transition
 */
function recordChange(message: PendingMessage, now: number, flapping?: FlappingConfig): boolean {
    if (!flapping?.count || !flapping.interval) {
        return false;
    }

    const changes = (message.changes || []).filter(ts => ts > now - flapping.interval);
    changes.push(now);
    message.changes = changes;

    if (changes.length > flapping.count && !message.flapping) {
        message.flapping = true;
        return true;
    }

    return false;
}

/**
 * Which transitions a change of a message writes into the event list.
 *
 * While a message flaps it writes nothing, only the moment it starts flapping is worth an entry.
 *
 * @param transition what happened
 * @param message the message
 * @param started the message starts flapping with this transition
 */
function transitionsOf(
    transition: MessageTransition,
    message: PendingMessage,
    started: boolean,
): MessageChange['transitions'] {
    if (started) {
        return [{ transition: 'flapping', message }];
    }
    return message.flapping ? [] : [{ transition, message }];
}

/** The code of the combined state, as it is used in control rooms */
export function getMessageState(message: PendingMessage): 'K' | 'KQ' | 'KG' | 'KGQ' {
    if (message.active) {
        return message.acked ? 'KQ' : 'K';
    }
    return message.acked || !message.requiresAck ? 'KGQ' : 'KG';
}

/**
 * Let a message come.
 *
 * A message that already stands does not produce a second entry: the existing one becomes active
 * again and counts its repetitions. That is the difference between a message list and a log, and
 * the reason why a flapping contact does not flood the list.
 *
 * @param list the standing messages
 * @param incoming the message that comes
 * @param now the current time
 * @param flapping when a message counts as flapping, undefined switches the protection off
 */
export function raiseMessage(
    list: PendingMessage[],
    incoming: IncomingMessage,
    now: number,
    flapping?: FlappingConfig,
): MessageChange {
    const level: MessageLevel = incoming.level || (incoming.severity ? severityToLevel(incoming.severity) : 'info');
    const result = [...list];
    const index = result.findIndex(item => item.id === incoming.id);

    if (index === -1) {
        const message: PendingMessage = {
            id: incoming.id,
            level,
            priority: incoming.priority ?? 50,
            text: incoming.text || incoming.id,
            active: true,
            acked: false,
            requiresAck: incoming.requiresAck ?? requiresAckByDefault(level),
            ts: now,
            lastTs: now,
            count: 1,
        };
        // only what is really there, so the stored list stays free of empty fields
        if (incoming.stateId !== undefined) {
            message.stateId = incoming.stateId;
        }
        if (incoming.val !== undefined) {
            message.val = incoming.val;
        }
        if (incoming.icon) {
            message.icon = incoming.icon;
        }
        if (incoming.color) {
            message.color = incoming.color;
        }
        if (incoming.severity !== undefined) {
            message.severity = incoming.severity;
        }
        if (incoming.group) {
            message.group = incoming.group;
        }
        if (incoming.changes?.length) {
            // it was here before, so its restlessness is not forgotten
            message.changes = [...incoming.changes];
        }

        const started = recordChange(message, now, flapping);
        result.push(message);
        return { list: result, transitions: transitionsOf('came', message, started) };
    }

    const existing = { ...result[index] };
    // the value and the text follow the state even while the message stands
    if (incoming.val !== undefined) {
        existing.val = incoming.val;
    }
    if (incoming.text) {
        existing.text = incoming.text;
    }
    if (incoming.level) {
        existing.level = incoming.level;
    }
    if (incoming.group) {
        existing.group = incoming.group;
    }

    if (existing.active) {
        // it already stands, so this is no new occurrence
        result[index] = existing;
        return { list: result, transitions: [] };
    }

    // it had gone and was not acknowledged, so it comes again
    existing.active = true;
    existing.lastTs = now;
    existing.count++;
    delete existing.goneTs;
    const started = recordChange(existing, now, flapping);
    result[index] = existing;

    return { list: result, transitions: transitionsOf('came', existing, started) };
}

/**
 * Let a message go. It leaves the list only if it does not have to be acknowledged any more.
 *
 * @param list the standing messages
 * @param id the message
 * @param now the current time
 * @param flapping when a message counts as flapping, undefined switches the protection off
 */
export function clearMessage(
    list: PendingMessage[],
    id: string,
    now: number,
    flapping?: FlappingConfig,
): MessageChange {
    const result = [...list];
    const index = result.findIndex(item => item.id === id);

    if (index === -1 || !result[index].active) {
        return { list: result, transitions: [] };
    }

    const message = { ...result[index], active: false, goneTs: now };
    const started = recordChange(message, now, flapping);
    result[index] = message;

    if (!isPending(message)) {
        result.splice(index, 1);
    }

    return { list: result, transitions: transitionsOf('gone', message, started) };
}

/**
 * Let the messages that have calmed down out of the flapping protection again.
 *
 * Has to be called from time to time, because a message that stops changing produces no event that
 * could carry the decision.
 *
 * @param list the standing messages
 * @param now the current time
 * @param flapping when a message counts as flapping
 */
export function settleMessages(list: PendingMessage[], now: number, flapping: FlappingConfig): MessageChange {
    const transitions: MessageChange['transitions'] = [];
    const result: PendingMessage[] = [];
    let changed = false;

    for (const item of list) {
        if (!item.flapping) {
            result.push(item);
            continue;
        }

        const changes = (item.changes || []).filter(ts => ts > now - flapping.interval);
        if (flapping.count && changes.length > flapping.count) {
            // still restless, but the window may have moved on
            if (changes.length !== (item.changes || []).length) {
                changed = true;
                result.push({ ...item, changes });
            } else {
                result.push(item);
            }
            continue;
        }

        changed = true;
        const message: PendingMessage = { ...item, changes };
        delete message.flapping;
        if (!changes.length) {
            delete message.changes;
        }
        transitions.push({ transition: 'settled', message });

        if (isPending(message)) {
            result.push(message);
        }
    }

    return { list: changed || transitions.length ? result : list, transitions };
}

/**
 * Acknowledge messages. A message that has already gone leaves the list with it.
 *
 * @param list the standing messages
 * @param filter one message id, a group name, or `*` for everything that can be acknowledged
 * @param now the current time
 * @param user who acknowledged, empty for a script
 */
export function acknowledgeMessages(list: PendingMessage[], filter: string, now: number, user?: string): MessageChange {
    const transitions: { transition: MessageTransition; message: PendingMessage }[] = [];
    const result: PendingMessage[] = [];

    for (const item of list) {
        const matches = filter === '*' || item.id === filter || (!!item.group && item.group === filter);
        if (!matches || item.acked) {
            result.push(item);
            continue;
        }

        const message: PendingMessage = { ...item, acked: true, ackTs: now };
        if (user) {
            message.ackUser = user;
        }
        transitions.push({ transition: 'ack', message });

        if (isPending(message)) {
            result.push(message);
        }
    }

    return { list: result, transitions };
}

/** A suppression may last a month at most. Everything longer is a fault nobody knows about any more. */
export const MAX_SUPPRESSION_MINUTES = 43200;

/**
 * Read what should be suppressed and for how long.
 *
 * Accepts `group`, `group:30`, `group 30` and the same as an object. A duration of 0 lifts the
 * suppression again.
 *
 * @param val what was written into the state or sent with the command
 * @param now the current time
 * @param defaultMinutes duration if none is given
 */
export function parseSuppression(val: unknown, now: number, defaultMinutes: number): Suppression | null {
    let target = '';
    let minutes: number | undefined;
    let until: number | undefined;

    if (typeof val === 'string') {
        const text = val.trim();
        if (!text) {
            return null;
        }
        const match = /^(.+?)[\s:]+(-?[\d.]+)$/.exec(text);
        if (match) {
            target = match[1].trim();
            minutes = parseFloat(match[2]);
        } else {
            target = text;
        }
    } else if (val && typeof val === 'object') {
        const request = val as { target?: string; id?: string; group?: string; minutes?: number; until?: number };
        target = (request.target || request.id || request.group || '').toString().trim();
        minutes = request.minutes;
        until = request.until;
    }

    if (!target) {
        return null;
    }

    if (until !== undefined) {
        return { target, until: until > now ? until : 0 };
    }

    if (minutes === undefined || isNaN(minutes)) {
        minutes = defaultMinutes;
    }
    if (minutes <= 0) {
        // lift it again
        return { target, until: 0 };
    }
    if (minutes > MAX_SUPPRESSION_MINUTES) {
        minutes = MAX_SUPPRESSION_MINUTES;
    }

    return { target, until: now + minutes * 60000 };
}

/**
 * Take a suppression over. One target is suppressed once, a new duration replaces the old one, and
 * an end that has passed removes it.
 *
 * @param list the suppressions
 * @param entry the new one
 */
export function addSuppression(list: Suppression[], entry: Suppression): Suppression[] {
    const result = list.filter(item => item.target !== entry.target);
    if (entry.until) {
        result.push(entry);
    }
    return result;
}

/**
 * Throw out the suppressions whose time is over
 *
 * @param list the suppressions
 * @param now the current time
 */
export function expireSuppressions(list: Suppression[], now: number): Suppression[] {
    return list.filter(item => item.until > now);
}

/**
 * Whether a message is suppressed at the moment. Matches its id, its group and `*`.
 *
 * @param message the message
 * @param suppressions the suppressions
 * @param now the current time
 */
export function isSuppressed(message: PendingMessage, suppressions: Suppression[], now: number): boolean {
    return suppressions.some(
        item =>
            item.until > now &&
            (item.target === '*' || item.target === message.id || (!!message.group && item.target === message.group)),
    );
}

/**
 * The messages that are shown and counted. A suppressed message keeps its state, it is only out of
 * sight until its suppression is over.
 *
 * @param list the standing messages
 * @param suppressions the suppressions
 * @param now the current time
 */
export function visibleMessages(list: PendingMessage[], suppressions: Suppression[], now: number): PendingMessage[] {
    if (!suppressions.length) {
        return list;
    }
    return list.filter(item => !isSuppressed(item, suppressions, now));
}

/**
 * Whether the horn sounds: an unacknowledged message of that level or a more severe one stands.
 *
 * A message that does not have to be acknowledged never sounds the horn, otherwise nobody could
 * ever switch it off again.
 *
 * @param list the standing messages
 * @param level from which level on the horn sounds, empty switches it off
 */
export function isHornOn(list: PendingMessage[], level: MessageLevel | '' | undefined): boolean {
    if (!level || !isLevel(level)) {
        return false;
    }
    const limit = LEVELS.indexOf(level);
    return list.some(item => item.requiresAck && !item.acked && LEVELS.indexOf(item.level) <= limit);
}

/**
 * Work out which messages a state raises and which it clears.
 *
 * Two ways to configure it. Either single values of the state carry a level, then every such value
 * is its own message and only the current one stands. Or the state has one condition, then there is
 * one message for the whole state.
 *
 * @param stateId the state
 * @param settings the message settings of the state, and the values with their levels
 * @param settings.message the condition and the level of the whole state
 * @param settings.states the single values, each of which may carry a level
 * @param settings.unit unit of the state, for the text
 * @param settings.name name of the state, for the text
 * @param val the new value
 * @param ctx unit, name and number format for the text
 * @param ctx.isFloatComma if the comma is the decimal separator
 * @param ctx.isActive tells whether a message stands at the moment, for the hysteresis
 */
export function evaluateStateMessages(
    stateId: string,
    settings: {
        message?: MessageSettings;
        states?: Array<{ val: string; text?: string; level?: MessageLevel; icon?: string; color?: string }> | null;
        unit?: string;
        name?: string;
    },
    val: ioBroker.StateValue,
    ctx: { isFloatComma?: boolean; isActive?: (id: string) => boolean },
): { raise: IncomingMessage[]; clear: string[] } {
    const raise: IncomingMessage[] = [];
    const clear: string[] = [];
    const valText = val === null || val === undefined ? '' : val.toString();

    const valuesWithLevel = (settings.states || []).filter(item => isLevel(item.level));

    if (valuesWithLevel.length) {
        for (const item of valuesWithLevel) {
            const id = `${stateId}#${item.val}`;
            if (item.val === valText) {
                raise.push({
                    id,
                    stateId,
                    level: item.level,
                    val,
                    icon: item.icon,
                    color: item.color,
                    text: formatMessageText(item.text || settings.message?.text || settings.name || stateId, {
                        val,
                        unit: settings.unit,
                        name: settings.name,
                        level: item.level!,
                        isFloatComma: ctx.isFloatComma,
                    }),
                    priority: settings.message?.priority,
                    requiresAck: settings.message?.requiresAck,
                    group: settings.message?.group,
                    delay: settings.message?.delay,
                    delayGone: settings.message?.delayGone,
                });
            } else {
                clear.push(id);
            }
        }
        return { raise, clear };
    }

    const message = settings.message;
    if (!message || !isLevel(message.level)) {
        return { raise, clear };
    }

    // with a hysteresis the answer depends on whether the message already stands
    const standing = ctx.isActive ? ctx.isActive(stateId) : false;

    if (isConditionMet(message.condition, val, { standing, hysteresis: message.hysteresis })) {
        raise.push({
            id: stateId,
            stateId,
            level: message.level,
            val,
            priority: message.priority,
            requiresAck: message.requiresAck,
            group: message.group,
            delay: message.delay,
            delayGone: message.delayGone,
            text: formatMessageText(message.text || settings.name || stateId, {
                val,
                unit: settings.unit,
                name: settings.name,
                level: message.level,
                isFloatComma: ctx.isFloatComma,
            }),
        });
    } else {
        clear.push(stateId);
    }

    return { raise, clear };
}

/** Most severe first, then the higher priority, then the newest */
export function sortMessages(list: PendingMessage[]): PendingMessage[] {
    return [...list].sort((a, b) => {
        const levelDiff = LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);
        if (levelDiff) {
            return levelDiff;
        }
        if (a.priority !== b.priority) {
            return b.priority - a.priority;
        }
        return b.lastTs - a.lastTs;
    });
}

/**
 * Counters and the most severe standing level
 *
 * @param list the standing messages
 */
export function summarizeMessages(list: PendingMessage[]): MessageSummary {
    const byLevel: Record<MessageLevel, number> = { fatal: 0, error: 0, warning: 0, info: 0 };
    let unacknowledged = 0;

    for (const item of list) {
        byLevel[item.level]++;
        if (!item.acked) {
            unacknowledged++;
        }
    }

    const highest = LEVELS.find(level => byLevel[level] > 0) || '';

    return { total: list.length, unacknowledged, byLevel, highest };
}

/**
 * Build the list for the GUI
 *
 * @param list the standing messages
 */
export function formatMessageList(list: PendingMessage[]): FormattedMessage[] {
    // the first message of a group is the interesting one, the rest is usually its consequence
    const firstOfGroup: Record<string, PendingMessage> = {};
    for (const item of list) {
        if (item.group && (!firstOfGroup[item.group] || item.ts < firstOfGroup[item.group].ts)) {
            firstOfGroup[item.group] = item;
        }
    }

    return sortMessages(list).map(item => {
        const message: FormattedMessage = {
            id: item.id,
            level: item.level,
            text: item.text,
            state: getMessageState(item),
            active: item.active,
            acked: item.acked,
            requiresAck: item.requiresAck,
            ackable: item.requiresAck && !item.acked,
            ts: item.ts,
            lastTs: item.lastTs,
            goneTs: item.goneTs,
            count: item.count,
            priority: item.priority,
            stateId: item.stateId,
            val: item.val,
            icon: item.icon,
            color: item.color || LEVEL_COLORS[item.level],
        };

        if (item.group) {
            message.group = item.group;
            if (firstOfGroup[item.group] === item) {
                message.first = true;
            }
        }
        if (item.flapping) {
            message.flapping = true;
        }

        return message;
    });
}

/**
 * Read the standing messages out of the state `messages.raw`
 *
 * @param val the value of the state
 * @param onError called with the error text if the list cannot be parsed
 */
export function parseMessageList(val: unknown, onError?: (text: string) => void): PendingMessage[] {
    if (!val) {
        return [];
    }
    if (Array.isArray(val)) {
        return val as PendingMessage[];
    }
    if (typeof val === 'string') {
        try {
            const parsed: unknown = JSON.parse(val);
            return Array.isArray(parsed) ? (parsed as PendingMessage[]) : [];
        } catch {
            onError?.(`Cannot parse message list: "${val}"`);
            return [];
        }
    }
    return [];
}

/**
 * The text of the event that a transition writes into the event list
 *
 * @param transition what happened
 * @param message the message
 * @param texts translated words for the transitions
 * @param texts.came word for a message that came
 * @param texts.gone word for a message that went
 * @param texts.acknowledged word for a message that was acknowledged
 * @param texts.flapping word for a message that starts flapping
 * @param texts.settled word for a message that has calmed down again
 */
export function buildTransitionEvent(
    transition: MessageTransition,
    message: PendingMessage,
    texts: { came: string; gone: string; acknowledged: string; flapping?: string; settled?: string },
): { event: string; color: string } {
    const words: Record<MessageTransition, string> = {
        came: texts.came,
        gone: texts.gone,
        ack: texts.acknowledged,
        flapping: texts.flapping || 'flapping',
        settled: texts.settled || 'settled',
    };

    return {
        event: `${message.text} - ${words[transition]}`,
        color: message.color || LEVEL_COLORS[message.level],
    };
}
