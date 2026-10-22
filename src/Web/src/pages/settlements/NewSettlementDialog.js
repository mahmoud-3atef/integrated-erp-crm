import { createElement as _createElement } from "react";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { endReasons, settlementsApi } from '../../api/settlements';
import { hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { usePeople } from '../deductions/advances';
import { DateField } from '../../components/DateField';
/**
 * A new settlement. A vacation one is for an approved leave without one: the staff's leave request, or a sponsored
 * worker's vacation departure (4.11ب). An end-of-service one is for an employee or a sponsored worker, with the reason
 * and the last day (and a fixed-term contract's end, for article 77). The server calculates it.
 */
export function NewSettlementDialog({ onClose, onCreated, employee, party: initialParty = 'Staff' }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { date } = useCommercialFormat();
    const [party, setParty] = useState(employee ? 'Staff' : initialParty);
    const [kind, setKind] = useState(employee ? 'EndOfService' : 'Vacation');
    const [leaves, setLeaves] = useState(null);
    const [leavesOf, setLeavesOf] = useState(null);
    const [leave, setLeave] = useState(null);
    const [search, setSearch] = useState('');
    const people = usePeople(search, party === 'Staff' && kind === 'EndOfService' && !employee);
    const [who, setWho] = useState(employee ?? null);
    const [workers, setWorkers] = useState([]);
    const [worker, setWorker] = useState(null);
    const [reason, setReason] = useState('ContractEnd');
    const [lastDay, setLastDay] = useState('');
    const [term, setTerm] = useState('Indefinite');
    const [ends, setEnds] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (kind !== 'Vacation' || leavesOf === party)
            return;
        setLeavesOf(party);
        setLeaves(null);
        setLeave(null);
        (party === 'Worker' ? settlementsApi.workerLeaves() : settlementsApi.leaves()).then(setLeaves).catch((f) => setError(errorKey(f)));
    }, [party, kind, leavesOf]);
    useEffect(() => {
        if (party !== 'Worker' || search.trim().length < 2)
            return;
        const timer = setTimeout(() => settlementsApi.workers(search).then(setWorkers).catch(() => setWorkers([])), 250);
        return () => clearTimeout(timer);
    }, [party, search]);
    const endReady = Boolean(lastDay && (term === 'Indefinite' || ends));
    const ready = kind === 'Vacation' ? Boolean(leave) : Boolean(party === 'Worker' ? worker : who) && endReady;
    const create = async () => {
        setBusy(true);
        setError(null);
        const end = { reason, lastDay, term, contractEndsOn: term === 'Fixed' ? ends : null };
        try {
            const made = kind === 'Vacation'
                ? await settlementsApi.create({ kind, party, leaveRequestId: leave.requestId })
                : await settlementsApi.create({ kind, party, employeeId: (party === 'Worker' ? worker : who).id, ...end });
            onCreated(made.id);
        }
        catch (f) {
            setError(errorKey(f));
            setBusy(false);
        }
    };
    const dateField = (label, value, set) => (_jsx(DateField, { size: "small", required: true, label: label, value: value, onChange: (e) => set(e.target.value), slotProps: { inputLabel: { shrink: true } }, sx: { flex: 1 } }));
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('settlements.new') }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 0.5 }, children: [!employee && (_jsxs(_Fragment, { children: [_jsxs(ToggleButtonGroup, { exclusive: true, fullWidth: true, size: "small", value: party, onChange: (_, v) => v && setParty(v), "aria-label": t('settlements.create.party'), children: [_jsx(ToggleButton, { value: "Staff", children: t('settlements.party.Staff') }), _jsx(ToggleButton, { value: "Worker", children: t('settlements.party.Worker') })] }), _jsxs(ToggleButtonGroup, { exclusive: true, fullWidth: true, size: "small", value: kind, onChange: (_, v) => v && setKind(v), "aria-label": t('settlements.col.kind'), children: [_jsx(ToggleButton, { value: "Vacation", children: t('settlements.kind.Vacation') }), _jsx(ToggleButton, { value: "EndOfService", children: t('settlements.kind.EndOfService') })] })] })), party === 'Worker' && kind === 'EndOfService' ? (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t('settlements.create.workerHint') }), _jsx(Autocomplete, { size: "small", options: workers, value: worker, onChange: (_, v) => setWorker(v), onInputChange: (_, v) => setSearch(v), getOptionLabel: (o) => `${o.name} · ${o.workerNo}`, isOptionEqualToValue: (x, y) => x.id === y.id, filterOptions: (x) => x, noOptionsText: t('settlements.create.noWorkers'), renderOption: (props, o) => (_createElement(Box, { component: "li", ...props, key: o.id },
                                        _jsxs(Box, { children: [_jsxs(Typography, { sx: { fontSize: 13, fontWeight: 600 }, children: [_jsx("bdi", { children: o.name }), " \u00B7 ", _jsx("bdi", { children: o.workerNo })] }), _jsxs(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: [_jsx("bdi", { children: o.sponsor }), o.projectName && ` · ${o.projectName}`] })] }))), renderInput: (params) => _jsx(TextField, { ...params, required: true, label: t('settlements.create.worker') }) })] })) : kind === 'Vacation' ? (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t(party === 'Worker' ? 'settlements.create.workerVacationHint' : 'settlements.create.vacationHint') }), _jsx(Autocomplete, { size: "small", loading: leaves === null, options: leaves ?? [], value: leave, onChange: (_, v) => setLeave(v), getOptionLabel: (o) => `${o.name} · ${o.requestNo}`, isOptionEqualToValue: (x, y) => x.requestId === y.requestId, noOptionsText: t(party === 'Worker' ? 'settlements.create.noWorkerLeaves' : 'settlements.create.noLeaves'), renderOption: (props, o) => (_createElement(Box, { component: "li", ...props, key: o.requestId },
                                        _jsxs(Box, { children: [_jsxs(Typography, { sx: { fontSize: 13, fontWeight: 600 }, children: [o.name, " \u00B7 ", _jsx("bdi", { children: o.employeeNo })] }), _jsxs(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: [_jsx("bdi", { children: o.requestNo }), " \u00B7 ", date(o.from), " \u2013 ", date(o.to), " \u00B7 ", t('settlements.daysN', { count: o.days })] })] }))), renderInput: (params) => _jsx(TextField, { ...params, required: true, label: t(party === 'Worker' ? 'settlements.create.workerLeave' : 'settlements.create.leave') }) })] })) : (_jsx(Autocomplete, { size: "small", disabled: Boolean(employee), options: people, value: who, onChange: (_, v) => setWho(v), onInputChange: (_, v) => setSearch(v), getOptionLabel: (o) => (ar ? o.nameAr : o.nameEn), isOptionEqualToValue: (x, y) => x.id === y.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, required: true, label: t('settlements.create.employee') }) })), kind === 'EndOfService' && (_jsxs(_Fragment, { children: [_jsx(TextField, { select: true, size: "small", required: true, label: t('settlements.col.reason'), value: reason, onChange: (e) => setReason(e.target.value), children: endReasons.map((r) => (_jsx(MenuItem, { value: r, children: t(`settlements.reason.${r}`) }, r))) }), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: -1 }, children: t(`settlements.reasonHint.${reason}`) }), dateField(t('settlements.create.lastDay'), lastDay, setLastDay), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 2 }, children: [_jsxs(TextField, { select: true, size: "small", label: t('settlements.create.term'), value: term, onChange: (e) => setTerm(e.target.value), sx: { flex: 1 }, children: [_jsx(MenuItem, { value: "Indefinite", children: t('settlements.term.Indefinite') }), _jsx(MenuItem, { value: "Fixed", children: t('settlements.term.Fixed') })] }), term === 'Fixed' && dateField(t('settlements.create.contractEnds'), ends, setEnds)] })] })), error && _jsx(Alert, { severity: "error", children: t(error) })] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: !ready || busy, onClick: () => void create(), children: t('settlements.create.submit') })] })] }));
}
