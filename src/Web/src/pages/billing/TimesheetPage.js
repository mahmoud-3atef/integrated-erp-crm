import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, ListItemIcon, Menu, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField, Tooltip, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { adjustmentTypes, billingApi, invoiceApi } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { recordTones, RecordHero, SectionTitle } from '../../components/RecordLayout';
import { PillTabs } from '../../components/ui';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { ColumnsButton, useHiddenColumns } from '../../components/hr/ColumnsMenu';
import { sar } from '../operations/delivery';
import { ExcelUploadDialog } from './ExcelUploadDialog';
import { InvoiceStatusBadge } from './invoices';
import { SourceBadge, TimesheetStatusBadge } from './timesheets';
import { useCrumb } from '../../app/breadcrumbs';
const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };
const dayMs = 86_400_000;
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / dayMs);
// Each adjustment's color in the trail.
const adjustmentColor = {
    Absence: '#e03434',
    Overtime: '#1f6fd1',
    ClientAddition: '#1f9d55',
    ClientDeduction: '#b8770a',
    CustomerLoan: '#7c4dcc',
    FeeDays: '#0f8f84',
    OtherCost: '#5d6f7b',
    InternalAddition: '#17734b',
    InternalDeduction: '#a32a5c',
};
/** The month as a desk calendar's page: the month's name on red, the cycle's days under it. */
function CalendarPage({ month, days }) {
    return (_jsxs(Box, { sx: { width: 50, borderRadius: '10px', overflow: 'hidden', bgcolor: '#fff', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.18)' }, children: [_jsx(Box, { sx: { bgcolor: '#e03434', color: '#fff', fontSize: 10, fontWeight: 800, py: '1px', whiteSpace: 'nowrap', overflow: 'hidden' }, children: month }), _jsx(Typography, { sx: { fontSize: 20, fontWeight: 800, color: recordTones.timesheet.main, lineHeight: 1.35 }, children: days })] }));
}
/**
 * The worker's month in one bar: the cycle's days, the part the worker was on the project in green, and a red square
 * for each day of absence at the end of it.
 */
function MonthBar({ from, to, lineFrom, lineTo, absence }) {
    const total = Math.max(1, daysBetween(from, to) + 1);
    const start = Math.max(0, daysBetween(from, lineFrom));
    const length = Math.max(0, Math.min(total - start, daysBetween(lineFrom, lineTo) + 1));
    const absent = Math.min(length, Math.ceil(absence));
    const day = 100 / total;
    return (_jsxs(Box, { sx: { position: 'relative', height: 14, borderRadius: '4px', bgcolor: tokens.gray100, overflow: 'hidden', minWidth: 80 }, children: [_jsx(Box, { sx: { position: 'absolute', insetBlock: 0, insetInlineStart: `${start * day}%`, width: `${length * day}%`, bgcolor: '#2fae73', borderRadius: '3px' } }), Array.from({ length: absent }, (_, n) => (_jsx(Box, { sx: { position: 'absolute', top: 2, bottom: 2, insetInlineStart: `calc(${(start + length - absent + n) * day}% + 1px)`, width: `calc(${day}% - 2px)`, bgcolor: '#e03434', borderRadius: '2px' } }, n)))] }));
}
/**
 * One project's timesheet for a cycle, as an attendance register: the band with the month, the approval bar, the
 * workers with their month drawn as a bar (absences in red) and the figures the timesheet makes for each; beside them
 * what the timesheet makes (invoice, payroll, suppliers, attendance) and the trail of adjustments; then the invoice,
 * payroll and supplier details and the approval's history.
 */
export function TimesheetPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const { ar, date } = useCommercialFormat();
    const [sheet, setSheet] = useState(null);
    useCrumb(sheet?.timesheetNo, `/billing/timesheets/${id}`);
    const [tab, setTab] = useState('invoice');
    const [adjusting, setAdjusting] = useState(null);
    const [settings, setSettings] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [menu, setMenu] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const approval = useRecordApproval(sheet?.approval?.instanceId);
    const reload = useCallback(async () => {
        try {
            setSheet(await billingApi.get(id));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!sheet) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    const run = async (action) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            await reload();
            await approval.reload();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const look = recordTones.timesheet;
    const workers = new Set(sheet.lines.map((l) => l.workerId)).size;
    const days = sheet.lines.reduce((s, l) => s + l.workDays, 0);
    const absence = sheet.lines.reduce((s, l) => s + l.absenceDays, 0);
    const attendance = days > 0 ? Math.round(((days - absence) / days) * 1000) / 10 : 0;
    const payroll = sheet.payroll.reduce((s, p) => s + p.net, 0);
    const suppliers = sheet.suppliers.reduce((s, p) => s + p.net, 0);
    const noPrice = sheet.lines.filter((l) => l.totalPrice <= 0);
    const canRun = (!sheet.awaitingApproval && sheet.canEdit) || approval.detail?.summary.status === 'Failed';
    const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(sheet.month));
    const monthShort = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(sheet.month));
    const nameOf = (workerId) => sheet.lines.find((l) => l.workerId === workerId)?.name ?? '—';
    const makeInvoice = async () => {
        setBusy(true);
        setError(null);
        try {
            const { id: invoiceId } = await invoiceApi.fromTimesheet(sheet.id);
            navigate(`/billing/invoices/${invoiceId}`);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Box, { children: [_jsx(RecordHero, { tone: "timesheet", icon: _jsx(CalendarPage, { month: monthShort, days: daysBetween(sheet.from, sheet.to) + 1 }), kind: t('timesheets.timesheetOf', { month: monthName }), number: sheet.timesheetNo, status: _jsx(Box, { sx: { bgcolor: '#fff', borderRadius: 99, px: 0.25 }, children: _jsx(TimesheetStatusBadge, { status: sheet.status }) }), title: sheet.projectName, subtitle: `${sheet.customerName ?? '—'} · ${t('timesheets.cycle', { from: date(sheet.from), to: date(sheet.to) })} · ${t(`timesheets.dayBasis.${sheet.dayBasis}`)}`, actions: _jsxs(_Fragment, { children: [sheet.canSubmit && (_jsx(Button, { variant: "contained", startIcon: _jsx(SendOutlinedIcon, {}), disabled: busy || noPrice.length > 0, onClick: () => void run(() => billingApi.submit(sheet.id)), children: t('timesheets.submit') })), sheet.canInvoice && (_jsx(Button, { variant: "contained", startIcon: _jsx(ReceiptLongOutlinedIcon, {}), disabled: busy, onClick: () => void makeInvoice(), children: t('invoices.makeFromTimesheet') })), canRun && _jsx(RunProcessButton, { screen: "billing.timesheet", recordId: sheet.id, title: `${sheet.timesheetNo} — ${sheet.projectName}`, onStarted: () => void reload().then(() => approval.reload()) }), _jsx(Button, { variant: "outlined", startIcon: _jsx(FileDownloadOutlinedIcon, {}), component: "a", href: `/api/v1/billing/timesheets/${sheet.id}/excel`, download: true, children: t('timesheets.excel.download') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(MoreHorizIcon, {}), onClick: (e) => setMenu(e.currentTarget), children: t('invoices.more') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate(`/billing/timesheets?month=${sheet.month}`), children: t('common.back') })] }) }), _jsxs(Menu, { anchorEl: menu, open: !!menu, onClose: () => setMenu(null), children: [sheet.canEdit && (_jsxs(MenuItem, { onClick: () => (setMenu(null), void run(() => billingApi.generate(sheet.projectId, sheet.month))), children: [_jsx(ListItemIcon, { children: _jsx(AutoModeOutlinedIcon, { fontSize: "small" }) }), t('timesheets.regenerate')] })), sheet.canEdit && (_jsxs(MenuItem, { onClick: () => (setMenu(null), setUploading(true)), children: [_jsx(ListItemIcon, { children: _jsx(UploadFileOutlinedIcon, { fontSize: "small" }) }), t('timesheets.excel.upload')] })), _jsxs(MenuItem, { onClick: () => (setMenu(null), setSettings(true)), children: [_jsx(ListItemIcon, { children: _jsx(SettingsOutlinedIcon, { fontSize: "small" }) }), t('timesheets.settings.title')] })] }), _jsx(ErrorMessage, { messageKey: error }), noPrice.length > 0 && (_jsx(Alert, { severity: "error", sx: { mb: `${tokens.gap}px` }, children: t('timesheets.noPrice', { workers: noPrice.map((l) => l.workerNo).join('، ') }) })), sheet.lastComment && sheet.status === 'Returned' && (_jsxs(Alert, { severity: "info", sx: { mb: `${tokens.gap}px` }, children: [t('operations.delivery.lastComment'), ": ", sheet.lastComment] })), sheet.approval && (_jsx(ApprovalBar, { status: sheet.approval, detail: approval.detail, loading: approval.loading, onChanged: () => {
                    void approval.reload();
                    void reload();
                } })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(0, 1fr)' }, gap: `${tokens.gap}px`, mb: `${tokens.gap}px`, alignItems: 'stretch' }, children: [_jsxs(Box, { sx: { ...card, overflow: 'hidden' }, children: [_jsx(Box, { sx: { px: 2.25, py: 1.25, color: '#fff', background: look.dark, fontSize: 14, fontWeight: 800 }, children: t('timesheets.effect.title') }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '230px minmax(0, 1fr)' }, alignItems: 'center', columnGap: 1 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.75, px: 2.25, py: 1.5 }, children: [_jsxs(Box, { sx: { position: 'relative', width: 78, height: 78, flex: '0 0 auto' }, children: [_jsx(CircularProgress, { variant: "determinate", value: 100, size: 78, thickness: 5, sx: { color: tokens.gray100, position: 'absolute' } }), _jsx(CircularProgress, { variant: "determinate", value: attendance, size: 78, thickness: 5, sx: { color: look.main, position: 'absolute', '& circle': { strokeLinecap: 'round' } } })] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t('timesheets.effect.attendance') }), _jsxs(Typography, { sx: { fontSize: 24, fontWeight: 800, color: look.main, lineHeight: 1.2 }, children: [attendance, "%"] }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray600 }, children: [t('timesheets.effect.days', { days: sar(days), workers }), absence > 0 && (_jsxs(Box, { component: "b", sx: { color: '#e03434' }, children: [' · ', t('timesheets.effect.absence', { days: sar(absence) })] }))] })] })] }), _jsx(Box, { sx: { px: 2.25, py: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 3 }, children: [
                                            [t('timesheets.tiles.amount'), sar(sheet.invoice.amount), tokens.navy800],
                                            [t('timesheets.tiles.vat'), sar(sheet.invoice.vat), tokens.navy800],
                                            [t('timesheets.tiles.total'), sar(sheet.invoice.total), recordTones.invoice.main],
                                            [t('timesheets.tiles.payroll'), sar(payroll), look.main],
                                            [t('timesheets.tiles.suppliers'), sar(suppliers), tokens.navy800],
                                            ...(sheet.unknownSource.length > 0 ? [[t('timesheets.tiles.unknown'), String(sheet.unknownSource.length), tokens.warning]] : []),
                                        ].map(([label, value, color], n) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 2, py: 0.85, borderBottom: `1px solid ${tokens.gray100}` }, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500 }, children: label }), _jsx(Typography, { sx: { fontSize: n === 2 || n === 3 ? 15 : 13.5, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }, children: value })] }, label))) })] }), sheet.invoiceDoc && (_jsx(Box, { sx: { px: 2.25, pb: 2 }, children: _jsxs(Button, { fullWidth: true, variant: "outlined", startIcon: _jsx(ReceiptLongOutlinedIcon, {}), onClick: () => navigate(`/billing/invoices/${sheet.invoiceDoc.id}`), sx: { justifyContent: 'space-between' }, children: [t('invoices.openInvoice', { number: sheet.invoiceDoc.invoiceNo ?? t('invoices.noNumber') }), _jsx(InvoiceStatusBadge, { status: sheet.invoiceDoc.status })] }) }))] }), _jsxs(Box, { sx: { ...card, p: 2.25, maxHeight: 330, overflowY: 'auto' }, children: [_jsx(SectionTitle, { icon: _jsx(EditNoteOutlinedIcon, {}), title: t('timesheets.trail.title', { count: sheet.adjustments.length }) }), sheet.adjustments.length === 0 && _jsx(Typography, { sx: { py: 2, textAlign: 'center', fontSize: 13, color: tokens.gray500 }, children: t('timesheets.trail.none') }), [...sheet.adjustments]
                                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                                .map((a) => (_jsxs(Stack, { direction: "row", sx: { gap: 1.25, py: 1, '&:not(:last-of-type)': { borderBottom: `1px solid ${tokens.gray100}` } }, children: [_jsx(Box, { sx: { flex: '0 0 4px', borderRadius: 4, bgcolor: adjustmentColor[a.type] } }), _jsxs(Box, { sx: { minWidth: 0, flex: 1 }, children: [_jsxs(Typography, { sx: { fontSize: 13, fontWeight: 800, color: adjustmentColor[a.type] }, children: [t(`timesheets.adjustments.${a.type}`), ": ", sar(a.value), " ", t(`timesheets.units.${a.type}`)] }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: [_jsx("bdi", { children: nameOf(a.workerId) }), " \u00B7 ", a.reason] }), _jsxs(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: [_jsx("bdi", { children: date(a.createdAt) }), " \u00B7 ", a.createdByName] })] })] }, a.id)))] })] }), _jsx(Box, { children: _jsxs(Stack, { spacing: `${tokens.gap}px`, sx: { minWidth: 0 }, children: [_jsxs(Box, { sx: { ...card, p: 2.25, minWidth: 0 }, children: [_jsx(SectionTitle, { icon: _jsx(EventAvailableOutlinedIcon, {}), title: t('timesheets.register.title', { count: sheet.lines.length }), extra: _jsxs(Stack, { direction: "row", sx: { gap: 1, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5 }, children: [_jsx(Legend, { color: "#2fae73", label: t('timesheets.register.present') }), _jsx(Legend, { color: "#e03434", label: t('timesheets.register.absent') }), _jsx(Legend, { color: tokens.gray200, label: t('timesheets.register.outside') })] }) }), _jsx(WorkersTab, { sheet: sheet, onAdjust: setAdjusting })] }), _jsxs(Box, { sx: { ...card, p: 2.25 }, children: [_jsx(PillTabs, { value: tab, onChange: setTab, options: [
                                        { value: 'invoice', label: t('timesheets.tabs.invoice') },
                                        { value: 'payroll', label: t('timesheets.tabs.payroll', { count: sheet.payroll.length }) },
                                        { value: 'suppliers', label: t('timesheets.tabs.suppliers', { count: sheet.suppliers.length }) },
                                        ...(sheet.unknownSource.length > 0 ? [{ value: 'unknown', label: t('timesheets.tabs.unknown', { count: sheet.unknownSource.length }) }] : []),
                                    ] }), tab === 'invoice' && _jsx(InvoiceTab, { sheet: sheet }), tab === 'payroll' && (_jsxs(_Fragment, { children: [_jsx(Hint, { text: t('timesheets.payrollHint') }), _jsx(PayTable, { rows: sheet.payroll })] })), tab === 'suppliers' && (_jsxs(_Fragment, { children: [_jsx(Hint, { text: t('timesheets.suppliersHint') }), sheet.suppliers.length === 0 ? (_jsx(Typography, { sx: { py: 4, textAlign: 'center', color: tokens.gray500 }, children: t('timesheets.noSuppliers') })) : (_jsx(Stack, { spacing: 2, children: sheet.suppliers.map((s) => (_jsxs(Box, { sx: { border: `1px solid ${tokens.navy50}`, borderRadius: `${tokens.radius}px`, p: 1.5 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.5, mb: 1 }, children: [_jsx(Typography, { sx: { fontSize: 15, fontWeight: 800, color: tokens.navy800, flex: 1 }, children: s.supplierName }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: t('timesheets.supplierSummary', { workers: s.workers, days: sar(s.workDays), net: sar(s.net) }) })] }), _jsx(PayTable, { rows: s.items })] }, s.supplierName))) }))] })), tab === 'unknown' && (_jsxs(_Fragment, { children: [_jsx(Alert, { severity: "warning", icon: _jsx(WarningAmberOutlinedIcon, {}), sx: { mb: 1.5 }, children: t('timesheets.unknownHint') }), _jsx(PayTable, { rows: sheet.unknownSource })] }))] })] }) }), uploading && (_jsx(ExcelUploadDialog, { timesheetId: sheet.id, onClose: () => setUploading(false), onApplied: () => {
                    setUploading(false);
                    void reload();
                } })), adjusting && _jsx(AdjustDialog, { sheet: sheet, line: adjusting, onClose: () => setAdjusting(null), onChanged: () => void reload() }), settings && (_jsx(SettingsDialog, { sheet: sheet, onClose: () => setSettings(false), onSaved: () => {
                    setSettings(false);
                    if (sheet.canEdit)
                        void run(() => billingApi.generate(sheet.projectId, sheet.month));
                } }))] }));
}
function Legend({ color, label }) {
    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5, color: tokens.gray600 }, children: [_jsx(Box, { sx: { width: 12, height: 10, borderRadius: '2px', bgcolor: color } }), label] }));
}
function Hint({ text }) {
    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1.5, fontSize: 12.5, color: tokens.gray500 }, children: [_jsx(InfoOutlinedIcon, { sx: { fontSize: 16 } }), text] }));
}
const registerColumns = [
    { key: 'price', group: 'invoice', value: (l) => l.totalPrice },
    { key: 'salary', group: 'invoice', value: (l) => l.dueSalary - l.absenceAmount },
    { key: 'fees', group: 'invoice', value: (l) => l.dueFees },
    { key: 'housing', group: 'invoice', value: (l) => l.dueHousing },
    { key: 'transport', group: 'invoice', value: (l) => l.dueTransport },
    { key: 'overtimeAmount', group: 'invoice', value: (l) => l.overtime },
    { key: 'additions', group: 'invoice', value: (l) => l.clientAdditions },
    { key: 'deductions', group: 'invoice', value: (l) => -l.clientDeductions, signed: true },
    { key: 'loans', group: 'invoice', value: (l) => -l.customerLoans, signed: true },
    { key: 'other', group: 'invoice', value: (l) => l.otherCosts },
    { key: 'gosi', group: 'invoice', value: (l) => l.gosi },
];
const registerAfter = [
    { key: 'vat', group: 'invoice', value: (l) => l.vat },
    { key: 'total', group: 'invoice', value: (l) => l.invoiceTotal },
    { key: 'internal', group: 'worker', value: (l) => l.internalAdditions - l.internalDeductions, signed: true },
];
const registerOptional = ['period', 'price', 'salary', 'fees', 'housing', 'transport', 'overtimeAmount', 'additions', 'deductions', 'loans', 'other', 'gosi', 'vat', 'total', 'internal'];
/**
 * The attendance register as a dense grid (the user's request: as many of the timesheet's columns as the screen holds):
 * the worker, the month's bar, the days (present, absent, overtime), what the line puts on the invoice element by
 * element, and the worker's side; the optional columns are chosen from «columns».
 */
