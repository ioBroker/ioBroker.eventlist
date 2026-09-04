/**
 * `eventlist` - add an own event to the event list.
 *
 * Generates the `insert` command documented in the README:
 * `sendTo('eventlist.0', 'insert', { event: '…', val: …, id: '…', icon: '…' })`
 */
import type { Block } from 'blockly/core';

import { instanceOptions, logLevelOptions, logLine, makeOptional, registerGenerator } from '../helpers';

const Blockly = window.Blockly;

export function installInsert(): void {
    Blockly.Sendto.blocks.eventlist = `<block type="eventlist">
  <field name="INSTANCE"></field>
  <field name="LOG"></field>
  <value name="EVENT">
    <shadow type="text">
      <field name="TEXT">My custom event</field>
    </shadow>
  </value>
</block>`;

    Blockly.Blocks.eventlist = {
        init: function (this: Block): void {
            this.appendDummyInput('INSTANCE')
                .appendField(Blockly.Translate('eventlist'))
                .appendField(new Blockly.FieldDropdown(instanceOptions()), 'INSTANCE');

            this.appendValueInput('EVENT').appendField(Blockly.Translate('eventlist_event'));

            // Everything below is optional - the adapter only insists on a text or a state ID
            for (const [name, word] of [
                ['VALUE', 'eventlist_value'],
                ['ID', 'eventlist_id'],
                ['ICON', 'eventlist_icon'],
            ] as const) {
                this.appendValueInput(name).appendField(Blockly.Translate(word));
                makeOptional(this, name);
            }

            this.appendDummyInput('LOG')
                .appendField(Blockly.Translate('eventlist_log'))
                .appendField(new Blockly.FieldDropdown(logLevelOptions()), 'LOG');

            this.setInputsInline(false);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);

            this.setColour(Blockly.Sendto.HUE);
            this.setTooltip(Blockly.Translate('eventlist_tooltip'));
            this.setHelpUrl(Blockly.Translate('eventlist_help'));
        },
    };

    registerGenerator('eventlist', (block: Block): string => {
        const instance = block.getFieldValue('INSTANCE');
        const logLevel = block.getFieldValue('LOG');
        const event = Blockly.JavaScript.valueToCode(block, 'EVENT', Blockly.JavaScript.ORDER_ATOMIC);
        const value = Blockly.JavaScript.valueToCode(block, 'VALUE', Blockly.JavaScript.ORDER_ATOMIC);
        const id = Blockly.JavaScript.valueToCode(block, 'ID', Blockly.JavaScript.ORDER_ATOMIC);
        const icon = Blockly.JavaScript.valueToCode(block, 'ICON', Blockly.JavaScript.ORDER_ATOMIC);

        // an unconnected input yields no code at all - `event: ,` would not parse
        const lines = [`sendTo('eventlist${instance}', 'insert', {\n`];
        if (event) {
            lines.push(`  event: ${event},\n`);
        }
        if (value) {
            lines.push(`  val: ${value},\n`);
        }
        if (id) {
            lines.push(`  id: ${id},\n`);
        }
        if (icon) {
            lines.push(`  icon: ${icon},\n`);
        }
        lines.push(`});\n${logLine(logLevel, 'eventlist', event)}`);

        return lines.join('');
    });
}
