import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import moment from 'moment'
import clsx from 'clsx'
import withWidth from "@material-ui/core/withWidth";

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

import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Switch from '@material-ui/core/Switch';
import Paper from '@material-ui/core/Paper';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Typography from '@material-ui/core/Typography';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';

import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CancelIcon from '@material-ui/icons/Cancel';
import SaveIcon from '@material-ui/icons/Save';
import {FaEraser as RemoveIcon} from 'react-icons/fa';
import {FaMinus as EmptyIcon} from 'react-icons/fa';
import {FaWhatsapp as WhatsappIcon} from 'react-icons/fa';
import Telegram from '../assets/telegram.svg';
import Pushover from '../assets/pushover.svg';

import MessengerSelect from '../Components/MessengerSelect';
import I18n from '@iobroker/adapter-react/i18n';
import SelectIDDialog from '@iobroker/adapter-react/Dialogs/SelectID';
import ColorPicker from '../Components/ColorPicker';
import IconPicker from '../Components/IconPicker';
import ConfirmDialog from '@iobroker/adapter-react/Dialogs/Confirm';

const styles = theme => ({
    textField: {
        width: 250,
        marginRight: theme.spacing(1),
    },
    textFieldWithButton: {
        width: 'calc(100% - 70px)'
    },
    examplePaper: {
        marginBottom: theme.spacing(2),
        background: theme.palette.type === 'dark' ? '#5f5f5f' : '#d8d8d8'
    },
    exampleTitle: {
        fontWeight: 'bold',
    },
    exampleText: {
        marginLeft: theme.spacing(1),
        fontStyle: 'italic',
        fontSize: 20,
    },
    exampleIcon: {
        maxWidth: 32,
        maxHeight: 32,
        marginRight: theme.spacing(1)
    },
    textDense: {
        marginTop: 0,
        marginBottom: 0,
    },
    paper: {
        marginBottom: theme.spacing(1),
        padding: theme.spacing(1),
        width: '100%'
    },
    buttonIcon: {
        marginRight: theme.spacing(1)
    },
    formControl: {
        width: 200
    },
    inputMessengers: {
        minWidth: 200,
        marginRight: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },
    flex: {
        flexGrow: 1,
    },
    messengersIcon: {
        width: 24,
        height: 24,
    },
    whatsAppIcon: {
        color: '#45c655'
    }
});

const DEFAULT_TEMPLATE = 'default';
const DISABLED_TEXT = '-------------';

class AddIdDialog extends Component {
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
            type: '',
            unit: '',
            name: '',

            event: '',
            eventDefault: true,
            alarmsOnly: false,

            defaultMessengers: true,
            messagesInAlarmsOnly: false,
            whatsAppCMB: [],
            pushover: [],
            telegram: [],

            states: null,
            color: '',
            icon: '',

            changesOnly: true,
            showSelectId: false,
            unknownId: true,
            expanded,

