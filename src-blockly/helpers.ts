/**
 * Pieces the eventlist blocks share.
 */
import type { Block } from 'blockly/core';

const Blockly = window.Blockly;

/**
 * The instance dropdown: every `eventlist.x` the admin knows about, or `eventlist.0` .. `eventlist.4`
 * while the editor has not reported any instances yet.
 *
 * There is no "all instances" entry on purpose. Every instance keeps its own list, so an event has
 * to go to one of them.
 */
export function instanceOptions(): [string, string][] {
    const options: [string, string][] = [];

    const instances = window.main?.instances;
    if (instances) {
        for (const id of instances) {
            const m = id.match(/^system\.adapter\.eventlist\.(\d+)$/);
            if (m) {
                const n = parseInt(m[1], 10);
                options.push([`eventlist.${n}`, `.${n}`]);
            }
        }
    }

    if (!options.length) {
        for (let n = 0; n <= 4; n++) {
            options.push([`eventlist.${n}`, `.${n}`]);
        }
    }

    return options;
}

/** The log level dropdown. The values are console method names, an empty one means "do not log". */
export function logLevelOptions(): [string, string][] {
    return [
        [Blockly.Translate('eventlist_log_none'), ''],
        [Blockly.Translate('eventlist_log_debug'), 'debug'],
        [Blockly.Translate('eventlist_log_info'), 'log'],
        [Blockly.Translate('eventlist_log_warn'), 'warn'],
        [Blockly.Translate('eventlist_log_error'), 'error'],
    ];
}

/**
 * The log line a block appends after the `sendTo`.
 *
 * `valueToCode` yields an empty string for an unconnected input, so appending `text` unconditionally
 * would emit `console.log('…' + );` and break the user's whole script with a syntax error.
 *
 * @param logLevel console method to call, empty when logging is switched off
 * @param prefix what the message starts with, e.g. `eventlist`
 * @param text generated code of the event text
 */
export function logLine(logLevel: string, prefix: string, text: string): string {
    if (!logLevel) {
        return '';
    }
    return `console.${logLevel}('${prefix}: '${text ? ` + ${text}` : ''});\n`;
}

/**
 * Marks a value input as optional, so the editor does not complain about it being unconnected.
 * Blockly has no public API for that.
 *
 * @param block the block the input belongs to
 * @param name name of the value input
 */
export function makeOptional(block: Block, name: string): void {
    const connection = block.getInput(name)?.connection;
    if (connection) {
        (connection as unknown as { _optional: boolean })._optional = true;
    }
}

/**
 * Registers a generator. Blockly >= 10 looks it up in `forBlock`; registering on the plain slot is
 * not enough, because the editor migrates that slot to `forBlock` before it loads any adapter's
 * `blockly.js`, so an adapter registering the old way is never migrated.
 *
 * @param type block type
 * @param generator turns a block of that type into JavaScript
 */
export function registerGenerator(type: string, generator: (block: Block) => string): void {
    if (Blockly.JavaScript.forBlock) {
        Blockly.JavaScript.forBlock[type] = generator;
    } else {
        Blockly.JavaScript[type] = generator;
    }
}
