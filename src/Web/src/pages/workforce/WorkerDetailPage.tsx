import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MultipleStopOutlinedIcon from '@mui/icons-material/MultipleStopOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import FlightLandOutlinedIcon from '@mui/icons-material/FlightLandOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MoreTimeOutlinedIcon from '@mui/icons-material/MoreTimeOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import WalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { Alert, Box, Button, LinearProgress, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../app/session';
import { ActionDialog } from '../operations/movements/ActionDialog';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workforceApi, type WorkerDetail, type WorkerKind, type WorkerPeriod } from '../../api/workforce';
import { photoUrl, profileApi } from '../../api/showroom';
import { ceoApi } from '../../api/reports';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { SalaryChangesList, WorkerDataDialog, WorkerSalaryDialog } from './WorkerEditDialogs';
import { Badge, Initials, PillTabs } from '../../components/ui';
import { WorkerActions, periodDays } from './WorkerActions';
import { WorkerInvoices } from './WorkerInvoices';
import { useService } from '../staff/staff';
import { WorkerProfileTab } from './WorkerProfileTab';
import { WorkerCostTab } from './WorkerCostTab';
import { placementLook } from '../../components/workforce/placement';
import { useCrumb } from '../../app/breadcrumbs';

type Tab = 'info' | 'actions' | 'invoices' | 'ids' | 'profile' | 'cost';

