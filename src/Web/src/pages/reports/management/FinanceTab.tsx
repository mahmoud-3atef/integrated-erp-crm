import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Button, Collapse, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { managementApi } from '../../../api/management';
import type { Finance, InvoiceRow, MonthMoney, Overview } from '../../../api/reports';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { DataTable, Donut, finCard, md, Pill, useNumbers, type Column } from './mdKit';

/** «المالية»: the old finance tab — its banner, five cards, the monthly billing against collection, statuses, debt ages, debtors, managers, coverage, invoices. */
export function FinanceTab({ from, to, overview }: { from: string; to: string; overview: Overview | null }) {
  const { t, i18n } = useTranslation();
  const f = useNumbers();
  const [project, setProject] = useState<string>('');
  const [data, setData] = useState<Finance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [showInvoices, setShowInvoices] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    managementApi
      .finance(from, to, project || null)
      .then((d) => {
        if (!live) return;
        setData(d);
        // The projects to narrow to: those of the period's invoices and of the debts (kept while one is chosen).
        if (!project) {
          const all = new Map<string, string>();
          for (const i of d.invoices) if (i.projectCrmId) all.set(i.projectCrmId, i.projectName);
          for (const x of d.debtors) if (x.projectCrmId) all.set(x.projectCrmId, x.name);
          setProjects([...all].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ar')));
        }
      })
      .catch((e) => live && setError(errorKey(e)));
    return () => {
      live = false;
    };
  }, [from, to, project]);

  if (error) return <ErrorMessage messageKey={error} />;
  const cov = overview?.coverage;
  const covered = cov ? cov.full : 0;
  const covTotal = cov ? cov.full + cov.partial + cov.missing : 0;

  return (
    <Stack sx={{ gap: 2 }}>
      <Box
        sx={{
          borderRadius: '18px',
          p: '14px 18px',
          color: '#fff',
          background: 'linear-gradient(135deg, #0A3C58 0%, #0E5F73 55%, #0E7C86 100%)',
          boxShadow: '0 10px 26px rgba(14,124,134,.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box aria-hidden sx={{ width: 42, height: 42, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.16)', '& svg': { fontSize: 22 } }}>
          <PieChartOutlineOutlinedIcon />
        </Box>
        <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
          <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }}>
            {t('mgmt.fin.title')}
          </Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.82 }}>{t('mgmt.fin.subtitle')}</Typography>
        </Box>
        <TextField
          select
          size="small"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          slotProps={{ select: { displayEmpty: true } }}
          sx={{ minWidth: 260, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,.14)', color: '#fff', borderRadius: '10px', '& fieldset': { borderColor: 'rgba(255,255,255,.35)' } }, '& svg': { color: '#fff' } }}
        >
          <MenuItem value="">{t('mgmt.fin.allProjects')}</MenuItem>
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              <bdi>{p.name}</bdi>
            </MenuItem>
          ))}
        </TextField>
        <Button component={RouterLink} to="/billing/invoices" startIcon={<ReceiptLongOutlinedIcon />} sx={{ bgcolor: md.glass, color: md.title, fontWeight: 700, borderRadius: '10px', px: 1.75, '&:hover': { bgcolor: md.glassHi } }}>
          {t('mgmt.fin.monthly')}
        </Button>
      </Box>

      {!data ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(5, minmax(0, 1fr))' } }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: '18px' }} />
          ))}
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' } }}>
            <FinKpi color={md.teal} icon={<DescriptionOutlinedIcon />} label={t('mgmt.fin.invoiced')} value={f.m(data.invoiced.value ?? 0)}>
              <Typography sx={{ fontSize: 11.5, color: md.muted }}>{t('mgmt.fin.invoicedSub', { count: f.n(data.invoiceCount.value ?? 0), workers: f.n(data.workers.value ?? 0) })}</Typography>
              <Typography sx={{ fontSize: 11.5, color: md.muted }}>{t('mgmt.fin.vatSub', { before: f.m(data.beforeVat.value ?? 0), vat: f.m(data.vat.value ?? 0) })}</Typography>
            </FinKpi>
            <FinKpi color={md.greenDeep} icon={<PaymentsOutlinedIcon />} label={t('mgmt.fin.collected')} value={f.m(data.collected.value ?? 0)}>
              <Progress value={data.collectionRate.value} color={md.greenDeep} />
              <Typography sx={{ fontSize: 11.5, color: md.muted }}>
                {t('mgmt.fin.rate')} <b>{data.collectionRate.value === null ? '—' : `${f.p(data.collectionRate.value)}%`}</b>
              </Typography>
            </FinKpi>
            <FinKpi color={md.amberDeep} icon={<AccountBalanceWalletOutlinedIcon />} label={t('mgmt.fin.remaining')} value={f.m(data.remaining.value ?? 0)}>
              <Typography sx={{ fontSize: 11.5, color: md.muted }}>{t('mgmt.fin.ofPeriod')}</Typography>
            </FinKpi>
            <FinKpi color={md.red} icon={<WarningAmberOutlinedIcon />} label={t('mgmt.fin.overdue')} value={f.n(data.overdue60)} valueColor={md.red}>
              <Typography sx={{ fontSize: 11.5, color: md.muted }}>
                {t('mgmt.fin.overdueSub', { count: f.n(data.overdue60Invoices), share: data.overdue60Share === null ? '—' : f.n(Math.round(data.overdue60Share)) })}
              </Typography>
            </FinKpi>
            <FinKpi
              color={md.coverage}
              icon={<FactCheckOutlinedIcon />}
              label={cov?.month ? t('mgmt.fin.coverageOf', { month: monthName(cov.month, i18n.language) }) : t('mgmt.fin.coverage')}
              value={cov?.month ? `${f.n(covered)}` : '—'}
              unit={cov?.month ? t('mgmt.fin.ofProjects', { total: f.n(covTotal) }) : undefined}
            >
              <Progress value={covTotal ? (covered / covTotal) * 100 : null} color={md.coverage} />
              {cov?.month && (
                <Typography sx={{ fontSize: 11.5, color: md.red }}>
                  <b>{f.n(cov.workersNotInvoiced)}</b> {t('mgmt.fin.notInvoiced')}
                </Typography>
              )}
            </FinKpi>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.7fr) minmax(0, 1fr)' } }}>
            <Box sx={finCard}>
              <CardHead icon={<BarChartOutlinedIcon />} title={t('mgmt.fin.trend')} />
              <MoneyChart months={data.money} />
            </Box>
            <Box sx={finCard}>
              <CardHead icon={<DonutLargeOutlinedIcon />} title={t('mgmt.fin.statuses')} />
              <Donut items={data.statuses.map((s) => ({ key: String(s.code), label: i18n.language === 'ar' ? s.nameAr : s.nameEn, value: s.count }))} size={140} />
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            <Box sx={finCard}>
              <CardHead icon={<HourglassBottomOutlinedIcon />} title={t('mgmt.fin.aging')} hint={t('mgmt.fin.agingHint')} />
              <Aging data={data} />
            </Box>
            <Box sx={finCard}>
              <CardHead icon={<ApartmentOutlinedIcon />} title={t('mgmt.fin.debtors')} hint={t('mgmt.fin.debtorsHint')} />
              <Stack sx={{ gap: 1, maxHeight: 420, overflowY: 'auto', scrollbarWidth: 'thin', pe: 0.5 }}>
                {data.debtors.slice(0, 12).map((d, index) => {
                  const top = data.debtors[0]?.outstanding || 1;
                  return (
                    <Stack key={d.projectCrmId ?? d.name} direction="row" sx={{ gap: 1.25, alignItems: 'center', p: 1, borderRadius: '12px', '&:hover': { bgcolor: md.glassHi } }}>
                      <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: md.red, bgcolor: md.glassHi, flex: '0 0 auto' }}>{index + 1}</Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: md.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <bdi>{d.name}</bdi>
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: md.muted }}>
                          <bdi>{d.manager ?? '—'}</bdi> · {t('mgmt.fin.openSince', { count: d.openInvoices, days: d.oldestDays })}
                        </Typography>
                        <Box sx={{ mt: 0.5, height: 4, borderRadius: 999, bgcolor: md.track }}>
                          <Box sx={{ height: '100%', width: `${(d.outstanding / top) * 100}%`, borderRadius: 999, background: 'linear-gradient(90deg, #E8890C, #E03434)' }} />
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: 'end', flex: '0 0 auto' }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: md.red, fontVariantNumeric: 'tabular-nums' }}>{f.n(d.outstanding)}</Typography>
                        <Typography sx={{ fontSize: 11, color: md.muted }}>{t('mgmt.fin.collectedPct', { rate: f.n(Math.round(d.rate)) })}</Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            {/* Collection by manager first (on the right), as the old page placed them. */}
            <Box sx={{ ...(finCard as object), order: { md: 2 } }}>
              <CardHead icon={<FactCheckOutlinedIcon />} title={cov?.month ? t('mgmt.fin.coverageOf', { month: monthName(cov.month, i18n.language) }) : t('mgmt.fin.coverage')} />
              {!cov?.month ? (
                <Alert severity="info">{t('mgmt.fin.noCoverage')}</Alert>
              ) : (
                <>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, mb: 1.5 }}>
                    <CovStat color={md.greenDeep} value={cov.full} label={t('mgmt.fin.covFull')} />
                    <CovStat color={md.amberDeep} value={cov.partial} label={t('mgmt.fin.covPartial')} />
                    <CovStat color={md.red} value={cov.missing} label={t('mgmt.fin.covMissing')} />
                  </Box>
                  <Stack sx={{ gap: 0.5, maxHeight: 300, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                    {cov.gaps.map((g) => (
                      <Stack key={g.projectCrmId} direction="row" sx={{ alignItems: 'center', gap: 1, py: 0.75, borderBottom: `1px solid ${md.border}` }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: g.hasInvoice ? md.amberDeep : md.red, flex: '0 0 auto' }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: md.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <bdi>{g.name}</bdi>
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: md.muted }}>
                            <bdi>{g.manager ?? '—'}</bdi>
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'end' }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, color: md.red }}>{f.n(g.worked - g.invoiced)}</Typography>
                          <Typography sx={{ fontSize: 10.5, color: md.muted }}>{g.hasInvoice ? t('mgmt.fin.notInvoicedOf', { worked: g.worked }) : t('mgmt.fin.noInvoice')}</Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </>
              )}
            </Box>
            <Box sx={finCard}>
              <CardHead icon={<PersonOutlineIcon />} title={t('mgmt.fin.byManager')} hint={t('mgmt.fin.byManagerHint')} />
              <Stack sx={{ gap: 1, maxHeight: 420, overflowY: 'auto', scrollbarWidth: 'thin', pe: 0.5 }}>
                {data.managers.map((m) => (
                  <Stack key={m.manager} direction="row" sx={{ gap: 1.25, alignItems: 'center', p: 1.25, borderRadius: '12px', bgcolor: md.glassHi, border: `1px solid ${md.border}` }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff', bgcolor: md.navy, flex: '0 0 auto' }}>
                      <bdi>{Array.from(m.manager.trim())[0]?.toUpperCase() ?? '—'}</bdi>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: md.ink }}>
                        <bdi>{m.manager}</bdi>
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: md.muted }}>{t('mgmt.fin.managerSub', { projects: m.projects, invoices: m.invoices, invoiced: f.n(m.invoiced) })}</Typography>
                      <Box sx={{ mt: 0.5, height: 4, borderRadius: 999, bgcolor: md.track }}>
                        <Box sx={{ height: '100%', width: `${Math.min(100, m.rate)}%`, borderRadius: 999, bgcolor: md.greenDeep }} />
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'end', flex: '0 0 auto' }}>
                      <Pill color="#fff" bg={m.rate >= 50 ? md.greenDeep : md.red}>{`${f.n(Math.round(m.rate))}%`}</Pill>
                      <Typography sx={{ fontSize: 11, color: md.muted, mt: 0.5 }}>{t('mgmt.fin.remainingShort', { amount: f.n(m.outstanding) })}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>

          <Box sx={finCard}>
            <Button
              fullWidth
              onClick={() => setShowInvoices((s) => !s)}
              endIcon={<ExpandMoreIcon sx={{ transform: showInvoices ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
              sx={{ justifyContent: 'space-between', color: md.title, fontWeight: 700, fontSize: 14 }}
            >
              <span>
                {t('mgmt.fin.invoices')}{' '}
                <Box component="small" sx={{ color: md.muted, fontWeight: 400 }}>
                  {t('mgmt.fin.latest', { count: Math.min(250, data.invoicesTotal) })}
                </Box>
              </span>
            </Button>
            <Collapse in={showInvoices} unmountOnExit>
              <InvoicesTable rows={data.invoices} excel={managementApi.invoicesExcel(from, to, project || null)} />
            </Collapse>
          </Box>
        </>
      )}
    </Stack>
  );
}

