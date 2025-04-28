'use strict';

const utils = require('@iobroker/adapter-core');
const moment = require('moment');
const fs = require('fs');
const adapterName = require('./package.json').name.split('.').pop();
const words = loadWords();
const list2pdf = require('./lib/list2pdf');

require('moment/locale/fr');
require('moment/locale/de');
require('moment/locale/en-gb');
require('moment/locale/ru');
require('moment/locale/it');
require('moment/locale/es');
require('moment/locale/pt');
require('moment/locale/zh-cn');
require('moment/locale/pl');
require('moment/locale/pt');
require('moment/locale/nl');

const DEFAULT_TEMPLATE = 'default';
const MIN_VALID_DATE = new Date(2019, 0, 1).getTime();
const MAX_VALID_DATE = new Date(2050, 0, 1).getTime();

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
const states = {};
let alarmMode = false;
let momentInterval = null;
let relativeCounter = 0;

let systemLang;
let isFloatComma;
let eventListRaw;
let textSwitchedOn;
let textSwitchedOff;
let textDeviceChangedStatus;
let textDays;
let textHours;
let textMinutes;
let textSeconds;
let textMs;

function loadWords() {
    let lines = fs.existsSync(`${__dirname}/admin/words.js`) ?
        fs.readFileSync(`${__dirname}/admin/words.js`).toString('utf8').split(/\r\n|\n|\r/) :
        fs.readFileSync(`${__dirname}/src/public/words.js`).toString('utf8').split(/\r\n|\n|\r/);

    lines = lines.map(l => l.trim()).map(l => l.replace(/'/g, '"')).filter(l => l);
    const start = lines.findIndex(line => line.startsWith('systemDictionary = {'));
    const end = lines.findIndex(line => line.startsWith('};'));
    lines.splice(end, lines.length - end);
    lines.splice(0, start + 1);
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, ''); // remove last comma

    lines.push('}');
    lines.unshift('{');

    return JSON.parse(lines.join('\n'));
}

function state2json(state) {
    state = state || {};
    let table = state.val || [];

    if (typeof table !== 'object') {
        try {
            table = JSON.parse(table);
        } catch (e) {
            adapter.log.warn(`Cannot parse event list: "${table}"`);
            table = [];
        }
    }

    table = table || [];

    return table;
}

/**
 * Starts the adapter instance
 * @param {Partial<utils.AdapterOptions>} [options]
 */
function startAdapter(options) {
    // Create the adapter and define its methods
    adapter = utils.adapter(Object.assign({}, options, {name: adapterName}));

    adapter.on('ready', main);

    // is called if a subscribed state changes
    adapter.on('stateChange', (id, state) => {
        if (id === `${adapter.namespace}.triggerPDF` && state && !state.ack && state.val) {
            reformatJsonTable(false)
                .then(table => list2pdf(adapter, moment, adapter.instance ? `report-${adapter.instance}.pdf` : 'report.pdf', table))
                .then(() => adapter.setForeignStateAsync(`${adapter.namespace}.triggerPDF`, false, true));
        } else if (id === `${adapter.namespace}.alarm` && state && !state.ack) {
            adapter.log.info(`Switch ALARM state to ${state.val}`);

            alarmMode = state.val === true || state.val === 'true' || state.val === 1 || state.val === '1' || state.val === 'ON' || state.val === 'on';
            if (adapter.config.deleteAlarmsByDisable && !alarmMode) {
                return getRawEventList()
                    .then(eventList => {
                        const alarmIds = Object.keys(states).filter(id => states[id].alarmsOnly);
                        const count = eventList.length;
                        eventListRaw = eventList.filter(item => !alarmIds.includes(item.id));

                        if (eventListRaw.length !== count) {
                            adapter.setStateAsync('eventListRaw', JSON.stringify(eventListRaw), true)
                                .then(count =>
                                    adapter.log.debug(`Removed ${count} from the list after the alarm is deactivated`));
                        }
                    });
            }
        } else if (id === `${adapter.namespace}.eventListRaw` && state && !state.ack && state.val) {
            eventListRaw = state2json(state);
            updateMomentTimes()
                .then(() => {});
        } else if (id === `${adapter.namespace}.insert` && state && !state.ack && state.val) {
            if (typeof state.val === 'string' && state.val.startsWith('{')) {
                try {
                    state.val = JSON.parse(state.val);
                } catch (e) {
                    // ignore
                }
                addEvent(state.val)
                    .then(event =>
                        adapter.log.debug(`Event ${JSON.stringify(event)} was added`));
            } else {
                addEvent({event: state.val})
                    .then(event =>
                        adapter.log.debug(`Event ${JSON.stringify(event)} was added`));
            }
        } else if (id === `${adapter.namespace}.delete` && state && !state.ack && state.val) {
            deleteEvents(state.val)
                .then(count =>
                    adapter.log.debug(`${count} events were deleted from the list`));
        } else if (states[id] && state) {
            if (states[id].states && state.val !== null && state.val !== undefined && states[id].states[state.val.toString()] && states[id].states[state.val.toString()].disabled) {
                adapter.log.debug(`Value ${state.val} of ${id} was ignored, because disabled`);
                return;
            }

            if (states[id].oldValueUsed) {
                state.oldVal = states[id].val;
            }

            // ignore non changed states
            if (states[id].changesOnly) {
                if (state && states[id].val === state.val) {
                    return;
                } else {
                    // calculate duration
                    if (states[id].durationUsed) {
                        // this event is only started, and we must update the duration of the previous event
                        if (states[id].ts && state.ts >= states[id].ts) {
                            state.duration = state.ts - states[id].ts;
                        } else {
                            state.duration = null;
                        }
                        states[id].ts = state.ts;

                        if (states[id].type === 'number' && states[id].val !== null && states[id].val !== undefined && state.val !== null && state.val !== undefined) {
                            state.diff = state.val - states[id].val;
                        }
                    }
                    states[id].val = state.val;
                }
            } else if (states[id].durationUsed) {
                // calculate duration
                if (states[id].ts && state.ts >= states[id].ts) {
                    state.duration = state.ts - states[id].ts;
                } else {
                    state.duration = null;
                }
                states[id].ts = state.ts;

                if (states[id].type === 'number' && states[id].val !== null && states[id].val !== undefined && state.val !== null && state.val !== undefined) {
                    state.diff = state.val - states[id].val;
                }
                states[id].val = state.val;
            }

            state.id = id;

            addEvent(state)
                .then(event =>
                    adapter.log.debug(`Event ${JSON.stringify(event)} was added`));
        }
    });

    adapter.on('message', obj => {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'insert') {
                // e.g. send email or pushover or whatever
                adapter.log.debug(`insert event: ${JSON.stringify(obj.message)}`);

                addEvent(obj.message)
                    .then(() => obj.callback && adapter.sendTo(obj.from, obj.command, {result: 'event inserted'}, obj.callback));
            } else if (obj.command === 'pdf') {
                reformatJsonTable(false)
                    .then(table => list2pdf(adapter, moment, adapter.instance ? `report-${adapter.instance}.pdf` : 'report.pdf', table, obj.message))
                    .then(() => obj.callback && adapter.sendTo(obj.from, obj.command, {result: 'rendered'}, obj.callback));
            } else if (obj.command === 'list') {
                getRawEventList()
                    .then(table => {
                        table = table || [];
                        // filter items
                        if (obj.message && (typeof obj.message === 'string' || typeof obj.message.id === 'string' || typeof obj.message.ids === 'object')) {
                            let ids = typeof obj.message === 'string' ? obj.message : null;
                            if (!ids && typeof obj.message.id === 'string') {
                                ids = typeof obj.message.id;
                            }
                            if (!ids && typeof obj.message.ids === 'object') {
                                ids = [...obj.message.ids];
                            }
                            if (typeof ids === 'string') {
                                ids = [ids];
                            }

                            // filter table
                            table = table.filter(item => (!item.id && ids.includes('custom')) || ids.includes(item.id));
                        }
                        if (obj.message && obj.message.count && parseInt(obj.message.count, 10) && parseInt(obj.message.count, 10) < table.length) {
                            table = table.splice(obj.message.count);
                        }

                        reformatJsonTable(obj.message.allowRelative === undefined ? true : obj.message.allowRelative, table)
                            .then(() => obj.callback && adapter.sendTo(obj.from, obj.command, table, obj.callback));
                    });
            } else if (obj.command === 'delete') {
                deleteEvents(obj.message)
                    .then(count => obj.callback && adapter.sendTo(obj.from, obj.command, {deleted: count}, obj.callback));
            }
        }
    });

    adapter.on('objectChange', (id, obj) =>
        updateStateSettings(id, obj)
            .then(changed => {
                if (changed) {
                    return updateMomentTimes();
                }
            }));

    adapter.on('unload', cb => {
        momentInterval && clearInterval(momentInterval);
        momentInterval = null;
        cb && cb();
    });

    return adapter;
}

