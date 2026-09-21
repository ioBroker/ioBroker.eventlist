/**
 * Shared types of the eventlist admin/web GUI
 */

import type { AlarmClass, MessageLevel } from './levels';

/** Default text/color/icon for a specific (string or numeric) state value */
export type DefaultStringText = {
    /** State value for which the defaults should be used */
    value: string;
    /** Text for the value */
    text: string;
    /** Color for the value */
    color: string;
    /** Icon for the value */
    icon?: string;
};

export type PdfMargins = {
    top: number;
    bottom: number;
    left: number;
    right: number;
};

/** Settings for the PDF generation. Same structure as in the backend (lib/list2pdf.ts) */
export type PdfSettings = {
    orientation: 'portrait' | 'landscape';
    enabledTime: boolean;
    enabledEvent?: boolean;
    enabledValue: boolean;
    enabledDuration: boolean;
    widthTime: number;
    widthEvent: number;
    widthValue: number;
    widthDuration: number;
    textTime: string;
    textEvent: string;
    textValue: string;
    textDuration: string;
    paddingLeft: number;
    paddingTopFirst: number;
    paddingTop: number;
    pageWidth: number;
    pageHeight: number;
    textColor: string;
    fontSize: number;
    colorLineOdd: string;
    colorLineEven: string;
    lineHeight: number;
    colorHeaderBackground: string;
    colorHeader: string;
    fontSizeHeader: number;
    enabledHeader: boolean;
    titleColor: string;
    titleText: string;
    titleFontSize: number;
    pageNumberOffsetX: number;
    pageNumberOffsetY: number;
    pageNumberFontSize: number;
    pageNumberColor: string;
    pageNumberEnabled: boolean;
    margins: PdfMargins;
};

/** Native configuration of the adapter instance (io-package.json => native) */
export type EventListNative = {
    maxLength: number;
    dateFormat: string;
    relativeTime: number;
    defaultBooleanTextTrue: string;
    defaultBooleanTextFalse: string;
    defaultBooleanText: string;
    defaultBooleanColorTrue: string;
    defaultBooleanColorFalse: string;
    defaultBooleanIconTrue: string;
    defaultBooleanIconFalse: string;
    defaultNonBooleanText: string;
    defaultStringTexts: DefaultStringText[];
    language: ioBroker.Languages | '';
    stateId: boolean;
    icons: boolean;
    duration: boolean;
    license: string;
    pdfButton: boolean;
    pdfSettings: PdfSettings;
    defaultWhatsAppCMB: string[];
    defaultTelegram: string[];
    defaultPushover: string[];
    deleteAlarmsByDisable: boolean;
    /** From which level on the horn sounds. Empty switches it off. */
    hornLevel: MessageLevel | '';
    /** What differs from the twelve built-in alarm classes, and the classes the user added */
    alarmClasses: AlarmClass[];
    /** More transitions than this inside the window count as flapping. 0 switches the protection off. */
    flappingCount: number;
    /** Length of the flapping window in minutes */
    flappingInterval: number;
    /** Duration of a suppression in minutes, if none is given */
    suppressDefault: number;
    /** How many alarm cycles the journal keeps. 0 switches it off. */
    journalLength: number;
    /** Whether a closed cycle is written into the monthly file `journal/<YYYY-MM>.jsonl` */
    journalArchive: boolean;
};

/** One line of the formatted event list (state `eventJSONList`) */
export type FormattedEvent = {
    /** Timestamp in ms. Used as unique ID */
    _id: number;
    event: string;
    /** Formatted time */
    ts: string;
    _style?: { color: string };
    icon?: string;
    /** Formatted duration */
    duration?: string;
    val?: string | number | boolean | null;
    /** State ID */
    id?: string;
    /** Duration is still running */
    dr?: number;
    /** State ID (merged in GUI from the raw list) */
    stateId?: string;
    /** Level, if the event comes from a standing message */
    level?: MessageLevel;
    /** What happened to the message */
    transition?: MessageTransition;
};

/** What happened to a standing message, as the event list writes it down */
export type MessageTransition = 'came' | 'gone' | 'ack' | 'flapping' | 'settled';

/** One line of the raw event list (state `eventListRaw`) */
export type RawEvent = {
    ts: number;
    event?: string;
    id?: string;
    val?: string | number | boolean | null;
    oldVal?: string | number | boolean | null;
    icon?: string;
    color?: string;
    duration?: number;
    diff?: number;
    /** Level of the message this event belongs to */
    level?: MessageLevel;
    /** What happened to the message */
    transition?: MessageTransition;
};

/** Custom event that will be sent to the instance with the command "insert" */
export type InsertEvent = {
    event: string;
    ts?: string;
    icon?: string;
    val?: number | boolean | string;
};

