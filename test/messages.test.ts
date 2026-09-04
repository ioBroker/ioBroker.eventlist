import assert from 'node:assert/strict';

import {
    acknowledgeMessages,
    addSuppression,
    buildTransitionEvent,
    clearMessage,
    evaluateStateMessages,
    expireSuppressions,
    formatMessageList,
    formatMessageText,
    getMessageState,
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

const NOW = new Date(2026, 0, 15, 10, 0, 0).getTime();
const LATER = NOW + 60000;
const TEXTS = { came: 'came', gone: 'gone', acknowledged: 'acknowledged' };

/** Let one message come, the short way into a list */
function withMessage(id = 'my.0.state', level: 'fatal' | 'error' | 'warning' | 'info' = 'error'): PendingMessage[] {
    return raiseMessage([], { id, level, text: 'Fault' }, NOW).list;
}

describe('message engine', () => {
    describe('levels', () => {
        it('demands an acknowledgement for the two severe levels', () => {
            assert.equal(requiresAckByDefault('fatal'), true);
            assert.equal(requiresAckByDefault('error'), true);
            assert.equal(requiresAckByDefault('warning'), false);
            assert.equal(requiresAckByDefault('info'), false);
        });

        it('maps the severity of a foreign system onto the bands', () => {
            assert.equal(severityToLevel(1000), 'fatal');
            assert.equal(severityToLevel(801), 'fatal');
            assert.equal(severityToLevel(800), 'error');
            assert.equal(severityToLevel(501), 'error');
            assert.equal(severityToLevel(500), 'warning');
            assert.equal(severityToLevel(201), 'warning');
            assert.equal(severityToLevel(200), 'info');
            assert.equal(severityToLevel(1), 'info');
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
                level: 'error',
            });
            assert.equal(text, 'Boiler: 92% is critical (error)');
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
            const first = raiseMessage([], { id: 'x', level: 'error', text: 'Fault' }, NOW);
            assert.equal(first.transitions.length, 1);
            assert.equal(first.transitions[0].transition, 'came');

            const again = raiseMessage(first.list, { id: 'x', level: 'error', text: 'Fault' }, LATER);
            assert.equal(again.transitions.length, 0, 'a standing message does not come a second time');
            assert.equal(again.list.length, 1);
            assert.equal(again.list[0].count, 1);
        });

        it('counts a repetition instead of adding a second entry', () => {
            const gone = clearMessage(withMessage(), 'my.0.state', LATER).list;
            const again = raiseMessage(gone, { id: 'my.0.state', level: 'error', text: 'Fault' }, LATER + 1000);

            assert.equal(again.list.length, 1);
            assert.equal(again.list[0].count, 2);
            assert.equal(again.list[0].active, true);
            assert.equal(again.list[0].goneTs, undefined);
            assert.equal(again.list[0].ts, NOW, 'the first coming stays the start of the standing period');
            assert.equal(again.transitions[0].transition, 'came');
        });

        it('follows the value while the message stands', () => {
            const first = raiseMessage([], { id: 'x', level: 'error', text: '80', val: 80 }, NOW);
            const second = raiseMessage(first.list, { id: 'x', level: 'error', text: '95', val: 95 }, LATER);
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
            let list = raiseMessage([], { id: 'a', level: 'error', text: 'A' }, NOW).list;
            list = raiseMessage(list, { id: 'b', level: 'error', text: 'B' }, NOW).list;

            const change = acknowledgeMessages(list, 'a', LATER);
            assert.equal(change.transitions.length, 1);
            assert.equal(change.list.find(m => m.id === 'a')!.acked, true);
            assert.equal(change.list.find(m => m.id === 'b')!.acked, false);
        });

        it('acknowledges everything with a star', () => {
            let list = raiseMessage([], { id: 'a', level: 'error', text: 'A' }, NOW).list;
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
                level: 'error' as const,
                text: '%n too hot: %s%u',
                condition: { operator: '>' as const, limit: 90 },
            },
        };

        it('raises the message when the limit is passed', () => {
            const result = evaluateStateMessages('my.0.temp', settings, 95, {});
            assert.equal(result.raise.length, 1);
            assert.equal(result.raise[0].id, 'my.0.temp');
            assert.equal(result.raise[0].text, 'Boiler too hot: 95°C');
            assert.deepEqual(result.clear, []);
        });

        it('clears it below the limit', () => {
            const result = evaluateStateMessages('my.0.temp', settings, 20, {});
            assert.deepEqual(result.raise, []);
            assert.deepEqual(result.clear, ['my.0.temp']);
        });

        it('does nothing without a level', () => {
            const result = evaluateStateMessages('my.0.temp', { message: { text: 'x' } }, 95, {});
            assert.deepEqual(result.raise, []);
            assert.deepEqual(result.clear, []);
        });

        it('gives every value of an enumeration its own message', () => {
            const enumState = {
                name: 'Door',
                states: [
                    { val: '0', text: 'closed', color: '', icon: '' },
                    { val: '1', text: 'open', color: '', icon: '', level: 'warning' as const },
                    { val: '2', text: 'broken', color: '', icon: '', level: 'fatal' as const },
                ],
            };

            const broken = evaluateStateMessages('my.0.door', enumState, 2, {});
            assert.equal(broken.raise.length, 1);
            assert.equal(broken.raise[0].id, 'my.0.door#2');
            assert.equal(broken.raise[0].level, 'fatal');
            assert.equal(broken.raise[0].text, 'broken');
            assert.deepEqual(broken.clear, ['my.0.door#1'], 'the other message of this state goes');

            const closed = evaluateStateMessages('my.0.door', enumState, 0, {});
            assert.deepEqual(closed.raise, []);
            assert.deepEqual(closed.clear, ['my.0.door#1', 'my.0.door#2']);
        });

        it('raises a boolean state by its value', () => {
            const boolState = {
                name: 'Water sensor',
                message: { level: 'fatal' as const, text: '%n reports water', condition: { value: true } },
            };
            assert.equal(evaluateStateMessages('my.0.water', boolState, true, {}).raise.length, 1);
            assert.deepEqual(evaluateStateMessages('my.0.water', boolState, false, {}).clear, ['my.0.water']);
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
            assert.equal(summary.unacknowledged, 4);
            assert.equal(summary.highest, 'fatal');
            assert.deepEqual(summary.byLevel, { fatal: 1, error: 0, warning: 1, info: 2 });
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
                level: 'error' as const,
                text: '%n too hot',
                condition: { operator: '>' as const, limit: 90 },
                hysteresis: 5,
                delay: 3000,
                delayGone: 60000,
                group: 'boiler',
            },
        };

        it('hands the delays and the group to the message', () => {
            const { raise } = evaluateStateMessages('my.0.temp', settings, 95, {});

            assert.equal(raise.length, 1);
            assert.equal(raise[0].delay, 3000);
            assert.equal(raise[0].delayGone, 60000);
            assert.equal(raise[0].group, 'boiler');
        });

        it('asks whether the message stands before it lets it go', () => {
            const standing = evaluateStateMessages('my.0.temp', settings, 88, { isActive: () => true });
            assert.deepEqual(standing.clear, [], 'inside the hysteresis it keeps standing');
            assert.equal(standing.raise.length, 1);

            const gone = evaluateStateMessages('my.0.temp', settings, 88, { isActive: () => false });
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
                        { val: 'true', text: 'fault', level: 'error' as const },
                    ],
                },
                true,
                {},
            );

            assert.equal(raise.length, 1);
            assert.equal(raise[0].id, 'my.0.pump#true');
            assert.equal(raise[0].group, 'boiler');
            assert.equal(raise[0].delay, 3000);
        });
    });

    describe('groups', () => {
        const build = (): PendingMessage[] => {
            let list = raiseMessage([], { id: 'a', level: 'error', text: 'A', group: 'boiler' }, NOW).list;
            list = raiseMessage(list, { id: 'b', level: 'error', text: 'B', group: 'boiler' }, NOW + 1000).list;
            return raiseMessage(list, { id: 'c', level: 'error', text: 'C' }, NOW + 2000).list;
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
            level: 'error' | 'warning' = 'error',
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
            const came = raiseMessage([], { id: 'x', level: 'error', text: 'X' }, NOW);
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
                ...raiseMessage([], { id: 'a', level: 'error', text: 'A', group: 'boiler' }, NOW).list,
                ...raiseMessage([], { id: 'b', level: 'error', text: 'B' }, NOW).list,
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
            return raiseMessage(warning, { id: 'e', level: 'error', text: 'E' }, NOW).list;
        };

        it('sounds for an unacknowledged message of that level or a more severe one', () => {
            assert.equal(isHornOn(list(), 'error'), true);
            assert.equal(isHornOn(list(), 'fatal'), false, 'nothing fatal stands');
            assert.equal(isHornOn(list(), 'warning'), true, 'the error is more severe');
        });

        it('goes quiet with the acknowledgement', () => {
            const acked = acknowledgeMessages(list(), '*', LATER, 'ben').list;
            assert.equal(isHornOn(acked, 'error'), false);
        });

        it('stays quiet for a message nobody has to acknowledge and when it is switched off', () => {
            const warning = raiseMessage([], { id: 'w', level: 'warning', text: 'W' }, NOW).list;
            assert.equal(isHornOn(warning, 'warning'), false, 'a warning is not acknowledged');
            assert.equal(isHornOn(list(), ''), false);
            assert.equal(isHornOn(list(), undefined), false);
        });
    });
});
