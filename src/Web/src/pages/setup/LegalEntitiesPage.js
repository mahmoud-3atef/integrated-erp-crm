import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import HistoryIcon from '@mui/icons-material/History';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, useMediaQuery, useTheme, } from '@mui/material';
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
export function LegalEntitiesPage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const [rows, setRows] = useState([]);
    const [editing, setEditing] = useState(null);
    const [history, setHistory] = useState(null);
    const [files, setFiles] = useState(null);
    const [error, setError] = useState(null);
    const canManage = can('organization.legal_entities.manage', true);
    const load = useCallback(async () => {
        try {
            setRows(await setupApi.legalEntities());
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const loadHistory = useCallback(() => setupApi.legalEntityHistory(history.id), [history]);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('legalEntities.title'), subtitle: t('legalEntities.intro'), actions: canManage && (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setEditing('new'), children: t('legalEntities.new') })) }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Panel, { children: [_jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('fields.Code') }), _jsx(TableCell, { children: t('legalEntities.name') }), _jsx(TableCell, { children: t('fields.CommercialRegistrationNo') }), _jsx(TableCell, { children: t('fields.VatNumber') }), _jsx(TableCell, { children: t('common.status') }), _jsx(TableCell, { align: "center", children: t('common.actions') })] }) }), _jsx(TableBody, { children: rows.map((row) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { sx: { fontWeight: 600, color: tokens.navy800 }, dir: "ltr", children: row.code }), _jsx(TableCell, { sx: { color: tokens.gray900 }, children: localName(row, i18n.language) }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums' }, children: row.commercialRegistrationNo }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums' }, children: row.vatNumber ?? '—' }), _jsx(TableCell, { children: _jsx(StatusDot, { tone: row.isActive ? 'success' : 'neutral', label: row.isActive ? t('common.active') : t('common.inactive') }) }), _jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [canManage && (_jsx(Tooltip, { title: t('common.edit'), children: _jsx(IconButton, { size: "small", onClick: () => setEditing(row), "aria-label": `${t('common.edit')} ${row.code}`, children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) })), _jsx(Tooltip, { title: t('attachments.title'), children: _jsx(IconButton, { size: "small", onClick: () => setFiles(row), "aria-label": `${t('attachments.title')} ${row.code}`, children: _jsx(AttachFileIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: t('history.title'), children: _jsx(IconButton, { size: "small", onClick: () => setHistory(row), "aria-label": `${t('history.title')} ${row.code}`, children: _jsx(HistoryIcon, { fontSize: "small" }) }) })] })] }, row.id))) })] }) }), rows.length === 0 && _jsx(EmptyState, { text: t('common.empty') })] }), editing && (_jsx(LegalEntityDialog, { entity: editing === 'new' ? null : editing, onClose: () => setEditing(null), onSaved: () => {
                    setEditing(null);
                    void load();
                } })), files && (_jsx(AttachmentsDialog, { title: files.code, ownerType: "organization.legal_entity", ownerId: files.id, canManage: canManage, onClose: () => setFiles(null) })), history && _jsx(HistoryDialog, { title: history.code, load: loadHistory, onClose: () => setHistory(null) })] }));
}
function LegalEntityDialog({ entity, onClose, onSaved }) {
    const { t } = useTranslation();
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('sm'));
    const [code, setCode] = useState(entity?.code ?? '');
    const [nameAr, setNameAr] = useState(entity?.nameAr ?? '');
    const [nameEn, setNameEn] = useState(entity?.nameEn ?? '');
    const [cr, setCr] = useState(entity?.commercialRegistrationNo ?? '');
    const [vat, setVat] = useState(entity?.vatNumber ?? '');
    const [active, setActive] = useState(entity?.isActive ?? true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const details = { nameAr, nameEn, commercialRegistrationNo: cr, vatNumber: vat.trim() || null };
            await (entity ? setupApi.updateLegalEntity(entity.id, { ...details, isActive: active }) : setupApi.createLegalEntity({ code, ...details }));
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const digits = (value, max) => value.replace(/\D/g, '').slice(0, max);
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", fullScreen: phone, children: [_jsx(DialogTitle, { children: entity ? `${t('common.edit')} — ${entity.code}` : t('legalEntities.new') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [entity ? (_jsx(TextField, { label: t('fields.Code'), value: entity.code, disabled: true, helperText: t('legalEntities.codeFixed'), slotProps: { htmlInput: { dir: 'ltr' } } })) : (_jsx(TextField, { label: t('fields.Code'), value: code, onChange: (e) => setCode(e.target.value), required: true, helperText: t('legalEntities.codeHint'), slotProps: { htmlInput: { dir: 'ltr', maxLength: 30 } } })), _jsx(TextField, { label: t('fields.NameAr'), value: nameAr, onChange: (e) => setNameAr(e.target.value), required: true, slotProps: { htmlInput: { dir: 'rtl', lang: 'ar' } } }), _jsx(TextField, { label: t('fields.NameEn'), value: nameEn, onChange: (e) => setNameEn(e.target.value), required: true, slotProps: { htmlInput: { dir: 'ltr', lang: 'en' } } }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 2, children: [_jsx(TextField, { label: t('fields.CommercialRegistrationNo'), value: cr, onChange: (e) => setCr(digits(e.target.value, 10)), required: true, helperText: t('legalEntities.crHint'), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'numeric' } } }), _jsx(TextField, { label: t('fields.VatNumber'), value: vat, onChange: (e) => setVat(digits(e.target.value, 15)), helperText: t('legalEntities.vatHint'), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'numeric' } } })] }), entity && _jsx(FormControlLabel, { control: _jsx(Switch, { checked: active, onChange: (e) => setActive(e.target.checked) }), label: t('fields.IsActive') })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy || !nameAr.trim() || !nameEn.trim() || cr.length !== 10 || (!entity && !code.trim()), children: busy ? t('common.loading') : t('common.save') })] })] }));
}