/**
 * One worker's or staff member's file, laid out as the old employee page (HR_EmployeeDetails.aspx, as the staff file):
 * the hero with the key facts and the dark «ملخص عام» card, pill tabs, then the data sections; the actions tab is the
 * old screen's actions timeline, each action opening its document. Staff have no supplier, agent, current project,
 * work days, invoices, marketing profile or cost.
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
  const [editing, setEditing] = useState<'data' | 'salary' | 'request' | null>(null);
  const [version, setVersion] = useState(0);
  const ar = i18n.language === 'ar';

  useEffect(() => {
    workforceApi.get(kind, id!).then(setWorker).catch((failure: unknown) => setError(errorKey(failure)));
  }, [kind, id, version]);

  useEffect(() => {
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
  const look = placementLook[w.placement];
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
  // The project of the open work period, to open its page from the header.
  const openWork = (periods ?? []).find((p) => p.kind === 'Work' && p.endsOn === null);
  const currentProjectId = openWork?.projectId ?? openWork?.projectCrmId ?? null;
  const flip = { transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' };
  const tally = (kinds: string[]) => (periods ?? []).filter((p) => kinds.includes(p.kind)).reduce((sum, p) => sum + periodDays(p), 0);
  const projectDays = tally(['Work', 'ClientVacation']);
  const housingDays = tally(['Housing']);
  const projects = new Set((periods ?? []).filter((p) => p.kind === 'Work' && p.projectName).map((p) => p.projectName)).size;
  const usage = projectDays + housingDays > 0 ? Math.round((projectDays * 100) / (projectDays + housingDays)) : null;
  const lastPrice = (periods ?? []).find((p) => p.kind === 'Work' && p.totalPrice !== null)?.totalPrice ?? null;
  const iqamaEnds = worker.identifiers.find((i) => i.type === 'Iqama' && i.isCurrent)?.expiresOn ?? null;
  const since = (worker.arrivedOn ?? worker.crmCreatedAt)?.slice(0, 10) ?? null;
  // Each part of the file has its own permission (the user's request, 2026-10-25); a staff file stays read-only here.
  const canEditData = !staff && can('workforce.workers.edit', true);
  const canEditSalary = !staff && !!w.salary && can('workforce.workers.salary_edit', true);
  const canRequestSalary = !staff && !!w.salary && can('workforce.salary_changes.request', true);
  const editButton = (onClick: () => void, label = t('workforce.edit.action')) => (
    <Button size="small" variant="outlined" onClick={onClick} sx={{ borderRadius: 99, height: 30, borderColor: tokens.border, color: tokens.navy800, fontWeight: 600, bgcolor: '#fff' }}>
      {label}
    </Button>
  );
  const dataActions = canEditData ? editButton(() => setEditing('data')) : undefined;
  const edited = (changeId?: string) => {
    setEditing(null);
    setVersion((n) => n + 1);
    if (changeId) navigate(`/workforce/salary-changes/${changeId}`);
  };

  return (
    <Box>
      <ErrorMessage messageKey={error} />
      {worker.removedInCrm && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('workforce.removedInCrm')}
        </Alert>
      )}

      {/* The hero (.cp-ed-hero) and the overview (.cp-ed-summary) */}
      <Box sx={{ display: 'grid', gap: `${tokens.gap}px`, gridTemplateColumns: { xs: '1fr', lg: staff ? '1fr' : 'minmax(0, 1fr) 380px' }, mb: `${tokens.gap}px` }}>
        <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: { xs: 2, md: 2.75 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' }, flexWrap: 'wrap' }}>
            <Stack direction="row" sx={{ gap: 2, alignItems: 'center', flex: { md: '1 1 320px' }, minWidth: 0 }}>
              <Box sx={{ flex: '0 0 auto', borderRadius: '50%', boxShadow: `0 0 0 4px ${tokens.navy50}` }}>
                {photo ? (
                  <Box component="img" src={photo} alt="" sx={{ display: 'block', width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                ) : (
                  <Initials name={w.name} size={72} />
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, color: tokens.navy800, lineHeight: 1.3, textAlign: 'start', overflowWrap: 'break-word' }}>
                  <bdi>{w.name}</bdi>
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: '4px 16px', mt: 0.25, fontSize: 12.5, color: tokens.gray600, '& svg': { fontSize: 15, color: tokens.navy400, verticalAlign: 'middle', marginInlineEnd: 0.4 } }}>
                  <span>
                    <TagOutlinedIcon />
                    <bdi>{w.workerNo}</bdi>
                  </span>
                  {w.iqama && (
                    <span>
                      <BadgeOutlinedIcon />
                      <bdi>{w.iqama}</bdi>
                    </span>
                  )}
                  {worker.arrivedOn ? (
                    <span>
                      <FlightLandOutlinedIcon />
                      {t('workforce.field.arrived')} <b>{date(worker.arrivedOn)}</b>
                    </span>
                  ) : (
                    worker.crmCreatedAt && (
                      <span>
                        <CalendarMonthOutlinedIcon />
                        {t('workforce.createdOn')} <b>{date(worker.crmCreatedAt)}</b>
                      </span>
                    )
                  )}
                  {staff && (
                    <span>
                      <Badge tone="primary">{t(`workforce.kind.${w.kind}`)}</Badge>
                    </span>
                  )}
                </Stack>
              </Box>
            </Stack>
            <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography component="p" sx={{ color: look.tone, fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 0.75, '& svg': { fontSize: 22 } }}>
                {look.icon}
                {status}
              </Typography>
              {since && (
                <Box sx={{ display: 'inline-flex', gap: 1, alignItems: 'center', border: '1px solid #cfe3ec', borderRadius: 99, px: 1.75, py: 0.6, bgcolor: '#f3f9fc', fontSize: 12.5 }}>
                  <b style={{ color: tokens.navy700 }}>{t('workforce.overview.service')}</b>
                  <span style={{ color: tokens.gray500 }}>{service(since) ?? '—'}</span>
                </Box>
              )}
              {can('operations.movements.manage', true) && (
                <Button variant="contained" startIcon={<MultipleStopOutlinedIcon />} onClick={() => setActing(true)} sx={{ borderRadius: 99, bgcolor: tokens.navy800, boxShadow: '0 6px 14px rgba(10,60,88,.25)', px: 2.5 }}>
                  {t('movements.new')}
                </Button>
              )}
              <Button startIcon={<ArrowBackIcon sx={flip} />} onClick={() => navigate(-1)} sx={{ borderRadius: 99 }}>
                {t('common.back')}
              </Button>
            </Stack>
          </Stack>
          {w.fromLedger && (
            <Typography sx={{ mt: 1, fontSize: 12, color: tokens.gray500 }}>{t('workforce.fromLedger', { status: (ar ? w.crmStatusAr : w.crmStatusEn) ?? '—' })}</Typography>
          )}

          <Box component="dl" sx={{ m: 0, mt: 1.75, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
            {working && (
              <Fact wide icon={<AccountTreeOutlinedIcon />} label={t('workforce.currentProject')}>
                {/* The project in gold, opening its page; the start date and the days at the end of the line. */}
                <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  {currentProjectId ? (
                    <Link component={RouterLink} to={`/commercial/projects/${currentProjectId}`} underline="hover" sx={{ flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: 800, color: '#9A6B12' }}>
                      {w.projectName ?? '—'}
                    </Link>
                  ) : (
                    <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: 800, color: '#9A6B12' }}>
                      {w.projectName ?? '—'}
                    </Box>
                  )}
                  {w.projectJoinedOn && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.35, borderRadius: 99, bgcolor: '#e6eefb', color: '#1d4f91', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {t('workforce.startedOn')} <b>{date(w.projectJoinedOn)}</b>
                    </Box>
                  )}
                  {w.workDays !== null && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.35, borderRadius: 99, bgcolor: '#e6f4ec', color: '#16734b', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      <b>{w.workDays}</b> {t('workforce.workDaysSuffix')}
                    </Box>
                  )}
                </Stack>
              </Fact>
            )}
            {staff && (
              <Fact wide icon={<CalendarMonthOutlinedIcon />} label={t('workforce.col.hired')}>
                {date(w.projectJoinedOn)}
              </Fact>
            )}
            <Fact icon={<WorkOutlineOutlinedIcon />} label={t(staff ? 'workforce.field.jobTitle' : 'workforce.col.profession')}>
              {(ar ? w.professionAr : w.professionEn) ?? '—'}
            </Fact>
            <Fact icon={<FlagOutlinedIcon />} label={t('workforce.col.nationality')}>
              {(ar ? w.nationalityAr : w.nationalityEn) ?? '—'}
            </Fact>
            {staff ? (
              <Fact icon={<CreditCardOutlinedIcon />} label={t('workforce.overview.iqamaEnds')}>
                {date(iqamaEnds)}
              </Fact>
            ) : (
              <>
                <Fact icon={<LocalShippingOutlinedIcon />} label={t('workforce.col.sponsor')}>
                  <bdi>{w.sponsor ?? '—'}</bdi>
                </Fact>
                <Fact icon={<CreditCardOutlinedIcon />} label={t('workforce.overview.iqamaEnds')}>
                  {date(iqamaEnds)}
                </Fact>
                <Fact icon={<SupportAgentOutlinedIcon />} label={t('workforce.field.agent')}>
                  <bdi>{worker.recruitmentAgent ?? '—'}</bdi>
                </Fact>
                <Fact icon={<SellOutlinedIcon />} label={t('workforce.overview.lastPrice')}>
                  {lastPrice === null ? '—' : money(lastPrice)}
                </Fact>
              </>
            )}
          </Box>
        </Box>

        {!staff && (
          <Overview usage={usage} projectDays={projectDays} housingDays={housingDays} projects={projects} profit={seesProfit ? profit : undefined} loading={periods === null} />
        )}
      </Box>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
        <PillTabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'info', label: t(staff ? 'workforce.tabs.staffInfo' : 'workforce.tabs.info') },
            { value: 'actions', label: periods ? t(staff ? 'workforce.tabs.staffActionsCount' : 'workforce.tabs.actionsCount', { count: periods.length }) : t(staff ? 'workforce.tabs.staffActions' : 'workforce.tabs.actions') },
            ...(staff || !can('billing.invoices.view', true) ? [] : [{ value: 'invoices' as const, label: t('workforce.tabs.invoices') }]),
            { value: 'ids', label: t('workforce.tabs.ids', { count: worker.identifiers.length }) },
            ...(staff ? [] : [{ value: 'profile' as const, label: t('workforce.tabs.profile') }]),
            ...(staff || !can('workforce.costs.view', true) ? [] : [{ value: 'cost' as const, label: t('workforce.tabs.cost') }]),
          ]}
        />

        {tab === 'invoices' ? (
          <WorkerInvoices workerId={id!} />
        ) : tab === 'actions' ? (
          periods ? <WorkerActions workerId={id!} periods={periods} withDocuments={!staff} /> : <LinearProgress />
        ) : tab === 'cost' ? (
          <WorkerCostTab workerId={id!} name={w.name} />
        ) : tab === 'profile' ? (
          <WorkerProfileTab workerId={id!} />
        ) : tab === 'info' ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
            <Stack spacing={2.5}>
              <FieldSection title={t('workforce.sections.basic')} icon={<BadgeOutlinedIcon />} actions={dataActions}>
                <FieldBox label={t(staff ? 'workforce.field.employeeNo' : 'workforce.col.number')} icon={<TagOutlinedIcon />}>
                  <span dir="ltr">{w.workerNo}</span>
                </FieldBox>
                <FieldBox label={t('workforce.field.iqama')} icon={<CreditCardOutlinedIcon />}>
                  <span dir="ltr">{w.iqama ?? '—'}</span>
                </FieldBox>
                <FieldBox label={t('workforce.field.name')} icon={<PersonOutlinedIcon />} wide>
                  <span dir="ltr">{w.name}</span>
                </FieldBox>
                <FieldBox label={t('workforce.col.nationality')} icon={<FlagOutlinedIcon />}>
                  {(ar ? w.nationalityAr : w.nationalityEn) ?? '—'}
                </FieldBox>
                <FieldBox label={t('workforce.col.status')} icon={look.icon}>
                  <Box component="span" sx={{ color: look.tone }}>
                    {status}
                  </Box>
                </FieldBox>
              </FieldSection>

              {staff ? (
                <FieldSection title={t('workforce.sections.staffJob')} icon={<WorkOutlineOutlinedIcon />}>
                  <FieldBox label={t('workforce.field.jobTitle')} icon={<WorkOutlineOutlinedIcon />} wide>
                    {(ar ? w.professionAr : w.professionEn) ?? '—'}
                  </FieldBox>
                  <FieldBox label={t('workforce.col.hired')} icon={<CalendarMonthOutlinedIcon />}>
                    {date(w.projectJoinedOn)}
                  </FieldBox>
                  <FieldBox label={t('workforce.field.arrived')} icon={<FlightLandOutlinedIcon />}>
                    {date(worker.arrivedOn)}
                  </FieldBox>
                  <FieldBox label={t('workforce.field.iqamaProfession')} icon={<CreditCardOutlinedIcon />} wide>
                    {(ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn) ?? '—'}
                  </FieldBox>
                </FieldSection>
              ) : (
                <FieldSection title={t('workforce.sections.job')} icon={<AccountTreeOutlinedIcon />} actions={dataActions}>
                  <FieldBox label={t('workforce.col.profession')} icon={<WorkOutlineOutlinedIcon />}>
                    {(ar ? w.professionAr : w.professionEn) ?? '—'}
                  </FieldBox>
                  <FieldBox label={t('workforce.col.sponsor')} icon={<LocalShippingOutlinedIcon />}>
                    <span dir="ltr">{w.sponsor ?? '—'}</span>
                  </FieldBox>
                  <FieldBox label={t('workforce.field.project')} icon={<AccountTreeOutlinedIcon />} wide>
                    {w.projectName ?? '—'}
                  </FieldBox>
                  <FieldBox label={t('workforce.field.projectJoined')} icon={<CalendarMonthOutlinedIcon />}>
                    {date(w.projectJoinedOn)}
                  </FieldBox>
                  <FieldBox label={t('workforce.col.workDays')} icon={<ScheduleOutlinedIcon />}>
                    {days(w.workDays)}
                  </FieldBox>
                  <FieldBox label={t('workforce.field.iqamaProfession')} icon={<CreditCardOutlinedIcon />}>
                    {(ar ? worker.iqamaProfessionAr : worker.iqamaProfessionEn) ?? '—'}
                  </FieldBox>
                  <FieldBox label={t('workforce.field.arrived')} icon={<FlightLandOutlinedIcon />}>
                    {date(worker.arrivedOn)}
                  </FieldBox>
                  <FieldBox label={t('workforce.field.agent')} icon={<SupportAgentOutlinedIcon />} wide>
                    <span dir="ltr">{worker.recruitmentAgent ?? '—'}</span>
                  </FieldBox>
                </FieldSection>
              )}
            </Stack>

            <Stack spacing={2.5}>
              <FieldSection
                title={t('workforce.sections.salary')}
                icon={<PaidOutlinedIcon />}
                tone="green"
                actions={
                  canEditSalary || canRequestSalary ? (
                    <>
                      {canRequestSalary && editButton(() => setEditing('request'), t('workforce.edit.requestAction'))}
                      {canEditSalary && editButton(() => setEditing('salary'))}
                    </>
                  ) : undefined
                }
              >
                {w.salary ? (
                  <>
                    <FieldBox label={t('workforce.salary.basic')} icon={<PaidOutlinedIcon />}>{money(w.salary.basic)}</FieldBox>
                    <FieldBox label={t('workforce.salary.housing')} icon={<HomeOutlinedIcon />}>{money(w.salary.housing)}</FieldBox>
                    <FieldBox label={t('workforce.salary.food')} icon={<RestaurantOutlinedIcon />}>{money(w.salary.food)}</FieldBox>
                    <FieldBox label={t('workforce.salary.transport')} icon={<DirectionsCarOutlinedIcon />}>{money(w.salary.transport)}</FieldBox>
                    <FieldBox label={t('workforce.salary.overtime')} icon={<MoreTimeOutlinedIcon />}>{money(w.salary.overtime)}</FieldBox>
                    <FieldBox label={t('workforce.salary.other')} icon={<RedeemOutlinedIcon />}>{money(w.salary.other)}</FieldBox>
                    <FieldBox label={t(staff ? 'workforce.salary.fixed' : 'workforce.salary.project')} icon={<WorkOutlineOutlinedIcon />}>{money(w.salary.project)}</FieldBox>
                    {w.salary.hardship > 0 && (
                      <FieldBox label={t('workforce.salary.hardship')} icon={<WorkOutlineOutlinedIcon />}>{money(w.salary.hardship)}</FieldBox>
                    )}
                    <FieldBox label={t('workforce.salary.total')} icon={<WalletOutlinedIcon />} highlight wide>
                      {money(w.salary.total)}
                    </FieldBox>
                    {!staff && <SalaryChangesList workerId={w.id} version={version} />}
                  </>
                ) : (
                  <Typography sx={{ gridColumn: '1 / -1', fontSize: 13, color: tokens.gray500 }}>{t('workforce.noSalaryPermission')}</Typography>
                )}
              </FieldSection>

              <FieldSection title={t('workforce.sections.contract')} icon={<DescriptionOutlinedIcon />} tone="sky" actions={dataActions}>
                <FieldBox label={t('workforce.field.contractStart')} icon={<EventAvailableOutlinedIcon />}>{date(worker.contract.startsOn)}</FieldBox>
                <FieldBox label={t('workforce.field.contractMonths')} icon={<HourglassBottomOutlinedIcon />}>
                  {worker.contract.months ?? '—'}
                  {worker.contract.months !== null && unit(t('workforce.months'))}
                </FieldBox>
                <FieldBox label={t('workforce.field.contractEnd')} icon={<EventBusyOutlinedIcon />}>{date(worker.contract.endsOn)}</FieldBox>
              </FieldSection>

              <FieldSection title={t('workforce.sections.leave')} icon={<BeachAccessOutlinedIcon />} tone="sky" actions={dataActions}>
                <FieldBox label={t('workforce.leave.annual')} icon={<FlightLandOutlinedIcon />}>{days(worker.leave.annualDays)}</FieldBox>
                <FieldBox label={t('workforce.leave.balance')} icon={<WalletOutlinedIcon />}>{days(worker.leave.balance)}</FieldBox>
                <FieldBox label={t('workforce.leave.oldConsumed')} icon={<HistoryOutlinedIcon />}>{days(worker.leave.oldConsumed)}</FieldBox>
                <FieldBox label={t('workforce.leave.consumed')} icon={<ScheduleOutlinedIcon />}>{days(worker.leave.consumed)}</FieldBox>
                <FieldBox label={t('workforce.leave.remaining')} icon={<BeachAccessOutlinedIcon />} highlight wide>{days(worker.leave.remaining)}</FieldBox>
              </FieldSection>
            </Stack>
          </Box>
        ) : (
          <Identifiers worker={worker} date={date} />
        )}

        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 2.5, fontSize: 12.5, color: tokens.gray500 }}>
          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          {t(canEditData || canEditSalary ? 'workforce.edit.syncNote' : 'workforce.readOnly')}
        </Stack>
      </Box>
      {editing === 'data' && <WorkerDataDialog worker={worker} onClose={() => setEditing(null)} onSaved={() => edited()} />}
      {(editing === 'salary' || editing === 'request') && w.salary && (
        <WorkerSalaryDialog workerId={w.id} salary={w.salary} request={editing === 'request'} onClose={() => setEditing(null)} onSaved={edited} />
      )}
      {acting && <ActionDialog workerId={w.id} onClose={() => setActing(false)} onSent={() => setSent((n) => n + 1)} />}
    </Box>
  );
}