function WorkersTab({ sheet, onAdjust }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { ar, date } = useCommercialFormat();
    const look = recordTones.timesheet;
    const { shown, toggle } = useHiddenColumns('timesheets.hiddenColumns', registerOptional, ['price', 'housing', 'transport', 'loans', 'other', 'gosi', 'vat']);
    const adjustments = (workerId) => sheet.adjustments.filter((a) => a.workerId === workerId).length;
    const sum = (pick) => sheet.lines.reduce((s, l) => s + pick(l), 0);
    const before = registerColumns.filter((c) => shown(c.key));
    const after = registerAfter.filter((c) => shown(c.key));
    const invoiceCols = before.length + 1 + after.filter((c) => c.group === 'invoice').length;
    const workerCols = after.filter((c) => c.group === 'worker').length + 1;
    const label = (key) => t(`timesheets.grid.${key}`);
    const money = (v, signed) => (v === 0 ? _jsx(Box, { component: "span", sx: { color: tokens.gray300 }, children: "\u2014" }) : _jsx("bdi", { style: { color: signed && v < 0 ? '#b8770a' : undefined }, children: sar(v) }));
    return (_jsxs(_Fragment, { children: [_jsx(Stack, { direction: "row", sx: { justifyContent: 'flex-end', mb: 1 }, children: _jsx(ColumnsButton, { columns: registerOptional.map((key) => ({ key, label: label(key), group: t(`timesheets.grid.groups.${key === 'period' ? 'days' : ([...registerColumns, ...registerAfter].find((c) => c.key === key)?.group ?? 'invoice')}`) })), shown: shown, toggle: toggle }) }), _jsx(TableContainer, { sx: { border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px`, maxHeight: 720 }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: {
                        '& .MuiTableCell-root': { px: 0.75 },
                        '& .MuiTableCell-body': { fontSize: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', py: 0.6 },
                        '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even) .MuiTableCell-body': { bgcolor: '#fafcfb' },
                        '& .pin': { position: 'sticky', insetInlineStart: 0, zIndex: 2, bgcolor: '#fff', boxShadow: `inset -1px 0 0 ${tokens.gray100}` },
                        '& td.g-days': { backgroundImage: 'linear-gradient(rgba(47,174,115,.06), rgba(47,174,115,.06))' },
                        '& td.g-invoice': { backgroundImage: 'linear-gradient(rgba(31,111,209,.045), rgba(31,111,209,.045))' },
                        '& td.g-worker': { backgroundImage: 'linear-gradient(rgba(124,77,204,.06), rgba(124,77,204,.06))' },
                        '& .gs': { borderInlineStart: '2px solid #fff' },
                        '& td.gs': { borderInlineStart: `2px solid ${tokens.gray100}` },
                    }, children: [_jsxs(TableHead, { sx: {
                                '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: look.dark, color: '#fff', borderBottom: 0, borderRadius: 0, fontSize: 11.5, lineHeight: 1.3, py: 0.6, verticalAlign: 'bottom' },
                                '& .grp': { textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.25) !important' },
                                '& th.g-days.grp': { bgcolor: '#17734b !important' },
                                '& th.g-days:not(.grp)': { bgcolor: '#1f8f5f !important' },
                                '& th.g-invoice.grp': { bgcolor: '#1d4f91 !important' },
                                '& th.g-invoice:not(.grp)': { bgcolor: '#2a64b0 !important' },
                                '& th.g-worker.grp': { bgcolor: '#55358f !important' },
                                '& th.g-worker:not(.grp)': { bgcolor: '#6a47aa !important' },
                                '& tr:nth-of-type(2) th': { top: 28 },
                                '& th.pin': { zIndex: 4 },
                            }, children: [_jsxs(TableRow, { children: [_jsx(TableCell, { rowSpan: 2, className: "pin", sx: { minWidth: 170 }, children: t('workforce.col.name') }), _jsx(TableCell, { colSpan: shown('period') ? 4 : 3, className: "grp g-days gs", children: t('timesheets.grid.groups.days') }), _jsx(TableCell, { colSpan: invoiceCols, className: "grp g-invoice gs", children: t('timesheets.grid.groups.invoice') }), _jsx(TableCell, { colSpan: workerCols, className: "grp g-worker gs", children: t('timesheets.grid.groups.worker') }), sheet.canEdit && _jsx(TableCell, { rowSpan: 2 })] }), _jsxs(TableRow, { children: [shown('period') && _jsx(TableCell, { className: "g-days gs", children: label('period') }), _jsx(TableCell, { align: "center", className: shown('period') ? 'g-days' : 'g-days gs', children: t('timesheets.register.present') }), _jsx(TableCell, { align: "center", className: "g-days", children: t('timesheets.register.absent') }), _jsx(TableCell, { align: "center", className: "g-days", children: t('timesheets.grid.overtimeHours') }), before.map((c) => (_jsx(TableCell, { align: "right", className: `g-invoice${c === before[0] ? ' gs' : ''}`, children: label(c.key) }, c.key))), _jsx(TableCell, { align: "right", className: before.length === 0 ? 'g-invoice gs' : 'g-invoice', children: t('timesheets.grid.amount') }), after.filter((c) => c.group === 'invoice').map((c) => (_jsx(TableCell, { align: "right", className: "g-invoice", children: label(c.key) }, c.key))), after.filter((c) => c.group === 'worker').map((c) => (_jsx(TableCell, { align: "right", className: "g-worker gs", children: label(c.key) }, c.key))), _jsx(TableCell, { align: "right", className: shown('internal') ? 'g-worker' : 'g-worker gs', children: t('timesheets.grid.net') })] })] }), _jsxs(TableBody, { children: [sheet.lines.map((l) => (_jsxs(TableRow, { hover: true, children: [_jsxs(TableCell, { className: "pin", sx: { cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${l.workerId}?tab=periods`), children: [_jsx(Typography, { sx: { fontSize: 12, fontWeight: 700, color: tokens.navy800, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }, title: l.name, children: l.name }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5 }, children: [_jsxs(Typography, { sx: { fontSize: 10.5, color: tokens.gray500, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }, children: [_jsx("span", { dir: "ltr", children: l.workerNo }), " \u00B7 ", (ar ? l.professionAr : l.professionEn) ?? '—'] }), l.source !== 'Company' && _jsx(SourceBadge, { source: l.source, supplier: l.supplierName })] })] }), shown('period') && (_jsx(TableCell, { className: "g-days gs", sx: { minWidth: 96 }, title: `${date(l.lineFrom)} – ${date(l.lineTo)} · ${l.sourceNo}${l.fromOldSystem ? ` · ${t('workforce.periods.oldSystem')}` : ''}`, children: _jsx(MonthBar, { from: sheet.from, to: sheet.to, lineFrom: l.lineFrom, lineTo: l.lineTo, absence: l.absenceDays }) })), _jsx(TableCell, { align: "center", className: shown('period') ? 'g-days' : 'g-days gs', sx: { fontWeight: 800, color: `${look.main} !important` }, children: sar(l.workDays - l.absenceDays) }), _jsx(TableCell, { align: "center", className: "g-days", title: l.absenceDays > 0 ? `−${sar(l.absenceAmount)}` : undefined, sx: { fontWeight: 800, color: l.absenceDays > 0 ? '#e03434 !important' : undefined }, children: l.absenceDays > 0 ? sar(l.absenceDays) : _jsx(Box, { component: "span", sx: { color: tokens.gray300 }, children: "\u2014" }) }), _jsx(TableCell, { align: "center", className: "g-days", sx: { color: l.overtimeHours > 0 ? '#1f6fd1 !important' : undefined, fontWeight: 700 }, children: l.overtimeHours > 0 ? sar(l.overtimeHours) : _jsx(Box, { component: "span", sx: { color: tokens.gray300 }, children: "\u2014" }) }), before.map((c) => (_jsx(TableCell, { align: "right", className: `g-invoice${c === before[0] ? ' gs' : ''}`, children: c.key === 'price' && l.totalPrice <= 0 ? _jsx(Box, { component: "span", sx: { color: tokens.danger, fontWeight: 700 }, children: t('timesheets.noPriceShort') }) : money(c.value(l), c.signed) }, c.key))), _jsx(TableCell, { align: "right", className: before.length === 0 ? 'g-invoice gs' : 'g-invoice', sx: { fontWeight: 800, color: `${tokens.navy800} !important` }, children: sar(l.invoiceAmount) }), after.map((c) => (_jsx(TableCell, { align: "right", className: c.group === 'worker' ? 'g-worker gs' : 'g-invoice', sx: c.key === 'total' ? { fontWeight: 700 } : undefined, children: money(c.value(l), c.signed) }, c.key))), _jsx(TableCell, { align: "right", className: shown('internal') ? 'g-worker' : 'g-worker gs', sx: { fontWeight: 700 }, children: sar(l.workerNet) }), sheet.canEdit && (_jsx(TableCell, { sx: { px: '2px !important' }, children: _jsx(Tooltip, { title: t('timesheets.adjust'), children: _jsxs(IconButton, { size: "small", onClick: () => onAdjust(l), sx: { color: look.main, p: 0.5 }, children: [_jsx(EditNoteOutlinedIcon, { fontSize: "small" }), adjustments(l.workerId) > 0 && (_jsx(Box, { component: "span", sx: { fontSize: 10.5, fontWeight: 800, marginInlineStart: '2px' }, children: adjustments(l.workerId) }))] }) }) }))] }, l.id))), sheet.lines.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 30, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('timesheets.noLines') }) }))] }), sheet.lines.length > 0 && (_jsx(TableFooter, { sx: { '& .MuiTableCell-footer': { fontSize: 12, fontWeight: 800, color: tokens.navy800, borderTop: `2px solid ${look.main}`, bgcolor: '#f6faf8', position: 'sticky', bottom: 0, px: 0.75, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } }, children: _jsxs(TableRow, { children: [_jsxs(TableCell, { className: "pin", sx: { bgcolor: '#f6faf8 !important' }, children: [t('timesheets.grid.totalRow'), _jsx(Typography, { component: "span", sx: { display: 'block', fontSize: 10.5, color: tokens.gray500 }, children: t('timesheets.grid.lines', { count: sheet.lines.length }) })] }), shown('period') && _jsx(TableCell, { className: "g-days gs" }), _jsx(TableCell, { align: "center", className: shown('period') ? 'g-days' : 'g-days gs', sx: { color: `${look.main} !important` }, children: sar(sum((l) => l.workDays - l.absenceDays)) }), _jsx(TableCell, { align: "center", className: "g-days", sx: { color: '#e03434 !important' }, children: sar(sum((l) => l.absenceDays)) }), _jsx(TableCell, { align: "center", className: "g-days", sx: { color: '#1f6fd1 !important' }, children: sar(sum((l) => l.overtimeHours)) }), before.map((c) => (_jsx(TableCell, { align: "right", className: `g-invoice${c === before[0] ? ' gs' : ''}`, children: c.key === 'price' ? '' : sar(sum(c.value)) }, c.key))), _jsx(TableCell, { align: "right", className: before.length === 0 ? 'g-invoice gs' : 'g-invoice', children: sar(sum((l) => l.invoiceAmount)) }), after.map((c) => (_jsx(TableCell, { align: "right", className: c.group === 'worker' ? 'g-worker gs' : 'g-invoice', children: sar(sum(c.value)) }, c.key))), _jsx(TableCell, { align: "right", className: shown('internal') ? 'g-worker' : 'g-worker gs', children: sar(sum((l) => l.workerNet)) }), sheet.canEdit && _jsx(TableCell, {})] }) }))] }) })] }));
}
function InvoiceTab({ sheet }) {
    const { t } = useTranslation();
    const i = sheet.invoice;
    const rows = [
        [t('timesheets.invoice.salary'), i.dueSalary],
        [t('timesheets.invoice.absence'), -i.absenceAmount],
        [t('timesheets.invoice.fees'), i.dueFees],
        [t('timesheets.invoice.housing'), i.dueHousing, true],
        [t('timesheets.invoice.transport'), i.dueTransport, true],
        [t('timesheets.invoice.overtime'), i.overtime],
        [t('timesheets.invoice.additions'), i.clientAdditions],
        [t('timesheets.invoice.deductions'), -i.clientDeductions],
        [t('timesheets.invoice.loans'), -i.customerLoans],
        [t('timesheets.invoice.other'), i.otherCosts],
        [t('timesheets.invoice.gosi'), i.gosi],
    ];
    return (_jsxs(_Fragment, { children: [_jsx(Hint, { text: t('timesheets.invoiceHint') }), _jsxs(Box, { sx: { maxWidth: 560 }, children: [rows
                        .filter(([, value, part]) => value !== 0 || !part)
                        .map(([label, value, part]) => (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', py: 0.75, borderBottom: `1px dashed ${tokens.gray200}`, paddingInlineStart: part ? 3 : 0, color: part ? tokens.gray500 : tokens.gray700 }, children: [_jsx(Typography, { sx: { fontSize: 13.5 }, children: label }), _jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 700, color: value < 0 ? tokens.danger : undefined }, children: sar(value) })] }, label))), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', py: 1, mt: 0.5 }, children: [_jsx(Typography, { sx: { fontWeight: 800 }, children: t('timesheets.invoice.amount') }), _jsx(Typography, { sx: { fontWeight: 800 }, children: sar(i.amount) })] }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', py: 0.5 }, children: [_jsx(Typography, { children: t('timesheets.invoice.vat', { rate: Math.round(sheet.settings.vatRate * 100) }) }), _jsx(Typography, { sx: { fontWeight: 700 }, children: sar(i.vat) })] }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', py: 1.25, px: 1.5, mt: 1, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy700, color: '#fff' }, children: [_jsx(Typography, { sx: { fontWeight: 800 }, children: t('timesheets.invoice.total') }), _jsx(Typography, { sx: { fontWeight: 800, fontSize: 18 }, children: sar(i.total) })] })] })] }));
}
function PayTable({ rows }) {
    const { t } = useTranslation();
    const total = (pick) => sar(rows.reduce((s, p) => s + pick(p), 0));
    if (rows.length === 0) {
        return _jsx(Typography, { sx: { py: 4, textAlign: 'center', color: tokens.gray500 }, children: t('timesheets.noWorkers') });
    }
    return (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { align: "center", children: t('timesheets.pay.salary') }), _jsx(TableCell, { align: "center", children: t('timesheets.col.days') }), _jsx(TableCell, { align: "center", children: t('timesheets.pay.due') }), _jsx(TableCell, { align: "center", children: t('timesheets.col.absence') }), _jsx(TableCell, { align: "center", children: t('timesheets.col.overtime') }), _jsx(TableCell, { align: "center", children: t('timesheets.pay.additions') }), _jsx(TableCell, { align: "center", children: t('timesheets.pay.deductions') }), _jsx(TableCell, { align: "center", children: t('timesheets.pay.internal') }), _jsx(TableCell, { align: "center", children: t('timesheets.col.net') })] }) }), _jsx(TableBody, { children: rows.map((p) => (_jsxs(TableRow, { hover: true, children: [_jsxs(TableCell, { sx: { minWidth: 170 }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: p.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: p.workerNo })] }), _jsx(TableCell, { align: "center", children: sar(p.paySalary) }), _jsx(TableCell, { align: "center", children: sar(p.workDays) }), _jsx(TableCell, { align: "center", children: sar(p.payDueSalary) }), _jsx(TableCell, { align: "center", children: p.payAbsence > 0 ? `−${sar(p.payAbsence)}` : '—' }), _jsx(TableCell, { align: "center", children: p.overtime > 0 ? sar(p.overtime) : '—' }), _jsx(TableCell, { align: "center", children: p.clientAdditions > 0 ? sar(p.clientAdditions) : '—' }), _jsx(TableCell, { align: "center", children: p.clientDeductions + p.customerLoans > 0 ? `−${sar(p.clientDeductions + p.customerLoans)}` : '—' }), _jsx(TableCell, { align: "center", sx: { color: p.internalAdditions - p.internalDeductions < 0 ? tokens.danger : undefined }, children: p.internalAdditions === 0 && p.internalDeductions === 0 ? '—' : sar(p.internalAdditions - p.internalDeductions) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800, color: tokens.navy800 }, children: sar(p.net) })] }, p.workerId))) }), _jsx(TableFooter, { children: _jsxs(TableRow, { sx: { '& td': { fontWeight: 800, color: tokens.navy800, fontSize: 13 } }, children: [_jsx(TableCell, { children: t('timesheets.pay.total', { count: rows.length }) }), _jsx(TableCell, {}), _jsx(TableCell, { align: "center", children: total((p) => p.workDays) }), _jsx(TableCell, { align: "center", children: total((p) => p.payDueSalary) }), _jsx(TableCell, { align: "center", children: total((p) => p.payAbsence) }), _jsx(TableCell, { align: "center", children: total((p) => p.overtime) }), _jsx(TableCell, { align: "center", children: total((p) => p.clientAdditions) }), _jsx(TableCell, { align: "center", children: total((p) => p.clientDeductions + p.customerLoans) }), _jsx(TableCell, { align: "center", children: total((p) => p.internalAdditions - p.internalDeductions) }), _jsx(TableCell, { align: "center", children: total((p) => p.net) })] }) })] }) }));
}
function AdjustDialog({ sheet, line, onClose, onChanged }) {
    const { t } = useTranslation();
    const [type, setType] = useState('Absence');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const mine = sheet.adjustments.filter((a) => a.workerId === line.workerId);
    const act = async (action) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            onChanged();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('timesheets.adjustTitle', { name: line.name }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), mine.length > 0 && (_jsx(Stack, { spacing: 0.75, sx: { mb: 2 }, children: mine.map((a) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, p: 1, borderRadius: '10px', bgcolor: tokens.gray50 }, children: [_jsxs(Box, { sx: { flex: 1 }, children: [_jsxs(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: [t(`timesheets.adjustments.${a.type}`), ": ", sar(a.value), " ", t(`timesheets.units.${a.type}`)] }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: [a.reason, " \u00B7 ", a.createdByName] })] }), _jsx(IconButton, { size: "small", disabled: busy, onClick: () => void act(() => billingApi.removeAdjustment(sheet.id, a.id)), children: _jsx(DeleteOutlineIcon, { fontSize: "small" }) })] }, a.id))) })), _jsxs(Stack, { spacing: 2, children: [_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 2, children: [_jsx(TextField, { select: true, sx: { flex: 2 }, label: t('timesheets.adjustmentType'), value: type, onChange: (e) => setType(e.target.value), children: adjustmentTypes.map((x) => (_jsx(MenuItem, { value: x, children: t(`timesheets.adjustments.${x}`) }, x))) }), _jsx(TextField, { sx: { flex: 1 }, label: t(`timesheets.units.${type}`), value: value, onChange: (e) => setValue(e.target.value.replace(type === 'FeeDays' ? /[^\d.-]/g : /[^\d.]/g, '')), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } })] }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t(`timesheets.adjustmentHints.${type}`) }), _jsx(TextField, { label: t('timesheets.reason'), value: reason, onChange: (e) => setReason(e.target.value), required: true, slotProps: { htmlInput: { maxLength: 500 } } })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.close') }), _jsx(Button, { variant: "contained", disabled: busy || !Number(value) || !reason.trim(), onClick: () => void act(async () => {
                            await billingApi.adjust(sheet.id, { workerId: line.workerId, type, value: Number(value), reason: reason.trim() });
                            setValue('');
                            setReason('');
                        }), children: t('timesheets.addAdjustment') })] })] }));
}
function SettingsDialog({ sheet, onClose, onSaved }) {
    const { t } = useTranslation();
    const [s, setS] = useState(sheet.settings);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const num = (key, label, scale = 1) => (_jsx(TextField, { label: label, value: s[key] === null ? '' : String(Math.round(Number(s[key]) * scale * 10000) / 10000), onChange: (e) => setS({ ...s, [key]: e.target.value === '' ? null : Number(e.target.value.replace(/[^\d.]/g, '')) / scale }), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } }));
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('timesheets.settings.title') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, mb: 2 }, children: t('timesheets.settings.hint', { project: sheet.projectName }) }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }, children: [_jsx(TextField, { select: true, label: t('timesheets.settings.cycleStartDay'), value: s.cycleStartDay, onChange: (e) => setS({ ...s, cycleStartDay: Number(e.target.value) }), children: Array.from({ length: 28 }, (_, n) => n + 1).map((d) => (_jsx(MenuItem, { value: d, children: d === 1 ? t('timesheets.settings.calendarMonth') : t('timesheets.settings.fromDay', { day: d, prev: d - 1 }) }, d))) }), _jsxs(TextField, { select: true, label: t('timesheets.settings.dayBasis'), value: s.dayBasis, onChange: (e) => setS({ ...s, dayBasis: e.target.value }), children: [_jsx(MenuItem, { value: "Thirty", children: t('timesheets.dayBasis.Thirty') }), _jsx(MenuItem, { value: "ActualDays", children: t('timesheets.dayBasis.ActualDays') })] }), num('overtimeMultiplier', t('timesheets.settings.overtimeMultiplier')), num('monthlyHours', t('timesheets.settings.monthlyHours')), num('overtimeHourlyRate', t('timesheets.settings.overtimeHourlyRate')), num('maxOvertimeHours', t('timesheets.settings.maxOvertimeHours')), num('gosiRate', t('timesheets.settings.gosiRate'), 100), num('vatRate', t('timesheets.settings.vatRate'), 100)] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy, onClick: () => {
                            setBusy(true);
                            setError(null);
                            billingApi
                                .saveSettings(sheet.projectId, s)
                                .then(onSaved)
                                .catch((failure) => setError(errorKey(failure)))
                                .finally(() => setBusy(false));
                        }, children: t('common.save') })] })] }));
}
