import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ReplyIcon from '@mui/icons-material/Reply';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Box, Button, Collapse, IconButton, ListItemIcon, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApprovalStatus } from '../api/workflow';
import { tokens } from '../app/theme';

const flow = {
  done: '#1f9d55',
  doneBg: '#e7f6ee',
  current: '#1f6fd1',
  currentBg: '#eaf2fd',
  rejected: '#d93636',
  rejectedBg: '#fdeeee',
  returned: tokens.warning,
  returnedBg: '#fdf3e1',
  muted: tokens.gray500,
  mutedBg: tokens.gray100,
  future: '#a3b1bd',
};

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(31, 111, 209, .40); }
  70% { box-shadow: 0 0 0 8px rgba(31, 111, 209, 0); }
  100% { box-shadow: 0 0 0 0 rgba(31, 111, 209, 0); }
`;

type NodeState = 'Done' | 'Current' | 'Rejected' | 'Returned' | 'Canceled' | 'Submitted' | 'Future';

interface Node {
  key: string;
  state: NodeState;
  name: string;
  owner: string;
  onBehalfOf?: string | null;
  others: string[];
  started: string;
  ended: string | null;
  comment?: string | null;
}

const colors: Record<NodeState, { main: string; soft: string }> = {
  Done: { main: flow.done, soft: flow.doneBg },
  Submitted: { main: flow.done, soft: flow.doneBg },
  Current: { main: flow.current, soft: flow.currentBg },
  Rejected: { main: flow.rejected, soft: flow.rejectedBg },
  Returned: { main: flow.returned, soft: flow.returnedBg },
  Canceled: { main: flow.muted, soft: flow.mutedBg },
  Future: { main: flow.future, soft: '#fff' },
};

export interface TrackerMenuAction {
  key: string;
  label: string;
  icon: ReactNode;
  color?: string;
  onClick: () => void;
}

export interface TrackerActions {
  onApprove?: () => void;
  onReject?: () => void;
  /** The less frequent actions (return, delegate, cancel), in a menu beside approve / reject. */
  more?: TrackerMenuAction[];
}

/**
 * Where an approval stands, in one slim bar above the record: a stepper of the submission and every stage — each
 * circle between the day it opened and the day it was decided, with how long it took — then who the current stage waits
 * for and its actions, or the approval's end state. The details (who, when, the comment) fold under it; the full log is
 * the record's approval tab.
 */
export function StageTracker({ status, actions }: { status: ApprovalStatus; actions?: TrackerActions }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('erp.tracker.open') === '1';
    } catch {
      return false;
    }
  });
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem('erp.tracker.open', open ? '0' : '1');
    } catch {
      // Remembering the choice is only a convenience.
    }
  };

  const date = (value: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const day = (value: string) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(value));

  const nodes: Node[] = [
    { key: 'submitted', state: 'Submitted', name: t('tracker.submitted'), owner: status.submittedBy, others: [], started: status.submittedAt, ended: status.submittedAt },
    ...status.stages.map((stage, index) => ({
      key: `${stage.stepId}-${index}`,
      state: stage.state as NodeState,
      name: ar ? stage.nameAr : stage.nameEn,
      owner: stage.decidedBy ?? stage.assignees[0] ?? '—',
      onBehalfOf: stage.onBehalfOf,
      others: stage.decidedBy ? [] : stage.assignees.slice(1),
      started: stage.openedAt,
      ended: stage.decidedAt,
      comment: stage.comment,
    })),
  ];
  const running = status.status === 'InProgress';
  if (running) {
    nodes.push({ key: 'future', state: 'Future', name: t('tracker.future'), owner: t('tracker.futureHint'), others: [], started: '', ended: null });
  }

  const current = nodes.find((n) => n.state === 'Current');
  const finished = status.stages.filter((s) => s.state === 'Done').length;
  const pill =
    status.status === 'Approved'
      ? colors.Done
      : status.status === 'Rejected' || status.status === 'Failed'
        ? colors.Rejected
        : status.status === 'Returned'
          ? colors.Returned
          : status.status === 'Canceled'
            ? colors.Canceled
            : colors.Current;
  const canDecide = !!(actions?.onApprove || actions?.onReject);
  const more = actions?.more ?? [];

  return (
    <Box
      sx={{
        mb: `${tokens.gap}px`,
        bgcolor: '#fff',
        border: `1px solid ${tokens.border}`,
        borderRadius: `${tokens.radiusLg}px`,
        boxShadow: tokens.shadowSm,
        overflow: 'hidden',
        position: 'relative',
        // The approval's state as a thin band on the reading edge.
        '&::before': { content: '""', position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: 4, bgcolor: pill.main },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
          alignItems: 'center',
          columnGap: 2.5,
          rowGap: 1.5,
          px: { xs: 2, md: 2.5 },
          py: 1.5,
        }}
      >
        {/* The path. */}
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', overflowX: 'auto', pb: 0.25 }}>
          {nodes.map((node, index) => (
            <Step key={node.key} node={node} first={index === 0} next={nodes[index + 1]?.state} date={date} day={day} />
          ))}
        </Box>

        {/* The current stage: who it waits for, since when, and what the user can do. */}
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, justifyContent: { xs: 'space-between', md: 'flex-end' }, flexWrap: 'wrap' }}>
          <Tooltip title={`${ar ? status.processNameAr : status.processNameEn} — ${t('tracker.count', { done: finished, total: status.stages.length })}`}>
            <Box sx={{ minWidth: 0, maxWidth: 200 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.25,
                  py: 0.35,
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  color: pill.main,
                  bgcolor: pill.soft,
                  border: `1px solid ${pill.main}40`,
                  '& svg': { fontSize: 16 },
                }}
              >
                {status.status === 'Approved' ? <CheckIcon /> : status.status === 'Rejected' || status.status === 'Failed' ? <CloseIcon /> : status.status === 'Returned' ? <ReplyIcon /> : null}
                {t(`approval.instance.${status.status}`)}
              </Box>
              {current && (
                <Typography sx={{ mt: 0.4, fontSize: 12.5, color: tokens.gray600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t('tracker.waitingFor')}{' '}
                  <Box component="b" sx={{ color: tokens.navy800 }}>
                    {(status.waitingFor.length ? status.waitingFor : [current.owner]).slice(0, 2).join('، ')}
                    {status.waitingFor.length > 2 ? ` +${status.waitingFor.length - 2}` : ''}
                  </Box>
                </Typography>
              )}
            </Box>
          </Tooltip>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
            {canDecide && actions?.onApprove && (
              <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />} onClick={actions.onApprove} sx={{ px: 2 }}>
                {t('approval.approve')}
              </Button>
            )}
            {canDecide && actions?.onReject && (
              <Button size="small" variant="outlined" color="error" startIcon={<CloseIcon />} onClick={actions.onReject}>
                {t('approval.reject')}
              </Button>
            )}
            {more.length > 0 && (
              <>
                <Tooltip title={t('tracker.moreActions')}>
                  <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} sx={{ border: `1px solid ${tokens.border}`, borderRadius: '10px' }}>
                    <MoreHorizIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
                  {more.map((item) => (
                    <MenuItem
                      key={item.key}
                      onClick={() => {
                        setMenu(null);
                        item.onClick();
                      }}
                      sx={{ fontSize: 13.5, color: item.color }}
                    >
                      <ListItemIcon sx={{ color: item.color ?? 'inherit', '& svg': { fontSize: 19 } }}>{item.icon}</ListItemIcon>
                      {item.label}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )}
            <Tooltip title={open ? t('tracker.hideDetails') : t('tracker.showDetails')}>
              <IconButton size="small" aria-expanded={open} onClick={toggle} sx={{ color: tokens.gray600 }}>
                <ExpandMoreIcon sx={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      {/* The details of every stage, folded. */}
      <Collapse in={open} unmountOnExit>
        <Box sx={{ borderTop: `1px solid ${tokens.gray100}`, bgcolor: tokens.gray50, px: { xs: 2, md: 2.5 }, py: 1 }}>
          {nodes
            .filter((n) => n.state !== 'Future')
            .map((node) => (
              <Box
                key={node.key}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 1.4fr) minmax(160px, 1.2fr) 150px 90px minmax(0, 2fr)' },
                  gap: { xs: 0.25, md: 2 },
                  alignItems: 'center',
                  py: 0.9,
                  fontSize: 12.5,
                  color: tokens.gray600,
                  '&:not(:last-of-type)': { borderBottom: `1px dashed ${tokens.border}` },
                }}
              >
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors[node.state].main, flex: '0 0 auto' }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{node.name}</Typography>
                  <Box sx={{ px: 0.9, borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: colors[node.state].main, bgcolor: colors[node.state].soft }}>{t(`tracker.state.${node.state}`)}</Box>
                </Stack>
                <span>
                  {[node.owner, ...node.others].join('، ')}
                  {node.onBehalfOf && <Box component="span" sx={{ color: tokens.gray500 }}> — {t('tracker.onBehalf', { name: node.onBehalfOf })}</Box>}
                </span>
                <span>{date(node.ended ?? node.started)}</span>
                <span>{node.state === 'Submitted' ? '' : duration(t, node.started, node.ended)}</span>
                <Box component="span" sx={{ color: tokens.gray500, fontStyle: node.comment ? 'normal' : 'italic' }}>
                  {node.comment ? `«${node.comment}»` : ''}
                </Box>
              </Box>
            ))}
        </Box>
      </Collapse>
    </Box>
  );
}

const lineColor = (state: NodeState) => (state === 'Submitted' ? flow.done : colors[state].main);

/** Half of the line between two stages; dashed toward a stage not reached yet. */
function Half({ state }: { state: NodeState | null }) {
  return (
    <Box
      aria-hidden
      sx={{
        flex: '1 1 0',
        minWidth: 10,
        height: 2,
        borderRadius: 2,
        visibility: state ? 'visible' : 'hidden',
        ...(state === 'Future' ? { background: `repeating-linear-gradient(90deg, ${flow.future} 0 5px, transparent 5px 9px)` } : { bgcolor: state ? lineColor(state) : 'transparent' }),
      }}
    />
  );
}

/** A day beside a circle: before it the day the stage opened, after it the day it was decided. */
function Day({ children }: { children?: ReactNode }) {
  return (
    <Typography component="span" sx={{ flex: '0 0 auto', mx: 0.5, fontSize: 11, fontWeight: 600, color: tokens.gray500, whiteSpace: 'nowrap', minWidth: children ? undefined : 0 }}>
      {children}
    </Typography>
  );
}

/**
 * One stage on the path: its circle between the day it opened and the day it was decided, the line to its neighbours,
 * then its name, who, and how long it took (or has been open).
 */
function Step({ node, first, next, date, day }: { node: Node; first: boolean; next?: NodeState; date: (v: string) => string; day: (v: string) => string }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const color = colors[node.state];
  const current = node.state === 'Current';
  const future = node.state === 'Future';
  const submitted = node.state === 'Submitted';
  const mark =
    node.state === 'Done' ? (
      <CheckIcon />
    ) : submitted ? (
      <SendOutlinedIcon sx={{ transform: rtl ? 'scaleX(-1)' : 'none' }} />
    ) : node.state === 'Rejected' ? (
      <CloseIcon />
    ) : node.state === 'Returned' ? (
      <ReplyIcon />
    ) : future ? (
      '?'
    ) : (
      '•'
    );

  return (
    <Box component="li" sx={{ flex: '1 1 0', minWidth: future ? 96 : 135, textAlign: 'center' }}>
      <Stack direction="row" sx={{ alignItems: 'center', height: 30 }}>
        <Half state={first ? null : node.state} />
        {!future && <Day>{submitted ? '' : day(node.started)}</Day>}
        <Tooltip
          title={
            future ? (
              node.owner
            ) : (
              <Box sx={{ fontSize: 12, lineHeight: 1.7 }}>
                <div>{[node.owner, ...node.others].join('، ')}</div>
                {node.onBehalfOf && <div>{t('tracker.onBehalf', { name: node.onBehalfOf })}</div>}
                <div>{date(node.ended ?? node.started)}</div>
                {node.comment && <div>«{node.comment}»</div>}
              </Box>
            )
          }
        >
          <Box
            sx={{
              flex: '0 0 auto',
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              fontSize: current ? 22 : 12.5,
              lineHeight: 1,
              fontWeight: 800,
              '& svg': { fontSize: 16 },
              ...(future
                ? { border: `2px dashed ${flow.future}`, color: flow.future, bgcolor: '#fff' }
                : current
                  ? { bgcolor: '#fff', color: flow.current, border: `2px solid ${flow.current}`, animation: `${pulse} 1.8s infinite` }
                  : { bgcolor: color.main, color: '#fff' }),
            }}
          >
            {mark}
          </Box>
        </Tooltip>
        {!future && <Day>{node.ended ? day(node.ended) : current ? '…' : ''}</Day>}
        <Half state={next ?? null} />
      </Stack>
      <Typography
        sx={{ mt: 0.5, px: 1, fontSize: 12.5, fontWeight: current ? 800 : 700, color: future ? flow.future : current ? flow.current : tokens.navy800, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {node.name}
      </Typography>
      <Stack direction="row" sx={{ justifyContent: 'center', alignItems: 'center', gap: 0.75, mt: 0.25, px: 1, minWidth: 0 }}>
        {!future && (
          <Typography component="span" sx={{ fontSize: 11, color: tokens.gray500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            {node.owner}
          </Typography>
        )}
        {!future && !submitted && (
          <Box
            component="span"
            sx={{
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.35,
              px: 0.8,
              py: 0.1,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              ...(current ? { color: '#b45309', bgcolor: '#fff4e0' } : { color: '#6b3fc4', bgcolor: '#f1ebfc' }),
              '& svg': { fontSize: 13 },
            }}
          >
            <TimerOutlinedIcon />
            {duration(t, node.started, node.ended)}
          </Box>
        )}
      </Stack>
    </Box>
  );
}

/** "less than a minute", "5 min", "2 h", "11 days". */
function duration(t: (key: string, options?: Record<string, unknown>) => string, from: string, to: string | null) {
  const minutes = Math.max(0, ((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 60000);
  if (minutes < 1) {
    return t('tracker.lessThanMinute');
  }
  if (minutes < 60) {
    return t('tracker.minutes', { count: Math.floor(minutes) });
  }
  if (minutes < 60 * 24) {
    return t('tracker.hours', { count: Math.floor(minutes / 60) });
  }
  return t('tracker.days', { count: Math.floor(minutes / 60 / 24) });
}
