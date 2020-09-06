'use strict';

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils       = require('@iobroker/adapter-core');
const moment      = require('moment');
const fs          = require('fs');
const adapterName = require('./package.json').name.split('.').pop();
const words       = loadWords();
let list2pdf;

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
let states = {};
let systemLang;
let isFloatComma;
let eventListRaw;
let textSwitchedOn;
let textSwitchedOff;
let textDeviceChangedStatus;
let textUndefined;
let textHours;
let textMinutes;
let textSeconds;
let textMs;

function loadWords() {
    let lines = fs.existsSync(__dirname + '/admin/words.js') ?
        fs.readFileSync(__dirname + '/admin/words.js').toString('utf8').split(/\r\n|\n|\r/) :
        fs.readFileSync(__dirname + '/src/public/words.js').toString('utf8').split(/\r\n|\n|\r/);
    lines = lines.map(l => l.trim()).map(l => l.replace(/'/g, '"')).filter(l => l);
    let start = lines.findIndex(line => line.startsWith('systemDictionary = {'));
    let end = lines.findIndex(line => line.startsWith('};'));
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
            adapter.log.warn('Cannot parse event list: "' + table + '"');
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
        if (id === adapter.namespace + '.triggerPDF' && !state.ack && state.val) {
            console.log(id);
            if (!list2pdf) {
                if (fs.existsSync(__dirname + '/lib/__list2pdf.js')) {
                    list2pdf = require('./lib/__list2pdf');
                } else if (fs.existsSync(__dirname + '/lib/list2pdf.js')) {
                    list2pdf = require('./lib/list2pdf');
                }
            }

            reformatJsonTable(false)
                .then(table => list2pdf(adapter, table))
                .then(() => adapter.setForeignStateAsync(adapter.namespace + '.triggerPDF', false, true));
        } else
        if (id === adapter.namespace + '.eventListRaw' && !state.ack && state.val) {
            eventListRaw = state2json(state);
            reformatJsonTable(true).then(table =>
                adapter.setState('eventJSONList', JSON.stringify(table), true));
        } else
        if (id === adapter.namespace + '.insert' && !state.ack && state.val) {
            if (state.val.startsWith('{')) {
                try {
                    state.val = JSON.parse(state.val);
                } catch (e) {

                }
                addEvent(state.val)
                    .then(event =>
                        adapter.log.debug(`Event ${JSON.stringify(event)} was added`));
            } else {
                addEvent({event: state.val})
                    .then(event =>
                        adapter.log.debug(`Event ${JSON.stringify(event)} was added`));
            }
        } else if (states[id]) {
            // ignore non changed states
            if (states[id].changesOnly) {
                if (state && states[id].val === state.val) {
                    return;
                } else {
                    // calculate duration
                    if (states[id].durationUsed) {
                        if (states[id].ts && state.ts >= states[id].ts) {
                            state.duration = state.ts - states[id].ts;
                        } else {
                            state.duration = null;
                        }
                        states[id].ts = state.ts;
                    }
                    states[id].val = state.val;
                }
            } else
            // calculate duration
            if (states[id].durationUsed) {
                if (states[id].ts && state.ts >= states[id].ts) {
                    state.duration = state.ts - states[id].ts;
                } else {
                    state.duration = null;
                }
                states[id].ts = state.ts;
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
                adapter.log.debug('insert event: ' + JSON.stringify(obj.message));

                addEvent(obj.message)
                    .then(() => obj.callback && adapter.sendTo(obj.from, obj.command, {result: 'event inserted'}, obj.callback));
            }
        }
    });

    adapter.on('objectChange', (id, obj) => {
        let changed = false;
        let promises = [];
        if (obj && obj.common && obj.common.custom && obj.common.custom[adapter.namespace] && obj.common.custom[adapter.namespace].enabled) {
            let settings = obj.common.custom[adapter.namespace];
            if (!states[id]) {
                changed = true;
                states[id] = settings;
                adapter.log.info('Enabled event list for ' + id);
                setImmediate(() => adapter.subscribeForeignStates(id));
            }
            // detect relevant changes
            if (states[id].event !== settings.event) {
                states[id].event = settings.event;
                changed = true;
            }
            if (states[id].changesOnly !== settings.changesOnly) {
                if (!settings.changesOnly) {
                    delete states[id].val;
                } else {
                    // read value
                    promises.push(adapter.getForeignStateAsync(id)
                        .then(state => states[id].val = state ? state.val : null))
                }
                states[id].changesOnly = settings.changesOnly;
                changed = true;
            }
            if (states[id].falseText !== settings.falseText) {
                states[id].falseText = settings.falseText;
                changed = true;
            }
            if (states[id].trueText !== settings.trueText) {
                states[id].trueText = settings.trueText;
                changed = true;
            }
            if (states[id].type !== obj.common.type) {
                states[id].type   = obj.common.type;
                changed = true;
            }
            if (adapter.config.icons) {
                if (states[id].icon !== obj.common.icon) {
                    states[id].icon   = obj.common.icon;
                    changed = true;
                }
            }

            const st = parseStates(obj.common.states);
            if (JSON.stringify(states[id].states) !== JSON.stringify(st)) {
                states[id].states = st;
                changed = true;
            }
            if (states[id].unit !== obj.common.unit) {
                states[id].unit   = obj.common.unit;
                changed = true;
            }
            if (states[id].min !== obj.common.min) {
                states[id].min   = obj.common.min;
                changed = true;
            }
            if (states[id].max !== obj.common.max) {
                states[id].max   = obj.common.max;
                changed = true;
            }
            const name = getName(obj);
            if (states[id].name !== name) {
                states[id].name   = name;
                changed = true;
            }
        } else if (states[id]) {
            changed = true;
            adapter.log.debug('Removed event list: ' + id);
            delete states[id];
            setImmediate(() => adapter.unsubscribeForeignStates(id));
        }

        if (changed) {
            Promise.all(promises)
                .then(() => reformatJsonTable(true))
                .then(table => adapter.setState('eventJSONList', JSON.stringify(table), true));
        }
    });

    return adapter;
}

