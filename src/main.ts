import * as utils from '@iobroker/adapter-core';
import moment from 'moment';

import list2pdf from '../lib/list2pdf';
import words from './words';

import 'moment/locale/de';
import 'moment/locale/fr';
import 'moment/locale/en-gb';
import 'moment/locale/ru';
import 'moment/locale/it';
import 'moment/locale/es';
import 'moment/locale/pt';
import 'moment/locale/zh-cn';
import 'moment/locale/pl';
import 'moment/locale/pt';
import 'moment/locale/nl';

const DEFAULT_TEMPLATE = 'default';
const MIN_VALID_DATE = new Date(2019, 0, 1).getTime();
const MAX_VALID_DATE = new Date(2050, 0, 1).getTime();

interface AdapterConfig {
    maxLength: number;
    dateFormat: string;
    relativeTime: number;
    defaultBooleanTextTrue: string;
    defaultBooleanTextFalse: string;
    defaultBooleanText: string;
    defaultBooleanColorTrue: string;
    defaultBooleanColorFalse: string;
    defaultBooleanIconTrue: string;
    defaultBooleanIconFalse: string;
    defaultNonBooleanText: string;
    defaultStringTexts: Array<{ value: string; text: string; color: string; icon: string }>;
    language: string;
    icons: boolean;
    duration: boolean;
    deleteAlarmsByDisable: boolean;
    defaultTelegram?: string[];
    defaultWhatsAppCMB?: string[];
    defaultPushover?: string[];
}

interface StateSettings {
    enabled?: boolean;
    event?: string;
    color?: string;
    icon?: string | { icon: string; color: string };
    changesOnly?: boolean;
    alarmsOnly?: boolean;
    defaultMessengers?: boolean;
    messagesInAlarmsOnly?: boolean;
    whatsAppCMB?: string[];
    telegram?: string[];
    pushover?: string[];
    states?: Array<{ val: string; text: string; color: string; icon: string; disabled?: boolean }>;
    type?: string;
    originalStates?: Record<string, string>;
    unit?: string;
    min?: number;
    max?: number;
    name?: string;
    val?: any;
    ts?: number;
    durationUsed?: boolean;
    oldValueUsed?: boolean;
}

interface EventItem {
    ts: number;
    event?: string;
    id?: string;
    val?: any;
    oldVal?: any;
    icon?: string;
    color?: string;
    duration?: number;
    diff?: number;
}

interface FormattedEvent {
    _id: number;
    event: string;
    ts: string;
    _style?: { color: string };
    icon?: string;
    duration?: string;
    val?: any;
    id?: string;
    dr?: number;
}

class EventList extends utils.Adapter {
    #states: Record<string, StateSettings> = {};
    #alarmMode = false;
    #momentInterval: NodeJS.Timeout | null = null;
    #relativeCounter = 0;
    #systemLang!: string;
    #isFloatComma!: boolean;
    #eventListRaw!: EventItem[];
    #textSwitchedOn!: string;
    #textSwitchedOff!: string;
    #textDeviceChangedStatus!: string;
    #textDays!: string;
    #textHours!: string;
    #textMinutes!: string;
    #textSeconds!: string;
    #textMs!: string;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
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
        state = state || ({} as ioBroker.State);
        let table: any = state.val || [];

        if (typeof table !== 'object') {
            try {
                table = JSON.parse(table);
            } catch (e) {
                this.log.warn(`Cannot parse event list: "${table}"`);
                table = [];
            }
        }

        table = table || [];

