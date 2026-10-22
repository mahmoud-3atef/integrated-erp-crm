import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MenuItem, TextField } from '@mui/material';
import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { DateField } from '../DateField';
export const EditorContext = createContext(null);
export function useEditor() {
    const data = useContext(EditorContext);
    if (!data) {
        throw new Error('useEditor must be used inside the process editor');
    }
    return data;
}
export function useFieldLabel() {
    const { i18n } = useTranslation();
    const { screen } = useEditor();
    return (key) => {
        const field = screen.fields.find((f) => f.key === key);
        return field ? localName(field, i18n.language) : (key ?? '');
    };
}
/** Shows a stored value in words (choice name, user name, registration code). */
export function useValueLabel() {
    const { t, i18n } = useTranslation();
    const { options, legalEntities } = useEditor();
    return (field, value) => {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        switch (field?.type) {
            case 'Choice': {
                const option = field.options?.find((o) => o.value === value);
                return option ? localName(option, i18n.language) : value;
            }
            case 'User':
                return options.members.find((m) => m.userAccountId === value)?.displayName ?? value;
            case 'LegalEntity':
                return legalEntities.find((e) => e.id === value)?.code ?? value;
            case 'Boolean':
                return value === 'true' ? t('common.yes') : t('common.no');
            default:
                return value;
        }
    };
}
/** The right input for a field's type; values are invariant strings, as the server stores them. */
export function FieldValueInput({ field, value, onChange, label }) {
    const { t, i18n } = useTranslation();
    const { options, legalEntities, readOnly } = useEditor();
    const common = { size: 'small', label, value: value ?? '', disabled: readOnly || !field, onChange: (e) => onChange(e.target.value) };
    switch (field?.type) {
        case 'Choice':
            return (_jsx(TextField, { select: true, ...common, children: (field.options ?? []).map((o) => (_jsx(MenuItem, { value: o.value, children: localName(o, i18n.language) }, o.value))) }));
        case 'User':
            return (_jsx(TextField, { select: true, ...common, children: options.members.map((m) => (_jsx(MenuItem, { value: m.userAccountId, children: m.displayName }, m.userAccountId))) }));
        case 'LegalEntity':
            return (_jsx(TextField, { select: true, ...common, children: legalEntities.map((e) => (_jsx(MenuItem, { value: e.id, children: `${e.code} — ${localName(e, i18n.language)}` }, e.id))) }));
        case 'Boolean':
            return (_jsxs(TextField, { select: true, ...common, children: [_jsx(MenuItem, { value: "true", children: t('common.yes') }), _jsx(MenuItem, { value: "false", children: t('common.no') })] }));
        case 'Date':
            return _jsx(DateField, { ...common, slotProps: { inputLabel: { shrink: true } } });
        case 'Number':
        case 'Money':
            return _jsx(TextField, { ...common, onChange: (e) => onChange(e.target.value.replace(/[^\d.-]/g, '')), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } });
        default:
            return _jsx(TextField, { ...common });
    }
}
