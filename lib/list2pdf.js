'use strict';

const PDFDocument = require('pdfkit');

const stream = require('stream');
const util = require('util');
const Writable = stream.Writable;

const memStore = { };

/**
 * @class
 * Writable memory stream
 */
function WMStrm(key, options) {
    // allow use without new operator
    if (!(this instanceof WMStrm)) {
        return new WMStrm(key, options);
    }

    Writable.call(this, options); // init super
    this.key = key; // save key
    memStore[key] = Buffer.alloc(0); // empty
}
util.inherits(WMStrm, Writable);

WMStrm.prototype._write = function (chunk, enc, cb) {
    if (chunk) {
        // our memory store stores things in buffers
        const buffer = (Buffer.isBuffer(chunk)) ?
            chunk :  // already is Buffer use it
            Buffer.from(chunk, enc);  // string, convert

        // concatenate to the buffer already there
        if (!memStore[this.key]) {
            memStore[this.key] = Buffer.alloc(0);
            console.log('memstore for ' + this.key + ' is null');
        }
        memStore[this.key] = Buffer.concat([memStore[this.key], buffer]);
    }
    if (!cb) {
        throw new Error('Callback is empty');
    }
    cb();
};

const FILE_NAME = 'test.pdf';

const SETTINGS = {
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
    }
};

/*
<span>PRINT</span>
<script>
    setTimeout(() => {
        //debugger;
        if (!isInDialog()) {
            $('.my-print-button').hide();
        } else {
            $('.my-print-button').off('click').on('click', () => {
                vis.setValue('javascript.0.triggerPDF', true, true);
                setTimeout(() => {
                    var myWindow=window.open(`/vis.0/pdf/ereignise.pdf`);
                    myWindow.focus();
                }, 400);
            });
        }
    }, 200);
</script>
 */

function pdfPlaceTitle(pdf, context, text) {
    text && pdf
        .fontSize(context.settings.titleFontSize)
        .fillColor(context.settings.titleColor)
        .text(text, 100, 80);
}

function pdfNextPage(pdf, context, addHeader, isForce) {
    if (context.y > context.settings.pageHeight || (isForce && context.y > context.settings.paddingTop)) {
        context.y = context.settings.paddingTop;
        context.odd = true;
        context.line = 0;
        // place page number
        pdfWriteLastPageNumber(pdf, context);
        context.page++;
        pdf.addPage();
        addHeader && addHeader(pdf, context);

        return true;
    } else {
        return false;
    }
}

function pdfAddTableHeader(pdf, context) {
    if (context.settings.enabledHeader) {
        let posX = context.settings.paddingLeft;
        pdf
            .rect(posX - 5, context.y, context.settings.pageWidth, context.settings.lineHeight)
            .fill(context.settings.colorHeaderBackground);

        pdf
            .fillColor(context.settings.colorHeader)
            .fontSize(context.settings.fontSizeHeader);

        if (context.settings.enabledTime) {
            context.settings.textTime && pdf.text(context.settings.textTime, posX, context.y);
            posX += context.settings.widthTime;
        }

        context.settings.textEvent && pdf.text(context.settings.textEvent, posX, context.y);
        posX += context.settings.widthEvent;

        if (context.settings.enabledValue) {
            context.settings.textValue && pdf.text(context.settings.textValue, posX, context.y);
            posX += context.settings.widthValue;
        }
        if (context.settings.enabledDuration) {
            context.settings.textDuration && pdf.text(context.settings.textDuration, posX, context.y);
            //posX += context.settings.widthDuration;
        }
        context.y += context.settings.lineHeight;
    }
}

function pdfWriteOneLine(pdf, context, data) {
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
        pdf
            .rect(posX - 5, context.y - 3, context.settings.pageWidth, context.settings.lineHeight)
            .fill(context.settings.colorLineOdd);
    } else if (context.settings.colorLineEven !== '#FFFFFF' && context.settings.colorLineEven) {
        pdf
            .rect(posX - 5, context.y - 3, context.settings.pageWidth, context.settings.lineHeight)
            .fill(context.settings.colorLineEven);
    }
    let posY = context.y;

    pdf
        .fillColor(context.settings.textColor)
        .fontSize(context.settings.fontSize);

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

function pdfWriteLastPageNumber(pdf, context) {
    if (context.settings.pageNumberEnabled) {
        context.page = context.page || 1;

        pdf
            .fillColor(context.settings.pageNumberColor)
            .fontSize(10)
            .text(
                context.page.toString(),
                context.settings.pageWidth + context.settings.pageNumberOffsetX,
                context.settings.pageHeight + context.settings.pageNumberOffsetY
            );
    }
}

function createPdf(fileName, lines, settings, onFinish) {
    const pdf = new PDFDocument({
        layout: settings.orientation || 'portrait',
        margins: settings.margins,
    });

    pdf.font(__dirname + '/DejaVuSans.ttf');

    const context = {settings};

    pdfPlaceTitle(pdf, context, settings.titleText);

    lines.forEach(data => pdfWriteOneLine(pdf, context, data));

    pdfWriteLastPageNumber(pdf, context);

    const stream = new WMStrm(fileName);
    pdf.pipe(stream);
    pdf.flushPages();
    pdf.end();
    stream.on('finish', () => onFinish());
}

function list2pdf(adapter, moment, fileName, list, settings) {
    settings = Object.assign({}, SETTINGS, adapter.config.pdfSettings, settings);

    // check that all settings have valid type
    Object.keys(SETTINGS).forEach(attr => {
        if (attr !== 'margins') {
            if (typeof SETTINGS[attr] === 'boolean') {
                settings[attr] = settings[attr] === true || settings[attr] === 'true' || settings[attr] === 'on' || settings[attr] === '1' || settings[attr] === 1;
            } else if (typeof SETTINGS[attr] === 'number') {
                settings[attr] = parseFloat(settings[attr]);
            }
        }
    });
    settings.margins.top    = parseFloat(settings.margins.top);
    settings.margins.left   = parseFloat(settings.margins.left);
    settings.margins.bottom = parseFloat(settings.margins.bottom);
    settings.margins.right  = parseFloat(settings.margins.right);
    if (settings.titleText) {
        const m = settings.titleText.match(/{{([^}]+)}}/);
        if (m) {
            settings.titleText = settings.titleText.replace(`{{${m[1]}}}`, moment().format(m[1]));
        }
    }

    return new Promise((resolve, reject) =>
        createPdf(FILE_NAME, list, settings, () => {
            let error = null;
            if (!memStore[FILE_NAME]) {
                error = 'File test.pdf is empty';
            }
            adapter.writeFile(adapter.name, fileName, memStore[FILE_NAME] || '', null, () => {
                if (memStore[FILE_NAME] !== undefined) {
                    delete memStore[FILE_NAME];
                    adapter.log.debug(`PDF generated and stored in ${adapter.name}/${fileName}`);
                }
                setImmediate(() => error ? reject(error) : resolve());
            });
        }));
}

module.exports = list2pdf;