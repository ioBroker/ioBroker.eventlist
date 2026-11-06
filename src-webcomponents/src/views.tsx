/**
 * The parts the elements are drawn of: the hint, the tables of events, alarms and alarm cycles, the panel with all of
 * them and the tile. Plain React into the shadow root - the styles are in `styles.ts`.
 */
import type { CSSProperties, JSX, KeyboardEvent, ReactNode } from 'react';

import {
    ageText,
    exactTime,
    formatValue,
    getLevelText,
    getMessageColor,
    LEVEL_COLORS,
    type AlarmCycle,
    type FormattedEvent,
    type FormattedMessage,
} from './data';
import type { Word } from './i18n';
import type { AgeWord, AlarmsPanelWord, EventTableWord, JournalTableWord, MessageTableWord } from './words';

/** A list: the picture of the hint */
const LIST_PATH = 'M3 13h2v-2H3zm0 4h2v-2H3zm0-8h2V7H3zm4 4h14v-2H7zm0 4h14v-2H7zM7 7v2h14V7z';

/** A check mark in a circle: no alarm stands */
const OK_PATH =
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z';

/**
 * A hint instead of the content: a setting is missing or names nothing of the eventlist adapter
 *
 * @param props the text and whether the host is in edit mode
 * @param props.text what to say
 * @param props.editMode in edit mode the element takes no clicks
 */
export function Hint({ text, editMode }: { text: string; editMode: boolean }): JSX.Element {
    return (
        <div className={`hint${editMode ? ' edit' : ''}`}>
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path d={LIST_PATH} />
            </svg>
            <span>{text}</span>
        </div>
    );
}

/** Which of the optional columns of the event table are shown, and their titles if they are set */
export interface EventColumns {
    time: boolean;
    value: boolean;
    duration: boolean;
    titles?: { time?: string; event?: string; value?: string; duration?: string };
}

/**
 * The events, newest first
 *
 * @param props the events and the columns
 * @param props.events the rows; null while the list is read
 * @param props.columns which columns, with which titles
 * @param props.word the words in the language of the system
 */
export function EventTable({
    events,
    columns,
    word,
}: {
    events: FormattedEvent[] | null;
    columns: EventColumns;
    word: Word<EventTableWord>;
}): JSX.Element {
    const title = (key: 'time' | 'event' | 'value' | 'duration'): string => {
        const text = columns.titles?.[key]?.trim();
        // "_" was the vis-1 marker for "the default title"
        return text && text !== '_' ? text : word(`header_${key}`);
    };

    return (
        <>
            <table>
                <thead>
                    <tr>
                        {columns.time ? <th className="c-time r">{title('time')}</th> : null}
                        <th>{title('event')}</th>
                        {columns.value ? <th className="c-value r">{title('value')}</th> : null}
                        {columns.duration ? <th className="c-duration r">{title('duration')}</th> : null}
                    </tr>
                </thead>
                <tbody>
                    {(events || []).map((event, index) => (
                        <tr
                            key={`${event._id}-${index}`}
                            style={event._style as CSSProperties | undefined}
                        >
                            {columns.time ? (
                                <td
                                    className="r num"
                                    title={exactTime(event._id)}
                                >
                                    {event.ts}
                                </td>
                            ) : null}
                            <td title={event.event}>{event.event}</td>
                            {columns.value ? <td className="r">{formatValue(event.val)}</td> : null}
                            {columns.duration ? <td className="r num">{event.duration || ''}</td> : null}
                        </tr>
                    ))}
                </tbody>
            </table>
            {events && !events.length ? <div className="empty">{word('no_events')}</div> : null}
        </>
    );
}

/** Which of the optional columns of the alarm table are shown */
export interface MessageColumns {
    since: boolean;
    value: boolean;
    count: boolean;
    group: boolean;
}

/**
 * The standing alarms, most severe first
 *
 * @param props the alarms and the columns
 * @param props.messages the rows; null while the list is read
 * @param props.columns which columns
 * @param props.now the time the ages are computed from
 * @param props.onAck acknowledges an alarm with a click; missing: a click does nothing
 * @param props.word the words in the language of the system
 */