function deleteEvents(filter) {
    return getRawEventList()
        .then(eventList => {
            const count = eventList.length;
            if (!filter || filter === '*') { // delete all
                eventListRaw = [];
                return adapter.setStateAsync('eventListRaw', JSON.stringify(eventListRaw), true)
                    .then(() => count);
            } else
            // Delete by timestamp
            if (typeof filter === 'number' || (filter.toString()[0] === '2' && filter.length === new Date().toISOString())) { // Attention: this will stop to work in 3000.01.01 :)
                const ts = new Date(filter).getTime();
                eventListRaw = eventList.filter(item => item.ts !== ts);
                if (eventListRaw.length !== count) {
                    return adapter.setStateAsync('eventListRaw', JSON.stringify(eventListRaw), true)
                        .then(() => count - eventListRaw.length);
                } else {
                    return Promise.resolve(0);
                }
            } else {
                // Delete by State ID
                eventListRaw = eventList.filter(item => item.id !== filter);
                if (eventListRaw.length !== count) {
                    return adapter.setStateAsync('eventListRaw', JSON.stringify(eventListRaw), true)
                        .then(() => count - eventListRaw.length);
                } else {
                    return Promise.resolve(0);
                }
            }
        });
}

function duration2text(ms, withSpaces) {
    if (ms < 1000) {
        return `${ms}${withSpaces ? ' ' : ''}${textMs}`;
    } else if (ms < 10000) {
        return `${isFloatComma ? (Math.round(ms / 100) / 10).toString().replace('.', ',') : (Math.round(ms / 100) / 10).toString()}${withSpaces ? ' ' : ''}${textSeconds}`;
    } else if (ms < 90000) {
        return `${isFloatComma ? Math.round(ms / 1000).toString().replace('.', ',') : Math.round(ms / 1000).toString()}${withSpaces ? ' ' : ''}${textSeconds}`;
    } else if (ms < 3600000) {
        return `${Math.floor(ms / 60000)}${withSpaces ? ' ' : ''}${textMinutes} ${Math.round((ms % 60000) / 1000)}${withSpaces ? ' ' : ''}${textSeconds}`;
    }
    let hours   = Math.floor(ms / 3600000);
    const minutes = Math.floor(ms / 60000) % 60;
    const seconds = Math.round(Math.floor(ms % 60000) / 1000);
    if (hours > 24) {
        const days = Math.floor(hours / 24);
        hours %= 24;
        if (days > 2) {
            return `${days}${withSpaces ? ' ' : ''}${textDays} ${hours}${withSpaces ? ' ' : ''}${textHours}`;
        }
        return `${days}${withSpaces ? ' ' : ''}${textDays} ${hours}${withSpaces ? ' ' : ''}${textHours} ${minutes}${withSpaces ? ' ' : ''}${textMinutes}`;
    }

    if (hours > 2) {
        return `${hours}${withSpaces ? ' ' : ''}${textHours} ${minutes}${withSpaces ? ' ' : ''}${textMinutes}`;
    }
    return `${hours}${withSpaces ? ' ' : ''}${textHours} ${minutes}${withSpaces ? ' ' : ''}${textMinutes} ${seconds}${withSpaces ? ' ' : ''}${textSeconds}`;
}

