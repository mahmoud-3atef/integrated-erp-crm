import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import BlockIcon from '@mui/icons-material/Block';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import HomeIcon from '@mui/icons-material/Home';
import LinkIcon from '@mui/icons-material/Link';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WorkIcon from '@mui/icons-material/Work';
import { Alert, Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { workforceApi, type HistoryIssue, type WorkerPeriod } from '../../api/workforce';
import { documentRoute, workerFileApi, type WorkerDocument } from '../../api/workerFile';
import { tokens } from '../../app/theme';

// The worker's actions as the old employee screen's actions tab (HR_EmployeeDetails.aspx, .cp-timeline), with its CSS
// (content/css/pages/hr-employee-details.css: «Timeline» and the later «كارت الإجراء المختصر», «تمييز نوع الإجراء» and
// «ألوان الإجراءات من الهوية» rules, folded into their final values). One card per period, latest first; the whole card
// opens the document that made it. A period of the old system without a document here opens a read-only drawer.

const DAY = 86400000;

/** The old screen's card types: work (teal) and housing (sand gold); the kinds it did not have get their own tone. */
type Look = 'work' | 'housing' | 'vacation' | 'stop' | 'out';
const lookOf: Record<string, Look | undefined> = { Work: 'work', ClientVacation: 'work', Housing: 'housing', Vacation: 'vacation', Absconded: 'stop', Suspended: 'stop', Out: 'out' };
const iconOf: Record<string, ReactNode> = {
  Work: <WorkIcon />, ClientVacation: <BeachAccessIcon />, Housing: <HomeIcon />, Vacation: <BeachAccessIcon />, Absconded: <PersonOffIcon />, Suspended: <BlockIcon />, Out: <LogoutIcon />,
};

const Timeline = styled('ol')`
  --cp-border: #e1ebf1;
  --cp-gray-200: #e1e9ef;
  --cp-text-muted: #66798a;
  --cp-navy-400: #3f86ab;
  --cp-navy-700: #0d4a6c;
  --cp-navy-800: #0a3c58;
  --cp-radius: 12px;
  --cp-shadow-md: 0 12px 30px rgba(10, 60, 88, 0.12);
  --cp-work-50: #e8f4f5;
  --cp-work-100: #bfe0e3;
  --cp-work-600: #0e7c86;
  --cp-work-700: #0a5a62;
  --cp-work-gradient: linear-gradient(135deg, #14a0ab 0%, #0a5a62 100%);
  --cp-housing-50: #faf5e8;
  --cp-housing-100: #ecdcae;
  --cp-housing-600: #b38a0f;
  --cp-housing-700: #7a5d08;
  --cp-housing-gradient: linear-gradient(135deg, #d4a82a 0%, #8f6d0a 100%);
  list-style: none;
  margin: 0;
  padding: 0;

  .timeline-item { position: relative; display: flex; gap: 16px; padding-bottom: 12px; }
  .timeline-item:not(:last-child)::before {
    content: ''; position: absolute; top: 46px; inset-inline-start: 20px; width: 2px; height: calc(100% - 40px); background: var(--cp-gray-200);
  }
  .timeline-icon {
    display: grid; place-items: center; flex: 0 0 auto; width: 42px; min-width: 42px; height: 42px; margin-top: 4px; border-radius: 50%; color: #fff;
    box-shadow: 0 0 0 4px #fff; background: var(--a-gradient);
  }
  .timeline-icon svg { font-size: 19px; }
  .timeline-current .timeline-icon { box-shadow: 0 0 0 4px var(--a-100); }

  .timeline-card {
    flex: 1; min-width: 0; padding: 10px 14px; border: 1px solid var(--a-100); border-inline-start: 5px solid var(--a-600); border-radius: var(--cp-radius);
    background: var(--a-50); text-align: start;
  }
  .timeline-card.is-link { cursor: pointer; transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s; }
  .timeline-card.is-link:hover { transform: translateY(-2px); box-shadow: var(--cp-shadow-md); }
  .timeline-card.is-link:hover .timeline-order { background: var(--cp-navy-700); border-color: var(--cp-navy-700); color: #fff; }
  .timeline-card:focus-visible { outline: 2px solid var(--cp-navy-700); outline-offset: 2px; }
  .timeline-current .timeline-card { box-shadow: 0 6px 18px var(--a-shadow); }
  .timeline-card.is-late { border-inline-start: 4px solid #c0392b; }

  .timeline-card-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .timeline-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; min-width: 0; }
  .timeline-title { font-size: 15px; font-weight: 700; color: var(--a-700); overflow-wrap: anywhere; }
  .timeline-subtitle { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12.5px; color: var(--cp-text-muted); }
  .timeline-type {
    display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 999px; background: var(--a-600); color: #fff; font-size: 11.5px; font-weight: 700;
  }
  .timeline-type svg, .timeline-order svg, .timeline-late svg { font-size: 12px; }
  .timeline-current-pill { display: inline-block; padding: 1px 10px; border-radius: 999px; background: #2fb344; color: #fff; font-size: 11px; font-weight: 600; }
  .timeline-chip {
    display: inline-block; padding: 1px 10px; border-radius: 999px; background: #fff; border: 1px solid var(--cp-border); color: var(--cp-navy-700); font-size: 11px; font-weight: 600;
  }
  .timeline-order {
    display: inline-flex; align-items: center; gap: 5px; padding: 1px 10px; border-radius: 999px; background: #fff; border: 1px solid var(--cp-border);
    color: var(--cp-navy-700); font-size: 11.5px; font-weight: 700; transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .timeline-order.is-none { color: var(--cp-text-muted); }
  .timeline-late {
    display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 999px; background: #c0392b; color: #fff; font-size: 11.5px; font-weight: 800;
    white-space: nowrap; cursor: help; box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.14);
  }

  .timeline-top-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .timeline-created {
    display: inline-flex; align-items: center; gap: 8px; padding: 3px 12px; border-radius: 999px; background: #eef6fe; border: 1px solid #cfe3f8; color: #1857a8;
    font-size: 12px; font-weight: 700; white-space: nowrap;
  }
  .timeline-created > span { display: inline-flex; align-items: center; }
  .timeline-created svg { margin-inline-end: 4px; font-size: 13px; opacity: 0.8; }
  .timeline-created .timeline-created-sep { width: 1px; height: 12px; background: #cfe3f8; }
  .timeline-badge { display: inline-flex; align-items: center; padding: 3px 12px; border-radius: 999px; background: var(--a-gradient); color: #fff; font-size: 12px; font-weight: 600; }

  .timeline-meta-row {
    display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); align-items: center; gap: 6px 14px; padding-top: 8px; border-top: 1px dashed var(--a-100);
  }
  .timeline-meta-box { display: flex; flex-direction: column; min-width: 0; }
  .timeline-meta-label { display: flex; align-items: center; font-size: 11.5px; font-weight: 500; color: var(--cp-text-muted); }
  .timeline-meta-label svg { width: 16px; margin-inline-end: 6px; font-size: 14px; color: var(--cp-navy-400); }
  .timeline-meta-value { font-size: 13px; font-weight: 600; color: var(--cp-navy-800); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .timeline-meta-value small { display: block; font-size: 11px; font-weight: 500; color: var(--cp-text-muted); }

  .a-work { --a-50: var(--cp-work-50); --a-100: var(--cp-work-100); --a-600: var(--cp-work-600); --a-700: var(--cp-work-700); --a-gradient: var(--cp-work-gradient); --a-shadow: rgba(14, 124, 134, 0.14); }
  .a-housing { --a-50: var(--cp-housing-50); --a-100: var(--cp-housing-100); --a-600: var(--cp-housing-600); --a-700: var(--cp-housing-700); --a-gradient: var(--cp-housing-gradient); --a-shadow: rgba(179, 138, 15, 0.16); }
  .a-vacation { --a-50: #f4effd; --a-100: #ddd0f8; --a-600: #7c3aed; --a-700: #5b21b6; --a-gradient: linear-gradient(135deg, #9f67fa 0%, #5b21b6 100%); --a-shadow: rgba(124, 58, 237, 0.14); }
  .a-stop { --a-50: #fdf0ef; --a-100: #f5cdc9; --a-600: #c0392b; --a-700: #8e2a20; --a-gradient: linear-gradient(135deg, #e0604f 0%, #8e2a20 100%); --a-shadow: rgba(192, 57, 43, 0.14); }
  .a-out { --a-50: #f3f6f8; --a-100: #dbe3e9; --a-600: #64748b; --a-700: #475569; --a-gradient: linear-gradient(135deg, #8a9bb0 0%, #475569 100%); --a-shadow: rgba(71, 85, 105, 0.12); }

  @media (max-width: 700px) {
    .timeline-meta-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
`;

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

/** The old screen's rule: a returned worker's housing order written more than two days after the arrival is late. */
export function lateDays(p: WorkerPeriod, document: WorkerDocument | null) {
  if (p.kind !== 'Housing' || document?.type !== 'return_order' || document.entry !== 'ReturnedWorker' || !document.createdAt) return 0;
  // The day it was written, in Riyadh.
  const written = Date.parse(new Date(Date.parse(document.createdAt) + 3 * 3600000).toISOString().slice(0, 10));
  const days = Math.round((written - Date.parse(p.startsOn)) / DAY);
  return days > 2 ? days : 0;
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
      <Timeline aria-label={t('workforce.actions.title')}>
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
      </Timeline>

      {shown && <PeriodDrawer period={shown} onClose={close} />}
    </>
  );
}

