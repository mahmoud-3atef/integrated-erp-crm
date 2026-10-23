import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MultipleStopOutlinedIcon from '@mui/icons-material/MultipleStopOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import { Alert, Box, Button, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../app/session';
import { ActionDialog } from '../operations/movements/ActionDialog';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workforceApi, type WorkerDetail, type WorkerKind, type WorkerPeriod } from '../../api/workforce';
import { photoUrl, profileApi } from '../../api/showroom';
import { ceoApi } from '../../api/reports';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, Initials } from '../../components/ui';
import { card, CopyButton, NotRecorded, Row, Section, StatusPill, UnderlineTabs, wf } from './workforceUi';
import { WorkerActions, periodDays } from './WorkerActions';
import { WorkerInvoices } from './WorkerInvoices';
import { useService } from '../staff/staff';
import { WorkerProfileTab } from './WorkerProfileTab';
import { WorkerCostTab } from './WorkerCostTab';
import { useCrumb } from '../../app/breadcrumbs';

type Tab = 'info' | 'actions' | 'invoices' | 'ids' | 'profile' | 'cost';

/**
 * One worker's or staff member's file (the user's redesign, 2026-10-23; docs/02-target-architecture/22): the title with
 * the new action, a white identity card with the current project and the key facts, the operational summary, underlined
 * tabs, then the data sections as labels and values; the actions tab is the old screen's actions timeline, each action
 * opening its document. Staff have no supplier, agent, current project, work days, invoices, marketing profile or cost.
 */
