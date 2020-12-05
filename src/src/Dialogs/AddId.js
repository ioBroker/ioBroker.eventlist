import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';

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
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';

import CancelIcon from '@material-ui/icons/Cancel';
import SaveIcon from '@material-ui/icons/Save';
import {FaEraser as RemoveIcon} from 'react-icons/fa';

import I18n from '@iobroker/adapter-react/i18n';
import ConfirmDialog from '@iobroker/adapter-react/Dialogs/Confirm';
import EditState from '../Components/EditState';
import SelectIDDialog from '@iobroker/adapter-react/Dialogs/SelectID';
import LinearProgress from '@material-ui/core/LinearProgress';

const DEFAULT_TEMPLATE = 'default';

const styles = theme => ({
    textFieldWithButton: {
        width: 'calc(100% - 70px)'
    },
    buttonIcon: {
        marginRight: theme.spacing(1)
    },
});

class AddIdDialog extends Component {
    constructor(props) {
        super(props);

        this.propsId = this.props.id !== 'true' ? this.props.id : '';

        this.state = {
            ids: [],
            currentId: this.propsId || '',
            showSelectId: !this.propsId,
            exists: {},
            settings: {},
            confirmExit: false,
            confirmRemove: false,
            unknownIds: {},
        };

        this.namespace = `${this.props.adapterName}.${this.props.instance}`;

        this.originalSettings = {};
        setTimeout(() => this.updateIds(this.propsId, true), 100);
    }

    writeSettings(ids, cb) {
        if (!ids || !ids.length) {
            cb && cb();
        } else {
            const id = ids.shift();
            this.props.socket.getObject(id)
                .then(obj => {
                    if (obj && obj.common) {
                        obj.common.custom = obj.common.custom || {};
                        const newSettings = EditState.getSettings(this.state.settings[id] || {enabled: true, event: DEFAULT_TEMPLATE, changesOnly: true, defaultMessengers: true});
                        // if changed
                        if (JSON.stringify(newSettings) !== JSON.stringify(obj.common.custom[this.namespace])) {
                            obj.common.custom[this.namespace] = newSettings;
                            return this.props.socket.setObject(obj._id, obj)
                                .then(() => setTimeout(() => this.writeSettings(ids, cb), 0));
                        }
                    }
                    setTimeout(() => this.writeSettings(ids, cb), 0);
                });
        }
    }

    removeSettings(cb) {
        this.props.socket.getObject(this.state.ids[0])
            .then(obj => {
                if (obj && obj.common && obj.common.custom && obj.common.custom[this.namespace]) {
                    obj.common.custom[this.namespace] = null;
                    this.props.socket.setObject(this.state.ids[0], obj)
                        .then(() => cb && cb());
                } else {
                    cb && cb();
                }
            });
    }

