import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { periodOf } from '../../api/attendance';
import { errorKey } from '../../api/auth';
import { daysText, leaveApi, leavePays } from '../../api/leave';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrDrawer, HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { EmployeeLeavePanel, typeName } from './leave';
import { DateField } from '../../components/DateField';
/** The balances of a type for every employee, the month's accrual, the year's carry-over and the opening balances' import. */
export function LeaveBalancesPage() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const navigate = useNavigate();
    const { can } = useSession();
    const [setup, setSetup] = useState(null);
    const [typeId, setTypeId] = useState('');
    const [rows, setRows] = useState(null);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(null);
    const [importing, setImporting] = useState(false);
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState(null);
    const [version, setVersion] = useState(0);
    const manage = can('leave.manage', true);
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    useEffect(() => {
        leaveApi
            .setup()
            .then((s) => (setSetup(s), setTypeId((v) => v || (s.types.find((x) => x.code === 'annual')?.id ?? ''))))
            .catch((f) => setError(errorKey(f)));
    }, []);
    useEffect(() => {
        if (!typeId)
            return;
        setRows(null);
        leaveApi
            .balances({ typeId, search: query })
            .then(setRows)
            .catch((f) => setError(errorKey(f)));
    }, [typeId, query, version]);
    const accrue = async () => {
        const period = periodOf(new Date());
        try {
            const r = await leaveApi.accrue(period);
            setNotice(t('leaveBalances.accrued', { period, employees: r.employees, days: daysText(r.days) }));
            setVersion((v) => v + 1);
        }
        catch (f) {
            setError(errorKey(f));
        }
    };
    const carry = async () => {
        const year = new Date().getFullYear() - 1;
        try {
            const r = await leaveApi.carryOver(year);
            setNotice(setup?.settings.carryOverLimit === null ? t('leaveBalances.noLimit') : t('leaveBalances.carried', { year, employees: r.employees, days: daysText(r.days) }));
            setVersion((v) => v + 1);
        }
        catch (f) {
            setError(errorKey(f));
        }
    };
    const balanceTypes = (setup?.types ?? []).filter((x) => x.hasBalance);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(BalanceOutlinedIcon, {}), title: t('leaveBalances.title'), subtitle: t('leaveBalances.intro'), actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(SettingsOutlinedIcon, {}), onClick: () => navigate('/hr/leave-types'), children: t('leaveBalances.types') }), manage && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(UploadFileOutlinedIcon, {}), onClick: () => setImporting(true), children: t('leaveBalances.import') }), _jsx(Button, { variant: "outlined", onClick: () => void carry(), children: t('leaveBalances.carryOver', { year: new Date().getFullYear() - 1 }) }), _jsx(Button, { variant: "contained", startIcon: _jsx(PlayArrowOutlinedIcon, {}), onClick: () => void accrue(), children: t('leaveBalances.accrue') })] }))] }) }), _jsx(ErrorMessage, { messageKey: error }), notice && (_jsx(Alert, { severity: "success", sx: { mb: 1.5 }, onClose: () => setNotice(null), children: notice })), _jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1, mb: 1.5 }, children: [_jsx(TextField, { select: true, size: "small", label: t('leave.type'), value: typeId, onChange: (e) => setTypeId(e.target.value), sx: { width: { md: 220 } }, children: balanceTypes.map((x) => (_jsx(MenuItem, { value: x.id, children: typeName(x, ar) }, x.id))) }), _jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('leave.search'), sx: { width: { md: 300 } }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('leave.search') } } })] }), !rows ? (_jsx(LinearProgress, {})) : rows.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(BalanceOutlinedIcon, {}), title: t('leaveBalances.none') })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 680 }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('leave.employee') }), _jsx(TableCell, { children: t('leaveBalances.cols.perYear') }), _jsx(TableCell, { children: t('leaveBalances.cols.opening') }), _jsx(TableCell, { children: t('leaveBalances.cols.accrued') }), _jsx(TableCell, { children: t('leaveBalances.cols.used') }), _jsx(TableCell, { children: t('leaveBalances.cols.reserved') }), _jsx(TableCell, { children: t('leaveBalances.cols.available') }), _jsx(TableCell, { children: t('leaveBalances.cols.sick') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => setOpen(r), children: [_jsx(TableCell, { sx: { minWidth: 220 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(HrAvatar, { name: r.name }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: r.name }), _jsxs(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: [_jsx("bdi", { children: r.employeeNo }), (ar ? r.departmentAr : r.departmentEn) ? ` · ${ar ? r.departmentAr : r.departmentEn}` : ''] })] })] }) }), _jsx(TableCell, { children: daysText(r.perYear) }), _jsx(TableCell, { children: daysText(r.opening) }), _jsx(TableCell, { children: daysText(r.accruedThisYear) }), _jsx(TableCell, { children: daysText(r.usedThisYear) }), _jsx(TableCell, { sx: { color: r.reserved ? hr.primary : undefined }, children: daysText(r.reserved) }), _jsx(TableCell, { sx: { fontWeight: 700, color: r.available < 0 ? hr.danger : hr.success }, children: daysText(r.available) }), _jsx(TableCell, { children: daysText(r.sickUsedThisYear) })] }, r.employeeId))) })] }) }))] }), open && (_jsx(HrDrawer, { open: true, onClose: () => setOpen(null), width: 640, avatar: _jsx(HrAvatar, { name: open.name, size: 44 }), title: open.name, subtitle: _jsx("bdi", { children: open.employeeNo }), children: _jsx(Box, { sx: { overflowY: 'auto' }, children: _jsx(EmployeeLeavePanel, { employee: { id: open.employeeId, nameAr: open.name, nameEn: open.name }, onChanged: () => setVersion((v) => v + 1) }) }) })), importing && typeId && _jsx(OpeningImportDialog, { typeId: typeId, onClose: () => setImporting(false), onDone: (n) => (setImporting(false), setNotice(t('leaveBalances.imported', { count: n })), setVersion((v) => v + 1)) })] }));
}
/** Opening balances from Excel: the file, its date, a preview of what is refused, then the import. */
function OpeningImportDialog({ typeId, onClose, onDone }) {
    const { t } = useTranslation();
    const input = useRef(null);
    const [file, setFile] = useState(null);
    const [asOf, setAsOf] = useState(`${new Date().getFullYear()}-01-01`);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const run = async (apply, f = file) => {
        if (!f)
            return;
        setBusy(true);
        setError(null);
        try {
            const r = await leaveApi.importOpenings(f, typeId, asOf, apply);
            if (apply)
                onDone(r.accepted);
            else
                setResult(r);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('leaveBalances.import') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('leaveBalances.importHint') }), _jsxs(Stack, { direction: "row", sx: { gap: 1, alignItems: 'center' }, children: [_jsx(DateField, { size: "small", label: t('leave.entry.asOf'), value: asOf, onChange: (e) => (setAsOf(e.target.value), setResult(null)), slotProps: { inputLabel: { shrink: true } } }), _jsx("input", { ref: input, type: "file", accept: ".xlsx", hidden: true, onChange: (e) => {
                                        const f = e.target.files?.[0] ?? null;
                                        setFile(f);
                                        if (f)
                                            void run(false, f);
                                    } }), _jsx(Button, { variant: "outlined", startIcon: _jsx(UploadFileOutlinedIcon, {}), onClick: () => input.current?.click(), children: file ? file.name : t('attendance.dialog.choose') })] }), busy && _jsx(LinearProgress, {}), result && (_jsxs(_Fragment, { children: [_jsx(Alert, { severity: result.rejected ? 'warning' : 'success', children: t('leaveBalances.previewLine', { rows: result.rows, accepted: result.accepted, rejected: result.rejected }) }), result.problems.length > 0 && (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 240 }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: "#" }), _jsx(TableCell, { children: t('leaveBalances.key') }), _jsx(TableCell, { children: t('leave.employee') }), _jsx(TableCell, { children: t('leave.cols.status') })] }) }), _jsx(TableBody, { children: result.problems.map((p) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: p.row }), _jsx(TableCell, { children: _jsx("bdi", { children: p.key }) }), _jsx(TableCell, { children: p.name ?? '—' }), _jsx(TableCell, { children: _jsx(HrStatusBadge, { label: t(`leaveBalances.problems.${p.problem}`), color: "#B91C1C", tint: "#FEE2E2" }) })] }, p.row))) })] }) }))] })), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !result || result.accepted === 0, onClick: () => void run(true), children: t('leaveBalances.apply', { count: result?.accepted ?? 0 }) }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
