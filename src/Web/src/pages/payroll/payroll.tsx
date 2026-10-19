import { useTranslation } from 'react-i18next';
import type { PayrollExclusionKind, PayrollNote, PayrollStatus } from '../../api/payroll';
import { HrStatusBadge, hr } from '../../components/hr/Hr';

// The payroll's states and review notes, as the HR screens show them (label, colour and tint: never colour alone).

export const runStatusLook: Record<PayrollStatus, { color: string; tint: string }> = {
  Draft: { color: '#475569', tint: '#F1F5F9' },
  InApproval: { color: hr.primary, tint: '#EFF6FF' },
  Returned: { color: '#B45309', tint: '#FEF3C7' },
  Approved: { color: hr.success, tint: '#D1FAE5' },
};

export function RunStatusBadge({ status }: { status: PayrollStatus }) {
  const { t } = useTranslation();
  return <HrStatusBadge label={t(`payroll.status.${status}`)} {...runStatusLook[status]} />;
}

export const noteLook: Record<PayrollNote, { color: string; tint: string }> = {
  absence: { color: '#B91C1C', tint: '#FEE2E2' },
  joined: { color: hr.primary, tint: '#EFF6FF' },
  left: { color: '#475569', tint: '#F1F5F9' },
  multi_project: { color: '#6D28D9', tint: '#EDE9FE' },
  salary_split: { color: '#B45309', tint: '#FEF3C7' },
  late: { color: '#0E7490', tint: '#CFFAFE' },
  net_not_positive: { color: hr.danger, tint: '#FEE2E2' },
};

export const exclusionLook: Record<PayrollExclusionKind, { color: string; tint: string }> = {
  TimesheetNotApproved: { color: '#B45309', tint: '#FEF3C7' },
  NoTimesheet: { color: '#B91C1C', tint: '#FEE2E2' },
  PaidElsewhere: { color: '#475569', tint: '#F1F5F9' },
  NetNotPositive: { color: hr.danger, tint: '#FEE2E2' },
};

/** Money as the payroll shows it: thousands separated, up to two decimals, tabular. */
export const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** «سبتمبر 2026» for a period ending in that month (the run's name in the header and the comparison). */
export function useMonthName() {
  const { i18n } = useTranslation();
  return (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' });
}
