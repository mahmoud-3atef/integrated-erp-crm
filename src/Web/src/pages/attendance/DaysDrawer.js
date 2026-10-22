import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { Alert, Box, Button, Checkbox, Collapse, FormControlLabel, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { attendanceApi, hhmm, hm, manualStatuses } from '../../api/attendance';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrDrawer, HrStatusBadge, hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { localRef } from './AttendanceMonthPage';
/** Each day status: its cell colour and its text colour (the label always says it too). */
export const dayLook = {
    Present: { bg: '#FFFFFF', fg: '#059669' },
    Late: { bg: '#FFFBEB', fg: '#B45309' },
    MissingPunch: { bg: '#EFF6FF', fg: '#2563EB' },
    Absent: { bg: '#FFF1F2', fg: '#BE123C' },
    Excused: { bg: '#F0FDF4', fg: '#15803D' },
    Rest: { bg: '#F1F5F9', fg: '#94A3B8' },
    Holiday: { bg: '#F5F3FF', fg: '#7C3AED' },
    Leave: { bg: '#ECFDF5', fg: '#047857' },
    Mission: { bg: '#ECFEFF', fg: '#0E7490' },
    Exempt: { bg: '#F8FAFC', fg: '#475569' },
    NoData: { bg: '#FFFFFF', fg: '#CBD5E1' },
};
const look = (d) => dayLook[d.status === 'Present' && d.lateMinutes > 0 ? 'Late' : d.status];
/** An employee's month: the calendar coloured by status, the chosen day with what the file said and its correction, and the summary. */
export function DaysDrawer({ period, employeeId, initialDate, canManage, onClose, onChanged }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { date } = useCommercialFormat();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [picked, setPicked] = useState(initialDate ?? null);
    const [version, setVersion] = useState(0);
    const [settings, setSettings] = useState(false);
    useEffect(() => {
        attendanceApi
            .employee(period, employeeId)
            .then((d) => (setData(d), setError(null)))
            .catch((failure) => setError(errorKey(failure)));
    }, [period, employeeId, version]);
    const day = data?.days.find((d) => d.date === picked) ?? null;
    const weekdays = t('attendance.weekdays', { returnObjects: true });
    const first = data?.days[0];
    const lead = first ? new Date(`${first.date}T00:00:00`).getDay() : 0;
    const name = data ? (ar ? (data.nameAr ?? data.nameEn) : data.nameEn) : '';
    const changed = () => {
        setVersion((v) => v + 1);
        onChanged();
    };
    return (_jsxs(HrDrawer, { open: true, onClose: onClose, width: 560, avatar: data ? _jsx(HrAvatar, { name: data.nameEn || name, size: 44 }) : undefined, title: name || '…', subtitle: data && (_jsxs(_Fragment, { children: [_jsx("bdi", { children: data.employeeNo }), (ar ? data.departmentAr : data.departmentEn) ? ` · ${ar ? data.departmentAr : data.departmentEn}` : '', data.shiftAr && ` · ${localRef({ nameAr: data.shiftAr, nameEn: data.shiftEn }, ar)} `, data.shiftStartsAt && _jsx("bdi", { dir: "ltr", children: `${hhmm(data.shiftStartsAt)} – ${hhmm(data.shiftEndsAt)}` }), data.graceMinutes !== null && ` · ${t('attendance.drawer.grace', { minutes: data.graceMinutes })}`] })), children: [_jsx(ErrorMessage, { messageKey: error }), !data ? (_jsx(LinearProgress, {})) : (_jsxs(Stack, { sx: { gap: 1.75, overflowY: 'auto', mx: -0.5, px: 0.5 }, children: [_jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 }, children: [weekdays.map((w) => (_jsx(Typography, { sx: { fontSize: 11, color: hr.textMuted, textAlign: 'center' }, children: w }, w))), Array.from({ length: lead }, (_, i) => (_jsx(Box, {}, `lead-${i}`))), data.days.map((d) => {
                                const l = look(d);
                                const on = d.date === picked;
                                return (_jsxs(Box, { component: "button", type: "button", onClick: () => setPicked(d.date), "aria-pressed": on, "aria-label": `${date(d.date)} · ${t(`attendance.status.${d.status}`)}`, sx: {
                                        all: 'unset',
                                        boxSizing: 'border-box',
                                        cursor: 'pointer',
                                        minHeight: 56,
                                        borderRadius: '8px',
                                        p: 0.6,
                                        bgcolor: l.bg,
                                        border: `1px solid ${on ? hr.primary : hr.border}`,
                                        boxShadow: on ? `0 0 0 2px #BFDBFE` : 'none',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 0.1,
                                        '&:focus-visible': { outline: `2px solid ${hr.primary}` },
                                    }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 700, color: hr.text, fontVariantNumeric: 'tabular-nums' }, children: Number(d.date.slice(8)) }), _jsx(Typography, { sx: { fontSize: 10.5, fontWeight: 600, color: l.fg, lineHeight: 1.2 }, children: d.status === 'Present' && d.lateMinutes > 0 ? t('attendance.status.Late') : d.status === 'Holiday' ? (localRef({ nameAr: d.holidayAr, nameEn: d.holidayEn }, ar) || t('attendance.status.Holiday')) : t(`attendance.status.${d.status}`) }), (d.in || d.out) && (_jsxs(Typography, { sx: { fontSize: 10, color: hr.textMuted, fontVariantNumeric: 'tabular-nums', lineHeight: 1.35 }, children: [hhmm(d.in) ?? '—', _jsx("br", {}), hhmm(d.out) ?? '—'] }))] }, d.date));
                            })] }), day ? _jsx(DayCard, { employeeId: data.employeeId, day: day, canManage: canManage, onSaved: changed }, `${day.date}-${version}`) : _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('attendance.drawer.pick') }), _jsxs(Box, { sx: { border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5 }, children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 1 }, children: t('attendance.drawer.summary') }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, textAlign: 'center' }, children: [
                                    [t('attendance.cols.present'), String(data.summary.present)],
                                    [t('attendance.cols.absent'), String(data.summary.absent)],
                                    [t('attendance.cols.late'), hm(data.summary.lateMinutes)],
                                    [t('attendance.cols.deduction'), String(data.summary.deduction)],
                                ].map(([l, v]) => (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: l }), _jsx(Typography, { sx: { fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: v }) })] }, l))) })] }), canManage && (_jsxs(Box, { children: [_jsx(Button, { size: "small", startIcon: _jsx(SettingsOutlinedIcon, {}), onClick: () => setSettings((s) => !s), children: t('attendance.drawer.settings') }), _jsx(Collapse, { in: settings, unmountOnExit: true, children: _jsx(EmployeeSettings, { data: data, onSaved: changed }) })] }))] }))] }));
}
function DayCard({ employeeId, day, canManage, onSaved }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { date } = useCommercialFormat();
    const [inTime, setIn] = useState(hhmm(day.in) ?? '');
    const [outTime, setOut] = useState(hhmm(day.out) ?? '');
    const [status, setStatus] = useState(day.manualStatus ?? '');
    const [note, setNote] = useState(day.note ?? '');
    const [deduction, setDeduction] = useState(day.deductionSet === null ? '' : String(day.deductionSet));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const l = look(day);
    const weekday = t('attendance.weekdays', { returnObjects: true })[new Date(`${day.date}T00:00:00`).getDay()];
    const editable = canManage && day.status !== 'NoData';
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await attendanceApi.correct(employeeId, day.date, {
                in: inTime && inTime !== hhmm(day.deviceIn) ? inTime : null,
                out: outTime && outTime !== hhmm(day.deviceOut) ? outTime : null,
                status: status || null,
                note: note.trim() || null,
                deduction: deduction === '' ? null : Number(deduction),
            });
            setSaved(true);
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Box, { sx: { border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5, display: 'grid', gap: 1 }, children: [_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', alignItems: 'center', gap: 1 }, children: [_jsxs(Typography, { sx: { fontWeight: 700 }, children: [weekday, " ", _jsx("bdi", { children: date(day.date) }), day.ramadan ? ` · ${t('shifts.ramadan')}` : ''] }), _jsx(HrStatusBadge, { label: day.status === 'Holiday' ? localRef({ nameAr: day.holidayAr, nameEn: day.holidayEn }, ar) || t('attendance.status.Holiday') : t(`attendance.status.${day.status}`), color: l.fg, tint: l.bg === '#FFFFFF' ? '#F0FDF4' : l.bg })] }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, fontSize: 12.5 }, children: [
                    [t('attendance.cols.in'), hhmm(day.in) ?? '—'],
                    [t('attendance.cols.out'), hhmm(day.out) ?? '—'],
                    [t('attendance.cols.late'), hm(day.lateMinutes)],
                    [t('attendance.drawer.worked'), hm(day.workedMinutes)],
                ].map(([k, v]) => (_jsxs(Box, { sx: { bgcolor: hr.muted, borderRadius: '8px', px: 1, py: 0.75 }, children: [_jsx(Typography, { sx: { fontSize: 11, color: hr.textMuted }, children: k }), _jsx(Typography, { sx: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' }, children: _jsx("bdi", { children: v }) })] }, k))) }), (day.deviceStatus || day.deviceIn || day.deviceOut) && (_jsxs(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: [day.deviceStatus && t('attendance.drawer.device', { status: day.deviceStatus }), (day.deviceIn || day.deviceOut) && (_jsxs(_Fragment, { children: [' · ', _jsx("bdi", { dir: "ltr", children: t('attendance.drawer.deviceTimes', { in: hhmm(day.deviceIn) ?? '—', out: hhmm(day.deviceOut) ?? '—' }) })] })), day.permissionMinutes > 0 && ` · ${t('attendance.drawer.permission', { minutes: day.permissionMinutes })}`, (day.deviceLateMinutes !== null || day.deviceEarlyMinutes !== null) && ` · ${t('attendance.drawer.deviceMinutes', { late: hm(day.deviceLateMinutes ?? 0), early: hm(day.deviceEarlyMinutes ?? 0) })}`] })), day.leaveRequestNo && (_jsxs(Typography, { sx: { fontSize: 12.5 }, children: [t('attendance.drawer.leave', { type: ar ? day.leaveTypeAr : day.leaveTypeEn }), " \u00B7 ", _jsx(RouterLink, { to: `/hr/leave`, children: _jsx("bdi", { children: day.leaveRequestNo }) })] })), day.approvedPermissionMinutes > 0 && (_jsxs(Typography, { sx: { fontSize: 12.5 }, children: [t('attendance.drawer.permissionApproved', { minutes: day.approvedPermissionMinutes }), " \u00B7 ", _jsx("bdi", { children: day.permissionRequestNo })] })), day.deviceLeaveWithoutRequest && _jsx(Alert, { severity: "warning", sx: { py: 0 }, children: t('attendance.drawer.deviceLeave') }), day.editedByName && _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t('attendance.drawer.edited', { by: day.editedByName, date: date(day.editedAt) }) }), editable && (_jsxs(Box, { sx: { borderTop: `1px dashed ${hr.border}`, pt: 1, display: 'grid', gap: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: t('attendance.drawer.correct') }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }, children: [_jsx(TextField, { size: "small", type: "time", label: t('attendance.drawer.in'), value: inTime, onChange: (e) => setIn(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { size: "small", type: "time", label: t('attendance.drawer.out'), value: outTime, onChange: (e) => setOut(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsxs(TextField, { select: true, size: "small", label: t('attendance.drawer.statusOver'), value: status, onChange: (e) => setStatus(e.target.value), slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('attendance.drawer.calculated') }), manualStatuses.map((s) => (_jsx(MenuItem, { value: s, children: t(`attendance.manual.${s}`) }, s)))] }), _jsx(TextField, { size: "small", type: "number", label: t('attendance.drawer.deduction'), value: deduction, onChange: (e) => setDeduction(e.target.value), helperText: t('attendance.drawer.deductionHint', { value: day.deduction }), slotProps: { htmlInput: { min: 0, max: 3, step: 0.25 }, inputLabel: { shrink: true } } })] }), _jsx(TextField, { size: "small", label: t('attendance.drawer.note'), value: note, onChange: (e) => setNote(e.target.value), multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 500 } } }), _jsx(ErrorMessage, { messageKey: error }), saved && _jsx(Alert, { severity: "success", children: t('attendance.drawer.saved') }), _jsx(Box, { children: _jsx(Button, { variant: "contained", disabled: busy, onClick: () => void save(), children: t('attendance.drawer.save') }) })] }))] }));
}
function EmployeeSettings({ data, onSaved }) {
    const { t } = useTranslation();
    const [badge, setBadge] = useState(data.badgeNo ?? '');
    const [exempt, setExempt] = useState(data.exempt);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await attendanceApi.saveEmployee(data.employeeId, { badgeNo: badge.trim() || null, exempt });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Box, { sx: { display: 'grid', gap: 1, mt: 1, border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5 }, children: [data.idNumber && (_jsxs(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: [t('attendance.drawer.idNumber'), " ", _jsx("bdi", { children: data.idNumber })] })), _jsx(TextField, { size: "small", label: t('attendance.drawer.badge'), helperText: t('attendance.drawer.badgeHint'), value: badge, onChange: (e) => setBadge(e.target.value), slotProps: { htmlInput: { maxLength: 30, dir: 'ltr' } } }), _jsx(FormControlLabel, { control: _jsx(Checkbox, { checked: exempt, onChange: (e) => setExempt(e.target.checked) }), label: t('attendance.drawer.exempt') }), _jsx(ErrorMessage, { messageKey: error }), _jsx(Box, { children: _jsx(Button, { variant: "outlined", disabled: busy, onClick: () => void save(), children: t('common.save') }) })] }));
}
