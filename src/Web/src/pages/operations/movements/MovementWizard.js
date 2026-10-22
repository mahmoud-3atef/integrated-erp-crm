import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CheckIcon from '@mui/icons-material/Check';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MultipleStopOutlinedIcon from '@mui/icons-material/MultipleStopOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import { Alert, Autocomplete, Box, Button, ButtonBase, Chip, CircularProgress, FormControlLabel, InputAdornment, Stack, Switch, TextField, Tooltip, Typography, } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../../app/session';
import { errorKey } from '../../../api/auth';
import { exitKinds, movementsApi, movementTypes, suspensionReasons, } from '../../../api/movements';
import { tokens } from '../../../app/theme';
import { recordTones } from '../../../components/RecordLayout';
import { Initials } from '../../../components/ui';
import { WizardAside, WizardCard, WizardDialog } from '../../../components/WizardDialog';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { isoToday, sar } from '../../operations/delivery';
import { gradient, rise, StateBubble, TypeIcon, typeLook, useStateName } from './movementMeta';
import { DateField } from '../../../components/DateField';
/** The period a movement opens, as the server decides it (to draw the "to" side before saving). */
const opens = (type, vacationKind, returnTo) => ({
    Arrival: 'Housing',
    VacationDeparture: vacationKind === 'Client' ? 'ClientVacation' : 'Vacation',
    VacationReturn: returnTo === 'Housing' ? 'Housing' : 'Work',
    Absconding: 'Absconded',
    AbscondingReturn: 'Housing',
    Suspension: 'Suspended',
    SuspensionLift: 'Housing',
    FinalExit: 'Out',
})[type];
const daysBetween = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
/** A choice drawn as a card: an icon, a title and a line under it. */
function ChoiceCard({ selected, onClick, icon, title, sub, tone }) {
    return (_jsxs(ButtonBase, { onClick: onClick, sx: {
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
        }, children: [_jsx(Box, { sx: { width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', color: selected ? '#fff' : tone, bgcolor: selected ? tone : `${tone}14`, transition: 'all .18s ease' }, children: selected ? _jsx(CheckIcon, { sx: { fontSize: 20 } }) : icon }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }, children: title }), sub && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: sub })] })] }));
}
/**
 * A new action as a guided popup, in three steps — the worker, the action (only those their state allows), then its
 * details — with the change drawn live beside the form, in the chosen action's colors. A returned action opens on its
 * details (the worker and the type stay); given a worker (the worker's page), it starts on the action.
 */
export function MovementWizard({ id, workerId, onClose, onSaved, done, }) {
    const { t } = useTranslation();
    const { ar, date } = useCommercialFormat();
    const stateName = useStateName();
    const [step, setStep] = useState(0);
    const [search, setSearch] = useState('');
    const [found, setFound] = useState(null);
    const [searching, setSearching] = useState(false);
    const [options, setOptions] = useState(null);
    const [type, setType] = useState(null);
    const [projects, setProjects] = useState([]);
    const [quote, setQuote] = useState(null);
    const [form, setForm] = useState({
        effectiveOn: isoToday(),
        expectedReturnOn: '',
        vacationKind: 'Regular',
        returnTo: 'Housing',
        projectId: null,
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
    const [error, setError] = useState(null);
    const set = (patch) => setForm({ ...form, ...patch });
    const go = (next) => setStep(next);
    // A worker chosen from the search, the worker page, or the returned movement.
    const chooseWorker = async (workerId, except) => {
        setError(null);
        try {
            setOptions(await movementsApi.options(workerId, except));
            if (!except)
                go(1);
        }
        catch (failure) {
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
                .catch((failure) => setError(errorKey(failure)));
        }
        else if (workerId) {
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
                .catch((failure) => setError(errorKey(failure)))
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);
    // A return to a project: its price for the worker on the return date.
    const returnProject = type === 'VacationReturn' ? (form.returnTo === 'SameProject' ? options?.previousProjectId : form.returnTo === 'NewProject' ? form.projectId : null) : null;
    useEffect(() => {
        setQuote(null);
        if (!returnProject || !options)
            return;
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
        if (!worker || !type || !form.effectiveOn)
            return false;
        if (late && !form.delayReason.trim())
            return false;
        if (type === 'Suspension' && !form.suspensionReason)
            return false;
        if (type === 'FinalExit' && !form.exitKind)
            return false;
        if (type === 'VacationDeparture' && form.expectedReturnOn && form.expectedReturnOn <= form.effectiveOn)
            return false;
        if (type === 'VacationReturn' && form.returnTo !== 'Housing') {
            if (!returnProject)
                return false;
            const kept = form.returnTo === 'SameProject' ? options?.previousPrice : null;
            if (form.special ? !(Number(form.specialPrice) > 0) || !form.specialReason.trim() : (kept ?? quote?.totalPrice) == null)
                return false;
        }
        return true;
    }, [worker, type, form, late, returnProject, quote]);
    const save = async () => {
        setBusy(true);
        setError(null);
        const input = {
            type: type,
            workerId: worker.id,
            effectiveOn: form.effectiveOn,
            expectedReturnOn: type === 'VacationDeparture' && form.expectedReturnOn ? form.expectedReturnOn : null,
            vacationKind: type === 'VacationDeparture' ? form.vacationKind : null,
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
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    // The details of the chosen action.
    const details = () => worker &&
        type && (_jsxs(WizardCard, { title: t(`movements.types.${type}`), icon: typeLook[type].icon, action: !id ? _jsx(Button, { size: "small", onClick: () => go(1), children: t('movements.changeType') }) : undefined, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500, mb: 2, mt: -1 }, children: t(`movements.typeHints.${type}`) }), _jsxs(Stack, { spacing: 2.25, children: [_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }, children: [_jsx(DateField, { label: t(`movements.dateLabel.${type}`), value: form.effectiveOn, onChange: (e) => set({ effectiveOn: e.target.value }), required: true, slotProps: { inputLabel: { shrink: true } } }), type === 'VacationDeparture' && (_jsx(DateField, { label: t('movements.expectedReturn'), value: form.expectedReturnOn, onChange: (e) => set({ expectedReturnOn: e.target.value }), error: !!form.expectedReturnOn && form.expectedReturnOn <= form.effectiveOn, slotProps: { inputLabel: { shrink: true } } })), (type === 'Arrival' || type === 'Absconding' || housing) && (_jsx(TextField, { label: t(type === 'Absconding' ? 'movements.lastPlace' : 'movements.housingPlace'), value: form.place, onChange: (e) => set({ place: e.target.value }) }))] }), type === 'VacationDeparture' && (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.gray600, mb: 1 }, children: t('movements.vacationKind') }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1.25, children: [_jsx(ChoiceCard, { selected: form.vacationKind === 'Regular', onClick: () => set({ vacationKind: 'Regular' }), icon: _jsx(HotelOutlinedIcon, {}), title: t('movements.vacation.Regular'), sub: t('movements.vacation.RegularHint'), tone: "#3b6fd8" }), _jsx(Tooltip, { title: worker.placement !== 'Working' ? t('movements.vacation.ClientOnlyWorking') : '', children: _jsx(Box, { sx: { flex: 1, display: 'flex', opacity: worker.placement !== 'Working' ? 0.45 : 1, pointerEvents: worker.placement !== 'Working' ? 'none' : 'auto' }, children: _jsx(ChoiceCard, { selected: form.vacationKind === 'Client', onClick: () => set({ vacationKind: 'Client' }), icon: _jsx(SwapHorizOutlinedIcon, {}), title: t('movements.vacation.Client'), sub: t('movements.vacation.ClientHint'), tone: "#6a4fd1" }) }) })] })] })), type === 'VacationReturn' && (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.gray600, mb: 1 }, children: t('movements.returnTo') }), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, spacing: 1.25, children: [_jsx(ChoiceCard, { selected: form.returnTo === 'Housing', onClick: () => set({ returnTo: 'Housing' }), icon: _jsx(HotelOutlinedIcon, {}), title: t('movements.return.Housing'), sub: t('movements.return.HousingHint'), tone: "#0d6e8c" }), _jsx(Box, { sx: { flex: 1, display: 'flex', opacity: options?.previousProjectId ? 1 : 0.45, pointerEvents: options?.previousProjectId ? 'auto' : 'none' }, children: _jsx(ChoiceCard, { selected: form.returnTo === 'SameProject', onClick: () => set({ returnTo: 'SameProject' }), icon: _jsx(ReplayOutlinedIcon, {}), title: t('movements.return.SameProject'), sub: options?.previousProjectName ?? t('movements.return.NoPrevious'), tone: "#1f7a4d" }) }), _jsx(ChoiceCard, { selected: form.returnTo === 'NewProject', onClick: () => set({ returnTo: 'NewProject' }), icon: _jsx(SwapHorizOutlinedIcon, {}), title: t('movements.return.NewProject'), sub: t('movements.return.NewProjectHint'), tone: "#b4561b" })] })] })), type === 'VacationReturn' && form.returnTo === 'NewProject' && (_jsx(Autocomplete, { options: projects, value: projects.find((p) => p.id === form.projectId) ?? null, onChange: (_, v) => set({ projectId: v?.id ?? null }), getOptionLabel: (p) => `${p.name} (${p.code})`, isOptionEqualToValue: (a, b) => a.id === b.id, renderInput: (p) => _jsx(TextField, { ...p, label: t('commercial.col.project'), required: true }) })), type === 'VacationReturn' && form.returnTo !== 'Housing' && returnProject && (_jsxs(Box, { sx: { p: 1.75, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, animation: `${rise} .3s ease both` }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 2, alignItems: { md: 'center' } }, children: [form.returnTo === 'SameProject' && options?.previousPrice != null && (_jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t('movements.keptPrice') }), _jsx(Typography, { sx: { fontSize: 20, fontWeight: 800, color: tokens.navy800 }, children: sar(options.previousPrice) }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t('movements.keptPriceHint') })] })), _jsxs(Box, { sx: { flex: 1, display: form.returnTo === 'SameProject' && options?.previousPrice != null ? 'none' : 'block' }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t('movements.packagePrice') }), _jsx(Typography, { sx: { fontSize: 20, fontWeight: 800, color: quote?.totalPrice == null ? tokens.danger : tokens.navy800 }, children: quote ? (quote.totalPrice == null ? t('movements.noPackage') : sar(quote.totalPrice)) : '…' }), quote?.totalPrice != null && (_jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [t('operations.delivery.breakdown', { salary: sar(quote.salary), fee: sar(quote.totalPrice - quote.salary) }), " \u00B7 ", _jsx("span", { dir: "ltr", children: quote.packageNo })] })), form.returnTo === 'SameProject' && options?.previousPrice != null && (_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t('movements.previousPrice', { price: sar(options.previousPrice) }) }))] }), _jsx(FormControlLabel, { control: _jsx(Switch, { checked: form.special, onChange: (e) => set({ special: e.target.checked, specialPrice: e.target.checked && options?.previousPrice ? String(options.previousPrice) : '' }) }), label: t('movements.specialPrice') })] }), form.special && (_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, spacing: 1.5, sx: { mt: 1.5 }, children: [_jsx(TextField, { label: t('movements.price'), value: form.specialPrice, onChange: (e) => set({ specialPrice: e.target.value.replace(/[^\d.]/g, '') }), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } }), _jsx(TextField, { sx: { flex: 1 }, label: t('movements.specialReason'), value: form.specialReason, onChange: (e) => set({ specialReason: e.target.value }), required: true })] }))] })), type === 'Suspension' && (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.gray600, mb: 1 }, children: t('movements.suspensionReason') }), _jsx(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: 1 }, children: suspensionReasons.map((r) => (_jsx(Chip, { label: t(`movements.suspension.${r}`), onClick: () => set({ suspensionReason: r }), color: form.suspensionReason === r ? 'primary' : 'default', variant: form.suspensionReason === r ? 'filled' : 'outlined', sx: { fontWeight: 700, px: 1 } }, r))) })] })), type === 'FinalExit' && (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.gray600, mb: 1 }, children: t('movements.exitKind') }), _jsx(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: 1 }, children: exitKinds.map((k) => (_jsx(Chip, { label: t(`movements.exit.${k}`), onClick: () => set({ exitKind: k }), color: form.exitKind === k ? 'primary' : 'default', variant: form.exitKind === k ? 'filled' : 'outlined', sx: { fontWeight: 700, px: 1 } }, k))) })] })), housing && (_jsx(FormControlLabel, { control: _jsx(Switch, { checked: form.paySalary, onChange: (e) => set({ paySalary: e.target.checked }) }), label: t('movements.paySalary') })), late && (_jsx(TextField, { label: t('movements.delayReason'), value: form.delayReason, onChange: (e) => set({ delayReason: e.target.value }), required: true, helperText: t('movements.delayHint'), sx: { animation: `${rise} .3s ease both` } })), _jsx(TextField, { label: t('movements.notes'), value: form.notes, onChange: (e) => set({ notes: e.target.value }), multiline: true, minRows: 2 })] })] }));
    // Beside the form: who, from where to where, and when.
    const summary = () => worker && (_jsxs(WizardAside, { tone: "movement", title: t('movements.summary'), children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25, py: 1.25 }, children: [_jsx(Initials, { name: worker.name, size: 40 }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 14, fontWeight: 800, color: tokens.navy800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: worker.name }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: _jsx("span", { dir: "ltr", children: worker.workerNo }) })] })] }), _jsx(Box, { sx: { pb: 1.5 }, children: _jsxs(Stack, { spacing: 1.5, sx: { p: 1.75, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50 }, children: [_jsx(StateBubble, { state: worker.placement, label: stateName(worker.placement), sub: worker.projectName, big: true }), type && target ? (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: { width: 2, height: 28, mx: 3, borderRadius: 2, background: gradient(type) } }), _jsx(TypeIcon, { type: type, size: 30, glow: true }), _jsxs(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: typeLook[type].from }, children: [t(`movements.types.${type}`), " \u00B7 ", date(form.effectiveOn)] })] }), _jsx(StateBubble, { state: target, label: stateName(target), sub: target === 'Work' ? (quote?.projectName ?? null) : target === 'ClientVacation' ? worker.projectName : form.place || null, big: true })] })) : (_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, px: 1 }, children: t('movements.chooseType') }))] }) })] }));
    const steps = [
        { key: 'worker', label: t('movements.steps.worker') },
        { key: 'type', label: t('movements.steps.type') },
        { key: 'details', label: t('movements.steps.details') },
    ];
    const fixedWorker = !!workerId || !!id;
    const look = type ? { band: gradient(type), dark: gradient(type), main: typeLook[type].from, soft: `${typeLook[type].from}1f` } : undefined;
    const ready = [!!options, !!type && !!options?.allowed.includes(type) && !options.busyWith, valid];
    return (_jsxs(WizardDialog, { tone: "movement", look: look, icon: type ? typeLook[type].icon : _jsx(MultipleStopOutlinedIcon, {}), title: id ? t('movements.editTitle') : type ? t(`movements.types.${type}`) : t('movements.new'), subtitle: worker ? `${worker.name} · ${worker.workerNo}` : t('movements.wizardHint'), steps: steps, step: step, onStep: (n) => go(n), canReach: (n) => !(fixedWorker && n === 0) && !(id && n < 2), canNext: ready[step] ?? false, onClose: onClose, onFinish: () => void save(), finishLabel: t('movements.send'), busy: busy, error: error, done: done, aside: worker ? summary() : undefined, children: [step === 0 && (_jsxs(WizardCard, { title: t('movements.chooseWorker'), icon: _jsx(SearchIcon, {}), children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500, mb: 2, mt: -1 }, children: t('movements.chooseWorkerHint') }), _jsx(TextField, { autoFocus: true, fullWidth: true, placeholder: t('movements.workerSearch'), value: search, onChange: (e) => setSearch(e.target.value), slotProps: {
                            input: {
                                startAdornment: (_jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, {}) })),
                                endAdornment: searching ? _jsx(CircularProgress, { size: 18 }) : undefined,
                                sx: { fontSize: 16, borderRadius: 3, py: 0.5 },
                            },
                        } }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.25, mt: 2 }, children: found?.map((w, n) => (_jsxs(ButtonBase, { onClick: () => void chooseWorker(w.id), sx: {
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
                            }, children: [_jsx(Initials, { name: w.name, size: 42 }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800, color: tokens.navy800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: w.name }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, mb: 0.5 }, children: [_jsx("span", { dir: "ltr", children: w.workerNo }), " \u00B7 ", (ar ? w.professionAr : w.professionEn) ?? '—'] }), _jsx(StateBubble, { state: w.placement, label: stateName(w.placement), sub: w.projectName })] })] }, w.id))) }), found && found.length === 0 && _jsx(Typography, { sx: { py: 4, textAlign: 'center', color: tokens.gray500 }, children: t('movements.noWorkers') })] })), step === 1 && worker && options && (_jsxs(WizardCard, { title: t('movements.chooseType'), icon: _jsx(MultipleStopOutlinedIcon, {}), action: !fixedWorker ? (_jsx(Button, { size: "small", startIcon: _jsx(ReplayOutlinedIcon, {}), onClick: () => go(0), children: t('movements.changeWorker') })) : undefined, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500, mb: 2, mt: -1 }, children: t('movements.chooseTypeHint', { state: stateName(worker.placement) }) }), options.busyWith && (_jsx(Alert, { severity: "warning", sx: { mb: 2 }, children: t('movements.busyWith', { number: options.busyWith }) })), _jsx(DocumentActions, { worker: worker }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5 }, children: [...movementTypes].sort((x, y) => Number(options.allowed.includes(y)) - Number(options.allowed.includes(x))).map((m, n) => {
                            const allowed = options.allowed.includes(m) && !options.busyWith;
                            const chosen = type === m;
                            const card = (_jsxs(ButtonBase, { disabled: !allowed, onClick: () => {
                                    setType(m);
                                    go(2);
                                }, sx: {
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
                                }, children: [_jsx(TypeIcon, { type: m, size: 46 }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 14.5, fontWeight: 800, color: tokens.navy800 }, children: t(`movements.types.${m}`) }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, lineHeight: 1.5 }, children: t(`movements.typeHints.${m}`) })] }), !allowed && _jsx(LockOutlinedIcon, { sx: { position: 'absolute', top: 12, insetInlineEnd: 12, fontSize: 18, color: tokens.gray500 } }), chosen && _jsx(CheckIcon, { sx: { position: 'absolute', top: 12, insetInlineEnd: 12, fontSize: 20, color: typeLook[m].from } })] }, m));
                            return allowed ? (card) : (_jsx(Tooltip, { title: t('movements.notAllowed', { state: stateName(worker.placement) }), children: _jsx("span", { children: card }) }, m));
                        }) })] })), step === 2 && worker && type && details()] }));
}
/**
 * The orders a worker's state allows, as the old employee screen's «إجراء جديد»: a delivery order to a project (a
 * worker in housing or new; the step suggested for one in housing), and a return to housing (a worker on the job; the
 * step suggested for them). Each opens its order with the worker chosen; a locked one says why.
 */
