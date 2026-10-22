import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AddIcon from '@mui/icons-material/Add';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import {
  newStepId,
  type ApprovalStep,
  type Assignee,
  type AssigneeKind,
  type ConditionStep,
  type NotifyStep,
  type Recipient,
  type RecipientKind,
  type Step,
  type StopStep,
  type ActionStep,
  type UpdateStep,
} from '../../api/workflow';
import { tokens } from '../../app/theme';
import { ConditionEditor } from './ConditionEditor';
import { FieldValueInput, useEditor, useFieldLabel, type EditorData } from './editorContext';

type StepType = Step['type'];

const icons: Record<StepType, ReactNode> = {
  approval: <HowToRegOutlinedIcon />,
  condition: <AccountTreeOutlinedIcon />,
  update: <EditNoteOutlinedIcon />,
  action: <BoltOutlinedIcon />,
  notify: <NotificationsActiveOutlinedIcon />,
  stop: <StopCircleOutlinedIcon />,
};

const colors: Record<StepType, string> = {
  approval: tokens.navy700,
  condition: tokens.gold,
  update: tokens.teal,
  action: '#7C3AED',
  notify: tokens.info,
  stop: tokens.danger,
};

export function newStep(type: StepType): Step {
  const id = newStepId();
  switch (type) {
    case 'approval':
      return { type, id, nameAr: '', nameEn: '', assignees: [{ kind: 'Role', roleId: null }], rule: 'Any', dueHours: null, requiredFields: [], allowReturn: true, allowDelegate: true, onApprove: [], onReject: [], onReturn: [] };
    case 'condition':
      return { type, id, branches: [{ condition: { matchAll: true, rules: [] }, steps: [] }], else: [] };
    case 'update':
      return { type, id, changes: [] };
    case 'action':
      return { type, id, action: '' };
    case 'notify':
      return { type, id, to: [{ kind: 'Submitter' }], titleAr: '', titleEn: '', bodyAr: '', bodyEn: '' };
    default:
      return { type: 'stop', id, outcome: 'Approved' };
  }
}

