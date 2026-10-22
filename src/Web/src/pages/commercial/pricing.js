import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, Radio, RadioGroup, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme, } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
import { useCommercialFormat } from './ProjectsPage';
import { DateField } from '../../components/DateField';
const statusTone = { Package: 'success', Special: 'warning', NoPackage: 'info', Missing: 'danger' };
export const money = (value) => value === null || value === undefined ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
/** "Housing 200 · Transport 100" under a price, when the price has those parts. */
function PriceParts({ housing, transport }) {
    const { t } = useTranslation();
    const parts = [housing ? `${t('commercial.prices.col.housing')} ${money(housing)}` : null, transport ? `${t('commercial.prices.col.transport')} ${money(transport)}` : null].filter(Boolean);
    return parts.length ? _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, whiteSpace: 'nowrap' }, children: parts.join(' · ') }) : null;
}
/** Profession over nationality, in one cell. */
function Who({ profession, nationality }) {
    return (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600, color: tokens.navy800 }, children: profession ?? '—' }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: nationality ?? '—' })] }));
}
function PackageState({ row }) {
    const { t } = useTranslation();
    const now = today();
    const [tone, key] = !row.isActive
        ? ['neutral', 'stopped']
        : row.isCurrent
            ? ['success', 'current']
            : row.validFrom > now
                ? ['info', 'upcoming']
                : ['neutral', 'ended'];
    return _jsx(Badge, { tone: tone, children: t(`commercial.prices.state.${key}`) });
}
/** The price packages: who they price, the amounts, validity and the workers on them; edit and stop when allowed. */
export function PackagesTable({ rows, showProject, onEdit, onToggle, }) {
    const { t } = useTranslation();
    const { ar, date } = useCommercialFormat();
    return (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('commercial.prices.col.package') }), showProject && _jsx(TableCell, { children: t('commercial.prices.col.scope') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.salary') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.serviceFee') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.total') }), _jsx(TableCell, { children: t('commercial.prices.col.validity') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.onPackage') }), _jsx(TableCell, { children: t('commercial.prices.col.state') }), (onEdit || onToggle) && _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, sx: { opacity: r.isActive ? 1 : 0.6 }, children: [_jsx(TableCell, { dir: "ltr", sx: { fontWeight: 700, color: tokens.navy800, textAlign: 'start', whiteSpace: 'nowrap' }, children: r.packageNo }), showProject && (_jsx(TableCell, { sx: { minWidth: 150, maxWidth: 220 }, children: r.projectId ? (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: r.projectName }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: r.customerName ?? t('commercial.noCustomer') })] })) : (_jsx(Badge, { tone: "primary", children: t('commercial.prices.general') })) })), _jsx(TableCell, { children: _jsx(Who, { profession: ar ? r.professionAr : r.professionEn, nationality: (ar ? r.nationalityAr : r.nationalityEn) ?? t('commercial.prices.anyNationality') }) }), _jsx(TableCell, { align: "center", children: money(r.salary) }), _jsx(TableCell, { align: "center", children: money(r.serviceFee) }), _jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [_jsx(Typography, { component: "span", sx: { fontWeight: 800, color: tokens.navy800 }, children: money(r.totalPrice) }), _jsx(PriceParts, { housing: r.housing, transport: r.transport })] }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap', fontSize: 12.5 }, children: [date(r.validFrom), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: r.validTo ? `← ${date(r.validTo)}` : t('commercial.prices.openEnded') })] }), _jsx(TableCell, { align: "center", children: r.workers > 0 ? _jsx(Badge, { tone: "success", children: r.workers }) : '—' }), _jsx(TableCell, { children: _jsx(PackageState, { row: r }) }), (onEdit || onToggle) && (_jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [onEdit && (_jsx(Tooltip, { title: t('common.edit'), children: _jsx(IconButton, { size: "small", onClick: () => onEdit(r), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) })), onToggle && (_jsx(Tooltip, { title: t(r.isActive ? 'commercial.prices.stop' : 'commercial.prices.activate'), children: _jsx(IconButton, { size: "small", onClick: () => onToggle(r), children: r.isActive ? _jsx(PauseCircleOutlineIcon, { fontSize: "small" }) : _jsx(PlayCircleOutlineIcon, { fontSize: "small" }) }) }))] }))] }, r.id))) })] }) }));
}
/** Packages suggested from the old system's prices, with "create package" (prefilled) when no package covers them yet. */
export function SuggestionsTable({ rows, showProject, onCreate }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { ar } = useCommercialFormat();
    return (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [showProject && _jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.currentPrice') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.salary') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.atPrice') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.otherPrices') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.missing') }), _jsx(TableCell, { children: t('commercial.prices.col.state') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: true, children: [showProject && (_jsxs(TableCell, { sx: { minWidth: 200, cursor: 'pointer' }, onClick: () => navigate(`/commercial/projects/${r.projectId}?tab=packages`), children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: r.projectName }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: r.customerName ?? t('commercial.noCustomer') })] })), _jsx(TableCell, { children: _jsx(Who, { profession: ar ? r.professionAr : r.professionEn, nationality: ar ? r.nationalityAr : r.nationalityEn }) }), _jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [_jsx(Typography, { component: "span", sx: { fontWeight: 800, color: tokens.navy800 }, children: r.feeAboveSalary !== null ? t('commercial.prices.salaryPlus', { fee: money(r.feeAboveSalary) }) : money(r.totalPrice) }), _jsx(PriceParts, { housing: r.housing, transport: r.transport })] }), _jsx(TableCell, { align: "center", children: money(r.salary) }), _jsx(TableCell, { align: "center", children: _jsx(Badge, { tone: "success", children: r.workers }) }), _jsx(TableCell, { align: "center", children: r.otherPrices > 0 ? _jsx(Badge, { tone: "warning", children: r.otherPrices }) : '—' }), _jsx(TableCell, { align: "center", children: r.withoutPrice > 0 ? _jsx(Badge, { tone: "danger", children: r.withoutPrice }) : '—' }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: r.coveredByNo ? (_jsx(Badge, { tone: "success", children: t('commercial.prices.coveredBy', { no: r.coveredByNo }) })) : onCreate && r.professionCode ? (_jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(AddIcon, {}), onClick: () => onCreate(r), children: t('commercial.prices.createFromSuggestion') })) : (_jsx(Badge, { tone: "neutral", children: t('commercial.prices.noPackageYet') })) })] }, r.id))) })] }) }));
}
/** Workers' current prices in the old system (as its "تحديث سعر الخدمة" page), compared with the package that applies to them. */
export function WorkerPricesTable({ rows, showProject }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { ar, date } = useCommercialFormat();
    return (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), showProject && _jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.salary') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.servicePrice') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.packagePrice') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.difference') }), _jsx(TableCell, { children: t('commercial.prices.col.state') }), _jsx(TableCell, { children: t('commercial.prices.col.workStart') })] }) }), _jsx(TableBody, { children: rows.map((w) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${w.workerId}`), children: [_jsxs(TableCell, { sx: { minWidth: 180 }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: w.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: w.workerNo })] }), showProject && _jsx(TableCell, { sx: { minWidth: 180 }, children: w.projectName }), _jsx(TableCell, { children: _jsx(Who, { profession: ar ? w.professionAr : w.professionEn, nationality: ar ? w.nationalityAr : w.nationalityEn }) }), _jsx(TableCell, { align: "center", children: money(w.salary) }), _jsxs(TableCell, { align: "center", sx: { fontWeight: 800, color: tokens.navy800 }, children: [w.fromWorkerDefault ? (_jsx(Tooltip, { title: t('commercial.prices.fromWorkerDefault'), children: _jsx(Box, { component: "span", sx: { borderBottom: `1px dashed ${tokens.gray500}` }, children: money(w.servicePrice) }) })) : (money(w.servicePrice)), _jsx(PriceParts, { housing: w.housing, transport: w.transport })] }), _jsxs(TableCell, { align: "center", children: [money(w.packagePrice), w.packageNo && (_jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500 }, children: w.packageNo }))] }), _jsx(TableCell, { align: "center", dir: "ltr", sx: { fontWeight: 700, color: !w.difference ? tokens.gray500 : w.difference > 0 ? '#1f9d55' : tokens.danger }, children: w.difference ? `${w.difference > 0 ? '+' : ''}${money(w.difference)}` : '—' }), _jsx(TableCell, { children: _jsx(Badge, { tone: statusTone[w.status], children: t(`commercial.prices.status.${w.status}`) }) }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 12.5, textAlign: 'start' }, children: w.workStartNo ?? '—' }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: date(w.startedOn) })] })] }, w.id))) })] }) }));
}
/** A new package's amounts from a suggestion: the old price split into salary, fee, housing and transport. */
export function draftFromSuggestion(s) {
    const above = s.feeAboveSalary ?? s.totalPrice - s.salary;
    return {
        projectId: s.projectId,
        professionCode: s.professionCode,
        nationalityCode: s.nationalityCode,
        salary: s.salary,
        serviceFee: Math.max(0, above - s.housing - s.transport),
        housing: s.housing,
        transport: s.transport,
    };
}
const optionLabel = (ar) => (o) => `${ar ? o.nameAr : o.nameEn}${o.code ? ` (${o.code})` : ''}`;
/** Add or edit a package: who it prices (project or general, profession, nationality or any), its amounts and validity. */
export function PackageDialog({ package: edited, draft, onClose, onSaved }) {
    const { t } = useTranslation();
    const { ar } = useCommercialFormat();
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('sm'));
    const [options, setOptions] = useState(null);
    const [found, setFound] = useState([]);
    const [general, setGeneral] = useState(edited ? edited.projectId === null : draft ? !draft.projectId : false);
    const [projectId, setProjectId] = useState(edited?.projectId ?? draft?.projectId ?? null);
    const [profession, setProfession] = useState(edited?.professionCode ?? draft?.professionCode ?? null);
    const [nationality, setNationality] = useState(edited?.nationalityCode ?? draft?.nationalityCode ?? null);
    const [salary, setSalary] = useState(String(edited?.salary ?? draft?.salary ?? ''));
    const [fee, setFee] = useState(String(edited?.serviceFee ?? draft?.serviceFee ?? ''));
    const [housing, setHousing] = useState(String(edited?.housing ?? draft?.housing ?? 0));
    const [housingBillable, setHousingBillable] = useState(edited?.housingBillable ?? false);
    const [transport, setTransport] = useState(String(edited?.transport ?? draft?.transport ?? 0));
    const [transportBillable, setTransportBillable] = useState(edited?.transportBillable ?? false);
    const [validFrom, setValidFrom] = useState(edited?.validFrom ?? today());
    const [validTo, setValidTo] = useState(edited?.validTo ?? '');
    const [notes, setNotes] = useState(edited?.notes ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        commercialApi.priceOptions().then(setOptions).catch((failure) => setError(errorKey(failure)));
    }, []);
    const num = (value) => (value.trim() === '' ? 0 : Number(value));
    const total = num(salary) + num(fee) + num(housing) + num(transport);
    const professions = useMemo(() => {
        const all = [...(options?.professions ?? []), ...found];
        return all.filter((o, i) => all.findIndex((x) => x.code === o.code) === i);
    }, [options, found]);
    const project = options?.projects.find((p) => p.id === projectId) ?? null;
    const valid = !!profession && (general || !!projectId) && total > 0 && [salary, fee, housing, transport].every((v) => num(v) >= 0 && !Number.isNaN(num(v)));
    const save = async () => {
        setBusy(true);
        setError(null);
        const input = {
            projectId: general ? null : projectId,
            professionCode: profession,
            nationalityCode: nationality,
            salary: num(salary),
            serviceFee: num(fee),
            housing: num(housing),
            housingBillable,
            transport: num(transport),
            transportBillable,
            validFrom,
            validTo: validTo || null,
            notes: notes.trim() || null,
        };
        try {
            await (edited ? commercialApi.updatePackage(edited.id, input) : commercialApi.createPackage(input));
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const amount = (label, value, set, helper) => (_jsx(TextField, { label: label, value: value, onChange: (e) => set(e.target.value.replace(/[^\d.]/g, '')), helperText: helper, slotProps: { htmlInput: { dir: 'ltr', inputMode: 'decimal' }, input: { endAdornment: _jsx(InputAdornment, { position: "end", children: t('commercial.prices.sar') }) } }, fullWidth: true }));
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "md", fullScreen: phone, children: [_jsx(DialogTitle, { children: edited ? `${t('common.edit')} — ${edited.packageNo}` : t('commercial.prices.new') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2.5, children: [_jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, mb: 0.5 }, children: t('commercial.prices.scope') }), _jsxs(RadioGroup, { row: true, value: general ? 'general' : 'project', onChange: (e) => setGeneral(e.target.value === 'general'), children: [_jsx(FormControlLabel, { value: "project", control: _jsx(Radio, {}), label: t('commercial.prices.forProject') }), _jsx(FormControlLabel, { value: "general", control: _jsx(Radio, {}), label: t('commercial.prices.forAllProjects') })] }), !general && (_jsx(Autocomplete, { options: options?.projects ?? [], value: project, onChange: (_, v) => setProjectId(v?.id ?? null), getOptionLabel: (p) => `${p.name} (${p.code})`, isOptionEqualToValue: (a, b) => a.id === b.id, renderInput: (params) => _jsx(TextField, { ...params, label: t('commercial.col.project'), required: true }) })), !general && project?.contractType === 'CostPlus' && (_jsx(Alert, { severity: "info", sx: { mt: 1 }, children: t('commercial.prices.costPlusHint') }))] }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 2, children: [_jsx(Autocomplete, { fullWidth: true, options: professions, value: professions.find((o) => o.code === profession) ?? null, onChange: (_, v) => setProfession(v?.code ?? null), onInputChange: (_, text, reason) => {
                                            if (reason === 'input' && text.trim().length >= 2) {
                                                commercialApi.priceOptions(text.trim()).then((o) => setFound(o.professions)).catch(() => undefined);
                                            }
                                        }, getOptionLabel: optionLabel(ar), isOptionEqualToValue: (a, b) => a.code === b.code, renderInput: (params) => _jsx(TextField, { ...params, label: t('workforce.col.profession'), required: true, helperText: t('commercial.prices.professionHint') }) }), _jsx(Autocomplete, { fullWidth: true, options: [{ code: '', nameAr: t('commercial.prices.anyNationality'), nameEn: t('commercial.prices.anyNationality') }, ...(options?.nationalities ?? [])], value: nationality ? (options?.nationalities.find((o) => o.code === nationality) ?? null) : { code: '', nameAr: t('commercial.prices.anyNationality'), nameEn: t('commercial.prices.anyNationality') }, onChange: (_, v) => setNationality(v?.code ? v.code : null), getOptionLabel: (o) => (o.code ? optionLabel(ar)(o) : o.nameAr), isOptionEqualToValue: (a, b) => a.code === b.code, renderInput: (params) => _jsx(TextField, { ...params, label: t('workforce.col.nationality') }) })] }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }, children: [amount(t('commercial.prices.col.salary'), salary, setSalary), amount(t('commercial.prices.col.serviceFee'), fee, setFee, t('commercial.prices.feeHint')), _jsxs(Box, { children: [amount(t('commercial.prices.col.housing'), housing, setHousing), _jsx(FormControlLabel, { control: _jsx(Switch, { size: "small", checked: housingBillable, onChange: (e) => setHousingBillable(e.target.checked) }), label: t('commercial.prices.billable') })] }), _jsxs(Box, { children: [amount(t('commercial.prices.col.transport'), transport, setTransport), _jsx(FormControlLabel, { control: _jsx(Switch, { size: "small", checked: transportBillable, onChange: (e) => setTransportBillable(e.target.checked) }), label: t('commercial.prices.billable') })] })] }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50 }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy700 }, children: t('commercial.prices.col.total') }), _jsxs(Typography, { dir: "ltr", sx: { fontSize: 20, fontWeight: 800, color: tokens.navy800 }, children: [money(total), " ", t('commercial.prices.sar')] })] }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 2, children: [_jsx(DateField, { label: t('commercial.prices.validFrom'), value: validFrom, onChange: (e) => setValidFrom(e.target.value), fullWidth: true, required: true, slotProps: { inputLabel: { shrink: true } } }), _jsx(DateField, { label: t('commercial.prices.validTo'), value: validTo, onChange: (e) => setValidTo(e.target.value), fullWidth: true, helperText: t('commercial.prices.validToHint'), slotProps: { inputLabel: { shrink: true } } })] }), _jsx(TextField, { label: t('commercial.prices.notes'), value: notes, onChange: (e) => setNotes(e.target.value), multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 1000 } } })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", onClick: () => void save(), disabled: busy || !valid || !validFrom, children: busy ? t('common.loading') : t('common.save') })] })] }));
}
