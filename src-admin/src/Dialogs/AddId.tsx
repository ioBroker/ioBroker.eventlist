import React, { Component, type JSX } from 'react';

import {
    Button,
    TextField,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Tabs,
    Tab,
    LinearProgress,
} from '@mui/material';

import { Cancel as CancelIcon, Save as SaveIcon } from '@mui/icons-material';
import { FaEraser as RemoveIcon } from 'react-icons/fa';

import {
    I18n,
    Confirm as ConfirmDialog,
    SelectID,
    type AdminConnection,
    type IobTheme,
    type ThemeName,
    type ThemeType,
} from '@iobroker/gui-components';

import EditStateComponent, { EditState } from '../Components/EditState';
import type { EditStateSettings, EventListNative } from '../types';

const DEFAULT_TEMPLATE = 'default';

/** Settings used if the object could not be read */
const EMPTY_SETTINGS: EditStateSettings = {
    type: '',
    name: '',
    unit: '',
    whatsAppCMB: [],
    pushover: [],
    telegram: [],
    event: '',
    icon: '',
    color: '',
    alarmsOnly: false,
    messagesInAlarmsOnly: false,
};

/** Settings used for new states that were not edited */
const DEFAULT_SETTINGS: EditStateSettings = {
    ...EMPTY_SETTINGS,
    event: DEFAULT_TEMPLATE,
    changesOnly: true,
    defaultMessengers: true,
};

interface AddIdDialogProps {
    instance: number;
    adapterName: string;
    onClose: () => void;
    themeName?: ThemeName;
    themeType?: ThemeType;
    socket: AdminConnection;
    native: EventListNative;
    /** ID of the state to edit. If empty, the dialog is used to add new states */
    id?: string;
    imagePrefix?: string;
    theme: IobTheme;
}

interface AddIdDialogState {
    ids: string[];
    currentId: string;
    showSelectId: boolean;
    /** Does the settings already exist on the server (by ID) */
    exists: Record<string, boolean>;
    settings: Record<string, EditStateSettings>;
    confirmExit: boolean;
    confirmRemove: boolean;
    reading: boolean;
}

