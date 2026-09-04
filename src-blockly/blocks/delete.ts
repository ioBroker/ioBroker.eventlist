/**
 * `eventlist_delete` - remove events from the event list.
 *
 * Generates the `delete` command documented in the README:
 * `sendTo('eventlist.0', 'delete', '*')` for everything, or the state ID / the ISO time of a single
 * event. The adapter tells those two apart on its own, so the block does not have to.
 */
import type { Block } from 'blockly/core';

import { instanceOptions, logLevelOptions, makeOptional, registerGenerator } from '../helpers';

const Blockly = window.Blockly;

/** Value of the WHAT dropdown that deletes the complete list */
const ALL = 'all';

export function installDelete(): void {
    Blockly.Sendto.blocks.eventlist_delete = `<block type="eventlist_delete">
  <field name="INSTANCE"></field>
  <field name="WHAT">${ALL}</field>
  <field name="LOG"></field>
</block>`;

    Blockly.Blocks.eventlist_delete = {
        init: function (this: Block): void {
            this.appendDummyInput('INSTANCE')
                .appendField(Blockly.Translate('eventlist_delete'))
                .appendField(new Blockly.FieldDropdown(instanceOptions()), 'INSTANCE');

            this.appendDummyInput('WHAT')
                .appendField(Blockly.Translate('eventlist_delete_what'))
                .appendField(
                    new Blockly.FieldDropdown([
                        [Blockly.Translate('eventlist_delete_all'), ALL],
                        [Blockly.Translate('eventlist_delete_filter'), 'filter'],
                    ]),
                    'WHAT',
                );

            // Only used when WHAT is not "all events". Optional, so the editor does not complain
            // about it while "all events" is selected.
            this.appendValueInput('FILTER').appendField(Blockly.Translate('eventlist_delete_filter'));
            makeOptional(this, 'FILTER');

            this.appendDummyInput('LOG')
                .appendField(Blockly.Translate('eventlist_log'))
                .appendField(new Blockly.FieldDropdown(logLevelOptions()), 'LOG');

            this.setInputsInline(false);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);

            this.setColour(Blockly.Sendto.HUE);
            this.setTooltip(Blockly.Translate('eventlist_delete_tooltip'));
            this.setHelpUrl(Blockly.Translate('eventlist_help'));
        },
    };

    registerGenerator('eventlist_delete', (block: Block): string => {
        const instance = block.getFieldValue('INSTANCE');
        const what = block.getFieldValue('WHAT');
        const logLevel = block.getFieldValue('LOG');
        const filter = Blockly.JavaScript.valueToCode(block, 'FILTER', Blockly.JavaScript.ORDER_ATOMIC);

        // The adapter deletes the whole list for an empty filter, so a block that asks for a
        // selection but has nothing connected must not send anything at all.
        if (what !== ALL && !filter) {
            return '// eventlist: no state ID or time given, nothing deleted\n';
        }

        const target = what === ALL ? `'*'` : filter;
        // The count only exists in the answer, so it has to be logged from the callback
        const callback = logLevel ? `, result => console.${logLevel}('eventlist: deleted ' + result.deleted)` : '';

        return `sendTo('eventlist${instance}', 'delete', ${target}${callback});\n`;
    });
}
