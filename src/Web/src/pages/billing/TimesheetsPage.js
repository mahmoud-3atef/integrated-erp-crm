import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, IconButton, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { billingApi } from '../../api/billing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, Initials } from '../../components/ui';
import { sar } from '../operations/delivery';
import { InvoiceStatusBadge } from './invoices';
import { TimesheetStatusBadge, timesheetTone } from './timesheets';
import { ListHero, rowEdge, StageLine, StatusStrip, StripItem, toneHead, useCurrentStages } from '../../components/ListLayout';
import { toneColors } from '../../app/theme';
/** Which projects a card shows: all, with a timesheet, in approval, approved, or with an issued invoice. */
const cardFilters = {
    all: () => true,
    generated: (p) => p.timesheetId !== null,
    inApproval: (p) => p.status === 'InApproval',
    approved: (p) => p.status === 'Approved',
    invoiced: (p) => p.invoiceDoc?.status === 'Issued',
};
const monthIso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
/** The month's projects with work, each with its timesheet (or the button to generate it), as the old "التحضير" page. */
export function TimesheetsPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const ar = i18n.language === 'ar';
    const [params, setParams] = useSearchParams();
    const month = params.get('month') ?? monthIso(new Date());
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(null);
    const [card, setCard] = useState('all');
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);
    const canManage = can('billing.timesheets.manage', true);
    const reload = useCallback(async () => {
        try {
            setData(await billingApi.month(month));
            setError(null);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [month]);
    useEffect(() => {
        setData(null);
        void reload();
    }, [reload]);
    const shift = (by) => {
        const d = new Date(`${month}T00:00:00`);
        d.setMonth(d.getMonth() + by);
        setParams({ month: monthIso(d) }, { replace: true });
    };
    const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`));
    const generate = async (projectId) => {
        setBusy(projectId);
        setError(null);
        try {
            const { id } = await billingApi.generate(projectId, month);
            navigate(`/billing/timesheets/${id}`);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(null);
        }
    };
    const generateAll = async () => {
        setBusy('all');
        setError(null);
        try {
            for (const p of data?.projects.filter((x) => !x.timesheetId && x.projectId) ?? []) {
                await billingApi.generate(p.projectId, month);
            }
            await reload();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(null);
        }
    };
    const missing = data?.projects.filter((p) => !p.timesheetId && p.projectId).length ?? 0;
    const term = search.trim().toLowerCase();
    const rows = (data?.projects ?? []).filter((p) => cardFilters[card](p) && (!term || [p.projectName, p.customerName, p.projectManager, p.timesheetNo, p.invoiceDoc?.invoiceNo].some((v) => v?.toLowerCase().includes(term))));
    const toggle = (value) => setCard(card === value ? 'all' : value);
    const stages = useCurrentStages('billing.timesheet', rows.flatMap((x) => (x.timesheetId ? [x.timesheetId] : [])));
    return (_jsxs(Box, { children: [_jsx(ListHero, { tone: "timesheet", icon: _jsx(CalendarMonthOutlinedIcon, {}), title: t('timesheets.title'), subtitle: t('timesheets.intro'), actions: canManage && missing > 0 ? (_jsx(Button, { variant: "contained", startIcon: _jsx(AutoModeOutlinedIcon, {}), disabled: busy !== null, onClick: () => void generateAll(), children: t('timesheets.generateAll', { count: missing }) })) : undefined }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }, children: [_jsx(IconButton, { onClick: () => shift(ar ? 1 : -1), sx: { bgcolor: '#fff', boxShadow: tokens.shadowXs }, children: _jsx(ChevronRightIcon, {}) }), _jsx(Box, { sx: { minWidth: 220, textAlign: 'center', px: 3, py: 1, borderRadius: 999, bgcolor: '#fff', boxShadow: tokens.shadowSm }, children: _jsx(Typography, { sx: { fontSize: 17, fontWeight: 800, color: tokens.navy800 }, children: monthName }) }), _jsx(IconButton, { onClick: () => shift(ar ? -1 : 1), sx: { bgcolor: '#fff', boxShadow: tokens.shadowXs }, children: _jsx(ChevronLeftIcon, {}) })] }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(StatusStrip, { count: 5, children: [_jsx(StripItem, { active: card === 'all', onClick: () => toggle('all'), label: t('timesheets.cards.projects'), value: String(data?.totals.projects ?? 0), foot: t('timesheets.cards.projectsFoot'), icon: _jsx(BusinessCenterOutlinedIcon, {}), tone: tokens.navy700 }), _jsx(StripItem, { active: card === 'generated', onClick: () => toggle('generated'), label: t('timesheets.cards.generated'), value: String(data?.totals.generated ?? 0), foot: t('timesheets.cards.generatedFoot', { count: missing }), icon: _jsx(PostAddOutlinedIcon, {}), tone: "#6b7a90" }), _jsx(StripItem, { active: card === 'inApproval', onClick: () => toggle('inApproval'), label: t('timesheets.cards.inApproval'), value: String(data?.totals.inApproval ?? 0), foot: t('timesheets.cards.inApprovalFoot'), icon: _jsx(HourglassBottomOutlinedIcon, {}), tone: "#d9822b" }), _jsx(StripItem, { active: card === 'approved', onClick: () => toggle('approved'), label: t('timesheets.cards.approved'), value: String(data?.totals.approved ?? 0), foot: t('timesheets.cards.approvedFoot'), icon: _jsx(AssignmentTurnedInOutlinedIcon, {}), tone: "#1f9d55" }), _jsx(StripItem, { active: card === 'invoiced', onClick: () => toggle('invoiced'), label: t('timesheets.cards.amount'), value: sar(data?.totals.invoiceAmount ?? 0), foot: t('timesheets.cards.amountFoot', { count: data?.totals.invoiced ?? 0 }), icon: _jsx(PaymentsOutlinedIcon, {}), tone: "#2b7bd9" })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1.5, alignItems: { sm: 'center' }, mb: 1.5 }, children: [_jsx(TextField, { size: "small", sx: { minWidth: 300 }, placeholder: t('timesheets.search'), value: search, onChange: (e) => setSearch(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), (card !== 'all' || term) && (_jsxs(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: [t('timesheets.filtered', { shown: rows.length, total: data?.projects.length ?? 0 }), ' ', _jsx(Button, { size: "small", onClick: () => (setCard('all'), setSearch('')), children: t('timesheets.clearFilter') })] }))] }), (!data || busy === 'all') && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { sx: toneHead('timesheet'), children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { align: "center", children: t('timesheets.col.ledgerWorkers') }), _jsx(TableCell, { children: t('timesheets.col.timesheet') }), _jsx(TableCell, { align: "center", children: t('timesheets.col.workDays') }), _jsx(TableCell, { align: "center", children: t('timesheets.col.amount') }), _jsx(TableCell, { children: t('timesheets.col.invoiceDoc') }), _jsx(TableCell, {})] }) }), _jsxs(TableBody, { children: [rows.map((p) => (_jsxs(TableRow, { hover: true, sx: [{ cursor: p.timesheetId ? 'pointer' : 'default' }, rowEdge(p.status ? toneColors[timesheetTone[p.status]].fg : tokens.gray300)], onClick: () => p.timesheetId && navigate(`/billing/timesheets/${p.timesheetId}`), children: [_jsx(TableCell, { sx: { minWidth: 260 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Initials, { name: p.projectName, size: 30 }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: p.projectName }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [p.customerName, p.projectManager].filter(Boolean).join(' · ') || '—' })] })] }) }), _jsx(TableCell, { align: "center", children: _jsx(Badge, { tone: "info", children: p.ledgerWorkers }) }), _jsx(TableCell, { children: p.timesheetId ? (_jsxs(Stack, { spacing: 0.4, sx: { alignItems: 'flex-start' }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 12.5, fontWeight: 700, color: tokens.navy800 }, children: p.timesheetNo }), _jsx(TimesheetStatusBadge, { status: p.status }), _jsx(StageLine, { stage: stages[p.timesheetId] })] })) : p.projectId ? (_jsx(Badge, { tone: "neutral", children: t('timesheets.notGenerated') })) : (_jsx(Tooltip, { title: t('timesheets.projectMissingHint'), children: _jsx("span", { children: _jsx(Badge, { tone: "warning", children: t('timesheets.projectMissing') }) }) })) }), _jsx(TableCell, { align: "center", children: p.workDays === null ? '—' : sar(p.workDays) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 700, color: tokens.navy800 }, children: p.invoiceAmount === null ? '—' : sar(p.invoiceAmount) }), _jsx(TableCell, { onClick: (e) => (p.invoiceDoc ? (e.stopPropagation(), navigate(`/billing/invoices/${p.invoiceDoc.id}`)) : undefined), children: p.invoiceDoc ? (_jsxs(Stack, { spacing: 0.4, sx: { alignItems: 'flex-start' }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 12.5, fontWeight: 700, color: tokens.navy800 }, children: p.invoiceDoc.invoiceNo ?? t('invoices.noNumber') }), _jsx(InvoiceStatusBadge, { status: p.invoiceDoc.status })] })) : ('—') }), _jsx(TableCell, { align: "left", onClick: (e) => e.stopPropagation(), children: !p.timesheetId && p.projectId && canManage && (_jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(PostAddOutlinedIcon, {}), disabled: busy !== null, onClick: () => void generate(p.projectId), children: t('timesheets.generate') })) })] }, p.projectCrmId))), data && rows.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, align: "center", sx: { py: 5, color: tokens.gray500 }, children: data.projects.length === 0 ? t('timesheets.empty') : t('timesheets.noMatch') }) }))] })] }) })] })] }));
}
