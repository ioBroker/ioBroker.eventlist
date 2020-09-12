import React from 'react';
import PropTypes from 'prop-types';
import {withStyles} from '@material-ui/core/styles';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import ListItemText from '@material-ui/core/ListItemText';
import Select from '@material-ui/core/Select';
import Checkbox from '@material-ui/core/Checkbox';
import CircularProgress from '@material-ui/core/CircularProgress';

import I18n from '@iobroker/adapter-react/i18n';

const styles = theme => ({

});

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;

class MessengerSelect extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            selected: this.props.selected || [],
            instances: null,
            adapterName: this.props.adapterName,
            loadedAdapterName: this.props.adapterName,
            names: [],
        };

        this.loadData(this.state.adapterName);
    }

    loadData(adapterName) {
        return this.props.socket.getAdapterInstances(adapterName)
            .then(instances => {
                const systemLang = I18n.getLanguage();
                const names = instances.map(item => {
                    const title = (item && item.common && (item.common.titleLang || item.common.title)) || item.common.name;
                    if (typeof title === 'object') {
                        return title[systemLang] || title.en;
                    } else {
                        return title;
                    }
                });
                return this.setState({instances: instances.map(item => item._id.split('.').pop()), names, loadedAdapterName: adapterName});
            });
    }

    /*static getDerivedStateFromProps(props, state) {
        const newState = {};
        let changed = false;
        if (props.selected && JSON.stringify(props.selected) !== JSON.stringify(state.selected)) {
            newState.selected = props.selected ? JSON.parse(JSON.stringify(props.selected)) : [];
            changed = true;
        }
        if (props.adapterName && props.adapterName !== state.adapterName) {
            newState.adapterName = props.adapterName;
            changed = true;
        }

        return changed ? newState : null;
    }*/


    render() {
        if (this.state.loadedAdapterName !== this.state.adapterName) {
            setTimeout(() => this.loadData(this.state.adapterName), 100);
        }

        if (this.state.instances && !this.state.instances.length) {
            return null;
        }

        return <FormControl className={(this.props.classes.formControl || '') + ' ' + this.props.className} style={this.props.style || {}}>
            {!this.state.instances ?
                <CircularProgress/> :
                <>
                    <InputLabel>{this.props.label || I18n.t('Send to messenger')}</InputLabel>
                    <Select
                        multiple
                        value={this.state.selected}
                        onChange={event => {
                            this.setState({selected: event.target.value}, () => this.props.onChange(this.state.selected))
                        }}
                        input={<Input />}
                        renderValue={selected => selected.join(', ')}
                        MenuProps={{
                            PaperProps: {
                                style: {
                                    maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
                                    width: 250
                                }
                            }
                        }}
                    >
                        {this.state.instances.map((name, i) =>
                            <MenuItem key={name} value={name}>
                                <Checkbox checked={this.state.selected.includes(name)} />
                                <ListItemText primary={(this.state.names[i] || this.props.adapterName) + '.' + name} />
                            </MenuItem>
                        )}
                    </Select>
                </>}
            </FormControl>;
    }
}

MessengerSelect.propTypes = {
    selected: PropTypes.array,
    adapterName: PropTypes.string.isRequired, // telegram, whatsapp-cmb, pushover, ...
    onChange: PropTypes.func.isRequired,
    label: PropTypes.string,
    style: PropTypes.object,
    className: PropTypes.string,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(MessengerSelect);
