import type { CSSProperties } from 'react';

/**
 * Styles for the icon picker of `@iobroker/gui-components`.
 *
 * The picker draws its label absolutely over its own content, and the content is a drop area with a
 * dashed border. So the border runs right through the text of the label and makes it hard to read.
 * Putting the label back into the normal flow puts it above the drop area, where it belongs; the
 * smaller font keeps the look of a shrunk MUI label.
 */
export const ICON_PICKER_STYLES: Record<string, CSSProperties> = {
    label: {
        position: 'relative',
        transform: 'none',
        fontSize: 12,
        marginBottom: 4,
    },
};