            simulateState: '',
            exists: false,
            confirmExit: false,
            confirmRemove: false,
        };

        this.language = this.props.native.language || I18n.getLanguage();
        moment.locale(this.language === 'en' ? 'en-gb' : this.language);

        this.textSwitchedOn = this.translate('switched on', this.language);
        this.textSwitchedOff = this.translate('switched off', this.language);
        this.textDeviceChangedStatus = this.translate('Device %n changed status:', this.language);

        this.namespace = `${this.props.adapterName}.${this.props.instance}`;

        this.subscribed = '';
        this.originalSettings = {};

        this.props.socket.getSystemConfig()
            .then(systemConfig => {
                this.isFloatComma = systemConfig.common.isFloatComma;
                if (this.state.id) {
                    this.readSettings();
                } else {
                    this.setState({showSelectId: true});
                }
            });
    }

    addBooleanStates(newState) {
        const states = JSON.parse(JSON.stringify(newState.states || []));
        let changed;
        let trueState = states.find(item => item.val === 'true');
        if (!trueState) {
            trueState = {val: 'true',  text: DEFAULT_TEMPLATE, color: DEFAULT_TEMPLATE, icon: DEFAULT_TEMPLATE, original: 'true', disabled: false};
            states.push(trueState);
            changed = true;
        } else {
            trueState.original = 'true';
        }
        let falseState = states.find(item => item.val === 'false');
        if (!falseState) {
            falseState = {val: 'false', text: DEFAULT_TEMPLATE, color: DEFAULT_TEMPLATE, icon: DEFAULT_TEMPLATE, original: 'false', disabled: false};
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

    parseStates(states) {
        // convert ['zero', 'one', two'] => {'0': 'zero', '1': 'one', '2': 'two']
        if (states instanceof Array) {
            const nState = {};
            states.forEach((val, i) => nState[i] = val);
            return nState;
        } else if (typeof states !== 'object') {
            return null;
        } else {
            return states;
        }
    }

    addNumericStates(newState, objStates) {
        const states = JSON.parse(JSON.stringify(newState.states || []));
        let changed;
        objStates = this.parseStates(objStates);
        if (objStates) {
            // {'value': 'valueName', 'value2': 'valueName2', 0: 'OFF', 1: 'ON'}
            Object.keys(objStates).forEach(attr => {
                let _st = states.find(item => item.val === attr);
                if (!_st) {
                    _st = {val: attr,  text: objStates[attr], color: '', icon: '', disabled: false};
                    states.push(_st);
                    changed = true;
                }
            });

            states.forEach(item => {
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

    subscribe() {
        if (this.state.id !== this.subscribed) {
            this.subscribed && this.props.socket.unsubscribeState(this.subscribed, this.onStateChanged);
            if (this.state.type) {
                this.state.id && this.props.socket.subscribeState(this.state.id, this.onStateChanged);
                this.subscribed = this.state.id;
            } else {
                this.subscribed = '';
            }
        }
    }

    onStateChanged = (id, state) => {
        this.setState({state: state || null});
    };

    readSettings(id) {
        id = id || this.state.id;
        if (this.readTypeTimer) {
            clearTimeout(this.readTypeTimer);
        }
        this.readTypeTimer = setTimeout(() =>
            this.props.socket.getObject(id)
                .then(obj => {
                    const newState = {
                        type:        (obj && obj.common && obj.common.type) || '',
                        unknownId:   !obj || !obj.common || !obj.common.type,
                        name:        this.getName(obj),
                        unit:        (obj && obj.common && obj.common.unit) || '',
                        whatsAppCMB: [],
                        pushover:    [],
                        telegram:    [],
                        event:       '',
                        icon:        '',
                        color:       '',
                        alarmsOnly:  false,
                        messagesInAlarmsOnly: false,
                    };

                    if (obj && obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
                        const newSettings = obj.common.custom[this.namespace];
                        newState.exists = true;

                        newState.event        = newSettings.event === DEFAULT_TEMPLATE ? '' : newSettings.event;
                        newState.eventDefault = newSettings.event === DEFAULT_TEMPLATE;
                        newState.icon         = newSettings.icon;
                        newState.color        = newSettings.color;
                        newState.states       = newSettings.states;
                        newState.alarmsOnly   = newSettings.alarmsOnly;
                        newState.messagesInAlarmsOnly = newSettings.messagesInAlarmsOnly;
                        newState.whatsAppCMB  = newSettings.whatsAppCMB || [];
                        newState.pushover     = newSettings.pushover || [];
                        newState.telegram     = newSettings.telegram || [];
                        newState.defaultMessengers = newSettings.defaultMessengers === undefined ? true : newSettings.defaultMessengers;

                        if (newState.type === 'boolean') {
                            this.addBooleanStates(newState);
                            newState.simulateState = false;
                        } else if (newState.type === 'number' && obj && obj.common && obj.common.states && typeof obj.common.states === 'object') {
                            this.addNumericStates(newState, obj.common.states);
                            newState.simulateState = null;
                        } else {
                            newState.states = null;
                            newState.simulateState = null;
                        }
                    } else {
                        newState.defaultMessengers = true;
                        newState.whatsAppCMB = this.props.native.defaultWhatsAppCMB || [];
                        newState.pushover    = this.props.native.defaultPushover    || [];
                        newState.telegram    = this.props.native.defaultTelegram    || [];

                        newState.exists = false;
                        if (newState.type === 'boolean') {
                            this.addBooleanStates(newState);
                            newState.simulateState = false;
                        } else if (newState.type === 'number' && obj && obj.common && obj.common.states && typeof obj.common.states === 'object') {
                            this.addNumericStates(newState, obj.common.states);
                            newState.simulateState = null;
                        } else {
                            newState.states = null;
                            newState.simulateState = null;
                        }
                    }

                    this.setState(newState, () => this.originalSettings = this.getSettings());
                })
                .catch(e => this.setState({type: '', unknownId: true, name: '', unit: ''}))
                .then(() => {
                    this.readTypeTimer = null;
                    this.subscribe();
                })
        ,500);
    }

    getName(obj) {
        let name = obj.common.name;
        if (typeof name === 'object') {
            name = name[this.props.native.language] || name.en;
        }
        return name || obj._id;
    }

    renderSelectId() {
        if (!this.state.showSelectId) {
            return null;
        }

        return <SelectIDDialog
            statesOnly={true}
            showExpertButton={true}
            multiSelect={false}
            notEditable={true}
            dialogName={I18n.t('Define state ID for event list')}
            socket={this.props.socket}
            selected={this.state.id}
            themeName={this.props.themeName}
            themeType={this.props.themeType}
            onOk={id => this.setState({id}, () => this.readSettings(id))}
            onClose={() => this.setState({showSelectId: false})}
        />;
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
        let color = '';
        if (this.state.states) {
            let stateVal = !!(this.state.state && this.state.state.val);
            if (this.state.type === 'boolean' && this.state.simulateState) {
                stateVal = !stateVal;
            } else
            if (this.state.type !== 'boolean' && this.state.simulateState !== null) {
                stateVal = this.state.simulateState;
            }
            stateVal = stateVal === undefined || stateVal === null ? '' : stateVal.toString();
            const item = this.state.states.find(item => item.val === stateVal);

            if (item && item.defColor) {
                color = stateVal === 'true' ? ColorPicker.getColor(this.props.native.defaultBooleanColorTrue) : ColorPicker.getColor(this.props.native.defaultBooleanColorFalse);
            } else if (item && item.color && ColorPicker.getColor(item.color)) {
                color = ColorPicker.getColor(item.color);
            }
        }
        color = color || (this.state.color && ColorPicker.getColor(this.state.color)) || '';

        return color;
    }

    getExampleIcon() {
        const defIcon = this.state.icon;
        let icon = defIcon || '';
        if (this.state.states) {
            let stateVal = !!(this.state.state && this.state.state.val);
            if (this.state.type === 'boolean' && this.state.simulateState) {
                stateVal = !stateVal;
            } else
            if (this.state.type !== 'boolean' && this.state.simulateState !== null) {
                stateVal = this.state.simulateState;
            }
            stateVal = stateVal === undefined || stateVal === null ? '' : stateVal.toString();
            const item = this.state.states.find(item => item.val === stateVal);

            if (item.defIcon) {
                icon = stateVal === 'true' ? this.props.native.defaultBooleanIconTrue : this.props.native.defaultBooleanIconFalse;
            } else if (item && item.icon) {
                icon = item.icon;
            }
        }

        if (icon) {
            if (!icon.startsWith('data:')) {
                if (icon.includes('.')) {
                    icon = '/adapter/' + this.state.id.split('.').shift() + '/' + icon;
                } else {
                    icon = '';
                }
            }
        }
        return icon;
    }

    getExampleText() {
        let text = '';
        let stateVal = this.state.state ? this.state.state.val : (this.state.type === 'boolean' ? false : null);
        if (this.state.states) {
            if (this.state.type === 'boolean' && this.state.simulateState) {
                stateVal = !stateVal;
            } else
            if (this.state.type !== 'boolean' && this.state.simulateState !== null) {
                stateVal = this.state.simulateState;
            }
            stateVal = stateVal === undefined || stateVal === null ? '' : stateVal.toString();
            const item = this.state.states.find(item => item.val === stateVal);

            if (item && item.disabled) {
                return DISABLED_TEXT;
            }

            if (stateVal === 'true' && item) {
                text = item.defText ? this.props.native.defaultBooleanTextTrue || this.textSwitchedOn : item.text || this.textSwitchedOn;
            } else if (stateVal === 'false' && item) {
                text = item.defText ? this.props.native.defaultBooleanTextFalse || this.textSwitchedOff : item.text || this.textSwitchedOff;
            } else {
                if (item && item.defText) {
                    text = stateVal === 'true' ? this.props.native.defaultBooleanTextTrue : this.props.native.defaultBooleanTextFalse;
                } else if (item && item.text) {
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
        let time = this.state.state && this.state.state.ts ? moment(new Date(this.state.state.ts)).format(this.props.native.dateFormat) : this.props.native.dateFormat;

        let valText = this.getExampleText();

        if (valText === DISABLED_TEXT) {
            return I18n.t('DISABLED');
        }

        if (this.state.type === 'boolean') {
            let stateVal = !!(this.state.state && this.state.state.val);
            if (this.state.simulateState) {
                stateVal = !stateVal;
            }

            if (!this.state.eventDefault && !this.state.event && stateVal && valText) {
                eventTemplate = valText;
            } else if (!this.state.eventDefault && !this.state.event && !stateVal && valText) {
                eventTemplate = valText;
            } else {
                if (this.state.event === DEFAULT_TEMPLATE || this.state.eventDefault) {
                    eventTemplate = this.props.native.defaultBooleanText || this.textDeviceChangedStatus;
                } else {
                    eventTemplate = this.state.event;
                }
                eventTemplate = eventTemplate.replace(/%u/g, this.state.unit || '');
                eventTemplate = eventTemplate.replace(/%n/g, this.state.name || this.state.id);
                valWithUnit = valText || (stateVal ? this.textSwitchedOn : this.textSwitchedOff);
            }
        } else {
            eventTemplate = this.state.event === DEFAULT_TEMPLATE ? this.props.native.defaultNonBooleanText || this.textDeviceChangedStatus : this.state.event || this.textDeviceChangedStatus;

            valWithUnit = valText;
            if (valWithUnit !== '' && this.state.unit) {
                valWithUnit += this.state.unit;
            }
            if (this.state.states) {
                if (!this.state.eventDefault && !this.state.event) {
                    eventTemplate = valWithUnit;
                    valWithUnit = '';
                }
            }
            eventTemplate = eventTemplate.replace(/%u/g, this.state.unit || '');
            eventTemplate = eventTemplate.replace(/%n/g, this.state.name || this.state.id);
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

        eventTemplate = eventTemplate.replace(/%t/g, this.state.state ? moment(new Date(this.state.state.ts)).format(this.props.native.dateFormat) : this.props.native.dateFormat);

        return `${time} | ${eventTemplate} | ${valWithUnit}`;
    }

    getSettings() {
        const settings = {
            enabled: true,
            event: this.state.eventDefault ? DEFAULT_TEMPLATE : this.state.event,
            changesOnly: !!this.state.changesOnly,
            defaultMessengers: !!this.state.defaultMessengers
        };
        if (this.state.color && ColorPicker.getColor(this.state.color)) {
            settings.color = ColorPicker.getColor(this.state.color);
        }
        if (this.state.icon) {
            settings.icon = this.state.icon;
        }
        if (this.state.alarmsOnly) {
            settings.alarmsOnly = true;
        }
        if (this.state.messagesInAlarmsOnly) {
            settings.messagesInAlarmsOnly = true;
        }
        if (this.state.pushover && this.state.pushover.length && !this.state.defaultMessengers) {
            settings.pushover = this.state.pushover;
        }
        if (this.state.telegram && this.state.telegram.length && !this.state.defaultMessengers) {
            settings.telegram = this.state.telegram;
        }
        if (this.state.whatsAppCMB && this.state.whatsAppCMB.length && !this.state.defaultMessengers) {
            settings.whatsAppCMB = this.state.whatsAppCMB;
        }

        this.state.states && this.state.states.forEach(item => {
            settings.states = settings.states || [];
            const it = {val: item.val};

            if (item.disabled)  {
                it.disabled = true;
                return;
            }

            if (item.val === 'true' || item.val === 'false') {
                it.text  = item.defText  ? DEFAULT_TEMPLATE : item.text || '';
                if (item.defColor || (item.color && ColorPicker.getColor(item.color))) {
                    it.color = item.defColor ? DEFAULT_TEMPLATE : ColorPicker.getColor(item.color);
                }
                if (item.defIcon || item.icon) {
                    it.icon = item.defIcon  ? DEFAULT_TEMPLATE : item.icon;
                }
            } else {
                it.text  = item.text || '';
                if (item.color && ColorPicker.getColor(item.color))  {
                    it.color = ColorPicker.getColor(item.color);
                }
                if (item.icon)  {
                    it.icon = item.icon;
                }
            }

            settings.states.push(it);
        });

        return settings;
    }

    duration2text(ms, withSpaces) {
        if (ms < 1000) {
            return `${ms}${withSpaces ? ' ' : ''}${I18n.t('ms')}`;
        } else if (ms < 90000) {
            return `${this.isFloatComma ? (Math.round((ms / 100)) / 10).toString().replace('.', ',') : (Math.round((ms / 100)) / 10).toString()}${withSpaces ? ' ' : ''}${I18n.t('seconds')}`;
        } else if (ms < 3600000) {
            return `${Math.floor(ms / 60000)}${withSpaces ? ' ' : ''}${I18n.t('minutes')} ${Math.round((ms % 60000) / 1000)}${withSpaces ? ' ' : ''}${I18n.t('seconds')}`;
        } else {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor(ms / 60000) % 60;
            const seconds = Math.round(Math.floor(ms % 60000) / 1000);
            return `${hours}${withSpaces ? ' ' : ''}${I18n.t('hours')} ${minutes}${withSpaces ? ' ' : ''}${I18n.t('minutes')} ${seconds}${withSpaces ? ' ' : ''}${I18n.t('seconds')}`;
        }
    }

    writeSettings(cb) {
        this.props.socket.getObject(this.state.id)
            .then(obj => {
                if (obj && obj.common) {
                    obj.common.custom = obj.common.custom || {};
                    obj.common.custom[this.namespace] = this.getSettings();
                    this.props.socket.setObject(this.state.id, obj)
                        .then(() => cb && cb());
                } else {
                    cb && cb();
                }
            });
    }

    removeSettings(cb) {
        this.props.socket.getObject(this.state.id)
            .then(obj => {
                if (obj && obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
                    obj.common.custom[this.namespace] = null;
                    this.props.socket.setObject(this.state.id, obj)
                        .then(() => cb && cb());
                } else {
                    cb && cb();
                }
            });
    }

    onClose() {
        if (this.state.id && JSON.stringify(this.originalSettings) !== JSON.stringify(this.getSettings())) {
            this.setState({confirmExit: true});
        } else {
            this.props.onClose();
        }
    }

    onToggle(id) {
        const expanded = [...this.state.expanded];
        const pos = expanded.indexOf(id);
        if (pos !== -1)  {
            expanded.splice(pos, 1);
        } else {
            expanded.push(id);
            expanded.sort();
        }
        window.localStorage.setItem('eventlist.addid.expanded', JSON.stringify(expanded));
        this.setState({expanded});
    }

    renderConfirmExit() {
        if (!this.state.confirmExit) {
            return null;
        } else {
            return <ConfirmDialog
                title={ I18n.t('Changes not saved.') }
                text={ I18n.t('All changes will be lost. Exit?') }
                ok={ I18n.t('Yes') }
                cancel={ I18n.t('No') }
                onClose={isYes => {
                    this.setState({ confirmExit: false} );
                    isYes && this.props.onClose();
                }}
            />;
        }
    }

    renderConfirmRemove() {
        if (!this.state.confirmRemove) {
            return null;
        } else {
            return <ConfirmDialog
                title={ I18n.t('Settings will be erased.') }
                text={ I18n.t('The state will be removed from event list and all settings erased. Are you sure?') }
                ok={ I18n.t('Remove from list') }
                cancel={ I18n.t('Cancel') }
                onClose={isYes => {
                    this.setState({ confirmRemove: false} );
                    if (isYes) {
                        this.removeSettings();
                        this.props.onClose();
                    }
                }}
            />;
        }
    }

    renderState(i, narrowWidth) {
        const state = this.state.states[i];
        const isBoolean = state.val === 'true' || state.val === 'false';

        let color = state.defColor ? (state.val === 'true' ? this.props.native.defaultBooleanColorTrue : this.props.native.defaultBooleanColorFalse) : state.color;
        color = !state.disabled && color ? ColorPicker.getColor(color) : '';

        return <Accordion
            key={state.val}
            expanded={this.state.expanded.includes('state_' + state.val) && !state.disabled}
            onChange={() => this.onToggle('state_' + state.val)}
        >
            <AccordionSummary expandIcon={!state.disabled ? <ExpandMoreIcon /> : <EmptyIcon/>}>
                <Typography className={this.props.classes.heading}>{I18n.t('State')} <span style={{color: color || undefined, fontWeight: 'bold'}}>{
                    state.original === 'true' || state.original === 'false' ?
                        `${state.original.toUpperCase()}${state.text ? ' - ' + state.text : ''}`
                        :
                        `${state.original}(${state.val})${state.text ? ' - ' + state.text : ''}`
                }</span></Typography>
                <div className={this.props.classes.flex}/>
                <FormControlLabel
                    control={<Checkbox
                        checked={!!state.disabled}
                        onChange={e => {
                            const states = JSON.parse(JSON.stringify(this.state.states));
                            states[i].disabled = e.target.checked;
                            this.setState({states});
                        }} />
                    }
                    label={I18n.t('Disable logging')}
                />
            </AccordionSummary>
            {!state.disabled && <AccordionDetails>
                <Paper className={this.props.classes.paper}>
                    {isBoolean ? <FormControlLabel
                        control={<Checkbox
                            checked={state.defText}
                            onChange={e => {
                                const states = JSON.parse(JSON.stringify(this.state.states));
                                states[i].defText = e.target.checked;
                                this.setState({states});
                            }} />
                        }
                        label={I18n.t('Use default text')}
                    /> : null}
                    {!isBoolean || !state.defText ? <TextField
                        margin="dense"
                        label={I18n.t('Text')}
                        value={state.text}
                        classes={{root: this.props.classes.textDense}}
                        onChange={e => {
                            const states = JSON.parse(JSON.stringify(this.state.states));
                            states[i].text = e.target.value;
                            this.setState({states});
                        }}
                        type="text"
                        className={this.props.classes.textField}
                    /> : null}
                    {narrowWidth ? <br/> : null}
                    {isBoolean ? <FormControlLabel
                        control={<Checkbox
                            checked={state.defColor}
                            onChange={e => {
                                const states = JSON.parse(JSON.stringify(this.state.states));
                                states[i].defColor = e.target.checked;
                                this.setState({states});
                            }} />
                        }
                        label={I18n.t('Use default color', state.val.toUpperCase())}
                    /> : null}
                    {!isBoolean || !state.defColor ?
                        <ColorPicker
                            openAbove={true}
                            color={state.color}
                            style={{width: 250, display: 'inline-block'}}
                            name={I18n.t('Color')}
                            onChange={color => {
                                const states = JSON.parse(JSON.stringify(this.state.states));
                                states[i].color = color;
                                this.setState({states});
                            }}
                        /> : null}
                    {narrowWidth ? <br/> : null}
                    {isBoolean ? <FormControlLabel
                        control={<Checkbox
                            checked={state.defIcon}
                            onChange={e => {
                                const states = JSON.parse(JSON.stringify(this.state.states));
                                states[i].defIcon = e.target.checked;
                                this.setState({states});
                            }} />
                        }
                        label={I18n.t('Use default icon', state.val.toUpperCase())}
                    /> : null}
                    {!isBoolean || !state.defIcon ? <IconPicker
                        label={I18n.t('Icon')}
                        socket={this.props.socket}
                        value={state.icon}
                        onChange={e => {
                            const states = JSON.parse(JSON.stringify(this.state.states));
                            states[i].icon = e.target.value;
                            this.setState({states});
                        }}
                    /> : null}
                    {narrowWidth ? <br/> : null}
                </Paper>
            </AccordionDetails>}
        </Accordion>;
    }

    renderStateSettings(narrowWidth) {
        const color = ColorPicker.getColor(this.state.color);
        const text = this.state.eventDefault ? (this.state.type === 'boolean' ? this.props.native.defaultBooleanText : this.props.native.defaultNonBooleanText) : this.state.event || I18n.t('Use the specific state texts');

        return <Accordion
            expanded={this.state.expanded.includes('state_settings')}
            onChange={() => this.onToggle('state_settings')}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography className={this.props.classes.heading}>{I18n.t('Event settings')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Paper className={this.props.classes.paper}>
                    <FormControlLabel
                        control={<Checkbox
                            checked={this.state.eventDefault}
                            onChange={e => this.setState({eventDefault: e.target.checked})} />
                        }
                        label={<span><span>{I18n.t('Default text')}</span>(!narrowWidth ? <span style={{color: color || undefined, fontStyle: 'italic'}}>{' - ' + text}</span> : null</span>}
                    />
                    {narrowWidth ? <br/> : null}
                    {!this.state.eventDefault ? <TextField
                        margin="dense"
                        label={I18n.t('Event text')}
                        value={this.state.event}
                        onChange={e => this.setState({event: e.target.value})}
                        type="text"
                        className={this.props.classes.textField}
                        helperText={ this.state.type === 'number' ?
                            I18n.t('You can use patterns: %s - value, %u - unit, %n - name, %t - time, %d - duration, %g - value difference')
                            :
                            I18n.t('You can use patterns: %s - value, %u - unit, %n - name, %t - time, %d - duration')}
                        fullWidth
                    /> : null}
                    <br/>
                    <ColorPicker
                        color={this.state.color}
                        style={{width: 250, display: 'inline-block'}}
                        name={I18n.t('Event color')}
                        openAbove={true}
                        onChange={color => this.setState({color})}
                    />
                    <br/>
                    <IconPicker
                        socket={this.props.socket}
                        label={I18n.t('Event icon')}
                        value={this.state.icon}
                        onChange={e => this.setState({icon: e.target.value})}
                    />
                </Paper>
            </AccordionDetails>
        </Accordion>;
    }

    renderMessengers(narrowWidth) {
        const count = (this.state.telegram ? this.state.telegram.length : 0) +
            (this.state.whatsAppCMB ? this.state.whatsAppCMB.length : 0) +
            (this.state.pushover ? this.state.pushover.length : 0);
        const messengers = !this.state.expanded.includes('state_messengers') ? [
            this.state.telegram    && this.state.telegram.length    ? [<img src={Telegram} key="icon" alt="telegram" className={this.props.classes.messengersIcon}/>, <span key="text">{'(' + this.state.telegram.join(', ')    + ')'}</span>] : null,
            this.state.whatsAppCMB && this.state.whatsAppCMB.length ? [<WhatsappIcon key="icon" className={clsx(this.props.classes.messengersIcon, this.props.classes.whatsAppIcon)}/>, <span key="text">{'(' + this.state.whatsAppCMB.join(', ') + ')'}</span>] : null,
            this.state.pushover    && this.state.pushover.length    ? [<img src={Pushover} key="icon" alt="pushover" className={this.props.classes.messengersIcon}/>, <span key="text">{'('    + this.state.pushover.join(', ')    + ')'}</span>] : null,
        ] : null;

        return <Accordion
            expanded={this.state.expanded.includes('state_messengers')}
            onChange={() => this.onToggle('state_messengers')}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography className={this.props.classes.heading}>{I18n.t('Messengers') + (count ? ' - ' : '')}
                    {messengers}
                </Typography>
            </AccordionSummary>
            <AccordionDetails style={{display: 'block'}}>
                <FormControlLabel
                    control={<Checkbox
                        disabled={this.state.alarmsOnly}
                        checked={this.state.messagesInAlarmsOnly || this.state.alarmsOnly}
                        onChange={e => this.setState({messagesInAlarmsOnly: e.target.checked})} />
                    }
                    label={I18n.t('Only in alarm state')}
                />
                {narrowWidth && <br/>}
                <FormControlLabel
                    control={<Checkbox
                        checked={this.state.defaultMessengers}
                        onChange={e => this.setState({defaultMessengers: e.target.checked})} />
                    }
                    label={I18n.t('Default messengers')}
                />
                <br/>
                {this.state.defaultMessengers ? null : <MessengerSelect
                    label={ I18n.t('Telegram') }
                    adapterName={'telegram'}
                    className={ this.props.classes.inputMessengers }
                    onChange={value => this.setState({telegram: value})}
                    selected={ this.state.telegram }
                    socket={this.props.socket}
                />}
                {narrowWidth && !this.state.defaultMessengers && <br/>}
                {this.state.defaultMessengers ? null : <MessengerSelect
                    label={ I18n.t('WhatsApp-CMB') }
                    adapterName={'whatsapp-cmb'}
                    className={ this.props.classes.inputMessengers }
                    onChange={value => this.setState({whatsAppCMB: value})}
                    selected={ this.state.whatsAppCMB}
                    socket={this.props.socket}
                />}
                {narrowWidth && !this.state.defaultMessengers && <br/>}
                {this.state.defaultMessengers ? null : <MessengerSelect
                    label={ I18n.t('Pushover') }
                    adapterName={'pushover'}
                    className={ this.props.classes.inputMessengers }
                    onChange={value => this.setState({pushover: value})}
                    selected={ this.state.pushover}
                    socket={this.props.socket}
                />}
            </AccordionDetails>
        </Accordion>;
    }

    render() {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm' || this.props.width === 'md';
        let val = '';
        if (this.state.state && this.state.state.val) {
            if (this.state.state.val === null || this.state.state.val === undefined) {
                val = ' - --';
            } else {
                val = ' - ' + this.state.state.val.toString();
            }
        }

        return <Dialog
            open={true}
            onClose={() => this.onClose()}
            aria-labelledby="form-dialog-title"
            fullWidth={true}
            maxWidth="lg"
        >
            <DialogTitle id="form-dialog-title">{I18n.t('Add event')}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {I18n.t('You can add state to the event list, so the changes will be monitored.')}
                </DialogContentText>
                <div className={this.props.classes.field}>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={I18n.t('State ID')}
                        error={!!(this.state.id && this.state.unknownId)}
                        className={this.props.classes.textFieldWithButton}
                        value={this.state.id}
                        onChange={e => this.setState({id: e.target.value}, () => this.readSettings())}
                        type="text"
                        fullWidth
                    />
                    <Button style={{marginTop: 8}} variant="contained" color="secondary" onClick={() => this.setState({showSelectId: true})}>...</Button>
                </div>

                {this.state.id && this.state.type ?
                    <Paper className={clsx(this.props.classes.paper, this.props.classes.examplePaper)}>

                        <span className={this.props.classes.exampleTitle}>{I18n.t('Example event:')}</span>
                        <span className={this.props.classes.exampleText} style={{color: this.getExampleColor() || undefined}}>
                            {this.props.native.icon ? <img src={this.getExampleIcon()} alt="event" className={this.props.classes.exampleIcon}/>: null}
                            {this.buildExample()}
                        </span>
                        {this.state.type === 'boolean' ?
                            <>
                                <br/>
                                <FormControlLabel
                                    control={<Switch
                                        checked={!!this.state.simulateState}
                                        onChange={e => this.setState({simulateState: e.target.checked})}/>
                                    }
                                    label={I18n.t('Toggle state to simulate')}
                                />
                            </>
                            : null
                        }
                        {this.state.type === 'number' && this.state.states ?
                            <>
                                <br/>
                                <FormControl className={this.props.classes.formControl}>
                                    <InputLabel>{I18n.t('Simulate value')}</InputLabel>
                                    <Select
                                        value={this.state.simulateState === null ? '_current_' : this.state.simulateState}
                                        onChange={e => this.setState({simulateState: e.target.value === '_current_' ? null : e.target.value})}
                                    >
                                    <MenuItem value={'_current_'}>{I18n.t('current') + val}</MenuItem>
                                    {this.state.states.map(item =>
                                        <MenuItem value={item.val}>{item.original}({item.val})</MenuItem>)}
                                </Select>
                                </FormControl>
                            </>
                            : null
                        }
                    </Paper>
                    : null }

                {this.state.id && this.state.type ?
                    <>
                        <br/>
                        <FormControlLabel
                            control={<Checkbox
                                checked={this.state.changesOnly}
                                onChange={e => this.setState({changesOnly: e.target.checked})} />
                            }
                            label={I18n.t('Only changes')}
                        />
                        {narrowWidth && <br/>}
                        <FormControlLabel
                            control={<Checkbox
                                checked={!!this.state.alarmsOnly}
                                onChange={e => this.setState({alarmsOnly: e.target.checked})} />
                            }
                            label={I18n.t('Only in alarm state')}
                        />
                    </> : null}
                {this.state.id     ? this.renderStateSettings() : null }
                {this.state.states ? this.state.states.map((item, i) => this.renderState(i, narrowWidth)) : null }
                {this.state.id     ? this.renderMessengers(narrowWidth) : null}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => this.props.onClose()}><CancelIcon className={this.props.classes.buttonIcon}/>{I18n.t('Cancel')}</Button>
                {this.state.exists ? <Button
                    disabled={!this.state.id || !this.state.type}
                    onClick={() => this.setState({confirmRemove: true})}
                ><RemoveIcon className={this.props.classes.buttonIcon}/>{I18n.t('Remove')}</Button> : null}
                <Button
                    disabled={!this.state.id || !this.state.type || (this.state.exists && JSON.stringify(this.originalSettings) === JSON.stringify(this.getSettings()))}
                    onClick={() =>
                        this.writeSettings(() =>
                            this.props.onClose())
                    }
                    color="primary"
                ><SaveIcon className={this.props.classes.buttonIcon}/>{this.state.exists ? I18n.t('Update') : I18n.t('Add')}</Button>
            </DialogActions>
            {this.renderSelectId()}
            {this.renderConfirmExit()}
            {this.renderConfirmRemove()}
        </Dialog>;
    }
}

AddIdDialog.propTypes = {
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    themeName: PropTypes.string,
    themeType: PropTypes.string,
    socket: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    id: PropTypes.string,
};

export default withWidth()(withStyles(styles)(AddIdDialog));