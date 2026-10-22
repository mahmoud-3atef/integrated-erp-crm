import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PublishIcon from '@mui/icons-material/Publish';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { Alert, Box, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { setupApi } from '../../api/setup';
import { workflowApi, withStatusValues } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader, Panel, PillTabs, StatusDot } from '../../components/ui';
import { ConditionEditor } from '../../components/workflow/ConditionEditor';
import { EditorContext } from '../../components/workflow/editorContext';
import { StepListEditor } from '../../components/workflow/StepListEditor';
/** Designs one approval process: start condition and steps; saves a draft, validates, publishes a version. */
export function ProcessEditorPage() {
    const { t, i18n } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const { can } = useSession();
    const canManage = can('workflow.processes.manage', true);
    const [detail, setDetail] = useState(null);
    const [data, setData] = useState(null);
    const [nameAr, setNameAr] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [priority, setPriority] = useState('0');
    const [definition, setDefinition] = useState({ startCondition: null, steps: [] });
    const [view, setView] = useState('draft');
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const show = useCallback((d) => {
        setDetail(d);
        setNameAr(d.process.nameAr);
        setNameEn(d.process.nameEn);
        setPriority(String(d.process.priority));
        setDefinition({ startCondition: d.draft.startCondition ?? null, steps: d.draft.steps ?? [] });
        setDirty(false);
    }, []);
    useEffect(() => {
        if (!id) {
            return;
        }
        Promise.all([workflowApi.process(id), workflowApi.screens(), workflowApi.approverOptions(), setupApi.legalEntities().catch(() => [])])
            .then(([d, screens, options, legalEntities]) => {
            show(d);
            const screen = screens.find((s) => s.code === d.process.screen);
            if (screen) {
                setData({ screen, options, legalEntities });
                // The status values the company added: an update step may set the record's status to them.
                workflowApi
                    .statusValues(screen.code)
                    .then((statuses) => setData({ screen: withStatusValues(screen, statuses), options, legalEntities }))
                    .catch(() => undefined);
            }
        })
            .catch((failure) => setError(errorKey(failure)));
    }, [id, show]);
    const change = (next) => {
        setDefinition(next);
        setDirty(true);
        setNotice(null);
    };
    const run = async (action, success) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await action();
            setNotice(success);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const save = () => workflowApi.saveDraft(detail.process.id, { nameAr, nameEn, priority: Number(priority) || 0, definition }).then(show);
    const versions = detail?.versions ?? [];
    const shown = view === 'draft' ? definition : versions.find((v) => String(v.version) === view)?.definition;
    const readOnly = !canManage || view !== 'draft';
    if (!detail || !data) {
        return (_jsx(Box, { children: _jsx(ErrorMessage, { messageKey: error }) }));
    }
    const ar = i18n.language === 'ar';
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: localName(detail.process, i18n.language), subtitle: `${t('process.screen')}: ${ar ? detail.process.screenNameAr : detail.process.screenNameEn}`, actions: _jsx(Button, { startIcon: _jsx(ArrowBackIcon, { sx: { transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate('/workflow/processes'), children: t('common.back') }) }), _jsx(ErrorMessage, { messageKey: error }), notice && (_jsx(Alert, { severity: "success", sx: { mb: 2 }, children: t(notice) })), _jsx(Panel, { padding: 2.5, sx: { mb: `${tokens.gap}px` }, children: _jsxs(Stack, { direction: { xs: 'column', lg: 'row' }, spacing: 2, sx: { alignItems: { lg: 'center' }, justifyContent: 'space-between' }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx(StatusDot, { tone: detail.process.isActive ? 'success' : 'neutral', label: detail.process.isActive ? t('process.activeStatus') : t('process.draftStatus') }), detail.process.currentVersion > 0 && _jsx(Badge, { tone: "primary", children: t('process.publishedVersion', { version: detail.process.currentVersion }) }), (dirty || detail.process.hasUnpublishedChanges) && _jsx(Badge, { tone: "warning", children: t('process.unpublished') })] }), canManage && (_jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap' }, children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(SaveOutlinedIcon, {}), disabled: busy || view !== 'draft', onClick: () => void run(save, 'process.saved'), children: t('process.saveDraft') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(FactCheckOutlinedIcon, {}), disabled: busy || view !== 'draft', onClick: () => void run(async () => {
                                        await save();
                                        await workflowApi.validate(detail.process.id);
                                    }, 'process.valid'), children: t('process.validate') }), _jsx(Button, { variant: "contained", startIcon: _jsx(PublishIcon, {}), disabled: busy || view !== 'draft', onClick: () => void run(async () => {
                                        await save();
                                        show(await workflowApi.publish(detail.process.id));
                                    }, 'process.published'), children: t('process.publish') }), detail.process.currentVersion > 0 && (_jsx(FormControlLabel, { sx: { marginInlineStart: 1 }, control: _jsx(Switch, { checked: detail.process.isActive, disabled: busy, onChange: (e) => void run(async () => show(await workflowApi.setActive(detail.process.id, e.target.checked)), e.target.checked ? 'process.activated' : 'process.deactivated') }), label: t('process.active') }))] }))] }) }), versions.length > 0 && (_jsx(PillTabs, { value: view, onChange: setView, options: [{ value: 'draft', label: t('process.draft') }, ...versions.map((v) => ({ value: String(v.version), label: t('routes.version', { version: v.version }) }))] })), view !== 'draft' && (_jsx(Alert, { severity: "info", sx: { mb: 2 }, children: t('process.versionReadOnly') })), _jsxs(EditorContext.Provider, { value: { ...data, readOnly }, children: [_jsxs(Panel, { padding: 2.5, sx: { mb: `${tokens.gap}px` }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800, mb: 1.5 }, children: t('process.general') }), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, spacing: 1.5, children: [_jsx(TextField, { size: "small", label: t('fields.NameAr'), value: nameAr, disabled: readOnly, onChange: (e) => { setNameAr(e.target.value); setDirty(true); }, slotProps: { htmlInput: { dir: 'rtl', maxLength: 200 } } }), _jsx(TextField, { size: "small", label: t('fields.NameEn'), value: nameEn, disabled: readOnly, onChange: (e) => { setNameEn(e.target.value); setDirty(true); }, slotProps: { htmlInput: { dir: 'ltr', maxLength: 200 } } }), _jsx(TextField, { size: "small", label: t('process.priority'), value: priority, disabled: readOnly, onChange: (e) => { setPriority(e.target.value.replace(/\D/g, '').slice(0, 4)); setDirty(true); }, sx: { maxWidth: { md: 160 } }, slotProps: { htmlInput: { dir: 'ltr' } } })] }), _jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800, mt: 2.5, mb: 0.5 }, children: t('process.startCondition') }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600, mb: 1 }, children: t('process.startConditionHint') }), _jsx(ConditionEditor, { value: shown?.startCondition ?? { matchAll: true, rules: [] }, onChange: (startCondition) => change({ ...definition, startCondition: startCondition.rules.length > 0 ? startCondition : null }) })] }), _jsxs(Panel, { padding: 2.5, children: [_jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800, mb: 0.5 }, children: t('process.steps') }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600, mb: 1.5 }, children: t('process.stepsHint') }), _jsx(StepListEditor, { steps: shown?.steps ?? [], onChange: (steps) => change({ ...definition, steps }), emptyHint: t('process.noSteps') })] })] })] }));
}
