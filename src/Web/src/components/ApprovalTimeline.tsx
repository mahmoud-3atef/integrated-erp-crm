import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ReplyIcon from '@mui/icons-material/Reply';
import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Timeline, TimelineStep } from '../api/workflow';
import { tokens } from '../app/theme';
import { Badge, type Tone } from './ui';

const look: Record<TimelineStep['status'], { tone: Tone; icon: ReactNode; color: string }> = {
  Approved: { tone: 'success', icon: <CheckIcon />, color: tokens.success },
  Rejected: { tone: 'danger', icon: <CloseIcon />, color: tokens.danger },
  Returned: { tone: 'warning', icon: <ReplyIcon />, color: tokens.warning },
  Pending: { tone: 'info', icon: <HourglassEmptyIcon />, color: tokens.info },
  Waiting: { tone: 'neutral', icon: null, color: tokens.gray300 },
};

/** Stages of an approval, top to bottom: who it is with, who decided, when, and why. */
export function ApprovalTimeline({ timeline }: { timeline: Timeline }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const when = (value: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));

  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      <Box component="li" sx={{ display: 'flex', gap: 1.5, pb: 2 }}>
        <Dot color={tokens.navy700}>{null}</Dot>
        <Box>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: tokens.navy800 }}>{t('approval.submitted', { name: timeline.submittedBy })}</Typography>
          <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{when(timeline.submittedAt)}</Typography>
        </Box>
      </Box>
      {timeline.steps.map((step, index) => {
        const style = look[step.status];
        return (
          <Box component="li" key={step.stageOrder} sx={{ display: 'flex', gap: 1.5, pb: index === timeline.steps.length - 1 ? 0 : 2 }}>
            <Dot color={style.color}>{style.icon}</Dot>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: tokens.navy800 }}>
                  {t('approval.stage', { order: step.stageOrder })} — {ar ? step.stageNameAr : step.stageNameEn}
                </Typography>
                <Badge tone={style.tone}>{t(`approval.status.${step.status}`)}</Badge>
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>
                {step.decidedBy
                  ? t('approval.decidedBy', { name: step.decidedBy })
                  : step.assignees.length > 0
                    ? t('approval.with', { names: step.assignees.join('، ') })
                    : t('approval.notYet')}
              </Typography>
              {step.decidedAt && <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{when(step.decidedAt)}</Typography>}
              {step.comment && (
                <Typography sx={{ mt: 0.5, px: 1.25, py: 0.75, fontSize: 12.5, borderRadius: '8px', bgcolor: tokens.gray50, border: `1px solid ${tokens.border}` }}>
                  {step.comment}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <Box
      aria-hidden
      sx={{
        flex: '0 0 auto',
        display: 'grid',
        placeItems: 'center',
        width: 26,
        height: 26,
        borderRadius: '50%',
        bgcolor: color,
        color: '#fff',
        '& svg': { fontSize: 16 },
      }}
    >
      {children}
    </Box>
  );
}
