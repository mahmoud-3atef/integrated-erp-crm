import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { deductionsApi, penaltyEffects, sar } from '../../api/deductions';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { AdvanceDialog, AdvancesTable } from './advances';
import { PenaltiesTable, PenaltyDialog } from './penalties';
function NumberField({ label, value, onChange, unit, disabled }) {
    return (_jsx(TextField, { size: "small", type: "number", label: label, value: value, disabled: disabled, onChange: (e) => onChange(Number(e.target.value)), slotProps: { htmlInput: { min: 0, step: 'any', dir: 'ltr' }, input: { endAdornment: _jsx(InputAdornment, { position: "end", children: unit }) } } }));
}
function Card({ icon, title, children }) {
    return (_jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1.5, color: hr.text, '& svg': { color: hr.primary, fontSize: 20 } }, children: [icon, _jsx(Typography, { sx: { fontWeight: 700 }, children: title })] }), _jsx(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }, children: children })] }));
}
/** A penalty type of the company's own, or one of the four renamed or stopped. */
function TypeDialog({ type, onClose, onSaved }) {
    const { t } = useTranslation();
    const [nameAr, setNameAr] = useState(type?.nameAr ?? '');
    const [nameEn, setNameEn] = useState(type?.nameEn ?? '');
    const [effect, setEffect] = useState(type?.effect ?? 'DeductDays');
    const [active, setActive] = useState(type?.isActive ?? true);
    const [order, setOrder] = useState(type?.sortOrder ?? 10);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await deductionsApi.saveType(type?.id ?? null, { nameAr: nameAr.trim(), nameEn: nameEn.trim() || null, effect, isActive: active, sortOrder: order });
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: type ? t('deductions.types.edit') : t('deductions.types.new') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(TextField, { size: "small", required: true, label: t('deductions.types.nameAr'), value: nameAr, onChange: (e) => setNameAr(e.target.value), slotProps: { htmlInput: { maxLength: 100 } } }), _jsx(TextField, { size: "small", label: t('deductions.types.nameEn'), value: nameEn, onChange: (e) => setNameEn(e.target.value), slotProps: { htmlInput: { maxLength: 100, dir: 'ltr' } } }), _jsx(TextField, { select: true, size: "small", label: t('deductions.types.effect'), value: effect, onChange: (e) => setEffect(e.target.value), children: penaltyEffects.map((x) => (_jsx(MenuItem, { value: x, children: t(`deductions.effects.${x}`) }, x))) }), _jsx(TextField, { size: "small", type: "number", label: t('deductions.types.order'), value: order, onChange: (e) => setOrder(Number(e.target.value)), slotProps: { htmlInput: { dir: 'ltr' } } }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: active, onChange: (e) => setActive(e.target.checked) }), label: t('deductions.types.active') }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !nameAr.trim(), onClick: () => void save(), children: t('common.save') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
/** The advance conditions, the legal penalty limits, the month's cap, and the penalty types. */
export function DeductionSettingsPage() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const navigate = useNavigate();
    const { can } = useSession();
    const editable = can('deductions.settings', true);
    const [setup, setSetup] = useState(null);
    const [s, setS] = useState(null);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(null);
    useCrumb(t('deductions.settings.pageTitle'));
    const load = useCallback(() => {
        deductionsApi
            .setup()
            .then((x) => (setSetup(x), setS(x.settings), setError(null)))
            .catch((f) => setError(errorKey(f)));
    }, []);
    useEffect(load, [load]);
    if (!setup || !s) {
        return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    const set = (k, v) => (setS({ ...s, [k]: v }), setSaved(false));
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await deductionsApi.saveSettings(s);
            setSaved(true);
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const percent = '%';
    const days = t('deductions.settings.daysUnit');
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(SettingsOutlinedIcon, {}), title: t('deductions.settings.pageTitle'), subtitle: t('deductions.settings.intro'), actions: _jsxs(_Fragment, { children: [editable && (_jsx(Button, { variant: "contained", disabled: busy, onClick: () => void save(), children: saved ? t('deductions.settings.saved') : t('common.save') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }, children: [_jsxs(Card, { icon: _jsx(CreditCardOutlinedIcon, {}), title: t('deductions.settings.advances'), children: [_jsx(NumberField, { label: t('deductions.settings.advanceCap'), unit: percent, value: s.advanceCapPercent, onChange: (v) => set('advanceCapPercent', v), disabled: !editable }), _jsx(NumberField, { label: t('deductions.settings.maxMonths'), unit: t('deductions.settings.monthsUnit'), value: s.advanceMaxMonths, onChange: (v) => set('advanceMaxMonths', v), disabled: !editable }), _jsx(NumberField, { label: t('deductions.settings.minService'), unit: t('deductions.settings.monthsUnit'), value: s.advanceMinServiceMonths, onChange: (v) => set('advanceMinServiceMonths', v), disabled: !editable }), _jsx(Box, {}), _jsx(FormControlLabel, { control: _jsx(Checkbox, { disabled: !editable, checked: s.advanceAfterProbation, onChange: (e) => set('advanceAfterProbation', e.target.checked) }), label: t('deductions.settings.afterProbation') }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { disabled: !editable, checked: s.advanceOneOpen, onChange: (e) => set('advanceOneOpen', e.target.checked) }), label: t('deductions.settings.oneOpen') })] }), _jsxs(Card, { icon: _jsx(BalanceOutlinedIcon, {}), title: t('deductions.settings.limits'), children: [_jsx(NumberField, { label: t('deductions.settings.perViolation'), unit: days, value: s.penaltyMaxDaysPerViolation, onChange: (v) => set('penaltyMaxDaysPerViolation', v), disabled: !editable }), _jsx(NumberField, { label: t('deductions.settings.perMonth'), unit: days, value: s.penaltyMaxDaysPerMonth, onChange: (v) => set('penaltyMaxDaysPerMonth', v), disabled: !editable }), _jsx(NumberField, { label: t('deductions.settings.suspension'), unit: days, value: s.suspensionMaxDaysPerMonth, onChange: (v) => set('suspensionMaxDaysPerMonth', v), disabled: !editable }), _jsx(NumberField, { label: t('deductions.settings.monthlyCap'), unit: percent, value: s.monthlyCapPercent, onChange: (v) => set('monthlyCapPercent', v), disabled: !editable }), _jsx(Typography, { sx: { gridColumn: '1 / -1', fontSize: 12, color: hr.textMuted }, children: t('deductions.settings.capNote') })] })] }), _jsxs(Box, { sx: { ...hrCard, p: 2, mt: 2 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }, children: [_jsx(Typography, { sx: { fontWeight: 700 }, children: t('deductions.types.title') }), editable && (_jsx(Button, { variant: "outlined", startIcon: _jsx(Add, {}), onClick: () => setEditing('new'), children: t('deductions.types.new') }))] }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44 }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('deductions.types.name') }), _jsx(TableCell, { children: t('deductions.types.effect') }), _jsx(TableCell, { children: t('deductions.cols.status') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: setup.penaltyTypes.map((x) => (_jsxs(TableRow, { children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: ar ? x.nameAr : x.nameEn }), _jsx(TableCell, { children: t(`deductions.effects.${x.effect}`) }), _jsx(TableCell, { children: x.isActive ? _jsx(HrStatusBadge, { label: t('deductions.types.activeBadge'), color: hr.success, tint: "#D1FAE5" }) : _jsx(HrStatusBadge, { label: t('deductions.types.stopped'), color: hr.textMuted, tint: hr.muted }) }), _jsx(TableCell, { sx: { textAlign: 'end' }, children: editable && (_jsx(IconButton, { size: "small", "aria-label": t('common.edit'), onClick: () => setEditing(x), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) })) })] }, x.id))) })] }) })] }), editing && (_jsx(TypeDialog, { type: editing === 'new' ? null : editing, onClose: () => setEditing(null), onSaved: () => {
                    setEditing(null);
                    load();
                } }))] }));
}
/** The employee file's «advances and penalties» tab: open advances, warnings, the year's penalty days and their lists. */
export function EmployeeDeductionsPanel({ employee }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [dialog, setDialog] = useState(null);
    useEffect(() => {
        deductionsApi
            .employee(employee.id)
            .then(setData)
            .catch((f) => setError(errorKey(f)));
    }, [employee.id]);
    if (!can('deductions.view', true))
        return _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('deductions.noAccess') });
    if (!data)
        return error ? _jsx(ErrorMessage, { messageKey: error }) : _jsx(LinearProgress, {});
    const cards = [
        [t('deductions.profile.open'), `${sar(data.openAdvances)} ${t('deductions.sar')}`, '#F5F3FF'],
        [t('deductions.profile.warnings'), String(data.warnings), '#FFFBEB'],
        [t('deductions.profile.days'), sar(data.penaltyDaysThisYear), '#FFF1F2'],
    ];
    return (_jsxs(HrScope, { children: [_jsxs(Stack, { sx: { gap: 1.75 }, children: [can('deductions.manage', true) && (_jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap' }, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setDialog('advance'), children: t('deductions.advance.new') }), _jsx(Button, { variant: "outlined", onClick: () => setDialog('Penalty'), children: t('deductions.penalty.new') }), _jsx(Button, { variant: "outlined", onClick: () => setDialog('Other'), children: t('deductions.other.new') })] })), _jsx(Box, { sx: { display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }, children: cards.map(([l, v, tint]) => (_jsxs(Box, { sx: { border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5, bgcolor: tint }, children: [_jsx(Typography, { sx: { fontWeight: 700 }, children: l }), _jsx(Typography, { sx: { fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: v }) })] }, l))) }), _jsx(Typography, { sx: { fontWeight: 700 }, children: t('deductions.profile.advances') }), _jsx(AdvancesTable, { rows: data.advances, showEmployee: false, onOpen: (id) => navigate(`/hr/advances/${id}`) }), _jsx(Typography, { sx: { fontWeight: 700 }, children: t('deductions.profile.penalties') }), _jsx(PenaltiesTable, { rows: data.penalties, showEmployee: false, onOpen: (id) => navigate(`/hr/penalties/${id}`) })] }), dialog === 'advance' && _jsx(AdvanceDialog, { employee: employee, onClose: () => setDialog(null), onSent: (id) => navigate(`/hr/advances/${id}`) }), (dialog === 'Penalty' || dialog === 'Other') && _jsx(PenaltyDialog, { category: dialog, employee: employee, onClose: () => setDialog(null), onSent: (id) => navigate(`/hr/penalties/${id}`) })] }));
}
