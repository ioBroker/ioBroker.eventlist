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

import {
    ACK_BY_DEFAULT,
    type AlarmClass,
    DEFAULT_SEVERITY,
    isLevel,
    LEVEL_COLORS,
    LEVELS,
    type MessageLevel,
    resolveAlarmClass,
    severityToLevel,
} from './levels';

export {
    ACK_BY_DEFAULT,
    type AlarmClass,
    buildAlarmClasses,
    builtInClasses,
    builtInId,
    buildClassId,
    DEFAULT_SEVERITY,
    isLevel,
    isSubLevel,
    LEVEL_COLORS,
    LEVELS,
    type MessageLevel,
    resolveAlarmClass,
    SEVERITY_BANDS,
    severityToLevel,
    sortAlarmClasses,
    SUB_LEVELS,
    type SubLevel,
} from './levels';

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

/**
 * One limit of a state, with the level it raises.
 *
 * Several of them make the ladder a control room works with: `> 200` a warning, `> 300` a fatal, and
 * a low limit below. The most severe limit that is reached wins, so one state raises one message
 * whose level follows the value.
 */
export interface MessageLimit {
    /** Id of the alarm class this limit raises, `alarm.high` for one of the twelve built-in ones */
    alarmClass: string;
    /** Comparison, `>` if it is missing */
    operator?: '>' | '>=' | '<' | '<=' | '==' | '!=';
    limit: number;
    /** How far the value has to come back before this limit lets go again */
    hysteresis?: number;
    /** Text of this limit. Without it the text of the whole state is used. */
    text?: string;
    /**
     * Whether this limit has to be acknowledged. Without it the default of its level counts, so the
     * warning of a ladder passes by and its fatal has to be confirmed.
     */
    requiresAck?: boolean;
    /** 0 to 100, sorts only inside the level. Without it the priority of the whole state counts. */
    priority?: number;
}

/** Message settings of one state, stored in `common.custom[<namespace>].message` */
export interface MessageSettings {
    /** Id of the alarm class the state raises. Without it the state raises no message. */
    alarmClass?: string;
    /**
     * Several limits with their classes. If they are there, they replace `alarmClass` and `condition`.
     */
    limits?: MessageLimit[];
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
    /** Id of the alarm class, if it comes from a state or from a script that knows the classes */
    alarmClass?: string;
    /** Name of the class, so the lists can show it without the settings */
    alarmName?: string;
    level?: MessageLevel;
    /** 1 to 1000, as OPC UA counts it. Without a level it says which level the message lands in. */
    severity?: number;
    /**
     * The message only writes its coming into the event list and never stands.
     *
     * That is what the classes below the alarm line of OPC UA do, `info` above all: there is nothing
     * to acknowledge and nothing to watch, so the message is an entry and not a state.
     */
    oneShot?: boolean;
    text?: string;
    priority?: number;
    requiresAck?: boolean;
    /** The ioBroker state that raised it, if any */
    stateId?: string;
    val?: ioBroker.StateValue;
    /** Unit of the value, so the lists can show the value as the user reads it */
    unit?: string;
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
    /** Id of an alarm class of this installation. It brings level, severity and acknowledgement. */
    alarmClass?: string;
    level?: MessageLevel;
    severity?: number;
    text?: string;
    priority?: number;
    requiresAck?: boolean;
    val?: ioBroker.StateValue;
    unit?: string;
    icon?: string;
    color?: string;
    group?: string;
}

/** A message as it is stored and shown */
export interface PendingMessage {
    id: string;
    level: MessageLevel;
    /** Id of the alarm class it belongs to */
    alarmClass?: string;
    /** Name of the class at the time it came */
    alarmName?: string;
    /** It only wrote its coming and never stands: it is kept as the memory of that edge */
    oneShot?: boolean;
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
    /** Unit of the value, so the table of the messages shows it the way the event list does */
    unit?: string;
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
    /** Id of the alarm class, for the filter of the GUI */
    alarmClass?: string;
    /** Name of the class, empty for one of the twelve built-in ones */
    alarmName?: string;
    /** 1 to 1000 */
    severity: number;
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
    /** When it was acknowledged, and by whom */
    ackTs?: number;
    ackUser?: string;
    count: number;
    priority: number;
    stateId?: string;
    val?: ioBroker.StateValue;
    unit?: string;
    icon?: string;
    color: string;
    group?: string;
    /** The first message of its group, the one that probably caused the others */
    first?: boolean;
    /** It changes too often, its transitions are not written any more */
    flapping?: boolean;
}

