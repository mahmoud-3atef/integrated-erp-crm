import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ReplyIcon from '@mui/icons-material/Reply';
import { Box, Button, CircularProgress, IconButton, ListItemIcon, Menu, MenuItem, Skeleton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApprovalStatus } from '../../api/workflow';
import { fit, pathNodes, stageNodes, type BarItem, type StageNode, type StageState } from './approvalModel';

/**
 * The approval colours (spec 16 §6, HR tokens): blue for the current stage and links, green for done, muted for what
 * is ahead. Used by the bar and its drawer only; the pages keep their own record colours.
 */
export const flow = {
  blue: '#2563EB',
  blueSoft: '#E8EFFE',
  green: '#059669',
  greenSoft: '#E3F5EE',
  red: '#DC2626',
  redSoft: '#FDECEC',
  amber: '#D97706',
  amberSoft: '#FDF1E1',
  muted: '#94A3B8',
  mutedSoft: '#F1F5F9',
  text: '#0F2747',
  textMuted: '#64748B',
  border: '#E2E8F0',
  // The track's own green and red (the old system's approval track): done links and «موافقة», rejections and «رفض».
  done: '#23A455',
  doneSoft: '#E9F8EF',
  rejected: '#E03434',
};

export const stateLook: Record<StageState, { main: string; soft: string; icon: ReactNode | null }> = {
  Submitted: { main: flow.green, soft: flow.greenSoft, icon: <CheckIcon /> },
  Done: { main: flow.green, soft: flow.greenSoft, icon: <CheckIcon /> },
  Current: { main: flow.blue, soft: flow.blueSoft, icon: null },
  Rejected: { main: flow.red, soft: flow.redSoft, icon: <CloseIcon /> },
  Returned: { main: flow.amber, soft: flow.amberSoft, icon: <ReplyIcon /> },
  Canceled: { main: flow.muted, soft: flow.mutedSoft, icon: <BlockIcon /> },
  Planned: { main: flow.muted, soft: '#fff', icon: null },
};

export interface BarMenuAction {
  key: string;
  label: string;
  icon: ReactNode;
  color?: string;
  onClick: () => void;
}

/** What the current user may do on the current stage, from the server's available actions only. */
export interface BarActions {
  onApprove?: () => void;
  onReject?: () => void;
  /** «موافقة» was pressed and the decision is on its way. */
  approving?: boolean;
  /** Less frequent actions (return, delegate, cancel), in the ⋯ menu beside the current stage. */
  more?: BarMenuAction[];
}

/** Day and time, and how long ago, in the reader's language (Riyadh time). */
export function useWhen() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  const short = (value: string) =>
    new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const day = (value: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const ago = (value: string) => {
    const minutes = (Date.now() - new Date(value).getTime()) / 60000;
    const format = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
    if (minutes < 60) {
      return format.format(-Math.max(1, Math.round(minutes)), 'minute');
    }
    if (minutes < 60 * 24) {
      return format.format(-Math.round(minutes / 60), 'hour');
    }
    return format.format(-Math.round(minutes / 60 / 24), 'day');
  };
  return { short, day, ago };
}

/** A stage's name in the reader's language (the submission has its own label). */
export function useStageName() {
  const { t, i18n } = useTranslation();
  return (node: StageNode) => (node.state === 'Submitted' ? t('approvalBar.submitted') : i18n.language === 'ar' ? node.nameAr : node.nameEn);
}

/**
 * GlobalCompactApprovalBar (spec 16 §3.1, v1.2): the old system's approval track made compact. A header line (title,
 * stages done, the approval's state and «عرض كل المراحل»), then the stages: a circle with the initials of who decided
 * (a green check when done), the stage and who and when beneath, and on each link the time the stage took. The
 * current stage is blue with «موافقة» and «رفض» side by side after it, for every reader while the approval runs (the
 * server decides who may; the page answers the others). Distant stages fold into chips.
 */
