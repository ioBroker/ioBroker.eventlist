import assert from 'node:assert/strict';
import moment from 'moment';

import {
    applyDeleteFilter,
    applyDurationToPreviousEvent,
    buildEventItem,
    duration2text,
    formatEvent,
    formatEventList,
    insertEventItem,
    isDurationUsed,
    isOldValueUsed,
    isAlarmModeOn,
    isSkippedByAlarmMode,
    isValueDisabled,
    normalizeEvent,
    normalizeInsertValue,
    parseEventList,
    prepareStateChangeEvent,
    removeAlarmEvents,
    type EventEngineContext,
    type EventItem,
    type EventTexts,
    type FormattedEvent,
    type StateSettings,
} from '../src/lib/events';
import type { EventListAdapterConfig } from '../src/types';

// The English texts of src/i18n/en.json
const TEXTS: EventTexts = {
    switchedOn: 'switched on',
    switchedOff: 'switched off',
    deviceChangedStatus: 'Device %n changed status:',
    days: 'days',
    hours: 'hours',
    minutes: 'minutes',
    seconds: 'sec',
    ms: 'ms',
};

const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
/** 2020-06-15 12:00:00 local time. It is older than `relativeTime`, so the absolute time is used */
const TS = new Date(2020, 5, 15, 12, 0, 0).getTime();
const TS_TEXT = '2020-06-15 12:00:00';

interface TestContext extends EventEngineContext {
    /** How often the engine requested the cyclic update of the times */
    relativeUsed: number;
}

/** Build the adapter configuration with the defaults of io-package.json */
function createConfig(overrides: Record<string, any> = {}): EventListAdapterConfig {
    return {
        maxLength: 100,
        dateFormat: DATE_FORMAT,
        relativeTime: 3600,
        defaultBooleanTextTrue: '',
        defaultBooleanTextFalse: '',
        defaultBooleanText: '',
        defaultBooleanColorTrue: '',
        defaultBooleanColorFalse: '',
        defaultBooleanIconTrue: '',
        defaultBooleanIconFalse: '',
        defaultNonBooleanText: '',
        defaultStringTexts: [],
        language: 'en',
        stateId: true,
        icons: true,
        duration: true,
        defaultWhatsAppCMB: [],
        defaultTelegram: [],
        defaultPushover: [],
        deleteAlarmsByDisable: false,
        ...overrides,
    } as unknown as EventListAdapterConfig;
}

function createContext(
    states: Record<string, StateSettings> = {},
    configOverrides: Record<string, any> = {},
    isFloatComma = false,
): TestContext {
    const ctx: TestContext = {
        config: createConfig(configOverrides),
        states,
        isFloatComma,
        texts: TEXTS,
        relativeUsed: 0,
        onRelativeTimeUsed: (): void => {
            ctx.relativeUsed++;
        },
    };

    return ctx;
}

/** Format one event and ensure it was not filtered out */
function format(state: EventItem, ctx: EventEngineContext, allowRelative = true): FormattedEvent {
    const event = formatEvent(state, allowRelative, ctx);
    if (!event) {
        throw new Error('The event was unexpectedly filtered out');
    }
    return event;
}

function createState(val: ioBroker.StateValue, ts: number): ioBroker.State {
    return { val, ack: true, ts, lc: ts, from: 'system.adapter.eventlist.0', q: 0 } as ioBroker.State;
}

