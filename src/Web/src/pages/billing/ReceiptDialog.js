import { createElement as _createElement } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import { Alert, Autocomplete, Box, Button, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { paymentMethods, receivablesApi } from '../../api/billing';
import { tokens } from '../../app/theme';
import { recordTones } from '../../components/RecordLayout';
import { WizardCard, WizardDialog } from '../../components/WizardDialog';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday, sar } from '../operations/delivery';
import { DateField } from '../../components/DateField';
const key = (kind, id) => `${kind}:${id}`;
/** The receipt as it fills in: a small emerald card with the payment, and how much of it goes to invoices. */
function ReceiptPreview({ amount, method, account, payer, receiptDate, allocated }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const share = amount > 0 ? Math.min(100, Math.round((allocated / amount) * 100)) : 0;
    return (_jsxs(Stack, { spacing: 1.5, children: [_jsxs(Box, { sx: {
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '20px',
                    p: 2.25,
                    color: '#fff',
                    minHeight: 180,
                    display: 'flex',
                    flexDirection: 'column',
                    background: recordTones.receipt.band,
                    boxShadow: '0 14px 30px rgba(6,90,82,.28)',
                    '&::before': { content: '""', position: 'absolute', width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.07)', top: -100, insetInlineEnd: -70 },
                }, children: [_jsxs(Stack, { direction: "row", sx: { position: 'relative', alignItems: 'center', gap: 0.75, fontSize: 12.5, opacity: 0.92, '& svg': { fontSize: 17 } }, children: [method === 'Cash' ? _jsx(PaymentsOutlinedIcon, {}) : _jsx(AccountBalanceOutlinedIcon, {}), t(`receipts.method.${method}`)] }), account && _jsx(Typography, { sx: { position: 'relative', fontSize: 12.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: account }), _jsxs(Box, { sx: { position: 'relative', mt: 2 }, children: [_jsx(Typography, { sx: { fontSize: 11.5, opacity: 0.8 }, children: t('receipts.received') }), _jsxs(Typography, { sx: { fontSize: 27, fontWeight: 800, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }, children: [amount > 0 ? sar(amount) : '—', _jsx(Box, { component: "span", sx: { fontSize: 13, opacity: 0.85, marginInlineStart: 0.75 }, children: t('operations.delivery.sarUnit') })] })] }), _jsx(Box, { sx: { flex: 1 } }), _jsxs(Stack, { direction: "row", sx: { position: 'relative', justifyContent: 'space-between', gap: 1.5, mt: 1.5 }, children: [_jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 11, opacity: 0.75 }, children: t('receipts.from') }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: payer ?? '—' })] }), _jsxs(Box, { sx: { flex: '0 0 auto', textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 11, opacity: 0.75 }, children: t('receipts.col.date') }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 800 }, children: receiptDate ? date(receiptDate) : '—' })] })] })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, border: `1px solid ${tokens.gray100}`, p: 1.75 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', fontSize: 12.5, mb: 0.75 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('receipts.allocatedShare') }), _jsxs(Typography, { sx: { fontSize: 13, fontWeight: 800, color: recordTones.receipt.main }, children: [share, "%"] })] }), _jsx(Box, { sx: { height: 8, borderRadius: 99, bgcolor: tokens.gray100, overflow: 'hidden' }, children: _jsx(Box, { sx: { height: '100%', width: `${share}%`, borderRadius: 99, bgcolor: recordTones.receipt.main, transition: 'width .3s ease' } }) }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', mt: 1, fontSize: 12 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray600 }, children: t('receipts.allocatedOf', { amount: sar(allocated) }) }), _jsx(Typography, { sx: { fontSize: 12, fontWeight: 700, color: amount - allocated > 0 ? '#b8770a' : tokens.gray500 }, children: t('receipts.leftCredit', { amount: sar(Math.max(0, amount - allocated)) }) })] })] })] }));
}
/**
 * A new or returned receipt in one screen (it needs no steps): the payment, then how it pays the project's open
 * invoices, beside a live card of the receipt. Saved as a draft; sending it for approval is on the receipt's page.
 */