const monthName = (key: string, lang: string) =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));

function CardHead({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
      <Box sx={{ color: md.teal, display: 'flex', '& svg': { fontSize: 19 } }}>{icon}</Box>
      <Typography component="h3" sx={{ fontSize: 14.5, fontWeight: 700, color: md.title }}>
        {title}
      </Typography>
      {hint && <Typography sx={{ fontSize: 11.5, color: md.muted, marginInlineStart: 'auto' }}>{hint}</Typography>}
    </Stack>
  );
}

/** A finance card: its colour's 4px line on top, a tinted icon square, the amount with «ريال». */
function FinKpi({ color, icon, label, value, unit, valueColor, children }: { color: string; icon: ReactNode; label: string; value: string; unit?: string; valueColor?: string; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ bgcolor: md.glass, border: `1px solid ${md.border}`, borderTop: `4px solid ${color}`, borderRadius: '18px', boxShadow: '0 4px 14px rgba(10,60,88,.07)', p: '16px 18px', minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
        <Box aria-hidden sx={{ width: 34, height: 34, borderRadius: '12px', display: 'grid', placeItems: 'center', color, bgcolor: `${color}1A`, '& svg': { fontSize: 18 } }}>
          {icon}
        </Box>
        <Typography sx={{ fontSize: 12.5, color: md.label, fontWeight: 600 }}>{label}</Typography>
      </Stack>
      <Typography component="div" sx={{ fontSize: 24, fontWeight: 700, color: valueColor ?? md.glow, textShadow: valueColor ? undefined : md.glowShadow, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
        <bdi>{value}</bdi>
        <Box component="small" sx={{ fontSize: 13, fontWeight: 600, color: md.muted, marginInlineStart: 0.75 }}>
          {unit ?? t('mgmt.unit.sar')}
        </Box>
      </Typography>
      <Stack sx={{ gap: 0.5, mt: 0.75 }}>{children}</Stack>
    </Box>
  );
}

function Progress({ value, color }: { value: number | null; color: string }) {
  return (
    <Box sx={{ height: 6, borderRadius: 999, bgcolor: md.track, overflow: 'hidden' }}>
      <Box sx={{ height: '100%', width: `${Math.max(0, Math.min(100, value ?? 0))}%`, borderRadius: 999, bgcolor: color }} />
    </Box>
  );
}

function CovStat({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <Box sx={{ borderRadius: '12px', bgcolor: `${color}12`, p: 1, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 20, fontWeight: 700, color }}>{value}</Typography>
      <Typography sx={{ fontSize: 11.5, color: md.text }}>{label}</Typography>
    </Box>
  );
}

const agingLook = [
  { color: '#1D8D48', key: 'fresh' },
  { color: '#7CB342', key: 'follow' },
  { color: '#E39A0B', key: 'late' },
  { color: '#E8650C', key: 'veryLate' },
  { color: '#E03434', key: 'danger' },
];

/** The debts by age: a stacked line, then a row per bucket (count, amount, share). */
function Aging({ data }: { data: Finance }) {
  const { t } = useTranslation();
  const f = useNumbers();
  const total = data.aging.reduce((s, a) => s + a.amount, 0);
  return (
    <>
      <Stack direction="row" sx={{ height: 10, borderRadius: 999, overflow: 'hidden', bgcolor: md.track, mb: 1.5 }}>
        {data.aging.map((a) => (
          <Box key={a.bucket} sx={{ width: total ? `${(a.amount / total) * 100}%` : 0, bgcolor: agingLook[a.bucket - 1]?.color }} />
        ))}
      </Stack>
      <Stack sx={{ gap: 0.75 }}>
        {data.aging.map((a) => {
          const look = agingLook[a.bucket - 1]!;
          return (
            <Stack key={a.bucket} direction="row" sx={{ alignItems: 'center', gap: 1, p: 1, borderRadius: '10px', bgcolor: md.glassHi, borderInlineStart: `3px solid ${look.color}` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: md.ink, minWidth: 92 }}>{t(`mgmt.fin.bucket.${a.bucket}`)}</Typography>
              <Pill color={look.color} bg={`${look.color}1A`}>
                {t(`mgmt.fin.age.${look.key}`)}
              </Pill>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11.5, color: md.muted }}>{t('mgmt.fin.invoicesCount', { count: a.count })}</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: md.ink, minWidth: 90, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{f.n(a.amount)}</Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: look.color, minWidth: 48, textAlign: 'end' }}>{`${f.p(a.percent)}%`}</Typography>
            </Stack>
          );
        })}
      </Stack>
    </>
  );
}

