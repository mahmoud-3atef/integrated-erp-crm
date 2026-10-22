import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../../api/auth';
import { payslipEmailApi } from '../../../api/payslips';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrScope, HrStatusBadge, hr } from '../../../components/hr/Hr';
const look = {
    Sent: { color: '#047857', tint: '#D1FAE5' },
    Pending: { color: '#1D4ED8', tint: '#DBEAFE' },
    Failed: { color: '#B91C1C', tint: '#FEE2E2' },
};
/**
 * Emailing an approved staff run's payslips (4.12b): who will get it (the grid's filter), who has no address in
 * their file, sending once (or again on purpose), and how each email went.
 */
export function PayslipEmailDialog({ runId, scope: given, onClose }) {
    const { t } = useTranslation();
    // The grid's filter as values (the object itself is new on each render of the page).
    const { search, department, note } = given;
    const scope = useMemo(() => ({ search, department, note }), [search, department, note]);
    const [preview, setPreview] = useState(null);
    const [rows, setRows] = useState(null);
    const [resend, setResend] = useState(false);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const load = useCallback(() => {
        setError(null);
        Promise.all([payslipEmailApi.preview(runId, scope), payslipEmailApi.status(runId)])
            .then(([p, s]) => (setPreview(p), setRows(s)))
            .catch((f) => setError(errorKey(f)));
    }, [runId, scope]);
    useEffect(load, [load]);
    const send = async () => {
        setBusy(true);
        setError(null);
        try {
            setResult(await payslipEmailApi.send(runId, scope, resend));
            setResend(false);
            load();
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    const toSend = preview ? (resend ? preview.withEmail : preview.withEmail - preview.alreadySent) : 0;
    const counts = rows ? { Sent: rows.filter((r) => r.status === 'Sent').length, Pending: rows.filter((r) => r.status === 'Pending').length, Failed: rows.filter((r) => r.status === 'Failed').length } : null;
    const line = (ok, text) => (_jsxs(Stack, { direction: "row", sx: { gap: 0.75, alignItems: 'center' }, children: [ok ? _jsx(CheckCircleOutlineIcon, { sx: { fontSize: 17, color: hr.success } }) : _jsx(WarningAmberOutlinedIcon, { sx: { fontSize: 17, color: hr.warning } }), _jsx(Typography, { sx: { fontSize: 13 }, children: text })] }, text));
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "md", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('payslip.email.title') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [!preview ? (error ? null : _jsx(LinearProgress, {})) : (_jsxs(_Fragment, { children: [!preview.configured && _jsx(Alert, { severity: "warning", children: t('payslip.email.notConfigured') }), _jsxs(Box, { sx: { bgcolor: '#F8FAFC', border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.5, display: 'grid', gap: 0.6 }, children: [preview.configured && line(true, t('payslip.email.from', { from: preview.fromAddress })), line(preview.withEmail > 0, t('payslip.email.withEmail', { count: preview.withEmail, total: preview.total })), preview.withoutEmailCount > 0 && line(false, t('payslip.email.withoutEmail', { count: preview.withoutEmailCount })), preview.alreadySent > 0 && line(true, t('payslip.email.alreadySent', { count: preview.alreadySent }))] }), preview.withoutEmail.length > 0 && (_jsxs(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: [t('payslip.email.withoutList'), ' ', preview.withoutEmail.map((r, i) => (_jsxs("span", { children: [i > 0 && '، ', r.name, " (", _jsx("bdi", { children: r.employeeNo }), ")"] }, r.employeeNo))), preview.withoutEmailCount > preview.withoutEmail.length && ` ${t('payslip.email.andMore', { count: preview.withoutEmailCount - preview.withoutEmail.length })}`] })), preview.alreadySent > 0 && (_jsx(FormControlLabel, { control: _jsx(Checkbox, { size: "small", checked: resend, onChange: (e) => setResend(e.target.checked) }), label: _jsx(Typography, { sx: { fontSize: 13 }, children: t('payslip.email.resend', { count: preview.alreadySent }) }) })), _jsx(Alert, { severity: "info", sx: { py: 0 }, children: t('payslip.email.hint') })] })), result && (_jsx(Alert, { severity: "success", sx: { py: 0 }, children: t('payslip.email.queued', { count: result.queued }) })), _jsx(ErrorMessage, { messageKey: error }), rows && rows.length > 0 && (_jsxs(Box, { children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 0.75 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 14 }, children: t('payslip.email.log') }), counts && (_jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t('payslip.email.counts', counts) })), _jsx(Box, { sx: { flex: 1 } }), _jsx(IconButton, { size: "small", "aria-label": t('payslip.email.refresh'), onClick: load, children: _jsx(RefreshIcon, { fontSize: "small" }) })] }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 300 }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: { '& td': { fontSize: 12.5 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('payslip.email.cols.employee') }), _jsx(TableCell, { children: t('payslip.email.cols.email') }), _jsx(TableCell, { children: t('payslip.email.cols.status') }), _jsx(TableCell, { children: t('payslip.email.cols.by') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [r.name, " ", _jsxs(Typography, { component: "span", sx: { fontSize: 11, color: hr.textMuted }, children: ["(", _jsx("bdi", { children: r.employeeNo }), ")"] })] }), _jsx(TableCell, { children: _jsx("bdi", { children: r.email }) }), _jsxs(TableCell, { children: [_jsx(HrStatusBadge, { label: t(`payslip.email.status.${r.status}`), ...look[r.status] }), r.error && _jsx(Typography, { sx: { fontSize: 11, color: hr.danger }, children: r.error })] }), _jsxs(TableCell, { sx: { color: hr.textMuted }, children: [r.queuedByName, " \u00B7 ", _jsx("bdi", { children: r.queuedAt.slice(0, 16).replace('T', ' ') })] })] }, r.employeeId))) })] }) })] }))] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !preview || !preview.configured || !preview.approved || toSend <= 0, onClick: () => void send(), children: t('payslip.email.send', { count: Math.max(0, toSend) }) }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.close') })] })] }) }));
}