function DocumentActions({ worker }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const ended = worker.placement === 'Exited' || worker.placement === 'Absconded';
    const actions = [
        {
            key: 'delivery',
            show: can('operations.delivery.create', true),
            icon: _jsx(WorkOutlineOutlinedIcon, {}),
            from: '#0e7c86',
            reason: worker.available ? null : ended ? t('movements.docs.ended') : t('movements.docs.deliveryWhen'),
            suggested: worker.available && worker.placement === 'Housing',
            open: () => navigate('/operations/delivery-orders/new', { state: { workerIds: [worker.id], fromWorker: true } }),
        },
        {
            key: 'return',
            show: can('operations.return.create', true),
            icon: _jsx(HomeOutlinedIcon, {}),
            from: '#b38a0f',
            reason: worker.onJob ? null : worker.placement === 'Housing' ? t('movements.docs.inHousing') : ended ? t('movements.docs.ended') : t('movements.docs.returnWhen'),
            suggested: worker.onJob,
            open: () => navigate('/operations/return-orders/new', { state: { workerId: worker.id, fromWorker: true } }),
        },
    ].filter((a) => a.show);
    if (actions.length === 0)
        return null;
    return (_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5, mb: 1.5 }, children: actions.map((a) => {
            const allowed = !a.reason;
            return (_jsxs(ButtonBase, { disabled: !allowed, onClick: a.open, sx: {
                    display: 'flex', alignItems: 'center', gap: 1.5, p: 2, textAlign: 'start', borderRadius: `${tokens.radius + 4}px`, position: 'relative',
                    border: `${a.suggested && allowed ? 2 : 1}px solid ${a.suggested && allowed ? a.from : tokens.gray100}`,
                    opacity: allowed ? 1 : 0.5, filter: allowed ? 'none' : 'grayscale(1)', transition: 'all .2s ease',
                    '&:hover': allowed ? { transform: 'translateY(-3px)', boxShadow: `0 14px 28px ${a.from}2e`, borderColor: a.from } : undefined,
                }, children: [_jsx(Box, { "aria-hidden": true, sx: { flex: '0 0 auto', width: 46, height: 46, borderRadius: '14px', display: 'grid', placeItems: 'center', color: '#fff', bgcolor: a.from, '& svg': { fontSize: 24 } }, children: a.icon }), _jsxs(Box, { sx: { minWidth: 0, flex: 1 }, children: [_jsx(Typography, { sx: { fontSize: 14.5, fontWeight: 800, color: tokens.navy800 }, children: t(`movements.docs.${a.key}`) }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, lineHeight: 1.5 }, children: t(`movements.docs.${a.key}Hint`) })] }), (a.reason || a.suggested) && (_jsx(Box, { component: "span", sx: { position: 'absolute', top: 10, insetInlineEnd: 10, borderRadius: 99, px: 1, py: 0.2, fontSize: 11, fontWeight: 700, color: a.reason ? tokens.gray600 : '#fff', bgcolor: a.reason ? tokens.gray100 : a.from }, children: a.reason ?? t('movements.docs.suggested') })), !allowed && _jsx(LockOutlinedIcon, { sx: { fontSize: 18, color: tokens.gray500 } })] }, a.key));
        }) }));
}