/** One fact of the hero on one line: the icon and its name, then the value (the user's request of 2026-10-25, a shorter header). */
function Fact({ icon, label, children, wide }: { icon: ReactNode; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <Box sx={{ gridColumn: wide ? '1 / -1' : undefined, display: 'flex', alignItems: 'baseline', gap: 1, p: '7px 12px', borderRadius: `${tokens.radius}px`, bgcolor: wide ? tokens.navy50 : tokens.gray50, minWidth: 0 }}>
      <Typography component="dt" sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', alignSelf: 'center', gap: 0.75, fontSize: 12, color: tokens.gray500, whiteSpace: 'nowrap', '& svg': { fontSize: 16, color: tokens.navy400 } }}>
        {icon}
        {label}
      </Typography>
      <Box component="dd" sx={{ m: 0, flex: 1, minWidth: 0, fontSize: wide ? 14.5 : 13.5, fontWeight: 600, color: tokens.navy800, overflowWrap: 'anywhere' }}>
        {children}
      </Box>
    </Box>
  );
}

/** The dark overview card (.cp-ed-summary): the share of the days on projects since arrival, and the last month's profit. */
function Overview({ usage, projectDays, housingDays, projects, profit, loading }: { usage: number | null; projectDays: number; housingDays: number; projects: number; profit: number | null | undefined; loading: boolean }) {
  const { t } = useTranslation();
  const n = (v: number) => v.toLocaleString('en-US');
  const rows: { icon: ReactNode; label: string; value: ReactNode }[] = [
    { icon: <WorkOutlineOutlinedIcon />, label: t('workforce.overview.projectDays'), value: n(projectDays) },
    { icon: <HomeOutlinedIcon />, label: t('workforce.overview.housingDays'), value: n(housingDays) },
    { icon: <AccountTreeOutlinedIcon />, label: t('workforce.overview.projects'), value: n(projects) },
  ];
  if (profit !== undefined) {
    rows.push({
      icon: <TrendingUpOutlinedIcon />,
      label: t('workforce.overview.profit'),
      value: profit === null ? '—' : (
        <>
          {profit.toLocaleString('en-US', { maximumFractionDigits: 0 })} <small style={{ fontWeight: 500, opacity: 0.8 }}>{t('workforce.sar')}</small>
        </>
      ),
    });
  }
  const ring = usage ?? 0;
  return (
    <Box sx={{ borderRadius: `${tokens.radiusLg}px`, p: 2.5, color: '#fff', background: 'linear-gradient(135deg, #0a3c58 0%, #0d5e72 55%, #127c86 100%)', boxShadow: tokens.shadowSm }}>
      <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
        <Box role="img" aria-label={t('workforce.overview.usage', { value: usage ?? '—' })} sx={{ flex: '0 0 auto', width: 96, height: 96, borderRadius: '50%', background: `conic-gradient(#7ee0a8 0 ${ring}%, rgba(255,255,255,.18) ${ring}% 100%)`, display: 'grid', placeItems: 'center' }}>
          <Box sx={{ width: 78, height: 78, borderRadius: '50%', bgcolor: '#0c4a63', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800 }}>
            <bdi>{loading || usage === null ? '—' : `${usage}%`}</bdi>
          </Box>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 19, fontWeight: 800, display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <ReceiptLongOutlinedIcon />
            {t('workforce.overview.title')}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 12.5, opacity: 0.85 }}>{t('workforce.overview.usageHint')}</Typography>
        </Box>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.9, mt: 2 }}>
        {rows.map((r) => (
          <Stack key={r.label} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, bgcolor: 'rgba(255,255,255,.1)', borderRadius: '10px', px: 1.25, py: 0.8, fontSize: 12.5, '& svg': { fontSize: 16, opacity: 0.85 } }}>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              {r.icon}
              {r.label}
            </Box>
            <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {r.value}
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
