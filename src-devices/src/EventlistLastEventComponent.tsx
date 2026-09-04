// Eventlist widget for the ioBroker device manager.
//
// The tile shows the newest entry of the event list, the click opens a dialog with the whole list.
//
// Data source: the eventlist adapter keeps the formatted list in one state
//
//     eventlist.<instance>.eventJSONList
//
// It holds a JSON array, newest event first, with the entries already formatted for display:
// `{ _id, ts, event, val, duration, icon, id, _style }`. The widget only has to subscribe to that
// one state, so it needs no adapter message and no object lookups.

import WidgetGeneric, {
    React,
    MuiMaterial,
    getTileStyles,
    isNeumorphicTheme,
    AdapterReact,
    type WidgetGenericProps,
    type WidgetGenericState,
    type CustomWidgetPlugin,
} from '@iobroker/dm-widgets';
import type {
    BoxProps,
    TypographyProps,
    DialogProps,
    DialogTitleProps,
    DialogContentProps,
    DialogActionsProps,
    ButtonProps,
} from '@mui/material';
import type { ConfigItemPanel, ConfigItemTabs } from '@iobroker/dm-utils';
import type { ConfigItemPanel as JsonConfigItemPanel } from '@iobroker/json-config';
import type { I18n as I18nType, Icon as IconType } from '@iobroker/gui-components';

// The MUI components come from the host through the dm-widgets bridge, never from a direct
// `@mui/material` import - the widget has to share the host's React and MUI instances.
const Box: React.ComponentType<BoxProps> = MuiMaterial?.Box;
const Typography: React.ComponentType<TypographyProps> = MuiMaterial?.Typography;
const Dialog: React.ComponentType<DialogProps> = MuiMaterial?.Dialog;
const DialogTitle: React.ComponentType<DialogTitleProps> = MuiMaterial?.DialogTitle;
const DialogContent: React.ComponentType<DialogContentProps> = MuiMaterial?.DialogContent;
const DialogActions: React.ComponentType<DialogActionsProps> = MuiMaterial?.DialogActions;
const Button: React.ComponentType<ButtonProps> = MuiMaterial?.Button;
const I18n = AdapterReact.I18n as typeof I18nType;
const Icon = AdapterReact.Icon as typeof IconType;

/** One entry of `eventJSONList`, as the adapter writes it */
interface FormattedEvent {
    /** Timestamp in ms, unique inside the list */
    _id: number;
    /** Already formatted time, absolute or relative */
    ts: string;
    event: string;
    val?: string | number | boolean | null;
    /** Already formatted duration */
    duration?: string;
    icon?: string;
    /** State ID the event belongs to */
    id?: string;
    /** Style of the line, carries the colour of the event */
    _style?: { color?: string };
}

interface EventlistLastEventSettings extends CustomWidgetPlugin {
    /** eventlist adapter instance, e.g. "eventlist.0" */
    instance?: string;
    /** Comma separated state IDs. Empty shows every event. */
    filter?: string;
    /** Maximum number of rows in the dialog */
    maxRows?: number;
    showValue?: boolean;
    showDuration?: boolean;
}

interface EventlistLastEventState extends WidgetGenericState {
    /** The list, newest first. Null until the first sample arrives. */
    events: FormattedEvent[] | null;
    dialogOpen: boolean;
}

/** Parses the state value of `eventJSONList`, which is a JSON string */
export function parseEventList(value: unknown): FormattedEvent[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value as FormattedEvent[];
    }
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            return Array.isArray(parsed) ? (parsed as FormattedEvent[]) : [];
        } catch {
            return [];
        }
    }
    return [];
}

export class EventlistLastEventComponent extends WidgetGeneric<
    EventlistLastEventState,
    EventlistLastEventSettings
