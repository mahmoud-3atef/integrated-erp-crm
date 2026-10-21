import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, ButtonBase, Popover, Stack, Typography } from '@mui/material';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExpenseItem, ProjectProfit, WorkerProfit } from '../../api/reports';
import { tokens } from '../../app/theme';
import { useFormat } from './reportKit';

/** A figure that opens how it was reached. */
function Opener({ children, label, panel }: { children: ReactNode; label: string; panel: ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <ButtonBase
        onClick={(e: MouseEvent<HTMLElement>) => {
          e.stopPropagation();
          setAnchor(e.currentTarget);
        }}
        aria-label={label}
        aria-haspopup="dialog"
        sx={{ gap: 0.5, px: 0.5, borderRadius: '6px', font: 'inherit', color: 'inherit', borderBottom: '1px dashed #94A3B8', '&:hover': { bgcolor: tokens.navy50 } }}
      >
        {children}
        <InfoOutlinedIcon sx={{ fontSize: 14, color: tokens.navy600 }} />
      </ButtonBase>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { p: 2, width: 380, maxWidth: '92vw', borderRadius: '14px' } } }}
      >
        {panel}
      </Popover>
    </>
  );
}

function Row({ label, hint, value, strong, negative }: { label: string; hint?: string; value: string; strong?: boolean; negative?: boolean }) {
  return (
    <Stack direction="row" sx={{ gap: 1, alignItems: 'baseline', py: 0.6, borderTop: strong ? `1px solid ${tokens.gray200}` : undefined, mt: strong ? 0.5 : 0 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: strong ? 800 : 600 }}>{label}</Typography>
        {hint && <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>{hint}</Typography>}
      </Box>
      <Typography sx={{ fontSize: strong ? 14 : 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: negative ? '#DC2626' : tokens.navy800 }}>
        <bdi>{value}</bdi>
      </Typography>
    </Stack>
  );
}

function Expenses({ items }: { items: ExpenseItem[] }) {
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const ar = i18n.language === 'ar';
  return (
    <>
      {items.map((e) => (
        <Row key={e.expenseNo} label={ar ? e.categoryAr : e.categoryEn} hint={t('ceo.parts.expense', { no: e.expenseNo })} value={f.n(e.amount)} />
      ))}
    </>
  );
}

