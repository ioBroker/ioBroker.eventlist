import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import TextField from '@material-ui/core/TextField';
import Fab from '@material-ui/core/Fab';
import DialogMessage from '@iobroker/adapter-react/Dialogs/Message';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import CircularProgress from '@material-ui/core/CircularProgress';

import {MdFlashOn as IconConnect} from 'react-icons/md';
import {MdClose as IconClose} from 'react-icons/md';

import I18n from '@iobroker/adapter-react/i18n';
import Message from '@iobroker/adapter-react/Dialogs/Message';
import DialogError from "@iobroker/adapter-react/Dialogs/Error";

const styles = theme => ({
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    license: {
        width: '100%',
        marginBottom: 20,
    },
    button: {
        marginRight: 20,
    },
    license_ok: {
        color: '#2f8f00'
    },
    license_not_ok: {
        color: '#8f2f00'
    }
});

class Options extends Component {
    constructor(props) {
        super(props);

        this.state = {
            showHint: false,
            toast: '',
            alive: this.props.alive,
            errorText: '',
            isLicenseOK: 'not_checked',
            messageText: '',
            requesting: false,
        };
    }

    static getDerivedStateFromProps(props, state) {
        if (props.alive !== state.alive) {
            return {alive: props.alive};
        }
        return null;
    }

    showError(text) {
        this.setState({errorText: text});
    }

    renderError() {
        if (!this.state.errorText) {
            return null;
        }
        return (<DialogError text={this.state.errorText} title={I18n.t('Error')} onClose={() => this.setState({errorText: ''})}/>);
    }

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

    renderLicenseSettings() {
        return [
            (<TextField
                placeholder={I18n.t('Place your ioBroker OPC-UA license here')}
                disabled={this.state.requesting}
                key="license"
                multiline
                className={this.props.classes.license}
                label={I18n.t('License')}
                value={this.props.native.license}
                onChange={e => this.props.onChange('license', e.target.value)}
            />),
            (<br/>),
            (<Fab key="test" variant="extended" disabled={this.state.requesting || !this.props.native.license} onClick={() => this.checkLicense()}>
                {this.state.requesting ? (<CircularProgress size={18} thickness={4} variant="indeterminate" disableShrink/>) : (<IconConnect />)}
                {I18n.t('Check license online')}
            </Fab>),
            (<br/>),
            !this.props.native.license ? (<p key="hint">{I18n.t('license_hint')} <a href="https://iobroker.net/accountLicenses" target="_blank">iobroker.net</a></p>) : null,
            (<br/>),
            this.state.isLicenseOK !== 'not_checked' ? (<p className={this.props.classes[this.state.isLicenseOK]}>{I18n.t(this.state.isLicenseOK)}</p>) : null
        ];
    }

    renderMessage() {
        if (!this.state.messageText) {
            return null;
        }
        return (<DialogMessage title={I18n.t('Success')} onClose={() => this.setState({messageText: ''})}>{this.state.messageText}</DialogMessage>)
    }

    checkLicense() {
        this.setState({requesting: true}, () =>
            fetch(
                'https://iobroker.net:3001/api/v1/public/cert/', // or https://iobroker.net/cert/ - deprecated
                {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'text/plain',
                        },
                        redirect: 'follow',
                        cache: 'no-cache',
                        body: this.props.native.license
                    }
                )
                .then(res => res.json())
                .then(data => {
                    if (data.result === 'invalid') {
                        this.setState({requesting: false, isLicenseOK: 'license_not_ok'}, () => this.showError(I18n.t('Invalid license')));
                    } else {
                        if (data.name.startsWith('iobroker.consumption')) {
                            // read UUID of device
                            if (this.state.alive) {
                                this.props.socket.sendTo('consumption.' + this.props.instance, 'uuid', null, result => {
                                    if (!data.uuid || data.uuid === result.uuid) {
                                        this.setState({messageText: data.result, requesting: false, isLicenseOK: 'license_ok'});
                                    } else {
                                        this.setState({requesting: false, isLicenseOK: 'license_not_ok'}, () => this.showError(I18n.t('Wrong license UUID %s, expected %s', data.uuid, result.uuid)));
                                    }
                                });
                            } else {
                                this.setState({messageText: data.result, requesting: false, isLicenseOK: 'license_ok'});
                            }
                        } else {
                            this.setState({requesting: false, isLicenseOK: 'license_not_ok'}, () => this.showError(I18n.t('Wrong license name %s', data.name)));
                        }
                    }
                })
                .catch(e => this.setState({requesting: false, errorText: I18n.t('Cannot check license: %s', e)}))
        );
    }

    render() {
        return (
            <form className={this.props.classes.tab}>
                {this.renderLicenseSettings()}
                <br/>
                {this.renderToast()}
                {this.renderMessage()}
                {this.renderError()}
            </form>
        );
    }
}

Options.propTypes = {
    native: PropTypes.object.isRequired,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
};

export default withStyles(styles)(Options);
