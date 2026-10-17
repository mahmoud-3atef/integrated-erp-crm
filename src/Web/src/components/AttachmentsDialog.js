import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme, } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../api/access';
import { errorKey } from '../api/auth';
import { acceptedFiles, documentsApi } from '../api/documents';
import { tokens } from '../app/theme';
import { ErrorMessage } from '../auth/AuthLayout';
import { Badge, EmptyState } from './ui';
const today = () => new Date().toISOString().slice(0, 10);
/** Files on one record: list, download, and (with the record's manage permission) upload and remove. */
export function AttachmentsDialog({ title, ownerType, ownerId, canManage, onClose }) {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('sm'));
    const fileInput = useRef(null);
    const [items, setItems] = useState([]);
    const [types, setTypes] = useState([]);
    const [type, setType] = useState('');
    const [file, setFile] = useState(null);
    const [expiresOn, setExpiresOn] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const load = useCallback(async () => {
        try {
            setItems(await documentsApi.attachments(ownerType, ownerId));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [ownerType, ownerId]);
    useEffect(() => {
        void load();
        documentsApi
            .documentTypes()
            .then((list) => {
            setTypes(list);
            setType((current) => current || list[0]?.code || '');
        })
            .catch((failure) => setError(errorKey(failure)));
    }, [load]);
    const typeName = (code) => {
        const found = types.find((x) => x.code === code);
        return found ? localName(found, i18n.language) : code;
    };
    const size = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
    const date = (value) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    const submit = async () => {
        if (!file) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await documentsApi.upload({ ownerType, ownerId, documentType: type, file, expiresOn: expiresOn || null, notes });
            setFile(null);
            setExpiresOn('');
            setNotes('');
            if (fileInput.current) {
                fileInput.current.value = '';
            }
            await load();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const remove = async (item) => {
        if (!window.confirm(t('attachments.confirmRemove', { name: item.fileName }))) {
            return;
        }
        try {
            await documentsApi.remove(item.id);
            await load();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "md", fullScreen: phone, children: [_jsxs(DialogTitle, { sx: { display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(AttachFileIcon, { sx: { color: tokens.navy700 } }), t('attachments.title'), " \u2014 ", title] }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), canManage && (_jsxs(Box, { sx: { p: 2, mb: 2, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px dashed ${tokens.gray300}` }, children: [_jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 1.5, sx: { mb: 1.5 }, children: [_jsx(TextField, { select: true, size: "small", label: t('attachments.type'), value: type, onChange: (e) => setType(e.target.value), sx: { flex: 1 }, children: types.map((x) => (_jsx(MenuItem, { value: x.code, children: localName(x, i18n.language) }, x.code))) }), _jsx(TextField, { size: "small", type: "date", label: t('attachments.expiresOn'), value: expiresOn, onChange: (e) => setExpiresOn(e.target.value), sx: { flex: 1 }, slotProps: { inputLabel: { shrink: true }, htmlInput: { min: today() } } })] }), _jsx(TextField, { size: "small", label: t('attachments.notes'), value: notes, onChange: (e) => setNotes(e.target.value), sx: { mb: 1.5 }, slotProps: { htmlInput: { maxLength: 500 } } }), _jsxs(Stack, { direction: "row", spacing: 1.5, sx: { alignItems: 'center', flexWrap: 'wrap', gap: 1 }, children: [_jsxs(Button, { variant: "outlined", component: "label", startIcon: _jsx(UploadFileIcon, {}), children: [t('attachments.choose'), _jsx("input", { ref: fileInput, hidden: true, type: "file", accept: acceptedFiles, onChange: (e) => setFile(e.target.files?.[0] ?? null) })] }), _jsx(Typography, { sx: { flex: 1, minWidth: 120, fontSize: 13, color: file ? tokens.gray900 : tokens.gray500 }, noWrap: true, children: file ? `${file.name} (${size(file.size)})` : t('attachments.allowed') }), _jsx(Button, { variant: "contained", onClick: () => void submit(), disabled: busy || !file || !type, children: busy ? t('common.loading') : t('attachments.upload') })] })] })), _jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('attachments.file') }), _jsx(TableCell, { children: t('attachments.type') }), _jsx(TableCell, { children: t('attachments.expiresOn') }), _jsx(TableCell, { children: t('attachments.uploaded') }), _jsx(TableCell, { align: "center", children: t('common.actions') })] }) }), _jsx(TableBody, { children: items.map((item) => {
                                        const expired = item.expiresOn !== null && item.expiresOn < today();
                                        return (_jsxs(TableRow, { hover: true, children: [_jsxs(TableCell, { sx: { maxWidth: 260 }, children: [_jsx(Typography, { noWrap: true, sx: { fontSize: 13, fontWeight: 500, color: tokens.gray900 }, title: item.fileName, children: item.fileName }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: size(item.size) })] }), _jsx(TableCell, { children: typeName(item.documentType) }), _jsx(TableCell, { children: item.expiresOn ? _jsx(Badge, { tone: expired ? 'danger' : 'neutral', children: expired ? t('attachments.expired') : date(item.expiresOn) }) : '—' }), _jsxs(TableCell, { children: [_jsx(Typography, { sx: { fontSize: 12.5 }, children: item.uploadedBy }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: date(item.uploadedAt) })] }), _jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [_jsx(Tooltip, { title: t('attachments.download'), children: _jsx(IconButton, { size: "small", component: "a", href: documentsApi.contentUrl(item.id), "aria-label": `${t('attachments.download')} ${item.fileName}`, children: _jsx(DownloadIcon, { fontSize: "small" }) }) }), canManage && (_jsx(Tooltip, { title: t('attachments.remove'), children: _jsx(IconButton, { size: "small", onClick: () => void remove(item), "aria-label": `${t('attachments.remove')} ${item.fileName}`, children: _jsx(DeleteOutlinedIcon, { fontSize: "small" }) }) }))] })] }, item.id));
                                    }) })] }) }), items.length === 0 && _jsx(EmptyState, { text: t('attachments.empty') })] }), _jsx(DialogActions, { children: _jsx(Button, { onClick: onClose, children: t('common.close') }) })] }));
}
