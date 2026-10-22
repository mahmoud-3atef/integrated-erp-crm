import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { billingApi } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
import { sar } from '../operations/delivery';
/** The old system's invoice number on a timesheet made from it, with its status there. */
export function LegacyBadge({ number, status }) {
    const { t } = useTranslation();
    return (_jsxs(Badge, { tone: "info", children: [t('timesheets.legacy.badge'), " \u00B7 ", _jsx("bdi", { children: number }), status ? ` · ${t(`timesheets.legacy.status.${status}`, { defaultValue: String(status) })}` : ''] }));
}
/**
 * «نقل فواتير النظام القديم»: the old system's invoices from June 2026 as draft timesheets, then what was done — the
 * drafts, the invoices left out and why, and the lines balanced to the old amounts.
 */
export function LegacyImportDialog({ onClose, onDone }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [report, setReport] = useState(null);
    const run = async () => {
        setBusy(true);
        setError(null);
        try {
            setReport(await billingApi.importLegacy());
            onDone();
        }
        catch (e) {
            setError(errorKey(e));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "md", "aria-labelledby": "legacy-title", children: [_jsx(DialogTitle, { id: "legacy-title", sx: { fontWeight: 800, color: tokens.navy800 }, children: t('timesheets.legacy.title') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), !report ? (_jsxs(Stack, { sx: { gap: 1.5 }, children: [_jsx(Typography, { sx: { fontSize: 14, lineHeight: 1.8 }, children: t('timesheets.legacy.intro') }), _jsx(Alert, { severity: "info", children: t('timesheets.legacy.rules') })] })) : (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(Box, { sx: { display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' } }, children: [
                                    [t('timesheets.legacy.imported'), String(report.imported)],
                                    [t('timesheets.legacy.lines'), String(report.lines)],
                                    [t('timesheets.legacy.workers'), String(report.workers)],
                                    [t('timesheets.legacy.amount'), sar(report.invoiceAmount)],
                                ].map(([label, value]) => (_jsxs(Box, { sx: { p: 1.25, borderRadius: '12px', bgcolor: tokens.navy50 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray600 }, children: label }), _jsx(Typography, { sx: { fontSize: 20, fontWeight: 800, color: tokens.navy800 }, children: value })] }, label))) }), report.missingWorkers > 0 && _jsx(Alert, { severity: "warning", children: t('timesheets.legacy.missingWorkers', { count: report.missingWorkers }) }), report.balanced.length > 0 && (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 800, color: tokens.navy800, mb: 0.5 }, children: t('timesheets.legacy.balanced', { count: report.balanced.length }) }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600, mb: 1 }, children: t('timesheets.legacy.balancedHint') }), _jsx(Box, { sx: { maxHeight: 240, overflowY: 'auto' }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('timesheets.legacy.col.invoice') }), _jsx(TableCell, { children: t('timesheets.legacy.col.timesheet') }), _jsx(TableCell, { children: t('timesheets.legacy.col.project') }), _jsx(TableCell, { align: "center", children: t('timesheets.legacy.col.lines') }), _jsx(TableCell, { align: "right", children: t('timesheets.legacy.col.invoiceDiff') }), _jsx(TableCell, { align: "right", children: t('timesheets.legacy.col.payDiff') })] }) }), _jsx(TableBody, { children: report.balanced.map((b) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx("bdi", { children: b.invoiceNo }) }), _jsx(TableCell, { children: _jsx("bdi", { children: b.timesheetNo }) }), _jsx(TableCell, { children: b.project }), _jsx(TableCell, { align: "center", children: b.lines }), _jsx(TableCell, { align: "right", children: _jsx("bdi", { children: sar(b.invoiceDifference) }) }), _jsx(TableCell, { align: "right", children: _jsx("bdi", { children: sar(b.payDifference) }) })] }, b.invoiceNo))) })] }) })] })), report.skipped.length > 0 && (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 800, color: tokens.navy800, mb: 1 }, children: t('timesheets.legacy.skipped', { count: report.skipped.length }) }), _jsx(Box, { sx: { maxHeight: 220, overflowY: 'auto' }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('timesheets.legacy.col.invoice') }), _jsx(TableCell, { children: t('timesheets.legacy.col.project') }), _jsx(TableCell, { children: t('timesheets.legacy.col.month') }), _jsx(TableCell, { children: t('timesheets.legacy.col.reason') })] }) }), _jsx(TableBody, { children: report.skipped.map((s) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx("bdi", { children: s.invoiceNo }) }), _jsx(TableCell, { children: s.project }), _jsx(TableCell, { children: _jsx("bdi", { children: s.month.slice(0, 7) }) }), _jsx(TableCell, { children: t(`timesheets.legacy.reasons.${s.reason}`) })] }, s.invoiceNo + s.month))) })] }) })] }))] }))] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, disabled: busy, children: report ? t('common.close') : t('common.cancel') }), !report && (_jsx(Button, { variant: "contained", disabled: busy, onClick: () => void run(), children: busy ? t('timesheets.legacy.running') : t('timesheets.legacy.run') }))] })] }));
}
