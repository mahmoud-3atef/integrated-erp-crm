import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import { Alert, Box, Button, CircularProgress, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { costsApi } from '../../api/costs';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { Badge } from '../../components/ui';
import { CostDialog } from './SupplierCostsPage';
import { ExpensesPage } from '../expenses/ExpensesPage';
/** A worker's cost to the company: for a supplier's worker the agreed cost (its history), for the company's the salary. */
export function WorkerCostTab({ workerId, name }) {
    const { t, i18n } = useTranslation();
    const { can } = useSession();
    const ar = i18n.language === 'ar';
    const manage = can('workforce.costs.manage', true);
    const [cost, setCost] = useState(null);
    const [options, setOptions] = useState(null);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const money = (v) => (_jsxs(_Fragment, { children: [new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 2 }).format(v), _jsx(Box, { component: "small", sx: { fontSize: 12, fontWeight: 500, color: tokens.gray500, marginInlineStart: 0.5 }, children: t('workforce.sar') })] }));
    const load = useCallback(() => {
        costsApi.worker(workerId).then(setCost).catch((f) => setError(errorKey(f)));
    }, [workerId]);
    useEffect(() => {
        load();
        costsApi.options().then(setOptions).catch(() => undefined);
    }, [load]);
    if (!can('workforce.costs.view', true))
        return _jsx(Alert, { severity: "info", children: t('costs.noAccess') });
    if (!cost)
        return error ? _jsx(ErrorMessage, { messageKey: error }) : _jsx(CircularProgress, { size: 28, sx: { m: 3 } });
    const save = async () => {
        if (!editing)
            return;
        setBusy(true);
        setError(null);
        try {
            await costsApi.addCard(workerId, editing);
            setEditing(null);
            load();
        }
        catch (f) {
            setError(errorKey(f));
        }
        finally {
            setBusy(false);
        }
    };
    if (cost.source !== 'Supplier') {
        return (_jsxs(Stack, { spacing: 2, children: [_jsx(Alert, { severity: "info", children: t(cost.source === 'Company' ? 'costs.worker.company' : 'costs.worker.unknown') }), _jsx(FieldSection, { title: t('costs.worker.companyCost'), icon: _jsx(PaidOutlinedIcon, {}), children: _jsx(FieldBox, { label: t('costs.worker.salary'), icon: _jsx(PaidOutlinedIcon, {}), children: cost.salary !== null ? money(cost.salary) : '—' }) }), _jsx(FieldSection, { title: t('costs.worker.expenses'), icon: _jsx(RuleOutlinedIcon, {}), columns: 1, children: _jsx(ExpensesPage, { workerId: workerId, compact: true }) })] }));
    }
    return (_jsxs(Box, { children: [_jsx(ErrorMessage, { messageKey: editing ? null : error }), manage && (_jsx(Stack, { direction: "row", sx: { justifyContent: 'flex-end', mb: 2 }, children: _jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setEditing({ supplier: cost.supplier, professionCode: null, nationalityCode: null, monthlyCost: cost.monthlyCost ?? 0, method: cost.method ?? 'MonthlyFixed', effectiveFrom: `${new Date().toISOString().slice(0, 7)}-01`, notes: null }), children: t('costs.worker.newCard') }) })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }, children: [_jsxs(FieldSection, { title: t('costs.worker.current'), icon: _jsx(PaidOutlinedIcon, {}), tone: "gold", children: [_jsx(FieldBox, { label: t('costs.col.supplier'), icon: _jsx(LocalShippingOutlinedIcon, {}), children: _jsx("bdi", { children: cost.supplier }) }), _jsx(FieldBox, { label: t('costs.col.cost'), icon: _jsx(PaidOutlinedIcon, {}), highlight: true, children: cost.monthlyCost !== null ? money(cost.monthlyCost) : _jsx(Badge, { tone: "danger", children: t('costs.source.none') }) }), _jsx(FieldBox, { label: t('costs.col.method'), icon: _jsx(RuleOutlinedIcon, {}), children: cost.method ? t(`costs.method.${cost.method}`) : '—' }), _jsx(FieldBox, { label: t('costs.col.from'), icon: _jsx(CalendarMonthOutlinedIcon, {}), children: _jsx("bdi", { children: cost.effectiveFrom?.replaceAll('-', '/') ?? '—' }) }), _jsx(FieldBox, { label: t('costs.col.source'), icon: _jsx(Inventory2OutlinedIcon, {}), wide: true, children: cost.costSource === 'Card'
                                    ? t('costs.source.Card')
                                    : cost.package
                                        ? t('costs.worker.fromPackage', {
                                            supplier: cost.package.supplier,
                                            profession: cost.package.professionCode ? (ar ? cost.package.professionAr : cost.package.professionEn) : t('costs.any'),
                                            nationality: cost.package.nationalityCode ? (ar ? cost.package.nationalityAr : cost.package.nationalityEn) : t('costs.any'),
                                        })
                                        : t('costs.worker.noneHint') })] }), _jsx(FieldSection, { title: t('costs.worker.history', { count: cost.cards.length }), icon: _jsx(CalendarMonthOutlinedIcon, {}), columns: 1, children: cost.cards.length === 0 ? (_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray500 }, children: t('costs.worker.noCards') })) : (_jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('costs.col.from') }), _jsx(TableCell, { children: t('costs.col.cost') }), _jsx(TableCell, { children: t('costs.col.method') }), _jsx(TableCell, { children: t('costs.worker.by') }), manage && _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: cost.cards.map((c) => (_jsxs(TableRow, { sx: c.current ? { bgcolor: '#FFFBEB' } : undefined, children: [_jsxs(TableCell, { children: [_jsx("bdi", { children: c.effectiveFrom.replaceAll('-', '/') }), " ", c.current && _jsx(Badge, { tone: "success", children: t('costs.worker.currentBadge') })] }), _jsx(TableCell, { sx: { fontWeight: 800 }, children: money(c.monthlyCost) }), _jsx(TableCell, { children: t(`costs.method.${c.method}`) }), _jsxs(TableCell, { sx: { fontSize: 12 }, children: [c.createdBy, c.notes && _jsx(Box, { sx: { color: tokens.gray500 }, children: c.notes })] }), manage && (_jsx(TableCell, { children: _jsx(IconButton, { size: "small", "aria-label": t('costs.worker.deleteCard'), onClick: () => window.confirm(t('costs.worker.deleteConfirm')) && costsApi.deleteCard(workerId, c.id).then(load).catch((f) => setError(errorKey(f))), children: _jsx(DeleteOutlineOutlinedIcon, { fontSize: "small" }) }) }))] }, c.id))) })] })) })] }), _jsx(Box, { sx: { mt: 2.5 }, children: _jsx(FieldSection, { title: t('costs.worker.expenses'), icon: _jsx(RuleOutlinedIcon, {}), columns: 1, children: _jsx(ExpensesPage, { workerId: workerId, compact: true }) }) }), editing && (_jsx(CostDialog, { title: t('costs.cardTitle', { name }), input: editing, options: options, package: false, error: error, busy: busy, onChange: setEditing, onClose: () => { setEditing(null); setError(null); }, onSave: save }))] }));
}
