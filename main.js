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
const words         = loadWords();

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

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
let states = {};
let systemLang;
let eventListRaw;
let textSwitchedOn;
let textSwitchedOff;
let textDeviceChangedStatus;

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
                    states[id].val = state.val;
                }
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

        icon = states[id].icon;

        if (states[id].type === 'boolean') {
            if (!states[id].event && state.val && states[id].trueText) {
                eventTemplate = states[id].trueText === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextTrue || textSwitchedOn : states[id].trueText;
                color = states[id].trueColor || adapter.config.defaultBooleanColorTrue;
            } else if (!states[id].event && !state.val && states[id].falseText) {
                eventTemplate = states[id].falseText === DEFAULT_TEMPLATE ? adapter.config.defaultBooleanTextFalse || textSwitchedOff : states[id].falseText;
                color = states[id].falseColor || adapter.config.defaultBooleanColorFalse;
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

                color = state.val ?
                    states[id].trueColor  || adapter.config.defaultBooleanColorTrue
                    :
                    states[id].falseColor || adapter.config.defaultBooleanColorFalse;

                valWithUnit = val;
            }
        } else {
            eventTemplate = states[id].event === DEFAULT_TEMPLATE ? adapter.config.defaultNonBooleanText || textDeviceChangedStatus : states[id].event || textDeviceChangedStatus;
            eventTemplate = eventTemplate.replace(/%u/g, states[id].unit || '');
            eventTemplate = eventTemplate.replace(/%n/g, states[id].name || id);
            
            val = state.val !== undefined && state.val !== null ? state.val.toString() : '';

            valWithUnit = val;

            if (valWithUnit !== '' && states[id].unit) {
                valWithUnit += states[id].unit;
            }
        }

        if (icon) {
            if (!icon.startsWith('data:')) {
                if (icon.includes('.')) {
                    icon = '/adapter/' + id.split('.').shift() + '/' + icon;
                } else {
                    icon = '';
                }
            }
        }
    } else {
        eventTemplate = state.event;
        icon = state.icon || undefined;
        if (state.val !== undefined) {
            val = state.val;
        }
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
            event.ts = new Date(_event.ts).getTime();
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

        // time must be unique
        while (eventListRaw.find(item => item.ts === _event.ts)) {
            _event.ts++;
        }

        eventListRaw.unshift(_event);
        eventListRaw.sort((a, b) => a.ts > b.ts ? -1 : (a.ts < b.ts ? 1 : 0));

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
                if (adapter.config.icons) {
                    promises.push(getIcon(id, obj).then(icon => {
                        if (icon) {
                            states[id].icon = icon;
                        }
                    }));
                }

                if (states[id].changesOnly) {
                    adapter.getForeignState(id, (err, state) => {
                        states[id].state = state ? state.val : null; // store to detect changes
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

function getIcon(id, obj) {
    return new Promise(resolve => {
        if (obj) {
            resolve(obj);
        } else {
            adapter.getForeignObject(id, (err, obj) => resolve(obj));
        }
    })
        .then(obj => {
            if (obj && obj.common && obj.common.icon) {
                return obj.common.icon;
            } else {
                const parts = id.split('.');
                parts.pop();
                return adapter.getForeignObjectAsync(parts.join('.'))
                    .then(obj => {
                        if (obj && obj.type === 'channel') {
                            if (obj.common && obj.common.icon) {
                                return obj.common && obj.common.icon;
                            } else {
                                const parts = obj._id.split('.');
                                parts.pop();
                                return adapter.getForeignObjectAsync(parts.join('.'))
                                    .then(obj => {
                                        if (obj && (obj.type === 'channel' || obj.type === 'device')) {
                                            if (obj.common && obj.common.icon) {
                                                return obj.common && obj.common.icon;
                                            } else {
                                                return null;
                                            }
                                        } else {
                                            return null;
                                        }
                                    });
                            }
                        } else if (obj && obj.type === 'device') {
                            return obj.common && obj.common.icon;
                        } else {
                            return null;
                        }
                    });
            }
        });
}

async function main() {
    textSwitchedOn = words['switched on'][systemLang] || words['switched on'].en;
    textSwitchedOff = words['switched off'][systemLang] || words['switched off'].en;
    textDeviceChangedStatus = words['Device %n changed status:'][systemLang] || words['Device %n changed status:'].en;
    
    adapter.config.maxLength = parseInt(adapter.config.maxLength, 10);
    adapter.config.maxLength = adapter.config.maxLength || 100;
    if (adapter.config.maxLength > 10000) {
        adapter.config.maxLength = 10000;
    }

    adapter.getForeignObject('system.config', (err, obj) => {
        systemLang = adapter.config.language || obj.common.language;

        moment.locale(systemLang === 'en' ? 'en-gb' : systemLang);

        readStates()
            .then(() => reformatJsonTable(true)) // Update table according to new settings
            .then(json => {
                adapter.setState('eventJSONList', JSON.stringify(json), true);
                adapter.subscribeStates('insert');
                adapter.subscribeStates('insert');
                adapter.subscribeStates('eventListRaw');
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