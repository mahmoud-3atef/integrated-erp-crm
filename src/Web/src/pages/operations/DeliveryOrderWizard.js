import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { Alert, Autocomplete, Box, Checkbox, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { operationsApi } from '../../api/operations';
import { tokens } from '../../app/theme';
import { recordTones } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { WizardAside, WizardCard, WizardDialog, WizardFact } from '../../components/WizardDialog';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { AvailableWorkers } from './AvailableWorkers';
import { isoToday, sar } from './delivery';
/** The least monthly service price a worker can have (as the server checks it). */
const minimumPrice = 1000;
import { DateField } from '../../components/DateField';
const daysAgo = (iso) => Math.floor((Date.parse(isoToday()) - Date.parse(iso)) / 86400000);
function initials(name) {
    return (name
        .split(/\s+/)
        .filter((part) => /\p{L}/u.test(part))
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || '·');
}
/**
 * A new or returned delivery order, in four steps: the order (project, dates, receiver), the workers, their prices and
 * start dates, then a review before it goes for approval. Saving starts the approval (the creator confirms first).
 */
export function DeliveryOrderWizard({ id, initialWorkerIds, fixedWorkers = false, onClose, onSaved, }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const [step, setStep] = useState(0);
    const [fixed, setFixed] = useState(fixedWorkers && !id);
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState(null);
    const [deliverOn, setDeliverOn] = useState(isoToday());
    const [startOn, setStartOn] = useState(isoToday());
    const [receiverName, setReceiverName] = useState('');
    const [receiverTitle, setReceiverTitle] = useState('');
    const [delayReason, setDelayReason] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState([]);
    const [quotes, setQuotes] = useState({});
    const [cards, setCards] = useState({});
    const [orderNo, setOrderNo] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        operationsApi.projects().then(setProjects).catch((failure) => setError(errorKey(failure)));
        if (id) {
            operationsApi
                .get(id)
                .then((o) => {
                setOrderNo(o.summary.orderNo);
                setProjectId(o.summary.projectId);
                setDeliverOn(o.summary.deliverOn ?? isoToday());
                setStartOn(o.summary.startOn ?? isoToday());
                setReceiverName(o.summary.receiverName);
                setReceiverTitle(o.receiverTitle ?? '');
                setDelayReason(o.delayReason ?? '');
                setNotes(o.notes ?? '');
                setLines(o.lines
                    .filter((l) => l.workerId)
                    .map((l) => ({ workerId: l.workerId, startOn: l.startOn ?? o.summary.startOn ?? '', special: l.isSpecialPrice, specialPrice: l.isSpecialPrice ? String(l.totalPrice) : '', specialReason: l.specialReason ?? '' })));
            })
                .catch((failure) => setError(errorKey(failure)));
        }
    }, [id]);
    // The package price of every worker on the order, again whenever the project, the date or the workers change.
    const workerKey = lines.map((l) => l.workerId).join(',');
    useEffect(() => {
        if (!projectId || !workerKey) {
            setQuotes({});
            return;
        }
        let cancelled = false;
        operationsApi
            .prices(projectId, workerKey.split(','), startOn || deliverOn, id)
            .then((list) => !cancelled && setQuotes(Object.fromEntries(list.map((q) => [q.worker.id, q]))))
            .catch((failure) => !cancelled && setError(errorKey(failure)));
        return () => {
            cancelled = true;
        };
    }, [projectId, workerKey, startOn, deliverOn, id]);
    // Workers chosen in the showroom start the new order.
    const initial = (initialWorkerIds ?? []).join(',');
    useEffect(() => {
        if (id || !initial)
            return;
        operationsApi
            .availableWorkers()
            .then((list) => {
            const ids = initial.split(',');
            const free = list.filter((a) => ids.includes(a.worker.id) && !a.busyOrderNo).map((a) => a.worker);
            add(free);
            // The worker cannot be delivered now (on another order…): choose the workers as usual.
            if (free.length === 0)
                setFixed(false);
        })
            .catch((failure) => setError(errorKey(failure)));
    }, [id, initial]);
    const project = projects.find((p) => p.id === projectId) ?? null;
    const late = !!deliverOn && daysAgo(deliverOn) > 2;
    const add = (workers) => {
        setCards((current) => ({ ...current, ...Object.fromEntries(workers.map((w) => [w.id, w])) }));
        setLines((current) => [
            ...current,
            ...workers.filter((w) => !current.some((l) => l.workerId === w.id)).map((w) => ({ workerId: w.id, startOn, special: false, specialPrice: '', specialReason: '' })),
        ]);
    };
    const toggle = (workers, on) => (on ? add(workers) : setLines((current) => current.filter((l) => !workers.some((w) => w.id === l.workerId))));
    // The order's start moves the workers' starts that followed it.
    const changeStart = (value) => {
        setLines((current) => current.map((l) => (!l.startOn || l.startOn === startOn ? { ...l, startOn: value } : l)));
        setStartOn(value);
    };
    const change = (workerId, patch) => setLines((current) => current.map((l) => (l.workerId === workerId ? { ...l, ...patch } : l)));
    const remove = (workerId) => setLines((current) => current.filter((l) => l.workerId !== workerId));
    const cardOf = (workerId) => quotes[workerId]?.worker ?? cards[workerId];
    const priceOf = (line) => (line.special ? Number(line.specialPrice) || 0 : quotes[line.workerId]?.totalPrice ?? null);
    const total = lines.reduce((sum, l) => sum + (priceOf(l) ?? 0), 0);
    const missingPrice = lines.some((l) => !l.special && quotes[l.workerId]?.totalPrice === null);
    const orderReady = !!projectId && !!deliverOn && !!startOn && startOn >= deliverOn && receiverName.trim() !== '' && (!late || delayReason.trim() !== '');
    // Every worker has a service price (the package's, or a special one with its reason) and a start on or after the delivery.
    const priceProblem = (l) => {
        const price = priceOf(l);
        if (price === null || price <= 0)
            return 'none';
        if (price < minimumPrice)
            return 'minimum';
        if (l.special && l.specialReason.trim() === '')
            return 'reason';
        return null;
    };
    const earliestOf = (l) => quotes[l.workerId]?.earliestStart ?? null;
    const startProblem = (l) => !l.startOn || l.startOn < deliverOn || (earliestOf(l) !== null && l.startOn < earliestOf(l));
    const pricesReady = lines.length > 0 && lines.every((l) => priceProblem(l) === null && !startProblem(l));
    const ready = { order: orderReady, workers: lines.length > 0, prices: pricesReady, review: orderReady && lines.length > 0 && pricesReady };
    const save = async () => {
        setBusy(true);
        setError(null);
        const input = {
            projectId: projectId,
            deliverOn,
            startOn,
            receiverName,
            receiverTitle: receiverTitle.trim() || null,
            delayReason: late ? delayReason.trim() || null : null,
            notes: notes.trim() || null,
            lines: lines.map((l) => ({
                workerId: l.workerId,
                startOn: l.startOn && l.startOn !== startOn ? l.startOn : null,
                specialPrice: l.special && l.specialPrice ? Number(l.specialPrice) : null,
                specialReason: l.special ? l.specialReason.trim() || null : null,
            })),
        };
        try {
            const saved = id ? await operationsApi.update(id, input) : await operationsApi.create(input);
            onSaved(saved.id, saved.approvalError);
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    const steps = [
        { key: 'order', label: t('operations.delivery.wizard.order') },
        { key: 'workers', label: t('operations.delivery.wizard.workers') },
        { key: 'prices', label: t('operations.delivery.wizard.prices') },
        { key: 'review', label: t('operations.delivery.wizard.review') },
    ].filter((s) => !fixed || s.key !== 'workers');
    const at = steps[step]?.key;
    const workerCell = (workerId) => {
        const w = cardOf(workerId);
        const q = quotes[workerId];
        return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: recordTones.delivery.soft, color: recordTones.delivery.main, fontSize: 11.5, fontWeight: 800 }, children: initials(w?.name ?? '') }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: w?.name ?? '…' }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [_jsx("span", { dir: "ltr", children: w?.workerNo }), q?.busy && (_jsx(Box, { component: "span", sx: { color: tokens.danger, marginInlineStart: 1 }, children: t('operations.delivery.busy', { no: q.busyOrderNo }) }))] })] })] }));
    };
    return (_jsxs(WizardDialog, { tone: "delivery", icon: _jsx(LocalShippingOutlinedIcon, {}), title: orderNo ? t('operations.delivery.editOrder', { no: orderNo }) : t('operations.delivery.new'), subtitle: project ? `${project.name}${project.customerName ? ` · ${project.customerName}` : ''}` : t('operations.delivery.wizard.hint'), steps: steps, step: step, onStep: setStep, canNext: at ? (ready[at] ?? false) : false, onClose: onClose, onFinish: () => void save(), finishLabel: t('operations.delivery.submit'), busy: busy, error: error, aside: _jsxs(WizardAside, { tone: "delivery", title: t('operations.delivery.summaryTitle'), children: [_jsx(WizardFact, { icon: _jsx(ApartmentOutlinedIcon, {}), label: t('commercial.col.project'), value: project?.name, sub: project?.customerName }), _jsx(WizardFact, { icon: _jsx(EventOutlinedIcon, {}), label: t('operations.delivery.col.deliverOn'), value: deliverOn ? date(deliverOn) : null, sub: startOn ? `${t('operations.delivery.col.startOn')}: ${date(startOn)}` : null }), _jsx(WizardFact, { icon: _jsx(BadgeOutlinedIcon, {}), label: t('operations.delivery.receiverName'), value: receiverName.trim(), sub: receiverTitle.trim() || null }), _jsx(WizardFact, { icon: _jsx(GroupsOutlinedIcon, {}), label: fixed && lines.length === 1 ? t('operations.return.col.worker') : t('operations.delivery.col.workers'), value: fixed && lines.length === 1 ? cardOf(lines[0].workerId)?.name : lines.length ? t('operations.delivery.workersCount', { count: lines.length }) : null, sub: fixed && lines.length === 1 ? cardOf(lines[0].workerId)?.workerNo : null }), _jsx(WizardFact, { icon: _jsx(PaymentsOutlinedIcon, {}), label: t('operations.delivery.monthlyTotal'), value: lines.length && projectId ? `${sar(total)} ${t('operations.delivery.sarUnit')}` : null })] }), children: [at === 'order' && (_jsx(WizardCard, { title: t('operations.delivery.sections.order'), icon: _jsx(LocalShippingOutlinedIcon, {}), children: _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 2 }, children: [_jsx(Autocomplete, { options: projects, value: project, onChange: (_, v) => setProjectId(v?.id ?? null), getOptionLabel: (p) => `${p.name} (${p.code})`, isOptionEqualToValue: (a, b) => a.id === b.id, renderInput: (params) => _jsx(TextField, { ...params, label: t('commercial.col.project'), required: true, autoFocus: true }) }), _jsx(DateField, { label: t('operations.delivery.col.deliverOn'), value: deliverOn, onChange: (e) => setDeliverOn(e.target.value), required: true, slotProps: { inputLabel: { shrink: true } } }), _jsx(DateField, { label: t('operations.delivery.col.startOn'), value: startOn, onChange: (e) => changeStart(e.target.value), required: true, error: !!startOn && !!deliverOn && startOn < deliverOn, helperText: startOn && deliverOn && startOn < deliverOn ? t('errors.validation_delivery_start_before') : undefined, slotProps: { inputLabel: { shrink: true } } }), project && (_jsxs(Stack, { direction: "row", sx: { gridColumn: '1 / -1', flexWrap: 'wrap', gap: 2.5, px: 1.5, py: 1, borderRadius: `${tokens.radius}px`, bgcolor: recordTones.delivery.soft, fontSize: 13, color: tokens.navy700 }, children: [_jsxs("span", { children: [t('commercial.col.customer'), ": ", _jsx("b", { children: project.customerName ?? t('commercial.noCustomer') })] }), _jsxs("span", { children: [t('commercial.col.manager'), ": ", _jsx("b", { children: project.manager ?? '—' })] }), _jsxs("span", { children: [t('commercial.col.contractType'), ": ", _jsx("b", { children: project.contractType ? t(`commercial.contractType.${project.contractType}`) : '—' })] })] })), _jsx(TextField, { label: t('operations.delivery.receiverName'), value: receiverName, onChange: (e) => setReceiverName(e.target.value), required: true, slotProps: { htmlInput: { maxLength: 200 } } }), _jsx(TextField, { label: t('operations.delivery.receiverTitle'), value: receiverTitle, onChange: (e) => setReceiverTitle(e.target.value), slotProps: { htmlInput: { maxLength: 200 } } }), _jsx(TextField, { label: t('operations.delivery.notes'), value: notes, onChange: (e) => setNotes(e.target.value), slotProps: { htmlInput: { maxLength: 2000 } } }), late && (_jsx(TextField, { sx: { gridColumn: '1 / -1' }, label: t('operations.delivery.delayReason'), value: delayReason, onChange: (e) => setDelayReason(e.target.value), required: true, helperText: t('operations.delivery.delayHint'), slotProps: { htmlInput: { maxLength: 500 } } }))] }) })), at === 'workers' && (_jsxs(_Fragment, { children: [lines.length > 0 && (_jsx(Alert, { severity: "success", sx: { mb: 2 }, children: t('operations.delivery.wizard.picked', { count: lines.length }) })), _jsx(AvailableWorkers, { orderId: id, onOrder: lines.map((l) => l.workerId), onToggle: toggle })] })), at === 'prices' && (_jsxs(WizardCard, { title: t('operations.delivery.sections.workers', { count: lines.length }), icon: _jsx(PaymentsOutlinedIcon, {}), action: _jsxs(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: recordTones.delivery.soft, color: recordTones.delivery.main, fontWeight: 800, fontSize: 13 }, children: [t('operations.delivery.monthlyTotal'), ": ", sar(total)] }), children: [missingPrice && _jsx(Alert, { severity: "error", sx: { mb: 1.5 }, children: t('operations.delivery.missingPackage') }), !pricesReady && !missingPrice && lines.length > 0 && _jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: t('operations.delivery.pricesNeeded') }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('commercial.prices.col.package') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.total') }), _jsx(TableCell, { children: t('operations.delivery.col.specialPrice') }), _jsx(TableCell, { children: t('operations.delivery.col.workerStart') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: lines.map((line) => {
                                        const q = quotes[line.workerId];
                                        return (_jsxs(TableRow, { children: [_jsx(TableCell, { sx: { minWidth: 190 }, children: workerCell(line.workerId) }), _jsx(TableCell, { children: q?.packageNo ? (_jsx(Tooltip, { title: q.packageForProject ? t('operations.delivery.projectPackage') : t('commercial.prices.general'), children: _jsx("span", { children: _jsx(Badge, { tone: "success", children: q.packageNo }) }) })) : q ? (_jsx(Badge, { tone: "danger", children: t('commercial.prices.status.NoPackage') })) : ('—') }), _jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [_jsx(Typography, { sx: { fontWeight: 800, color: priceProblem(line) ? tokens.danger : tokens.navy800 }, children: sar(priceOf(line)) }), priceProblem(line) && (_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.danger }, children: t(`operations.delivery.priceProblem.${priceProblem(line)}`) })), q && (_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t('operations.delivery.breakdown', { salary: sar(q.salary), fee: q.packageNo && !line.special ? sar(q.serviceFee) : '—' }) }))] }), _jsx(TableCell, { sx: { minWidth: 180 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5 }, children: [_jsx(Checkbox, { size: "small", checked: line.special, onChange: (e) => change(line.workerId, { special: e.target.checked }) }), line.special ? (_jsxs(Stack, { spacing: 0.75, sx: { flex: 1 }, children: [_jsx(TextField, { size: "small", placeholder: t('commercial.prices.col.total'), value: line.specialPrice, onChange: (e) => change(line.workerId, { specialPrice: e.target.value.replace(/[^\d.]/g, '') }), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } }), _jsx(TextField, { size: "small", placeholder: t('operations.delivery.specialReason'), value: line.specialReason, onChange: (e) => change(line.workerId, { specialReason: e.target.value }) })] })) : (_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('operations.delivery.useSpecial') }))] }) }), _jsx(TableCell, { children: _jsx(DateField, { size: "small", value: line.startOn, required: true, error: startProblem(line), onChange: (e) => change(line.workerId, { startOn: e.target.value }), helperText: !line.startOn || line.startOn < deliverOn
                                                            ? t('errors.validation_delivery_start_before')
                                                            : startProblem(line)
                                                                ? t('operations.delivery.earliestStart', { date: date(earliestOf(line)) })
                                                                : line.startOn === startOn
                                                                    ? t('operations.delivery.sameAsOrder')
                                                                    : undefined, sx: { width: 150 }, slotProps: { inputLabel: { shrink: true } } }) }), _jsx(TableCell, { children: _jsx(IconButton, { size: "small", disabled: fixed, onClick: () => remove(line.workerId), children: _jsx(DeleteOutlineIcon, { fontSize: "small" }) }) })] }, line.workerId));
                                    }) })] }) })] })), at === 'review' && (_jsxs(_Fragment, { children: [_jsxs(WizardCard, { title: t('operations.delivery.wizard.review'), icon: _jsx(FactCheckOutlinedIcon, {}), children: [_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }, children: [
                                    [t('commercial.col.project'), project?.name ?? '—'],
                                    [t('operations.delivery.col.deliverOn'), date(deliverOn)],
                                    [t('operations.delivery.col.startOn'), date(startOn)],
                                    [t('operations.delivery.receiverName'), receiverTitle.trim() ? `${receiverName} — ${receiverTitle}` : receiverName],
                                    [t('operations.delivery.col.workers'), t('operations.delivery.workersCount', { count: lines.length })],
                                    [t('operations.delivery.monthlyTotal'), `${sar(total)} ${t('operations.delivery.sarUnit')}`],
                                ].map(([label, value]) => (_jsxs(Box, { sx: { p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.gray100}` }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: label }), _jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }, children: value })] }, label))) }), _jsx(Stack, { spacing: 0.75, children: lines.map((line) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, py: 0.75, borderBottom: `1px dashed ${tokens.gray100}` }, children: [_jsx(Box, { sx: { flex: 1, minWidth: 0 }, children: workerCell(line.workerId) }), line.special && _jsx(Badge, { tone: "warning", children: t('commercial.prices.status.Special') }), _jsx(Typography, { sx: { fontWeight: 800, color: tokens.navy800, minWidth: 70, textAlign: 'end' }, children: sar(priceOf(line)) })] }, line.workerId))) })] }), _jsx(Alert, { severity: "info", children: t('operations.delivery.flowHint') })] }))] }));
}
