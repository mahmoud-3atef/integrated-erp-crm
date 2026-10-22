import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HourglassTopOutlinedIcon from '@mui/icons-material/HourglassTopOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Alert, Box, Button, ButtonBase, InputAdornment, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { settlementsApi } from '../../api/settlements';
import { useSession } from '../../app/session';
import { HrEmptyState, HrScope, hr } from '../../components/hr/Hr';
import { GlassHero, GlassKpi, GlassRow, glassButton, glassOnDark, glassPanel } from '../../components/glass';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { NewSettlementDialog } from './NewSettlementDialog';
import { Money, SettlementStatusBadge, sar, useYears } from './settlementParts';
const statuses = ['', 'Open', 'InApproval', 'Approved', 'Paid', 'Cancelled'];
/**
 * The settlements (docs/03-migration-plan/18): the company's staff and its sponsored workers, vacation and end of
 * service; the KPIs over all of them from the server; filtered, sorted and paged on the server. The glass strip is the
 * list's tint (the details have the other one).
 */
export function SettlementsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const years = useYears();
    const [party, setParty] = useState('Staff');
    const [kind, setKind] = useState('');
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [typed, setTyped] = useState('');
    const [sort, setSort] = useState({ by: '', desc: true });
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(25);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [creating, setCreating] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(typed.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [typed]);
    const load = useCallback(() => {
        setError(null);
        settlementsApi
            .list({ party, kind, status, search, sort: sort.by || undefined, desc: sort.desc, page: page + 1, pageSize: size })
            .then(setData)
            .catch((f) => setError(errorKey(f)));
    }, [party, kind, status, search, sort, page, size]);
    useEffect(load, [load]);
    const c = data?.counts;
    const sortBy = (by) => {
        setSort((s) => ({ by, desc: s.by === by ? !s.desc : true }));
        setPage(0);
    };
    const head = (by, label, align) => (_jsx(TableCell, { align: align, sortDirection: sort.by === by ? (sort.desc ? 'desc' : 'asc') : false, children: _jsx(TableSortLabel, { active: sort.by === by, direction: sort.by === by && !sort.desc ? 'asc' : 'desc', onClick: () => sortBy(by), children: label }) }));
    const filtered = Boolean(search || kind || status);
    return (_jsxs(HrScope, { children: [_jsxs(GlassHero, { tint: "list", overline: t('settlements.crumb'), title: t('settlements.title'), subtitle: t('settlements.subtitle'), actions: can('payroll.settlements.manage', true) && (_jsx(Button, { variant: "outlined", startIcon: _jsx(AddIcon, {}), onClick: () => setCreating(true), sx: glassButton(true), children: t('settlements.new') })), children: [_jsx(GlassRow, { children: !c ? (Array.from({ length: 4 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 104, sx: { bgcolor: 'rgba(255,255,255,.12)', borderRadius: '16px' } }, i))) : (_jsxs(_Fragment, { children: [_jsx(GlassKpi, { icon: _jsx(EditNoteOutlinedIcon, {}), label: t('settlements.kpi.drafts'), value: c.drafts, hint: t('settlements.kpi.draftsHint') }), _jsx(GlassKpi, { icon: _jsx(HourglassTopOutlinedIcon, {}), label: t('settlements.kpi.inApproval'), value: c.inApproval, hint: c.oldestInApproval ? t('settlements.kpi.oldest', { date: date(c.oldestInApproval) }) : t('settlements.kpi.none') }), _jsx(GlassKpi, { icon: _jsx(PaymentsOutlinedIcon, {}), label: t('settlements.kpi.toPay'), value: c.approved, hint: `${sar(c.approvedNet)} ${t('settlements.sar')}` }), _jsx(GlassKpi, { icon: _jsx(CheckCircleOutlineIcon, {}), label: t('settlements.kpi.paid'), value: c.paidThisMonth, hint: `${sar(c.paidThisMonthNet)} ${t('settlements.sar')}` })] })) }), _jsx(Stack, { direction: "row", role: "tablist", sx: { ...glassOnDark, display: 'inline-flex', borderRadius: 99, p: 0.5, gap: 0.5, mt: 2 }, children: ['Staff', 'Worker'].map((p) => (_jsxs(ButtonBase, { role: "tab", "aria-selected": party === p, onClick: () => {
                                setParty(p);
                                setPage(0);
                            }, sx: { px: 2, py: 0.75, borderRadius: 99, fontWeight: 700, fontSize: 12.5, color: party === p ? hr.navy : '#fff', bgcolor: party === p ? '#fff' : 'transparent' }, children: [t(`settlements.party.${p}`), " (", c ? (p === 'Staff' ? c.staff : c.workers) : '—', ")"] }, p))) })] }), _jsxs(Box, { sx: { ...glassPanel, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.25, mb: 1.5 }, children: [_jsx(TextField, { size: "small", value: typed, onChange: (e) => setTyped(e.target.value), placeholder: t('settlements.search'), sx: { flex: { md: '0 1 320px' } }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsxs(TextField, { select: true, size: "small", label: t('settlements.col.kind'), value: kind, onChange: (e) => { setKind(e.target.value); setPage(0); }, sx: { flex: { md: '0 1 200px' } }, children: [_jsx(MenuItem, { value: "", children: t('settlements.all') }), _jsx(MenuItem, { value: "Vacation", children: t('settlements.kind.Vacation') }), _jsx(MenuItem, { value: "EndOfService", children: t('settlements.kind.EndOfService') })] }), _jsx(TextField, { select: true, size: "small", label: t('settlements.col.status'), value: status, onChange: (e) => { setStatus(e.target.value); setPage(0); }, sx: { flex: { md: '0 1 200px' } }, children: statuses.map((s) => (_jsx(MenuItem, { value: s, children: s ? t(`settlements.filter.${s}`) : t('settlements.all') }, s))) })] }), error ? (_jsx(Alert, { severity: "error", action: _jsx(Button, { onClick: load, children: t('settlements.retry') }), children: t(error) })) : !data ? (_jsx(Stack, { sx: { gap: 1 }, children: Array.from({ length: 5 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 44 }, i)) })) : data.items.length === 0 ? (filtered ? (_jsx(HrEmptyState, { icon: _jsx(SearchIcon, {}), title: t('settlements.noResults'), hint: t('settlements.noResultsHint') })) : (_jsx(HrEmptyState, { icon: _jsx(ReceiptLongOutlinedIcon, {}), title: t('settlements.empty'), hint: t(party === 'Staff' ? 'settlements.emptyHint' : 'settlements.emptyWorkers') }))) : (_jsxs(_Fragment, { children: [_jsx(TableContainer, { children: _jsxs(Table, { size: "small", sx: { '& td, & th': { whiteSpace: 'nowrap' }, '& tbody tr': { cursor: 'pointer', height: 46 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('settlements.col.no') }), head('name', t('settlements.col.name')), _jsx(TableCell, { children: t('settlements.col.kind') }), _jsx(TableCell, { children: t('settlements.col.reason') }), head('date', t('settlements.col.date')), _jsx(TableCell, { children: t('settlements.col.service') }), _jsx(TableCell, { align: "center", children: t('settlements.col.additions') }), _jsx(TableCell, { align: "center", children: t('settlements.col.deductions') }), head('net', t('settlements.col.net'), 'center'), _jsx(TableCell, { children: t('settlements.col.status') })] }) }), _jsx(TableBody, { children: data.items.map((s) => (_jsxs(TableRow, { hover: true, tabIndex: 0, onClick: () => navigate(`/hr/settlements/${s.id}`), onKeyDown: (e) => {
                                                    if (e.key === 'Enter')
                                                        navigate(`/hr/settlements/${s.id}`);
                                                }, children: [_jsx(TableCell, { children: _jsx("bdi", { children: s.settlementNo }) }), _jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600 }, children: s.name }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: _jsx("bdi", { children: s.personNo }) })] }), _jsx(TableCell, { children: t(`settlements.kind.${s.kind}`) }), _jsx(TableCell, { children: s.reason ? t(`settlements.reason.${s.reason}`) : t('settlements.annualLeave') }), _jsx(TableCell, { children: date(s.leaveFrom ?? s.lastDay) }), _jsx(TableCell, { children: s.kind === 'EndOfService' ? years(s.serviceYears) : '—' }), _jsx(TableCell, { align: "center", children: _jsx(Money, { value: s.totalAdditions }) }), _jsx(TableCell, { align: "center", children: _jsx(Money, { value: s.totalDeductions }) }), _jsx(TableCell, { align: "center", children: _jsx(Money, { value: s.net, strong: true }) }), _jsx(TableCell, { children: _jsx(SettlementStatusBadge, { status: s.status }) })] }, s.id))) })] }) }), _jsx(TablePagination, { component: "div", count: data.total, page: page, onPageChange: (_, p) => setPage(p), rowsPerPage: size, onRowsPerPageChange: (e) => {
                                    setSize(Number(e.target.value));
                                    setPage(0);
                                }, rowsPerPageOptions: [10, 25, 50, 100], labelRowsPerPage: t('settlements.perPage'), labelDisplayedRows: ({ from, to, count }) => t('settlements.shown', { from, to, count }) })] }))] }), creating && _jsx(NewSettlementDialog, { party: party, onClose: () => setCreating(false), onCreated: (id) => navigate(`/hr/settlements/${id}`) })] }));
}