function formatEvent(state, allowRelative) {
    const event = {};
    let eventTemplate = '';
    let val;
    let valWithUnit;
    let color = state.color || '';
    let icon = '';

    const date = new Date(state.ts);
    let time;

    if (allowRelative && Date.now() - date.getTime() < adapter.config.relativeTime * 1000) {
        relativeCounter++;
        if (!momentInterval) {
            momentInterval = setInterval(() => updateMomentTimes(), 10000);
        }
        time = moment(date).fromNow();
    } else {
        time = moment(date).format(adapter.config.dateFormat);
    }

    event._id = date.getTime();

    if (!state.event) {
        const id = state.id || state._id;
        if (!states[id]) {
            return null;
        }
        if (states[id].type === 'boolean') {
            val = state.val ? 'true' : 'false';

            const item = states[id].states && states[id].states.find(item => item.val === val);

            if (item && item.disabled) {
                return null;
            }

            if (!states[id].event && state.val && item && item.text) {
                eventTemplate = item.text === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextTrue || textSwitchedOn : item.text;
                color         = item.color || adapter.config.defaultBooleanColorTrue || states[id].color;
                icon          = item.icon  || states[id].icon || undefined;
            } else if (!states[id].event && !state.val && item && item.text) {
                eventTemplate = item.text === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextFalse || textSwitchedOff : item.text;
                color         = item.color || adapter.config.defaultBooleanColorFalse || states[id].color;
                icon          = item.icon || states[id].icon || undefined;
            } else {
                if (states[id].event === DEFAULT_TEMPLATE) {
                    eventTemplate = adapter.config.defaultBooleanText || textDeviceChangedStatus;
                } else {
                    eventTemplate = states[id].event;
                }

                if (eventTemplate === null || eventTemplate === undefined) {
                    eventTemplate = '';
                } else if (typeof eventTemplate !== 'string') {
                    eventTemplate = eventTemplate.toString();
                }

                eventTemplate = eventTemplate.replace(/%u/g, states[id].unit || '');
                eventTemplate = eventTemplate.replace(/%n/g, states[id].name || id);
                if (item) {
                    val = state.val ?
                        (item.text === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextTrue  || textSwitchedOn : item.text || textSwitchedOn)
                        :
                        (item.text === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextFalse || textSwitchedOff : item.text || textSwitchedOff);

                    icon = state.val ?
                        (item.icon === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanIconTrue  || states[id].icon || '' : item.icon || states[id].icon || '')
                        :
                        (item.icon === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanIconFalse || states[id].icon || '' : item.icon || states[id].icon || '');

                    color = state.val ?
                        (item.color === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanColorTrue  || states[id].color || '' : item.color || states[id].color || '')
                        :
                        (item.color === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanColorFalse || states[id].color || '' : item.color || states[id].color || '');
                } else {
                    val = state.val ?
                        adapter.config.defaultBooleanTextTrue  || textSwitchedOn
                        :
                        adapter.config.defaultBooleanTextFalse || textSwitchedOff;

                    icon = state.val ?
                        (adapter.config.defaultBooleanIconTrue  || states[id].icon || '')
                        :
                        (adapter.config.defaultBooleanIconFalse || states[id].icon || '');

                    color = state.val ?
                        (adapter.config.defaultBooleanColorTrue  || states[id].color || '')
                        :
                        (adapter.config.defaultBooleanColorFalse || states[id].color || '');
                }

                valWithUnit = val;
            }
        } else {
            eventTemplate = states[id].event === DEFAULT_TEMPLATE ? adapter.config.defaultNonBooleanText || textDeviceChangedStatus : states[id].event || textDeviceChangedStatus;
            eventTemplate = eventTemplate.replace(/%u/g, states[id].unit || '');
            eventTemplate = eventTemplate.replace(/%n/g, states[id].name || id);

            val = state.val !== undefined ? state.val : '';

            if (val === null) {
                val = 'null';
            } else if (typeof val === 'number') {
                val = val.toString();
                if (isFloatComma) {
                    val = val.replace('.', ',');
                }
            } else {
                val = val.toString();
            }

            if (states[id].states) {
                // try to find text for value in states
                const item = states[id].states.find(item => item.val === val);
                const stateText = states[id].originalStates[item.val];
                const def = adapter.config.defaultStringTexts && adapter.config.defaultStringTexts.find(it => it.value === stateText || it.value === val);

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
                } else if (states[id].originalStates) {
                    val = states[id].originalStates[val] === undefined ? val : states[id].originalStates[val];
                }

                if (!states[id].event && val) {
                    eventTemplate = val;
                    val = '';
                }
            } else if (states[id].originalStates) {
                val = states[id].originalStates[val] === undefined ? val : states[id].originalStates[val];
                const def = adapter.config.defaultStringTexts && adapter.config.defaultStringTexts.find(it => it.value === val);
                if (def) {
                    val = def.text;
                    color = def.color;
                    icon = def.icon;
                }
            } else {
                const def = adapter.config.defaultStringTexts && adapter.config.defaultStringTexts.find(it => it.value === val);
                if (def) {
                    val = def.text;
                    color = def.color;
                    icon = def.icon;
                }
            }

            if (val !== '' && states[id].unit) {
                valWithUnit = val + states[id].unit;
            } else {
                valWithUnit = val;
            }

            icon  = icon  || states[id].icon;
            color = color || states[id].color;
            // todo => change bright of icon depends on value and min/max
        }
    } else {
        eventTemplate = state.event;
        icon  = state.icon  || undefined;
        color = state.color || undefined;

        if (state.val !== undefined) {
            val = state.val;
            if (val === null) {
                val = 'null';
            } else if (typeof val === 'number') {
                val = val.toString();
                if (isFloatComma) {
                    val = val.replace('.', ',');
                }
            } else {
                val = val.toString();
            }
        }
    }

    if (icon) {
        color = color || (typeof icon === 'object' ? icon.color : '');
        icon = typeof icon === 'object' ? icon.icon : icon;

        /*if (!icon.startsWith('data:')) {
            if (icon.includes('.')) {
                icon = '/adapter/' + (event.id || '').split('.').shift() + '/' + icon;
            } else {
                icon = '';
            }
        }*/
    }

    let durationText;
    if (state.duration !== undefined) {
        durationText = duration2text(state.duration);
    } else {
        durationText = duration2text(Date.now() - state.ts);
        event.dr = 1; // duration running
        relativeCounter++;
        if (!momentInterval) {
            momentInterval = setInterval(() => updateMomentTimes(), 10000);
        }
    }

    if (eventTemplate.includes('%d')) {
        eventTemplate = eventTemplate.replace(/%d/g, durationText);
    }

    if (eventTemplate.includes('%g')) {
        eventTemplate = eventTemplate.replace(/%g/g, isFloatComma ? state.diff.toString().replace('.', ',') : state.diff);
    }

    if (eventTemplate.includes('%o')) {
        eventTemplate = eventTemplate.replace(/%o/g, isFloatComma ? (state.oldVal === undefined || state.oldVal === null ? '_' : state.oldVal).toString().replace('.', ',') : (state.oldVal === undefined || state.oldVal === null ? '_' : state.oldVal));
    }

    if (eventTemplate.includes('%s')) {
        eventTemplate = eventTemplate.replace(/%s/g, val === undefined ? '' : val);
        valWithUnit = '';
    }

    if (eventTemplate.includes('%t')) {
        eventTemplate = eventTemplate.replace(/%t/g, moment(new Date(state.ts)).format(adapter.config.dateFormat));
    }

    if (eventTemplate.includes('%r')) {
        eventTemplate = eventTemplate.replace(/%r/g, moment(new Date(state.ts)).fromNow());
    }

    event.event = eventTemplate;
    event.ts = time;

    if (color) {
        event._style = {color};
    }
    if (icon && adapter.config.icons) {
        event.icon = icon;
    }
    if (durationText && adapter.config.duration) {
        event.duration = durationText;
    }

    if (valWithUnit !== '') {
        event.val = valWithUnit;
    } else {
        event.val = val;
    }
    // because of filter add event.id
    if (state.id) {
        event.id = state.id;
    }

    return event;
}

