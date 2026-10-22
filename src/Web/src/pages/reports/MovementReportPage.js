import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CloseIcon from '@mui/icons-material/Close';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FiberNewOutlinedIcon from '@mui/icons-material/FiberNewOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { Alert, Box, Button, Chip, Drawer, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { movementApi } from '../../api/reports';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Columns, RankedBars } from '../../components/charts';
import { accents, appear, card, CardTitle, Empty, Hero, Kpi, Legend, Loading, PrintStyles, ReportBar, Ticker, useFormat, useMark, usePeriodChoice } from './reportKit';
/**
 * The workforce movement report (docs/03-migration-plan/14, phase B): the starts and the returns against the period
 * before, the new workers and their delivery, how long the returning workers stayed, why they came back and who waits in
 * housing; every figure comes from the server and opens the list behind it, as Excel too.
 */
export function MovementReportPage() {
    const { t } = useTranslation();
    const { can } = useSession();
    const choice = usePeriodChoice();
    const { from, to } = choice;
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(null);
    useEffect(() => {
        setData(null);
        setError(null);
        movementApi.overview(from, to).then(setData).catch((f) => setError(errorKey(f)));
    }, [from, to]);
    if (!can('reports.movement.view', true)) {
        return _jsx(Alert, { severity: "warning", children: t('movement.noAccess') });
    }
    return (_jsxs(Box, { children: [_jsx(PrintStyles, {}), _jsx(ReportBar, { tabs: [{ key: 'moves', label: t('movement.tab'), icon: _jsx(SwapHorizOutlinedIcon, {}) }], tab: "moves", onTab: () => undefined, choice: choice, period: data?.period }), _jsx(ErrorMessage, { messageKey: error }), data ? _jsx(Body, { data: data, onOpen: setOpen }, `${from}-${to}`) : !error && _jsx(Loading, {}), open && _jsx(ListDrawer, { from: from, to: to, ...open, onClose: () => setOpen(null) })] }));
}
function Body({ data, onOpen }) {
    const { t } = useTranslation();
    const f = useFormat();
    const months = data.months.map((m) => f.monthName(m.month));
    const inHousing = (data.arrivals.value ?? 0) - data.arrivalsDelivered;
    return (_jsxs(Box, { children: [_jsxs(Hero, { children: [_jsx(Kpi, { index: 0, label: t('movement.kpi.starts'), icon: _jsx(TrendingUpOutlinedIcon, {}), figure: data.starts, unit: t('exec.worker'), good: "up", spark: data.months.map((m) => m.starts), onClick: () => onOpen({ list: 'moves', title: t('movement.kpi.starts'), drill: { kind: 'Work' } }) }), _jsx(Kpi, { index: 1, label: t('movement.kpi.returns'), icon: _jsx(KeyboardReturnOutlinedIcon, {}), figure: data.returns, unit: t('exec.worker'), good: "down", spark: data.months.map((m) => m.returns), onClick: () => onOpen({ list: 'moves', title: t('movement.kpi.returns'), drill: { kind: 'Housing' } }) }), _jsx(Kpi, { index: 2, label: t('movement.kpi.arrivals'), icon: _jsx(FiberNewOutlinedIcon, {}), figure: data.arrivals, unit: t('exec.worker'), spark: data.months.map((m) => m.arrivals), note: t('movement.kpi.arrivalsNote', { delivered: f.n(data.arrivalsDelivered), housing: f.n(inHousing) }), onClick: () => onOpen({ list: 'arrivals', title: t('movement.kpi.arrivals'), drill: {} }) }), _jsx(Kpi, { index: 3, label: t('movement.kpi.net'), icon: _jsx(SyncAltOutlinedIcon, {}), figure: data.net, good: "up", spark: data.months.map((m) => m.starts - m.returns) }), _jsx(Kpi, { index: 4, label: t('movement.kpi.stint'), icon: _jsx(TimerOutlinedIcon, {}), figure: data.averageStint, unit: t('movement.daysUnit'), spark: data.months.map((m) => m.averageStint), note: t('movement.kpi.stintNote') }), _jsx(Kpi, { index: 5, label: t('movement.kpi.waiting'), icon: _jsx(HourglassBottomOutlinedIcon, {}), value: data.waiting, unit: t('exec.worker'), note: data.oldestWaitingDays !== null ? t('movement.kpi.oldest', { days: f.n(data.oldestWaitingDays) }) : undefined, onClick: () => onOpen({ list: 'waiting', title: t('movement.kpi.waiting'), drill: {} }) })] }), _jsx(Summary, { data: data }), _jsxs(Box, { sx: { display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, mb: 1.75 }, children: [_jsxs(Box, { sx: { ...card, ...appear(0.35) }, children: [_jsx(CardTitle, { icon: _jsx(HistoryOutlinedIcon, {}), title: t('movement.months.title'), hint: t('exec.moves.hint') }), _jsx(Columns, { categories: months, series: [
                                    { key: 'starts', label: t('exec.moves.starts'), color: tokens.navy700 },
                                    { key: 'returns', label: t('exec.moves.returns'), color: accents.amber },
                                ], values: [data.months.map((m) => m.starts), data.months.map((m) => m.returns)], onPick: (i) => onOpen({ list: 'moves', title: t('exec.drill.month', { month: f.monthLong(data.months[i].month) }), drill: { month: data.months[i].month } }) }), _jsx(Legend, { items: [[t('exec.moves.starts'), tokens.navy700], [t('exec.moves.returns'), accents.amber]] })] }), _jsxs(Box, { sx: { ...card, ...appear(0.43) }, children: [_jsx(CardTitle, { icon: _jsx(ManageAccountsOutlinedIcon, {}), title: t('exec.managers.title'), hint: t('exec.managers.hint') }), data.startsByManager.length === 0 ? (_jsx(Empty, {})) : (_jsx(RankedBars, { items: data.startsByManager.slice(0, 8).map((r) => ({ key: r.key, label: r.name, value: r.count })), onClick: (key) => onOpen({ list: 'moves', title: t('exec.drill.manager', { name: key }), drill: { manager: key, kind: 'Work' } }) }))] })] }), _jsxs(Box, { sx: { display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' } }, children: [_jsxs(Box, { sx: { ...card, ...appear(0.51) }, children: [_jsx(CardTitle, { icon: _jsx(FiberNewOutlinedIcon, {}), title: t('movement.arrivals.title'), hint: t('movement.arrivals.hint', { count: f.n(data.newWorkersTotal) }), action: data.newWorkersTotal > 8 ? (_jsx(Button, { size: "small", onClick: () => onOpen({ list: 'arrivals', title: t('movement.kpi.arrivals'), drill: {} }), children: t('movement.showAll') })) : undefined }), data.newWorkers.length === 0 ? _jsx(Empty, {}) : _jsx(ArrivalsTable, { rows: data.newWorkers.slice(0, 8) })] }), _jsxs(Box, { sx: { ...card, ...appear(0.59) }, children: [_jsx(CardTitle, { icon: _jsx(KeyboardReturnOutlinedIcon, {}), title: t('movement.reasons.title'), hint: t('movement.reasons.hint') }), data.reasons.length === 0 ? (_jsx(Empty, {})) : (_jsx(RankedBars, { color: accents.amber, items: data.reasons.map((r) => ({ key: r.key, label: t(`operations.return.reasons.${r.key}`), value: r.count })), onClick: (key) => onOpen({ list: 'returns', title: t('movement.drill.reason', { reason: t(`operations.return.reasons.${key}`) }), drill: { reason: key } }) }))] })] })] }));
}
/** The summary for management, written from the figures. */
function Summary({ data }) {
    const { t } = useTranslation();
    const f = useFormat();
    const mark = useMark();
    const lines = [];
    const s = data.starts.value ?? 0;
    const ps = data.starts.previous;
    lines.push(ps === null ? mark('exec.ins.starts', { count: f.n(s) }) : mark(s >= ps ? 'exec.ins.startsUp' : 'exec.ins.startsDown', { count: f.n(s), diff: f.n(Math.abs(s - ps)) }));
    if (data.startsByProject[0])
        lines.push(mark('movement.ins.topProject', { name: data.startsByProject[0].name, count: f.n(data.startsByProject[0].count) }));
    const r = data.returns.value ?? 0;
    const top = data.reasons[0];
    lines.push(top ? mark('movement.ins.returnsReason', { count: f.n(r), top: f.n(top.count), reason: t(`operations.return.reasons.${top.key}`) }) : mark('movement.ins.returns', { count: f.n(r) }));
    if (data.averageStint.value !== null)
        lines.push(mark('movement.ins.stint', { days: f.n(data.averageStint.value) }));
    const a = data.arrivals.value ?? 0;
    if (a > 0)
        lines.push(mark('movement.ins.arrivals', { count: f.n(a), delivered: f.n(data.arrivalsDelivered), waiting: f.n(a - data.arrivalsDelivered) }));
    if (data.waiting > 0)
        lines.push(mark('movement.ins.waiting', { count: f.n(data.waiting), days: f.n(data.oldestWaitingDays ?? 0) }));
    return _jsx(Ticker, { lines: lines });
}
function WorkerCell({ name, no }) {
    return (_jsxs(_Fragment, { children: [_jsx(Typography, { dir: "auto", sx: { fontSize: 12.5, fontWeight: 600, unicodeBidi: 'plaintext', textAlign: 'start' }, children: name }), _jsx(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: _jsx("bdi", { children: no }) })] }));
}
const head = { '& th': { bgcolor: tokens.navy800, color: '#fff', fontWeight: 700 } };
function ArrivalsTable({ rows, full }) {
    const { t } = useTranslation();
    const f = useFormat();
    return (_jsx(TableContainer, { sx: full ? { maxHeight: 'calc(100vh - 120px)' } : undefined, children: _jsxs(Table, { size: "small", stickyHeader: full, children: [_jsx(TableHead, { sx: head, children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('exec.drill.worker') }), _jsx(TableCell, { children: t('movement.arrivals.arrived') }), _jsx(TableCell, { children: t('movement.arrivals.firstWork') }), _jsx(TableCell, { children: t('exec.fin.project') }), _jsx(TableCell, { children: t('movement.arrivals.days') }), full && _jsx(TableCell, { children: t('movement.arrivals.workDays') }), full && _jsx(TableCell, { children: t('movement.arrivals.housingDays') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { children: _jsx(WorkerCell, { name: r.name, no: r.workerNo }) }), _jsx(TableCell, { children: _jsx("bdi", { children: f.day(r.arrivedOn) }) }), _jsx(TableCell, { children: r.firstWorkOn ? _jsx("bdi", { children: f.day(r.firstWorkOn) }) : '—' }), _jsx(TableCell, { children: r.firstWorkOn ? (r.firstProject ?? '—') : _jsx(Chip, { size: "small", label: t('movement.arrivals.inHousing'), sx: { bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, height: 22 } }) }), _jsx(TableCell, { children: t('exec.daysCount', { count: r.days }) }), full && _jsx(TableCell, { children: f.n(r.workDays) }), full && _jsx(TableCell, { children: f.n(r.housingDays) })] }, r.workerNo))) })] }) }));
}
/** The list behind a clicked figure, with its Excel. */
function ListDrawer({ from, to, list, title, drill, onClose }) {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const load = useCallback(() => {
        setError(null);
        setData(null);
        movementApi
            .list(list, from, to, drill)
            .then((rows) => setData({ list, rows }))
            .catch((e) => setError(errorKey(e)));
    }, [list, from, to, drill]);
    useEffect(load, [load]);
    return (_jsxs(Drawer, { anchor: "left", open: true, onClose: onClose, slotProps: { paper: { sx: { width: { xs: '100%', md: 760 }, p: 2 } } }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1.5 }, children: [_jsx(Box, { sx: { width: 38, height: 38, borderRadius: '50%', bgcolor: tokens.navy50, color: tokens.navy700, display: 'grid', placeItems: 'center' }, children: _jsx(EngineeringOutlinedIcon, {}) }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { noWrap: true, sx: { fontWeight: 800, fontSize: 16 }, children: title }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: data ? t('exec.drill.count', { count: data.rows.length }) : ' ' })] }), _jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(FileDownloadOutlinedIcon, {}), component: "a", href: movementApi.excel(list, from, to, drill), children: t('exec.excel') }), _jsx(IconButton, { onClick: onClose, "aria-label": t('common.close'), children: _jsx(CloseIcon, {}) })] }), _jsx(ErrorMessage, { messageKey: error }), !data ? !error && _jsx(LinearProgress, {}) : data.rows.length === 0 ? _jsx(Empty, {}) : _jsx(ListTable, { data: data })] }));
}
function ListTable({ data }) {
    const { t } = useTranslation();
    const f = useFormat();
    if (data.list === 'arrivals')
        return _jsx(ArrivalsTable, { rows: data.rows, full: true });
    const columns = data.list === 'moves'
        ? [t('exec.drill.worker'), t('exec.drill.kind'), t('exec.drill.on'), t('exec.fin.project'), t('exec.fin.manager')]
        : data.list === 'returns'
            ? [t('exec.drill.worker'), t('movement.drill.enteredOn'), t('movement.drill.reasonCol'), t('exec.fin.project'), t('exec.fin.manager'), t('movement.drill.housing')]
            : [t('exec.drill.worker'), t('movement.drill.since'), t('movement.drill.days'), t('movement.drill.lastProject'), t('exec.fin.manager'), t('movement.drill.housing')];
    const rows = data.list === 'moves'
        ? data.rows.map((m, i) => ({ key: `${m.workerNo}-${m.on}-${i}`, cells: [_jsx(WorkerCell, { name: m.name, no: m.workerNo }), t(`exec.drill.${m.kind}`), _jsx("bdi", { children: f.day(m.on) }), m.project ?? '—', m.manager ?? '—'] }))
        : data.list === 'returns'
            ? data.rows.map((r, i) => ({ key: `${r.workerNo}-${r.on}-${i}`, cells: [_jsx(WorkerCell, { name: r.name, no: r.workerNo }), _jsx("bdi", { children: f.day(r.on) }), t(`operations.return.reasons.${r.reason}`), r.project ?? '—', r.manager ?? '—', r.housing ?? '—'] }))
            : data.rows.map((w) => ({ key: w.workerNo, cells: [_jsx(WorkerCell, { name: w.name, no: w.workerNo }), _jsx("bdi", { children: f.day(w.since) }), f.n(w.days), w.fromProject ?? '—', w.manager ?? '—', w.housing ?? '—'] }));
    return (_jsx(TableContainer, { sx: { maxHeight: 'calc(100vh - 120px)' }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsx(TableRow, { children: columns.map((c) => (_jsx(TableCell, { children: c }, c))) }) }), _jsx(TableBody, { children: rows.map((r) => (_jsx(TableRow, { hover: true, children: r.cells.map((c, i) => (_jsx(TableCell, { children: c }, i))) }, r.key))) })] }) }));
}