/** An ordered list of steps with "add step", as in the Dynamics CRM workflow designer. */
export function StepListEditor({ steps, onChange, emptyHint }: { steps: Step[]; onChange: (steps: Step[]) => void; emptyHint?: string }) {
  const { t } = useTranslation();
  const { readOnly } = useEditor();
  const [menu, setMenu] = useState<HTMLElement | null>(null);

  const replace = (index: number, step: Step) => onChange(steps.map((s, i) => (i === index ? step : s)));
  const move = (index: number, by: number) => {
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    onChange(next);
  };

  return (
    <Stack>
      {steps.length === 0 && emptyHint && <Typography sx={{ fontSize: 12.5, color: tokens.gray500, fontStyle: 'italic' }}>{emptyHint}</Typography>}
      {steps.map((step, index) => (
        <Box key={step.id}>
          {/* Each step is its own section, with a short connector to the next so the order reads at a glance. */}
          {index > 0 && <Box aria-hidden sx={{ width: 2, height: 18, mx: 'auto', bgcolor: tokens.gray300 }} />}
          <StepCard
            step={step}
            number={index + 1}
            onChange={(s) => replace(index, s)}
            onRemove={() => onChange(steps.filter((_, i) => i !== index))}
            onMove={(by) => move(index, by)}
            isFirst={index === 0}
            isLast={index === steps.length - 1}
          />
        </Box>
      ))}
      {!readOnly && (
        <Box sx={{ mt: steps.length > 0 ? 1.5 : 0 }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={(e) => setMenu(e.currentTarget)}>
            {t('process.addStep')}
          </Button>
          <Menu anchorEl={menu} open={menu !== null} onClose={() => setMenu(null)}>
            {(['approval', 'condition', 'update', 'action', 'notify', 'stop'] as StepType[]).map((type) => (
              <MenuItem
                key={type}
                onClick={() => {
                  onChange([...steps, newStep(type)]);
                  setMenu(null);
                }}
              >
                <Box component="span" sx={{ display: 'inline-flex', color: colors[type], marginInlineEnd: 1.5, '& svg': { fontSize: 20 } }}>
                  {icons[type]}
                </Box>
                <ListItemText primary={t(`process.type.${type}`)} secondary={t(`process.typeHint.${type}`)} />
              </MenuItem>
            ))}
          </Menu>
        </Box>
      )}
    </Stack>
  );
}

interface StepCardProps {
  step: Step;
  number: number;
  onChange: (step: Step) => void;
  onRemove: () => void;
  onMove: (by: number) => void;
  isFirst: boolean;
  isLast: boolean;
}

function StepCard({ step, number, onChange, onRemove, onMove, isFirst, isLast }: StepCardProps) {
  const { t } = useTranslation();
  const { readOnly } = useEditor();
  const [open, setOpen] = useState(true);
  const summary = useStepSummary(step);
  const title = useStepTitle(step);
  const color = colors[step.type];

  return (
    <Box component="section" sx={{ borderRadius: `${tokens.radius}px`, bgcolor: '#fff', border: `1.5px solid ${color}55`, boxShadow: tokens.shadowXs, overflow: 'hidden' }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, px: 1.5, py: 1, bgcolor: `${color}12`, borderBottom: open ? `1px solid ${color}33` : 'none' }}>
        <Box sx={{ display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 30, height: 30, borderRadius: '9px', bgcolor: color, color: '#fff', '& svg': { fontSize: 18 } }}>{icons[step.type]}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ flex: '0 0 auto', px: 1, borderRadius: 999, fontSize: 11, fontWeight: 800, color, bgcolor: '#fff', border: `1px solid ${color}55` }}>
              {t('process.stepNumber', { number })} · {t(`process.type.${step.type}`)}
            </Box>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 800, color: tokens.navy800 }}>
              {title}
            </Typography>
          </Stack>
          <Typography noWrap sx={{ fontSize: 12, color: tokens.gray600, mt: 0.25 }}>
            {summary}
          </Typography>
        </Box>
        {!readOnly && (
          <>
            <IconButton size="small" disabled={isFirst} onClick={() => onMove(-1)} aria-label={t('routes.moveUp')}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" disabled={isLast} onClick={() => onMove(1)} aria-label={t('routes.moveDown')}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <Tooltip title={t('process.removeStep')}>
              <IconButton size="small" onClick={onRemove} aria-label={t('process.removeStep')}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
        <IconButton size="small" onClick={() => setOpen((o) => !o)} aria-label={open ? t('process.collapse') : t('process.expand')}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>
      {open && (
        <Box sx={{ px: 1.75, pb: 1.75, pt: 1 }}>
          {step.type !== 'approval' && (
            <TextField
              size="small"
              fullWidth
              label={t('process.stepLabel')}
              placeholder={t(`process.type.${step.type}`)}
              value={step.label ?? ''}
              disabled={readOnly}
              onChange={(e) => onChange({ ...step, label: e.target.value || null })}
              sx={{ mt: 0.5, mb: 0.5 }}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
          )}
          {step.type === 'approval' && <ApprovalEditor step={step} onChange={onChange} />}
          {step.type === 'condition' && <ConditionStepEditor step={step} onChange={onChange} />}
          {step.type === 'update' && <UpdateEditor step={step} onChange={onChange} />}
          {step.type === 'action' && <ActionEditor step={step} onChange={onChange} />}
          {step.type === 'notify' && <NotifyEditor step={step} onChange={onChange} />}
          {step.type === 'stop' && <StopEditor step={step} onChange={onChange} />}
        </Box>
      )}
    </Box>
  );
}

/** The step's name in its header: the stage name, or the label the designer gave it, or its type. */
function useStepTitle(step: Step) {
  const { t, i18n } = useTranslation();
  if (step.type === 'approval') {
    return (i18n.language === 'ar' ? step.nameAr : step.nameEn) || step.label || t('process.unnamedStage');
  }
  return step.label || t(`process.type.${step.type}`);
}