function sendTelegram(event) {
    if (event.id && states[event.id] &&
        (alarmMode || !states[event.id].messagesInAlarmsOnly) &&
        ((states[event.id].defaultMessengers && adapter.config.defaultTelegram && adapter.config.defaultTelegram.length) ||
        (!states[event.id].defaultMessengers && states[event.id].telegram && states[event.id].telegram.length))
    ) {
        const instances = (states[event.id].defaultMessengers && adapter.config.defaultTelegram) ||
            (!states[event.id].defaultMessengers && states[event.id].telegram);

        const ev = formatEvent(event, true);
        if (ev) {
            const text = ev.event + (ev.val !== undefined ? ' => ' + ev.val.toString() + (states[event.id].unit || '') : '');
            adapter.log.debug(`Send to 'telegram.${instances.join(',')}' => ${text}`);

            instances.forEach(num =>
                adapter.sendTo(`telegram.${num}`, 'send', {text}));
        }
    }

    return Promise.resolve();
}

function sendWhatsApp(event) {
    if (event.id && states[event.id] &&
        (alarmMode || !states[event.id].messagesInAlarmsOnly) &&
        ((states[event.id].defaultMessengers && adapter.config.defaultWhatsAppCMB && adapter.config.defaultWhatsAppCMB.length) ||
        (!states[event.id].defaultMessengers && states[event.id].whatsAppCMB && states[event.id].whatsAppCMB.length))
    ) {
        const instances = (states[event.id].defaultMessengers && adapter.config.defaultWhatsAppCMB) ||
            (!states[event.id].defaultMessengers && states[event.id].whatsAppCMB);

        const ev = formatEvent(event, true);
        if (ev) {
            const text = ev.event + (ev.val !== undefined ? ` => ${ev.val.toString()}${states[event.id].unit || ''}` : '');
            adapter.log.debug(`Send to 'telegram.${instances.join(',')}' => ${text}`);

            instances.forEach(num =>
                adapter.sendTo(`whatsapp-cmb.${num}`, 'send', {text}));
        }
    }

    return Promise.resolve();
}

