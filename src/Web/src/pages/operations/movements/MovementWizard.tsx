import CheckIcon from '@mui/icons-material/Check';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MultipleStopOutlinedIcon from '@mui/icons-material/MultipleStopOutlined';
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
import { recordTones } from '../../../components/RecordLayout';
import { Initials } from '../../../components/ui';
import { WizardAside, WizardCard, WizardDialog } from '../../../components/WizardDialog';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { isoToday, sar } from '../../operations/delivery';
import { gradient, rise, StateBubble, TypeIcon, typeLook, useStateName } from './movementMeta';

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
 * A new action as a guided popup, in three steps — the worker, the action (only those their state allows), then its
 * details — with the change drawn live beside the form, in the chosen action's colors. A returned action opens on its
 * details (the worker and the type stay); given a worker (the worker's page), it starts on the action.
 */
export function MovementWizard({
  id,
  workerId,
  onClose,
  onSaved,
  done,
}: {
  id?: string;
  workerId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
  done?: ReactNode;
}) {
  const { t } = useTranslation();
  const { ar, date } = useCommercialFormat();
  const stateName = useStateName();
  const [step, setStep] = useState<Step>(0);
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

  const go = (next: Step) => setStep(next);

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
    } else if (workerId) {
      void chooseWorker(workerId);
    }
  }, [id, workerId]);

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
      onSaved(saved.id);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };


  // The details of the chosen action.
  const details = () =>
    worker &&
    type && (
      <WizardCard title={t(`movements.types.${type}`)} icon={typeLook[type].icon} action={!id ? <Button size="small" onClick={() => go(1)}>{t('movements.changeType')}</Button> : undefined}>
        <Typography sx={{ fontSize: 13, color: tokens.gray500, mb: 2, mt: -1 }}>{t(`movements.typeHints.${type}`)}</Typography>
              <Stack spacing={2.25}>
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
      </WizardCard>
    );

  // Beside the form: who, from where to where, and when.
  const summary = () =>
    worker && (
      <WizardAside tone="movement" title={t('movements.summary')}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, py: 1.25 }}>
          <Initials name={worker.name} size={40} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: tokens.navy800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{worker.name}</Typography>
            <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
              <span dir="ltr">{worker.workerNo}</span>
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ pb: 1.5 }}>
              <Stack spacing={1.5} sx={{ p: 1.75, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50 }}>
                <StateBubble state={worker.placement} label={stateName(worker.placement)} sub={worker.projectName} big />
                {type && target ? (
                  <>
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
                  </>
                ) : (
                  <Typography sx={{ fontSize: 12.5, color: tokens.gray500, px: 1 }}>{t('movements.chooseType')}</Typography>
                )}
              </Stack>
        </Box>
      </WizardAside>
    );

  const steps = [
    { key: 'worker', label: t('movements.steps.worker') },
    { key: 'type', label: t('movements.steps.type') },
    { key: 'details', label: t('movements.steps.details') },
  ];
  const fixedWorker = !!workerId || !!id;
  const look = type ? { band: gradient(type), dark: gradient(type), main: typeLook[type].from, soft: `${typeLook[type].from}1f` } : undefined;
  const ready = [!!options, !!type && !!options?.allowed.includes(type) && !options.busyWith, valid];

  return (
    <WizardDialog
      tone="movement"
      look={look}
      icon={type ? typeLook[type].icon : <MultipleStopOutlinedIcon />}
      title={id ? t('movements.editTitle') : type ? t(`movements.types.${type}`) : t('movements.new')}
      subtitle={worker ? `${worker.name} · ${worker.workerNo}` : t('movements.wizardHint')}
      steps={steps}
      step={step}
      onStep={(n) => go(n as Step)}
      canReach={(n) => !(fixedWorker && n === 0) && !(id && n < 2)}
      canNext={ready[step] ?? false}
      onClose={onClose}
      onFinish={() => void save()}
      finishLabel={t('movements.send')}
      busy={busy}
      error={error}
      done={done}
      aside={worker ? summary() : undefined}
    >
      {step === 0 && (
        <WizardCard title={t('movements.chooseWorker')} icon={<SearchIcon />}>
          <Typography sx={{ fontSize: 13, color: tokens.gray500, mb: 2, mt: -1 }}>{t('movements.chooseWorkerHint')}</Typography>
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
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.25, mt: 2 }}>
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
                  border: `1px solid ${worker?.id === w.id ? recordTones.movement.main : tokens.gray100}`,
                  transition: 'all .18s ease',
                  animation: `${rise} .3s ease both`,
                  animationDelay: `${n * 35}ms`,
                  '&:hover': { borderColor: recordTones.movement.main, boxShadow: tokens.shadowSm, transform: 'translateY(-2px)' },
                }}
              >
                <Initials name={w.name} size={42} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mb: 0.5 }}>
                    <span dir="ltr">{w.workerNo}</span> · {(ar ? w.professionAr : w.professionEn) ?? '—'}
                  </Typography>
                  <StateBubble state={w.placement} label={stateName(w.placement)} sub={w.projectName} />
                </Box>
              </ButtonBase>
            ))}
          </Box>
          {found && found.length === 0 && <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('movements.noWorkers')}</Typography>}
        </WizardCard>
      )}

      {step === 1 && worker && options && (
        <WizardCard
          title={t('movements.chooseType')}
          icon={<MultipleStopOutlinedIcon />}
          action={
            !fixedWorker ? (
              <Button size="small" startIcon={<ReplayOutlinedIcon />} onClick={() => go(0)}>
                {t('movements.changeWorker')}
              </Button>
            ) : undefined
          }
        >
          <Typography sx={{ fontSize: 13, color: tokens.gray500, mb: 2, mt: -1 }}>{t('movements.chooseTypeHint', { state: stateName(worker.placement) })}</Typography>
          {options.busyWith && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('movements.busyWith', { number: options.busyWith })}
            </Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            {[...movementTypes].sort((x, y) => Number(options.allowed.includes(y)) - Number(options.allowed.includes(x))).map((m, n) => {
              const allowed = options.allowed.includes(m) && !options.busyWith;
              const chosen = type === m;
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
                    border: `${chosen ? 2 : 1}px solid ${chosen ? typeLook[m].from : tokens.gray100}`,
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
                  {chosen && <CheckIcon sx={{ position: 'absolute', top: 12, insetInlineEnd: 12, fontSize: 20, color: typeLook[m].from }} />}
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
        </WizardCard>
      )}

      {step === 2 && worker && type && details()}
    </WizardDialog>
  );
}
