import React, { Component, type ComponentType, type CSSProperties, type JSX } from 'react';
import { lighten, type Theme } from '@mui/material/styles';

import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Toolbar,
    Typography,
    Paper,
    Checkbox,
    IconButton,
    Tooltip,
    Fab,
    Snackbar,
    LinearProgress,
    CircularProgress,
    MenuItem,
    ListItemText,
    Select,
    type SelectChangeEvent,
} from '@mui/material';

import {
    Refresh as IconReload,
    Close as IconClose,
    QuestionAnswer as IconQuestion,
    Add as IconAddEvent,
    Edit as IconEdit,
    Delete as DeleteIcon,
    Event as IconEvent,
} from '@mui/icons-material';

import { FaFilePdf as IconPdf } from 'react-icons/fa';

import {
    I18n,
    Utils,
    Image,
    Router,
    withWidth,
    Confirm as ConfirmDialog,
    type AdminConnection,
    type IobTheme,
    type ThemeName,
    type ThemeType,
    type Width,
} from '@iobroker/gui-components';

import AddEventDialog from '../Dialogs/AddEvent';
import AddIdDialog from '../Dialogs/AddId';
import SelectStateDialog from '../Dialogs/SelectState';
import type { EventListNative, FormattedEvent, RawEvent } from '../types';

// Copyright Apache 2.0 https://raw.githubusercontent.com/material-icons/material-icons/master/svg/filter_alt/baseline.svg
// https://github.com/material-icons/material-icons/blob/master/LICENSE
function IconFilter(props: { style?: CSSProperties }): JSX.Element {
    return (
        <svg
            viewBox="0 0 24 24"
            width={24}
            height={24}
            xmlns="http://www.w3.org/2000/svg"
            style={props.style}
        >
            <path
                fill="currentColor"
                stroke="currentColor"
                d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0 0 18.95 4H5.04c-.83 0-1.3.95-.79 1.61z"
            />
        </svg>
    );
}

const COLOR_RUNNING_DURATION = '#59be78';

const styles: Record<string, CSSProperties> = {
    tab: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    instanceNotOnline: {
        color: '#883333',
        marginLeft: 8,
    },
    toolbarRoot: {
        paddingLeft: 16,
        paddingRight: 8,
    },
    toolbarTitle: {
        flex: '1 1 100%',
    },
    toolbarButton: {
        marginRight: 8,
    },
    visuallyHidden: {
        border: 0,
        clip: 'rect(0 0 0 0)',
        height: 1,
        margin: -1,
        overflow: 'hidden',
        padding: 0,
        position: 'absolute',
        top: 20,
        width: 1,
    },
    tableContainer: {
        height: '100%',
        overflow: 'auto',
    },
    table: {
        width: 'auto',
    },
    tdIcons: {
        textAlign: 'right',
        marginRight: 8,
        marginTop: 2,
    },
    tdTs: {
        paddingRight: 8,
    },
    tdEvent: {
        paddingRight: 8,
    },
    tdVal: {},
    tdDuration: {},
    tdID: {
        opacity: 0.3,
    },
    tdEdit: {},
    toolbarButtonText: {
        whiteSpace: 'nowrap',
        marginLeft: 16,
        marginRight: 16,
        lineHeight: 24,
        display: 'inline-block',
    },
    tabMargins: {
        paddingLeft: 16,
    },
    filterControl: {
        minWidth: 200,
        marginRight: 8,
        marginLeft: 3,
    },
    filterDiv: {
        position: 'relative',
        display: 'inline-block',
        cursor: 'pointer',
    },
    filterIcon: {},
    filterClearIcon: {
        color: '#FF0000',
        position: 'absolute',
        top: 0,
        left: 0,
        width: 24,
        height: 24,
        opacity: 0.5,
    },
    filterCounts: {
        fontSize: 10,
        opacity: 0.7,
        float: 'right',
        marginTop: 16,
    },
    filterSecondary: {
        opacity: 0.7,
        fontSize: 'smaller',
    },
};

const sxToolbarHighlight = (theme: Theme): { color: string; backgroundColor: string } =>
    theme.palette.mode === 'light'
        ? {
              color: theme.palette.secondary.main,
              backgroundColor: lighten(theme.palette.secondary.light, 0.85),
          }
        : {
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.secondary.dark,
          };

