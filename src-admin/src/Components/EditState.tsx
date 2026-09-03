import React, { Component, type ComponentType, type CSSProperties, type JSX } from 'react';
import moment from 'moment';

import 'moment/locale/fr';
import 'moment/locale/de';
import 'moment/locale/en-gb';
import 'moment/locale/ru';
import 'moment/locale/it';
import 'moment/locale/es';
import 'moment/locale/pt';
import 'moment/locale/zh-cn';
import 'moment/locale/pl';
import 'moment/locale/nl';

import {
    TextField,
    FormControlLabel,
    Checkbox,
    Switch,
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    InputLabel,
    MenuItem,
    FormControl,
    Select,
    IconButton,
    type SelectChangeEvent,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';

import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { FaMinus as EmptyIcon, FaWhatsapp as WhatsappIcon } from 'react-icons/fa';

import {
    I18n,
    IconPicker,
    Image,
    withWidth,
    ColorPicker,
    type AdminConnection,
    type ThemeName,
    type ThemeType,
    type Width,
} from '@iobroker/gui-components';

import Telegram from '../assets/telegram.svg';
import Pushover from '../assets/pushover.svg';

import MessengerSelect from './MessengerSelect';
import type {
    DefaultStringText,
    EditStateSettings,
    EventListNative,
    StateValueSettings,
    StoredStateSettings,
    StoredStateValueSettings,
} from '../types';

const styles: Record<string, CSSProperties> = {
    textField: {
        width: 250,
        marginRight: 8,
    },
    exampleTitle: {
        fontWeight: 'bold',
    },
    exampleText: {
        marginLeft: 8,
        fontStyle: 'italic',
        fontSize: 20,
    },
    textDense: {
        marginTop: 0,
        marginBottom: 0,
    },
    paper: {
        marginBottom: 8,
        padding: 8,
        width: 'calc(100% - 16px)',
    },
    formControl: {
        width: 200,
    },
    inputMessengers: {
        minWidth: 200,
        marginRight: 16,
        marginBottom: 16,
    },
    flex: {
        flexGrow: 1,
    },
    messengersIcon: {
        width: 24,
        height: 24,
    },
    whatsAppIcon: {
        color: '#45c655',
    },
    width100: {
        width: '100%',
    },
    width100minus32: {
        width: 'calc(100% - 32px)',
    },
    iconOpenAll: {
        float: 'right',
        marginRight: 4,
    },
    iconCloseAll: {
        float: 'right',
    },
};

const sxExamplePaper = (theme: Theme): { marginBottom: number; background: string } => ({
    marginBottom: 2,
    background: theme.palette.mode === 'dark' ? '#5f5f5f' : '#d8d8d8',
});

const DEFAULT_TEMPLATE = 'default';
const DISABLED_TEXT = '-------------';

interface EditStateProps {
    instance: number;
    adapterName: string;
    /** Called with the modified settings (GUI format). Use `EditState.getSettings` to convert them for storing */
    onChange: (id: string, settings: EditStateSettings) => void;
    themeName?: ThemeName;
    themeType?: ThemeType;
    socket: AdminConnection;
    native: EventListNative;
    id: string;
    /** Settings are being read from the server */
    reading?: boolean;
    settings: EditStateSettings;
    imagePrefix?: string;
    /** Provided by withWidth */
    width?: Width;
}

interface EditStateState {
    id: string;
    settings: EditStateSettings;
    expanded: string[];
    /** For boolean: toggle the current state; for numeric enum: the simulated value; null: use the current value */
    simulateState: boolean | string | null;
    /** Current value of the state */
    state: ioBroker.State | null;
}

export class EditState extends Component<EditStateProps, EditStateState> {
    private readonly imagePrefix?: string;
    private readonly language: ioBroker.Languages;
    private readonly textSwitchedOn: string;
    private readonly textSwitchedOff: string;
    private readonly textDeviceChangedStatus: string;
    private isFloatComma = false;

    constructor(props: EditStateProps) {
        super(props);

        let expanded: string[];
        try {
            expanded = JSON.parse(window.localStorage.getItem('eventlist.addid.expanded') || '[]');
        } catch {
            expanded = [];
        }

        this.state = {
            id: this.props.id || '',
            settings: JSON.parse(JSON.stringify(this.props.settings)),
            expanded,
            simulateState: null,
            state: null,
        };

        this.imagePrefix = this.props.imagePrefix;
        this.language = this.props.native.language || I18n.getLanguage();
        moment.locale(this.language === 'en' ? 'en-gb' : this.language);

        this.textSwitchedOn = EditState.translate('switched on', this.language);
        this.textSwitchedOff = EditState.translate('switched off', this.language);
        this.textDeviceChangedStatus = EditState.translate('Device %n changed status:', this.language);
    }

    componentDidMount(): void {
        void this.props.socket.getSystemConfig().then(systemConfig => {
            this.isFloatComma = !!systemConfig?.common?.isFloatComma;
            this.forceUpdate();
        });
        void this.props.socket.subscribeState(this.props.id, this.onStateChanged);
    }

    componentWillUnmount(): void {
        this.props.socket.unsubscribeState(this.props.id, this.onStateChanged);
    }

    onStateChanged = (_id: string, state: ioBroker.State | null | undefined): void =>
        this.setState({ state: state || null });

    /**
     * Converts the "default" markers of text/color/icon into the defText/defColor/defIcon flags
     *
     * @returns true if something was changed
     */
    static normalizeDefaults(item: StateValueSettings): boolean {
        let changed = false;

        // text
        let newFlag = item.text === DEFAULT_TEMPLATE;
        if (newFlag !== item.defText) {
            changed = true;
            item.defText = newFlag;
        }
        let newVal = item.text === DEFAULT_TEMPLATE ? '' : item.text;
        if (newVal !== item.text) {
            changed = true;
            item.text = newVal;
        }

        // color
        newFlag = item.color === DEFAULT_TEMPLATE;
        if (newFlag !== item.defColor) {
            changed = true;
            item.defColor = newFlag;
        }
        newVal = item.color === DEFAULT_TEMPLATE ? '' : item.color;
        if (newVal !== item.color) {
            changed = true;
            item.color = newVal;
        }

        // icon
        newFlag = item.icon === DEFAULT_TEMPLATE;
        if (newFlag !== item.defIcon) {
            changed = true;
            item.defIcon = newFlag;
        }
        newVal = item.icon === DEFAULT_TEMPLATE ? '' : item.icon;
        if (newVal !== item.icon) {
            changed = true;
            item.icon = newVal;
        }

        return changed;
    }

    static addBooleanStates(newState: EditStateSettings): boolean {
        const states: StateValueSettings[] = JSON.parse(JSON.stringify(newState.states || []));
        let changed = false;
        let trueState = states.find(item => item.val === 'true');
        if (!trueState) {
            trueState = {
                val: 'true',
                text: DEFAULT_TEMPLATE,
                color: DEFAULT_TEMPLATE,
                icon: DEFAULT_TEMPLATE,
                original: 'true',
                disabled: false,
            };
            states.push(trueState);
            changed = true;
        } else {
            trueState.original = 'true';
        }
        let falseState = states.find(item => item.val === 'false');
        if (!falseState) {
            falseState = {
                val: 'false',
                text: DEFAULT_TEMPLATE,
                color: DEFAULT_TEMPLATE,
                icon: DEFAULT_TEMPLATE,
                original: 'false',
                disabled: false,
            };
            states.push(falseState);
            changed = true;
        } else {
            falseState.original = 'false';
        }

        if (EditState.normalizeDefaults(trueState)) {
            changed = true;
        }
        if (EditState.normalizeDefaults(falseState)) {
            changed = true;
        }

        if (changed) {
            newState.states = states;
            return true;
        }
        return false;
    }

    static parseStates(
        states: Record<string, string> | string[] | string | undefined | null,
    ): Record<string, string> | null {
        // convert ['zero', 'one', 'two'] => {'0': 'zero', '1': 'one', '2': 'two'}
        if (Array.isArray(states)) {
            const nState: Record<string, string> = {};
            states.forEach((val, i) => (nState[i] = val));
            return nState;
        }
        if (!states || typeof states !== 'object') {
            return null;
        }
        return states;
    }

    static addNumericStates(
        newState: EditStateSettings,
        objStates: Record<string, string> | string[] | string | undefined,
        defaultStringTexts?: DefaultStringText[],
    ): boolean {
        const states: StateValueSettings[] = JSON.parse(JSON.stringify(newState.states || []));
        let changed = false;
        const parsedStates = EditState.parseStates(objStates);
        if (parsedStates) {
            // {'value': 'valueName', 'value2': 'valueName2', 0: 'OFF', 1: 'ON'}
            Object.keys(parsedStates).forEach(attr => {
                let _st = states.find(item => item.val === attr);
                if (!_st) {
                    _st = { val: attr, text: parsedStates[attr], color: '', icon: '', disabled: false };
                    // check default states
                    const def = defaultStringTexts?.find(item => item.value === attr);
                    if (def) {
                        _st.text = def.text ? DEFAULT_TEMPLATE : parsedStates[attr];
                        _st.color = def.color ? DEFAULT_TEMPLATE : '';
                        _st.icon = def.icon ? DEFAULT_TEMPLATE : '';
                    }

                    states.push(_st);
                    changed = true;
                }
            });

            states.forEach(item => {
                if (EditState.normalizeDefaults(item)) {
                    changed = true;
                }

                if (item.original !== parsedStates[item.val]) {
                    item.original = parsedStates[item.val];
                    changed = true;
                }
            });

            if (changed) {
                newState.states = states;
                return true;
            }
            return false;
        }
        if (newState.states) {
            newState.states = null;
            return true;
        }
        return false;
    }

    static async extractIconAndColor(
        socket: AdminConnection,
        obj: ioBroker.Object,
    ): Promise<{ icon: string; color?: string } | null> {
        if (obj?.common?.icon) {
            return { icon: obj.common.icon, color: obj.common.color };
        }
        const parts = obj._id.split('.');
        parts.pop();

        const parent = await socket.getObject(parts.join('.'));
        if (parent?.type === 'channel') {
            if (parent.common?.icon) {
                return { icon: parent.common.icon, color: parent.common.color };
            }
            const parentParts = parent._id.split('.');
            parentParts.pop();
            const grandParent = await socket.getObject(parentParts.join('.'));
            if (grandParent && (grandParent.type === 'channel' || grandParent.type === 'device')) {
                if (grandParent.common?.icon) {
                    return { icon: grandParent.common.icon, color: grandParent.common.color };
                }
            }
            return null;
        }
        if (parent?.common && parent.type === 'device') {
            return { icon: parent.common.icon || '', color: parent.common.color };
        }
        return null;
    }

    static async readSettingsFromServer(
        socket: AdminConnection,
        lang: ioBroker.Languages,
        native: EventListNative,
        namespace: string,
        id: string,
    ): Promise<{ settings: EditStateSettings; exists: boolean }> {
        const obj = await socket.getObject(id);
        const common = obj?.common as ioBroker.StateCommon | undefined;

        const settings: EditStateSettings = {
            type: common?.type || '',
            name: obj ? EditState.getName(obj, lang) : id,
            unit: common?.unit || '',
            whatsAppCMB: [],
            pushover: [],
            telegram: [],
            event: '',
            icon: '',
            color: '',
            alarmsOnly: false,
            messagesInAlarmsOnly: false,
        };

        let exists: boolean;

        const custom: StoredStateSettings | undefined = common?.custom?.[namespace];

        if (custom) {
            exists = true;

            settings.event = custom.event === DEFAULT_TEMPLATE ? '' : custom.event;
            settings.eventDefault = custom.event === DEFAULT_TEMPLATE;
            settings.icon = custom.icon || '';
            settings.color = custom.color || '';
            settings.states = custom.states as StateValueSettings[] | undefined;
            settings.alarmsOnly = !!custom.alarmsOnly;
            settings.messagesInAlarmsOnly = !!custom.messagesInAlarmsOnly;
            settings.whatsAppCMB = custom.whatsAppCMB || [];
            settings.pushover = custom.pushover || [];
            settings.telegram = custom.telegram || [];
            settings.changesOnly = custom.changesOnly;

            settings.defaultMessengers = custom.defaultMessengers === undefined ? true : custom.defaultMessengers;
        } else {
            exists = false;

            settings.defaultMessengers = true;
            settings.whatsAppCMB = native.defaultWhatsAppCMB || [];
            settings.pushover = native.defaultPushover || [];
            settings.telegram = native.defaultTelegram || [];
        }

        if (settings.type === 'boolean') {
            EditState.addBooleanStates(settings);
            settings.simulateState = false;
        } else if (settings.type === 'number' && common?.states && typeof common.states === 'object') {
            EditState.addNumericStates(settings, common.states, native.defaultStringTexts);
            settings.simulateState = null;
        } else {
            settings.states = null;
            settings.simulateState = null;
        }

        if (obj) {
            const result = await EditState.extractIconAndColor(socket, obj);
            if (result?.icon) {
                // we must get from /icons/113_hmip-psm_thumb.png => /adapter/hm-rpc/icons/113_hmip-psm_thumb.png
                // or                                                /hm-rpc.admin/icons/113_hmip-psm_thumb.png
                settings.ownIcon = `/adapter/${obj._id.split('.')[0]}${result.icon}`;
            }
            if (result?.color) {
                settings.ownColor = result.color;
            }
        }

        return { settings, exists };
    }

    static getName(obj: ioBroker.Object, lang: ioBroker.Languages): string {
        let name: ioBroker.StringOrTranslated | undefined = obj.common?.name;
        if (name && typeof name === 'object') {
            name = name[lang] || name.en || '';
        }
        return name || obj._id;
    }

    /**
     * Translate the word into the language of the adapter (which may differ from the GUI language)
     */
    static translate(word: string, lang?: ioBroker.Languages): string {
        lang = lang || I18n.getLanguage();
        const translations = window.i18nTranslations;
        const w = translations?.[lang]?.[word] || translations?.en?.[word];
        return w || word;
    }

    getSimulatedValue(): string {
        let stateVal: ioBroker.StateValue = !!this.state.state?.val;
        if (this.state.settings.type === 'boolean' && this.state.simulateState) {
            stateVal = !stateVal;
        } else if (this.state.settings.type !== 'boolean' && this.state.simulateState !== null) {
            stateVal = this.state.simulateState;
        }
        return stateVal === undefined || stateVal === null ? '' : stateVal.toString();
    }

    getExampleColor(): string {
        let color = this.state.settings.ownColor || '';
        if (this.state.settings.states) {
            const stateVal = this.getSimulatedValue();
            const item = this.state.settings.states.find(it => it.val === stateVal);

            if (item?.defColor) {
                const def =
                    this.state.settings.type !== 'boolean' &&
                    this.props.native.defaultStringTexts?.find(t => t.value === stateVal || t.value === item.original);
                if (def) {
                    color = def.color;
                } else {
                    color =
                        stateVal === 'true'
                            ? ColorPicker.getColor(this.props.native.defaultBooleanColorTrue)
                            : ColorPicker.getColor(this.props.native.defaultBooleanColorFalse);
                }
            } else if (item?.color && ColorPicker.getColor(item.color)) {
                color = ColorPicker.getColor(item.color);
            }
        }
        color ||= (this.state.settings.color && ColorPicker.getColor(this.state.settings.color)) || '';

        return color;
    }

    getExampleIcon(): string {
        const defIcon = this.state.settings.icon || this.state.settings.ownIcon;
        let icon = defIcon || '';
        if (this.state.settings.states) {
            const stateVal = this.getSimulatedValue();
            const item = this.state.settings.states.find(it => it.val === stateVal);

            if (item?.defIcon) {
                const def =
                    this.state.settings.type !== 'boolean' &&
                    this.props.native.defaultStringTexts?.find(t => t.value === stateVal || t.value === item.original);
                if (def) {
                    icon = def.icon || '';
                } else {
                    icon =
                        (stateVal === 'true'
                            ? this.props.native.defaultBooleanIconTrue
                            : this.props.native.defaultBooleanIconFalse) ||
                        this.state.settings.ownIcon ||
                        '';
                }
            } else if (item?.icon) {
                icon = item.icon;
            }
        }

        return icon;
    }

    getExampleText(): string {
        let text = '';
        let stateVal: ioBroker.StateValue | undefined = this.state.state
            ? this.state.state.val
            : this.state.settings.type === 'boolean'
              ? false
              : null;

        if (this.state.settings.states) {
            if (this.state.settings.type === 'boolean' && this.state.simulateState) {
                stateVal = !stateVal;
            } else if (this.state.settings.type !== 'boolean' && this.state.simulateState !== null) {
                stateVal = this.state.simulateState;
            }
            const stateValStr = stateVal === undefined || stateVal === null ? '' : stateVal.toString();
            const item = this.state.settings.states.find(it => it.val === stateValStr);

            if (item?.disabled) {
                return DISABLED_TEXT;
            }

            if (stateValStr === 'true' && item) {
                text = item.defText
                    ? this.props.native.defaultBooleanTextTrue || this.textSwitchedOn
                    : item.text || this.textSwitchedOn;
            } else if (stateValStr === 'false' && item) {
                text = item.defText
                    ? this.props.native.defaultBooleanTextFalse || this.textSwitchedOff
                    : item.text || this.textSwitchedOff;
            } else if (item?.defText) {
                const def =
                    this.state.settings.type !== 'boolean' &&
                    this.props.native.defaultStringTexts?.find(
                        t => t.value === stateValStr || t.value === item.original,
                    );
                if (def) {
                    text = def.text;
                } else {
                    text =
                        stateValStr === 'true'
                            ? this.props.native.defaultBooleanTextTrue
                            : this.props.native.defaultBooleanTextFalse;
                }
            } else if (item?.text) {
                text = item.text;
            } else {
                text = stateValStr;
            }
        } else if (stateVal === null || stateVal === undefined) {
            text = 'null';
        } else if (typeof stateVal === 'number') {
            text = stateVal.toString();
            if (this.isFloatComma) {
                text = text.replace('.', ',');
            }
        } else {
            text = stateVal.toString();
        }

        return text || '';
    }

    buildExample(): string {
        let eventTemplate = '';
        let valWithUnit = '';
        const time = this.state.state?.ts
            ? moment(new Date(this.state.state.ts)).format(this.props.native.dateFormat)
            : this.props.native.dateFormat;

        const valText = this.getExampleText();

        if (valText === DISABLED_TEXT) {
            return I18n.t('DISABLED');
        }

        if (this.state.settings.type === 'boolean') {
            let stateVal = !!this.state.state?.val;
            if (this.state.simulateState) {
                stateVal = !stateVal;
            }

            if (!this.state.settings.eventDefault && !this.state.settings.event && valText) {
                eventTemplate = valText;
            } else {
                if (this.state.settings.event === DEFAULT_TEMPLATE || this.state.settings.eventDefault) {
                    eventTemplate = this.props.native.defaultBooleanText || this.textDeviceChangedStatus;
                } else {
                    eventTemplate = this.state.settings.event;
                }
                eventTemplate = eventTemplate.replace(/%u/g, this.state.settings.unit || '');
                eventTemplate = eventTemplate.replace(/%n/g, this.state.settings.name || this.props.id);
                valWithUnit = valText || (stateVal ? this.textSwitchedOn : this.textSwitchedOff);
            }
        } else {
            eventTemplate =
                this.state.settings.event === DEFAULT_TEMPLATE
                    ? this.props.native.defaultNonBooleanText || this.textDeviceChangedStatus
                    : this.state.settings.event || this.textDeviceChangedStatus;

            valWithUnit = valText;
            if (valWithUnit !== '' && this.state.settings.unit) {
                valWithUnit += this.state.settings.unit;
            }
            if (this.state.settings.states) {
                if (!this.state.settings.eventDefault && !this.state.settings.event) {
                    eventTemplate = valWithUnit;
                    valWithUnit = '';
                }
            }
            eventTemplate = eventTemplate.replace(/%u/g, this.state.settings.unit || '');
            eventTemplate = eventTemplate.replace(/%n/g, this.state.settings.name || this.props.id);
        }

        if (eventTemplate.includes('%d')) {
            eventTemplate = eventTemplate.replace(/%d/g, this.duration2text(5000));
        }

        if (eventTemplate.includes('%s')) {
            eventTemplate = eventTemplate.replace(/%s/g, valText);
            valWithUnit = '';
        }

        if (eventTemplate.includes('%t')) {
            eventTemplate = eventTemplate.replace(
                /%t/g,
                this.state.state
                    ? moment(new Date(this.state.state.ts)).format(this.props.native.dateFormat)
                    : this.props.native.dateFormat,
            );
        }

        if (eventTemplate.includes('%r')) {
            eventTemplate = eventTemplate.replace(
                /%r/g,
                this.state.state ? moment(new Date(this.state.state.ts)).fromNow() : moment(new Date()).fromNow(),
            );
        }

        if (eventTemplate.includes('%o')) {
            eventTemplate = eventTemplate.replace(/%o/g, '_');
        }

        return `${time} | ${eventTemplate} | ${valWithUnit}`;
    }

    /**
     * Converts the GUI settings into the settings that are stored in `object.common.custom`
     */
    static getSettings(settings: EditStateSettings): StoredStateSettings {
        const curSettings: StoredStateSettings = {
            enabled: true,
            event: settings.eventDefault ? DEFAULT_TEMPLATE : settings.event,
            changesOnly: !!settings.changesOnly,
            defaultMessengers: !!settings.defaultMessengers,
        };

        if (settings.color && ColorPicker.getColor(settings.color)) {
            curSettings.color = ColorPicker.getColor(settings.color);
        }
        if (settings.icon) {
            curSettings.icon = settings.icon;
        }
        if (settings.alarmsOnly) {
            curSettings.alarmsOnly = true;
        }
        if (settings.messagesInAlarmsOnly) {
            curSettings.messagesInAlarmsOnly = true;
        }
        if (settings.pushover?.length && !settings.defaultMessengers) {
            curSettings.pushover = settings.pushover;
        }
        if (settings.telegram?.length && !settings.defaultMessengers) {
            curSettings.telegram = settings.telegram;
        }
        if (settings.whatsAppCMB?.length && !settings.defaultMessengers) {
            curSettings.whatsAppCMB = settings.whatsAppCMB;
        }

        settings.states?.forEach(item => {
            curSettings.states = curSettings.states || [];
            const it: StoredStateValueSettings = { val: item.val };

            if (item.disabled) {
                it.disabled = true;
                curSettings.states.push(it);
                return;
            }

            it.text = item.defText ? DEFAULT_TEMPLATE : item.text || '';
            if (item.defColor || (item.color && ColorPicker.getColor(item.color))) {
                it.color = item.defColor ? DEFAULT_TEMPLATE : ColorPicker.getColor(item.color);
            }
            if (item.defIcon || item.icon) {
                it.icon = item.defIcon ? DEFAULT_TEMPLATE : item.icon;
            }

            curSettings.states.push(it);
        });

        return curSettings;
    }

    duration2text(ms: number, withSpaces?: boolean): string {
        const space = withSpaces ? ' ' : '';
        if (ms < 1000) {
            return `${ms}${space}${I18n.t('ms')}`;
        } else if (ms < 90000) {
            const seconds = (Math.round(ms / 100) / 10).toString();
            return `${this.isFloatComma ? seconds.replace('.', ',') : seconds}${space}${I18n.t('seconds')}`;
        } else if (ms < 3600000) {
            return `${Math.floor(ms / 60000)}${space}${I18n.t('minutes')} ${Math.round((ms % 60000) / 1000)}${space}${I18n.t('seconds')}`;
        }
        let hours = Math.floor(ms / 3600000);
        const minutes = Math.floor(ms / 60000) % 60;
        const seconds = Math.round(Math.floor(ms % 60000) / 1000);
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            hours %= 24;
            if (days > 2) {
                return `${days}${space}${I18n.t('days')} ${hours}${space}${I18n.t('hours')}`;
            }
            return `${days}${space}${I18n.t('days')} ${hours}${space}${I18n.t('hours')} ${minutes}${space}${I18n.t('minutes')}`;
        }
        if (hours > 2) {
            return `${hours}${space}${I18n.t('hours')} ${minutes}${space}${I18n.t('minutes')}`;
        }
        return `${hours}${space}${I18n.t('hours')} ${minutes}${space}${I18n.t('minutes')} ${seconds}${space}${I18n.t('seconds')}`;
    }

    onToggle(id: string | boolean): void {
        let expanded: string[];
        if (id === false) {
            expanded = [];
        } else if (id === true) {
            expanded = ['state_settings', 'state_messengers'];
            this.state.settings.states?.forEach(state => expanded.push(`state_${state.val}`));
        } else {
            expanded = [...this.state.expanded];
            const pos = expanded.indexOf(id);
            if (pos !== -1) {
                expanded.splice(pos, 1);
            } else {
                expanded.push(id);
                expanded.sort();
            }
        }

        window.localStorage.setItem('eventlist.addid.expanded', JSON.stringify(expanded));

        this.setState({ expanded });
    }

    updateStateValue(i: number, update: Partial<StateValueSettings>): void {
        const states: StateValueSettings[] = JSON.parse(JSON.stringify(this.state.settings.states || []));
        Object.assign(states[i], update);
        this.setSettings('states', states);
    }

    renderState(i: number): JSX.Element | null {
        const state = this.state.settings.states?.[i];
        if (!state) {
            return null;
        }
        const isBoolean = state.val === 'true' || state.val === 'false';
        let text = state.defText
            ? state.val === 'true'
                ? this.props.native.defaultBooleanTextTrue
                : this.props.native.defaultBooleanTextFalse
            : state.text;

        let color = state.defColor
            ? state.val === 'true'
                ? this.props.native.defaultBooleanColorTrue
                : this.props.native.defaultBooleanColorFalse
            : state.color;
        color = !state.disabled && color ? ColorPicker.getColor(color) : '';

        let hasDefaultValue = isBoolean;
        if (!hasDefaultValue && this.props.native.defaultStringTexts) {
            const def = this.props.native.defaultStringTexts.find(
                item => item.value === state.val || item.value === state.original,
            );
            hasDefaultValue = !!def;
            if (def) {
                color = state.defColor ? def.color : color;
                color = !state.disabled && color ? ColorPicker.getColor(color) : '';
                text = state.defText ? def.text : text;
            }
        }

        return (
            <Accordion
                key={state.val}
                expanded={this.state.expanded.includes(`state_${state.val}`) && !state.disabled}
                onChange={() => this.onToggle(`state_${state.val}`)}
            >
                <AccordionSummary expandIcon={!state.disabled ? <ExpandMoreIcon /> : <EmptyIcon />}>
                    <Typography>
                        {I18n.t('State')}{' '}
                        <span style={{ color: color || undefined, fontWeight: 'bold' }}>
                            {state.original === 'true' || state.original === 'false'
                                ? `${state.original.toUpperCase()}${text ? ` - ${text}` : ''}`
                                : `${state.original}(${state.val})${text ? ` - ${text}` : ''}`}
                        </span>
                    </Typography>
                    <div style={styles.flex} />
                    <FormControlLabel
                        disabled={this.props.reading}
                        control={
                            <Checkbox
                                checked={!!state.disabled}
                                onChange={e => this.updateStateValue(i, { disabled: e.target.checked })}
                            />
                        }
                        label={I18n.t('Disable logging')}
                    />
                </AccordionSummary>
                {!state.disabled && (
                    <AccordionDetails>
                        <Paper style={styles.paper}>
                            {hasDefaultValue ? (
                                <FormControlLabel
                                    disabled={this.props.reading}
                                    control={
                                        <Checkbox
                                            checked={!!state.defText}
                                            onChange={e => this.updateStateValue(i, { defText: e.target.checked })}
                                        />
                                    }
                                    label={I18n.t('Use default text')}
                                />
                            ) : null}
                            {!hasDefaultValue || !state.defText ? (
                                <TextField
                                    variant="standard"
                                    disabled={this.props.reading}
                                    margin="dense"
                                    label={I18n.t('Text')}
                                    value={state.text}
                                    onChange={e => this.updateStateValue(i, { text: e.target.value })}
                                    type="text"
                                    style={{ ...styles.textField, ...styles.textDense }}
                                />
                            ) : null}
                            <br />
                            {hasDefaultValue ? (
                                <FormControlLabel
                                    disabled={this.props.reading}
                                    control={
                                        <Checkbox
                                            checked={!!state.defColor}
                                            onChange={e => this.updateStateValue(i, { defColor: e.target.checked })}
                                        />
                                    }
                                    label={I18n.t('Use default color', state.val.toUpperCase())}
                                />
                            ) : null}
                            {!hasDefaultValue || !state.defColor ? (
                                <ColorPicker
                                    disabled={this.props.reading}
                                    value={state.color}
                                    style={{ width: 250, display: 'inline-block' }}
                                    label={I18n.t('Color')}
                                    onChange={color => this.updateStateValue(i, { color })}
                                />
                            ) : null}
                            <br />
                            {isBoolean ? (
                                <FormControlLabel
                                    disabled={this.props.reading}
                                    control={
                                        <Checkbox
                                            checked={!!state.defIcon}
                                            onChange={e => this.updateStateValue(i, { defIcon: e.target.checked })}
                                        />
                                    }
                                    label={I18n.t('Use default icon', state.val.toUpperCase())}
                                />
                            ) : null}
                            {!isBoolean || !state.defIcon ? (
                                <IconPicker
                                    disabled={this.props.reading}
                                    key={this.props.id + this.state.settings.type + state.original}
                                    label={I18n.t('Icon')}
                                    value={state.icon}
                                    onChange={icon => this.updateStateValue(i, { icon })}
                                />
                            ) : null}
                        </Paper>
                    </AccordionDetails>
                )}
            </Accordion>
        );
    }

    setSettings<K extends keyof EditStateSettings>(attr: K, value: EditStateSettings[K]): void {
        const settings: EditStateSettings = JSON.parse(JSON.stringify(this.state.settings));
        settings[attr] = value;
        this.setState({ settings }, () => this.props.onChange(this.props.id, settings));
    }

    renderStateSettings(narrowWidth: boolean): JSX.Element {
        const color = ColorPicker.getColor(this.state.settings.color);
        const text = this.state.settings.eventDefault
            ? this.state.settings.type === 'boolean'
                ? this.props.native.defaultBooleanText
                : this.props.native.defaultNonBooleanText
            : this.state.settings.event || I18n.t('Use the specific state texts');

        return (
            <Accordion
                expanded={this.state.expanded.includes('state_settings')}
                onChange={() => this.onToggle('state_settings')}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    style={styles.width100minus32}
                >
                    <Typography>
                        {I18n.t('Event settings')}
                        {!narrowWidth ? (
                            <span style={{ color: color || undefined, fontStyle: 'italic' }}>{` - ${text}`}</span>
                        ) : null}
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Paper style={styles.paper}>
                        <FormControlLabel
                            disabled={this.props.reading}
                            control={
                                <Checkbox
                                    checked={!!this.state.settings.eventDefault}
                                    onChange={e => this.setSettings('eventDefault', e.target.checked)}
                                />
                            }
                            label={
                                <span>
                                    <span>{I18n.t('Default text')}</span>
                                </span>
                            }
                        />
                        {narrowWidth ? <br /> : null}
                        {!this.state.settings.eventDefault ? (
                            <TextField
                                variant="standard"
                                disabled={this.props.reading}
                                margin="dense"
                                label={I18n.t('Event text')}
                                value={this.state.settings.event}
                                onChange={e => this.setSettings('event', e.target.value)}
                                type="text"
                                style={styles.textField}
                                helperText={
                                    this.state.settings.type === 'number'
                                        ? I18n.t(
                                              'You can use patterns: %s - value, %u - unit, %n - name, %t - time, %d - duration, %g - value difference',
                                          )
                                        : I18n.t(
                                              'You can use patterns: %s - value, %u - unit, %n - name, %t - time, %d - duration',
                                          )
                                }
                                fullWidth
                            />
                        ) : null}
                        <br />
                        <ColorPicker
                            disabled={this.props.reading}
                            value={this.state.settings.color}
                            style={{ width: 250, display: 'inline-block' }}
                            label={I18n.t('Event color')}
                            onChange={color => this.setSettings('color', color)}
                        />
                        <br />
                        <IconPicker
                            disabled={this.props.reading}
                            key={this.props.id + this.state.settings.type}
                            label={I18n.t('Event icon')}
                            value={this.state.settings.icon}
                            onChange={icon => this.setSettings('icon', icon)}
                        />
                    </Paper>
                </AccordionDetails>
            </Accordion>
        );
    }

    renderMessengers(narrowWidth: boolean): JSX.Element {
        const count =
            (this.state.settings.telegram ? this.state.settings.telegram.length : 0) +
            (this.state.settings.whatsAppCMB ? this.state.settings.whatsAppCMB.length : 0) +
            (this.state.settings.pushover ? this.state.settings.pushover.length : 0);

        const messengers = [
            this.state.settings.telegram?.length
                ? [
                      <img
                          src={Telegram}
                          key="icon"
                          alt="telegram"
                          style={styles.messengersIcon}
                      />,
                      <span key="text">{`(${this.state.settings.telegram.join(', ')})`}</span>,
                  ]
                : null,
            this.state.settings.whatsAppCMB?.length
                ? [
                      <WhatsappIcon
                          key="icon"
                          style={{ ...styles.messengersIcon, ...styles.whatsAppIcon }}
                      />,
                      <span key="text">{`(${this.state.settings.whatsAppCMB.join(', ')})`}</span>,
                  ]
                : null,
            this.state.settings.pushover?.length
                ? [
                      <img
                          src={Pushover}
                          key="icon"
                          alt="pushover"
                          style={styles.messengersIcon}
                      />,
                      <span key="text">{`(${this.state.settings.pushover.join(', ')})`}</span>,
                  ]
                : null,
        ];

        return (
            <Accordion
                expanded={this.state.expanded.includes('state_messengers')}
                onChange={() => this.onToggle('state_messengers')}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                        {I18n.t('Messengers') + (count ? ' - ' : '')}
                        {messengers}
                    </Typography>
                </AccordionSummary>
                <AccordionDetails style={{ display: 'block' }}>
                    <FormControlLabel
                        disabled={this.props.reading}
                        control={
                            <Checkbox
                                disabled={!!this.state.settings.alarmsOnly}
                                checked={!!(this.state.settings.messagesInAlarmsOnly || this.state.settings.alarmsOnly)}
                                onChange={e => this.setSettings('messagesInAlarmsOnly', e.target.checked)}
                            />
                        }
                        label={I18n.t('Only in alarm state')}
                    />
                    {narrowWidth && <br />}
                    <FormControlLabel
                        disabled={this.props.reading}
                        control={
                            <Checkbox
                                checked={!!this.state.settings.defaultMessengers}
                                onChange={e => this.setSettings('defaultMessengers', e.target.checked)}
                            />
                        }
                        label={I18n.t('Default messengers')}
                    />
                    <br />
                    {this.state.settings.defaultMessengers ? null : (
                        <MessengerSelect
                            label={I18n.t('Telegram')}
                            adapterName="telegram"
                            style={styles.inputMessengers}
                            onChange={value => this.setSettings('telegram', value)}
                            selected={this.state.settings.telegram}
                            socket={this.props.socket}
                        />
                    )}
                    {narrowWidth && !this.state.settings.defaultMessengers && <br />}
                    {this.state.settings.defaultMessengers ? null : (
                        <MessengerSelect
                            label={I18n.t('WhatsApp-CMB')}
                            adapterName="whatsapp-cmb"
                            style={styles.inputMessengers}
                            onChange={value => this.setSettings('whatsAppCMB', value)}
                            selected={this.state.settings.whatsAppCMB}
                            socket={this.props.socket}
                        />
                    )}
                    {narrowWidth && !this.state.settings.defaultMessengers && <br />}
                    {this.state.settings.defaultMessengers ? null : (
                        <MessengerSelect
                            label={I18n.t('Pushover')}
                            adapterName="pushover"
                            style={styles.inputMessengers}
                            onChange={value => this.setSettings('pushover', value)}
                            selected={this.state.settings.pushover}
                            socket={this.props.socket}
                        />
                    )}
                </AccordionDetails>
            </Accordion>
        );
    }

    render(): JSX.Element {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm' || this.props.width === 'md';
        const val = this.state.state?.val ? ` - ${this.state.state.val.toString()}` : '';

        const exampleColor = this.getExampleColor() || undefined;

        const states = this.state.settings.states;
        const sortedStates = states ? [...states].sort((a, b) => (a.val > b.val ? 1 : a.val < b.val ? -1 : 0)) : null;

        return (
            <>
                {this.state.settings.type ? (
                    <Paper
                        style={styles.paper}
                        sx={sxExamplePaper}
                    >
                        <span style={styles.exampleTitle}>{I18n.t('Example event:')}</span>
                        <span style={{ ...styles.exampleText, color: exampleColor }}>
                            {this.props.native.icons ? (
                                <Image
                                    src={this.getExampleIcon()}
                                    sx={{ maxWidth: 32, maxHeight: 32, marginRight: '8px' }}
                                    color={exampleColor}
                                    imagePrefix={this.imagePrefix}
                                />
                            ) : null}
                            {this.buildExample()}
                        </span>
                        {this.state.settings.type === 'boolean' ? (
                            <>
                                <br />
                                <FormControlLabel
                                    disabled={this.props.reading}
                                    control={
                                        <Switch
                                            checked={!!this.state.simulateState}
                                            onChange={e => this.setState({ simulateState: e.target.checked })}
                                        />
                                    }
                                    label={I18n.t('Toggle state to simulate')}
                                />
                            </>
                        ) : null}
                        {this.state.settings.type === 'number' && states ? (
                            <>
                                <br />
                                <FormControl
                                    variant="standard"
                                    style={styles.formControl}
                                    disabled={this.props.reading}
                                >
                                    <InputLabel>{I18n.t('Simulate value')}</InputLabel>
                                    <Select
                                        variant="standard"
                                        value={
                                            this.state.simulateState === null
                                                ? '_current_'
                                                : this.state.simulateState.toString()
                                        }
                                        onChange={(e: SelectChangeEvent<string>) =>
                                            this.setState({
                                                simulateState: e.target.value === '_current_' ? null : e.target.value,
                                            })
                                        }
                                    >
                                        <MenuItem value="_current_">{I18n.t('current') + val}</MenuItem>
                                        {states.map(item => (
                                            <MenuItem
                                                key={item.val}
                                                value={item.val}
                                            >
                                                {item.original}({item.val})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </>
                        ) : null}
                    </Paper>
                ) : null}

                {this.state.settings.type ? (
                    <div style={styles.width100}>
                        <FormControlLabel
                            disabled={this.props.reading}
                            control={
                                <Checkbox
                                    checked={!!this.state.settings.changesOnly}
                                    onChange={e => this.setSettings('changesOnly', e.target.checked)}
                                />
                            }
                            label={I18n.t('Only changes')}
                        />
                        {narrowWidth && <br />}
                        <FormControlLabel
                            disabled={this.props.reading}
                            control={
                                <Checkbox
                                    checked={!!this.state.settings.alarmsOnly}
                                    onChange={e => this.setSettings('alarmsOnly', e.target.checked)}
                                />
                            }
                            label={I18n.t('Only in alarm state')}
                        />
                        <IconButton
                            disabled={this.state.expanded.length === (states ? states.length : 0) + 2}
                            style={styles.iconOpenAll}
                            onClick={() => this.onToggle(true)}
                        >
                            <ExpandMoreIcon />
                        </IconButton>
                        <IconButton
                            disabled={!this.state.expanded.length}
                            style={styles.iconCloseAll}
                            onClick={() => this.onToggle(false)}
                        >
                            <ExpandLessIcon />
                        </IconButton>
                    </div>
                ) : null}
                {this.renderStateSettings(narrowWidth)}
                {states && sortedStates ? sortedStates.map(item => this.renderState(states.indexOf(item))) : null}
                {this.renderMessengers(narrowWidth)}
            </>
        );
    }
}

export default withWidth()(EditState) as unknown as ComponentType<Omit<EditStateProps, 'width'>>;
