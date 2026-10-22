import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { Box, Button, InputAdornment, LinearProgress, Stack, TablePagination, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi } from '../../api/commercial';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { PageHeader, PillTabs } from '../../components/ui';
import { draftFromSuggestion, PackageDialog, PackagesTable, SuggestionsTable, WorkerPricesTable } from './pricing';
/** Price packages: the user's packages, suggestions from the old system's prices, and the workers' prices against them. */
export function PricesPage() {
    const { t } = useTranslation();
    const { can } = useSession();
    const canManage = can('commercial.prices.manage', true);
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') ?? 'packages';
    const status = params.get('status') ?? '';
    const search = params.get('q') ?? '';
    const page = Number(params.get('page') ?? '1');
    const [text, setText] = useState(search);
    const [pageSize, setPageSize] = useState(50);
    const [packages, setPackages] = useState(null);
    const [suggestions, setSuggestions] = useState(null);
    const [workers, setWorkers] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [reload, setReload] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const update = (changes) => {
        const next = new URLSearchParams(params);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        if (!('page' in changes)) {
            next.delete('page');
        }
        setParams(next, { replace: true });
    };
    useEffect(() => {
        let cancelled = false;
        setBusy(true);
        const q = { search, status, page, pageSize };
        // The packages list carries the cards' totals, so it is loaded on every tab.
        const load = Promise.all([
            commercialApi.prices(tab === 'packages' ? q : { page: 1, pageSize: 10 }).then((value) => !cancelled && setPackages(value)),
            tab === 'suggestions' ? commercialApi.suggestions(q).then((value) => !cancelled && setSuggestions(value)) : null,
            tab === 'workers' ? commercialApi.priceWorkers({ ...q, sort: 'difference' }).then((value) => !cancelled && setWorkers(value)) : null,
        ]);
        load
            .then(() => !cancelled && setError(null))
            .catch((failure) => !cancelled && setError(errorKey(failure)))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [tab, search, status, page, pageSize, reload]);
    const refresh = useCallback(() => setReload((n) => n + 1), []);
    const toggle = async (row) => {
        try {
            await commercialApi.setPackageActive(row.id, !row.isActive);
            refresh();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    const totals = packages?.totals;
    const card = (key, cardTab, label, value, foot, icon, tone) => {
        const active = tab === cardTab && status === key;
        return (_jsx(KpiCard, { label: label, value: (value ?? 0).toLocaleString('en-US'), foot: active ? `✓ ${t('workforce.currentFilter')}` : foot, icon: icon, tone: tone, active: active, onClick: () => update(active ? { status: null } : { tab: cardTab === 'packages' ? null : cardTab, status: key || null }) }));
    };
    const total = tab === 'packages' ? packages?.total ?? 0 : tab === 'suggestions' ? suggestions?.total ?? 0 : workers?.total ?? 0;
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('commercial.prices.title'), subtitle: t('commercial.prices.intro'), actions: canManage ? (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setDialog({}), children: t('commercial.prices.new') })) : undefined }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(KpiGrid, { count: 5, children: [card('current', 'packages', t('commercial.prices.cards.packages'), totals?.packages, t('commercial.prices.cards.packagesFoot'), _jsx(SellOutlinedIcon, {}), tokens.navy700), card('package', 'workers', t('commercial.prices.cards.onPackage'), totals?.onPackage, t('commercial.prices.cards.onPackageFoot'), _jsx(TaskAltOutlinedIcon, {}), '#1f9d55'), card('special', 'workers', t('commercial.prices.cards.special'), totals?.special, t('commercial.prices.cards.specialFoot'), _jsx(PriceChangeOutlinedIcon, {}), '#d9822b'), card('noPackage', 'workers', t('commercial.prices.cards.noPackage'), totals?.withoutPackage, t('commercial.prices.cards.noPackageFoot'), _jsx(LinkOffOutlinedIcon, {}), '#1b6a92'), card('missing', 'workers', t('commercial.prices.cards.missing'), totals?.withoutPrice, t('commercial.prices.cards.missingFoot'), _jsx(ErrorOutlineOutlinedIcon, {}), '#c0392b')] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsx(PillTabs, { value: tab, onChange: (value) => update({ tab: value === 'packages' ? null : value, status: null }), options: [
                            { value: 'packages', label: t('commercial.prices.tabs.packages') },
                            { value: 'suggestions', label: t('commercial.prices.tabs.suggestions') },
                            { value: 'workers', label: t('commercial.prices.tabs.workers') },
                        ] }), tab === 'suggestions' && _jsx(Typography, { sx: { fontSize: 13, color: tokens.gray600, mb: 1.5 }, children: t('commercial.prices.suggestionsIntro') }), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t(tab === 'workers' ? 'commercial.prices.searchWorkers' : 'commercial.prices.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || status) && _jsx(Button, { onClick: () => (setText(''), update({ q: null, status: null })), children: t('workforce.reset') })] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t(`commercial.prices.count.${tab}`, { count: total }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), tab === 'packages' && packages && (_jsx(PackagesTable, { rows: packages.items, showProject: true, onEdit: canManage ? (row) => setDialog({ package: row }) : undefined, onToggle: canManage ? (row) => void toggle(row) : undefined })), tab === 'suggestions' && suggestions && _jsx(SuggestionsTable, { rows: suggestions.items, showProject: true, onCreate: canManage ? (row) => setDialog({ draft: draftFromSuggestion(row) }) : undefined }), tab === 'workers' && workers && _jsx(WorkerPricesTable, { rows: workers.items, showProject: true }), total === 0 && !busy && (_jsx(Typography, { sx: { py: 5, textAlign: 'center', color: tokens.gray500 }, children: t(tab === 'packages' && !search && !status ? 'commercial.prices.noPackagesYet' : 'commercial.prices.empty') })), _jsx(TablePagination, { component: "div", count: total, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] }), dialog && _jsx(PackageDialog, { package: dialog.package, draft: dialog.draft, onClose: () => setDialog(null), onSaved: () => (setDialog(null), refresh()) })] }));
}
