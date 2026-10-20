import { LinearProgress, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { payslipsPath } from '../../../api/payslips';
import { staffPayrollApi, type StaffEmployeeRun } from '../../../api/staffPayroll';
import { useSession } from '../../../app/session';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { HrScope, hr } from '../../../components/hr/Hr';
import { useMonthName as usePeriodName } from '../../attendance/AttendanceMonthPage';
import { money, RunStatusBadge } from '../payroll';

/** The employee file's «payroll» tab: the employee's line in each staff run, latest first. */
export function EmployeePayrollPanel({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const periodName = usePeriodName();
  const [rows, setRows] = useState<StaffEmployeeRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = can('payroll.staff.view', true);
  useEffect(() => {
    if (!allowed) return;
    staffPayrollApi
      .employeeLines(employeeId)
      .then(setRows)
      .catch((f) => setError(errorKey(f)));
  }, [employeeId, allowed]);
  if (!allowed) return <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('staffPayroll.noAccess')}</Typography>;
  if (!rows) return error ? <ErrorMessage messageKey={error} /> : <LinearProgress />;
  if (rows.length === 0) return <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('staffPayroll.employeeNone')}</Typography>;
  return (
    <HrScope>
      <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
        <Table size="small" sx={{ '& td': { height: 44, fontVariantNumeric: 'tabular-nums' }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700 }, '& tbody tr': { cursor: 'pointer' } }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('staffPayroll.cols.period')}</TableCell>
              <TableCell>{t('staffPayroll.cols.no')}</TableCell>
              <TableCell align="right">{t('staffPayroll.cols.days')}</TableCell>
              <TableCell align="right">{t('staffPayroll.cols.gross')}</TableCell>
              <TableCell align="right">{t('staffPayroll.cols.deductionsGroup')}</TableCell>
              <TableCell align="right">{t('staffPayroll.cols.net')}</TableCell>
              <TableCell>{t('staffPayroll.cols.status')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.lineId} hover onClick={() => navigate(`/payroll/staff/${r.runId}`)}>
                <TableCell sx={{ fontWeight: 600 }}>{periodName(r.period)}</TableCell>
                <TableCell>
                  <bdi>{r.runNo}</bdi>
                </TableCell>
                <TableCell align="right">{money(r.paidDays)}</TableCell>
                <TableCell align="right">{money(r.gross)}</TableCell>
                <TableCell align="right" sx={{ color: '#B45309' }}>
                  {money(r.deductions)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {money(r.net)}
                </TableCell>
                <TableCell>
                  <RunStatusBadge status={r.status} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Link href={payslipsPath('staff', r.runId, { line: r.lineId })} target="_blank" rel="noopener" sx={{ fontWeight: 600, color: hr.primary }}>
                    {t('payslip.open')}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </HrScope>
  );
}
