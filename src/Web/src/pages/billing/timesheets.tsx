import { useTranslation } from 'react-i18next';
import type { TimesheetStatus, WorkerSource } from '../../api/billing';
import { Badge, type Tone } from '../../components/ui';

const statusTone: Record<TimesheetStatus, Tone> = { Draft: 'neutral', InApproval: 'warning', Returned: 'info', Approved: 'success' };
const sourceTone: Record<WorkerSource, Tone> = { Company: 'primary', Supplier: 'info', Unknown: 'warning' };

export function TimesheetStatusBadge({ status }: { status: TimesheetStatus }) {
  const { t } = useTranslation();
  return <Badge tone={statusTone[status]}>{t(`timesheets.status.${status}`)}</Badge>;
}

export function SourceBadge({ source, supplier }: { source: WorkerSource; supplier: string | null }) {
  const { t } = useTranslation();
  return <Badge tone={sourceTone[source]}>{source === 'Supplier' && supplier ? supplier : t(`timesheets.source.${source}`)}</Badge>;
}