function useStepSummary(step: Step) {
  const { t, i18n } = useTranslation();
  const label = useFieldLabel();
  const { screen } = useEditor();
  switch (step.type) {
    case 'approval':
      return t('process.assigneeCount', { count: step.assignees.length }) + (step.dueHours ? ` — ${t('process.dueIn', { hours: step.dueHours })}` : '');
    case 'condition':
      return t('process.branchCount', { count: step.branches.length });
    case 'update': {
      const relation = step.target ? screen.relations?.find((r) => r.key === step.target) : undefined;
      const table = relation ? localName(relation, i18n.language) : localName(screen, i18n.language);
      const names = step.changes.map((c) => {
        const field = (relation ? relation.fields : screen.fields).find((f) => f.key === c.fieldKey);
        return field ? localName(field, i18n.language) : label(c.fieldKey);
      });
      return `${table}: ${names.join('، ') || t('process.noChanges')}`;
    }
    case 'action': {
      const action = screen.actions?.find((a) => a.key === step.action);
      return action ? localName(action, i18n.language) : t('process.noAction');
    }
    case 'notify':
      return (i18n.language === 'ar' ? step.titleAr : step.titleEn) || '—';
    default:
      return t(`process.outcome.${step.outcome}`);
  }
}

/** Nested list under a heading, indented like a CRM workflow's inner steps. */
function Branch({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Box sx={{ mt: 1.5, paddingInlineStart: 2, borderInlineStart: `2px dashed ${tokens.gray300}` }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.navy700, mb: 0.75 }}>{title}</Typography>
      {hint && <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mb: 0.75 }}>{hint}</Typography>}
      {children}
    </Box>
  );
}

// ---------------------------------------------------------------- Approval stage

