import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, Checkbox, InputAdornment, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { operationsApi } from '../../api/operations';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PillTabs } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from './delivery';
/**
 * The workers that can be put on an order, listed at once: filter by text (or several numbers), status (or current
 * project), profession and nationality; a ticked worker is on the order (untick to take them off). By default the workers that can be
 * delivered (in housing or new); with <c>onJob</c> the workers on the job (for a transfer), where those already on
 * <c>targetProjectCrmId</c> cannot be picked.
 */
export function AvailableWorkers({ orderId, onOrder, onToggle, onJob, targetProjectCrmId, }) {
    const { t } = useTranslation();
    const { ar, date } = useCommercialFormat();
    const [workers, setWorkers] = useState(null);
    const [error, setError] = useState(null);
    const [text, setText] = useState('');
    const [place, setPlace] = useState('all');
    const [profession, setProfession] = useState('');
    const [nationality, setNationality] = useState('');
    const [project, setProject] = useState('');
    useEffect(() => {
        (onJob ? onJob.load(orderId) : operationsApi.availableWorkers(orderId))
            .then(setWorkers)
            .catch((failure) => setError(errorKey(failure)));
        // The loader is fixed for the form's lifetime.
    }, [orderId]);
    const name = (a, e) => (ar ? a : e) ?? '—';
    const options = (key) => {
        const counts = new Map();
        for (const w of workers ?? []) {
            const [code, a, e] = key(w);
            const id = code ?? '';
            const entry = counts.get(id) ?? { label: code ? name(a, e) : '—', count: 0 };
            entry.count++;
            counts.set(id, entry);
        }
        return [...counts.entries()].sort((x, y) => y[1].count - x[1].count);
    };
    const professions = options((w) => [w.worker.professionCode, w.worker.professionAr, w.worker.professionEn]);
    const nationalities = options((w) => [w.worker.nationalityCode, w.worker.nationalityAr, w.worker.nationalityEn]);
    const projects = options((w) => [w.worker.projectCrmId, w.worker.projectName, w.worker.projectName]);
    const shown = useMemo(() => {
        const tokens = text.split(/[\s,،;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
        return (workers ?? []).filter(({ worker: w }) => {
            if (place !== 'all' && w.placement !== place)
                return false;
            if (profession && (w.professionCode ?? '') !== profession)
                return false;
            if (nationality && (w.nationalityCode ?? '') !== nationality)
                return false;
            if (project && (w.projectCrmId ?? '') !== project)
                return false;
            if (tokens.length > 1)
                return tokens.includes(w.workerNo.toUpperCase()) || (!!w.iqamaNo && tokens.includes(w.iqamaNo.toUpperCase()));
            if (tokens.length === 1) {
                const q = tokens[0];
                return [w.workerNo, w.name, w.iqamaNo, w.professionAr, w.professionEn, w.nationalityAr, w.nationalityEn].some((v) => v?.toUpperCase().includes(q));
            }
            return true;
        });
    }, [workers, text, place, profession, nationality, project]);
    const onTarget = (w) => !!targetProjectCrmId && w.projectCrmId === targetProjectCrmId;
    const selectable = shown.filter((w) => !w.busyOrderNo && !onTarget(w.worker));
    const allPicked = selectable.length > 0 && selectable.every((w) => onOrder.includes(w.worker.id));
    const counts = { all: workers?.length ?? 0, Housing: workers?.filter((w) => w.worker.placement === 'Housing').length ?? 0, New: workers?.filter((w) => w.worker.placement === 'New').length ?? 0 };
    const filtered = text || place !== 'all' || profession || nationality || project;
    return (_jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 0.5, color: tokens.navy800, '& svg': { color: tokens.navy700 } }, children: [_jsx(GroupAddOutlinedIcon, {}), _jsx(Typography, { sx: { fontSize: 16, fontWeight: 800, flex: 1 }, children: t(onJob?.titleKey ?? 'operations.delivery.available.title', { count: counts.all }) })] }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500, mb: 2 }, children: t(onJob?.hintKey ?? 'operations.delivery.availableHint') }), _jsx(ErrorMessage, { messageKey: error }), !onJob && (_jsx(PillTabs, { value: place, onChange: setPlace, options: [
                    { value: 'all', label: t('operations.delivery.available.all', { count: counts.all }) },
                    { value: 'Housing', label: t('operations.delivery.available.housing', { count: counts.Housing }) },
                    { value: 'New', label: t('operations.delivery.available.new', { count: counts.New }) },
                ] })), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, mb: 1.5 }, children: [_jsx(TextField, { size: "small", sx: { flex: 2 }, placeholder: t('operations.delivery.workerSearch'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsxs(TextField, { select: true, size: "small", sx: { flex: 1, minWidth: 180 }, label: t('workforce.col.profession'), value: profession, onChange: (e) => setProfession(e.target.value), children: [_jsx(MenuItem, { value: "", children: t('operations.delivery.available.any') }), professions.map(([code, o]) => (_jsxs(MenuItem, { value: code, children: [o.label, " (", o.count, ")"] }, code || 'none')))] }), _jsxs(TextField, { select: true, size: "small", sx: { flex: 1, minWidth: 180 }, label: t('workforce.col.nationality'), value: nationality, onChange: (e) => setNationality(e.target.value), children: [_jsx(MenuItem, { value: "", children: t('operations.delivery.available.any') }), nationalities.map(([code, o]) => (_jsxs(MenuItem, { value: code, children: [o.label, " (", o.count, ")"] }, code || 'none')))] }), onJob && (_jsxs(TextField, { select: true, size: "small", sx: { flex: 1, minWidth: 200 }, label: t('operations.transfer.currentProject'), value: project, onChange: (e) => setProject(e.target.value), children: [_jsx(MenuItem, { value: "", children: t('operations.delivery.available.any') }), projects.map(([code, o]) => (_jsxs(MenuItem, { value: code, children: [o.label, " (", o.count, ")"] }, code || 'none')))] })), filtered && (_jsx(Button, { startIcon: _jsx(FilterAltOffOutlinedIcon, {}), onClick: () => (setText(''), setPlace('all'), setProfession(''), setNationality(''), setProject('')), children: t('workforce.reset') }))] }), !workers && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { sx: { maxHeight: 440, border: `1px solid ${tokens.navy50}`, borderRadius: `${tokens.radius}px` }, children: _jsxs(Table, { size: "small", stickyHeader: true, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { padding: "checkbox", children: _jsx(Checkbox, { checked: allPicked, indeterminate: !allPicked && selectable.some((w) => onOrder.includes(w.worker.id)), disabled: selectable.length === 0, onChange: (e) => onToggle(selectable.map((w) => w.worker), e.target.checked) }) }), _jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('operations.delivery.col.iqama') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { children: t('workforce.col.status') }), _jsx(TableCell, { children: t(onJob ? 'operations.transfer.currentProject' : 'operations.delivery.available.lastProject') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.salary') })] }) }), _jsxs(TableBody, { children: [shown.map(({ worker: w, busyOrderNo }) => {
                                    const added = onOrder.includes(w.id);
                                    const already = onTarget(w);
                                    const disabled = (!!busyOrderNo || already) && !added;
                                    return (_jsxs(TableRow, { hover: !disabled, selected: added, sx: { cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }, onClick: () => !disabled && onToggle([w], !added), children: [_jsx(TableCell, { padding: "checkbox", children: _jsx(Checkbox, { checked: added, disabled: disabled }) }), _jsxs(TableCell, { sx: { minWidth: 190 }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: w.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: w.workerNo })] }), _jsx(TableCell, { dir: "ltr", children: w.iqamaNo ?? '—' }), _jsxs(TableCell, { children: [name(w.professionAr, w.professionEn), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: name(w.nationalityAr, w.nationalityEn) })] }), _jsx(TableCell, { children: added ? (_jsx(Badge, { tone: "primary", children: t('operations.delivery.available.added') })) : busyOrderNo ? (_jsx(Badge, { tone: "warning", children: t('operations.delivery.busy', { no: busyOrderNo }) })) : already ? (_jsx(Badge, { tone: "neutral", children: t('operations.transfer.alreadyThere') })) : (_jsx(Badge, { tone: w.placement === 'New' ? 'info' : 'success', children: (ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`) })) }), _jsxs(TableCell, { children: [w.projectName ?? '—', onJob && w.projectJoinedOn && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t('operations.transfer.since', { date: date(w.projectJoinedOn) }) })] }), _jsx(TableCell, { align: "center", children: sar(w.totalSalary) })] }, w.id));
                                }), workers && shown.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, align: "center", sx: { py: 4, color: tokens.gray500 }, children: t('operations.delivery.noWorkersFound') }) }))] })] }) }), _jsx(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.5, mt: 1.5 }, children: _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('operations.delivery.available.shown', { shown: shown.length, all: counts.all }) }) })] }));
}
