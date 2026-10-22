import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Step, StepLabel, Stepper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { attendanceApi, fileFields, hhmm } from '../../api/attendance';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrScope, HrStatusBadge, hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
const required = ['key', 'date'];
/**
 * Importing the fingerprint file: choose it, check how its columns were matched (and correct them), see what would be
 * accepted, rejected or warned about, then import. Nothing is written before the last step.
 */
export function ImportDialog({ onClose, onDone }) {
    const { t } = useTranslation();
    const { date } = useCommercialFormat();
    const input = useRef(null);
    const [file, setFile] = useState(null);
    const [step, setStep] = useState(0);
    const [preview, setPreview] = useState(null);
    const [mapping, setMapping] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const steps = t('attendance.dialog.steps', { returnObjects: true });
    const read = async (f, m, next) => {
        setBusy(true);
        setError(null);
        try {
            const p = await attendanceApi.preview(f, m);
            setPreview(p);
            setMapping(p.mapping);
            if (next !== undefined)
                setStep(next);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const apply = async () => {
        if (!file)
            return;
        setBusy(true);
        setError(null);
        try {
            const r = await attendanceApi.apply(file, mapping);
            onDone(t('attendance.dialog.done', { accepted: r.accepted, employees: r.employees }), r.from);
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    const mappedOk = required.every((f) => mapping[f]);
    const statusOf = (rejected) => (rejected ? { color: '#B91C1C', tint: '#FEE2E2' } : { color: '#B45309', tint: '#FEF3C7' });
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "lg", fullWidth: true, children: _jsxs(HrScope, { children: [_jsxs(DialogTitle, { sx: { fontWeight: 700 }, children: [t('attendance.dialog.title'), file && (_jsxs(Typography, { component: "div", sx: { fontSize: 12.5, color: hr.textMuted }, children: [_jsx("bdi", { children: file.name }), preview && ` · ${t('attendance.dialog.rows', { count: preview.rows })}`] }))] }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 2 }, children: [_jsx(Stepper, { activeStep: step, alternativeLabel: true, sx: { pt: 1 }, children: steps.map((s) => (_jsx(Step, { children: _jsx(StepLabel, { children: s }) }, s))) }), busy && _jsx(LinearProgress, {}), _jsx(ErrorMessage, { messageKey: error }), step === 0 && (_jsxs(Box, { sx: { border: `1.5px dashed #CBD5E1`, borderRadius: '12px', p: 4, textAlign: 'center', display: 'grid', gap: 1, justifyItems: 'center' }, children: [_jsx(UploadFileOutlinedIcon, { sx: { fontSize: 40, color: '#94A3B8' } }), _jsx(Typography, { sx: { fontWeight: 700 }, children: t('attendance.dialog.pick') }), _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted, maxWidth: 520 }, children: t('attendance.dialog.pickHint') }), _jsx("input", { ref: input, type: "file", accept: ".xlsx", hidden: true, onChange: (e) => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                            setFile(f);
                                            void read(f, undefined, 1);
                                        }
                                    } }), _jsx(Button, { variant: "contained", disabled: busy, onClick: () => input.current?.click(), children: t('attendance.dialog.choose') })] })), step === 1 && preview && (_jsxs(Box, { sx: { display: 'grid', gap: 1 }, children: [_jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('attendance.dialog.mappingHint') }), _jsxs(Alert, { severity: "info", sx: { py: 0 }, children: [t('attendance.dialog.matchBy', { value: t(`shifts.matchByValue.${preview.matchBy}`) }), " \u2014 ", t('attendance.dialog.matchByChange')] }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('attendance.dialog.field') }), _jsx(TableCell, { children: t('attendance.dialog.fileColumn') }), _jsx(TableCell, { children: t('attendance.dialog.samples') })] }) }), _jsx(TableBody, { children: fileFields.map((f) => {
                                                    const col = preview.columns.find((c) => c.header === mapping[f]);
                                                    return (_jsxs(TableRow, { children: [_jsxs(TableCell, { sx: { fontWeight: 600 }, children: [t(`attendance.dialog.fields.${f}`), required.includes(f) && _jsx(Typography, { component: "span", sx: { color: hr.danger, ms: 0.5 }, children: " *" })] }), _jsx(TableCell, { sx: { width: 280 }, children: _jsxs(TextField, { select: true, size: "small", fullWidth: true, value: mapping[f] ?? '', onChange: (e) => setMapping((m) => ({ ...m, [f]: e.target.value })), slotProps: { select: { displayEmpty: true }, htmlInput: { 'aria-label': t(`attendance.dialog.fields.${f}`) } }, children: [_jsx(MenuItem, { value: "", children: t('attendance.dialog.none') }), preview.columns.map((c) => (_jsx(MenuItem, { value: c.header, children: c.header }, c.header)))] }) }), _jsx(TableCell, { sx: { color: hr.textMuted, fontSize: 12 }, children: _jsx("bdi", { children: col?.samples.join(' · ') ?? '—' }) })] }, f));
                                                }) })] }) })] })), step === 2 && preview && (_jsxs(Box, { sx: { display: 'grid', gap: 1.5 }, children: [_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }, children: [
                                        ['accepted', preview.accepted, hr.success, '#ECFDF5'],
                                        ['rejected', preview.rejected, '#B91C1C', '#FFF1F2'],
                                        ['warnings', preview.warnings, '#B45309', '#FFFBEB'],
                                        ['employees', preview.employees, hr.primary, '#EFF6FF'],
                                        ['skipped', preview.skipped, hr.textMuted, hr.muted],
                                    ].map(([k, v, c, b]) => (_jsxs(Box, { sx: { bgcolor: b, border: `1px solid ${hr.border}`, borderRadius: '10px', p: 1.25 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: hr.textMuted }, children: t(`attendance.dialog.summary.${k}`) }), _jsx(Typography, { sx: { fontSize: 20, fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums' }, children: v.toLocaleString('en-US') })] }, k))) }), preview.from && (_jsx(Typography, { sx: { fontSize: 13 }, children: _jsx("bdi", { children: t('attendance.dialog.range', { from: date(preview.from), to: date(preview.to) }) }) })), preview.unmatched.length > 0 && (_jsxs(Alert, { severity: "warning", children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: t('attendance.dialog.unmatched', { count: preview.unmatched.length }) }), _jsx(Typography, { sx: { fontSize: 12.5 }, children: t('attendance.dialog.unmatchedHint') }), _jsxs(Typography, { sx: { fontSize: 12.5, mt: 0.5 }, children: [preview.unmatched.slice(0, 20).map((u, i) => (_jsxs("span", { children: [i > 0 && '، ', _jsx("bdi", { children: u.key }), u.name ? _jsxs(_Fragment, { children: [" (", _jsx("bdi", { children: u.name.trim() }), ")"] }) : ''] }, u.key))), preview.unmatched.length > 20 && ' …'] })] })), _jsx(Typography, { sx: { fontWeight: 700 }, children: t('attendance.dialog.problems') }), preview.problems.length === 0 ? (_jsx(Typography, { sx: { fontSize: 13, color: hr.success }, children: t('attendance.dialog.noProblems') })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 300 }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: { '& td': { fontVariantNumeric: 'tabular-nums' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: "#" }), _jsx(TableCell, { children: t('attendance.dialog.fields.key') }), _jsx(TableCell, { children: t('attendance.cols.employee') }), _jsx(TableCell, { children: t('attendance.cols.date') }), _jsx(TableCell, { children: t('attendance.cols.in') }), _jsx(TableCell, { children: t('attendance.cols.out') }), _jsx(TableCell, { children: t('attendance.cols.status') })] }) }), _jsx(TableBody, { children: preview.problems.slice(0, 200).map((p) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: p.row }), _jsx(TableCell, { children: _jsx("bdi", { children: p.key }) }), _jsx(TableCell, { children: p.name ?? '—' }), _jsx(TableCell, { children: date(p.date) }), _jsx(TableCell, { children: _jsx("bdi", { children: hhmm(p.in) ?? '—' }) }), _jsx(TableCell, { children: _jsx("bdi", { children: hhmm(p.out) ?? '—' }) }), _jsx(TableCell, { children: _jsx(HrStatusBadge, { label: t(`attendance.dialog.codes.${p.code}`), ...statusOf(p.rejected) }) })] }, `${p.row}-${p.code}`))) })] }) })), _jsx(Alert, { severity: "info", children: t('attendance.dialog.note') })] }))] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, gap: 1, justifyContent: 'flex-start' }, children: [step === 1 && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "contained", disabled: busy || !mappedOk || !file, onClick: () => file && void read(file, mapping, 2), children: t('attendance.dialog.next') }), _jsx(Button, { disabled: busy, onClick: () => setStep(0), children: t('attendance.dialog.back') })] })), step === 2 && preview && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "contained", disabled: busy || preview.accepted === 0, onClick: () => void apply(), children: t('attendance.dialog.apply', { count: preview.accepted }) }), _jsx(Button, { disabled: busy, onClick: () => file && void read(file, mapping), children: t('attendance.dialog.reread') }), _jsx(Button, { disabled: busy, onClick: () => setStep(1), children: t('attendance.dialog.back') })] })), _jsx(Box, { sx: { flex: 1 } }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
