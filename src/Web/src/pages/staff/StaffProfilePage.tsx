import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import Add from '@mui/icons-material/Add';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined';
import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';
import TagIcon from '@mui/icons-material/Tag';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlineOutlined';
import { Box, Button, ButtonBase, LinearProgress, Link, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { staffApi, type ActionRow, type Contract, type Department, type StaffEvent, type StaffProfile } from '../../api/staff';
import { useCrumb } from '../../app/breadcrumbs';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { ActionDialog, ActionStatusBadge, actionIcon } from './StaffActions';
import { ContractDialog, JobDialog, PayDetailsDialog, PersonalDialog, SalaryDialog } from './StaffDialogs';
import { EmployeePayrollPanel } from '../payroll/staff/EmployeePayrollPanel';
import { EmployeeLeavePanel } from '../leave/leave';
import { EmployeeDeductionsPanel } from '../deductions/settings';
import { useService } from './staff';
import { useSession } from '../../app/session';
import { NewSettlementDialog } from '../settlements/NewSettlementDialog';

// The employee's file after the old system's latest employee screen (content/css/pages/hr-employee-details.css,
// 2026-10-14): the hero with the facts, the dark overview card, pill tabs, and boxes titled on their border with
// «تعديل». Its navy is the app's own (the HR screens' blue is not used here — a decision of the user).

const tone = { navy: '#0a3c58', navySoft: '#eaf3f8', green: '#1f9d55', greenSoft: '#e9f7ef', sky: '#1b6a92', skySoft: '#eaf4fa' } as const;
type BoxTone = 'navy' | 'green' | 'sky';
type TabKey = 'data' | 'leave' | 'deductions' | 'payroll' | 'contract' | 'history';
type Edit = 'personal' | 'job' | 'contract' | 'salary' | 'pay' | 'action' | 'settlement' | null;

/** The file's fields a change shows, by the stored property's name. */
const changeLabels: Record<string, string> = {
  NameAr: 'nameAr', NameEn: 'nameEn', IdNumber: 'idNumber', NationalityCode: 'nationality', BirthDate: 'birthDate', Mobile: 'mobile', Email: 'email', GosiNo: 'gosiNo',
  DepartmentId: 'department', PositionId: 'position', LegalEntityId: 'legalEntity', HireDate: 'hireDate', ProbationEndsOn: 'probationEnds', Status: 'status',
  ContractStartsOn: 'contractStart', ContractMonths: 'contractMonths', ContractEndsOn: 'contractEnd',
  BankName: 'bank', Iban: 'iban', AccountHolder: 'accountHolder', GosiSince: 'gosiSince',
};

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));

