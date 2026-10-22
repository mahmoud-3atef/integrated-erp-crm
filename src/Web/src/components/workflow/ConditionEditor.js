import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, IconButton, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { workflowApi } from '../../api/workflow';
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
/**
 * Rows of "table — field — operator — value", joined by AND (all) or OR (any): the table is the record itself or one of
 * its related tables (e.g. a transfer order's new project), and the field one of that table's. Only declared fields and
 * fixed operators.
 */
export function ConditionEditor({ value, onChange }) {
    const { t, i18n } = useTranslation();
    const { screen, readOnly } = useEditor();
    // Rules whose value is picked from the field's values (a list) rather than typed.
    const [picking, setPicking] = useState({});
    const update = (index, change) => onChange({ ...value, rules: value.rules.map((r, i) => (i === index ? { ...r, ...change } : r)) });
    const relations = screen.relations ?? [];
    const fieldsOf = (relation) => (relation ? (relations.find((r) => r.key === relation)?.fields ?? []) : screen.fields);
    const tables = [{ key: '', label: t('process.thisRecord') }, ...relations.map((r) => ({ key: r.key, label: localName(r, i18n.language) }))];
    // The first field of the same type: of the record, else of a related table (what a dynamic value starts with).
    const firstOfType = (type, except) => {
        for (const table of tables) {
            const match = fieldsOf(table.key || null).find((f) => f.type === type && `${table.key}.${f.key}` !== except);
            if (match)
                return { valueFromRelation: table.key || null, valueFromField: match.key };
        }
        return null;
    };
    return (_jsxs(Box, { children: [value.rules.length > 1 && (_jsxs(ToggleButtonGroup, { size: "small", exclusive: true, value: value.matchAll ? 'all' : 'any', onChange: (_, v) => v && onChange({ ...value, matchAll: v === 'all' }), disabled: readOnly, sx: { mb: 1 }, children: [_jsx(ToggleButton, { value: "all", children: t('process.matchAll') }), _jsx(ToggleButton, { value: "any", children: t('process.matchAny') })] })), _jsx(Stack, { spacing: 1, children: value.rules.map((rule, index) => {
                    const tableFields = fieldsOf(rule.relation);
                    const field = tableFields.find((f) => f.key === rule.fieldKey);
                    const operators = operatorsFor(field?.type);
                    const needsValue = rule.operator !== 'IsEmpty' && rule.operator !== 'IsNotEmpty';
                    const self = `${rule.relation ?? ''}.${rule.fieldKey}`;
                    const dynamic = !!rule.valueFromField && rule.operator !== 'In';
                    // A text field: its value can be picked among those it holds in the data (a list), or typed.
                    const listable = field?.type === 'Text';
                    const canBeDynamic = needsValue && rule.operator !== 'In' && firstOfType(field?.type, self) !== null;
                    return (_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, spacing: 1, sx: { alignItems: { md: 'center' } }, children: [index > 0 && (_jsx(Typography, { sx: { fontSize: 12, fontWeight: 700, color: tokens.navy600, minWidth: 28 }, children: value.matchAll ? t('process.and') : t('process.or') })), relations.length > 0 && (_jsxs(TextField, { select: true, size: "small", label: t('process.table'), value: rule.relation ?? '', disabled: readOnly, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, onChange: (e) => {
                                    const relation = e.target.value || null;
                                    update(index, { relation, fieldKey: fieldsOf(relation)[0]?.key ?? '', operator: 'Equals', value: null, values: null, valueFromField: null, valueFromRelation: null });
                                }, sx: { minWidth: 170 }, children: [_jsx(MenuItem, { value: "", children: t('process.thisRecord') }), relations.map((r) => (_jsx(MenuItem, { value: r.key, children: localName(r, i18n.language) }, r.key)))] })), _jsx(TextField, { select: true, size: "small", label: t('process.field'), value: rule.fieldKey, disabled: readOnly, onChange: (e) => update(index, { fieldKey: e.target.value, operator: 'Equals', value: null, values: null, valueFromField: null, valueFromRelation: null }), sx: { minWidth: 170 }, children: tableFields.map((f) => (_jsx(MenuItem, { value: f.key, children: localName(f, i18n.language) }, f.key))) }), _jsx(TextField, { select: true, size: "small", label: t('process.operator'), value: operators.includes(rule.operator) ? rule.operator : 'Equals', disabled: readOnly, onChange: (e) => {
                                    const op = e.target.value;
                                    // «In» and the empty tests take no other field.
                                    const keep = op === 'In' || op === 'IsEmpty' || op === 'IsNotEmpty' ? { valueFromField: null, valueFromRelation: null } : {};
                                    update(index, { operator: op, value: null, values: null, ...keep });
                                }, sx: { minWidth: 150 }, children: operators.map((op) => (_jsx(MenuItem, { value: op, children: t(`process.op.${op}`) }, op))) }), canBeDynamic && (_jsxs(TextField, { select: true, size: "small", label: t('process.valueFrom'), value: dynamic ? 'field' : (picking[index] ?? false) ? 'list' : 'value', disabled: readOnly, onChange: (e) => {
                                    setPicking((p) => ({ ...p, [index]: e.target.value === 'list' }));
                                    update(index, e.target.value === 'field' ? { ...firstOfType(field?.type, self), value: null, values: null } : { valueFromField: null, valueFromRelation: null });
                                }, sx: { minWidth: 150 }, children: [_jsx(MenuItem, { value: "value", children: field?.type === 'User' ? t('process.valueUser') : field?.type === 'Choice' || field?.type === 'Boolean' ? t('process.valueList') : t('process.valueFixed') }), listable && _jsx(MenuItem, { value: "list", children: t('process.valueList') }), _jsx(MenuItem, { value: "field", children: t('process.valueField') })] })), needsValue && dynamic && (_jsxs(_Fragment, { children: [relations.length > 0 && (_jsx(TextField, { select: true, size: "small", label: t('process.valueTable'), value: rule.valueFromRelation ?? '', disabled: readOnly, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, onChange: (e) => {
                                            const table = e.target.value || null;
                                            const first = fieldsOf(table).find((f) => f.type === field?.type && `${table ?? ''}.${f.key}` !== self);
                                            update(index, { valueFromRelation: table, valueFromField: first?.key ?? null });
                                        }, sx: { minWidth: 170 }, children: tables
                                            .filter((tb) => fieldsOf(tb.key || null).some((f) => f.type === field?.type && `${tb.key}.${f.key}` !== self))
                                            .map((tb) => (_jsx(MenuItem, { value: tb.key, children: tb.label }, tb.key))) })), _jsx(TextField, { select: true, size: "small", label: t('process.valueFieldName'), value: rule.valueFromField ?? '', disabled: readOnly, onChange: (e) => update(index, { valueFromField: e.target.value }), sx: { flex: 1, minWidth: 170 }, children: fieldsOf(rule.valueFromRelation)
                                            .filter((f) => f.type === field?.type && `${rule.valueFromRelation ?? ''}.${f.key}` !== self)
                                            .map((f) => (_jsx(MenuItem, { value: f.key, children: localName(f, i18n.language) }, f.key))) })] })), needsValue && !dynamic && rule.operator !== 'In' && listable && picking[index] && (_jsx(FieldValuesPicker, { screen: screen.code, relation: rule.relation, field: rule.fieldKey, value: rule.value ?? null, disabled: readOnly, onChange: (v) => update(index, { value: v }) })), needsValue && !dynamic && rule.operator !== 'In' && !(listable && picking[index]) && (_jsx(Box, { sx: { flex: 1, minWidth: 160 }, children: _jsx(FieldValueInput, { field: field, value: rule.value, label: field?.type === 'User' ? t('process.valueUser') : t('process.value'), onChange: (v) => update(index, { value: v }) }) })), rule.operator === 'In' && field?.options && (_jsx(TextField, { select: true, size: "small", label: t('process.values'), disabled: readOnly, value: rule.values ?? [], onChange: (e) => update(index, { values: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value }), slotProps: { select: { multiple: true } }, sx: { flex: 1, minWidth: 160 }, children: field.options.map((o) => (_jsx(MenuItem, { value: o.value, children: localName(o, i18n.language) }, o.value))) })), !readOnly && (_jsx(IconButton, { size: "small", onClick: () => onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) }), "aria-label": t('process.removeRule'), children: _jsx(DeleteOutlinedIcon, { fontSize: "small" }) }))] }, index));
                }) }), !readOnly && (_jsx(Button, { size: "small", startIcon: _jsx(AddIcon, {}), sx: { mt: 1 }, onClick: () => onChange({ ...value, rules: [...value.rules, { fieldKey: screen.fields[0]?.key ?? '', operator: 'Equals', value: null }] }), children: t('process.addRule') }))] }));
}
/** The values a text field holds in its table (the record's or a related one), to pick one instead of typing it. */
function FieldValuesPicker({ screen, relation, field, value, disabled, onChange }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(null);
    useEffect(() => {
        let live = true;
        setValues(null);
        workflowApi
            .fieldValues(screen, relation, field)
            .then((v) => live && setValues(v))
            .catch(() => live && setValues([]));
        return () => {
            live = false;
        };
    }, [screen, relation, field]);
    const options = values ?? [];
    return (_jsxs(TextField, { select: true, size: "small", label: t('process.value'), value: value && options.includes(value) ? value : '', disabled: disabled || values === null, helperText: values !== null && options.length === 0 ? t('process.noFieldValues') : undefined, onChange: (e) => onChange(e.target.value), sx: { flex: 1, minWidth: 180 }, children: [value && !options.includes(value) && _jsx(MenuItem, { value: value, children: value }), options.map((v) => (_jsx(MenuItem, { value: v, children: v }, v)))] }));
}