export function GlobalCompactApprovalBar({
  status,
  actions,
  loadingActions,
  onViewAll,
}: {
  status: ApprovalStatus;
  actions?: BarActions;
  /** The user's actions are still loading: a placeholder keeps the row from jumping. */
  loadingActions?: boolean;
  onViewAll: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const phone = !useMediaQuery(theme.breakpoints.up('sm'));
  const { day } = useWhen();

  const nodes = pathNodes(stageNodes(status));
  const running = status.status === 'InProgress';
  const canAct = running && !!(actions?.onApprove || actions?.onReject || actions?.more?.length);
  const ended = status.status !== 'InProgress' && status.status !== 'Failed';
  const done = nodes.filter((n) => n.state === 'Done').length;
  const stages = nodes.filter((n) => n.state !== 'Submitted').length;
  // Fold distant stages by the room the track really has.
  const space = useWidth();
  // The widths are estimates: when the stages still overflow once drawn, fold one more step (again on each resize).
  const [list, setList] = useState<HTMLElement | null>(null);
  const [tighten, setTighten] = useState(0);
  useEffect(() => setTighten(0), [space.width]);
  const items = fit(nodes, space.width - 24 - tighten * 110, (canAct || !!loadingActions) && !phone, tighten > 0);
  useLayoutEffect(() => {
    if (list && list.scrollWidth > list.clientWidth + 1 && tighten < 8) {
      setTighten((n) => n + 1);
    }
  });
  const endedAt = [...status.history].reverse().find((h) => h.kind === 'Completed')?.at;
  const state = ended ? outcomeLook(status.status) : { main: flow.blue, soft: flow.blueSoft, icon: null };

  return (
    <Box
      component="section"
      ref={space.ref}
      aria-label={t('approvalBar.label')}
      sx={{
        mb: 1.75,
        bgcolor: '#fff',
        border: `1px solid ${flow.border}`,
        borderRadius: '12px',
        boxShadow: '0 1px 2px rgba(15, 39, 71, .05)',
        px: { xs: 1.5, md: 2 },
        pt: 1,
        pb: 1.25,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.75, minWidth: 0 }}>
        <Box aria-hidden sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: flow.blueSoft, color: flow.blue, flex: '0 0 auto' }}>
          <AccountTreeOutlinedIcon sx={{ fontSize: 15 }} />
        </Box>
        <Typography component="h2" sx={{ fontSize: 13.5, fontWeight: 800, color: flow.text, whiteSpace: 'nowrap' }}>
          {t('approvalBar.title')}
        </Typography>
        {stages > 0 && (
          <Typography sx={{ fontSize: 12, color: flow.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t('approvalBar.doneOf', { done, count: stages })}
          </Typography>
        )}
        <Box
          role="status"
          sx={{
            marginInlineStart: 'auto',
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.25,
            py: 0.3,
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            color: state.main,
            bgcolor: state.soft,
            '& svg': { fontSize: 15 },
          }}
        >
          {state.icon}
          {running ? t('approvalBar.inProgress') : t(`approval.instance.${status.status}`)}
          {ended && endedAt && <bdi>{day(endedAt)}</bdi>}
        </Box>
        <Button
          size="small"
          onClick={onViewAll}
          aria-label={t('approvalBar.viewAll')}
          startIcon={phone ? undefined : <FormatListBulletedIcon />}
          sx={{
            flex: '0 0 auto',
            height: 28,
            borderRadius: 999,
            px: phone ? 0.75 : 1.25,
            minWidth: phone ? 32 : undefined,
            fontSize: 12,
            fontWeight: 700,
            color: flow.blue,
            border: `1px solid ${flow.border}`,
            whiteSpace: 'nowrap',
            '&:hover': { borderColor: flow.blue, bgcolor: flow.blueSoft },
          }}
        >
          {phone ? <FormatListBulletedIcon fontSize="small" /> : t('approvalBar.viewAll')}
        </Button>
      </Stack>

      <Box
        component="ol"
        ref={setList}
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', alignItems: 'flex-start', overflowX: 'auto', scrollbarWidth: 'thin', pt: 0.5 }}
      >
        {items.map((item, index) => (
          <Fragment key={item.kind === 'node' ? item.node.key : `more-${item.side}`}>
            {index > 0 && <Connector from={items[index - 1]} to={item} />}
            {item.kind === 'more' ? (
              <MoreChip item={item} onClick={onViewAll} compact={phone} />
            ) : (
              <Box component="li" sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <Node node={item.node} status={status} />
                {/* «موافقة» then «رفض», side by side after the current stage. */}
                {item.node.state === 'Current' && (canAct || loadingActions) && !phone && (
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, pt: 0.5 }}>
                    {loadingActions && !canAct ? (
                      <>
                        <Skeleton variant="rounded" width={86} height={30} sx={{ borderRadius: 999 }} />
                        <Skeleton variant="rounded" width={70} height={30} sx={{ borderRadius: 999 }} />
                      </>
                    ) : (
                      <>
                        {actions?.onApprove && <ApproveButton onClick={actions.onApprove} busy={actions.approving} />}
                        {actions?.onReject && <RejectButton onClick={actions.onReject} disabled={actions.approving} />}
                        {!!actions?.more?.length && <MoreMenu items={actions.more} />}
                      </>
                    )}
                  </Stack>
                )}
              </Box>
            )}
          </Fragment>
        ))}
      </Box>

      {/* On a phone the decision stays in reach: a sticky area at the bottom of the screen. */}
      {phone && canAct && (
        <Box
          sx={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            zIndex: theme.zIndex.appBar,
            bgcolor: '#fff',
            borderTop: `1px solid ${flow.border}`,
            boxShadow: '0 -4px 14px rgba(15, 39, 71, .08)',
            px: 2,
            py: 1.25,
          }}
        >
          <Decisions actions={actions!} />
        </Box>
      )}
    </Box>
  );
}

