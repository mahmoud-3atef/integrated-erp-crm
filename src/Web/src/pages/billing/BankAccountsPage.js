import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { receivablesApi } from '../../api/billing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader } from '../../components/ui';
const empty = { bankName: '', accountNo: '', iban: '', label: '', isActive: true };
/** The company's bank accounts that receive the customers' payments (chosen on each receipt voucher). */
export function BankAccountsPage() {
    const { t } = useTranslation();
    const { can } = useSession();
    const canManage = can('billing.bank_accounts.manage', true);
    const [list, setList] = useState(null);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const reload = useCallback(async () => {
        try {
            setList(await receivablesApi.bankAccounts());
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);
    const save = async () => {
        if (!editing)
            return;
        setBusy(true);
        setError(null);
        try {
            const input = { ...editing.input, iban: editing.input.iban || null, label: editing.input.label || null };
            if (editing.id)
                await receivablesApi.saveBankAccount(editing.id, input);
            else
                await receivablesApi.addBankAccount(input);
            setEditing(null);
            await reload();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const field = (key, label, ltr = false) => (_jsx(TextField, { label: label, value: editing?.input[key] ?? '', onChange: (e) => editing && setEditing({ ...editing, input: { ...editing.input, [key]: e.target.value } }), required: key === 'bankName' || key === 'accountNo', slotProps: { htmlInput: ltr ? { dir: 'ltr' } : undefined } }));
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('bankAccounts.title'), subtitle: t('bankAccounts.intro'), actions: canManage ? (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setEditing({ id: null, input: empty }), children: t('bankAccounts.add') })) : undefined }), _jsx(ErrorMessage, { messageKey: editing ? null : error }), _jsx(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('bankAccounts.label') }), _jsx(TableCell, { children: t('bankAccounts.bank') }), _jsx(TableCell, { children: t('bankAccounts.accountNo') }), _jsx(TableCell, { children: t('bankAccounts.iban') }), _jsx(TableCell, { children: t('bankAccounts.status') }), canManage && _jsx(TableCell, {})] }) }), _jsxs(TableBody, { children: [list?.map((a) => (_jsxs(TableRow, { hover: true, children: [_jsx(TableCell, { sx: { fontWeight: 700, color: tokens.navy800 }, children: a.display }), _jsx(TableCell, { children: a.bankName }), _jsx(TableCell, { dir: "ltr", sx: { textAlign: 'start' }, children: a.accountNo }), _jsx(TableCell, { dir: "ltr", sx: { textAlign: 'start' }, children: a.iban ?? '—' }), _jsx(TableCell, { children: _jsx(Badge, { tone: a.isActive ? 'success' : 'neutral', children: a.isActive ? t('bankAccounts.active') : t('bankAccounts.inactive') }) }), canManage && (_jsx(TableCell, { align: "left", children: _jsx(IconButton, { size: "small", onClick: () => setEditing({ id: a.id, input: { bankName: a.bankName, accountNo: a.accountNo, iban: a.iban ?? '', label: a.label ?? '', isActive: a.isActive } }), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) }))] }, a.id))), list && list.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('bankAccounts.empty') }) }))] })] }) }) }), editing && (_jsxs(Dialog, { open: true, onClose: () => setEditing(null), fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: editing.id ? t('bankAccounts.edit') : t('bankAccounts.add') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [field('bankName', t('bankAccounts.bank')), field('accountNo', t('bankAccounts.accountNo'), true), field('iban', t('bankAccounts.iban'), true), field('label', t('bankAccounts.labelHint')), _jsx(FormControlLabel, { control: _jsx(Switch, { checked: editing.input.isActive, onChange: (e) => setEditing({ ...editing, input: { ...editing.input, isActive: e.target.checked } }) }), label: t('bankAccounts.active') })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setEditing(null), children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !editing.input.bankName.trim() || !editing.input.accountNo.trim(), onClick: () => void save(), children: t('common.save') })] })] }))] }));
}