export function MessageTable({
    messages,
    columns,
    now,
    onAck,
    word,
}: {
    messages: FormattedMessage[] | null;
    columns: MessageColumns;
    now: number;
    onAck?: (message: FormattedMessage) => void;
    word: Word<MessageTableWord>;
}): JSX.Element {
    if (messages && !messages.length) {
        return <div className="empty">{word('no_messages')}</div>;
    }
    return (
        <table>
            <thead>
                <tr>
                    <th className="c-level">{word('header_level')}</th>
                    <th className="c-state m">{word('header_state')}</th>
                    {columns.since ? <th className="c-since r">{word('header_since')}</th> : null}
                    <th>{word('header_message')}</th>
                    {columns.value ? <th className="c-mvalue r">{word('header_value')}</th> : null}
                    {columns.count ? <th className="c-count r">{word('header_count')}</th> : null}
                    {columns.group ? <th className="c-group">{word('header_group')}</th> : null}
                </tr>
            </thead>
            <tbody>
                {(messages || []).map(message => {
                    const ackable = !!onAck && message.ackable;
                    const classes = [
                        message.ackable ? 'unacked' : '',
                        message.active ? '' : 'gone',
                        ackable ? 'ackable' : '',
                    ].filter(name => name);
                    const color = getMessageColor(message);
                    return (
                        <tr
                            key={message.id}
                            className={classes.join(' ') || undefined}
                            title={ackable ? word('tooltip_ack') : undefined}
                            onClick={ackable ? () => onAck(message) : undefined}
                        >
                            <td>
                                <span
                                    className="chip"
                                    style={{ backgroundColor: color }}
                                >
                                    {getLevelText(message, word)}
                                </span>
                            </td>
                            <td className="m code">{message.state}</td>
                            {columns.since ? (
                                <td
                                    className="r num"
                                    title={exactTime(message.ts)}
                                >
                                    {ageText(now - message.ts, key => word(key as AgeWord))}
                                </td>
                            ) : null}
                            <td
                                style={{ color }}
                                title={message.text}
                            >
                                {message.text}
                            </td>
                            {columns.value ? <td className="r">{formatValue(message.val, message.unit)}</td> : null}
                            {columns.count ? <td className="r num">{message.count > 1 ? message.count : ''}</td> : null}
                            {columns.group ? <td>{message.group || ''}</td> : null}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/**
 * The alarm cycles, newest first: when each came, how it stands and when it went
 *
 * @param props the cycles
 * @param props.cycles the rows, newest first
 * @param props.word the words in the language of the system
 */
export function JournalTable({ cycles, word }: { cycles: AlarmCycle[]; word: Word<JournalTableWord> }): JSX.Element {
    if (!cycles.length) {
        return <div className="empty">{word('no_journal')}</div>;
    }
    return (
        <table>
            <thead>
                <tr>
                    <th className="c-came">{word('header_came')}</th>
                    <th className="c-level">{word('header_level')}</th>
                    <th className="c-cycle m">{word('header_state')}</th>
                    <th>{word('header_message')}</th>
                    <th className="c-gone r">{word('header_gone')}</th>
                </tr>
            </thead>
            <tbody>
                {cycles.map(cycle => (
                    <tr
                        key={cycle.id}
                        className={cycle.state === 'CLOSED' ? 'closed' : undefined}
                    >
                        <td className="num">{new Date(cycle.activatedAt).toLocaleString()}</td>
                        <td>
                            <span
                                className="chip"
                                style={{ backgroundColor: LEVEL_COLORS[cycle.level] || LEVEL_COLORS.info }}
                            >
                                {getLevelText(cycle, word)}
                            </span>
                        </td>
                        <td className="m">{word(`cycle_${cycle.state}`)}</td>
                        <td title={cycle.text}>{cycle.text}</td>
                        <td className="r num">{cycle.clearedAt ? new Date(cycle.clearedAt).toLocaleString() : ''}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** What the panel of the alarms shows */
export interface AlarmsView {
    /** The standing alarms, filtered and cut; null: not shown */
    messages: FormattedMessage[] | null;
    messageColumns: MessageColumns;
    /** The events, filtered and cut; null: not shown */
    events: FormattedEvent[] | null;
    eventColumns: EventColumns;
    /** The alarm cycles, newest first and cut; null: not shown */
    journal: AlarmCycle[] | null;
    /** The counters above the lists; null: not shown */
    summary: { unacknowledged: number; active: number; events: number } | null;
    /** Share of the height of the alarms when the events are shown too, in percent */
    ratio: number;
    titles: boolean;
    /** Shows the button that saves the journal as CSV */
    onExport: (() => void) | null;
    onAck?: (message: FormattedMessage) => void;
    now: number;
}

/**
 * The counters, the standing alarms, the events and the journal one below the other, as the settings say
 *
 * @param props what to show
 * @param props.view the lists and the columns
 * @param props.dialog drawn into a dialog: the lists take the height they need
 * @param props.editMode in edit mode the element takes no clicks
 * @param props.word the words in the language of the system
 */
export function AlarmsPanel({
    view,
    dialog,
    editMode,
    word,
}: {
    view: AlarmsView;
    dialog?: boolean;
    editMode?: boolean;
    word: Word<AlarmsPanelWord>;
}): JSX.Element {
    const both = !!view.messages && !!view.events;
    const exportButton = view.onExport ? (
        <button
            type="button"
            className="export"
            disabled={!view.journal?.length}
            onClick={view.onExport}
        >
            {word('export_csv')}
        </button>
    ) : null;

    return (
        <div className={`panel${editMode ? ' edit' : ''}`}>
            {view.summary ? (
                <div className="summary">
                    {[
                        {
                            label: word('unacknowledged'),
                            value: view.summary.unacknowledged,
                            color: LEVEL_COLORS.fatal,
                        },
                        { label: word('active'), value: view.summary.active, color: LEVEL_COLORS.alarm },
                        { label: word('events'), value: view.summary.events, color: undefined },
                    ].map(cell => (
                        <span key={cell.label}>
                            <span
                                className="count"
                                style={{ color: cell.value ? cell.color : undefined }}
                            >
                                {cell.value}
                            </span>
                            <span className="label">{cell.label}</span>
                        </span>
                    ))}
                </div>
            ) : null}
            {view.messages ? (
                <>
                    {view.titles ? <div className="title">{word('standing_messages')}</div> : null}
                    <div
                        className="section"
                        style={{ flex: both && !dialog ? view.ratio : 1 }}
                    >
                        <div className="list">
                            <MessageTable
                                messages={view.messages}
                                columns={view.messageColumns}
                                now={view.now}
                                onAck={view.onAck}
                                word={word}
                            />
                        </div>
                    </div>
                </>
            ) : null}
            {view.events ? (
                <>
                    {view.titles ? <div className="title">{word('events')}</div> : null}
                    <div
                        className="section"
                        style={{ flex: both && !dialog ? 100 - view.ratio : 1 }}
                    >
                        <div className="list">
                            <EventTable
                                events={view.events}
                                columns={view.eventColumns}
                                word={word}
                            />
                        </div>
                    </div>
                </>
            ) : null}
            {view.journal ? (
                <>
                    {view.titles || exportButton ? (
                        <div className="title">
                            <span>{view.titles ? word('alarm_journal') : ''}</span>
                            {exportButton}
                        </div>
                    ) : null}
                    <div
                        className="section"
                        style={{ flex: 1 }}
                    >
                        <div className="list">
                            <JournalTable
                                cycles={view.journal}
                                word={word}
                            />
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}

/**
 * The tile: one thing large in the middle, the click opens the lists
 *
 * @param props what the tile shows
 * @param props.icon URL of a picture above the text
 * @param props.accent the color of a standing alarm: the tile is framed in it
 * @param props.hint the tooltip, what a click does
 * @param props.editMode in edit mode the element takes no clicks
 * @param props.onOpen the click
 * @param props.children the texts
 */
export function Tile({
    icon,
    accent,
    hint,
    editMode,
    onOpen,
    children,
}: {
    icon?: string | null;
    accent?: string;
    hint: string;
    editMode: boolean;
    onOpen: () => void;
    children: ReactNode;
}): JSX.Element {
    const clickable = !editMode;
    const classes = ['tile'];
    if (clickable) {
        classes.push('clickable');
    }
    if (editMode) {
        classes.push('edit');
    }
    if (accent) {
        classes.push('alarm');
    }
    if (icon) {
        classes.push('with-icon');
    }

    return (
        <div
            className={classes.join(' ')}
            style={accent ? ({ '--accent': accent } as CSSProperties) : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            title={clickable ? hint : undefined}
            onClick={clickable ? onOpen : undefined}
            onKeyDown={
                clickable
                    ? (e: KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpen();
                          }
                      }
                    : undefined
            }
        >
            {icon ? (
                <img
                    className="icon"
                    src={icon}
                    alt=""
                />
            ) : null}
            <div className="body">{children}</div>
        </div>
    );
}

/** The check mark of a tile without standing alarm */
export function OkIcon(): JSX.Element {
    return (
        <svg
            className="ok"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path d={OK_PATH} />
        </svg>
    );
}
