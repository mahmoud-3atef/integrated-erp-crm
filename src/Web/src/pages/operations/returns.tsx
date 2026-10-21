import { useTranslation } from 'react-i18next';
import type { ReturnRow, ReturnStatus } from '../../api/operations';
import { Badge, type Tone } from '../../components/ui';

export const returnTone: Record<ReturnStatus, Tone> = {
  UnderPreparation: 'neutral',
  SentToSales: 'info',
  SentToOperationsManager: 'warning',
  InApproval: 'warning',
  Returned: 'info',
  Rejected: 'danger',
  Completed: 'success',
  Canceled: 'neutral',
  CanceledAfterApproval: 'danger',
};

/** Old housing-order statuses with their own names (waiting for the project supervisor, sent to investigation…). */
const crmStatusNames = new Set([1, 100000002, 100000007, 100000008, 100000005]);

export function ReturnStatusBadge({ row }: { row: Pick<ReturnRow, 'status' | 'source' | 'crmStatus'> }) {
  const { t } = useTranslation();
  const label = row.source === 'Crm' && row.crmStatus !== null && crmStatusNames.has(row.crmStatus) ? t(`operations.return.crmStatus.${row.crmStatus}`) : t(`operations.return.status.${row.status}`);
  return <Badge tone={returnTone[row.status]}>{label}</Badge>;
}
