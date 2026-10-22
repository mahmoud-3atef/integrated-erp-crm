import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workflowApi } from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { statusTone } from '../../components/ApprovalTimeline';
import { Badge, EmptyState, PageHeader, Panel, PillTabs, StatusDot } from '../../components/ui';
const decisionTone = { Approved: 'success', Rejected: 'danger', Returned: 'warning', Delegated: 'neutral' };
export function useDates() {
    const { i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
    return {
        dateTime: (v) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(v)),
        date: (v) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(v)),
    };
}
/** Tasks waiting for the current user (and those already decided), like CRM approval tasks. */
export function InboxPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { dateTime } = useDates();
    const ar = i18n.language === 'ar';
    const [scope, setScope] = useState('pending');
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);
    const load = useCallback(async () => {
        try {
            setItems(await workflowApi.inbox(scope));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [scope]);
    useEffect(() => {
        void load();
    }, [load]);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('tasks.title'), subtitle: t('tasks.intro') }), _jsx(PillTabs, { value: scope, onChange: setScope, options: [{ value: 'pending', label: t('tasks.pending') }, { value: 'done', label: t('tasks.done') }] }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Panel, { children: [_jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('tasks.document') }), _jsx(TableCell, { children: t('tasks.stage') }), _jsx(TableCell, { children: t('tasks.submittedBy') }), _jsx(TableCell, { children: scope === 'pending' ? t('tasks.due') : t('tasks.decision') }), _jsx(TableCell, { align: "center", children: t('common.actions') })] }) }), _jsx(TableBody, { children: items.map((item) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(item.link ?? `/workflow/approvals/${item.instanceId}`), children: [_jsxs(TableCell, { sx: { whiteSpace: 'normal', minWidth: 220 }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: ar ? item.screenNameAr : item.screenNameEn }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 600, color: tokens.gray900 }, children: item.title })] }), _jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("span", { children: ar ? item.stepNameAr : item.stepNameEn }), item.isDelegated && _jsx(Badge, { tone: "neutral", children: t('tasks.delegatedToMe') })] }) }), _jsxs(TableCell, { children: [item.submittedBy, _jsx(Box, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: dateTime(item.submittedAt) })] }), _jsx(TableCell, { children: scope === 'pending' ? (item.dueAt ? _jsx(Badge, { tone: item.isOverdue ? 'danger' : 'neutral', children: item.isOverdue ? t('tasks.overdue') : dateTime(item.dueAt) }) : '—') : (_jsxs(Stack, { spacing: 0.25, children: [_jsx("span", { children: _jsx(Badge, { tone: decisionTone[item.status] ?? 'neutral', children: t(`approval.decided.${item.status}`) }) }), item.decidedAt && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: dateTime(item.decidedAt) })] })) }), _jsx(TableCell, { align: "center", children: _jsx(Tooltip, { title: t('tasks.open'), children: _jsx(IconButton, { size: "small", "aria-label": `${t('tasks.open')} ${item.title}`, children: _jsx(OpenInNewIcon, { fontSize: "small" }) }) }) })] }, item.id))) })] }) }), items.length === 0 && _jsx(EmptyState, { text: scope === 'pending' ? t('tasks.emptyPending') : t('tasks.emptyDone') })] })] }));
}
/** A list of approvals: the user's own requests, or all of the company for monitoring. */
export function InstancesTable({ rows, empty }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { dateTime } = useDates();
    const ar = i18n.language === 'ar';
    return (_jsxs(Panel, { children: [_jsx(TableContainer, { sx: { borderRadius: '6px' }, children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('tasks.document') }), _jsx(TableCell, { children: t('process.process') }), _jsx(TableCell, { children: t('tasks.submittedBy') }), _jsx(TableCell, { children: t('common.status') })] }) }), _jsx(TableBody, { children: rows.map((row) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(row.link ?? `/workflow/approvals/${row.id}`), children: [_jsxs(TableCell, { sx: { whiteSpace: 'normal', minWidth: 220 }, children: [_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: ar ? row.screenNameAr : row.screenNameEn }), _jsx(Typography, { sx: { fontSize: 13, fontWeight: 600, color: tokens.gray900 }, children: row.title })] }), _jsxs(TableCell, { children: [ar ? row.processNameAr : row.processNameEn, _jsx(Box, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t('routes.version', { version: row.version }) })] }), _jsxs(TableCell, { children: [row.submittedBy, _jsx(Box, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: dateTime(row.submittedAt) })] }), _jsxs(TableCell, { children: [_jsx(StatusDot, { tone: statusTone[row.status] ?? 'neutral', label: t(`approval.instance.${row.status}`) }), row.status === 'InProgress' && (ar ? row.waitingStepAr : row.waitingStepEn) && (_jsx(Box, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: ar ? row.waitingStepAr : row.waitingStepEn }))] })] }, row.id))) })] }) }), rows.length === 0 && _jsx(EmptyState, { text: empty })] }));
}
export function MyApprovalsPage() {
    const { t } = useTranslation();
    const [rows, setRows] = useState([]);
    const [error, setError] = useState(null);
    useEffect(() => {
        workflowApi.myRequests().then(setRows).catch((failure) => setError(errorKey(failure)));
    }, []);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('myApprovals.title'), subtitle: t('myApprovals.intro') }), _jsx(ErrorMessage, { messageKey: error }), _jsx(InstancesTable, { rows: rows, empty: t('myApprovals.empty') })] }));
}
const monitorStatuses = ['', 'InProgress', 'Failed', 'Approved', 'Rejected', 'Returned', 'Canceled'];
export function MonitorPage() {
    const { t } = useTranslation();
    const [status, setStatus] = useState('');
    const [rows, setRows] = useState([]);
    const [error, setError] = useState(null);
    useEffect(() => {
        workflowApi.instances(status).then(setRows).catch((failure) => setError(errorKey(failure)));
    }, [status]);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('monitor.title'), subtitle: t('monitor.intro') }), _jsx(PillTabs, { value: status, onChange: setStatus, options: monitorStatuses.map((s) => ({ value: s, label: s ? t(`approval.instance.${s}`) : t('monitor.all') })) }), _jsx(ErrorMessage, { messageKey: error }), _jsx(InstancesTable, { rows: rows, empty: t('myApprovals.empty') })] }));
}
