import React, { Component, type ComponentType, type CSSProperties, type JSX } from 'react';

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

import { I18n, Utils, Image, withWidth, type AdminConnection, type Width } from '@iobroker/gui-components';

import { formatValue } from '../formatValue';
import { levelLabel } from '../Components/AlarmClassSelect';
import {
    LEVEL_COLORS,
    MESSAGE_LEVELS,
    type EventListNative,
    type FormattedMessage,
    type MessageLevel,
    type Suppression,
} from '../types';
import moment, { setMomentLocale } from '../momentLocale';

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
    stateName: {
        lineHeight: '16px',
    },
    stateIdSmall: {
        fontSize: 10,
        lineHeight: '12px',
        opacity: 0.7,
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
    unacknowledged: {
        fontWeight: 'bold',
    },
    summary: {
        display: 'flex',
        gap: 24,
        padding: '4px 16px',
        alignItems: 'baseline',
        flex: 'none',
    },
    summaryCell: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
    },
    summaryValue: {
        fontSize: 22,
        fontWeight: 'bold',
        fontVariantNumeric: 'tabular-nums',
    },
    summaryLabel: {
        fontSize: 12,
        opacity: 0.7,
        textTransform: 'uppercase',
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
    currentValue: {
        marginLeft: 6,
        fontWeight: 'bold',
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
    /** The value the state has right now, keyed with its ID */
    currentValues: Record<string, string | number | boolean | null>;
    /** How many entries the event list holds, for the summary */
    eventCount: number;
    /** Whether the comma is the decimal separator of this installation */
    isFloatComma: boolean;
    suppressions: Suppression[];
    isInstanceAlive: boolean;
    filterLevel: MessageLevel | '';
    toast: string;
    /** The name of every state a message points at, keyed by its ID */
    stateNames: Record<string, string>;
}

class Messages extends Component<MessagesProps, MessagesState> {
    private readonly aliveId: string;
    private readonly listId: string;
    private readonly suppressedId: string;
    private readonly ackId: string;
    private readonly eventCountId: string;
    /** The times are shown relative, so they have to be refreshed even without a change */
    private timeInterval: ReturnType<typeof setInterval> | null = null;
    /** The states whose value is watched, because a message of them stands */
    private subscribedValues: string[] = [];

    constructor(props: MessagesProps) {
        super(props);

        setMomentLocale(this.props.native.language);

        this.state = {
            messages: null,
            currentValues: {},
            eventCount: 0,
            isFloatComma: false,
            suppressions: [],
            isInstanceAlive: false,
            filterLevel: '',
            toast: '',
            stateNames: {},
        };

        this.aliveId = `system.adapter.${this.props.adapterName}.${this.props.instance}.alive`;
        this.listId = `${this.props.adapterName}.${this.props.instance}.messages.list`;
        this.suppressedId = `${this.props.adapterName}.${this.props.instance}.messages.suppressed`;
        this.ackId = `${this.props.adapterName}.${this.props.instance}.messages.ack`;
        this.eventCountId = `${this.props.adapterName}.${this.props.instance}.eventCount`;
    }

    componentDidMount(): void {
        void this.props.socket
            .getSystemConfig()
            .then(systemConfig => this.setState({ isFloatComma: !!systemConfig?.common?.isFloatComma }));

        void this.readStatus().then(() => {
            void this.props.socket.subscribeState(this.aliveId, this.onStateChanged);
            void this.props.socket.subscribeState(this.listId, this.onStateChanged);
            void this.props.socket.subscribeState(this.suppressedId, this.onStateChanged);
            void this.props.socket.subscribeState(this.eventCountId, this.onStateChanged);
            void this.subscribeValues();
        });

        this.timeInterval = setInterval(() => this.forceUpdate(), 30000);
    }

    componentWillUnmount(): void {
        this.props.socket.unsubscribeState(this.aliveId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.listId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.suppressedId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.eventCountId, this.onStateChanged);

        for (const id of this.subscribedValues) {
            this.props.socket.unsubscribeState(id, this.onValueChanged);
        }
        this.subscribedValues = [];

        if (this.timeInterval) {
            clearInterval(this.timeInterval);
            this.timeInterval = null;
        }
    }

    /**
     * Watch the states the standing messages belong to.
     *
     * A message keeps the value that raised it; the state has moved on in the meantime. Both belong
     * in the table: what was, and what is.
     */
    async subscribeValues(): Promise<void> {
        const wanted = [
            ...new Set((this.state.messages || []).map(item => item.stateId).filter((id): id is string => !!id)),
        ];

        for (const id of this.subscribedValues) {
            if (!wanted.includes(id)) {
                this.props.socket.unsubscribeState(id, this.onValueChanged);
            }
        }
        for (const id of wanted) {
            if (!this.subscribedValues.includes(id)) {
                await this.props.socket.subscribeState(id, this.onValueChanged);
            }
        }

        this.subscribedValues = wanted;
        await this.readNames(wanted);
    }

    /**
     * Read the names of the states the messages belong to, the way the event list shows them.
     *
     * An ID says where an alarm comes from, a name says what it is. Both belong there, so the name
     * stands above and the ID under it.
     *
     * @param ids the state IDs of the rows
     */
    async readNames(ids: string[]): Promise<void> {
        const names = { ...this.state.stateNames };
        let found = false;

        for (const id of ids) {
            if (names[id] !== undefined) {
                continue;
            }
            try {
                const obj = await this.props.socket.getObject(id);
                names[id] = obj ? Utils.getObjectNameFromObj(obj, I18n.getLanguage()) : id;
            } catch {
                names[id] = id;
            }
            found = true;
        }

        if (found) {
            this.setState({ stateNames: names });
        }
    }

    /**
     * The cell of a state: its name, and the ID under it
     *
     * @param stateId the ID of the state, if the message has one
     */
    renderStateId(stateId?: string): JSX.Element {
        const name = stateId ? this.state.stateNames[stateId] : '';

        return (
            <>
                <div style={styles.stateName}>{name || stateId || ''}</div>
                {name && stateId && name !== stateId ? <div style={styles.stateIdSmall}>{stateId}</div> : null}
            </>
        );
    }

    onValueChanged = (id: string, state: ioBroker.State | null | undefined): void => {
        const value = state ? state.val : null;
        if (this.state.currentValues[id] === value) {
            return;
        }
        this.setState({ currentValues: { ...this.state.currentValues, [id]: value } });
    };

    /**
     * How long ago that was. Built from the translated words and not with `moment.fromNow()`,
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
            return `${minutes} ${I18n.t('minutes')}`;
        }

        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            const rest = minutes % 60;
            return `${hours} ${I18n.t('hours')}${rest ? ` ${rest} ${I18n.t('minutes')}` : ''}`;
        }

        const days = Math.floor(hours / 24);
        const rest = hours % 24;
        return `${days} ${I18n.t('days')}${rest ? ` ${rest} ${I18n.t('hours')}` : ''}`;
    }

    /**
     * The value of the message, and the value the state has now if it is not the same one.
     *
     * A message that stands says what raised it. Whether the pressure has kept climbing since then
     * is the other half of the picture, and it is the half an operator acts on.
     *
     * @param row the message
     */
    renderValue(row: FormattedMessage): JSX.Element {
        const stored = formatValue(row.val, this.state.isFloatComma, row.unit);
        const current = row.stateId ? this.state.currentValues[row.stateId] : undefined;
        const changed =
            current !== undefined &&
            current !== null &&
            row.val !== undefined &&
            row.val !== null &&
            current.toString() !== row.val.toString();

        return (
            <>
                <span>{stored}</span>
                {changed ? (
                    <span
                        style={{ ...styles.currentValue, color: row.color || LEVEL_COLORS[row.level] }}
                        title={I18n.t('The value the state has now')}
                    >
                        {`(${formatValue(current, this.state.isFloatComma, row.unit)})`}
                    </span>
                ) : null}
            </>
        );
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
        const eventCount = await this.props.socket.getState(this.eventCountId);

        await new Promise<void>(resolve =>
            this.setState(
                {
                    isInstanceAlive: !!alive?.val,
                    messages: Messages.parse<FormattedMessage>(list),
                    suppressions: Messages.parse<Suppression>(suppressed),
                    eventCount: (eventCount?.val as number) || 0,
                },
                resolve,
            ),
        );
    }

    onStateChanged = (id: string, state: ioBroker.State | null | undefined): void => {
        if (id === this.aliveId) {
            this.setState({ isInstanceAlive: !!state?.val });
        } else if (id === this.listId) {
            // a new message may belong to a state that is not watched yet
            this.setState({ messages: Messages.parse<FormattedMessage>(state) }, () => void this.subscribeValues());
        } else if (id === this.suppressedId) {
            this.setState({ suppressions: Messages.parse<Suppression>(state) });
        } else if (id === this.eventCountId) {
            this.setState({ eventCount: (state?.val as number) || 0 });
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
    /**
     * The four numbers an operator looks at first.
     *
     * The most important one is the number of unacknowledged alarms: everything else can wait, that
     * one is what nobody has seen yet.
     *
     * @param messages the standing messages
     * @param events how many entries the event list holds
     */
    static renderSummary(messages: FormattedMessage[], events: number): JSX.Element {
        const unacknowledged = messages.filter(item => item.ackable).length;
        const active = messages.filter(item => item.active).length;
        const warnings = messages.filter(item => item.level === 'warning').length;

        const cells: { label: string; value: number; color?: string; loud?: boolean }[] = [
            {
                label: I18n.t('Unacknowledged'),
                value: unacknowledged,
                color: unacknowledged ? LEVEL_COLORS.fatal : undefined,
                loud: !!unacknowledged,
            },
            { label: I18n.t('Active'), value: active, color: active ? LEVEL_COLORS.alarm : undefined },
            { label: I18n.t('Warnings'), value: warnings, color: warnings ? LEVEL_COLORS.warning : undefined },
            { label: I18n.t('Events'), value: events },
        ];

        return (
            <div style={styles.summary}>
                {cells.map(cell => (
                    <div
                        key={cell.label}
                        style={styles.summaryCell}
                    >
                        <span style={{ ...styles.summaryValue, color: cell.color }}>{cell.value}</span>
                        <span style={styles.summaryLabel}>{cell.label}</span>
                    </div>
                ))}
            </div>
        );
    }

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
                        {`${item.count} × ${levelLabel(item.level)}`}
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
                                {levelLabel(level).toUpperCase()}
                            </span>
                        </MenuItem>
                    ))}
                </Select>

                <Tooltip
                    title={I18n.t('Acknowledge all messages')}
                    slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                >
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
                    {!narrowWidth ? <TableCell align="right">{I18n.t('Acknowledged at')}</TableCell> : null}
                    {!narrowWidth ? <TableCell align="right">{I18n.t('Gone at')}</TableCell> : null}
                    {this.props.native.icons ? <TableCell padding="none" /> : null}
                    <TableCell>{I18n.t('Message')}</TableCell>
                    {!narrowWidth ? <TableCell align="right">{I18n.t('Value')}</TableCell> : null}
                    {!narrowWidth ? <TableCell align="right">{I18n.t('Count')}</TableCell> : null}
                    {!narrowWidth ? <TableCell align="right">{I18n.t('Priority')}</TableCell> : null}
                    {!narrowWidth ? <TableCell>{I18n.t('Group')}</TableCell> : null}
                    {!narrowWidth && this.props.native.stateId ? <TableCell>{I18n.t('State ID')}</TableCell> : null}
                    <TableCell padding="none" />
                </TableRow>
            </TableHead>
        );
    }

    /** The combined state and what it means, in the notation used in control rooms */
    static renderState(row: FormattedMessage): JSX.Element {
        let explanation: string;

        if (!row.requiresAck) {
            // nobody has to confirm this one, so saying "not acknowledged" would ask for something
            // that is not wanted
            explanation = row.active ? I18n.t('came') : I18n.t('gone');
        } else if (row.acked) {
            explanation = row.active ? I18n.t('came, acknowledged') : I18n.t('gone, acknowledged');
        } else {
            explanation = row.active ? I18n.t('came, not acknowledged') : I18n.t('gone, not acknowledged');
        }

        return (
            <Tooltip
                title={explanation}
                slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
            >
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
                // what nobody has seen yet must catch the eye, what has gone may fade
                style={{ ...(row.active ? undefined : styles.gone), ...(row.ackable ? styles.unacknowledged : {}) }}
            >
                <TableCell style={styles.tdNarrow}>
                    <span
                        style={{ ...styles.levelChip, backgroundColor: row.color || LEVEL_COLORS[row.level] }}
                        title={row.alarmName || levelLabel(row.level)}
                    >
                        {(row.alarmName || levelLabel(row.level)).toUpperCase()}
                    </span>
                </TableCell>
                <TableCell align="center">{Messages.renderState(row)}</TableCell>
                <TableCell
                    align="right"
                    style={styles.tdNarrow}
                >
                    <Tooltip
                        title={moment(row.ts).format(dateFormat)}
                        slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                    >
                        <span>{Messages.ageText(Date.now() - row.ts)}</span>
                    </Tooltip>
                </TableCell>
                {!narrowWidth ? (
                    <TableCell
                        align="right"
                        style={styles.tdNarrow}
                        title={row.ackUser ? `${I18n.t('Acknowledged')}: ${row.ackUser}` : undefined}
                    >
                        {row.ackTs ? moment(row.ackTs).format(dateFormat) : ''}
                    </TableCell>
                ) : null}
                {!narrowWidth ? (
                    <TableCell
                        align="right"
                        style={styles.tdNarrow}
                    >
                        {row.goneTs ? moment(row.goneTs).format(dateFormat) : ''}
                    </TableCell>
                ) : null}
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
                        <Tooltip
                            title={I18n.t('First message of the group')}
                            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                        >
                            <IconFirst
                                fontSize="small"
                                style={{ verticalAlign: 'middle', marginLeft: 4 }}
                            />
                        </Tooltip>
                    ) : null}
                    {row.flapping ? (
                        <Tooltip
                            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                            title={I18n.t('This message changes too often, its transitions are not written')}
                        >
                            <IconFlapping
                                fontSize="small"
                                style={{ verticalAlign: 'middle', marginLeft: 4 }}
                            />
                        </Tooltip>
                    ) : null}
                </TableCell>
                {!narrowWidth ? <TableCell align="right">{this.renderValue(row)}</TableCell> : null}
                {!narrowWidth ? <TableCell align="right">{row.count > 1 ? row.count : ''}</TableCell> : null}
                {!narrowWidth ? <TableCell align="right">{row.priority}</TableCell> : null}
                {!narrowWidth ? <TableCell>{row.group || ''}</TableCell> : null}
                {!narrowWidth && this.props.native.stateId ? (
                    <TableCell>{this.renderStateId(row.stateId)}</TableCell>
                ) : null}
                <TableCell padding="none">
                    {row.ackable ? (
                        <Tooltip
                            title={I18n.t('Acknowledge')}
                            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                        >
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
                {Messages.renderSummary(this.state.messages, this.state.eventCount)}
                {this.renderSuppressions()}
                {this.renderTable(messages)}
                {this.renderToast()}
            </Paper>
        );
    }
}

export default withWidth()(Messages) as unknown as ComponentType<Omit<MessagesProps, 'width'>>;
