import assert from 'node:assert/strict';

import {
    acknowledgeMessages,
    addSuppression,
    buildTransitionEvent,
    builtInClasses,
    DEFAULT_SEVERITY,
    clearMessage,
    evaluateStateMessages,
    expireSuppressions,
    findMatchingLimit,
    formatMessageList,
    formatMessageText,
    getMessageState,
    hasMessage,
    isConditionMet,
    isHornOn,
    isPending,
    isSuppressed,
    MAX_SUPPRESSION_MINUTES,
    parseMessageList,
    parseSuppression,
    raiseMessage,
    requiresAckByDefault,
    settleMessages,
    severityToLevel,
    sortMessages,
    summarizeMessages,
    visibleMessages,
    type FlappingConfig,
    type PendingMessage,
    type Suppression,
} from '../src/lib/messages';

/** The twelve built-in classes, the ones every installation has */
const CLASSES = builtInClasses();

const NOW = new Date(2026, 0, 15, 10, 0, 0).getTime();
const LATER = NOW + 60000;
const TEXTS = { came: 'came', gone: 'gone', acknowledged: 'acknowledged' };

/** Let one message come, the short way into a list */
function withMessage(id = 'my.0.state', level: 'fatal' | 'alarm' | 'warning' | 'info' = 'alarm'): PendingMessage[] {
    return raiseMessage([], { id, level, text: 'Fault' }, NOW).list;
}

