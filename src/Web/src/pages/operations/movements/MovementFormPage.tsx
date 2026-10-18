import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import {
  exitKinds,
  movementsApi,
  movementTypes,
  suspensionReasons,
  type MovementInput,
  type MovementOptions,
  type MovementQuote,
  type MovementType,
  type ReturnTarget,
} from '../../../api/movements';
import type { ProjectOption, WorkerCard } from '../../../api/operations';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { Initials } from '../../../components/ui';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { isoToday, sar } from '../../operations/delivery';
import { gradient, rise, slideFrom, StateBubble, TypeIcon, typeLook, useStateName } from './movementMeta';

type Step = 0 | 1 | 2;

/** The period a movement opens, as the server decides it (to draw the "to" side before saving). */
const opens = (type: MovementType, vacationKind: string, returnTo: ReturnTarget) =>
  ({
    Arrival: 'Housing',
    VacationDeparture: vacationKind === 'Client' ? 'ClientVacation' : 'Vacation',
    VacationReturn: returnTo === 'Housing' ? 'Housing' : 'Work',
    Absconding: 'Absconded',
    AbscondingReturn: 'Housing',
    Suspension: 'Suspended',
    SuspensionLift: 'Housing',
    FinalExit: 'Out',
  })[type];

const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

/** A choice drawn as a card: an icon, a title and a line under it. */
function ChoiceCard({ selected, onClick, icon, title, sub, tone }: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; sub?: string; tone: string }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1.25,
        p: 1.5,
        textAlign: 'start',
        borderRadius: `${tokens.radius}px`,
        border: `2px solid ${selected ? tone : tokens.gray100}`,
        bgcolor: selected ? `${tone}0f` : '#fff',
        transition: 'all .18s ease',
        '&:hover': { borderColor: tone },
      }}
    >
      <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', color: selected ? '#fff' : tone, bgcolor: selected ? tone : `${tone}14`, transition: 'all .18s ease' }}>
        {selected ? <CheckIcon sx={{ fontSize: 20 }} /> : icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>{title}</Typography>
        {sub && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{sub}</Typography>}
      </Box>
    </ButtonBase>
  );
}

/**
 * A new movement in three steps — the worker, the movement (only those their state allows), then its details — with
 * the change drawn live beside the form. A returned movement opens on its details (the worker and the type stay).
 */
