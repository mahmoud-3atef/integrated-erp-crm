import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { staffApi } from '../../api/staff';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrScope, hr } from '../../components/hr/Hr';
/**
 * Updating many staff files from an Excel sheet: download the template (the employees and what their files hold),
 * fill what should change, and upload it. The preview lists every change and every problem; a row with a problem is
 * left out, and an empty cell changes nothing.
 */
export function BulkUpdateDialog({ onClose, onApplied }) {
    const { t, i18n } = useTranslation();
    const input = useRef(null);
    const [file, setFile] = useState(null);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const preview = async (f) => {
        setFile(f);
        setResult(null);
        setBusy(true);
        setError(null);
        try {
            setResult(await staffApi.bulkUpdate(f, false));
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
            const r = await staffApi.bulkUpdate(file, true);
            onApplied(r.changes);
        }
        catch (failure) {
            setError(errorKey(failure));
            setBusy(false);
        }
    };
    const field = (key) => (key ? t(`staff.bulk.fields.${key}`, { defaultValue: key }) : '—');
    return (_jsx(Dialog, { open: true, onClose: busy ? undefined : onClose, maxWidth: "md", fullWidth: true, children: _jsxs(HrScope, { children: [_jsx(DialogTitle, { sx: { fontWeight: 700 }, children: t('staff.bulk.title') }), _jsxs(DialogContent, { sx: { display: 'grid', gap: 1.5, pt: '8px !important' }, children: [_jsx(Alert, { severity: "info", sx: { py: 0.25 }, children: t('staff.bulk.hint') }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { gap: 1 }, children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(FileDownloadOutlinedIcon, {}), component: "a", href: staffApi.updateTemplateUrl(i18n.language === 'ar' ? 'ar' : 'en'), download: true, children: t('staff.bulk.template') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(UploadFileOutlinedIcon, {}), disabled: busy, onClick: () => input.current?.click(), children: file ? t('staff.bulk.another') : t('staff.bulk.upload') }), _jsx("input", { ref: input, type: "file", accept: ".xlsx", hidden: true, onChange: (e) => {
                                        const f = e.target.files?.[0];
                                        e.target.value = '';
                                        if (f)
                                            void preview(f);
                                    } }), file && _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted, alignSelf: 'center' }, children: file.name })] }), busy && _jsx(LinearProgress, {}), _jsx(ErrorMessage, { messageKey: error }), result && (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 13.5 }, children: t('staff.bulk.summary', { rows: result.rows, employees: result.employees, changes: result.changes, rejected: result.rejected }) }), result.problems.length > 0 && (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.5, color: hr.danger }, children: t('staff.bulk.problemsTitle') }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 180 }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('staff.bulk.row') }), _jsx(TableCell, { children: t('staff.bulk.employee') }), _jsx(TableCell, { children: t('staff.bulk.field') }), _jsx(TableCell, { children: t('staff.bulk.problem') })] }) }), _jsx(TableBody, { children: result.problems.map((p, i) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: p.row }), _jsx(TableCell, { children: _jsx("bdi", { children: p.employeeNo ?? '—' }) }), _jsx(TableCell, { children: field(p.field) }), _jsxs(TableCell, { children: [t(`staff.bulk.problems.${p.problem}`), p.value && (_jsxs(_Fragment, { children: [' ', "\u00B7 ", _jsx("bdi", { dir: "ltr", children: p.value })] }))] })] }, i))) })] }) })] })), result.items.length > 0 && (_jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, mb: 0.5 }, children: t('staff.bulk.changesTitle') }), _jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px', maxHeight: 300 }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('staff.bulk.employee') }), _jsx(TableCell, { children: t('staff.bulk.field') }), _jsx(TableCell, { children: t('staff.bulk.from') }), _jsx(TableCell, { children: t('staff.bulk.to') })] }) }), _jsx(TableBody, { children: result.items.map((c, i) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx("b", { children: c.name }), " \u00B7 ", _jsx("bdi", { children: c.employeeNo })] }), _jsx(TableCell, { children: field(c.field) }), _jsx(TableCell, { sx: { color: hr.textMuted }, children: _jsx("bdi", { children: c.from ?? '—' }) }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: _jsx("bdi", { children: c.to ?? '—' }) })] }, i))) })] }) })] })), result.changes === 0 && result.problems.length === 0 && _jsx(Typography, { sx: { fontSize: 13, color: hr.textMuted }, children: t('staff.bulk.nothing') })] }))] }), _jsxs(DialogActions, { sx: { px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }, children: [_jsx(Button, { variant: "contained", disabled: busy || !result || result.changes === 0, onClick: () => void apply(), children: result ? t('staff.bulk.apply', { count: result.changes }) : t('staff.bulk.applyNone') }), _jsx(Button, { disabled: busy, onClick: onClose, children: t('common.cancel') })] })] }) }));
}