export function StaffProfilePage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { date } = useCommercialFormat();
  const service = useService();
  const { can } = useSession();
  const [p, setP] = useState<StaffProfile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('data');
  const [edit, setEdit] = useState<Edit>(null);
  const [version, setVersion] = useState(0);
  const navigate = useNavigate();
  const ar = i18n.language === 'ar';
  useCrumb(p ? (p.nameAr ?? p.nameEn) : undefined, `/hr/employees/${id}`);

  const reload = useCallback(async () => {
    try {
      setP(await staffApi.profile(id));
      setVersion((v) => v + 1);
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);
  useEffect(() => {
    void reload();
    staffApi.structure().then((s) => setDepartments(s.departments)).catch(() => setDepartments([]));
  }, [reload]);

  if (!p) {
    return (
      <>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </>
    );
  }

  const name = (ar ? p.nameAr : null) ?? p.nameEn;
  const d = (v: string | null) => (v ? date(v) : '—');
  const named = (r: { nameAr: string; nameEn: string } | null) => (r ? (ar ? r.nameAr : r.nameEn) : '—');
  const missing = p.missing.map((m) => t(`staff.profile.missing.${m}`)).join('، ');
  const summary =
    t('staff.profile.summaryText', { service: service(p.hireDate) ?? '—', hire: p.hireDate ? ` (${date(p.hireDate)})` : '' }) +
    (p.status === 'Probation' && p.probationEndsOn ? t('staff.profile.summaryProbation', { date: date(p.probationEndsOn) }) : '') +
    (p.contractEndsOn ? t('staff.profile.summaryContract', { date: date(p.contractEndsOn) }) : '') +
    (p.leaveRemaining !== null ? t('staff.profile.summaryLeave', { days: fmt(p.leaveRemaining) }) : '') +
    (missing ? t('staff.profile.summaryMissing', { items: missing }) : t('staff.profile.summaryDone'));
  const done = () => {
    setEdit(null);
    void reload();
  };

  return (
    <Box>
      <ErrorMessage messageKey={error} />
      {/* The hero and the overview */}
      <Box sx={{ display: 'grid', gap: `${tokens.gap}px`, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 420px' }, mb: `${tokens.gap}px` }}>
        <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: { xs: 2, md: 2.75 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
            <Stack direction="row" sx={{ gap: 2, alignItems: 'center', flex: 1, minWidth: 0 }}>
              <Box sx={{ flex: '0 0 auto', width: 62, height: 62, borderRadius: '50%', bgcolor: tokens.navy700, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 700, boxShadow: `0 0 0 4px ${tokens.navy50}` }}>
                {name.trim().charAt(0).toUpperCase()}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, color: tokens.navy800, lineHeight: 1.3 }}>
                  {name}
                </Typography>
                <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', color: tokens.gray600, fontSize: 12.5, mt: 0.25, '& svg': { fontSize: 15, color: tokens.navy400, verticalAlign: 'middle', marginInlineEnd: 0.4 } }}>
                  <span>
                    <TagIcon />
                    <bdi>{p.employeeNo}</bdi>
                  </span>
                  {p.idNumber && (
                    <span>
                      <BadgeOutlinedIcon />
                      <bdi>{p.idNumber}</bdi>
                    </span>
                  )}
                  {p.hireDate && (
                    <span>
                      <CalendarMonthOutlinedIcon />
                      {t('staff.profile.hiredBy', { date: date(p.hireDate), by: p.createdByName })}
                    </span>
                  )}
                </Stack>
              </Box>
            </Stack>
            <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ color: tokens.teal, fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <PersonOutlineIcon />
                {t(`staff.status.${p.status}`)}
              </Typography>
              <Box sx={{ display: 'inline-flex', gap: 1, alignItems: 'center', border: '1px solid #cfe3ec', borderRadius: 99, px: 1.75, py: 0.6, bgcolor: '#f3f9fc', fontSize: 12.5 }}>
                <b style={{ color: tokens.navy700 }}>{t('staff.profile.service')}</b>
                <span style={{ color: tokens.gray500 }}>{service(p.hireDate) ?? '—'}</span>
              </Box>
              {p.canEdit && (
                <Button variant="contained" startIcon={<Add />} disabled={p.status === 'Left'} onClick={() => setEdit('action')} sx={{ borderRadius: 99, bgcolor: tokens.navy800, boxShadow: '0 6px 14px rgba(10,60,88,.25)', px: 2.5 }}>
                  {t('staff.profile.newAction')}
                </Button>
              )}
              {can('payroll.settlements.manage', true) && p.status !== 'Left' && (
                <Button variant="outlined" onClick={() => setEdit('settlement')} sx={{ borderRadius: 99, borderColor: tokens.border, color: tokens.navy800 }}>
                  {t('staff.profile.endService')}
                </Button>
              )}
            </Stack>
          </Stack>
          <Box component="dl" sx={{ m: 0, mt: 2, display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
            <Fact wide icon={<ApartmentOutlinedIcon />} label={t('staff.profile.department')} value={named(p.department)} />
            <Fact icon={<WorkOutlineIcon />} label={t('staff.profile.jobTitle')} value={p.jobTitle ? `${named(p.jobTitle)}${p.grade ? ` · ${p.grade}` : ''}` : '—'} />
            <Fact icon={<FlagOutlinedIcon />} label={t('staff.profile.nationality')} value={(ar ? p.nationalityAr : p.nationalityEn) ?? '—'} />
            <Fact icon={<AccountBalanceOutlinedIcon />} label={t('staff.profile.legalEntity')} value={named(p.legalEntity)} />
            <Fact icon={<SupervisorAccountOutlinedIcon />} label={t('staff.profile.manager')} value={p.manager ? <Link component={RouterLink} to={`/hr/employees/${p.manager.id}`}>{named(p.manager)}</Link> : '—'} />
            <Fact icon={<HourglassBottomOutlinedIcon />} label={t('staff.profile.probationEnds')} value={d(p.probationEndsOn)} warn={p.status === 'Probation'} />
            <Fact icon={<DescriptionOutlinedIcon />} label={t('staff.profile.contractEnds')} value={d(p.contractEndsOn)} />
          </Box>
          {p.legacyStatusAr && (
            <Typography sx={{ mt: 1.25, fontSize: 12, color: tokens.gray500 }}>{t('staff.profile.legacy', { status: ar ? p.legacyStatusAr : (p.legacyStatusEn ?? p.legacyStatusAr) })}</Typography>
          )}
        </Box>
        <Overview score={p.completeness} text={summary} canEdit={p.canEdit} onComplete={() => setEdit(p.missing.some((m) => ['department', 'position', 'legal_entity', 'hire_date'].includes(m)) ? 'job' : 'personal')} />
      </Box>

      {/* The tabs and their boxes */}
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" sx={{ display: 'inline-flex', bgcolor: tokens.gray100, borderRadius: 99, p: 0.6, gap: 0.5, flexWrap: 'wrap' }} role="tablist">
          {(['data', 'leave', 'deductions', 'payroll', 'contract', 'history'] as TabKey[]).map((k) => {
            const icons = { data: <BadgeOutlinedIcon />, leave: <BeachAccessOutlinedIcon />, deductions: <CreditCardOutlinedIcon />, payroll: <PaymentsOutlinedIcon />, contract: <DescriptionOutlinedIcon />, history: <HistoryOutlinedIcon /> };
            return (
              <ButtonBase
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                sx={{ px: 2.25, py: 1, borderRadius: 99, fontWeight: 600, fontSize: 13.5, gap: 0.75, color: tab === k ? tokens.navy800 : tokens.gray600, bgcolor: tab === k ? '#fff' : 'transparent', boxShadow: tab === k ? '0 1px 4px rgba(0,0,0,.08)' : 'none', '& svg': { fontSize: 17 } }}
              >
                {icons[k]}
                {t(`staff.profile.tabs.${k}`)}
              </ButtonBase>
            );
          })}
        </Stack>

        {tab === 'data' && (
          <Box sx={{ display: 'grid', gap: 2.25, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start', mt: 1 }}>
            <Box>
              <Section title={t('staff.profile.boxes.basic')} icon={<BadgeOutlinedIcon />} onEdit={p.canEdit ? () => setEdit('personal') : undefined}>
                <Field icon={<TagIcon />} label={t('staff.profile.fields.employeeNo')} value={<bdi>{p.employeeNo}</bdi>} />
                <Field icon={<BadgeOutlinedIcon />} label={t('staff.profile.fields.idNumber')} value={<bdi>{p.idNumber ?? '—'}</bdi>} />
                <Field wide icon={<PersonOutlineIcon />} label={t('staff.profile.fields.name')} value={p.nameAr ? `${p.nameAr} · ${p.nameEn}` : p.nameEn} />
                <Field icon={<FlagOutlinedIcon />} label={t('staff.profile.fields.nationality')} value={(ar ? p.nationalityAr : p.nationalityEn) ?? '—'} />
                <Field icon={<CheckCircleOutlineOutlinedIcon />} label={t('staff.profile.fields.status')} value={<Box component="span" sx={{ bgcolor: tone.green, color: '#fff', borderRadius: 99, px: 1.5, py: 0.25, fontSize: 12 }}>{t(`staff.status.${p.status}`)}</Box>} />
                <Field icon={<CakeOutlinedIcon />} label={t('staff.profile.fields.birthDate')} value={d(p.birthDate)} />
                <Field icon={<PhoneIphoneOutlinedIcon />} label={t('staff.profile.fields.mobile')} value={<bdi>{p.mobile ?? '—'}</bdi>} />
                <Field icon={<EmailOutlinedIcon />} label={t('staff.profile.fields.email')} value={<bdi>{p.email ?? '—'}</bdi>} />
                <Field icon={<ShieldOutlinedIcon />} label={t('staff.profile.fields.gosiNo')} value={<bdi>{p.gosiNo ?? '—'}</bdi>} />
              </Section>
              <Section title={t('staff.profile.boxes.job')} icon={<ApartmentOutlinedIcon />} onEdit={p.canEdit ? () => setEdit('job') : undefined}>
                <Field icon={<ApartmentOutlinedIcon />} label={t('staff.profile.fields.department')} value={named(p.department)} />
                <Field icon={<WorkOutlineIcon />} label={t('staff.profile.fields.jobTitle')} value={named(p.jobTitle)} />
                <Field icon={<StarBorderOutlinedIcon />} label={t('staff.profile.fields.grade')} value={p.grade ?? '—'} />
                <Field icon={<SupervisorAccountOutlinedIcon />} label={t('staff.profile.fields.manager')} value={named(p.manager)} />
                <Field icon={<AccountBalanceOutlinedIcon />} label={t('staff.profile.fields.legalEntity')} value={named(p.legalEntity)} />
                <Field icon={<CalendarMonthOutlinedIcon />} label={t('staff.profile.fields.hireDate')} value={d(p.hireDate)} />
                <Field icon={<HourglassBottomOutlinedIcon />} label={t('staff.profile.fields.probationEnds')} value={d(p.probationEndsOn)} />
                {p.sponsor && <Field icon={<OpenInNewIcon />} label={t('staff.profile.fields.sponsor')} value={<bdi>{p.sponsor}</bdi>} />}
              </Section>
            </Box>
            <Box>
              <SalaryBox p={p} onChange={p.canChangeSalary ? () => setEdit('salary') : undefined} />
              {p.payDetails && <PayBox p={p} onEdit={p.canManageBank ? () => setEdit('pay') : undefined} />}
              <ContractBox p={p} onEdit={p.canEdit ? () => setEdit('contract') : undefined} />
            </Box>
          </Box>
        )}
        {tab === 'leave' && (
          <Box sx={{ mt: 2.25 }}>
            <EmployeeLeavePanel employee={{ id: p.id, nameAr: p.nameAr ?? p.nameEn, nameEn: p.nameEn }} />
            <LeaveBox p={p} />
          </Box>
        )}
        {tab === 'deductions' && (
          <Box sx={{ mt: 2.25 }}>
            <EmployeeDeductionsPanel employee={{ id: p.id, nameAr: p.nameAr ?? p.nameEn, nameEn: p.nameEn }} />
          </Box>
        )}
        {tab === 'payroll' && (
          <Box sx={{ mt: 2.25 }}>
            <EmployeePayrollPanel employeeId={p.id} />
          </Box>
        )}
        {tab === 'contract' && (
          <Box sx={{ display: 'grid', gap: 2.25, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
            <ContractBox p={p} onEdit={p.canEdit ? () => setEdit('contract') : undefined} />
            <Contracts id={p.id} version={version} />
          </Box>
        )}
        {tab === 'history' && <History id={p.id} version={version} />}
      </Box>

      {edit === 'personal' && <PersonalDialog profile={p} onClose={() => setEdit(null)} onSaved={done} />}
      {edit === 'job' && <JobDialog profile={p} departments={departments} onClose={() => setEdit(null)} onSaved={done} />}
      {edit === 'contract' && <ContractDialog profile={p} onClose={() => setEdit(null)} onSaved={done} />}
      {edit === 'salary' && <SalaryDialog profile={p} onClose={() => setEdit(null)} onSaved={done} />}
      {edit === 'pay' && <PayDetailsDialog profile={p} onClose={() => setEdit(null)} onSaved={done} />}
      {edit === 'settlement' && (
        <NewSettlementDialog employee={{ id: p.id, nameAr: p.nameAr ?? p.nameEn, nameEn: p.nameEn }} onClose={() => setEdit(null)} onCreated={(sid) => navigate(`/hr/settlements/${sid}`)} />
      )}
      {edit === 'action' && <ActionDialog profile={p} departments={departments} onClose={() => setEdit(null)} onSent={(actionId) => navigate(`/hr/actions/${actionId}`)} />}
    </Box>
  );
}

function Fact({ icon, label, value, wide, warn }: { icon: ReactNode; label: string; value: ReactNode; wide?: boolean; warn?: boolean }) {
  return (
    <Box sx={{ gridColumn: wide ? '1 / -1' : undefined, bgcolor: wide ? tokens.navy50 : tokens.gray50, borderRadius: `${tokens.radius}px`, px: 1.75, py: 1.25 }}>
      <Typography component="dt" sx={{ fontSize: 12, color: tokens.gray500, display: 'flex', gap: 0.6, alignItems: 'center', '& svg': { fontSize: 15, color: tokens.navy400 } }}>
        {icon}
        {label}
      </Typography>
      <Typography component="dd" sx={{ m: 0, mt: 0.4, fontWeight: 700, color: warn ? '#b45309' : tokens.navy800, fontSize: wide ? 15 : 13.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

function Overview({ score, text, canEdit, onComplete }: { score: number; text: string; canEdit: boolean; onComplete: () => void }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ borderRadius: `${tokens.radiusLg}px`, p: 2.5, color: '#fff', background: 'linear-gradient(135deg, #0a3c58 0%, #0d5e72 55%, #127c86 100%)', display: 'flex', flexDirection: 'column', boxShadow: tokens.shadowSm }}>
      <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
        <Box role="img" aria-label={t('staff.profile.completeness', { value: score })} sx={{ flex: '0 0 auto', width: 96, height: 96, borderRadius: '50%', background: `conic-gradient(#7ee0a8 0 ${score}%, rgba(255,255,255,.18) ${score}% 100%)`, display: 'grid', placeItems: 'center' }}>
          <Box sx={{ width: 78, height: 78, borderRadius: '50%', bgcolor: '#0c4a63', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800 }}>
            <bdi>{score}</bdi>
          </Box>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 19, fontWeight: 800, display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <DescriptionOutlinedIcon />
            {t('staff.profile.summary')}
          </Typography>
          <Box component="span" sx={{ display: 'inline-block', mt: 0.75, bgcolor: '#7ee0a8', color: tokens.navy800, borderRadius: 99, px: 1.5, py: 0.25, fontWeight: 700, fontSize: 12 }}>
            {t('staff.profile.completeness', { value: score })}
          </Box>
        </Box>
      </Stack>
      <Typography sx={{ my: 1.75, lineHeight: 1.9, fontSize: 13, opacity: 0.95 }}>{text}</Typography>
      {canEdit && score < 100 && (
        <Button onClick={onComplete} startIcon={<EditNoteOutlinedIcon />} sx={{ alignSelf: 'flex-start', mt: 'auto', bgcolor: '#fff', color: tokens.navy800, borderRadius: 99, px: 2, fontWeight: 700, '&:hover': { bgcolor: '#eef5f8' } }}>
          {t('staff.profile.complete')}
        </Button>
      )}
    </Box>
  );
}

/** A box titled on its border (the old screen's fieldset), with «تعديل» on the other side of the border. */
function Section({ title, icon, onEdit, editLabel, boxTone = 'navy', children }: { title: string; icon: ReactNode; onEdit?: () => void; editLabel?: string; boxTone?: BoxTone; children: ReactNode }) {
  const { t } = useTranslation();
  const main = tone[boxTone];
  return (
    <Box component="fieldset" sx={{ position: 'relative', minWidth: 0, m: 0, mt: 2.25, px: 2.25, pt: 2.5, pb: 1.75, border: '1.5px solid #dbe4ec', borderRadius: '18px', bgcolor: '#fff' }}>
      <Box component="legend" sx={{ px: 1.25, display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 14.5, fontWeight: 800, color: main }}>
        <Box component="span" sx={{ width: 28, height: 28, borderRadius: '9px', bgcolor: main, color: '#fff', display: 'grid', placeItems: 'center', '& svg': { fontSize: 15 } }}>
          {icon}
        </Box>
        {title}
      </Box>
      {onEdit && (
        <Box sx={{ position: 'absolute', top: -17, insetInlineEnd: 16, bgcolor: '#fff', px: 0.75 }}>
          <Button size="small" variant="outlined" onClick={onEdit} sx={{ borderRadius: 99, height: 30, borderColor: tokens.border, color: tokens.navy800, fontWeight: 600 }}>
            {editLabel ?? t('staff.profile.edit')}
          </Button>
        </Box>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, columnGap: 2.25, rowGap: 0.25, '--field-tone': main, '--field-soft': boxTone === 'green' ? tone.greenSoft : boxTone === 'sky' ? tone.skySoft : tone.navySoft }}>{children}</Box>
    </Box>
  );
}

/** The old screen's field: a coloured icon, the label, and the value in a quiet box. */
function Field({ icon, label, value, wide, unit }: { icon: ReactNode; label: string; value: ReactNode; wide?: boolean; unit?: string }) {
  return (
    <Box sx={{ gridColumn: wide ? '1 / -1' : undefined, display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 1.25, alignItems: 'end', py: 0.75 }}>
      <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: 'var(--field-soft)', color: 'var(--field-tone)', display: 'grid', placeItems: 'center', '& svg': { fontSize: 17 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: tokens.gray500, mb: 0.6 }}>{label}</Typography>
        <Box sx={{ border: '1px solid #dfe8ef', borderRadius: '10px', px: 1.5, py: 0.9, fontWeight: 700, color: tokens.navy800, textAlign: 'center', bgcolor: '#fbfcfd', fontSize: 13.5, fontVariantNumeric: 'tabular-nums', minHeight: 38, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
          {unit && (
            <Box component="small" sx={{ color: tokens.gray500, fontWeight: 500, fontSize: 11, marginInlineStart: 0.5 }}>
              {unit}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function SalaryBox({ p, onChange }: { p: StaffProfile; onChange?: () => void }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const s = p.salary;
  const riyal = t('hr.sar');
  return (
    <Section title={t('staff.profile.boxes.salary')} icon={<PaymentsOutlinedIcon />} boxTone="green" onEdit={onChange} editLabel={t('staff.profile.changeSalary')}>
      {!p.canSeeSalary ? (
        <Typography sx={{ gridColumn: '1 / -1', color: tokens.gray500, py: 1 }}>{t('staff.profile.salaryHidden')}</Typography>
      ) : !s ? (
        <Typography sx={{ gridColumn: '1 / -1', color: tokens.gray500, py: 1 }}>{t('staff.profile.noSalary')}</Typography>
      ) : (
        <>
          <Field icon={<LocalAtmOutlinedIcon />} label={t('staff.profile.fields.basic')} value={fmt(s.basic)} unit={riyal} />
          <Field icon={<HomeOutlinedIcon />} label={t('staff.profile.fields.housing')} value={fmt(s.housing)} unit={riyal} />
          <Field icon={<RestaurantOutlinedIcon />} label={t('staff.profile.fields.food')} value={fmt(s.food)} unit={riyal} />
          <Field icon={<DirectionsCarOutlinedIcon />} label={t('staff.profile.fields.transport')} value={fmt(s.transport)} unit={riyal} />
          <Field icon={<PhoneIphoneOutlinedIcon />} label={t('staff.profile.fields.mobileAllowance')} value={fmt(s.mobile)} unit={riyal} />
          <Field icon={<WorkOutlineIcon />} label={t('staff.profile.fields.project')} value={fmt(s.project)} unit={riyal} />
          <Field icon={<RedeemOutlinedIcon />} label={t('staff.profile.fields.other')} value={fmt(s.other)} unit={riyal} />
          <Box sx={{ gridColumn: '1 / -1', bgcolor: tone.greenSoft, borderRadius: '14px', p: 1.5, mt: 0.75, display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 1.25, alignItems: 'end' }}>
            <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: tone.green, color: '#fff', display: 'grid', placeItems: 'center' }}>
              <CreditCardOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: tokens.gray500, mb: 0.6 }}>
                {t('staff.profile.fields.total')} · {t('staff.profile.fields.effective', { date: date(s.effectiveFrom) })} · {t(`staff.profile.source.${s.source}`)}
                {p.salaryChanges > 0 && ` · ${t('staff.profile.salaryChanges', { count: p.salaryChanges })}`}
              </Typography>
              <Box sx={{ bgcolor: '#fff', borderRadius: '10px', px: 1.75, py: 0.9, fontWeight: 800, color: tone.green, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
                {s.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small style={{ fontSize: 11, color: tokens.gray500, fontWeight: 500 }}>{riyal}</small>
              </Box>
            </Box>
          </Box>
        </>
      )}
    </Section>
  );
}

/** The bank the salary goes to and the GOSI start (shown to those who manage bank details or see salaries). */
function PayBox({ p, onEdit }: { p: StaffProfile; onEdit?: () => void }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const d = p.payDetails!;
  return (
    <Section title={t('staff.profile.boxes.pay')} icon={<AccountBalanceOutlinedIcon />} boxTone="sky" onEdit={onEdit}>
      <Field icon={<AccountBalanceOutlinedIcon />} label={t('staff.profile.fields.bank')} value={d.bankName ?? '—'} />
      <Field icon={<PersonOutlineIcon />} label={t('staff.profile.fields.accountHolder')} value={d.accountHolder ?? '—'} />
      <Field wide icon={<CreditCardOutlinedIcon />} label={t('staff.profile.fields.iban')} value={d.iban ? <bdi dir="ltr">{d.iban.replace(/(.{4})/g, '$1 ').trim()}</bdi> : <Box component="span" sx={{ color: '#b45309' }}>{t('staff.profile.noIban')}</Box>} />
      <Field icon={<ShieldOutlinedIcon />} label={t('staff.profile.fields.gosiSince')} value={d.gosiSince ? date(d.gosiSince) : '—'} />
    </Section>
  );
}

function ContractBox({ p, onEdit }: { p: StaffProfile; onEdit?: () => void }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const d = (v: string | null) => (v ? date(v) : '—');
  return (
    <Section title={t('staff.profile.boxes.contract')} icon={<DescriptionOutlinedIcon />} boxTone="sky" onEdit={onEdit}>
      <Field icon={<EventAvailableOutlinedIcon />} label={t('staff.profile.fields.contractStart')} value={d(p.contractStartsOn)} />
      <Field icon={<HourglassBottomOutlinedIcon />} label={t('staff.profile.fields.contractMonths')} value={fmt(p.contractMonths)} unit={t('staff.profile.fields.months')} />
      <Field icon={<EventBusyOutlinedIcon />} label={t('staff.profile.fields.contractEnd')} value={d(p.contractEndsOn)} />
      <Field icon={<HourglassBottomOutlinedIcon />} label={t('staff.profile.fields.probationEnds')} value={d(p.probationEndsOn)} />
    </Section>
  );
}

function LeaveBox({ p }: { p: StaffProfile }) {
  const { t } = useTranslation();
  const days = t('staff.profile.fields.days');
  return (
    <Box sx={{ maxWidth: 760 }}>
      <Section title={t('staff.profile.boxes.leaveOld')} icon={<BeachAccessOutlinedIcon />} boxTone="green">
        <Field icon={<BeachAccessOutlinedIcon />} label={t('staff.profile.fields.annualLeave')} value={fmt(p.annualLeaveDays)} unit={days} />
        <Field icon={<CalendarMonthOutlinedIcon />} label={t('staff.profile.fields.leaveBalance')} value={fmt(p.leaveBalance)} unit={days} />
        <Field icon={<HistoryOutlinedIcon />} label={t('staff.profile.fields.oldConsumed')} value={fmt(p.leaveOldConsumed)} unit={days} />
        <Field icon={<EventBusyOutlinedIcon />} label={t('staff.profile.fields.consumed')} value={fmt(p.leaveConsumed)} unit={days} />
        <Field wide icon={<ScaleOutlinedIcon />} label={t('staff.profile.fields.remaining')} value={fmt(p.leaveRemaining)} unit={days} />
      </Section>
      <Typography sx={{ fontSize: 12, color: tokens.gray500, mt: 1 }}>{t('staff.profile.leaveNote')}</Typography>
    </Box>
  );
}

function History({ id, version }: { id: string; version: number }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const [events, setEvents] = useState<StaffEvent[] | null>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);
  useEffect(() => {
    staffApi.history(id).then(setEvents).catch(() => setEvents([]));
    staffApi.actions({ employeeId: id }).then(setActions).catch(() => setActions([]));
  }, [id, version]);
  if (!events) return <LinearProgress sx={{ mt: 2 }} />;
  // What a change touched, in the file's words; changes made only by the import (leave balance, dates synced) are left out.
  const shown = events
    .map((e) => ({ ...e, fields: e.changes ? Object.keys(e.changes).filter((k) => k in changeLabels).map((k) => t(`staff.profile.fields.${changeLabels[k]}`)) : [] }))
    .filter((e) => e.kind !== 'Changed' || e.fields.length > 0);
  if (shown.length === 0 && actions.length === 0) return <Typography sx={{ mt: 2, color: tokens.gray500 }}>{t('staff.profile.history.empty')}</Typography>;
  const look = { Created: { c: tokens.navy700, i: <Add /> }, Changed: { c: tokens.sky, i: <EditNoteOutlinedIcon /> }, Salary: { c: tone.green, i: <PaymentsOutlinedIcon /> } } as const;
  return (
    <Stack sx={{ gap: 1.5, mt: 2.5 }}>
      {actions.map((a) => (
        <Stack key={a.id} direction="row" sx={{ gap: 1.5 }}>
          <Box sx={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', bgcolor: tokens.navy700, color: '#fff', display: 'grid', placeItems: 'center', '& svg': { fontSize: 17 } }}>{actionIcon[a.kind]}</Box>
          <Box component={RouterLink} to={`/hr/actions/${a.id}`} sx={{ flex: 1, textDecoration: 'none', color: 'inherit', border: '1px solid #e6eef7', borderInlineStart: `4px solid ${tokens.navy700}`, borderRadius: '14px', px: 1.75, py: 1.25, '&:hover': { bgcolor: tokens.gray50 } }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700, color: tokens.navy800 }}>
                {t(`staffActions.kind.${a.kind}`)} · <bdi style={{ color: tokens.gray500, fontWeight: 600 }}>{a.actionNo}</bdi>
              </Typography>
              <ActionStatusBadge status={a.status} />
            </Stack>
            <Typography sx={{ fontSize: 12, color: tokens.gray500, mt: 0.25 }}>
              {t('staffActions.effectiveFrom')} <bdi>{date(a.effectiveFrom)}</bdi> · {t('staff.profile.history.by', { by: a.createdByName })}
            </Typography>
          </Box>
        </Stack>
      ))}
      {shown.map((e, n) => (
        <Stack key={n} direction="row" sx={{ gap: 1.5 }}>
          <Box sx={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', bgcolor: look[e.kind].c, color: '#fff', display: 'grid', placeItems: 'center', '& svg': { fontSize: 17 } }}>{look[e.kind].i}</Box>
          <Box sx={{ flex: 1, border: '1px solid #e6eef7', borderInlineStart: `4px solid ${look[e.kind].c}`, borderRadius: '14px', px: 1.75, py: 1.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, color: look[e.kind].c }}>{t(`staff.profile.history.${e.kind}`)}</Typography>
              <Typography sx={{ fontSize: 12, color: tokens.gray500, fontVariantNumeric: 'tabular-nums' }}>
                <bdi>{date(e.at.slice(0, 10))}</bdi> · {t('staff.profile.history.by', { by: e.by })}
              </Typography>
            </Stack>
            {e.salary && (
              <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mt: 0.5 }}>
                {t('staff.profile.fields.total')}: <b><bdi>{e.salary.total.toLocaleString('en-US')}</bdi></b> · {t('staff.profile.fields.effective', { date: date(e.salary.effectiveFrom) })}
                {e.salary.reason && ` · ${t('staff.profile.history.reason', { reason: e.salary.reason })}`}
              </Typography>
            )}
            {e.kind === 'Changed' && <Typography sx={{ fontSize: 12, color: tokens.gray500, mt: 0.5 }}>{e.fields.join('، ')}</Typography>}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

/** The employee's contracts, newest first (a renewal is a new one). */
function Contracts({ id, version }: { id: string; version: number }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const [list, setList] = useState<Contract[] | null>(null);
  useEffect(() => {
    staffApi.contracts(id).then(setList).catch(() => setList([]));
  }, [id, version]);
  const look = { Active: { c: tone.green, b: tone.greenSoft }, Renewed: { c: tokens.navy500, b: tokens.navy50 }, Ended: { c: tokens.gray500, b: tokens.gray100 } } as const;
  return (
    <Section title={t('staffContracts.title')} icon={<HistoryOutlinedIcon />} boxTone="sky">
      <Box sx={{ gridColumn: '1 / -1' }}>
        {!list ? (
          <LinearProgress />
        ) : list.length === 0 ? (
          <Typography sx={{ color: tokens.gray500, fontSize: 13, py: 1 }}>{t('staffContracts.none')}</Typography>
        ) : (
          <Stack sx={{ gap: 1, py: 0.5 }}>
            {list.map((c) => (
              <Box key={c.id} sx={{ border: '1px solid #e6eef7', borderRadius: '12px', px: 1.5, py: 1 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: tokens.navy800, fontSize: 13.5 }}>
                    <bdi>{t('staffContracts.from', { date: date(c.startsOn) })}</bdi> {c.endsOn ? <bdi>{t('staffContracts.to', { date: date(c.endsOn) })}</bdi> : `· ${t('staffContracts.open')}`}
                  </Typography>
                  <Box component="span" sx={{ bgcolor: look[c.status].b, color: look[c.status].c, borderRadius: 99, px: 1.25, py: 0.25, fontSize: 12, fontWeight: 700 }}>
                    {t(`staffContracts.status.${c.status}`)}
                  </Box>
                </Stack>
                <Typography sx={{ fontSize: 12, color: tokens.gray500, mt: 0.25 }}>
                  {t(`staffActions.contractKinds.${c.kind}`)}
                  {c.months ? ` · ${c.months} ${t('staff.profile.fields.months')}` : ''} · {t('staffContracts.notice', { days: c.noticeDays })}
                  {c.actionId && (
                    <>
                      {' · '}
                      <RouterLink to={`/hr/actions/${c.actionId}`}>{t('staffContracts.byAction')}</RouterLink>
                    </>
                  )}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Section>
  );
}
