import PDFDocument from 'pdfkit';
import { Writable, WritableOptions } from 'node:stream';

interface MemStore {
    [key: string]: Buffer;
}

const memStore: MemStore = {};

/**
 * Writable memory stream
 */
class WMStrm extends Writable {
    private readonly key: string;

    constructor(key: string, options?: WritableOptions) {
        super(options);
        this.key = key;
        memStore[key] = Buffer.alloc(0);
    }

    _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        if (chunk) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);

            if (!memStore[this.key]) {
                memStore[this.key] = Buffer.alloc(0);
                console.log(`memstore for ${this.key} is null`);
            }
            memStore[this.key] = Buffer.concat([memStore[this.key], buffer]);
        }
        callback();
    }
}

const FILE_NAME = 'test.pdf';

interface Settings {
    orientation: 'portrait' | 'landscape';
    enabledTime: boolean;
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
    margins: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
}

const SETTINGS: Settings = {
    orientation: 'portrait',
    enabledTime: true,
    enabledValue: true,
    enabledDuration: true,
    widthTime: 105,
    widthEvent: 200,
    widthValue: 110,
    widthDuration: 100,
    textTime: 'Time',
    textEvent: 'Event',
    textValue: 'Value',
    textDuration: 'Duration',
    paddingLeft: 60,
    paddingTopFirst: 120,
    paddingTop: 60,
    pageWidth: 510,
    pageHeight: 740,

    textColor: '#000000',
    fontSize: 10,
    colorLineOdd: '#E8E8E8',
    colorLineEven: '#FFFFFF',
    lineHeight: 18,

    colorHeaderBackground: '#888888',
    colorHeader: '#FFFFFF',
    fontSizeHeader: 13,
    enabledHeader: true,

    titleColor: '#000000',
    titleText: 'Event list on {{YYYY MM DD H:mm:ss}}',
    titleFontSize: 18,

    pageNumberOffsetX: 50,
    pageNumberOffsetY: 10,
    pageNumberFontSize: 10,
    pageNumberColor: '#000000',
    pageNumberEnabled: true,

    margins: {
        top: 30,
        bottom: 30,
        left: 30,
        right: 30,
    },
};

interface Context {
    settings: Settings;
    y?: number;
    odd?: boolean;
    page?: number;
    line?: number;
}

interface LineData {
    ts: string;
    event: string;
    val?: string;
    duration?: string;
}

interface Adapter {
    config: {
        pdfSettings?: Partial<Settings>;
    };
    name: string;
    writeFile: (namespace: string, fileName: string, data: Buffer, options: null, callback: () => void) => void;
    log: {
        debug: (message: string) => void;
    };
}

interface Moment {
    (): MomentInstance;
}

interface MomentInstance {
    format: (format: string) => string;
}

function pdfPlaceTitle(pdf: typeof PDFDocument, context: Context, text: string): void {
    if (text) {
        pdf.fontSize(context.settings.titleFontSize).fillColor(context.settings.titleColor).text(text, 100, 80);
    }
}

function pdfNextPage(
    pdf: typeof PDFDocument,
    context: Context,
    addHeader?: (pdf: typeof PDFDocument, context: Context) => void,
    isForce?: boolean,
): boolean {
    if (context.y! > context.settings.pageHeight || (isForce && context.y! > context.settings.paddingTop)) {
        context.y = context.settings.paddingTop;
        context.odd = true;
        context.line = 0;
        pdfWriteLastPageNumber(pdf, context);
        context.page!++;
        pdf.addPage();
        addHeader?.(pdf, context);
        return true;
    }
    return false;
}

function pdfAddTableHeader(pdf: typeof PDFDocument, context: Context): void {
    if (context.settings.enabledHeader) {
        let posX = context.settings.paddingLeft;
        pdf.rect(posX - 5, context.y!, context.settings.pageWidth, context.settings.lineHeight).fill(
            context.settings.colorHeaderBackground,
        );

        pdf.fillColor(context.settings.colorHeader).fontSize(context.settings.fontSizeHeader);

        if (context.settings.enabledTime) {
            context.settings.textTime && pdf.text(context.settings.textTime, posX, context.y!);
            posX += context.settings.widthTime;
        }

        context.settings.textEvent && pdf.text(context.settings.textEvent, posX, context.y!);
        posX += context.settings.widthEvent;

        if (context.settings.enabledValue) {
            context.settings.textValue && pdf.text(context.settings.textValue, posX, context.y!);
            posX += context.settings.widthValue;
        }
        if (context.settings.enabledDuration) {
            context.settings.textDuration && pdf.text(context.settings.textDuration, posX, context.y!);
        }
        context.y! += context.settings.lineHeight;
    }
}

