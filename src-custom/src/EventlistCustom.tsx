import React, { type JSX } from 'react';

import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
    type SelectChangeEvent,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

// important to import from the package and not from some children
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';
import { ColorPicker, I18n, InfoBox } from '@iobroker/gui-components';

import AlarmClassSelect, { classColor, classLabel } from './AlarmClassSelect';
import { buildAlarmClasses, resolveAlarmClass, type AlarmClass } from './levels';

/** Marks a text, a colour or an icon as "use the default from the instance settings" */
const DEFAULT_TEMPLATE = 'default';

/** How a standing message works, the same words as in the admin GUI */
const MESSAGE_PRINCIPLE = [
    'A message comes when its condition holds, and it stays standing until the condition falls away again: one message for the state, and not a line for every value.',
    'With a ladder the sharpest reached limit applies. As long as the value stays above a limit, the message only changes its level, it does not go and come again.',
    'The hysteresis holds the message until the value has come back that far, the delays hold it until the condition has lasted that long.',
    'A message that has to be acknowledged stays pending after it has gone, until somebody acknowledges it. The messages of a group are acknowledged together, and the first one of them is marked.',
    "The option 'Only the message in the event list' writes only the coming and the going: a value that is read every ten seconds gives two lines instead of hundreds.",
];

const OPERATORS = ['>', '>=', '<', '<=', '==', '!='] as const;

/** One limit of a numeric state, with the alarm class it raises */
interface MessageLimit {
    /** Id of the alarm class */
    alarmClass: string;
    operator?: string;
    limit: number;
    hysteresis?: number;
    text?: string;
    requiresAck?: boolean;
    priority?: number;
}

/** Settings of the standing message a state raises */
interface MessageSettings {
    /** Id of the alarm class the state raises */
    alarmClass?: string;
    limits?: MessageLimit[];
    condition?: { operator?: string; limit?: number; value?: string | number | boolean };
    hysteresis?: number;
    text?: string;
    requiresAck?: boolean;
    priority?: number;
    delay?: number;
    delayGone?: number;
    group?: string;
}

/** Settings of one state value, as they are stored in `common.custom[<namespace>].states` */
interface StoredValueSettings {
    val: string;
    text?: string;
    color?: string;
    icon?: string;
    disabled?: boolean;
    /** Id of the alarm class this value raises */
    alarmClass?: string;
}

/** The part of `common.custom[<namespace>]` this component edits */
interface EventlistCustomData {
    enabled?: boolean;
    event?: string;
    changesOnly?: boolean;
    /** Only the transitions of the standing message go into the event list, not every value change */
    messagesOnly?: boolean;
    states?: StoredValueSettings[];
    message?: MessageSettings;
}

const styles: Record<string, React.CSSProperties> = {
    valueBlock: {
        padding: 8,
        borderRadius: 4,
        border: '1px dashed rgba(128, 128, 128, 0.4)',
    },
    valueTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
    },
    section: {
        fontWeight: 'bold',
        marginBottom: 4,
    },
    hint: {
        marginTop: 16,
        fontStyle: 'italic',
        opacity: 0.7,
    },
    limitRow: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    limitLevel: {
        width: 140,
    },
    operator: {
        width: 90,
    },
    limitField: {
        width: 120,
    },
    limitText: {
        flexGrow: 1,
        minWidth: 160,
    },
    limitAck: {
        marginLeft: 0,
        marginRight: 0,
        whiteSpace: 'nowrap',
    },
    limitPriority: {
        width: 90,
    },
    levelSelect: {
        width: 200,
        marginRight: 16,
    },
    valueField: {
        width: 250,
    },
    delayField: {
        width: 240,
        marginRight: 16,
    },
    priorityField: {
        width: 200,
    },
};

/**
 * The settings of one state for the event list, shown in the custom tab of the objects.
 *
 * Everything that belongs to the single state: the event text, the texts and colours of TRUE and
 * FALSE, "only changes", and the standing message with its levels, limits and delays. Icons and the
 * messengers stay in the instance settings, where there is room for them.
 */
interface EventlistCustomState extends ConfigGenericState {
    /** The alarm classes of the instance, read from its settings */
    alarmClasses: AlarmClass[];
}

export default class EventlistCustom extends ConfigGeneric<ConfigGenericProps, EventlistCustomState> {
    /** The alarm classes of this installation, the tree the selects are built from */
    get alarmClasses(): AlarmClass[] {
        return this.state.alarmClasses || buildAlarmClasses(null);
    }

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();