function sendPushover(event) {
    if (event.id && states[event.id] &&
        (alarmMode || !states[event.id].messagesInAlarmsOnly) &&
        ((states[event.id].defaultMessengers && adapter.config.defaultPushover && adapter.config.defaultPushover.length) ||
        (!states[event.id].defaultMessengers && states[event.id].pushover && states[event.id].pushover.length))
    ) {
        const instances = (states[event.id].defaultMessengers && adapter.config.defaultPushover) ||
            (!states[event.id].defaultMessengers && states[event.id].pushover);

        const ev = formatEvent(event, true);
        if (ev) {
            const text = ev.event + (ev.val !== undefined ? ` => ${ev.val.toString()}${states[event.id].unit || ''}` : '');
            adapter.log.debug(`Send to 'pushover.${instances.join(',')}' => ${text}`);

            instances.forEach(num =>
                adapter.sendTo(`pushover.${num}`, 'send', {text}));
        }
    }

    return Promise.resolve();
}

function getRawEventList() {
    return new Promise(resolve => {
        if (!eventListRaw) {
            adapter.getState('eventListRaw', (err, state) => {
                eventListRaw = state2json(state);
                resolve(eventListRaw);
            });
        } else {
            return resolve(eventListRaw);
        }
    });
}

async function addEvent(event) {
    await getRawEventList();
    const _event = {};

    if (typeof event === 'string') {
        event = {event};
    }

    if (!event.event && !event.id) {
        adapter.log.warn('Cannot add empty event to the list');
        return;
    }

    if (!alarmMode && states[event.id] && states[event.id].alarmsOnly) {
        adapter.log.debug(`State ${event.id} => ${event.val} skipped because only in alarm mode`);
        return;
    }

    _event.ts = event.ts || Date.now();

    if (typeof _event.ts !== 'number') {
        _event.ts = new Date(_event.ts).getTime();
    } else {
        if (_event.ts < MIN_VALID_DATE || _event.ts > MAX_VALID_DATE) {
            adapter.log.warn(`Invalid date provided in event: ${new Date(_event.ts).toISOString()}`);
            _event.ts = new Date(_event.ts).getTime();
        }
    }

    if (event.event) {
        _event.event = event.event;
    }

    if (event.id || event._id) {
        _event.id = event.id || event._id;
    }

    if (event.val !== undefined) {
        _event.val = event.val;
    }

    if (event.oldVal !== undefined) {
        _event.oldVal = event.oldVal;
    }

    if (event.icon) {
        _event.icon = event.icon;
    }

    if (event.duration !== undefined && event.duration !== null) {
        // This is duration of previous event
        const prevEvent = eventListRaw.find(item => item.id === event.id);
        if (prevEvent) {
            prevEvent.duration = event.duration;
        }
    }

    // time must be unique
    while (eventListRaw.find(item => item.ts === _event.ts)) {
        _event.ts++;
    }

    eventListRaw.unshift(_event);
    eventListRaw.sort((a, b) => a.ts > b.ts ? -1 : (a.ts < b.ts ? 1 : 0));

    adapter.log.debug(`Add ${JSON.stringify(_event)}`);

    if (eventListRaw.length > adapter.config.maxLength) {
        eventListRaw.splice(adapter.config.maxLength, eventListRaw.length - adapter.config.maxLength);
    }

    const ev = formatEvent(_event, true);

    if (ev) {
        await adapter.setStateAsync('eventListRaw', JSON.stringify(eventListRaw), true);
        await updateMomentTimes();
        await adapter.setForeignStateAsync(`${adapter.namespace}.lastEvent.event`, ev.event, true);
        await adapter.setForeignStateAsync(`${adapter.namespace}.lastEvent.id`, _event.id === undefined || _event.id === null ? null : _event.id.toString(), true);
        await adapter.setForeignStateAsync(`${adapter.namespace}.lastEvent.ts`, _event.ts, true);
        await adapter.setForeignStateAsync(`${adapter.namespace}.lastEvent.val`, _event.val === undefined ? null : _event.val, true);
        await adapter.setForeignStateAsync(`${adapter.namespace}.lastEvent.duration`, _event.duration === undefined ? null : _event.duration, true);
        await adapter.setForeignStateAsync(`${adapter.namespace}.lastEvent.json`, JSON.stringify(_event), true);
        await sendTelegram(_event);
        await sendWhatsApp(_event);
        await sendPushover(_event);
    }

    return _event;
}

