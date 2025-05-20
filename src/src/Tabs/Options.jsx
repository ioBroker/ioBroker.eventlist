import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {
    TextField,
    Button,
    Select,
    InputLabel,
    MenuItem,
    FormControl,
    Snackbar,
    IconButton,
    FormControlLabel,
    Checkbox,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Fab,
} from '@mui/material';

import { ExpandMore as ExpandMoreIcon,
    Close as IconClose,
    Help as IconHelp,
    Add as IconAdd,
    Delete as IconDelete,
} from '@mui/icons-material';

import { I18n, Logo, ColorPicker } from '@iobroker/adapter-react-v5';

import MessengerSelect from '../Components/MessengerSelect';

const styles = {
    tab: {
        width: '100%',
        minHeight: '100%',
    },
    input: {
        minWidth: 300,
        marginRight: 16,
        marginBottom: 16,
    },
    inputNarrowText: {
        minWidth: 300,
        marginRight: 16,
        marginTop: 6,
    },
    buttonDelete: {
        marginTop: 14,
    },
    inputNarrowColor: {
        minWidth: 300,
        marginRight: 16,
        marginTop: 0,
    },
    inputMessengers: {
        minWidth: 200,
        marginRight: 16,
        marginBottom: 16,
    },
    button: {
        marginRight: 20,
        marginBottom: 40,
    },
    card: {
        maxWidth: 345,
        textAlign: 'center',
    },
    media: {
        height: 180,
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20,
    },
    columnLogo: {
        width: 350,
        marginRight: 0,
    },
    columnSettings: {
        width: 'calc(100% - 10px)',
    },
    cannotUse: {
        color: 'red',
        fontWeight: 'bold',
    },
    hintUnsaved: {
        fontSize: 12,
        color: 'red',
        fontStyle: 'italic',
    },
    buttonFormat: {
        marginTop: 20,
    },
    checkBoxLabel: {
        whiteSpace: 'nowrap',
    },
    heading: {
        fontWeight: 'bold',
    },
};

class Options extends Component {
    constructor(props) {
        super(props);

        let expanded = window.localStorage.getItem('eventlist.options.expanded') || '[]';
        try {
            expanded = JSON.parse(expanded);
        } catch {
            expanded = [];
        }

        this.state = {
            inAction: false,
            toast: '',
            isInstanceAlive: false,
            errorWithPercent: false,
            expanded,
        };

        this.aliveId = `system.adapter.${this.props.adapterName}.${this.props.instance}.alive`;

        this.props.socket.getState(this.aliveId).then(state => this.setState({ isInstanceAlive: state && state.val }));
    }

    componentDidMount() {
        this.props.socket.subscribeState(this.aliveId, this.onAliveChanged);
    }

    componentWillUnmount() {
        this.props.socket.unsubscribeState(this.aliveId, this.onAliveChanged);
    }

    onAliveChanged = (id, state) => {
        if (id === this.aliveId) {
            this.setState({ isInstanceAlive: state && state.val });
        }
    };