/** The leave types and their rules, and the leave settings (carry-over limit, monthly permission allowance). */
export function LeaveTypesPage() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { can } = useSession();
    const [setup, setSetup] = useState(null);
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState(null);
    const [version, setVersion] = useState(0);
    const canSet = can('leave.settings', true);
    useCrumb(t('leaveTypes.title'));
    useEffect(() => {
        leaveApi
            .setup()
            .then(setSetup)
            .catch((f) => setError(errorKey(f)));
    }, [version]);
    const entitlement = (x) => x.hasBalance
        ? t('leaveTypes.balanceRule', { days: x.daysPerYear ?? 0, senior: x.seniorDaysPerYear ?? x.daysPerYear ?? 0, years: x.seniorAfterYears ?? 0 })
        : [x.daysPerYear ? t('leaveTypes.perYear', { days: x.daysPerYear }) : null, x.maxDaysPerRequest ? t('leaveTypes.perRequest', { days: x.maxDaysPerRequest }) : null, x.oncePerService ? t('leaveTypes.once') : null]
            .filter(Boolean)
            .join(' · ') || '—';
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(SettingsOutlinedIcon, {}), title: t('leaveTypes.title'), subtitle: t('leaveTypes.intro'), actions: canSet && (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setEditing('new'), children: t('leaveTypes.new') })) }), _jsx(ErrorMessage, { messageKey: error }), !setup ? (_jsx(LinearProgress, {})) : (_jsxs(Stack, { sx: { gap: 1.75 }, children: [_jsx(TableContainer, { sx: { ...hrCard }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 46 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('leaveTypes.cols.name') }), _jsx(TableCell, { children: t('leaveTypes.cols.pay') }), _jsx(TableCell, { children: t('leaveTypes.cols.entitlement') }), _jsx(TableCell, { children: t('leaveTypes.cols.dayCount') }), _jsx(TableCell, { children: t('leaveTypes.cols.attachment') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: setup.types.map((x) => (_jsxs(TableRow, { sx: { opacity: x.isActive ? 1 : 0.55 }, children: [_jsx(TableCell, { sx: { fontWeight: 700 }, children: typeName(x, ar) }), _jsx(TableCell, { children: t(`leave.pay.${x.pay}`) }), _jsx(TableCell, { children: entitlement(x) }), _jsx(TableCell, { children: t(`leaveTypes.dayCount.${x.dayCount}`) }), _jsx(TableCell, { children: x.needsAttachment ? t('leaveTypes.required') : '—' }), _jsx(TableCell, { children: canSet && (_jsx(Button, { size: "small", onClick: () => setEditing(x), children: t('shifts.edit') })) })] }, x.id))) })] }) }), _jsx(SettingsCard, { setup: setup, canSet: canSet, onSaved: () => setVersion((v) => v + 1) })] })), editing && _jsx(TypeDialog, { type: editing === 'new' ? null : editing, onClose: () => setEditing(null), onSaved: () => (setEditing(null), setVersion((v) => v + 1)) })] }));
}
function SettingsCard({ setup, canSet, onSaved }) {
    const { t } = useTranslation();
    const [limit, setLimit] = useState(setup.settings.carryOverLimit === null ? '' : String(setup.settings.carryOverLimit));
    const [hours, setHours] = useState(String(setup.settings.permissionMinutesPerMonth / 60));
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const save = async () => {
        setError(null);
        try {
            await leaveApi.saveSettings({ carryOverLimit: limit === '' ? null : Number(limit), permissionMinutesPerMonth: Math.round(Number(hours) * 60) });
            setSaved(true);
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
        }
    };
    return (_jsxs(Box, { sx: { ...hrCard, p: 2, display: 'grid', gap: 1.25, maxWidth: 760 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 15 }, children: t('leaveTypes.settings') }), _jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }, children: [_jsx(TextField, { size: "small", type: "number", label: t('leaveTypes.carryOver'), value: limit, disabled: !canSet, onChange: (e) => (setLimit(e.target.value), setSaved(false)), helperText: t('leaveTypes.carryOverHint') }), _jsx(TextField, { size: "small", type: "number", label: t('leaveTypes.permission'), value: hours, disabled: !canSet, onChange: (e) => (setHours(e.target.value), setSaved(false)), helperText: t('leaveTypes.permissionHint'), slotProps: { htmlInput: { step: 0.5, min: 0 } } })] }), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('leaveTypes.processNote') }), _jsx(ErrorMessage, { messageKey: error }), saved && _jsx(Alert, { severity: "success", children: t('shifts.saved') }), canSet && (_jsx(Box, { children: _jsx(Button, { variant: "outlined", onClick: () => void save(), children: t('common.save') }) }))] }));
}
function TypeDialog({ type, onClose, onSaved }) {
    const { t } = useTranslation();
    const [v, setV] = useState(type ?? { nameAr: '', nameEn: '', pay: 'Full', hasBalance: false, daysPerYear: null, seniorDaysPerYear: null, seniorAfterYears: null, maxDaysPerRequest: null, oncePerService: false, dayCount: 'Calendar', needsAttachment: false, isActive: true, sortOrder: 50 });
    const [error, setError] = useState(null);
    const set = (k, value) => setV((s) => ({ ...s, [k]: value }));
    const num = (s) => (s === '' ? null : Number(s));
    const save = async () => {
        setError(null);
        try {
            await leaveApi.saveType(type?.id ?? null, v);
            onSaved();
        }
        catch (f) {
            setError(errorKey(f));
        }
    };
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: type ? type.nameAr : t('leaveTypes.new') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr', pt: '8px !important' }, children: [_jsx(TextField, { size: "small", required: true, label: t('shifts.form.nameAr'), value: v.nameAr, onChange: (e) => set('nameAr', e.target.value) }), _jsx(TextField, { size: "small", label: t('shifts.form.nameEn'), value: v.nameEn, onChange: (e) => set('nameEn', e.target.value), slotProps: { htmlInput: { dir: 'ltr' } } }), _jsx(TextField, { select: true, size: "small", label: t('leaveTypes.cols.pay'), value: v.pay, onChange: (e) => set('pay', e.target.value), children: leavePays.map((p) => (_jsx(MenuItem, { value: p, children: t(`leave.pay.${p}`) }, p))) }), _jsx(TextField, { select: true, size: "small", label: t('leaveTypes.cols.dayCount'), value: v.dayCount, onChange: (e) => set('dayCount', e.target.value), children: ['Calendar', 'Working'].map((d) => (_jsx(MenuItem, { value: d, children: t(`leaveTypes.dayCount.${d}`) }, d))) }), _jsx(FormControlLabel, { sx: { gridColumn: '1 / -1' }, control: _jsx(Checkbox, { checked: v.hasBalance, onChange: (e) => set('hasBalance', e.target.checked) }), label: t('leaveTypes.form.hasBalance') }), _jsx(TextField, { size: "small", type: "number", label: t('leaveTypes.form.daysPerYear'), value: v.daysPerYear ?? '', onChange: (e) => set('daysPerYear', num(e.target.value)) }), _jsx(TextField, { size: "small", type: "number", label: t('leaveTypes.form.maxPerRequest'), value: v.maxDaysPerRequest ?? '', onChange: (e) => set('maxDaysPerRequest', num(e.target.value)) }), v.hasBalance && (_jsxs(_Fragment, { children: [_jsx(TextField, { size: "small", type: "number", label: t('leaveTypes.form.seniorDays'), value: v.seniorDaysPerYear ?? '', onChange: (e) => set('seniorDaysPerYear', num(e.target.value)) }), _jsx(TextField, { size: "small", type: "number", label: t('leaveTypes.form.seniorAfter'), value: v.seniorAfterYears ?? '', onChange: (e) => set('seniorAfterYears', num(e.target.value)) })] })), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: v.oncePerService, onChange: (e) => set('oncePerService', e.target.checked) }), label: t('leaveTypes.once') }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: v.needsAttachment, onChange: (e) => set('needsAttachment', e.target.checked) }), label: t('leaveTypes.form.attachment') }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: v.isActive, onChange: (e) => set('isActive', e.target.checked) }), label: t('shifts.form.isActive') }), _jsx(Box, { sx: { gridColumn: '1 / -1' }, children: _jsx(ErrorMessage, { messageKey: error }) })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: !v.nameAr.trim(), onClick: () => void save(), children: t('common.save') }), _jsx(Button, { onClick: onClose, children: t('common.cancel') })] })] }) }));
}
