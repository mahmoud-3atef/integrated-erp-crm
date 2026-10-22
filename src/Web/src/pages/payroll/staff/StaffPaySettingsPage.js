import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, Link, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { gosiCategories, staffPayrollApi } from '../../../api/staffPayroll';
import { useCrumb } from '../../../app/breadcrumbs';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrPageHeader, HrScope, hr, hrCard } from '../../../components/hr/Hr';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { money } from '../payroll';
import { DateField } from '../../../components/DateField';
/** A GOSI rate of a category from a date (a new row for a change: the earlier one stays for the earlier months). */
function RateDialog({ rate, onClose, onSaved }) {
    const { t } = useTranslation();
    const [category, setCategory] = useState(rate?.category ?? 'SaudiNew');
    const [from, setFrom] = useState(rate?.effectiveFrom ?? new Date().toISOString().slice(0, 10));
    const [employee, setEmployee] = useState(String(rate?.employeePercent ?? 9.75));
    const [employer, setEmployer] = useState(String(rate?.employerPercent ?? 11.75));
    const [min, setMin] = useState(String(rate?.minBase ?? 1500));
    const [max, setMax] = useState(String(rate?.maxBase ?? 45000));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await staffPayrollApi.saveGosiRate(rate?.id ?? null, { category, effectiveFrom: from, employeePercent: Number(employee), employerPercent: Number(employer), minBase: Number(min), maxBase: Number(max) });
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    const pct = { input: { endAdornment: _jsx(InputAdornment, { position: "end", children: "%" }) }, htmlInput: { step: '0.01', dir: 'ltr' } };
    const sar = { input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('hr.sar') }) }, htmlInput: { dir: 'ltr' } };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: rate ? t('staffPayroll.settings.editRate') : t('staffPayroll.settings.newRate') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(TextField, { select: true, size: "small", label: t('staffPayroll.gosi.category'), value: category, disabled: Boolean(rate), onChange: (e) => setCategory(e.target.value), children: gosiCategories.map((c) => (_jsx(MenuItem, { value: c, children: t(`staffPayroll.gosiCategory.${c}`) }, c))) }), _jsx(DateField, { size: "small", label: t('staffPayroll.settings.from'), value: from, onChange: (e) => setFrom(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }, children: [_jsx(TextField, { size: "small", type: "number", label: t('staffPayroll.gosi.employee'), value: employee, onChange: (e) => setEmployee(e.target.value), slotProps: pct }), _jsx(TextField, { size: "small", type: "number", label: t('staffPayroll.gosi.employer'), value: employer, onChange: (e) => setEmployer(e.target.value), slotProps: pct }), _jsx(TextField, { size: "small", type: "number", label: t('staffPayroll.settings.min'), value: min, onChange: (e) => setMin(e.target.value), slotProps: sar }), _jsx(TextField, { size: "small", type: "number", label: t('staffPayroll.settings.max'), value: max, onChange: (e) => setMax(e.target.value), slotProps: sar })] }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !from, onClick: () => void save(), children: t('common.save') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
/** The staff payroll's rules (overtime, lateness) and GOSI's rates by category and date. */
export function StaffPaySettingsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const editable = can('payroll.settings.manage', true);
    useCrumb(t('staffPayroll.settings.pageTitle'));
    const [s, setS] = useState(null);
    const [rates, setRates] = useState(null);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(null);
    const load = useCallback(() => {
        Promise.all([staffPayrollApi.settings(), staffPayrollApi.gosiRates()])
            .then(([x, r]) => (setS(x), setRates(r), setError(null)))
            .catch((f) => setError(errorKey(f)));
    }, []);
    useEffect(load, [load]);
    if (!s || !rates) {
        return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), !error && _jsx(LinearProgress, {})] }));
    }
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await staffPayrollApi.saveSettings(s);
            setSaved(true);
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const set = (k, v) => (setS({ ...s, [k]: v }), setSaved(false));
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(SettingsOutlinedIcon, {}), title: t('staffPayroll.settings.pageTitle'), subtitle: t('staffPayroll.settings.intro'), actions: _jsxs(_Fragment, { children: [editable && (_jsx(Button, { variant: "contained", disabled: busy, onClick: () => void save(), children: saved ? t('staffPayroll.settings.saved') : t('common.save') })), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') } }), onClick: () => navigate(-1), children: t('common.back') })] }) }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { ...hrCard, p: 2, mb: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1.5 }, children: t('staffPayroll.settings.rules') }), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }, children: [_jsx(TextField, { size: "small", type: "number", disabled: !editable, label: t('staffPayroll.settings.premium'), value: s.overtimePremiumPercent, onChange: (e) => set('overtimePremiumPercent', Number(e.target.value)), slotProps: { input: { endAdornment: _jsx(InputAdornment, { position: "end", children: "%" }) }, htmlInput: { dir: 'ltr' } } }), _jsx(TextField, { size: "small", type: "number", disabled: !editable, label: t('staffPayroll.settings.hours'), value: s.hoursPerDay, onChange: (e) => set('hoursPerDay', Number(e.target.value)), slotProps: { input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('staffPayroll.settings.hoursUnit') }) }, htmlInput: { dir: 'ltr' } } }), _jsxs(TextField, { select: true, size: "small", disabled: !editable, label: t('staffPayroll.settings.late'), value: s.lateMode, onChange: (e) => set('lateMode', e.target.value), children: [_jsx(MenuItem, { value: "None", children: t('staffPayroll.settings.lateModes.None') }), _jsx(MenuItem, { value: "PerMinute", children: t('staffPayroll.settings.lateModes.PerMinute') })] })] }), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 1.25 }, children: t('staffPayroll.settings.rulesHint') }), _jsxs(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 0.5 }, children: [t('staffPayroll.settings.cap', { percent: s.monthlyCapPercent }), ' ', _jsx(Link, { component: RouterLink, to: "/hr/deductions-settings", children: t('staffPayroll.settings.capLink') })] })] }), _jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', mb: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 700 }, children: t('staffPayroll.settings.gosi') }), editable && (_jsx(Button, { variant: "outlined", startIcon: _jsx(Add, {}), onClick: () => setEditing('new'), children: t('staffPayroll.settings.newRate') }))] }), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mb: 1.25 }, children: t('staffPayroll.settings.gosiHint') }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('staffPayroll.gosi.category') }), _jsx(TableCell, { children: t('staffPayroll.settings.from') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.gosi.employee') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.gosi.employer') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.settings.range') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: rates.map((r) => (_jsxs(TableRow, { children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: t(`staffPayroll.gosiCategory.${r.category}`) }), _jsx(TableCell, { children: date(r.effectiveFrom) }), _jsxs(TableCell, { align: "right", children: [r.employeePercent, "%"] }), _jsxs(TableCell, { align: "right", children: [r.employerPercent, "%"] }), _jsx(TableCell, { align: "right", children: _jsx("bdi", { children: `${money(r.minBase)} – ${money(r.maxBase)}` }) }), _jsx(TableCell, { sx: { textAlign: 'end' }, children: editable && (_jsx(IconButton, { size: "small", "aria-label": t('common.edit'), onClick: () => setEditing(r), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) })) })] }, r.id))) })] }) })] }), editing && (_jsx(RateDialog, { rate: editing === 'new' ? null : editing, onClose: () => setEditing(null), onSaved: () => {
                    setEditing(null);
                    load();
                } }))] }));
}