        // the alarm classes belong to the instance, not to the single state, so they are read from
        // its settings - without them only the twelve built-in ones are known
        try {
            const id = `system.adapter.${this.props.oContext.adapterName}.${this.props.oContext.instance}`;
            const obj = await this.props.oContext.socket.getObject(id);
            const native = obj?.native as { alarmClasses?: AlarmClass[] } | undefined;
            this.setState({ alarmClasses: buildAlarmClasses(native?.alarmClasses) });
        } catch {
            this.setState({ alarmClasses: buildAlarmClasses(null) });
        }

        // A state that was just enabled normally brings the defaults of the schema with it. This is
        // only the safety net if it does not, so an untouched state still logs something sensible -
        // the old dialog filled the same values with its `defaults` function.
        const data = this.props.data as EventlistCustomData;
        if (data.event === undefined) {
            void this.onChange('event', DEFAULT_TEMPLATE);
        }
        if (data.changesOnly === undefined) {
            void this.onChange('changesOnly', true);
        }
    }

    /** The list of values, empty if several objects with different values are edited at once */
    getValues(): StoredValueSettings[] {
        const states = (this.props.data as EventlistCustomData).states;
        if (!Array.isArray(states) || states.find(item => !item || typeof item.val !== 'string')) {
            return [];
        }
        return states;
    }

    /** The message settings, empty if several objects with different ones are edited at once */
    getMessage(): MessageSettings {
        const message = (this.props.data as EventlistCustomData).message;
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return {};
        }
        return message;
    }

    /**
     * Change the text or the colour of one value.
     *
     * The whole list is written back, and the entries the dialog does not show - the icon and the
     * disabled flag - are kept as they are.
     *
     * @param val the value, `true` or `false`
     * @param patch what changes
     */
    updateValue(val: string, patch: Partial<StoredValueSettings>): void {
        const values: StoredValueSettings[] = JSON.parse(JSON.stringify(this.getValues()));

        // the adapter expects both values in the list
        for (const value of ['false', 'true']) {
            if (!values.find(item => item.val === value)) {
                values.push({ val: value, text: DEFAULT_TEMPLATE, color: DEFAULT_TEMPLATE });
            }
        }

        Object.assign(
            values.find(item => item.val === val)!,
            patch,
        );

        void this.onChange('states', values);
    }

    /**
     * Change the message settings
     *
     * @param patch what changes
     */
    updateMessage(patch: Partial<MessageSettings>): void {
        void this.onChange('message', { ...this.getMessage(), ...patch });
    }

    /**
     * The limits of a numeric state, most severe first.
     *
     * Settings from before the ladder carry one level with one condition; they are shown as the
     * first row, and the next change writes them as a ladder.
     */
    getLimits(): MessageLimit[] {
        const message = this.getMessage();

        if (message.limits?.length) {
            const severityOf = (limit: MessageLimit): number =>
                resolveAlarmClass(limit.alarmClass, this.alarmClasses)?.severity ?? 0;
            return [...message.limits].sort((a, b) => severityOf(b) - severityOf(a));
        }

        if (message.alarmClass && message.condition?.limit !== undefined) {
            return [
                {
                    alarmClass: message.alarmClass,
                    operator: message.condition.operator || '>',
                    limit: message.condition.limit,
                    hysteresis: message.hysteresis,
                    requiresAck: message.requiresAck,
                    priority: message.priority,
                },
            ];
        }

        return [];
    }

    /**
     * Write the ladder back. The single condition of the old form goes with it, and so do the
     * acknowledgement duty and the priority: with a ladder they belong to the single limit, and a
     * value left behind here would work invisibly.
     *
     * @param limits the new ladder
     */
    updateLimits(limits: MessageLimit[]): void {
        const next: MessageSettings = { ...this.getMessage(), limits };
        delete next.alarmClass;
        delete next.condition;
        delete next.hysteresis;
        delete next.requiresAck;
        delete next.priority;

        if (!limits.length) {
            delete next.limits;
        }

        void this.onChange('message', next);
    }

    /** Dropdown for an alarm class, `no message` included */
    renderLevelSelect(label: string, value: string | undefined, onChange: (alarmClass?: string) => void): JSX.Element {
        return (
            <AlarmClassSelect
                label={label}
                value={value}
                classes={this.alarmClasses}
                emptyText={I18n.t('No message')}
                style={styles.levelSelect}
                onChange={id => onChange(id || undefined)}
            />
        );
    }

    /** One line of the ladder: level, comparison, limit, hysteresis, text, acknowledgement, priority */
    renderLimit(limits: MessageLimit[], index: number): JSX.Element {
        const item = limits[index];
        const limitClass = resolveAlarmClass(item.alarmClass, this.alarmClasses);
        const update = (patch: Partial<MessageLimit>): void => {
            const next = JSON.parse(JSON.stringify(limits)) as MessageLimit[];
            Object.assign(next[index], patch);
            this.updateLimits(next);
        };

        return (
            <div
                key={index}
                style={styles.limitRow}
            >
                <AlarmClassSelect
                    label={I18n.t('Level')}
                    value={item.alarmClass}
                    classes={this.alarmClasses}
                    style={styles.limitLevel}
                    onChange={alarmClass => update({ alarmClass })}
                />
                <FormControl
                    variant="standard"
                    style={styles.operator}
                >
                    <InputLabel shrink>{I18n.t('Condition')}</InputLabel>
                    <Select
                        variant="standard"
                        value={item.operator || '>'}
                        onChange={(e: SelectChangeEvent<string>) => update({ operator: e.target.value })}
                    >
                        {OPERATORS.map(operator => (
                            <MenuItem
                                key={operator}
                                value={operator}
                            >
                                {operator}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <TextField
                    variant="standard"
                    label={I18n.t('Limit')}
                    type="number"
                    style={styles.limitField}
                    value={item.limit ?? ''}
                    onChange={e => update({ limit: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                />
                <TextField
                    variant="standard"
                    label={I18n.t('Hysteresis')}
                    title={I18n.t('The message goes only when the value has come back this far')}
                    type="number"
                    style={styles.limitField}
                    value={item.hysteresis ?? ''}
                    onChange={e =>
                        update({ hysteresis: e.target.value === '' ? undefined : parseFloat(e.target.value) })
                    }
                />
                <TextField
                    variant="standard"
                    label={I18n.t('Own text')}
                    title={I18n.t('Instead of the message text below, only for this limit')}
                    style={styles.limitText}
                    value={item.text || ''}
                    onChange={e => update({ text: e.target.value || undefined })}
                />
                <FormControlLabel
                    title={I18n.t('Must be acknowledged')}
                    style={styles.limitAck}
                    control={
                        <Checkbox
                            // without an own value the default of the level counts, and the checkbox
                            // shows what will happen
                            disabled={limitClass?.level === 'fatal'}
                            checked={limitClass?.level === 'fatal' || (item.requiresAck ?? !!limitClass?.requiresAck)}
                            onChange={e => update({ requiresAck: e.target.checked })}
                        />
                    }
                    label={I18n.t('Acknowledge')}
                />
                <TextField
                    variant="standard"
                    label={I18n.t('Priority')}
                    title={I18n.t('Sorts only inside the same level, 0 to 100. It changes nothing else.')}
                    type="number"
                    slotProps={{ htmlInput: { min: 0, max: 100 } }}
                    style={styles.limitPriority}
                    value={item.priority ?? 50}
                    onChange={e => update({ priority: parseInt(e.target.value, 10) })}
                />
                <IconButton
                    title={I18n.t('Delete limit')}
                    onClick={() => this.updateLimits(limits.filter((_, i) => i !== index))}
                >
                    <DeleteIcon />
                </IconButton>
            </div>
        );
    }

    /** The ladder of a numeric state: several limits, the most severe one that is reached wins */
    renderLimits(limits: MessageLimit[]): JSX.Element {
        return (
            <div>
                {limits.map((_, index) => this.renderLimit(limits, index))}
                <Button
                    startIcon={<AddIcon />}
                    onClick={() => {
                        const used = limits.map(item => item.alarmClass);
                        const free = ['fatal.normal', 'alarm.normal', 'warning.normal', 'info.normal'].find(
                            id => !used.includes(id),
                        );

                        this.updateLimits([
                            ...limits,
                            {
                                alarmClass: limits.length ? free || 'warning.normal' : 'warning.normal',
                                operator: limits[0]?.operator || '>',
                                limit: limits[0]?.limit ?? 0,
                            },
                        ]);
                    }}
                >
                    {I18n.t('Add limit')}
                </Button>
                {limits.length ? (
                    <FormHelperText>
                        {I18n.t('The most severe limit that is reached wins, the message follows the value')}
                    </FormHelperText>
                ) : null}
            </div>
        );
    }

    /**
     * The standing message of this state.
     *
     * A numeric state gets a ladder of limits, a boolean one its level per value - that one sits in
     * the value blocks above - and everything else one level with the value that raises it.
     *
     * @param isBoolean the state is a boolean, so the levels sit at its values
     */
    renderMessage(isBoolean: boolean): JSX.Element {
        const message = this.getMessage();
        const common = this.props.customObj?.common as ioBroker.StateCommon | undefined;
        const withLimits = !isBoolean && common?.type === 'number';
        const limits = withLimits ? this.getLimits() : [];
        const condition = message.condition || {};

        const classes = this.alarmClasses;
        const levelsOfValues = this.getValues().filter(item => item.alarmClass);
        const active = isBoolean ? !!levelsOfValues.length : withLimits ? !!limits.length : !!message.alarmClass;
        const effectiveClass = withLimits
            ? resolveAlarmClass(limits[0]?.alarmClass, classes)
            : isBoolean
              ? levelsOfValues
                    .map(item => resolveAlarmClass(item.alarmClass, classes))
                    .filter((item): item is AlarmClass => !!item)
                    .sort((a, b) => b.severity - a.severity)[0]
              : resolveAlarmClass(message.alarmClass, classes);

        return (
            <Box style={styles.valueBlock}>
                <Typography style={styles.section}>{I18n.t('Message')}</Typography>

                <InfoBox
                    type="info"
                    closeable
                    storeId="eventlist.messagePrinciple"
                    iconPosition="top"
                >
                    {MESSAGE_PRINCIPLE.map((line, i) => (
                        <span key={line}>
                            {i ? <br /> : null}
                            {I18n.t(line)}
                        </span>
                    ))}
                </InfoBox>

                {isBoolean ? (
                    <FormHelperText>{I18n.t('The level is set above, at every single value')}</FormHelperText>
                ) : withLimits ? (
                    this.renderLimits(limits)
                ) : (
                    <div>
                        {this.renderLevelSelect(I18n.t('Level'), message.alarmClass, alarmClass =>
                            this.updateMessage({ alarmClass }),
                        )}
                        {message.alarmClass ? (
                            <TextField
                                variant="standard"
                                label={I18n.t('Value that raises the message')}
                                style={styles.valueField}
                                value={condition.value === undefined ? '' : condition.value.toString()}
                                onChange={e =>
                                    this.updateMessage({ condition: { ...condition, value: e.target.value } })
                                }
                            />
                        ) : null}
                    </div>
                )}

                {active ? (
                    <div>
                        <TextField
                            variant="standard"
                            fullWidth
                            label={I18n.t('Message text')}
                            value={message.text || ''}
                            helperText={I18n.t('You can use patterns: %s - value, %u - unit, %n - name, %l - level')}
                            onChange={e => this.updateMessage({ text: e.target.value })}
                        />
                        {withLimits ? null : (
                            <>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            disabled={effectiveClass?.level === 'fatal'}
                                            checked={
                                                effectiveClass?.level === 'fatal' ||
                                                (message.requiresAck ?? !!effectiveClass?.requiresAck)
                                            }
                                            onChange={e => this.updateMessage({ requiresAck: e.target.checked })}
                                        />
                                    }
                                    label={I18n.t('Must be acknowledged')}
                                />
                                <TextField
                                    variant="standard"
                                    label={I18n.t('Priority within the level')}
                                    title={I18n.t(
                                        'Sorts only inside the same level, 0 to 100. It changes nothing else.',
                                    )}
                                    type="number"
                                    slotProps={{ htmlInput: { min: 0, max: 100 } }}
                                    style={styles.priorityField}
                                    value={message.priority ?? 50}
                                    onChange={e => this.updateMessage({ priority: parseInt(e.target.value, 10) })}
                                />
                            </>
                        )}
                        <div>
                            <TextField
                                variant="standard"
                                label={I18n.t('Delay when coming (s)')}
                                type="number"
                                slotProps={{ htmlInput: { min: 0 } }}
                                style={styles.delayField}
                                value={message.delay ? message.delay / 1000 : ''}
                                onChange={e =>
                                    this.updateMessage({ delay: EventlistCustom.toMilliseconds(e.target.value) })
                                }
                            />
                            <TextField
                                variant="standard"
                                label={I18n.t('Delay when going (s)')}
                                type="number"
                                slotProps={{ htmlInput: { min: 0 } }}
                                style={styles.delayField}
                                value={message.delayGone ? message.delayGone / 1000 : ''}
                                onChange={e =>
                                    this.updateMessage({ delayGone: EventlistCustom.toMilliseconds(e.target.value) })
                                }
                            />
                            <TextField
                                variant="standard"
                                label={I18n.t('Group')}
                                style={styles.valueField}
                                helperText={I18n.t('Acknowledged together, and the first one is marked')}
                                value={message.group || ''}
                                onChange={e => this.updateMessage({ group: e.target.value || undefined })}
                            />
                        </div>
                        <FormControlLabel
                            title={I18n.t(
                                'Only the coming and the going of the message are written, not every value of the state',
                            )}
                            control={
                                <Checkbox
                                    checked={!!(this.props.data as EventlistCustomData).messagesOnly}
                                    onChange={e => void this.onChange('messagesOnly', e.target.checked)}
                                />
                            }
                            label={I18n.t('Only the message in the event list')}
                        />
                    </div>
                ) : null}
            </Box>
        );
    }

    /**
     * The delays are entered in seconds and stored in milliseconds, like everywhere else in ioBroker
     *
     * @param value what the user typed
     */
    static toMilliseconds(value: string): number | undefined {
        if (value === '') {
            return undefined;
        }
        const seconds = parseFloat(value);
        return isNaN(seconds) || seconds <= 0 ? undefined : Math.round(seconds * 1000);
    }

    renderValue(val: 'true' | 'false'): JSX.Element {
        const item = this.getValues().find(value => value.val === val) || { val };
        const text = item.text ?? DEFAULT_TEMPLATE;
        const color = item.color ?? DEFAULT_TEMPLATE;
        const defaultText = text === DEFAULT_TEMPLATE;
        const defaultColor = color === DEFAULT_TEMPLATE;

        return (
            <Grid size={{ xs: 12, md: 6 }}>
                <Box style={styles.valueBlock}>
                    <Typography style={styles.valueTitle}>{val.toUpperCase()}</Typography>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={defaultText}
                                onChange={e =>
                                    this.updateValue(val, { text: e.target.checked ? DEFAULT_TEMPLATE : '' })
                                }
                            />
                        }
                        label={I18n.t('Use default text')}
                    />
                    {!defaultText ? (
                        <TextField
                            variant="standard"
                            fullWidth
                            label={I18n.t('Text')}
                            value={text}
                            onChange={e => this.updateValue(val, { text: e.target.value })}
                        />
                    ) : null}
                    <div>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={defaultColor}
                                    onChange={e =>
                                        this.updateValue(val, { color: e.target.checked ? DEFAULT_TEMPLATE : '' })
                                    }
                                />
                            }
                            label={I18n.t('Use default color')}
                        />
                    </div>
                    {!defaultColor ? (
                        <ColorPicker
                            value={color}
                            label={I18n.t('Color')}
                            onChange={newColor => this.updateValue(val, { color: newColor })}
                        />
                    ) : null}
                    <div>
                        {this.renderLevelSelect(I18n.t('Message level'), item.alarmClass, alarmClass =>
                            this.updateValue(val, { alarmClass }),
                        )}
                    </div>
                </Box>
            </Grid>
        );
    }

    renderItem(): JSX.Element {
        const data = this.props.data as EventlistCustomData;
        const common = this.props.customObj?.common as ioBroker.StateCommon | undefined;
        const isBoolean = common?.type === 'boolean';

        // with several objects selected at once the admin puts the differing values into an array
        const event = typeof data.event === 'string' ? data.event : DEFAULT_TEMPLATE;
        const changesOnly = typeof data.changesOnly === 'boolean' ? data.changesOnly : true;
        const defaultEvent = event === DEFAULT_TEMPLATE;

        return (
            <Grid
                container
                spacing={2}
            >
                <Grid size={{ xs: 12 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={defaultEvent}
                                onChange={e => void this.onChange('event', e.target.checked ? DEFAULT_TEMPLATE : '')}
                            />
                        }
                        label={I18n.t('Use default text')}
                    />
                    {!defaultEvent ? (
                        <TextField
                            variant="standard"
                            fullWidth
                            label={I18n.t('Event text')}
                            value={event}
                            helperText={I18n.t(
                                'You can use patterns: %s - value, %u - unit, %n - name, %t - time, %d - duration, %g - value difference, %o - previous value',
                            )}
                            onChange={e => void this.onChange('event', e.target.value)}
                        />
                    ) : null}
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={changesOnly}
                                onChange={e => void this.onChange('changesOnly', e.target.checked)}
                            />
                        }
                        title={I18n.t(
                            'An event is written only if the value has really changed, and not on every update of the state',
                        )}
                        label={I18n.t('Only changes')}
                    />
                    <FormHelperText>{I18n.t('Generate event only by state change')}</FormHelperText>
                </Grid>

                {isBoolean ? this.renderValue('true') : null}
                {isBoolean ? this.renderValue('false') : null}

                <Grid size={{ xs: 12 }}>{this.renderMessage(isBoolean)}</Grid>

                <Grid size={{ xs: 12 }}>
                    <Typography
                        variant="body2"
                        style={styles.hint}
                    >
                        {I18n.t('Icons and messengers can be set in the instance settings')}
                    </Typography>
                </Grid>
            </Grid>
        );
    }
}