const sxEditButton = {
    height: 22,
    width: 22,
    opacity: 0.3,
    '&:hover': {
        opacity: 1,
    },
};

const sxButtonAddState = {
    minWidth: '120px !important',
};

const sxDurationRunning = {
    animationName: 'running',
    animationDuration: '2s',
    animationIterationCount: 'infinite',
};

type SortKey = 'ts' | 'event' | 'val';
type Order = 'asc' | 'desc';

interface HeadCell {
    id: SortKey | 'icon';
    label?: string;
    align?: 'left' | 'right' | 'center';
}

const HEAD_STYLES: Record<SortKey, CSSProperties> = {
    ts: styles.tdTs,
    event: styles.tdEvent,
    val: styles.tdVal,
};

interface StateIdItem {
    id: string;
    name?: string;
    count?: number;
}

interface ListProps {
    /** Is the editing of the list possible at all */
    editAvailable?: boolean;
    /** Is the edit mode enabled by default */
    editEnabled?: boolean;
    /** Show the button to toggle the edit mode */
    showEditButton?: boolean;
    instance: number;
    adapterName: string;
    socket: AdminConnection;
    themeName?: ThemeName;
    themeType?: ThemeType;
    theme: IobTheme;
    native: EventListNative;
    imagePrefix?: string;
    isWeb?: boolean;
    name?: ioBroker.StringOrTranslated;
    onError?: (text: string) => void;
    /** Provided by withWidth */
    width?: Width;
}

interface ListState {
    toast: string;
    isInstanceAlive: boolean;
    /** Formatted event list or null if not loaded yet */
    eventList: FormattedEvent[] | null;
    /** Raw event list or null if not loaded yet */
    eventRawList: RawEvent[] | null;
    order: Order;
    orderBy: SortKey;
    /** Show only events of these state IDs */
    filterStates: string[];
    /** Selected events (by `_id`, which is the timestamp) */
    selected: number[];
    showDeleteConfirm: boolean;
    showSelectState: boolean;
    /** false - do not show, true - show for new IDs, string - show for this ID */
    showAddIdDialog: string | boolean;
    showAddEventDialog: boolean;
    /** State ID of the only selected event */
    selectedId: string;
    editEnabled: boolean;
    editAvailable: boolean;
    pdfInGeneration: boolean;
    /** All state IDs that are in the event list (for the filter) or null if not loaded yet */
    stateIds: StateIdItem[] | null;
}

class List extends Component<ListProps, ListState> {
    private readonly imagePrefix?: string;
    private readonly aliveId: string;
    private readonly eventListId: string;
    private readonly eventRawListId: string;
    private readonly triggerPDFId: string;
    private readonly headCells: HeadCell[];

    constructor(props: ListProps) {
        super(props);

        const storageKey = `${props.adapterName}-${props.instance || 0}-adapter`;
        const storedEditEnabled = window.localStorage.getItem(`${storageKey}.editEnabled`) || null;
        const editAvailable = props.editAvailable !== undefined ? props.editAvailable : true;

        let filterStates: string[];
        try {
            const stored = window.localStorage.getItem(`${storageKey}.filterStates`);
            filterStates = stored ? JSON.parse(stored) : [];
        } catch {
            filterStates = [];
        }

        let editEnabled: boolean;
        if (!editAvailable) {
            editEnabled = false;
        } else if (!props.showEditButton || storedEditEnabled === null) {
            editEnabled = props.editEnabled !== undefined ? props.editEnabled : true;
        } else {
            editEnabled = storedEditEnabled !== 'false';
        }

        const location = Router.getLocation();

        this.state = {
            toast: '',
            isInstanceAlive: false,
            eventList: null,
            eventRawList: null,
            order: 'desc',
            orderBy: 'ts',
            filterStates,
            selected: [],
            showDeleteConfirm: false,
            showSelectState: location.dialog === 'selectState',
            showAddIdDialog: location.dialog === 'addId' ? location.id || true : false,
            showAddEventDialog: location.dialog === 'addEvent',
            selectedId: '',
            editEnabled,
            editAvailable,
            pdfInGeneration: false,
            stateIds: null,
        };

        this.imagePrefix = this.props.imagePrefix; // by default is admin
        this.aliveId = `system.adapter.${this.props.adapterName}.${this.props.instance}.alive`;
        this.eventListId = `${this.props.adapterName}.${this.props.instance}.eventJSONList`;
        this.eventRawListId = `${this.props.adapterName}.${this.props.instance}.eventListRaw`;
        this.triggerPDFId = `${this.props.adapterName}.${this.props.instance}.triggerPDF`;

        this.headCells = [
            { id: 'ts', label: I18n.t('Time'), align: 'right' },
            { id: 'icon' },
            { id: 'event', label: I18n.t('Event'), align: 'center' },
            { id: 'val', label: I18n.t('Value'), align: 'left' },
        ];
    }

