import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../../api/auth';
import { managementApi } from '../../../api/management';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { DataTable, Donut, finCard, md, Pill, Rolling, useNumbers } from './mdKit';
const typeLook = {
    invoice: { color: md.teal, bg: md.glassHi },
    deliver: { color: '#1F78C8', bg: md.glassHi },
    housing: { color: md.brown, bg: md.glassHi },
    vacation: { color: md.amberDeep, bg: md.glassHi },
    permission: { color: '#7C5CBF', bg: md.glassHi },
    other: { color: md.muted, bg: md.glassHi },
};
const statusLook = {
    done: { color: md.greenDeep, bg: md.glassHi },
    late: { color: md.red, bg: md.glassHi },
    open: { color: md.blue, bg: md.glassHi },
};
/**
 * «المهام» as the old dashboard had it (docs/03-migration-plan/19): the old system's tasks of the period, read from the
 * CRM copy. A task is shown only (it cannot be opened or changed here: its record lives in the old system).
 */
export function TasksTab({ from, to }) {
    const { t } = useTranslation();
    const f = useNumbers();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('pending');
    const [type, setType] = useState('all');
    const [owner, setOwner] = useState(null);
    const [ownerSearch, setOwnerSearch] = useState('');
    const [shown, setShown] = useState(null);
    useEffect(() => {
        let live = true;
        setData(null);
        setError(null);
        setOwner(null);
        managementApi
            .tasks(from, to)
            .then((d) => live && setData(d))
            .catch((e) => live && setError(errorKey(e)));
        return () => {
            live = false;
        };
    }, [from, to]);
    const rows = useMemo(() => (data?.rows ?? []).filter((r) => (status === 'all' || (status === 'pending' ? r.status !== 'done' : r.status === status)) && (type === 'all' || r.type === type) && (!owner || r.owner === owner)), [data, status, type, owner]);
    const columns = useMemo(() => [
        {
            key: 'task',
            label: t('mgmt.tasks.col.task'),
            render: (r) => (_jsxs(Box, { sx: { minWidth: 0, maxWidth: 320, whiteSpace: 'normal' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: md.ink }, children: _jsx("bdi", { children: r.subject || '—' }) }), r.regarding && (_jsxs(Typography, { sx: { fontSize: 11, color: md.muted, display: 'flex', alignItems: 'center', gap: 0.5 }, children: [_jsx(LinkOutlinedIcon, { sx: { fontSize: 13 } }), _jsx("bdi", { children: r.regarding })] }))] })),
            text: (r) => `${r.subject} ${r.regarding ?? ''}`,
        },
        { key: 'owner', label: t('mgmt.tasks.col.owner'), render: (r) => _jsx("bdi", { children: r.owner }), text: (r) => r.owner },
        { key: 'type', label: t('mgmt.tasks.col.type'), render: (r) => _jsx(Pill, { ...typeLook[r.type], children: t(`mgmt.tasks.type.${r.type}`) }) },
        {
            key: 'created',
            label: t('mgmt.tasks.col.created'),
            render: (r) => (_jsxs(_Fragment, { children: [_jsx("bdi", { children: r.createdOn ?? '—' }), _jsx(Typography, { sx: { fontSize: 10.5, color: md.muted }, children: t('mgmt.tasks.since', { count: r.ageDays }) })] })),
        },
        {
            key: 'due',
            label: t('mgmt.tasks.col.due'),
            render: (r) => (_jsxs(_Fragment, { children: [_jsx("bdi", { children: r.dueOn ?? '—' }), _jsx(Box, { sx: { mt: 0.25 }, children: _jsx(Timing, { row: r }) })] })),
        },
        { key: 'status', label: t('mgmt.tasks.col.status'), render: (r) => _jsx(Pill, { ...statusLook[r.status], children: t(`mgmt.tasks.status.${r.status}`) }) },
    ], [t]);
    if (error)
        return _jsx(ErrorMessage, { messageKey: error });
    if (!data) {
        return (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' } }, children: Array.from({ length: 5 }, (_, i) => (_jsx(Skeleton, { variant: "rounded", height: 86, sx: { borderRadius: '12px' } }, i))) }), _jsx(Skeleton, { variant: "rounded", height: 420, sx: { borderRadius: '16px' } })] }));
    }
    const owners = data.owners.filter((o) => o.name.toLowerCase().includes(ownerSearch.trim().toLowerCase()));
    const typeTop = Math.max(1, ...data.byType.map((x) => x.total));
    return (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsxs(Box, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' } }, children: [_jsx(TaskKpi, { color: md.teal, icon: _jsx(ChecklistOutlinedIcon, {}), label: t('mgmt.tasks.total'), value: _jsx(Rolling, { value: data.total }), foot: t('mgmt.inPeriod'), onClick: () => (setStatus('all'), setOwner(null)) }), _jsx(TaskKpi, { color: md.green, icon: _jsx(CheckCircleOutlineOutlinedIcon, {}), label: t('mgmt.tasks.done'), value: _jsx(Rolling, { value: data.completed }), foot: t('mgmt.tasks.completion', { rate: data.completionRate === null ? '—' : f.p(data.completionRate) }), footColor: md.greenDeep, onClick: () => setStatus('done') }), _jsx(TaskKpi, { color: md.blue, icon: _jsx(HourglassBottomOutlinedIcon, {}), label: t('mgmt.tasks.open'), value: _jsx(Rolling, { value: data.open }), foot: t('mgmt.tasks.openFoot'), onClick: () => setStatus('pending') }), _jsx(TaskKpi, { color: md.red, icon: _jsx(WarningAmberOutlinedIcon, {}), label: t('mgmt.tasks.late'), value: _jsx(Rolling, { value: data.overdue }), valueColor: md.red, foot: t('mgmt.tasks.lateFoot'), onClick: () => setStatus('late') }), _jsx(TaskKpi, { color: md.navy, icon: _jsx(ScheduleOutlinedIcon, {}), label: t('mgmt.tasks.onTime'), value: data.onTimeRate === null ? '—' : _jsxs(_Fragment, { children: [_jsx(Rolling, { value: data.onTimeRate, decimals: 1 }), "%"] }), foot: t('mgmt.tasks.onTimeFoot') })] }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 290px' }, alignItems: 'start' }, children: [_jsxs(Box, { sx: finCard, children: [_jsx(DataTable, { title: owner ? t('mgmt.tasks.ofOwner', { name: owner }) : t('mgmt.tasks.all'), badge: t('mgmt.tasks.shown', { count: rows.length }), rows: rows, columns: columns, excel: managementApi.tasksExcel(from, to), empty: t('mgmt.tasks.empty'), onRow: setShown, filters: _jsxs(Stack, { sx: { gap: 0.75, mb: 1.25 }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 0.75, flexWrap: 'wrap' }, children: [['pending', 'late', 'open', 'done', 'all'].map((s) => (_jsx(Chip, { active: status === s, onClick: () => setStatus(s), children: t(`mgmt.tasks.filter.${s}`) }, s))), owner && (_jsxs(Chip, { active: true, onClick: () => setOwner(null), children: [t('mgmt.tasks.allStaff'), " \u2715"] }))] }), _jsx(Stack, { direction: "row", sx: { gap: 0.75, flexWrap: 'wrap' }, children: ['all', 'invoice', 'deliver', 'housing', 'vacation', 'permission', 'other'].map((k) => (_jsx(Chip, { active: type === k, onClick: () => setType(k), dot: k === 'all' ? undefined : typeLook[k].color, children: k === 'all' ? t('mgmt.tasks.allTypes') : t(`mgmt.tasks.type.${k}`) }, k))) })] }) }), _jsx(Typography, { sx: { fontSize: 11, color: md.muted, mt: 1 }, children: t('mgmt.tasks.listNote', { count: 300 }) })] }), _jsxs(Box, { sx: finCard, children: [_jsx(Typography, { component: "h3", sx: { fontSize: 14.5, fontWeight: 700, color: md.title }, children: t('mgmt.tasks.staff') }), _jsx(Typography, { sx: { fontSize: 11.5, color: md.muted, mb: 1 }, children: t('mgmt.tasks.staffHint') }), _jsx(TextField, { size: "small", fullWidth: true, placeholder: t('mgmt.tasks.staffSearch'), value: ownerSearch, onChange: (e) => setOwnerSearch(e.target.value), sx: { mb: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } } }), _jsx(Stack, { sx: { gap: 1, maxHeight: 640, overflowY: 'auto', scrollbarWidth: 'thin', pe: 0.5 }, children: owners.map((o) => {
                                    const late = o.overdue > 0;
                                    return (_jsxs(ButtonBase, { onClick: () => (setOwner(owner === o.name ? null : o.name), setStatus('pending')), sx: {
                                            display: 'flex',
                                            gap: 1,
                                            p: 1.25,
                                            borderRadius: '12px',
                                            textAlign: 'start',
                                            border: `1px solid ${owner === o.name ? md.navy : md.border}`,
                                            boxShadow: `inset -3px 0 0 ${late ? md.red : o.open ? md.blue : md.green}`,
                                            bgcolor: owner === o.name ? md.glassHi : md.glass,
                                        }, children: [_jsx(Box, { sx: { width: 32, height: 32, borderRadius: '50%', bgcolor: md.navy, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, flex: '0 0 auto' }, children: _jsx("bdi", { children: Array.from(o.name.trim())[0]?.toUpperCase() ?? '—' }) }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: md.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: _jsx("bdi", { children: o.name }) }), _jsx(Typography, { sx: { fontSize: 10.5, color: md.muted }, children: t('mgmt.tasks.ownerSub', { total: o.total, completion: f.p(o.completionRate), onTime: f.p(o.onTimeRate) }) }), _jsxs(Stack, { direction: "row", sx: { height: 5, borderRadius: 999, overflow: 'hidden', bgcolor: md.track, my: 0.5 }, children: [_jsx(Box, { sx: { width: `${(o.completed / Math.max(1, o.total)) * 100}%`, bgcolor: md.green } }), _jsx(Box, { sx: { width: `${((o.open - o.overdue) / Math.max(1, o.total)) * 100}%`, bgcolor: md.blue } }), _jsx(Box, { sx: { width: `${(o.overdue / Math.max(1, o.total)) * 100}%`, bgcolor: md.red } })] }), o.open > 0 && _jsx(Typography, { sx: { fontSize: 10.5, color: late ? md.red : md.muted }, children: t('mgmt.tasks.oldest', { count: o.oldestPendingDays }) })] }), _jsxs(Box, { sx: { textAlign: 'center', flex: '0 0 auto' }, children: [_jsx(Typography, { sx: { fontSize: 18, fontWeight: 700, color: late ? md.red : o.open ? md.blue : md.green }, children: o.open }), late ? _jsx(Pill, { ...statusLook.late, children: t('mgmt.tasks.lateCount', { count: o.overdue }) }) : _jsx(Typography, { sx: { fontSize: 10.5, color: md.muted }, children: t('mgmt.tasks.pending') })] })] }, o.name));
                                }) })] })] }), _jsxs(Box, { sx: { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.4fr) minmax(0, 1fr)' } }, children: [_jsxs(Box, { sx: finCard, children: [_jsx(Typography, { component: "h3", sx: { fontSize: 14.5, fontWeight: 700, color: md.title, mb: 1.5 }, children: t('mgmt.tasks.byType') }), _jsx(Stack, { sx: { gap: 1 }, children: data.byType.map((x) => (_jsxs(ButtonBase, { onClick: () => (setType(x.type), setStatus('all')), sx: { display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) 64px', gap: 1.25, alignItems: 'center', textAlign: 'start', borderRadius: '8px', p: 0.5 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: md.text }, children: t(`mgmt.tasks.type.${x.type}`) }), _jsxs(Stack, { direction: "row", sx: { height: 10, borderRadius: 999, overflow: 'hidden', bgcolor: md.track }, children: [_jsx(Box, { sx: { width: `${(x.done / typeTop) * 100}%`, bgcolor: md.green } }), _jsx(Box, { sx: { width: `${(x.open / typeTop) * 100}%`, bgcolor: '#E8890C' } })] }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: md.ink, textAlign: 'end' }, children: f.n(x.total) })] }, x.type))) }), _jsxs(Stack, { direction: "row", sx: { gap: 2, mt: 1.25, fontSize: 11.5, color: md.muted }, children: [_jsxs("span", { children: [_jsx(Box, { component: "span", sx: { color: md.green }, children: "\u25A0" }), " ", t('mgmt.tasks.status.done')] }), _jsxs("span", { children: [_jsx(Box, { component: "span", sx: { color: '#E8890C' }, children: "\u25A0" }), " ", t('mgmt.tasks.pending')] })] })] }), _jsxs(Box, { sx: finCard, children: [_jsx(Typography, { component: "h3", sx: { fontSize: 14.5, fontWeight: 700, color: md.title, mb: 1.5 }, children: t('mgmt.tasks.statuses') }), _jsx(Donut, { items: [
                                    { key: 'done', label: t('mgmt.tasks.status.done'), value: data.completed },
                                    { key: 'open', label: t('mgmt.tasks.status.open'), value: data.open - data.overdue },
                                    { key: 'late', label: t('mgmt.tasks.status.late'), value: data.overdue },
                                ], colors: [md.green, md.blue, md.red] })] })] }), _jsx(Dialog, { open: !!shown, onClose: () => setShown(null), maxWidth: "sm", fullWidth: true, "aria-labelledby": "task-title", children: shown && (_jsxs(_Fragment, { children: [_jsx(DialogTitle, { id: "task-title", sx: { fontWeight: 700, color: md.title }, children: _jsx("bdi", { children: shown.subject || '—' }) }), _jsx(DialogContent, { dividers: true, children: _jsxs(Stack, { sx: { gap: 1.25 }, children: [_jsxs(Fact, { label: t('mgmt.tasks.col.status'), children: [_jsx(Pill, { ...statusLook[shown.status], children: t(`mgmt.tasks.status.${shown.status}`) }), " ", _jsx(Timing, { row: shown })] }), _jsx(Fact, { label: t('mgmt.tasks.col.type'), children: t(`mgmt.tasks.type.${shown.type}`) }), _jsx(Fact, { label: t('mgmt.tasks.regarding'), children: _jsx("bdi", { children: shown.regarding ?? '—' }) }), _jsx(Fact, { label: t('mgmt.tasks.col.owner'), children: _jsx("bdi", { children: shown.owner }) }), _jsx(Fact, { label: t('mgmt.tasks.col.created'), children: _jsx("bdi", { children: shown.createdOn ?? '—' }) }), _jsx(Fact, { label: t('mgmt.tasks.col.due'), children: _jsx("bdi", { children: shown.dueOn ?? '—' }) }), shown.doneOn && (_jsx(Fact, { label: t('mgmt.tasks.doneOn'), children: _jsx("bdi", { children: shown.doneOn }) })), _jsx(Typography, { sx: { fontSize: 12, color: md.muted, mt: 0.5 }, children: t('mgmt.tasks.viewOnly') })] }) }), _jsx(DialogActions, { children: _jsx(Button, { onClick: () => setShown(null), autoFocus: true, children: t('common.close') }) })] })) })] }));
}
function Timing({ row }) {
    const { t } = useTranslation();
    const look = row.timing === 'late' || row.timing === 'lateNoDue' || row.timing === 'doneLate'
        ? statusLook.late
        : row.timing === 'doneOnTime'
            ? statusLook.done
            : { color: md.muted, bg: md.glassHi };
    return _jsx(Pill, { ...look, children: t(`mgmt.tasks.timing.${row.timing}`, { count: row.timingDays }) });
}
function Fact({ label, children }) {
    return (_jsxs(Stack, { direction: "row", sx: { gap: 1.5, alignItems: 'center' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: md.muted, minWidth: 120 }, children: label }), _jsx(Box, { sx: { fontSize: 13.5, fontWeight: 600, color: md.ink }, children: children })] }));
}
function Chip({ active, onClick, dot, children }) {
    return (_jsxs(ButtonBase, { onClick: onClick, sx: { gap: 0.75, px: 1.5, py: 0.6, borderRadius: 999, fontSize: 12, fontWeight: 700, color: active ? '#fff' : md.text, bgcolor: active ? md.navy : md.glassHi, border: `1px solid ${active ? md.navy : md.border}` }, children: [dot && _jsx(Box, { component: "span", sx: { width: 7, height: 7, borderRadius: '50%', bgcolor: dot } }), children] }));
}
function TaskKpi({ color, icon, label, value, foot, footColor, valueColor, onClick }) {
    return (_jsxs(ButtonBase, { onClick: onClick, disabled: !onClick, sx: { justifyContent: 'flex-start', gap: 1.5, p: '12px 14px', borderRadius: '12px', bgcolor: md.glass, border: `1px solid ${md.border}`, boxShadow: `inset 0 3px 0 ${color}, 0 4px 14px rgba(10,60,88,.07)`, textAlign: 'start' }, children: [_jsx(Box, { "aria-hidden": true, sx: { width: 42, height: 42, borderRadius: '50%', bgcolor: color, color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto', '& svg': { fontSize: 21 } }, children: icon }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: md.label }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 24, fontWeight: 700, color: valueColor ?? md.glow, textShadow: valueColor ? undefined : md.glowShadow, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }, children: value }), _jsx(Typography, { sx: { fontSize: 11, color: footColor ?? md.muted }, children: foot })] })] }));
}
