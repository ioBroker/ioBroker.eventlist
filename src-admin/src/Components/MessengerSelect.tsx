import React, { Component, type CSSProperties, type JSX } from 'react';
import {
    Input,
    InputLabel,
    MenuItem,
    FormControl,
    ListItemText,
    Select,
    Checkbox,
    CircularProgress,
    type SelectChangeEvent,
} from '@mui/material';

import { I18n, type AdminConnection } from '@iobroker/gui-components';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;

interface MessengerSelectProps {
    /** Selected instance numbers, e.g. ['0', '1'] */
    selected?: string[];
    /** telegram, whatsapp-cmb, pushover, ... */
    adapterName: string;
    onChange: (selected: string[]) => void;
    label?: string;
    style?: CSSProperties;
    socket: AdminConnection;
}

interface MessengerSelectState {
    selected: string[];
    /** Instance numbers of the adapter or null if not loaded yet */
    instances: string[] | null;
    adapterName: string;
    loadedAdapterName: string;
    /** Names of the instances (same order as `instances`) */
    names: string[];
}

class MessengerSelect extends Component<MessengerSelectProps, MessengerSelectState> {
    constructor(props: MessengerSelectProps) {
        super(props);

        this.state = {
            selected: this.props.selected || [],
            instances: null,
            adapterName: this.props.adapterName,
            loadedAdapterName: '',
            names: [],
        };
    }

    componentDidMount(): void {
        void this.loadData(this.state.adapterName);
    }

    async loadData(adapterName: string): Promise<void> {
        const instances = await this.props.socket.getAdapterInstances(adapterName);
        const systemLang = I18n.getLanguage();
        const names = instances.map(item => {
            const title = item?.common?.titleLang || item?.common?.title || item?.common?.name;
            if (typeof title === 'object') {
                return title[systemLang] || title.en || '';
            }
            return title || '';
        });

        this.setState({
            instances: instances.map(item => item._id.split('.').pop() || ''),
            names,
            loadedAdapterName: adapterName,
        });
    }

    render(): JSX.Element | null {
        if (this.state.instances && this.state.loadedAdapterName !== this.state.adapterName) {
            setTimeout(() => this.loadData(this.state.adapterName), 100);
        }

        if (this.state.instances && !this.state.instances.length) {
            return null;
        }

        return (
            <FormControl
                variant="standard"
                style={this.props.style}
            >
                {!this.state.instances ? (
                    <CircularProgress />
                ) : (
                    <>
                        <InputLabel>{this.props.label || I18n.t('Send to messenger')}</InputLabel>
                        <Select
                            variant="standard"
                            multiple
                            value={this.state.selected}
                            onChange={(event: SelectChangeEvent<string[]>) => {
                                const value = event.target.value;
                                const selected = typeof value === 'string' ? value.split(',') : value;
                                this.setState({ selected }, () => this.props.onChange(this.state.selected));
                            }}
                            input={<Input />}
                            renderValue={(selected: string[]) => selected.join(', ')}
                            MenuProps={{
                                slotProps: {
                                    paper: {
                                        style: {
                                            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
                                            width: 250,
                                        },
                                    },
                                },
                            }}
                        >
                            {this.state.instances.map((name, i) => (
                                <MenuItem
                                    key={name}
                                    value={name}
                                >
                                    <Checkbox checked={this.state.selected.includes(name)} />
                                    <ListItemText
                                        primary={`${this.state.names[i] || this.props.adapterName}.${name}`}
                                    />
                                </MenuItem>
                            ))}
                        </Select>
                    </>
                )}
            </FormControl>
        );
    }
}

export default MessengerSelect;
