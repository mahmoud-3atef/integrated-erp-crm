import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import { Box, Button, Checkbox, FormControlLabel, IconButton, ListItemText, Menu, MenuItem, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { newStepId, } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ConditionEditor } from './ConditionEditor';
import { FieldValueInput, useEditor, useFieldLabel } from './editorContext';
const icons = {
    approval: _jsx(HowToRegOutlinedIcon, {}),
    condition: _jsx(AccountTreeOutlinedIcon, {}),
    update: _jsx(EditNoteOutlinedIcon, {}),
    notify: _jsx(NotificationsActiveOutlinedIcon, {}),
    stop: _jsx(StopCircleOutlinedIcon, {}),
};
const colors = {
    approval: tokens.navy700,
    condition: tokens.gold,
    update: tokens.teal,
    notify: tokens.info,
    stop: tokens.danger,
};
export function newStep(type) {
    const id = newStepId();
    switch (type) {
        case 'approval':
            return { type, id, nameAr: '', nameEn: '', assignees: [{ kind: 'Role', roleId: null }], rule: 'Any', dueHours: null, requiredFields: [], allowReturn: true, allowDelegate: true, onApprove: [], onReject: [], onReturn: [] };
        case 'condition':
            return { type, id, branches: [{ condition: { matchAll: true, rules: [] }, steps: [] }], else: [] };
        case 'update':
            return { type, id, changes: [] };
        case 'notify':
            return { type, id, to: [{ kind: 'Submitter' }], titleAr: '', titleEn: '', bodyAr: '', bodyEn: '' };
        default:
            return { type: 'stop', id, outcome: 'Approved' };
    }
}
/** An ordered list of steps with "add step", as in the Dynamics CRM workflow designer. */
export function StepListEditor({ steps, onChange, emptyHint }) {
    const { t } = useTranslation();
    const { readOnly } = useEditor();
    const [menu, setMenu] = useState(null);
    const replace = (index, step) => onChange(steps.map((s, i) => (i === index ? step : s)));
    const move = (index, by) => {
        const next = [...steps];
        const [item] = next.splice(index, 1);
        next.splice(index + by, 0, item);
        onChange(next);
    };
    return (_jsxs(Stack, { children: [steps.length === 0 && emptyHint && _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, fontStyle: 'italic' }, children: emptyHint }), steps.map((step, index) => (_jsxs(Box, { children: [index > 0 && _jsx(Box, { "aria-hidden": true, sx: { width: 2, height: 18, mx: 'auto', bgcolor: tokens.gray300 } }), _jsx(StepCard, { step: step, number: index + 1, onChange: (s) => replace(index, s), onRemove: () => onChange(steps.filter((_, i) => i !== index)), onMove: (by) => move(index, by), isFirst: index === 0, isLast: index === steps.length - 1 })] }, step.id))), !readOnly && (_jsxs(Box, { sx: { mt: steps.length > 0 ? 1.5 : 0 }, children: [_jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(AddIcon, {}), onClick: (e) => setMenu(e.currentTarget), children: t('process.addStep') }), _jsx(Menu, { anchorEl: menu, open: menu !== null, onClose: () => setMenu(null), children: ['approval', 'condition', 'update', 'notify', 'stop'].map((type) => (_jsxs(MenuItem, { onClick: () => {
                                onChange([...steps, newStep(type)]);
                                setMenu(null);
                            }, children: [_jsx(Box, { component: "span", sx: { display: 'inline-flex', color: colors[type], marginInlineEnd: 1.5, '& svg': { fontSize: 20 } }, children: icons[type] }), _jsx(ListItemText, { primary: t(`process.type.${type}`), secondary: t(`process.typeHint.${type}`) })] }, type))) })] }))] }));
}
function StepCard({ step, number, onChange, onRemove, onMove, isFirst, isLast }) {
    const { t } = useTranslation();
    const { readOnly } = useEditor();
    const [open, setOpen] = useState(true);
    const summary = useStepSummary(step);
    const title = useStepTitle(step);
    const color = colors[step.type];
    return (_jsxs(Box, { component: "section", sx: { borderRadius: `${tokens.radius}px`, bgcolor: '#fff', border: `1.5px solid ${color}55`, boxShadow: tokens.shadowXs, overflow: 'hidden' }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25, px: 1.5, py: 1, bgcolor: `${color}12`, borderBottom: open ? `1px solid ${color}33` : 'none' }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 30, height: 30, borderRadius: '9px', bgcolor: color, color: '#fff', '& svg': { fontSize: 18 } }, children: icons[step.type] }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsxs(Box, { component: "span", sx: { flex: '0 0 auto', px: 1, borderRadius: 999, fontSize: 11, fontWeight: 800, color, bgcolor: '#fff', border: `1px solid ${color}55` }, children: [t('process.stepNumber', { number }), " \u00B7 ", t(`process.type.${step.type}`)] }), _jsx(Typography, { noWrap: true, sx: { fontSize: 14, fontWeight: 800, color: tokens.navy800 }, children: title })] }), _jsx(Typography, { noWrap: true, sx: { fontSize: 12, color: tokens.gray600, mt: 0.25 }, children: summary })] }), !readOnly && (_jsxs(_Fragment, { children: [_jsx(IconButton, { size: "small", disabled: isFirst, onClick: () => onMove(-1), "aria-label": t('routes.moveUp'), children: _jsx(ArrowUpwardIcon, { fontSize: "small" }) }), _jsx(IconButton, { size: "small", disabled: isLast, onClick: () => onMove(1), "aria-label": t('routes.moveDown'), children: _jsx(ArrowDownwardIcon, { fontSize: "small" }) }), _jsx(Tooltip, { title: t('process.removeStep'), children: _jsx(IconButton, { size: "small", onClick: onRemove, "aria-label": t('process.removeStep'), children: _jsx(DeleteOutlinedIcon, { fontSize: "small" }) }) })] })), _jsx(IconButton, { size: "small", onClick: () => setOpen((o) => !o), "aria-label": open ? t('process.collapse') : t('process.expand'), children: open ? _jsx(ExpandLessIcon, { fontSize: "small" }) : _jsx(ExpandMoreIcon, { fontSize: "small" }) })] }), open && (_jsxs(Box, { sx: { px: 1.75, pb: 1.75, pt: 1 }, children: [step.type !== 'approval' && (_jsx(TextField, { size: "small", fullWidth: true, label: t('process.stepLabel'), placeholder: t(`process.type.${step.type}`), value: step.label ?? '', disabled: readOnly, onChange: (e) => onChange({ ...step, label: e.target.value || null }), sx: { mt: 0.5, mb: 0.5 }, slotProps: { htmlInput: { maxLength: 200 } } })), step.type === 'approval' && _jsx(ApprovalEditor, { step: step, onChange: onChange }), step.type === 'condition' && _jsx(ConditionStepEditor, { step: step, onChange: onChange }), step.type === 'update' && _jsx(UpdateEditor, { step: step, onChange: onChange }), step.type === 'notify' && _jsx(NotifyEditor, { step: step, onChange: onChange }), step.type === 'stop' && _jsx(StopEditor, { step: step, onChange: onChange })] }))] }));
}
/** The step's name in its header: the stage name, or the label the designer gave it, or its type. */
function useStepTitle(step) {
    const { t, i18n } = useTranslation();
    if (step.type === 'approval') {
        return (i18n.language === 'ar' ? step.nameAr : step.nameEn) || step.label || t('process.unnamedStage');
    }
    return step.label || t(`process.type.${step.type}`);
}
function useStepSummary(step) {
    const { t, i18n } = useTranslation();
    const label = useFieldLabel();
    const { screen } = useEditor();
    switch (step.type) {
        case 'approval':
            return t('process.assigneeCount', { count: step.assignees.length }) + (step.dueHours ? ` — ${t('process.dueIn', { hours: step.dueHours })}` : '');
        case 'condition':
            return t('process.branchCount', { count: step.branches.length });
        case 'update': {
            const relation = step.target ? screen.relations?.find((r) => r.key === step.target) : undefined;
            const table = relation ? localName(relation, i18n.language) : localName(screen, i18n.language);
            const names = step.changes.map((c) => {
                const field = (relation ? relation.fields : screen.fields).find((f) => f.key === c.fieldKey);
                return field ? localName(field, i18n.language) : label(c.fieldKey);
            });
            return `${table}: ${names.join('، ') || t('process.noChanges')}`;
        }
        case 'notify':
            return (i18n.language === 'ar' ? step.titleAr : step.titleEn) || '—';
        default:
            return t(`process.outcome.${step.outcome}`);
    }
}
/** Nested list under a heading, indented like a CRM workflow's inner steps. */
function Branch({ title, hint, children }) {
    return (_jsxs(Box, { sx: { mt: 1.5, paddingInlineStart: 2, borderInlineStart: `2px dashed ${tokens.gray300}` }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: tokens.navy700, mb: 0.75 }, children: title }), hint && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, mb: 0.75 }, children: hint }), children] }));
}
// ---------------------------------------------------------------- Approval stage
function ApprovalEditor({ step, onChange }) {
    const { t, i18n } = useTranslation();
    const { screen, readOnly } = useEditor();
    const set = (change) => onChange({ ...step, ...change });
    const userFields = screen.fields.filter((f) => f.type === 'User');
    const updatable = screen.fields.filter((f) => f.updatable);
    const setAssignee = (index, change) => set({ assignees: step.assignees.map((a, i) => (i === index ? { ...a, ...change } : a)) });
    return (_jsxs(Stack, { spacing: 1.5, sx: { mt: 1 }, children: [_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1.5, children: [_jsx(TextField, { size: "small", label: t('process.stageNameAr'), value: step.nameAr, disabled: readOnly, onChange: (e) => set({ nameAr: e.target.value }), slotProps: { htmlInput: { dir: 'rtl', maxLength: 200 } } }), _jsx(TextField, { size: "small", label: t('process.stageNameEn'), value: step.nameEn, disabled: readOnly, onChange: (e) => set({ nameEn: e.target.value }), slotProps: { htmlInput: { dir: 'ltr', maxLength: 200 } } })] }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: tokens.navy800 }, children: t('process.assignees') }), step.assignees.map((a, index) => (_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1, sx: { alignItems: { sm: 'center' } }, children: [_jsxs(TextField, { select: true, size: "small", label: t('routes.approverKind'), value: a.kind, disabled: readOnly, onChange: (e) => setAssignee(index, { kind: e.target.value, userId: null, roleId: null, fieldKey: null }), sx: { maxWidth: { sm: 200 } }, children: [_jsx(MenuItem, { value: "Role", children: t('process.assignee.Role') }), _jsx(MenuItem, { value: "User", children: t('process.assignee.User') }), _jsx(MenuItem, { value: "UserField", disabled: userFields.length === 0, children: t('process.assignee.UserField') })] }), _jsx(PersonPicker, { kind: a.kind, value: a.kind === 'Role' ? a.roleId : a.kind === 'User' ? a.userId : a.fieldKey, onChange: (v) => setAssignee(index, a.kind === 'Role' ? { roleId: v } : a.kind === 'User' ? { userId: v } : { fieldKey: v }) }), !readOnly && step.assignees.length > 1 && (_jsx(IconButton, { size: "small", onClick: () => set({ assignees: step.assignees.filter((_, i) => i !== index) }), "aria-label": t('process.removeAssignee'), children: _jsx(DeleteOutlinedIcon, { fontSize: "small" }) }))] }, index))), !readOnly && (_jsx(Box, { children: _jsx(Button, { size: "small", startIcon: _jsx(AddIcon, {}), onClick: () => set({ assignees: [...step.assignees, { kind: 'User', userId: null }] }), disabled: step.assignees.length >= 10, children: t('process.addAssignee') }) })), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1.5, sx: { alignItems: { sm: 'center' } }, children: [_jsxs(ToggleButtonGroup, { size: "small", exclusive: true, value: step.rule, disabled: readOnly, onChange: (_, v) => v && set({ rule: v }), children: [_jsx(ToggleButton, { value: "Any", children: t('process.ruleAny') }), _jsx(ToggleButton, { value: "All", children: t('process.ruleAll') })] }), _jsx(TextField, { size: "small", label: t('process.dueHours'), value: step.dueHours ?? '', disabled: readOnly, onChange: (e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                            set({ dueHours: digits ? Number(digits) : null });
                        }, sx: { maxWidth: 180 }, slotProps: { htmlInput: { dir: 'ltr', inputMode: 'numeric' } } })] }), updatable.length > 0 && (_jsx(TextField, { select: true, size: "small", label: t('process.requiredFields'), helperText: t('process.requiredFieldsHint'), value: step.requiredFields, disabled: readOnly, onChange: (e) => set({ requiredFields: typeof e.target.value === 'string' ? e.target.value.split(',').filter(Boolean) : e.target.value }), slotProps: { select: { multiple: true, renderValue: (v) => v.map((k) => localName(updatable.find((f) => f.key === k) ?? { nameAr: k, nameEn: k }, i18n.language)).join('، ') } }, children: updatable.map((f) => (_jsxs(MenuItem, { value: f.key, children: [_jsx(Checkbox, { size: "small", checked: step.requiredFields.includes(f.key) }), localName(f, i18n.language)] }, f.key))) })), _jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: 2 }, children: [_jsx(FormControlLabel, { control: _jsx(Switch, { size: "small", checked: step.allowReturn, disabled: readOnly, onChange: (e) => set({ allowReturn: e.target.checked }) }), label: t('process.allowReturn') }), _jsx(FormControlLabel, { control: _jsx(Switch, { size: "small", checked: step.allowDelegate, disabled: readOnly, onChange: (e) => set({ allowDelegate: e.target.checked }) }), label: t('process.allowDelegate') })] }), _jsx(Branch, { title: t('process.onApprove'), hint: t('process.onApproveHint'), children: _jsx(StepListEditor, { steps: step.onApprove, onChange: (s) => set({ onApprove: s }) }) }), _jsx(Branch, { title: t('process.onReject'), hint: t('process.onRejectHint'), children: _jsx(StepListEditor, { steps: step.onReject, onChange: (s) => set({ onReject: s }) }) }), step.allowReturn && (_jsx(Branch, { title: t('process.onReturn'), hint: t('process.onReturnHint'), children: _jsx(StepListEditor, { steps: step.onReturn, onChange: (s) => set({ onReturn: s }) }) }))] }));
}
/** A role, a user, or a user field of the record. */
function PersonPicker({ kind, value, onChange, label }) {
    const { t, i18n } = useTranslation();
    const { screen, options, readOnly } = useEditor();
    if (kind === 'Submitter') {
        return null;
    }
    const items = kind === 'Role'
        ? options.roles.map((r) => ({ value: r.id, label: localName(r, i18n.language) }))
        : kind === 'User'
            ? options.members.map((m) => ({ value: m.userAccountId, label: m.displayName }))
            : screen.fields.filter((f) => f.type === 'User').map((f) => ({ value: f.key, label: localName(f, i18n.language) }));
    return (_jsx(TextField, { select: true, size: "small", label: label ?? t(`process.assignee.${kind}`), value: value ?? '', disabled: readOnly, onChange: (e) => onChange(e.target.value), sx: { flex: 1 }, children: items.map((i) => (_jsx(MenuItem, { value: i.value, children: i.label }, i.value))) }));
}
// ---------------------------------------------------------------- Condition
function ConditionStepEditor({ step, onChange }) {
    const { t } = useTranslation();
    const { readOnly } = useEditor();
    const setBranch = (index, change) => onChange({ ...step, branches: step.branches.map((b, i) => (i === index ? { ...b, ...change } : b)) });
    return (_jsxs(Box, { sx: { mt: 1 }, children: [step.branches.map((branch, index) => (_jsxs(Box, { sx: { mb: 1.5, p: 1.25, borderRadius: '10px', bgcolor: tokens.gray50 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', mb: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800, fontSize: 13 }, children: index === 0 ? t('process.if') : t('process.elseIf') }), !readOnly && step.branches.length > 1 && (_jsx(IconButton, { size: "small", onClick: () => onChange({ ...step, branches: step.branches.filter((_, i) => i !== index) }), "aria-label": t('process.removeBranch'), children: _jsx(DeleteOutlinedIcon, { fontSize: "small" }) }))] }), _jsx(ConditionEditor, { value: branch.condition, onChange: (condition) => setBranch(index, { condition }) }), _jsx(Branch, { title: t('process.then'), children: _jsx(StepListEditor, { steps: branch.steps, onChange: (steps) => setBranch(index, { steps }) }) })] }, index))), !readOnly && (_jsx(Button, { size: "small", startIcon: _jsx(AddIcon, {}), onClick: () => onChange({ ...step, branches: [...step.branches, { condition: { matchAll: true, rules: [] }, steps: [] }] }), disabled: step.branches.length >= 10, children: t('process.addElseIf') })), _jsx(Branch, { title: t('process.else'), hint: t('process.elseHint'), children: _jsx(StepListEditor, { steps: step.else, onChange: (steps) => onChange({ ...step, else: steps }) }) })] }));
}
// ---------------------------------------------------------------- Update record
const recordTable = '__record';
function UpdateEditor({ step, onChange }) {
    const { t, i18n } = useTranslation();
    const { screen, readOnly } = useEditor();
    const relations = (screen.relations ?? []).filter((r) => r.fields.some((f) => f.updatable));
    const relation = step.target ? (screen.relations ?? []).find((r) => r.key === step.target) : undefined;
    const tableFields = relation ? relation.fields : screen.fields;
    const updatable = tableFields.filter((f) => f.updatable);
    const setChange = (index, change) => onChange({ ...step, changes: step.changes.map((c, i) => (i === index ? { ...c, ...change } : c)) });
    return (_jsxs(Stack, { spacing: 1.25, sx: { mt: 1 }, children: [_jsxs(TextField, { select: true, size: "small", label: t('process.table'), helperText: relations.length === 0 ? t('process.noRelatedTables') : t('process.tableHint'), value: step.target ?? recordTable, disabled: readOnly, onChange: (e) => onChange({ ...step, target: e.target.value === recordTable ? null : e.target.value, changes: [] }), sx: { maxWidth: 420 }, children: [_jsx(MenuItem, { value: recordTable, children: t('process.thisRecord', { screen: localName(screen, i18n.language) }) }), relations.map((r) => (_jsx(MenuItem, { value: r.key, children: t('process.relatedTable', { table: localName(r, i18n.language) }) }, r.key)))] }), updatable.length === 0 && _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('process.nothingUpdatable') }), step.changes.map((change, index) => {
                const field = tableFields.find((f) => f.key === change.fieldKey);
                const sameType = screen.fields.filter((f) => f.type === field?.type && f.key !== field?.key);
                const fromField = change.fromField !== null && change.fromField !== undefined;
                return (_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, spacing: 1, sx: { alignItems: { md: 'center' } }, children: [_jsx(TextField, { select: true, size: "small", label: t('process.field'), value: change.fieldKey, disabled: readOnly, onChange: (e) => setChange(index, { fieldKey: e.target.value, value: null, fromField: null }), sx: { minWidth: 170 }, children: updatable.map((f) => (_jsx(MenuItem, { value: f.key, children: localName(f, i18n.language) }, f.key))) }), _jsxs(TextField, { select: true, size: "small", label: t('process.setTo'), value: fromField ? 'field' : 'value', disabled: readOnly || sameType.length === 0, onChange: (e) => setChange(index, e.target.value === 'field' ? { fromField: sameType[0]?.key ?? null, value: null } : { fromField: null }), sx: { minWidth: 150 }, children: [_jsx(MenuItem, { value: "value", children: t('process.fixedValue') }), _jsx(MenuItem, { value: "field", children: t('process.fromField') })] }), _jsx(Box, { sx: { flex: 1, minWidth: 160 }, children: fromField ? (_jsx(TextField, { select: true, size: "small", label: t('process.field'), value: change.fromField ?? '', disabled: readOnly, onChange: (e) => setChange(index, { fromField: e.target.value }), children: sameType.map((f) => (_jsx(MenuItem, { value: f.key, children: localName(f, i18n.language) }, f.key))) })) : (_jsx(FieldValueInput, { field: field && field.options ? { ...field, options: field.options.filter((o) => o.settable) } : field, value: change.value, label: t('process.value'), onChange: (v) => setChange(index, { value: v }) })) }), !readOnly && (_jsx(IconButton, { size: "small", onClick: () => onChange({ ...step, changes: step.changes.filter((_, i) => i !== index) }), "aria-label": t('process.removeRule'), children: _jsx(DeleteOutlinedIcon, { fontSize: "small" }) }))] }, index));
            }), !readOnly && (_jsx(Box, { children: _jsx(Button, { size: "small", startIcon: _jsx(AddIcon, {}), disabled: updatable.length === 0, onClick: () => onChange({ ...step, changes: [...step.changes, { fieldKey: updatable[0].key, value: null }] }), children: t('process.addField') }) }))] }));
}
// ---------------------------------------------------------------- Notify
function NotifyEditor({ step, onChange }) {
    const { t } = useTranslation();
    const { screen, readOnly } = useEditor();
    const set = (change) => onChange({ ...step, ...change });
    const setRecipient = (index, change) => set({ to: step.to.map((r, i) => (i === index ? { ...r, ...change } : r)) });
    const placeholders = ['title', 'submitter', ...screen.fields.map((f) => f.key)].map((k) => `{${k}}`).join(' ');
    return (_jsxs(Stack, { spacing: 1.25, sx: { mt: 1 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: tokens.navy800 }, children: t('process.recipients') }), step.to.map((r, index) => (_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1, sx: { alignItems: { sm: 'center' } }, children: [_jsxs(TextField, { select: true, size: "small", label: t('process.recipient'), value: r.kind, disabled: readOnly, onChange: (e) => setRecipient(index, { kind: e.target.value, userId: null, roleId: null, fieldKey: null }), sx: { maxWidth: { sm: 200 } }, children: [_jsx(MenuItem, { value: "Submitter", children: t('process.assignee.Submitter') }), _jsx(MenuItem, { value: "Role", children: t('process.assignee.Role') }), _jsx(MenuItem, { value: "User", children: t('process.assignee.User') }), _jsx(MenuItem, { value: "UserField", children: t('process.assignee.UserField') })] }), _jsx(PersonPicker, { kind: r.kind, value: r.kind === 'Role' ? r.roleId : r.kind === 'User' ? r.userId : r.fieldKey, onChange: (v) => setRecipient(index, r.kind === 'Role' ? { roleId: v } : r.kind === 'User' ? { userId: v } : { fieldKey: v }) }), !readOnly && step.to.length > 1 && (_jsx(IconButton, { size: "small", onClick: () => set({ to: step.to.filter((_, i) => i !== index) }), "aria-label": t('process.removeAssignee'), children: _jsx(DeleteOutlinedIcon, { fontSize: "small" }) }))] }, index))), !readOnly && (_jsx(Box, { children: _jsx(Button, { size: "small", startIcon: _jsx(AddIcon, {}), onClick: () => set({ to: [...step.to, { kind: 'User', userId: null }] }), children: t('process.addRecipient') }) })), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1.5, children: [_jsx(TextField, { size: "small", label: t('process.titleAr'), value: step.titleAr, disabled: readOnly, onChange: (e) => set({ titleAr: e.target.value }), slotProps: { htmlInput: { dir: 'rtl', maxLength: 200 } } }), _jsx(TextField, { size: "small", label: t('process.titleEn'), value: step.titleEn, disabled: readOnly, onChange: (e) => set({ titleEn: e.target.value }), slotProps: { htmlInput: { dir: 'ltr', maxLength: 200 } } })] }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1.5, children: [_jsx(TextField, { size: "small", multiline: true, minRows: 2, label: t('process.bodyAr'), value: step.bodyAr, disabled: readOnly, onChange: (e) => set({ bodyAr: e.target.value }), slotProps: { htmlInput: { dir: 'rtl', maxLength: 1500 } } }), _jsx(TextField, { size: "small", multiline: true, minRows: 2, label: t('process.bodyEn'), value: step.bodyEn, disabled: readOnly, onChange: (e) => set({ bodyEn: e.target.value }), slotProps: { htmlInput: { dir: 'ltr', maxLength: 1500 } } })] }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, dir: "ltr", children: [t('process.placeholders'), " ", placeholders] })] }));
}
// ---------------------------------------------------------------- Stop
function StopEditor({ step, onChange }) {
    const { t } = useTranslation();
    const { readOnly } = useEditor();
    return (_jsx(TextField, { select: true, size: "small", label: t('process.endAs'), value: step.outcome, disabled: readOnly, onChange: (e) => onChange({ ...step, outcome: e.target.value }), sx: { mt: 1, maxWidth: 260 }, children: ['Approved', 'Rejected', 'Canceled'].map((o) => (_jsx(MenuItem, { value: o, children: t(`process.outcome.${o}`) }, o))) }));
}
