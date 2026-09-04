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
exports.MAX_SUPPRESSION_MINUTES = exports.LEVEL_COLORS = exports.LEVELS = void 0;
exports.isLevel = isLevel;
exports.requiresAckByDefault = requiresAckByDefault;
exports.severityToLevel = severityToLevel;
exports.isConditionMet = isConditionMet;
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
exports.evaluateStateMessages = evaluateStateMessages;
exports.sortMessages = sortMessages;
exports.summarizeMessages = summarizeMessages;
exports.formatMessageList = formatMessageList;
exports.parseMessageList = parseMessageList;
exports.buildTransitionEvent = buildTransitionEvent;
/** Levels, ordered from the most to the least severe */
exports.LEVELS = ['fatal', 'error', 'warning', 'info'];
/** Colour of a level, used for the event entry when the message brings no colour of its own */
exports.LEVEL_COLORS = {
    fatal: '#B3122B',
    error: '#D9601A',
    warning: '#E0A800',
    info: '#4A7FA5',
};
/** Levels that have to be acknowledged unless the message says otherwise */
const ACK_BY_DEFAULT = {
    fatal: true,
    error: true,
    warning: false,
    info: false,
};
function isLevel(value) {
    return typeof value === 'string' && exports.LEVELS.includes(value);
}
/**
 * Whether a message of this level has to be acknowledged if the message does not say
 *
 * @param level level of the message
 */
function requiresAckByDefault(level) {
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
function severityToLevel(severity) {
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
    const level = incoming.level || (incoming.severity ? severityToLevel(incoming.severity) : 'info');
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
    if (!level || !isLevel(level)) {
        return false;
    }
    const limit = exports.LEVELS.indexOf(level);
    return list.some(item => item.requiresAck && !item.acked && exports.LEVELS.indexOf(item.level) <= limit);
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
function evaluateStateMessages(stateId, settings, val, ctx) {
    const raise = [];
    const clear = [];
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
                        level: item.level,
                        isFloatComma: ctx.isFloatComma,
                    }),
                    priority: settings.message?.priority,
                    requiresAck: settings.message?.requiresAck,
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
    }
    else {
        clear.push(stateId);
    }
    return { raise, clear };
}
/** Most severe first, then the higher priority, then the newest */
function sortMessages(list) {
    return [...list].sort((a, b) => {
        const levelDiff = exports.LEVELS.indexOf(a.level) - exports.LEVELS.indexOf(b.level);
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
function summarizeMessages(list) {
    const byLevel = { fatal: 0, error: 0, warning: 0, info: 0 };
    let unacknowledged = 0;
    for (const item of list) {
        byLevel[item.level]++;
        if (!item.acked) {
            unacknowledged++;
        }
    }
    const highest = exports.LEVELS.find(level => byLevel[level] > 0) || '';
    return { total: list.length, unacknowledged, byLevel, highest };
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
    return sortMessages(list).map(item => {
        const message = {
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
            color: item.color || exports.LEVEL_COLORS[item.level],
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
        color: message.color || exports.LEVEL_COLORS[message.level],
    };
}
//# sourceMappingURL=messages.js.map