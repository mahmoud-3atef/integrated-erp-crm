import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CloseIcon from '@mui/icons-material/Close';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import InsertLinkOutlinedIcon from '@mui/icons-material/InsertLinkOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import { Alert, Box, ButtonBase, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { workforceApi, type HistoryIssue, type WorkerPeriod } from '../../api/workforce';
import { documentRoute, workerFileApi, type WorkerDocument } from '../../api/workerFile';
import { tokens } from '../../app/theme';

// The worker's actions after the old employee screen's actions tab (HR_EmployeeDetails.aspx, .cp-timeline): one card
// per period, latest first, with its icon, place, type, the document that made it and its days; the whole card opens
// that document. A period of the old system without a document here opens a read-only drawer with what is known.

const out = { tone: '#64748b', soft: '#f1f5f9', icon: <LogoutOutlinedIcon /> };
const looks: Record<string, { tone: string; soft: string; icon: ReactNode } | undefined> = {
  Work: { tone: '#0e7c86', soft: '#e6f6f4', icon: <WorkOutlineOutlinedIcon /> },
  ClientVacation: { tone: '#0e7c86', soft: '#e6f6f4', icon: <BeachAccessOutlinedIcon /> },
  Housing: { tone: '#d98a06', soft: '#fef3c7', icon: <HomeOutlinedIcon /> },
  Vacation: { tone: '#7c3aed', soft: '#f1eafe', icon: <BeachAccessOutlinedIcon /> },
  Absconded: { tone: '#dc2626', soft: '#fdecec', icon: <PersonOffOutlinedIcon /> },
  Suspended: { tone: '#dc2626', soft: '#fdecec', icon: <BlockOutlinedIcon /> },
  Out: out,
};

const DAY = 86400000;

/** Days in a period (the ledger's end is the first day after it; an open period runs to today). */
export function periodDays(p: WorkerPeriod) {
  const end = p.endsOn ? Date.parse(p.endsOn) : Date.parse(new Date().toISOString().slice(0, 10)) + DAY;
  return Math.max(0, Math.round((end - Date.parse(p.startsOn)) / DAY));
}

/** The document a period came from: its own (recorded here), or the old system's work start or housing order copied here. */
export function documentOf(p: WorkerPeriod, documents: WorkerDocument[]): WorkerDocument | null {
  if (documentRoute[p.sourceType]) {
    return documents.find((d) => d.type === p.sourceType && d.id === p.sourceId)
      ?? { type: p.sourceType, id: p.sourceId, no: p.sourceNo, status: '', crmId: null, workStartNo: null, reason: null, createdByName: null, createdAt: null };
  }
  if (p.sourceType === 'empwork') {
    return documents.find((d) => d.type === 'delivery_order' && d.workStartNo === p.sourceNo) ?? null;
  }
  if (p.sourceType === 'housing_order') {
    return documents.find((d) => d.type === 'return_order' && d.crmId === p.sourceId) ?? null;
  }
  return null;
}

export function WorkerActions({ workerId, periods, withDocuments }: { workerId: string; periods: WorkerPeriod[]; withDocuments: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<WorkerDocument[]>([]);
  const [issues, setIssues] = useState<HistoryIssue[]>([]);
  const [shown, setShown] = useState<WorkerPeriod | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (withDocuments) workerFileApi.documents(workerId).then(setDocuments).catch(() => setDocuments([]));
    workforceApi
      .historyIssues({ workerId, page: 1, pageSize: 100 })
      .then((list) => setIssues(list.items))
      .catch(() => setIssues([]));
  }, [workerId, withDocuments]);

  if (periods.length === 0) {
    return <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('workforce.periods.empty')}</Typography>;
  }

  const close = () => {
    setShown(null);
    opener.current?.focus();
  };

  return (
    <>
      {issues.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, mb: 0.5 }}>{t('workforce.periods.issues', { count: issues.length })}</Typography>
          {issues.map((i) => (
            <Typography key={i.id} sx={{ fontSize: 13 }}>
              • {t(`workforce.history.codes.${i.code}`)}: {i.details}
            </Typography>
          ))}
        </Alert>
      )}
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 800, color: tokens.navy800 }}>
          {t('workforce.actions.title')}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('workforce.actions.hint')}</Typography>
      </Stack>

      <Box component="ol" sx={{ position: 'relative', listStyle: 'none', m: 0, p: 0, paddingInlineStart: '50px', '&::before': { content: '""', position: 'absolute', top: 12, bottom: 12, insetInlineStart: 19, width: 2, bgcolor: tokens.border } }}>
        {periods.map((p, index) => (
          <ActionCard
            key={p.id}
            period={p}
            current={index === 0 && p.endsOn === null}
            document={documentOf(p, documents)}
            onOpen={(document, target) => {
              if (document) navigate(`${documentRoute[document.type]}${document.id}`);
              else {
                opener.current = target;
                setShown(p);
              }
            }}
          />
        ))}
      </Box>

      {shown && <PeriodDrawer period={shown} onClose={close} />}
    </>
  );
}

