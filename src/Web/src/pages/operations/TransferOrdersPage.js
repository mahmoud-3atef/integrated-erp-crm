import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AddIcon from '@mui/icons-material/Add';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { Box, Button, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography, } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { transfersApi } from '../../api/operations';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, Initials } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from './delivery';
import { TransferStatusBadge, transferTone } from './transfers';
import { TransferOrderWizard } from './TransferOrderWizard';
import { ListHero, rowEdge, StageLine, StatusStrip, StripItem, toneHead, useCurrentStages } from '../../components/ListLayout';
import { toneColors } from '../../app/theme';
/** Transfer orders between projects: search, cards that filter, and the orders. */
export function TransferOrdersPage({ creating = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [wizard, setWizard] = useState(creating);
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
    const status = params.get('status') ?? '';
    const search = params.get('q') ?? '';
    const page = Number(params.get('page') ?? '1');
    const [text, setText] = useState(search);
    const [sort, setSort] = useState('created');
    const [desc, setDesc] = useState(true);
    const [pageSize, setPageSize] = useState(50);
    const [data, setData] = useState(null);
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
        transfersApi
            .list({ search, status, sort, desc, page, pageSize })
            .then((value) => !cancelled && (setData(value), setError(null)))
            .catch((failure) => !cancelled && setError(errorKey(failure)))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [search, status, sort, desc, page, pageSize]);
    const sortBy = (key) => (sort === key ? setDesc((d) => !d) : (setSort(key), setDesc(true)));
    const head = (key, label) => (_jsx(TableSortLabel, { active: sort === key, direction: desc ? 'desc' : 'asc', onClick: () => sortBy(key), sx: { color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'inherit !important' } }, children: label }));
    const card = (key, label, value, foot, icon, tone) => (_jsx(StripItem, { label: label, value: (value ?? 0).toLocaleString('en-US'), foot: status === key ? `✓ ${t('workforce.currentFilter')}` : foot, icon: icon, tone: tone, active: status === key, onClick: () => update({ status: status === key ? null : key || null }) }));
    const stages = useCurrentStages('operations.transfer_order', (data?.items ?? []).map((x) => x.id));
    return (_jsxs(Box, { children: [_jsx(ListHero, { tone: "transfer", icon: _jsx(SwapHorizIcon, {}), title: t('operations.transfer.title'), subtitle: t('operations.transfer.intro'), actions: can('operations.transfer.create', true) ? (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setWizard(true), children: t('operations.transfer.new') })) : undefined }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(StatusStrip, { count: 5, children: [card('', t('operations.transfer.cards.all'), data?.totals.all, t('operations.transfer.cards.allFoot'), _jsx(DescriptionOutlinedIcon, {}), tokens.navy700), card('preparing', t('operations.delivery.cards.preparing'), data?.totals.underPreparation, t('operations.delivery.cards.preparingFoot'), _jsx(EditNoteOutlinedIcon, {}), '#6b7a90'), card('operations', t('operations.delivery.cards.operations'), data?.totals.withOperations, t('operations.delivery.cards.operationsFoot'), _jsx(HourglassBottomOutlinedIcon, {}), '#d9822b'), card('transferred', t('operations.transfer.cards.transferred'), data?.totals.transferred, t('operations.transfer.cards.transferredFoot'), _jsx(TaskAltOutlinedIcon, {}), '#1f9d55'), card('closed', t('operations.transfer.cards.closed'), data?.totals.closed, t('operations.transfer.cards.closedFoot'), _jsx(AssignmentTurnedInOutlinedIcon, {}), '#c0392b')] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 560 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t('operations.transfer.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || status) && _jsx(Button, { onClick: () => (setText(''), setParams(new URLSearchParams(), { replace: true })), children: t('workforce.reset') })] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t('operations.delivery.count', { count: data?.total ?? 0 }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { sx: toneHead('transfer'), children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: head('orderNo', t('operations.transfer.col.order')) }), _jsx(TableCell, { children: t('operations.transfer.col.from') }), _jsx(TableCell, { children: head('transferOn', t('operations.transfer.col.transferOn')) }), _jsx(TableCell, { align: "center", children: head('workers', t('operations.delivery.col.workers')) }), _jsx(TableCell, { align: "center", children: t('operations.delivery.monthlyTotal') }), _jsx(TableCell, { children: t('operations.delivery.col.status') }), _jsx(TableCell, { children: t('operations.delivery.createdBy') })] }) }), _jsxs(TableBody, { children: [data?.items.map((o) => (_jsxs(TableRow, { hover: true, sx: [{ cursor: 'pointer' }, rowEdge(toneColors[transferTone[o.status]].fg)], onClick: () => navigate(`/operations/transfer-orders/${o.id}`), children: [_jsx(TableCell, { sx: { minWidth: 240 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Initials, { name: o.projectName, size: 30 }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: o.projectName }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: o.orderNo })] })] }) }), _jsx(TableCell, { sx: { fontSize: 13, maxWidth: 260 }, children: o.fromProjects ?? '—' }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(o.transferOn) }), _jsx(TableCell, { align: "center", children: _jsx(Badge, { tone: "info", children: o.workers }) }), _jsx(TableCell, { align: "center", children: sar(o.totalPrice) }), _jsxs(TableCell, { children: [_jsx(TransferStatusBadge, { status: o.status }), _jsx(StageLine, { stage: stages[o.id] })] }), _jsx(TableCell, { children: o.createdByName })] }, o.id))), data && data.items.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('operations.transfer.empty') }) }))] })] }) }), _jsx(TablePagination, { component: "div", count: data?.total ?? 0, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] }), wizard && (_jsx(TransferOrderWizard, { onClose: () => (creating ? navigate('/operations/transfer-orders') : setWizard(false)), onSaved: (saved, failed) => navigate(`/operations/transfer-orders/${saved}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`) }))] }));
}
