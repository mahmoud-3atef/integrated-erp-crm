import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workflowApi } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { EmptyState, PageHeader, Panel, PillTabs, StatusDot } from '../../components/ui';
export const requestTone = {
    Draft: 'neutral',
    InApproval: 'info',
    UnderReview: 'info',
    OnHold: 'warning',
    Approved: 'success',
    Rejected: 'danger',
    Returned: 'warning',
    Canceled: 'neutral',
};
export function RequestsPage() {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const navigate = useNavigate();
    const [scope, setScope] = useState('mine');
    const [rows, setRows] = useState([]);
    const [error, setError] = useState(null);
    const canCreate = can('workflow.requests.create');
    const canSeeAll = can('workflow.requests.view');
    const load = useCallback(async () => {
        try {
            setRows(await workflowApi.requests(scope === 'all'));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [scope]);
    useEffect(() => {
        void load();
    }, [load]);
    const date = (value) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    const money = (value) => new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('requests.title'), subtitle: t('requests.intro'), actions: canCreate && (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => navigate('/workflow/requests/new'), children: t('requests.new') })) }), canSeeAll && (_jsx(PillTabs, { value: scope, onChange: setScope, options: [
                    { value: 'mine', label: t('requests.mine') },
                    { value: 'all', label: t('requests.all') },
                ] })), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Panel, { children: [_jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('requests.number') }), _jsx(TableCell, { children: t('requests.subject') }), _jsx(TableCell, { children: t('requests.amount') }), _jsx(TableCell, { children: t('requests.createdBy') }), _jsx(TableCell, { children: t('common.status') }), _jsx(TableCell, { align: "center", children: t('common.actions') })] }) }), _jsx(TableBody, { children: rows.map((row) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workflow/requests/${row.id}`), children: [_jsx(TableCell, { sx: { fontWeight: 600, color: tokens.navy800 }, dir: "ltr", children: row.number }), _jsx(TableCell, { sx: { color: tokens.gray900, whiteSpace: 'normal', minWidth: 200 }, children: row.subject }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums' }, children: row.amount === null ? '—' : money(row.amount) }), _jsxs(TableCell, { children: [row.createdByName, _jsx(Box, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: date(row.createdAt) })] }), _jsx(TableCell, { children: _jsx(StatusDot, { tone: requestTone[row.status], label: t(`requests.status.${row.status}`) }) }), _jsx(TableCell, { align: "center", children: _jsx(Tooltip, { title: t('tasks.open'), children: _jsx(IconButton, { size: "small", "aria-label": `${t('tasks.open')} ${row.number}`, children: _jsx(OpenInNewIcon, { fontSize: "small" }) }) }) })] }, row.id))) })] }) }), rows.length === 0 && _jsx(EmptyState, { text: t('requests.empty') })] })] }));
}
