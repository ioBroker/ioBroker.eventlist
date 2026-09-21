"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SUPPRESSION_MINUTES = exports.SUB_LEVELS = exports.sortAlarmClasses = exports.severityToLevel = exports.SEVERITY_BANDS = exports.resolveAlarmClass = exports.LEVELS = exports.LEVEL_COLORS = exports.isSubLevel = exports.isLevel = exports.DEFAULT_SEVERITY = exports.buildClassId = exports.builtInId = exports.builtInClasses = exports.buildAlarmClasses = exports.ACK_BY_DEFAULT = void 0;
exports.requiresAckByDefault = requiresAckByDefault;
exports.isConditionMet = isConditionMet;
exports.findMatchingLimit = findMatchingLimit;
exports.formatMessageText = formatMessageText;
exports.isPending = isPending;
exports.getMessageState = getMessageState;
exports.raiseMessage = raiseMessage;
exports.clearMessage = clearMessage;
exports.settleMessages = settleMessages;
exports.acknowledgeMessages = acknowledgeMessages;
exports.parseSuppression = parseSuppression;
exports.addSuppression = addSuppression;
exports.expireSuppressions = expireSuppressions;
exports.isSuppressed = isSuppressed;
exports.visibleMessages = visibleMessages;
exports.isHornOn = isHornOn;
exports.hasMessage = hasMessage;
exports.evaluateStateMessages = evaluateStateMessages;
exports.sortMessages = sortMessages;
exports.summarizeMessages = summarizeMessages;
exports.formatMessageList = formatMessageList;
exports.parseMessageList = parseMessageList;
exports.buildTransitionEvent = buildTransitionEvent;
const levels_1 = require("./levels");
var levels_2 = require("./levels");
Object.defineProperty(exports, "ACK_BY_DEFAULT", { enumerable: true, get: function () { return levels_2.ACK_BY_DEFAULT; } });
Object.defineProperty(exports, "buildAlarmClasses", { enumerable: true, get: function () { return levels_2.buildAlarmClasses; } });
Object.defineProperty(exports, "builtInClasses", { enumerable: true, get: function () { return levels_2.builtInClasses; } });
Object.defineProperty(exports, "builtInId", { enumerable: true, get: function () { return levels_2.builtInId; } });
Object.defineProperty(exports, "buildClassId", { enumerable: true, get: function () { return levels_2.buildClassId; } });
Object.defineProperty(exports, "DEFAULT_SEVERITY", { enumerable: true, get: function () { return levels_2.DEFAULT_SEVERITY; } });
Object.defineProperty(exports, "isLevel", { enumerable: true, get: function () { return levels_2.isLevel; } });
Object.defineProperty(exports, "isSubLevel", { enumerable: true, get: function () { return levels_2.isSubLevel; } });
Object.defineProperty(exports, "LEVEL_COLORS", { enumerable: true, get: function () { return levels_2.LEVEL_COLORS; } });
Object.defineProperty(exports, "LEVELS", { enumerable: true, get: function () { return levels_2.LEVELS; } });
Object.defineProperty(exports, "resolveAlarmClass", { enumerable: true, get: function () { return levels_2.resolveAlarmClass; } });
Object.defineProperty(exports, "SEVERITY_BANDS", { enumerable: true, get: function () { return levels_2.SEVERITY_BANDS; } });
Object.defineProperty(exports, "severityToLevel", { enumerable: true, get: function () { return levels_2.severityToLevel; } });
Object.defineProperty(exports, "sortAlarmClasses", { enumerable: true, get: function () { return levels_2.sortAlarmClasses; } });
Object.defineProperty(exports, "SUB_LEVELS", { enumerable: true, get: function () { return levels_2.SUB_LEVELS; } });
/**
 * Whether a message of this level has to be acknowledged if the message does not say
 *
 * @param level level of the message
 */
