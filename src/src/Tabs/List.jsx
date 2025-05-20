import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { lighten } from '@mui/material/styles';

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

import { I18n, Utils, Image, Router, withWidth, Confirm as ConfirmDialog } from '@iobroker/adapter-react-v5';

import AddEventDialog from '../Dialogs/AddEvent';
import AddIdDialog from '../Dialogs/AddId';
import SelectStateDialog from '../Dialogs/SelectState';

// Copyright Apache 2.0 https://raw.githubusercontent.com/material-icons/material-icons/master/svg/filter_alt/baseline.svg
// https://github.com/material-icons/material-icons/blob/master/LICENSE
class IconFilter extends React.Component {
    render() {
        return (
            <svg
                viewBox="0 0 24 24"
                width={24}
                height={24}
                xmlns="http://www.w3.org/2000/svg"
                style={this.props.style}
            >
                <path
                    fill="currentColor"
                    stroke="currentColor"
                    d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0 0 18.95 4H5.04c-.83 0-1.3.95-.79 1.61z"
                />
            </svg>
        );
    }
}

const COLOR_RUNNING_DURATION = '#59be78';

const styles = {
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
    toolbarHighlight: theme =>
        theme.palette.mode === 'light'
            ? {
                  color: theme.palette.secondary.main,
                  backgroundColor: lighten(theme.palette.secondary.light, 0.85),
              }
            : {
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.secondary.dark,
              },
    toolbarTitle: {
        flex: '1 1 100%',
    },
    toolbarButton: {
        marginRight: 8,
        // height: 37.25,
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
        //width: 100
        paddingRight: 8,
    },
    tdEvent: {
        //width: `calc(100% - 250px - 52px)`,
        paddingRight: 8,
    },
    tdVal: {
        //width: 150,
    },
    tdDuration: {
        //paddingRight: 8,
    },
    tdDurationRunning: {
        animationName: 'running',
        animationDuration: '2s',
        animationIterationCount: 'infinite',
    },
    tdID: {
        opacity: 0.3,
    },
    tdEdit: {},
    editButton: {
        height: 22,
        width: 22,
        opacity: 0.3,
        '&:hover': {
            opacity: 1,
        },
    },
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
    buttonAddState: {
        minWidth: '120px !important',
    },
    icon: {
        width: 28,
        height: 28,
        verticalAlign: 'middle',
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

class List extends Component {
    constructor(props) {
        super(props);

        let editEnabled =
            window.localStorage.getItem(`${this.props.adapterName}-${this.props.instance || 0}-adapter.editEnabled`) ||
            null;
        let editAvailable = props.editAvailable !== undefined ? props.editAvailable : true;

        let filterStates =
            window.localStorage.getItem(`${this.props.adapterName}-${this.props.instance || 0}-adapter.filterStates`) ||
            null;
        try {
            filterStates = filterStates ? JSON.parse(filterStates) : [];
        } catch (e) {
            filterStates = [];
        }

        if (!editAvailable) {
            editEnabled = false;
        } else if (!this.props.showEditButton || editEnabled === null) {
            editEnabled = props.editEnabled !== undefined ? props.editEnabled : true;
        } else if (editEnabled === 'true') {
            editEnabled = true;
        } else if (editEnabled === 'false') {
            editEnabled = false;
        }

        const location = Router.getLocation();

        this.state = {
            toast: '',
            isInstanceAlive: false,
            eventList: false,
            eventRawList: false,
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
            isFloatComma: true,
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

    readStatus(cb) {
        this.props.socket.getState(this.aliveId).then(aliveState =>
            this.props.socket.getState(this.eventListId).then(state =>
                this.props.socket.getState(this.eventRawListId).then(rawState => {
                    let eventList;
                    try {
                        eventList = state && state.val ? JSON.parse(state.val) : [];
                    } catch (e) {
                        eventList = [];
                    }
                    let eventRawList;
                    try {
                        eventRawList = rawState && rawState.val ? JSON.parse(rawState.val) : [];
                    } catch (e) {
                        eventRawList = [];
                    }

                    // merge together
                    eventList.forEach(item => {
                        const raw = eventRawList.find(it => it.ts === item._id);
                        if (raw) {
                            item.stateId = raw.id;
                        }
                    });

                    this.setState(
                        { isInstanceAlive: aliveState && aliveState.val, eventList, eventRawList },
                        () => cb && cb(),
                    );
                }),
            ),
        );
    }

    componentDidMount() {
        this.readStatus(() => {
            this.props.socket.subscribeState(this.aliveId, this.onStateChanged);
            this.props.socket.subscribeState(this.eventListId, this.onStateChanged);
            this.props.socket.subscribeState(this.eventRawListId, this.onStateChanged);
            this.props.socket.subscribeState(this.triggerPDFId, this.onStateChanged);
        });
    }

    componentWillUnmount() {
        this.props.socket.unsubscribeState(this.aliveId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.eventListId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.eventRawListId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.triggerPDFId, this.onStateChanged);
    }

    onStateChanged = (id, state) => {
        if (id === this.aliveId) {
            this.setState({ isInstanceAlive: state && state.val });
        }
        if (id === this.triggerPDFId) {
            this.setState({ pdfInGeneration: state && state.val });
        } else if (id === this.eventListId) {
            let eventList;
            try {
                eventList = state && state.val ? JSON.parse(state.val) : [];
            } catch (e) {
                eventList = [];
            }
            // merge together
            this.state.eventRawList &&
                eventList.forEach(item => {
                    const raw = this.state.eventRawList.find(it => it.ts === item._id);
                    if (raw) {
                        item.stateId = raw.id;
                    }
                });
            this.setState({ eventList });
        } else if (id === this.eventRawListId) {
            let eventRawList;
            try {
                eventRawList = state && state.val ? JSON.parse(state.val) : [];
            } catch (e) {
                eventRawList = [];
            }
            // merge together
            let eventList = null;
            this.state.eventList &&
                this.state.eventList.forEach((item, i) => {
                    if (!item.stateId) {
                        const raw = eventRawList.find(it => it.ts === item._id);
                        if (raw) {
                            eventList = eventList || JSON.parse(JSON.stringify(this.state.eventList));
                            eventList[i].stateId = raw.id;
                        }
                    }
                });
            const newState = { eventRawList };
            if (eventList) {
                newState.eventList = eventList;
            }
            this.setState(newState);
        }
    };

    renderToast() {
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
                        style={styles.close}
                        onClick={() => this.setState({ toast: '' })}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />
        );
    }

    onRequestSort = (event, property) => {
        const isAsc = this.state.orderBy === property && this.state.order === 'asc';
        this.setState({ order: isAsc ? 'desc' : 'asc', orderBy: property });
    };

    renderHeader() {
        const createSortHandler = property => event => this.onRequestSort(event, property);

        return (
            <TableHead>
                <TableRow>
                    {this.state.isInstanceAlive && this.state.editAvailable && this.state.editEnabled && (
                        <TableCell padding="checkbox">
                            <Checkbox
                                indeterminate={
                                    !!this.state.selected.length &&
                                    this.state.selected.length < this.state.eventList.length
                                }
                                checked={
                                    this.state.eventList.length > 0 &&
                                    this.state.selected.length === this.state.eventList.length
                                }
                                disabled={!this.state.eventList.length}
                                onChange={e => {
                                    if (e.target.checked) {
                                        const selected = this.state.eventList.map(n => n._id);
                                        const selectedId =
                                            selected.length === 1
                                                ? this.state.eventList.find(item => item._id === selected[0]).stateId
                                                : '';
                                        this.setState({ selected, selectedId });
                                    } else {
                                        this.setState({ selected: [], selectedId: '' });
                                    }
                                }}
                                slotProps={{
                                    input: { 'aria-label': 'select all desserts' },
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
                                styles={styles[`td${cell.id[0].toUpperCase()}${cell.id.substring(1)}`]}
                                align={cell.align}
                                padding="none"
                                component="th"
                                sortDirection={this.state.orderBy === cell.id ? this.state.order : false}
                            >
                                <TableSortLabel
                                    active={this.state.orderBy === cell.id}
                                    direction={this.state.orderBy === cell.id ? this.state.order : 'asc'}
                                    onClick={createSortHandler(cell.id)}
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

    triggerPdf() {
        if (this.state.isInstanceAlive) {
            this.props.socket
                .sendTo(`${this.props.adapterName}.${this.props.instance}`, 'pdf', this.props.native.pdfSettings)
                .then(() => {
                    let myWindow;
                    if (!window.location.pathname.includes('adapter/')) {
                        myWindow = window.open('/eventlist/report.pdf?q=' + Date.now(), 'pdf');
                    } else {
                        myWindow = window.open('/files/eventlist/report.pdf?q=' + Date.now(), 'pdf');
                    }

                    myWindow && myWindow.focus();
                });
        }
    }

    async readIds() {
        const objects = await this.props.socket.getObjectViewCustom('custom', 'state', '', '\u9999');
        const namespace = `${this.props.adapterName}.${this.props.instance || 0}`;
        const ids = [];
        const allIds = Object.keys(objects);
        for (let i = 0; i < allIds.length; i++) {
            const id = allIds[i];
            if (objects[id][namespace]) {
                try {
                    const obj = await this.props.socket.getObject(id);
                    if (obj) {
                        let count = 0;
                        // count states
                        this.state.eventList.forEach(item => item.id === obj._id && count++);
                        ids.push({
                            id: obj._id,
                            name: Utils.getObjectNameFromObj(obj, I18n.getLanguage()),
                            count,
                        });
                    } else {
                        ids.push({ id });
                    }
                } catch (e) {
                    ids.push({ id });
                }
            }
        }
        ids.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
        return ids;
    }

    renderFilter() {
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
                    onChange={event => {
                        window.localStorage.setItem(
                            `${this.props.adapterName}-${this.props.instance || 0}-adapter.filterStates`,
                            JSON.stringify(event.target.value),
                        );
                        this.setState({ filterStates: event.target.value });
                    }}
                    //input={<Input placeholder={I18n.t('Filter by ID')}/>}
                    onOpen={() => this.readIds().then(ids => this.setState({ stateIds: ids }))}
                    renderValue={selected => (selected.length === 1 ? selected[0] : selected.length)}
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

    renderToolbar() {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm';
        let name = this.props.name || I18n.t('Event list');
        if (typeof name === 'object') {
            name = name[I18n.getLanguage()] || name.en || I18n.t('Event list');
        }

        return (
            <Toolbar
                sx={this.state.selected.length ? styles.toolbarHighlight : undefined}
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
                                    sx={styles.buttonAddState}
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
                                    style={this.state.editEnabled ? { background: 'red' } : {}}
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
                                onClick={() => this.readStatus()}
                            >
                                <IconReload />
                            </Fab>
                        </Tooltip>
                    </>
                )}
            </Toolbar>
        );
    }

    stableSort(array, comparator) {
        if (this.state.filterStates && this.state.filterStates.length) {
            array = array.filter(item => this.state.filterStates.includes(item.id));
        }
        const stabilizedThis = array.map((el, index) => [el, index]);

        stabilizedThis.sort((a, b) => {
            const order = comparator(a[0], b[0]);
            if (order !== 0) {
                return order;
            }
            return a[1] - b[1];
        });
        return stabilizedThis.map(el => el[0]);
    }

    descendingComparator(a, b, orderBy) {
        if (b[orderBy] < a[orderBy]) {
            return -1;
        }
        if (b[orderBy] > a[orderBy]) {
            return 1;
        }
        return 0;
    }

    getComparator(order, orderBy) {
        return order === 'desc'
            ? (a, b) => this.descendingComparator(a, b, orderBy === 'ts' ? '_id' : orderBy)
            : (a, b) => -this.descendingComparator(a, b, orderBy === 'ts' ? '_id' : orderBy);
    }

    handleClick(id) {
        const selectedIndex = this.state.selected.indexOf(id);
        let newSelected = [];
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
            selectedId = this.state.eventList.find(item => item._id === newSelected[0]).stateId;
        }

        this.setState({ selected: newSelected, selectedId });
    }

    deleteEntries(cb) {
        this.props.socket.getState(`${this.props.adapterName}.${this.props.instance}.eventListRaw`).then(state => {
            let eventList;
            try {
                eventList = state && state.val ? JSON.parse(state.val) : [];
            } catch (e) {
                eventList = [];
            }

            eventList = eventList.filter(item => !this.state.selected.includes(item.ts));

            this.props.socket
                .setState(`${this.props.adapterName}.${this.props.instance}.eventListRaw`, JSON.stringify(eventList))
                .then(() => this.setState({ selected: [], selectedId: '' }, () => cb && cb()));
        });
    }

    renderSelectState() {
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
                        Router.doNavigate(null, 'addId', id);
                        this.setState({ showAddIdDialog: id, showSelectState: false });
                    } else {
                        Router.doNavigate(null, '', '');
                        this.setState({ showSelectState: false });
                    }
                }}
            />
        );
    }

    renderList() {
        return (
            <TableContainer style={styles.tableContainer}>
                <Table
                    style={styles.table}
                    size="small"
                >
                    {this.renderHeader()}
                    <TableBody>
                        {this.stableSort(
                            this.state.eventList,
                            this.getComparator(this.state.order, this.state.orderBy),
                        ).map((row, index) => {
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
                                                        style={styles.icon}
                                                        color={(row._style && row._style.color) || ''}
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
                                        {row.val === undefined ? '' : row.val.toString()}
                                    </TableCell>
                                    {this.props.native.duration ? (
                                        <TableCell
                                            style={
                                                row.dr
                                                    ? { ...row._style, color: COLOR_RUNNING_DURATION }
                                                    : row._style || undefined
                                            }
                                            sx={{
                                                ...(row.dr ? styles.tdDurationRunning : undefined),
                                                ...styles.tdDuration,
                                            }}
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
                                                        sx={styles.editButton}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            Router.doNavigate(null, 'addId', row.stateId);
                                                            this.setState({ showAddIdDialog: row.stateId });
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
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    renderConfirmDialog() {
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
                onClose={result => this.setState({ showDeleteConfirm: false }, () => result && this.deleteEntries())}
            />
        );
    }

    renderAddEventDialog() {
        if (!this.state.showAddEventDialog) {
            return null;
        } else {
            return (
                <AddEventDialog
                    imagePrefix={this.imagePrefix}
                    onClose={event =>
                        this.setState(
                            { showAddEventDialog: false },
                            () =>
                                event &&
                                this.props.socket.sendTo(
                                    `${this.props.adapterName}.${this.props.instance}`,
                                    'insert',
                                    event,
                                ),
                        )
                    }
                />
            );
        }
    }

    renderAddIdDialog() {
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
                onClose={event => {
                    Router.doNavigate(null, '', '');
                    this.setState(
                        { showAddIdDialog: false },
                        () =>
                            event &&
                            this.props.socket.sendTo(
                                `${this.props.adapterName}.${this.props.instance}`,
                                'insert',
                                event,
                            ),
                    );
                }}
            />
        );
    }

    render() {
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
                {this.state.eventList ? this.renderList() : <LinearProgress />}
                {this.renderToast()}
                {this.renderConfirmDialog()}
                {this.renderAddEventDialog()}
                {this.renderAddIdDialog()}
                {this.renderSelectState()}
            </Paper>
        );
    }
}

List.propTypes = {
    editAvailable: PropTypes.bool,
    editEnabled: PropTypes.bool,
    showEditButton: PropTypes.bool,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    socket: PropTypes.object.isRequired,
    themeName: PropTypes.string,
    themeType: PropTypes.string,
    theme: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    imagePrefix: PropTypes.string,
    isWeb: PropTypes.bool,
    name: PropTypes.string,
};

export default withWidth()(List);