describe('message engine', () => {
    describe('levels', () => {
        it('demands an acknowledgement for the two severe levels', () => {
            assert.equal(requiresAckByDefault('fatal'), true);
            assert.equal(requiresAckByDefault('alarm'), true);
            assert.equal(requiresAckByDefault('warning'), false);
            assert.equal(requiresAckByDefault('info'), false);
        });

        it('maps the severity of a foreign system onto the bands', () => {
            assert.deepEqual(severityToLevel(1000), { level: 'fatal', subLevel: 'high' });
            assert.deepEqual(severityToLevel(801), { level: 'fatal', subLevel: 'low' });
            assert.deepEqual(severityToLevel(800), { level: 'alarm', subLevel: 'high' });
            assert.deepEqual(severityToLevel(601), { level: 'alarm', subLevel: 'low' });
            assert.deepEqual(severityToLevel(600), { level: 'warning', subLevel: 'high' });
            assert.deepEqual(severityToLevel(401), { level: 'warning', subLevel: 'low' });
            assert.deepEqual(severityToLevel(400), { level: 'info', subLevel: 'high' });
            assert.deepEqual(severityToLevel(1), { level: 'info', subLevel: 'low' });
        });
    });

    describe('conditions', () => {
        it('compares numbers with the operator', () => {
            assert.equal(isConditionMet({ operator: '>', limit: 80 }, 81), true);
            assert.equal(isConditionMet({ operator: '>', limit: 80 }, 80), false);
            assert.equal(isConditionMet({ operator: '>=', limit: 80 }, 80), true);
            assert.equal(isConditionMet({ operator: '<', limit: 5 }, 4), true);
            assert.equal(isConditionMet({ operator: '<=', limit: 5 }, 5), true);
            assert.equal(isConditionMet({ operator: '==', limit: 5 }, 5), true);
            assert.equal(isConditionMet({ operator: '!=', limit: 5 }, 6), true);
        });

        it('reads a number out of a string', () => {
            assert.equal(isConditionMet({ operator: '>', limit: 80 }, '81'), true);
        });

        it('says no if the value is not a number at all', () => {
            assert.equal(isConditionMet({ operator: '>', limit: 80 }, 'warm'), false);
        });

        it('compares booleans and texts as text', () => {
            assert.equal(isConditionMet({ value: true }, true), true);
            assert.equal(isConditionMet({ value: 'true' }, true), true);
            assert.equal(isConditionMet({ value: true }, false), false);
            assert.equal(isConditionMet({ value: 'OPEN' }, 'OPEN'), true);
            assert.equal(isConditionMet({ value: 3 }, 3), true);
        });

        it('says no without a condition and for an empty value', () => {
            assert.equal(isConditionMet(undefined, true), false);
            assert.equal(isConditionMet({ value: 'x' }, null), false);
        });
    });

    describe('text patterns', () => {
        it('replaces value, unit, name and level', () => {
            const text = formatMessageText('%n: %s%u is critical (%l)', {
                val: 92,
                unit: '%',
                name: 'Boiler',
                level: 'alarm',
            });
            assert.equal(text, 'Boiler: 92% is critical (alarm)');
        });

        it('uses the comma as a decimal separator if the system does', () => {
            assert.equal(formatMessageText('%s', { val: 21.5, level: 'info', isFloatComma: true }), '21,5');
            assert.equal(formatMessageText('%s', { val: 21.5, level: 'info' }), '21.5');
        });

        it('leaves an empty value empty', () => {
            assert.equal(formatMessageText('[%s]', { val: null, level: 'info' }), '[]');
        });
    });

    describe('the four states', () => {
        it('comes as K and stands', () => {
            const list = withMessage();
            assert.equal(list.length, 1);
            assert.equal(getMessageState(list[0]), 'K');
            assert.equal(isPending(list[0]), true);
            assert.equal(list[0].count, 1);
        });

        it('is KQ after the acknowledgement and still stands', () => {
            const list = acknowledgeMessages(withMessage(), '*', LATER, 'ben').list;
            assert.equal(getMessageState(list[0]), 'KQ');
            assert.equal(isPending(list[0]), true);
            assert.equal(list[0].ackUser, 'ben');
        });

        it('is KG after going and stays in the list unacknowledged', () => {
            const list = clearMessage(withMessage(), 'my.0.state', LATER).list;
            assert.equal(list.length, 1);
            assert.equal(getMessageState(list[0]), 'KG');
            assert.equal(list[0].goneTs, LATER);
        });

        it('leaves the list as KGQ, gone and acknowledged', () => {
            const gone = clearMessage(withMessage(), 'my.0.state', LATER).list;
            const change = acknowledgeMessages(gone, '*', LATER + 1);
            assert.equal(change.list.length, 0);
            assert.equal(change.transitions[0].transition, 'ack');
        });

        it('leaves the list right away without an acknowledgement duty', () => {
            const list = raiseMessage([], { id: 'x', level: 'info', text: 'note' }, NOW).list;
            assert.equal(list[0].requiresAck, false);
            const change = clearMessage(list, 'x', LATER);
            assert.equal(change.list.length, 0);
            assert.equal(change.transitions[0].transition, 'gone');
        });
    });

    describe('coming and going', () => {
        it('reports the coming once', () => {
            const first = raiseMessage([], { id: 'x', level: 'alarm', text: 'Fault' }, NOW);
            assert.equal(first.transitions.length, 1);
            assert.equal(first.transitions[0].transition, 'came');

            const again = raiseMessage(first.list, { id: 'x', level: 'alarm', text: 'Fault' }, LATER);
            assert.equal(again.transitions.length, 0, 'a standing message does not come a second time');
            assert.equal(again.list.length, 1);
            assert.equal(again.list[0].count, 1);
        });

        it('counts a repetition instead of adding a second entry', () => {
            const gone = clearMessage(withMessage(), 'my.0.state', LATER).list;
            const again = raiseMessage(gone, { id: 'my.0.state', level: 'alarm', text: 'Fault' }, LATER + 1000);

            assert.equal(again.list.length, 1);
            assert.equal(again.list[0].count, 2);
            assert.equal(again.list[0].active, true);
            assert.equal(again.list[0].goneTs, undefined);
            assert.equal(again.list[0].ts, NOW, 'the first coming stays the start of the standing period');
            assert.equal(again.transitions[0].transition, 'came');
        });

        it('follows the value while the message stands', () => {
            const first = raiseMessage([], { id: 'x', level: 'alarm', text: '80', val: 80 }, NOW);
            const second = raiseMessage(first.list, { id: 'x', level: 'alarm', text: '95', val: 95 }, LATER);
            assert.equal(second.list[0].val, 95);
            assert.equal(second.list[0].text, '95');
            assert.equal(second.transitions.length, 0);
        });

        it('ignores the going of a message that is not there or already gone', () => {
            assert.equal(clearMessage([], 'nothing', NOW).transitions.length, 0);
            const gone = clearMessage(withMessage(), 'my.0.state', LATER).list;
            assert.equal(clearMessage(gone, 'my.0.state', LATER + 1).transitions.length, 0);
        });

        it('takes the level from the severity if none is given', () => {
            const list = raiseMessage([], { id: 'x', severity: 900, text: 'from OPC UA' }, NOW).list;
            assert.equal(list[0].level, 'fatal');
            assert.equal(list[0].severity, 900);
        });
    });

    describe('acknowledgement', () => {
        it('acknowledges only the named message', () => {
            let list = raiseMessage([], { id: 'a', level: 'alarm', text: 'A' }, NOW).list;
            list = raiseMessage(list, { id: 'b', level: 'alarm', text: 'B' }, NOW).list;

            const change = acknowledgeMessages(list, 'a', LATER);
            assert.equal(change.transitions.length, 1);
            assert.equal(change.list.find(m => m.id === 'a')!.acked, true);
            assert.equal(change.list.find(m => m.id === 'b')!.acked, false);
        });

        it('acknowledges everything with a star', () => {
            let list = raiseMessage([], { id: 'a', level: 'alarm', text: 'A' }, NOW).list;
            list = raiseMessage(list, { id: 'b', level: 'fatal', text: 'B' }, NOW).list;

            const change = acknowledgeMessages(list, '*', LATER);
            assert.equal(change.transitions.length, 2);
            assert.equal(change.list.every(m => m.acked), true);
        });

        it('does not acknowledge twice', () => {
            const acked = acknowledgeMessages(withMessage(), '*', LATER).list;
            assert.equal(acknowledgeMessages(acked, '*', LATER + 1).transitions.length, 0);
        });
    });

    describe('states raise messages', () => {
        const settings = {
            name: 'Boiler',
            unit: '°C',
            message: {
                alarmClass: 'alarm.normal',
                text: '%n too hot: %s%u',
                condition: { operator: '>' as const, limit: 90 },
            },
        };

        it('raises the message when the limit is passed', () => {
            const result = evaluateStateMessages('my.0.temp', settings, 95, { classes: CLASSES });
            assert.equal(result.raise.length, 1);
            assert.equal(result.raise[0].id, 'my.0.temp');
            assert.equal(result.raise[0].text, 'Boiler too hot: 95°C');
            assert.deepEqual(result.clear, []);
        });

        it('clears it below the limit', () => {
            const result = evaluateStateMessages('my.0.temp', settings, 20, { classes: CLASSES });
            assert.deepEqual(result.raise, []);
            assert.deepEqual(result.clear, ['my.0.temp']);
        });

        it('does nothing without a level', () => {
            const result = evaluateStateMessages('my.0.temp', { message: { text: 'x' } }, 95, { classes: CLASSES });
            assert.deepEqual(result.raise, []);
            assert.deepEqual(result.clear, []);
        });

        it('gives every value of an enumeration its own message', () => {
            const enumState = {
                name: 'Door',
                states: [
                    { val: '0', text: 'closed', color: '', icon: '' },
                    { val: '1', text: 'open', color: '', icon: '', alarmClass: 'warning.normal' },
                    { val: '2', text: 'broken', color: '', icon: '', alarmClass: 'fatal.normal' },
                ],
            };

            const broken = evaluateStateMessages('my.0.door', enumState, 2, { classes: CLASSES });
            assert.equal(broken.raise.length, 1);
            assert.equal(broken.raise[0].id, 'my.0.door#2');
            assert.equal(broken.raise[0].level, 'fatal');
            assert.equal(broken.raise[0].text, 'broken');
            assert.deepEqual(broken.clear, ['my.0.door#1'], 'the other message of this state goes');

            const closed = evaluateStateMessages('my.0.door', enumState, 0, { classes: CLASSES });
            assert.deepEqual(closed.raise, []);
            assert.deepEqual(closed.clear, ['my.0.door#1', 'my.0.door#2']);
        });

        it('raises a boolean state by its value', () => {
            const boolState = {
                name: 'Water sensor',
                message: { alarmClass: 'fatal.normal', text: '%n reports water', condition: { value: true } },
            };
            assert.equal(evaluateStateMessages('my.0.water', boolState, true, { classes: CLASSES }).raise.length, 1);
            assert.deepEqual(evaluateStateMessages('my.0.water', boolState, false, { classes: CLASSES }).clear, ['my.0.water']);
        });
    });

    describe('list, counters and events', () => {
        const build = (): PendingMessage[] => {
            let list = raiseMessage([], { id: 'w', level: 'warning', text: 'W' }, NOW).list;
            list = raiseMessage(list, { id: 'f', level: 'fatal', text: 'F' }, NOW + 1).list;
            list = raiseMessage(list, { id: 'i', level: 'info', text: 'I', priority: 90 }, NOW + 2).list;
            list = raiseMessage(list, { id: 'i2', level: 'info', text: 'I2', priority: 10 }, NOW + 3).list;
            return list;
        };

        it('sorts by level, then priority, then time', () => {
            assert.deepEqual(
                sortMessages(build()).map(m => m.id),
                ['f', 'w', 'i', 'i2'],
            );
        });

        it('counts per level and names the highest', () => {
            const summary = summarizeMessages(build());
            assert.equal(summary.total, 4);
            assert.equal(summary.active, 4, 'the condition of all of them is true');
            assert.equal(summary.unacknowledged, 1, 'only the fatal one has to be acknowledged');
            assert.equal(summary.highest, 'fatal');
            assert.deepEqual(summary.byLevel, { fatal: 1, alarm: 0, warning: 1, info: 2 });
        });

        it('separates what stands from what is active', () => {
            // the fatal one goes, but nobody has acknowledged it: it stands and is not active
            const gone = clearMessage(build(), 'f', LATER, undefined).list;
            const summary = summarizeMessages(gone);

            assert.equal(summary.total, 4, 'it is still in the list');
            assert.equal(summary.active, 3);
            assert.equal(summary.unacknowledged, 1);
        });

        it('puts the unacknowledged alarm of a level in front of the acknowledged one', () => {
            let list = raiseMessage([], { id: 'a', level: 'fatal', text: 'A' }, NOW).list;
            list = raiseMessage(list, { id: 'b', level: 'fatal', text: 'B' }, NOW + 1).list;
            list = acknowledgeMessages(list, 'b', NOW + 2, 'ben').list;

            assert.deepEqual(
                sortMessages(list).map(m => m.id),
                ['a', 'b'],
                'the newer one was acknowledged, so the older unacknowledged one leads',
            );
        });

        it('reports nothing standing on an empty list', () => {
            const summary = summarizeMessages([]);
            assert.equal(summary.highest, '');
            assert.equal(summary.total, 0);
        });

        it('marks in the formatted list what can still be acknowledged', () => {
            const list = formatMessageList(build());
            assert.equal(list[0].id, 'f');
            assert.equal(list[0].state, 'K');
            assert.equal(list[0].ackable, true, 'fatal has to be acknowledged');
            assert.equal(list.find(m => m.id === 'i')!.ackable, false, 'info has not');
            assert.equal(list[0].color, '#B3122B', 'the level gives the colour');
        });

        it('builds the event text of a transition', () => {
            const message = withMessage()[0];
            assert.equal(buildTransitionEvent('came', message, TEXTS).event, 'Fault - came');
            assert.equal(buildTransitionEvent('gone', message, TEXTS).event, 'Fault - gone');
            assert.equal(buildTransitionEvent('ack', message, TEXTS).event, 'Fault - acknowledged');
            assert.equal(buildTransitionEvent('came', message, TEXTS).color, '#D9601A');
        });
    });

    describe('parseMessageList', () => {
        it('reads the stored list', () => {
            const list = withMessage();
            assert.deepEqual(parseMessageList(JSON.stringify(list)), list);
        });

        it('survives rubbish and emptiness', () => {
            const errors: string[] = [];
            assert.deepEqual(parseMessageList('{noJson', text => errors.push(text)), []);
            assert.equal(errors.length, 1);
            assert.deepEqual(parseMessageList(''), []);
            assert.deepEqual(parseMessageList(null), []);
            assert.deepEqual(parseMessageList('{"a":1}'), [], 'an object is not a list');
        });
    });

    describe('hysteresis', () => {
        it('lets a standing message go only when the value has come back far enough', () => {
            const condition = { operator: '>' as const, limit: 90 };

            assert.equal(isConditionMet(condition, 91), true);
            assert.equal(isConditionMet(condition, 88, { standing: true, hysteresis: 5 }), true, 'it still stands');
            assert.equal(isConditionMet(condition, 84, { standing: true, hysteresis: 5 }), false, 'now it goes');
            assert.equal(
                isConditionMet(condition, 88, { standing: false, hysteresis: 5 }),
                false,
                'for coming the plain limit counts',
            );
        });

        it('turns the hysteresis around for a lower limit', () => {
            const condition = { operator: '<' as const, limit: 10 };

            assert.equal(isConditionMet(condition, 9), true);
            assert.equal(isConditionMet(condition, 12, { standing: true, hysteresis: 5 }), true);
            assert.equal(isConditionMet(condition, 16, { standing: true, hysteresis: 5 }), false);
        });

        it('leaves a comparison of values alone', () => {
            assert.equal(isConditionMet({ value: 'STOP' }, 'RUN', { standing: true, hysteresis: 5 }), false);
            assert.equal(isConditionMet({ value: 'STOP' }, 'STOP', { standing: true, hysteresis: 5 }), true);
        });
    });

    describe('delays, group and hysteresis of a state', () => {
        const settings = {
            name: 'Boiler',
            message: {
                alarmClass: 'alarm.normal',
                text: '%n too hot',
                condition: { operator: '>' as const, limit: 90 },
                hysteresis: 5,
                delay: 3000,
                delayGone: 60000,
                group: 'boiler',
            },
        };

        it('hands the delays and the group to the message', () => {
            const { raise } = evaluateStateMessages('my.0.temp', settings, 95, { classes: CLASSES });

            assert.equal(raise.length, 1);
            assert.equal(raise[0].delay, 3000);
            assert.equal(raise[0].delayGone, 60000);
            assert.equal(raise[0].group, 'boiler');
        });

        it('asks whether the message stands before it lets it go', () => {
            const standing = evaluateStateMessages('my.0.temp', settings, 88, { classes: CLASSES, activeSeverity: () => DEFAULT_SEVERITY.alarm.normal });
            assert.deepEqual(standing.clear, [], 'inside the hysteresis it keeps standing');
            assert.equal(standing.raise.length, 1);

            const gone = evaluateStateMessages('my.0.temp', settings, 88, { classes: CLASSES, activeSeverity: () => undefined });
            assert.deepEqual(gone.clear, ['my.0.temp'], 'it does not come back at 88');
            assert.equal(gone.raise.length, 0);
        });

        it('gives the shared settings to the messages of single values', () => {
            const { raise } = evaluateStateMessages(
                'my.0.pump',
                {
                    ...settings,
                    states: [
                        { val: 'false', text: 'off' },
                        { val: 'true', text: 'fault', alarmClass: 'alarm.normal' },
                    ],
                },
                true,
                { classes: CLASSES },
            );

            assert.equal(raise.length, 1);
            assert.equal(raise[0].id, 'my.0.pump#true');
            assert.equal(raise[0].group, 'boiler');
            assert.equal(raise[0].delay, 3000);
        });
    });

    describe('several limits of one state', () => {
        const LIMITS = [
            { alarmClass: 'warning.normal', operator: '>' as const, limit: 200 },
            { alarmClass: 'fatal.normal', operator: '>' as const, limit: 300, hysteresis: 20 },
            { alarmClass: 'alarm.normal', operator: '<' as const, limit: 50 },
        ];
        const settings = { name: 'Pressure', message: { text: '%n: %s', limits: LIMITS } };

        it('takes the most severe limit the value has reached', () => {
            assert.equal(findMatchingLimit(LIMITS, 150, CLASSES), null, 'below every limit');
            assert.equal(findMatchingLimit(LIMITS, 250, CLASSES)?.alarmClass, 'warning.normal');
            assert.equal(findMatchingLimit(LIMITS, 350, CLASSES)?.alarmClass, 'fatal.normal', 'not the warning it also passed');
            assert.equal(findMatchingLimit(LIMITS, 40, CLASSES)?.alarmClass, 'alarm.normal', 'the low limit counts too');
        });

        it('holds a band until the value has come back through the hysteresis', () => {
            // it stands at fatal, so the fatal limit lets go only below 280
            assert.equal(findMatchingLimit(LIMITS, 290, CLASSES, DEFAULT_SEVERITY.fatal.normal)?.alarmClass, 'fatal.normal');
            assert.equal(findMatchingLimit(LIMITS, 270, CLASSES, DEFAULT_SEVERITY.fatal.normal)?.alarmClass, 'warning.normal', 'one band down');
            // without a standing message the plain limit counts
            assert.equal(findMatchingLimit(LIMITS, 290, CLASSES)?.alarmClass, 'warning.normal');
        });

        it('raises one message whose level follows the value', () => {
            const climbing = evaluateStateMessages('my.0.p', settings, 250, { classes: CLASSES, activeSeverity: () => undefined });
            assert.equal(climbing.raise.length, 1, 'one message, not one per limit');
            assert.equal(climbing.raise[0].id, 'my.0.p');
            assert.equal(climbing.raise[0].level, 'warning');
            assert.equal(climbing.raise[0].text, 'Pressure: 250');

            const higher = evaluateStateMessages('my.0.p', settings, 350, {
                classes: CLASSES,
                activeSeverity: () => DEFAULT_SEVERITY.warning.normal,
            });
            assert.equal(higher.raise[0].level, 'fatal');

            const gone = evaluateStateMessages('my.0.p', settings, 100, {
                classes: CLASSES,
                activeSeverity: () => DEFAULT_SEVERITY.warning.normal,
            });
            assert.deepEqual(gone.clear, ['my.0.p']);
            assert.equal(gone.raise.length, 0);
        });

        it('takes the acknowledgement duty and the priority of the limit', () => {
            const ladder = {
                name: 'Memory',
                message: {
                    text: '%n: %s',
                    priority: 50,
                    limits: [
                        { alarmClass: 'warning.normal', limit: 150 },
                        { alarmClass: 'fatal.normal', limit: 200, requiresAck: true, priority: 90 },
                    ],
                },
            };

            const warning = evaluateStateMessages('my.0.mem', ladder, 160, { classes: CLASSES });
            assert.equal(warning.raise[0].requiresAck, false, 'nothing said, so the class decides');
            assert.equal(warning.raise[0].priority, 50, 'the priority of the state');

            const fatal = evaluateStateMessages('my.0.mem', ladder, 250, { classes: CLASSES });
            assert.equal(fatal.raise[0].requiresAck, true);
            assert.equal(fatal.raise[0].priority, 90, 'the priority of the limit wins');

            // and the message really takes them over
            const list = raiseMessage([], warning.raise[0], NOW).list;
            assert.equal(list[0].requiresAck, false, 'a warning is not acknowledged by default');
            assert.equal(list[0].priority, 50);

            const escalated = raiseMessage(list, fatal.raise[0], LATER).list;
            assert.equal(escalated[0].requiresAck, true);
            assert.equal(escalated[0].priority, 90, 'the priority follows the step');
        });

        it('uses the text of the limit if it brings one', () => {
            const withText = {
                name: 'Pressure',
                message: {
                    text: '%n: %s',
                    limits: [{ alarmClass: 'fatal.normal', limit: 300, text: '%n dangerously high: %s' }],
                },
            };
            const { raise } = evaluateStateMessages('my.0.p', withText, 350, { classes: CLASSES });
            assert.equal(raise[0].text, 'Pressure dangerously high: 350');
        });

        it('counts a changed level as a new occurrence and asks for the acknowledgement again', () => {
            const warning = raiseMessage([], { id: 'p', level: 'warning', text: 'W' }, NOW).list;
            assert.equal(warning[0].requiresAck, false, 'a warning is not acknowledged');

            const acked = acknowledgeMessages(warning, '*', NOW, 'ben').list;
            const escalated = raiseMessage(acked, { id: 'p', level: 'fatal', text: 'F' }, LATER);

            assert.deepEqual(
                escalated.transitions.map(item => item.transition),
                ['came'],
                'the escalation is written',
            );
            assert.equal(escalated.list[0].level, 'fatal');
            assert.equal(escalated.list[0].count, 2);
            assert.equal(escalated.list[0].acked, false, 'the old acknowledgement does not cover the new level');
            assert.equal(escalated.list[0].requiresAck, true, 'now it has to be acknowledged');
        });

        it('lets a message that falls back stop asking for an acknowledgement', () => {
            const fatal = raiseMessage([], { id: 'p', level: 'fatal', text: 'F' }, NOW).list;
            const back = raiseMessage(fatal, { id: 'p', level: 'warning', text: 'W' }, LATER).list;

            assert.equal(back[0].level, 'warning');
            assert.equal(back[0].requiresAck, false);
            assert.equal(isPending(back[0]), true, 'it still stands, it is still active');
        });

        it('says nothing while the level stays the same', () => {
            const first = raiseMessage([], { id: 'p', level: 'warning', text: 'W' }, NOW).list;
            const again = raiseMessage(first, { id: 'p', level: 'warning', text: 'W' }, LATER);

            assert.deepEqual(again.transitions, []);
            assert.equal(again.list[0].count, 1);
        });
    });

    describe('groups', () => {
        const build = (): PendingMessage[] => {
            let list = raiseMessage([], { id: 'a', level: 'alarm', text: 'A', group: 'boiler' }, NOW).list;
            list = raiseMessage(list, { id: 'b', level: 'alarm', text: 'B', group: 'boiler' }, NOW + 1000).list;
            return raiseMessage(list, { id: 'c', level: 'alarm', text: 'C' }, NOW + 2000).list;
        };

        it('acknowledges a whole group at once', () => {
            const change = acknowledgeMessages(build(), 'boiler', LATER, 'ben');

            assert.deepEqual(
                change.transitions.map(item => item.message.id),
                ['a', 'b'],
            );
            assert.equal(change.list.find(item => item.id === 'c')!.acked, false, 'the message outside stays');
        });

        it('marks the message of a group that came first', () => {
            const list = formatMessageList(build());

            assert.equal(list.find(item => item.id === 'a')!.first, true);
            assert.equal(list.find(item => item.id === 'b')!.first, undefined);
            assert.equal(list.find(item => item.id === 'c')!.first, undefined, 'without a group nothing is first');
            assert.equal(list.find(item => item.id === 'a')!.group, 'boiler');
        });
    });

    describe('flapping protection', () => {
        const FLAPPING: FlappingConfig = { count: 4, interval: 60000 };

        /**
         * Let a message come and go a few times
         *
         * @param cycles how often it comes and goes
         * @param level level of the message
         */
        function flap(
            cycles: number,
            level: 'alarm' | 'warning' = 'alarm',
        ): { list: PendingMessage[]; events: string[] } {
            let list: PendingMessage[] = [];
            const events: string[] = [];
            let changes: number[] | undefined;

            for (let i = 0; i < cycles; i++) {
                // the adapter hands the transitions back in, so a message may leave the list in between
                const came = raiseMessage(list, { id: 'x', level, text: 'X', changes }, NOW + i * 2000, FLAPPING);
                list = came.list;
                came.transitions.forEach(item => events.push(item.transition));
                changes = came.transitions[0]?.message.changes || changes;

                const gone = clearMessage(list, 'x', NOW + i * 2000 + 1000, FLAPPING);
                list = gone.list;
                gone.transitions.forEach(item => events.push(item.transition));
                changes = gone.transitions[0]?.message.changes || changes;
            }

            return { list, events };
        }

        it('writes the transitions as long as the message behaves', () => {
            const { events } = flap(2);
            assert.deepEqual(events, ['came', 'gone', 'came', 'gone']);
        });

        it('says once that the message flaps and then keeps quiet', () => {
            const { list, events } = flap(4);

            // the fifth transition inside the window is one too many, after that nothing is written
            assert.deepEqual(events, ['came', 'gone', 'came', 'gone', 'flapping']);
            assert.equal(list[0].flapping, true);
        });

        it('keeps a flapping message in the list although it has gone', () => {
            const { list } = flap(4, 'warning');

            assert.equal(list.length, 1, 'a warning would otherwise be gone');
            assert.equal(list[0].active, false);
            assert.equal(list[0].flapping, true);
        });

        it('lets a calmed down message write again', () => {
            const { list } = flap(4);
            const change = settleMessages(list, NOW + 10 * 60000, FLAPPING);

            assert.deepEqual(
                change.transitions.map(item => item.transition),
                ['settled'],
            );
            assert.equal(change.list[0].flapping, undefined);
            assert.equal(change.list[0].changes, undefined, 'the old transitions are forgotten');
        });

        it('leaves a message that is still restless alone', () => {
            const { list } = flap(4);
            const change = settleMessages(list, NOW + 10000, FLAPPING);

            assert.deepEqual(change.transitions, []);
            assert.equal(change.list[0].flapping, true);
        });

        it('does nothing without a configuration', () => {
            const came = raiseMessage([], { id: 'x', level: 'alarm', text: 'X' }, NOW);
            assert.equal(came.list[0].changes, undefined);
            assert.equal(came.list[0].flapping, undefined);
        });
    });

    describe('suppression', () => {
        it('reads target and duration', () => {
            assert.deepEqual(parseSuppression('boiler', NOW, 60), { target: 'boiler', until: NOW + 3600000 });
            assert.deepEqual(parseSuppression('boiler:30', NOW, 60), { target: 'boiler', until: NOW + 1800000 });
            assert.deepEqual(parseSuppression('boiler 30', NOW, 60), { target: 'boiler', until: NOW + 1800000 });
            assert.deepEqual(parseSuppression({ id: 'my.0.x', minutes: 5 }, NOW, 60), {
                target: 'my.0.x',
                until: NOW + 300000,
            });
            assert.deepEqual(parseSuppression('my.0.state:15', NOW, 60), {
                target: 'my.0.state',
                until: NOW + 900000,
            });
        });

        it('lifts a suppression with a duration of zero', () => {
            assert.deepEqual(parseSuppression('boiler:0', NOW, 60), { target: 'boiler', until: 0 });
            assert.deepEqual(parseSuppression({ target: 'boiler', minutes: 0 }, NOW, 60), {
                target: 'boiler',
                until: 0,
            });
        });

        it('does not let a suppression last for ever', () => {
            const suppression = parseSuppression('boiler:999999', NOW, 60)!;
            assert.equal(suppression.until, NOW + MAX_SUPPRESSION_MINUTES * 60000);
        });

        it('refuses what it cannot read', () => {
            assert.equal(parseSuppression('', NOW, 60), null);
            assert.equal(parseSuppression(null, NOW, 60), null);
            assert.equal(parseSuppression({ minutes: 5 }, NOW, 60), null);
        });

        it('keeps one entry per target and throws out what is over', () => {
            let list: Suppression[] = [];
            list = addSuppression(list, { target: 'boiler', until: NOW + 1000 });
            list = addSuppression(list, { target: 'boiler', until: NOW + 5000 });
            assert.deepEqual(list, [{ target: 'boiler', until: NOW + 5000 }]);

            list = addSuppression(list, { target: 'boiler', until: 0 });
            assert.deepEqual(list, [], 'a lifted suppression is gone');

            list = addSuppression(list, { target: 'a', until: NOW + 1000 });
            list = addSuppression(list, { target: 'b', until: NOW + 9000 });
            assert.deepEqual(expireSuppressions(list, NOW + 5000), [{ target: 'b', until: NOW + 9000 }]);
        });

        it('takes the message, its group and everything out of the list', () => {
            const list = [
                ...raiseMessage([], { id: 'a', level: 'alarm', text: 'A', group: 'boiler' }, NOW).list,
                ...raiseMessage([], { id: 'b', level: 'alarm', text: 'B' }, NOW).list,
            ];

            const byId: Suppression[] = [{ target: 'a', until: LATER }];
            assert.equal(isSuppressed(list[0], byId, NOW), true);
            assert.equal(isSuppressed(list[1], byId, NOW), false);

            const byGroup: Suppression[] = [{ target: 'boiler', until: LATER }];
            assert.equal(isSuppressed(list[0], byGroup, NOW), true);
            assert.equal(isSuppressed(list[1], byGroup, NOW), false);

            const all: Suppression[] = [{ target: '*', until: LATER }];
            assert.deepEqual(visibleMessages(list, all, NOW), []);
            assert.deepEqual(visibleMessages(list, all, LATER + 1), list, 'afterwards everything is back');
            assert.deepEqual(visibleMessages(list, [], NOW), list);
        });
    });

    describe('horn', () => {
        const list = (): PendingMessage[] => {
            const warning = raiseMessage([], { id: 'w', level: 'warning', text: 'W' }, NOW).list;
            return raiseMessage(warning, { id: 'e', level: 'alarm', text: 'E' }, NOW).list;
        };

        it('sounds for an unacknowledged message of that level or a more severe one', () => {
            assert.equal(isHornOn(list(), 'alarm'), true);
            assert.equal(isHornOn(list(), 'fatal'), false, 'nothing fatal stands');
            assert.equal(isHornOn(list(), 'warning'), true, 'the alarm is more severe');
        });

        it('goes quiet with the acknowledgement', () => {
            const acked = acknowledgeMessages(list(), '*', LATER, 'ben').list;
            assert.equal(isHornOn(acked, 'alarm'), false);
        });

        it('stays quiet for a message nobody has to acknowledge and when it is switched off', () => {
            const warning = raiseMessage([], { id: 'w', level: 'warning', text: 'W' }, NOW).list;
            assert.equal(isHornOn(warning, 'warning'), false, 'a warning is not acknowledged');
            assert.equal(isHornOn(list(), ''), false);
            assert.equal(isHornOn(list(), undefined), false);
        });
    });

    describe('hasMessage', () => {
        it('finds the class at the state, at a ladder and at a value', () => {
            assert.equal(hasMessage({ message: { alarmClass: 'alarm.normal' } }), true);
            assert.equal(hasMessage({ message: { limits: [{ alarmClass: 'warning.normal', limit: 200 }] } }), true);
            assert.equal(hasMessage({ states: [{ alarmClass: 'info.normal' }] }), true);
        });

        it('says no without a class, so such a state keeps writing its values', () => {
            assert.equal(hasMessage({}), false);
            assert.equal(hasMessage({ message: {} }), false);
            assert.equal(hasMessage({ message: { text: 'Fault', limits: [] } }), false);
            assert.equal(hasMessage({ states: [{}, {}] }), false);
            assert.equal(hasMessage({ states: null }), false);
        });
    });
});