export interface MessageSummary {
    /** Everything that stands: active or not acknowledged yet */
    total: number;
    /** The condition of these is true right now */
    active: number;
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
    /** Name of the alarm class, for the pattern %c */
    alarmName?: string;
    isFloatComma?: boolean;
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
 * The most severe limit the value has reached, or null if it has reached none.
 *
 * The message that stands is one, not one per limit, and its level follows the value up and down
 * the ladder. The hysteresis of a limit counts as long as the message stands at that limit or at a
 * more severe one - only then does a value that falls back leave the band it is in.
 *
 * @param limits the configured limits, in any order
 * @param val the current value of the state
 * @param classes the alarm classes of this installation
 * @param standingSeverity severity at which the message stands at the moment, if it stands
 */
export function findMatchingLimit(
    limits: MessageLimit[],
    val: ioBroker.StateValue,
    classes: AlarmClass[],
    standingSeverity?: number,
): MessageLimit | null {
    const withClass = limits
        .map(item => ({ item, cls: resolveAlarmClass(item.alarmClass, classes) }))
        .filter((entry): entry is { item: MessageLimit; cls: AlarmClass } => !!entry.cls);

    withClass.sort((a, b) => b.cls.severity - a.cls.severity);

    for (const { item, cls } of withClass) {
        const standing = standingSeverity !== undefined && standingSeverity >= cls.severity;
        const condition: MessageCondition = { operator: item.operator || '>', limit: item.limit };

        if (isConditionMet(condition, val, { standing, hysteresis: item.hysteresis })) {
            return item;
        }
    }

    return null;
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
    if (result.includes('%c')) {
        // the class of the plant, and the level as the fallback of a built-in class without a name
        result = result.replace(/%c/g, ctx.alarmName || ctx.level);
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
    const level: MessageLevel =
        incoming.level || (incoming.severity ? severityToLevel(incoming.severity).level : 'info');
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
            // a message that only writes its coming has nothing anybody could acknowledge
            requiresAck: incoming.oneShot ? false : (incoming.requiresAck ?? requiresAckByDefault(level)),
            ts: now,
            lastTs: now,
            count: 1,
        };
        // only what is really there, so the stored list stays free of empty fields
        if (incoming.alarmClass) {
            message.alarmClass = incoming.alarmClass;
        }
        if (incoming.alarmName) {
            message.alarmName = incoming.alarmName;
        }
        if (incoming.oneShot) {
            message.oneShot = true;
        }
        if (incoming.stateId !== undefined) {
            message.stateId = incoming.stateId;
        }
        if (incoming.val !== undefined) {
            message.val = incoming.val;
        }
        if (incoming.unit) {
            message.unit = incoming.unit;
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
    if (incoming.unit) {
        existing.unit = incoming.unit;
    }
    if (incoming.text) {
        existing.text = incoming.text;
    }
    if (incoming.level) {
        existing.level = incoming.level;
    }
    if (incoming.alarmClass) {
        // the ladder climbs from one class to the next, and colour and icon follow it
        existing.alarmClass = incoming.alarmClass;
        existing.alarmName = incoming.alarmName;
        existing.icon = incoming.icon;
        existing.color = incoming.color;
    }
    if (incoming.severity !== undefined) {
        existing.severity = incoming.severity;
    }
    if (incoming.priority !== undefined) {
        // with a ladder of limits every step may sort differently inside its level
        existing.priority = incoming.priority;
    }
    if (incoming.group) {
        existing.group = incoming.group;
    }

    if (existing.active) {
        // a message that comes without a severity - a script that only names a level - is compared
        // by the severity its level stands for, otherwise an escalation would go unnoticed
        const severityOf = (item: PendingMessage): number => item.severity ?? DEFAULT_SEVERITY[item.level].normal;

        if (severityOf(existing) === severityOf(result[index]) && existing.alarmClass === result[index].alarmClass) {
            // it already stands at the same class, so this is no new occurrence
            result[index] = existing;
            return { list: result, transitions: [] };
        }

        // A pressure that climbs from the warning limit to the fatal one is a new event: the text
        // and the colour change, and an acknowledgement of the milder state must not cover it. The
        // duty to acknowledge follows the new level, so a message that falls back to a warning stops
        // asking for one instead of demanding a second acknowledgement.
        existing.lastTs = now;
        existing.count++;
        existing.acked = false;
        existing.requiresAck = existing.oneShot
            ? false
            : (incoming.requiresAck ?? requiresAckByDefault(existing.level));
        delete existing.ackTs;
        delete existing.ackUser;

        const escalated = recordChange(existing, now, flapping);
        result[index] = existing;

        return { list: result, transitions: transitionsOf('came', existing, escalated) };
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
    return list.some(item => !item.oneShot && item.requiresAck && !item.acked && LEVELS.indexOf(item.level) <= limit);
}

/**
 * Whether this state raises a message at all: at the state itself, as one class or a ladder of
 * limits, or at one of its values.
 *
 * A state without one must keep writing its value changes, whatever `messagesOnly` says - otherwise
 * a class that was removed would silently switch the state off.
 *
 * @param settings the settings of the state
 * @param settings.message the message of the state itself
 * @param settings.states the settings of the single values
 */
export function hasMessage(settings: {
    message?: MessageSettings;
    states?: Array<{ alarmClass?: string }> | null;
}): boolean {
    return (
        !!settings.message?.alarmClass ||
        !!settings.message?.limits?.length ||
        !!settings.states?.some(item => !!item.alarmClass)
    );
}

/**
 * What the alarm class contributes to every message that is raised with it.
 *
 * The class is the single place where level, severity, colour, icon and the two flags come from, so
 * that a plant which renames `alarm high` into `Boiler pressure` changes one entry and not fifty
 * states.
 *
 * @param cls the alarm class
 */
function fromClass(
    cls: AlarmClass,
): Pick<IncomingMessage, 'alarmClass' | 'alarmName' | 'level' | 'severity' | 'oneShot' | 'icon' | 'color'> {
    return {
        alarmClass: cls.id,
        alarmName: cls.name,
        level: cls.level,
        severity: cls.severity,
        oneShot: !cls.standing,
        icon: cls.icon,
        color: cls.color,
    };
}

/**
 * Whether this message has to be acknowledged: what was configured for it wins, then its class.
 *
 * `fatal` is the exception and is always acknowledged - a fault of that level that nobody has seen
 * must not be able to leave the list.
 *
 * @param configured what the limit or the state says, if it says anything
 * @param cls the alarm class
 */
function acknowledgeDuty(configured: boolean | undefined, cls: AlarmClass): boolean {
    if (cls.level === 'fatal') {
        return true;
    }
    return configured ?? cls.requiresAck;
}

/**
 * Work out which messages a state raises and which it clears.
 *
 * Three ways to configure it. Either single values of the state carry an alarm class, then every
 * such value is its own message and only the current one stands. Or the state carries a ladder of
 * limits, then there is one message whose class follows the value. Or it carries one single
 * condition.
 *
 * @param stateId the state
 * @param settings the message settings of the state, and the values with their classes
 * @param settings.message the limits or the condition and the class of the whole state
 * @param settings.states the single values, each of which may carry a class
 * @param settings.unit unit of the state, for the text
 * @param settings.name name of the state, for the text
 * @param val the new value
 * @param ctx the classes of this installation and what the text and the hysteresis need
 * @param ctx.isFloatComma if the comma is the decimal separator
 * @param ctx.classes all alarm classes of this installation
 * @param ctx.activeSeverity severity at which the message of a state stands, for the hysteresis
 */
export function evaluateStateMessages(
    stateId: string,
    settings: {
        message?: MessageSettings;
        states?: Array<{ val: string; text?: string; alarmClass?: string; icon?: string; color?: string }> | null;
        unit?: string;
        name?: string;
    },
    val: ioBroker.StateValue,
    ctx: {
        isFloatComma?: boolean;
        classes: AlarmClass[];
        activeSeverity?: (id: string) => number | undefined;
    },
): { raise: IncomingMessage[]; clear: string[] } {
    const raise: IncomingMessage[] = [];
    const clear: string[] = [];
    const valText = val === null || val === undefined ? '' : val.toString();
    const classes = ctx.classes || [];

    const valuesWithClass = (settings.states || [])
        .map(item => ({ item, cls: resolveAlarmClass(item.alarmClass, classes) }))
        .filter((entry): entry is { item: (typeof entry)['item']; cls: AlarmClass } => !!entry.cls);

    if (valuesWithClass.length) {
        for (const { item, cls } of valuesWithClass) {
            const id = `${stateId}#${item.val}`;
            if (item.val === valText) {
                raise.push({
                    id,
                    stateId,
                    ...fromClass(cls),
                    val,
                    unit: settings.unit,
                    // what the value brings wins over the colour and the icon of the class
                    icon: item.icon || cls.icon,
                    color: item.color || cls.color,
                    text: formatMessageText(item.text || settings.message?.text || settings.name || stateId, {
                        val,
                        unit: settings.unit,
                        name: settings.name,
                        level: cls.level,
                        alarmName: cls.name,
                        isFloatComma: ctx.isFloatComma,
                    }),
                    priority: settings.message?.priority,
                    requiresAck: acknowledgeDuty(settings.message?.requiresAck, cls),
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
    if (!message || (!message.alarmClass && !message.limits?.length)) {
        return { raise, clear };
    }

    // with a hysteresis the answer depends on whether the message already stands, and with a ladder
    // of limits also on the class it stands at
    const standingSeverity = ctx.activeSeverity?.(stateId);

    if (message.limits?.length) {
        const reached = findMatchingLimit(message.limits, val, classes, standingSeverity);
        const cls = reached ? resolveAlarmClass(reached.alarmClass, classes) : null;

        if (reached && cls) {
            raise.push({
                id: stateId,
                stateId,
                ...fromClass(cls),
                val,
                unit: settings.unit,
                // what the limit says wins, then the state, and only then what the class says
                priority: reached.priority ?? message.priority,
                requiresAck: acknowledgeDuty(reached.requiresAck ?? message.requiresAck, cls),
                group: message.group,
                delay: message.delay,
                delayGone: message.delayGone,
                text: formatMessageText(reached.text || message.text || settings.name || stateId, {
                    val,
                    unit: settings.unit,
                    name: settings.name,
                    level: cls.level,
                    alarmName: cls.name,
                    isFloatComma: ctx.isFloatComma,
                }),
            });
        } else {
            clear.push(stateId);
        }

        return { raise, clear };
    }

    const cls = resolveAlarmClass(message.alarmClass, classes);
    if (!cls) {
        return { raise, clear };
    }

    if (
        isConditionMet(message.condition, val, {
            standing: standingSeverity !== undefined,
            hysteresis: message.hysteresis,
        })
    ) {
        raise.push({
            id: stateId,
            stateId,
            ...fromClass(cls),
            val,
            unit: settings.unit,
            priority: message.priority,
            requiresAck: acknowledgeDuty(message.requiresAck, cls),
            group: message.group,
            delay: message.delay,
            delayGone: message.delayGone,
            text: formatMessageText(message.text || settings.name || stateId, {
                val,
                unit: settings.unit,
                name: settings.name,
                level: cls.level,
                alarmName: cls.name,
                isFloatComma: ctx.isFloatComma,
            }),
        });
    } else {
        clear.push(stateId);
    }

    return { raise, clear };
}

/**
 * The order of a control room: most severe first, and inside one severity what nobody has seen yet.
 *
 * The severity carries the order of the levels in it, so one number is enough: a class of `alarm
 * high` outranks one of `alarm low`, and that one outranks every warning. Then comes the
 * acknowledgement - an unacknowledged alarm is the one that still wants the operator - and only
 * then the priority and the time.
 */
export function sortMessages(list: PendingMessage[]): PendingMessage[] {
    return [...list].sort((a, b) => {
        const severityA = a.severity ?? DEFAULT_SEVERITY[a.level].normal;
        const severityB = b.severity ?? DEFAULT_SEVERITY[b.level].normal;
        if (severityA !== severityB) {
            return severityB - severityA;
        }

        const unackedA = a.requiresAck && !a.acked;
        const unackedB = b.requiresAck && !b.acked;
        if (unackedA !== unackedB) {
            return unackedA ? -1 : 1;
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
    const byLevel: Record<MessageLevel, number> = { fatal: 0, alarm: 0, warning: 0, info: 0 };
    let unacknowledged = 0;
    let active = 0;
    let total = 0;

    for (const item of list) {
        if (item.oneShot) {
            // it never stands, it is only the memory of an entry that was written
            continue;
        }
        total++;
        byLevel[item.level]++;
        if (item.active) {
            active++;
        }
        if (item.requiresAck && !item.acked) {
            unacknowledged++;
        }
    }

    const highest = LEVELS.find(level => byLevel[level] > 0) || '';

    return { total, active, unacknowledged, byLevel, highest };
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

    // a message that only wrote its coming is kept as the memory of that edge, it is not shown
    return sortMessages(list.filter(item => !item.oneShot)).map(item => {
        const message: FormattedMessage = {
            id: item.id,
            level: item.level,
            alarmClass: item.alarmClass,
            alarmName: item.alarmName,
            severity: item.severity ?? DEFAULT_SEVERITY[item.level].normal,
            text: item.text,
            state: getMessageState(item),
            active: item.active,
            acked: item.acked,
            requiresAck: item.requiresAck,
            ackable: item.requiresAck && !item.acked,
            ts: item.ts,
            lastTs: item.lastTs,
            goneTs: item.goneTs,
            ackTs: item.ackTs,
            ackUser: item.ackUser,
            count: item.count,
            priority: item.priority,
            stateId: item.stateId,
            val: item.val,
            unit: item.unit,
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
