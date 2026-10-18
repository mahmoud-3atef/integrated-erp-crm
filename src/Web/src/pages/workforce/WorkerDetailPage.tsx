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
import { Alert, Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../app/session';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workforceApi, type WorkerDetail, type WorkerKind } from '../../api/workforce';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { Badge, Initials, PillTabs } from '../../components/ui';
import { WorkerPeriods } from './WorkerPeriods';
import { placementLook } from '../../components/workforce/placement';

/**
 * One worker's or staff member's file, laid out as the old employee page: header with the key facts, then the data
 * sections. Staff have no supplier, agent, current project or work days; their job section shows the job title and
 * joining date.
 */
export function WorkerDetailPage({ kind }: { kind: WorkerKind }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { id } = useParams();
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [tab, setTab] = useState<'info' | 'ids' | 'periods'>(() => (new URLSearchParams(window.location.search).get('tab') === 'periods' ? 'periods' : 'info'));
  const [error, setError] = useState<string | null>(null);
  const ar = i18n.language === 'ar';

  useEffect(() => {
    workforceApi.get(kind, id!).then(setWorker).catch((failure: unknown) => setError(errorKey(failure)));
  }, [kind, id]);

  if (!worker) {
    return <ErrorMessage messageKey={error} />;
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
  const flip = { transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' };

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, mb: 1 }}>
        {!staff && can('operations.movements.manage', true) && (
          <Button variant="outlined" startIcon={<MultipleStopOutlinedIcon />} onClick={() => navigate(`/operations/movements/new?worker=${w.id}`)}>
            {t('movements.new')}
          </Button>
        )}
        <Button startIcon={<ArrowBackIcon sx={flip} />} onClick={() => navigate(-1)}>
          {t('common.back')}
        </Button>
      </Stack>
      <ErrorMessage messageKey={error} />
      {worker.removedInCrm && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('workforce.removedInCrm')}
        </Alert>
      )}

      {/* Header (.cp-ed-hero): identity, then the key facts. */}
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: '20px 22px', mb: `${tokens.gap}px` }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 2, mb: 2.25 }}>
          <Box sx={{ borderRadius: '50%', boxShadow: `0 0 0 4px ${tokens.navy50}` }}>
            <Initials name={w.name} size={64} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" dir="ltr" sx={{ fontSize: 20, fontWeight: 700, color: tokens.navy800, mb: 0.5, textAlign: 'start', overflowWrap: 'anywhere' }}>
              {w.name}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, color: tokens.gray600, '& svg': { fontSize: 16, color: tokens.navy400, marginInlineEnd: 0.75, verticalAlign: 'text-bottom' } }}>
              <span>
                <TagOutlinedIcon />
                <span dir="ltr">{w.workerNo}</span>
              </span>
              {w.iqama && (
                <span>
                  <BadgeOutlinedIcon />
                  <span dir="ltr">{w.iqama}</span>
                </span>
              )}
              {worker.crmCreatedAt && (
                <span>
                  <CalendarMonthOutlinedIcon />
                  {t('workforce.createdOn')} <b>{date(worker.crmCreatedAt)}</b>
                </span>
              )}
              <span>
                <Badge tone={staff ? 'primary' : 'neutral'}>{t(`workforce.kind.${w.kind}`)}</Badge>
              </span>
            </Stack>
          </Box>
        </Stack>

        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' }, gap: 1.25 }}>
          {/* Status card (.cp-ed-fact-status). */}
          <Box
            sx={{
              gridColumn: { xs: 'span 2', md: working || staff ? 'span 3' : '1 / -1' },
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 1.5,
              alignItems: 'center',
              p: '10px 14px',
              borderRadius: `${tokens.radius}px`,
              bgcolor: look.soft,
              borderInlineStart: `4px solid ${look.tone}`,
            }}
          >
            <Box sx={{ gridRow: '1 / span 2', display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: '12px', bgcolor: look.tone, color: '#fff', '& svg': { fontSize: 20 } }}>
              {look.icon}
            </Box>
            <Typography component="dt" sx={{ fontSize: 12, color: tokens.gray500 }}>
              {t('workforce.col.status')}
            </Typography>
            <Typography component="dd" sx={{ m: 0, fontSize: 15, fontWeight: 800, color: look.tone }}>
              {status}
              {w.fromLedger && (
                <Typography component="span" sx={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: tokens.gray500 }}>
                  {t('workforce.fromLedger', { status: (ar ? w.crmStatusAr : w.crmStatusEn) ?? '—' })}
                </Typography>
              )}
            </Typography>
          </Box>
          {working && (
            <Fact wide icon={<AccountTreeOutlinedIcon />} label={t('workforce.currentProject')}>
              {w.projectName ?? '—'}
              {w.projectJoinedOn && (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: '4px 10px', mt: 0.5, fontSize: 12, fontWeight: 500, color: tokens.gray600 }}>
                  <span>
                    {t('workforce.startedOn')} <b>{date(w.projectJoinedOn)}</b>
                  </span>
                  {w.workDays !== null && (
                    <span>
                      <b>{w.workDays}</b> {t('workforce.workDaysSuffix')}
                    </span>
                  )}
                </Stack>
              )}
            </Fact>
          )}
          {staff && (
            <Fact wide icon={<CalendarMonthOutlinedIcon />} label={t('workforce.col.hired')}>
              {date(w.projectJoinedOn)}
            </Fact>
          )}
          <Fact icon={<WorkOutlineOutlinedIcon />} label={t(staff ? 'workforce.field.jobTitle' : 'workforce.col.profession')} wide={staff}>
            {(ar ? w.professionAr : w.professionEn) ?? '—'}
          </Fact>
          <Fact icon={<FlagOutlinedIcon />} label={t('workforce.col.nationality')} wide={staff}>
            {(ar ? w.nationalityAr : w.nationalityEn) ?? '—'}
          </Fact>
          {!staff && (
            <Fact icon={<LocalShippingOutlinedIcon />} label={t('workforce.col.sponsor')}>
              <span dir="ltr">{w.sponsor ?? '—'}</span>
            </Fact>
          )}
        </Box>
      </Box>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'info', label: t('workforce.tabs.info') },
            { value: 'ids', label: t('workforce.tabs.ids', { count: worker.identifiers.length }) },
            ...(staff ? [] : [{ value: 'periods' as const, label: t('workforce.tabs.periods') }]),
          ]}
        />

        {tab === 'periods' ? (
          <WorkerPeriods kind={kind} workerId={id!} />
        ) : tab === 'info' ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
            <Stack spacing={2.5}>
              <FieldSection title={t('workforce.sections.basic')} icon={<BadgeOutlinedIcon />}>
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
                <FieldSection title={t('workforce.sections.job')} icon={<AccountTreeOutlinedIcon />}>
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
              <FieldSection title={t('workforce.sections.salary')} icon={<PaidOutlinedIcon />} tone="green">
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
                  </>
                ) : (
                  <Typography sx={{ gridColumn: '1 / -1', fontSize: 13, color: tokens.gray500 }}>{t('workforce.noSalaryPermission')}</Typography>
                )}
              </FieldSection>

              <FieldSection title={t('workforce.sections.contract')} icon={<DescriptionOutlinedIcon />} tone="sky">
                <FieldBox label={t('workforce.field.contractStart')} icon={<EventAvailableOutlinedIcon />}>{date(worker.contract.startsOn)}</FieldBox>
                <FieldBox label={t('workforce.field.contractMonths')} icon={<HourglassBottomOutlinedIcon />}>
                  {worker.contract.months ?? '—'}
                  {worker.contract.months !== null && unit(t('workforce.months'))}
                </FieldBox>
                <FieldBox label={t('workforce.field.contractEnd')} icon={<EventBusyOutlinedIcon />}>{date(worker.contract.endsOn)}</FieldBox>
              </FieldSection>

              <FieldSection title={t('workforce.sections.leave')} icon={<BeachAccessOutlinedIcon />} tone="sky">
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
          {t('workforce.readOnly')}
        </Stack>
      </Box>
    </Box>
  );
}

function Fact({ icon, label, children, wide }: { icon: ReactNode; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <Box sx={{ gridColumn: { xs: wide ? 'span 2' : 'span 1', md: wide ? 'span 3' : 'span 2' }, p: '10px 14px', borderRadius: `${tokens.radius}px`, bgcolor: wide ? tokens.navy50 : tokens.gray50, minWidth: 0 }}>
      <Typography component="dt" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: tokens.gray500, mb: 0.25, '& svg': { fontSize: 16, color: tokens.navy400 } }}>
        {icon}
        {label}
      </Typography>
      <Box component="dd" sx={{ m: 0, fontSize: wide ? 15 : 14, fontWeight: 600, color: tokens.navy800, overflowWrap: 'anywhere' }}>
        {children}
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
