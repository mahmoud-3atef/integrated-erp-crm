import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accessApi, localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
const tone = { new: 'info', member: 'neutral', not_found: 'danger', added: 'success', failed: 'danger' };
/**
 * «إضافة مجموعة مستخدمين» (the user's request, 2026-10-23: the old system's users): the names from an Excel list or
 * typed one per line, then a preview — who is in the directory, who is already a member — where any can be left out,
 * then adding the chosen ones at once, each with the chosen role (read only by default) for all registrations.
 */
export function BulkMembersDialog({ roles, onClose, onDone }) {
    const { t, i18n } = useTranslation();
    const input = useRef(null);
    const [text, setText] = useState('');
    const [roleId, setRoleId] = useState(() => roles.find((r) => r.kind === 'ReadOnly')?.id ?? '');
    const [preview, setPreview] = useState(null);
    const [chosen, setChosen] = useState(new Set());
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const names = () => text.split(/[\r\n,;]+/).map((n) => n.trim()).filter(Boolean);
    const act = async (work) => {
        setBusy(true);
        setError(null);
        try {
            await work();
        }
        catch (e) {
            setError(errorKey(e));
        }
        finally {
            setBusy(false);
        }
    };
    const readFile = (file) => file &&
        act(async () => {
            setText((await accessApi.readUserNames(file)).join('\n'));
            setPreview(null);
        });
    const check = () => act(async () => {
        const rows = await accessApi.bulkPreview(names(), roleId || null);
        setPreview(rows);
        setChosen(new Set(rows.filter((r) => r.outcome !== 'not_found').map((r) => r.userName)));
    });
    const add = () => act(async () => {
        setResult(await accessApi.bulkAdd([...chosen], roleId || null));
        onDone();
    });
    const rows = result ?? preview;
    const toggle = (name) => setChosen((s) => {
        const next = new Set(s);
        if (next.has(name))
            next.delete(name);
        else
            next.add(name);
        return next;
    });
    return (_jsxs(Dialog, { open: true, onClose: busy ? undefined : onClose, fullWidth: true, maxWidth: "md", "aria-labelledby": "bulk-title", children: [_jsx(DialogTitle, { id: "bulk-title", children: t('users.bulk.title') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), !rows && (_jsxs(Stack, { sx: { gap: 1.5 }, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray600 }, children: t('users.bulk.intro') }), _jsx("input", { ref: input, type: "file", accept: ".xlsx", hidden: true, onChange: (e) => void readFile(e.target.files?.[0]) }), _jsx(Box, { children: _jsx(Button, { variant: "outlined", startIcon: _jsx(UploadFileOutlinedIcon, {}), disabled: busy, onClick: () => (input.current && ((input.current.value = ''), input.current.click())), children: t('users.bulk.file') }) }), _jsx(TextField, { label: t('users.bulk.names'), value: text, onChange: (e) => setText(e.target.value), multiline: true, minRows: 6, maxRows: 12, helperText: t('users.bulk.namesHint', { count: names().length }), slotProps: { htmlInput: { dir: 'ltr' } } }), _jsxs(TextField, { select: true, label: t('users.bulk.role'), value: roleId, onChange: (e) => setRoleId(e.target.value), helperText: t('users.bulk.roleHint'), children: [_jsx(MenuItem, { value: "", children: t('users.bulk.noRole') }), roles
                                        .filter((r) => r.isActive)
                                        .map((r) => (_jsx(MenuItem, { value: r.id, children: localName(r, i18n.language) }, r.id)))] })] })), busy && _jsx(LinearProgress, { sx: { my: 1.5, borderRadius: 2 } }), rows && (_jsxs(_Fragment, { children: [_jsx(Alert, { severity: result ? 'success' : 'info', sx: { mb: 1.5 }, children: result
                                    ? t('users.bulk.done', { added: result.filter((r) => r.outcome === 'added').length, member: result.filter((r) => r.outcome === 'member').length, failed: result.filter((r) => r.outcome === 'not_found' || r.outcome === 'failed').length })
                                    : t('users.bulk.previewHint', { count: chosen.size, role: localName(roles.find((r) => r.id === roleId) ?? { nameAr: t('users.bulk.noRole'), nameEn: t('users.bulk.noRole') }, i18n.language) }) }), _jsx(TableContainer, { sx: { maxHeight: 420, border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px` }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [!result && _jsx(TableCell, { padding: "checkbox" }), _jsx(TableCell, { children: t('users.bulk.userName') }), _jsx(TableCell, { children: t('users.bulk.name') }), _jsx(TableCell, { children: t('users.bulk.email') }), _jsx(TableCell, { children: t('users.bulk.outcome') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, children: [!result && (_jsx(TableCell, { padding: "checkbox", children: _jsx(Checkbox, { size: "small", checked: chosen.has(r.userName), disabled: r.outcome === 'not_found', onChange: () => toggle(r.userName), slotProps: { input: { 'aria-label': r.userName } } }) })), _jsx(TableCell, { children: _jsx("bdi", { children: r.userName }) }), _jsx(TableCell, { children: r.displayName ?? '—' }), _jsx(TableCell, { children: _jsx("bdi", { children: r.email ?? '—' }) }), _jsx(TableCell, { children: _jsx(Badge, { tone: tone[r.outcome], children: t(`users.bulk.outcomes.${r.outcome}`) }) })] }, r.userName))) })] }) })] }))] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, disabled: busy, children: result ? t('common.close') : t('common.cancel') }), preview && !result && (_jsx(Button, { onClick: () => setPreview(null), disabled: busy, children: t('users.bulk.back') })), !rows && (_jsx(Button, { variant: "contained", disabled: busy || names().length === 0, onClick: () => void check(), children: t('users.bulk.check') })), preview && !result && (_jsx(Button, { variant: "contained", disabled: busy || chosen.size === 0, onClick: () => void add(), children: t('users.bulk.add', { count: chosen.size }) }))] })] }));
}
