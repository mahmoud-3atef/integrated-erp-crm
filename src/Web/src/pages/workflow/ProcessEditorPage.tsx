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
import { workflowApi, type ProcessDefinition, type ProcessDetail, withStatusValues } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader, Panel, PillTabs, StatusDot } from '../../components/ui';
import { ConditionEditor } from '../../components/workflow/ConditionEditor';
import { EditorContext, type EditorData } from '../../components/workflow/editorContext';
import { StepListEditor } from '../../components/workflow/StepListEditor';

/** Designs one approval process: start condition and steps; saves a draft, validates, publishes a version. */
export function ProcessEditorPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useSession();
  const canManage = can('workflow.processes.manage', true);
  const [detail, setDetail] = useState<ProcessDetail | null>(null);
  const [data, setData] = useState<Omit<EditorData, 'readOnly'> | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [priority, setPriority] = useState('0');
  const [definition, setDefinition] = useState<ProcessDefinition>({ startCondition: null, steps: [] });
  const [view, setView] = useState<string>('draft');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const show = useCallback((d: ProcessDetail) => {
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
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [id, show]);

  const change = (next: ProcessDefinition) => {
    setDefinition(next);
    setDirty(true);
    setNotice(null);
  };

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const save = () => workflowApi.saveDraft(detail!.process.id, { nameAr, nameEn, priority: Number(priority) || 0, definition }).then(show);
  const versions = detail?.versions ?? [];
  const shown = view === 'draft' ? definition : versions.find((v) => String(v.version) === view)?.definition;
  const readOnly = !canManage || view !== 'draft';

  if (!detail || !data) {
    return (
      <Box>
        <ErrorMessage messageKey={error} />
      </Box>
    );
  }

  const ar = i18n.language === 'ar';
  return (
    <Box>
      <PageHeader
        title={localName(detail.process, i18n.language)}
        subtitle={`${t('process.screen')}: ${ar ? detail.process.screenNameAr : detail.process.screenNameEn}`}
        actions={
          <Button startIcon={<ArrowBackIcon sx={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/workflow/processes')}>
            {t('common.back')}
          </Button>
        }
      />
      <ErrorMessage messageKey={error} />
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t(notice)}
        </Alert>
      )}

      <Panel padding={2.5} sx={{ mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: { lg: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusDot tone={detail.process.isActive ? 'success' : 'neutral'} label={detail.process.isActive ? t('process.activeStatus') : t('process.draftStatus')} />
            {detail.process.currentVersion > 0 && <Badge tone="primary">{t('process.publishedVersion', { version: detail.process.currentVersion })}</Badge>}
            {(dirty || detail.process.hasUnpublishedChanges) && <Badge tone="warning">{t('process.unpublished')}</Badge>}
          </Stack>
          {canManage && (
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" startIcon={<SaveOutlinedIcon />} disabled={busy || view !== 'draft'} onClick={() => void run(save, 'process.saved')}>
                {t('process.saveDraft')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<FactCheckOutlinedIcon />}
                disabled={busy || view !== 'draft'}
                onClick={() => void run(async () => {
                  await save();
                  await workflowApi.validate(detail.process.id);
                }, 'process.valid')}
              >
                {t('process.validate')}
              </Button>
              <Button
                variant="contained"
                startIcon={<PublishIcon />}
                disabled={busy || view !== 'draft'}
                onClick={() => void run(async () => {
                  await save();
                  show(await workflowApi.publish(detail.process.id));
                }, 'process.published')}
              >
                {t('process.publish')}
              </Button>
              {detail.process.currentVersion > 0 && (
                <FormControlLabel
                  sx={{ marginInlineStart: 1 }}
                  control={
                    <Switch
                      checked={detail.process.isActive}
                      disabled={busy}
                      onChange={(e) => void run(async () => show(await workflowApi.setActive(detail.process.id, e.target.checked)), e.target.checked ? 'process.activated' : 'process.deactivated')}
                    />
                  }
                  label={t('process.active')}
                />
              )}
            </Stack>
          )}
        </Stack>
      </Panel>

      {versions.length > 0 && (
        <PillTabs
          value={view}
          onChange={setView}
          options={[{ value: 'draft', label: t('process.draft') }, ...versions.map((v) => ({ value: String(v.version), label: t('routes.version', { version: v.version }) }))]}
        />
      )}
      {view !== 'draft' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('process.versionReadOnly')}
        </Alert>
      )}

      <EditorContext.Provider value={{ ...data, readOnly }}>
        <Panel padding={2.5} sx={{ mb: `${tokens.gap}px` }}>
          <Typography sx={{ fontWeight: 700, color: tokens.navy800, mb: 1.5 }}>{t('process.general')}</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField size="small" label={t('fields.NameAr')} value={nameAr} disabled={readOnly} onChange={(e) => { setNameAr(e.target.value); setDirty(true); }} slotProps={{ htmlInput: { dir: 'rtl', maxLength: 200 } }} />
            <TextField size="small" label={t('fields.NameEn')} value={nameEn} disabled={readOnly} onChange={(e) => { setNameEn(e.target.value); setDirty(true); }} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 200 } }} />
            <TextField size="small" label={t('process.priority')} value={priority} disabled={readOnly} onChange={(e) => { setPriority(e.target.value.replace(/\D/g, '').slice(0, 4)); setDirty(true); }} sx={{ maxWidth: { md: 160 } }} slotProps={{ htmlInput: { dir: 'ltr' } }} />
          </Stack>
          <Typography sx={{ fontWeight: 700, color: tokens.navy800, mt: 2.5, mb: 0.5 }}>{t('process.startCondition')}</Typography>
          <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mb: 1 }}>{t('process.startConditionHint')}</Typography>
          <ConditionEditor
            value={shown?.startCondition ?? { matchAll: true, rules: [] }}
            onChange={(startCondition) => change({ ...definition, startCondition: startCondition.rules.length > 0 ? startCondition : null })}
          />
        </Panel>

        <Panel padding={2.5}>
          <Typography sx={{ fontWeight: 700, color: tokens.navy800, mb: 0.5 }}>{t('process.steps')}</Typography>
          <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mb: 1.5 }}>{t('process.stepsHint')}</Typography>
          <StepListEditor steps={shown?.steps ?? []} onChange={(steps) => change({ ...definition, steps })} emptyHint={t('process.noSteps')} />
        </Panel>
      </EditorContext.Provider>
    </Box>
  );
}
