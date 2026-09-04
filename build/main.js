"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventList = void 0;
const adapter_core_1 = require("@iobroker/adapter-core");
const moment_1 = __importDefault(require("moment"));
const list2pdf_1 = __importDefault(require("./lib/list2pdf"));
const events_1 = require("./lib/events");
const messages_1 = require("./lib/messages");
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
class EventList extends adapter_core_1.Adapter {
    #states = {};
    #alarmMode = false;
    #momentInterval = null;
    #relativeCounter = 0;
    #systemLang;
    #isFloatComma;
    #eventListRaw;
    #texts;
    /** The standing messages */
    #messages = [];
    /** What is suppressed at the moment, and until when */
    #suppressions = [];
    /** When a message counts as flapping, undefined if the protection is switched off */
    #flapping;
    /** Running delays of messages, keyed with `came:<id>` and `gone:<id>` */
    #messageTimers = new Map();
    /** The messages that are waiting for their delay, with the newest text and value */
    #delayedRaise = new Map();
    /** The last transitions per message, so a message that left the list keeps its restlessness */
    #changes = new Map();
    /** Looks after the flapping messages and the end of the suppressions */
    #messageHousekeeping = null;
    /** Translated words for the events a transition writes */
    #transitionTexts;
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
        return (0, events_1.parseEventList)(state, text => this.log.warn(text));
    }
    /** Collect everything the events engine requires to format an event */
    #getEngineContext() {
        return {
            config: this.config,
            states: this.#states,
            isFloatComma: this.#isFloatComma,
            texts: this.#texts,
            onRelativeTimeUsed: () => {
                this.#relativeCounter++;
                this.#momentInterval ||= setInterval(() => this.#updateMomentTimes(), 10000);
            },
        };
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
        this.#texts = {
            switchedOn: this.getTranslatedWords('switched on'),
            switchedOff: this.getTranslatedWords('switched off'),
            deviceChangedStatus: this.getTranslatedWords('Device %n changed status:'),
            days: this.getTranslatedWords('days'),
            hours: this.getTranslatedWords('hours'),
            minutes: this.getTranslatedWords('minutes'),
            seconds: this.getTranslatedWords('sec'),
            ms: this.getTranslatedWords('ms'),
        };
        this.#transitionTexts = {
            came: this.getTranslatedWords('came'),
            gone: this.getTranslatedWords('gone'),
            acknowledged: this.getTranslatedWords('acknowledged'),
            flapping: this.getTranslatedWords('flapping'),
            settled: this.getTranslatedWords('settled'),
            suppressed: this.getTranslatedWords('suppressed'),
            released: this.getTranslatedWords('released'),
        };
        const flappingCount = parseInt(this.config.flappingCount, 10);
        const flappingInterval = parseFloat(this.config.flappingInterval);
        this.#flapping =
            flappingCount > 0 && flappingInterval > 0
                ? { count: flappingCount, interval: Math.round(flappingInterval * 60000) }
                : undefined;
        this.config.maxLength = parseInt(this.config.maxLength, 10) || 100;
        this.config.deleteAlarmsByDisable =
            this.config.deleteAlarmsByDisable === true ||
                this.config.deleteAlarmsByDisable === 'true';
        if (this.config.maxLength > 10000) {
            this.config.maxLength = 10000;
        }
        // The alarm mode is switched with the state `alarm`, so it has to be read from there too.
        // Reading `alarmMode`, which does not exist, turned the alarm mode off on every restart.
        const state = await this.getStateAsync('alarm');
        this.#alarmMode = (0, events_1.isAlarmModeOn)(state?.val);
        moment_1.default.locale(this.#systemLang === 'en' ? 'en-gb' : this.#systemLang);
        await this.#readStates();
        await this.#loadMessages();
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
            await this.subscribeStatesAsync('messages.ack');
        }
        catch (e) {
            this.log.error(`Cannot subscribe on states: ${e}`);
        }
        try {
            await this.subscribeStatesAsync('messages.suppress');
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
            this.#alarmMode = (0, events_1.isAlarmModeOn)(state.val);
            if (this.config.deleteAlarmsByDisable && !this.#alarmMode) {
                return this.#getRawEventList().then(eventList => {
                    const count = eventList.length;
                    this.#eventListRaw = (0, events_1.removeAlarmEvents)(eventList, this.#states);
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
            this.#addEvent((0, events_1.normalizeInsertValue)(state.val))
                .then(event => this.log.debug(`Event ${JSON.stringify(event)} was added`))
                .catch(e => this.log.error(`Cannot add event: ${e}`));
        }
        else if (id === `${this.namespace}.delete` && state?.val && !state.ack) {
            this.#deleteEvents(state.val)
                .then(count => this.log.debug(`${count} events were deleted from the list`))
                .catch(e => this.log.error(`Cannot delete events: ${e}`));
        }
        else if (id === `${this.namespace}.messages.ack` && state && !state.ack && state.val) {
            await this.#acknowledge(state.val.toString());
            await this.setStateAsync('messages.ack', '', true);
        }
        else if (id === `${this.namespace}.messages.suppress` && state && !state.ack && state.val) {
            await this.#suppress(state.val.toString());
            await this.setStateAsync('messages.suppress', '', true);
        }
        else if (this.#states[id] && state) {
            // The standing messages are evaluated before the event handling, because a value that is
            // not logged still changes the condition of a message.
            await this.#evaluateMessages(id, state.val);
            if ((0, events_1.isValueDisabled)(this.#states[id], state.val)) {
                this.log.debug(`Value ${state.val} of ${id} was ignored, because disabled`);
                return;
            }
            const eventItem = (0, events_1.prepareStateChangeEvent)(state, this.#states[id]);
            if (!eventItem) {
                // the value was not changed
                return;
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
            else if (obj.command === 'message') {
                // A message from a script: it comes, or it goes if state is "gone"
                const request = obj.message;
                try {
                    if (!request?.id) {
                        throw new Error('The message needs an id');
                    }
                    if (request.state === 'gone') {
                        await this.#applyMessageChange((0, messages_1.clearMessage)(this.#messages, request.id, Date.now(), this.#flapping));
                    }
                    else {
                        await this.#applyMessageChange(this.#raise(this.#messages, {
                            id: request.id,
                            level: request.level,
                            severity: request.severity,
                            text: request.text,
                            priority: request.priority,
                            requiresAck: request.requiresAck,
                            val: request.val,
                            icon: request.icon,
                            color: request.color,
                            group: request.group,
                        }, Date.now()));
                    }
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { result: 'ok' }, obj.callback);
                    }
                }
                catch (e) {
                    this.log.error(`Cannot set message: ${e}`);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { error: e.toString() }, obj.callback);
                    }
                }
            }
            else if (obj.command === 'ack') {
                const request = obj.message;
                const filter = typeof request === 'string' ? request : request?.id || '*';
                const user = typeof request === 'string' ? undefined : request?.user;
                const acknowledged = await this.#acknowledge(filter, user);
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, { acknowledged }, obj.callback);
                }
            }
            else if (obj.command === 'messages') {
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, (0, messages_1.formatMessageList)(this.#visibleMessages()), obj.callback);
                }
            }
            else if (obj.command === 'suppress') {
                // Take a message or a group out of the list for a while, for a maintenance
                const request = obj.message;
                const suppression = await this.#suppress(request);
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, suppression
                        ? { target: suppression.target, until: suppression.until }
                        : { error: 'Cannot read the message or the group to suppress' }, obj.callback);
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
        if (this.#messageHousekeeping) {
            clearInterval(this.#messageHousekeeping);
            this.#messageHousekeeping = null;
        }
        for (const timer of this.#messageTimers.values()) {
            clearTimeout(timer);
        }
        this.#messageTimers.clear();
        this.#delayedRaise.clear();
        callback?.();
    }
    async #deleteEvents(filter) {
        const eventList = await this.#getRawEventList();
        const result = (0, events_1.applyDeleteFilter)(eventList, filter);
        this.#eventListRaw = result.list;
        if (result.deleteAll || result.deleted) {
            await this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true);
        }
        return result.deleted;
    }
    #formatEvent(state, allowRelative) {
        return (0, events_1.formatEvent)(state, allowRelative, this.#getEngineContext());
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
    async #addEvent(incoming) {
        await this.#getRawEventList();
        const event = (0, events_1.normalizeEvent)(incoming, Date.now());
        if (!event.event && !event.id) {
            this.log.warn('Cannot add empty event to the list');
            return;
        }
        if ((0, events_1.isSkippedByAlarmMode)(event, this.#alarmMode, this.#states)) {
            this.log.debug(`State ${event.id} => ${event.val} skipped because only in alarm mode`);
            return;
        }
        const eventItem = (0, events_1.buildEventItem)(event, Date.now(), text => this.log.warn(text));
        (0, events_1.applyDurationToPreviousEvent)(this.#eventListRaw, event);
        (0, events_1.insertEventItem)(this.#eventListRaw, eventItem, this.config.maxLength);
        this.log.debug(`Add ${JSON.stringify(eventItem)}`);
        const ev = this.#formatEvent(eventItem, true);
        if (!ev) {
            // The event is not shown, e.g. because this value is disabled. It must not stay in the
            // list either, otherwise it would be written together with the next event.
            const pos = this.#eventListRaw.indexOf(eventItem);
            if (pos !== -1) {
                this.#eventListRaw.splice(pos, 1);
            }
            return;
        }
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
        return eventItem;
    }
    /**
     * Read the standing messages and bring them in line with the current values.
     *
     * A message whose condition is no longer true went while the adapter was down. It does not
     * simply disappear: it goes now and stays in the list until somebody acknowledges it, otherwise
     * nobody would ever learn that the fault happened.
     */
    async #loadMessages() {
        const state = await this.getStateAsync('messages.raw');
        this.#messages = (0, messages_1.parseMessageList)(state?.val, text => this.log.warn(text));
        // a suppression that was still running keeps running, the rest of it is over
        const suppressed = await this.getStateAsync('messages.suppressed');
        this.#suppressions = (0, messages_1.expireSuppressions)(this.#parseSuppressions(suppressed?.val), Date.now());
        for (const id of Object.keys(this.#states)) {
            try {
                const value = await this.getForeignStateAsync(id);
                if (value) {
                    await this.#evaluateMessages(id, value.val);
                }
            }
            catch (e) {
                this.log.warn(`Cannot read ${id} for the messages: ${e}`);
            }
        }
        await this.#publishMessages();
        this.#updateHousekeeping();
    }
    /**
     * Read the suppressions out of the state `messages.suppressed`
     *
     * @param val the value of the state
     */
    #parseSuppressions(val) {
        let parsed = val;
        if (typeof val === 'string') {
            if (!val) {
                return [];
            }
            try {
                parsed = JSON.parse(val);
            }
            catch {
                this.log.warn(`Cannot parse the suppressions: "${val}"`);
                return [];
            }
        }
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(item => item && typeof item.target === 'string' && item.until > 0);
    }
    /**
     * Work out which messages the new value of a state raises and which it clears
     *
     * @param id the state
     * @param val its new value
     */
    async #evaluateMessages(id, val) {
        const settings = this.#states[id];
        if (!settings) {
            return;
        }
        const { raise, clear } = (0, messages_1.evaluateStateMessages)(id, settings, val, {
            isFloatComma: this.#isFloatComma,
            isActive: messageId => this.#isMessageActive(messageId),
        });
        if (!raise.length && !clear.length) {
            return;
        }
        const now = Date.now();
        let list = this.#messages;
        const transitions = [];
        for (const message of raise) {
            // the condition is true again, so a delayed going is off
            this.#cancelMessageTimer(`gone:${message.id}`);
            if (message.delay && !this.#isMessageActive(message.id)) {
                // it comes only if the condition holds long enough. The newest text goes with it.
                this.#delayedRaise.set(message.id, message);
                this.#delayMessage(`came:${message.id}`, message.delay, () => this.#raiseDelayed(message.id));
                continue;
            }
            this.#cancelMessageTimer(`came:${message.id}`);
            const next = this.#raise(list, message, now);
            list = next.list;
            transitions.push(...next.transitions);
        }
        const delayGone = settings.message?.delayGone;
        for (const messageId of clear) {
            // the condition is false again, so a delayed coming is off
            this.#cancelMessageTimer(`came:${messageId}`);
            if (delayGone && this.#isMessageActive(messageId)) {
                // a fault that stops for a moment is not repaired
                this.#delayMessage(`gone:${messageId}`, delayGone, () => this.#clearDelayed(messageId));
                continue;
            }
            this.#cancelMessageTimer(`gone:${messageId}`);
            const next = (0, messages_1.clearMessage)(list, messageId, now, this.#flapping);
            list = next.list;
            transitions.push(...next.transitions);
        }
        await this.#applyMessageChange({ list, transitions });
    }
    /** Whether the message stands at the moment */
    #isMessageActive(id) {
        return this.#messages.some(item => item.id === id && item.active);
    }
    /**
     * Let a message come, together with the transitions it made before it last left the list. Only
     * with them a message that nobody has to acknowledge can ever count as flapping.
     *
     * @param list the standing messages
     * @param incoming the message that comes
     * @param now the current time
     */
    #raise(list, incoming, now) {
        const changes = this.#changes.get(incoming.id);
        return (0, messages_1.raiseMessage)(list, changes?.length ? { ...incoming, changes } : incoming, now, this.#flapping);
    }
    /**
     * Wait before the message comes or goes. A delay that is already running is not started again,
     * otherwise a restless signal would postpone it for ever.
     *
     * @param key `came:<id>` or `gone:<id>`
     * @param delay how long to wait in ms
     * @param action what to do afterwards
     */
    #delayMessage(key, delay, action) {
        if (this.#messageTimers.has(key)) {
            return;
        }
        const timer = setTimeout(() => {
            this.#messageTimers.delete(key);
            action().catch(e => this.log.error(`Cannot apply the delayed message ${key}: ${e}`));
        }, delay);
        this.#messageTimers.set(key, timer);
    }
    /**
     * Stop a running delay
     *
     * @param key `came:<id>` or `gone:<id>`
     */
    #cancelMessageTimer(key) {
        const timer = this.#messageTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.#messageTimers.delete(key);
        }
        if (key.startsWith('came:')) {
            this.#delayedRaise.delete(key.substring(5));
        }
    }
    /**
     * Let a message come whose delay is over
     *
     * @param id the message
     */
    async #raiseDelayed(id) {
        const incoming = this.#delayedRaise.get(id);
        this.#delayedRaise.delete(id);
        if (!incoming) {
            return;
        }
        await this.#applyMessageChange(this.#raise(this.#messages, incoming, Date.now()));
    }
    /**
     * Let a message go whose delay is over
     *
     * @param id the message
     */
    async #clearDelayed(id) {
        await this.#applyMessageChange((0, messages_1.clearMessage)(this.#messages, id, Date.now(), this.#flapping));
    }
    /**
     * Take a message or a group out of the list for a while, and write down that it happened.
     *
     * @param request the message, the group or `*`, with the duration in minutes
     * @returns what is suppressed now, or null if the request could not be read
     */
    async #suppress(request) {
        const now = Date.now();
        const defaultMinutes = parseFloat(this.config.suppressDefault) || 60;
        const suppression = (0, messages_1.parseSuppression)(request, now, defaultMinutes);
        if (!suppression) {
            this.log.warn(`Cannot read what should be suppressed: ${JSON.stringify(request)}`);
            return null;
        }
        this.#suppressions = (0, messages_1.addSuppression)((0, messages_1.expireSuppressions)(this.#suppressions, now), suppression);
        // the suppression goes into the event list, so the gap in the history has a reason
        const minutes = Math.round((suppression.until - now) / 60000);
        const event = suppression.until
            ? `${suppression.target} - ${this.#transitionTexts.suppressed} (${minutes} ${this.#texts.minutes})`
            : `${suppression.target} - ${this.#transitionTexts.released}`;
        try {
            await this.#addEvent({ event });
        }
        catch (e) {
            this.log.error(`Cannot add the event of the suppression: ${e}`);
        }
        await this.#publishMessages();
        this.#updateHousekeeping();
        return suppression;
    }
    /** The messages that are shown and counted, without the suppressed ones */
    #visibleMessages() {
        return (0, messages_1.visibleMessages)(this.#messages, this.#suppressions, Date.now());
    }
    /**
     * Start or stop the timer that looks after the flapping messages and the end of the
     * suppressions. Both are changes that no state change announces.
     */
    #updateHousekeeping() {
        const needed = !!this.#suppressions.length || !!this.#changes.size || this.#messages.some(item => item.flapping);
        if (needed && !this.#messageHousekeeping) {
            this.#messageHousekeeping = setInterval(() => {
                this.#houseKeeping().catch(e => this.log.error(`Cannot look after the messages: ${e}`));
            }, 30000);
        }
        else if (!needed && this.#messageHousekeeping) {
            clearInterval(this.#messageHousekeeping);
            this.#messageHousekeeping = null;
        }
    }
    /** Let calmed down messages out of the flapping protection and end the suppressions that are over */
    async #houseKeeping() {
        const now = Date.now();
        if (this.#flapping) {
            const change = (0, messages_1.settleMessages)(this.#messages, now, this.#flapping);
            if (change.transitions.length) {
                await this.#applyMessageChange(change);
            }
            // forget the messages that have been quiet for a whole window
            for (const [id, times] of this.#changes) {
                if (!times.length || times[times.length - 1] <= now - this.#flapping.interval) {
                    this.#changes.delete(id);
                }
            }
        }
        else if (this.#changes.size) {
            this.#changes.clear();
        }
        const left = (0, messages_1.expireSuppressions)(this.#suppressions, now);
        if (left.length !== this.#suppressions.length) {
            this.#suppressions = left;
            await this.#publishMessages();
        }
        this.#updateHousekeeping();
    }
    /**
     * Acknowledge messages
     *
     * @param filter one message id or `*` for everything that can be acknowledged
     * @param user who acknowledged
     * @returns how many messages were acknowledged
     */
    async #acknowledge(filter, user) {
        const change = (0, messages_1.acknowledgeMessages)(this.#messages, filter, Date.now(), user);
        await this.#applyMessageChange(change);
        return change.transitions.length;
    }
    /**
     * Take over a changed message list: every transition writes an event, then the states follow
     *
     * @param change the new list and what happened
     */
    async #applyMessageChange(change) {
        const listChanged = change.list !== this.#messages;
        this.#messages = change.list;
        const now = Date.now();
        for (const { transition, message } of change.transitions) {
            // keep the restlessness of the message, even if it just left the list
            if (message.changes?.length) {
                this.#changes.set(message.id, message.changes);
            }
            else {
                this.#changes.delete(message.id);
            }
            if ((0, messages_1.isSuppressed)(message, this.#suppressions, now)) {
                // during a maintenance the message writes nothing, that is what it was suppressed for
                continue;
            }
            const { event, color } = (0, messages_1.buildTransitionEvent)(transition, message, this.#transitionTexts);
            try {
                await this.#addEvent({
                    event,
                    id: message.stateId,
                    val: message.val,
                    icon: message.icon,
                    color,
                    level: message.level,
                    messageId: message.id,
                    transition,
                });
            }
            catch (e) {
                this.log.error(`Cannot add the event of the message ${message.id}: ${e}`);
            }
        }
        if (listChanged || change.transitions.length) {
            await this.#publishMessages();
            this.#updateHousekeeping();
        }
    }
    /** Write the standing messages, the counters and the horn */
    async #publishMessages() {
        const visible = this.#visibleMessages();
        const summary = (0, messages_1.summarizeMessages)(visible);
        try {
            // the raw list keeps the suppressed messages, they are only out of sight
            await this.setStateAsync('messages.raw', JSON.stringify(this.#messages), true);
            await this.setStateAsync('messages.list', JSON.stringify((0, messages_1.formatMessageList)(visible)), true);
            await this.setStateAsync('messages.count', summary.total, true);
            await this.setStateAsync('messages.unacknowledged', summary.unacknowledged, true);
            await this.setStateAsync('messages.highest', summary.highest, true);
            await this.setStateAsync('messages.horn', (0, messages_1.isHornOn)(visible, this.config.hornLevel), true);
            await this.setStateAsync('messages.suppressed', JSON.stringify(this.#suppressions), true);
            for (const level of messages_1.LEVELS) {
                const name = `count${level[0].toUpperCase()}${level.substring(1)}`;
                await this.setStateAsync(`messages.${name}`, summary.byLevel[level], true);
            }
        }
        catch (e) {
            this.log.error(`Cannot update the messages: ${e}`);
        }
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
            if (JSON.stringify(this.#states[id].message) !== JSON.stringify(settings.message)) {
                this.#states[id].message = settings.message;
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
        const durationUsed = (0, events_1.isDurationUsed)(this.#states[id], this.config);
        const oldValueUsed = (0, events_1.isOldValueUsed)(this.#states[id], this.config);
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
        return (0, events_1.formatEventList)(table, allowRelative, this.#getEngineContext());
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