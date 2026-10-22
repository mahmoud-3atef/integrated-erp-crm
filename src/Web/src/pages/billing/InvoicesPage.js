import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Box, IconButton, InputAdornment, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { invoiceApi } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { PillTabs } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from '../operations/delivery';
import { InvoiceKindBadge, InvoiceStatusBadge, invoiceTone, signed } from './invoices';
import { ListHero, rowEdge, StageLine, StatusStrip, StripItem, toneHead, useCurrentStages } from '../../components/ListLayout';
import { toneColors } from '../../app/theme';
const monthIso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
/** The month's customer invoices and notes (the month the billing cycle ends in), with their review and issue. */
export function InvoicesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { ar, date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
    const month = params.get('month') ?? monthIso(new Date());
    const status = (params.get('status') ?? '');
    const kind = params.get('kind') ?? '';
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const set = (key, value) => {
        const next = new URLSearchParams(params);
        if (value)
            next.set(key, value);
        else
            next.delete(key);
        setParams(next, { replace: true });
    };
    const reload = useCallback(async () => {
        try {
            setData(await invoiceApi.list({ month, status, kind, search: query }));
            setError(null);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [month, status, kind, query]);
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
        set('month', monthIso(d));
    };
    const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00:00`));
    const totals = data?.totals;
    const stages = useCurrentStages('billing.invoice', (data?.rows ?? []).map((x) => x.id));
    return (_jsxs(Box, { children: [_jsx(ListHero, { tone: "invoice", icon: _jsx(ReceiptLongOutlinedIcon, {}), title: t('invoices.title'), subtitle: t('invoices.intro') }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }, children: [_jsx(IconButton, { onClick: () => shift(ar ? 1 : -1), sx: { bgcolor: '#fff', boxShadow: tokens.shadowXs }, children: _jsx(ChevronRightIcon, {}) }), _jsx(Box, { sx: { minWidth: 220, textAlign: 'center', px: 3, py: 1, borderRadius: 999, bgcolor: '#fff', boxShadow: tokens.shadowSm }, children: _jsx(Typography, { sx: { fontSize: 17, fontWeight: 800, color: tokens.navy800 }, children: monthName }) }), _jsx(IconButton, { onClick: () => shift(ar ? -1 : 1), sx: { bgcolor: '#fff', boxShadow: tokens.shadowXs }, children: _jsx(ChevronLeftIcon, {}) })] }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(StatusStrip, { count: 5, children: [_jsx(StripItem, { label: t('invoices.cards.drafts'), value: String(totals?.drafts ?? 0), foot: t('invoices.cards.draftsFoot'), icon: _jsx(EditNoteOutlinedIcon, {}), tone: "#6b7a90" }), _jsx(StripItem, { label: t('invoices.cards.inReview'), value: String(totals?.inReview ?? 0), foot: t('invoices.cards.inReviewFoot'), icon: _jsx(HourglassBottomOutlinedIcon, {}), tone: "#d9822b" }), _jsx(StripItem, { label: t('invoices.cards.issued'), value: sar(totals?.issuedTotal ?? 0), foot: t('invoices.cards.issuedFoot', { count: totals?.issued ?? 0 }), icon: _jsx(ReceiptLongOutlinedIcon, {}), tone: "#1f9d55" }), _jsx(StripItem, { label: t('invoices.cards.credits'), value: sar(totals?.credits ?? 0), foot: t('invoices.cards.creditsFoot'), icon: _jsx(RemoveCircleOutlineIcon, {}), tone: tokens.danger }), _jsx(StripItem, { label: t('invoices.cards.debits'), value: sar(totals?.debits ?? 0), foot: t('invoices.cards.debitsFoot'), icon: _jsx(AddCircleOutlineIcon, {}), tone: "#2b7bd9" })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsx(Box, { sx: { flex: 1 }, children: _jsx(PillTabs, { value: status, onChange: (v) => set('status', v), options: [
                                        { value: '', label: t('invoices.filter.all') },
                                        { value: 'Open', label: t('invoices.filter.open') },
                                        { value: 'InReview', label: t('invoices.filter.inReview') },
                                        { value: 'Issued', label: t('invoices.filter.issued') },
                                    ] }) }), _jsxs(TextField, { select: true, size: "small", sx: { minWidth: 170 }, label: t('invoices.col.kind'), value: kind, onChange: (e) => set('kind', e.target.value), children: [_jsx(MenuItem, { value: "", children: t('invoices.filter.allKinds') }), ['Invoice', 'CreditNote', 'DebitNote'].map((k) => (_jsx(MenuItem, { value: k, children: t(`invoices.kind.${k}`) }, k)))] }), _jsx(TextField, { size: "small", sx: { minWidth: 260 }, placeholder: t('invoices.search'), value: search, onChange: (e) => setSearch(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } })] }), !data && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { sx: toneHead('invoice'), children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('invoices.col.number') }), _jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('invoices.col.date') }), _jsx(TableCell, { children: t('invoices.col.due') }), _jsx(TableCell, { align: "center", children: t('invoices.col.amount') }), _jsx(TableCell, { align: "center", children: t('invoices.col.total') }), _jsx(TableCell, { children: t('invoices.col.status') })] }) }), _jsxs(TableBody, { children: [data?.rows.map((r) => (_jsxs(TableRow, { hover: true, sx: [{ cursor: 'pointer' }, rowEdge(toneColors[invoiceTone[r.status]].fg)], onClick: () => navigate(`/billing/invoices/${r.id}`), children: [_jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: _jsxs(Stack, { spacing: 0.4, sx: { alignItems: 'flex-start' }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 800, color: r.invoiceNo ? tokens.navy800 : tokens.gray500 }, children: r.invoiceNo ?? t('invoices.noNumber') }), _jsx(InvoiceKindBadge, { kind: r.kind })] }) }), _jsxs(TableCell, { sx: { minWidth: 240 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: r.projectName }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [r.customerName, r.originalInvoiceNo && ` · ${t('invoices.onInvoice', { number: r.originalInvoiceNo })}`, r.timesheetNo && ` · ${r.timesheetNo}`] })] }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(r.invoiceDate) }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(r.dueDate) }), _jsx(TableCell, { align: "center", children: sar(signed(r.kind, r.amount)) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800, color: r.kind === 'CreditNote' ? tokens.danger : tokens.navy800 }, children: sar(signed(r.kind, r.total)) }), _jsxs(TableCell, { children: [_jsx(InvoiceStatusBadge, { status: r.status }), _jsx(StageLine, { stage: stages[r.id] })] })] }, r.id))), data && data.rows.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('invoices.empty') }) }))] })] }) })] })] }));
}
