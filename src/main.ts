import { Adapter, type AdapterOptions, I18n } from '@iobroker/adapter-core';
import moment from 'moment';

import list2pdf from './lib/list2pdf';
import {
    applyDeleteFilter,
    applyDurationToPreviousEvent,
    buildEventItem,
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
    type EventItem,
    type IncomingEvent,
    type EventEngineContext,
    type EventTexts,
    type FormattedEvent,
    type StateSettings,
} from './lib/events';
import type { EventListAdapterConfig } from './types';

import 'moment/locale/de';
import 'moment/locale/fr';
import 'moment/locale/en-gb';
import 'moment/locale/ru';
import 'moment/locale/it';
import 'moment/locale/es';
import 'moment/locale/zh-cn';
import 'moment/locale/pl';
import 'moment/locale/pt';
import 'moment/locale/nl';

export class EventList extends Adapter {
    declare config: EventListAdapterConfig;
    #states: Record<string, StateSettings> = {};
    #alarmMode = false;
    #momentInterval: NodeJS.Timeout | null = null;
    #relativeCounter = 0;
    #systemLang!: string;
    #isFloatComma!: boolean;
    #eventListRaw!: EventItem[];
    #texts!: EventTexts;

    public constructor(options: Partial<AdapterOptions> = {}) {
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

    #state2json(state?: ioBroker.State | null): EventItem[] {
        return parseEventList(state, text => this.log.warn(text));
    }