export function MovementFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ar, date } = useCommercialFormat();
  const stateName = useStateName();
  const [step, setStep] = useState<Step>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<WorkerCard[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [options, setOptions] = useState<MovementOptions | null>(null);
  const [type, setType] = useState<MovementType | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [quote, setQuote] = useState<MovementQuote | null>(null);
  const [form, setForm] = useState({
    effectiveOn: isoToday(),
    expectedReturnOn: '',
    vacationKind: 'Regular',
    returnTo: 'Housing' as ReturnTarget,
    projectId: null as string | null,
    special: false,
    specialPrice: '',
    specialReason: '',
    paySalary: false,
    suspensionReason: '',
    exitKind: '',
    place: '',
    delayReason: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  const go = (next: Step) => {
    setDirection(next > step ? (ar ? -1 : 1) : ar ? 1 : -1);
    setStep(next);
  };

  // A worker chosen from the search, the worker page, or the returned movement.
  const chooseWorker = async (workerId: string, except?: string) => {
    setError(null);
    try {
      setOptions(await movementsApi.options(workerId, except));
      if (!except) go(1);
    } catch (failure) {
      setError(errorKey(failure));
    }
  };

  useEffect(() => {
    movementsApi.projects().then(setProjects).catch(() => undefined);
    if (id) {
      movementsApi
        .get(id)
        .then(async (m) => {
          setType(m.type);
          setForm({
            effectiveOn: m.effectiveOn,
            expectedReturnOn: m.expectedReturnOn ?? '',
            vacationKind: m.vacationKind ?? 'Regular',
            returnTo: m.returnTo ?? 'Housing',
            projectId: m.returnTo === 'NewProject' ? m.projectId : null,
            special: m.isSpecialPrice,
            specialPrice: m.isSpecialPrice ? String(m.totalPrice) : '',
            specialReason: m.specialReason ?? '',
            paySalary: m.paySalary,
            suspensionReason: m.suspensionReason ?? '',
            exitKind: m.exitKind ?? '',
            place: m.place ?? '',
            delayReason: m.delayReason ?? '',
            notes: m.notes ?? '',
          });
          await chooseWorker(m.workerId, m.id);
          setStep(2);
        })
        .catch((failure: unknown) => setError(errorKey(failure)));
    } else if (params.get('worker')) {
      void chooseWorker(params.get('worker')!);
    }
  }, [id]);

  // Searching as the user types.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setFound(null);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      movementsApi
        .workers(term)
        .then(setFound)
        .catch((failure: unknown) => setError(errorKey(failure)))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // A return to a project: its price for the worker on the return date.
  const returnProject = type === 'VacationReturn' ? (form.returnTo === 'SameProject' ? options?.previousProjectId : form.returnTo === 'NewProject' ? form.projectId : null) : null;
  useEffect(() => {
    setQuote(null);
    if (!returnProject || !options) return;
    movementsApi
      .quote(options.worker.id, returnProject, form.effectiveOn)
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [returnProject, options, form.effectiveOn]);

  const worker = options?.worker ?? null;
  const late = daysBetween(form.effectiveOn, isoToday()) > 2;
  const target = type ? opens(type, form.vacationKind, form.returnTo) : null;
  const housing = type === 'Arrival' || type === 'AbscondingReturn' || type === 'SuspensionLift' || (type === 'VacationReturn' && form.returnTo === 'Housing');
  const valid = useMemo(() => {
    if (!worker || !type || !form.effectiveOn) return false;
    if (late && !form.delayReason.trim()) return false;
    if (type === 'Suspension' && !form.suspensionReason) return false;
    if (type === 'FinalExit' && !form.exitKind) return false;
    if (type === 'VacationDeparture' && form.expectedReturnOn && form.expectedReturnOn <= form.effectiveOn) return false;
    if (type === 'VacationReturn' && form.returnTo !== 'Housing') {
      if (!returnProject) return false;
      const kept = form.returnTo === 'SameProject' ? options?.previousPrice : null;
      if (form.special ? !(Number(form.specialPrice) > 0) || !form.specialReason.trim() : (kept ?? quote?.totalPrice) == null) return false;
    }

    return true;
  }, [worker, type, form, late, returnProject, quote]);

  const save = async () => {
    setBusy(true);
    setError(null);
    const input: MovementInput = {
      type: type!,
      workerId: worker!.id,
      effectiveOn: form.effectiveOn,
      expectedReturnOn: type === 'VacationDeparture' && form.expectedReturnOn ? form.expectedReturnOn : null,
      vacationKind: type === 'VacationDeparture' ? (form.vacationKind as 'Regular' | 'Client') : null,
      returnTo: type === 'VacationReturn' ? form.returnTo : null,
      projectId: type === 'VacationReturn' && form.returnTo === 'NewProject' ? form.projectId : null,
      specialPrice: form.special ? Number(form.specialPrice) : null,
      specialReason: form.special ? form.specialReason.trim() : null,
      paySalary: housing && form.paySalary,
      suspensionReason: type === 'Suspension' ? form.suspensionReason : null,
      exitKind: type === 'FinalExit' ? form.exitKind : null,
      place: form.place.trim() || null,
      delayReason: late ? form.delayReason.trim() : null,
      notes: form.notes.trim() || null,
    };
    try {
      const saved = id ? await movementsApi.update(id, input) : await movementsApi.create(input);
      navigate(`/operations/movements/${saved.id}`);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const steps = [t('movements.steps.worker'), t('movements.steps.type'), t('movements.steps.details')];
  const tone = type ? typeLook[type].from : '#0d6e8c';

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800, color: tokens.navy800 }}>
            {id ? t('movements.editTitle') : t('movements.new')}
          </Typography>
          <Typography sx={{ fontSize: 13, color: tokens.gray500 }}>{t('movements.wizardHint')}</Typography>
        </Box>
        <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(id ? `/operations/movements/${id}` : '/operations/movements')}>
          {t('common.back')}
        </Button>
      </Stack>

      {/* The steps, with a bar filling as the user goes. */}
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, px: { xs: 2, md: 4 }, py: 2.25, mb: 2.5 }}>
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ position: 'absolute', top: 17, insetInlineStart: 18, insetInlineEnd: 18, height: 3, borderRadius: 3, bgcolor: tokens.gray100 }} />
          <Box
            sx={{
              position: 'absolute',
              top: 17,
              insetInlineStart: 18,
              width: `calc((100% - 36px) * ${step / 2})`,
              height: 3,
              borderRadius: 3,
              background: type ? gradient(type) : 'linear-gradient(90deg,#0d6e8c,#1aa39a)',
              transition: 'width .45s cubic-bezier(.4,0,.2,1)',
            }}
          />
          {steps.map((label, n) => {
            const done = n < step;
            const current = n === step;
            const reachable = n < step && !(id && n < 2);
            return (
              <ButtonBase
                key={label}
                disabled={!reachable}
                onClick={() => go(n as Step)}
                sx={{ position: 'relative', zIndex: 1, flexDirection: 'column', gap: 0.75, borderRadius: 2, px: 1 }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                    color: done || current ? '#fff' : tokens.gray500,
                    background: done || current ? (type ? gradient(type) : 'linear-gradient(135deg,#0d6e8c,#1aa39a)') : '#fff',
                    border: done || current ? 'none' : `2px solid ${tokens.gray200}`,
                    boxShadow: current ? `0 0 0 5px ${tone}22` : 'none',
                    transition: 'all .3s ease',
                  }}
                >
                  {done ? <CheckIcon sx={{ fontSize: 19 }} /> : n + 1}
                </Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: current ? 800 : 600, color: current ? tokens.navy800 : tokens.gray500 }}>{label}</Typography>
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      <ErrorMessage messageKey={error} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: step === 2 ? '1fr 360px' : '1fr' }, gap: 2.5, alignItems: 'start' }}>
        {/* The step's content, sliding in from the side it comes from. */}
        <Box key={step} sx={{ animation: `${slideFrom(direction)} .38s cubic-bezier(.2,.8,.2,1) both`, minWidth: 0 }}>
          {step === 0 && (
            <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: { xs: 2, md: 3 } }}>
              <Typography sx={{ fontSize: 17, fontWeight: 800, color: tokens.navy800, mb: 0.5 }}>{t('movements.chooseWorker')}</Typography>
              <Typography sx={{ fontSize: 13, color: tokens.gray500, mb: 2 }}>{t('movements.chooseWorkerHint')}</Typography>
              <TextField
                autoFocus
                fullWidth
                placeholder={t('movements.workerSearch')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: searching ? <CircularProgress size={18} /> : undefined,
                    sx: { fontSize: 16, borderRadius: 3, py: 0.5 },
                  },
                }}
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 1.25, mt: 2 }}>
                {found?.map((w, n) => (
                  <ButtonBase
                    key={w.id}
                    onClick={() => void chooseWorker(w.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      textAlign: 'start',
                      justifyContent: 'flex-start',
                      borderRadius: `${tokens.radius}px`,
                      border: `1px solid ${tokens.gray100}`,
                      transition: 'all .18s ease',
                      animation: `${rise} .3s ease both`,
                      animationDelay: `${n * 35}ms`,
                      '&:hover': { borderColor: '#0d6e8c', boxShadow: tokens.shadowSm, transform: 'translateY(-2px)' },
                    }}
                  >
                    <Initials name={w.name} size={42} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800, textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mb: 0.5 }}>
                        <span dir="ltr">{w.workerNo}</span> · {(ar ? w.professionAr : w.professionEn) ?? '—'}
                      </Typography>
                      <StateBubble state={w.placement} label={stateName(w.placement)} sub={w.projectName} />
                    </Box>
                  </ButtonBase>
                ))}
              </Box>
              {found && found.length === 0 && <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('movements.noWorkers')}</Typography>}
            </Box>
          )}

          {step === 1 && worker && options && (
            <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: { xs: 2, md: 3 } }}>
              <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' }, mb: 2.5, p: 1.75, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50 }}>
                <Initials name={worker.name} size={46} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, textAlign: 'start' }}>
                    {worker.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>
                    <span dir="ltr">{worker.workerNo}</span> · {(ar ? worker.professionAr : worker.professionEn) ?? '—'} · {(ar ? worker.nationalityAr : worker.nationalityEn) ?? '—'}
                  </Typography>
                </Box>
                <StateBubble state={worker.placement} label={stateName(worker.placement)} sub={worker.projectName} big />
                <Button size="small" startIcon={<ReplayOutlinedIcon />} onClick={() => go(0)}>
                  {t('movements.changeWorker')}
                </Button>
              </Stack>
              {options.busyWith && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t('movements.busyWith', { number: options.busyWith })}
                </Alert>
              )}
              <Typography sx={{ fontSize: 17, fontWeight: 800, color: tokens.navy800, mb: 0.5 }}>{t('movements.chooseType')}</Typography>
              <Typography sx={{ fontSize: 13, color: tokens.gray500, mb: 2 }}>{t('movements.chooseTypeHint', { state: stateName(worker.placement) })}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                {movementTypes.map((m, n) => {
                  const allowed = options.allowed.includes(m) && !options.busyWith;
                  const card = (
                    <ButtonBase
                      key={m}
                      disabled={!allowed}
                      onClick={() => {
                        setType(m);
                        go(2);
                      }}
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 1.25,
                        p: 2,
                        textAlign: 'start',
                        borderRadius: `${tokens.radius + 4}px`,
                        border: `1px solid ${tokens.gray100}`,
                        position: 'relative',
                        overflow: 'hidden',
                        opacity: allowed ? 1 : 0.42,
                        filter: allowed ? 'none' : 'grayscale(1)',
                        transition: 'all .2s ease',
                        animation: `${rise} .35s ease both`,
                        animationDelay: `${n * 35}ms`,
                        '&:hover': allowed ? { transform: 'translateY(-3px)', boxShadow: `0 14px 28px ${typeLook[m].from}2e`, borderColor: typeLook[m].from } : undefined,
                      }}
                    >
                      <TypeIcon type={m} size={46} />
                      <Box>
                        <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.navy800 }}>{t(`movements.types.${m}`)}</Typography>
                        <Typography sx={{ fontSize: 12, color: tokens.gray500, lineHeight: 1.5 }}>{t(`movements.typeHints.${m}`)}</Typography>
                      </Box>
                      {!allowed && <LockOutlinedIcon sx={{ position: 'absolute', top: 12, insetInlineEnd: 12, fontSize: 18, color: tokens.gray500 }} />}
                    </ButtonBase>
                  );
                  return allowed ? (
                    card
                  ) : (
                    <Tooltip key={m} title={t('movements.notAllowed', { state: stateName(worker.placement) })}>
                      <span>{card}</span>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          )}

          {step === 2 && worker && type && (
            <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, overflow: 'hidden' }}>
              <Box sx={{ p: 2.25, color: '#fff', background: gradient(type), display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: '30%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.2)', '& svg': { fontSize: 24 } }}>{typeLook[type].icon}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 17, fontWeight: 800 }}>{t(`movements.types.${type}`)}</Typography>
                  <Typography sx={{ fontSize: 12.5, opacity: 0.9 }}>{t(`movements.typeHints.${type}`)}</Typography>
                </Box>
                {!id && (
                  <Button size="small" onClick={() => go(1)} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,.18)', fontWeight: 700, px: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,.28)' } }}>
                    {t('movements.changeType')}
                  </Button>
                )}
              </Box>
              <Stack spacing={2.25} sx={{ p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    type="date"
                    label={t(`movements.dateLabel.${type}`)}
                    value={form.effectiveOn}
                    onChange={(e) => set({ effectiveOn: e.target.value })}
                    required
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  {type === 'VacationDeparture' && (
                    <TextField
                      type="date"
                      label={t('movements.expectedReturn')}
                      value={form.expectedReturnOn}
                      onChange={(e) => set({ expectedReturnOn: e.target.value })}
                      error={!!form.expectedReturnOn && form.expectedReturnOn <= form.effectiveOn}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  )}
                  {(type === 'Arrival' || type === 'Absconding' || housing) && (
                    <TextField label={t(type === 'Absconding' ? 'movements.lastPlace' : 'movements.housingPlace')} value={form.place} onChange={(e) => set({ place: e.target.value })} />
                  )}
                </Box>

                {type === 'VacationDeparture' && (
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.gray600, mb: 1 }}>{t('movements.vacationKind')}</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <ChoiceCard selected={form.vacationKind === 'Regular'} onClick={() => set({ vacationKind: 'Regular' })} icon={<HotelOutlinedIcon />} title={t('movements.vacation.Regular')} sub={t('movements.vacation.RegularHint')} tone="#3b6fd8" />
                      <Tooltip title={worker.placement !== 'Working' ? t('movements.vacation.ClientOnlyWorking') : ''}>
                        <Box sx={{ flex: 1, display: 'flex', opacity: worker.placement !== 'Working' ? 0.45 : 1, pointerEvents: worker.placement !== 'Working' ? 'none' : 'auto' }}>
                          <ChoiceCard selected={form.vacationKind === 'Client'} onClick={() => set({ vacationKind: 'Client' })} icon={<SwapHorizOutlinedIcon />} title={t('movements.vacation.Client')} sub={t('movements.vacation.ClientHint')} tone="#6a4fd1" />
                        </Box>
                      </Tooltip>
                    </Stack>
                  </Box>
                )}

                {type === 'VacationReturn' && (
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.gray600, mb: 1 }}>{t('movements.returnTo')}</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                      <ChoiceCard selected={form.returnTo === 'Housing'} onClick={() => set({ returnTo: 'Housing' })} icon={<HotelOutlinedIcon />} title={t('movements.return.Housing')} sub={t('movements.return.HousingHint')} tone="#0d6e8c" />
                      <Box sx={{ flex: 1, display: 'flex', opacity: options?.previousProjectId ? 1 : 0.45, pointerEvents: options?.previousProjectId ? 'auto' : 'none' }}>
                        <ChoiceCard
                          selected={form.returnTo === 'SameProject'}
                          onClick={() => set({ returnTo: 'SameProject' })}
                          icon={<ReplayOutlinedIcon />}
                          title={t('movements.return.SameProject')}
                          sub={options?.previousProjectName ?? t('movements.return.NoPrevious')}
                          tone="#1f7a4d"
                        />
                      </Box>
                      <ChoiceCard selected={form.returnTo === 'NewProject'} onClick={() => set({ returnTo: 'NewProject' })} icon={<SwapHorizOutlinedIcon />} title={t('movements.return.NewProject')} sub={t('movements.return.NewProjectHint')} tone="#b4561b" />
                    </Stack>
                  </Box>
                )}

                {type === 'VacationReturn' && form.returnTo === 'NewProject' && (
                  <Autocomplete
                    options={projects}
                    value={projects.find((p) => p.id === form.projectId) ?? null}
                    onChange={(_, v) => set({ projectId: v?.id ?? null })}
                    getOptionLabel={(p) => `${p.name} (${p.code})`}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    renderInput={(p) => <TextField {...p} label={t('commercial.col.project')} required />}
                  />
                )}

                {type === 'VacationReturn' && form.returnTo !== 'Housing' && returnProject && (
                  <Box sx={{ p: 1.75, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, animation: `${rise} .3s ease both` }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
                      {form.returnTo === 'SameProject' && options?.previousPrice != null && (
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('movements.keptPrice')}</Typography>
                          <Typography sx={{ fontSize: 20, fontWeight: 800, color: tokens.navy800 }}>{sar(options.previousPrice)}</Typography>
                          <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('movements.keptPriceHint')}</Typography>
                        </Box>
                      )}
                      <Box sx={{ flex: 1, display: form.returnTo === 'SameProject' && options?.previousPrice != null ? 'none' : 'block' }}>
                        <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('movements.packagePrice')}</Typography>
                        <Typography sx={{ fontSize: 20, fontWeight: 800, color: quote?.totalPrice == null ? tokens.danger : tokens.navy800 }}>
                          {quote ? (quote.totalPrice == null ? t('movements.noPackage') : sar(quote.totalPrice)) : '…'}
                        </Typography>
                        {quote?.totalPrice != null && (
                          <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                            {t('operations.delivery.breakdown', { salary: sar(quote.salary), fee: sar(quote.totalPrice - quote.salary) })} · <span dir="ltr">{quote.packageNo}</span>
                          </Typography>
                        )}
                        {form.returnTo === 'SameProject' && options?.previousPrice != null && (
                          <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('movements.previousPrice', { price: sar(options.previousPrice) })}</Typography>
                        )}
                      </Box>
                      <FormControlLabel control={<Switch checked={form.special} onChange={(e) => set({ special: e.target.checked, specialPrice: e.target.checked && options?.previousPrice ? String(options.previousPrice) : '' })} />} label={t('movements.specialPrice')} />
                    </Stack>
                    {form.special && (
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
                        <TextField label={t('movements.price')} value={form.specialPrice} onChange={(e) => set({ specialPrice: e.target.value.replace(/[^\d.]/g, '') })} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }} />
                        <TextField sx={{ flex: 1 }} label={t('movements.specialReason')} value={form.specialReason} onChange={(e) => set({ specialReason: e.target.value })} required />
                      </Stack>
                    )}
                  </Box>
                )}

                {type === 'Suspension' && (
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.gray600, mb: 1 }}>{t('movements.suspensionReason')}</Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                      {suspensionReasons.map((r) => (
                        <Chip key={r} label={t(`movements.suspension.${r}`)} onClick={() => set({ suspensionReason: r })} color={form.suspensionReason === r ? 'primary' : 'default'} variant={form.suspensionReason === r ? 'filled' : 'outlined'} sx={{ fontWeight: 700, px: 1 }} />
                      ))}
                    </Stack>
                  </Box>
                )}

                {type === 'FinalExit' && (
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.gray600, mb: 1 }}>{t('movements.exitKind')}</Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                      {exitKinds.map((k) => (
                        <Chip key={k} label={t(`movements.exit.${k}`)} onClick={() => set({ exitKind: k })} color={form.exitKind === k ? 'primary' : 'default'} variant={form.exitKind === k ? 'filled' : 'outlined'} sx={{ fontWeight: 700, px: 1 }} />
                      ))}
                    </Stack>
                  </Box>
                )}

                {housing && (
                  <FormControlLabel control={<Switch checked={form.paySalary} onChange={(e) => set({ paySalary: e.target.checked })} />} label={t('movements.paySalary')} />
                )}

                {late && (
                  <TextField label={t('movements.delayReason')} value={form.delayReason} onChange={(e) => set({ delayReason: e.target.value })} required helperText={t('movements.delayHint')} sx={{ animation: `${rise} .3s ease both` }} />
                )}
                <TextField label={t('movements.notes')} value={form.notes} onChange={(e) => set({ notes: e.target.value })} multiline minRows={2} />
              </Stack>
            </Box>
          )}
        </Box>

        {/* The summary: who, from where to where, and when. */}
        {step === 2 && worker && type && target && (
          <Box sx={{ position: { lg: 'sticky' }, top: { lg: 84 }, animation: `${rise} .45s ease both` }}>
            <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.gray500, mb: 1.5 }}>{t('movements.summary')}</Typography>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, mb: 2.5 }}>
                <Initials name={worker.name} size={40} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, color: tokens.navy800, textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {worker.name}
                  </Typography>
                  <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                    {worker.workerNo}
                  </Typography>
                </Box>
              </Stack>
              <Stack spacing={1.5} sx={{ p: 1.75, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50 }}>
                <StateBubble state={worker.placement} label={stateName(worker.placement)} sub={worker.projectName} big />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 2, height: 28, mx: 3, borderRadius: 2, background: gradient(type) }} />
                  <TypeIcon type={type} size={30} glow />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: typeLook[type].from }}>
                    {t(`movements.types.${type}`)} · {date(form.effectiveOn)}
                  </Typography>
                </Box>
                <StateBubble
                  state={target}
                  label={stateName(target)}
                  sub={target === 'Work' ? (quote?.projectName ?? null) : target === 'ClientVacation' ? worker.projectName : form.place || null}
                  big
                />
              </Stack>
              <Button fullWidth variant="contained" size="large" startIcon={<SendOutlinedIcon />} disabled={busy || !valid} onClick={() => void save()} sx={{ mt: 2.5, py: 1.25, fontWeight: 800, background: gradient(type) }}>
                {t('movements.send')}
              </Button>
              <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mt: 1, textAlign: 'center' }}>{t('movements.sendHint')}</Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