    onClose() {
        if (this.state.ids.find(id => JSON.stringify(this.originalSettings[id]) !== JSON.stringify(this.state.settings[id]))) {
            this.setState({confirmExit: true});
        } else {
            this.props.onClose();
        }
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

    renderSelectId() {
        if (!this.state.showSelectId) {
            return null;
        }

        return <SelectIDDialog
            statesOnly={true}
            imagePrefix={'../..'}
            showExpertButton={true}
            multiSelect={true}
            notEditable={true}
            dialogName={I18n.t('Define state ID for event list')}
            socket={this.props.socket}
            selected={this.state.ids}
            themeName={this.props.themeName}
            themeType={this.props.themeType}
            onOk={ids => this.updateIds(ids, true)}
            onClose={() => this.setState({showSelectId: false})}
        />;
    }

    onChange(id, newSettings) {
        const settings = JSON.parse(JSON.stringify(this.state.settings));
        settings[id] = JSON.parse(JSON.stringify(newSettings));
        this.setState({settings});
    }

    updateIds(ids, noWait) {
        const newState = {
            ids: ids && typeof ids === 'object' ? ids.filter(id => id && id !== 'true') : (ids || '').split(',').map(id => id.trim()),
        };

        if (!this.state.currentId || !newState.ids.includes(this.state.currentId)) {
            newState.currentId = newState.ids[0] || '';
        }

        this.setState(newState, () => {
            if (this.state.ids.find(id => !this.state.settings[id])) {
                this.readTypeTimer && clearTimeout(this.readTypeTimer);
                this.setState({reading: true});

                this.readTypeTimer = setTimeout(async () => {
                    this.readTypeTimer = null;

                    const newState = {
                        settings: JSON.parse(JSON.stringify(this.state.settings)),
                        exists:   JSON.parse(JSON.stringify(this.state.exists)),
                        reading:  false,
                    }

                    // read all settings of all IDs
                    for (let i = 0; i < this.state.ids.length; i++) {
                        const id = this.state.ids[i];
                        if (!newState.settings[id]) {
                            try {
                                const result = await EditState.readSettingsFromServer(
                                    this.props.socket,
                                    this.props.native.language || I18n.getLanguage(),
                                    this.props.native, this.namespace,
                                    id
                                );

                                this.originalSettings[id] = JSON.parse(JSON.stringify(result.settings));
                                newState.settings[id]     = result.settings;
                                newState.exists[id]       = result.exists;
                            } catch (e) {
                                console.error(e);
                                this.originalSettings[id] = {type: '', name: '', unit: ''};
                                newState.settings[id]     = {type: '', name: '', unit: ''};
                                newState.exists[id]       = false;
                            }
                        }
                    }

                    this.setState(newState);
                }, noWait ? 0 : 500);
            }
        });
    }

    render() {
        const changed = this.state.ids.find(id =>
                !this.state.exists[id] || JSON.stringify(this.originalSettings[id]) !== JSON.stringify(this.state.settings[id]));

        const exists = this.state.ids.find(id => this.state.exists[id]);

        let tabs = null;
        if (this.state.ids.length > 1) {
            tabs =
                <Tabs
                    value={this.state.ids.indexOf(this.state.currentId)}
                    onChange={(event, newValue) => this.setState({currentId: this.state.ids[newValue]})}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    {this.state.ids.map(id => <Tab label={id} />)}
                </Tabs>
        }

        return <Dialog
            open={true}
            onClose={() => this.onClose()}
            aria-labelledby="form-dialog-title"
            fullWidth={true}
            maxWidth="lg"
        >
            <DialogTitle id="form-dialog-title">{this.propsId ? I18n.t('Edit event') : I18n.t('Add event')}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {I18n.t('You can add state to the event list, so the changes will be monitored.')}
                </DialogContentText>
                <div className={this.props.classes.field}>
                    <TextField
                        autoFocus
                        disabled={!!this.propsId}
                        margin="dense"
                        label={I18n.t('State ID')}
                        error={!!(this.state.ids && this.state.unknownId)}
                        className={this.props.classes.textFieldWithButton}
                        value={this.state.ids.join(', ')}
                        onChange={e => this.updateIds(e.target.value)}
                        type="text"
                        fullWidth
                    />
                    {!this.propsId ? <Button
                        style={{marginTop: 8}}
                        variant="contained"
                        color="secondary"
                        onClick={() => this.setState({showSelectId: true})}
                    >...</Button> : null}
                </div>
                {this.state.reading ? <LinearProgress/> : <div style={{height: 4, width: '100%'}}/>}
                {tabs}
                {this.state.settings[this.state.currentId] ? <EditState
                    key={this.state.currentId}
                    id={this.state.currentId}
                    onChange={(id, settings) => this.onChange(id, settings)}
                    instance={this.props.instance}
                    reading={this.state.reading}
                    adapterName={this.props.adapterName}
                    themeName={this.props.themeName}
                    themeType={this.props.themeType}
                    socket={this.props.socket}
                    imagePrefix={this.props.imagePrefix}
                    native={this.props.native}
                    settings={this.state.settings[this.state.currentId]}
                /> : null}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => this.props.onClose()}><CancelIcon className={this.props.classes.buttonIcon}/>{!changed ? I18n.t('Close') : I18n.t('Cancel')}</Button>
                {this.state.exists[this.state.currentId] && this.state.ids.length === 1 ? <Button
                    onClick={() => this.setState({confirmRemove: true})}
                ><RemoveIcon className={this.props.classes.buttonIcon}/>{I18n.t('Remove')}</Button> : null}
                <Button
                    disabled={!this.state.ids.length || !changed}
                    onClick={() =>
                        this.writeSettings([...this.state.ids], () =>
                            this.props.onClose())
                    }
                    color="primary"
                ><SaveIcon className={this.props.classes.buttonIcon}/>{exists ? I18n.t('Update') : I18n.t('Add')}</Button>
            </DialogActions>
            {this.renderConfirmExit()}
            {this.renderConfirmRemove()}
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
    imagePrefix: PropTypes.string,
};

export default withStyles(styles)(AddIdDialog);