export function ReceiptDialog({ id, onClose, onSaved, preset, }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const [projects, setProjects] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [projectId, setProjectId] = useState(preset?.projectId ?? null);
    const [receiptDate, setReceiptDate] = useState(isoToday());
    const [amount, setAmount] = useState(preset ? String(preset.amount) : '');
    const [method, setMethod] = useState('BankTransfer');
    const [accountId, setAccountId] = useState('');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [receiptNo, setReceiptNo] = useState(null);
    const [open, setOpen] = useState(null);
    const [allocations, setAllocations] = useState(preset ? { [key(preset.kind, preset.targetId)]: String(preset.amount) } : {});
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        receivablesApi.projects().then(setProjects).catch((failure) => setError(errorKey(failure)));
        receivablesApi.bankAccounts().then((list) => setAccounts(list.filter((a) => a.isActive))).catch((failure) => setError(errorKey(failure)));
        if (id) {
            receivablesApi
                .receipt(id)
                .then((r) => {
                setReceiptNo(r.receiptNo);
                setProjectId(r.projectId);
                setReceiptDate(r.receiptDate);
                setAmount(String(r.amount));
                setMethod(r.method);
                setAccountId(r.bankAccountId ?? '');
                setReference(r.reference ?? '');
                setNotes(r.notes ?? '');
                setAllocations(Object.fromEntries(r.allocations.map((a) => [key(a.kind, a.targetId), String(a.amount)])));
            })
                .catch((failure) => setError(errorKey(failure)));
        }
    }, [id]);
    useEffect(() => {
        if (!projectId) {
            setOpen(null);
            return;
        }
        setLoading(true);
        receivablesApi
            .open(projectId, id)
            .then(setOpen)
            .catch((failure) => setError(errorKey(failure)))
            .finally(() => setLoading(false));
    }, [projectId, id]);
    const project = projects.find((p) => p.id === projectId) ?? null;
    const account = accounts.find((a) => a.id === accountId) ?? null;
    const total = Number(amount) || 0;
    const allocated = useMemo(() => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0), [allocations]);
    const items = open?.items ?? [];
    const overItem = items.some((i) => (Number(allocations[key(i.kind, i.id)]) || 0) > i.available + 0.001);
    const valid = !!projectId && total > 0 && !!receiptDate && (method === 'Cash' || !!accountId) && allocated <= total + 0.001 && !overItem;
    // Oldest due first, until the amount runs out.
    const autoAllocate = () => {
        let left = total;
        const next = {};
        for (const i of [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
            if (left <= 0)
                break;
            const take = Math.min(left, i.available);
            if (take > 0) {
                next[key(i.kind, i.id)] = String(Math.round(take * 100) / 100);
                left = Math.round((left - take) * 100) / 100;
            }
        }
        setAllocations(next);
    };
    const save = async () => {
        setBusy(true);
        setError(null);
        const input = {
            projectId: projectId,
            receiptDate,
            amount: total,
            method,
            bankAccountId: accountId || null,
            reference: reference.trim() || null,
            notes: notes.trim() || null,
            allocations: items
                .map((i) => ({ kind: i.kind, targetId: i.id, amount: Number(allocations[key(i.kind, i.id)]) || 0 }))
                .filter((a) => a.amount > 0),
        };
        try {
            if (id) {
                await receivablesApi.update(id, input);
                onSaved(id);
            }
            else {
                onSaved((await receivablesApi.create(input)).id);
            }
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    return (_jsxs(WizardDialog, { tone: "receipt", icon: _jsx(PaymentsOutlinedIcon, {}), title: id ? `${t('receipts.editTitle')}${receiptNo ? ` ${receiptNo}` : ''}` : t('receipts.new'), subtitle: project ? `${project.name}${project.customerName ? ` · ${project.customerName}` : ''}` : t('receipts.dialogHint'), steps: [{ key: 'receipt', label: t('receipts.voucher') }], step: 0, onStep: () => undefined, canNext: valid, onClose: onClose, onFinish: () => void save(), finishLabel: t('receipts.save'), busy: busy, error: error, aside: _jsx(ReceiptPreview, { amount: total, method: method, account: method === 'Cash' ? null : (account?.display ?? null), payer: project?.customerName ?? project?.name ?? null, receiptDate: receiptDate, allocated: allocated }), children: [_jsx(WizardCard, { title: t('receipts.sections.payment'), icon: _jsx(PaymentsOutlinedIcon, {}), children: _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 2 }, children: [_jsx(Autocomplete, { options: projects, value: project, disabled: !!id, onChange: (_, v) => {
                                setProjectId(v?.id ?? null);
                                setAllocations({});
                            }, getOptionLabel: (p) => `${p.name} (${p.code})`, renderOption: (props, p) => (_createElement("li", { ...props, key: p.id },
                                _jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 700 }, children: p.name }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: p.customerName ?? p.code })] }),
                                p.outstanding > 0 && _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: tokens.danger }, children: sar(p.outstanding) }))), isOptionEqualToValue: (a, b) => a.id === b.id, renderInput: (params) => _jsx(TextField, { ...params, label: t('commercial.col.project'), required: true, autoFocus: !id }) }), _jsx(DateField, { label: t('receipts.col.date'), value: receiptDate, onChange: (e) => setReceiptDate(e.target.value), required: true, slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { label: t('receipts.col.amount'), value: amount, onChange: (e) => setAmount(e.target.value.replace(/[^\d.]/g, '')), required: true, slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal', style: { fontWeight: 800, fontSize: 17 } } } }), _jsx(TextField, { select: true, label: t('receipts.col.method'), value: method, onChange: (e) => setMethod(e.target.value), children: paymentMethods.map((m) => (_jsx(MenuItem, { value: m, children: t(`receipts.method.${m}`) }, m))) }), _jsxs(TextField, { select: true, label: t('receipts.bankAccount'), value: accountId, onChange: (e) => setAccountId(e.target.value), required: method !== 'Cash', helperText: accounts.length === 0 ? t('receipts.noAccounts') : undefined, children: [_jsx(MenuItem, { value: "", children: "\u2014" }), accounts.map((a) => (_jsx(MenuItem, { value: a.id, children: a.display }, a.id)))] }), _jsx(TextField, { label: t('receipts.reference'), value: reference, onChange: (e) => setReference(e.target.value), slotProps: { htmlInput: { maxLength: 100, dir: 'ltr' } } }), _jsx(TextField, { sx: { gridColumn: '1 / -1' }, label: t('receipts.notes'), value: notes, onChange: (e) => setNotes(e.target.value), slotProps: { htmlInput: { maxLength: 1000 } } })] }) }), _jsxs(WizardCard, { title: t('receipts.sections.allocation'), icon: _jsx(SwapVertOutlinedIcon, {}), action: _jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(AutoFixHighOutlinedIcon, {}), disabled: !open || total <= 0 || items.length === 0, onClick: autoAllocate, sx: { color: recordTones.receipt.main, borderColor: recordTones.receipt.main }, children: t('receipts.autoAllocate') }), children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, mt: -1, mb: 1.5 }, children: t('receipts.allocationHint') }), loading && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), !projectId && _jsx(Typography, { sx: { py: 3, textAlign: 'center', color: tokens.gray500 }, children: t('receipts.chooseProject') }), open && items.length === 0 && _jsx(Typography, { sx: { py: 3, textAlign: 'center', color: tokens.gray500 }, children: t('receipts.nothingOpen') }), open && items.length > 0 && (_jsx(TableContainer, { sx: { border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px` }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { sx: {
                                        '& .MuiTableRow-root': { background: recordTones.receipt.dark },
                                        '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: 'transparent', color: '#fff', borderBottom: 0, borderRadius: 0 },
                                    }, children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('receipts.col.item') }), _jsx(TableCell, { children: t('receipts.col.due') }), _jsx(TableCell, { align: "center", children: t('receipts.col.total') }), _jsx(TableCell, { align: "center", children: t('receipts.col.outstanding') }), _jsx(TableCell, { align: "center", sx: { width: 170 }, children: t('receipts.col.allocate') })] }) }), _jsx(TableBody, { children: items.map((i) => {
                                        const k = key(i.kind, i.id);
                                        const over = (Number(allocations[k]) || 0) > i.available + 0.001;
                                        return (_jsxs(TableRow, { hover: true, children: [_jsxs(TableCell, { children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: i.number }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t(`receipts.kind.${i.kind}`) })] }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [date(i.dueDate), i.daysOverdue > 0 && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.danger }, children: t('receipts.overdue', { days: i.daysOverdue }) })] }), _jsx(TableCell, { align: "center", children: sar(i.total - i.credited) }), _jsxs(TableCell, { align: "center", sx: { fontWeight: 700 }, children: [sar(i.available), i.available < i.outstanding && _jsx(Typography, { sx: { fontSize: 11, color: tokens.warning }, children: t('receipts.reserved', { amount: sar(i.outstanding - i.available) }) })] }), _jsx(TableCell, { align: "center", children: _jsx(TextField, { size: "small", value: allocations[k] ?? '', error: over, onChange: (e) => setAllocations({ ...allocations, [k]: e.target.value.replace(/[^\d.]/g, '') }), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal', style: { textAlign: 'center' } } } }) })] }, k));
                                    }) })] }) })), allocated > total + 0.001 && (_jsx(Alert, { severity: "error", sx: { mt: 1.5 }, children: t('errors.validation_receipt_over_amount') })), overItem && (_jsx(Alert, { severity: "error", sx: { mt: 1.5 }, children: t('errors.validation_receipt_over_item') }))] })] }));
}
