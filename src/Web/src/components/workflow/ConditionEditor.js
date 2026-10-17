import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, IconButton, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { tokens } from '../../app/theme';
import { FieldValueInput, useEditor } from './editorContext';
const operatorsFor = (type) => {
    const base = ['Equals', 'NotEquals', 'IsEmpty', 'IsNotEmpty'];
    if (type === 'Number' || type === 'Money' || type === 'Date') {
        return ['Equals', 'NotEquals', 'GreaterThan', 'GreaterOrEqual', 'LessThan', 'LessOrEqual', 'IsEmpty', 'IsNotEmpty'];
    }
    if (type === 'Choice') {
        return [...base.slice(0, 2), 'In', ...base.slice(2)];
    }
    return base;
};
/** Rows of "field — operator — value", joined by AND (all) or OR (any). Only declared fields and fixed operators. */
export function ConditionEditor({ value, onChange }) {
    const { t, i18n } = useTranslation();
    const { screen, readOnly } = useEditor();
    const update = (index, change) => onChange({ ...value, rules: value.rules.map((r, i) => (i === index ? { ...r, ...change } : r)) });
    return (_jsxs(Box, { children: [value.rules.length > 1 && (_jsxs(ToggleButtonGroup, { size: "small", exclusive: true, value: value.matchAll ? 'all' : 'any', onChange: (_, v) => v && onChange({ ...value, matchAll: v === 'all' }), disabled: readOnly, sx: { mb: 1 }, children: [_jsx(ToggleButton, { value: "all", children: t('process.matchAll') }), _jsx(ToggleButton, { value: "any", children: t('process.matchAny') })] })), _jsx(Stack, { spacing: 1, children: value.rules.map((rule, index) => {
                    const field = screen.fields.find((f) => f.key === rule.fieldKey);
                    const operators = operatorsFor(field?.type);
                    const needsValue = rule.operator !== 'IsEmpty' && rule.operator !== 'IsNotEmpty';
                    return (_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, spacing: 1, sx: { alignItems: { md: 'center' } }, children: [index > 0 && (_jsx(Typography, { sx: { fontSize: 12, fontWeight: 700, color: tokens.navy600, minWidth: 28 }, children: value.matchAll ? t('process.and') : t('process.or') })), _jsx(TextField, { select: true, size: "small", label: t('process.field'), value: rule.fieldKey, disabled: readOnly, onChange: (e) => update(index, { fieldKey: e.target.value, operator: 'Equals', value: null, values: null }), sx: { minWidth: 170 }, children: screen.fields.map((f) => (_jsx(MenuItem, { value: f.key, children: localName(f, i18n.language) }, f.key))) }), _jsx(TextField, { select: true, size: "small", label: t('process.operator'), value: operators.includes(rule.operator) ? rule.operator : 'Equals', disabled: readOnly, onChange: (e) => update(index, { operator: e.target.value, value: null, values: null }), sx: { minWidth: 150 }, children: operators.map((op) => (_jsx(MenuItem, { value: op, children: t(`process.op.${op}`) }, op))) }), needsValue && rule.operator !== 'In' && (_jsx(Box, { sx: { flex: 1, minWidth: 160 }, children: _jsx(FieldValueInput, { field: field, value: rule.value, label: t('process.value'), onChange: (v) => update(index, { value: v }) }) })), rule.operator === 'In' && field?.options && (_jsx(TextField, { select: true, size: "small", label: t('process.values'), disabled: readOnly, value: rule.values ?? [], onChange: (e) => update(index, { values: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value }), slotProps: { select: { multiple: true } }, sx: { flex: 1, minWidth: 160 }, children: field.options.map((o) => (_jsx(MenuItem, { value: o.value, children: localName(o, i18n.language) }, o.value))) })), !readOnly && (_jsx(IconButton, { size: "small", onClick: () => onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) }), "aria-label": t('process.removeRule'), children: _jsx(DeleteOutlinedIcon, { fontSize: "small" }) }))] }, index));
                }) }), !readOnly && (_jsx(Button, { size: "small", startIcon: _jsx(AddIcon, {}), sx: { mt: 1 }, onClick: () => onChange({ ...value, rules: [...value.rules, { fieldKey: screen.fields[0]?.key ?? '', operator: 'Equals', value: null }] }), children: t('process.addRule') }))] }));
}