function requiresAckByDefault(level) {
    return levels_1.ACK_BY_DEFAULT[level];
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
function isConditionMet(condition, val, options) {
    if (!condition) {
        return false;
    }
    // a comparison wins over an equality, so a wrongly filled form does not silently do both
    if (condition.operator && condition.limit !== undefined && condition.limit !== null) {
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (!isFinite(num)) {
            return false;
        }
        // the hysteresis only widens the range in which the message keeps standing
        const hysteresis = options?.standing && options.hysteresis ? Math.abs(options.hysteresis) : 0;
        let limit = condition.limit;
        if (hysteresis) {
            if (condition.operator === '>' || condition.operator === '>=') {
                limit -= hysteresis;
            }
            else if (condition.operator === '<' || condition.operator === '<=') {
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
function findMatchingLimit(limits, val, classes, standingSeverity) {
    const withClass = limits
        .map(item => ({ item, cls: (0, levels_1.resolveAlarmClass)(item.alarmClass, classes) }))
        .filter((entry) => !!entry.cls);
    withClass.sort((a, b) => b.cls.severity - a.cls.severity);
    for (const { item, cls } of withClass) {
        const standing = standingSeverity !== undefined && standingSeverity >= cls.severity;
        const condition = { operator: item.operator || '>', limit: item.limit };
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
function formatMessageText(text, ctx) {
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
function isPending(message) {
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
function recordChange(message, now, flapping) {
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
function transitionsOf(transition, message, started) {
    if (started) {
        return [{ transition: 'flapping', message }];
    }
    return message.flapping ? [] : [{ transition, message }];
}
/** The code of the combined state, as it is used in control rooms */
function getMessageState(message) {
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
function raiseMessage(list, incoming, now, flapping) {
    const level = incoming.level || (incoming.severity ? (0, levels_1.severityToLevel)(incoming.severity).level : 'info');
    const result = [...list];
    const index = result.findIndex(item => item.id === incoming.id);
    if (index === -1) {
        const message = {
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
        const severityOf = (item) => item.severity ?? levels_1.DEFAULT_SEVERITY[item.level].normal;
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
function clearMessage(list, id, now, flapping) {
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
function settleMessages(list, now, flapping) {
    const transitions = [];
    const result = [];
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
            }
            else {
                result.push(item);
            }
            continue;
        }
        changed = true;
        const message = { ...item, changes };
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
function acknowledgeMessages(list, filter, now, user) {
    const transitions = [];
    const result = [];
    for (const item of list) {
        const matches = filter === '*' || item.id === filter || (!!item.group && item.group === filter);
        if (!matches || item.acked) {
            result.push(item);
            continue;
        }
        const message = { ...item, acked: true, ackTs: now };
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
exports.MAX_SUPPRESSION_MINUTES = 43200;
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
function parseSuppression(val, now, defaultMinutes) {
    let target = '';
    let minutes;
    let until;
    if (typeof val === 'string') {
        const text = val.trim();
        if (!text) {
            return null;
        }
        const match = /^(.+?)[\s:]+(-?[\d.]+)$/.exec(text);
        if (match) {
            target = match[1].trim();
            minutes = parseFloat(match[2]);
        }
        else {
            target = text;
        }
    }
    else if (val && typeof val === 'object') {
        const request = val;
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
    if (minutes > exports.MAX_SUPPRESSION_MINUTES) {
        minutes = exports.MAX_SUPPRESSION_MINUTES;
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
function addSuppression(list, entry) {
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
function expireSuppressions(list, now) {
    return list.filter(item => item.until > now);
}
/**
 * Whether a message is suppressed at the moment. Matches its id, its group and `*`.
 *
 * @param message the message
 * @param suppressions the suppressions
 * @param now the current time
 */
function isSuppressed(message, suppressions, now) {
    return suppressions.some(item => item.until > now &&
        (item.target === '*' || item.target === message.id || (!!message.group && item.target === message.group)));
}
/**
 * The messages that are shown and counted. A suppressed message keeps its state, it is only out of
 * sight until its suppression is over.
 *
 * @param list the standing messages
 * @param suppressions the suppressions
 * @param now the current time
 */
function visibleMessages(list, suppressions, now) {
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
function isHornOn(list, level) {
    if (!level || !(0, levels_1.isLevel)(level)) {
        return false;
    }
    const limit = levels_1.LEVELS.indexOf(level);
    return list.some(item => !item.oneShot && item.requiresAck && !item.acked && levels_1.LEVELS.indexOf(item.level) <= limit);
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
function hasMessage(settings) {
    return (!!settings.message?.alarmClass ||
        !!settings.message?.limits?.length ||
        !!settings.states?.some(item => !!item.alarmClass));
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
function fromClass(cls) {
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
function acknowledgeDuty(configured, cls) {
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
function evaluateStateMessages(stateId, settings, val, ctx) {
    const raise = [];
    const clear = [];
    const valText = val === null || val === undefined ? '' : val.toString();
    const classes = ctx.classes || [];
    const valuesWithClass = (settings.states || [])
        .map(item => ({ item, cls: (0, levels_1.resolveAlarmClass)(item.alarmClass, classes) }))
        .filter((entry) => !!entry.cls);
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
            }
            else {
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
        const cls = reached ? (0, levels_1.resolveAlarmClass)(reached.alarmClass, classes) : null;
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
        }
        else {
            clear.push(stateId);
        }
        return { raise, clear };
    }
    const cls = (0, levels_1.resolveAlarmClass)(message.alarmClass, classes);
    if (!cls) {
        return { raise, clear };
    }
    if (isConditionMet(message.condition, val, {
        standing: standingSeverity !== undefined,
        hysteresis: message.hysteresis,
    })) {
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
    }
    else {
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
function sortMessages(list) {
    return [...list].sort((a, b) => {
        const severityA = a.severity ?? levels_1.DEFAULT_SEVERITY[a.level].normal;
        const severityB = b.severity ?? levels_1.DEFAULT_SEVERITY[b.level].normal;
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
function summarizeMessages(list) {
    const byLevel = { fatal: 0, alarm: 0, warning: 0, info: 0 };
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
    const highest = levels_1.LEVELS.find(level => byLevel[level] > 0) || '';
    return { total, active, unacknowledged, byLevel, highest };
}
/**
 * Build the list for the GUI
 *
 * @param list the standing messages
 */
function formatMessageList(list) {
    // the first message of a group is the interesting one, the rest is usually its consequence
    const firstOfGroup = {};
    for (const item of list) {
        if (item.group && (!firstOfGroup[item.group] || item.ts < firstOfGroup[item.group].ts)) {
            firstOfGroup[item.group] = item;
        }
    }
    // a message that only wrote its coming is kept as the memory of that edge, it is not shown
    return sortMessages(list.filter(item => !item.oneShot)).map(item => {
        const message = {
            id: item.id,
            level: item.level,
            alarmClass: item.alarmClass,
            alarmName: item.alarmName,
            severity: item.severity ?? levels_1.DEFAULT_SEVERITY[item.level].normal,
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
            color: item.color || levels_1.LEVEL_COLORS[item.level],
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
function parseMessageList(val, onError) {
    if (!val) {
        return [];
    }
    if (Array.isArray(val)) {
        return val;
    }
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
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
function buildTransitionEvent(transition, message, texts) {
    const words = {
        came: texts.came,
        gone: texts.gone,
        ack: texts.acknowledged,
        flapping: texts.flapping || 'flapping',
        settled: texts.settled || 'settled',
    };
    return {
        event: `${message.text} - ${words[transition]}`,
        color: message.color || levels_1.LEVEL_COLORS[message.level],
    };
}
//# sourceMappingURL=messages.js.map