import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { periodOf, shiftPeriod } from '../../../api/attendance';
import { errorKey } from '../../../api/auth';
import { staffPayrollApi } from '../../../api/staffPayroll';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, hr, hrCard } from '../../../components/hr/Hr';
import { useMonthName as usePeriodName } from '../../attendance/AttendanceMonthPage';
import { money, RunStatusBadge } from '../payroll';
import { useLegalEntities } from '../RunDialogs';
/** The staff payroll runs: one per commercial registration and closed attendance month. */
export function StaffRunsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const periodName = usePeriodName();
    const [view, setView] = useState('all');
    const [runs, setRuns] = useState(null);
    const [error, setError] = useState(null);
    const [creating, setCreating] = useState(false);
    const load = useCallback(() => {
        setRuns(null);
        setError(null);
        staffPayrollApi
            .runs({ tab: view })
            .then(setRuns)
            .catch((f) => setError(errorKey(f)));
    }, [view]);
    useEffect(load, [load]);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(RequestQuoteOutlinedIcon, {}), title: t('staffPayroll.title'), subtitle: t('staffPayroll.intro'), actions: _jsxs(_Fragment, { children: [can('payroll.staff.view', true) && (_jsx(Button, { variant: "outlined", startIcon: _jsx(SettingsOutlinedIcon, {}), onClick: () => navigate('/payroll/staff-settings'), children: t('staffPayroll.settings.title') })), can('payroll.staff.manage', true) && (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setCreating(true), children: t('staffPayroll.new') }))] }) }), _jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsxs(Tabs, { value: view, onChange: (_, v) => setView(v), sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: [_jsx(Tab, { value: "all", label: t('staffPayroll.tabs.all') }), _jsx(Tab, { value: "open", label: t('staffPayroll.tabs.open') }), _jsx(Tab, { value: "pending", label: t('staffPayroll.tabs.pending') }), _jsx(Tab, { value: "approved", label: t('staffPayroll.tabs.approved') })] }), error ? (_jsxs(Stack, { sx: { gap: 1, alignItems: 'flex-start' }, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Button, { size: "small", variant: "outlined", onClick: load, children: t('staffPayroll.retry') })] })) : !runs ? (_jsx(Stack, { sx: { gap: 0.75 }, children: Array.from({ length: 4 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 42 }, i)) })) : runs.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(RequestQuoteOutlinedIcon, {}), title: t('staffPayroll.none'), hint: t('staffPayroll.noneHint') })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 46, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700, color: '#334155' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('staffPayroll.cols.no') }), _jsx(TableCell, { children: t('staffPayroll.cols.legalEntity') }), _jsx(TableCell, { children: t('staffPayroll.cols.period') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.cols.employees') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.cols.net') }), _jsx(TableCell, { children: t('staffPayroll.cols.status') })] }) }), _jsx(TableBody, { children: runs.map((r) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/payroll/staff/${r.id}`), children: [_jsx(TableCell, { sx: { fontWeight: 700 }, children: _jsx(RouterLink, { to: `/payroll/staff/${r.id}`, onClick: (e) => e.stopPropagation(), style: { color: 'inherit', textDecoration: 'none' }, children: _jsx("bdi", { children: r.runNo }) }) }), _jsx(TableCell, { children: r.legalEntityName }), _jsx(TableCell, { children: periodName(r.period) }), _jsx(TableCell, { align: "right", children: r.employees }), _jsx(TableCell, { align: "right", sx: { fontWeight: 700 }, children: money(r.net) }), _jsx(TableCell, { children: _jsx(RunStatusBadge, { status: r.status }) })] }, r.id))) })] }) }))] }), creating && _jsx(NewStaffRunDialog, { onClose: () => setCreating(false), onCreated: (id) => navigate(`/payroll/staff/${id}`) })] }));
}
/** A new run: the registration and a closed attendance month, with what the run will and will not cover checked first. */
function NewStaffRunDialog({ onClose, onCreated }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const periodName = usePeriodName();
    const entities = useLegalEntities();
    const [entity, setEntity] = useState('');
    const now = periodOf(new Date());
    const periods = Array.from({ length: 6 }, (_, i) => shiftPeriod(now, -i));
    const [period, setPeriod] = useState(now);
    const [checks, setChecks] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!entity && entities[0])
            setEntity(entities[0].id);
    }, [entities, entity]);
    useEffect(() => {
        if (!entity)
            return;
        setChecks(null);
        staffPayrollApi
            .checks(entity, period)
            .then((c) => (setChecks(c), setError(null)))
            .catch((f) => setError(errorKey(f)));
    }, [entity, period]);
    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            onCreated((await staffPayrollApi.create({ legalEntityId: entity, period })).id);
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    const blocked = !checks || !checks.attendanceClosed || Boolean(checks.existingRunNo) || Boolean(checks.earlierOpenRunNo) || checks.employees === 0;
    const line = (ok, text) => (_jsxs(Stack, { direction: "row", sx: { gap: 0.75, alignItems: 'center', fontSize: 13 }, children: [ok ? _jsx(CheckCircleOutlineIcon, { sx: { fontSize: 17, color: hr.success } }) : _jsx(WarningAmberOutlinedIcon, { sx: { fontSize: 17, color: hr.warning } }), _jsx(Typography, { sx: { fontSize: 13 }, children: text })] }, text));
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('staffPayroll.new') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }, children: [_jsx(TextField, { select: true, size: "small", required: true, label: t('staffPayroll.cols.legalEntity'), value: entity, onChange: (e) => setEntity(e.target.value), children: entities.map((e) => (_jsx(MenuItem, { value: e.id, children: ar ? e.nameAr : e.nameEn }, e.id))) }), _jsx(TextField, { select: true, size: "small", required: true, label: t('staffPayroll.attendanceMonth'), value: period, onChange: (e) => setPeriod(e.target.value), children: periods.map((p) => (_jsx(MenuItem, { value: p, children: periodName(p) }, p))) })] }), _jsx(Box, { sx: { bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5, display: 'grid', gap: 0.6 }, children: !checks ? (_jsx(LinearProgress, {})) : (_jsxs(_Fragment, { children: [line(checks.attendanceClosed, checks.attendanceClosed ? t('staffPayroll.checks.closed', { month: periodName(period) }) : t('staffPayroll.checks.notClosed', { month: periodName(period) })), checks.attendanceClosed && line(checks.employees > 0, t('staffPayroll.checks.employees', { count: checks.employees })), checks.withoutRegistration > 0 && line(false, t('staffPayroll.checks.noRegistration', { count: checks.withoutRegistration })), checks.noSalary > 0 && line(false, t('staffPayroll.checks.noSalary', { count: checks.noSalary })), checks.withoutIban > 0 && line(false, t('staffPayroll.checks.noIban', { count: checks.withoutIban })), checks.existingRunNo && line(false, t('staffPayroll.checks.existing', { no: checks.existingRunNo })), checks.earlierOpenRunNo && line(false, t('staffPayroll.checks.earlier', { no: checks.earlierOpenRunNo })), !checks.existingRunNo && !checks.earlierOpenRunNo && line(true, t('staffPayroll.checks.noOverlap'))] })) }), _jsx(Alert, { severity: "info", sx: { py: 0 }, children: t('staffPayroll.newHint') }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || blocked, onClick: () => void create(), children: t('staffPayroll.create') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