function getName(obj) {
    let name = obj.common.name;
    if (typeof name === 'object') {
        name = name[systemLang] || name.en;
    }
    return name || obj._id;
}

function parseStates(states) {
    // todo
    return states;
}

async function updateStateSettings(id, obj) {
    if (!obj || !obj.common || !obj.common.custom || !obj.common.custom[adapter.namespace] || !obj.common.custom[adapter.namespace].enabled) {
        if (states[id]) {
            adapter.log.debug(`Removed from event list: ${id}`);
            delete states[id];
            try {
                await adapter.unsubscribeForeignStatesAsync(id);
            } catch (e) {
                adapter.log.error(`Cannot unsubscribe from ${id}: ${e}`);
            }

            return true;
        } else {
            return false;
        }
    }

    id = obj._id;
    const needSubscribe = !states[id];
    let changed = false;
    const settings = obj.common.custom[adapter.namespace];
    if (states[id]) {
        // detect relevant changes
        if (states[id].event !== settings.event) {
            states[id].event = settings.event;
            changed = true;
        }
        if (states[id].color !== settings.color) {
            states[id].color = settings.color;
            changed = true;
        }
        if (states[id].icon !== settings.icon) {
            states[id].icon = settings.icon;
            changed = true;
        }
        if (states[id].changesOnly !== settings.changesOnly) {
            states[id].changesOnly = settings.changesOnly;
            changed = true;
        }
        if (states[id].alarmsOnly !== settings.alarmsOnly) {
            states[id].alarmsOnly = settings.alarmsOnly;
            changed = true;
        }
        if (states[id].defaultMessengers !== settings.defaultMessengers) {
            states[id].defaultMessengers = settings.defaultMessengers;
            changed = true;
        }
        if (states[id].messagesInAlarmsOnly !== settings.messagesInAlarmsOnly) {
            states[id].messagesInAlarmsOnly = settings.messagesInAlarmsOnly;
            changed = true;
        }
        if (JSON.stringify(states[id].whatsAppCMB) !== JSON.stringify(settings.whatsAppCMB)) {
            states[id].whatsAppCMB = settings.whatsAppCMB;
            changed = true;
        }
        if (JSON.stringify(states[id].telegram) !== JSON.stringify(settings.telegram)) {
            states[id].telegram = settings.telegram;
            changed = true;
        }
        if (JSON.stringify(states[id].pushover) !== JSON.stringify(settings.pushover)) {
            states[id].pushover = settings.pushover;
            changed = true;
        }
        const st = parseStates(settings.states || undefined);
        if (JSON.stringify(states[id].states) !== JSON.stringify(st)) {
            states[id].states = st;
            changed = true;
        }
    } else {
        states[id] = settings;
        changed = true;
    }

    if (states[id].type !== obj.common.type) {
        states[id].type = obj.common.type;
        changed = true;
    }

    const st = parseStates(obj.common.states || undefined);
    if (JSON.stringify(states[id].originalStates) !== JSON.stringify(st)) {
        states[id].originalStates = st;
        changed = true;
    }
    if (states[id].unit !== obj.common.unit) {
        states[id].unit = obj.common.unit;
        changed = true;
    }
    if (states[id].min !== obj.common.min) {
        states[id].min = obj.common.min;
        changed = true;
    }
    if (states[id].max !== obj.common.max) {
        states[id].max = obj.common.max;
        changed = true;
    }

    const name = getName(obj);
    if (states[id].name !== name) {
        states[id].name = name;
        changed = true;
    }

    let durationUsed = adapter.config.duration;

    if (!durationUsed && states[id].states) {
        if (states[id].type === 'boolean') {
            durationUsed = (states[id].event || adapter.config.defaultBooleanText).includes('%d') ||
                           (states[id].event || adapter.config.defaultBooleanText).includes('%g');

            if (!durationUsed) {
                const item = states[id].states.find(item => item.val === 'true');

                durationUsed = ((item && item.text) || adapter.config.defaultBooleanTextTrue).includes('%d') ||
                               ((item && item.text) || adapter.config.defaultBooleanTextTrue).includes('%d');
            }
            if (!durationUsed) {
                const item = states[id].states.find(item => item.val === 'false');

                durationUsed = ((item && item.text) || adapter.config.defaultBooleanTextFalse).includes('%d') ||
                               ((item && item.text) || adapter.config.defaultBooleanTextFalse).includes('%g');
            }
        } else {
            durationUsed = (states[id].event || adapter.config.defaultNonBooleanText).includes('%d') ||
                           (states[id].event || adapter.config.defaultNonBooleanText).includes('%g');

            if (!durationUsed) {
                durationUsed = !!states[id].states.find(item => item.text.includes('%d') || item.text.includes('%g'));
            }
        }
    } else if (!durationUsed) {
        durationUsed = (states[id].event || adapter.config.defaultNonBooleanText).includes('%d') ||
                       (states[id].event || adapter.config.defaultNonBooleanText).includes('%g');
    }

    let oldValueUsed = false;

    if (states[id].states) {
        if (states[id].type === 'boolean') {
            oldValueUsed = (states[id].event || adapter.config.defaultBooleanText).includes('%o');

            if (!oldValueUsed) {
                const item = states[id].states.find(item => item.val === 'true');

                oldValueUsed = ((item && item.text) || adapter.config.defaultBooleanTextTrue).includes('%o');
            }
            if (!oldValueUsed) {
                const item = states[id].states.find(item => item.val === 'false');

                oldValueUsed = ((item && item.text) || adapter.config.defaultBooleanTextFalse).includes('%o');
            }
        } else {
            oldValueUsed = (states[id].event || adapter.config.defaultNonBooleanText).includes('%o');
            oldValueUsed = oldValueUsed || !!states[id].states.find(item => item.text.includes('%o'));
        }
    } else {
        oldValueUsed = oldValueUsed || (states[id].event || adapter.config.defaultNonBooleanText).includes('%o');
    }

    if (states[id].oldValueUsed !== oldValueUsed) {
        states[id].oldValueUsed = oldValueUsed;
        changed = true;
    }

    if (states[id].durationUsed !== durationUsed) {
        states[id].durationUsed = durationUsed;
        changed = true;
    }

    if (adapter.config.icons && (!states[id].color || !states[id].icon)) {
        const result = await getIconAndColor(id, obj);
        if (result && !states[id].icon && result.icon !== states[id].icon) {
            changed = true;
            // we must get from /icons/113_hmip-psm_thumb.png => /adapter/hm-rpc/icons/113_hmip-psm_thumb.png
            // or                                                  hm-rpc.admin/icons/113_hmip-psm_thumb.png
            states[id].icon = `${id.split('.')[0]}.admin${result.icon}`;
        }
        if (result && !states[id].color && result.color !== states[id].color) {
            changed = true;
            states[id].color = result.color;
        }
    }

    needSubscribe && adapter.log.debug(`Subscribe on ${id}`);

    if (states[id].val === undefined && (states[id].changesOnly || durationUsed)) {
        try {
            const state = await adapter.getForeignStateAsync(id);
            states[id].val = state ? state.val : null; // store to detect changes
            states[id].ts  = state ? state.ts  : null; // store to calculate duration
        } catch (e) {
            adapter.log.error(`Cannot read state ${id}: ${e}`);
            states[id].val = null; // store to detect changes
            states[id].ts  = null;
        }
    }

    if (needSubscribe) {
        try {
            await adapter.subscribeForeignStatesAsync(id);
        } catch (e) {
            adapter.log.error(`Cannot subscribe on ${id}: ${e}`);
        }
    }
    return changed;
}