function ActionCard({ period: p, current, document, onOpen }: { period: WorkerPeriod; current: boolean; document: WorkerDocument | null; onOpen: (document: WorkerDocument | null, target: HTMLElement) => void }) {
  const { t } = useTranslation();
  const f = useActionFormat();
  const look = looks[p.kind] ?? out;
  const priced = p.kind === 'Work' || p.kind === 'ClientVacation';
  const housing = p.kind === 'Housing';
  const days = periodDays(p);
  const title = p.projectName ?? t(housing ? 'workforce.actions.housing' : `workforce.periods.kinds.${p.kind}`);
  const created = document?.createdAt ?? null;
  const by = document?.createdByName ?? (p.fromOldSystem ? t('workforce.periods.oldSystem') : null);

  return (
    <Box component="li" sx={{ position: 'relative', mb: 1.75 }}>
      <Box aria-hidden sx={{ position: 'absolute', insetInlineStart: -50, top: 14, width: 40, height: 40, borderRadius: '50%', bgcolor: look.tone, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 4px #fff', '& svg': { fontSize: 19 } }}>
        {look.icon}
      </Box>
      <ButtonBase
        onClick={(e) => onOpen(document, e.currentTarget)}
        aria-label={`${title} — ${document ? t('workforce.actions.open', { no: document.no }) : t('workforce.actions.details')}`}
        sx={{
          display: 'block', width: '100%', textAlign: 'start', borderRadius: '16px', border: `1px solid ${tokens.border}`, borderInlineStart: `4px solid ${look.tone}`,
          bgcolor: current ? '#f0fbf8' : '#fff', p: { xs: 1.5, md: '14px 16px' }, transition: 'box-shadow .15s, transform .15s',
          '&:hover': { boxShadow: '0 8px 22px rgba(15,39,71,.12)' },
          '&.Mui-focusVisible': { outline: `2px solid ${tokens.navy600}`, outlineOffset: 2 },
        }}
      >
        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, overflowWrap: 'anywhere' }}>{title}</Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 0.6, fontSize: 12 }}>
              <Chip bg={tokens.gray100} color={tokens.gray700}>
                {t(`workforce.periods.kinds.${p.kind}`)}
                {document?.reason ? ` · ${t(`operations.return.reasons.${document.reason}`, { defaultValue: document.reason })}` : ''}
              </Chip>
              {current && (
                <Chip bg="#dcfce7" color="#166534">
                  {t('workforce.actions.current')}
                </Chip>
              )}
              {housing && <Chip bg={p.paySalary ? '#e0f2fe' : tokens.gray100} color={p.paySalary ? '#075985' : tokens.gray600}>{t(p.paySalary ? 'workforce.periods.salaryPaid' : 'workforce.periods.salaryStopped')}</Chip>}
              {p.isSpecialPrice ? (
                <Chip bg="#fef3c7" color="#92400e">{t('commercial.prices.status.Special')}</Chip>
              ) : (
                p.packageNo && <Chip bg="#e6f6f4" color="#0e7c86"><bdi>{p.packageNo}</bdi></Chip>
              )}
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: document ? '#1d4ed8' : tokens.gray500, fontWeight: 700, '& svg': { fontSize: 16 } }}>
                <InsertLinkOutlinedIcon />
                {document ? (
                  <>
                    {t(`workforce.actions.documents.${document.type}`)} <bdi>{document.no}</bdi>
                  </>
                ) : (
                  <>
                    {t(`workforce.actions.sources.${p.sourceType}`, { defaultValue: p.sourceType })} <bdi>{p.sourceNo}</bdi>
                  </>
                )}
              </Box>
            </Stack>
          </Box>
          <Box component="span" sx={{ flex: '0 0 auto', borderRadius: '10px', px: 1.25, py: 0.6, fontWeight: 800, fontSize: 12, bgcolor: look.soft, color: look.tone, whiteSpace: 'nowrap' }}>
            {t(priced ? 'workforce.actions.workDays' : housing ? 'workforce.actions.housingDays' : 'workforce.actions.days', { count: days })}
          </Box>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' }, gap: 1, mt: 1.5 }}>
          <Meta label={t(housing ? 'workforce.actions.housingIn' : priced ? 'workforce.actions.started' : 'workforce.periods.from')}>{f.date(p.startsOn)}</Meta>
          <Meta label={t(housing ? 'workforce.actions.housingOut' : priced ? 'workforce.actions.stopped' : 'workforce.periods.to')}>
            {p.endsOn ? f.lastDay(p.endsOn) : `— ${t('workforce.periods.open')}`}
            {p.closedByNo && (
              <Typography component="span" sx={{ display: 'block', fontSize: 11, fontWeight: 500, color: tokens.gray500 }}>
                <bdi>{p.closedByNo}</bdi>
              </Typography>
            )}
          </Meta>
          {priced && (
            <>
              <Meta label={t('workforce.actions.totalPrice')}>{f.money(p.totalPrice)}</Meta>
              <Meta label={t('workforce.actions.housingPrice')}>{f.money(p.housing)}</Meta>
              <Meta label={t('workforce.actions.transport')}>{f.money(p.transport)}</Meta>
            </>
          )}
        </Box>

        <Stack direction="row" sx={{ justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', mt: 1, fontSize: 11.5, color: tokens.gray500, '& svg': { fontSize: 14 } }}>
          {(created || by) && (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarMonthOutlinedIcon />
              {created ? t('workforce.actions.created', { date: f.date(created.slice(0, 10)) }) : null}
              {by && <> · {by}</>}
            </Box>
          )}
          <Box component="span" sx={{ color: '#1d4ed8', fontWeight: 700 }}>
            {document ? t('workforce.actions.openDocument') : t('workforce.actions.details')}
          </Box>
        </Stack>
      </ButtonBase>
    </Box>
  );
}

