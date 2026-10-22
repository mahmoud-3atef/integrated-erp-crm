import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accessApi, localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { payrollApi } from '../../api/payroll';
import { ErrorMessage } from '../../auth/AuthLayout';
import { hr } from '../../components/hr/Hr';
import { DateField } from '../../components/DateField';
/** The company's active commercial registrations (the payroll is per registration). */
export function useLegalEntities() {
    const [list, setList] = useState([]);
    useEffect(() => {
        accessApi
            .legalEntities()
            .then((all) => setList(all.filter((e) => e.isActive)))
            .catch(() => setList([]));
    }, []);
    return list;
}
/** A new run: the registration and the period (the day after its last run, for a month, by default). */
export function NewRunDialog({ open, defaultEntity, onClose, onCreated, onLinkSponsors }) {
    const { t, i18n } = useTranslation();
    const entities = useLegalEntities();
    const [entity, setEntity] = useState(defaultEntity ?? '');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        const first = entities[0];
        if (!entity && first) {
            setEntity(first.id);
        }
    }, [entities, entity]);
    useEffect(() => {
        if (!open || !entity) {
            return;
        }
        payrollApi
            .nextPeriod(entity)
            .then((p) => {
            setFrom(p.from);
            setTo(p.to);
        })
            .catch(() => undefined);
    }, [open, entity]);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            onCreated((await payrollApi.create({ legalEntityId: entity, from, to })).id);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: open, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "sm", slotProps: { paper: { sx: { borderRadius: `${hr.radius}px` } } }, children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('payroll.create.title') }), _jsx(DialogContent, { children: _jsxs(Stack, { sx: { gap: 2, pt: 1 }, children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('payroll.create.hint') }), _jsx(ErrorMessage, { messageKey: error }), error === 'errors.validation_payroll_no_sponsors' && (_jsx(Alert, { severity: "info", action: _jsx(Button, { color: "inherit", size: "small", onClick: onLinkSponsors, children: t('payroll.sponsors') }), children: t('payroll.create.linkFirst') })), _jsx(TextField, { select: true, label: t('payroll.create.legalEntity'), value: entity, onChange: (e) => setEntity(e.target.value), required: true, children: entities.map((e) => (_jsx(MenuItem, { value: e.id, children: localName(e, i18n.language) }, e.id))) }), _jsxs(Stack, { direction: "row", sx: { gap: 2 }, children: [_jsx(DateField, { label: t('payroll.create.from'), value: from, onChange: (e) => setFrom(e.target.value), slotProps: { inputLabel: { shrink: true } }, fullWidth: true, required: true }), _jsx(DateField, { label: t('payroll.create.to'), value: to, onChange: (e) => setTo(e.target.value), slotProps: { inputLabel: { shrink: true } }, fullWidth: true, required: true })] })] }) }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy || !entity || !from || !to, children: t('payroll.create.save') })] })] }));
}
/** Which of the old system's sponsors is which commercial registration (set once). */
export function SponsorsDialog({ open, onClose }) {
    const { t, i18n } = useTranslation();
    const entities = useLegalEntities();
    const [links, setLinks] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (open) {
            payrollApi.sponsors().then(setLinks).catch((failure) => setError(errorKey(failure)));
        }
    }, [open]);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await payrollApi.linkSponsors(links.map((l) => ({ sponsor: l.sponsor, legalEntityId: l.legalEntityId })));
            onClose(true);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: open, onClose: busy ? undefined : () => onClose(false), fullWidth: true, maxWidth: "sm", slotProps: { paper: { sx: { borderRadius: `${hr.radius}px` } } }, children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('payroll.sponsorDialog.title') }), _jsxs(DialogContent, { children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted, mb: 2 }, children: t('payroll.sponsorDialog.hint') }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('payroll.sponsorDialog.sponsor') }), _jsx(TableCell, { children: t('payroll.sponsorDialog.legalEntity') })] }) }), _jsx(TableBody, { children: links.map((l, i) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx("bdi", { dir: "ltr", style: { fontWeight: 600 }, children: l.sponsor }) }), _jsx(TableCell, { children: _jsxs(TextField, { select: true, size: "small", fullWidth: true, value: l.legalEntityId ?? '', onChange: (e) => setLinks(links.map((x, j) => (j === i ? { ...x, legalEntityId: e.target.value || null } : x))), slotProps: { htmlInput: { 'aria-label': `${t('payroll.sponsorDialog.legalEntity')} — ${l.sponsor}` } }, children: [_jsx(MenuItem, { value: "", children: t('payroll.sponsorDialog.none') }), entities.map((e) => (_jsx(MenuItem, { value: e.id, children: localName(e, i18n.language) }, e.id)))] }) })] }, l.sponsor))) })] })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2 }, children: [_jsx(Button, { onClick: () => onClose(false), disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy, children: t('common.save') })] })] }));
}
