import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { Alert, Autocomplete, Box, Checkbox, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { transfersApi } from '../../api/operations';
import { tokens } from '../../app/theme';
import { recordTones } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { WizardAside, WizardCard, WizardDialog, WizardFact } from '../../components/WizardDialog';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { AvailableWorkers } from './AvailableWorkers';
import { isoToday, sar } from './delivery';
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
 * A new or returned transfer order, in four steps: the transfer (new project, date, receiver), the workers on the job,
 * their new prices, then a review before it goes for approval. Saving starts the approval (the creator confirms first).
 */
export function TransferOrderWizard({ id, onClose, onSaved }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const [step, setStep] = useState(0);
    const [projects, setProjects] = useState([]);
    const [targets, setTargets] = useState([]);
    const [projectId, setProjectId] = useState(null);
    const [fromProjectId, setFromProjectId] = useState(null);
    const [transferOn, setTransferOn] = useState(isoToday());
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
        transfersApi.projects().then(setProjects).catch((failure) => setError(errorKey(failure)));
        transfersApi.targetProjects().then(setTargets).catch((failure) => setError(errorKey(failure)));
        if (id) {
            transfersApi
                .get(id)
                .then((o) => {
                setOrderNo(o.summary.orderNo);
                setProjectId(o.summary.projectId);
                setFromProjectId(o.fromProjectId);
                setTransferOn(o.summary.transferOn);
                setReceiverName(o.receiverName ?? '');
                setReceiverTitle(o.receiverTitle ?? '');
                setDelayReason(o.delayReason ?? '');
                setNotes(o.notes ?? '');
                setLines(o.lines.map((l) => ({ workerId: l.workerId, special: l.isSpecialPrice, specialPrice: l.isSpecialPrice ? String(l.totalPrice) : '', specialReason: l.specialReason ?? '' })));
            })
                .catch((failure) => setError(errorKey(failure)));
        }
    }, [id]);
    // The new project's package price of every worker on the order, again whenever the project, the date or the workers change.
    const workerKey = lines.map((l) => l.workerId).join(',');
    useEffect(() => {
        if (!projectId || !workerKey || !transferOn) {
            setQuotes({});
            return;
        }
        let cancelled = false;
        transfersApi
            .prices(projectId, workerKey.split(','), transferOn)
            .then((list) => !cancelled && setQuotes(Object.fromEntries(list.map((q) => [q.worker.id, q]))))
            .catch((failure) => !cancelled && setError(errorKey(failure)));
        return () => {
            cancelled = true;
        };
    }, [projectId, workerKey, transferOn]);
    const project = targets.find((p) => p.id === projectId) ?? projects.find((p) => p.id === projectId) ?? null;
    const fromProject = projects.find((p) => p.id === fromProjectId) ?? null;
    // The workers on the project they leave (the list loads again when that project changes).
    const onJob = { load: (orderId) => transfersApi.onJobWorkers(orderId, fromProjectId), titleKey: 'operations.transfer.picker.title', hintKey: 'operations.transfer.picker.hint' };
    const chooseFrom = (value) => {
        if (value !== fromProjectId)
            setLines([]);
        setFromProjectId(value);
    };
    const late = !!transferOn && daysAgo(transferOn) > 2;
    const add = (workers) => {
        setCards((current) => ({ ...current, ...Object.fromEntries(workers.map((w) => [w.id, w])) }));
        setLines((current) => [
            ...current,
            ...workers.filter((w) => !current.some((l) => l.workerId === w.id)).map((w) => ({ workerId: w.id, special: false, specialPrice: '', specialReason: '' })),
        ]);
    };
    const change = (workerId, patch) => setLines((current) => current.map((l) => (l.workerId === workerId ? { ...l, ...patch } : l)));
    const remove = (workerId) => setLines((current) => current.filter((l) => l.workerId !== workerId));
    const toggle = (workers, on) => (on ? add(workers) : setLines((current) => current.filter((l) => !workers.some((w) => w.id === l.workerId))));
    const cardOf = (workerId) => quotes[workerId]?.worker ?? cards[workerId];
    const priceOf = (line) => (line.special ? Number(line.specialPrice) || 0 : quotes[line.workerId]?.totalPrice ?? null);
    const total = lines.reduce((sum, l) => sum + (priceOf(l) ?? 0), 0);
    const missingPrice = lines.some((l) => !l.special && quotes[l.workerId]?.totalPrice === null);
    const sameProject = !!project && lines.some((l) => cardOf(l.workerId)?.projectCrmId === project.crmId);
    const orderReady = !!projectId && !!fromProjectId && projectId !== fromProjectId && !!transferOn && (!late || delayReason.trim() !== '');
    // Every worker has a service price of at least 1,000 (a special one with its reason), and can move on the transfer date.
    const priceProblem = (l) => {
        const price = priceOf(l);
        if (price === null || price <= 0)
            return 'none';
        if (price < 1000)
            return 'minimum';
        if (l.special && l.specialReason.trim() === '')
            return 'reason';
        const earliest = quotes[l.workerId]?.earliestStart;
        if (earliest && transferOn < earliest)
            return 'start';
        return null;
    };
    const pricesReady = lines.length > 0 && lines.every((l) => priceProblem(l) === null);
    const ready = [orderReady, lines.length > 0 && !sameProject, pricesReady, orderReady && lines.length > 0 && !sameProject && pricesReady];
    const save = async () => {
        setBusy(true);
        setError(null);
        const input = {
            projectId: projectId,
            transferOn,
            receiverName: receiverName.trim() || null,
            receiverTitle: receiverTitle.trim() || null,
            delayReason: late ? delayReason.trim() || null : null,
            notes: notes.trim() || null,
            lines: lines.map((l) => ({
                workerId: l.workerId,
                specialPrice: l.special && l.specialPrice ? Number(l.specialPrice) : null,
                specialReason: l.special ? l.specialReason.trim() || null : null,
            })),
            fromProjectId,
        };
        try {
            const saved = id ? await transfersApi.update(id, input) : await transfersApi.create(input);
            onSaved(saved.id, saved.approvalError);
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    const steps = [
        { key: 'order', label: t('operations.transfer.wizard.order') },
        { key: 'workers', label: t('operations.transfer.wizard.workers') },
        { key: 'prices', label: t('operations.transfer.wizard.prices') },
        { key: 'review', label: t('operations.transfer.wizard.review') },
    ];
    const workerCell = (workerId) => {
        const w = cardOf(workerId);
        const q = quotes[workerId];
        return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Box, { sx: { flex: '0 0 auto', width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: recordTones.transfer.soft, color: recordTones.transfer.main, fontSize: 11.5, fontWeight: 800 }, children: initials(w?.name ?? '') }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: w?.name ?? '…' }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [_jsx("span", { dir: "ltr", children: w?.workerNo }), q?.busy && (_jsx(Box, { component: "span", sx: { color: tokens.danger, marginInlineStart: 1 }, children: t('operations.delivery.busy', { no: q.busyOrderNo }) }))] })] })] }));
    };
    return (_jsxs(WizardDialog, { tone: "transfer", icon: _jsx(SwapHorizIcon, {}), title: orderNo ? t('operations.transfer.editOrder', { no: orderNo }) : t('operations.transfer.new'), subtitle: project ? `${project.name}${project.customerName ? ` · ${project.customerName}` : ''}` : t('operations.transfer.wizard.hint'), steps: steps, step: step, onStep: setStep, canNext: ready[step] ?? false, onClose: onClose, onFinish: () => void save(), finishLabel: t('operations.delivery.submit'), busy: busy, error: error, aside: _jsxs(WizardAside, { tone: "transfer", title: t('operations.transfer.wizard.summary'), children: [_jsx(WizardFact, { icon: _jsx(ApartmentOutlinedIcon, {}), label: t('operations.transfer.fromProject'), value: fromProject?.name, sub: fromProject?.customerName }), _jsx(WizardFact, { icon: _jsx(ApartmentOutlinedIcon, {}), label: t('operations.transfer.newProject'), value: project?.name, sub: project?.customerName }), _jsx(WizardFact, { icon: _jsx(EventOutlinedIcon, {}), label: t('operations.transfer.col.transferOn'), value: transferOn ? date(transferOn) : null }), _jsx(WizardFact, { icon: _jsx(BadgeOutlinedIcon, {}), label: t('operations.transfer.receiverName'), value: receiverName.trim(), sub: receiverTitle.trim() || null }), _jsx(WizardFact, { icon: _jsx(GroupsOutlinedIcon, {}), label: t('operations.delivery.col.workers'), value: lines.length ? t('operations.delivery.workersCount', { count: lines.length }) : null }), _jsx(WizardFact, { icon: _jsx(PaymentsOutlinedIcon, {}), label: t('operations.transfer.newMonthlyTotal'), value: lines.length && projectId ? `${sar(total)} ${t('operations.delivery.sarUnit')}` : null })] }), children: [step === 0 && (_jsx(WizardCard, { title: t('operations.transfer.sections.order'), icon: _jsx(SwapHorizIcon, {}), children: _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }, children: [_jsx(Autocomplete, { options: projects, value: fromProject, onChange: (_, v) => chooseFrom(v?.id ?? null), getOptionLabel: (p) => `${p.name} (${p.code})`, isOptionEqualToValue: (a, b) => a.id === b.id, renderInput: (params) => _jsx(TextField, { ...params, label: t('operations.transfer.fromProject'), required: true, autoFocus: true }) }), _jsx(Autocomplete, { options: targets.filter((p) => p.id !== fromProjectId), value: project, onChange: (_, v) => setProjectId(v?.id ?? null), getOptionLabel: (p) => `${p.name} (${p.code})`, isOptionEqualToValue: (a, b) => a.id === b.id, noOptionsText: t('operations.transfer.noTargets'), renderInput: (params) => _jsx(TextField, { ...params, label: t('operations.transfer.newProject'), required: true, helperText: targets.length === 0 ? t('operations.transfer.noTargets') : undefined }) }), _jsx(DateField, { label: t('operations.transfer.col.transferOn'), value: transferOn, onChange: (e) => setTransferOn(e.target.value), required: true, helperText: t('operations.transfer.dateHint'), slotProps: { inputLabel: { shrink: true } } }), project && (_jsxs(Stack, { direction: "row", sx: { gridColumn: '1 / -1', flexWrap: 'wrap', gap: 2.5, px: 1.5, py: 1, borderRadius: `${tokens.radius}px`, bgcolor: recordTones.transfer.soft, fontSize: 13, color: tokens.navy700 }, children: [_jsxs("span", { children: [t('commercial.col.customer'), ": ", _jsx("b", { children: project.customerName ?? t('commercial.noCustomer') })] }), _jsxs("span", { children: [t('commercial.col.manager'), ": ", _jsx("b", { children: project.manager ?? '—' })] }), _jsxs("span", { children: [t('commercial.col.contractType'), ": ", _jsx("b", { children: project.contractType ? t(`commercial.contractType.${project.contractType}`) : '—' })] })] })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, gridColumn: '1 / -1' }, children: [_jsx(TextField, { label: t('operations.transfer.receiverName'), value: receiverName, onChange: (e) => setReceiverName(e.target.value), slotProps: { htmlInput: { maxLength: 200 } } }), _jsx(TextField, { label: t('operations.delivery.receiverTitle'), value: receiverTitle, onChange: (e) => setReceiverTitle(e.target.value), slotProps: { htmlInput: { maxLength: 200 } } }), _jsx(TextField, { label: t('operations.delivery.notes'), value: notes, onChange: (e) => setNotes(e.target.value), slotProps: { htmlInput: { maxLength: 2000 } } })] }), late && (_jsx(TextField, { sx: { gridColumn: '1 / -1' }, label: t('operations.delivery.delayReason'), value: delayReason, onChange: (e) => setDelayReason(e.target.value), required: true, helperText: t('operations.transfer.delayHint'), slotProps: { htmlInput: { maxLength: 500 } } }))] }) })), step === 1 && (_jsxs(_Fragment, { children: [lines.length > 0 && (_jsx(Alert, { severity: "success", sx: { mb: 2 }, children: t('operations.transfer.wizard.picked', { count: lines.length }) })), sameProject && (_jsx(Alert, { severity: "error", sx: { mb: 2 }, children: t('errors.validation_transfer_same_project') })), _jsx(AvailableWorkers, { orderId: id, onOrder: lines.map((l) => l.workerId), onToggle: toggle, onJob: onJob, targetProjectCrmId: project?.crmId ?? null })] })), step === 2 && (_jsxs(WizardCard, { title: t('operations.transfer.sections.workers', { count: lines.length }), icon: _jsx(PaymentsOutlinedIcon, {}), action: _jsxs(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: recordTones.transfer.soft, color: recordTones.transfer.main, fontWeight: 800, fontSize: 13 }, children: [t('operations.transfer.newMonthlyTotal'), ": ", sar(total)] }), children: [missingPrice && _jsx(Alert, { severity: "warning", sx: { mb: 1.5 }, children: t('operations.delivery.missingPackage') }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('commercial.prices.col.package') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.total') }), _jsx(TableCell, { children: t('operations.delivery.col.specialPrice') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: lines.map((line) => {
                                        const q = quotes[line.workerId];
                                        return (_jsxs(TableRow, { children: [_jsxs(TableCell, { sx: { minWidth: 190 }, children: [workerCell(line.workerId), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, mt: 0.5 }, children: [t('operations.transfer.col.from'), ": ", cardOf(line.workerId)?.projectName ?? '—'] })] }), _jsx(TableCell, { children: q?.packageNo ? (_jsx(Tooltip, { title: q.packageForProject ? t('operations.delivery.projectPackage') : t('commercial.prices.general'), children: _jsx("span", { children: _jsx(Badge, { tone: "success", children: q.packageNo }) }) })) : q ? (_jsx(Badge, { tone: "danger", children: t('commercial.prices.status.NoPackage') })) : ('—') }), _jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [_jsx(Typography, { sx: { fontWeight: 800, color: priceProblem(line) ? tokens.danger : tokens.navy800 }, children: sar(priceOf(line)) }), priceProblem(line) && (_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.danger }, children: priceProblem(line) === 'start'
                                                                ? t('operations.delivery.earliestStart', { date: date(quotes[line.workerId].earliestStart) })
                                                                : t(`operations.delivery.priceProblem.${priceProblem(line)}`) })), q && (_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t('operations.delivery.breakdown', { salary: sar(q.salary), fee: q.packageNo && !line.special ? sar(q.serviceFee) : '—' }) }))] }), _jsx(TableCell, { sx: { minWidth: 180 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5 }, children: [_jsx(Checkbox, { size: "small", checked: line.special, onChange: (e) => change(line.workerId, { special: e.target.checked }) }), line.special ? (_jsxs(Stack, { spacing: 0.75, sx: { flex: 1 }, children: [_jsx(TextField, { size: "small", placeholder: t('commercial.prices.col.total'), value: line.specialPrice, onChange: (e) => change(line.workerId, { specialPrice: e.target.value.replace(/[^\d.]/g, '') }), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } }), _jsx(TextField, { size: "small", placeholder: t('operations.delivery.specialReason'), value: line.specialReason, onChange: (e) => change(line.workerId, { specialReason: e.target.value }) })] })) : (_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('operations.delivery.useSpecial') }))] }) }), _jsx(TableCell, { children: _jsx(IconButton, { size: "small", onClick: () => remove(line.workerId), children: _jsx(DeleteOutlineIcon, { fontSize: "small" }) }) })] }, line.workerId));
                                    }) })] }) })] })), step === 3 && (_jsxs(_Fragment, { children: [_jsxs(WizardCard, { title: t('operations.transfer.wizard.review'), icon: _jsx(FactCheckOutlinedIcon, {}), children: [_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }, children: [
                                    [t('operations.transfer.newProject'), project?.name ?? '—'],
                                    [t('operations.transfer.col.transferOn'), date(transferOn)],
                                    [t('operations.transfer.receiverName'), receiverName.trim() ? (receiverTitle.trim() ? `${receiverName} — ${receiverTitle}` : receiverName) : '—'],
                                    [t('operations.delivery.col.workers'), t('operations.delivery.workersCount', { count: lines.length })],
                                    [t('operations.transfer.newMonthlyTotal'), `${sar(total)} ${t('operations.delivery.sarUnit')}`],
                                ].map(([label, value]) => (_jsxs(Box, { sx: { p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.gray100}` }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: label }), _jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }, children: value })] }, label))) }), _jsx(Stack, { spacing: 0.75, children: lines.map((line) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, py: 0.75, borderBottom: `1px dashed ${tokens.gray100}` }, children: [_jsx(Box, { sx: { flex: 1, minWidth: 0 }, children: workerCell(line.workerId) }), line.special && _jsx(Badge, { tone: "warning", children: t('commercial.prices.status.Special') }), _jsx(Typography, { sx: { fontWeight: 800, color: tokens.navy800, minWidth: 70, textAlign: 'end' }, children: sar(priceOf(line)) })] }, line.workerId))) })] }), _jsx(Alert, { severity: "info", children: t('operations.transfer.flowHint') })] }))] }));
}
