import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { billingApi } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
/** A month's billing period from the project's cycle (as the server's TimesheetMath.Cycle): the month, or from a day of the month before. */
export function cycleOf(month, startDay) {
    const [y, m] = month.split('-').map(Number);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (startDay <= 1)
        return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    const day = Math.min(startDay, 28);
    return [iso(new Date(y, m - 2, day)), iso(new Date(y, m - 1, day - 1))];
}
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
/** The cycle's start day: the calendar month, or from a day to the day before it of the next month. */
function CycleField({ value, onChange }) {
    const { t } = useTranslation();
    return (_jsx(TextField, { select: true, label: t('timesheets.settings.cycleStartDay'), value: value, onChange: (e) => onChange(Number(e.target.value)), children: Array.from({ length: 28 }, (_, n) => n + 1).map((d) => (_jsx(MenuItem, { value: d, children: d === 1 ? t('timesheets.settings.calendarMonth') : t('timesheets.settings.fromDay', { day: d, prev: d - 1 }) }, d))) }));
}
function BasisField({ value, onChange }) {
    const { t } = useTranslation();
    return (_jsxs(TextField, { select: true, label: t('timesheets.settings.dayBasis'), value: value, onChange: (e) => onChange(e.target.value), children: [_jsx(MenuItem, { value: "Thirty", children: t('timesheets.dayBasis.Thirty') }), _jsx(MenuItem, { value: "ActualDays", children: t('timesheets.dayBasis.ActualDays') })] }));
}
/** A project's timesheet settings: the cycle, the day basis, overtime, GOSI and VAT (from the project or a timesheet). */
export function TimesheetSettingsDialog({ projectId, projectName, settings, onClose, onSaved }) {
    const { t } = useTranslation();
    const [s, setS] = useState(settings);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const num = (key, label, scale = 1) => (_jsx(TextField, { label: label, value: s[key] === null ? '' : String(Math.round(Number(s[key]) * scale * 10000) / 10000), onChange: (e) => setS({ ...s, [key]: e.target.value === '' ? null : Number(e.target.value.replace(/[^\d.]/g, '')) / scale }), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } }));
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: t('timesheets.settings.title') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, mb: 2 }, children: t('timesheets.settings.hint', { project: projectName }) }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }, children: [_jsx(CycleField, { value: s.cycleStartDay, onChange: (cycleStartDay) => setS({ ...s, cycleStartDay }) }), _jsx(BasisField, { value: s.dayBasis, onChange: (dayBasis) => setS({ ...s, dayBasis }) }), num('overtimeMultiplier', t('timesheets.settings.overtimeMultiplier')), num('monthlyHours', t('timesheets.settings.monthlyHours')), num('overtimeHourlyRate', t('timesheets.settings.overtimeHourlyRate')), num('maxOvertimeHours', t('timesheets.settings.maxOvertimeHours')), num('gosiRate', t('timesheets.settings.gosiRate'), 100), num('vatRate', t('timesheets.settings.vatRate'), 100)] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy, onClick: () => {
                            setBusy(true);
                            setError(null);
                            billingApi
                                .saveSettings(projectId, s)
                                .then(onSaved)
                                .catch((failure) => setError(errorKey(failure)))
                                .finally(() => setBusy(false));
                        }, children: t('common.save') })] })] }));
}
/**
 * «إنشاء التحضير الشهري» from a project's page: the month, its period and day basis from the project's settings (they
 * can be changed here, and are then saved as the project's settings); OK generates the timesheet and opens it.
 */
export function CreateTimesheetDialog({ projectId, projectName, onClose }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [settings, setSettings] = useState(null);
    const [cycle, setCycle] = useState(1);
    const [basis, setBasis] = useState('Thirty');
    const [month, setMonth] = useState(() => monthKey(new Date()));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        billingApi
            .settings(projectId)
            .then((s) => {
            setSettings(s);
            setCycle(s.cycleStartDay);
            setBasis(s.dayBasis);
        })
            .catch((e) => setError(errorKey(e)));
    }, [projectId]);
    // This month and the eleven before it.
    const months = useMemo(() => {
        const now = new Date();
        return Array.from({ length: 12 }, (_, n) => new Date(now.getFullYear(), now.getMonth() - n, 1));
    }, []);
    const label = (d) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(d);
    const [from, to] = cycleOf(month, cycle);
    const changed = settings !== null && (settings.cycleStartDay !== cycle || settings.dayBasis !== basis);
    const create = async () => {
        if (!settings)
            return;
        setBusy(true);
        setError(null);
        try {
            // A changed period or day basis becomes the project's setting, so the timesheet is generated with it.
            if (changed) {
                await billingApi.saveSettings(projectId, { ...settings, cycleStartDay: cycle, dayBasis: basis });
            }
            const { id } = await billingApi.generate(projectId, month);
            navigate(`/billing/timesheets/${id}`);
        }
        catch (e) {
            setError(errorKey(e));
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "sm", "aria-labelledby": "create-timesheet", children: [_jsx(DialogTitle, { id: "create-timesheet", children: t('timesheets.create.title') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, mb: 2 }, children: t('timesheets.create.hint', { project: projectName }) }), !settings ? (_jsx(Skeleton, { variant: "rounded", height: 160 })) : (_jsxs(Stack, { sx: { gap: 2 }, children: [_jsx(TextField, { select: true, label: t('timesheets.create.month'), value: month, onChange: (e) => setMonth(e.target.value), children: months.map((d) => (_jsx(MenuItem, { value: monthKey(d), children: label(d) }, monthKey(d)))) }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }, children: [_jsx(CycleField, { value: cycle, onChange: setCycle }), _jsx(BasisField, { value: basis, onChange: setBasis })] }), _jsxs(Box, { sx: { p: 1.5, borderRadius: '10px', bgcolor: tokens.navy50, color: tokens.navy800, fontSize: 13.5, fontWeight: 700 }, children: [t('timesheets.create.period'), " ", _jsx("bdi", { dir: "ltr", children: from.replaceAll('-', '/') }), " \u2190 ", _jsx("bdi", { dir: "ltr", children: to.replaceAll('-', '/') }), " \u00B7 ", t(`timesheets.dayBasis.${basis}`)] }), changed && (_jsx(Alert, { severity: "info", sx: { py: 0 }, children: t('timesheets.create.willSave') }))] }))] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, disabled: busy, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: !settings || busy, onClick: () => void create(), children: busy ? t('timesheets.create.creating') : t('timesheets.create.ok') })] })] }));
}
