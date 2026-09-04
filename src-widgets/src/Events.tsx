import React, { type CSSProperties } from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps, VisRxWidgetState } from '@iobroker/types-vis-2';

import Generic from './Generic';
import { parseEventList, type FormattedEvent } from './types';

type Align = 'left' | 'right' | 'center';

interface EventsRxData {
    instance: string;
    maxRows: string;
    filterById: string;
    defaultStyle: boolean;
    oddBackground: string;
    evenBackground: string;

    showTime: boolean;
    showValue: boolean;
    showDuration: boolean;

    textTime: string;
    textEvent: string;
    textValue: string;
    textDuration: string;

    widthTime: string;
    widthEvent: string;
    widthValue: string;
    widthDuration: string;

    alignTime: Align;
    alignEvent: Align;
    alignValue: Align;
    alignDuration: Align;
}

interface EventsState extends VisRxWidgetState {
    /** Content of `eventlist.<instance>.eventJSONList`, null while it is being read */
    events: FormattedEvent[] | null;
}

/** The columns in the order they are rendered. `event` has no checkbox, it is always shown. */
const COLUMNS = ['time', 'event', 'value', 'duration'] as const;
type Column = (typeof COLUMNS)[number];

const ALIGN_OPTIONS: { value: Align; label: Align }[] = [
    { value: 'left', label: 'left' },
    { value: 'right', label: 'right' },
    { value: 'center', label: 'center' },
];

/** Columns whose visibility can be switched off */
const OPTIONAL: Column[] = ['time', 'value', 'duration'];

const styles: Record<string, CSSProperties> = {
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
    },
    cell: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    empty: {
        opacity: 0.6,
        fontStyle: 'italic',
        padding: 4,
    },
};

/** Header and row background of the "default style", the same look the vis-1 widget has */
const DEFAULT_STYLE = {
    header: { backgroundColor: '#000000', color: '#FFFFFF', fontWeight: 'bold' } as CSSProperties,
    odd: '#a9a9a9',
    even: '#d3d3d3',
};

export default class Events extends Generic<EventsRxData, EventsState> {
    /** The state this widget is subscribed to, so it can unsubscribe from exactly that one */
    private subscribedId = '';

