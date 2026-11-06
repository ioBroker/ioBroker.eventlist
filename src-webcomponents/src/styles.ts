/**
 * The styles of the shadow roots. An element fills the box of the host, has a transparent background and inherits
 * `color` and `font`; lines, secondary text and buttons take the theme of the host (`--iob-divider`,
 * `--iob-text-secondary`, `--iob-primary`, ...), so it looks right in light and dark. Sizes follow the box with
 * container queries (`cqmin`, `cqw`), nothing is measured.
 *
 * The colors of the levels (fatal, alarm, warning, info) are those of the adapter, as in the native widgets.
 */

/** The box, and the hint shown instead of the content while settings are missing */
const BASE = `
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it */
    container-type: size;
}
.edit {
    pointer-events: none;
}
.hint {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 3cqmin, 8px);
    overflow: hidden;
    text-align: center;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 7cqmin, 15px);
}
.hint svg {
    width: clamp(16px, 14cqmin, 32px);
    height: clamp(16px, 14cqmin, 32px);
    fill: currentColor;
    flex: none;
}
`;

/** The tables of events, alarms and alarm cycles */
const TABLES = `
.list {
    width: 100%;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    font-size: clamp(11px, 3.5cqw, 14px);
}
table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}
th,
td {
    padding: 0.2em 0.45em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
}
th {
    font-weight: 600;
    font-size: 0.85em;
    color: var(--iob-text-secondary);
    border-bottom: 1px solid var(--iob-divider);
}
tbody tr:nth-child(even) {
    background: color-mix(in srgb, currentColor 5%, transparent);
}
.r {
    text-align: right;
}
.m {
    text-align: center;
}
.num {
    font-variant-numeric: tabular-nums;
}
.empty {
    padding: 0.4em 0.45em;
    color: var(--iob-text-secondary);
    font-style: italic;
}
.c-time {
    width: 30%;
}
.c-value {
    width: 20%;
}
.c-duration {
    width: 18%;
}
.c-level {
    width: 6.5em;
}
.c-state {
    width: 3em;
}
.c-cycle {
    width: 7em;
}
.c-since,
.c-mvalue,
.c-group {
    width: 6em;
}
.c-count {
    width: 3.5em;
}
.c-came,
.c-gone {
    width: 10em;
}
@container (max-width: 320px) {
    .c-time {
        width: 38%;
    }
    .c-came,
    .c-gone {
        width: 7em;
    }
}
.chip {
    display: inline-block;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0 0.5em;
    border-radius: var(--iob-border-radius);
    color: #fff;
    font-weight: 700;
    font-size: 0.75em;
    line-height: 1.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
}
.code {
    font-family: monospace;
    font-weight: 700;
}
tr.unacked {
    font-weight: 700;
}
tr.gone,
tr.closed {
    opacity: 0.6;
}
tr.ackable {
    cursor: pointer;
}
tr.ackable:hover {
    background: color-mix(in srgb, var(--iob-primary) 14%, transparent);
}
`;

/** The standing alarms, the events and the journal one below the other */
const PANEL = `
.panel {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.2em;
    overflow: hidden;
    font-size: clamp(11px, 3.2cqw, 14px);
}
.panel .list {
    height: auto;
    font-size: inherit;
}
.section {
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
}
.title {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
    padding: 0.35em 0.45em 0.1em;
    font-size: 0.8em;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--iob-text-secondary);
}
.summary {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2em 1.2em;
    padding: 0.2em 0.45em;
}
.summary .count {
    font-size: 1.5em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.summary .label {
    margin-left: 0.3em;
    font-size: 0.75em;
    text-transform: uppercase;
    color: var(--iob-text-secondary);
}
button.export {
    font: inherit;
    font-size: 0.95em;
    letter-spacing: normal;
    text-transform: none;
    color: inherit;
    background: transparent;
    border: 1px solid var(--iob-divider);
    border-radius: var(--iob-border-radius);
    padding: 0.1em 0.7em;
    cursor: pointer;
}
button.export:hover:not(:disabled) {
    background: color-mix(in srgb, currentColor 8%, transparent);
}
button.export:disabled {
    cursor: default;
    opacity: 0.5;
}
`;

