import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import HistoryIcon from '@mui/icons-material/History';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, useMediaQuery, useTheme, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { setupApi } from '../../api/setup';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { AttachmentsDialog } from '../../components/AttachmentsDialog';
import { HistoryDialog } from '../../components/HistoryDialog';
import { EmptyState, PageHeader, Panel, StatusDot } from '../../components/ui';
const allEntities = 'all';
export function BranchesPage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const [rows, setRows] = useState([]);
    const [entities, setEntities] = useState([]);
    const [editing, setEditing] = useState(null);
    const [history, setHistory] = useState(null);
    const [files, setFiles] = useState(null);
    const [error, setError] = useState(null);
    const canManage = can('organization.branches.manage', true);
    const load = useCallback(async () => {
        try {
            const [b, e] = await Promise.all([setupApi.branches(), can('organization.legal_entities.view') ? setupApi.legalEntities() : Promise.resolve([])]);
            setRows(b);
            setEntities(e);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [can]);
    useEffect(() => {
        void load();
    }, [load]);
    const entityLabel = (id) => {
        if (!id) {
            return t('users.allEntities');
        }
        const entity = entities.find((e) => e.id === id);
        return entity ? `${entity.code} — ${localName(entity, i18n.language)}` : '…';
    };
    const loadHistory = useCallback(() => setupApi.branchHistory(history.id), [history]);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('branches.title'), subtitle: t('branches.intro'), actions: canManage && (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setEditing('new'), children: t('branches.new') })) }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Panel, { children: [_jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('fields.Code') }), _jsx(TableCell, { children: t('branches.name') }), _jsx(TableCell, { children: t('fields.LegalEntityId') }), _jsx(TableCell, { children: t('fields.City') }), _jsx(TableCell, { children: t('common.status') }), _jsx(TableCell, { align: "center", children: t('common.actions') })] }) }), _jsx(TableBody, { children: rows.map((row) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { sx: { fontWeight: 600, color: tokens.navy800 }, dir: "ltr", children: row.code }), _jsx(TableCell, { sx: { color: tokens.gray900 }, children: localName(row, i18n.language) }), _jsx(TableCell, { children: entityLabel(row.legalEntityId) }), _jsx(TableCell, { children: row.city ?? '—' }), _jsx(TableCell, { children: _jsx(StatusDot, { tone: row.isActive ? 'success' : 'neutral', label: row.isActive ? t('common.active') : t('common.inactive') }) }), _jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [canManage && (_jsx(Tooltip, { title: t('common.edit'), children: _jsx(IconButton, { size: "small", onClick: () => setEditing(row), "aria-label": `${t('common.edit')} ${row.code}`, children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) })), _jsx(Tooltip, { title: t('attachments.title'), children: _jsx(IconButton, { size: "small", onClick: () => setFiles(row), "aria-label": `${t('attachments.title')} ${row.code}`, children: _jsx(AttachFileIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: t('history.title'), children: _jsx(IconButton, { size: "small", onClick: () => setHistory(row), "aria-label": `${t('history.title')} ${row.code}`, children: _jsx(HistoryIcon, { fontSize: "small" }) }) })] })] }, row.id))) })] }) }), rows.length === 0 && _jsx(EmptyState, { text: t('common.empty') })] }), editing && (_jsx(BranchDialog, { branch: editing === 'new' ? null : editing, entities: entities, onClose: () => setEditing(null), onSaved: () => {
                    setEditing(null);
                    void load();
                } })), files && (_jsx(AttachmentsDialog, { title: files.code, ownerType: "organization.branch", ownerId: files.id, canManage: canManage, onClose: () => setFiles(null) })), history && (_jsx(HistoryDialog, { title: history.code, load: loadHistory, formatValue: (field, value) => (field === 'LegalEntityId' ? entityLabel(String(value)) : null), onClose: () => setHistory(null) }))] }));
}
function BranchDialog({ branch, entities, onClose, onSaved }) {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('sm'));
    const [code, setCode] = useState(branch?.code ?? '');
    const [nameAr, setNameAr] = useState(branch?.nameAr ?? '');
    const [nameEn, setNameEn] = useState(branch?.nameEn ?? '');
    const [entity, setEntity] = useState(branch?.legalEntityId ?? allEntities);
    const [city, setCity] = useState(branch?.city ?? '');
    const [active, setActive] = useState(branch?.isActive ?? true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const details = { nameAr, nameEn, legalEntityId: entity === allEntities ? null : entity, city: city.trim() || null, isActive: active };
            await (branch ? setupApi.updateBranch(branch.id, details) : setupApi.createBranch({ code, ...details }));
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", fullScreen: phone, children: [_jsx(DialogTitle, { children: branch ? `${t('common.edit')} — ${branch.code}` : t('branches.new') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [branch ? (_jsx(TextField, { label: t('fields.Code'), value: branch.code, disabled: true, helperText: t('legalEntities.codeFixed'), slotProps: { htmlInput: { dir: 'ltr' } } })) : (_jsx(TextField, { label: t('fields.Code'), value: code, onChange: (e) => setCode(e.target.value), required: true, helperText: t('branches.codeHint'), slotProps: { htmlInput: { dir: 'ltr', maxLength: 30 } } })), _jsx(TextField, { label: t('fields.NameAr'), value: nameAr, onChange: (e) => setNameAr(e.target.value), required: true, slotProps: { htmlInput: { dir: 'rtl', lang: 'ar' } } }), _jsx(TextField, { label: t('fields.NameEn'), value: nameEn, onChange: (e) => setNameEn(e.target.value), required: true, slotProps: { htmlInput: { dir: 'ltr', lang: 'en' } } }), _jsxs(TextField, { select: true, label: t('fields.LegalEntityId'), value: entity, onChange: (e) => setEntity(e.target.value), children: [_jsx(MenuItem, { value: allEntities, children: t('users.allEntities') }), entities.map((e) => (_jsx(MenuItem, { value: e.id, children: `${e.code} — ${localName(e, i18n.language)}` }, e.id)))] }), _jsx(TextField, { label: t('fields.City'), value: city, onChange: (e) => setCity(e.target.value), slotProps: { htmlInput: { maxLength: 100 } } }), branch && _jsx(FormControlLabel, { control: _jsx(Switch, { checked: active, onChange: (e) => setActive(e.target.checked) }), label: t('fields.IsActive') })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy || !nameAr.trim() || !nameEn.trim() || (!branch && !code.trim()), children: busy ? t('common.loading') : t('common.save') })] })] }));
}
