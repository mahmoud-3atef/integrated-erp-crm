import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography, } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { attendanceApi, hhmm, matchBys, minutesSources } from '../../api/attendance';
import { staffApi } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { localRef } from './AttendanceMonthPage';
import { DateField } from '../../components/DateField';
const accents = ['#2563EB', '#D97706', '#059669', '#7C3AED', '#DB2777', '#0E7490'];
/** The shifts (with Ramadan hours) and who has them, the year's holidays, the attendance settings and the calculation rules. */
export function ShiftsPage() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [year, setYear] = useState(new Date().getFullYear());
    const [data, setData] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(null);
    const [assigning, setAssigning] = useState(null);
    const [holiday, setHoliday] = useState(null);
    const [version, setVersion] = useState(0);
    const canSet = can('attendance.settings', true);
    const weekdays = t('attendance.weekdays', { returnObjects: true });
    useEffect(() => {
        attendanceApi
            .setup(year)
            .then((d) => (setData(d), setError(null)))
            .catch((failure) => setError(errorKey(failure)));
    }, [year, version]);
    useEffect(() => {
        staffApi.structure().then((s) => setDepartments(s.departments)).catch(() => setDepartments([]));
    }, []);
    const reload = () => setVersion((v) => v + 1);
    const remove = async (run, name) => {
        if (!window.confirm(t('shifts.confirmDelete', { name })))
            return;
        try {
            await run();
            reload();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(EventNoteOutlinedIcon, {}), title: t('shifts.title'), subtitle: t('shifts.intro'), actions: canSet && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(Add, {}), onClick: () => setHoliday('new'), children: t('shifts.newHoliday') }), _jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setEditing('new'), children: t('shifts.new') })] })) }), _jsx(ErrorMessage, { messageKey: error }), !data ? (_jsx(LinearProgress, {})) : (_jsxs(Stack, { sx: { gap: 1.75 }, children: [_jsx(Box, { sx: { display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }, children: data.shifts.map((s, i) => (_jsxs(Box, { sx: { ...hrCard, p: 1.75, borderTop: `3px solid ${accents[i % accents.length]}`, display: 'grid', gap: 1, alignContent: 'start', opacity: s.isActive ? 1 : 0.6 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 15, flex: 1 }, children: localRef(s, ar) }), s.isDefault && _jsx(HrStatusBadge, { label: t('shifts.default'), color: hr.primary, tint: "#EFF6FF" }), !s.isActive && _jsx(HrStatusBadge, { label: t('shifts.inactive'), color: hr.textMuted, tint: hr.muted }), canSet && (_jsx(Button, { size: "small", variant: "outlined", onClick: () => setEditing(s), children: t('shifts.edit') }))] }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }, children: [_jsx(Fact, { label: t('shifts.hours'), value: _jsx("bdi", { dir: "ltr", children: `${hhmm(s.startsAt)} – ${hhmm(s.endsAt)}` }) }), _jsx(Fact, { label: t('shifts.break'), value: t('shifts.minutes', { count: s.breakMinutes }) }), _jsx(Fact, { label: t('shifts.grace'), value: t('shifts.minutes', { count: s.graceMinutes }) }), _jsx(Fact, { label: t('shifts.rest'), value: s.restDays.map((d) => weekdays[d]).join('، ') || '—' })] }), _jsxs(Box, { sx: { bgcolor: '#F5F3FF', borderRadius: '8px', px: 1.25, py: 0.75, fontSize: 12.5 }, children: [_jsxs(Box, { component: "b", sx: { color: hr.violet }, children: [t('shifts.ramadan'), ":", ' '] }), s.ramadanStartsAt ? _jsx("bdi", { dir: "ltr", children: `${hhmm(s.ramadanStartsAt)} – ${hhmm(s.ramadanEndsAt)}` }) : t('shifts.noRamadan')] }), _jsxs(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: [t(`shifts.lateFrom.${s.lateFrom}`), " \u00B7 ", t(`shifts.source.${s.minutesSource}`)] }), _jsxs(Box, { sx: { borderTop: `1px dashed ${hr.border}`, pt: 1 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', mb: 0.5 }, children: [_jsxs(Typography, { sx: { fontSize: 12.5, fontWeight: 600, flex: 1 }, children: [t('shifts.assigned'), " \u00B7 ", t('shifts.employees', { count: s.employees })] }), canSet && (_jsx(Button, { size: "small", startIcon: _jsx(Add, {}), onClick: () => setAssigning(s), children: t('shifts.assign') }))] }), _jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: 0.75 }, children: [s.isDefault && _jsx(Chip, { size: "small", label: t('shifts.assignedDefault') }), s.assignments.map((a) => (_jsx(Chip, { size: "small", variant: "outlined", label: _jsxs("span", { children: [localRef(a, ar), " \u00B7 ", _jsx("bdi", { children: date(a.from) }), a.to ? _jsxs(_Fragment, { children: [" \u2013 ", _jsx("bdi", { children: date(a.to) })] }) : ''] }), onDelete: canSet ? () => void remove(() => attendanceApi.unassign(a.id), localRef(a, ar)) : undefined }, a.id)))] })] })] }, s.id))) }), _jsxs(Box, { sx: { display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: '1.25fr 1fr' }, alignItems: 'start' }, children: [_jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsx(Tabs, { value: year, onChange: (_, v) => setYear(v), sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: [year - 1, year, year + 1].map((y) => (_jsx(Tab, { value: y, label: t('shifts.holidays', { year: y }) }, y))) }), data.holidays.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(EventNoteOutlinedIcon, {}), title: t('shifts.noHolidays') })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 44, fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('shifts.cols.name') }), _jsx(TableCell, { children: t('shifts.cols.from') }), _jsx(TableCell, { children: t('shifts.cols.to') }), _jsx(TableCell, { children: t('shifts.cols.days') }), _jsx(TableCell, { children: t('shifts.cols.kind') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: data.holidays.map((h) => (_jsxs(TableRow, { hover: true, sx: { cursor: canSet ? 'pointer' : undefined }, onClick: () => canSet && setHoliday(h), children: [_jsx(TableCell, { sx: { fontWeight: 700 }, children: localRef(h, ar) }), _jsx(TableCell, { children: date(h.from) }), _jsx(TableCell, { children: date(h.to) }), _jsx(TableCell, { children: h.days }), _jsx(TableCell, { children: _jsx(HrStatusBadge, { label: t(`shifts.kind.${h.kind}`), ...(h.kind === 'Ramadan' ? { color: '#0E7490', tint: '#CFFAFE' } : { color: hr.violet, tint: '#F5F3FF' }) }) }), _jsx(TableCell, { align: "right", children: canSet && (_jsx(IconButton, { size: "small", "aria-label": t('shifts.delete'), onClick: (e) => {
                                                                        e.stopPropagation();
                                                                        void remove(() => attendanceApi.deleteHoliday(h.id), localRef(h, ar));
                                                                    }, children: _jsx(DeleteOutlineIcon, { fontSize: "small" }) })) })] }, h.id))) })] }) }))] }), _jsxs(Stack, { sx: { gap: 1.75 }, children: [_jsx(SettingsCard, { data: data, canSet: canSet, onSaved: reload }), _jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 15, mb: 0.5 }, children: t('shifts.rules') }), ['absent', 'missing', 'late', 'early', 'device', 'holiday'].map((k) => {
                                                const [when, then] = t(`shifts.rule.${k}`, { returnObjects: true });
                                                return (_jsxs(Stack, { direction: "row", sx: { justifyContent: 'space-between', gap: 2, py: 0.9, borderBottom: `1px solid #EEF2F7` }, children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: when }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, textAlign: 'end' }, children: then })] }, k));
                                            }), _jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted, mt: 1 }, children: t('shifts.rulesNote') })] })] })] })] })), editing && (_jsx(ShiftDialog, { shift: editing === 'new' ? null : editing, onClose: () => setEditing(null), onSaved: () => (setEditing(null), reload()), onDelete: editing !== 'new' && !editing.isDefault ? () => void remove(() => attendanceApi.deleteShift(editing.id), localRef(editing, ar)).then(() => setEditing(null)) : undefined })), assigning && _jsx(AssignDialog, { shift: assigning, departments: departments, onClose: () => setAssigning(null), onSaved: () => (setAssigning(null), reload()) }), holiday && _jsx(HolidayDialog, { holiday: holiday === 'new' ? null : holiday, year: year, onClose: () => setHoliday(null), onSaved: () => (setHoliday(null), reload()) })] }));
}
function Fact({ label, value }) {
    return (_jsxs(Box, { sx: { bgcolor: '#F8FAFC', borderRadius: '8px', px: 1.25, py: 0.75 }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: label }), _jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }, children: value })] }));
}
function SettingsCard({ data, canSet, onSaved }) {
    const { t } = useTranslation();
    const [matchBy, setMatchBy] = useState(data.settings.matchBy);
    const [cycle, setCycle] = useState(String(data.settings.cycleStartDay));
    const [device, setDevice] = useState(data.settings.useDeviceMinutes);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const dirty = matchBy !== data.settings.matchBy || Number(cycle) !== data.settings.cycleStartDay || device !== data.settings.useDeviceMinutes;
    const save = async () => {
        setError(null);
        try {
            await attendanceApi.saveSettings({ matchBy, cycleStartDay: Number(cycle), useDeviceMinutes: device });
            setSaved(true);
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    return (_jsxs(Box, { sx: { ...hrCard, p: 2, display: 'grid', gap: 1.25 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 15 }, children: t('shifts.settings') }), _jsx(TextField, { select: true, size: "small", label: t('shifts.matchBy'), value: matchBy, disabled: !canSet, onChange: (e) => (setMatchBy(e.target.value), setSaved(false)), children: matchBys.map((m) => (_jsx(MenuItem, { value: m, children: t(`shifts.matchByValue.${m}`) }, m))) }), _jsx(TextField, { size: "small", type: "number", label: t('shifts.cycle'), value: cycle, disabled: !canSet, onChange: (e) => (setCycle(e.target.value), setSaved(false)), helperText: t('shifts.cycleHint'), slotProps: { htmlInput: { min: 1, max: 28 } } }), _jsxs(TextField, { select: true, size: "small", label: t('shifts.minutesFrom'), value: device ? 'device' : 'shift', disabled: !canSet, onChange: (e) => (setDevice(e.target.value === 'device'), setSaved(false)), children: [_jsx(MenuItem, { value: "device", children: t('shifts.minutesFromValue.device') }), _jsx(MenuItem, { value: "shift", children: t('shifts.minutesFromValue.shift') })] }), _jsx(ErrorMessage, { messageKey: error }), saved && _jsx(Alert, { severity: "success", children: t('shifts.saved') }), canSet && (_jsx(Box, { children: _jsx(Button, { variant: "outlined", disabled: !dirty, onClick: () => void save(), children: t('common.save') }) }))] }));
}
const blank = { nameAr: '', nameEn: '', startsAt: '09:00', endsAt: '17:00', breakMinutes: 0, graceMinutes: 15, lateFrom: 'GraceEnd', minutesSource: 'Company', restDays: [5, 6], ramadanStartsAt: null, ramadanEndsAt: null, isActive: true, isDefault: false };
function ShiftDialog({ shift, onClose, onSaved, onDelete }) {
    const { t } = useTranslation();
    const [v, setV] = useState(() => shift ? { ...shift, startsAt: hhmm(shift.startsAt), endsAt: hhmm(shift.endsAt), ramadanStartsAt: hhmm(shift.ramadanStartsAt), ramadanEndsAt: hhmm(shift.ramadanEndsAt) } : blank);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const weekdays = t('attendance.weekdays', { returnObjects: true });
    const set = (k, value) => setV((s) => ({ ...s, [k]: value }));
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await attendanceApi.saveShift(shift?.id ?? null, { ...v, ramadanStartsAt: v.ramadanStartsAt || null, ramadanEndsAt: v.ramadanEndsAt || null });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "sm", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: shift ? shift.nameAr : t('shifts.form.title') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr', pt: '8px !important' }, children: [_jsx(TextField, { size: "small", required: true, label: t('shifts.form.nameAr'), value: v.nameAr, onChange: (e) => set('nameAr', e.target.value) }), _jsx(TextField, { size: "small", label: t('shifts.form.nameEn'), value: v.nameEn, onChange: (e) => set('nameEn', e.target.value), slotProps: { htmlInput: { dir: 'ltr' } } }), _jsx(TextField, { size: "small", type: "time", label: t('shifts.form.startsAt'), value: v.startsAt, onChange: (e) => set('startsAt', e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { size: "small", type: "time", label: t('shifts.form.endsAt'), value: v.endsAt, onChange: (e) => set('endsAt', e.target.value), helperText: v.endsAt <= v.startsAt ? t('shifts.form.overnight') : ' ', slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { size: "small", type: "number", label: t('shifts.form.breakMinutes'), value: v.breakMinutes, onChange: (e) => set('breakMinutes', Number(e.target.value)), slotProps: { htmlInput: { min: 0, max: 240 } } }), _jsx(TextField, { size: "small", type: "number", label: t('shifts.form.graceMinutes'), value: v.graceMinutes, onChange: (e) => set('graceMinutes', Number(e.target.value)), slotProps: { htmlInput: { min: 0, max: 120 } } }), _jsx(TextField, { select: true, size: "small", label: t('shifts.form.lateFrom'), value: v.lateFrom, onChange: (e) => set('lateFrom', e.target.value), sx: { gridColumn: '1 / -1' }, children: ['GraceEnd', 'ShiftStart'].map((k) => (_jsx(MenuItem, { value: k, children: t(`shifts.lateFrom.${k}`) }, k))) }), _jsx(TextField, { select: true, size: "small", label: t('shifts.form.minutesSource'), value: v.minutesSource, onChange: (e) => set('minutesSource', e.target.value), sx: { gridColumn: '1 / -1' }, helperText: t('shifts.form.minutesSourceHint'), children: minutesSources.map((k) => (_jsx(MenuItem, { value: k, children: t(`shifts.sourceOption.${k}`) }, k))) }), _jsxs(Box, { sx: { gridColumn: '1 / -1' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted, mb: 0.5 }, children: t('shifts.form.restDays') }), _jsx(ToggleButtonGroup, { size: "small", value: v.restDays, onChange: (_, days) => set('restDays', days), sx: { flexWrap: 'wrap' }, children: weekdays.map((w, i) => (_jsx(ToggleButton, { value: i, sx: { px: 1.25 }, children: w }, w))) })] }), _jsx(TextField, { size: "small", type: "time", label: t('shifts.form.ramadanStartsAt'), value: v.ramadanStartsAt ?? '', onChange: (e) => set('ramadanStartsAt', e.target.value || null), slotProps: { inputLabel: { shrink: true } } }), _jsx(TextField, { size: "small", type: "time", label: t('shifts.form.ramadanEndsAt'), value: v.ramadanEndsAt ?? '', onChange: (e) => set('ramadanEndsAt', e.target.value || null), slotProps: { inputLabel: { shrink: true } } }), _jsx(Typography, { sx: { gridColumn: '1 / -1', fontSize: 12, color: hr.textMuted, mt: -1 }, children: t('shifts.form.ramadanHint') }), _jsx(FormControlLabel, { sx: { gridColumn: '1 / -1' }, control: _jsx(Checkbox, { checked: v.isDefault, onChange: (e) => set('isDefault', e.target.checked) }), label: t('shifts.form.isDefault') }), _jsx(FormControlLabel, { sx: { gridColumn: '1 / -1', mt: -1.5 }, control: _jsx(Checkbox, { checked: v.isActive, onChange: (e) => set('isActive', e.target.checked) }), label: t('shifts.form.isActive') }), _jsx(Box, { sx: { gridColumn: '1 / -1' }, children: _jsx(ErrorMessage, { messageKey: error }) })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !v.nameAr.trim(), onClick: () => void save(), children: t('common.save') }), _jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Box, { sx: { flex: 1 } }), onDelete && (_jsx(Button, { color: "error", startIcon: _jsx(DeleteOutlineIcon, {}), onClick: onDelete, children: t('shifts.delete') }))] })] }) }));
}
function AssignDialog({ shift, departments, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [to, setTo] = useState('department');
    const [department, setDepartment] = useState('');
    const [employee, setEmployee] = useState(null);
    const [options, setOptions] = useState([]);
    const [search, setSearch] = useState('');
    const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
    const [until, setUntil] = useState('');
    const [error, setError] = useState(null);
    useEffect(() => {
        if (to !== 'employee')
            return;
        const timer = setTimeout(() => staffApi.pick(search).then(setOptions).catch(() => setOptions([])), 250);
        return () => clearTimeout(timer);
    }, [search, to]);
    const save = async () => {
        setError(null);
        try {
            await attendanceApi.assign({ shiftId: shift.id, departmentId: to === 'department' ? department || null : null, employeeId: to === 'employee' ? (employee?.id ?? null) : null, from, to: until || null });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsxs(DialogTitle, { sx: { fontWeight: 700 }, children: [t('shifts.assignForm.title'), " \u00B7 ", localRef(shift, ar)] }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsxs(ToggleButtonGroup, { exclusive: true, size: "small", value: to, onChange: (_, v) => v && setTo(v), children: [_jsx(ToggleButton, { value: "department", children: t('shifts.assignForm.department') }), _jsx(ToggleButton, { value: "employee", children: t('shifts.assignForm.employee') })] }), to === 'department' ? (_jsx(TextField, { select: true, size: "small", label: t('shifts.assignForm.pickDepartment'), value: department, onChange: (e) => setDepartment(e.target.value), children: departments.map((d) => (_jsx(MenuItem, { value: d.id, children: ar ? d.nameAr : d.nameEn }, d.id))) })) : (_jsx(Autocomplete, { size: "small", options: options, value: employee, onChange: (_, v) => setEmployee(v), onInputChange: (_, v) => setSearch(v), getOptionLabel: (o) => localRef(o, ar), isOptionEqualToValue: (a, b) => a.id === b.id, filterOptions: (x) => x, renderInput: (params) => _jsx(TextField, { ...params, label: t('shifts.assignForm.pickEmployee') }) })), _jsx(DateField, { size: "small", label: t('shifts.assignForm.from'), value: from, onChange: (e) => setFrom(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(DateField, { size: "small", label: t('shifts.assignForm.until'), value: until, onChange: (e) => setUntil(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: !from || (to === 'department' ? !department : !employee), onClick: () => void save(), children: t('shifts.assign') }), _jsx(Button, { onClick: onClose, children: t('common.cancel') })] })] }) }));
}
function HolidayDialog({ holiday, year, onClose, onSaved }) {
    const { t } = useTranslation();
    const [nameAr, setNameAr] = useState(holiday?.nameAr ?? '');
    const [nameEn, setNameEn] = useState(holiday?.nameEn ?? '');
    const [from, setFrom] = useState(holiday?.from ?? `${year}-01-01`);
    const [to, setTo] = useState(holiday?.to ?? `${year}-01-01`);
    const [kind, setKind] = useState(holiday?.kind ?? 'Official');
    const [error, setError] = useState(null);
    const save = async () => {
        setError(null);
        try {
            await attendanceApi.saveHoliday(holiday?.id ?? null, { nameAr, nameEn: nameEn || null, from, to, kind });
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    return (_jsx(Dialog, { open: true, onClose: onClose, maxWidth: "xs", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: holiday ? holiday.nameAr : t('shifts.holidayForm.title') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(TextField, { size: "small", required: true, label: t('shifts.holidayForm.nameAr'), value: nameAr, onChange: (e) => setNameAr(e.target.value) }), _jsx(TextField, { size: "small", label: t('shifts.holidayForm.nameEn'), value: nameEn, onChange: (e) => setNameEn(e.target.value), slotProps: { htmlInput: { dir: 'ltr' } } }), _jsx(TextField, { select: true, size: "small", label: t('shifts.holidayForm.kind'), value: kind, onChange: (e) => setKind(e.target.value), children: ['Official', 'Ramadan'].map((k) => (_jsx(MenuItem, { value: k, children: t(`shifts.kind.${k}`) }, k))) }), _jsxs(Stack, { direction: "row", sx: { gap: 1 }, children: [_jsx(DateField, { size: "small", fullWidth: true, label: t('shifts.holidayForm.from'), value: from, onChange: (e) => (setFrom(e.target.value), to < e.target.value && setTo(e.target.value)), slotProps: { inputLabel: { shrink: true } } }), _jsx(DateField, { size: "small", fullWidth: true, label: t('shifts.holidayForm.to'), value: to, onChange: (e) => setTo(e.target.value), slotProps: { inputLabel: { shrink: true } } })] }), _jsx(ErrorMessage, { messageKey: error })] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: !nameAr.trim() || !from || !to, onClick: () => void save(), children: t('common.save') }), _jsx(Button, { onClick: onClose, children: t('common.cancel') })] })] }) }));
}
