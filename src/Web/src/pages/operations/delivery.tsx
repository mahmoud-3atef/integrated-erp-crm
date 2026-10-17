import { useTranslation } from 'react-i18next';
import type { DeliveryRow, DeliveryStatus } from '../../api/operations';
import { Badge, type Tone } from '../../components/ui';

export const deliveryTone: Record<DeliveryStatus, Tone> = {
  Draft: 'neutral',
  InApproval: 'warning',
  Returned: 'info',
  Approved: 'primary',
  Rejected: 'danger',
  Delivered: 'success',
  NotDelivered: 'danger',
  Canceled: 'neutral',
};

/** Old system statuses with their own names (sent to the delivery officer, the sales coordinator…). */
const crmStatusNames = new Set([279640000, 279640002, 279640006, 279640007, 279640009, 279640010, 279640011]);

/** The order's status; an order of the old system shows the old status name while it waits. */
export function DeliveryStatusBadge({ row }: { row: Pick<DeliveryRow, 'status' | 'source' | 'crmStatus'> }) {
  const { t } = useTranslation();
  const label = row.source === 'Crm' && row.crmStatus !== null && crmStatusNames.has(row.crmStatus) ? t(`operations.crmStatus.${row.crmStatus}`) : t(`operations.status.${row.status}`);
  return <Badge tone={deliveryTone[row.status]}>{label}</Badge>;
}

export const sar = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const isoToday = () => new Date().toISOString().slice(0, 10);
