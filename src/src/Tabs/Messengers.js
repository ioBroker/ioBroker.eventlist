import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';

import TextField from '@material-ui/core/TextField';
import DialogMessage from '@iobroker/adapter-react/Dialogs/Message';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';

import {MdClose as IconClose} from 'react-icons/md';

import I18n from '@iobroker/adapter-react/i18n';
import DialogError from "@iobroker/adapter-react/Dialogs/Error";

const styles = theme => ({
    tab: {
        width: '100%',
        height: '100%'
    },
    field: {
        width: 150,
        marginRight: theme.spacing(1),
    },
});

class Messengers extends Component {
    constructor(props) {
        super(props);

        let expanded = window.localStorage.getItem('eventlist.app.messangers') || '[]';
        try {
            expanded = JSON.parse(expanded);
        } catch (e) {

        }

        this.state = {
            showHint: false,
            toast: '',
            errorText: '',
            messageText: '',
            telegramInstances: [],
            whatsappInstances: [],
            expanded,
        };

        this.aliveId = `system.adapter.${this.props.adapterName}.${this.props.instance}.alive`;
        this.triggerPDFId = `${this.props.adapterName}.${this.props.instance}.triggerPDF`;
        this.props.socket.getAdapterInstances('telegram')
            .then(telegram => this.props.socket.getAdapterInstances('whatsapp-cmb')
                .then(whatsapp => {
                    this.setState({telegramInstances: telegram.map(item => item._id.split('.').pop()), whatsappInstances: whatsapp.map(item => item._id.split('.').pop())});
                }));
    }

    showError(text) {
        this.setState({errorText: text});
    }

    renderError() {
        if (!this.state.errorText) {
            return null;
        }
        return <DialogError text={this.state.errorText} title={I18n.t('Error')} onClose={() => this.setState({errorText: ''})}/>;
    }

    renderToast() {
        if (!this.state.toast) {
            return null;
        }
        return <Snackbar
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
            />;
    }

    onExpand(name, ex) {
        const expanded = [...this.state.expanded];
        if (ex) {
            !expanded.includes(name) && expanded.push(name);
        } else {
            const pos = expanded.indexOf(name);
            pos !== -1 && expanded.splice(pos, 1);
        }
        window.localStorage.setItem('eventlist.app.messangers', JSON.stringify(expanded));
        this.setState({expanded});
    }

    renderTelegram() {
        return <Accordion
            expanded={this.state.expanded.includes('telegram')}
            onChange={(event, ex) => this.onExpand('telegram', ex)}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} classes={{content: this.props.classes.accordionContent}}>Telegram</AccordionSummary>
            <AccordionDetails>
                <FormControl className={this.props.classes.field}>
                    <InputLabel>{I18n.t('Instance')}</InputLabel>
                    <Select
                        value={this.props.native.telegram || 'none'}
                        onChange={e => this.props.onChange('telegram', e.target.value === 'none' ? '' : e.target.value)}
                    >
                        <MenuItem value="none">{I18n.t('Disabled')}</MenuItem>
                        {this.state.telegramInstances.map(i => <MenuItem value={i.toString()}>telegram.{i}</MenuItem>)}
                    </Select>
                </FormControl>
                {this.props.native.telegram !== '' && this.props.native.telegram !== null && this.props.native.telegram !== undefined && <TextField
                    key="telegramUser"
                    type="text"
                    className={this.props.classes.field}
                    label={I18n.t('Telegram user')}
                    value={this.props.native.telegramUser}
                    onChange={e => this.props.onChange('telegramUser', e.target.value)}
                />}
            </AccordionDetails>
        </Accordion>
    }

    renderWhatsApp() {
        return <Accordion
            expanded={this.state.expanded.includes('whatsapp')}
            onChange={(event, ex) => this.onExpand('whatsapp', ex)}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} classes={{content: this.props.classes.accordionContent}}>WhatsApp</AccordionSummary>
            <AccordionDetails>
                <FormControl className={this.props.classes.field}>
                    <InputLabel>{I18n.t('Instance')}</InputLabel>
                    <Select
                        value={this.props.native.whatsapp || 'none'}
                        onChange={e => this.props.onChange('whatsapp', e.target.value === 'none' ? '' : e.target.value)}
                    >
                        <MenuItem value="none">{I18n.t('Disabled')}</MenuItem>
                        {this.state.whatsappInstances.map(i => <MenuItem value={i.toString()}>whatsapp-cmb.{i}</MenuItem>)}
                    </Select>
                </FormControl>
                {this.props.native.whatsapp !== '' && this.props.native.whatsapp !== null && this.props.native.whatsapp !== undefined && <TextField
                    key="whatsappPhone"
                    type="text"
                    className={this.props.classes.field}
                    label={I18n.t('WhatsApp phone')}
                    value={this.props.native.whatsappPhone}
                    onChange={e => this.props.onChange('whatsappPhone', e.target.value)}
                />}
            </AccordionDetails>
        </Accordion>
    }

    renderMessage() {
        if (!this.state.messageText) {
            return null;
        }
        return <DialogMessage title={I18n.t('Success')} onClose={() => this.setState({messageText: ''})}>{this.state.messageText}</DialogMessage>
    }

    render() {
        return (
            <form className={this.props.classes.tab}>
                {this.renderTelegram()}
                {this.renderWhatsApp()}
                {this.renderToast()}
                {this.renderMessage()}
                {this.renderError()}
            </form>
        );
    }
}

Messengers.propTypes = {
    native: PropTypes.object.isRequired,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
};

export default withStyles(styles)(Messengers);
