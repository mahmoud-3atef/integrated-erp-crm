import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, } from '@mui/material';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey, upload } from '../../api/auth';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { sar } from '../operations/delivery';
/**
 * Uploads the filled-in timesheet file: first a preview (its problems, or the changes it makes), then — when it has
 * no problem — applying it. Nothing is saved before the confirmation.
 */
export function ExcelUploadDialog({ timesheetId, onClose, onApplied }) {
    const { t } = useTranslation();
    const input = useRef(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const send = async (path, chosen) => {
        const form = new FormData();
        form.append('file', chosen);
        return upload(`/api/v1/billing/timesheets/${timesheetId}/excel/${path}`, form);
    };
    const choose = async (chosen) => {
        if (!chosen)
            return;
        setFile(chosen);
        setPreview(null);
        setBusy(true);
        setError(null);
        try {
            setPreview(await send('preview', chosen));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const apply = async () => {
        setBusy(true);
        setError(null);
        try {
            const result = await send('apply', file);
            if (result.problems.length > 0) {
                setPreview(result);
            }
            else {
                onApplied();
            }
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const ok = preview && preview.problems.length === 0;
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "md", children: [_jsx(DialogTitle, { children: t('timesheets.excel.uploadTitle') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsx(Typography, { sx: { fontSize: 13, color: tokens.gray600, mb: 2 }, children: t('timesheets.excel.uploadHint') }), _jsx("input", { ref: input, type: "file", accept: ".xlsx", hidden: true, onChange: (e) => void choose(e.target.files?.[0]) }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.5, mb: 2 }, children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(UploadFileOutlinedIcon, {}), disabled: busy, onClick: () => (input.current && ((input.current.value = ''), input.current.click())), children: file ? t('timesheets.excel.chooseOther') : t('timesheets.excel.choose') }), file && _jsx(Typography, { sx: { fontSize: 13, color: tokens.navy800, fontWeight: 700 }, children: file.name })] }), busy && _jsx(LinearProgress, { sx: { mb: 2, borderRadius: 2 } }), preview && preview.problems.length > 0 && (_jsxs(_Fragment, { children: [_jsx(Alert, { severity: "error", icon: _jsx(ErrorOutlineIcon, {}), sx: { mb: 1.5 }, children: t('timesheets.excel.problems', { count: preview.problems.length }) }), _jsx(TableContainer, { sx: { maxHeight: 320 }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('timesheets.excel.row') }), _jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('timesheets.excel.problem') })] }) }), _jsx(TableBody, { children: preview.problems.map((p, n) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: p.row > 0 ? p.row : '—' }), _jsx(TableCell, { dir: "ltr", sx: { textAlign: 'start' }, children: p.workerNo ?? '—' }), _jsx(TableCell, { sx: { color: tokens.danger }, children: t(`timesheets.excel.codes.${p.code}`) })] }, n))) })] }) })] })), ok && (_jsxs(_Fragment, { children: [_jsx(Alert, { severity: preview.changes.length > 0 ? 'success' : 'info', icon: _jsx(CheckCircleOutlineIcon, {}), sx: { mb: 1.5 }, children: preview.changes.length > 0 ? t('timesheets.excel.ready', { rows: preview.rows, count: preview.changes.length }) : t('timesheets.excel.noChanges', { rows: preview.rows }) }), preview.changes.length > 0 && (_jsx(TableContainer, { sx: { maxHeight: 360 }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('timesheets.adjustmentType') }), _jsx(TableCell, { align: "center", children: t('timesheets.excel.current') }), _jsx(TableCell, { align: "center", children: t('timesheets.excel.uploaded') }), _jsx(TableCell, { children: t('timesheets.reason') })] }) }), _jsx(TableBody, { children: preview.changes.map((c, n) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 12.5, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: c.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11, color: tokens.gray500, textAlign: 'start' }, children: c.workerNo })] }), _jsx(TableCell, { children: t(`timesheets.adjustments.${c.type}`) }), _jsx(TableCell, { align: "center", sx: { color: tokens.gray500 }, children: sar(c.current) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800, color: tokens.navy800 }, children: sar(c.uploaded) }), _jsx(TableCell, { sx: { fontSize: 12.5 }, children: c.reason })] }, n))) })] }) }))] })), !preview && !busy && (_jsx(Box, { sx: { p: 3, textAlign: 'center', borderRadius: `${tokens.radius}px`, border: `2px dashed ${tokens.gray200}`, color: tokens.gray500, fontSize: 13 }, children: t('timesheets.excel.empty') }))] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.close') }), _jsx(Button, { variant: "contained", disabled: busy || !ok || preview.changes.length === 0, onClick: () => void apply(), children: t('timesheets.excel.apply') })] })] }));
}
