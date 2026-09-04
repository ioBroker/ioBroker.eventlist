import React, { Component, type ComponentType, type CSSProperties, type JSX } from 'react';
import moment from 'moment';

import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Toolbar,
    Typography,
    Paper,
    IconButton,
    Tooltip,
    Button,
    Snackbar,
    LinearProgress,
    MenuItem,
    Select,
    type SelectChangeEvent,
} from '@mui/material';

import {
    Check as IconAck,
    DoneAll as IconAckAll,
    SwapVert as IconFlapping,
    LooksOne as IconFirst,
    NotificationsOff as IconSuppressed,
    Warning as IconMessage,
    Close as IconClose,
} from '@mui/icons-material';

import { I18n, Image, withWidth, type AdminConnection, type Width } from '@iobroker/gui-components';

import {
    LEVEL_COLORS,
    MESSAGE_LEVELS,
    type EventListNative,
    type FormattedMessage,
    type MessageLevel,
    type Suppression,
} from '../types';

const ICON_SIZE = 28;

/** Same hard size limit as in the event list: a user icon may not blow up the table layout */
const sxIconBox = {
    width: ICON_SIZE,
    height: ICON_SIZE,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',
    '& > *': {
        maxWidth: '100%',
        maxHeight: '100%',
        flexShrink: 0,
    },
};

const styles: Record<string, CSSProperties> = {
    tab: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    toolbarRoot: {
        paddingLeft: 16,
        paddingRight: 8,
        gap: 8,
    },
    toolbarTitle: {
        flex: '1 1 100%',
    },
    instanceNotOnline: {
        color: '#883333',
        marginLeft: 8,
    },
    tableContainer: {
        // fill the rest of the card below the toolbar
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
    },
    table: {
        width: '100%',
    },
    levelChip: {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
        whiteSpace: 'nowrap',
    },
    counters: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
    },
    counter: {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        color: '#FFF',
        fontSize: 12,
        whiteSpace: 'nowrap',
    },
    stateCode: {
        fontFamily: 'monospace',
        fontWeight: 'bold',
    },
    gone: {
        opacity: 0.6,
    },
    filter: {
        minWidth: 140,
    },
    ackAllButton: {
        flex: 'none',
        whiteSpace: 'nowrap',
    },
    suppressed: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 16px',
        fontStyle: 'italic',
        opacity: 0.8,
        fontSize: 12,
    },
    empty: {
        padding: 32,
        textAlign: 'center',
        opacity: 0.7,
    },
    tdText: {
        width: '100%',
    },
    tdNarrow: {
        whiteSpace: 'nowrap',
    },
};

interface MessagesProps {
    socket: AdminConnection;
    native: EventListNative;
    instance: number;
    adapterName: string;
    imagePrefix?: string;
    /** Provided by withWidth */
    width?: Width;
}

interface MessagesState {
    messages: FormattedMessage[] | null;
    suppressions: Suppression[];
    isInstanceAlive: boolean;
    filterLevel: MessageLevel | '';
    toast: string;
}

class Messages extends Component<MessagesProps, MessagesState> {
    private readonly aliveId: string;
    private readonly listId: string;
    private readonly suppressedId: string;
    private readonly ackId: string;
    /** The times are shown relative, so they have to be refreshed even without a change */
    private timeInterval: ReturnType<typeof setInterval> | null = null;

    constructor(props: MessagesProps) {
        super(props);

        this.state = {
            messages: null,
            suppressions: [],
            isInstanceAlive: false,
            filterLevel: '',
            toast: '',
        };

        this.aliveId = `system.adapter.${this.props.adapterName}.${this.props.instance}.alive`;
        this.listId = `${this.props.adapterName}.${this.props.instance}.messages.list`;
        this.suppressedId = `${this.props.adapterName}.${this.props.instance}.messages.suppressed`;
        this.ackId = `${this.props.adapterName}.${this.props.instance}.messages.ack`;
    }