// Read all Object names sequentially, that do not have aliases
async function readAllNames(ids) {
    for (let i = 0; i < ids.length; i++) {
        try {
            const obj = await adapter.getForeignObjectAsync(ids[i]);
            await updateStateSettings(ids[i], obj);
        } catch (e) {
            adapter.log.error(`Cannot read object ${ids[i]}: ${e}`);
        }
    }
}

async function readStates() {
    const doc = await adapter.getObjectViewAsync('custom', 'state', {});
    const readNames = [];
    if (doc && doc.rows) {
        doc.rows.forEach(item => {
            if (item.value) {
                const obj = item.value;
                if (obj && obj[adapter.namespace] && obj[adapter.namespace].enabled) {
                    readNames.push(item.id);
                }
            }
        });
    }
    return readAllNames(readNames);
}

async function reformatJsonTable(allowRelative, table) {
    if (!table && !eventListRaw) {
        table = await getRawEventList();
    } else {
        table = table || eventListRaw;
    }

    return table
        .map(ev => formatEvent(ev, allowRelative))
        .filter(ev => ev);
}

async function getIconAndColor(id, obj) {
    if (obj) {
        return obj;
    } else {
        obj = await adapter.getForeignObjectAsync(id);
    }

    if (obj && obj.common && obj.common.icon) {
        return {icon: obj.common.icon, color: obj.common.color};
    }

    const parts = id.split('.');
    parts.pop();
    obj = await adapter.getForeignObjectAsync(parts.join('.'));
    if (obj && obj.type === 'channel') {
        if (obj.common && obj.common.icon) {
            return {icon: obj.common.icon, color: obj.common.color};
        } else {
            const parts = obj._id.split('.');
            parts.pop();
            obj = await adapter.getForeignObjectAsync(parts.join('.'));
            if (obj && (obj.type === 'channel' || obj.type === 'device')) {
                if (obj.common && obj.common.icon) {
                    return {icon: obj.common.icon, color: obj.common.color};
                } else {
                    return null;
                }
            } else {
                return null;
            }
        }
    } else if (obj && obj.type === 'device' && obj.common) {
        return {icon: obj.common.icon, color: obj.common.color};
    } else {
        return null;
    }
}

