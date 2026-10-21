import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ForwardIcon from '@mui/icons-material/Forward';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApprovalStatus, HistoryEntry } from '../api/workflow';
import { tokens } from '../app/theme';
import { Badge, type Tone } from './ui';

const look: Record<string, { icon: ReactNode; color: string }> = {
  Submitted: { icon: <SendOutlinedIcon />, color: tokens.navy700 },
  StageOpened: { icon: <HourglassEmptyIcon />, color: tokens.info },
  Approved: { icon: <CheckIcon />, color: tokens.success },
  Rejected: { icon: <CloseIcon />, color: tokens.danger },
  Returned: { icon: <ReplyIcon />, color: tokens.warning },
  Delegated: { icon: <ForwardIcon />, color: tokens.teal },
  Reassigned: { icon: <SwapHorizIcon />, color: tokens.gold },
  ConditionEvaluated: { icon: <AccountTreeOutlinedIcon />, color: tokens.gold },
  RecordUpdated: { icon: <EditNoteOutlinedIcon />, color: tokens.teal },
  ActionRun: { icon: <BoltOutlinedIcon />, color: '#7C3AED' },
  Notified: { icon: <NotificationsNoneOutlinedIcon />, color: tokens.info },
  Completed: { icon: <FlagOutlinedIcon />, color: tokens.navy800 },
  Canceled: { icon: <BlockIcon />, color: tokens.gray500 },
  Failed: { icon: <ErrorOutlinedIcon />, color: tokens.danger },
  Retried: { icon: <ReplayIcon />, color: tokens.navy600 },
};

export const statusTone: Record<string, Tone> = {
  InProgress: 'info',
  Approved: 'success',
  Rejected: 'danger',
  Returned: 'warning',
  Canceled: 'neutral',
  Failed: 'danger',
};

/** The approval's full history, oldest first: every submission, stage, decision, update and notification. */
export function ApprovalTimeline({ status, fieldName }: { status: ApprovalStatus; fieldName?: (key: string) => string }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const when = (value: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));

  return (
    <Box>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
        <Badge tone={statusTone[status.status] ?? 'neutral'}>{t(`approval.instance.${status.status}`)}</Badge>
        <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>
          {ar ? status.processNameAr : status.processNameEn} — {t('routes.version', { version: status.processVersion })}
        </Typography>
      </Stack>
      {status.status === 'InProgress' && status.waitingFor.length > 0 && (
        <Box sx={{ mb: 2, p: 1.25, borderRadius: '10px', bgcolor: tokens.navy50 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.navy800 }}>
            {ar ? status.currentStepAr : status.currentStepEn}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>{t('approval.with', { names: status.waitingFor.join('، ') })}</Typography>
        </Box>
      )}
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {status.history.map((entry, index) => (
          <Entry key={entry.sequence} entry={entry} last={index === status.history.length - 1} when={when} ar={ar} fieldName={fieldName} />
        ))}
      </Box>
    </Box>
  );
}

function Entry({ entry, last, when, ar, fieldName }: { entry: HistoryEntry; last: boolean; when: (v: string) => string; ar: boolean; fieldName?: (key: string) => string }) {
  const { t } = useTranslation();
  const style = look[entry.kind] ?? { icon: null, color: tokens.gray300 };
  const step = ar ? entry.stepNameAr : entry.stepNameEn;
  return (
    <Box component="li" sx={{ display: 'flex', gap: 1.5, position: 'relative', pb: last ? 0 : 2 }}>
      {!last && <Box aria-hidden sx={{ position: 'absolute', insetInlineStart: 12, top: 26, bottom: 0, width: 2, bgcolor: tokens.gray200 }} />}
      <Box aria-hidden sx={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: '50%', bgcolor: style.color, color: '#fff', zIndex: 1, '& svg': { fontSize: 15 } }}>
        {style.icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: tokens.navy800 }}>
          {t(`approval.event.${entry.kind}`, { defaultValue: entry.kind })}
          {step ? ` — ${step}` : ''}
          {entry.kind === 'Completed' && entry.outcome ? ` (${t(`approval.instance.${entry.outcome}`)})` : ''}
        </Typography>
        {entry.actor && (
          <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>
            {entry.onBehalfOf ? t('approval.byOnBehalf', { name: entry.actor, original: entry.onBehalfOf }) : t('approval.by', { name: entry.actor })}
          </Typography>
        )}
        <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{when(entry.at)}</Typography>
        {entry.changes && (
          <Box sx={{ mt: 0.5, fontSize: 12.5, color: tokens.gray700 }}>
            {Object.entries(entry.changes).map(([key, value]) => (
              <div key={key}>
                {fieldName ? fieldName(key) : key}: <b>{value ?? '—'}</b>
              </div>
            ))}
          </Box>
        )}
        {entry.comment && (
          <Typography sx={{ mt: 0.5, px: 1.25, py: 0.75, fontSize: 12.5, borderRadius: '8px', bgcolor: tokens.gray50, border: `1px solid ${tokens.border}`, whiteSpace: 'pre-wrap' }}>
            {entry.comment}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/**
 * The approval's history as a feed (newest first): a tinted icon on a thin line, what happened and by whom, and the
 * day and time at the end of the row.
 */
export function ApprovalFeed({
  status,
  fieldName,
  fieldValue,
}: {
  status: ApprovalStatus;
  fieldName?: (key: string) => string;
  fieldValue?: (key: string, value: string | null) => string;
}) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const locale = ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  const day = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const time = (value: string) => new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const entries = [...status.history].reverse();

  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {entries.map((entry, index) => {
        const style = look[entry.kind] ?? { icon: null, color: tokens.gray300 };
        const step = ar ? entry.stepNameAr : entry.stepNameEn;
        const last = index === entries.length - 1;
        const by = entry.actor ? (entry.onBehalfOf ? t('approval.byOnBehalf', { name: entry.actor, original: entry.onBehalfOf }) : t('approval.by', { name: entry.actor })) : null;
        return (
          <Box component="li" key={entry.sequence} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', position: 'relative', py: 1.1 }}>
            {!last && <Box aria-hidden sx={{ position: 'absolute', insetInlineStart: 13, top: 38, bottom: -6, width: 2, bgcolor: tokens.gray100 }} />}
            <Box
              aria-hidden
              sx={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '50%', bgcolor: `${style.color}1f`, color: style.color, zIndex: 1, '& svg': { fontSize: 16 } }}
            >
              {style.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: tokens.navy800 }}>
                {t(`approval.event.${entry.kind}`, { defaultValue: entry.kind })}
                {step ? ` — ${step}` : ''}
                {entry.kind === 'Completed' && entry.outcome ? ` (${t(`approval.instance.${entry.outcome}`)})` : ''}
              </Typography>
              {(by || entry.comment) && (
                <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>
                  {by}
                  {by && entry.comment ? ' — ' : ''}
                  {entry.comment ? `«${entry.comment}»` : ''}
                </Typography>
              )}
              {entry.changes && (
                <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>
                  {Object.entries(entry.changes)
                    .map(([key, value]) => `${fieldName ? fieldName(key) : key}: ${fieldValue ? fieldValue(key, value) : (value ?? '—')}`)
                    .join(' · ')}
                </Typography>
              )}
            </Box>
            <Stack direction="row" sx={{ flex: '0 0 auto', gap: 2, fontSize: 12, color: tokens.gray500, whiteSpace: 'nowrap', pt: 0.25 }}>
              <span>{day(entry.at)}</span>
              <Box component="span" sx={{ minWidth: 58, textAlign: 'end' }}>
                {time(entry.at)}
              </Box>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
