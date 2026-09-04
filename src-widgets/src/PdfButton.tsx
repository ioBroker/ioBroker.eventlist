import React from 'react';
import { Button } from '@mui/material';

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps, VisRxWidgetState } from '@iobroker/types-vis-2';

import Generic from './Generic';

interface PdfButtonRxData {
    instance: string;
    text: string;
    image: string;
    imageHeight: string;
    alt: string;
    noStyle: boolean;
}

interface PdfButtonState extends VisRxWidgetState {
    /** The adapter is currently rendering the PDF */
    generating: boolean;
    /** The instance is running. Without it the PDF would never be created. */
    alive: boolean;
}

export default class PdfButton extends Generic<PdfButtonRxData, PdfButtonState> {
    private subscribedIds: string[] = [];
    /** True between the click and the moment the adapter reports the PDF as done */
    private waitingForPdf = false;

    constructor(props: VisRxWidgetProps) {
        super(props);
        this.state = { ...this.state, generating: false, alive: false };
    }

    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplEventlistButton',
            visSet: 'eventlist',
            visSetLabel: 'events',
            visName: 'PDF',
            visWidgetLabel: 'pdf',
            visPrev: 'widgets/eventlist/img/Prev_EventlistButton.png',
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
                        { name: 'text', type: 'text', default: 'PDF', label: 'pdf_text' },
                        { name: 'image', type: 'image', label: 'pdf_image' },
                        {
                            name: 'imageHeight',
                            type: 'slider',
                            min: 0,
                            max: 200,
                            step: 1,
                            default: 100,
                            label: 'pdf_image_height',
                            hidden: '!data.image',
                        },
                        { name: 'alt', type: 'text', label: 'pdf_alt', hidden: '!data.image' },
                        { name: 'noStyle', type: 'checkbox', label: 'pdf_no_style' },
                    ],
                },
            ],
            visDefaultStyle: {
                width: 100,
                height: 40,
                position: 'relative',
            },
        };
    }

    getWidgetInfo(): RxWidgetInfo {
        return PdfButton.getWidgetInfo();
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
        if (this.subscribedIds[0] !== this.getStateId('triggerPDF')) {
            this.unsubscribe();
            void this.subscribe();
        }
    }

    onPdfStateChanged = (id: string, state: ioBroker.State | null | undefined): void => {
        if (id.endsWith('.alive')) {
            this.setState({ alive: !!state?.val });
            return;
        }

        // triggerPDF is true while the adapter renders and goes back to false, acknowledged, when it is done
        const generating = !!state?.val;
        if (!generating && this.waitingForPdf && state?.ack) {
            this.waitingForPdf = false;
            this.openPdf();
        }
        this.setState({ generating });
    };

    async subscribe(): Promise<void> {
        this.subscribedIds = [this.getStateId('triggerPDF'), `system.adapter.${this.getStateId('alive')}`];
        try {
            await this.props.context.socket.subscribeState(this.subscribedIds, this.onPdfStateChanged);
        } catch (e) {
            console.warn(`Cannot subscribe on ${this.subscribedIds.join(', ')}: ${e as string}`);
        }
    }

    unsubscribe(): void {
        if (this.subscribedIds.length) {
            this.props.context.socket.unsubscribeState(this.subscribedIds, this.onPdfStateChanged);
            this.subscribedIds = [];
        }
    }

    /**
     * Opens the report of this instance.
     *
     * The adapter writes `report.pdf` for instance 0 and `report-<instance>.pdf` for every other one,
     * so the file name has to follow the instance.
     */
    openPdf(): void {
        const instance = this.getInstance();
        const file = instance ? `report-${instance}.pdf` : 'report.pdf';
        window.open(`../eventlist/${file}?q=${Date.now()}`, 'PDF');
    }

    onClick(): void {
        if (this.props.editMode || !this.state.alive) {
            return;
        }
        this.waitingForPdf = true;
        this.setState({ generating: true });
        this.props.context.setValue(this.getStateId('triggerPDF'), true);
    }

    renderContent(): React.JSX.Element {
        const { image, imageHeight, alt, text } = this.state.rxData;

        return (
            <>
                {image ? (
                    <img
                        src={image}
                        alt={alt || 'PDF'}
                        style={{ verticalAlign: 'middle', height: `${parseInt(imageHeight, 10) || 100}%` }}
                    />
                ) : null}
                {this.state.generating ? Generic.t('pdf_generating') : text || 'PDF'}
            </>
        );
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);

        const disabled = !this.state.alive || this.state.generating;
        const title = this.state.alive ? undefined : Generic.t('instance_not_running');

        if (this.state.rxData.noStyle) {
            return (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.6 : 1,
                    }}
                    title={title}
                    onClick={() => this.onClick()}
                >
                    {this.renderContent()}
                </div>
            );
        }

        return (
            <Button
                style={{ width: '100%', height: '100%' }}
                variant="contained"
                color="primary"
                // in the editor the button must stay clickable to be selectable, but it must not trigger a PDF
                disabled={disabled && !this.props.editMode}
                title={title}
                onClick={() => this.onClick()}
            >
                {this.renderContent()}
            </Button>
        );
    }
}
