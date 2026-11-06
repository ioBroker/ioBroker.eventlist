/**
 * The content of an element dialog: the host frames it (title, close button, backdrop) and moves the element into
 * its own dialog - out of the element of the component. So the content brings its styles in a shadow root of its own
 * and takes the theme along as CSS variables.
 */
import { createRoot, type Root } from 'react-dom/client';

import type { WebComponentTheme } from '@iobroker/web-components';
import { getThemeCssVariables } from '@iobroker/web-components/element';

import { DIALOG_STYLES } from './styles';

export interface DialogContent {
    /** Goes to `openDialog({ element })` */
    element: HTMLElement;
    /** Draw into it; unmount it when the dialog is closed */
    root: Root;
}

/**
 * A new content for an element dialog
 *
 * @param theme the theme of the host
 */
export function createDialogContent(theme: WebComponentTheme): DialogContent {
    const element = document.createElement('div');
    for (const [name, value] of Object.entries(getThemeCssVariables(theme))) {
        element.style.setProperty(name, value);
    }
    const shadow = element.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = DIALOG_STYLES;
    const mount = document.createElement('div');
    mount.className = 'dialog';
    shadow.append(style, mount);
    return { element, root: createRoot(mount) };
}
