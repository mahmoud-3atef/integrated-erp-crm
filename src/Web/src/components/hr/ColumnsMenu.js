import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import { Box, Button, Checkbox, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
/**
 * A grid's optional columns the viewer hides or shows, remembered in their browser (a per-viewer convenience: if the
 * storage is blocked the choice lasts for the page only).
 */
export function useHiddenColumns(storageKey, optional, hiddenByDefault = []) {
    const [hidden, setHidden] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved === null)
                return [...hiddenByDefault];
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed.filter((k) => optional.includes(k)) : [...hiddenByDefault];
        }
        catch {
            return [...hiddenByDefault];
        }
    });
    const toggle = (key) => {
        const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
        setHidden(next);
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
        }
        catch {
            // The choice lasts for this page only.
        }
    };
    return { shown: (key) => !hidden.includes(key), toggle };
}
/** The «columns» button: a menu of the optional columns, each with its group's name. */
export function ColumnsButton({ columns, shown, toggle }) {
    const { t } = useTranslation();
    const [anchor, setAnchor] = useState(null);
    return (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", size: "small", startIcon: _jsx(ViewColumnOutlinedIcon, {}), onClick: (e) => setAnchor(e.currentTarget), sx: { height: 34, flex: '0 0 auto' }, children: t('common.columns') }), _jsx(Menu, { anchorEl: anchor, open: Boolean(anchor), onClose: () => setAnchor(null), children: columns.map((c) => (_jsxs(MenuItem, { dense: true, onClick: () => toggle(c.key), children: [_jsx(Checkbox, { size: "small", checked: shown(c.key), sx: { p: 0.25, marginInlineEnd: 1 } }), c.label, c.group && (_jsxs(Box, { component: "span", sx: { color: 'text.secondary', fontSize: 12, marginInlineStart: 0.75 }, children: ["\u00B7 ", c.group] }))] }, c.key))) })] }));
}
