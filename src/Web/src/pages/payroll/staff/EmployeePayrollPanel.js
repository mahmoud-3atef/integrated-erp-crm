import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LinearProgress, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { payslipsPath } from '../../../api/payslips';
import { staffPayrollApi } from '../../../api/staffPayroll';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrScope, hr } from '../../../components/hr/Hr';
import { useMonthName as usePeriodName } from '../../attendance/AttendanceMonthPage';
import { money, RunStatusBadge } from '../payroll';
/** The employee file's «payroll» tab: the employee's line in each staff run, latest first. */
export function EmployeePayrollPanel({ employeeId }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const periodName = usePeriodName();
    const [rows, setRows] = useState(null);
    const [error, setError] = useState(null);
    const allowed = can('payroll.staff.view', true);
    useEffect(() => {
        if (!allowed)
            return;
        staffPayrollApi
            .employeeLines(employeeId)
            .then(setRows)
            .catch((f) => setError(errorKey(f)));
    }, [employeeId, allowed]);
    if (!allowed)
        return _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('staffPayroll.noAccess') });
    if (!rows)
        return error ? _jsx(ErrorMessage, { messageKey: error }) : _jsx(LinearProgress, {});
    if (rows.length === 0)
        return _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('staffPayroll.employeeNone') });
    return (_jsx(HrScope, { children: _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700 }, '& tbody tr': { cursor: 'pointer' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('staffPayroll.cols.period') }), _jsx(TableCell, { children: t('staffPayroll.cols.no') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.cols.days') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.cols.gross') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.cols.deductionsGroup') }), _jsx(TableCell, { align: "right", children: t('staffPayroll.cols.net') }), _jsx(TableCell, { children: t('staffPayroll.cols.status') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, onClick: () => navigate(`/payroll/staff/${r.runId}`), children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: periodName(r.period) }), _jsx(TableCell, { children: _jsx("bdi", { children: r.runNo }) }), _jsx(TableCell, { align: "right", children: money(r.paidDays) }), _jsx(TableCell, { align: "right", children: money(r.gross) }), _jsx(TableCell, { align: "right", sx: { color: '#B45309' }, children: money(r.deductions) }), _jsx(TableCell, { align: "right", sx: { fontWeight: 700 }, children: money(r.net) }), _jsx(TableCell, { children: _jsx(RunStatusBadge, { status: r.status }) }), _jsx(TableCell, { onClick: (e) => e.stopPropagation(), children: _jsx(Link, { href: payslipsPath('staff', r.runId, { line: r.lineId }), target: "_blank", rel: "noopener", sx: { fontWeight: 600, color: hr.primary }, children: t('payslip.open') }) })] }, r.lineId))) })] }) }) }));
}