> {
    /** The subscribed state, so the widget can unsubscribe from exactly that one */
    private subscribedId: string | null = null;
    private readonly onListChanged = (_id: string, state: ioBroker.State | null | undefined): void => {
        this.setState({ events: parseEventList(state?.val) });
    };

    constructor(props: WidgetGenericProps<EventlistLastEventSettings>) {
        super(props);
        this.state = {
            ...this.state,
            events: null,
            dialogOpen: false,
        };
    }

    static override getConfigSchema(): { name: string; schema: ConfigItemPanel | ConfigItemTabs } {
        const schema: JsonConfigItemPanel = {
            type: 'panel',
            items: {
                instance: {
                    type: 'instance',
                    adapter: 'eventlist',
                    label: 'evl_instance',
                    default: 'eventlist.0',
                    sm: 12,
                },
                filter: {
                    type: 'text',
                    label: 'evl_filter',
                    tooltip: 'evl_tooltip_filter',
                    sm: 12,
                },
                maxRows: {
                    type: 'number',
                    label: 'evl_max_rows',
                    min: 0,
                    default: 30,
                    sm: 6,
                },
                icon: {
                    type: 'component',
                    subType: 'iconSelect',
                    label: 'evl_icon',
                    sm: 6,
                },
                showValue: {
                    type: 'checkbox',
                    label: 'evl_show_value',
                    default: true,
                    sm: 6,
                },
                showDuration: {
                    type: 'checkbox',
                    label: 'evl_show_duration',
                    default: false,
                    sm: 6,
                },
                name: {
                    type: 'text',
                    label: 'evl_name',
                    sm: 12,
                },
            },
        };

        return { name: 'EventlistLastEvent', schema: schema as unknown as ConfigItemPanel };
    }

    componentDidMount(): void {
        super.componentDidMount?.();
        this.subscribe();
    }

    componentDidUpdate(prevProps: Readonly<WidgetGenericProps<EventlistLastEventSettings>>): void {
        super.componentDidUpdate?.(prevProps, this.state);
        if (prevProps.settings.instance !== this.props.settings.instance) {
            this.unsubscribe();
            this.setState({ events: null });
            this.subscribe();
        }
    }

    componentWillUnmount(): void {
        super.componentWillUnmount?.();
        this.unsubscribe();
    }

    private subscribe(): void {
        this.subscribedId = `${this.props.settings.instance || 'eventlist.0'}.eventJSONList`;
        this.props.stateContext.getState(this.subscribedId, this.onListChanged);
    }

    private unsubscribe(): void {
        if (this.subscribedId) {
            this.props.stateContext.removeState(this.subscribedId, this.onListChanged);
            this.subscribedId = null;
        }
    }

    /** The events this widget shows, filtered by the configured state IDs */
    private getEvents(): FormattedEvent[] {
        const events = this.state.events || [];
        const filter = (this.props.settings.filter || '')
            .split(',')
            .map(id => id.trim())
            .filter(id => id);

        return filter.length ? events.filter(event => filter.includes(event.id || '')) : events;
    }

    private getLastEvent(): FormattedEvent | null {
        // the adapter writes the newest event first
        return this.getEvents()[0] || null;
    }

    /** The tile reacts to the click and opens the list */
    protected hasTileAction(): boolean {
        return true;
    }

    protected onTileClick(): void {
        this.setState({ dialogOpen: true });
    }

    /** Active as long as there is something to show */
    protected isTileActive(): boolean {
        return !!this.getLastEvent();
    }

    protected renderTileIcon(): React.JSX.Element | null {
        const event = this.getLastEvent();
        // the event brings its own icon, the configured one is the fallback
        const src = (event?.icon && !event.icon.endsWith('default') && event.icon) || this.props.settings?.icon;
        if (!src) {
            return null;
        }
        return (
            <Icon
                src={src}
                style={{ width: '30%', height: '30%', color: event?._style?.color }}
            />
        );
    }

    /** Body of the tile: the newest event with its time, text and value */
    private renderBody(compact: boolean): React.JSX.Element {
        const event = this.getLastEvent();
        const name = this.props.settings.name;
        const color = event?._style?.color;

        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    gap: compact ? 0.3 : 0.6,
                    overflow: 'hidden',
                    px: 1,
                    py: 1,
                }}
            >
                {this.renderTileIcon()}
                {name ? (
                    <Typography
                        variant={compact ? 'caption' : 'body2'}
                        sx={{
                            fontWeight: 600,
                            opacity: 0.9,
                            maxWidth: '100%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {name}
                    </Typography>
                ) : null}

                {event ? (
                    <>
                        <Typography
                            sx={{
                                fontSize: compact ? '0.85rem' : '1.05rem',
                                fontWeight: 700,
                                color,
                                textAlign: 'center',
                                // the event text can be long, so it is clipped instead of wrapping
                                maxWidth: '100%',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                            title={event.event}
                        >
                            {event.event}
                        </Typography>
                        {this.props.settings.showValue !== false && event.val !== undefined && event.val !== null ? (
                            <Typography
                                sx={{
                                    fontSize: compact ? '0.95rem' : '1.2rem',
                                    fontWeight: 700,
                                    color,
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {event.val.toString()}
                            </Typography>
                        ) : null}
                        <Typography
                            variant="caption"
                            sx={{ opacity: 0.75, whiteSpace: 'nowrap' }}
                        >
                            {event.ts}
                        </Typography>
                    </>
                ) : (
                    <Typography
                        variant="caption"
                        sx={{ opacity: 0.7, fontStyle: 'italic' }}
                    >
                        {I18n.t('evl_no_events')}
                    </Typography>
                )}
            </Box>
        );
    }

    /** The dialog with the whole list, opened by the click on the tile */
    private renderDialog(): React.JSX.Element | null {
        if (!this.state.dialogOpen) {
            return null;
        }
        const maxRows = this.props.settings.maxRows ?? 30;
        const events = maxRows > 0 ? this.getEvents().slice(0, maxRows) : this.getEvents();
        const showValue = this.props.settings.showValue !== false;
        const showDuration = this.props.settings.showDuration === true;

        const headerCell = { textAlign: 'left', padding: '4px 8px', fontWeight: 700, opacity: 0.8 } as const;
        const cell = { padding: '4px 8px', verticalAlign: 'top' } as const;

        return (
            <Dialog
                open
                onClose={() => this.setState({ dialogOpen: false })}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>{this.props.settings.name || I18n.t('evl_title')}</DialogTitle>
                <DialogContent>
                    {events.length ? (
                        <Box
                            component="table"
                            sx={{ width: '100%', borderCollapse: 'collapse' }}
                        >
                            <thead>
                                <tr>
                                    <th style={{ ...headerCell, whiteSpace: 'nowrap' }}>{I18n.t('evl_time')}</th>
                                    <th style={headerCell}>{I18n.t('evl_event')}</th>
                                    {showValue ? <th style={headerCell}>{I18n.t('evl_value')}</th> : null}
                                    {showDuration ? <th style={headerCell}>{I18n.t('evl_duration')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {events.map(event => (
                                    <tr
                                        key={event._id}
                                        style={{ color: event._style?.color }}
                                    >
                                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>{event.ts}</td>
                                        <td style={cell}>{event.event}</td>
                                        {showValue ? (
                                            <td style={cell}>
                                                {event.val === undefined || event.val === null
                                                    ? ''
                                                    : event.val.toString()}
                                            </td>
                                        ) : null}
                                        {showDuration ? <td style={cell}>{event.duration || ''}</td> : null}
                                    </tr>
                                ))}
                            </tbody>
                        </Box>
                    ) : (
                        <Typography sx={{ opacity: 0.7, fontStyle: 'italic' }}>{I18n.t('evl_no_events')}</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        variant="contained"
                        onClick={() => this.setState({ dialogOpen: false })}
                    >
                        {I18n.t('ra_Close')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    renderCompact(): React.JSX.Element {
        const isActive = this.isTileActive();
        const accent = this.getAccentColor();
        const indicators = this.renderIndicators(this.renderSettingsButton());

        return (
            <Box
                id={String(this.props.widget.id)}
                className={this.getWidgetClass()}
                sx={theme => WidgetGeneric.getStyleCompact(theme)}
            >
                <Box
                    title={I18n.t('evl_open_hint')}
                    sx={theme => ({
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                        aspectRatio: '1',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        ...(getTileStyles(theme, isActive, accent, true) as any),
                        padding: isNeumorphicTheme(theme) ? '4px' : '6px',
                    })}
                    onClick={() => this.onTileClick()}
                >
                    {/* the icons of the host must not trigger the tile action */}
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'contents' }}
                    >
                        {indicators}
                    </div>
                    {this.renderBody(true)}
                </Box>
                {this.renderDialog()}
            </Box>
        );
    }

    renderWideTall(): React.JSX.Element {
        const isActive = this.isTileActive();
        const accent = this.getAccentColor();
        const indicators = this.renderIndicators(this.renderSettingsButton());

        return (
            <Box
                id={String(this.props.widget.id)}
                className={this.getWidgetClass()}
                sx={theme => WidgetGeneric.getStyleWideTall(theme)}
            >
                <Box
                    title={I18n.t('evl_open_hint')}
                    sx={theme => ({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        aspectRatio: '2',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        ...(getTileStyles(theme, isActive, accent, true) as any),
                        padding: isNeumorphicTheme(theme) ? '8px' : '12px',
                    })}
                    onClick={() => this.onTileClick()}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'contents' }}
                    >
                        {indicators}
                    </div>
                    {this.renderBody(false)}
                </Box>
                {this.renderDialog()}
            </Box>
        );
    }
}

export default EventlistLastEventComponent;
