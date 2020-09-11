import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';

import {MdClose as IconClose} from 'react-icons/md';
import {MdHelp as IconHelp} from 'react-icons/md';

import I18n from '@iobroker/adapter-react/i18n';
import Logo from '@iobroker/adapter-react/Components/Logo';
import ColorPicker from '../Components/ColorPicker';

const styles = theme => ({
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    input: {
        minWidth: 300,
        marginRight: theme.spacing(2),
    },
    button: {
        marginRight: 20,
        marginBottom: 40,
    },
    card: {
        maxWidth: 345,
        textAlign: 'center'
    },
    media: {
        height: 180,
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20
    },
    columnLogo: {
        width: 350,
        marginRight: 0
    },
    columnSettings: {
        width: 'calc(100% - 370px)',
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
    buttonIcon: {
        marginRight: theme.spacing(2),
    },
    buttonFormat: {
        marginTop: 20,
    }
});

class Options extends Component {
    constructor(props) {
        super(props);

        this.state = {
            inAction: false,
            toast: '',
            isInstanceAlive: false,
            errorWithPercent: false,
        };

        this.aliveId = `system.adapter.${this.props.adapterName}.${this.props.instance}.alive`;

        this.props.socket.getState(this.aliveId).then(state =>
            this.setState({isInstanceAlive: state && state.val}));
    }

    componentDidMount() {
        this.props.socket.subscribeState(this.aliveId, this.onAliveChanged);
    }

    componentWillUnmount() {
        this.props.socket.unsubscribeState(this.aliveId, this.onAliveChanged);
    }

    onAliveChanged = (id, state) => {
        if (id === this.aliveId) {
            this.setState({isInstanceAlive: state && state.val});
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
                open={true}
                autoHideDuration={6000}
                onClose={() => this.setState({toast: ''})}
                ContentProps={{
                    'aria-describedby': 'message-id',
                }}
                message={<span id="message-id">{this.state.toast}</span>}
                action={[
                    <IconButton
                        key="close"
                        aria-label="Close"
                        color="inherit"
                        className={this.props.classes.close}
                        onClick={() => this.setState({toast: ''})}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />);
    }

    render() {
        return (
            <form className={ this.props.classes.tab }>
                <Logo
                    instance={ this.props.instance }
                    common={ this.props.common }
                    native={ this.props.native }
                    onError={ text => this.setState({errorText: text}) }
                    onLoad={ this.props.onLoad }
                />
                <div className={ this.props.classes.column + ' ' + this.props.classes.columnSettings }>
                    <TextField
                        label={ I18n.t('Max list length') }
                        className={ this.props.classes.input }
                        value={ this.props.native.maxLength }
                        type="number"
                        inputProps={{min: 1, max: 1000}}
                        onChange={ e => this.props.onChange('maxLength', e.target.value) }
                        margin="normal"
                    />
                    <br/>
                    <TextField
                        label={ I18n.t('Date format') }
                        className={ this.props.classes.input }
                        value={ this.props.native.dateFormat }
                        type="text"
                        onChange={ e => this.props.onChange('dateFormat', e.target.value) }
                        margin="normal"
                    />
                    <Button
                        variant="contained"
                        className={this.props.classes.buttonFormat}
                        onClick={() => window.open('https://momentjs.com/docs/#/displaying/format/', 'momentHelp')}>
                            <IconHelp className={this.props.classes.buttonIcon}/>{I18n.t('Format description')}
                    </Button>
                    <br/>
                    <TextField
                        label={ I18n.t('Show absolute time after seconds') }
                        className={ this.props.classes.input }
                        value={ this.props.native.relativeTime }
                        type="number"
                        inputProps={{min: 0, max: 140000}}
                        onChange={ e => this.props.onChange('relativeTime', e.target.value) }
                        helperText={I18n.t('All older entries will be shown with absolute time, newer with relative time')}
                        margin="normal"
                    />
                    <br/>
                    <TextField
                        label={ I18n.t('Default event text for boolean') }
                        className={ this.props.classes.input }
                        value={ this.props.native.defaultBooleanText }
                        type="text"
                        onChange={ e => this.props.onChange('defaultBooleanText', e.target.value) }
                        margin="normal"
                        helperText={I18n.t('You can use patterns: %s - value, %u - unit, %n - name, %t - time, %d - duration')}
                    />
                    <br/>
                    <TextField
                        label={ I18n.t('Default text by TRUE') }
                        className={ this.props.classes.input }
                        value={ this.props.native.defaultBooleanTextTrue }
                        type="text"
                        onChange={ e => this.props.onChange('defaultBooleanTextTrue', e.target.value) }
                        margin="normal"
                    />
                    <TextField
                        label={ I18n.t('Default text by FALSE') }
                        className={ this.props.classes.input }
                        value={ this.props.native.defaultBooleanTextFalse }
                        type="text"
                        onChange={ e => this.props.onChange('defaultBooleanTextFalse', e.target.value) }
                        margin="normal"
                    />
                    <br/>
                    <ColorPicker
                        color={this.props.native.defaultBooleanColorTrue}
                        style={{width: 300, display: 'inline-block', marginRight: 16}}
                        name={I18n.t('Default color by TRUE')}
                        onChange={color => this.props.onChange('defaultBooleanColorTrue', color)}
                    />
                    <ColorPicker
                        color={this.props.native.defaultBooleanColorFalse}
                        style={{width: 300, display: 'inline-block'}}
                        name={I18n.t('Default color by FALSE')}
                        onChange={color => this.props.onChange('defaultBooleanColorFalse', color)}
                    />
                    <br/>
                    <TextField
                        label={ I18n.t('Default event text for non boolean states') }
                        className={ this.props.classes.input }
                        value={ this.props.native.defaultNonBooleanText }
                        type="text"
                        onChange={ e => this.props.onChange('defaultNonBooleanText', e.target.value) }
                        margin="normal"
                        helperText={I18n.t('You can use patterns: %s - value, %u - unit, %n - name, %t - time, %d - duration')}
                    />
                    <br/>
                    <FormControl className={this.props.classes.input}>
                        <InputLabel>{I18n.t('Language')}</InputLabel>
                        <Select
                            value={this.props.native.language || 'system'}
                            onChange={ e => this.props.onChange('language', e.target.value === 'system' ? '' : e.target.value) }
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
                    <br/>
                    <FormControlLabel
                        control={<Checkbox checked={this.props.native.icons || false} onChange={e => this.props.onChange('icons', e.target.checked)} />}
                        label={I18n.t('Show icons in the list')}
                    />
                    <FormControlLabel
                        control={<Checkbox checked={this.props.native.duration || false} onChange={e => this.props.onChange('duration', e.target.checked)} />}
                        label={I18n.t('Show duration in the list')}
                    />
                    <br/>
                    <FormControlLabel
                        control={<Checkbox checked={this.props.native.icons || false} onChange={e => this.props.onChange('icons', e.target.checked)} />}
                        label={I18n.t('Show icons in the list')}
                    />
                    <FormControlLabel
                        control={<Checkbox checked={this.props.native.duration || false} onChange={e => this.props.onChange('duration', e.target.checked)} />}
                        label={I18n.t('Show duration in the list')}
                    />
                </div>
                { this.renderToast() }
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

export default withStyles(styles)(Options);
