import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Link, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workerFileApi } from '../../api/workerFile';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
/** The worker's invoice lines month by month, as the old employee screen's invoices tab, the latest first. */
export function WorkerInvoices({ workerId }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [rows, setRows] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        Promise.all([workerFileApi.invoiceLines(workerId), workerFileApi.legacyInvoices(workerId)])
            .then(([mine, old]) => setRows([
            ...mine.map((l) => ({
                key: `n-${l.invoiceId}-${l.from}`, invoiceId: l.invoiceId, invoiceNo: l.invoiceNo ?? t('workforce.invoices.draft'), projectName: l.projectName,
                from: l.from, to: l.to, status: t(`workforce.invoices.status.${l.status}`, { defaultValue: l.status }), workDays: l.workDays, monthlyPrice: l.monthlyPrice, amount: l.amount,
            })),
            ...old.map((l, i) => ({
                key: `o-${l.invoiceNo}-${i}`, invoiceId: null, invoiceNo: l.invoiceNo, projectName: l.projectName,
                from: l.from, to: l.to, status: ar ? l.statusAr : l.statusEn, workDays: l.workDays, monthlyPrice: l.monthlyPrice, amount: l.amount,
            })),
        ].sort((a, b) => b.to.localeCompare(a.to))))
            .catch((failure) => setError(errorKey(failure)));
    }, [workerId, t, ar]);
    const date = (value) => value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—';
    const money = (value) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (error) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    if (!rows) {
        return (_jsx(Box, { children: [0, 1, 2].map((i) => (_jsx(Skeleton, { height: 44 }, i))) }));
    }
    if (rows.length === 0) {
        return _jsx(Typography, { sx: { py: 4, textAlign: 'center', color: tokens.gray500 }, children: t('workforce.invoices.empty') });
    }
    return (_jsxs(_Fragment, { children: [_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.invoices.no') }), _jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('workforce.invoices.period') }), _jsx(TableCell, { align: "center", children: t('workforce.invoices.days') }), _jsx(TableCell, { align: "center", children: t('workforce.invoices.price') }), _jsx(TableCell, { align: "center", children: t('workforce.invoices.amount') }), _jsx(TableCell, { children: t('common.status') }), _jsx(TableCell, { children: t('workforce.periods.origin') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { sx: { fontWeight: 700 }, children: r.invoiceId ? (_jsx(Link, { component: RouterLink, to: `/billing/invoices/${r.invoiceId}`, underline: "hover", children: _jsx("bdi", { children: r.invoiceNo }) })) : (_jsx("bdi", { children: r.invoiceNo })) }), _jsx(TableCell, { children: r.projectName }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [date(r.from), " \u2013 ", date(r.to)] }), _jsx(TableCell, { align: "center", children: r.workDays.toLocaleString('en-US') }), _jsx(TableCell, { align: "center", children: money(r.monthlyPrice) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800, color: tokens.navy800 }, children: money(r.amount) }), _jsx(TableCell, { children: r.status }), _jsx(TableCell, { children: _jsx(Badge, { tone: r.invoiceId ? 'primary' : 'neutral', children: t(r.invoiceId ? 'workforce.periods.thisSystem' : 'workforce.periods.oldSystem') }) })] }, r.key))) })] }) }), _jsx(Typography, { sx: { mt: 1.5, fontSize: 12, color: tokens.gray500 }, children: t('workforce.invoices.note') })] }));
}