function pdfWriteOneLine(pdf: typeof PDFDocument, context: Context, data: LineData): void {
    let posX = context.settings.paddingLeft;
    if (context.y === undefined) {
        context.y = context.settings.paddingTopFirst;
        context.odd = true;
        context.page = 1;
        pdfAddTableHeader(pdf, context);
    } else if (!pdfNextPage(pdf, context, pdfAddTableHeader)) {
        context.odd = !context.odd;
    }

    if (context.odd) {
        pdf.rect(posX - 5, context.y! - 3, context.settings.pageWidth, context.settings.lineHeight).fill(
            context.settings.colorLineOdd,
        );
    } else if (context.settings.colorLineEven !== '#FFFFFF' && context.settings.colorLineEven) {
        pdf.rect(posX - 5, context.y! - 3, context.settings.pageWidth, context.settings.lineHeight).fill(
            context.settings.colorLineEven,
        );
    }
    let posY = context.y!;

    pdf.fillColor(context.settings.textColor).fontSize(context.settings.fontSize);

    // Time
    if (context.settings.enabledTime) {
        pdf.text(data.ts, posX, posY);
        posX += context.settings.widthTime;
    }

    // Name
    pdf.text(data.event, posX, posY);
    posX += context.settings.widthEvent;

    // Value
    if (context.settings.enabledValue) {
        pdf.text(data.val, posX, posY);
        posX += context.settings.widthValue;
    }

    // Duration
    if (context.settings.enabledDuration) {
        pdf.text(data.duration, posX, posY);
        //posX += context.settings.widthDuration;
    }

    posY += context.settings.lineHeight;

    context.y = posY;
}

function pdfWriteLastPageNumber(pdf: typeof PDFDocument, context: Context): void {
    if (context.settings.pageNumberEnabled) {
        context.page ||= 1;

        pdf.fillColor(context.settings.pageNumberColor)
            .fontSize(10)
            .text(
                context.page.toString(),
                context.settings.pageWidth + context.settings.pageNumberOffsetX,
                context.settings.pageHeight + context.settings.pageNumberOffsetY,
            );
    }
}

function createPdf(fileName: string, lines: LineData[], settings: Settings, onFinish: () => void): void {
    const pdf = new PDFDocument({
        layout: settings.orientation || 'portrait',
        margins: settings.margins,
    });

    pdf.font(`${__dirname}/DejaVuSans.ttf`);

    const context: Context = { settings };

    pdfPlaceTitle(pdf, context, settings.titleText);

    lines.forEach(data => pdfWriteOneLine(pdf, context, data));

    pdfWriteLastPageNumber(pdf, context);

    const stream = new WMStrm(fileName);
    pdf.pipe(stream);
    pdf.flushPages();
    pdf.end();
    stream.on('finish', () => onFinish());
}

export default function list2pdf(
    adapter: Adapter,
    moment: Moment,
    fileName: string,
    list: LineData[],
    settings?: Partial<Settings>,
): Promise<void> {
    const mergedSettings: Settings = Object.assign({}, SETTINGS, adapter.config.pdfSettings, settings);

    // check that all settings have valid type
    Object.keys(SETTINGS).forEach(attr => {
        const key = attr as keyof Settings;
        if (attr !== 'margins') {
            if (typeof SETTINGS[key] === 'boolean') {
                const value = mergedSettings[key] as any;
                (mergedSettings[key] as any) =
                    value === true || value === 'true' || value === 'on' || value === '1' || value === 1;
            } else if (typeof SETTINGS[key] === 'number') {
                (mergedSettings[key] as any) = parseFloat(mergedSettings[key] as any);
            }
        }
    });
    mergedSettings.margins.top = parseFloat(mergedSettings.margins.top as any);
    mergedSettings.margins.left = parseFloat(mergedSettings.margins.left as any);
    mergedSettings.margins.bottom = parseFloat(mergedSettings.margins.bottom as any);
    mergedSettings.margins.right = parseFloat(mergedSettings.margins.right as any);

    if (mergedSettings.titleText) {
        const m = mergedSettings.titleText.match(/{{([^}]+)}}/);
        if (m) {
            mergedSettings.titleText = mergedSettings.titleText.replace(`{{${m[1]}}}`, moment().format(m[1]));
        }
    }

    return new Promise<void>((resolve, reject) =>
        createPdf(FILE_NAME, list, mergedSettings, () => {
            let error: string | null = null;
            if (!memStore[FILE_NAME]) {
                error = 'File test.pdf is empty';
            }
            adapter.writeFile(adapter.name, fileName, memStore[FILE_NAME] || Buffer.alloc(0), null, () => {
                if (memStore[FILE_NAME] !== undefined) {
                    delete memStore[FILE_NAME];
                    adapter.log.debug(`PDF generated and stored in ${adapter.name}/${fileName}`);
                }
                setImmediate(() => (error ? reject(error) : resolve()));
            });
        }),
    );
}