/** One thing large in the middle - the newest event, the worst alarm - that opens the lists with a click */
const TILE = `
.tile {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: clamp(4px, 5cqmin, 12px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 3cqmin, 10px);
    overflow: hidden;
    text-align: center;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    border-radius: calc(var(--iob-border-radius) * 2);
}
.tile.clickable {
    cursor: pointer;
}
.tile.clickable:hover {
    background: color-mix(in srgb, currentColor 6%, transparent);
}
.tile:focus-visible {
    box-shadow: inset 0 0 0 2px var(--iob-primary);
}
.tile.alarm {
    box-shadow: inset 0 0 0 2px var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.tile.alarm.clickable:hover {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.tile .icon {
    flex: none;
    width: clamp(16px, 18cqmin, 56px);
    height: clamp(16px, 18cqmin, 56px);
    object-fit: contain;
}
.tile .body {
    min-width: 0;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(1px, 2cqmin, 6px);
}
.tile .name,
.tile .meta {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.tile .name {
    font-size: clamp(9px, 7cqmin, 14px);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--iob-text-secondary);
}
.tile .text {
    max-width: 100%;
    font-size: clamp(11px, 11cqmin, 22px);
    font-weight: 700;
    line-height: 1.25;
    overflow: hidden;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.tile .value {
    font-size: clamp(12px, 14cqmin, 32px);
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}
.tile .meta {
    font-size: clamp(9px, 6.5cqmin, 13px);
    color: var(--iob-text-secondary);
}
.tile .chip {
    font-size: clamp(8px, 6cqmin, 12px);
}
.tile .none {
    font-size: clamp(10px, 8cqmin, 16px);
    font-style: italic;
    color: var(--iob-text-secondary);
}
.tile .ok {
    width: clamp(16px, 16cqmin, 44px);
    height: clamp(16px, 16cqmin, 44px);
    fill: var(--iob-success);
}
/* a wide box: the picture beside the text */
@container (min-aspect-ratio: 5 / 2) {
    .tile.with-icon {
        flex-direction: row;
        text-align: left;
    }
    .tile.with-icon .body {
        align-items: flex-start;
    }
}
`;

/** `<iob-eventlist-events>`: the table fills the box */
export const EVENTS_STYLES = `${BASE}${TABLES}`;

/** `<iob-eventlist-last-event>`: the tile */
export const LAST_EVENT_STYLES = `${BASE}${TILE}`;

/** `<iob-eventlist-alarms>`: the tile in a small box, the lists in a large one - or what the setting says */
export const ALARMS_STYLES = `${BASE}${TABLES}${PANEL}${TILE}
.alarms {
    width: 100%;
    height: 100%;
}
.alarms > .panel {
    display: none;
}
.alarms.panel-only > .tile {
    display: none;
}
.alarms.panel-only > .panel {
    display: flex;
}
@container (min-width: 360px) and (min-height: 240px) {
    .alarms.auto > .tile {
        display: none;
    }
    .alarms.auto > .panel {
        display: flex;
    }
}
`;

/** `<iob-eventlist-pdf>`: one button that fills the box */
export const PDF_STYLES = `${BASE}
.pdf {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: clamp(2px, 4cqmin, 8px);
    display: flex;
}
.pdf button {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
    padding: 0 0.6em;
    font: inherit;
    font-size: clamp(11px, 18cqmin, 28px);
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--iob-primary-contrast);
    background: var(--iob-primary);
    border: none;
    border-radius: var(--iob-border-radius);
    cursor: pointer;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
}
.pdf button:hover:not(:disabled) {
    filter: brightness(1.08);
}
.pdf button:focus-visible {
    outline: 2px solid var(--iob-text);
    outline-offset: 1px;
}
.pdf button:disabled {
    cursor: default;
    opacity: 0.55;
}
.pdf.edit button:disabled {
    opacity: 1;
}
.pdf button.failed {
    background: var(--iob-error);
}
.pdf button svg {
    flex: none;
    width: 1.2em;
    height: 1.2em;
    fill: currentColor;
}
.pdf button.generating svg {
    animation: pdf-pulse 0.8s ease-in-out infinite alternate;
}
@keyframes pdf-pulse {
    from {
        opacity: 1;
    }
    to {
        opacity: 0.3;
    }
}
.pdf .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
`;

/** The content of a dialog the host frames; the theme comes as variables, the size from the dialog */
export const DIALOG_STYLES = `
:host {
    display: block;
}
.dialog {
    box-sizing: border-box;
    width: 100%;
    color: var(--iob-text);
    font-family: var(--iob-font-family);
    font-size: var(--iob-font-size);
}
${TABLES}${PANEL}
.dialog .list,
.dialog .panel {
    height: auto;
    overflow: visible;
    font-size: inherit;
}
.dialog .section {
    flex: none !important;
    overflow: visible;
}
.dialog .title {
    padding-top: 0.8em;
}
.dialog th,
.dialog td {
    white-space: normal;
    overflow-wrap: anywhere;
}
`;