/** A period of the old system with no document here: what is known of it, read-only. */
function PeriodDrawer({ period: p, onClose }: { period: WorkerPeriod; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useActionFormat();
  const look = looks[p.kind] ?? out;
  const priced = p.kind === 'Work' || p.kind === 'ClientVacation';
  return (
    <Drawer anchor="left" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 }, p: 2.5 }, role: 'dialog', 'aria-label': t('workforce.actions.details') } }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: look.tone, color: '#fff', display: 'grid', placeItems: 'center' }}>{look.icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{p.projectName ?? t(`workforce.periods.kinds.${p.kind}`)}</Typography>
          <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('workforce.actions.noDocument')}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <Meta label={t('workforce.periods.kind')}>{t(`workforce.periods.kinds.${p.kind}`)}</Meta>
        <Meta label={t('workforce.periods.source')}>
          {t(`workforce.actions.sources.${p.sourceType}`, { defaultValue: p.sourceType })} <bdi>{p.sourceNo}</bdi>
        </Meta>
        <Meta label={t('workforce.periods.from')}>{f.date(p.startsOn)}</Meta>
        <Meta label={t('workforce.periods.to')}>{p.endsOn ? f.lastDay(p.endsOn) : t('workforce.periods.open')}</Meta>
        <Meta label={t('workforce.actions.daysLabel')}>{periodDays(p).toLocaleString('en-US')}</Meta>
        <Meta label={t('workforce.periods.origin')}>{t(p.fromOldSystem ? 'workforce.periods.oldSystem' : 'workforce.periods.thisSystem')}</Meta>
        {priced && (
          <>
            <Meta label={t('workforce.actions.totalPrice')}>{f.money(p.totalPrice)}</Meta>
            <Meta label={t('workforce.actions.housingPrice')}>{f.money(p.housing)}</Meta>
            <Meta label={t('workforce.actions.transport')}>{f.money(p.transport)}</Meta>
          </>
        )}
      </Box>
    </Drawer>
  );
}

function Chip({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return (
    <Box component="span" sx={{ bgcolor: bg, color, borderRadius: '8px', px: 1, py: 0.25, fontWeight: 700 }}>
      {children}
    </Box>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ bgcolor: tokens.gray50, borderRadius: '10px', px: 1.25, py: 1, minWidth: 0 }}>
      <Typography component="span" sx={{ display: 'block', fontSize: 11, color: tokens.gray500 }}>
        {label}
      </Typography>
      <Typography component="span" sx={{ display: 'block', fontSize: 13, fontWeight: 800, color: tokens.navy800, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function useActionFormat() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const date = (value: string) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  return {
    date,
    // The ledger stores the first day after the period; people read the last day in it.
    lastDay: (endsOn: string) => date(new Date(Date.parse(endsOn) - DAY).toISOString().slice(0, 10)),
    money: (value: number | null) => (value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 })),
  };
}