    renderToast() {
        if (!this.state.toast) return null;
        return (
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open
                autoHideDuration={6000}
                slotProps={{
                    content: { 'aria-describedby': 'message-id' },
                }}
                onClose={() => this.setState({ toast: '' })}
                message={<span id="message-id">{this.state.toast}</span>}
                action={[
                    <IconButton
                        key="close"
                        aria-label="Close"
                        color="inherit"
                        style={styles.close}
                        onClick={() => this.setState({ toast: '' })}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />
        );
    }

    onToggle(id) {
        const expanded = [...this.state.expanded];
        const pos = expanded.indexOf(id);
        if (pos !== -1) {
            expanded.splice(pos, 1);
        } else {
            expanded.push(id);
            expanded.sort();
        }
        window.localStorage.setItem('eventlist.options.expanded', JSON.stringify(expanded));
        this.setState({ expanded });
    }

    render() {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm' || this.props.width === 'md';
        return (
            <form style={styles.tab}>
                <Logo
                    instance={this.props.instance}
                    common={this.props.common}
                    native={this.props.native}
                    onError={text => this.setState({ errorText: text })}
                    onLoad={this.props.onLoad}
                />
                <div style={{ ...styles.column, ...styles.columnSettings }}>
                    <TextField
                        variant="standard"
                        label={I18n.t('Max list length')}
                        style={styles.input}
                        value={this.props.native.maxLength}
                        type="number"
                        slotProps={{
                            htmlInput: {
                                min: 1,
                                max: 9999,
                            },
                        }}
                        onChange={e => this.props.onChange('maxLength', e.target.value)}
                        margin="normal"
                    />
                    <br />
                    <TextField
                        variant="standard"
                        label={I18n.t('Date format')}
                        style={styles.input}
                        value={this.props.native.dateFormat}
                        type="text"
                        onChange={e => this.props.onChange('dateFormat', e.target.value)}
                        margin="normal"
                    />
                    <Button
                        color="grey"
                        variant="contained"
                        style={styles.buttonFormat}
                        onClick={() => window.open('https://momentjs.com/docs/#/displaying/format/', 'momentHelp')}
                        startIcon={<IconHelp />}
                    >
                        {I18n.t('Format description')}
                    </Button>
                    <br />
                    <TextField
                        variant="standard"
                        label={I18n.t('Show absolute time after seconds')}
                        style={styles.input}
                        value={this.props.native.relativeTime}
                        type="number"
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                max: 140000,
                            },
                        }}
                        onChange={e => this.props.onChange('relativeTime', e.target.value)}
                        helperText={I18n.t(
                            'All older entries will be shown with absolute time, newer with relative time',
                        )}
                        margin="normal"
                    />
                    {narrowWidth && <br />}
                    <FormControlLabel
                        sx={{
                            '& .MuiFormControlLabel-label': styles.checkBoxLabel,
                        }}
                        control={
                            <Checkbox
                                checked={this.props.native.stateId === undefined ? true : this.props.native.stateId}
                                onChange={e => this.props.onChange('stateId', e.target.checked)}
                            />
                        }
                        label={I18n.t('Show state ID in the list')}
                    />
                    {narrowWidth && <br />}
                    <FormControlLabel
                        sx={{
                            '& .MuiFormControlLabel-label': styles.checkBoxLabel,
                        }}
                        control={
                            <Checkbox
                                checked={this.props.native.icons || false}
                                onChange={e => this.props.onChange('icons', e.target.checked)}
                            />
                        }
                        label={I18n.t('Show icons in the list')}
                    />
                    {narrowWidth && <br />}
                    <FormControlLabel
                        sx={{
                            '& .MuiFormControlLabel-label': styles.checkBoxLabel,
                        }}
                        control={
                            <Checkbox
                                checked={this.props.native.duration || false}
                                onChange={e => this.props.onChange('duration', e.target.checked)}
                            />
                        }
                        label={I18n.t('Show duration in the list')}
                    />
                    <br />
                    <FormControlLabel
                        sx={{
                            '& .MuiFormControlLabel-label': styles.checkBoxLabel,
                        }}
                        control={
                            <Checkbox
                                checked={this.props.native.deleteAlarmsByDisable || false}
                                onChange={e => this.props.onChange('deleteAlarmsByDisable', e.target.checked)}
                            />
                        }
                        label={I18n.t('Remove alarm events from list by the alarm mode deactivating')}
                    />

                    <Accordion
                        expanded={this.state.expanded.includes('state_boolean')}
                        onChange={() => this.onToggle('state_boolean')}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography style={styles.heading}>{I18n.t('Boolean settings')}</Typography>
                        </AccordionSummary>
                        <AccordionDetails style={{ display: 'block' }}>
                            <TextField
                                variant="standard"
                                label={I18n.t('Default event text for boolean')}
                                style={styles.input}
                                value={this.props.native.defaultBooleanText}
                                type="text"
                                onChange={e => this.props.onChange('defaultBooleanText', e.target.value)}
                                margin="normal"
                                helperText={I18n.t(
                                    'You can use patterns: %s - value, %u - unit, %n - name, %t - time, %d - duration',
                                )}
                            />
                            <br />
                            <TextField
                                variant="standard"
                                label={I18n.t('Default text by TRUE')}
                                style={styles.input}
                                value={this.props.native.defaultBooleanTextTrue}
                                type="text"
                                onChange={e => this.props.onChange('defaultBooleanTextTrue', e.target.value)}
                                margin="normal"
                            />
                            {narrowWidth && <br />}
                            <TextField
                                variant="standard"
                                label={I18n.t('Default text by FALSE')}
                                style={styles.input}
                                value={this.props.native.defaultBooleanTextFalse}
                                type="text"
                                onChange={e => this.props.onChange('defaultBooleanTextFalse', e.target.value)}
                                margin="normal"
                            />
                            <br />
                            <ColorPicker
                                value={this.props.native.defaultBooleanColorTrue}
                                style={{ ...styles.input, width: 300, display: 'inline-block', marginRight: 16 }}
                                label={I18n.t('Default color by TRUE')}
                                openAbove
                                onChange={color => this.props.onChange('defaultBooleanColorTrue', color)}
                            />
                            {narrowWidth && <br />}
                            <ColorPicker
                                value={this.props.native.defaultBooleanColorFalse}
                                style={{ ...styles.input, width: 300, display: 'inline-block' }}
                                label={I18n.t('Default color by FALSE')}
                                openAbove
                                onChange={color => this.props.onChange('defaultBooleanColorFalse', color)}
                            />
                        </AccordionDetails>
                    </Accordion>

                    <Accordion
                        expanded={this.state.expanded.includes('state_string')}
                        onChange={() => this.onToggle('state_string')}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography style={styles.heading}>{I18n.t('String settings')}</Typography>
                            {this.state.expanded.includes('state_string') ? (
                                <Fab
                                    size="small"
                                    color="primary"
                                    style={{ width: 36, height: 36, marginLeft: 8 }}
                                    onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        let defaultStringTexts = this.props.native.defaultStringTexts
                                            ? JSON.parse(JSON.stringify(this.props.native.defaultStringTexts))
                                            : [];
                                        defaultStringTexts.push({ value: '', text: '', color: '#000000' });
                                        this.props.onChange('defaultStringTexts', defaultStringTexts);
                                    }}
                                >
                                    <IconAdd />
                                </Fab>
                            ) : null}
                        </AccordionSummary>
                        <AccordionDetails style={{ display: 'block' }}>
                            {this.props.native.defaultStringTexts
                                ? this.props.native.defaultStringTexts.map((item, i) => (
                                      <div
                                          key={i}
                                          style={{ display: 'flex', alignItems: 'center' }}
                                      >
                                          <TextField
                                              variant="standard"
                                              label={I18n.t('For value')}
                                              style={styles.inputNarrowText}
                                              value={item.value}
                                              type="text"
                                              onChange={e => {
                                                  let defaultStringTexts = this.props.native.defaultStringTexts
                                                      ? JSON.parse(JSON.stringify(this.props.native.defaultStringTexts))
                                                      : [];
                                                  defaultStringTexts[i].value = e.target.value;
                                                  this.props.onChange('defaultStringTexts', defaultStringTexts);
                                              }}
                                              margin="normal"
                                          />
                                          <TextField
                                              variant="standard"
                                              label={I18n.t('Text for value')}
                                              style={styles.inputNarrowText}
                                              value={item.text}
                                              type="text"
                                              onChange={e => {
                                                  let defaultStringTexts = this.props.native.defaultStringTexts
                                                      ? JSON.parse(JSON.stringify(this.props.native.defaultStringTexts))
                                                      : [];
                                                  defaultStringTexts[i].text = e.target.value;
                                                  this.props.onChange('defaultStringTexts', defaultStringTexts);
                                              }}
                                              margin="normal"
                                          />
                                          <ColorPicker
                                              value={item.color}
                                              style={{
                                                  ...styles.inputNarrowColor,
                                                  width: 300,
                                                  display: 'inline-block',
                                              }}
                                              label={I18n.t('Color for value')}
                                              openAbove
                                              onChange={color => {
                                                  let defaultStringTexts = this.props.native.defaultStringTexts
                                                      ? JSON.parse(JSON.stringify(this.props.native.defaultStringTexts))
                                                      : [];
                                                  defaultStringTexts[i].color = color;
                                                  this.props.onChange('defaultStringTexts', defaultStringTexts);
                                              }}
                                          />
                                          <IconButton
                                              style={styles.buttonDelete}
                                              title={I18n.t('Delete value')}
                                              color="secondary"
                                              onClick={() => {
                                                  let defaultStringTexts = this.props.native.defaultStringTexts
                                                      ? JSON.parse(JSON.stringify(this.props.native.defaultStringTexts))
                                                      : [];
                                                  defaultStringTexts.splice(i, 1);
                                                  this.props.onChange('defaultStringTexts', defaultStringTexts);
                                              }}
                                          >
                                              <IconDelete />
                                          </IconButton>
                                      </div>
                                  ))
                                : null}
                        </AccordionDetails>
                    </Accordion>
                    <TextField
                        variant="standard"
                        label={I18n.t('Default event text for non boolean states')}
                        style={styles.input}
                        value={this.props.native.defaultNonBooleanText}
                        type="text"
                        onChange={e => this.props.onChange('defaultNonBooleanText', e.target.value)}
                        margin="normal"
                        helperText={I18n.t(
                            'You can use patterns: %s - value, %u - unit, %n - name, %t - time, %d - duration',
                        )}
                    />
                    <br />
                    <FormControl
                        variant="standard"
                        style={styles.input}
                    >
                        <InputLabel>{I18n.t('Language')}</InputLabel>
                        <Select
                            variant="standard"
                            value={this.props.native.language || 'system'}
                            onChange={e =>
                                this.props.onChange('language', e.target.value === 'system' ? '' : e.target.value)
                            }
                        >
                            <MenuItem value="system">{I18n.t('System language')}</MenuItem>
                            <MenuItem value="en">English</MenuItem>
                            <MenuItem value="de">Deutsch</MenuItem>
                            <MenuItem value="ru">русский</MenuItem>
                            <MenuItem value="pt">Portugues</MenuItem>
                            <MenuItem value="nl">Nederlands</MenuItem>
                            <MenuItem value="fr">français</MenuItem>
                            <MenuItem value="it">Italiano</MenuItem>
                            <MenuItem value="es">Espanol</MenuItem>
                            <MenuItem value="pl">Polski</MenuItem>
                            <MenuItem value="zh-cn">简体中文</MenuItem>
                        </Select>
                    </FormControl>
                    <Accordion
                        expanded={this.state.expanded.includes('state_messengers')}
                        onChange={() => this.onToggle('state_messengers')}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography style={styles.heading}>{I18n.t("Default messenger's settings")}</Typography>
                        </AccordionSummary>
                        <AccordionDetails style={{ display: 'block' }}>
                            <MessengerSelect
                                label={I18n.t('Telegram')}
                                adapterName="telegram"
                                style={styles.inputMessengers}
                                selected={this.props.native.defaultTelegram}
                                onChange={values => this.props.onChange('defaultTelegram', values)}
                                socket={this.props.socket}
                            />
                            {narrowWidth && <br />}
                            <MessengerSelect
                                label={I18n.t('WhatsApp-CMB')}
                                adapterName="whatsapp-cmb"
                                style={styles.inputMessengers}
                                selected={this.props.native.defaultWhatsAppCMB}
                                onChange={values => this.props.onChange('defaultWhatsAppCMB', values)}
                                socket={this.props.socket}
                            />
                            {narrowWidth && <br />}
                            <MessengerSelect
                                label={I18n.t('Pushover')}
                                adapterName="pushover"
                                style={styles.inputMessengers}
                                selected={this.props.native.defaultPushover}
                                onChange={values => this.props.onChange('defaultPushover', values)}
                                socket={this.props.socket}
                            />
                        </AccordionDetails>
                    </Accordion>
                </div>
                {this.renderToast()}
            </form>
        );
    }
}

Options.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    changed: PropTypes.bool,
    socket: PropTypes.object.isRequired,
};

export default Options;
