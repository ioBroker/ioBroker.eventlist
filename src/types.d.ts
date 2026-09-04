export interface EventListAdapterConfig {
    maxLength: number | string;
    dateFormat: string;
    relativeTime: number;
    defaultBooleanTextTrue: '';
    defaultBooleanTextFalse: '';
    defaultBooleanText: '';
    defaultBooleanColorTrue: '';
    defaultBooleanColorFalse: '';
    defaultBooleanIconTrue: '';
    defaultBooleanIconFalse: '';
    defaultNonBooleanText: '';
    defaultStringTexts: Array<{ value: string; text: string; color: string; icon: string }>;
    language: string;
    stateId: boolean;
    icons: boolean;
    duration: boolean;
    license: string;
    pdfButton: boolean;
    pdfSettings: {
        orientation: 'portrait' | 'landscape';
        enabledTime: true;
        enabledEvent: true;
        enabledValue: true;
        enabledDuration: true;
        widthTime: number;
        widthEvent: number;
        widthValue: number;
        widthDuration: number;
        textTime: string;
        textEvent: string;
        textValue: string;
        textDuration: string;
        textColor: string;
        paddingLeft: number;
        paddingTopFirst: number;
        paddingTop: number;
        pageWidth: number;
        pageHeight: number;
        fontSize: number;
        colorLineOdd: string;
        colorLineEven: string;
        enabledHeader: boolean;
        fontSizeHeader: number;
        colorHeaderBackground: string;
        colorHeader: string;
        titleColor: string;
        titleText: string;
        titleFontSize: number;
        lineHeight: number;
        pageNumberOffsetX: number;
        pageNumberOffsetY: number;
        pageNumberFontSize: number;
        pageNumberColor: string;
        pageNumberEnabled: boolean;
        margins: {
            top: number;
            bottom: number;
            left: number;
            right: number;
        };
    };
    defaultWhatsAppCMB: string[];
    defaultTelegram: string[];
    defaultPushover: string[];
    deleteAlarmsByDisable: boolean;
    /** From which level on the horn sounds. Empty switches it off. */
    hornLevel: '' | 'fatal' | 'error' | 'warning' | 'info';
    /** More transitions than this inside the window count as flapping. 0 switches the protection off. */
    flappingCount: number | string;
    /** Length of the flapping window in minutes */
    flappingInterval: number | string;
    /** Duration of a suppression in minutes, if none is given */
    suppressDefault: number | string;
}
