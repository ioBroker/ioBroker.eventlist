'use strict';

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils       = require('@iobroker/adapter-core');
const moment      = require('moment');
const adapterName = require('./package.json').name.split('.').pop();

// Load your modules here, e.g.:
// const fs = require("fs");

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
let states;
let systemLang;

/**
 * Starts the adapter instance
 * @param {Partial<utils.AdapterOptions>} [options]
 */
function startAdapter(options) {
    // Create the adapter and define its methods
    return adapter = utils.adapter(Object.assign({}, options, {
        name: adapterName,

        // The ready callback is called when databases are connected and adapter received configuration.
        // start here!
        ready: main, // Main method defined below for readability

        // is called if a subscribed state changes
        stateChange: (id, state) => {
            if (state && !state.ack && state.val) {
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
            }
        },

        // If you need to accept messages in your adapter, uncomment the following block.
        // /**
        //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
        //  * Using this method requires "common.message" property to be set to true in io-package.json
        //  */
        message: (obj) => {
            if (typeof obj === 'object' && obj.message) {
                if (obj.command === 'insert') {
                    // e.g. send email or pushover or whatever
                    adapter.log.info('insert event');

                    addEvent(obj.message)
                        .then(() => obj.callback && adapter.sendTo(obj.from, obj.command, {result: 'event inserted'}, obj.callback));
                }
            }
        },
    }));
}

function addEvent(event) {
    return new Promise(resolve =>
        adapter.getState('eventList', (err, state) => {
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
            const _event = {};
            if (!event.event) {
                adapter.log.warn('Cannot add empty event to the list');
                return;
            }
            _event.ts = event.ts || Date.now();
            if (typeof _event.ts !== 'string' || new Date(_event.ts).toISOString() === _event.ts) {
                event.ts = moment(new Date(_event.ts)).format(adapter.config.dateFormat);
            }
            _event.event = event.event;
            if (event.val !== undefined) {
                _event.val = event.val;
            }

            table.push(_event);
            table.sort((a, b) => a.ts > b.ts ? 1 : (a.ts < b.ts ? -1 : 0));
            adapter.setState('eventList', JSON.stringify(table), true, () => resolve(_event));
        }));
}

function getName(obj) {
    if (obj.common.custom[adapter.namespace].alias) {
        return obj.common.custom[adapter.namespace].alias;
    } else {
        let name = obj.common.name;
        if (typeof name === 'object') {
            name = name[systemLang] || name.en;
        }
        return name || obj._id;
    }
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
                states[id].name   = getName(obj);
                states[id].type   = obj.common && obj.common.type;
                states[id].states = obj.common && parseStates(obj.common.states || undefined);
                states[id].unit   = obj.common && obj.common.unit;
                states[id].min    = obj.common && obj.common.min;
                states[id].max    = obj.common && obj.common.max;
                
                adapter.subscribeForeignStates(id, () =>
                    setImmediate(readAllNames, ids, cb));
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

async function main() {
    adapter.getForeignObject('system.config', (err, obj) => {
        systemLang = obj.common.language;
        readStates()
            .then(() => {
                adapter.subscribeStates('insert');

            })
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