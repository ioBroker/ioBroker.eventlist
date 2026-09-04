/**
 * Shared types of the eventlist admin/web GUI
 */

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
    /** More transitions than this inside the window count as flapping. 0 switches the protection off. */
    flappingCount: number;
    /** Length of the flapping window in minutes */
    flappingInterval: number;
    /** Duration of a suppression in minutes, if none is given */
    suppressDefault: number;
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
};

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
    /** How often it came in the current standing period */
    count: number;
    priority: number;
    stateId?: string;
    val?: string | number | boolean | null;
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

/** Settings of one state value (true/false or one enum value) as edited in the GUI */
/** Levels of a standing message, ordered from the most to the least severe */
export const MESSAGE_LEVELS = ['fatal', 'error', 'warning', 'info'] as const;

export type MessageLevel = (typeof MESSAGE_LEVELS)[number];

/** Colour of a level, the same one the adapter writes into the event */
export const LEVEL_COLORS: Record<MessageLevel, string> = {
    fatal: '#B3122B',
    error: '#D9601A',
    warning: '#E0A800',
    info: '#4A7FA5',
};

/** Levels that have to be acknowledged unless the message says otherwise */
export const DEFAULT_ACK: Record<MessageLevel, boolean> = {
    fatal: true,
    error: true,
    warning: false,
    info: false,
};

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

/** Settings of the standing message a state raises */
export type MessageSettings = {
    level?: MessageLevel;
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
    /** Level of the message this value raises */
    level?: MessageLevel;
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
    level?: MessageLevel;
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
