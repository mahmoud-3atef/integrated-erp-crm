import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReplyIcon from '@mui/icons-material/Reply';
import { Box, Button, Collapse, Drawer, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApprovalStatus } from '../../api/workflow';
import { ApprovalFeed } from '../ApprovalTimeline';
import { flow, stateLook, useStageName, useWhen, type BarActions } from './ApprovalBar';
import { stageNodes, type StageNode } from './approvalModel';

/**
 * ApprovalHistoryDrawer (spec 16 §3.2): every stage of the approval from the start side, earlier rounds included,
 * with its rule, approvers, dates and comments, the stages still planned, then the full event log. It overlays the
 * page (the grid keeps its width) and, being modal, is the only drawer open; focus returns to the button that opened it.
 */
export function ApprovalHistoryDrawer({
  open,
  onClose,
  status,
  title,
  actions,
  canReturn,
  onReturn,
  fieldName,
  fieldValue,
}: {
  open: boolean;
  onClose: () => void;
  status: ApprovalStatus;
  /** The record's title, when known. */
  title?: string | null;
  /** The current user's decisions, shown under the current stage. */
  actions?: BarActions;
  canReturn?: boolean;
  onReturn?: () => void;
  fieldName?: (key: string) => string;
  fieldValue?: (key: string, value: string | null) => string;
}) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { short } = useWhen();
  const [log, setLog] = useState(false);
  const nodes = stageNodes(status);

  return (
    // "left" is the start side: MUI mirrors it to the right in Arabic.
    <Drawer anchor="left" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 }, maxWidth: '100%' } } }}>
      <Box component="header" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2.5, pt: 2.25, pb: 1.75, borderBottom: `1px solid ${flow.border}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" id="approval-drawer-title" sx={{ fontSize: 18, fontWeight: 700, color: flow.text }}>
            {t('approvalBar.drawerTitle')}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: flow.textMuted, mt: 0.25 }}>
            {title ? (
              <>
                <bdi>{title}</bdi> ·{' '}
              </>
            ) : null}
            {ar ? status.processNameAr : status.processNameEn} · {t('approvalBar.startedBy', { date: short(status.submittedAt), name: status.submittedBy })}
          </Typography>
          <Box
            sx={{
              display: 'inline-block',
              mt: 1,
              px: 1.1,
              py: 0.2,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              color: status.status === 'InProgress' ? flow.blue : status.status === 'Approved' ? flow.green : status.status === 'Returned' ? flow.amber : status.status === 'Canceled' ? flow.textMuted : flow.red,
              bgcolor: status.status === 'InProgress' ? flow.blueSoft : status.status === 'Approved' ? flow.greenSoft : status.status === 'Returned' ? flow.amberSoft : status.status === 'Canceled' ? flow.mutedSoft : flow.redSoft,
            }}
          >
            {t(`approval.instance.${status.status}`)}
            {status.status === 'InProgress' && (ar ? status.currentStepAr : status.currentStepEn) ? ` — ${ar ? status.currentStepAr : status.currentStepEn}` : ''}
          </Box>
        </Box>
        <Tooltip title={t('approvalBar.close')}>
          <IconButton onClick={onClose} aria-label={t('approvalBar.close')} sx={{ border: `1px solid ${flow.border}`, borderRadius: '8px' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
        <Box component="ol" aria-labelledby="approval-drawer-title" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {nodes.map((node, index) => (
            <StageEntry
              key={node.key}
              node={node}
              last={index === nodes.length - 1}
              actions={node.state === 'Current' ? actions : undefined}
              canReturn={node.state === 'Current' && canReturn}
              onReturn={onReturn}
            />
          ))}
        </Box>

        {status.history.length > 0 && (
          <Box sx={{ mt: 2.5, pt: 1.5, borderTop: `1px solid ${flow.border}` }}>
            <Button
              onClick={() => setLog(!log)}
              aria-expanded={log}
              endIcon={<ExpandMoreIcon sx={{ transition: 'transform .2s', transform: log ? 'rotate(180deg)' : 'none' }} />}
              sx={{ color: flow.text, fontWeight: 700, px: 0.5 }}
            >
              {t('approvalBar.eventLog', { count: status.history.length })}
            </Button>
            <Collapse in={log} unmountOnExit>
              <Box sx={{ pt: 1 }}>
                <ApprovalFeed status={status} fieldName={fieldName} fieldValue={fieldValue} />
              </Box>
            </Collapse>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

function StageEntry({
  node,
  last,
  actions,
  canReturn,
  onReturn,
}: {
  node: StageNode;
  last: boolean;
  actions?: BarActions;
  canReturn?: boolean;
  onReturn?: () => void;
}) {
  const { t } = useTranslation();
  const name = useStageName()(node);
  const { short } = useWhen();
  const look = stateLook[node.state];
  const current = node.state === 'Current';
  const planned = node.state === 'Planned';
  const decidedLabel =
    node.state === 'Rejected' ? 'approvalBar.rejectedOn' : node.state === 'Returned' ? 'approvalBar.returnedOn' : node.state === 'Submitted' ? 'approvalBar.sentOn' : 'approvalBar.approvedOn';

  return (
    <Box component="li" aria-current={current ? 'step' : undefined} sx={{ display: 'flex', gap: 1.5, position: 'relative', pb: last ? 0 : 2.25, opacity: node.superseded ? 0.85 : 1 }}>
      {!last && <Box aria-hidden sx={{ position: 'absolute', insetInlineStart: 13, top: 32, bottom: 2, width: 2, bgcolor: flow.border }} />}
      <Box
        aria-hidden
        sx={{
          flex: '0 0 auto',
          zIndex: 1,
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 13,
          fontWeight: 700,
          '& svg': { fontSize: 16 },
          ...(current
            ? { bgcolor: flow.blue, color: '#fff', boxShadow: `0 0 0 4px ${flow.blueSoft}` }
            : planned
              ? { bgcolor: '#fff', color: flow.muted, border: `1.5px solid ${flow.border}` }
              : { bgcolor: look.soft, color: look.main }),
        }}
      >
        {look.icon ?? (node.order || '•')}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: current ? flow.blue : planned ? flow.textMuted : flow.text }}>{name}</Typography>
          <Tag color={look.main} soft={planned ? flow.mutedSoft : look.soft}>
            {t(`approvalBar.state.${node.state}`)}
          </Tag>
          {node.superseded && <Tag color={flow.amber} soft={flow.amberSoft}>{t('approvalBar.earlierRound')}</Tag>}
          {node.round > 1 && <Tag color={flow.amber} soft={flow.amberSoft}>{t('approvalBar.round', { round: node.round })}</Tag>}
        </Stack>

        {planned ? (
          <Typography sx={{ fontSize: 12.5, color: flow.textMuted, mt: 0.25 }}>
            {t('approvalBar.plannedHint')}
            {node.rule === 'All' ? ` · ${t('approvalBar.ruleAll')}` : ''}
          </Typography>
        ) : (
          <>
            {node.state !== 'Submitted' && (
              <Typography sx={{ fontSize: 12.5, color: flow.textMuted, mt: 0.25 }}>
                {node.assignees.join('، ')}
                {/* The rule matters once a stage has several approvers. */}
                {node.assignees.length > 1 || node.rule === 'All' ? ` · ${t(node.rule === 'All' ? 'approvalBar.ruleAll' : 'approvalBar.ruleAny')}` : ''}
              </Typography>
            )}
            <Typography sx={{ fontSize: 12, color: flow.textMuted, mt: 0.25 }}>
              {node.state !== 'Submitted' && node.openedAt && (
                <>
                  {t('approvalBar.assignedOn', { date: short(node.openedAt) })}
                  {node.decidedAt || current ? ' · ' : ''}
                </>
              )}
              {current && t('approvalBar.awaitingDecision')}
              {node.decidedAt && node.state !== 'Canceled' && (
                <>
                  {t(decidedLabel, { date: short(node.decidedAt) })}
                  {node.decidedBy ? ` — ${node.decidedBy}` : ''}
                </>
              )}
              {node.onBehalfOf && ` (${t('tracker.onBehalf', { name: node.onBehalfOf })})`}
            </Typography>
          </>
        )}

        {node.comment && (
          <Typography sx={{ mt: 0.75, px: 1.25, py: 0.75, fontSize: 12.5, borderRadius: '8px', bgcolor: '#F6F8FC', border: `1px solid ${flow.border}`, color: flow.text, whiteSpace: 'pre-wrap' }}>
            {node.comment}
          </Typography>
        )}

        {current && (actions?.onApprove || actions?.onReject || canReturn) && (
          <Stack direction="row" sx={{ gap: 1, mt: 1.25, flexWrap: 'wrap' }}>
            {actions?.onApprove && (
              <Button
                variant="contained"
                disableElevation
                startIcon={<CheckIcon />}
                onClick={actions.onApprove}
                sx={{ height: 34, borderRadius: '8px', fontWeight: 700, bgcolor: flow.green, '&:hover': { bgcolor: '#047857' } }}
              >
                {t('approval.approve')}
              </Button>
            )}
            {actions?.onReject && (
              <Button
                variant="outlined"
                startIcon={<CloseIcon />}
                onClick={actions.onReject}
                sx={{ height: 34, borderRadius: '8px', fontWeight: 700, color: flow.red, borderColor: '#F3B4B4', '&:hover': { borderColor: flow.red, bgcolor: flow.redSoft } }}
              >
                {t('approval.reject')}
              </Button>
            )}
            {canReturn && onReturn && (
              <Button
                variant="outlined"
                startIcon={<ReplyIcon />}
                onClick={onReturn}
                sx={{ height: 34, borderRadius: '8px', fontWeight: 700, color: flow.text, borderColor: flow.border }}
              >
                {t('approval.return')}
              </Button>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function Tag({ color, soft, children }: { color: string; soft: string; children: ReactNode }) {
  return (
    <Box component="span" sx={{ px: 0.9, py: 0.1, borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color, bgcolor: soft }}>
      {children}
    </Box>
  );
}