function ApprovalEditor({ step, onChange }: { step: ApprovalStep; onChange: (step: Step) => void }) {
  const { t, i18n } = useTranslation();
  const { screen, readOnly } = useEditor();
  const set = (change: Partial<ApprovalStep>) => onChange({ ...step, ...change });
  const anyUserField = userFields(screen, i18n.language).length > 0;
  const updatable = screen.fields.filter((f) => f.updatable);
  const setAssignee = (index: number, change: Partial<Assignee>) => set({ assignees: step.assignees.map((a, i) => (i === index ? { ...a, ...change } : a)) });

  return (
    <Stack spacing={1.5} sx={{ mt: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField size="small" label={t('process.stageNameAr')} value={step.nameAr} disabled={readOnly} onChange={(e) => set({ nameAr: e.target.value })} slotProps={{ htmlInput: { dir: 'rtl', maxLength: 200 } }} />
        <TextField size="small" label={t('process.stageNameEn')} value={step.nameEn} disabled={readOnly} onChange={(e) => set({ nameEn: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 200 } }} />
      </Stack>

      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.navy800 }}>{t('process.assignees')}</Typography>
      {step.assignees.map((a, index) => (
        <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
          <TextField
            select
            size="small"
            label={t('routes.approverKind')}
            value={a.kind}
            disabled={readOnly}
            onChange={(e) => setAssignee(index, { kind: e.target.value as AssigneeKind, userId: null, roleId: null, fieldKey: null, permission: null })}
            sx={{ maxWidth: { sm: 200 } }}
          >
            <MenuItem value="Role">{t('process.assignee.Role')}</MenuItem>
            <MenuItem value="User">{t('process.assignee.User')}</MenuItem>
            <MenuItem value="Permission">{t('process.assignee.Permission')}</MenuItem>
            <MenuItem value="Submitter">{t('process.assignee.SubmitterConfirms')}</MenuItem>
            <MenuItem value="UserField" disabled={!anyUserField}>
              {t('process.assignee.UserField')}
            </MenuItem>
          </TextField>
          <PersonPicker
            kind={a.kind}
            value={a.kind === 'Role' ? a.roleId : a.kind === 'User' ? a.userId : a.kind === 'Permission' ? a.permission : a.fieldKey}
            onChange={(v) => setAssignee(index, a.kind === 'Role' ? { roleId: v } : a.kind === 'User' ? { userId: v } : a.kind === 'Permission' ? { permission: v } : { fieldKey: v })}
          />
          {!readOnly && step.assignees.length > 1 && (
            <IconButton size="small" onClick={() => set({ assignees: step.assignees.filter((_, i) => i !== index) })} aria-label={t('process.removeAssignee')}>
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ))}
      {!readOnly && (
        <Box>
          <Button size="small" startIcon={<AddIcon />} onClick={() => set({ assignees: [...step.assignees, { kind: 'User', userId: null }] })} disabled={step.assignees.length >= 10}>
            {t('process.addAssignee')}
          </Button>
        </Box>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
        <ToggleButtonGroup size="small" exclusive value={step.rule} disabled={readOnly} onChange={(_, v: 'Any' | 'All' | null) => v && set({ rule: v })}>
          <ToggleButton value="Any">{t('process.ruleAny')}</ToggleButton>
          <ToggleButton value="All">{t('process.ruleAll')}</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          size="small"
          label={t('process.dueHours')}
          value={step.dueHours ?? ''}
          disabled={readOnly}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
            set({ dueHours: digits ? Number(digits) : null });
          }}
          sx={{ maxWidth: 180 }}
          slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
        />
      </Stack>

      {updatable.length > 0 && (
        <TextField
          select
          size="small"
          label={t('process.requiredFields')}
          helperText={t('process.requiredFieldsHint')}
          value={step.requiredFields}
          disabled={readOnly}
          onChange={(e) => set({ requiredFields: typeof e.target.value === 'string' ? e.target.value.split(',').filter(Boolean) : (e.target.value as string[]) })}
          slotProps={{ select: { multiple: true, renderValue: (v) => (v as string[]).map((k) => localName(updatable.find((f) => f.key === k) ?? { nameAr: k, nameEn: k }, i18n.language)).join('، ') } }}
        >
          {updatable.map((f) => (
            <MenuItem key={f.key} value={f.key}>
              <Checkbox size="small" checked={step.requiredFields.includes(f.key)} />
              {localName(f, i18n.language)}
            </MenuItem>
          ))}
        </TextField>
      )}

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
        <FormControlLabel control={<Switch size="small" checked={step.allowReturn} disabled={readOnly} onChange={(e) => set({ allowReturn: e.target.checked })} />} label={t('process.allowReturn')} />
        <FormControlLabel control={<Switch size="small" checked={step.allowDelegate} disabled={readOnly} onChange={(e) => set({ allowDelegate: e.target.checked })} />} label={t('process.allowDelegate')} />
      </Stack>

      <Branch title={t('process.onApprove')} hint={t('process.onApproveHint')}>
        <StepListEditor steps={step.onApprove} onChange={(s) => set({ onApprove: s })} />
      </Branch>
      <Branch title={t('process.onReject')} hint={t('process.onRejectHint')}>
        <StepListEditor steps={step.onReject} onChange={(s) => set({ onReject: s })} />
      </Branch>
      {step.allowReturn && (
        <Branch title={t('process.onReturn')} hint={t('process.onReturnHint')}>
          <StepListEditor steps={step.onReturn} onChange={(s) => set({ onReturn: s })} />
        </Branch>
      )}
    </Stack>
  );
}

/** A role, a user, or a user field of the record. */
/** Every user field a step can name: the record's, and each related table's as "relation.field". */
function userFields(screen: EditorData['screen'], language: string) {
  return [
    ...screen.fields.filter((f) => f.type === 'User').map((f) => ({ value: f.key, label: localName(f, language) })),
    ...(screen.relations ?? []).flatMap((r) =>
      r.fields.filter((f) => f.type === 'User').map((f) => ({ value: `${r.key}.${f.key}`, label: `${localName(r, language)} › ${localName(f, language)}` })),
    ),
  ];
}

/** Every field of a type a value can come from: the record's, and each related table's ("relation.field"). */
function fieldsOfType(screen: EditorData['screen'], language: string, type: string | undefined, except?: string) {
  return [
    ...screen.fields.filter((f) => f.type === type && f.key !== except).map((f) => ({ value: f.key, label: localName(f, language) })),
    ...(screen.relations ?? []).flatMap((r) => r.fields.filter((f) => f.type === type).map((f) => ({ value: `${r.key}.${f.key}`, label: `${localName(r, language)} › ${localName(f, language)}` }))),
  ];
}

function PersonPicker({ kind, value, onChange, label }: { kind: AssigneeKind | RecipientKind; value: string | null | undefined; onChange: (value: string) => void; label?: string }) {
  const { t, i18n } = useTranslation();
  const { screen, options, readOnly } = useEditor();
  if (kind === 'Submitter') {
    return null;
  }

  const ar = i18n.language === 'ar';
  const items =
    kind === 'Permission'
      ? options.permissions.map((p) => ({ value: p.code, label: `${ar ? p.groupAr : p.groupEn} — ${ar ? p.nameAr : p.nameEn}` }))
      : kind === 'Role'
      ? options.roles.map((r) => ({ value: r.id, label: localName(r, i18n.language) }))
      : kind === 'User'
        ? options.members.map((m) => ({ value: m.userAccountId, label: m.displayName }))
        : userFields(screen, i18n.language);
  return (
    <TextField select size="small" label={label ?? t(`process.assignee.${kind}`)} value={value ?? ''} disabled={readOnly} onChange={(e) => onChange(e.target.value)} sx={{ flex: 1 }}>
      {items.map((i) => (
        <MenuItem key={i.value} value={i.value}>
          {i.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

// ---------------------------------------------------------------- Condition

function ConditionStepEditor({ step, onChange }: { step: ConditionStep; onChange: (step: Step) => void }) {
  const { t } = useTranslation();
  const { readOnly } = useEditor();
  const setBranch = (index: number, change: Partial<ConditionStep['branches'][number]>) =>
    onChange({ ...step, branches: step.branches.map((b, i) => (i === index ? { ...b, ...change } : b)) });

  return (
    <Box sx={{ mt: 1 }}>
      {step.branches.map((branch, index) => (
        <Box key={index} sx={{ mb: 1.5, p: 1.25, borderRadius: '10px', bgcolor: tokens.gray50 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontWeight: 700, color: tokens.navy800, fontSize: 13 }}>{index === 0 ? t('process.if') : t('process.elseIf')}</Typography>
            {!readOnly && step.branches.length > 1 && (
              <IconButton size="small" onClick={() => onChange({ ...step, branches: step.branches.filter((_, i) => i !== index) })} aria-label={t('process.removeBranch')}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          <ConditionEditor value={branch.condition} onChange={(condition) => setBranch(index, { condition })} />
          <Branch title={t('process.then')}>
            <StepListEditor steps={branch.steps} onChange={(steps) => setBranch(index, { steps })} />
          </Branch>
        </Box>
      ))}
      {!readOnly && (
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange({ ...step, branches: [...step.branches, { condition: { matchAll: true, rules: [] }, steps: [] }] })} disabled={step.branches.length >= 10}>
          {t('process.addElseIf')}
        </Button>
      )}
      <Branch title={t('process.else')} hint={t('process.elseHint')}>
        <StepListEditor steps={step.else} onChange={(steps) => onChange({ ...step, else: steps })} />
      </Branch>
    </Box>
  );
}

// ---------------------------------------------------------------- Update record

const recordTable = '__record';

/** «تنفيذ إجراء»: one of the screen's actions, by name (its module's code); what it does is shown under it. */
function ActionEditor({ step, onChange }: { step: ActionStep; onChange: (step: Step) => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { screen, readOnly } = useEditor();
  const actions = screen.actions ?? [];
  const chosen = actions.find((a) => a.key === step.action);
  return (
    <Stack spacing={1.25} sx={{ mt: 1 }}>
      <TextField
        select
        size="small"
        label={t('process.action')}
        value={chosen ? step.action : ''}
        disabled={readOnly || actions.length === 0}
        helperText={actions.length === 0 ? t('process.noActions') : t('process.actionHint')}
        onChange={(e) => onChange({ ...step, action: e.target.value })}
      >
        {actions.map((a) => (
          <MenuItem key={a.key} value={a.key}>
            {localName(a, i18n.language)}
            {a.required && ` — ${t('process.requiredAction')}`}
          </MenuItem>
        ))}
      </TextField>
      {chosen && (
        <Typography sx={{ fontSize: 12.5, color: tokens.gray600, bgcolor: tokens.gray50, borderRadius: 1, p: 1.25, lineHeight: 1.8 }}>
          {ar ? chosen.descriptionAr : chosen.descriptionEn}
        </Typography>
      )}
    </Stack>
  );
}

function UpdateEditor({ step, onChange }: { step: UpdateStep; onChange: (step: Step) => void }) {
  const { t, i18n } = useTranslation();
  const { screen, readOnly } = useEditor();
  const relations = screen.relations ?? [];
  const relation = step.target ? relations.find((r) => r.key === step.target) : undefined;
  const tableFields = relation ? relation.fields : screen.fields;
  const updatable = tableFields.filter((f) => f.updatable);
  const setChange = (index: number, change: Partial<UpdateStep['changes'][number]>) =>
    onChange({ ...step, changes: step.changes.map((c, i) => (i === index ? { ...c, ...change } : c)) });

  return (
    <Stack spacing={1.25} sx={{ mt: 1 }}>
      {/* 1. The table: the screen's own record, or a table related to it. */}
      <TextField
        select
        size="small"
        label={t('process.table')}
        helperText={relations.length === 0 ? t('process.noRelatedTables') : t('process.tableHint')}
        value={step.target ?? recordTable}
        disabled={readOnly}
        onChange={(e) => onChange({ ...step, target: e.target.value === recordTable ? null : e.target.value, changes: [] })}
        sx={{ maxWidth: 420 }}
      >
        <MenuItem value={recordTable}>{t('process.thisRecord', { screen: localName(screen, i18n.language) })}</MenuItem>
        {relations.map((r) => (
          <MenuItem key={r.key} value={r.key}>
            {t('process.relatedTable', { table: localName(r, i18n.language) })}
          </MenuItem>
        ))}
      </TextField>

      {/* 2. The fields of that table. */}
      {updatable.length === 0 && <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('process.nothingUpdatable')}</Typography>}
      {step.changes.map((change, index) => {
        const field = tableFields.find((f) => f.key === change.fieldKey);
        const sameType = fieldsOfType(screen, i18n.language, field?.type, step.target ? undefined : field?.key);
        const fromField = change.fromField !== null && change.fromField !== undefined;
        return (
          <Stack key={index} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' } }}>
            <TextField select size="small" label={t('process.field')} value={change.fieldKey} disabled={readOnly} onChange={(e) => setChange(index, { fieldKey: e.target.value, value: null, fromField: null })} sx={{ minWidth: 200 }}>
              {/* Every field of the table; the module decides which a process may change (the others are locked). */}
              {tableFields.map((f) => (
                <MenuItem key={f.key} value={f.key} disabled={!f.updatable}>
                  {localName(f, i18n.language)}
                  {!f.updatable && (
                    <Typography component="span" sx={{ fontSize: 11, color: tokens.gray500, marginInlineStart: 1 }}>
                      {t('process.readOnlyField')}
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t('process.setTo')}
              value={fromField ? 'field' : 'value'}
              disabled={readOnly || sameType.length === 0}
              onChange={(e) => setChange(index, e.target.value === 'field' ? { fromField: sameType[0]?.value ?? null, value: null } : { fromField: null })}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="value">{t('process.fixedValue')}</MenuItem>
              <MenuItem value="field">{t('process.fromField')}</MenuItem>
            </TextField>
            <Box sx={{ flex: 1, minWidth: 160 }}>
              {fromField ? (
                <TextField select size="small" label={t('process.field')} value={change.fromField ?? ''} disabled={readOnly} onChange={(e) => setChange(index, { fromField: e.target.value })}>
                  {sameType.map((f) => (
                    <MenuItem key={f.value} value={f.value}>
                      {f.label}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <FieldValueInput
                  field={field && field.options ? { ...field, options: field.options.filter((o) => o.settable) } : field}
                  value={change.value}
                  label={t('process.value')}
                  onChange={(v) => setChange(index, { value: v })}
                />
              )}
            </Box>
            {!readOnly && (
              <IconButton size="small" onClick={() => onChange({ ...step, changes: step.changes.filter((_, i) => i !== index) })} aria-label={t('process.removeRule')}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        );
      })}
      {!readOnly && (
        <Box>
          <Button size="small" startIcon={<AddIcon />} disabled={updatable.length === 0} onClick={() => onChange({ ...step, changes: [...step.changes, { fieldKey: updatable[0]!.key, value: null }] })}>
            {t('process.addField')}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------- Notify

function NotifyEditor({ step, onChange }: { step: NotifyStep; onChange: (step: Step) => void }) {
  const { t } = useTranslation();
  const { screen, readOnly } = useEditor();
  const set = (change: Partial<NotifyStep>) => onChange({ ...step, ...change });
  const setRecipient = (index: number, change: Partial<Recipient>) => set({ to: step.to.map((r, i) => (i === index ? { ...r, ...change } : r)) });
  const placeholders = ['title', 'submitter', ...screen.fields.map((f) => f.key)].map((k) => `{${k}}`).join(' ');
  const related = (screen.relations ?? []).slice(0, 3).map((r) => `{${r.key}.${r.fields[0]?.key ?? 'name'}}`).join(' ');

  return (
    <Stack spacing={1.25} sx={{ mt: 1 }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.navy800 }}>{t('process.recipients')}</Typography>
      {step.to.map((r, index) => (
        <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
          <TextField
            select
            size="small"
            label={t('process.recipient')}
            value={r.kind}
            disabled={readOnly}
            onChange={(e) => setRecipient(index, { kind: e.target.value as RecipientKind, userId: null, roleId: null, fieldKey: null })}
            sx={{ maxWidth: { sm: 200 } }}
          >
            <MenuItem value="Submitter">{t('process.assignee.Submitter')}</MenuItem>
            <MenuItem value="Role">{t('process.assignee.Role')}</MenuItem>
            <MenuItem value="User">{t('process.assignee.User')}</MenuItem>
            <MenuItem value="UserField">{t('process.assignee.UserField')}</MenuItem>
          </TextField>
          <PersonPicker kind={r.kind} value={r.kind === 'Role' ? r.roleId : r.kind === 'User' ? r.userId : r.fieldKey} onChange={(v) => setRecipient(index, r.kind === 'Role' ? { roleId: v } : r.kind === 'User' ? { userId: v } : { fieldKey: v })} />
          {!readOnly && step.to.length > 1 && (
            <IconButton size="small" onClick={() => set({ to: step.to.filter((_, i) => i !== index) })} aria-label={t('process.removeAssignee')}>
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ))}
      {!readOnly && (
        <Box>
          <Button size="small" startIcon={<AddIcon />} onClick={() => set({ to: [...step.to, { kind: 'User', userId: null }] })}>
            {t('process.addRecipient')}
          </Button>
        </Box>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField size="small" label={t('process.titleAr')} value={step.titleAr} disabled={readOnly} onChange={(e) => set({ titleAr: e.target.value })} slotProps={{ htmlInput: { dir: 'rtl', maxLength: 200 } }} />
        <TextField size="small" label={t('process.titleEn')} value={step.titleEn} disabled={readOnly} onChange={(e) => set({ titleEn: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 200 } }} />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField size="small" multiline minRows={2} label={t('process.bodyAr')} value={step.bodyAr} disabled={readOnly} onChange={(e) => set({ bodyAr: e.target.value })} slotProps={{ htmlInput: { dir: 'rtl', maxLength: 1500 } }} />
        <TextField size="small" multiline minRows={2} label={t('process.bodyEn')} value={step.bodyEn} disabled={readOnly} onChange={(e) => set({ bodyEn: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 1500 } }} />
      </Stack>
      <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }} dir="ltr">
        {t('process.placeholders')} {placeholders}
      </Typography>
      {related && (
        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }} dir="ltr">
          {t('process.relatedPlaceholders')} {related}
        </Typography>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------- Stop

function StopEditor({ step, onChange }: { step: StopStep; onChange: (step: Step) => void }) {
  const { t } = useTranslation();
  const { readOnly } = useEditor();
  return (
    <TextField select size="small" label={t('process.endAs')} value={step.outcome} disabled={readOnly} onChange={(e) => onChange({ ...step, outcome: e.target.value as StopStep['outcome'] })} sx={{ mt: 1, maxWidth: 260 }}>
      {(['Approved', 'Rejected', 'Canceled'] as const).map((o) => (
        <MenuItem key={o} value={o}>
          {t(`process.outcome.${o}`)}
        </MenuItem>
      ))}
    </TextField>
  );
}