/** Unicode first-strong isolation, so names keep their own direction inside a sentence. */
const isolate = (text: string) => String.fromCharCode(0x2068) + text + String.fromCharCode(0x2069);

/** The first letters of a name's first two words («Belal Harbi» → BH), for the stage's circle. */
export function initials(name: string | null | undefined) {
  const words = (name ?? '').trim().split(/[\s._-]+/).filter(Boolean);
  return words.length === 0 ? '' : words.slice(0, 2).map((w) => Array.from(w)[0]!.toUpperCase()).join('');
}

/** The element's width, measured once it is on the page (it may mount after a loading state) and on every resize. */
function useWidth() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(1200);
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 1200));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref: setElement, width };
}

const lastOf = (item: BarItem | undefined) => (item?.kind === 'node' ? item.node : item?.nodes.at(-1));
const firstOf = (item: BarItem | undefined) => (item?.kind === 'node' ? item.node : item?.nodes[0]);

function outcomeLook(status: ApprovalStatus['status']) {
  return status === 'Approved'
    ? stateLook.Done
    : status === 'Rejected'
      ? stateLook.Rejected
      : status === 'Returned'
        ? stateLook.Returned
        : stateLook.Canceled;
}

/** The decisions on a phone: approve, reject and the menu side by side at full touch size. */
function Decisions({ actions }: { actions: BarActions }) {
  return (
    <Stack direction="row" sx={{ gap: 1, '& > .MuiButton-root': { flex: 1, height: 44 } }}>
      {actions.onApprove && <ApproveButton onClick={actions.onApprove} busy={actions.approving} />}
      {actions.onReject && <RejectButton onClick={actions.onReject} disabled={actions.approving} />}
      {!!actions.more?.length && <MoreMenu items={actions.more} large />}
    </Stack>
  );
}

const pill = {
  height: 30,
  px: 1.75,
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  color: '#fff',
  boxShadow: '0 2px 6px rgba(15, 39, 71, .14)',
  '& .MuiButton-startIcon': { marginInlineEnd: 0.5, '& svg': { fontSize: 16 } },
  '&:focus-visible': { outline: `2px solid ${flow.blue}`, outlineOffset: 2 },
} as const;

function ApproveButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="contained"
      disableElevation
      onClick={onClick}
      disabled={busy}
      startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <CheckIcon />}
      sx={{ ...pill, bgcolor: flow.done, '&:hover': { bgcolor: '#1b8a47' }, '&.Mui-disabled': { bgcolor: flow.done, color: '#fff', opacity: 0.8 } }}
    >
      {busy ? t('approvalBar.approving') : t('approvalBar.approve')}
    </Button>
  );
}

function RejectButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <Button variant="contained" disableElevation onClick={onClick} disabled={disabled} startIcon={<CloseIcon />} sx={{ ...pill, bgcolor: flow.rejected, '&:hover': { bgcolor: '#c42a2a' } }}>
      {t('approval.reject')}
    </Button>
  );
}