/** Billing against collection by month: two columns a month and the collection rate as a line (its own % axis). */
function MoneyChart({ months }: { months: MonthMoney[] }) {
  const { t, i18n } = useTranslation();
  const f = useNumbers();
  const w = 640;
  const h = 260;
  const pad = { top: 16, bottom: 30, side: 44 };
  const top = Math.max(1, ...months.flatMap((m) => [m.invoiced, m.collected]));
  const step = 10 ** Math.floor(Math.log10(top));
  const max = Math.ceil(top / step) * step;
  const inner = w - pad.side * 2;
  const slot = inner / Math.max(1, months.length);
  const y = (v: number) => pad.top + (h - pad.top - pad.bottom) * (1 - v / max);
  const yr = (v: number) => pad.top + (h - pad.top - pad.bottom) * (1 - Math.min(100, v) / 100);
  const label = (key: string) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
  // Months read left to right in both languages, as on the old chart.
  const x = (i: number) => pad.side + slot * i + slot / 2;
  const line = months.map((m, i) => (m.rate === null ? null : `${x(i)},${yr(m.rate)}`)).filter(Boolean).join(' ');
  return (
    <Box>
      <Stack direction="row" sx={{ gap: 2, mb: 1, fontSize: 11.5, color: md.muted }}>
        <Legend color={md.teal} text={t('mgmt.fin.legendInvoiced')} />
        <Legend color={md.green} text={t('mgmt.fin.legendCollected')} />
        <Legend color="#E8890C" text={t('mgmt.fin.legendRate')} line />
      </Stack>
      <Box dir="ltr">
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={t('mgmt.fin.trend')}>
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line x1={pad.side} x2={w - pad.side} y1={y(max * p)} y2={y(max * p)} stroke={md.border} />
              <text x={pad.side - 6} y={y(max * p) + 4} textAnchor="end" fontSize="10" fill={md.muted}>
                {f.n(Math.round((max * p) / 1e5) / 10)}M
              </text>
              <text x={w - pad.side + 6} y={yr(100 * p) + 4} fontSize="10" fill={md.muted}>
                {100 * p}%
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const bw = Math.min(28, slot / 3);
            return (
              <g key={m.month}>
                <rect x={x(i) - bw - 3} y={y(m.invoiced)} width={bw} height={Math.max(0, y(0) - y(m.invoiced))} rx="3" fill={md.teal}>
                  <title>{`${label(m.month)} · ${f.n(m.invoiced)}`}</title>
                </rect>
                <rect x={x(i) + 3} y={y(m.collected)} width={bw} height={Math.max(0, y(0) - y(m.collected))} rx="3" fill={md.green}>
                  <title>{`${label(m.month)} · ${f.n(m.collected)}`}</title>
                </rect>
                <text x={x(i)} y={h - 10} textAnchor="middle" fontSize="10.5" fill={md.text}>
                  {label(m.month)}
                </text>
              </g>
            );
          })}
          {line && <polyline points={line} fill="none" stroke="#E8890C" strokeWidth="2" />}
          {months.map((m, i) => (m.rate === null ? null : <circle key={m.month} cx={x(i)} cy={yr(m.rate)} r="3.5" fill="#E8890C" />))}
        </svg>
      </Box>
    </Box>
  );
}

