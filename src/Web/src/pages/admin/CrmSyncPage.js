import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import SyncIcon from '@mui/icons-material/Sync';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import LinkIcon from '@mui/icons-material/Link';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { crmSyncApi } from '../../api/crmSync';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, EmptyState, PageHeader, Panel, PillTabs, StatusDot } from '../../components/ui';
const runTone = { Queued: 'neutral', Running: 'info', Succeeded: 'success', PartlyFailed: 'warning', Failed: 'danger' };
const ruleTone = { Name: 'success', Duplicate: 'neutral', Spelling: 'info', EnglishName: 'info', Alias: 'primary', Conflict: 'warning', Unmapped: 'danger', Manual: 'primary' };
const pageSize = 100;
/** Copying the old CRM into staging, and turning its countries and professions into the company's lists without duplicates. */
export function CrmSyncPage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const canRun = can('crm_sync.run', true);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const [confirmFull, setConfirmFull] = useState(false);
    const [busy, setBusy] = useState(false);
    const [report, setReport] = useState(null);
    const [list, setList] = useState('nationalities');
    const [refresh, setRefresh] = useState(0);
    const active = status?.runs.some((r) => r.status === 'Queued' || r.status === 'Running') ?? false;
    const load = useCallback(async () => {
        try {
            setStatus(await crmSyncApi.status());
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    // While a run is queued or running, follow it.
    useEffect(() => {
        if (!active) {
            return;
        }
        const timer = window.setInterval(() => void load(), 3000);
        return () => window.clearInterval(timer);
    }, [active, load]);
    const run = async (mode) => {
        setConfirmFull(false);
        setError(null);
        try {
            await crmSyncApi.run(mode);
            await load();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    const importLists = async () => {
        setBusy(true);
        setError(null);
        try {
            setReport(await crmSyncApi.importReferences());
            setRefresh((r) => r + 1);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const when = useDate();
    const day = (value) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
    const synced = (status?.entities.find((e) => e.entity === 'new_country')?.records ?? 0) > 0;
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('crmSync.title'), subtitle: t('crmSync.intro') }), _jsx(ErrorMessage, { messageKey: error }), status && !status.configured && (_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('crmSync.notConfigured') })), status?.configured && !status.isThisCompany && (_jsx(Alert, { severity: "info", sx: { mb: 2 }, children: t('crmSync.otherCompany', { company: status.company }) })), _jsxs(Panel, { padding: 2.5, sx: { mb: `${tokens.gap}px` }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 2 }, children: [_jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 800, color: tokens.navy800 }, children: t('crmSync.copyTitle') }), _jsxs(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: [t('crmSync.readOnly'), " ", status && (status.intervalMinutes > 0 ? t('crmSync.every', { minutes: status.intervalMinutes }) : t('crmSync.manualOnly'))] })] }), canRun && status?.configured && status.isThisCompany && (_jsxs(Stack, { direction: "row", sx: { gap: 1 }, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(SyncIcon, {}), disabled: active, onClick: () => void run('Incremental'), children: t('crmSync.runIncremental') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(CloudSyncOutlinedIcon, {}), disabled: active, onClick: () => setConfirmFull(true), children: t('crmSync.runFull') })] }))] }), active && _jsx(LinearProgress, { sx: { mb: 2, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('crmSync.entity') }), _jsx(TableCell, { align: "center", children: t('crmSync.records') }), _jsx(TableCell, { align: "center", children: t('crmSync.deleted') }), _jsx(TableCell, { children: t('crmSync.lastChange') }), _jsx(TableCell, { children: t('crmSync.lastSuccess') }), _jsx(TableCell, { children: t('common.status') })] }) }), _jsx(TableBody, { children: status?.entities.map((e) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600 }, children: t(`crmSync.entities.${e.entity}`, { defaultValue: e.nameAr }) }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, dir: "ltr", children: e.entity }), e.createdFrom && _jsx(Badge, { tone: "warning", children: t('crmSync.createdFrom', { date: day(e.createdFrom) }) })] }), _jsx(TableCell, { align: "center", children: e.records.toLocaleString('en-US') }), _jsx(TableCell, { align: "center", children: e.deleted || '—' }), _jsx(TableCell, { children: e.lastChangeCopied ? when(e.lastChangeCopied) : '—' }), _jsx(TableCell, { children: e.lastSucceededAt ? when(e.lastSucceededAt) : '—' }), _jsx(TableCell, { sx: { whiteSpace: 'normal', maxWidth: 280 }, children: e.lastError && (!e.lastSucceededAt || (e.lastFailedAt ?? '') > e.lastSucceededAt) ? (_jsx(StatusDot, { tone: "danger", label: e.lastError })) : e.lastSucceededAt ? (_jsx(StatusDot, { tone: "success", label: t('crmSync.ok') })) : (_jsx(StatusDot, { tone: "neutral", label: t('crmSync.never') })) })] }, e.entity))) })] }) }), status && status.runs.length > 0 && (_jsxs(Box, { sx: { mt: 2.5 }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800, mb: 1 }, children: t('crmSync.runs') }), _jsx(Stack, { spacing: 0.75, children: status.runs.slice(0, 5).map((r) => {
                                    const totals = r.results.reduce((a, x) => ({ read: a.read + x.read, inserted: a.inserted + x.inserted, updated: a.updated + x.updated, deleted: a.deleted + x.deleted + (x.excluded ?? 0) }), { read: 0, inserted: 0, updated: 0, deleted: 0 });
                                    return (_jsxs(Stack, { direction: "row", sx: { gap: 1.25, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: tokens.gray600 }, children: [_jsx(Badge, { tone: runTone[r.status], children: t(`crmSync.status.${r.status}`) }), _jsx("span", { children: t(`crmSync.mode.${r.mode}`) }), _jsxs("span", { children: ["\u2014 ", r.requestedBy === 'scheduled' ? t('crmSync.scheduled') : r.requestedBy] }), _jsxs("span", { children: ["\u2014 ", when(r.requestedAt)] }), r.finishedAt && _jsxs("span", { children: ["\u2014 ", t('crmSync.totals', totals)] }), r.error && _jsxs("span", { style: { color: tokens.danger }, children: ["\u2014 ", r.error] })] }, r.id));
                                }) })] }))] }), _jsxs(Panel, { padding: 2.5, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 2 }, children: [_jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 800, color: tokens.navy800 }, children: t('crmSync.referencesTitle') }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: t('crmSync.referencesIntro') })] }), canRun && status?.isThisCompany && (_jsx(Button, { variant: "contained", startIcon: _jsx(PlaylistAddCheckIcon, {}), disabled: busy || active || !synced, onClick: () => void importLists(), children: busy ? t('common.loading') : t('crmSync.import') }))] }), !synced && _jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500, mb: 2 }, children: t('crmSync.syncFirst') }), report && (_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 2.5 }, children: [_jsx(Summary, { title: t('crmSync.lists.nationalities'), summary: report.nationalities }), _jsx(Summary, { title: t('crmSync.lists.professions'), summary: report.professions })] })), _jsx(PillTabs, { value: list, onChange: setList, options: [
                            { value: 'nationalities', label: t('crmSync.lists.nationalities') },
                            { value: 'professions', label: t('crmSync.lists.professions') },
                        ] }), _jsx(MappingTable, { list: list, refresh: refresh, canMerge: canRun && status?.isThisCompany === true })] }), _jsxs(Dialog, { open: confirmFull, onClose: () => setConfirmFull(false), children: [_jsx(DialogTitle, { children: t('crmSync.runFull') }), _jsx(DialogContent, { children: _jsx(Typography, { children: t('crmSync.fullHint') }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setConfirmFull(false), children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void run('Full'), children: t('crmSync.runFull') })] })] })] }));
}
function Summary({ title, summary }) {
    const { t } = useTranslation();
    const cells = [
        [t('crmSync.summary.crmRecords'), summary.crmRecords, 'neutral'],
        [t('crmSync.summary.items'), summary.items, 'primary'],
        [t('crmSync.summary.merged'), summary.merged, 'info'],
        [t('crmSync.summary.created'), summary.created, 'success'],
        [t('crmSync.summary.unmapped'), summary.unmapped, summary.unmapped ? 'danger' : 'neutral'],
        [t('crmSync.summary.needsReview'), summary.needsReview, summary.needsReview ? 'warning' : 'neutral'],
    ];
    return (_jsxs(Box, { sx: { p: 1.75, borderRadius: '14px', border: `1px solid ${tokens.border}`, bgcolor: tokens.gray50 }, children: [_jsx(Typography, { sx: { fontWeight: 800, color: tokens.navy800, mb: 1 }, children: title }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }, children: cells.map(([label, value, tone]) => (_jsxs(Box, { sx: { p: 1, borderRadius: '10px', bgcolor: '#fff', border: `1px solid ${tokens.border}` }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: label }), _jsx(Badge, { tone: tone, children: value.toLocaleString('en-US') })] }, label))) })] }));
}
/** Each item with the CRM records merged into it, and the CRM records left unmapped. */
function MappingTable({ list, refresh, canMerge }) {
    const { t, i18n } = useTranslation();
    const [report, setReport] = useState(null);
    const [merge, setMerge] = useState(null);
    const [reloads, setReloads] = useState(0);
    const [search, setSearch] = useState('');
    const [mergedOnly, setMergedOnly] = useState(false);
    const [open, setOpen] = useState(null);
    const [limit, setLimit] = useState(pageSize);
    const ar = i18n.language === 'ar';
    // A new list starts empty; a reload of the same list keeps the table (and the page's scroll) until it arrives.
    useEffect(() => {
        setReport(null);
        setLimit(pageSize);
    }, [list]);
    useEffect(() => {
        crmSyncApi.report(list).then(setReport).catch(() => setReport({ listCode: list, items: [], unmapped: [] }));
    }, [list, refresh, reloads]);
    const items = useMemo(() => {
        const query = search.trim().toLowerCase();
        return (report?.items ?? []).filter((i) => i.records.length > 0 &&
            (!mergedOnly || i.records.length > 1) &&
            (!query || i.code.toLowerCase().includes(query) || i.nameAr.includes(query) || i.nameEn.toLowerCase().includes(query) || i.records.some((r) => r.crmName.toLowerCase().includes(query))));
    }, [report, search, mergedOnly]);
    if (!report) {
        return _jsx(LinearProgress, {});
    }
    if (report.items.every((i) => i.records.length === 0) && report.unmapped.length === 0) {
        return _jsx(EmptyState, { text: t('crmSync.notImported') });
    }
    return (_jsxs(Box, { children: [report.unmapped.length > 0 && (_jsxs(Alert, { severity: "warning", sx: { mb: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13.5, mb: 0.5 }, children: t('crmSync.unmappedTitle', { count: report.unmapped.length }) }), _jsx(Box, { component: "ul", sx: { m: 0, paddingInlineStart: 2.5, fontSize: 13 }, children: report.unmapped.map((m) => (_jsxs("li", { children: ["\u00AB", m.crmName || '—', "\u00BB", m.crmCode ? ` (${m.crmCode})` : '', " \u2014 ", t('crmSync.usedBy', { count: m.usage }), canMerge && (_jsx(Button, { size: "small", startIcon: _jsx(LinkIcon, {}), onClick: () => setMerge({ kind: 'record', record: m }), sx: { marginInlineStart: 1, py: 0 }, children: t('crmSync.link') }))] }, m.crmId))) })] })), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1.5, alignItems: { sm: 'center' }, mb: 1.5 }, children: [_jsx(TextField, { size: "small", placeholder: t('crmSync.search'), value: search, onChange: (e) => setSearch(e.target.value), sx: { minWidth: 260 } }), _jsx(FormControlLabel, { control: _jsx(Switch, { size: "small", checked: mergedOnly, onChange: (e) => setMergedOnly(e.target.checked) }), label: t('crmSync.mergedOnly') }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('crmSync.itemCount', { count: items.length }) })] }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { sx: { width: 44 } }), _jsx(TableCell, { children: t('crmSync.code') }), _jsx(TableCell, { children: t('crmSync.name') }), _jsx(TableCell, { align: "center", children: t('crmSync.crmCopies') }), _jsx(TableCell, { align: "center", children: t('crmSync.employees') })] }) }), _jsx(TableBody, { children: items.slice(0, limit).map((item) => (_jsx(ItemRows, { item: item, ar: ar, open: open === item.code, onToggle: () => setOpen(open === item.code ? null : item.code), onMerge: canMerge ? () => setMerge({ kind: 'item', item }) : undefined }, item.code))) })] }) }), items.length > limit && (_jsx(Box, { sx: { textAlign: 'center', mt: 1.5 }, children: _jsx(Button, { onClick: () => setLimit((l) => l + pageSize), children: t('crmSync.showMore') }) })), merge && (_jsx(MergeDialog, { list: list, merge: merge, items: report.items, onClose: () => setMerge(null), onDone: () => {
                    setMerge(null);
                    setOpen(null);
                    setReloads((r) => r + 1);
                } }))] }));
}
/** Merge an item into another, or link an unmatched CRM record to an item; later imports keep the choice. */
function MergeDialog({ list, merge, items, onClose, onDone }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [target, setTarget] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const options = items.filter((i) => merge.kind === 'record' || i.code !== merge.item.code);
    const label = (i) => `${ar ? i.nameAr : i.nameEn} — ${i.code}`;
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await crmSyncApi.merge(list, target.code, merge.kind === 'item' ? { fromCode: merge.item.code } : { crmId: merge.record.crmId });
            onDone();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: merge.kind === 'item' ? t('crmSync.mergeTitle') : t('crmSync.linkTitle') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { sx: { mb: 2, color: tokens.gray700 }, children: merge.kind === 'item'
                            ? t('crmSync.mergeHint', { name: ar ? merge.item.nameAr : merge.item.nameEn, count: merge.item.usage })
                            : t('crmSync.linkHint', { name: merge.record.crmName, count: merge.record.usage }) }), _jsx(Autocomplete, { options: options, value: target, onChange: (_, value) => setTarget(value), getOptionLabel: label, isOptionEqualToValue: (a, b) => a.code === b.code, renderInput: (params) => _jsx(TextField, { ...params, label: t('crmSync.target'), autoFocus: true }) })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy || !target, children: busy ? t('common.loading') : merge.kind === 'item' ? t('crmSync.merge') : t('crmSync.link') })] })] }));
}
function ItemRows({ item, ar, open, onToggle, onMerge }) {
    const { t } = useTranslation();
    const merged = item.records.length > 1;
    return (_jsxs(Fragment, { children: [_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: onToggle, children: [_jsx(TableCell, { children: _jsx(IconButton, { size: "small", "aria-label": open ? t('process.collapse') : t('process.expand'), children: open ? _jsx(ExpandLessIcon, { fontSize: "small" }) : _jsx(ExpandMoreIcon, { fontSize: "small" }) }) }), _jsx(TableCell, { dir: "ltr", sx: { fontFamily: 'monospace', fontSize: 12.5 }, children: item.code }), _jsxs(TableCell, { sx: { whiteSpace: 'normal' }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600 }, children: ar ? item.nameAr : item.nameEn }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: ar ? item.nameEn : item.nameAr })] }), _jsx(TableCell, { align: "center", children: merged ? _jsx(Badge, { tone: "info", children: item.records.length }) : 1 }), _jsx(TableCell, { align: "center", children: item.usage || '—' })] }), open && (_jsx(TableRow, { children: _jsxs(TableCell, { colSpan: 5, sx: { bgcolor: tokens.gray50 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }, children: [_jsx(Typography, { sx: { fontSize: 12, fontWeight: 700, color: tokens.navy700 }, children: t('crmSync.crmRecords') }), onMerge && (_jsx(Button, { size: "small", startIcon: _jsx(CallMergeIcon, {}), onClick: onMerge, children: t('crmSync.mergeInto') }))] }), _jsx(Stack, { spacing: 0.5, children: item.records.map((r) => (_jsxs(Stack, { direction: "row", sx: { gap: 1, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }, children: [_jsx(Badge, { tone: ruleTone[r.rule] ?? 'neutral', children: t(`crmSync.rule.${r.rule}`) }), _jsxs("span", { children: ["\u00AB", r.crmName, "\u00BB"] }), r.crmCode && (_jsxs(Box, { component: "span", dir: "ltr", sx: { color: tokens.gray500 }, children: ["(", r.crmCode, ")"] })), _jsxs("span", { style: { color: tokens.gray500 }, children: ["\u2014 ", t('crmSync.usedBy', { count: r.usage })] })] }, r.crmId))) })] }) }))] }));
}
function useDate() {
    const { i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    return (value) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));
}
