import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import moment from 'moment'

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

import I18n from '@iobroker/adapter-react/i18n';
import SelectIDDialog from '@iobroker/adapter-react/Dialogs/SelectID';
import ColorPicker from '../Components/ColorPicker';

const styles = theme => ({
    textField: {

    },
    textFieldWithButton: {
        width: 'calc(100% - 70px)'
    },
    exampleDiv: {
        marginBottom: theme.spacing(2),
    },
    exampleTitle: {
        fontWeight: 'bold',
    },
    exampleText: {
        marginLeft: theme.spacing(1),
        fontStyle: 'italic',
        fontSize: 20,
    },
    textDense: {
        marginTop: 0,
        marginBottom: 0,
    },
    paper: {
        marginBottom: theme.spacing(1),
        padding: theme.spacing(1),
    }
});

const DEFAULT_TEMPLATE = 'default';

class AddIdDialog extends Component {
    constructor(props) {
        super(props);

        this.state = {
            id: this.props.id || '',
            type: '',
            event: '',
            trueText: '',
            falseText: '',
            falseTextDefault: true,
            trueTextDefault: true,
            eventDefault: true,
            trueColor: '',
            trueColorRaw: '',
            falseColor: '',
            falseColorRaw: '',
            trueColorDefault: true,
            falseColorDefault: true,
            changesOnly: true,
            showSelectId: false,
            unknownId: true,
            unit: '',
            name: '',
            toggleState: false,
            exists: false,
        };

        this.language = this.props.native.language || I18n.getLanguage();
        moment.locale(this.language === 'en' ? 'en-gb' : this.language);

        this.textSwitchedOn = this.translate('switched on', this.language);
        this.textSwitchedOff = this.translate('switched off', this.language);
        this.textDeviceChangedStatus = this.translate('Device %n changed status:', this.language);

        this.namespace = `${this.props.adapterName}.${this.props.instance}`;

        this.subscribed = '';
        this.originalSettings = {};

        if (this.state.id) {
            this.readSettings();
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
                        type: (obj && obj.common && obj.common.type) || '',
                        unknownId: !obj || !obj.common || !obj.common.type,
                        name: this.getName(obj),
                        unit: (obj && obj.common && obj.common.unit) || ''
                    };

                    if (obj && obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
                        const newSettings = obj.common.custom[this.namespace];
                        newState.exists = true;
                        if (newState.type === 'boolean') {
                            newState.trueText = newSettings.trueText === DEFAULT_TEMPLATE ? '' : newSettings.trueText;
                            newState.trueTextDefault = newSettings.trueText === DEFAULT_TEMPLATE;

                            newState.falseText = newSettings.falseText === DEFAULT_TEMPLATE ? '' : newSettings.falseText;
                            newState.falseTextDefault = newSettings.falseText === DEFAULT_TEMPLATE;

                            newState.trueColor = newSettings.trueColor === DEFAULT_TEMPLATE ? '' : newSettings.trueColor;
                            newState.trueColorDefault = newSettings.trueColor === DEFAULT_TEMPLATE;

                            newState.falseColor = newSettings.falseColor === DEFAULT_TEMPLATE ? '' : newSettings.falseColor;
                            newState.falseColorDefault = newSettings.falseColor === DEFAULT_TEMPLATE;
                        } else {
                            newState.trueText = '';
                            newState.trueTextDefault = true;
                            newState.falseText = '';
                            newState.falseTextDefault = true;
                            newState.trueColor = '';
                            newState.trueColorDefault = true;
                            newState.falseColor = '';
                            newState.falseColorDefault = true;
                        }

                        newState.event = newSettings.event === DEFAULT_TEMPLATE ? '' : newSettings.event;
                        newState.eventDefault = newSettings.event === DEFAULT_TEMPLATE;

                    } else {
                        newState.exists = false;
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

    isChanged() {
        const original = this.originalSettings || {};
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
    static getColor(color) {
        if (color && typeof color === 'object') {
            if (color.rgb) {
                return 'rgba(' + color.rgb.r + ',' + color.rgb.g + ',' + color.rgb.b + ',' + color.rgb.a + ')';
            } else {
                return 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + color.a + ')';
            }
        } else {
            return color || '';
        }
    }

    getExampleColor() {
        let color = '';
        if (this.state.type === 'boolean') {
            const trueColor = AddIdDialog.getColor(this.state.trueColor);
            const falseColor = AddIdDialog.getColor(this.state.falseColor);

            let stateVal = !!(this.state.state && this.state.state.val);
            if (this.state.toggleState) {
                stateVal = !stateVal;
            }

            if (stateVal && (trueColor || this.state.trueColorDefault)) {
                color = trueColor || this.props.native.defaultBooleanColorTrue || '';
            } else if (!stateVal && (falseColor || this.state.falseColorDefault)) {
                color = falseColor || this.props.native.defaultBooleanColorFalse || '';
            }
        }

        return color;
    }

    buildExample() {
        let eventTemplate = '';
        let val = '';
        let valWithUnit = '';
        let time = this.state.state && this.state.state.ts ? moment(new Date(this.state.state.ts)).format(this.props.native.dateFormat) : this.props.native.dateFormat;

        if (this.state.type === 'boolean') {
            let stateVal = !!(this.state.state && this.state.state.val);
            if (this.state.toggleState) {
                stateVal = !stateVal;
            }

            if (!this.state.eventDefault && !this.state.event && stateVal && (this.state.trueText || this.state.trueTextDefault)) {
                eventTemplate = (this.state.trueTextDefault || this.state.trueText === DEFAULT_TEMPLATE) ? this.props.native.defaultBooleanTextTrue || this.textSwitchedOn : this.state.trueText;
            } else if (!this.state.eventDefault && !this.state.event && !stateVal && (this.state.falseText || this.state.falseTextDefault)) {
                eventTemplate = (this.state.falseTextDefault || this.state.falseText === DEFAULT_TEMPLATE) ? this.props.native.defaultBooleanTextFalse || this.textSwitchedOff : this.state.falseText;
            } else {
                if (this.state.event === DEFAULT_TEMPLATE || this.state.eventDefault) {
                    eventTemplate = this.props.native.defaultBooleanText || this.textDeviceChangedStatus;
                } else {
                    eventTemplate = this.state.event;
                }
                eventTemplate = eventTemplate.replace(/%u/g, this.state.unit || '');
                eventTemplate = eventTemplate.replace(/%n/g, this.state.name || this.state.id);
                val = stateVal ?
                    (this.state.trueTextDefault || this.state.trueText === DEFAULT_TEMPLATE) ? this.props.native.defaultBooleanTextTrue || this.textSwitchedOn : this.state.trueText || this.textSwitchedOn
                    :
                    (this.state.falseTextDefault || this.state.falseText === DEFAULT_TEMPLATE) ? this.props.native.defaultBooleanTextFalse || this.textSwitchedOff : this.state.falseText || this.textSwitchedOff;
                valWithUnit = val;
            }
        } else {
            eventTemplate = this.state.event === DEFAULT_TEMPLATE ? this.props.native.defaultNonBooleanText || this.textDeviceChangedStatus : this.state.event || this.textDeviceChangedStatus;
            eventTemplate = eventTemplate.replace(/%u/g, this.state.unit || '');
            eventTemplate = eventTemplate.replace(/%n/g, this.state.name || this.state.id);
            val = this.state.state && this.state.state.val !== undefined && this.state.state.val !== null ? this.state.state.val.toString() : '';
            valWithUnit = val;
            if (valWithUnit !== '' && this.state.unit) {
                valWithUnit += this.state.unit;
            }
        }

        if (eventTemplate.includes('%s')) {
            eventTemplate = eventTemplate.replace(/%s/g, val);
            valWithUnit = '';
        }

        eventTemplate = eventTemplate.replace(/%t/g, this.state.state ? moment(new Date(this.state.state.ts)).format(this.props.native.dateFormat) : this.props.native.dateFormat);

        return `${time} | ${eventTemplate} | ${valWithUnit}`;
    }

    getSettings() {
        const settings = {
            enabled: true,
            event: this.state.eventDefault ? DEFAULT_TEMPLATE : this.state.event,
            changesOnly: !!this.state.changesOnly
        };

        if (this.state.type === 'boolean') {
            settings.trueText   = this.state.trueTextDefault   ? DEFAULT_TEMPLATE : this.state.trueText;
            settings.falseText  = this.state.falseTextDefault  ? DEFAULT_TEMPLATE : this.state.falseText;
            settings.trueColor  = this.state.trueColorDefault  ? DEFAULT_TEMPLATE : this.state.trueColor;
            settings.falseColor = this.state.falseColorDefault ? DEFAULT_TEMPLATE : this.state.falseColor;
        }

        return settings;
    }

    writeSettings(cb) {
        this.props.socket.getObject(this.state.id)
            .then(obj => {
                if (obj && obj.common) {
                    obj.common.custom = obj.common.custom || {};

                    obj.common.custom[this.namespace] = this.getSettings();
                    this.props.socket.setObject(this.state.id, obj)
                        .then(() => cb && cb());
                }
            });
    }

    render() {
        return <Dialog
            open={true}
            onClose={() => this.props.onClose()}
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
                    <Paper className={this.props.classes.paper}>

                        <span className={this.props.classes.exampleTitle}>{I18n.t('Example text:')}</span>
                        <span className={this.props.classes.exampleText} style={{color: this.getExampleColor() || undefined}}>{this.buildExample()}</span>
                        {this.state.type === 'boolean' ?
                            <>
                                <br/>
                                <FormControlLabel
                                    control={<Switch
                                        checked={this.state.toggleState}
                                        onChange={e => this.setState({toggleState: e.target.checked})}/>
                                    }
                                    label={I18n.t('Toggle state to simulate')}
                                />
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
                    </> : null}
                {this.state.id ?
                    <Paper className={this.props.classes.paper}>
                        <FormControlLabel
                            control={<Checkbox
                                checked={this.state.eventDefault}
                                onChange={e => this.setState({eventDefault: e.target.checked})} />
                            }
                            label={I18n.t('Default event text')}
                        />
                        <br/>
                        {!this.state.eventDefault ? <TextField
                            margin="dense"
                            label={I18n.t('Event text')}
                            value={this.state.event}
                            onChange={e => this.setState({event: e.target.value})}
                            type="text"
                            className={this.props.classes.textField}
                            helperText={I18n.t('You can use patterns: %s - value, %u - unit, %n - name, %t - time')}
                            fullWidth
                        /> : null}
                    </Paper>
                    : null }
                {this.state.id && this.state.type === 'boolean' ?
                    [
                        <Paper key="1" className={this.props.classes.paper}>
                            <FormControlLabel
                                control={<Checkbox
                                    checked={this.state.trueTextDefault}
                                    onChange={e => this.setState({trueTextDefault: e.target.checked})} />
                                }
                                label={I18n.t('Use default TRUE value text')}
                            />
                            {!this.state.trueTextDefault ? <TextField
                                margin="dense"
                                label={I18n.t('TRUE text')}
                                value={this.state.trueText}
                                classes={{root: this.props.classes.textDense}}
                                onChange={e => this.setState({trueText: e.target.value})}
                                type="text"
                                className={this.props.classes.textField}
                                helperText={I18n.t('This text will be used when the state is TRUE')}
                            /> : null}
                        </Paper>,
                        <Paper key="2" className={this.props.classes.paper}>
                            <FormControlLabel
                                control={<Checkbox
                                    checked={this.state.trueColorDefault}
                                    onChange={e => this.setState({trueColorDefault: e.target.checked})} />
                                }
                                label={I18n.t('Use default TRUE value color')}
                            />
                            {!this.state.trueColorDefault ? <ColorPicker
                                color={this.state.trueColor}
                                style={{width: 200, display: 'inline-block'}}
                                name={I18n.t('TRUE color')}
                                onChange={color => this.setState({trueColor: color})}
                            /> : null}
                        </Paper>,
                        <Paper key="3" className={this.props.classes.paper}>
                            <FormControlLabel
                                control={<Checkbox
                                    checked={this.state.falseTextDefault}
                                    onChange={e => this.setState({falseTextDefault: e.target.checked})} />
                                }
                                label={I18n.t('Use default FALSE value text')}
                            />
                            {!this.state.falseTextDefault ? <TextField
                                margin="dense"
                                label={I18n.t('FALSE text')}
                                value={this.state.falseText}
                                classes={{root: this.props.classes.textDense}}
                                onChange={e => this.setState({falseText: e.target.value})}
                                type="text"
                                className={this.props.classes.textField}
                                helperText={I18n.t('This text will be used when the state is FALSE')}
                            /> : null}
                        </Paper>,
                        <Paper key="4" className={this.props.classes.paper}>
                            <FormControlLabel
                                control={<Checkbox
                                    checked={this.state.falseColorDefault}
                                    onChange={e => this.setState({falseColorDefault: e.target.checked})} />
                                }
                                label={I18n.t('Use default FALSE value color')}
                            />
                            {!this.state.falseColorDefault ? <ColorPicker
                                style={{width: 200, display: 'inline-block'}}
                                color={this.state.falseColor}
                                name={I18n.t('FALSE color')}
                                onChange={color => this.setState({falseColor: color})}
                            /> : null}
                        </Paper>
                        ]
                    : null }
            </DialogContent>
            <DialogActions>
                <Button onClick={() => this.props.onClose()} color="primary">{I18n.t('Cancel')}</Button>
                <Button
                    disabled={!this.state.id || !this.state.type || JSON.stringify(this.originalSettings) === JSON.stringify(this.getSettings())}
                    onClick={() =>
                        this.writeSettings(() =>
                            this.props.onClose())
                    }
                    color="primary"
                >{this.state.exists ? I18n.t('Update') : I18n.t('Add')}</Button>
            </DialogActions>
            {this.renderSelectId()}
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

export default withStyles(styles)(AddIdDialog);
