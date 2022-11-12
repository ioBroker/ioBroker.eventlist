import React, {Component} from 'react';
import { withStyles } from '@mui/styles';
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

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import { FaEraser as RemoveIcon } from 'react-icons/fa';

import I18n from '@iobroker/adapter-react-v5/i18n';
import ConfirmDialog from '@iobroker/adapter-react-v5/Dialogs/Confirm';
import EditStateComponent, { EditState } from '../Components/EditState';
import SelectIDDialog from '@iobroker/adapter-react-v5/Dialogs/SelectID';
import LinearProgress from '@mui/material/LinearProgress';

const DEFAULT_TEMPLATE = 'default';

const styles = () => ({
    textFieldWithButton: {
        width: 'calc(100% - 70px)',
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
            imagePrefix={this.props.imagePrefix}
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
                        variant="standard"
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
                        style={{ marginTop: 8 }}
                        variant="contained"
                        color="secondary"
                        onClick={() => this.setState({showSelectId: true})}
                    >...</Button> : null}
                </div>
                {this.state.reading ? <LinearProgress/> : <div style={{height: 4, width: '100%'}}/>}
                {tabs}
                {this.state.settings[this.state.currentId] ? <EditStateComponent
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
                {this.state.exists[this.state.currentId] && this.state.ids.length === 1 ? <Button
                    color="grey"
                    onClick={() => this.setState({confirmRemove: true})}
                    variant="contained"
                    startIcon={<RemoveIcon />}
                >{I18n.t('Remove')}</Button> : null}
                <Button
                    disabled={!this.state.ids.length || !changed}
                    variant="contained"
                    onClick={() =>
                        this.writeSettings([...this.state.ids], () =>
                            this.props.onClose())
                    }
                    startIcon={<SaveIcon />}
                    color="primary"
                >{exists ? I18n.t('Update') : I18n.t('Add')}</Button>
                <Button
                    color="grey"
                    onClick={() => this.props.onClose()}
                    startIcon={<CancelIcon />}
                    variant="contained"
                >
                    {!changed ? I18n.t('Close') : I18n.t('Cancel')}
                </Button>
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