function duration2text(ms, withSpaces) {
    if (ms < 1000) {
        return `${ms}${withSpaces ? ' ' : ''}${textMs}`;
    } else if (ms < 90000) {
        return `${isFloatComma ? (Math.round((ms / 100)) / 10).toString().replace('.', ',') : (Math.round((ms / 100)) / 10).toString()}${withSpaces ? ' ' : ''}${textSeconds}`;
    } else if (ms < 3600000) {
        return `${Math.floor(ms / 60000)}${withSpaces ? ' ' : ''}${textMinutes} ${Math.round((ms % 60000) / 1000)}${withSpaces ? ' ' : ''}${textSeconds}`;
    } else {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor(ms / 60000) % 60;
        const seconds = Math.round(Math.floor(ms % 60000) / 1000);
        return `${hours}${withSpaces ? ' ' : ''}${textHours} ${minutes}${withSpaces ? ' ' : ''}${textMinutes} ${seconds}${withSpaces ? ' ' : ''}${textSeconds}`;
    }
}

function formatEvent(state, allowRelative) {
    const event = {};
    let eventTemplate = '';
    let val;
    let valWithUnit;
    let color = state.color || '';
    let icon = '';

    let date = new Date(state.ts);
    const time = allowRelative && Date.now() - date.getTime() < adapter.config.relativeTime * 1000 ? moment(date).fromNow() : moment(date).format(adapter.config.dateFormat);

    event._id = date.getTime();

    if (!state.event) {
        const id = state.id || state._id;
        if (!states[id]) {
            return null;
        }

        if (states[id].type === 'boolean') {
            if (!states[id].event && state.val && states[id].trueText) {
                eventTemplate = states[id].trueText === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextTrue || textSwitchedOn : states[id].trueText;
                color = states[id].trueColor || adapter.config.defaultBooleanColorTrue || states[id].color;
                icon  = states[id].trueIcon  || states[id].icon || undefined;
            } else if (!states[id].event && !state.val && states[id].falseText) {
                eventTemplate = states[id].falseText === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextFalse || textSwitchedOff : states[id].falseText;
                color = states[id].falseColor || adapter.config.defaultBooleanColorFalse || states[id].color;
                icon  = states[id].falseIcon  || states[id].icon || undefined;
            } else {
                if (states[id].event === DEFAULT_TEMPLATE) {
                    eventTemplate = adapter.config.defaultBooleanText || textDeviceChangedStatus;
                } else {
                    eventTemplate = states[id].event;
                }
                eventTemplate = eventTemplate.replace(/%u/g, states[id].unit || '');
                eventTemplate = eventTemplate.replace(/%n/g, states[id].name || id);
                val = state.val ?
                    states[id].trueText === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextTrue || textSwitchedOn : states[id].trueText || textSwitchedOn
                    :
                    states[id].falseText === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextFalse || textSwitchedOff : states[id].falseText || textSwitchedOff;

                icon = state.val ?
                    icon = states[id].trueIcon
                    :
                    icon = states[id].falseIcon;

                icon = icon || states[id].icon || undefined;

                color = state.val ?
                    states[id].trueColor  || adapter.config.defaultBooleanColorTrue
                    :
                    states[id].falseColor || adapter.config.defaultBooleanColorFalse;

                color = color || states[id].color;

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

            valWithUnit = val;

            if (valWithUnit !== '' && states[id].unit) {
                valWithUnit += states[id].unit;
            }

            icon  = states[id].icon;
            color = states[id].color;
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
        if (!icon.startsWith('data:')) {
            if (icon.includes('.')) {
                icon = '/adapter/' + (event.id || '').split('.').shift() + '/' + icon;
            } else {
                icon = '';
            }
        }
    }

    let durationText = state.duration !== undefined ? duration2text(state.duration): '';

    if (eventTemplate.includes('%d')) {
        eventTemplate = eventTemplate.replace(/%d/g, durationText);
    }

    if (eventTemplate.includes('%s')) {
        eventTemplate = eventTemplate.replace(/%s/g, val === undefined ? '' : val);
        valWithUnit = '';
    }

    eventTemplate = eventTemplate.replace(/%t/g, moment(new Date(state.ts)).format(adapter.config.dateFormat));

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
    }

    return event;
}

function addEvent(event) {
    return new Promise(resolve => {
        const _event = {};

        if (!event.event && !event.id) {
            adapter.log.warn('Cannot add empty event to the list');
            return;
        }

        _event.ts = event.ts || Date.now();

        if (typeof _event.ts !== 'number') {
            _event.ts = new Date(_event.ts).getTime();
        } else {
            if (_event.ts < MIN_VALID_DATE || _event.ts > MAX_VALID_DATE) {
                adapter.log.warn('Invalid date provided in event: ' + new Date(_event.ts).toISOString());
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

        if (event.duration !== undefined && event.duration !== null) {
            _event.duration = event.duration;
        }

        // time must be unique
        while (eventListRaw.find(item => item.ts === _event.ts)) {
            _event.ts++;
        }

        eventListRaw.unshift(_event);
        eventListRaw.sort((a, b) => a.ts > b.ts ? -1 : (a.ts < b.ts ? 1 : 0));

        adapter.log.debug('Add ' + JSON.stringify(_event));

        if (eventListRaw.length > adapter.config.maxLength) {
            eventListRaw.splice(adapter.config.maxLength, eventListRaw.length - adapter.config.maxLength);
        }

        adapter.setState('eventListRaw', JSON.stringify(eventListRaw), true, () =>
            reformatJsonTable(true)
                .then(table =>
                    adapter.setState('eventJSONList', JSON.stringify(table), true, () =>
                        resolve(_event))));
    });
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

// Read all Object names sequentially, that do not have aliases
function readAllNames(ids, cb) {
    if (!ids || !ids.length) {
        cb && cb();
    } else {
        const id = ids.shift();
        adapter.getForeignObject(id, (err, obj) => {
            if (obj) {
                let promises = [];
                states[id].name   = getName(obj);
                states[id].type   = obj.common && obj.common.type;
                states[id].states = obj.common && parseStates(obj.common.states || undefined);
                states[id].unit   = obj.common && obj.common.unit;
                states[id].min    = obj.common && obj.common.min;
                states[id].max    = obj.common && obj.common.max;
                let durationUsed = false;
                if (!durationUsed && states[id].type === 'boolean') {
                    durationUsed = (states[id].event || adapter.config.defaultBooleanText).includes('%d');
                    if (!durationUsed) {
                        durationUsed = (states[id].trueText || adapter.config.defaultBooleanTextTrue).includes('%d');
                    }
                    if (!durationUsed) {
                        durationUsed = (states[id].falseText || adapter.config.defaultBooleanTextFalse).includes('%d');
                    }
                } else if (!durationUsed) {
                    durationUsed = (states[id].event || adapter.config.defaultNonBooleanText).includes('%d');
                }

                states[id].durationUsed = true;

                if (adapter.config.icons) {
                    promises.push(getIconAndColor(id, obj)
                        .then(icon => {
                            if (icon) {
                                states[id].icon = icon;
                            }
                        }));
                }

                if (states[id].changesOnly || durationUsed) {
                    adapter.getForeignState(id, (err, state) => {
                        states[id].val = state ? state.val : null; // store to detect changes
                        states[id].ts  = state ? state.ts  : null; // store to calculate duration
                        Promise.all(promises)
                            .then(() =>
                                adapter.subscribeForeignStates(id, () =>
                                    setImmediate(readAllNames, ids, cb)));
                    });
                } else {
                    Promise.all(promises)
                        .then(() =>
                            adapter.subscribeForeignStates(id, () =>
                                setImmediate(readAllNames, ids, cb)));
                }
            } else {
                setImmediate(readAllNames, ids, cb);
            }
        });
    }
}

function readStates() {
    return new Promise(resolve =>
        adapter.getObjectView('custom', 'state', {}, (err, doc) => {
            const readNames = [];
            if (doc && doc.rows) {
                for (let i = 0, l = doc.rows.length; i < l; i++) {
                    if (doc.rows[i].value) {
                        const id = doc.rows[i].id;
                        const obj = doc.rows[i].value;
                        if (obj[adapter.namespace] && obj[adapter.namespace].enabled) {
                            states[id] = obj[adapter.namespace];
                            readNames.push(id);
                        }
                    }
                }
            }

            readAllNames(JSON.parse(JSON.stringify(readNames)), () =>
                resolve());
        }));
}

function reformatJsonTable(allowRelative, table) {
    return new Promise(resolve => {
        if (!table && !eventListRaw) {
            adapter.getState('eventListRaw', (err, state) => {
                eventListRaw = state2json(state);
                resolve(eventListRaw);
            });
        } else {
            table = table || eventListRaw;
            return resolve(table);
        }
    })
        .then(table =>
            Promise.resolve(table.map(ev => formatEvent(ev, allowRelative)).filter(ev => ev)));
}

function getIconAndColor(id, obj) {
    return new Promise(resolve => {
        if (obj) {
            resolve(obj);
        } else {
            adapter.getForeignObject(id, (err, obj) => resolve(obj));
        }
    })
        .then(obj => {
            if (obj && obj.common && obj.common.icon) {
                return {icon: obj.common.icon, color: obj.common.color};
            } else {
                const parts = id.split('.');
                parts.pop();
                return adapter.getForeignObjectAsync(parts.join('.'))
                    .then(obj => {
                        if (obj && obj.type === 'channel') {
                            if (obj.common && obj.common.icon) {
                                return {icon: obj.common.icon, color: obj.common.color};
                            } else {
                                const parts = obj._id.split('.');
                                parts.pop();
                                return adapter.getForeignObjectAsync(parts.join('.'))
                                    .then(obj => {
                                        if (obj && (obj.type === 'channel' || obj.type === 'device')) {
                                            if (obj.common && obj.common.icon) {
                                                return {icon: obj.common.icon, color: obj.common.color};
                                            } else {
                                                return null;
                                            }
                                        } else {
                                            return null;
                                        }
                                    });
                            }
                        } else if (obj && obj.type === 'device' && obj.common) {
                            return {icon: obj.common.icon, color: obj.common.color};
                        } else {
                            return null;
                        }
                    });
            }
        });
}

async function main() {
    textSwitchedOn          = words['switched on'][systemLang] || words['switched on'].en;
    textSwitchedOff         = words['switched off'][systemLang] || words['switched off'].en;
    textDeviceChangedStatus = words['Device %n changed status:'][systemLang] || words['Device %n changed status:'].en;
    textUndefined           = words['undefined'][systemLang] || words['undefined'].en;
    textHours               = words['hours'][systemLang] || words['hours'].en;
    textMinutes             = words['minutes'][systemLang] || words['minutes'].en;
    textSeconds             = words['sec'][systemLang] || words['sec'].en;
    textMs                  = words['ms'][systemLang] || words['ms'].en;

    adapter.config.maxLength = parseInt(adapter.config.maxLength, 10);
    adapter.config.maxLength = adapter.config.maxLength || 100;
    if (adapter.config.maxLength > 10000) {
        adapter.config.maxLength = 10000;
    }

    adapter.getForeignObject('system.config', (err, obj) => {
        obj = obj || {};
        obj.common = obj.common || {};
        systemLang = adapter.config.language || obj.common.language;
        isFloatComma = obj.common.isFloatComma === undefined ? true : obj.common.isFloatComma;

        moment.locale(systemLang === 'en' ? 'en-gb' : systemLang);

        readStates()
            .then(() => reformatJsonTable(true)) // Update table according to new settings
            .then(json => {
                adapter.setState('eventJSONList', JSON.stringify(json), true);
                adapter.subscribeStates('insert');
                adapter.subscribeStates('insert');
                adapter.subscribeStates('eventListRaw');
                adapter.subscribeStates('triggerPdfGeneration');
                // detect changes of objects
                adapter.subscribeForeignObjects('*');
            });
    });
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}