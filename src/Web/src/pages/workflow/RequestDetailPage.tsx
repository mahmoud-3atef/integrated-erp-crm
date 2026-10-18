import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SendIcon from '@mui/icons-material/Send';
import SubjectOutlinedIcon from '@mui/icons-material/SubjectOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { workflowApi, type InternalRequest, type MemberOption } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { ApprovalBar, ApprovalLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { PageHeader, Panel, PillTabs, StatusDot } from '../../components/ui';
import { requestTone } from './RequestsPage';
import { useCrumb } from '../../app/breadcrumbs';

const none = 'none';
export const categories = ['GENERAL', 'PURCHASE', 'ADVANCE', 'LEAVE', 'OTHER'] as const;

/**
 * One internal request: edit while a draft or returned, send for approval, and follow and decide its approval on the
 * same page (the stage bar above the request, and an approval tab with the full log).
 */
export function RequestDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { me } = useSession();
  const { id } = useParams();
  const isNew = id === 'new';
  const [request, setRequest] = useState<InternalRequest | null>(null);
  useCrumb(request?.number);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('GENERAL');
  const [manager, setManager] = useState(none);
  const [people, setPeople] = useState<MemberOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'data' | 'approval'>('data');
  const approval = useRecordApproval(request?.approval?.instanceId);

  const show = useCallback((value: InternalRequest) => {
    setRequest(value);
    setSubject(value.subject);
    setDetails(value.details);
    setAmount(value.amount === null ? '' : String(value.amount));
    setCategory(value.category);
    setManager(value.directManagerId ?? none);
  }, []);

  const reload = useCallback(async () => {
    if (id && !isNew) {
      try {
        show(await workflowApi.request(id));
      } catch (failure) {
        setError(errorKey(failure));
      }
    }
  }, [id, isNew, show]);

  useEffect(() => {
    workflowApi.people().then(setPeople).catch(() => setPeople([]));
    void reload();
  }, [reload]);

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

  const ar = i18n.language === 'ar';
  const money = (value: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2 }).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const personName = (userId: string | null) => people.find((p) => p.userAccountId === userId)?.displayName ?? '—';
  const flip = { transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' };

  return (
    <Box>
      <PageHeader
        title={isNew ? t('requests.new') : (request?.number ?? '…')}
        subtitle={request ? request.subject : t('requests.newIntro')}
        actions={
          <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
            {request && <StatusDot tone={requestTone[request.status]} label={t(`requests.status.${request.status}`)} />}
            <Button startIcon={<ArrowBackIcon sx={flip} />} onClick={() => navigate('/workflow/requests')}>
              {t('common.back')}
            </Button>
          </Stack>
        }
      />
      <ErrorMessage messageKey={error} />

      {/* The approval stages above the request, as in the old portal. */}
      {request?.approval && (
        <ApprovalBar
          status={request.approval}
          detail={approval.detail}
          onChanged={() => {
            void approval.reload();
            void reload();
          }}
        />
      )}

      {request?.approval && (
        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'data', label: t('requests.tabs.data') },
            { value: 'approval', label: t('requests.tabs.approval') },
          ]}
        />
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

      {tab === 'approval' && request?.approval ? (
        <Panel padding={2.5}>
          <ApprovalLog status={request.approval} detail={approval.detail} />
        </Panel>
      ) : (
        <Panel padding={2.5}>
          <Stack spacing={2.5}>
            {editable ? (
              <>
                <FieldSection title={t('requests.sections.main')} icon={<DescriptionOutlinedIcon />}>
                  <FieldBox label={t('requests.subject')} icon={<SubjectOutlinedIcon />} input required wide>
                    <TextField fullWidth size="small" value={subject} onChange={(e) => setSubject(e.target.value)} slotProps={{ htmlInput: { maxLength: 200, 'aria-label': t('requests.subject') } }} />
                  </FieldBox>
                  <FieldBox label={t('requests.category')} icon={<CategoryOutlinedIcon />} input>
                    <TextField select fullWidth size="small" value={category} onChange={(e) => setCategory(e.target.value)} slotProps={{ htmlInput: { 'aria-label': t('requests.category') } }}>
                      {categories.map((c) => (
                        <MenuItem key={c} value={c}>
                          {t(`requests.categories.${c}`)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </FieldBox>
                  <FieldBox label={t('requests.amountSar')} icon={<PaymentsOutlinedIcon />} input>
                    <TextField
                      fullWidth
                      size="small"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                      slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal', 'aria-label': t('requests.amountSar') } }}
                    />
                  </FieldBox>
                </FieldSection>
                <FieldSection title={t('requests.sections.people')} icon={<PersonOutlinedIcon />} tone="sky">
                  <FieldBox label={t('requests.directManager')} icon={<ManageAccountsOutlinedIcon />} input wide>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={manager}
                      onChange={(e) => setManager(e.target.value)}
                      helperText={t('requests.directManagerHint')}
                      slotProps={{ htmlInput: { 'aria-label': t('requests.directManager') } }}
                    >
                      <MenuItem value={none}>{t('requests.noManager')}</MenuItem>
                      {people
                        .filter((p) => p.userAccountId !== me.userId)
                        .map((p) => (
                          <MenuItem key={p.userAccountId} value={p.userAccountId}>
                            {p.displayName}
                          </MenuItem>
                        ))}
                    </TextField>
                  </FieldBox>
                </FieldSection>
                <FieldSection title={t('requests.details')} icon={<NotesOutlinedIcon />} tone="gold" columns={1}>
                  <FieldBox label={t('requests.details')} icon={<NotesOutlinedIcon />} input>
                    <TextField fullWidth multiline minRows={5} value={details} onChange={(e) => setDetails(e.target.value)} slotProps={{ htmlInput: { maxLength: 4000, 'aria-label': t('requests.details') } }} />
                  </FieldBox>
                </FieldSection>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                  <Button variant="outlined" onClick={() => void save()} disabled={busy || !subject.trim()}>
                    {isNew ? t('requests.saveDraft') : t('common.save')}
                  </Button>
                  {!isNew && request && (
                    <Button variant="contained" startIcon={<SendIcon sx={flip} />} onClick={() => void submit()} disabled={busy || !subject.trim()}>
                      {t('requests.send')}
                    </Button>
                  )}
                  {!isNew && <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('requests.sendHint')}</Typography>}
                </Stack>
              </>
            ) : (
              request && (
                <>
                  <FieldSection title={t('requests.sections.main')} icon={<DescriptionOutlinedIcon />}>
                    <FieldBox label={t('requests.number')} icon={<TagOutlinedIcon />}>
                      {request.number}
                    </FieldBox>
                    <FieldBox label={t('requests.category')} icon={<CategoryOutlinedIcon />}>
                      {t(`requests.categories.${request.category}`)}
                    </FieldBox>
                    <FieldBox label={t('requests.subject')} icon={<SubjectOutlinedIcon />} wide>
                      {request.subject}
                    </FieldBox>
                    <FieldBox label={t('requests.amount')} icon={<PaymentsOutlinedIcon />} highlight={request.amount !== null}>
                      {request.amount !== null ? money(request.amount) : '—'}
                    </FieldBox>
                  </FieldSection>
                  <FieldSection title={t('requests.sections.people')} icon={<PersonOutlinedIcon />} tone="sky">
                    <FieldBox label={t('requests.createdBy')} icon={<PersonOutlinedIcon />}>
                      {request.createdByName} — {date(request.createdAt)}
                    </FieldBox>
                    <FieldBox label={t('requests.directManager')} icon={<ManageAccountsOutlinedIcon />}>
                      {personName(request.directManagerId)}
                    </FieldBox>
                  </FieldSection>
                  {(request.details || request.approverNotes) && (
                    <FieldSection title={t('requests.details')} icon={<NotesOutlinedIcon />} tone="gold" columns={1}>
                      {request.details && (
                        <FieldBox label={t('requests.details')} icon={<NotesOutlinedIcon />} multiline>
                          {request.details}
                        </FieldBox>
                      )}
                      {request.approverNotes && (
                        <FieldBox label={t('requests.approverNotes')} icon={<RateReviewOutlinedIcon />} multiline>
                          {request.approverNotes}
                        </FieldBox>
                      )}
                    </FieldSection>
                  )}
                  {!request.approval && <Typography sx={{ color: tokens.gray500, fontSize: 13 }}>{t('approval.notSubmitted')}</Typography>}
                </>
              )
            )}
          </Stack>
        </Panel>
      )}
    </Box>
  );
}