function ActionCard({ period: p, current, document, onOpen }: { period: WorkerPeriod; current: boolean; document: WorkerDocument | null; onOpen: (document: WorkerDocument | null, target: HTMLElement) => void }) {
  const { t } = useTranslation();
  const f = useActionFormat();
  const look = lookOf[p.kind] ?? 'out';
  const icon = iconOf[p.kind] ?? <LogoutIcon />;
  const priced = p.kind === 'Work' || p.kind === 'ClientVacation';
  const housing = p.kind === 'Housing';
  const days = periodDays(p);
  const late = lateDays(p, document);
  // A housing card as the old screen's: titled «السكن», its type and document only (no housing name, reason or pay).
  const title = housing ? t('workforce.actions.housing') : (p.projectName ?? t(`workforce.periods.kinds.${p.kind}`));
  const by = document?.createdByName ?? (p.fromOldSystem ? t('workforce.periods.oldSystem') : null);
  const kind = t(priced ? 'workforce.actions.kindWork' : housing ? 'workforce.actions.kindHousing' : 'workforce.actions.kindOther');
  const daysKey = days === 1 ? 'daysOne' : days === 2 ? 'daysTwo' : days >= 3 && days <= 10 ? 'daysFew' : 'daysMany';
  const label = `${title} — ${document ? t('workforce.actions.open', { no: document.no }) : t('workforce.actions.details')}`;
  const open = (target: HTMLElement) => onOpen(document, target);
  const keys = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(e.currentTarget);
    }
  };

  return (
    <li className={`timeline-item a-${look}${current ? ' timeline-current' : ''}`}>
      <div className="timeline-icon" aria-hidden>
        {icon}
      </div>
      <div className={`timeline-card is-link${late > 0 ? ' is-late' : ''}`} role="link" tabIndex={0} aria-label={label} title={label} onClick={(e) => open(e.currentTarget)} onKeyDown={keys}>
        <div className="timeline-card-top">
          <div className="timeline-head">
            <div className="timeline-title">{title}</div>
            <div className="timeline-subtitle">
              <span className="timeline-type">
                {icon}
                {priced ? t('workforce.actions.workStart') : t(`workforce.periods.kinds.${p.kind}`)}
              </span>
              {current && <span className="timeline-current-pill">{t('workforce.actions.current')}</span>}
              {p.isSpecialPrice ? (
                <span className="timeline-chip">{t('commercial.prices.status.Special')}</span>
              ) : (
                p.packageNo && (
                  <span className="timeline-chip">
                    <bdi>{p.packageNo}</bdi>
                  </span>
                )
              )}
              <span className={`timeline-order${document ? '' : ' is-none'}`}>
                <LinkIcon />
                {document ? t(`workforce.actions.documents.${document.type}`) : t(`workforce.actions.sources.${p.sourceType}`, { defaultValue: p.sourceType })}{' '}
                <bdi>{document?.no ?? p.sourceNo}</bdi>
              </span>
              {late > 0 && (
                <span className="timeline-late" title={document?.delayReason ? t('workforce.actions.lateWhy', { count: late, reason: document.delayReason }) : t('workforce.actions.lateNoReason', { count: late })}>
                  <WarningAmberIcon />
                  {t('workforce.actions.late', { count: late })}
                </span>
              )}
            </div>
          </div>

          <div className="timeline-top-actions">
            {(document?.createdAt || by) && (
              <span className="timeline-created" title={t('workforce.actions.createdTitle')}>
                {document?.createdAt && (
                  <span>
                    <EventOutlinedIcon />
                    {f.date(document.createdAt)}
                  </span>
                )}
                {document?.createdAt && by && <span className="timeline-created-sep" />}
                {by && (
                  <span>
                    <PersonOutlineIcon />
                    <bdi>{by}</bdi>
                  </span>
                )}
              </span>
            )}
            <span className="timeline-badge">{t(`workforce.actions.${daysKey}`, { count: days, kind })}</span>
          </div>
        </div>

        <div className="timeline-meta-row">
          <Meta icon={priced ? <PlayArrowIcon /> : <LoginIcon />} label={t(housing ? 'workforce.actions.housingIn' : priced ? 'workforce.actions.started' : 'workforce.periods.from')}>
            {f.date(p.startsOn)}
          </Meta>
          <Meta icon={priced ? <StopIcon /> : <LogoutIcon />} label={t(housing ? 'workforce.actions.housingOut' : priced ? 'workforce.actions.stopped' : 'workforce.periods.to')}>
            {p.endsOn ? f.date(p.endsOn) : t('workforce.actions.untilNow')}
            {p.closedByNo && (
              <small>
                <bdi>{p.closedByNo}</bdi>
              </small>
            )}
          </Meta>
          {priced && (
            <>
              <Meta icon={<AttachMoneyIcon />} label={t('workforce.actions.totalPrice')}>
                {f.riyal(p.totalPrice)}
              </Meta>
              <Meta icon={<HomeIcon />} label={t('workforce.actions.housingPrice')}>
                {f.riyal(p.housing)}
              </Meta>
              <Meta icon={<DirectionsCarIcon />} label={t('workforce.actions.transport')}>
                {f.riyal(p.transport)}
              </Meta>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function Meta({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="timeline-meta-box">
      <span className="timeline-meta-label">
        {icon}
        {label}
      </span>
      <span className="timeline-meta-value">{children}</span>
    </div>
  );
}

/** A period of the old system with no document here: what is known of it, read-only. */
function PeriodDrawer({ period: p, onClose }: { period: WorkerPeriod; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useActionFormat();
  const priced = p.kind === 'Work' || p.kind === 'ClientVacation';
  const field = (label: string, value: ReactNode) => (
    <Box sx={{ bgcolor: tokens.gray50, borderRadius: '10px', px: 1.25, py: 1, minWidth: 0 }}>
      <Typography component="span" sx={{ display: 'block', fontSize: 11, color: tokens.gray500 }}>
        {label}
      </Typography>
      <Typography component="span" sx={{ display: 'block', fontSize: 13, fontWeight: 800, color: tokens.navy800, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
  return (
    <Drawer anchor="left" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 }, p: 2.5 }, role: 'dialog', 'aria-label': t('workforce.actions.details') } }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{p.projectName ?? t(`workforce.periods.kinds.${p.kind}`)}</Typography>
          <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('workforce.actions.noDocument')}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {field(t('workforce.periods.kind'), t(`workforce.periods.kinds.${p.kind}`))}
        {field(
          t('workforce.periods.source'),
          <>
            {t(`workforce.actions.sources.${p.sourceType}`, { defaultValue: p.sourceType })} <bdi>{p.sourceNo}</bdi>
          </>,
        )}
        {field(t('workforce.periods.from'), f.date(p.startsOn))}
        {field(t('workforce.periods.to'), p.endsOn ? f.date(p.endsOn) : t('workforce.actions.untilNow'))}
        {field(t('workforce.actions.daysLabel'), periodDays(p).toLocaleString('en-US'))}
        {field(t('workforce.periods.origin'), t(p.fromOldSystem ? 'workforce.periods.oldSystem' : 'workforce.periods.thisSystem'))}
        {priced && (
          <>
            {field(t('workforce.actions.totalPrice'), f.riyal(p.totalPrice))}
            {field(t('workforce.actions.housingPrice'), f.riyal(p.housing))}
            {field(t('workforce.actions.transport'), f.riyal(p.transport))}
          </>
        )}
      </Box>
    </Drawer>
  );
}

function useActionFormat() {
  const { t } = useTranslation();
  // The old screen's dates: 2026-10-11 (a timestamp shown as its Riyadh day).
  const date = (value: string) => (value.length > 10 ? new Date(Date.parse(value) + 3 * 3600000).toISOString() : value).slice(0, 10);
  return {
    // A period's end is shown as the old screen shows it: the day the worker left (the ledger's first day after it).
    date,
    riyal: (value: number | null) => (value === null ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${t('workforce.actions.riyal')}`),
  };
}