async function updateMomentTimes(table) {
    relativeCounter = 0;
    const json = await reformatJsonTable(true, table);
    if (!relativeCounter && momentInterval) {
        clearInterval(momentInterval);
        momentInterval = null;
    }
    return adapter.setStateAsync('eventJSONList', JSON.stringify(json), true);
}

async function main() {
    let obj = await adapter.getForeignObjectAsync('system.config');
    obj = obj || {};
    obj.common = obj.common || {};
    systemLang = adapter.config.language || obj.common.language;
    isFloatComma = obj.common.isFloatComma === undefined ? true : obj.common.isFloatComma;

    textSwitchedOn          = words['switched on'][systemLang]               || words['switched on'].en;
    textSwitchedOff         = words['switched off'][systemLang]              || words['switched off'].en;
    textDeviceChangedStatus = words['Device %n changed status:'][systemLang] || words['Device %n changed status:'].en;
    textDays                = words['days'][systemLang]                      || words['days'].en;
    textHours               = words['hours'][systemLang]                     || words['hours'].en;
    textMinutes             = words['minutes'][systemLang]                   || words['minutes'].en;
    textSeconds             = words['sec'][systemLang]                       || words['sec'].en;
    textMs                  = words['ms'][systemLang]                        || words['ms'].en;

    adapter.config.maxLength = parseInt(adapter.config.maxLength, 10) || 100;
    adapter.config.deleteAlarmsByDisable = adapter.config.deleteAlarmsByDisable === true || adapter.config.deleteAlarmsByDisable === 'true';
    if (adapter.config.maxLength > 10000) {
        adapter.config.maxLength = 10000;
    }

    const state = await adapter.getStateAsync('alarmMode');
    alarmMode = !!(state && state.val);


    moment.locale(systemLang === 'en' ? 'en-gb' : systemLang);

    await readStates();
    await updateMomentTimes(); // Update table according to new settings

    try {
        await adapter.subscribeStatesAsync('insert');
    } catch (e) {
        adapter.log.error(`Cannot subscribe on states: ${e}`);
    }
    try {
        await adapter.subscribeStatesAsync('eventListRaw');
    } catch (e) {
        adapter.log.error(`Cannot subscribe on states: ${e}`);
    }
    try {
        await adapter.subscribeStatesAsync('triggerPDF');
    } catch (e) {
        adapter.log.error(`Cannot subscribe on states: ${e}`);
    }
    try {
        await adapter.subscribeStatesAsync('alarm');
    } catch (e) {
        adapter.log.error(`Cannot subscribe on states: ${e}`);
    }
    try {
        // detect changes of objects
        await adapter.subscribeForeignObjectsAsync('*');
    } catch (e) {
        adapter.log.error(`Cannot subscribe on object: ${e}`);
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