    static parseList<T>(state: ioBroker.State | null | undefined): T[] {
        try {
            return state?.val ? JSON.parse(state.val as string) : [];
        } catch {
            return [];
        }
    }

    /** Take the state IDs from the raw list and store them in the formatted list */
    static mergeStateIds(eventList: FormattedEvent[], eventRawList: RawEvent[] | null): void {
        if (!eventRawList) {
            return;
        }
        eventList.forEach(item => {
            const raw = eventRawList.find(it => it.ts === item._id);
            if (raw) {
                item.stateId = raw.id;
            }
        });
    }

    async readStatus(): Promise<void> {
        const aliveState = await this.props.socket.getState(this.aliveId);
        const state = await this.props.socket.getState(this.eventListId);
        const rawState = await this.props.socket.getState(this.eventRawListId);

        const eventList = List.parseList<FormattedEvent>(state);
        const eventRawList = List.parseList<RawEvent>(rawState);

        // merge together
        List.mergeStateIds(eventList, eventRawList);

        await new Promise<void>(resolve =>
            this.setState({ isInstanceAlive: !!aliveState?.val, eventList, eventRawList }, resolve),
        );
    }

    componentDidMount(): void {
        void this.readStatus().then(() => {
            void this.props.socket.subscribeState(this.aliveId, this.onStateChanged);
            void this.props.socket.subscribeState(this.eventListId, this.onStateChanged);
            void this.props.socket.subscribeState(this.eventRawListId, this.onStateChanged);
            void this.props.socket.subscribeState(this.triggerPDFId, this.onStateChanged);
        });
    }

    componentWillUnmount(): void {
        this.props.socket.unsubscribeState(this.aliveId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.eventListId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.eventRawListId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.triggerPDFId, this.onStateChanged);
    }

    onStateChanged = (id: string, state: ioBroker.State | null | undefined): void => {
        if (id === this.aliveId) {
            this.setState({ isInstanceAlive: !!state?.val });
        }
        if (id === this.triggerPDFId) {
            this.setState({ pdfInGeneration: !!state?.val });
        } else if (id === this.eventListId) {
            const eventList = List.parseList<FormattedEvent>(state);
            // merge together
            List.mergeStateIds(eventList, this.state.eventRawList);
            this.setState({ eventList });
        } else if (id === this.eventRawListId) {
            const eventRawList = List.parseList<RawEvent>(state);
            // merge together
            let eventList: FormattedEvent[] | null = null;
            this.state.eventList?.forEach((item, i) => {
                if (!item.stateId) {
                    const raw = eventRawList.find(it => it.ts === item._id);
                    if (raw) {
                        eventList = eventList || JSON.parse(JSON.stringify(this.state.eventList));
                        (eventList as FormattedEvent[])[i].stateId = raw.id;
                    }
                }
            });
            if (eventList) {
                this.setState({ eventRawList, eventList });
            } else {
                this.setState({ eventRawList });
            }
        }
    };

