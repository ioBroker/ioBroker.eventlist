import React, { Component, type CSSProperties, type JSX } from 'react';

import {
    Button,
    TextField,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';

import { Cancel as CancelIcon, Add as AddIcon, Close as ClearIcon } from '@mui/icons-material';

import { I18n, Utils, type AdminConnection } from '@iobroker/gui-components';

const styles: Record<string, CSSProperties> = {
    icon: {
        width: 32,
        maxHeight: 32,
    },
    emptyIcon: {
        marginRight: 8,
    },
    listSecondary: {
        opacity: 0.7,
        fontStyle: 'italic',
        fontSize: 'smaller',
    },
    flex: {
        flex: 1,
    },
    dialogTitle: {
        display: 'flex',
    },
};

const sxListItem = (theme: Theme): Record<string, any> => ({
    padding: '3px',
    '&:hover': {
        background: theme.palette.mode === 'dark' ? theme.palette.primary.dark : theme.palette.primary.light,
    },
});

function getSelectIdIcon(obj: ioBroker.Object, prefix?: string): string | null {
    prefix ||= '.'; // http://localhost:8081';
    let src = '';
    const id = obj._id.replace('system.adapter.', '');
    const adapter = id.split('.')[0];

    const aIcon = obj?.common?.icon;
    if (aIcon) {
        // if not BASE64
        if (!aIcon.startsWith('data:image/')) {
            if (aIcon.includes('.')) {
                src = `${prefix}/adapter/${adapter}/${aIcon}`;
            } else {
                return null; // '<i class="material-icons iob-list-icon">' + obj.common.icon + '</i>';
            }
        } else {
            src = aIcon;
        }
    }

    return src || null;
}

interface SelectStateDialogProps {
    /** Called with the selected ID, with `true` to add new states, or without arguments if canceled */
    onClose: (id?: string | true) => void;
    socket: AdminConnection;
    adapterName: string;
    instance: number;
    imagePrefix?: string;
}

interface SelectStateDialogState {
    /** IDs of all states that are already in the event list */
    ids: string[];
    filter: string;
    /** Loaded objects by ID */
    objects: Record<string, ioBroker.Object>;
}

class SelectStateDialog extends Component<SelectStateDialogProps, SelectStateDialogState> {
    private readonly promises: Record<string, Promise<void>> = {};

    constructor(props: SelectStateDialogProps) {
        super(props);

        this.state = {
            ids: [],
            filter: '',
            objects: {},
        };
    }

    componentDidMount(): void {
        void this.readIds().then(ids => this.setState({ ids }));
    }

    async readIds(): Promise<string[]> {
        const objects = (await this.props.socket.getObjectViewCustom('custom', 'state', '', '香')) as unknown as Record<
            string,
            Record<string, unknown> | null | undefined
        >;
        const namespace = `${this.props.adapterName}.${this.props.instance || 0}`;
        const ids: string[] = [];
        Object.keys(objects).forEach(id => {
            if (objects[id]?.[namespace]) {
                ids.push(id);
            }
        });

        return ids;
    }

    async getObject(id: string): Promise<void> {
        const obj = await this.props.socket.getObject(id);
        if (obj) {
            this.setState(prevState => ({ objects: { ...prevState.objects, [obj._id]: obj } }));
        }
    }

    renderListItem(id: string, filter: string): JSX.Element | null {
        const obj = this.state.objects[id];
        if (obj) {
            const name = Utils.getObjectNameFromObj(obj, I18n.getLanguage()) || id;
            if (filter && !id.toLowerCase().includes(filter) && !name.toLowerCase().includes(filter)) {
                return null;
            }

            const icon = getSelectIdIcon(obj, this.props.imagePrefix);
            return (
                <ListItemButton
                    onClick={() => this.props.onClose(id)}
                    key={id}
                    sx={sxListItem}
                >
                    <ListItemIcon>
                        {icon ? (
                            <img
                                src={icon}
                                style={styles.icon}
                                alt="state"
                            />
                        ) : (
                            <div style={styles.emptyIcon}>&nbsp;</div>
                        )}
                    </ListItemIcon>
                    <ListItemText
                        primary={name}
                        secondary={id !== name ? id : ''}
                        sx={{
                            '& .MuiListItemText-secondary': styles.listSecondary,
                        }}
                    />
                </ListItemButton>
            );
        }
        this.promises[id] ||= this.getObject(id);
        if (filter && !id.toLowerCase().includes(filter)) {
            return null;
        }
        return (
            <ListItemButton
                onClick={() => this.props.onClose(id)}
                key={id}
                sx={sxListItem}
            >
                <ListItemIcon>
                    <div style={styles.emptyIcon}>&nbsp;</div>
                </ListItemIcon>
                <ListItemText primary={id} />
            </ListItemButton>
        );
    }

    render(): JSX.Element {
        const filter = this.state.filter.toLowerCase();
        return (
            <Dialog
                open={!0}
                fullWidth
                maxWidth="md"
                onClose={() => this.props.onClose()}
            >
                <DialogTitle style={styles.dialogTitle}>
                    <div style={{ marginRight: 20, marginTop: 5 }}>{I18n.t('Select state')}</div>
                    <TextField
                        variant="standard"
                        style={styles.flex}
                        label={I18n.t('Filter')}
                        slotProps={{
                            inputLabel: { shrink: true },
                            input: {
                                endAdornment: this.state.filter ? (
                                    <IconButton onClick={() => this.setState({ filter: '' })}>
                                        <ClearIcon />
                                    </IconButton>
                                ) : undefined,
                            },
                        }}
                        autoFocus
                        value={this.state.filter}
                        onChange={e => this.setState({ filter: e.target.value })}
                        fullWidth
                        size="small"
                    />
                </DialogTitle>
                <DialogContent>
                    <List dense>
                        {!filter && (
                            <ListItemButton onClick={() => this.props.onClose(true)}>
                                <Button
                                    color="grey"
                                    variant="contained"
                                >
                                    <AddIcon />
                                    {I18n.t('Add new states')}
                                </Button>
                            </ListItemButton>
                        )}
                        {this.state.ids.map(item => this.renderListItem(item, filter))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => this.props.onClose()}
                        color="primary"
                        variant="contained"
                        startIcon={<CancelIcon />}
                    >
                        {I18n.t('Cancel')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default SelectStateDialog;
