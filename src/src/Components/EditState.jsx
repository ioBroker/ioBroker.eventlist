import React, { Component } from 'react';
import PropTypes from 'prop-types';
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
import 'moment/locale/pt';
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
} from '@mui/material';

import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { FaMinus as EmptyIcon, FaWhatsapp as WhatsappIcon } from 'react-icons/fa';
import Telegram from '../assets/telegram.svg';
import Pushover from '../assets/pushover.svg';

import { I18n, IconPicker, Image, withWidth, ColorPicker } from '@iobroker/adapter-react-v5';

import MessengerSelect from './MessengerSelect';

const styles = {
    textField: {
        width: 250,
        marginRight: 8,
    },
    examplePaper: theme => ({
        marginBottom: 2,
        background: theme.palette.mode === 'dark' ? '#5f5f5f' : '#d8d8d8',
    }),
    exampleTitle: {
        fontWeight: 'bold',
    },
    exampleText: {
        marginLeft: 8,
        fontStyle: 'italic',
        fontSize: 20,
    },
    exampleIcon: {
        maxWidth: 32,
        maxHeight: 32,
        marginRight: 8,
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

const DEFAULT_TEMPLATE = 'default';
const DISABLED_TEXT = '-------------';

export class EditState extends Component {
    constructor(props) {
        super(props);

        let expanded = window.localStorage.getItem('eventlist.addid.expanded') || '[]';
        try {
            expanded = JSON.parse(expanded);
        } catch (e) {
            expanded = [];
        }

        this.state = {
            id: this.props.id || '',
            settings: JSON.parse(JSON.stringify(this.props.settings)),
            expanded,
            simulateState: null,
        };

        this.imagePrefix = this.props.imagePrefix;
        this.language = this.props.native.language || I18n.getLanguage();
        moment.locale(this.language === 'en' ? 'en-gb' : this.language);

        this.textSwitchedOn = this.translate('switched on', this.language);
        this.textSwitchedOff = this.translate('switched off', this.language);
        this.textDeviceChangedStatus = this.translate('Device %n changed status:', this.language);

        this.namespace = `${this.props.adapterName}.${this.props.instance}`;

        this.props.socket
            .getSystemConfig()
            .then(systemConfig => (this.isFloatComma = systemConfig.common.isFloatComma));
    }

    componentDidMount() {
        this.props.socket.subscribeState(this.props.id, this.onStateChanged);
    }

    componentWillUnmount() {
        this.props.socket.unsubscribeState(this.props.id, this.onStateChanged);
    }

    static addBooleanStates(newState) {
        const states = JSON.parse(JSON.stringify(newState.states || []));
        let changed;
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

        let newVal = trueState.text === DEFAULT_TEMPLATE;
        if (newVal !== trueState.defText) {
            changed = true;
            trueState.defText = newVal;
        }
        newVal = trueState.text === DEFAULT_TEMPLATE ? '' : trueState.text;
        if (newVal !== trueState.text) {
            changed = true;
            trueState.text = newVal;
        }

        newVal = trueState.color === DEFAULT_TEMPLATE;
        if (newVal !== trueState.defColor) {
            changed = true;
            trueState.defColor = newVal;
        }
        newVal = trueState.color === DEFAULT_TEMPLATE ? '' : trueState.color;
        if (newVal !== trueState.color) {
            changed = true;
            trueState.color = newVal;
        }

        newVal = trueState.icon === DEFAULT_TEMPLATE;
        if (newVal !== trueState.defIcon) {
            changed = true;
            trueState.defIcon = newVal;
        }
        newVal = trueState.icon === DEFAULT_TEMPLATE ? '' : trueState.icon;
        if (newVal !== trueState.icon) {
            changed = true;
            trueState.icon = newVal;
        }

        newVal = falseState.text === DEFAULT_TEMPLATE;
        if (newVal !== falseState.defText) {
            changed = true;
            falseState.defText = newVal;
        }
        newVal = falseState.text === DEFAULT_TEMPLATE ? '' : falseState.text;
        if (newVal !== falseState.text) {
            changed = true;
            falseState.text = newVal;
        }

        newVal = falseState.color === DEFAULT_TEMPLATE;
        if (newVal !== falseState.defColor) {
            changed = true;
            falseState.defColor = newVal;
        }
        newVal = falseState.color === DEFAULT_TEMPLATE ? '' : falseState.color;
        if (newVal !== falseState.color) {
            changed = true;
            falseState.color = newVal;
        }

        newVal = falseState.icon === DEFAULT_TEMPLATE;
        if (newVal !== falseState.defIcon) {
            changed = true;
            falseState.defIcon = newVal;
        }
        newVal = falseState.icon === DEFAULT_TEMPLATE ? '' : falseState.icon;
        if (newVal !== falseState.icon) {
            changed = true;
            falseState.icon = newVal;
        }

        if (changed) {
            newState.states = states;
            return true;
        } else {
            return false;
        }
    }

    static parseStates(states) {
        // convert ['zero', 'one', two'] => {'0': 'zero', '1': 'one', '2': 'two']
        if (states instanceof Array) {
            const nState = {};
            states.forEach((val, i) => (nState[i] = val));
            return nState;
        } else if (typeof states !== 'object') {
            return null;
        } else {
            return states;
        }
    }

    static addNumericStates(newState, objStates, defaultStringTexts) {
        const states = JSON.parse(JSON.stringify(newState.states || []));
        let changed;
        objStates = EditState.parseStates(objStates);
        if (objStates) {
            // {'value': 'valueName', 'value2': 'valueName2', 0: 'OFF', 1: 'ON'}
            Object.keys(objStates).forEach(attr => {
                let _st = states.find(item => item.val === attr);
                if (!_st) {
                    _st = { val: attr, text: objStates[attr], color: '', icon: '', disabled: false };
                    // check default states
                    const def = defaultStringTexts?.find(item => item.value === attr);
                    if (def) {
                        _st.text = def.text ? DEFAULT_TEMPLATE : objStates[attr];
                        _st.color = def.color ? DEFAULT_TEMPLATE : '';
                        _st.icon = def.icon ? DEFAULT_TEMPLATE : '';
                    }

                    states.push(_st);
                    changed = true;
                }
            });

            states.forEach(item => {
                // text
                let newVal = item.text === DEFAULT_TEMPLATE;
                if (newVal !== item.defText) {
                    changed = true;
                    item.defText = newVal;
                }
                newVal = item.text === DEFAULT_TEMPLATE ? '' : item.text;
                if (newVal !== item.text) {
                    changed = true;
                    item.text = newVal;
                }

                // Color
                newVal = item.color === DEFAULT_TEMPLATE;
                if (newVal !== item.defColor) {
                    changed = true;
                    item.defColor = newVal;
                }
                newVal = item.color === DEFAULT_TEMPLATE ? '' : item.color;
                if (newVal !== item.color) {
                    changed = true;
                    item.color = newVal;
                }

                // icon
                newVal = item.icon === DEFAULT_TEMPLATE;
                if (newVal !== item.defIcon) {
                    changed = true;
                    item.defIcon = newVal;
                }
                newVal = item.icon === DEFAULT_TEMPLATE ? '' : item.icon;
                if (newVal !== item.icon) {
                    changed = true;
                    item.icon = newVal;
                }

                if (item.original !== objStates[item.val]) {
                    item.original = objStates[item.val];
                    changed = true;
                }
            });

            if (changed) {
                newState.states = states;
                return true;
            } else {
                return false;
            }
        } else if (newState.states) {
            newState.states = null;
            return true;
        } else {
            return false;
        }
    }

    onStateChanged = (id, state) => this.setState({ state: state || null });

    static extractIconAndColor(socket, obj) {
        if (obj?.common?.icon) {
            return Promise.resolve({ icon: obj.common.icon, color: obj.common.color });
        }
        const parts = obj._id.split('.');
        parts.pop();

        return socket.getObject(parts.join('.')).then(obj => {
            if (obj?.type === 'channel') {
                if (obj.common?.icon) {
                    return { icon: obj.common.icon, color: obj.common.color };
                }
                const parts = obj._id.split('.');
                parts.pop();
                return socket.getObject(parts.join('.')).then(obj => {
                    if (obj && (obj.type === 'channel' || obj.type === 'device')) {
                        if (obj.common?.icon) {
                            return { icon: obj.common.icon, color: obj.common.color };
                        }
                        return null;
                    }
                    return null;
                });
            }
            if (obj?.common && obj.type === 'device') {
                return { icon: obj.common.icon, color: obj.common.color };
            }
            return null;
        });
    }

    static readSettingsFromServer(socket, lang, native, namespace, id) {
        return socket.getObject(id).then(obj => {
            const settings = {
                type: obj?.common?.type || '',
                name: EditState.getName(obj, lang),
                unit: obj?.common?.unit || '',
                whatsAppCMB: [],
                pushover: [],
                telegram: [],
                event: '',
                icon: '',
                color: '',
                alarmsOnly: false,
                messagesInAlarmsOnly: false,
            };

            let exists;

            if (obj?.common?.custom?.[namespace]) {
                const newSettings = obj.common.custom[namespace];
                exists = true;

                settings.event = newSettings.event === DEFAULT_TEMPLATE ? '' : newSettings.event;
                settings.eventDefault = newSettings.event === DEFAULT_TEMPLATE;
                settings.icon = newSettings.icon;
                settings.color = newSettings.color;
                settings.states = newSettings.states;
                settings.alarmsOnly = newSettings.alarmsOnly;
                settings.messagesInAlarmsOnly = newSettings.messagesInAlarmsOnly;
                settings.whatsAppCMB = newSettings.whatsAppCMB || [];
                settings.pushover = newSettings.pushover || [];
                settings.telegram = newSettings.telegram || [];
                settings.changesOnly = newSettings.changesOnly;

                settings.defaultMessengers =
                    newSettings.defaultMessengers === undefined ? true : newSettings.defaultMessengers;

                if (settings.type === 'boolean') {
                    EditState.addBooleanStates(settings);
                    settings.simulateState = false;
                } else if (settings.type === 'number' && obj?.common?.states && typeof obj.common.states === 'object') {
                    EditState.addNumericStates(settings, obj.common.states, native.defaultStringTexts);
                    settings.simulateState = null;
                } else {
                    settings.states = null;
                    settings.simulateState = null;
                }
            } else {
                settings.defaultMessengers = true;
                settings.whatsAppCMB = native.defaultWhatsAppCMB || [];
                settings.pushover = native.defaultPushover || [];
                settings.telegram = native.defaultTelegram || [];

                exists = false;
                if (settings.type === 'boolean') {
                    EditState.addBooleanStates(settings);
                    settings.simulateState = false;
                } else if (settings.type === 'number' && obj?.common?.states && typeof obj.common.states === 'object') {
                    EditState.addNumericStates(settings, obj.common.states, native.defaultStringTexts);
                    settings.simulateState = null;
                } else {
                    settings.states = null;
                    settings.simulateState = null;
                }
            }

            return EditState.extractIconAndColor(socket, obj).then(result => {
                if (result?.icon) {
                    // we must get from /icons/113_hmip-psm_thumb.png => /adapter/hm-rpc/icons/113_hmip-psm_thumb.png
                    // or                                                /hm-rpc.admin/icons/113_hmip-psm_thumb.png
                    settings.ownIcon = `/adapter/${obj._id.split('.')[0]}${result.icon}`;
                }
                if (result?.color) {
                    settings.ownColor = result.color;
                }
                return { settings, exists };
            });
        });
    }

    static getName(obj, lang) {
        let name = obj.common.name;
        if (typeof name === 'object') {
            name = name[lang] || name.en || '';
        }
        return name || obj._id;
    }

    translate(word, lang) {
        lang = lang || I18n.lang;
        if (I18n.translations[lang]) {
            const w = I18n.translations[lang][word] || I18n.translations.en[word];
            if (w) {
                word = w;
            }
        }
        return word;
    }

    getExampleColor() {
        let color = this.state.ownColor || '';
        if (this.state.settings.states) {
            let stateVal = !!(this.state.state && this.state.state.val);
            if (this.state.settings.type === 'boolean' && this.state.simulateState) {
                stateVal = !stateVal;
            } else if (this.state.settings.type !== 'boolean' && this.state.simulateState !== null) {
                stateVal = this.state.simulateState;
            }
            stateVal = stateVal === undefined || stateVal === null ? '' : stateVal.toString();
            const item = this.state.settings.states.find(item => item.val === stateVal);

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

    getExampleIcon() {
        const defIcon = this.state.settings.icon || this.state.ownIcon;
        let icon = defIcon || '';
        if (this.state.settings.states) {
            let stateVal = !!(this.state.state && this.state.state.val);
            if (this.state.settings.type === 'boolean' && this.state.simulateState) {
                stateVal = !stateVal;
            } else if (this.state.settings.type !== 'boolean' && this.state.simulateState !== null) {
                stateVal = this.state.simulateState;
            }
            stateVal = stateVal === undefined || stateVal === null ? '' : stateVal.toString();
            const item = this.state.settings.states.find(item => item.val === stateVal);

            if (item && item.defIcon) {
                const def =
                    this.state.settings.type !== 'boolean' &&
                    this.props.native.defaultStringTexts?.find(t => t.value === stateVal || t.value === item.original);
                if (def) {
                    icon = def.icon;
                } else {
                    icon =
                        (stateVal === 'true'
                            ? this.props.native.defaultBooleanIconTrue
                            : this.props.native.defaultBooleanIconFalse) ||
                        this.state.ownIcon ||
                        '';
                }
            } else if (item?.icon) {
                icon = item.icon;
            }
        }

        return icon;
    }

    getExampleText() {
        let text = '';
        let stateVal = this.state.state ? this.state.state.val : this.state.settings.type === 'boolean' ? false : null;
        if (this.state.settings.states) {
            if (this.state.settings.type === 'boolean' && this.state.simulateState) {
                stateVal = !stateVal;
            } else if (this.state.settings.type !== 'boolean' && this.state.simulateState !== null) {
                stateVal = this.state.simulateState;
            }
            stateVal = stateVal === undefined || stateVal === null ? '' : stateVal.toString();
            const item = this.state.settings.states.find(item => item.val === stateVal);

            if (item && item.disabled) {
                return DISABLED_TEXT;
            }

            if (stateVal === 'true' && item) {
                text = item.defText
                    ? this.props.native.defaultBooleanTextTrue || this.textSwitchedOn
                    : item.text || this.textSwitchedOn;
            } else if (stateVal === 'false' && item) {
                text = item.defText
                    ? this.props.native.defaultBooleanTextFalse || this.textSwitchedOff
                    : item.text || this.textSwitchedOff;
            } else {
                if (item?.defText) {
                    const def =
                        this.state.settings.type !== 'boolean' &&
                        this.props.native.defaultStringTexts?.find(
                            t => t.value === stateVal || t.value === item.original,
                        );
                    if (def) {
                        text = def.text;
                    } else {
                        text =
                            stateVal === 'true'
                                ? this.props.native.defaultBooleanTextTrue
                                : this.props.native.defaultBooleanTextFalse;
                    }
                } else if (item?.text) {
                    text = item.text;
                } else {
                    text = stateVal;
                }
            }
        } else {
            if (stateVal === null || stateVal === undefined) {
                text = 'null';
            } else if (typeof stateVal === 'number') {
                text = stateVal.toString();
                if (this.isFloatComma) {
                    text = text.replace('.', ',');
                }
            } else {
                text = stateVal.toString();
            }
        }

        return text || '';
    }

    buildExample() {
        let eventTemplate = '';
        let valWithUnit = '';
        let time = this.state.state?.ts
            ? moment(new Date(this.state.state.ts)).format(this.props.native.dateFormat)
            : this.props.native.dateFormat;

        let valText = this.getExampleText();

        if (valText === DISABLED_TEXT) {
            return I18n.t('DISABLED');
        }

        if (this.state.settings.type === 'boolean') {
            let stateVal = !!this.state.state?.val;
            if (this.state.simulateState) {
                stateVal = !stateVal;
            }

            if (!this.state.settings.eventDefault && !this.state.settings.event && stateVal && valText) {
                eventTemplate = valText;
            } else if (!this.state.settings.eventDefault && !this.state.settings.event && !stateVal && valText) {
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
            let text;
            text = this.duration2text(5000);
            eventTemplate = eventTemplate.replace(/%d/g, text);
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

    static getSettings(settings) {
        const curSettings = {
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
            const it = { val: item.val };

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

    duration2text(ms, withSpaces) {
        if (ms < 1000) {
            return `${ms}${withSpaces ? ' ' : ''}${I18n.t('ms')}`;
        } else if (ms < 90000) {
            return `${this.isFloatComma ? (Math.round(ms / 100) / 10).toString().replace('.', ',') : (Math.round(ms / 100) / 10).toString()}${withSpaces ? ' ' : ''}${I18n.t('seconds')}`;
        } else if (ms < 3600000) {
            return `${Math.floor(ms / 60000)}${withSpaces ? ' ' : ''}${I18n.t('minutes')} ${Math.round((ms % 60000) / 1000)}${withSpaces ? ' ' : ''}${I18n.t('seconds')}`;
        }
        let hours = Math.floor(ms / 3600000);
        const minutes = Math.floor(ms / 60000) % 60;
        const seconds = Math.round(Math.floor(ms % 60000) / 1000);
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            hours %= 24;
            if (days > 2) {
                return `${days}${withSpaces ? ' ' : ''}${I18n.t('days')} ${hours}${withSpaces ? ' ' : ''}${I18n.t('hours')}`;
            }
            return `${days}${withSpaces ? ' ' : ''}${I18n.t('days')} ${hours}${withSpaces ? ' ' : ''}${I18n.t('hours')} ${minutes}${withSpaces ? ' ' : ''}${I18n.t('minutes')}`;
        }
        if (hours > 2) {
            return `${hours}${withSpaces ? ' ' : ''}${I18n.t('hours')} ${minutes}${withSpaces ? ' ' : ''}${I18n.t('minutes')}`;
        }
        return `${hours}${withSpaces ? ' ' : ''}${I18n.t('hours')} ${minutes}${withSpaces ? ' ' : ''}${I18n.t('minutes')} ${seconds}${withSpaces ? ' ' : ''}${I18n.t('seconds')}`;
    }

    onToggle(id) {
        let expanded;
        if (id === false) {
            expanded = [];
        } else if (id === true) {
            expanded = ['state_settings', 'state_messengers'];
            this.state.settings.states &&
                this.state.settings.states.forEach(state => expanded.push(`state_${state.val}`));
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

    renderState(i) {
        const state = this.state.settings.states[i];
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
                    <Typography style={styles.heading}>
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
                                onChange={e => {
                                    const states = JSON.parse(JSON.stringify(this.state.settings.states));
                                    states[i].disabled = e.target.checked;
                                    this.setSettings('states', states);
                                }}
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
                                            checked={state.defText}
                                            onChange={e => {
                                                const states = JSON.parse(JSON.stringify(this.state.settings.states));
                                                states[i].defText = e.target.checked;
                                                this.setSettings('states', states);
                                            }}
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
                                    onChange={e => {
                                        const states = JSON.parse(JSON.stringify(this.state.settings.states));
                                        states[i].text = e.target.value;
                                        this.setSettings('states', states);
                                    }}
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
                                            checked={state.defColor}
                                            onChange={e => {
                                                const states = JSON.parse(JSON.stringify(this.state.settings.states));
                                                states[i].defColor = e.target.checked;
                                                this.setSettings('states', states);
                                            }}
                                        />
                                    }
                                    label={I18n.t('Use default color', state.val.toUpperCase())}
                                />
                            ) : null}
                            {!hasDefaultValue || !state.defColor ? (
                                <ColorPicker
                                    disabled={this.props.reading}
                                    openAbove
                                    value={state.color}
                                    style={{ width: 250, display: 'inline-block' }}
                                    label={I18n.t('Color')}
                                    onChange={color => {
                                        const states = JSON.parse(JSON.stringify(this.state.settings.states));
                                        states[i].color = color;
                                        this.setSettings('states', states);
                                    }}
                                />
                            ) : null}
                            <br />
                            {isBoolean ? (
                                <FormControlLabel
                                    disabled={this.props.reading}
                                    control={
                                        <Checkbox
                                            checked={state.defIcon}
                                            onChange={e => {
                                                const states = JSON.parse(JSON.stringify(this.state.settings.states));
                                                states[i].defIcon = e.target.checked;
                                                this.setSettings('states', states);
                                            }}
                                        />
                                    }
                                    label={I18n.t('Use default icon', state.val.toUpperCase())}
                                />
                            ) : null}
                            {!isBoolean || !state.defIcon ? (
                                <IconPicker
                                    disabled={this.props.reading}
                                    imagePrefix={this.imagePrefix}
                                    key={this.props.id + this.state.settings.type + state.original}
                                    color={color}
                                    label={I18n.t('Icon')}
                                    socket={this.props.socket}
                                    value={state.icon}
                                    onChange={icon => {
                                        const states = JSON.parse(JSON.stringify(this.state.settings.states));
                                        states[i].icon = icon;
                                        this.setSettings('states', states);
                                    }}
                                />
                            ) : null}
                        </Paper>
                    </AccordionDetails>
                )}
            </Accordion>
        );
    }

    setSettings(attr, value) {
        const settings = JSON.parse(JSON.stringify(this.state.settings));
        settings[attr] = value;
        this.setState({ settings }, () => this.props.onChange(this.props.id, EditState.getSettings(settings)));
    }

    renderStateSettings(narrowWidth) {
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
                    <Typography style={styles.heading}>
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
                                    checked={this.state.settings.eventDefault}
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
                            openAbove
                            onChange={color => this.setSettings('color', color)}
                        />
                        <br />
                        <IconPicker
                            disabled={this.props.reading}
                            imagePrefix={this.imagePrefix}
                            key={this.props.id + this.state.settings.type}
                            color={this.state.settings.color}
                            socket={this.props.socket}
                            label={I18n.t('Event icon')}
                            value={this.state.settings.icon}
                            onChange={icon => this.setSettings('icon', icon)}
                        />
                    </Paper>
                </AccordionDetails>
            </Accordion>
        );
    }

    renderMessengers(narrowWidth) {
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
                    <Typography style={styles.heading}>
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
                                checked={this.state.settings.defaultMessengers}
                                onChange={e => this.setSettings('defaultMessengers', e.target.checked)}
                            />
                        }
                        label={I18n.t('Default messengers')}
                    />
                    <br />
                    {this.state.settings.defaultMessengers ? null : (
                        <MessengerSelect
                            label={I18n.t('Telegram')}
                            adapterName={'telegram'}
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
                            adapterName={'whatsapp-cmb'}
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
                            adapterName={'pushover'}
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

    render() {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm' || this.props.width === 'md';
        let val = '';
        if (this.state.state?.val) {
            if (this.state.state.val === null || this.state.state.val === undefined) {
                val = ' - --';
            } else {
                val = ` - ${this.state.state.val.toString()}`;
            }
        }

        const exampleColor = this.getExampleColor() || undefined;

        return (
            <React.Fragment>
                {this.state.settings.type ? (
                    <Paper
                        style={styles.paper}
                        sx={styles.examplePaper}
                    >
                        <span style={styles.exampleTitle}>{I18n.t('Example event:')}</span>
                        <span style={{ ...styles.exampleText, color: exampleColor }}>
                            {this.props.native.icons ? (
                                <Image
                                    src={this.getExampleIcon()}
                                    style={styles.exampleIcon}
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
                        {this.state.settings.type === 'number' && this.state.settings.states ? (
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
                                            this.state.simulateState === null ? '_current_' : this.state.simulateState
                                        }
                                        onChange={e =>
                                            this.setState({
                                                simulateState: e.target.value === '_current_' ? null : e.target.value,
                                            })
                                        }
                                    >
                                        <MenuItem value={'_current_'}>{I18n.t('current') + val}</MenuItem>
                                        {this.state.settings.states.map(item => (
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
                                    checked={this.state.settings.changesOnly}
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
                            disabled={
                                this.state.expanded.length ===
                                (this.state.settings.states ? this.state.settings.states.length : 0) + 2
                            }
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
                            {' '}
                            <ExpandLessIcon />
                        </IconButton>
                    </div>
                ) : null}
                {this.renderStateSettings()}
                {this.state.settings.states
                    ? this.state.settings.states
                          .sort((a, b) => (a.val > b.val ? 1 : a.val < b.val ? -1 : 0))
                          .map((item, i) => this.renderState(i, narrowWidth))
                    : null}
                {this.renderMessengers(narrowWidth)}
            </React.Fragment>
        );
    }
}

EditState.propTypes = {
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    themeName: PropTypes.string,
    themeType: PropTypes.string,
    socket: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    id: PropTypes.string,
    reading: PropTypes.bool,
    settings: PropTypes.object,
    imagePrefix: PropTypes.string,
};

export default withWidth()(EditState);