        return table;
    }

    async #onReady(): Promise<void> {
        const obj = (await this.getForeignObjectAsync('system.config')) as ioBroker.SystemConfigObject | null;
        const systemConfig = obj?.common || ({} as any);
        this.#systemLang = (this.config as any).language || systemConfig.language || 'en';
        this.#isFloatComma = systemConfig.isFloatComma === undefined ? true : systemConfig.isFloatComma;

        this.#textSwitchedOn = words['switched on'][this.#systemLang] || words['switched on'].en;
        this.#textSwitchedOff = words['switched off'][this.#systemLang] || words['switched off'].en;
        this.#textDeviceChangedStatus =
            words['Device %n changed status:'][this.#systemLang] ||
            words['Device %n changed status:'].en;
        this.#textDays = words['days'][this.#systemLang] || words['days'].en;
        this.#textHours = words['hours'][this.#systemLang] || words['hours'].en;
        this.#textMinutes = words['minutes'][this.#systemLang] || words['minutes'].en;
        this.#textSeconds = words['sec'][this.#systemLang] || words['sec'].en;
        this.#textMs = words['ms'][this.#systemLang] || words['ms'].en;

        const config = this.config as any as AdapterConfig;
        config.maxLength = parseInt(config.maxLength as any, 10) || 100;
        config.deleteAlarmsByDisable =
            config.deleteAlarmsByDisable === true || (config.deleteAlarmsByDisable as any) === 'true';
        if (config.maxLength > 10000) {
            config.maxLength = 10000;
        }

        const state = await this.getStateAsync('alarmMode');
        this.#alarmMode = !!(state && state.val);

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
                    list2pdf(this as any, moment, this.instance ? `report-${this.instance}.pdf` : 'report.pdf', table),
                )
                .then(() => this.setForeignStateAsync(`${this.namespace}.triggerPDF`, false, true));
        } else if (id === `${this.namespace}.alarm` && state && !state.ack) {
            this.log.info(`Switch ALARM state to ${state.val}`);

            this.#alarmMode =
                state.val === true ||
                state.val === 'true' ||
                state.val === 1 ||
                state.val === '1' ||
                state.val === 'ON' ||
                state.val === 'on';
            if ((this.config as any).deleteAlarmsByDisable && !this.#alarmMode) {
                return this.#getRawEventList().then(eventList => {
                    const alarmIds = Object.keys(this.#states).filter(id => this.#states[id].alarmsOnly);
                    const count = eventList.length;
                    this.#eventListRaw = eventList.filter(item => !alarmIds.includes(item.id || ''));

                    if (this.#eventListRaw.length !== count) {
                        this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true).then(() =>
                            this.log.debug(
                                `Removed ${count - this.#eventListRaw.length} from the list after the alarm is deactivated`,
                            ),
                        );
                    }
                });
            }
        } else if (id === `${this.namespace}.eventListRaw` && state && !state.ack && state.val) {
            this.#eventListRaw = this.#state2json(state);
            this.#updateMomentTimes().then(() => {});
        } else if (id === `${this.namespace}.insert` && state && !state.ack && state.val) {
            if (typeof state.val === 'string' && state.val.startsWith('{')) {
                try {
                    state.val = JSON.parse(state.val);
                } catch (e) {
                    // ignore
                }
                this.#addEvent(state.val).then(event => this.log.debug(`Event ${JSON.stringify(event)} was added`));
            } else {
                this.#addEvent({ event: state.val.toString() }).then(event =>
                    this.log.debug(`Event ${JSON.stringify(event)} was added`),
                );
            }
        } else if (id === `${this.namespace}.delete` && state && !state.ack && state.val) {
            this.#deleteEvents(state.val).then(count => this.log.debug(`${count} events were deleted from the list`));
        } else if (this.#states[id] && state) {
            if (
                this.#states[id].states &&
                state.val !== null &&
                state.val !== undefined &&
                this.#states[id].states?.[state.val.toString()]?.disabled
            ) {
                this.log.debug(`Value ${state.val} of ${id} was ignored, because disabled`);
                return;
            }

            if (this.#states[id].oldValueUsed) {
                (state as any).oldVal = this.#states[id].val;
            }

            // ignore non changed states
            if (this.#states[id].changesOnly) {
                if (state && this.#states[id].val === state.val) {
                    return;
                } else {
                    // calculate duration
                    if (this.#states[id].durationUsed) {
                        // this event is only started, and we must update the duration of the previous event
                        if (this.#states[id].ts && state.ts >= (this.#states[id].ts || 0)) {
                            (state as any).duration = state.ts - (this.#states[id].ts || 0);
                        } else {
                            (state as any).duration = null;
                        }
                        this.#states[id].ts = state.ts;

                        if (
                            this.#states[id].type === 'number' &&
                            this.#states[id].val !== null &&
                            this.#states[id].val !== undefined &&
                            state.val !== null &&
                            state.val !== undefined
                        ) {
                            (state as any).diff = (state.val as number) - (this.#states[id].val as number);
                        }
                    }
                    this.#states[id].val = state.val;
                }
            } else if (this.#states[id].durationUsed) {
                // calculate duration
                if (this.#states[id].ts && state.ts >= (this.#states[id].ts || 0)) {
                    (state as any).duration = state.ts - (this.#states[id].ts || 0);
                } else {
                    (state as any).duration = null;
                }
                this.#states[id].ts = state.ts;

                if (
                    this.#states[id].type === 'number' &&
                    this.#states[id].val !== null &&
                    this.#states[id].val !== undefined &&
                    state.val !== null &&
                    state.val !== undefined
                ) {
                    (state as any).diff = (state.val as number) - (this.#states[id].val as number);
                }
                this.#states[id].val = state.val;
            }

            (state as any).id = id;

            this.#addEvent(state as any).then(event => this.log.debug(`Event ${JSON.stringify(event)} was added`));
        }
    }

    async #onMessage(obj: ioBroker.Message): Promise<void> {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'insert') {
                // e.g. send email or pushover or whatever
                this.log.debug(`insert event: ${JSON.stringify(obj.message)}`);

                this.#addEvent(obj.message).then(
                    () =>
                        obj.callback && this.sendTo(obj.from, obj.command, { result: 'event inserted' }, obj.callback),
                );
            } else if (obj.command === 'pdf') {
                this.#reformatJsonTable(false)
                    .then(table =>
                        list2pdf(
                            this as any,
                            moment,
                            this.instance ? `report-${this.instance}.pdf` : 'report.pdf',
                            table,
                            obj.message,
                        ),
                    )
                    .then(
                        () => obj.callback && this.sendTo(obj.from, obj.command, { result: 'rendered' }, obj.callback),
                    );
            } else if (obj.command === 'list') {
                this.#getRawEventList().then(table => {
                    table = table || [];
                    // filter items
                    if (
                        obj.message &&
                        (typeof obj.message === 'string' ||
                            typeof (obj.message as any).id === 'string' ||
                            typeof (obj.message as any).ids === 'object')
                    ) {
                        let ids: string[] | string | null = typeof obj.message === 'string' ? obj.message : null;
                        if (!ids && typeof (obj.message as any).id === 'string') {
                            ids = (obj.message as any).id;
                        }
                        if (!ids && typeof (obj.message as any).ids === 'object') {
                            ids = [...(obj.message as any).ids];
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
                        obj.message &&
                        (obj.message as any).count &&
                        parseInt((obj.message as any).count, 10) &&
                        parseInt((obj.message as any).count, 10) < table.length
                    ) {
                        table = table.splice((obj.message as any).count);
                    }

                    this.#reformatJsonTable(
                        (obj.message as any)?.allowRelative === undefined ? true : (obj.message as any).allowRelative,
                        table,
                    ).then(() => obj.callback && this.sendTo(obj.from, obj.command, table, obj.callback));
                });
            } else if (obj.command === 'delete') {
                this.#deleteEvents(obj.message).then(
                    count => obj.callback && this.sendTo(obj.from, obj.command, { deleted: count }, obj.callback),
                );
            }
        }
    }

    async #onObjectChange(id: string, obj: ioBroker.Object | null | undefined): Promise<void> {
        this.#updateStateSettings(id, obj).then(changed => {
            if (changed) {
                return this.#updateMomentTimes();
            }
        });
    }

    #onUnload(callback: () => void): void {
        this.#momentInterval && clearInterval(this.#momentInterval);
        this.#momentInterval = null;
        callback && callback();
    }

    async #deleteEvents(filter: any): Promise<number> {
        return this.#getRawEventList().then(eventList => {
            const count = eventList.length;
            if (!filter || filter === '*') {
                // delete all
                this.#eventListRaw = [];
                return this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true).then(() => count);
            } else if (
                typeof filter === 'number' ||
                (filter.toString()[0] === '2' && filter.length === new Date().toISOString().length)
            ) {
                // Delete by timestamp
                // Attention: this will stop to work in 3000.01.01 :)
                const ts = new Date(filter).getTime();
                this.#eventListRaw = eventList.filter(item => item.ts !== ts);
                if (this.#eventListRaw.length !== count) {
                    return this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true).then(
                        () => count - this.#eventListRaw.length,
                    );
                }
                return Promise.resolve(0);
            }
            // Delete it by State ID
            this.#eventListRaw = eventList.filter(item => item.id !== filter);
            if (this.#eventListRaw.length !== count) {
                return this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true).then(
                    () => count - this.#eventListRaw.length,
                );
            }
            return Promise.resolve(0);
        });
    }

    #duration2text(ms: number, withSpaces?: boolean): string {
        if (ms < 1000) {
            return `${ms}${withSpaces ? ' ' : ''}${this.#textMs}`;
        }
        if (ms < 10000) {
            return `${this.#isFloatComma ? (Math.round(ms / 100) / 10).toString().replace('.', ',') : (Math.round(ms / 100) / 10).toString()}${withSpaces ? ' ' : ''}${this.#textSeconds}`;
        }
        if (ms < 90000) {
            return `${
                this.#isFloatComma
                    ? Math.round(ms / 1000)
                          .toString()
                          .replace('.', ',')
                    : Math.round(ms / 1000).toString()
            }${withSpaces ? ' ' : ''}${this.#textSeconds}`;
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

    #formatEvent(state: EventItem, allowRelative: boolean): FormattedEvent | null {
        const event: Partial<FormattedEvent> = {};
        let eventTemplate = '';
        let val: string | undefined;
        let valWithUnit: string | undefined;
        let color = state.color || '';
        let icon: string | undefined = '';

        const date = new Date(state.ts);
        let time: string;

        if (allowRelative && Date.now() - date.getTime() < (this.config as any).relativeTime * 1000) {
            this.#relativeCounter++;
            if (!this.#momentInterval) {
                this.#momentInterval = setInterval(() => this.#updateMomentTimes(), 10000);
            }
            time = moment(date).fromNow();
        } else {
            time = moment(date).format((this.config as any).dateFormat);
        }

        event._id = date.getTime();

        if (!state.event) {
            const id = state.id || (state as any)._id;
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
                            ? (this.config as any).defaultBooleanTextTrue || this.#textSwitchedOn
                            : item.text;
                    color = item.color || (this.config as any).defaultBooleanColorTrue || this.#states[id].color || '';
                    icon =
                        item.icon ||
                        (typeof this.#states[id].icon === 'string' ? this.#states[id].icon : undefined) ||
                        undefined;
                } else if (!this.#states[id].event && !state.val && item && item.text) {
                    eventTemplate =
                        item.text === DEFAULT_TEMPLATE
                            ? (this.config as any).defaultBooleanTextFalse || this.#textSwitchedOff
                            : item.text;
                    color = item.color || (this.config as any).defaultBooleanColorFalse || this.#states[id].color || '';
                    icon =
                        item.icon ||
                        (typeof this.#states[id].icon === 'string' ? this.#states[id].icon : undefined) ||
                        undefined;
                } else {
                    if (this.#states[id].event === DEFAULT_TEMPLATE) {
                        eventTemplate = (this.config as any).defaultBooleanText || this.#textDeviceChangedStatus;
                    } else {
                        eventTemplate = (this.#states[id].event as any) || '';
                    }

                    if (eventTemplate === null || eventTemplate === undefined) {
                        eventTemplate = '';
                    } else if (typeof eventTemplate !== 'string') {
                        eventTemplate = (eventTemplate as any).toString();
                    }

                    eventTemplate = eventTemplate.replace(/%u/g, this.#states[id].unit || '');
                    eventTemplate = eventTemplate.replace(/%n/g, this.#states[id].name || id);
                    if (item) {
                        val = state.val
                            ? item.text === DEFAULT_TEMPLATE
                                ? (this.config as any).defaultBooleanTextTrue || this.#textSwitchedOn
                                : item.text || this.#textSwitchedOn
                            : item.text === DEFAULT_TEMPLATE
                              ? (this.config as any).defaultBooleanTextFalse || this.#textSwitchedOff
                              : item.text || this.#textSwitchedOff;

                        const iconStr = typeof this.#states[id].icon === 'string' ? this.#states[id].icon : '';
                        icon = state.val
                            ? item.icon === DEFAULT_TEMPLATE
                                ? (this.config as any).defaultBooleanIconTrue || iconStr || ''
                                : item.icon || iconStr || ''
                            : item.icon === DEFAULT_TEMPLATE
                              ? (this.config as any).defaultBooleanIconFalse || iconStr || ''
                              : item.icon || iconStr || '';

                        color = state.val
                            ? item.color === DEFAULT_TEMPLATE
                                ? (this.config as any).defaultBooleanColorTrue || this.#states[id].color || ''
                                : item.color || this.#states[id].color || ''
                            : item.color === DEFAULT_TEMPLATE
                              ? (this.config as any).defaultBooleanColorFalse || this.#states[id].color || ''
                              : item.color || this.#states[id].color || '';
                    } else {
                        val = state.val
                            ? (this.config as any).defaultBooleanTextTrue || this.#textSwitchedOn
                            : (this.config as any).defaultBooleanTextFalse || this.#textSwitchedOff;

                        const iconStr = typeof this.#states[id].icon === 'string' ? this.#states[id].icon : '';
                        icon = state.val
                            ? (this.config as any).defaultBooleanIconTrue || iconStr || ''
                            : (this.config as any).defaultBooleanIconFalse || iconStr || '';

                        color = state.val
                            ? (this.config as any).defaultBooleanColorTrue || this.#states[id].color || ''
                            : (this.config as any).defaultBooleanColorFalse || this.#states[id].color || '';
                    }

                    valWithUnit = val;
                }
            } else {
                eventTemplate =
                    this.#states[id].event === DEFAULT_TEMPLATE
                        ? (this.config as any).defaultNonBooleanText || this.#textDeviceChangedStatus
                        : this.#states[id].event || this.#textDeviceChangedStatus;
                eventTemplate = eventTemplate.replace(/%u/g, this.#states[id].unit || '');
                eventTemplate = eventTemplate.replace(/%n/g, this.#states[id].name || id);

                let tempVal: any = state.val !== undefined ? state.val : '';

                if (tempVal === null) {
                    val = 'null';
                } else if (typeof tempVal === 'number') {
                    val = tempVal.toString();
                    if (this.#isFloatComma) {
                        val = val.replace('.', ',');
                    }
                } else {
                    val = tempVal.toString();
                }

                if (this.#states[id].states) {
                    // try to find text for value in states
                    const item = this.#states[id].states?.find(item => item.val === val);
                    const stateText = item?.val && this.#states[id].originalStates?.[item.val];
                    const def =
                        (this.config as any).defaultStringTexts &&
                        (this.config as any).defaultStringTexts.find(
                            (it: any) => it.value === stateText || it.value === val,
                        );

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
                    } else if (this.#states[id].originalStates && val !== undefined) {
                        val =
                            this.#states[id].originalStates?.[val] === undefined
                                ? val
                                : this.#states[id].originalStates?.[val] || '';
                    }

                    if (!this.#states[id].event && val) {
                        eventTemplate = val;
                        val = '';
                    }
                } else if (this.#states[id].originalStates && val !== undefined) {
                    val =
                        this.#states[id].originalStates?.[val] === undefined
                            ? val
                            : this.#states[id].originalStates?.[val] || '';
                    const def =
                        (this.config as any).defaultStringTexts &&
                        (this.config as any).defaultStringTexts.find((it: any) => it.value === val);
                    if (def) {
                        val = def.text;
                        color = def.color;
                        icon = def.icon;
                    }
                } else {
                    const def =
                        (this.config as any).defaultStringTexts &&
                        (this.config as any).defaultStringTexts.find((it: any) => it.value === val);
                    if (def) {
                        val = def.text;
                        color = def.color;
                        icon = def.icon;
                    }
                }

                if (val !== '' && this.#states[id].unit) {
                    valWithUnit = val + this.#states[id].unit;
                } else {
                    valWithUnit = val;
                }

                icon = icon || (typeof this.#states[id].icon === 'string' ? this.#states[id].icon : undefined);
                color = color || this.#states[id].color || '';
                // todo => change bright of icon depends on value and min/max
            }
        } else {
            eventTemplate = state.event;
            icon = state.icon || undefined;
            color = state.color || '';

            if (state.val !== undefined) {
                const tempVal2: any = state.val;
                if (tempVal2 === null) {
                    val = 'null';
                } else if (typeof tempVal2 === 'number') {
                    val = tempVal2.toString();
                    if (this.#isFloatComma) {
                        val = val.replace('.', ',');
                    }
                } else {
                    val = tempVal2.toString();
                }
            }
        }

        if (icon) {
            color = color || (typeof icon === 'object' ? (icon as any).color : '');
            icon = typeof icon === 'object' ? (icon as any).icon : icon;
        }

        let durationText: string;
        if (state.duration !== undefined) {
            durationText = this.#duration2text(state.duration);
        } else {
            durationText = this.#duration2text(Date.now() - state.ts);
            event.dr = 1; // duration running
            this.#relativeCounter++;
            if (!this.#momentInterval) {
                this.#momentInterval = setInterval(() => this.#updateMomentTimes(), 10000);
            }
        }

        if (eventTemplate.includes('%d')) {
            eventTemplate = eventTemplate.replace(/%d/g, durationText);
        }

        if (eventTemplate.includes('%g')) {
            eventTemplate = eventTemplate.replace(
                /%g/g,
                this.#isFloatComma ? (state.diff || 0).toString().replace('.', ',') : (state.diff || 0).toString(),
            );
        }

        if (eventTemplate.includes('%o')) {
            eventTemplate = eventTemplate.replace(
                /%o/g,
                this.#isFloatComma
                    ? (state.oldVal === undefined || state.oldVal === null ? '_' : state.oldVal)
                          .toString()
                          .replace('.', ',')
                    : state.oldVal === undefined || state.oldVal === null
                      ? '_'
                      : state.oldVal,
            );
        }

        if (eventTemplate.includes('%s')) {
            eventTemplate = eventTemplate.replace(/%s/g, val === undefined ? '' : val);
            valWithUnit = '';
        }

        if (eventTemplate.includes('%t')) {
            eventTemplate = eventTemplate.replace(
                /%t/g,
                moment(new Date(state.ts)).format((this.config as any).dateFormat),
            );
        }

        if (eventTemplate.includes('%r')) {
            eventTemplate = eventTemplate.replace(/%r/g, moment(new Date(state.ts)).fromNow());
        }

        event.event = eventTemplate;
        event.ts = time;

        if (color) {
            event._style = { color };
        }
        if (icon && (this.config as any).icons) {
            event.icon = icon;
        }
        if (durationText && (this.config as any).duration) {
            event.duration = durationText;
        }

        if (valWithUnit !== '' && valWithUnit !== undefined) {
            event.val = valWithUnit;
        } else {
            event.val = val;
        }
        // because of filter add event.id
        if (state.id) {
            event.id = state.id;
        }

        return event as FormattedEvent;
    }

    async #sendTelegram(event: EventItem): Promise<void> {
        if (
            event.id &&
            this.#states[event.id] &&
            (this.#alarmMode || !this.#states[event.id].messagesInAlarmsOnly) &&
            ((this.#states[event.id].defaultMessengers && (this.config as any).defaultTelegram?.length) ||
                (!this.#states[event.id].defaultMessengers &&
                    this.#states[event.id].telegram &&
                    this.#states[event.id].telegram?.length))
        ) {
            const instances =
                (this.#states[event.id].defaultMessengers && (this.config as any).defaultTelegram) ||
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
            ((this.#states[event.id].defaultMessengers && (this.config as any).defaultWhatsAppCMB?.length) ||
                (!this.#states[event.id].defaultMessengers && this.#states[event.id].whatsAppCMB?.length))
        ) {
            const instances =
                (this.#states[event.id].defaultMessengers && (this.config as any).defaultWhatsAppCMB) ||
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
            ((this.#states[event.id].defaultMessengers && (this.config as any).defaultPushover?.length) ||
                (!this.#states[event.id].defaultMessengers &&
                    this.#states[event.id].pushover &&
                    this.#states[event.id].pushover?.length))
        ) {
            const instances =
                (this.#states[event.id].defaultMessengers && (this.config as any).defaultPushover) ||
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

    async #addEvent(event: any): Promise<EventItem | undefined> {
        await this.#getRawEventList();
        const _event: EventItem = {} as EventItem;

        if (typeof event === 'string') {
            event = { event };
        }

        if (!event.event && !event.id) {
            this.log.warn('Cannot add empty event to the list');
            return;
        }

        if (!this.#alarmMode && this.#states[event.id] && this.#states[event.id].alarmsOnly) {
            this.log.debug(`State ${event.id} => ${event.val} skipped because only in alarm mode`);
            return;
        }

        _event.ts = event.ts || Date.now();

        if (typeof _event.ts !== 'number') {
            _event.ts = new Date(_event.ts).getTime();
        } else {
            if (_event.ts < MIN_VALID_DATE || _event.ts > MAX_VALID_DATE) {
                this.log.warn(`Invalid date provided in event: ${new Date(_event.ts).toISOString()}`);
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
            const prevEvent = this.#eventListRaw.find(item => item.id === event.id);
            if (prevEvent) {
                prevEvent.duration = event.duration;
            }
        }

        // time must be unique
        while (this.#eventListRaw.find(item => item.ts === _event.ts)) {
            _event.ts++;
        }

        this.#eventListRaw.unshift(_event);
        this.#eventListRaw.sort((a, b) => (a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0));

        this.log.debug(`Add ${JSON.stringify(_event)}`);

        if (this.#eventListRaw.length > (this.config as any).maxLength) {
            this.#eventListRaw.splice(
                (this.config as any).maxLength,
                this.#eventListRaw.length - (this.config as any).maxLength,
            );
        }

        const ev = this.#formatEvent(_event, true);

        if (ev) {
            await this.setStateAsync('eventListRaw', JSON.stringify(this.#eventListRaw), true);
            await this.#updateMomentTimes();
            await this.setForeignStateAsync(`${this.namespace}.lastEvent.event`, ev.event, true);
            await this.setForeignStateAsync(
                `${this.namespace}.lastEvent.id`,
                _event.id === undefined || _event.id === null ? null : _event.id.toString(),
                true,
            );
            await this.setForeignStateAsync(`${this.namespace}.lastEvent.ts`, _event.ts, true);
            await this.setForeignStateAsync(
                `${this.namespace}.lastEvent.val`,
                _event.val === undefined ? null : _event.val,
                true,
            );
            await this.setForeignStateAsync(
                `${this.namespace}.lastEvent.duration`,
                _event.duration === undefined ? null : _event.duration,
                true,
            );
            await this.setForeignStateAsync(`${this.namespace}.lastEvent.json`, JSON.stringify(_event), true);
            await this.#sendTelegram(_event);
            await this.#sendWhatsApp(_event);
            await this.#sendPushover(_event);
        }

        return _event;
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

    async #updateStateSettings(id: string, obj: ioBroker.Object | null | undefined): Promise<boolean> {
        if (!obj?.common?.custom?.[this.namespace] || !(obj.common.custom[this.namespace] as any).enabled) {
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
        const settings = obj.common.custom[this.namespace] as any as StateSettings;
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
        if (this.#states[id].unit !== (obj.common as any).unit) {
            this.#states[id].unit = (obj.common as any).unit;
            changed = true;
        }
        if (this.#states[id].min !== (obj.common as any).min) {
            this.#states[id].min = (obj.common as any).min;
            changed = true;
        }
        if (this.#states[id].max !== (obj.common as any).max) {
            this.#states[id].max = (obj.common as any).max;
            changed = true;
        }

        const name = this.#getName(obj);
        if (this.#states[id].name !== name) {
            this.#states[id].name = name;
            changed = true;
        }

        let durationUsed = (this.config as any).duration;

        if (!durationUsed && this.#states[id].states) {
            if (this.#states[id].type === 'boolean') {
                durationUsed =
                    (this.#states[id].event || (this.config as any).defaultBooleanText).includes('%d') ||
                    (this.#states[id].event || (this.config as any).defaultBooleanText).includes('%g');

                if (!durationUsed) {
                    const item = this.#states[id].states?.find(item => item.val === 'true');

                    durationUsed =
                        ((item && item.text) || (this.config as any).defaultBooleanTextTrue).includes('%d') ||
                        ((item && item.text) || (this.config as any).defaultBooleanTextTrue).includes('%d');
                }
                if (!durationUsed) {
                    const item = this.#states[id].states?.find(item => item.val === 'false');

                    durationUsed =
                        ((item && item.text) || (this.config as any).defaultBooleanTextFalse).includes('%d') ||
                        ((item && item.text) || (this.config as any).defaultBooleanTextFalse).includes('%g');
                }
            } else {
                durationUsed =
                    (this.#states[id].event || (this.config as any).defaultNonBooleanText).includes('%d') ||
                    (this.#states[id].event || (this.config as any).defaultNonBooleanText).includes('%g');

                if (!durationUsed) {
                    durationUsed = !!this.#states[id].states?.find(
                        item => item.text.includes('%d') || item.text.includes('%g'),
                    );
                }
            }
        } else if (!durationUsed) {
            durationUsed =
                (this.#states[id].event || (this.config as any).defaultNonBooleanText).includes('%d') ||
                (this.#states[id].event || (this.config as any).defaultNonBooleanText).includes('%g');
        }

        let oldValueUsed = false;

        if (this.#states[id].states) {
            if (this.#states[id].type === 'boolean') {
                oldValueUsed = (this.#states[id].event || (this.config as any).defaultBooleanText).includes('%o');

                if (!oldValueUsed) {
                    const item = this.#states[id].states?.find(item => item.val === 'true');

                    oldValueUsed = ((item && item.text) || (this.config as any).defaultBooleanTextTrue).includes('%o');
                }
                if (!oldValueUsed) {
                    const item = this.#states[id].states?.find(item => item.val === 'false');

                    oldValueUsed = ((item && item.text) || (this.config as any).defaultBooleanTextFalse).includes('%o');
                }
            } else {
                oldValueUsed = (this.#states[id].event || (this.config as any).defaultNonBooleanText).includes('%o');
                oldValueUsed = oldValueUsed || !!this.#states[id].states?.find(item => item.text.includes('%o'));
            }
        } else {
            oldValueUsed =
                oldValueUsed || (this.#states[id].event || (this.config as any).defaultNonBooleanText).includes('%o');
        }

        if (this.#states[id].oldValueUsed !== oldValueUsed) {
            this.#states[id].oldValueUsed = oldValueUsed;
            changed = true;
        }

        if (this.#states[id].durationUsed !== durationUsed) {
            this.#states[id].durationUsed = durationUsed;
            changed = true;
        }

        if ((this.config as any).icons && (!this.#states[id].color || !this.#states[id].icon)) {
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

    // Read all Object names sequentially, that do not have aliases
    async #readAllNames(ids: string[]): Promise<void> {
        for (let i = 0; i < ids.length; i++) {
            try {
                const obj = await this.getForeignObjectAsync(ids[i]);
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
                if ((obj as any)?.[this.namespace]?.enabled) {
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

        return table.map(ev => this.#formatEvent(ev, allowRelative)).filter((ev): ev is FormattedEvent => ev !== null);
    }

    async #getIconAndColor(id: string, obj?: ioBroker.Object | null): Promise<{ icon: string; color: string } | null> {
        if (obj) {
            if (obj.common && (obj.common as any).icon) {
                return { icon: (obj.common as any).icon, color: (obj.common as any).color };
            }
        } else {
            obj = await this.getForeignObjectAsync(id);

            if (obj && obj.common && (obj.common as any).icon) {
                return { icon: (obj.common as any).icon, color: (obj.common as any).color };
            }
        }

        const parts = id.split('.');
        parts.pop();
        obj = await this.getForeignObjectAsync(parts.join('.'));
        if (obj && obj.type === 'channel') {
            if (obj.common && (obj.common as any).icon) {
                return { icon: (obj.common as any).icon, color: (obj.common as any).color };
            } else {
                const parts = obj._id.split('.');
                parts.pop();
                obj = await this.getForeignObjectAsync(parts.join('.'));
                if (obj && (obj.type === 'channel' || obj.type === 'device')) {
                    if (obj.common && (obj.common as any).icon) {
                        return { icon: (obj.common as any).icon, color: (obj.common as any).color };
                    }
                    return null;
                }
                return null;
            }
        }
        if (obj && obj.type === 'device' && obj.common) {
            return { icon: (obj.common as any).icon, color: (obj.common as any).color };
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
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new EventList(options);
} else {
    // otherwise start the instance directly
    (() => new EventList())();
}