    /** Collect everything the events engine requires to format an event */
    #getEngineContext(): EventEngineContext {
        return {
            config: this.config,
            states: this.#states,
            isFloatComma: this.#isFloatComma,
            texts: this.#texts,
            onRelativeTimeUsed: (): void => {
                this.#relativeCounter++;
                this.#momentInterval ||= setInterval(() => this.#updateMomentTimes(), 10000);
            },
        };
    }

    getTranslatedWords(word: string): string {
        const text = I18n.getTranslatedObject(word);
        return text[this.#systemLang] || text.en;
    }

    async #onReady(): Promise<void> {
        await I18n.init(__dirname, this);
        const obj = (await this.getForeignObjectAsync('system.config')) as ioBroker.SystemConfigObject | null;
        const systemConfig = obj?.common || ({} as ioBroker.SystemConfigObject['common']);
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

        this.config.maxLength = parseInt(this.config.maxLength as string, 10) || 100;
        this.config.deleteAlarmsByDisable =
            this.config.deleteAlarmsByDisable === true ||
            (this.config.deleteAlarmsByDisable as unknown as string) === 'true';
        if (this.config.maxLength > 10000) {
            this.config.maxLength = 10000;
        }

        // The alarm mode is switched with the state `alarm`, so it has to be read from there too.
        // Reading `alarmMode`, which does not exist, turned the alarm mode off on every restart.
        const state = await this.getStateAsync('alarm');
        this.#alarmMode = isAlarmModeOn(state?.val);

        moment.locale(this.#systemLang === 'en' ? 'en-gb' : this.#systemLang);

        await this.#readStates();
        await this.#updateMomentTimes(); // Update table according to new settings

        try {
            await this.subscribeStatesAsync('insert');
        } catch (e) {
            this.log.error(`Cannot subscribe on states: ${e}`);
        }
        try {
            await this.subscribeStatesAsync('eventListRaw');
        } catch (e) {
            this.log.error(`Cannot subscribe on states: ${e}`);
        }
        try {
            await this.subscribeStatesAsync('triggerPDF');
        } catch (e) {
            this.log.error(`Cannot subscribe on states: ${e}`);
        }
        try {
            await this.subscribeStatesAsync('alarm');
        } catch (e) {
            this.log.error(`Cannot subscribe on states: ${e}`);
        }
        try {
            // detect changes of objects
            await this.subscribeForeignObjectsAsync('*');
        } catch (e) {
            this.log.error(`Cannot subscribe on object: ${e}`);
        }
    }

    async #onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (id === `${this.namespace}.triggerPDF` && state && !state.ack && state.val) {
            this.#reformatJsonTable(false)
                .then(table =>
                    list2pdf(this, moment, this.instance ? `report-${this.instance}.pdf` : 'report.pdf', table),
                )
                .then(() => this.setForeignStateAsync(`${this.namespace}.triggerPDF`, false, true))
                .catch(e => this.log.error(`Cannot create PDF: ${e}`));
        } else if (id === `${this.namespace}.alarm` && state && !state.ack) {
            this.log.info(`Switch ALARM state to ${state.val}`);

            this.#alarmMode = isAlarmModeOn(state.val);
            if (this.config.deleteAlarmsByDisable && !this.#alarmMode) {
                return this.#getRawEventList().then(eventList => {
                    const count = eventList.length;
                    this.#eventListRaw = removeAlarmEvents(eventList, this.#states);

                    if (this.#eventListRaw.length !== count) {
                        this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true)
                            .then(() =>
                                this.log.debug(
                                    `Removed ${count - this.#eventListRaw.length} from the list after the alarm is deactivated`,
                                ),
                            )
                            .catch(e => this.log.error(`Cannot update eventListRaw: ${e}`));
                    }
                });
            }
        } else if (id === `${this.namespace}.eventListRaw` && state && !state.ack && state.val) {
            this.#eventListRaw = this.#state2json(state);
            this.#updateMomentTimes().catch(e => this.log.error(`Cannot update eventListRaw: ${e}`));
        } else if (id === `${this.namespace}.insert` && state && !state.ack && state.val) {
            this.#addEvent(normalizeInsertValue(state.val))
                .then(event => this.log.debug(`Event ${JSON.stringify(event)} was added`))
                .catch(e => this.log.error(`Cannot add event: ${e}`));
        } else if (id === `${this.namespace}.delete` && state?.val && !state.ack) {
            this.#deleteEvents(state.val as string)
                .then(count => this.log.debug(`${count} events were deleted from the list`))
                .catch(e => this.log.error(`Cannot delete events: ${e}`));
        } else if (this.#states[id] && state) {
            if (isValueDisabled(this.#states[id], state.val)) {
                this.log.debug(`Value ${state.val} of ${id} was ignored, because disabled`);
                return;
            }
            const eventItem = prepareStateChangeEvent(state, this.#states[id]);
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

    async #onMessage(obj: ioBroker.Message): Promise<void> {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'insert') {
                // e.g. send email or pushover or whatever
                this.log.debug(`insert event: ${JSON.stringify(obj.message)}`);

                await this.#addEvent(obj.message);
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, { result: 'event inserted' }, obj.callback);
                }
            } else if (obj.command === 'pdf') {
                const table = await this.#reformatJsonTable(false);
                await list2pdf(
                    this,
                    moment,
                    this.instance ? `report-${this.instance}.pdf` : 'report.pdf',
                    table,
                    obj.message,
                );
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, { result: 'rendered' }, obj.callback);
                }
            } else if (obj.command === 'list') {
                try {
                    let table = await this.#getRawEventList();
                    table ||= [];
                    // filter items
                    if (
                        obj.message &&
                        (typeof obj.message === 'string' ||
                            typeof obj.message.id === 'string' ||
                            typeof obj.message.ids === 'object')
                    ) {
                        let ids: string[] | string | null = typeof obj.message === 'string' ? obj.message : null;
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
                        table = table.filter(
                            item => (!item.id && ids?.includes('custom')) || ids?.includes(item.id || ''),
                        );
                    }
                    if (
                        obj.message?.count &&
                        parseInt(obj.message.count, 10) &&
                        parseInt(obj.message.count, 10) < table.length
                    ) {
                        table = table.splice(obj.message.count);
                    }

                    try {
                        await this.#reformatJsonTable(
                            obj.message?.allowRelative === undefined ? true : obj.message.allowRelative,
                            table,
                        );
                    } catch (e) {
                        this.log.error(`Cannot reformat JSON table: ${e}`);
                    }
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, table, obj.callback);
                    }
                } catch (e) {
                    this.log.error(`Cannot get event list: ${e}`);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { error: e.toString() }, obj.callback);
                    }
                }
            } else if (obj.command === 'delete') {
                try {
                    const count = await this.#deleteEvents(obj.message);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { deleted: count }, obj.callback);
                    }
                } catch (e) {
                    this.log.error(`Cannot delete event: ${e}`);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { error: e.toString() }, obj.callback);
                    }
                }
            }
        }
    }

    async #onObjectChange(id: string, obj: ioBroker.Object | null | undefined): Promise<void> {
        const changed = await this.#updateStateSettings(id, obj as ioBroker.StateObject | null | undefined);
        if (changed) {
            await this.#updateMomentTimes();
        }
    }

    #onUnload(callback: () => void): void {
        if (this.#momentInterval) {
            clearInterval(this.#momentInterval);
            this.#momentInterval = null;
        }
        callback?.();
    }

    async #deleteEvents(filter: number | string): Promise<number> {
        const eventList = await this.#getRawEventList();
        const result = applyDeleteFilter(eventList, filter);
        this.#eventListRaw = result.list;

        if (result.deleteAll || result.deleted) {
            await this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true);
        }

        return result.deleted;
    }

    #formatEvent(state: EventItem, allowRelative: boolean): FormattedEvent | null {
        return formatEvent(state, allowRelative, this.#getEngineContext());
    }

    async #sendTelegram(event: EventItem): Promise<void> {
        if (
            event.id &&
            this.#states[event.id] &&
            (this.#alarmMode || !this.#states[event.id].messagesInAlarmsOnly) &&
            ((this.#states[event.id].defaultMessengers && this.config.defaultTelegram?.length) ||
                (!this.#states[event.id].defaultMessengers &&
                    this.#states[event.id].telegram &&
                    this.#states[event.id].telegram?.length))
        ) {
            const instances =
                (this.#states[event.id].defaultMessengers && this.config.defaultTelegram) ||
                (!this.#states[event.id].defaultMessengers && this.#states[event.id].telegram) ||
                [];

            const ev = this.#formatEvent(event, true);
            if (ev) {
                const text =
                    ev.event +
                    (ev.val !== undefined ? ` => ${ev.val.toString()}${this.#states[event.id].unit || ''}` : '');
                this.log.debug(`Send to 'telegram.${instances.join(',')}' => ${text}`);

                instances.forEach(num => this.sendTo(`telegram.${num}`, 'send', { text }));
            }
        }

        return Promise.resolve();
    }

    async #sendWhatsApp(event: EventItem): Promise<void> {
        if (
            event.id &&
            this.#states[event.id] &&
            (this.#alarmMode || !this.#states[event.id].messagesInAlarmsOnly) &&
            ((this.#states[event.id].defaultMessengers && this.config.defaultWhatsAppCMB?.length) ||
                (!this.#states[event.id].defaultMessengers && this.#states[event.id].whatsAppCMB?.length))
        ) {
            const instances =
                (this.#states[event.id].defaultMessengers && this.config.defaultWhatsAppCMB) ||
                (!this.#states[event.id].defaultMessengers && this.#states[event.id].whatsAppCMB) ||
                [];

            const ev = this.#formatEvent(event, true);
            if (ev) {
                const text =
                    ev.event +
                    (ev.val !== undefined ? ` => ${ev.val.toString()}${this.#states[event.id].unit || ''}` : '');
                this.log.debug(`Send to 'telegram.${instances.join(',')}' => ${text}`);

                instances.forEach(num => this.sendTo(`whatsapp-cmb.${num}`, 'send', { text }));
            }
        }

        return Promise.resolve();
    }

    async #sendPushover(event: EventItem): Promise<void> {
        if (
            event.id &&
            this.#states[event.id] &&
            (this.#alarmMode || !this.#states[event.id].messagesInAlarmsOnly) &&
            ((this.#states[event.id].defaultMessengers && this.config.defaultPushover?.length) ||
                (!this.#states[event.id].defaultMessengers &&
                    this.#states[event.id].pushover &&
                    this.#states[event.id].pushover?.length))
        ) {
            const instances =
                (this.#states[event.id].defaultMessengers && this.config.defaultPushover) ||
                (!this.#states[event.id].defaultMessengers && this.#states[event.id].pushover) ||
                [];

            const ev = this.#formatEvent(event, true);
            if (ev) {
                const text =
                    ev.event +
                    (ev.val !== undefined ? ` => ${ev.val.toString()}${this.#states[event.id].unit || ''}` : '');
                this.log.debug(`Send to 'pushover.${instances.join(',')}' => ${text}`);

                instances.forEach(num => this.sendTo(`pushover.${num}`, 'send', text));
            }
        }

        return Promise.resolve();
    }

    #getRawEventList(): Promise<EventItem[]> {
        return new Promise(resolve => {
            if (!this.#eventListRaw) {
                this.getState('eventListRaw', (err, state) => {
                    this.#eventListRaw = this.#state2json(state);
                    resolve(this.#eventListRaw);
                });
            } else {
                return resolve(this.#eventListRaw);
            }
        });
    }

    async #addEvent(incoming: string | IncomingEvent): Promise<EventItem | undefined> {
        await this.#getRawEventList();

        const event = normalizeEvent(incoming, Date.now());

        if (!event.event && !event.id) {
            this.log.warn('Cannot add empty event to the list');
            return;
        }

        if (isSkippedByAlarmMode(event, this.#alarmMode, this.#states)) {
            this.log.debug(`State ${event.id} => ${event.val} skipped because only in alarm mode`);
            return;
        }

        const eventItem = buildEventItem(event, Date.now(), text => this.log.warn(text));

        applyDurationToPreviousEvent(this.#eventListRaw, event);

        insertEventItem(this.#eventListRaw, eventItem, this.config.maxLength as number);

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
        await this.setForeignStateAsync(
            `${this.namespace}.lastEvent.id`,
            eventItem.id === undefined || eventItem.id === null ? null : eventItem.id.toString(),
            true,
        );
        await this.setForeignStateAsync(`${this.namespace}.lastEvent.ts`, eventItem.ts, true);
        await this.setForeignStateAsync(
            `${this.namespace}.lastEvent.val`,
            eventItem.val === undefined ? null : eventItem.val,
            true,
        );
        await this.setForeignStateAsync(
            `${this.namespace}.lastEvent.duration`,
            eventItem.duration === undefined ? null : eventItem.duration,
            true,
        );
        await this.setForeignStateAsync(`${this.namespace}.lastEvent.json`, JSON.stringify(eventItem), true);
        await this.#sendTelegram(eventItem);
        await this.#sendWhatsApp(eventItem);
        await this.#sendPushover(eventItem);

        return eventItem;
    }

    #getName(obj: ioBroker.Object): string {
        let name = obj.common.name;
        if (typeof name === 'object') {
            name = (name as any)[this.#systemLang] || (name as any).en || '';
        }
        return (name as string) || obj._id;
    }

    #parseStates(states: any): any {
        // todo
        return states;
    }

    async #updateStateSettings(id: string, obj: ioBroker.StateObject | null | undefined): Promise<boolean> {
        if (!obj?.common?.custom?.[this.namespace] || !obj.common.custom[this.namespace].enabled) {
            if (this.#states[id]) {
                this.log.debug(`Removed from event list: ${id}`);
                delete this.#states[id];
                try {
                    await this.unsubscribeForeignStatesAsync(id);
                } catch (e) {
                    this.log.error(`Cannot unsubscribe from ${id}: ${e}`);
                }

                return true;
            }
            return false;
        }

        id = obj._id;
        const needSubscribe = !this.#states[id];
        let changed = false;
        const settings = obj.common.custom[this.namespace] as StateSettings;
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
        } else {
            this.#states[id] = settings;
            changed = true;
        }

        if (this.#states[id].type !== obj.common.type) {
            this.#states[id].type = obj.common.type;
            changed = true;
        }

        const st = this.#parseStates((obj.common as any).states || undefined);
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

        const durationUsed = isDurationUsed(this.#states[id], this.config);
        const oldValueUsed = isOldValueUsed(this.#states[id], this.config);

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
            } catch (e) {
                this.log.error(`Cannot read state ${id}: ${e}`);
                this.#states[id].val = null; // store to detect changes
                this.#states[id].ts = undefined;
            }
        }

        if (needSubscribe) {
            try {
                await this.subscribeForeignStatesAsync(id);
            } catch (e) {
                this.log.error(`Cannot subscribe on ${id}: ${e}`);
            }
        }
        return changed;
    }

    // Read all Object names sequentially that do not have aliases
    async #readAllNames(ids: string[]): Promise<void> {
        for (let i = 0; i < ids.length; i++) {
            try {
                const obj = (await this.getForeignObjectAsync(ids[i])) as ioBroker.StateObject | null | undefined;
                await this.#updateStateSettings(ids[i], obj);
            } catch (e) {
                this.log.error(`Cannot read object ${ids[i]}: ${e}`);
            }
        }
    }

    async #readStates(): Promise<void> {
        const doc = await this.getObjectViewAsync('custom', 'state', {});
        const readNames: string[] = [];
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

    async #reformatJsonTable(allowRelative: boolean, table?: EventItem[]): Promise<FormattedEvent[]> {
        if (!table && !this.#eventListRaw) {
            table = await this.#getRawEventList();
        } else {
            table ||= this.#eventListRaw;
        }

        return formatEventList(table, allowRelative, this.#getEngineContext());
    }

    async #getIconAndColor(
        id: string,
        obj?: ioBroker.StateObject | null,
    ): Promise<{ icon: string; color?: string } | null> {
        if (obj) {
            if (obj.common?.icon) {
                return { icon: obj.common.icon, color: obj.common.color };
            }
        } else {
            obj = (await this.getForeignObjectAsync(id)) as ioBroker.StateObject | null | undefined;

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

    async #updateMomentTimes(table?: EventItem[]): Promise<void> {
        this.#relativeCounter = 0;
        const json = await this.#reformatJsonTable(true, table);
        if (!this.#relativeCounter && this.#momentInterval) {
            clearInterval(this.#momentInterval);
            this.#momentInterval = null;
        }
        await this.setStateAsync('eventJSONList', JSON.stringify(json), true);
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new EventList(options);
} else {
    // otherwise start the instance directly
    (() => new EventList())();
}
