import { createElement as _createElement } from "react";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Alert, Autocomplete, Box, FormControlLabel, InputAdornment, LinearProgress, MenuItem, Radio, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { returnReasons, returnsApi } from '../../api/operations';
import { tokens } from '../../app/theme';
import { Badge } from '../../components/ui';
import { WizardAside, WizardCard, WizardDialog, WizardFact } from '../../components/WizardDialog';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday } from './delivery';
import { useStateName } from './movements/movementMeta';
import { daysBetween, Journey, JourneyLine } from './recordParts';
import { DateField } from '../../components/DateField';
const daysAgo = (iso) => Math.floor((Date.parse(isoToday()) - Date.parse(iso)) / 86400000);
/**
 * A new or returned return order, in three steps: the worker on the job, the return (arrival in housing, reason,
 * room, salary), then a review drawing the way back before it goes for approval.
 */
export function ReturnOrderWizard({ id, initialWorkerId, fixedWorker = false, onClose, onSaved, }) {
    const { t } = useTranslation();
    const { ar, date } = useCommercialFormat();
    const stateName = useStateName();
    const [step, setStep] = useState(0);
    const [fixed, setFixed] = useState(fixedWorker && !id);
    const [workers, setWorkers] = useState(null);
    const [workerId, setWorkerId] = useState(null);
    const [filter, setFilter] = useState('');
    const [project, setProject] = useState('');
    const [arrivedOn, setArrivedOn] = useState(isoToday());
    const [reason, setReason] = useState('');
    const [reasonNotes, setReasonNotes] = useState('');
    const [stopSalary, setStopSalary] = useState(true);
    const [housingName, setHousingName] = useState('');
    const [rooms, setRooms] = useState(null);
    const [roomId, setRoomId] = useState(null);
    const [delayReason, setDelayReason] = useState('');
    const [notes, setNotes] = useState('');
    const [orderNo, setOrderNo] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        returnsApi
            .onJobWorkers(id)
            .then((list) => {
            setWorkers(list);
            // From a worker's page («إجراء جديد»): that worker is chosen.
            if (!id && initialWorkerId && list.some((w) => w.worker.id === initialWorkerId && !w.busyOrderNo)) {
                setWorkerId(initialWorkerId);
                if (!fixedWorker)
                    setStep(1);
            }
            else if (fixedWorker) {
                // The worker cannot return now (on another order…): choose the worker as usual.
                setFixed(false);
            }
        })
            .catch((failure) => setError(errorKey(failure)));
        returnsApi.rooms().then(setRooms).catch(() => setRooms([]));
        if (id) {
            returnsApi
                .get(id)
                .then((o) => {
                setOrderNo(o.summary.orderNo);
                setWorkerId(o.summary.workerId);
                setArrivedOn(o.summary.arrivedOn ?? isoToday());
                setReason(o.summary.reason);
                setReasonNotes(o.reasonNotes ?? '');
                setStopSalary(o.summary.stopSalary);
                setHousingName(o.summary.housingName ?? '');
                setRoomId(o.roomId);
                setDelayReason(o.delayReason ?? '');
                setNotes(o.notes ?? '');
            })
                .catch((failure) => setError(errorKey(failure)));
        }
    }, [id]);
    const projects = useMemo(() => [...new Set((workers ?? []).map((w) => w.worker.projectName ?? '—'))].sort(), [workers]);
    const shown = useMemo(() => {
        const q = filter.trim().toUpperCase();
        return (workers ?? []).filter(({ worker: w }) => {
            if (project && (w.projectName ?? '—') !== project)
                return false;
            return !q || [w.workerNo, w.name, w.iqamaNo, w.projectName].some((v) => v?.toUpperCase().includes(q));
        });
    }, [workers, filter, project]);
    const chosen = workers?.find((w) => w.worker.id === workerId)?.worker ?? null;
    const room = rooms?.find((r) => r.id === roomId) ?? null;
    const housing = room ? room.label : housingName.trim();
    const late = !!arrivedOn && daysAgo(arrivedOn) > 2;
    const detailsReady = !!arrivedOn && !!reason && (reason !== 'Other' || reasonNotes.trim() !== '') && (!late || delayReason.trim() !== '');
    const ready = { worker: !!workerId, details: detailsReady, review: !!workerId && detailsReady };
    const save = async () => {
        setBusy(true);
        setError(null);
        const input = {
            workerId: workerId,
            arrivedOn,
            reason,
            reasonNotes: reasonNotes.trim() || null,
            stopSalary,
            housingName: roomId ? null : housingName.trim() || null,
            roomId,
            delayReason: late ? delayReason.trim() || null : null,
            notes: notes.trim() || null,
        };
        try {
            const saved = id ? await returnsApi.update(id, input) : await returnsApi.create(input);
            onSaved(saved.id, saved.approvalError);
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    const steps = [
        { key: 'worker', label: t('operations.return.wizard.worker') },
        { key: 'details', label: t('operations.return.wizard.details') },
        { key: 'review', label: t('operations.return.wizard.review') },
    ].filter((s) => !fixed || s.key !== 'worker');
    const at = steps[step]?.key;
    const worked = daysBetween(chosen?.projectJoinedOn, arrivedOn);
    return (_jsxs(WizardDialog, { tone: "return", icon: _jsx(KeyboardReturnOutlinedIcon, {}), title: orderNo ? t('operations.return.editOrder', { no: orderNo }) : t('operations.return.new'), subtitle: chosen ? `${chosen.name} · ${chosen.workerNo}` : t('operations.return.wizard.hint'), steps: steps, step: step, onStep: setStep, canNext: at ? (ready[at] ?? false) : false, onClose: onClose, onFinish: () => void save(), finishLabel: t('operations.delivery.submit'), busy: busy, error: error, aside: _jsxs(WizardAside, { tone: "return", title: t('operations.return.wizard.summary'), children: [_jsx(WizardFact, { icon: _jsx(EngineeringOutlinedIcon, {}), label: t('operations.return.col.worker'), value: chosen?.name, sub: chosen?.workerNo }), _jsx(WizardFact, { icon: _jsx(ApartmentOutlinedIcon, {}), label: t('operations.return.col.project'), value: chosen?.projectName, sub: chosen ? `${t('operations.return.workStarted')}: ${date(chosen.projectJoinedOn)}` : null }), _jsx(WizardFact, { icon: _jsx(EventOutlinedIcon, {}), label: t('operations.return.col.arrivedOn'), value: arrivedOn ? date(arrivedOn) : null }), _jsx(WizardFact, { icon: _jsx(ReportProblemOutlinedIcon, {}), label: t('operations.return.col.reason'), value: reason ? t(`operations.return.reasons.${reason}`) : null }), _jsx(WizardFact, { icon: _jsx(HotelOutlinedIcon, {}), label: t('operations.return.col.housing'), value: housing }), _jsx(WizardFact, { icon: _jsx(PaymentsOutlinedIcon, {}), label: t('operations.return.salaryInHousing'), value: stopSalary ? t('operations.return.salaryStops') : t('operations.return.salaryPaid') })] }), children: [at === 'worker' && (_jsxs(WizardCard, { title: t('operations.return.sections.worker', { count: workers?.length ?? 0 }), icon: _jsx(EngineeringOutlinedIcon, {}), children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, mb: 1.5 }, children: t('operations.return.workerHint') }), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, mb: 1.5 }, children: [_jsx(TextField, { size: "small", sx: { flex: 2 }, placeholder: t('operations.return.workerSearch'), value: filter, onChange: (e) => setFilter(e.target.value), autoFocus: true, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsxs(TextField, { select: true, size: "small", sx: { flex: 1, minWidth: 200 }, label: t('commercial.col.project'), value: project, onChange: (e) => setProject(e.target.value), children: [_jsx(MenuItem, { value: "", children: t('operations.delivery.available.any') }), projects.map((p) => (_jsx(MenuItem, { value: p, children: p }, p)))] })] }), !workers && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { sx: { maxHeight: 380, border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px` }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { padding: "checkbox" }), _jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('workforce.col.joined') }), _jsx(TableCell, { children: t('workforce.col.status') })] }) }), _jsxs(TableBody, { children: [shown.map(({ worker: w, busyOrderNo }) => {
                                            const disabled = !!busyOrderNo;
                                            return (_jsxs(TableRow, { hover: !disabled, selected: workerId === w.id, sx: { cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }, onClick: () => !disabled && setWorkerId(w.id), children: [_jsx(TableCell, { padding: "checkbox", children: _jsx(Radio, { checked: workerId === w.id, disabled: disabled, size: "small" }) }), _jsxs(TableCell, { sx: { minWidth: 190 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: w.name }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [_jsx("span", { dir: "ltr", children: w.workerNo }), w.iqamaNo && (_jsxs(_Fragment, { children: [' · ', _jsx("span", { dir: "ltr", children: w.iqamaNo })] }))] })] }), _jsxs(TableCell, { children: [(ar ? w.professionAr : w.professionEn) ?? '—', _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: (ar ? w.nationalityAr : w.nationalityEn) ?? '—' })] }), _jsx(TableCell, { children: w.projectName ?? '—' }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(w.projectJoinedOn) }), _jsx(TableCell, { children: busyOrderNo ? _jsx(Badge, { tone: "warning", children: t('operations.delivery.busy', { no: busyOrderNo }) }) : _jsx(Badge, { tone: "success", children: (ar ? w.statusAr : w.statusEn) ?? '—' }) })] }, w.id));
                                        }), workers && shown.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, align: "center", sx: { py: 4, color: tokens.gray500 }, children: t('operations.delivery.noWorkersFound') }) }))] })] }) })] })), at === 'details' && (_jsxs(WizardCard, { title: t('operations.return.sections.details'), icon: _jsx(KeyboardReturnOutlinedIcon, {}), children: [chosen && (_jsx(Alert, { severity: "info", sx: { mb: 2 }, children: t('operations.return.chosen', { project: chosen.projectName ?? '—', since: date(chosen.projectJoinedOn) }) })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }, children: [_jsx(DateField, { label: t('operations.return.col.arrivedOn'), value: arrivedOn, onChange: (e) => setArrivedOn(e.target.value), required: true, helperText: t('operations.return.arrivedHint'), slotProps: { inputLabel: { shrink: true }, htmlInput: { max: isoToday() } } }), _jsx(TextField, { select: true, label: t('operations.return.col.reason'), value: reason, onChange: (e) => setReason(e.target.value), required: true, children: returnReasons.map((r) => (_jsx(MenuItem, { value: r, children: t(`operations.return.reasons.${r}`) }, r))) }), _jsx(TextField, { sx: { gridColumn: { md: '1 / -1' } }, label: t('operations.return.reasonNotes'), value: reasonNotes, onChange: (e) => setReasonNotes(e.target.value), required: reason === 'Other', multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 1000 } } }), rooms && rooms.length > 0 ? (_jsx(Autocomplete, { sx: { gridColumn: { md: '1 / -1' } }, options: rooms, value: room, onChange: (_, v) => setRoomId(v?.id ?? null), getOptionLabel: (r) => r.label, getOptionDisabled: (r) => r.free === 0 && r.id !== roomId, groupBy: (r) => r.buildingName, isOptionEqualToValue: (a, b) => a.id === b.id, renderOption: (props, r) => (_createElement("li", { ...props, key: r.id },
                                    _jsxs(Stack, { direction: "row", sx: { width: '100%', justifyContent: 'space-between', gap: 2 }, children: [_jsx("span", { children: r.roomNo }), _jsx(Typography, { component: "span", sx: { fontSize: 12.5, color: r.free === 0 ? tokens.danger : tokens.gray500 }, children: r.free === 0 ? t('housing.full') : t('housing.freeCount', { count: r.free }) })] }))), renderInput: (params) => _jsx(TextField, { ...params, label: t('operations.return.room'), helperText: t('operations.return.roomHint') }) })) : (_jsx(TextField, { sx: { gridColumn: { md: '1 / -1' } }, label: t('operations.return.col.housing'), value: housingName, onChange: (e) => setHousingName(e.target.value), helperText: t('operations.return.housingHint'), slotProps: { htmlInput: { maxLength: 200 } } })), late && (_jsx(TextField, { sx: { gridColumn: { md: '1 / -1' } }, label: t('operations.delivery.delayReason'), value: delayReason, onChange: (e) => setDelayReason(e.target.value), required: true, helperText: t('operations.return.delayHint'), slotProps: { htmlInput: { maxLength: 500 } } })), _jsxs(Box, { sx: { gridColumn: { md: '1 / -1' }, p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.gray100}` }, children: [_jsx(FormControlLabel, { control: _jsx(Switch, { checked: stopSalary, onChange: (e) => setStopSalary(e.target.checked) }), label: t('operations.return.stopSalary') }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t('operations.return.stopSalaryHint') })] }), _jsx(TextField, { sx: { gridColumn: { md: '1 / -1' } }, label: t('operations.delivery.notes'), value: notes, onChange: (e) => setNotes(e.target.value), slotProps: { htmlInput: { maxLength: 2000 } } })] })] })), at === 'review' && (_jsxs(_Fragment, { children: [_jsxs(WizardCard, { title: t('operations.return.journey'), icon: _jsx(FactCheckOutlinedIcon, {}), children: [_jsx(Journey, { from: { state: 'Work', label: stateName('Work'), sub: chosen?.projectName, lines: _jsx(JourneyLine, { label: t('operations.return.workStarted'), children: date(chosen?.projectJoinedOn ?? null) }) }, to: { state: 'Housing', label: stateName('Housing'), sub: housing || null, lines: _jsx(JourneyLine, { label: t('operations.return.col.arrivedOn'), children: date(arrivedOn) }) }, pill: worked !== null ? t('operations.return.workedDays', { count: worked }) : undefined }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mt: 2.5 }, children: [
                                    [t('operations.return.col.reason'), reason ? t(`operations.return.reasons.${reason}`) : '—'],
                                    [t('operations.return.salaryInHousing'), stopSalary ? t('operations.return.salaryStops') : t('operations.return.salaryPaid')],
                                    [t('operations.return.reasonNotes'), reasonNotes.trim() || '—'],
                                ].map(([label, value]) => (_jsxs(Box, { sx: { p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.gray100}` }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: label }), _jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }, children: value })] }, label))) })] }), _jsx(Alert, { severity: "info", children: t('operations.return.flowHint') })] }))] }));
}