function Legend({ color, text, line }: { color: string; text: string; line?: boolean }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: line ? 16 : 10, height: line ? 3 : 10, borderRadius: line ? 2 : '3px', bgcolor: color }} />
      {text}
    </Stack>
  );
}

function InvoicesTable({ rows, excel }: { rows: InvoiceRow[]; excel: string }) {
  const { t, i18n } = useTranslation();
  const f = useNumbers();
  const columns = useMemo<Column<InvoiceRow>[]>(
    () => [
      { key: 'no', label: t('mgmt.col.invoice'), render: (r) => <bdi>{r.no || '—'}</bdi>, text: (r) => r.no },
      { key: 'project', label: t('mgmt.col.project'), render: (r) => <bdi>{r.projectName}</bdi>, text: (r) => r.projectName },
      { key: 'manager', label: t('mgmt.col.manager'), render: (r) => <bdi>{r.manager ?? '—'}</bdi>, text: (r) => r.manager ?? '' },
      { key: 'workers', label: t('mgmt.col.workers'), render: (r) => f.n(r.workers), align: 'center' },
      { key: 'total', label: t('mgmt.col.total'), render: (r) => f.m(r.total), align: 'end' },
      { key: 'collected', label: t('mgmt.col.collected'), render: (r) => f.m(r.collected), align: 'end' },
      { key: 'remaining', label: t('mgmt.col.remaining'), render: (r) => <Box component="b" sx={{ color: r.remaining > 0.01 ? md.red : md.greenDeep }}>{f.m(r.remaining)}</Box>, align: 'end' },
      { key: 'status', label: t('mgmt.col.status'), render: (r) => (i18n.language === 'ar' ? r.statusAr : r.statusEn), text: (r) => r.statusAr + r.statusEn },
      { key: 'to', label: t('mgmt.col.periodEnd'), render: (r) => <bdi>{r.to.slice(0, 10)}</bdi> },
      { key: 'age', label: t('mgmt.col.age'), render: (r) => f.n(r.ageDays), align: 'center' },
    ],
    [t, i18n.language, f],
  );
  return <DataTable title={t('mgmt.fin.invoices')} rows={rows} columns={columns} excel={excel} empty={t('mgmt.empty')} />;
}
