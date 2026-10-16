import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SendIcon from '@mui/icons-material/Send';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workflowApi, type InternalRequest, type MemberOption } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { ApprovalTimeline } from '../../components/ApprovalTimeline';
import { PageHeader, Panel, StatusDot } from '../../components/ui';
import { requestTone } from './RequestsPage';

const none = 'none';
export const categories = ['GENERAL', 'PURCHASE', 'ADVANCE', 'LEAVE', 'OTHER'] as const;

/** One internal request: edit while a draft or returned, send for approval, follow the approval. */
export function RequestDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { me } = useSession();
  const { id } = useParams();
  const isNew = id === 'new';
  const [request, setRequest] = useState<InternalRequest | null>(null);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('GENERAL');
  const [manager, setManager] = useState(none);
  const [people, setPeople] = useState<MemberOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const show = useCallback((value: InternalRequest) => {
    setRequest(value);
    setSubject(value.subject);
    setDetails(value.details);
    setAmount(value.amount === null ? '' : String(value.amount));
    setCategory(value.category);
    setManager(value.directManagerId ?? none);
  }, []);

  useEffect(() => {
    workflowApi.people().then(setPeople).catch(() => setPeople([]));
    if (!isNew && id) {
      workflowApi.request(id).then(show).catch((failure: unknown) => setError(errorKey(failure)));
    }
  }, [id, isNew, show]);

  const editable = isNew || request?.canEdit === true;
  const input = () => ({
    subject,
    details,
    amount: amount.trim() === '' ? null : Number(amount),
    legalEntityId: request?.legalEntityId ?? null,
    category,
    directManagerId: manager === none ? null : manager,
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (isNew) {
        const created = await workflowApi.createRequest(input());
        navigate(`/workflow/requests/${created.id}`, { replace: true });
      } else {
        show(await workflowApi.updateRequest(request!.id, input()));
        setSaved(true);
      }
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await workflowApi.updateRequest(request!.id, input());
      show(await workflowApi.submitRequest(request!.id));
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const money = (value: number) => new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2 }).format(value);
  const personName = (userId: string | null) => people.find((p) => p.userAccountId === userId)?.displayName ?? '—';

  return (
    <Box>
      <PageHeader
        title={isNew ? t('requests.new') : (request?.number ?? '…')}
        subtitle={request ? request.createdByName : t('requests.newIntro')}
        actions={
          <Button startIcon={<ArrowBackIcon sx={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate('/workflow/requests')}>
            {t('common.back')}
          </Button>
        }
      />
      <ErrorMessage messageKey={error} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 420px' }, gap: `${tokens.gap}px`, alignItems: 'start' }}>
        <Panel padding={2.5}>
          {request && (
            <Box sx={{ mb: 2 }}>
              <StatusDot tone={requestTone[request.status]} label={t(`requests.status.${request.status}`)} />
            </Box>
          )}
          {request?.status === 'Returned' && request.lastComment && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('requests.returnedBecause', { reason: request.lastComment })}
            </Alert>
          )}
          {saved && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {t('requests.saved')}
            </Alert>
          )}
          {editable ? (
            <Stack spacing={2}>
              <TextField label={t('requests.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} required slotProps={{ htmlInput: { maxLength: 200 } }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField select label={t('requests.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (
                    <MenuItem key={c} value={c}>
                      {t(`requests.categories.${c}`)}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={t('requests.amountSar')}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                  slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
                />
              </Stack>
              <TextField select label={t('requests.directManager')} value={manager} onChange={(e) => setManager(e.target.value)} helperText={t('requests.directManagerHint')}>
                <MenuItem value={none}>{t('requests.noManager')}</MenuItem>
                {people
                  .filter((p) => p.userAccountId !== me.userId)
                  .map((p) => (
                    <MenuItem key={p.userAccountId} value={p.userAccountId}>
                      {p.displayName}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField label={t('requests.details')} value={details} onChange={(e) => setDetails(e.target.value)} multiline minRows={5} slotProps={{ htmlInput: { maxLength: 4000 } }} />
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button variant="outlined" onClick={() => void save()} disabled={busy || !subject.trim()}>
                  {isNew ? t('requests.saveDraft') : t('common.save')}
                </Button>
                {!isNew && request && (
                  <Button variant="contained" startIcon={<SendIcon sx={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} />} onClick={() => void submit()} disabled={busy || !subject.trim()}>
                    {t('requests.send')}
                  </Button>
                )}
              </Stack>
              {!isNew && <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('requests.sendHint')}</Typography>}
            </Stack>
          ) : (
            request && (
              <Stack spacing={1.25}>
                <Typography sx={{ fontSize: 17, fontWeight: 700, color: tokens.navy800 }}>{request.subject}</Typography>
                <Typography sx={{ color: tokens.gray600 }}>
                  {t('requests.category')}: <b>{t(`requests.categories.${request.category}`)}</b>
                  {request.amount !== null && (
                    <>
                      {' — '}
                      {t('requests.amount')}: <b>{money(request.amount)}</b>
                    </>
                  )}
                </Typography>
                <Typography sx={{ color: tokens.gray600 }}>
                  {t('requests.directManager')}: <b>{personName(request.directManagerId)}</b>
                </Typography>
                {request.details && <Typography sx={{ whiteSpace: 'pre-wrap', color: tokens.gray700, lineHeight: 1.8 }}>{request.details}</Typography>}
                {request.approverNotes && (
                  <Alert severity="info">
                    {t('requests.approverNotes')}: {request.approverNotes}
                  </Alert>
                )}
              </Stack>
            )
          )}
        </Panel>
        <Panel padding={2.5}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, color: tokens.navy800 }}>{t('approval.title')}</Typography>
            {request?.approval && (
              <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/workflow/approvals/${request.approval!.instanceId}`)}>
                {t('approval.details')}
              </Button>
            )}
          </Stack>
          {request?.approval ? <ApprovalTimeline status={request.approval} /> : <Typography sx={{ color: tokens.gray500, fontSize: 13 }}>{t('approval.notSubmitted')}</Typography>}
        </Panel>
      </Box>
    </Box>
  );
}