/** One standing message, as the adapter writes it into `messages.list` */
export type FormattedMessage = {
    id: string;
    level: MessageLevel;
    /** Id of the alarm class it belongs to */
    alarmClass?: string;
    /** Name of the class, empty for one of the twelve built-in ones */
    alarmName?: string;
    /** 1 to 1000, as OPC UA counts it */
    severity: number;
    text: string;
    /** K = came, KQ = came and acknowledged, KG = gone and not acknowledged */
    state: 'K' | 'KQ' | 'KG' | 'KGQ';
    active: boolean;
    acked: boolean;
    requiresAck: boolean;
    /** True while the user can still acknowledge it */
    ackable: boolean;
    /** When it came the first time in the current standing period */
    ts: number;
    /** When it came the last time */
    lastTs: number;
    /** When it went, as long as it is still in the list */
    goneTs?: number;
    /** When it was acknowledged, and by whom */
    ackTs?: number;
    ackUser?: string;
    /** How often it came in the current standing period */
    count: number;
    priority: number;
    stateId?: string;
    val?: string | number | boolean | null;
    /** Unit of the value, as the state settings give it */
    unit?: string;
    icon?: string;
    color: string;
    group?: string;
    /** The first message of its group, the one that probably caused the others */
    first?: boolean;
    /** It changes too often, its transitions are not written any more */
    flapping?: boolean;
};

/** A suppressed message or group, as the adapter writes it into `messages.suppressed` */
export type Suppression = {
    /** Message id, group name or `*` */
    target: string;
    /** Time at which the suppression ends */
    until: number;
};

/** The levels and everything around them live in their own file, the GUI only passes them on */
export { LEVELS as MESSAGE_LEVELS, LEVEL_COLORS, ACK_BY_DEFAULT as DEFAULT_ACK } from './levels';
export type { AlarmClass, MessageLevel, SubLevel } from './levels';

export const MESSAGE_OPERATORS = ['>', '>=', '<', '<=', '==', '!='] as const;

export type MessageOperator = (typeof MESSAGE_OPERATORS)[number];

/** When a state raises a message */
export type MessageCondition = {
    /** Comparison for numbers */
    operator?: MessageOperator;
    limit?: number;
    /** The value that raises the message, for booleans and texts */
    value?: string | number | boolean;
};

/**
 * One limit of a numeric state, with the level it raises.
 *
 * Several of them make a ladder: `> 200` a warning, `> 300` a fatal. The most severe limit that is
 * reached wins, so the state raises one message whose level follows the value.
 */
export type MessageLimit = {
    /** Id of the alarm class this limit raises */
    alarmClass: string;
    /** Comparison, `>` if it is missing */
    operator?: MessageOperator;
    limit: number;
    /** How far the value has to come back before this limit lets go again */
    hysteresis?: number;
    /** Text of this limit. Without it the text of the whole state is used. */
    text?: string;
    /** Whether this limit has to be acknowledged. Without it the default of its level counts. */
    requiresAck?: boolean;
    /** 0 to 100, sorts only inside the level */
    priority?: number;
};

/** Settings of the standing message a state raises */
export type MessageSettings = {
    /** Id of the alarm class the state raises */
    alarmClass?: string;
    /** The ladder of limits. If it is there, it replaces `alarmClass` and `condition`. */
    limits?: MessageLimit[];
    /** 0 to 100, only sorts inside the level */
    priority?: number;
    requiresAck?: boolean;
    text?: string;
    condition?: MessageCondition;
    /** Only for numbers: how far the value has to come back over the limit before the message goes */
    hysteresis?: number;
    /** The condition has to hold that many milliseconds before the message comes */
    delay?: number;
    /** The condition has to be false that many milliseconds before the message goes */
    delayGone?: number;
    /** Free name of a group, for the collective acknowledgement and the first message of a group */
    group?: string;
};

export type StateValueSettings = {
    val: string;
    text: string;
    color: string;
    icon: string;
    /** Id of the alarm class this value raises */
    alarmClass?: string;
    /** Original name of the value (from `common.states`) */
    original?: string;
    disabled?: boolean;
    /** Use default text */
    defText?: boolean;
    /** Use default color */
    defColor?: boolean;
    /** Use default icon */
    defIcon?: boolean;
};

/** Settings of one state value as stored in `object.common.custom[namespace].states` */
export type StoredStateValueSettings = {
    val: string;
    text?: string;
    color?: string;
    icon?: string;
    disabled?: boolean;
    /** Id of the alarm class this value raises */
    alarmClass?: string;
};

/** Settings as stored in `object.common.custom[namespace]` */
export type StoredStateSettings = {
    enabled: boolean;
    event: string;
    changesOnly: boolean;
    defaultMessengers: boolean;
    color?: string;
    icon?: string;
    alarmsOnly?: boolean;
    messagesInAlarmsOnly?: boolean;
    /** Only the transitions of the standing message go into the event list, not every value change */
    messagesOnly?: boolean;
    pushover?: string[];
    telegram?: string[];
    whatsAppCMB?: string[];
    states?: StoredStateValueSettings[];
    message?: MessageSettings;
};

/** Settings of one state as edited in the GUI */
export type EditStateSettings = {
    type: ioBroker.CommonType | '';
    name: string;
    unit: string;
    whatsAppCMB: string[];
    pushover: string[];
    telegram: string[];
    event: string;
    /** Use the default event text */
    eventDefault?: boolean;
    icon: string;
    color: string;
    alarmsOnly: boolean;
    messagesInAlarmsOnly: boolean;
    /** Only the transitions of the standing message go into the event list, not every value change */
    messagesOnly?: boolean;
    changesOnly?: boolean;
    defaultMessengers?: boolean;
    states?: StateValueSettings[] | null;
    /** Settings of the standing message this state raises */
    message?: MessageSettings;
    simulateState?: boolean | null;
    /** Icon of the object or of the parent channel/device */
    ownIcon?: string;
    /** Color of the object or of the parent channel/device */
    ownColor?: string;
};
