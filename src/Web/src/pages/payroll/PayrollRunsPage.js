import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import { Box, Button, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { payrollApi } from '../../api/payroll';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrEmptyState, HrPageHeader, HrScope, hr, hrCard } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { money, RunStatusBadge, useMonthName } from './payroll';
import { NewRunDialog, SponsorsDialog, useLegalEntities } from './RunDialogs';
/** The payroll runs of the company's workers, latest first, by commercial registration. */
export function PayrollRunsPage({ creating = false } = {}) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const monthName = useMonthName();
    const entities = useLegalEntities();
    const [entity, setEntity] = useState('');
    const [runs, setRuns] = useState(null);
    const [error, setError] = useState(null);
    const [newRun, setNewRun] = useState(creating);
    const [sponsors, setSponsors] = useState(false);
    const canManage = can('payroll.workers.manage', true);
    const reload = useCallback(async () => {
        try {
            setRuns(await payrollApi.runs(entity || undefined));
            setError(null);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [entity]);
    useEffect(() => {
        void reload();
    }, [reload]);
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(RequestQuoteOutlinedIcon, {}), title: t('payroll.title'), subtitle: t('payroll.intro'), actions: _jsxs(_Fragment, { children: [can('payroll.settings.manage', true) && (_jsx(Button, { variant: "outlined", startIcon: _jsx(LinkOutlinedIcon, {}), onClick: () => setSponsors(true), children: t('payroll.sponsors') })), canManage && (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setNewRun(true), children: t('payroll.new') }))] }) }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { ...hrCard, p: 2 }, children: [_jsx(Stack, { direction: "row", sx: { mb: 1.5, gap: 1 }, children: _jsxs(TextField, { select: true, size: "small", label: t('payroll.cols.legalEntity'), value: entity, onChange: (e) => setEntity(e.target.value), sx: { width: 300 }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('payroll.all') }), entities.map((e) => (_jsx(MenuItem, { value: e.id, children: localName(e, i18n.language) }, e.id)))] }) }), runs === null ? (_jsx(LinearProgress, {})) : runs.length === 0 ? (_jsx(HrEmptyState, { icon: _jsx(RequestQuoteOutlinedIcon, {}), title: t('payroll.empty'), hint: t('payroll.emptyHint'), action: canManage && (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setNewRun(true), children: t('payroll.new') })) })) : (_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& th': { bgcolor: hr.muted, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }, '& td': { height: 46 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('payroll.cols.run') }), _jsx(TableCell, { children: t('payroll.cols.legalEntity') }), _jsx(TableCell, { children: t('payroll.cols.period') }), _jsx(TableCell, { align: "right", children: t('payroll.cols.workers') }), _jsx(TableCell, { align: "right", children: t('payroll.cols.excluded') }), _jsx(TableCell, { align: "right", children: t('payroll.cols.net') }), _jsx(TableCell, { children: t('payroll.cols.status') })] }) }), _jsx(TableBody, { children: runs.map((r) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/payroll/runs/${r.id}`), children: [_jsxs(TableCell, { children: [_jsx(Box, { sx: { fontWeight: 700, color: hr.text }, children: monthName(r.to) }), _jsx(Box, { component: "bdi", sx: { fontSize: 12, color: hr.textMuted, fontVariantNumeric: 'tabular-nums' }, children: r.runNo })] }), _jsx(TableCell, { children: r.legalEntityName }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: _jsxs("bdi", { children: [date(r.from), " \u2013 ", date(r.to)] }) }), _jsx(TableCell, { align: "right", sx: { fontVariantNumeric: 'tabular-nums' }, children: r.workers.toLocaleString('en-US') }), _jsx(TableCell, { align: "right", sx: { fontVariantNumeric: 'tabular-nums', color: r.excluded ? '#B45309' : hr.textMuted }, children: r.excluded.toLocaleString('en-US') }), _jsx(TableCell, { align: "right", sx: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' }, children: money(r.net) }), _jsx(TableCell, { children: _jsx(RunStatusBadge, { status: r.status }) })] }, r.id))) })] }) }))] }), _jsx(NewRunDialog, { open: newRun, defaultEntity: entity || undefined, onClose: () => {
                    setNewRun(false);
                    if (creating)
                        navigate('/payroll/runs');
                }, onCreated: (id) => navigate(`/payroll/runs/${id}`), onLinkSponsors: () => setSponsors(true) }), _jsx(SponsorsDialog, { open: sponsors, onClose: () => setSponsors(false) })] }));
}
