"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventList = void 0;
const adapter_core_1 = require("@iobroker/adapter-core");
const moment_1 = __importDefault(require("moment"));
const list2pdf_1 = __importDefault(require("./lib/list2pdf"));
require("moment/locale/de");
require("moment/locale/fr");
require("moment/locale/en-gb");
require("moment/locale/ru");
require("moment/locale/it");
require("moment/locale/es");
require("moment/locale/zh-cn");
require("moment/locale/pl");
require("moment/locale/pt");
require("moment/locale/nl");
const DEFAULT_TEMPLATE = 'default';
const MIN_VALID_DATE = new Date(2019, 0, 1).getTime();
const MAX_VALID_DATE = new Date(2050, 0, 1).getTime();
class EventList extends adapter_core_1.Adapter {
    #states = {};
    #alarmMode = false;
    #momentInterval = null;
    #relativeCounter = 0;
    #systemLang;
    #isFloatComma;
    #eventListRaw;
    #textSwitchedOn;
    #textSwitchedOff;
    #textDeviceChangedStatus;
    #textDays;
    #textHours;
    #textMinutes;
    #textSeconds;
    #textMs;
    constructor(options = {}) {
        super({
            ...options,
            name: 'eventlist',
        });
        this.on('ready', this.#onReady.bind(this));
        this.on('stateChange', this.#onStateChange.bind(this));
        this.on('message', this.#onMessage.bind(this));
        this.on('objectChange', this.#onObjectChange.bind(this));
        this.on('unload', this.#onUnload.bind(this));
    }
    #state2json(state) {
        state = state || {};
        let table = state.val || [];
        if (typeof table !== 'object') {
            try {
                table = JSON.parse(table);
            }
            catch {
                this.log.warn(`Cannot parse event list: "${table}"`);
                table = [];
            }
        }
        table = table || [];
        return table;
    }
    getTranslatedWords(word) {
        const text = adapter_core_1.I18n.getTranslatedObject(word);
        return text[this.#systemLang] || text.en;
    }
    async #onReady() {
        await adapter_core_1.I18n.init(__dirname, this);
        const obj = (await this.getForeignObjectAsync('system.config'));
        const systemConfig = obj?.common || {};
        this.#systemLang = this.config.language || systemConfig.language || 'en';
        this.#isFloatComma = systemConfig.isFloatComma === undefined ? true : systemConfig.isFloatComma;
        this.#textSwitchedOn = this.getTranslatedWords('switched on');
        this.#textSwitchedOff = this.getTranslatedWords('switched off');
        this.#textDeviceChangedStatus = this.getTranslatedWords('Device %n changed status:');
        this.#textDays = this.getTranslatedWords('days');
        this.#textHours = this.getTranslatedWords('hours');
        this.#textMinutes = this.getTranslatedWords('minutes');
        this.#textSeconds = this.getTranslatedWords('sec');
        this.#textMs = this.getTranslatedWords('ms');
        this.config.maxLength = parseInt(this.config.maxLength, 10) || 100;
        this.config.deleteAlarmsByDisable =
            this.config.deleteAlarmsByDisable === true ||
                this.config.deleteAlarmsByDisable === 'true';
        if (this.config.maxLength > 10000) {
            this.config.maxLength = 10000;
        }
        const state = await this.getStateAsync('alarmMode');
        this.#alarmMode = !!(state && state.val);
        moment_1.default.locale(this.#systemLang === 'en' ? 'en-gb' : this.#systemLang);
        await this.#readStates();
        await this.#updateMomentTimes(); // Update table according to new settings
        try {
            await this.subscribeStatesAsync('insert');
        }
        catch (e) {
            this.log.error(`Cannot subscribe on states: ${e}`);
        }
        try {
            await this.subscribeStatesAsync('eventListRaw');
        }
        catch (e) {
            this.log.error(`Cannot subscribe on states: ${e}`);
        }
        try {
            await this.subscribeStatesAsync('triggerPDF');
        }
        catch (e) {
            this.log.error(`Cannot subscribe on states: ${e}`);
        }
        try {
            await this.subscribeStatesAsync('alarm');
        }
        catch (e) {
            this.log.error(`Cannot subscribe on states: ${e}`);
        }
        try {
            // detect changes of objects
            await this.subscribeForeignObjectsAsync('*');
        }
        catch (e) {
            this.log.error(`Cannot subscribe on object: ${e}`);
        }
    }
    async #onStateChange(id, state) {
        if (id === `${this.namespace}.triggerPDF` && state && !state.ack && state.val) {
            this.#reformatJsonTable(false)
                .then(table => (0, list2pdf_1.default)(this, moment_1.default, this.instance ? `report-${this.instance}.pdf` : 'report.pdf', table))
                .then(() => this.setForeignStateAsync(`${this.namespace}.triggerPDF`, false, true))
                .catch(e => this.log.error(`Cannot create PDF: ${e}`));
        }
        else if (id === `${this.namespace}.alarm` && state && !state.ack) {
            this.log.info(`Switch ALARM state to ${state.val}`);
            this.#alarmMode =
                state.val === true ||
                    state.val === 'true' ||
                    state.val === 1 ||
                    state.val === '1' ||
                    state.val === 'ON' ||
                    state.val === 'on';
            if (this.config.deleteAlarmsByDisable && !this.#alarmMode) {
                return this.#getRawEventList().then(eventList => {
                    const alarmIds = Object.keys(this.#states).filter(id => this.#states[id].alarmsOnly);
                    const count = eventList.length;
                    this.#eventListRaw = eventList.filter(item => !alarmIds.includes(item.id || ''));
                    if (this.#eventListRaw.length !== count) {
                        this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true)
                            .then(() => this.log.debug(`Removed ${count - this.#eventListRaw.length} from the list after the alarm is deactivated`))
                            .catch(e => this.log.error(`Cannot update eventListRaw: ${e}`));
                    }
                });
            }
        }
        else if (id === `${this.namespace}.eventListRaw` && state && !state.ack && state.val) {
            this.#eventListRaw = this.#state2json(state);
            this.#updateMomentTimes().catch(e => this.log.error(`Cannot update eventListRaw: ${e}`));
        }
        else if (id === `${this.namespace}.insert` && state && !state.ack && state.val) {
            if (typeof state.val === 'string' && state.val.startsWith('{')) {
                try {
                    state.val = JSON.parse(state.val);
                }
                catch {
                    // ignore
                }
                this.#addEvent(state.val)
                    .then(event => this.log.debug(`Event ${JSON.stringify(event)} was added`))
                    .catch(e => this.log.error(`Cannot add event: ${e}`));
            }
            else {
                this.#addEvent(state.val.toString())
                    .then(event => this.log.debug(`Event ${JSON.stringify(event)} was added`))
                    .catch(e => this.log.error(`Cannot add event: ${e}`));
            }
        }
        else if (id === `${this.namespace}.delete` && state?.val && !state.ack) {
            this.#deleteEvents(state.val)
                .then(count => this.log.debug(`${count} events were deleted from the list`))
                .catch(e => this.log.error(`Cannot delete events: ${e}`));
        }
        else if (this.#states[id] && state) {
            if (this.#states[id].states &&
                state.val !== null &&
                state.val !== undefined &&
                this.#states[id].states?.[state.val.toString()]?.disabled) {
                this.log.debug(`Value ${state.val} of ${id} was ignored, because disabled`);
                return;
            }
            const eventItem = state;
            if (this.#states[id].oldValueUsed) {
                eventItem.oldVal = this.#states[id].val;
            }
            // ignore non-changed states
            if (this.#states[id].changesOnly) {
                if (state && this.#states[id].val === state.val) {
                    return;
                }
                // calculate duration
                if (this.#states[id].durationUsed) {
                    // this event is only started, and we must update the duration of the previous event
                    if (this.#states[id].ts && state.ts >= (this.#states[id].ts || 0)) {
                        eventItem.duration = state.ts - (this.#states[id].ts || 0);
                    }
                    else {
                        eventItem.duration = null;
                    }
                    this.#states[id].ts = state.ts;
                    if (this.#states[id].type === 'number' &&
                        this.#states[id].val !== null &&
                        this.#states[id].val !== undefined &&
                        state.val !== null &&
                        state.val !== undefined) {
                        eventItem.diff = state.val - this.#states[id].val;
                    }
                }
                this.#states[id].val = state.val;
            }
            else if (this.#states[id].durationUsed) {
                // calculate duration
                if (this.#states[id].ts && state.ts >= (this.#states[id].ts || 0)) {
                    eventItem.duration = state.ts - (this.#states[id].ts || 0);
                }
                else {
                    eventItem.duration = null;
                }
                this.#states[id].ts = state.ts;
                if (this.#states[id].type === 'number' &&
                    this.#states[id].val !== null &&
                    this.#states[id].val !== undefined &&
                    state.val !== null &&
                    state.val !== undefined) {
                    eventItem.diff = state.val - this.#states[id].val;
                }
                this.#states[id].val = state.val;
            }
            eventItem.id = id;
            this.#addEvent(eventItem)
                .then(event => this.log.debug(`Event ${JSON.stringify(event)} was added`))
                .catch(e => this.log.error(`Cannot add event: ${e}`));
        }
    }
    async #onMessage(obj) {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'insert') {
                // e.g. send email or pushover or whatever
                this.log.debug(`insert event: ${JSON.stringify(obj.message)}`);
                await this.#addEvent(obj.message);
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, { result: 'event inserted' }, obj.callback);
                }
            }
            else if (obj.command === 'pdf') {
                const table = await this.#reformatJsonTable(false);
                await (0, list2pdf_1.default)(this, moment_1.default, this.instance ? `report-${this.instance}.pdf` : 'report.pdf', table, obj.message);
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, { result: 'rendered' }, obj.callback);
                }
            }
            else if (obj.command === 'list') {
                try {
                    let table = await this.#getRawEventList();
                    table ||= [];
                    // filter items
                    if (obj.message &&
                        (typeof obj.message === 'string' ||
                            typeof obj.message.id === 'string' ||
                            typeof obj.message.ids === 'object')) {
                        let ids = typeof obj.message === 'string' ? obj.message : null;
                        if (!ids && typeof obj.message.id === 'string') {
                            ids = obj.message.id;
                        }
                        if (!ids && typeof obj.message.ids === 'object') {
                            ids = [...obj.message.ids];
                        }
                        if (typeof ids === 'string') {
                            ids = [ids];
                        }
                        // filter table
                        table = table.filter(item => (!item.id && ids?.includes('custom')) || ids?.includes(item.id || ''));
                    }
                    if (obj.message?.count &&
                        parseInt(obj.message.count, 10) &&
                        parseInt(obj.message.count, 10) < table.length) {
                        table = table.splice(obj.message.count);
                    }
                    try {
                        await this.#reformatJsonTable(obj.message?.allowRelative === undefined ? true : obj.message.allowRelative, table);
                    }
                    catch (e) {
                        this.log.error(`Cannot reformat JSON table: ${e}`);
                    }
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, table, obj.callback);
                    }
                }
                catch (e) {
                    this.log.error(`Cannot get event list: ${e}`);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { error: e.toString() }, obj.callback);
                    }
                }
            }
            else if (obj.command === 'delete') {
                try {
                    const count = await this.#deleteEvents(obj.message);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { deleted: count }, obj.callback);
                    }
                }
                catch (e) {
                    this.log.error(`Cannot delete event: ${e}`);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { error: e.toString() }, obj.callback);
                    }
                }
            }
        }
    }
    async #onObjectChange(id, obj) {
        const changed = await this.#updateStateSettings(id, obj);
        if (changed) {
            await this.#updateMomentTimes();
        }
    }
    #onUnload(callback) {
        if (this.#momentInterval) {
            clearInterval(this.#momentInterval);
            this.#momentInterval = null;
        }
        callback?.();
    }
    async #deleteEvents(filter) {
        const eventList = await this.#getRawEventList();
        const count = eventList.length;
        if (!filter || filter === '*') {
            // delete all
            this.#eventListRaw = [];
            await this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true);
            return count;
        }
        if (typeof filter === 'number' ||
            (filter.toString()[0] === '2' && filter.length === new Date().toISOString().length)) {
            // Delete it by timestamp
            // Attention: this will stop work in 3000.01.01 :)
            const ts = new Date(filter).getTime();
            this.#eventListRaw = eventList.filter(item => item.ts !== ts);
            if (this.#eventListRaw.length !== count) {
                await this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true);
                return count - this.#eventListRaw.length;
            }
            return 0;
        }
        // Delete it by State ID
        this.#eventListRaw = eventList.filter(item => item.id !== filter);
        if (this.#eventListRaw.length !== count) {
            await this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true);
            return count - this.#eventListRaw.length;
        }
        return 0;
    }
    #duration2text(ms, withSpaces) {
        if (ms < 1000) {
            return `${ms}${withSpaces ? ' ' : ''}${this.#textMs}`;
        }
        if (ms < 10000) {
            return `${this.#isFloatComma ? (Math.round(ms / 100) / 10).toString().replace('.', ',') : (Math.round(ms / 100) / 10).toString()}${withSpaces ? ' ' : ''}${this.#textSeconds}`;
        }
        if (ms < 90000) {
            return `${this.#isFloatComma
                ? Math.round(ms / 1000)
                    .toString()
                    .replace('.', ',')
                : Math.round(ms / 1000).toString()}${withSpaces ? ' ' : ''}${this.#textSeconds}`;
        }
        if (ms < 3600000) {
            return `${Math.floor(ms / 60000)}${withSpaces ? ' ' : ''}${this.#textMinutes} ${Math.round((ms % 60000) / 1000)}${withSpaces ? ' ' : ''}${this.#textSeconds}`;
        }
        let hours = Math.floor(ms / 3600000);
        const minutes = Math.floor(ms / 60000) % 60;
        const seconds = Math.round(Math.floor(ms % 60000) / 1000);
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            hours %= 24;
            if (days > 2) {
                return `${days}${withSpaces ? ' ' : ''}${this.#textDays} ${hours}${withSpaces ? ' ' : ''}${this.#textHours}`;
            }
            return `${days}${withSpaces ? ' ' : ''}${this.#textDays} ${hours}${withSpaces ? ' ' : ''}${this.#textHours} ${minutes}${withSpaces ? ' ' : ''}${this.#textMinutes}`;
        }
        if (hours > 2) {
            return `${hours}${withSpaces ? ' ' : ''}${this.#textHours} ${minutes}${withSpaces ? ' ' : ''}${this.#textMinutes}`;
        }
        return `${hours}${withSpaces ? ' ' : ''}${this.#textHours} ${minutes}${withSpaces ? ' ' : ''}${this.#textMinutes} ${seconds}${withSpaces ? ' ' : ''}${this.#textSeconds}`;
    }
    #formatEvent(state, allowRelative) {
        const event = {};
        let eventTemplate = '';
        let val;
        let valWithUnit;
        let color = state.color || '';
        let icon = '';
        const date = new Date(state.ts);
        let time;
        if (allowRelative && Date.now() - date.getTime() < this.config.relativeTime * 1000) {
            this.#relativeCounter++;
            if (!this.#momentInterval) {
                this.#momentInterval = setInterval(() => this.#updateMomentTimes(), 10000);
            }
            time = (0, moment_1.default)(date).fromNow();
        }
        else {
            time = (0, moment_1.default)(date).format(this.config.dateFormat);
        }
        event._id = date.getTime();
        if (!state.event) {
            const id = state.id || state._id;
            if (!id || !this.#states[id]) {
                return null;
            }
            if (this.#states[id].type === 'boolean') {
                val = state.val ? 'true' : 'false';
                const item = this.#states[id].states?.find(item => item.val === val);
                if (item && item.disabled) {
                    return null;
                }
                if (!this.#states[id].event && state.val && item && item.text) {
                    eventTemplate =
                        item.text === DEFAULT_TEMPLATE
                            ? this.config.defaultBooleanTextTrue || this.#textSwitchedOn
                            : item.text;
                    color = item.color || this.config.defaultBooleanColorTrue || this.#states[id].color || '';
                    icon =
                        item.icon ||
                            (typeof this.#states[id].icon === 'string' ? this.#states[id].icon : undefined) ||
                            undefined;
                }
                else if (!this.#states[id].event && !state.val && item && item.text) {
                    eventTemplate =
                        item.text === DEFAULT_TEMPLATE
                            ? this.config.defaultBooleanTextFalse || this.#textSwitchedOff
                            : item.text;
                    color = item.color || this.config.defaultBooleanColorFalse || this.#states[id].color || '';
                    icon =
                        item.icon ||
                            (typeof this.#states[id].icon === 'string' ? this.#states[id].icon : undefined) ||
                            undefined;
                }
                else {
                    if (this.#states[id].event === DEFAULT_TEMPLATE) {
                        eventTemplate = this.config.defaultBooleanText || this.#textDeviceChangedStatus;
                    }
                    else {
                        eventTemplate = this.#states[id].event || '';
                    }
                    if (eventTemplate === null || eventTemplate === undefined) {
                        eventTemplate = '';
                    }
                    else if (typeof eventTemplate !== 'string') {
                        eventTemplate = eventTemplate.toString();
                    }
                    eventTemplate = eventTemplate.replace(/%u/g, this.#states[id].unit || '');
                    eventTemplate = eventTemplate.replace(/%n/g, this.#states[id].name || id);
                    if (item) {
                        val = state.val
                            ? item.text === DEFAULT_TEMPLATE
                                ? this.config.defaultBooleanTextTrue || this.#textSwitchedOn
                                : item.text || this.#textSwitchedOn
                            : item.text === DEFAULT_TEMPLATE
                                ? this.config.defaultBooleanTextFalse || this.#textSwitchedOff
                                : item.text || this.#textSwitchedOff;
                        const iconStr = typeof this.#states[id].icon === 'string' ? this.#states[id].icon : '';
                        icon = state.val
                            ? item.icon === DEFAULT_TEMPLATE
                                ? this.config.defaultBooleanIconTrue || iconStr || ''
                                : item.icon || iconStr || ''
                            : item.icon === DEFAULT_TEMPLATE
                                ? this.config.defaultBooleanIconFalse || iconStr || ''
                                : item.icon || iconStr || '';
                        color = state.val
                            ? item.color === DEFAULT_TEMPLATE
                                ? this.config.defaultBooleanColorTrue || this.#states[id].color || ''
                                : item.color || this.#states[id].color || ''
                            : item.color === DEFAULT_TEMPLATE
                                ? this.config.defaultBooleanColorFalse || this.#states[id].color || ''
                                : item.color || this.#states[id].color || '';
                    }
                    else {
                        val = state.val
                            ? this.config.defaultBooleanTextTrue || this.#textSwitchedOn
                            : this.config.defaultBooleanTextFalse || this.#textSwitchedOff;
                        const iconStr = typeof this.#states[id].icon === 'string' ? this.#states[id].icon : '';
                        icon = state.val
                            ? this.config.defaultBooleanIconTrue || iconStr || ''
                            : this.config.defaultBooleanIconFalse || iconStr || '';
                        color = state.val
                            ? this.config.defaultBooleanColorTrue || this.#states[id].color || ''
                            : this.config.defaultBooleanColorFalse || this.#states[id].color || '';
                    }
                    valWithUnit = val;
                }
            }
            else {
                eventTemplate =
                    this.#states[id].event === DEFAULT_TEMPLATE
                        ? this.config.defaultNonBooleanText || this.#textDeviceChangedStatus
                        : this.#states[id].event || this.#textDeviceChangedStatus;
                eventTemplate = eventTemplate.replace(/%u/g, this.#states[id].unit || '');
                eventTemplate = eventTemplate.replace(/%n/g, this.#states[id].name || id);
                const tempVal = state.val !== undefined ? state.val : '';
                if (tempVal === null) {
                    val = 'null';
                }
                else if (typeof tempVal === 'number') {
                    val = tempVal.toString();
                    if (this.#isFloatComma) {
                        val = val.replace('.', ',');
                    }
                }
                else {
                    val = tempVal.toString();
                }
                if (this.#states[id].states) {
                    // try to find text for value in states
                    const item = this.#states[id].states?.find(item => item.val === val);
                    const stateText = item?.val && this.#states[id].originalStates?.[item.val];
                    const def = this.config.defaultStringTexts &&
                        this.config.defaultStringTexts.find((it) => it.value === stateText || it.value === val);
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
                    }
                    else if (this.#states[id].originalStates && val !== undefined) {
                        val =
                            this.#states[id].originalStates?.[val] === undefined
                                ? val
                                : this.#states[id].originalStates?.[val] || '';
                    }
                    if (!this.#states[id].event && val) {
                        eventTemplate = val;
                        val = '';
                    }
                }
                else if (this.#states[id].originalStates && val !== undefined) {
                    val =
                        this.#states[id].originalStates?.[val] === undefined
                            ? val
                            : this.#states[id].originalStates?.[val] || '';
                    const def = this.config.defaultStringTexts &&
                        this.config.defaultStringTexts.find((it) => it.value === val);
                    if (def) {
                        val = def.text;
                        color = def.color;
                        icon = def.icon;
                    }
                }
                else {
                    const def = this.config.defaultStringTexts &&
                        this.config.defaultStringTexts.find((it) => it.value === val);
                    if (def) {
                        val = def.text;
                        color = def.color;
                        icon = def.icon;
                    }
                }
                if (val !== '' && this.#states[id].unit) {
                    valWithUnit = val + this.#states[id].unit;
                }
                else {
                    valWithUnit = val;
                }
                icon = icon || (typeof this.#states[id].icon === 'string' ? this.#states[id].icon : undefined);
                color = color || this.#states[id].color || '';
                // todo => change bright of icon depends on value and min/max
            }
        }
        else {
            eventTemplate = state.event;
            icon = state.icon || undefined;
            color = state.color || '';
            if (state.val !== undefined) {
                const tempVal2 = state.val;
                if (tempVal2 === null) {
                    val = 'null';
                }
                else if (typeof tempVal2 === 'number') {
                    val = tempVal2.toString();
                    if (this.#isFloatComma) {
                        val = val.replace('.', ',');
                    }
                }
                else {
                    val = tempVal2.toString();
                }
            }
        }
        if (icon) {
            color = color || (typeof icon === 'object' ? icon.color : '');
            icon = typeof icon === 'object' ? icon.icon : icon;
        }
        let durationText;
        if (state.duration != null) {
            durationText = this.#duration2text(state.duration);
        }
        else {
            durationText = this.#duration2text(Date.now() - state.ts);
            event.dr = 1; // duration running
            this.#relativeCounter++;
            this.#momentInterval ||= setInterval(() => this.#updateMomentTimes(), 10000);
        }
        if (eventTemplate.includes('%d')) {
            eventTemplate = eventTemplate.replace(/%d/g, durationText);
        }
        if (eventTemplate.includes('%g')) {
            eventTemplate = eventTemplate.replace(/%g/g, this.#isFloatComma ? (state.diff || 0).toString().replace('.', ',') : (state.diff || 0).toString());
        }
        if (eventTemplate.includes('%o')) {
            eventTemplate = eventTemplate.replace(/%o/g, this.#isFloatComma
                ? (state.oldVal == null ? '_' : state.oldVal).toString().replace('.', ',')
                : state.oldVal == null
                    ? '_'
                    : state.oldVal.toString());
        }
        if (eventTemplate.includes('%s')) {
            eventTemplate = eventTemplate.replace(/%s/g, val === undefined ? '' : val);
            valWithUnit = '';
        }
        if (eventTemplate.includes('%t')) {
            eventTemplate = eventTemplate.replace(/%t/g, (0, moment_1.default)(new Date(state.ts)).format(this.config.dateFormat));
        }
        if (eventTemplate.includes('%r')) {
            eventTemplate = eventTemplate.replace(/%r/g, (0, moment_1.default)(new Date(state.ts)).fromNow());
        }
        event.event = eventTemplate;
        event.ts = time;
        if (color) {
            event._style = { color };
        }
        if (icon && this.config.icons) {
            event.icon = icon;
        }
        if (durationText && this.config.duration) {
            event.duration = durationText;
        }
        if (valWithUnit !== '' && valWithUnit !== undefined) {
            event.val = valWithUnit;
        }
        else {
            event.val = val;
        }
        // because of filter add event.id
        if (state.id) {
            event.id = state.id;
        }
        return event;
    }
    async #sendTelegram(event) {
        if (event.id &&
            this.#states[event.id] &&
            (this.#alarmMode || !this.#states[event.id].messagesInAlarmsOnly) &&
            ((this.#states[event.id].defaultMessengers && this.config.defaultTelegram?.length) ||
                (!this.#states[event.id].defaultMessengers &&
                    this.#states[event.id].telegram &&
                    this.#states[event.id].telegram?.length))) {
            const instances = (this.#states[event.id].defaultMessengers && this.config.defaultTelegram) ||
                (!this.#states[event.id].defaultMessengers && this.#states[event.id].telegram) ||
                [];
            const ev = this.#formatEvent(event, true);
            if (ev) {
                const text = ev.event +
                    (ev.val !== undefined ? ` => ${ev.val.toString()}${this.#states[event.id].unit || ''}` : '');
                this.log.debug(`Send to 'telegram.${instances.join(',')}' => ${text}`);
                instances.forEach(num => this.sendTo(`telegram.${num}`, 'send', { text }));
            }
        }
        return Promise.resolve();
    }
    async #sendWhatsApp(event) {
        if (event.id &&
            this.#states[event.id] &&
            (this.#alarmMode || !this.#states[event.id].messagesInAlarmsOnly) &&
            ((this.#states[event.id].defaultMessengers && this.config.defaultWhatsAppCMB?.length) ||
                (!this.#states[event.id].defaultMessengers && this.#states[event.id].whatsAppCMB?.length))) {
            const instances = (this.#states[event.id].defaultMessengers && this.config.defaultWhatsAppCMB) ||
                (!this.#states[event.id].defaultMessengers && this.#states[event.id].whatsAppCMB) ||
                [];
            const ev = this.#formatEvent(event, true);
            if (ev) {
                const text = ev.event +
                    (ev.val !== undefined ? ` => ${ev.val.toString()}${this.#states[event.id].unit || ''}` : '');
                this.log.debug(`Send to 'telegram.${instances.join(',')}' => ${text}`);
                instances.forEach(num => this.sendTo(`whatsapp-cmb.${num}`, 'send', { text }));
            }
        }
        return Promise.resolve();
    }
    async #sendPushover(event) {
        if (event.id &&
            this.#states[event.id] &&
            (this.#alarmMode || !this.#states[event.id].messagesInAlarmsOnly) &&
            ((this.#states[event.id].defaultMessengers && this.config.defaultPushover?.length) ||
                (!this.#states[event.id].defaultMessengers &&
                    this.#states[event.id].pushover &&
                    this.#states[event.id].pushover?.length))) {
            const instances = (this.#states[event.id].defaultMessengers && this.config.defaultPushover) ||
                (!this.#states[event.id].defaultMessengers && this.#states[event.id].pushover) ||
                [];
            const ev = this.#formatEvent(event, true);
            if (ev) {
                const text = ev.event +
                    (ev.val !== undefined ? ` => ${ev.val.toString()}${this.#states[event.id].unit || ''}` : '');
                this.log.debug(`Send to 'pushover.${instances.join(',')}' => ${text}`);
                instances.forEach(num => this.sendTo(`pushover.${num}`, 'send', text));
            }
        }
        return Promise.resolve();
    }
    #getRawEventList() {
        return new Promise(resolve => {
            if (!this.#eventListRaw) {
                this.getState('eventListRaw', (err, state) => {
                    this.#eventListRaw = this.#state2json(state);
                    resolve(this.#eventListRaw);
                });
            }
            else {
                return resolve(this.#eventListRaw);
            }
        });
    }
    async #addEvent(event) {
        await this.#getRawEventList();
        const eventItem = {};
        if (typeof event === 'string') {
            event = { event, ts: Date.now() };
        }
        if (!event.event && !event.id) {
            this.log.warn('Cannot add empty event to the list');
            return;
        }
        if (!this.#alarmMode && event.id && this.#states[event.id] && this.#states[event.id].alarmsOnly) {
            this.log.debug(`State ${event.id} => ${event.val} skipped because only in alarm mode`);
            return;
        }
        eventItem.ts ||= Date.now();
        if (typeof eventItem.ts !== 'number') {
            eventItem.ts = new Date(eventItem.ts).getTime();
        }
        else {
            if (eventItem.ts < MIN_VALID_DATE || eventItem.ts > MAX_VALID_DATE) {
                this.log.warn(`Invalid date provided in event: ${new Date(eventItem.ts).toISOString()}`);
                eventItem.ts = new Date(eventItem.ts).getTime();
            }
        }
        if (event.event) {
            eventItem.event = event.event;
        }
        if (event.id || event._id) {
            eventItem.id = event.id || event._id;
        }
        if (event.val !== undefined) {
            eventItem.val = event.val;
        }
        if (event.oldVal !== undefined) {
            eventItem.oldVal = event.oldVal;
        }
        if (event.icon) {
            eventItem.icon = event.icon;
        }
        if (event.duration != null) {
            // This is duration of previous event
            const prevEvent = this.#eventListRaw.find(item => item.id === event.id);
            if (prevEvent) {
                prevEvent.duration = event.duration;
            }
        }
        // time must be unique
        while (this.#eventListRaw.find(item => item.ts === eventItem.ts)) {
            eventItem.ts++;
        }
        this.#eventListRaw.unshift(eventItem);
        this.#eventListRaw.sort((a, b) => (a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0));
        this.log.debug(`Add ${JSON.stringify(eventItem)}`);
        if (this.#eventListRaw.length > this.config.maxLength) {
            this.#eventListRaw.splice(this.config.maxLength, this.#eventListRaw.length - this.config.maxLength);
        }
        const ev = this.#formatEvent(eventItem, true);
        if (ev) {
            await this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true);
            await this.#updateMomentTimes();
            await this.setForeignStateAsync(`${this.namespace}.lastEvent.event`, ev.event, true);
            await this.setForeignStateAsync(`${this.namespace}.lastEvent.id`, eventItem.id === undefined || eventItem.id === null ? null : eventItem.id.toString(), true);
            await this.setForeignStateAsync(`${this.namespace}.lastEvent.ts`, eventItem.ts, true);
            await this.setForeignStateAsync(`${this.namespace}.lastEvent.val`, eventItem.val === undefined ? null : eventItem.val, true);
            await this.setForeignStateAsync(`${this.namespace}.lastEvent.duration`, eventItem.duration === undefined ? null : eventItem.duration, true);
            await this.setForeignStateAsync(`${this.namespace}.lastEvent.json`, JSON.stringify(eventItem), true);
            await this.#sendTelegram(eventItem);
            await this.#sendWhatsApp(eventItem);
            await this.#sendPushover(eventItem);
        }
        return eventItem;
    }
    #getName(obj) {
        let name = obj.common.name;
        if (typeof name === 'object') {
            name = name[this.#systemLang] || name.en || '';
        }
        return name || obj._id;
    }
    #parseStates(states) {
        // todo
        return states;
    }
    async #updateStateSettings(id, obj) {
        if (!obj?.common?.custom?.[this.namespace] || !obj.common.custom[this.namespace].enabled) {
            if (this.#states[id]) {
                this.log.debug(`Removed from event list: ${id}`);
                delete this.#states[id];
                try {
                    await this.unsubscribeForeignStatesAsync(id);
                }
                catch (e) {
                    this.log.error(`Cannot unsubscribe from ${id}: ${e}`);
                }
                return true;
            }
            return false;
        }
        id = obj._id;
        const needSubscribe = !this.#states[id];
        let changed = false;
        const settings = obj.common.custom[this.namespace];
        if (this.#states[id]) {
            // detect relevant changes
            if (this.#states[id].event !== settings.event) {
                this.#states[id].event = settings.event;
                changed = true;
            }
            if (this.#states[id].color !== settings.color) {
                this.#states[id].color = settings.color;
                changed = true;
            }
            if (this.#states[id].icon !== settings.icon) {
                this.#states[id].icon = settings.icon;
                changed = true;
            }
            if (this.#states[id].changesOnly !== settings.changesOnly) {
                this.#states[id].changesOnly = settings.changesOnly;
                changed = true;
            }
            if (this.#states[id].alarmsOnly !== settings.alarmsOnly) {
                this.#states[id].alarmsOnly = settings.alarmsOnly;
                changed = true;
            }
            if (this.#states[id].defaultMessengers !== settings.defaultMessengers) {
                this.#states[id].defaultMessengers = settings.defaultMessengers;
                changed = true;
            }
            if (this.#states[id].messagesInAlarmsOnly !== settings.messagesInAlarmsOnly) {
                this.#states[id].messagesInAlarmsOnly = settings.messagesInAlarmsOnly;
                changed = true;
            }
            if (JSON.stringify(this.#states[id].whatsAppCMB) !== JSON.stringify(settings.whatsAppCMB)) {
                this.#states[id].whatsAppCMB = settings.whatsAppCMB;
                changed = true;
            }
            if (JSON.stringify(this.#states[id].telegram) !== JSON.stringify(settings.telegram)) {
                this.#states[id].telegram = settings.telegram;
                changed = true;
            }
            if (JSON.stringify(this.#states[id].pushover) !== JSON.stringify(settings.pushover)) {
                this.#states[id].pushover = settings.pushover;
                changed = true;
            }
            const st = this.#parseStates(settings.states || undefined);
            if (JSON.stringify(this.#states[id].states) !== JSON.stringify(st)) {
                this.#states[id].states = st;
                changed = true;
            }
        }
        else {
            this.#states[id] = settings;
            changed = true;
        }
        if (this.#states[id].type !== obj.common.type) {
            this.#states[id].type = obj.common.type;
            changed = true;
        }
        const st = this.#parseStates(obj.common.states || undefined);
        if (JSON.stringify(this.#states[id].originalStates) !== JSON.stringify(st)) {
            this.#states[id].originalStates = st;
            changed = true;
        }
        if (this.#states[id].unit !== obj.common.unit) {
            this.#states[id].unit = obj.common.unit;
            changed = true;
        }
        if (this.#states[id].min !== obj.common.min) {
            this.#states[id].min = obj.common.min;
            changed = true;
        }
        if (this.#states[id].max !== obj.common.max) {
            this.#states[id].max = obj.common.max;
            changed = true;
        }
        const name = this.#getName(obj);
        if (this.#states[id].name !== name) {
            this.#states[id].name = name;
            changed = true;
        }
        let durationUsed = this.config.duration;
        if (!durationUsed && this.#states[id].states) {
            if (this.#states[id].type === 'boolean') {
                durationUsed =
                    (this.#states[id].event || this.config.defaultBooleanText).includes('%d') ||
                        (this.#states[id].event || this.config.defaultBooleanText).includes('%g');
                if (!durationUsed) {
                    const item = this.#states[id].states?.find(item => item.val === 'true');
                    durationUsed =
                        ((item && item.text) || this.config.defaultBooleanTextTrue).includes('%d') ||
                            ((item && item.text) || this.config.defaultBooleanTextTrue).includes('%d');
                }
                if (!durationUsed) {
                    const item = this.#states[id].states?.find(item => item.val === 'false');
                    durationUsed =
                        ((item && item.text) || this.config.defaultBooleanTextFalse).includes('%d') ||
                            ((item && item.text) || this.config.defaultBooleanTextFalse).includes('%g');
                }
            }
            else {
                durationUsed =
                    (this.#states[id].event || this.config.defaultNonBooleanText).includes('%d') ||
                        (this.#states[id].event || this.config.defaultNonBooleanText).includes('%g');
                if (!durationUsed) {
                    durationUsed = !!this.#states[id].states?.find(item => item.text.includes('%d') || item.text.includes('%g'));
                }
            }
        }
        else if (!durationUsed) {
            durationUsed =
                (this.#states[id].event || this.config.defaultNonBooleanText).includes('%d') ||
                    (this.#states[id].event || this.config.defaultNonBooleanText).includes('%g');
        }
        let oldValueUsed = false;
        if (this.#states[id].states) {
            if (this.#states[id].type === 'boolean') {
                oldValueUsed = (this.#states[id].event || this.config.defaultBooleanText).includes('%o');
                if (!oldValueUsed) {
                    const item = this.#states[id].states?.find(item => item.val === 'true');
                    oldValueUsed = ((item && item.text) || this.config.defaultBooleanTextTrue).includes('%o');
                }
                if (!oldValueUsed) {
                    const item = this.#states[id].states?.find(item => item.val === 'false');
                    oldValueUsed = ((item && item.text) || this.config.defaultBooleanTextFalse).includes('%o');
                }
            }
            else {
                oldValueUsed = (this.#states[id].event || this.config.defaultNonBooleanText).includes('%o');
                oldValueUsed = oldValueUsed || !!this.#states[id].states?.find(item => item.text.includes('%o'));
            }
        }
        else {
            oldValueUsed = oldValueUsed || (this.#states[id].event || this.config.defaultNonBooleanText).includes('%o');
        }
        if (this.#states[id].oldValueUsed !== oldValueUsed) {
            this.#states[id].oldValueUsed = oldValueUsed;
            changed = true;
        }
        if (this.#states[id].durationUsed !== durationUsed) {
            this.#states[id].durationUsed = durationUsed;
            changed = true;
        }
        if (this.config.icons && (!this.#states[id].color || !this.#states[id].icon)) {
            const result = await this.#getIconAndColor(id, obj);
            const currentIcon = typeof this.#states[id].icon === 'string' ? this.#states[id].icon : undefined;
            if (result && !this.#states[id].icon && result.icon !== currentIcon) {
                changed = true;
                // we must get from /icons/113_hmip-psm_thumb.png => /adapter/hm-rpc/icons/113_hmip-psm_thumb.png
                // or                                                  hm-rpc.admin/icons/113_hmip-psm_thumb.png
                this.#states[id].icon = `${id.split('.')[0]}.admin${result.icon}`;
            }
            if (result && !this.#states[id].color && result.color !== this.#states[id].color) {
                changed = true;
                this.#states[id].color = result.color;
            }
        }
        needSubscribe && this.log.debug(`Subscribe on ${id}`);
        if (this.#states[id].val === undefined && (this.#states[id].changesOnly || durationUsed)) {
            try {
                const state = await this.getForeignStateAsync(id);
                this.#states[id].val = state ? state.val : null; // store to detect changes
                this.#states[id].ts = state ? state.ts : undefined; // store to calculate duration
            }
            catch (e) {
                this.log.error(`Cannot read state ${id}: ${e}`);
                this.#states[id].val = null; // store to detect changes
                this.#states[id].ts = undefined;
            }
        }
        if (needSubscribe) {
            try {
                await this.subscribeForeignStatesAsync(id);
            }
            catch (e) {
                this.log.error(`Cannot subscribe on ${id}: ${e}`);
            }
        }
        return changed;
    }
    // Read all Object names sequentially that do not have aliases
    async #readAllNames(ids) {
        for (let i = 0; i < ids.length; i++) {
            try {
                const obj = (await this.getForeignObjectAsync(ids[i]));
                await this.#updateStateSettings(ids[i], obj);
            }
            catch (e) {
                this.log.error(`Cannot read object ${ids[i]}: ${e}`);
            }
        }
    }
    async #readStates() {
        const doc = await this.getObjectViewAsync('custom', 'state', {});
        const readNames = [];
        doc?.rows?.forEach(item => {
            if (item.value) {
                const obj = item.value;
                if (obj?.[this.namespace]?.enabled) {
                    readNames.push(item.id);
                }
            }
        });
        return this.#readAllNames(readNames);
    }
    async #reformatJsonTable(allowRelative, table) {
        if (!table && !this.#eventListRaw) {
            table = await this.#getRawEventList();
        }
        else {
            table ||= this.#eventListRaw;
        }
        return table.map(ev => this.#formatEvent(ev, allowRelative)).filter((ev) => ev !== null);
    }
    async #getIconAndColor(id, obj) {
        if (obj) {
            if (obj.common?.icon) {
                return { icon: obj.common.icon, color: obj.common.color };
            }
        }
        else {
            obj = (await this.getForeignObjectAsync(id));
            if (obj?.common?.icon) {
                return { icon: obj.common.icon, color: obj.common.color };
            }
        }
        const parts = id.split('.');
        parts.pop();
        const objParent = await this.getForeignObjectAsync(parts.join('.'));
        if (objParent?.type === 'channel') {
            if (objParent.common?.icon) {
                return { icon: objParent.common.icon, color: objParent.common.color };
            }
            const parts = objParent._id.split('.');
            parts.pop();
            const objDevice = await this.getForeignObjectAsync(parts.join('.'));
            if (objDevice && (objDevice.type === 'channel' || objDevice.type === 'device')) {
                if (objDevice.common?.icon) {
                    return { icon: objDevice.common.icon, color: objDevice.common.color };
                }
                return null;
            }
            return null;
        }
        if (objParent?.common?.icon && objParent.type === 'device') {
            return { icon: objParent.common.icon, color: objParent.common.color };
        }
        return null;
    }
    async #updateMomentTimes(table) {
        this.#relativeCounter = 0;
        const json = await this.#reformatJsonTable(true, table);
        if (!this.#relativeCounter && this.#momentInterval) {
            clearInterval(this.#momentInterval);
            this.#momentInterval = null;
        }
        await this.setStateAsync('eventJSONList', JSON.stringify(json), true);
    }
}
exports.EventList = EventList;
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new EventList(options);
}
else {
    // otherwise start the instance directly
    (() => new EventList())();
}
//# sourceMappingURL=main.js.map