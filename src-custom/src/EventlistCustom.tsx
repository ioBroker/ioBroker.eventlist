import React, { type JSX } from 'react';

import { Box, Checkbox, FormControlLabel, FormHelperText, Grid, TextField, Typography } from '@mui/material';

// important to import from the package and not from some children
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';
import { ColorPicker, I18n } from '@iobroker/gui-components';

/** Marks a text, a colour or an icon as "use the default from the instance settings" */
const DEFAULT_TEMPLATE = 'default';

/** Settings of one state value, as they are stored in `common.custom[<namespace>].states` */
interface StoredValueSettings {
    val: string;
    text?: string;
    color?: string;
    icon?: string;
    disabled?: boolean;
    level?: string;
}

/** The part of `common.custom[<namespace>]` this component edits */
interface EventlistCustomData {
    enabled?: boolean;
    event?: string;
    changesOnly?: boolean;
    states?: StoredValueSettings[];
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
    hint: {
        marginTop: 16,
        fontStyle: 'italic',
        opacity: 0.7,
    },
};

/**
 * The settings of one state for the event list, shown in the custom tab of the objects.
 *
 * The same settings the old `admin/custom_m.html` offered - the event text, the texts and colours of
 * TRUE and FALSE, and "only changes" - but written into the data model the adapter uses today: the
 * texts and colours of the single values live in `states`, where `default` means "take it from the
 * instance settings".
 */
export default class EventlistCustom extends ConfigGeneric<ConfigGenericProps, ConfigGenericState> {
    async componentDidMount(): Promise<void> {
        await super.componentDidMount();

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

    /**
     * Change the text or the colour of one value.
     *
     * The whole list is written back, and the entries the dialog does not show - icon, level and the
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
                                onChange={e => this.updateValue(val, { text: e.target.checked ? DEFAULT_TEMPLATE : '' })}
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
                        label={I18n.t('Only changes')}
                    />
                    <FormHelperText>{I18n.t('Generate event only by state change')}</FormHelperText>
                </Grid>

                {isBoolean ? this.renderValue('true') : null}
                {isBoolean ? this.renderValue('false') : null}

                <Grid size={{ xs: 12 }}>
                    <Typography
                        variant="body2"
                        style={styles.hint}
                    >
                        {I18n.t('Icons, messengers and messages can be set in the instance settings')}
                    </Typography>
                </Grid>
            </Grid>
        );
    }
}