    constructor(props: VisRxWidgetProps) {
        super(props);
        this.state = { ...this.state, events: null };
    }

    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplEventlist',
            visSet: 'eventlist',
            visSetLabel: 'events',
            visName: 'Events',
            visWidgetLabel: 'events',
            visPrev: 'widgets/eventlist/img/Prev_Eventlist.png',
            visAttrs: [
                {
                    name: 'common',
                    label: 'group_common',
                    fields: [
                        {
                            name: 'instance',
                            type: 'instance',
                            adapter: 'eventlist',
                            isShort: true,
                            default: '0',
                            label: 'instance',
                        },
                        { name: 'maxRows', type: 'number', min: 0, label: 'max_rows' },
                        { name: 'filterById', type: 'text', label: 'filter_by_id', tooltip: 'tooltip_filter_by_id' },
                        {
                            name: 'defaultStyle',
                            type: 'checkbox',
                            default: true,
                            label: 'default_style',
                            tooltip: 'tooltip_default_style',
                        },
                        {
                            name: 'oddBackground',
                            type: 'color',
                            label: 'odd_background',
                            hidden: '!!data.defaultStyle',
                        },
                        {
                            name: 'evenBackground',
                            type: 'color',
                            label: 'even_background',
                            hidden: '!!data.defaultStyle',
                        },
                    ],
                },
                {
                    name: 'header',
                    label: 'group_header',
                    fields: OPTIONAL.map(column => ({
                        name: `show${Events.upperFirst(column)}`,
                        type: 'checkbox' as const,
                        default: true,
                        label: `show_${column}`,
                    })),
                },
                {
                    name: 'headerTitle',
                    label: 'group_header_title',
                    fields: COLUMNS.map(column => ({
                        name: `text${Events.upperFirst(column)}`,
                        type: 'text' as const,
                        label: `text_${column}`,
                    })),
                },
                {
                    name: 'headerWidths',
                    label: 'group_header_widths',
                    fields: COLUMNS.map(column => ({
                        name: `width${Events.upperFirst(column)}`,
                        type: 'text' as const,
                        label: `width_${column}`,
                    })),
                },
                {
                    name: 'headerAligns',
                    label: 'group_header_aligns',
                    fields: COLUMNS.map(column => ({
                        name: `align${Events.upperFirst(column)}`,
                        type: 'select' as const,
                        noTranslation: true,
                        options: ALIGN_OPTIONS,
                        default: column === 'event' ? 'left' : 'right',
                        label: `align_${column}`,
                    })),
                },
            ],
            visDefaultStyle: {
                width: 300,
                height: 150,
                position: 'relative',
            },
        };
    }

    static upperFirst(text: string): string {
        return text[0].toUpperCase() + text.substring(1);
    }

    getWidgetInfo(): RxWidgetInfo {
        return Events.getWidgetInfo();
    }

    componentDidMount(): void {
        super.componentDidMount();
        void this.subscribe();
    }

    componentWillUnmount(): void {
        this.unsubscribe();
        super.componentWillUnmount();
    }

    onRxDataChanged(): void {
        // the instance can be changed in the editor at any time
        if (this.subscribedId !== this.getStateId('eventJSONList')) {
            this.unsubscribe();
            void this.subscribe();
        }
    }

    onListChanged = (_id: string, state: ioBroker.State | null | undefined): void => {
        this.setState({ events: parseEventList(state?.val) });
    };

    async subscribe(): Promise<void> {
        this.subscribedId = this.getStateId('eventJSONList');
        const id = this.subscribedId;
        try {
            await this.props.context.socket.subscribeState(id, this.onListChanged);
        } catch (e) {
            console.warn(`Cannot subscribe on ${id}: ${e as string}`);
            // show an empty list instead of the endless "loading"
            if (this.subscribedId === id) {
                this.setState({ events: [] });
            }
        }
    }

    unsubscribe(): void {
        if (this.subscribedId) {
            this.props.context.socket.unsubscribeState(this.subscribedId, this.onListChanged);
            this.subscribedId = '';
        }
    }

    /** The IDs the list is filtered by, or null if everything is shown */
    getFilter(): string[] | null {
        const filter = (this.state.rxData.filterById || '')
            .split(',')
            .map(id => id.trim())
            .filter(id => id);

        return filter.length ? filter : null;
    }

    isVisible(column: Column): boolean {
        if (column === 'event') {
            return true;
        }
        const value = (this.state.rxData as unknown as Record<string, boolean | undefined>)[
            `show${Events.upperFirst(column)}`
        ];
        return value === undefined ? true : !!value;
    }

    getColumnData(column: Column): { title: string; width: string | undefined; align: Align } {
        const rxData = this.state.rxData as unknown as Record<string, string | undefined>;
        const title = rxData[`text${Events.upperFirst(column)}`];
        const width = rxData[`width${Events.upperFirst(column)}`];

        return {
            // "_" was the vis-1 marker for "use the default title"
            title: !title || title === '_' ? Generic.t(`header_${column}`) : title,
            // a plain number means pixels
            width: width ? (width === parseFloat(width).toString() ? `${width}px` : width) : undefined,
            align: (rxData[`align${Events.upperFirst(column)}`] as Align) || (column === 'event' ? 'left' : 'right'),
        };
    }

    /** In the editor an empty list would show nothing at all, so one sample line is rendered */
    static getSampleEvents(): FormattedEvent[] {
        return [
            {
                _id: Date.now(),
                ts: new Date().toLocaleTimeString(),
                event: Generic.t('sample_event'),
                val: '5°C',
                duration: '1h 2s',
            },
        ];
    }

    getVisibleEvents(): FormattedEvent[] {
        let events = this.state.events || [];

        if (!events.length && this.props.editMode) {
            events = Events.getSampleEvents();
        }

        const filter = this.getFilter();
        if (filter) {
            events = events.filter(event => filter.includes(event.id || ''));
        }

        const maxRows = parseInt(this.state.rxData.maxRows, 10) || 0;
        return maxRows > 0 ? events.slice(0, maxRows) : events;
    }

    getRowStyle(index: number): CSSProperties {
        const { defaultStyle, oddBackground, evenBackground } = this.state.rxData;
        const odd = !!(index % 2);

        if (defaultStyle) {
            return { backgroundColor: odd ? DEFAULT_STYLE.odd : DEFAULT_STYLE.even };
        }
        const background = odd ? oddBackground : evenBackground;
        return background ? { backgroundColor: background } : {};
    }

    renderHeader(columns: Column[]): React.JSX.Element {
        return (
            <thead>
                <tr style={this.state.rxData.defaultStyle ? DEFAULT_STYLE.header : undefined}>
                    {columns.map(column => {
                        const { title, width, align } = this.getColumnData(column);
                        return (
                            <th
                                key={column}
                                style={{ ...styles.cell, width, textAlign: align }}
                            >
                                {title}
                            </th>
                        );
                    })}
                </tr>
            </thead>
        );
    }

    renderRow(event: FormattedEvent, index: number, columns: Column[]): React.JSX.Element {
        return (
            <tr
                key={event._id ?? index}
                style={{ ...this.getRowStyle(index), ...event._style }}
            >
                {columns.map(column => {
                    const { align } = this.getColumnData(column);
                    let content: string;
                    if (column === 'time') {
                        content = event.ts;
                    } else if (column === 'event') {
                        content = event.event;
                    } else if (column === 'value') {
                        content = event.val === undefined || event.val === null ? '' : event.val.toString();
                    } else {
                        content = event.duration || '';
                    }

                    return (
                        <td
                            key={column}
                            style={{ ...styles.cell, textAlign: align }}
                            title={content}
                        >
                            {content}
                        </td>
                    );
                })}
            </tr>
        );
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);

        const columns = COLUMNS.filter(column => this.isVisible(column));
        const events = this.getVisibleEvents();

        return (
            <div style={{ width: '100%', height: '100%', overflowX: 'hidden', overflowY: 'auto' }}>
                <table style={styles.table}>
                    {this.renderHeader(columns)}
                    <tbody>{events.map((event, index) => this.renderRow(event, index, columns))}</tbody>
                </table>
                {!events.length && this.state.events ? (
                    <div style={styles.empty}>{Generic.t('no_events')}</div>
                ) : null}
            </div>
        );
    }
}