describe('events engine', () => {
    before(() => {
        // The adapter sets the locale according to the system language. The tests expect English.
        moment.locale('en');
    });

    describe('parseEventList', () => {
        it('returns an empty list for a missing state', () => {
            assert.deepEqual(parseEventList(null), []);
            assert.deepEqual(parseEventList(undefined), []);
        });

        it('returns an empty list for an empty value', () => {
            assert.deepEqual(parseEventList(createState('', TS)), []);
        });

        it('parses the stored JSON string', () => {
            const list = parseEventList(createState('[{"ts":100,"event":"text"}]', TS));
            assert.deepEqual(list, [{ ts: 100, event: 'text' }]);
        });

        it('takes over an already parsed list', () => {
            const table = [{ ts: 100, event: 'text' }];
            const state = createState(null, TS);
            (state as any).val = table;
            assert.equal(parseEventList(state), table);
        });

        it('reports an invalid JSON and returns an empty list', () => {
            const errors: string[] = [];
            const list = parseEventList(createState('[{invalid', TS), text => errors.push(text));
            assert.deepEqual(list, []);
            assert.equal(errors.length, 1);
            assert.match(errors[0], /Cannot parse event list/);
        });
    });

    describe('duration2text', () => {
        it('shows milliseconds under one second', () => {
            assert.equal(duration2text(0, false, TEXTS), '0ms');
            assert.equal(duration2text(999, false, TEXTS), '999ms');
        });

        it('shows tenths of a second under ten seconds', () => {
            assert.equal(duration2text(1500, false, TEXTS), '1.5sec');
            assert.equal(duration2text(1500, true, TEXTS), '1,5sec');
        });

        it('shows full seconds under 90 seconds', () => {
            assert.equal(duration2text(20400, false, TEXTS), '20sec');
            assert.equal(duration2text(65000, false, TEXTS), '65sec');
        });

        it('shows minutes and seconds under one hour', () => {
            assert.equal(duration2text(100000, false, TEXTS), '1minutes 40sec');
        });

        it('shows hours, minutes and seconds up to two hours', () => {
            assert.equal(duration2text(2 * 3600000 + 3 * 60000, false, TEXTS), '2hours 3minutes 0sec');
        });

        it('omits the seconds if longer than two hours', () => {
            assert.equal(duration2text(3 * 3600000 + 5 * 60000, false, TEXTS), '3hours 5minutes');
        });

        it('shows days and hours for long durations', () => {
            assert.equal(duration2text(25 * 3600000, false, TEXTS), '1days 1hours 0minutes');
            assert.equal(duration2text(4 * 24 * 3600000, false, TEXTS), '4days 0hours');
        });

        it('can place spaces between the value and the unit', () => {
            assert.equal(duration2text(500, false, TEXTS, true), '500 ms');
            assert.equal(duration2text(100000, false, TEXTS, true), '1 minutes 40 sec');
        });
    });

    describe('insert message', () => {
        it('accepts a simple text', () => {
            assert.equal(normalizeInsertValue('My custom text'), 'My custom text');
        });

        it('accepts a JSON string with the event description', () => {
            assert.deepEqual(normalizeInsertValue('{"event":"My custom text %s","val":5}'), {
                event: 'My custom text %s',
                val: 5,
            });
        });

        it('uses an invalid JSON string as text', () => {
            assert.equal(normalizeInsertValue('{"event":'), '{"event":');
        });

        it('converts other types to text', () => {
            assert.equal(normalizeInsertValue(42), '42');
            assert.equal(normalizeInsertValue(true), 'true');
        });

        it('converts a text event into an event object', () => {
            assert.deepEqual(normalizeEvent('My custom text', 1600000000000), {
                event: 'My custom text',
                ts: 1600000000000,
            });
        });

        it('takes over an event object as it is', () => {
            const event: EventItem = { ts: TS, event: 'text', val: 5 };
            assert.equal(normalizeEvent(event, 1600000000000), event);
        });
    });

    describe('buildEventItem', () => {
        it('takes over the known attributes', () => {
            const item = buildEventItem(
                { ts: TS, event: 'text', id: 'my.0.state', val: 5, oldVal: 4, icon: 'icon.png' },
                1600000000000,
            );

            assert.equal(item.event, 'text');
            assert.equal(item.id, 'my.0.state');
            assert.equal(item.val, 5);
            assert.equal(item.oldVal, 4);
            assert.equal(item.icon, 'icon.png');
        });

        it('adds the event with the current time if it brings none', () => {
            const item = buildEventItem({ event: 'text' }, 1600000000000);
            assert.equal(item.ts, 1600000000000);
        });

        it('takes the ID from _id if the id is not given', () => {
            const item = buildEventItem({ ts: TS, event: 'text', _id: 'my.0.state' }, 1600000000000);
            assert.equal(item.id, 'my.0.state');
        });

        it('stores falsy values too', () => {
            const item = buildEventItem({ ts: TS, id: 'my.0.state', val: false }, 1600000000000);
            assert.equal(item.val, false);
            assert.ok(Object.prototype.hasOwnProperty.call(item, 'val'));
        });

        it('ignores the duration, as it belongs to the previous event', () => {
            const item = buildEventItem({ ts: TS, event: 'text', duration: 1000 }, 1600000000000);
            assert.equal(item.duration, undefined);
        });

        it('warns about a timestamp outside of the valid range and uses the current time', () => {
            const warnings: string[] = [];
            const item = buildEventItem({ ts: new Date(2001, 0, 1).getTime(), event: 'text' }, 1600000000000, text =>
                warnings.push(text),
            );
            assert.equal(warnings.length, 1);
            assert.match(warnings[0], /Invalid date provided in event/);
            assert.equal(item.ts, 1600000000000);
        });

        it('warns about an unparsable timestamp and uses the current time', () => {
            const warnings: string[] = [];
            const item = buildEventItem({ ts: 'yesterday', event: 'text' }, 1600000000000, text =>
                warnings.push(text),
            );
            assert.equal(warnings.length, 1);
            assert.equal(item.ts, 1600000000000);
        });

        it('uses the timestamp provided with the event', () => {
            const item = buildEventItem({ ts: TS, event: 'text' }, 1600000000000);
            assert.equal(item.ts, TS);
        });

        it('parses a date string as timestamp, as the README and the admin GUI send it', () => {
            const iso = new Date(TS).toISOString();
            assert.equal(buildEventItem({ ts: iso, event: 'text' }, 1600000000000).ts, TS);
            // the value of a "datetime-local" input, which the admin dialog sends
            assert.equal(buildEventItem({ ts: '2020-06-15T12:00:00', event: 'text' }, 1600000000000).ts, TS);
        });

        it('takes over the color of the event', () => {
            const item = buildEventItem({ ts: TS, event: 'text', color: '#FF0000' }, 1600000000000);
            assert.equal(item.color, '#FF0000');
        });
    });

    describe('applyDurationToPreviousEvent', () => {
        it('writes the duration into the previous event of the same state', () => {
            const list: EventItem[] = [
                { ts: 300, id: 'my.0.other' },
                { ts: 200, id: 'my.0.state' },
                { ts: 100, id: 'my.0.state' },
            ];

            applyDurationToPreviousEvent(list, { ts: 400, id: 'my.0.state', duration: 5000 });

            assert.equal(list[1].duration, 5000);
            assert.equal(list[2].duration, undefined);
            assert.equal(list[0].duration, undefined);
        });

        it('does nothing if there is no previous event', () => {
            const list: EventItem[] = [{ ts: 100, id: 'my.0.other' }];
            applyDurationToPreviousEvent(list, { ts: 400, id: 'my.0.state', duration: 5000 });
            assert.equal(list[0].duration, undefined);
        });

        it('does nothing without a duration', () => {
            const list: EventItem[] = [{ ts: 100, id: 'my.0.state', duration: 1 }];
            applyDurationToPreviousEvent(list, { ts: 400, id: 'my.0.state' });
            assert.equal(list[0].duration, 1);
        });
    });

    describe('insertEventItem', () => {
        it('places the newest event at the beginning', () => {
            const list: EventItem[] = [
                { ts: 300, event: 'c' },
                { ts: 100, event: 'a' },
            ];

            insertEventItem(list, { ts: 200, event: 'b' }, 100);

            assert.deepEqual(
                list.map(item => item.event),
                ['c', 'b', 'a'],
            );
        });

        it('makes the timestamps unique', () => {
            const list: EventItem[] = [{ ts: 100, event: 'a' }];
            const item: EventItem = { ts: 100, event: 'b' };

            insertEventItem(list, item, 100);

            assert.equal(item.ts, 101);
            assert.deepEqual(
                list.map(i => i.event),
                ['b', 'a'],
            );
        });

        it('truncates the list to maxLength and keeps the newest events', () => {
            const list: EventItem[] = [
                { ts: 300, event: 'c' },
                { ts: 200, event: 'b' },
                { ts: 100, event: 'a' },
            ];

            insertEventItem(list, { ts: 400, event: 'd' }, 3);

            assert.equal(list.length, 3);
            assert.deepEqual(
                list.map(item => item.event),
                ['d', 'c', 'b'],
            );
        });

        it('does not truncate a short list', () => {
            const list: EventItem[] = [{ ts: 100, event: 'a' }];
            insertEventItem(list, { ts: 200, event: 'b' }, 100);
            assert.equal(list.length, 2);
        });
    });

    describe('alarm mode', () => {
        const states: Record<string, StateSettings> = {
            'my.0.alarm': { alarmsOnly: true },
            'my.0.normal': { alarmsOnly: false },
        };

        it('skips the alarm states if the alarm mode is off', () => {
            assert.equal(isSkippedByAlarmMode({ ts: TS, id: 'my.0.alarm' }, false, states), true);
        });

        it('adds the alarm states if the alarm mode is on', () => {
            assert.equal(isSkippedByAlarmMode({ ts: TS, id: 'my.0.alarm' }, true, states), false);
        });

        it('always adds the normal states', () => {
            assert.equal(isSkippedByAlarmMode({ ts: TS, id: 'my.0.normal' }, false, states), false);
        });

        it('always adds the custom events without an ID', () => {
            assert.equal(isSkippedByAlarmMode({ ts: TS, event: 'text' }, false, states), false);
        });

        it('removes all events of the alarm states', () => {
            const list: EventItem[] = [
                { ts: 300, id: 'my.0.alarm' },
                { ts: 200, id: 'my.0.normal' },
                { ts: 100, event: 'custom event' },
            ];

            const result = removeAlarmEvents(list, states);

            assert.deepEqual(
                result.map(item => item.ts),
                [200, 100],
            );
        });
    });

    describe('isAlarmModeOn', () => {
        it('accepts the usual spellings of on', () => {
            for (const val of [true, 1, 'true', '1', 'ON', 'on']) {
                assert.equal(isAlarmModeOn(val), true, `${JSON.stringify(val)} must switch the alarm mode on`);
            }
        });

        it('treats everything else as off', () => {
            for (const val of [false, 0, 'false', '0', 'OFF', 'off', '', null, undefined]) {
                assert.equal(
                    isAlarmModeOn(val as ioBroker.StateValue),
                    false,
                    `${JSON.stringify(val)} must switch the alarm mode off`,
                );
            }
        });

        it('does not fall for a truthy string', () => {
            // the old code at the start used `!!state.val`, which read "false" as on
            assert.equal(isAlarmModeOn('false'), false);
        });
    });

    describe('isValueDisabled', () => {
        const settings: StateSettings = {
            type: 'number',
            states: [
                { val: '0', text: 'off', color: '', icon: '' },
                { val: '1', text: 'on', color: '', icon: '', disabled: true },
            ],
        };

        it('finds the disabled value in the list', () => {
            assert.equal(isValueDisabled(settings, 1), true);
            assert.equal(isValueDisabled(settings, '1'), true);
        });

        it('does not report an enabled value', () => {
            assert.equal(isValueDisabled(settings, 0), false);
        });

        it('does not report a value that is not in the list', () => {
            assert.equal(isValueDisabled(settings, 7), false);
        });

        it('handles booleans', () => {
            const boolSettings: StateSettings = {
                type: 'boolean',
                states: [
                    { val: 'true', text: '', color: '', icon: '' },
                    { val: 'false', text: '', color: '', icon: '', disabled: true },
                ],
            };
            assert.equal(isValueDisabled(boolSettings, false), true);
            assert.equal(isValueDisabled(boolSettings, true), false);
        });

        it('says no if there are no values or the state is empty', () => {
            assert.equal(isValueDisabled({ type: 'string' }, 'anything'), false);
            assert.equal(isValueDisabled(settings, null), false);
            assert.equal(isValueDisabled(settings, undefined as unknown as ioBroker.StateValue), false);
        });
    });

    describe('applyDeleteFilter', () => {
        const createList = (): EventItem[] => [
            { ts: new Date('2020-10-20T21:00:12.000Z').getTime(), id: 'my.0.state' },
            { ts: new Date('2020-10-20T20:00:12.000Z').getTime(), id: 'my.0.state' },
            { ts: new Date('2020-10-20T19:00:12.000Z').getTime(), id: 'my.0.other' },
            { ts: new Date('2020-10-20T18:00:12.000Z').getTime(), event: 'custom event' },
        ];

        it('deletes the whole list with "*"', () => {
            const result = applyDeleteFilter(createList(), '*');
            assert.equal(result.deleteAll, true);
            assert.equal(result.deleted, 4);
            assert.deepEqual(result.list, []);
        });

        it('deletes the whole list with an empty filter', () => {
            const result = applyDeleteFilter(createList(), '');
            assert.equal(result.deleteAll, true);
            assert.equal(result.deleted, 4);
            assert.deepEqual(result.list, []);
        });

        it('deletes one event by an ISO timestamp', () => {
            const result = applyDeleteFilter(createList(), '2020-10-20T20:00:12.000Z');
            assert.equal(result.deleteAll, false);
            assert.equal(result.deleted, 1);
            assert.equal(result.list.length, 3);
            assert.equal(
                result.list.find(item => item.ts === new Date('2020-10-20T20:00:12.000Z').getTime()),
                undefined,
            );
        });

        it('deletes one event by a numeric timestamp', () => {
            const ts = new Date('2020-10-20T19:00:12.000Z').getTime();
            const result = applyDeleteFilter(createList(), ts);
            assert.equal(result.deleted, 1);
            assert.equal(
                result.list.find(item => item.ts === ts),
                undefined,
            );
        });

        it('deletes nothing if no event has this timestamp', () => {
            const result = applyDeleteFilter(createList(), '2019-10-20T20:00:12.000Z');
            assert.equal(result.deleted, 0);
            assert.equal(result.list.length, 4);
        });

        it('deletes all events of one state ID', () => {
            const result = applyDeleteFilter(createList(), 'my.0.state');
            assert.equal(result.deleteAll, false);
            assert.equal(result.deleted, 2);
            assert.deepEqual(
                result.list.map(item => item.id),
                ['my.0.other', undefined],
            );
        });

        it('deletes nothing for an unknown state ID', () => {
            const result = applyDeleteFilter(createList(), 'my.0.unknown');
            assert.equal(result.deleted, 0);
            assert.equal(result.list.length, 4);
        });
    });

    describe('prepareStateChangeEvent', () => {
        it('ignores a non-changed value if "changesOnly" is enabled', () => {
            const settings: StateSettings = { changesOnly: true, val: 5 };
            assert.equal(prepareStateChangeEvent(createState(5, TS), settings), null);
        });

        it('accepts a changed value if "changesOnly" is enabled', () => {
            const settings: StateSettings = { changesOnly: true, val: 5 };
            const event = prepareStateChangeEvent(createState(6, TS), settings);

            assert.ok(event);
            assert.equal(event!.val, 6);
            assert.equal(settings.val, 6, 'the new value must be stored to detect the next change');
        });

        it('accepts a non-changed value if "changesOnly" is disabled', () => {
            const settings: StateSettings = { changesOnly: false, val: 5 };
            const event = prepareStateChangeEvent(createState(5, TS), settings);
            assert.ok(event);
        });

        it('calculates the duration of the previous value', () => {
            const settings: StateSettings = { durationUsed: true, ts: TS - 30000 };
            const event = prepareStateChangeEvent(createState(true, TS), settings);

            assert.equal(event!.duration, 30000);
            assert.equal(settings.ts, TS, 'the time of the new value must be stored');
        });

        it('reports no duration for the very first value', () => {
            const settings: StateSettings = { durationUsed: true };
            const event = prepareStateChangeEvent(createState(true, TS), settings);
            assert.equal(event!.duration, null);
        });

        it('reports no duration if the new value is older than the previous one', () => {
            const settings: StateSettings = { durationUsed: true, ts: TS + 1000 };
            const event = prepareStateChangeEvent(createState(true, TS), settings);
            assert.equal(event!.duration, null);
        });

        it('calculates the difference of numeric values', () => {
            const settings: StateSettings = { durationUsed: true, type: 'number', val: 10, ts: TS - 1000 };
            const event = prepareStateChangeEvent(createState(15, TS), settings);
            assert.equal(event!.diff, 5);
        });

        it('calculates no difference for non-numeric states', () => {
            const settings: StateSettings = { durationUsed: true, type: 'string', val: 'a', ts: TS - 1000 };
            const event = prepareStateChangeEvent(createState('b', TS), settings);
            assert.equal(event!.diff, undefined);
        });

        it('stores the previous value if it is used in the text', () => {
            const settings: StateSettings = { oldValueUsed: true, changesOnly: true, val: 'old' };
            const event = prepareStateChangeEvent(createState('new', TS), settings);
            assert.equal(event!.oldVal, 'old');
            assert.equal(event!.val, 'new');
        });

        it('does not calculate anything if neither duration nor changes are used', () => {
            const settings: StateSettings = { val: 5 };
            const event = prepareStateChangeEvent(createState(6, TS), settings);

            assert.equal(event!.duration, undefined);
            assert.equal(settings.val, 5);
        });
    });

    describe('isDurationUsed / isOldValueUsed', () => {
        it('detects the duration if it is enabled in the configuration', () => {
            assert.equal(isDurationUsed({}, createConfig({ duration: true })), true);
        });

        it('detects %d in the event text', () => {
            const config = createConfig({ duration: false });
            assert.equal(isDurationUsed({ event: 'was active for %d' }, config), true);
        });

        it('detects %g in the event text', () => {
            const config = createConfig({ duration: false });
            assert.equal(isDurationUsed({ event: 'changed by %g' }, config), true);
        });

        it('detects no duration in a plain text', () => {
            const config = createConfig({ duration: false });
            assert.equal(isDurationUsed({ event: 'just changed' }, config), false);
        });

        it('detects %d in the text of a value', () => {
            const config = createConfig({ duration: false });
            const settings: StateSettings = {
                type: 'number',
                states: [{ val: '1', text: 'was %d in the previous state', color: '', icon: '' }],
            };
            assert.equal(isDurationUsed(settings, config), true);
        });

        it('detects %d in the text of the FALSE value of a boolean', () => {
            const config = createConfig({ duration: false });
            const settings: StateSettings = {
                type: 'boolean',
                states: [{ val: 'false', text: 'was on for %d', color: '', icon: '' }],
            };
            assert.equal(isDurationUsed(settings, config), true);
        });

        it('detects %g in the text of the TRUE value of a boolean', () => {
            const config = createConfig({ duration: false });
            const settings: StateSettings = {
                type: 'boolean',
                states: [{ val: 'true', text: 'changed by %g', color: '', icon: '' }],
            };
            assert.equal(isDurationUsed(settings, config), true);
        });

        it('detects %o in the event text', () => {
            assert.equal(isOldValueUsed({ event: 'changed from %o' }, createConfig()), true);
            assert.equal(isOldValueUsed({ event: 'just changed' }, createConfig()), false);
        });

        it('detects %o in the text of a value', () => {
            const settings: StateSettings = {
                type: 'number',
                states: [{ val: '1', text: 'changed from %o', color: '', icon: '' }],
            };
            assert.equal(isOldValueUsed(settings, createConfig()), true);
        });

        it('detects %o in the text of the TRUE value of a boolean', () => {
            const settings: StateSettings = {
                type: 'boolean',
                states: [{ val: 'true', text: 'switched on from %o', color: '', icon: '' }],
            };
            assert.equal(isOldValueUsed(settings, createConfig()), true);
        });
    });

    describe('formatEvent: patterns', () => {
        it('replaces %s with the value', () => {
            const ctx = createContext();
            const event = format({ ts: TS, event: 'Value is %s', val: 5, duration: 0 }, ctx);
            assert.equal(event.event, 'Value is 5');
        });

        it('replaces %s with a comma as a decimal separator if configured', () => {
            const withPoint = createContext({}, {}, false);
            const withComma = createContext({}, {}, true);

            assert.equal(format({ ts: TS, event: '%s', val: 5.5, duration: 0 }, withPoint).event, '5.5');
            assert.equal(format({ ts: TS, event: '%s', val: 5.5, duration: 0 }, withComma).event, '5,5');
        });

        it('replaces %s with an empty text if there is no value', () => {
            const ctx = createContext();
            assert.equal(format({ ts: TS, event: 'Value is "%s"', duration: 0 }, ctx).event, 'Value is ""');
        });

        it('replaces %n with the name and %u with the unit of the state', () => {
            const ctx = createContext({
                'my.0.temp': { type: 'number', name: 'Temperature', unit: '°C', event: '%n is now %s%u' },
            });

            const event = format({ ts: TS, id: 'my.0.temp', val: 21.5, duration: 0 }, ctx);
            assert.equal(event.event, 'Temperature is now 21.5°C');
        });

        it('replaces %n with the ID if the state has no name', () => {
            const ctx = createContext({ 'my.0.temp': { type: 'number', event: '%n changed' } });
            assert.equal(format({ ts: TS, id: 'my.0.temp', val: 1, duration: 0 }, ctx).event, 'my.0.temp changed');
        });

        it('replaces %t with the absolute time', () => {
            const ctx = createContext();
            assert.equal(format({ ts: TS, event: 'changed at %t', duration: 0 }, ctx).event, `changed at ${TS_TEXT}`);
        });

        it('replaces %r with the relative time', () => {
            const ctx = createContext();
            const event = format({ ts: Date.now() - 60000, event: 'changed %r', duration: 0 }, ctx);
            assert.equal(event.event, 'changed a minute ago');
        });

        it('replaces %d with the duration', () => {
            const ctx = createContext();
            assert.equal(format({ ts: TS, event: 'was on for %d', duration: 65000 }, ctx).event, 'was on for 65sec');
        });

        it('replaces %g with the difference to the previous value', () => {
            const ctx = createContext({}, {}, true);
            const event = format({ ts: TS, event: 'changed by %g', diff: 2.5, duration: 0 }, ctx);
            assert.equal(event.event, 'changed by 2,5');
        });

        it('replaces %g with 0 if there is no difference', () => {
            const ctx = createContext();
            assert.equal(format({ ts: TS, event: 'changed by %g', duration: 0 }, ctx).event, 'changed by 0');
        });

        it('replaces %o with the previous value', () => {
            const ctx = createContext();
            const event = format({ ts: TS, event: 'from %o to %s', oldVal: 5, val: 7, duration: 0 }, ctx);
            assert.equal(event.event, 'from 5 to 7');
        });

        it('replaces %o with "_" if there is no previous value', () => {
            const ctx = createContext();
            assert.equal(format({ ts: TS, event: 'from %o', duration: 0 }, ctx).event, 'from _');
        });

        it('replaces all occurrences of a pattern', () => {
            const ctx = createContext();
            assert.equal(format({ ts: TS, event: '%s = %s', val: 3, duration: 0 }, ctx).event, '3 = 3');
        });
    });

    describe('formatEvent: boolean states', () => {
        it('uses the default texts for a switched on/off device', () => {
            const ctx = createContext({ 'my.0.lamp': { type: 'boolean', name: 'Lamp', event: 'default' } });

            const on = format({ ts: TS, id: 'my.0.lamp', val: true, duration: 0 }, ctx);
            assert.equal(on.event, 'Device Lamp changed status:');
            assert.equal(on.val, 'switched on');

            const off = format({ ts: TS, id: 'my.0.lamp', val: false, duration: 0 }, ctx);
            assert.equal(off.event, 'Device Lamp changed status:');
            assert.equal(off.val, 'switched off');
        });

        it('uses the configured default texts, colors and icons', () => {
            const ctx = createContext(
                { 'my.0.lamp': { type: 'boolean', name: 'Lamp', event: 'default' } },
                {
                    defaultBooleanTextTrue: 'ON',
                    defaultBooleanTextFalse: 'OFF',
                    defaultBooleanColorTrue: '#00FF00',
                    defaultBooleanColorFalse: '#FF0000',
                    defaultBooleanIconTrue: 'on.png',
                    defaultBooleanIconFalse: 'off.png',
                },
            );

            const on = format({ ts: TS, id: 'my.0.lamp', val: true, duration: 0 }, ctx);
            assert.equal(on.val, 'ON');
            assert.deepEqual(on._style, { color: '#00FF00' });
            assert.equal(on.icon, 'on.png');

            const off = format({ ts: TS, id: 'my.0.lamp', val: false, duration: 0 }, ctx);
            assert.equal(off.val, 'OFF');
            assert.deepEqual(off._style, { color: '#FF0000' });
            assert.equal(off.icon, 'off.png');
        });

        it('uses the texts, colors and icons of the values as event text', () => {
            const ctx = createContext({
                'my.0.door': {
                    type: 'boolean',
                    name: 'Door',
                    states: [
                        { val: 'true', text: 'Door opened', color: '#FF0000', icon: 'open.png' },
                        { val: 'false', text: 'Door closed', color: '#00FF00', icon: 'closed.png' },
                    ],
                },
            });

            const opened = format({ ts: TS, id: 'my.0.door', val: true, duration: 0 }, ctx);
            assert.equal(opened.event, 'Door opened');
            assert.deepEqual(opened._style, { color: '#FF0000' });
            assert.equal(opened.icon, 'open.png');

            const closed = format({ ts: TS, id: 'my.0.door', val: false, duration: 0 }, ctx);
            assert.equal(closed.event, 'Door closed');
            assert.deepEqual(closed._style, { color: '#00FF00' });
            assert.equal(closed.icon, 'closed.png');
        });

        it('falls back to the default text if the value text is "default"', () => {
            const ctx = createContext({
                'my.0.door': {
                    type: 'boolean',
                    name: 'Door',
                    states: [{ val: 'true', text: 'default', color: '', icon: '' }],
                },
            });

            assert.equal(format({ ts: TS, id: 'my.0.door', val: true, duration: 0 }, ctx).event, 'switched on');
        });

        it('ignores the disabled values', () => {
            const ctx = createContext({
                'my.0.door': {
                    type: 'boolean',
                    states: [
                        { val: 'true', text: 'Door opened', color: '', icon: '', disabled: true },
                        { val: 'false', text: 'Door closed', color: '', icon: '' },
                    ],
                },
            });

            assert.equal(formatEvent({ ts: TS, id: 'my.0.door', val: true, duration: 0 }, true, ctx), null);
            assert.ok(formatEvent({ ts: TS, id: 'my.0.door', val: false, duration: 0 }, true, ctx));
        });

        it('uses the value texts in the event template', () => {
            const ctx = createContext({
                'my.0.door': {
                    type: 'boolean',
                    name: 'Door',
                    event: '%n: %s',
                    states: [
                        { val: 'true', text: 'opened', color: '', icon: '' },
                        { val: 'false', text: 'closed', color: '', icon: '' },
                    ],
                },
            });

            assert.equal(format({ ts: TS, id: 'my.0.door', val: true, duration: 0 }, ctx).event, 'Door: opened');
            assert.equal(format({ ts: TS, id: 'my.0.door', val: false, duration: 0 }, ctx).event, 'Door: closed');
        });
    });

    describe('formatEvent: numeric and string states', () => {
        it('adds the unit to the value', () => {
            const ctx = createContext({
                'my.0.temp': { type: 'number', name: 'Temperature', unit: '°C', event: 'default' },
            });

            const event = format({ ts: TS, id: 'my.0.temp', val: 21.5, duration: 0 }, ctx);
            assert.equal(event.event, 'Device Temperature changed status:');
            assert.equal(event.val, '21.5°C');
        });

        it('uses a comma as a decimal separator if configured', () => {
            const ctx = createContext(
                { 'my.0.temp': { type: 'number', name: 'Temperature', unit: '°C', event: 'default' } },
                {},
                true,
            );

            assert.equal(format({ ts: TS, id: 'my.0.temp', val: 21.5, duration: 0 }, ctx).val, '21,5°C');
        });

        it('uses the texts of common.states', () => {
            const ctx = createContext({
                'my.0.lock': {
                    type: 'number',
                    name: 'Lock',
                    event: '%n: %s',
                    originalStates: { '0': 'unlocked', '1': 'locked' },
                },
            });

            assert.equal(format({ ts: TS, id: 'my.0.lock', val: 1, duration: 0 }, ctx).event, 'Lock: locked');
            assert.equal(format({ ts: TS, id: 'my.0.lock', val: 0, duration: 0 }, ctx).event, 'Lock: unlocked');
        });

        it('uses the configured texts, colors and icons of the values', () => {
            const ctx = createContext({
                'my.0.mode': {
                    type: 'number',
                    name: 'Mode',
                    event: '%n %s',
                    states: [
                        { val: '0', text: 'is off', color: '#111111', icon: 'off.png' },
                        { val: '1', text: 'is on', color: '#222222', icon: 'on.png' },
                    ],
                },
            });

            const event = format({ ts: TS, id: 'my.0.mode', val: 0, duration: 0 }, ctx);
            assert.equal(event.event, 'Mode is off');
            assert.deepEqual(event._style, { color: '#111111' });
            assert.equal(event.icon, 'off.png');
        });

        it('uses the text of the value as event text if no event text is defined', () => {
            const ctx = createContext({
                'my.0.mode': {
                    type: 'number',
                    name: 'Mode',
                    states: [{ val: '0', text: 'Mode is off', color: '', icon: '' }],
                },
            });

            const event = format({ ts: TS, id: 'my.0.mode', val: 0, duration: 0 }, ctx);
            assert.equal(event.event, 'Mode is off');
            assert.equal(event.val, '');
        });

        it('ignores the disabled values', () => {
            const ctx = createContext({
                'my.0.mode': {
                    type: 'number',
                    states: [{ val: '0', text: 'Mode is off', color: '', icon: '', disabled: true }],
                },
            });

            assert.equal(formatEvent({ ts: TS, id: 'my.0.mode', val: 0, duration: 0 }, true, ctx), null);
        });

        it('formats a string value', () => {
            const ctx = createContext({ 'my.0.text': { type: 'string', name: 'Message', event: '%n: %s' } });
            assert.equal(format({ ts: TS, id: 'my.0.text', val: 'hello', duration: 0 }, ctx).event, 'Message: hello');
        });

        it('uses the default texts for string values', () => {
            const ctx = createContext({ 'my.0.dev': { type: 'string', name: 'Device', event: '%n %s' } }, {
                defaultStringTexts: [{ value: 'ONLINE', text: 'is online', color: '#00FF00', icon: 'ok.png' }],
            });

            const event = format({ ts: TS, id: 'my.0.dev', val: 'ONLINE', duration: 0 }, ctx);
            assert.equal(event.event, 'Device is online');
            assert.deepEqual(event._style, { color: '#00FF00' });
            assert.equal(event.icon, 'ok.png');
        });

        it('formats a null value', () => {
            const ctx = createContext({ 'my.0.text': { type: 'string', name: 'Message', event: '%n: %s' } });
            assert.equal(format({ ts: TS, id: 'my.0.text', val: null, duration: 0 }, ctx).event, 'Message: null');
        });

        it('ignores the events of unknown states', () => {
            const ctx = createContext();
            assert.equal(formatEvent({ ts: TS, id: 'my.0.unknown', val: 1 }, true, ctx), null);
            assert.equal(formatEvent({ ts: TS, val: 1 }, true, ctx), null);
        });
    });

    describe('formatEvent: time, duration and options', () => {
        it('uses the absolute time for old events', () => {
            const ctx = createContext();
            const event = format({ ts: TS, event: 'text', duration: 0 }, ctx);

            assert.equal(event.ts, TS_TEXT);
            assert.equal(event._id, TS);
            assert.equal(ctx.relativeUsed, 0);
        });

        it('uses the relative time for recent events', () => {
            const ctx = createContext();
            const event = format({ ts: Date.now() - 60000, event: 'text', duration: 0 }, ctx);

            assert.equal(event.ts, 'a minute ago');
            assert.equal(ctx.relativeUsed, 1, 'the times must be updated cyclically');
        });

        it('uses the absolute time if the relative time is not allowed', () => {
            const ctx = createContext();
            const ts = new Date(2020, 5, 15, 12, 0, 0).getTime();
            const event = format({ ts, event: 'text', duration: 0 }, ctx, false);

            assert.equal(event.ts, TS_TEXT);
            assert.equal(ctx.relativeUsed, 0);
        });

        it('uses the absolute time if the event is older than "relativeTime"', () => {
            const ctx = createContext({}, { relativeTime: 10 });
            const event = format({ ts: Date.now() - 60000, event: 'text', duration: 0 }, ctx);

            assert.notEqual(event.ts, 'a minute ago');
            assert.equal(ctx.relativeUsed, 0);
        });

        it('marks a running duration and updates it cyclically', () => {
            const ctx = createContext();
            const event = format({ ts: Date.now() - 5000, event: 'text' }, ctx, false);

            assert.equal(event.dr, 1);
            assert.equal(ctx.relativeUsed, 1);
            // the duration is calculated from "now", so it is about 5 seconds
            assert.match(event.duration || '', /^5(\.\d)?sec$/);
        });

        it('shows the duration of a finished event', () => {
            const ctx = createContext();
            const event = format({ ts: TS, event: 'text', duration: 65000 }, ctx);

            assert.equal(event.duration, '65sec');
            assert.equal(event.dr, undefined);
        });

        it('hides the duration if it is disabled', () => {
            const ctx = createContext({}, { duration: false });
            assert.equal(format({ ts: TS, event: 'text', duration: 65000 }, ctx).duration, undefined);
        });

        it('hides the icon if the icons are disabled', () => {
            const ctx = createContext({}, { icons: false });
            const event = format({ ts: TS, event: 'text', icon: 'icon.png', duration: 0 }, ctx);
            assert.equal(event.icon, undefined);
        });

        it('takes over the icon and the ID of a custom event', () => {
            const ctx = createContext();
            const event = format({ ts: TS, event: 'text', icon: 'icon.png', id: 'my.0.state', duration: 0 }, ctx);

            assert.equal(event.icon, 'icon.png');
            assert.equal(event.id, 'my.0.state');
        });
    });

    describe('formatEventList', () => {
        it('formats all events and filters the ignored ones out', () => {
            const ctx = createContext({
                'my.0.door': {
                    type: 'boolean',
                    states: [
                        { val: 'true', text: 'Door opened', color: '', icon: '', disabled: true },
                        { val: 'false', text: 'Door closed', color: '', icon: '' },
                    ],
                },
            });

            const table: EventItem[] = [
                { ts: TS + 3, event: 'custom event', duration: 0 },
                { ts: TS + 2, id: 'my.0.door', val: true, duration: 0 },
                { ts: TS + 1, id: 'my.0.door', val: false, duration: 0 },
                { ts: TS, id: 'my.0.unknown', val: 1, duration: 0 },
            ];

            const json = formatEventList(table, true, ctx);

            assert.deepEqual(
                json.map(item => item.event),
                ['custom event', 'Door closed'],
            );
        });

        it('returns an empty list for an empty table', () => {
            assert.deepEqual(formatEventList([], true, createContext()), []);
        });
    });
});
