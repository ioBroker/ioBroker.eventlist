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

/** Settings of one state value (true/false or one enum value) as edited in the GUI */
export type StateValueSettings = {
    val: string;
    text: string;
    color: string;
    icon: string;
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
    simulateState?: boolean | null;
    /** Icon of the object or of the parent channel/device */
    ownIcon?: string;
    /** Color of the object or of the parent channel/device */
    ownColor?: string;
};
