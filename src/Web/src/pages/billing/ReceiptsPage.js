import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import Add from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, IconButton, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi } from '../../api/billing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from '../operations/delivery';
import { monthEnd, monthStart, receiptTone, ReceiptStatusBadge } from './receipts';
import { ReceiptDialog } from './ReceiptDialog';
import { ListHero, rowEdge, StageLine, StatusStrip, StripItem, toneHead, useCurrentStages } from '../../components/ListLayout';
import { toneColors } from '../../app/theme';
/** The month's receipt vouchers: drafts, in review, approved, and the credit not yet allocated to invoices. */
export function ReceiptsPage({ creating = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [dialog, setDialog] = useState(creating);
    const { can } = useSession();
    const { ar, date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
    const month = params.get('month') ?? monthStart(new Date());
    const [filter, setFilter] = useState('');
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const reload = useCallback(async () => {
        try {
            setData(await receivablesApi.receipts({ from: month, to: monthEnd(month), status: filter, search: query }));
            setError(null);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [month, filter, query]);
    useEffect(() => {
        void reload();
    }, [reload]);
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search.trim()), 350);
        return () => clearTimeout(timer);
    }, [search]);
    const shift = (by) => {
        const d = new Date(`${month}T00:00:00`);
        d.setMonth(d.getMonth() + by);
        setParams({ month: monthStart(d) }, { replace: true });
    };
    const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`));
    const toggle = (value) => setFilter(filter === value ? '' : value);
    const totals = data?.totals;
    const stages = useCurrentStages('billing.receipt', (data?.rows ?? []).map((x) => x.id));
    return (_jsxs(Box, { children: [_jsx(ListHero, { tone: "receipt", icon: _jsx(PaymentsOutlinedIcon, {}), title: t('receipts.title'), subtitle: t('receipts.intro'), actions: can('billing.receipts.manage', true) ? (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setDialog(true), children: t('receipts.new') })) : undefined }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }, children: [_jsx(IconButton, { onClick: () => shift(ar ? 1 : -1), sx: { bgcolor: '#fff', boxShadow: tokens.shadowXs }, children: _jsx(ChevronRightIcon, {}) }), _jsx(Box, { sx: { minWidth: 220, textAlign: 'center', px: 3, py: 1, borderRadius: 999, bgcolor: '#fff', boxShadow: tokens.shadowSm }, children: _jsx(Typography, { sx: { fontSize: 17, fontWeight: 800, color: tokens.navy800 }, children: monthName }) }), _jsx(IconButton, { onClick: () => shift(ar ? -1 : 1), sx: { bgcolor: '#fff', boxShadow: tokens.shadowXs }, children: _jsx(ChevronLeftIcon, {}) })] }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(StatusStrip, { count: 4, children: [_jsx(StripItem, { active: filter === 'Open', onClick: () => toggle('Open'), label: t('receipts.cards.drafts'), value: String(totals?.drafts ?? 0), foot: t('receipts.cards.draftsFoot'), icon: _jsx(EditNoteOutlinedIcon, {}), tone: "#6b7a90" }), _jsx(StripItem, { active: filter === 'InReview', onClick: () => toggle('InReview'), label: t('receipts.cards.inReview'), value: String(totals?.inReview ?? 0), foot: t('receipts.cards.inReviewFoot'), icon: _jsx(HourglassBottomOutlinedIcon, {}), tone: "#d9822b" }), _jsx(StripItem, { active: filter === 'Approved', onClick: () => toggle('Approved'), label: t('receipts.cards.approved'), value: sar(totals?.approvedAmount ?? 0), foot: t('receipts.cards.approvedFoot', { count: totals?.approved ?? 0 }), icon: _jsx(PaymentsOutlinedIcon, {}), tone: "#1f9d55" }), _jsx(StripItem, { active: filter === 'Unallocated', onClick: () => toggle('Unallocated'), label: t('receipts.cards.unallocated'), value: sar(totals?.unallocated ?? 0), foot: t('receipts.cards.unallocatedFoot'), icon: _jsx(AccountBalanceWalletOutlinedIcon, {}), tone: "#2b7bd9" })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsx(TextField, { size: "small", sx: { minWidth: 300, mb: 1.5 }, placeholder: t('receipts.search'), value: search, onChange: (e) => setSearch(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), !data && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { sx: toneHead('receipt'), children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('receipts.col.number') }), _jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('receipts.col.date') }), _jsx(TableCell, { children: t('receipts.col.method') }), _jsx(TableCell, { align: "center", children: t('receipts.col.amount') }), _jsx(TableCell, { align: "center", children: t('receipts.col.unallocated') }), _jsx(TableCell, { children: t('receipts.col.status') })] }) }), _jsxs(TableBody, { children: [data?.rows.map((r) => (_jsxs(TableRow, { hover: true, sx: [{ cursor: 'pointer' }, rowEdge(toneColors[receiptTone[r.status]].fg)], onClick: () => navigate(`/billing/receipts/${r.id}`), children: [_jsx(TableCell, { dir: "ltr", sx: { fontWeight: 800, color: r.receiptNo ? tokens.navy800 : tokens.gray500, textAlign: 'start', whiteSpace: 'nowrap' }, children: r.receiptNo ?? t('receipts.noNumber') }), _jsxs(TableCell, { sx: { minWidth: 220 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: r.projectName }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: r.customerName ?? '—' })] }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(r.receiptDate) }), _jsxs(TableCell, { children: [t(`receipts.method.${r.method}`), r.bankAccountName && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: r.bankAccountName })] }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800, color: tokens.navy800 }, children: sar(r.amount) }), _jsx(TableCell, { align: "center", sx: { color: r.amount - r.allocated > 0 ? '#2b7bd9' : tokens.gray500 }, children: r.amount - r.allocated > 0 ? sar(r.amount - r.allocated) : '—' }), _jsxs(TableCell, { children: [_jsx(ReceiptStatusBadge, { status: r.status }), _jsx(StageLine, { stage: stages[r.id] })] })] }, r.id))), data && data.rows.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('receipts.empty') }) }))] })] }) })] }), dialog && _jsx(ReceiptDialog, { onClose: () => (creating ? navigate('/billing/receipts') : setDialog(false)), onSaved: (saved) => navigate(`/billing/receipts/${saved}`) })] }));
}
