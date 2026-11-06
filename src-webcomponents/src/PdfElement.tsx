/**
 * The PDF of the event list as a web component: `<iob-eventlist-pdf>` - the web component of the vis-2 widget "PDF"
 * (`src-widgets/src/PdfButton.tsx`).
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`eventlist-pdf.json`, written by the build from `manifest.ts`), so a host loads this module only when it
 * shows the element. The host sets `socket` and `settings`, and if it has them `theme` and `editMode`.
 *
 * A button: the click writes `true` into `eventlist.<n>.triggerPDF`, the adapter renders the list as PDF into its
 * file storage and acknowledges the state with `false`. Then the element opens the file in a new window - from
 * `/eventlist/report.pdf` (web) or `/files/eventlist/report.pdf` (admin), whichever the server of the page has, see
 * `getPdfUrls()`. The window is opened with the click itself and only gets its address later, so that no popup
 * blocker stops it. The button is disabled while the instance is not running (`system.adapter.eventlist.<n>.alive`).
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import { createRoot, type Root } from 'react-dom/client';

import { defineWebComponent, IobWebComponent } from '@iobroker/web-components/element';

import { getNamespace, getTag, type PdfSettings } from './constants';
import { findPdf, getPdfUrls } from './data';
import { getWords } from './i18n';
import { PDF_STYLES } from './styles';
import { Hint } from './views';

/** A document with a fold: the picture of the button */
const PDF_PATH =
    'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5zm4-3H19v1h1.5V11H19v2h-1.5V7h3zM9 9.5h1v-1H9zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4zm10 5.5h1v-3h-1z';

/** How long the adapter may take for the PDF before the element gives up */
const PDF_TIMEOUT_MS = 60_000;

/** A click whose PDF is being made */
interface PendingPdf {
    /** The state of `triggerPDF` at the click: the PDF is done once another one came, `false` and acknowledged */
    before: ioBroker.State | null | undefined;
    /** Opened with the click; null if the browser did not open it */
    window: Window | null;
    timer: ReturnType<typeof setTimeout>;
}

class EventlistPdf extends IobWebComponent<PdfSettings> {
    readonly #root: Root;

    #pending: PendingPdf | null = null;

    /** The last click brought no PDF */
    #failed = false;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = PDF_STYLES;
        const mount = document.createElement('div');
        mount.className = 'mount';
        shadow.append(style, mount);
        this.#root = createRoot(mount);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        // gone from the page: the window waits for nothing any more
        this.#finish(null);
    }

    protected override getStateIds(settings: PdfSettings): string[] {
        const namespace = getNamespace(settings.instance);
        return namespace ? [`${namespace}.triggerPDF`, `system.adapter.${namespace}.alive`] : [];
    }

    #onClick = (): void => {
        const namespace = getNamespace(this.settings.instance);
        if (!namespace || this.editMode || this.#pending || !this.states[`system.adapter.${namespace}.alive`]?.val) {
            return;
        }
        const triggerId = `${namespace}.triggerPDF`;
        // its first value would be taken for the answer
        if (this.states[triggerId] === undefined) {
            return;
        }
        this.#failed = false;
        this.#pending = {
            before: this.states[triggerId],
            window: window.open('', '_blank'),
            timer: setTimeout(() => this.#finish(null), PDF_TIMEOUT_MS),
        };
        this.setState(triggerId, true).catch((e: unknown) => {
            console.warn(`<${this.localName}>: cannot start the PDF: ${String(e)}`);
            this.#finish(null);
        });
        this.render();
    };

    /**
     * The PDF is done, or will not come
     *
     * @param namespace the instance whose PDF to open; null: there is none, close the window
     */
    #finish(namespace: string | null): void {
        const pending = this.#pending;
        if (!pending) {
            return;
        }
        this.#pending = null;
        clearTimeout(pending.timer);
        if (namespace) {
            void findPdf(getPdfUrls(namespace)).then(url => {
                if (pending.window && !pending.window.closed) {
                    pending.window.location.href = url;
                } else {
                    window.open(url, '_blank');
                }
            });
        } else {
            pending.window?.close();
            this.#failed = this.isConnected;
            if (this.isConnected) {
                this.render();
            }
        }
    }

    protected override render(): void {
        const settings = this.settings;
        const word = getWords<'eventlist-pdf'>(this.systemLang);
        const namespace = getNamespace(settings.instance);

        if (!namespace) {
            this.#root.render(
                <Hint
                    text={settings.instance ? `${word('noInstance')}: ${settings.instance}` : word('chooseInstance')}
                    editMode={this.editMode}
                />,
            );
            return;
        }
        const triggerId = `${namespace}.triggerPDF`;
        if (this.objects[triggerId] === null) {
            this.#root.render(
                <Hint
                    text={`${word('noInstance')}: ${namespace}`}
                    editMode={this.editMode}
                />,
            );
            return;
        }

        const trigger = this.states[triggerId];
        // the adapter acknowledges `triggerPDF` with false when the file is written
        if (this.#pending && trigger && trigger !== this.#pending.before && !trigger.val && trigger.ack) {
            this.#finish(namespace);
        }

        const alive = !!this.states[`system.adapter.${namespace}.alive`]?.val;
        const generating = !!this.#pending || !!trigger?.val;
        let label = settings.text || 'PDF';
        if (generating) {
            label = word('pdf_generating');
        } else if (this.#failed) {
            label = word('pdfFailed');
        }
        const classes = [];
        if (generating) {
            classes.push('generating');
        } else if (this.#failed) {
            classes.push('failed');
        }

        this.#root.render(
            <div className={`pdf${this.editMode ? ' edit' : ''}`}>
                <button
                    type="button"
                    className={classes.join(' ') || undefined}
                    // in edit mode it looks like it does at runtime, the host takes the clicks
                    disabled={!this.editMode && (!alive || generating)}
                    title={alive ? undefined : word('instance_not_running')}
                    onClick={this.#onClick}
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d={PDF_PATH} />
                    </svg>
                    <span className="label">{label}</span>
                </button>
            </div>,
        );
    }
}

defineWebComponent(getTag('eventlist-pdf'), EventlistPdf);