/** A worker's cost, part by part: the salary on the invoice lines or the supplier's cost, the housing days, the expenses. */
export function WorkerCost({ w }: { w: WorkerProfit }) {
  const { t } = useTranslation();
  const f = useFormat();
  const p = w.parts;
  const supplier = w.source === 'Supplier';
  const panel = (
    <Box>
      <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 0.25 }}>{t('ceo.parts.title')}</Typography>
      <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mb: 1 }}>
        {w.name} · <bdi>{w.workerNo}</bdi> · {t(`ceo.source.${w.source}`)}
      </Typography>
      {supplier ? (
        <>
          <Row
            label={t('ceo.parts.supplierWork')}
            hint={p.supplierMonthly !== null ? t('ceo.parts.supplierWorkHint', { monthly: f.n(p.supplierMonthly), days: w.workDays, monthDays: p.monthDays }) : undefined}
            value={f.n(p.supplierWork)}
          />
          {p.idleDays > 0 && <Row label={t('ceo.parts.idle')} hint={t('ceo.parts.idleHint', { days: p.idleDays, monthly: f.n(p.supplierMonthly ?? 0), monthDays: p.monthDays })} value={f.n(p.idleCost)} negative />}
          {p.byWorkingDays && w.housingDays > 0 && <Typography sx={{ fontSize: 11.5, color: tokens.gray500, py: 0.5 }}>{t('ceo.parts.byDaysNote', { days: w.housingDays })}</Typography>}
        </>
      ) : (
        <>
          {p.billedDays > 0 && (
            <>
              <Row label={t('ceo.parts.dueSalary')} hint={t('ceo.parts.billedSalaryHint', { days: f.n(p.billedDays) })} value={f.n(p.dueSalary)} />
              {p.absenceDeduction > 0 && <Row label={t('ceo.parts.absence')} hint={t('ceo.parts.absenceHint', { days: f.n(p.absentDays) })} value={f.n(-p.absenceDeduction)} negative />}
              {p.otherDeductions > 0 && <Row label={t('ceo.parts.otherDeductions')} hint={t('ceo.parts.otherDeductionsHint')} value={f.n(-p.otherDeductions)} negative />}
              <Row label={t('ceo.parts.netSalary')} hint={t('ceo.parts.netSalaryHint')} value={f.n(p.billedSalary)} />
            </>
          )}
          {p.unbilledDays > 0 && <Row label={t('ceo.parts.unbilledSalary')} hint={t('ceo.parts.unbilledHint', { days: p.unbilledDays, daily: f.n(p.dailySalary) })} value={f.n(p.unbilledSalary)} />}
          {w.housingDays > 0 && <Typography sx={{ fontSize: 11.5, color: tokens.gray500, py: 0.5 }}>{t('ceo.parts.housingUnpaid', { days: w.housingDays })}</Typography>}
          {w.source === 'Unknown' && <Typography sx={{ fontSize: 11.5, color: tokens.info, py: 0.5 }}>{t('ceo.parts.unknown')}</Typography>}
        </>
      )}
      <Expenses items={p.expenses} />
      <Row label={t('ceo.parts.total')} value={f.n(w.cost)} strong />
      <Row label={t('ceo.parts.revenue')} hint={t('ceo.parts.revenueHint')} value={f.n(w.revenue)} />
      <Row label={t('ceo.col.profit')} value={f.n(w.profit)} strong negative={w.profit < 0} />
      {p.expenses.length === 0 && <Typography sx={{ fontSize: 11, color: tokens.gray500, mt: 1 }}>{t('ceo.parts.noExpenses')}</Typography>}
    </Box>
  );
  return (
    <Opener label={t('ceo.parts.open')} panel={panel}>
      {f.n(w.cost)}
    </Opener>
  );
}

/** A project's cost: its company workers' and its suppliers' workers' share on its days, then its own expenses. */
export function ProjectCost({ p }: { p: ProjectProfit }) {
  const { t } = useTranslation();
  const f = useFormat();
  const panel = (
    <Box>
      <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 0.25 }}>{t('ceo.parts.projectTitle')}</Typography>
      <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mb: 1 }}>
        {p.name} · {t('ceo.parts.projectWorkers', { count: p.workers, days: f.n(p.workDays) })}
      </Typography>
      {p.companyCost > 0 && <Row label={t('ceo.parts.companyWorkers')} hint={t('ceo.parts.companyWorkersHint')} value={f.n(p.companyCost)} />}
      {p.supplierCost > 0 && <Row label={t('ceo.parts.supplierWorkers')} hint={t('ceo.parts.supplierWorkersHint')} value={f.n(p.supplierCost)} />}
      {p.missingCosts > 0 && <Typography sx={{ fontSize: 11.5, color: tokens.info, py: 0.5 }}>{t('ceo.parts.missing', { count: p.missingCosts })}</Typography>}
      <Expenses items={p.expenseItems} />
      <Row label={t('ceo.parts.total')} value={f.n(p.cost)} strong />
      <Row label={t('ceo.parts.revenue')} hint={t('ceo.parts.projectRevenueHint')} value={f.n(p.revenue)} />
      <Row label={t('ceo.col.profit')} value={f.n(p.profit)} strong negative={p.profit < 0} />
      <Typography sx={{ fontSize: 11, color: tokens.gray500, mt: 1 }}>{t('ceo.parts.projectNote')}</Typography>
    </Box>
  );
  return (
    <Opener label={t('ceo.parts.open')} panel={panel}>
      {f.n(p.cost)}
    </Opener>
  );
}