export function WorkerDetailPage({ kind }: { kind: WorkerKind }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { id } = useParams();
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  useCrumb(worker?.summary.name);
  const [tab, setTab] = useState<Tab>(() => {
    const asked = new URLSearchParams(window.location.search).get('tab');
    if (asked === 'periods' || asked === 'actions') return 'actions';
    return asked === 'ids' || ((asked === 'profile' || asked === 'cost' || asked === 'invoices') && kind === 'Worker') ? asked : 'info';
  });
  const [periods, setPeriods] = useState<WorkerPeriod[] | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [profit, setProfit] = useState<number | null>(null);
  const service = useService();
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [sent, setSent] = useState(0);
  const ar = i18n.language === 'ar';

  useEffect(() => {
    workforceApi.get(kind, id!).then(setWorker).catch((failure: unknown) => setError(errorKey(failure)));
    if (kind === 'Worker') {
      profileApi
        .get(id!)
        .then((p) => setPhoto(p.photos[0] ? photoUrl(id!, p.photos[0]) : null))
        .catch(() => setPhoto(null));
    }
  }, [kind, id]);

  useEffect(() => {
    workforceApi.periods(kind, id!).then(setPeriods).catch(() => setPeriods([]));
  }, [kind, id, sent]);

  // The last invoiced month's profit on the worker (the CEO report's), for those who may see it.
  const seesProfit = kind === 'Worker' && can('reports.profit.view', true) && can('workforce.workers.salary', true);
  const workerNo = worker?.summary.workerNo;
  useEffect(() => {
    if (!seesProfit || !workerNo) return;
    ceoApi
      .workers(null, { search: workerNo })
      .then((rows) => setProfit(rows.find((r) => r.workerId === id)?.profit ?? null))
      .catch(() => setProfit(null));
  }, [seesProfit, workerNo, id]);

  if (!worker) {
    return (
      <>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </>
    );
  }

  const w = worker.summary;
  const status = (ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`);
  const date = (value: string | null) =>
    value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—';
  const money = (value: number) => (
    <>
      {new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}
      <Box component="small" sx={{ fontSize: 12, fontWeight: 500, color: tokens.gray500, marginInlineStart: 0.5 }}>
        {t('workforce.sar')}
      </Box>
    </>
  );
  const unit = (text: string) => (
    <Box component="small" sx={{ fontSize: 12, fontWeight: 500, color: tokens.gray500, marginInlineStart: 0.5 }}>
      {text}
    </Box>
  );
  const days = (value: number | null) => (value === null ? '—' : <>{value.toLocaleString('en-US')}{unit(t('workforce.days'))}</>);
  const staff = kind === 'Staff';
  const working = w.placement === 'Working' && !staff;
  const flip = { transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' };
  const tally = (kinds: string[]) => (periods ?? []).filter((p) => kinds.includes(p.kind)).reduce((sum, p) => sum + periodDays(p), 0);
  const projectDays = tally(['Work', 'ClientVacation']);
  const housingDays = tally(['Housing']);
  const projects = new Set((periods ?? []).filter((p) => p.kind === 'Work' && p.projectName).map((p) => p.projectName)).size;
  const usage = projectDays + housingDays > 0 ? Math.round((projectDays * 100) / (projectDays + housingDays)) : null;
  const lastPrice = (periods ?? []).find((p) => p.kind === 'Work' && p.totalPrice !== null)?.totalPrice ?? null;
  const iqamaEnds = worker.identifiers.find((i) => i.type === 'Iqama' && i.isCurrent)?.expiresOn ?? null;
  const since = (worker.arrivedOn ?? worker.crmCreatedAt)?.slice(0, 10) ?? null;

  const title = t(staff ? 'workforce.ui.staffTitle' : 'workforce.ui.workerTitle');
  const missing = <NotRecorded />;
  const text = (value: string | null | undefined, ltr = false) => (value ? ltr ? <bdi>{value}</bdi> : value : missing);

  return (
    <Box>
      <ErrorMessage messageKey={error} />
      {worker.removedInCrm && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('workforce.removedInCrm')}
        </Alert>
      )}

      {/* The page's title, with the new action and the way back beside it. */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Typography component="h1" sx={{ fontSize: 24, fontWeight: 600, color: wf.navy, lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          {can('operations.movements.manage', true) && (
            <Button variant="contained" startIcon={<MultipleStopOutlinedIcon />} onClick={() => setActing(true)} sx={{ height: 40, borderRadius: wf.control, bgcolor: wf.navy, boxShadow: 'none', px: 2.25, '&:hover': { bgcolor: wf.navyHover, boxShadow: 'none' } }}>
              {t('movements.new')}
            </Button>
          )}
          <Button variant="outlined" startIcon={<ArrowBackIcon sx={flip} />} onClick={() => navigate(-1)} sx={{ height: 40, borderRadius: wf.control, borderColor: wf.border, color: wf.navy, bgcolor: wf.surface }}>
            {t('common.back')}
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: staff ? '1fr' : 'minmax(0, 1fr) 360px' }, mb: 2, alignItems: 'start' }}>
        {/* Who the worker is: photo, name, number and iqama (copyable), status, arrival and service. */}
        <Box sx={{ ...(card as object), p: { xs: 2, md: 2.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, alignItems: { sm: 'flex-start' } }}>
            <Box sx={{ flex: '0 0 auto' }}>
              {photo ? (
                <Box component="img" src={photo} alt="" sx={{ display: 'block', width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 20%', border: `2px solid ${wf.border}` }} />
              ) : (
                <Initials name={w.name} size={72} />
              )}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                <Typography component="h2" dir="ltr" sx={{ fontSize: 19, fontWeight: 600, color: wf.navy, lineHeight: 1.35, textAlign: 'start', overflowWrap: 'anywhere' }}>
                  {w.name}
                </Typography>
                <StatusPill placement={w.placement}>{status}</StatusPill>
                {staff && <StatusPill placement="Other">{t(`workforce.kind.${w.kind}`)}</StatusPill>}
              </Stack>
              <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: '4px 18px', mt: 0.75, fontSize: 13, color: wf.textSecondary, '& b': { color: wf.text, fontWeight: 600 } }}>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  {t(staff ? 'workforce.field.employeeNo' : 'workforce.col.number')} <b><bdi>{w.workerNo}</bdi></b>
                  <CopyButton value={w.workerNo} label={t(staff ? 'workforce.field.employeeNo' : 'workforce.col.number')} />
                </Box>
                {w.iqama && (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    {t('workforce.field.iqama')} <b><bdi>{w.iqama}</bdi></b>
                    <CopyButton value={w.iqama} label={t('workforce.field.iqama')} />
                  </Box>
                )}
                {worker.arrivedOn ? (
                  <span>
                    {t('workforce.field.arrived')} <b>{date(worker.arrivedOn)}</b>
                  </span>
                ) : (
                  worker.crmCreatedAt && (
                    <span>
                      {t('workforce.createdOn')} <b>{date(worker.crmCreatedAt)}</b>
                    </span>
                  )
                )}
                {since && (
                  <span>
                    {t('workforce.overview.service')} <b>{service(since) ?? '—'}</b>
                  </span>
                )}
              </Stack>
              {w.fromLedger && <Typography sx={{ mt: 0.75, fontSize: 12, color: wf.textSecondary }}>{t('workforce.fromLedger', { status: (ar ? w.crmStatusAr : w.crmStatusEn) ?? '—' })}</Typography>}
            </Box>
          </Stack>

          {/* The current project (a neutral strip), then the key facts in one simple grid. */}
          {working && (
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, mt: 2, px: 1.75, py: 1.25, borderRadius: wf.control, bgcolor: wf.subtle, border: `1px solid ${wf.border}`, flexWrap: 'wrap', '& > svg': { color: wf.navy, fontSize: 20 } }}>
              <AccountTreeOutlinedIcon />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: wf.textSecondary }}>{t('workforce.currentProject')}</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: wf.navy, overflowWrap: 'anywhere' }}>{text(w.projectName)}</Typography>
              </Box>
              <Box sx={{ flex: 1 }} />
              {w.projectJoinedOn && (
                <Typography sx={{ fontSize: 13, color: wf.textSecondary }}>
                  {t('workforce.startedOn')} <b style={{ color: wf.text }}>{date(w.projectJoinedOn)}</b>
                  {w.workDays !== null && (
                    <>
                      {' · '}
                      <b style={{ color: wf.text }}>{w.workDays.toLocaleString('en-US')}</b> {t('workforce.workDaysSuffix')}
                    </>
                  )}
                </Typography>
              )}
            </Stack>
          )}
          <Box component="dl" sx={{ m: 0, mt: 1.5, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, columnGap: 2.5 }}>
            {staff && <Row label={t('workforce.col.hired')}>{w.projectJoinedOn ? date(w.projectJoinedOn) : missing}</Row>}
            <Row label={t(staff ? 'workforce.field.jobTitle' : 'workforce.col.profession')}>{text(ar ? w.professionAr : w.professionEn)}</Row>
            <Row label={t('workforce.col.nationality')}>{text(ar ? w.nationalityAr : w.nationalityEn)}</Row>
            {!staff && <Row label={t('workforce.col.sponsor')}>{text(w.sponsor, true)}</Row>}
            <Row label={t('workforce.overview.iqamaEnds')}>{iqamaEnds ? date(iqamaEnds) : missing}</Row>
            {!staff && <Row label={t('workforce.field.agent')}>{text(worker.recruitmentAgent, true)}</Row>}
            {!staff && <Row label={t('workforce.overview.lastPrice')}>{lastPrice === null ? missing : money(lastPrice)}</Row>}
          </Box>
        </Box>

        {!staff && (
          <Overview usage={usage} projectDays={projectDays} housingDays={housingDays} projects={projects} profit={seesProfit ? profit : undefined} loading={periods === null} />
        )}
      </Box>

      <Box sx={{ ...(card as object), overflow: 'hidden' }}>
        <UnderlineTabs<Tab>
          value={tab}
          onChange={setTab}
          label={title}
          options={[
            { value: 'info', label: t(staff ? 'workforce.tabs.staffInfo' : 'workforce.tabs.info') },
            { value: 'actions', label: t(staff ? 'workforce.tabs.staffActions' : 'workforce.tabs.actions'), count: periods?.length },
            ...(staff || !can('billing.invoices.view', true) ? [] : [{ value: 'invoices' as const, label: t('workforce.tabs.invoices') }]),
            { value: 'ids', label: t('workforce.ui.idsTab'), count: worker.identifiers.length },
            ...(staff ? [] : [{ value: 'profile' as const, label: t('workforce.tabs.profile') }]),
            ...(staff || !can('workforce.costs.view', true) ? [] : [{ value: 'cost' as const, label: t('workforce.tabs.cost') }]),
          ]}
        />

        <Box role="tabpanel" sx={{ p: { xs: 1.5, md: 2.5 } }}>
          {tab === 'invoices' ? (
            <WorkerInvoices workerId={id!} />
          ) : tab === 'actions' ? (
            periods ? <WorkerActions workerId={id!} periods={periods} withDocuments={!staff} /> : <LinearProgress />
          ) : tab === 'cost' ? (
            <WorkerCostTab workerId={id!} name={w.name} />
          ) : tab === 'profile' ? (
            <WorkerProfileTab workerId={id!} />
          ) : tab === 'info' ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
              <Stack spacing={2}>
                <Section title={t('workforce.sections.basic')} icon={<BadgeOutlinedIcon />}>
                  <Row label={t(staff ? 'workforce.field.employeeNo' : 'workforce.col.number')}>
                    <bdi>{w.workerNo}</bdi>
                  </Row>
                  <Row label={t('workforce.field.iqama')}>{text(w.iqama, true)}</Row>
                  <Row label={t('workforce.field.name')} wide>
                    <bdi>{w.name}</bdi>
                  </Row>
                  <Row label={t('workforce.col.nationality')}>{text(ar ? w.nationalityAr : w.nationalityEn)}</Row>
                  <Row label={t('workforce.col.status')}>
                    <StatusPill placement={w.placement}>{status}</StatusPill>
                  </Row>
                </Section>

                {staff ? (
                  <Section title={t('workforce.sections.staffJob')} icon={<WorkOutlineOutlinedIcon />}>
                    <Row label={t('workforce.field.jobTitle')} wide>{text(ar ? w.professionAr : w.professionEn)}</Row>
                    <Row label={t('workforce.col.hired')}>{w.projectJoinedOn ? date(w.projectJoinedOn) : missing}</Row>
                    <Row label={t('workforce.field.arrived')}>{worker.arrivedOn ? date(worker.arrivedOn) : missing}</Row>
                    <Row label={t('workforce.field.iqamaProfession')} wide>{text(ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn)}</Row>
                  </Section>
                ) : (
                  <Section title={t('workforce.sections.job')} icon={<AccountTreeOutlinedIcon />}>
                    <Row label={t('workforce.col.profession')}>{text(ar ? w.professionAr : w.professionEn)}</Row>
                    <Row label={t('workforce.col.sponsor')}>{text(w.sponsor, true)}</Row>
                    <Row label={t('workforce.field.project')} wide>{text(w.projectName)}</Row>
                    <Row label={t('workforce.field.projectJoined')}>{w.projectJoinedOn ? date(w.projectJoinedOn) : missing}</Row>
                    <Row label={t('workforce.col.workDays')}>{days(w.workDays)}</Row>
                    <Row label={t('workforce.field.iqamaProfession')}>{text(ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn)}</Row>
                    <Row label={t('workforce.field.arrived')}>{worker.arrivedOn ? date(worker.arrivedOn) : missing}</Row>
                    <Row label={t('workforce.field.agent')} wide>{text(worker.recruitmentAgent, true)}</Row>
                  </Section>
                )}
              </Stack>

              <Stack spacing={2}>
                <Section title={t('workforce.sections.salary')} icon={<PaidOutlinedIcon />}>
                  {w.salary ? (
                    <>
                      <Row label={t('workforce.salary.basic')}>{money(w.salary.basic)}</Row>
                      <Row label={t('workforce.salary.housing')}>{money(w.salary.housing)}</Row>
                      <Row label={t('workforce.salary.food')}>{money(w.salary.food)}</Row>
                      <Row label={t('workforce.salary.transport')}>{money(w.salary.transport)}</Row>
                      <Row label={t('workforce.salary.overtime')}>{money(w.salary.overtime)}</Row>
                      <Row label={t('workforce.salary.other')}>{money(w.salary.other)}</Row>
                      <Row label={t(staff ? 'workforce.salary.fixed' : 'workforce.salary.project')}>{money(w.salary.project)}</Row>
                      {w.salary.hardship > 0 && <Row label={t('workforce.salary.hardship')}>{money(w.salary.hardship)}</Row>}
                      <Row label={t('workforce.salary.total')} highlight>
                        {money(w.salary.total)}
                      </Row>
                    </>
                  ) : (
                    <Typography sx={{ gridColumn: '1 / -1', fontSize: 13, color: wf.textSecondary }}>{t('workforce.noSalaryPermission')}</Typography>
                  )}
                </Section>

                <Section title={t('workforce.sections.contract')} icon={<DescriptionOutlinedIcon />}>
                  <Row label={t('workforce.field.contractStart')}>{worker.contract.startsOn ? date(worker.contract.startsOn) : missing}</Row>
                  <Row label={t('workforce.field.contractMonths')}>
                    {worker.contract.months === null ? missing : (
                      <>
                        {worker.contract.months}
                        {unit(t('workforce.months'))}
                      </>
                    )}
                  </Row>
                  <Row label={t('workforce.field.contractEnd')}>{worker.contract.endsOn ? date(worker.contract.endsOn) : missing}</Row>
                </Section>

                <Section title={t('workforce.sections.leave')} icon={<BeachAccessOutlinedIcon />}>
                  <Row label={t('workforce.leave.annual')}>{days(worker.leave.annualDays)}</Row>
                  <Row label={t('workforce.leave.balance')}>{days(worker.leave.balance)}</Row>
                  <Row label={t('workforce.leave.oldConsumed')}>{days(worker.leave.oldConsumed)}</Row>
                  <Row label={t('workforce.leave.consumed')}>{days(worker.leave.consumed)}</Row>
                  <Row label={t('workforce.leave.remaining')} highlight>
                    {days(worker.leave.remaining)}
                  </Row>
                </Section>
              </Stack>
            </Box>
          ) : (
            <Identifiers worker={worker} date={date} />
          )}

          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 2, fontSize: 12.5, color: wf.textSecondary }}>
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
            {t('workforce.readOnly')}
          </Stack>
        </Box>
      </Box>
      {acting && <ActionDialog workerId={w.id} onClose={() => setActing(false)} onSent={() => setSent((n) => n + 1)} />}
    </Box>
  );
}

/**
 * «الملخص التشغيلي»: the share of the days on projects since arrival (project days ÷ project and housing days, as
 * before), as a small navy ring, then the project and housing days, the projects and the last month's profit.
 */
function Overview({ usage, projectDays, housingDays, projects, profit, loading }: { usage: number | null; projectDays: number; housingDays: number; projects: number; profit: number | null | undefined; loading: boolean }) {
  const { t } = useTranslation();
  const n = (v: number) => v.toLocaleString('en-US');
  const rows: { label: string; value: ReactNode }[] = [
    { label: t('workforce.overview.projectDays'), value: n(projectDays) },
    { label: t('workforce.overview.housingDays'), value: n(housingDays) },
    { label: t('workforce.overview.projects'), value: n(projects) },
  ];
  if (profit !== undefined) {
    rows.push({
      label: t('workforce.overview.profit'),
      value: profit === null ? '—' : (
        <>
          {profit.toLocaleString('en-US', { maximumFractionDigits: 0 })} <small style={{ fontWeight: 500, color: wf.textSecondary }}>{t('workforce.sar')}</small>
        </>
      ),
    });
  }
  const ring = usage ?? 0;
  const r = 30;
  const circumference = 2 * Math.PI * r;
  return (
    <Box component="section" sx={{ ...(card as object), p: 2.5 }}>
      <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600, color: wf.navy, mb: 1.5 }}>
        {t('workforce.ui.opsTitle')}
      </Typography>
      <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
        <Box role="img" aria-label={t('workforce.overview.usage', { value: usage ?? '—' })} sx={{ position: 'relative', flex: '0 0 auto', width: 76, height: 76 }}>
          <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden>
            <circle cx="38" cy="38" r={r} fill="none" stroke={wf.subtle} strokeWidth="7" />
            {ring > 0 && <circle cx="38" cy="38" r={r} fill="none" stroke={wf.navy} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(circumference * ring) / 100} ${circumference}`} transform="rotate(-90 38 38)" />}
          </svg>
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 600, color: wf.navy, fontVariantNumeric: 'tabular-nums' }}>
            <bdi>{loading || usage === null ? '—' : `${usage}%`}</bdi>
          </Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: wf.text }}>{t('workforce.ui.usageLabel')}</Typography>
          <Typography sx={{ mt: 0.25, fontSize: 12.5, color: wf.textSecondary, lineHeight: 1.5 }}>{t('workforce.ui.usageHint')}</Typography>
        </Box>
      </Stack>
      <Box component="dl" sx={{ m: 0, mt: 1.5 }}>
        {rows.map((row) => (
          <Stack key={row.label} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', py: 1, borderTop: `1px solid ${wf.subtle}`, fontSize: 13.5 }}>
            <Box component="dt" sx={{ color: wf.textSecondary }}>
              {row.label}
            </Box>
            <Box component="dd" sx={{ m: 0, fontWeight: 600, color: wf.text, fontVariantNumeric: 'tabular-nums' }}>
              {row.value}
            </Box>
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

/** Identity numbers with their expiry: expired (red), within 60 days (amber). */
function Identifiers({ worker, date }: { worker: WorkerDetail; date: (v: string | null) => string }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  if (worker.identifiers.length === 0) {
    return <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('workforce.noIds')}</Typography>;
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('workforce.ids.type')}</TableCell>
            <TableCell>{t('workforce.ids.number')}</TableCell>
            <TableCell>{t('workforce.ids.expires')}</TableCell>
            <TableCell>{t('common.status')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {worker.identifiers.map((i) => {
            const expiry = i.expiresOn?.slice(0, 10);
            const tone = !expiry ? null : expiry < today ? 'danger' : expiry <= soon ? 'warning' : 'success';
            return (
              <TableRow key={`${i.type}-${i.number}`}>
                <TableCell>{t(`workforce.idType.${i.type}`)}</TableCell>
                <TableCell dir="ltr" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {i.number}
                </TableCell>
                <TableCell>
                  {tone ? <Badge tone={tone}>{`${date(i.expiresOn)}${tone === 'danger' ? ` — ${t('workforce.ids.expired')}` : tone === 'warning' ? ` — ${t('workforce.ids.soon')}` : ''}`}</Badge> : '—'}
                </TableCell>
                <TableCell>
                  {i.isCurrent ? <Badge tone="success">{t('workforce.ids.current')}</Badge> : <Badge tone="warning">{t('workforce.ids.duplicate')}</Badge>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
