import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { settlementsApi } from '../../api/settlements';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useLineDetail } from './SettlementPage';
import { sar, useYears } from './settlementParts';
/** The settlement to print and sign (A4): the facts, the dues and deductions, the net, and the employee's acknowledgment. */
export function SettlementPrintPage() {
    const { id = '' } = useParams();
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { date } = useCommercialFormat();
    const years = useYears();
    const detail = useLineDetail();
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        settlementsApi.get(id).then(setD).catch((f) => setError(errorKey(f)));
    }, [id]);
    if (!d) {
        return error ? _jsx(ErrorMessage, { messageKey: error }) : _jsx(LinearProgress, {});
    }
    const end = d.kind === 'EndOfService';
    const table = (title, lines, total) => (_jsxs(Box, { component: "table", sx: { width: '100%', borderCollapse: 'collapse', mb: 2, '& td, & th': { border: '1px solid #cbd5e1', p: '6px 8px', fontSize: 12.5, textAlign: 'start' } }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx(Box, { component: "th", colSpan: 2, sx: { bgcolor: '#f1f5f9' }, children: title }), _jsx(Box, { component: "th", sx: { bgcolor: '#f1f5f9', width: 140 }, children: t('settlements.award.amount') })] }) }), _jsxs("tbody", { children: [lines.map((l) => (_jsxs("tr", { children: [_jsx("td", { children: t(`settlements.line.${l.code}`) }), _jsx("td", { children: detail(l, d) }), _jsx(Box, { component: "td", sx: { fontVariantNumeric: 'tabular-nums' }, children: sar(l.amount) })] }, l.lineNo))), _jsxs(Box, { component: "tr", sx: { fontWeight: 800 }, children: [_jsx("td", { colSpan: 2, children: t(title === t('settlements.dues') ? 'settlements.totalDues' : 'settlements.totalDeductions') }), _jsx("td", { children: sar(total) })] })] })] }));
    const fact = (label, value) => (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 11, color: '#64748b' }, children: label }), _jsx(Typography, { component: "div", sx: { fontSize: 13, fontWeight: 700 }, children: value })] }));
    return (_jsxs(Box, { sx: { maxWidth: 820, mx: 'auto', p: 3, bgcolor: '#fff', color: '#0f2747', '@media print': { p: 0, '& .no-print': { display: 'none' } } }, children: [_jsx(Stack, { direction: "row", className: "no-print", sx: { justifyContent: 'flex-end', mb: 2 }, children: _jsx(Button, { variant: "contained", onClick: () => window.print(), children: t('settlements.print') }) }), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #082B49', pb: 1.5, mb: 2 }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 20, fontWeight: 800 }, children: t(end ? 'settlements.kind.EndOfService' : 'settlements.kind.Vacation') }), _jsxs(Typography, { sx: { fontSize: 12.5, color: '#64748b' }, children: [_jsx("bdi", { children: d.settlementNo }), " \u00B7 ", t(`settlements.status.${d.status}`)] })] }), _jsx(Typography, { sx: { fontSize: 12, color: '#64748b' }, children: date(new Date().toISOString()) })] }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2 }, children: [fact(t(d.party === 'Worker' ? 'settlements.worker' : 'settlements.employee'), _jsxs(_Fragment, { children: [d.name, " \u00B7 ", _jsx("bdi", { children: d.personNo })] })), fact(t(d.party === 'Worker' ? 'settlements.professionProject' : 'settlements.jobDepartment'), [ar ? d.jobTitleAr : d.jobTitleEn, ar ? d.departmentAr : d.departmentEn].filter(Boolean).join(' · ') || '—'), fact(t('settlements.hireDate'), date(d.hireDate)), end
                        ? fact(t('settlements.col.reason'), t(`settlements.reason.${d.reason}`))
                        : fact(t('settlements.annualLeave'), `${date(d.leaveFrom)} – ${date(d.leaveTo)}`), end ? fact(t('settlements.create.lastDay'), date(d.lastDay)) : fact(t('settlements.kpi.leaveDays'), t('settlements.daysN', { count: d.leaveDays })), end ? fact(t('settlements.kpi.service'), years(d.serviceYears)) : fact(t(d.party === 'Worker' ? 'settlements.workerLeaveRequest' : 'settlements.leaveRequest'), _jsx("bdi", { children: d.leaveRequestNo ?? '—' })), fact(t('settlements.wage'), `${sar(d.wage)} ${t('settlements.sar')}`)] }), table(t('settlements.dues'), d.lines.filter((l) => l.side === 'Addition'), d.totalAdditions), table(t('settlements.deductions'), d.lines.filter((l) => l.side === 'Deduction'), d.totalDeductions), _jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', bgcolor: '#082B49', color: '#fff', borderRadius: 1, px: 2, py: 1.25, mb: 2, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }, children: [_jsx(Typography, { sx: { fontWeight: 700 }, children: t('settlements.netDue') }), _jsxs(Typography, { sx: { fontWeight: 800, fontSize: 18 }, children: [sar(d.net), " ", t('settlements.sar')] })] }), _jsx(Typography, { sx: { fontSize: 12.5, lineHeight: 2, mb: 4 }, children: t(end ? 'settlements.acknowledgeEnd' : 'settlements.acknowledgeVacation', { name: d.name, net: sar(d.net) }) }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, textAlign: 'center', fontSize: 12.5 }, children: [d.party === 'Worker' ? 'workerSign' : 'employeeSign', 'hrSign', 'financeSign'].map((k) => (_jsx(Box, { sx: { borderTop: '1px solid #94a3b8', pt: 1 }, children: t(`settlements.${k}`) }, k))) })] }));
}