class AddIdDialog extends Component<AddIdDialogProps, AddIdDialogState> {
    private readonly propsId: string;
    private readonly namespace: string;
    private originalSettings: Record<string, EditStateSettings> = {};
    private readTypeTimer: ReturnType<typeof setTimeout> | null = null;
    private initTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: AddIdDialogProps) {
        super(props);

        this.propsId = this.props.id !== 'true' ? this.props.id || '' : '';

        this.state = {
            ids: [],
            currentId: this.propsId,
            showSelectId: !this.propsId,
            exists: {},
            settings: {},
            confirmExit: false,
            confirmRemove: false,
            reading: false,
        };

        this.namespace = `${this.props.adapterName}.${this.props.instance}`;
    }

    componentDidMount(): void {
        this.initTimer = setTimeout(() => {
            this.initTimer = null;
            this.updateIds(this.propsId, true);
        }, 100);
    }

    componentWillUnmount(): void {
        if (this.initTimer) {
            clearTimeout(this.initTimer);
            this.initTimer = null;
        }
        if (this.readTypeTimer) {
            clearTimeout(this.readTypeTimer);
            this.readTypeTimer = null;
        }
    }

    async writeSettings(ids: string[]): Promise<void> {
        for (const id of ids) {
            const obj = await this.props.socket.getObject(id);
            const common = obj?.common as ioBroker.StateCommon | undefined;
            if (obj && common) {
                common.custom ||= {};
                const newSettings = EditState.getSettings(this.state.settings[id] || DEFAULT_SETTINGS);
                // if changed
                if (JSON.stringify(newSettings) !== JSON.stringify(common.custom[this.namespace])) {
                    common.custom[this.namespace] = newSettings;
                    await this.props.socket.setObject(obj._id, obj);
                }
            }
        }
    }

    async removeSettings(): Promise<void> {
        const id = this.state.ids[0];
        const obj = await this.props.socket.getObject(id);
        const common = obj?.common as ioBroker.StateCommon | undefined;
        if (obj && common?.custom?.[this.namespace]) {
            common.custom[this.namespace] = null;
            await this.props.socket.setObject(id, obj);
        }
    }

    onClose(): void {
        if (
            this.state.ids.find(
                id => JSON.stringify(this.originalSettings[id]) !== JSON.stringify(this.state.settings[id]),
            )
        ) {
            this.setState({ confirmExit: true });
        } else {
            this.props.onClose();
        }
    }

    renderConfirmExit(): JSX.Element | null {
        if (!this.state.confirmExit) {
            return null;
        }
        return (
            <ConfirmDialog
                title={I18n.t('Changes not saved.')}
                text={I18n.t('All changes will be lost. Exit?')}
                ok={I18n.t('Yes')}
                cancel={I18n.t('No')}
                onClose={isYes => {
                    this.setState({ confirmExit: false });
                    if (isYes) {
                        this.props.onClose();
                    }
                }}
            />
        );
    }

    renderConfirmRemove(): JSX.Element | null {
        if (!this.state.confirmRemove) {
            return null;
        }
        return (
            <ConfirmDialog
                title={I18n.t('Settings will be erased.')}
                text={I18n.t('The state will be removed from event list and all settings erased. Are you sure?')}
                ok={I18n.t('Remove from list')}
                cancel={I18n.t('Cancel')}
                onClose={isYes => {
                    this.setState({ confirmRemove: false });
                    if (isYes) {
                        void this.removeSettings();
                        this.props.onClose();
                    }
                }}
            />
        );
    }

    renderSelectId(): JSX.Element | null {
        if (!this.state.showSelectId) {
            return null;
        }

        return (
            <SelectID
                theme={this.props.theme}
                types="state"
                imagePrefix={this.props.imagePrefix}
                showExpertButton
                multiSelect
                notEditable
                dialogName="eventlist-add-id"
                title={I18n.t('Define state ID for event list')}
                socket={this.props.socket}
                selected={this.state.ids}
                themeName={this.props.themeName}
                themeType={this.props.themeType}
                onOk={ids => this.updateIds(ids, true)}
                onClose={() => this.setState({ showSelectId: false })}
            />
        );
    }

    onChange(id: string, newSettings: EditStateSettings): void {
        const settings: Record<string, EditStateSettings> = JSON.parse(JSON.stringify(this.state.settings));
        settings[id] = JSON.parse(JSON.stringify(newSettings));
        this.setState({ settings });
    }

    async readSettings(): Promise<void> {
        const settings: Record<string, EditStateSettings> = JSON.parse(JSON.stringify(this.state.settings));
        const exists: Record<string, boolean> = { ...this.state.exists };

        // read all settings of all IDs
        for (const id of this.state.ids) {
            if (!settings[id]) {
                try {
                    const result = await EditState.readSettingsFromServer(
                        this.props.socket,
                        this.props.native.language || I18n.getLanguage(),
                        this.props.native,
                        this.namespace,
                        id,
                    );

                    this.originalSettings[id] = JSON.parse(JSON.stringify(result.settings));
                    settings[id] = result.settings;
                    exists[id] = result.exists;
                } catch (e) {
                    console.error(e);
                    this.originalSettings[id] = { ...EMPTY_SETTINGS };
                    settings[id] = { ...EMPTY_SETTINGS };
                    exists[id] = false;
                }
            }
        }

        this.setState({ settings, exists, reading: false });
    }

    updateIds(ids: string | string[] | undefined, noWait?: boolean): void {
        const newIds = Array.isArray(ids)
            ? ids.filter(id => id && id !== 'true')
            : (ids || '').split(',').map(id => id.trim());

        const currentId =
            !this.state.currentId || !newIds.includes(this.state.currentId) ? newIds[0] || '' : this.state.currentId;

        this.setState({ ids: newIds, currentId }, () => {
            if (this.state.ids.find(id => !this.state.settings[id])) {
                if (this.readTypeTimer) {
                    clearTimeout(this.readTypeTimer);
                }
                this.setState({ reading: true });

                this.readTypeTimer = setTimeout(
                    () => {
                        this.readTypeTimer = null;
                        void this.readSettings();
                    },
                    noWait ? 0 : 500,
                );
            }
        });
    }

    render(): JSX.Element {
        const changed = !!this.state.ids.find(
            id =>
                !this.state.exists[id] ||
                JSON.stringify(this.originalSettings[id]) !== JSON.stringify(this.state.settings[id]),
        );

        const exists = !!this.state.ids.find(id => this.state.exists[id]);

        let tabs: JSX.Element | null = null;
        if (this.state.ids.length > 1) {
            tabs = (
                <Tabs
                    value={this.state.ids.indexOf(this.state.currentId)}
                    onChange={(_event, newValue: number) => this.setState({ currentId: this.state.ids[newValue] })}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    {this.state.ids.map(id => (
                        <Tab
                            key={id}
                            label={id}
                        />
                    ))}
                </Tabs>
            );
        }

        const currentSettings = this.state.settings[this.state.currentId];

        return (
            <Dialog
                open={!0}
                onClose={() => this.onClose()}
                aria-labelledby="form-dialog-title"
                fullWidth
                maxWidth="lg"
            >
                <DialogTitle id="form-dialog-title">
                    {this.propsId ? I18n.t('Edit event') : I18n.t('Add event')}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {I18n.t('You can add state to the event list, so the changes will be monitored.')}
                    </DialogContentText>
                    <div style={{ width: '100%' }}>
                        <TextField
                            variant="standard"
                            autoFocus
                            disabled={!!this.propsId}
                            margin="dense"
                            label={I18n.t('State ID')}
                            style={{ width: 'calc(100% - 70px)' }}
                            value={this.state.ids.join(', ')}
                            onChange={e => this.updateIds(e.target.value)}
                            type="text"
                            fullWidth
                        />
                        {!this.propsId ? (
                            <Button
                                style={{ marginTop: 8 }}
                                variant="contained"
                                color="secondary"
                                onClick={() => this.setState({ showSelectId: true })}
                            >
                                ...
                            </Button>
                        ) : null}
                    </div>
                    {this.state.reading ? <LinearProgress /> : <div style={{ height: 4, width: '100%' }} />}
                    {tabs}
                    {currentSettings ? (
                        <EditStateComponent
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
                            settings={currentSettings}
                        />
                    ) : null}
                </DialogContent>
                <DialogActions>
                    {this.state.exists[this.state.currentId] && this.state.ids.length === 1 ? (
                        <Button
                            color="grey"
                            onClick={() => this.setState({ confirmRemove: true })}
                            variant="contained"
                            startIcon={<RemoveIcon />}
                        >
                            {I18n.t('Remove')}
                        </Button>
                    ) : null}
                    <Button
                        disabled={!this.state.ids.length || !changed}
                        variant="contained"
                        onClick={() => void this.writeSettings([...this.state.ids]).then(() => this.props.onClose())}
                        startIcon={<SaveIcon />}
                        color="primary"
                    >
                        {exists ? I18n.t('Update') : I18n.t('Add')}
                    </Button>
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
            </Dialog>
        );
    }
}

export default AddIdDialog;