    componentDidMount(): void {
        void this.readStatus().then(() => {
            void this.props.socket.subscribeState(this.aliveId, this.onStateChanged);
            void this.props.socket.subscribeState(this.listId, this.onStateChanged);
            void this.props.socket.subscribeState(this.suppressedId, this.onStateChanged);
        });

        this.timeInterval = setInterval(() => this.forceUpdate(), 30000);
    }

    componentWillUnmount(): void {
        this.props.socket.unsubscribeState(this.aliveId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.listId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.suppressedId, this.onStateChanged);

        if (this.timeInterval) {
            clearInterval(this.timeInterval);
            this.timeInterval = null;
        }
    }

    /**
     * How long ago that was. Built from the translated words and not with ,
     * whose locale files do not reach the moment instance of the GUI.
     *
     * @param ms how long ago in milliseconds
     */
    static ageText(ms: number): string {
        if (ms < 60000) {
            return I18n.t('just now');
        }

        const minutes = Math.floor(ms / 60000);
        if (minutes < 60) {
            return `${minutes} ${I18n.t('minutes short')}`;
        }

        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            const rest = minutes % 60;
            return `${hours} ${I18n.t('hours short')}${rest ? ` ${rest} ${I18n.t('minutes short')}` : ''}`;
        }

        const days = Math.floor(hours / 24);
        const rest = hours % 24;
        return `${days} ${I18n.t('days short')}${rest ? ` ${rest} ${I18n.t('hours short')}` : ''}`;
    }

    static parse<T>(state: ioBroker.State | null | undefined): T[] {
        try {
            return state?.val ? JSON.parse(state.val as string) : [];
        } catch {
            return [];
        }
    }

    async readStatus(): Promise<void> {
        const alive = await this.props.socket.getState(this.aliveId);
        const list = await this.props.socket.getState(this.listId);
        const suppressed = await this.props.socket.getState(this.suppressedId);

        await new Promise<void>(resolve =>
            this.setState(
                {
                    isInstanceAlive: !!alive?.val,
                    messages: Messages.parse<FormattedMessage>(list),
                    suppressions: Messages.parse<Suppression>(suppressed),
                },
                resolve,
            ),
        );
    }

    onStateChanged = (id: string, state: ioBroker.State | null | undefined): void => {
        if (id === this.aliveId) {
            this.setState({ isInstanceAlive: !!state?.val });
        } else if (id === this.listId) {
            this.setState({ messages: Messages.parse<FormattedMessage>(state) });
        } else if (id === this.suppressedId) {
            this.setState({ suppressions: Messages.parse<Suppression>(state) });
        }
    };

    /**
     * Acknowledge a message, a group or everything.
     *
     * The adapter listens on the state, so the acknowledgement takes the same way as one from a
     * script and lands in the event list.
     *
     * @param filter message id, group name or `*`
     */
    acknowledge(filter: string): void {
        this.props.socket
            .setState(this.ackId, filter)
            .then(() => this.setState({ toast: I18n.t('Acknowledged') }))
            .catch(e => this.setState({ toast: e.toString() }));
    }

    renderToast(): JSX.Element | null {
        if (!this.state.toast) {
            return null;
        }

        return (
            <Snackbar
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                open
                autoHideDuration={3000}
                onClose={() => this.setState({ toast: '' })}
                message={this.state.toast}
                action={
                    <IconButton
                        aria-label="Close"
                        color="inherit"
                        onClick={() => this.setState({ toast: '' })}
                    >
                        <IconClose />
                    </IconButton>
                }
            />
        );
    }

    /** The counters per level, they say at a glance what is standing */
    static renderCounters(messages: FormattedMessage[]): JSX.Element | null {
        const counters = MESSAGE_LEVELS.map(level => ({
            level,
            count: messages.filter(item => item.level === level).length,
        })).filter(item => item.count);

        if (!counters.length) {
            return null;
        }

        return (
            <div style={styles.counters}>
                {counters.map(item => (
                    <span
                        key={item.level}
                        style={{ ...styles.counter, backgroundColor: LEVEL_COLORS[item.level] }}
                    >
                        {`${item.count} × ${item.level}`}
                    </span>
                ))}
            </div>
        );
    }

    renderToolbar(messages: FormattedMessage[]): JSX.Element {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm';
        const ackable = messages.filter(item => item.ackable).length;

        return (
            <Toolbar style={styles.toolbarRoot}>
                <Typography
                    style={styles.toolbarTitle}
                    variant="h6"
                    component="div"
                >
                    <span>{I18n.t('Standing messages')}</span>
                    <span style={styles.instanceNotOnline}>
                        {!this.state.isInstanceAlive ? I18n.t('(Instance not running)') : ''}
                    </span>
                </Typography>

                {!narrowWidth ? Messages.renderCounters(messages) : null}

                <Select
                    variant="standard"
                    style={styles.filter}
                    displayEmpty
                    value={this.state.filterLevel}
                    onChange={(e: SelectChangeEvent<string>) =>
                        this.setState({ filterLevel: e.target.value as MessageLevel | '' })
                    }
                >
                    <MenuItem value="">
                        <em>{I18n.t('All levels')}</em>
                    </MenuItem>
                    {MESSAGE_LEVELS.map(level => (
                        <MenuItem
                            key={level}
                            value={level}
                        >
                            <span style={{ color: LEVEL_COLORS[level], fontWeight: 'bold' }}>
                                {level.toUpperCase()}
                            </span>
                        </MenuItem>
                    ))}
                </Select>

                <Tooltip title={I18n.t('Acknowledge all messages')}>
                    <span>
                        <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            style={styles.ackAllButton}
                            disabled={!ackable}
                            startIcon={<IconAckAll />}
                            onClick={() => this.acknowledge('*')}
                        >
                            {narrowWidth
                                ? ackable || ''
                                : `${I18n.t('Acknowledge all')} ${ackable ? `(${ackable})` : ''}`}
                        </Button>
                    </span>
                </Tooltip>
            </Toolbar>
        );
    }

    /** What is suppressed at the moment. Without this line a quiet list could be a lie. */
    renderSuppressions(): JSX.Element | null {
        const now = Date.now();
        const running = this.state.suppressions.filter(item => item.until > now);

        if (!running.length) {
            return null;
        }

        return (
            <div style={styles.suppressed}>
                <IconSuppressed fontSize="small" />
                <span>
                    {`${I18n.t('Suppressed')}: ${running
                        .map(item => `${item.target} (${I18n.t('until')} ${moment(item.until).format('HH:mm')})`)
                        .join(', ')}`}
                </span>
            </div>
        );
    }

    renderHeader(): JSX.Element {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm';

        return (
            <TableHead>
                <TableRow>
                    <TableCell>{I18n.t('Level')}</TableCell>
                    <TableCell align="center">{I18n.t('State')}</TableCell>
                    <TableCell align="right">{I18n.t('Since')}</TableCell>
                    {this.props.native.icons ? <TableCell padding="none" /> : null}
                    <TableCell>{I18n.t('Message')}</TableCell>
                    {!narrowWidth ? <TableCell align="right">{I18n.t('Value')}</TableCell> : null}
                    {!narrowWidth ? <TableCell align="right">{I18n.t('Count')}</TableCell> : null}
                    {!narrowWidth ? <TableCell>{I18n.t('Group')}</TableCell> : null}
                    {!narrowWidth && this.props.native.stateId ? <TableCell>{I18n.t('State ID')}</TableCell> : null}
                    <TableCell padding="none" />
                </TableRow>
            </TableHead>
        );
    }

    /** The combined state and what it means, in the notation used in control rooms */
    static renderState(row: FormattedMessage): JSX.Element {
        const explanation =
            row.state === 'K'
                ? I18n.t('came, not acknowledged')
                : row.state === 'KQ'
                  ? I18n.t('came, acknowledged')
                  : I18n.t('gone, not acknowledged');

        return (
            <Tooltip title={explanation}>
                <span style={styles.stateCode}>{row.state}</span>
            </Tooltip>
        );
    }

    renderRow(row: FormattedMessage): JSX.Element {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm';
        const dateFormat = this.props.native.dateFormat || 'MMM Do, HH:mm:ss';

        return (
            <TableRow
                key={row.id}
                hover
                style={!row.active ? styles.gone : undefined}
            >
                <TableCell style={styles.tdNarrow}>
                    <span style={{ ...styles.levelChip, backgroundColor: LEVEL_COLORS[row.level] }}>
                        {row.level.toUpperCase()}
                    </span>
                </TableCell>
                <TableCell align="center">{Messages.renderState(row)}</TableCell>
                <TableCell
                    align="right"
                    style={styles.tdNarrow}
                >
                    <Tooltip title={moment(row.ts).format(dateFormat)}>
                        <span>{Messages.ageText(Date.now() - row.ts)}</span>
                    </Tooltip>
                </TableCell>
                {this.props.native.icons ? (
                    <TableCell
                        padding="none"
                        align="center"
                    >
                        {row.icon ? (
                            <Box sx={sxIconBox}>
                                <Image
                                    imagePrefix={this.props.imagePrefix}
                                    src={row.icon}
                                    sx={{ width: ICON_SIZE, height: ICON_SIZE }}
                                    color={row.color}
                                />
                            </Box>
                        ) : null}
                    </TableCell>
                ) : null}
                <TableCell style={styles.tdText}>
                    <span style={{ color: row.color }}>{row.text}</span>
                    {row.first ? (
                        <Tooltip title={I18n.t('First message of the group')}>
                            <IconFirst
                                fontSize="small"
                                style={{ verticalAlign: 'middle', marginLeft: 4 }}
                            />
                        </Tooltip>
                    ) : null}
                    {row.flapping ? (
                        <Tooltip title={I18n.t('This message changes too often, its transitions are not written')}>
                            <IconFlapping
                                fontSize="small"
                                style={{ verticalAlign: 'middle', marginLeft: 4 }}
                            />
                        </Tooltip>
                    ) : null}
                </TableCell>
                {!narrowWidth ? (
                    <TableCell align="right">
                        {row.val === undefined || row.val === null ? '' : row.val.toString()}
                    </TableCell>
                ) : null}
                {!narrowWidth ? <TableCell align="right">{row.count > 1 ? row.count : ''}</TableCell> : null}
                {!narrowWidth ? <TableCell>{row.group || ''}</TableCell> : null}
                {!narrowWidth && this.props.native.stateId ? <TableCell>{row.stateId || ''}</TableCell> : null}
                <TableCell padding="none">
                    {row.ackable ? (
                        <Tooltip title={I18n.t('Acknowledge')}>
                            <IconButton
                                size="small"
                                onClick={() => this.acknowledge(row.id)}
                            >
                                <IconAck />
                            </IconButton>
                        </Tooltip>
                    ) : null}
                </TableCell>
            </TableRow>
        );
    }

    renderTable(messages: FormattedMessage[]): JSX.Element {
        if (!messages.length) {
            return (
                <div style={styles.empty}>
                    <IconMessage style={{ verticalAlign: 'middle', marginRight: 8 }} />
                    {this.state.filterLevel ? I18n.t('No message of this level') : I18n.t('No standing messages')}
                </div>
            );
        }

        return (
            <TableContainer style={styles.tableContainer}>
                <Table
                    style={styles.table}
                    size="small"
                    stickyHeader
                >
                    {this.renderHeader()}
                    <TableBody>{messages.map(row => this.renderRow(row))}</TableBody>
                </Table>
            </TableContainer>
        );
    }

    render(): JSX.Element {
        if (!this.state.messages) {
            return (
                <Paper style={styles.tab}>
                    <LinearProgress />
                </Paper>
            );
        }

        // the adapter sorts by level, priority and time, so the order stays the one of a control room
        const messages = this.state.filterLevel
            ? this.state.messages.filter(item => item.level === this.state.filterLevel)
            : this.state.messages;

        return (
            <Paper style={styles.tab}>
                {this.renderToolbar(this.state.messages)}
                {this.renderSuppressions()}
                {this.renderTable(messages)}
                {this.renderToast()}
            </Paper>
        );
    }
}

export default withWidth()(Messages) as unknown as ComponentType<Omit<MessagesProps, 'width'>>;