function MoreMenu({ items, large }: { items: BarMenuAction[]; large?: boolean }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title={t('approvalBar.moreActions')}>
        <IconButton
          aria-label={t('approvalBar.moreActions')}
          aria-haspopup="menu"
          aria-expanded={!!anchor}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ width: large ? 44 : 30, height: large ? 44 : 30, border: `1px solid ${flow.border}`, borderRadius: 999, color: flow.text }}
        >
          <MoreHorizIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {items.map((item) => (
          <MenuItem
            key={item.key}
            onClick={() => {
              setAnchor(null);
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
  );
}

/** How long a stage took, short («22 س», «أقل من دقيقة»). */
function useDuration() {
  const { t } = useTranslation();
  return (from: string, to: string) => {
    const minutes = (new Date(to).getTime() - new Date(from).getTime()) / 60000;
    return minutes < 1
      ? t('approvalBar.took.lessThanMinute')
      : minutes < 60
        ? t('approvalBar.took.minutes', { count: Math.round(minutes) })
        : minutes < 60 * 24
          ? t('approvalBar.took.hours', { count: Math.round(minutes / 60) })
          : t('approvalBar.took.days', { count: Math.round(minutes / 60 / 24) });
  };
}

/**
 * The link between two stages, behind the circles: solid green toward a done stage (with the time it took), blue
 * toward the current one, dashed grey toward what is ahead, dashed red toward a rejection.
 */
function Connector({ from, to }: { from: BarItem | undefined; to: BarItem }) {
  const took = useDuration();
  const before = lastOf(from);
  const after = firstOf(to);
  const state = after?.state;
  const decided = state === 'Done' || state === 'Rejected' || state === 'Returned';
  const label = decided && before?.decidedAt && after?.decidedAt ? took(before.decidedAt, after.decidedAt) : null;
  const look =
    state === 'Done'
      ? { background: flow.done }
      : state === 'Current'
        ? { background: flow.blue }
        : state === 'Rejected'
          ? { background: `repeating-linear-gradient(90deg, ${flow.rejected} 0 7px, transparent 7px 12px)` }
          : { background: `repeating-linear-gradient(90deg, #8a9aa6 0 5px, transparent 5px 10px)` };
  return (
    <Box component="li" aria-hidden sx={{ position: 'relative', flex: '1 1 0', minWidth: 44, maxWidth: 220, height: 34, mx: -1.5 }}>
      <Box sx={{ position: 'absolute', top: 16, insetInline: 0, height: 2.5, borderRadius: 2, ...look }} />
      {label && (
        <Box
          component="span"
          sx={{
            position: 'absolute',
            top: -1,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 0.75,
            bgcolor: '#fff',
            color: state === 'Rejected' ? flow.rejected : flow.textMuted,
            fontSize: 10.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Box>
      )}
    </Box>
  );
}

/** A chip standing for stages folded away («+3 مراحل»); it opens the drawer with all of them. */
function MoreChip({ item, onClick, compact }: { item: Extract<BarItem, { kind: 'more' }>; onClick: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const name = useStageName();
  const allDone = item.nodes.every((n) => n.state === 'Done' || n.state === 'Submitted');
  const label = allDone ? t('approvalBar.moreDone', { count: item.nodes.length }) : t('approvalBar.moreStages', { count: item.nodes.length });
  return (
    <Box component="li" sx={{ flex: '0 0 auto', position: 'relative', zIndex: 1, pt: 0.6 }}>
      <Tooltip title={item.nodes.map(name).join(' ← ')}>
        <Box
          component="button"
          type="button"
          onClick={onClick}
          aria-label={label}
          sx={{
            border: `1px solid ${allDone ? '#bfe6cc' : flow.border}`,
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 12,
            fontWeight: 700,
            color: allDone ? '#157a3c' : flow.textMuted,
            bgcolor: allDone ? flow.doneSoft : flow.mutedSoft,
            borderRadius: 999,
            px: 1.25,
            py: 0.4,
            whiteSpace: 'nowrap',
            '&:hover': { filter: 'brightness(.97)' },
            '&:focus-visible': { outline: `2px solid ${flow.blue}`, outlineOffset: 2 },
          }}
        >
          {compact ? `+${item.nodes.length}` : label}
        </Box>
      </Tooltip>
    </Box>
  );
}

/** One stage: a circle with the initials of who decided (or who it waits for), its name, then who and when. */
function Node({ node, status }: { node: StageNode; status: ApprovalStatus }) {
  const { t } = useTranslation();
  const name = useStageName()(node);
  const { short, ago } = useWhen();
  const look = stateLook[node.state];
  const current = node.state === 'Current';
  const planned = node.state === 'Planned';
  const waiting = status.waitingFor.length ? status.waitingFor : node.assignees;
  const who = current ? waiting[0] : (node.decidedBy ?? node.assignees[0]);
  const mark = planned ? '?' : initials(who) || String(node.order);

  // Each part isolated in its own <bdi>: Arabic names beside English times (and the reverse) keep their order.
  const names = waiting.slice(0, 2).join('، ') + (waiting.length > 2 ? ` +${waiting.length - 2}` : '');
  const parts: string[] = current
    ? [`${t('approvalBar.waitingFor')} ${isolate(names)}`, node.openedAt ? ago(node.openedAt) : '']
    : planned
      ? [t('approvalBar.plannedShort')]
      : node.state === 'Canceled'
        ? [t('approvalBar.state.Canceled')]
        : [node.decidedBy ?? '', node.decidedAt ? short(node.decidedAt) : ''];
  const detail = parts.filter(Boolean);
  const circle = current
    ? { width: 38, height: 38, mt: '-2px', bgcolor: flow.blue, color: '#fff', border: `3px solid ${flow.blue}`, boxShadow: `0 0 0 4px ${flow.blueSoft}` }
    : planned
      ? { bgcolor: '#33444f', color: '#cfd9e1', border: '2px dashed #5d6f7d' }
      : { bgcolor: look.soft, color: look.main === flow.green ? '#157a3c' : look.main, border: `2px solid ${look.main === flow.green ? flow.done : look.main}` };

  return (
    <Tooltip
      title={
        <Box sx={{ fontSize: 12, lineHeight: 1.7 }}>
          <div>
            <b>{name}</b> — {t(`approvalBar.state.${node.state}`)}
          </div>
          {node.assignees.length > 0 && !planned && <div>{node.assignees.join('، ')}</div>}
          {node.rule === 'All' && node.state !== 'Submitted' && <div>{t('approvalBar.ruleAll')}</div>}
          {node.round > 1 && <div>{t('approvalBar.round', { round: node.round })}</div>}
          {planned && <div>{t('approvalBar.plannedHint')}</div>}
          {node.comment && <div>«{node.comment}»</div>}
        </Box>
      }
    >
      <Stack
        tabIndex={0}
        aria-label={`${name} — ${t(`approvalBar.state.${node.state}`)}${detail.length ? ` — ${detail.join(' · ')}` : ''}`}
        aria-current={current ? 'step' : undefined}
        sx={{
          position: 'relative',
          zIndex: 1,
          alignItems: 'center',
          textAlign: 'center',
          width: current ? 150 : planned ? 104 : 124,
          gap: '1px',
          borderRadius: '8px',
          '&:focus-visible': { outline: `2px solid ${flow.blue}`, outlineOffset: 2 },
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'relative',
            width: 34,
            height: 34,
            mb: '3px',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '.3px',
            ...circle,
          }}
        >
          <bdi>{mark}</bdi>
          {look.icon && !current && !planned && (
            <Box
              sx={{
                position: 'absolute',
                bottom: -4,
                insetInlineStart: -4,
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid #fff',
                bgcolor: look.main === flow.green ? flow.done : look.main,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                '& svg': { fontSize: 10 },
              }}
            >
              {look.icon}
            </Box>
          )}
        </Box>
        <Typography
          sx={{
            maxWidth: '100%',
            fontSize: 12.5,
            fontWeight: 800,
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: current ? flow.blue : planned ? flow.textMuted : flow.text,
          }}
        >
          {name}
          {node.round > 1 && (
            <Box component="span" sx={{ marginInlineStart: 0.5, fontSize: 10.5, fontWeight: 700, color: flow.amber }}>
              {t('approvalBar.round', { round: node.round })}
            </Box>
          )}
        </Typography>
        {detail.length > 0 && (
          <Typography
            sx={{
              maxWidth: '100%',
              fontSize: 11,
              lineHeight: 1.35,
              color: current ? flow.blue : flow.textMuted,
              fontWeight: current ? 700 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {detail.map((part, index) => (
              <Fragment key={index}>
                {index > 0 && ' · '}
                <bdi>{part}</bdi>
              </Fragment>
            ))}
          </Typography>
        )}
      </Stack>
    </Tooltip>
  );
}
