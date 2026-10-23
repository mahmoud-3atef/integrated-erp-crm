import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { documentsApi } from '../../api/documents';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
const ownerType = 'billing.timesheet';
const previewable = ['application/pdf', 'image/png', 'image/jpeg'];
/**
 * A timesheet's files with a glimpse of each (the old monthly timesheet page's «المرفقات», the user's request,
 * 2026-10-23): an image or the first page of a PDF, opened in full on a click, and a drop area to add one. The
 * preview is fetched by the page and shown from memory (a blob), so the file never needs to be served inline.
 */
export function TimesheetFiles({ timesheetId, canManage }) {
    const { t } = useTranslation();
    const input = useRef(null);
    const [items, setItems] = useState(null);
    const [busy, setBusy] = useState(false);
    const [drag, setDrag] = useState(false);
    const [error, setError] = useState(null);
    const load = useCallback(async () => {
        try {
            setItems(await documentsApi.attachments(ownerType, timesheetId));
        }
        catch (e) {
            setError(errorKey(e));
            setItems([]);
        }
    }, [timesheetId]);
    useEffect(() => void load(), [load]);
    const add = async (files) => {
        if (!files?.length)
            return;
        setBusy(true);
        setError(null);
        try {
            for (const file of Array.from(files)) {
                await documentsApi.upload({ ownerType, ownerId: timesheetId, documentType: 'OTHER', file, expiresOn: null, notes: '' });
            }
            await load();
        }
        catch (e) {
            setError(errorKey(e));
        }
        finally {
            setBusy(false);
            if (input.current)
                input.current.value = '';
        }
    };
    const remove = async (id) => {
        setError(null);
        try {
            await documentsApi.remove(id);
            await load();
        }
        catch (e) {
            setError(errorKey(e));
        }
    };
    return (_jsxs(Box, { sx: { display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0, height: '100%' }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: { width: 28, height: 28, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: '#FDF3E1', color: '#B7791F' }, children: _jsx(AttachFileIcon, { sx: { fontSize: 17 } }) }), _jsx(Typography, { sx: { fontSize: 14, fontWeight: 800, color: tokens.navy800 }, children: t('timesheets.files.title', { count: items?.length ?? 0 }) })] }), _jsx(ErrorMessage, { messageKey: error }), items === null ? (_jsx(Box, { sx: { display: 'grid', placeItems: 'center', py: 3 }, children: _jsx(CircularProgress, { size: 22 }) })) : (_jsxs(Box, { sx: { display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))' }, children: [items.map((a) => (_jsx(FileCard, { file: a, onRemove: canManage ? () => void remove(a.id) : undefined }, a.id))), items.length === 0 && !canManage && (_jsxs(Stack, { sx: { gridColumn: '1 / -1', alignItems: 'center', gap: 0.5, py: 2.5, color: tokens.gray500, fontSize: 12.5 }, children: [_jsx(FolderOpenOutlinedIcon, { sx: { color: tokens.gray300 } }), t('timesheets.files.none')] }))] })), canManage && (_jsxs(Box, { component: "label", onDragOver: (e) => (e.preventDefault(), setDrag(true)), onDragLeave: () => setDrag(false), onDrop: (e) => (e.preventDefault(), setDrag(false), void add(e.dataTransfer.files)), sx: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: '12px',
                    border: `1.5px dashed ${drag ? tokens.navy400 : tokens.gray300}`,
                    bgcolor: drag ? tokens.navy50 : '#FAFBFD',
                    cursor: busy ? 'progress' : 'pointer',
                    color: tokens.gray600,
                    fontSize: 12.5,
                    '&:focus-within': { outline: `2px solid ${tokens.navy400}`, outlineOffset: 2 },
                }, children: [_jsx("input", { ref: input, type: "file", multiple: true, hidden: true, accept: ".pdf,.png,.jpg,.jpeg,.docx,.xlsx", disabled: busy, onChange: (e) => void add(e.target.files) }), busy ? _jsx(CircularProgress, { size: 22 }) : _jsx(CloudUploadOutlinedIcon, { sx: { color: tokens.navy600, fontSize: 26 } }), _jsxs("span", { children: [_jsx(Box, { component: "strong", sx: { color: tokens.navy800, display: 'block' }, children: t('timesheets.files.add') }), t('timesheets.files.kinds')] })] }))] }));
}
/** One file: its glimpse (an image or a PDF's first page), its name, and download or remove. */
function FileCard({ file, onRemove }) {
    const { t } = useTranslation();
    const [url, setUrl] = useState(null);
    const canPreview = previewable.includes(file.contentType);
    useEffect(() => {
        if (!canPreview)
            return;
        let live = true;
        let made = null;
        fetch(documentsApi.contentUrl(file.id), { credentials: 'same-origin' })
            .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
            .then((blob) => {
            if (!live)
                return;
            made = URL.createObjectURL(new Blob([blob], { type: file.contentType }));
            setUrl(made);
        })
            .catch(() => undefined);
        return () => {
            live = false;
            if (made)
                URL.revokeObjectURL(made);
        };
    }, [file.id, file.contentType, canPreview]);
    const open = () => (url ? window.open(url, '_blank', 'noopener') : window.location.assign(documentsApi.contentUrl(file.id)));
    return (_jsxs(Box, { sx: { border: `1px solid ${tokens.gray100}`, borderRadius: '12px', overflow: 'hidden', bgcolor: '#fff', display: 'flex', flexDirection: 'column', minWidth: 0 }, children: [_jsxs(Box, { component: "button", type: "button", onClick: open, "aria-label": t('timesheets.files.open', { name: file.fileName }), sx: { height: 120, p: 0, border: 0, bgcolor: tokens.gray50, cursor: 'pointer', display: 'grid', placeItems: 'center', overflow: 'hidden', '&:focus-visible': { outline: `2px solid ${tokens.navy400}`, outlineOffset: -2 } }, children: [url && file.contentType === 'application/pdf' && (_jsx(Box, { component: "iframe", src: `${url}#toolbar=0&navpanes=0&view=FitH`, title: file.fileName, tabIndex: -1, sx: { width: '100%', height: '100%', border: 0, pointerEvents: 'none', bgcolor: '#fff' } })), url && file.contentType !== 'application/pdf' && _jsx(Box, { component: "img", src: url, alt: file.fileName, sx: { width: '100%', height: '100%', objectFit: 'cover' } }), !url && canPreview && _jsx(CircularProgress, { size: 20 }), !canPreview && _jsx(InsertDriveFileOutlinedIcon, { sx: { fontSize: 40, color: '#1d8d48' } })] }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderTop: `1px solid ${tokens.gray100}` }, children: [_jsx(Typography, { title: file.fileName, sx: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color: tokens.navy800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: _jsx("bdi", { children: file.fileName }) }), _jsx(Tooltip, { title: t('timesheets.files.download'), children: _jsx(IconButton, { size: "small", component: "a", href: documentsApi.contentUrl(file.id), download: true, sx: { p: 0.4 }, children: _jsx(FileDownloadOutlinedIcon, { sx: { fontSize: 17 } }) }) }), onRemove && (_jsx(Tooltip, { title: t('timesheets.files.remove'), children: _jsx(IconButton, { size: "small", onClick: onRemove, sx: { p: 0.4, color: tokens.danger }, children: _jsx(DeleteOutlinedIcon, { sx: { fontSize: 17 } }) }) }))] })] }));
}