    renderToast(): JSX.Element | null {
        if (!this.state.toast) {
            return null;
        }
        return (
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open={!0}
                autoHideDuration={6000}
                onClose={() => this.setState({ toast: '' })}
                slotProps={{
                    content: {
                        'aria-describedby': 'message-id',
                    },
                }}
                message={<span id="message-id">{this.state.toast}</span>}
                action={[
                    <IconButton
                        key="close"
                        aria-label="Close"
                        color="inherit"
                        onClick={() => this.setState({ toast: '' })}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />
        );
    }

    onRequestSort(property: SortKey): void {
        const isAsc = this.state.orderBy === property && this.state.order === 'asc';
        this.setState({ order: isAsc ? 'desc' : 'asc', orderBy: property });
    }

    renderHeader(eventList: FormattedEvent[]): JSX.Element {
        return (
            <TableHead>
                <TableRow>
                    {this.state.isInstanceAlive && this.state.editAvailable && this.state.editEnabled && (
                        <TableCell padding="checkbox">
                            <Checkbox
                                indeterminate={
                                    !!this.state.selected.length && this.state.selected.length < eventList.length
                                }
                                checked={eventList.length > 0 && this.state.selected.length === eventList.length}
                                disabled={!eventList.length}
                                onChange={e => {
                                    if (e.target.checked) {
                                        const selected = eventList.map(n => n._id);
                                        const selectedId =
                                            selected.length === 1
                                                ? eventList.find(item => item._id === selected[0])?.stateId || ''
                                                : '';
                                        this.setState({ selected, selectedId });
                                    } else {
                                        this.setState({ selected: [], selectedId: '' });
                                    }
                                }}
                                slotProps={{
                                    input: { 'aria-label': 'select all events' },
                                }}
                            />
                        </TableCell>
                    )}
                    {this.headCells.map(cell =>
                        cell.id === 'icon' ? (
                            this.props.native.icons ? (
                                <TableCell
                                    key={cell.id}
                                    component="th"
                                    style={styles.tdIcons}
                                    align="left"
                                    padding="none"
                                />
                            ) : null
                        ) : (
                            <TableCell
                                key={cell.id}
                                style={HEAD_STYLES[cell.id]}
                                align={cell.align}
                                padding="none"
                                component="th"
                                sortDirection={this.state.orderBy === cell.id ? this.state.order : false}
                            >
                                <TableSortLabel
                                    active={this.state.orderBy === cell.id}
                                    direction={this.state.orderBy === cell.id ? this.state.order : 'asc'}
                                    onClick={() => this.onRequestSort(cell.id as SortKey)}
                                >
                                    {cell.label}
                                    {this.state.orderBy === cell.id ? (
                                        <span style={styles.visuallyHidden}>
                                            {this.state.order === 'desc'
                                                ? I18n.t('sorted descending')
                                                : I18n.t('sorted ascending')}
                                        </span>
                                    ) : null}
                                </TableSortLabel>
                            </TableCell>
                        ),
                    )}
                    {this.props.native.duration ? (
                        <TableCell
                            style={styles.tdDuration}
                            component="th"
                            padding="none"
                            align="right"
                        >
                            {I18n.t('Duration')}
                        </TableCell>
                    ) : null}
                    {this.state.editAvailable && this.state.editEnabled && (
                        <TableCell
                            style={styles.tdID}
                            align="left"
                        >
                            State ID
                        </TableCell>
                    )}
                    {this.state.editAvailable && this.state.editEnabled && (
                        <TableCell
                            style={styles.tdEdit}
                            align="left"
                        />
                    )}
                </TableRow>
            </TableHead>
        );
    }

    triggerPdf(): void {
        if (this.state.isInstanceAlive) {
            void this.props.socket
                .sendTo(`${this.props.adapterName}.${this.props.instance}`, 'pdf', this.props.native.pdfSettings)
                .then(() => {
                    let myWindow: Window | null;
                    if (!window.location.pathname.includes('adapter/')) {
                        myWindow = window.open(`/eventlist/report.pdf?q=${Date.now()}`, 'pdf');
                    } else {
                        myWindow = window.open(`/files/eventlist/report.pdf?q=${Date.now()}`, 'pdf');
                    }

                    myWindow?.focus();
                });
        }
    }

    async readIds(): Promise<StateIdItem[]> {
        const objects = (await this.props.socket.getObjectViewCustom('custom', 'state', '', '香')) as unknown as Record<
            string,
            Record<string, unknown> | null | undefined
        >;
        const namespace = `${this.props.adapterName}.${this.props.instance || 0}`;
        const ids: StateIdItem[] = [];
        const allIds = Object.keys(objects);
        for (let i = 0; i < allIds.length; i++) {
            const id = allIds[i];
            if (objects[id]?.[namespace]) {
                try {
                    const obj = await this.props.socket.getObject(id);
                    if (obj) {
                        let count = 0;
                        // count states
                        this.state.eventList?.forEach(item => item.id === obj._id && count++);
                        ids.push({
                            id: obj._id,
                            name: Utils.getObjectNameFromObj(obj, I18n.getLanguage()),
                            count,
                        });
                    } else {
                        ids.push({ id });
                    }
                } catch {
                    ids.push({ id });
                }
            }
        }
        ids.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
        return ids;
    }

    renderFilter(): JSX.Element {
        return (
            <>
                <div
                    style={styles.filterDiv}
                    title={I18n.t('Clear filter')}
                    onClick={() => {
                        window.localStorage.setItem(
                            `${this.props.adapterName}-${this.props.instance || 0}-adapter.filterStates`,
                            '',
                        );
                        this.setState({ filterStates: [] });
                    }}
                >
                    <IconFilter style={styles.filterIcon} />
                    {this.state.filterStates.length ? <IconClose style={styles.filterClearIcon} /> : null}
                </div>
                <Select
                    variant="standard"
                    style={styles.filterControl}
                    multiple
                    label={I18n.t('Filter by ID')}
                    value={this.state.filterStates}
                    onChange={(event: SelectChangeEvent<string[]>) => {
                        const value = event.target.value;
                        const filterStates = typeof value === 'string' ? value.split(',') : value;
                        window.localStorage.setItem(
                            `${this.props.adapterName}-${this.props.instance || 0}-adapter.filterStates`,
                            JSON.stringify(filterStates),
                        );
                        this.setState({ filterStates });
                    }}
                    onOpen={() => void this.readIds().then(ids => this.setState({ stateIds: ids }))}
                    renderValue={(selected: string[]) => (selected.length === 1 ? selected[0] : selected.length)}
                >
                    {!this.state.stateIds ? (
                        <MenuItem>
                            <CircularProgress />
                        </MenuItem>
                    ) : (
                        this.state.stateIds.map(item => (
                            <MenuItem
                                key={item.id}
                                value={item.id}
                            >
                                <Checkbox checked={this.state.filterStates.includes(item.id)} />
                                <ListItemText
                                    primary={
                                        <span>
                                            {item.name} <span style={styles.filterCounts}>{item.count}</span>
                                        </span>
                                    }
                                    secondary={item.id}
                                    sx={{ '& .MuiListItemText-secondary': styles.filterSecondary }}
                                />
                            </MenuItem>
                        ))
                    )}
                </Select>
            </>
        );
    }

    renderToolbar(): JSX.Element {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm';
        let name: string;
        if (this.props.name && typeof this.props.name === 'object') {
            name = this.props.name[I18n.getLanguage()] || this.props.name.en || I18n.t('Event list');
        } else {
            name = this.props.name || I18n.t('Event list');
        }

        return (
            <Toolbar
                sx={this.state.selected.length ? sxToolbarHighlight : undefined}
                style={styles.toolbarRoot}
            >
                {this.state.isInstanceAlive &&
                this.state.editAvailable &&
                this.state.editEnabled &&
                this.state.selected.length ? (
                    <Typography
                        style={styles.toolbarTitle}
                        color="inherit"
                        variant="subtitle1"
                        component="div"
                    >
                        {this.state.selected.length} {I18n.t('selected')}
                    </Typography>
                ) : (
                    <Typography
                        style={styles.toolbarTitle}
                        variant="h6"
                        id="tableTitle"
                        component="div"
                    >
                        <span>{name}</span>
                        <span style={styles.instanceNotOnline}>
                            {!this.state.isInstanceAlive ? I18n.t('(Instance not running)') : ''}
                        </span>
                    </Typography>
                )}

                {!this.state.selected.length ? this.renderFilter() : null}

                {this.state.editAvailable && this.state.editEnabled && this.state.selected.length ? (
                    <>
                        <Tooltip title={I18n.t('Delete')}>
                            <IconButton
                                aria-label="delete"
                                onClick={() => this.setState({ showDeleteConfirm: true })}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                        {this.state.selectedId ? (
                            <Tooltip title={I18n.t('Edit settings for state')}>
                                <IconButton
                                    aria-label="edit"
                                    onClick={() => {
                                        Router.doNavigate(null, 'addId', this.state.selectedId);
                                        this.setState({ showAddIdDialog: this.state.selectedId });
                                    }}
                                >
                                    <IconEdit />
                                </IconButton>
                            </Tooltip>
                        ) : null}
                    </>
                ) : (
                    <>
                        {this.state.editAvailable && this.state.editEnabled && (
                            <Tooltip
                                title={I18n.t('Add state to event list')}
                                style={styles.toolbarButton}
                            >
                                <Fab
                                    variant="extended"
                                    size="small"
                                    aria-label="add"
                                    color="secondary"
                                    sx={sxButtonAddState}
                                    onClick={() => {
                                        Router.doNavigate(null, 'selectState', '');
                                        this.setState({ showSelectState: true });
                                    }}
                                >
                                    <div style={!narrowWidth ? styles.toolbarButtonText : undefined}>
                                        <IconEdit
                                            style={{ verticalAlign: 'middle', marginRight: 8, paddingLeft: 16 }}
                                        />
                                        {narrowWidth ? null : (
                                            <span style={{ verticalAlign: 'middle', paddingRight: 16 }}>
                                                {I18n.t('States')}
                                            </span>
                                        )}
                                    </div>
                                </Fab>
                            </Tooltip>
                        )}
                        {this.state.editAvailable && this.state.editEnabled && (
                            <Tooltip
                                title={I18n.t('Insert custom event into list')}
                                style={styles.toolbarButton}
                            >
                                <span>
                                    <Fab
                                        variant="extended"
                                        aria-label="add"
                                        size="small"
                                        color="primary"
                                        disabled={!this.state.isInstanceAlive}
                                        onClick={() => this.setState({ showAddEventDialog: true })}
                                    >
                                        <div style={!narrowWidth ? styles.toolbarButtonText : undefined}>
                                            <IconAddEvent style={{ verticalAlign: 'middle' }} />
                                            {narrowWidth ? null : (
                                                <span style={{ verticalAlign: 'middle' }}>
                                                    {I18n.t('Custom Event')}
                                                </span>
                                            )}
                                        </div>
                                    </Fab>
                                </span>
                            </Tooltip>
                        )}
                        {this.state.editAvailable && this.props.showEditButton && (
                            <Tooltip
                                title={I18n.t('Edit mode')}
                                style={styles.toolbarButton}
                            >
                                <Fab
                                    variant="extended"
                                    aria-label="enable-edit"
                                    size="small"
                                    style={this.state.editEnabled ? { background: 'red' } : undefined}
                                    onClick={() => {
                                        window.localStorage.setItem(
                                            `${this.props.adapterName}-${this.props.instance || 0}-adapter.editEnabled`,
                                            this.state.editEnabled ? 'false' : 'true',
                                        );
                                        this.setState({ editEnabled: !this.state.editEnabled });
                                    }}
                                >
                                    <IconEdit />
                                </Fab>
                            </Tooltip>
                        )}
                        {this.props.native.pdfButton && (
                            <Tooltip
                                title={I18n.t('Generate PDF file')}
                                style={styles.toolbarButton}
                            >
                                <span>
                                    <Fab
                                        variant="extended"
                                        aria-label="generate-pdf"
                                        size="small"
                                        disabled={!this.state.isInstanceAlive || this.state.pdfInGeneration}
                                        onClick={() => this.triggerPdf()}
                                    >
                                        <IconPdf />
                                    </Fab>
                                </span>
                            </Tooltip>
                        )}
                        <Tooltip
                            title={I18n.t('Refresh list')}
                            style={styles.toolbarButton}
                        >
                            <Fab
                                variant="extended"
                                aria-label="refresh"
                                size="small"
                                onClick={() => void this.readStatus()}
                            >
                                <IconReload />
                            </Fab>
                        </Tooltip>
                    </>
                )}
            </Toolbar>
        );
    }

    stableSort(
        array: FormattedEvent[],
        comparator: (a: FormattedEvent, b: FormattedEvent) => number,
    ): FormattedEvent[] {
        if (this.state.filterStates?.length) {
            array = array.filter(item => this.state.filterStates.includes(item.id || ''));
        }
        const stabilizedThis: [FormattedEvent, number][] = array.map((el, index) => [el, index]);

        stabilizedThis.sort((a, b) => {
            const order = comparator(a[0], b[0]);
            if (order !== 0) {
                return order;
            }
            return a[1] - b[1];
        });
        return stabilizedThis.map(el => el[0]);
    }

    static descendingComparator(a: FormattedEvent, b: FormattedEvent, orderBy: SortKey): number {
        const key: keyof FormattedEvent = orderBy === 'ts' ? '_id' : orderBy;
        const aVal = a[key] as string | number;
        const bVal = b[key] as string | number;
        if (bVal < aVal) {
            return -1;
        }
        if (bVal > aVal) {
            return 1;
        }
        return 0;
    }

    static getComparator(order: Order, orderBy: SortKey): (a: FormattedEvent, b: FormattedEvent) => number {
        return order === 'desc'
            ? (a, b) => List.descendingComparator(a, b, orderBy)
            : (a, b) => -List.descendingComparator(a, b, orderBy);
    }

    handleClick(id: number): void {
        const selectedIndex = this.state.selected.indexOf(id);
        let newSelected: number[] = [];
        let selectedId = '';

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(this.state.selected, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(this.state.selected.slice(1));
        } else if (selectedIndex === this.state.selected.length - 1) {
            newSelected = newSelected.concat(this.state.selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                this.state.selected.slice(0, selectedIndex),
                this.state.selected.slice(selectedIndex + 1),
            );
        }
        if (newSelected.length === 1) {
            selectedId = this.state.eventList?.find(item => item._id === newSelected[0])?.stateId || '';
        }

        this.setState({ selected: newSelected, selectedId });
    }

    async deleteEntries(): Promise<void> {
        const state = await this.props.socket.getState(this.eventRawListId);
        let eventList = List.parseList<RawEvent>(state);

        eventList = eventList.filter(item => !this.state.selected.includes(item.ts));

        await this.props.socket.setState(this.eventRawListId, JSON.stringify(eventList));
        this.setState({ selected: [], selectedId: '' });
    }

    renderSelectState(): JSX.Element | null {
        if (!this.state.showSelectState) {
            return null;
        }
        return (
            <SelectStateDialog
                imagePrefix={this.props.imagePrefix}
                socket={this.props.socket}
                adapterName={this.props.adapterName}
                instance={this.props.instance}
                onClose={id => {
                    if (id) {
                        Router.doNavigate(null, 'addId', typeof id === 'string' ? id : '');
                        this.setState({ showAddIdDialog: id, showSelectState: false });
                    } else {
                        Router.doNavigate(null, '', '');
                        this.setState({ showSelectState: false });
                    }
                }}
            />
        );
    }

    renderList(eventList: FormattedEvent[]): JSX.Element {
        return (
            <TableContainer style={styles.tableContainer}>
                <Table
                    style={styles.table}
                    size="small"
                >
                    {this.renderHeader(eventList)}
                    <TableBody>
                        {this.stableSort(eventList, List.getComparator(this.state.order, this.state.orderBy)).map(
                            (row, index) => {
                                const isItemSelected = this.state.selected.includes(row._id);
                                const labelId = `enhanced-table-checkbox-${index}`;

                                let icon = row.icon;

                                if (!this.props.isWeb && icon?.match(/^[-_0-9a-z]+\.admin\//)) {
                                    // support of hm-rpc.admin/icons/152_hmip-swdo-i_thumb.png
                                    icon = `/files/${icon}`;
                                }

                                return (
                                    <TableRow
                                        hover
                                        onClick={() => this.handleClick(row._id)}
                                        style={row._style || undefined}
                                        role="checkbox"
                                        aria-checked={isItemSelected}
                                        tabIndex={-1}
                                        key={row._id}
                                        selected={isItemSelected}
                                    >
                                        {this.state.isInstanceAlive &&
                                            this.state.editAvailable &&
                                            this.state.editEnabled && (
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={isItemSelected}
                                                        slotProps={{
                                                            input: { 'aria-labelledby': labelId },
                                                        }}
                                                    />
                                                </TableCell>
                                            )}
                                        <TableCell
                                            style={{ ...row._style, ...styles.tdTs }}
                                            scope="row"
                                            padding="none"
                                            align="right"
                                        >
                                            {row.ts}
                                        </TableCell>
                                        {this.props.native.icons ? (
                                            <TableCell
                                                style={{ ...styles.tdIcons, ...row._style }}
                                                component="td"
                                                padding="none"
                                                align="center"
                                            >
                                                {icon ? (
                                                    icon.endsWith('default') ? (
                                                        <IconEvent />
                                                    ) : (
                                                        <Image
                                                            imagePrefix={this.imagePrefix}
                                                            src={icon}
                                                            sx={{ width: 28, height: 28, verticalAlign: 'middle' }}
                                                            color={row._style?.color || ''}
                                                        />
                                                    )
                                                ) : null}
                                            </TableCell>
                                        ) : null}
                                        <TableCell
                                            style={{ ...row._style, ...styles.tdEvent }}
                                            align="right"
                                        >
                                            {row.event}
                                        </TableCell>
                                        <TableCell
                                            style={{ ...row._style, ...styles.tdVal }}
                                            align="left"
                                        >
                                            {row.val === undefined || row.val === null ? '' : row.val.toString()}
                                        </TableCell>
                                        {this.props.native.duration ? (
                                            <TableCell
                                                style={
                                                    row.dr
                                                        ? { ...row._style, color: COLOR_RUNNING_DURATION }
                                                        : row._style || undefined
                                                }
                                                sx={row.dr ? sxDurationRunning : undefined}
                                                component="td"
                                                padding="none"
                                                align="right"
                                            >
                                                {row.duration || ''}
                                            </TableCell>
                                        ) : null}
                                        {this.state.editAvailable && this.state.editEnabled && (
                                            <TableCell
                                                style={styles.tdID}
                                                align="left"
                                            >
                                                {row.stateId}
                                            </TableCell>
                                        )}
                                        {this.state.editAvailable && this.state.editEnabled && (
                                            <TableCell
                                                style={styles.tdEdit}
                                                align="left"
                                            >
                                                {row.stateId ? (
                                                    <Tooltip
                                                        title={I18n.t('Edit settings for state')}
                                                        style={styles.toolbarButton}
                                                    >
                                                        <IconButton
                                                            sx={sxEditButton}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                Router.doNavigate(null, 'addId', row.stateId);
                                                                this.setState({ showAddIdDialog: row.stateId || true });
                                                            }}
                                                        >
                                                            <IconEdit />
                                                        </IconButton>
                                                    </Tooltip>
                                                ) : null}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            },
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    renderConfirmDialog(): JSX.Element | null {
        if (!this.state.showDeleteConfirm) {
            return null;
        }
        return (
            <ConfirmDialog
                title={I18n.t('Please confirm')}
                text={I18n.t('Are you sure to delete events from list?')}
                ok={I18n.t('Ok')}
                cancel={I18n.t('Cancel')}
                icon={<IconQuestion />}
                onClose={result =>
                    this.setState({ showDeleteConfirm: false }, () => {
                        if (result) {
                            void this.deleteEntries();
                        }
                    })
                }
            />
        );
    }

    renderAddEventDialog(): JSX.Element | null {
        if (!this.state.showAddEventDialog) {
            return null;
        }
        return (
            <AddEventDialog
                onClose={event =>
                    this.setState({ showAddEventDialog: false }, () => {
                        if (event) {
                            void this.props.socket.sendTo(
                                `${this.props.adapterName}.${this.props.instance}`,
                                'insert',
                                event,
                            );
                        }
                    })
                }
            />
        );
    }

    renderAddIdDialog(): JSX.Element | null {
        if (!this.state.showAddIdDialog) {
            return null;
        }
        return (
            <AddIdDialog
                imagePrefix={this.imagePrefix}
                instance={this.props.instance}
                adapterName={this.props.adapterName}
                themeName={this.props.themeName}
                themeType={this.props.themeType}
                theme={this.props.theme}
                socket={this.props.socket}
                native={this.props.native}
                id={typeof this.state.showAddIdDialog === 'string' ? this.state.showAddIdDialog : ''}
                onClose={() => {
                    Router.doNavigate(null, '', '');
                    this.setState({ showAddIdDialog: false });
                }}
            />
        );
    }

    render(): JSX.Element {
        return (
            <Paper
                style={{
                    ...styles.tab,
                    ...(!(this.state.isInstanceAlive && this.state.editAvailable && this.state.editEnabled)
                        ? styles.tabMargins
                        : undefined),
                }}
            >
                {this.renderToolbar()}
                {this.state.eventList ? this.renderList(this.state.eventList) : <LinearProgress />}
                {this.renderToast()}
                {this.renderConfirmDialog()}
                {this.renderAddEventDialog()}
                {this.renderAddIdDialog()}
                {this.renderSelectState()}
            </Paper>
        );
    }
}

export default withWidth()(List) as unknown as ComponentType<Omit<ListProps, 'width'>>;
