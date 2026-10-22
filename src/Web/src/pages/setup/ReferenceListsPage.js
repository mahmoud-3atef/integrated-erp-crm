import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryIcon from '@mui/icons-material/History';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { setupApi } from '../../api/setup';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HistoryDialog } from '../../components/HistoryDialog';
import { Badge, EmptyState, PageHeader, Panel, StatusDot } from '../../components/ui';
export function ReferenceListsPage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const navigate = useNavigate();
    const { list: selected } = useParams();
    const [lists, setLists] = useState([]);
    const [items, setItems] = useState([]);
    const [editing, setEditing] = useState(null);
    const [history, setHistory] = useState(null);
    const [error, setError] = useState(null);
    const canManage = can('organization.reference_data.manage', true);
    const current = lists.find((l) => l.code === selected);
    const loadLists = useCallback(async () => {
        try {
            setLists(await setupApi.referenceLists());
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    const loadItems = useCallback(async () => {
        if (!selected) {
            return;
        }
        try {
            setItems(await setupApi.items(selected));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [selected]);
    useEffect(() => {
        void loadLists();
    }, [loadLists]);
    useEffect(() => {
        // Open the first list when none is chosen.
        const first = lists[0];
        if (!selected && first) {
            navigate(`/setup/reference-lists/${first.code}`, { replace: true });
        }
    }, [selected, lists, navigate]);
    useEffect(() => {
        setItems([]);
        void loadItems();
    }, [loadItems]);
    const loadHistory = useCallback(() => setupApi.itemHistory(selected, history.id), [selected, history]);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('reference.title'), subtitle: t('reference.intro') }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' }, gap: `${tokens.gap}px`, alignItems: 'start' }, children: [_jsx(Panel, { padding: 1.25, children: _jsx(Stack, { component: "nav", "aria-label": t('reference.title'), spacing: 0.5, children: lists.map((list) => {
                                const active = list.code === selected;
                                return (_jsxs(ButtonBase, { onClick: () => navigate(`/setup/reference-lists/${list.code}`), "aria-current": active ? 'page' : undefined, sx: {
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        px: 1.75,
                                        py: 1.1,
                                        borderRadius: 999,
                                        fontSize: 13.5,
                                        fontWeight: active ? 700 : 500,
                                        color: active ? '#fff' : tokens.navy800,
                                        bgcolor: active ? tokens.navy700 : 'transparent',
                                        textAlign: 'start',
                                        '&:hover': { bgcolor: active ? tokens.navy700 : tokens.tint },
                                    }, children: [_jsx("span", { children: localName(list, i18n.language) }), _jsx(Box, { component: "span", sx: { minWidth: 24, px: 0.9, borderRadius: 999, fontSize: 11, fontWeight: 700, textAlign: 'center', bgcolor: active ? '#fff' : tokens.navy50, color: tokens.navy700 }, children: list.itemCount })] }, list.code));
                            }) }) }), _jsxs(Panel, { children: [current && (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 15, fontWeight: 700, color: tokens.navy800 }, children: localName(current, i18n.language) }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: i18n.language === 'ar' ? current.descriptionAr : current.descriptionEn })] }), canManage && (_jsx(Button, { variant: "contained", size: "small", startIcon: _jsx(AddIcon, {}), onClick: () => setEditing('new'), children: t('reference.newItem') }))] })), _jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('fields.Code') }), _jsx(TableCell, { children: t('fields.NameAr') }), _jsx(TableCell, { children: t('fields.NameEn') }), _jsx(TableCell, { children: t('fields.SortOrder') }), _jsx(TableCell, { children: t('common.status') }), _jsx(TableCell, { align: "center", children: t('common.actions') })] }) }), _jsx(TableBody, { children: items.map((item) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { sx: { fontWeight: 600, color: tokens.navy800, whiteSpace: 'nowrap' }, children: _jsxs(Stack, { direction: "row", spacing: 0.75, sx: { alignItems: 'center' }, children: [_jsx("span", { dir: "ltr", children: item.code }), item.isSystem && (_jsx(Tooltip, { title: t('reference.systemHint'), children: _jsx("span", { children: _jsx(Badge, { tone: "primary", icon: _jsx(LockOutlinedIcon, {}), children: t('reference.system') }) }) }))] }) }), _jsx(TableCell, { sx: { color: tokens.gray900 }, lang: "ar", dir: "rtl", children: item.nameAr }), _jsx(TableCell, { lang: "en", dir: "ltr", sx: { textAlign: 'start' }, children: item.nameEn }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums' }, children: item.sortOrder }), _jsx(TableCell, { children: _jsx(StatusDot, { tone: item.isActive ? 'success' : 'neutral', label: item.isActive ? t('common.active') : t('common.inactive') }) }), _jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [canManage && (_jsx(Tooltip, { title: t('common.edit'), children: _jsx(IconButton, { size: "small", onClick: () => setEditing(item), "aria-label": `${t('common.edit')} ${item.code}`, children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) })), _jsx(Tooltip, { title: t('history.title'), children: _jsx(IconButton, { size: "small", onClick: () => setHistory(item), "aria-label": `${t('history.title')} ${item.code}`, children: _jsx(HistoryIcon, { fontSize: "small" }) }) })] })] }, item.id))) })] }) }), items.length === 0 && _jsx(EmptyState, { text: t('reference.empty') })] })] }), editing && selected && (_jsx(ItemDialog, { list: selected, item: editing === 'new' ? null : editing, nextOrder: items.reduce((max, i) => Math.max(max, i.sortOrder), 0) + 1, onClose: () => setEditing(null), onSaved: () => {
                    setEditing(null);
                    void loadItems();
                    void loadLists();
                } })), history && _jsx(HistoryDialog, { title: history.code, load: loadHistory, onClose: () => setHistory(null) })] }));
}
function ItemDialog({ list, item, nextOrder, onClose, onSaved }) {
    const { t } = useTranslation();
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('sm'));
    const [code, setCode] = useState(item?.code ?? '');
    const [nameAr, setNameAr] = useState(item?.nameAr ?? '');
    const [nameEn, setNameEn] = useState(item?.nameEn ?? '');
    const [order, setOrder] = useState(String(item?.sortOrder ?? nextOrder));
    const [active, setActive] = useState(item?.isActive ?? true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const sortOrder = Number.parseInt(order, 10) || 0;
            await (item
                ? setupApi.updateItem(list, item.id, { nameAr, nameEn, sortOrder, isActive: active })
                : setupApi.createItem(list, { code, nameAr, nameEn, sortOrder }));
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", fullScreen: phone, children: [_jsx(DialogTitle, { children: item ? `${t('common.edit')} — ${item.code}` : t('reference.newItem') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [item ? (_jsx(TextField, { label: t('fields.Code'), value: item.code, disabled: true, helperText: t('reference.codeFixed'), slotProps: { htmlInput: { dir: 'ltr' } } })) : (_jsx(TextField, { label: t('fields.Code'), value: code, onChange: (e) => setCode(e.target.value), required: true, helperText: t('reference.codeHint'), slotProps: { htmlInput: { dir: 'ltr', maxLength: 30 } } })), _jsx(TextField, { label: t('fields.NameAr'), value: nameAr, onChange: (e) => setNameAr(e.target.value), required: true, slotProps: { htmlInput: { dir: 'rtl', lang: 'ar' } } }), _jsx(TextField, { label: t('fields.NameEn'), value: nameEn, onChange: (e) => setNameEn(e.target.value), required: true, slotProps: { htmlInput: { dir: 'ltr', lang: 'en' } } }), _jsx(TextField, { label: t('fields.SortOrder'), value: order, onChange: (e) => setOrder(e.target.value.replace(/\D/g, '').slice(0, 5)), slotProps: { htmlInput: { dir: 'ltr', inputMode: 'numeric' } } }), item && (_jsx(FormControlLabel, { control: _jsx(Switch, { checked: active, onChange: (e) => setActive(e.target.checked), disabled: item.isSystem }), label: item.isSystem ? t('reference.systemHint') : t('fields.IsActive') }))] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy || !nameAr.trim() || !nameEn.trim() || (!item && !code.trim()), children: busy ? t('common.loading') : t('common.save') })] })] }));
}
