import { useTranslation } from 'react-i18next';
import type { ReceiptStatus } from '../../api/billing';
import { Badge, type Tone } from '../../components/ui';

export const receiptTone: Record<ReceiptStatus, Tone> = { Draft: 'neutral', AccountantReview: 'warning', FinanceReview: 'warning', Returned: 'info', Approved: 'success' };

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  const { t } = useTranslation();
  return <Badge tone={receiptTone[status]}>{t(`receipts.status.${status}`)}</Badge>;
}

export const monthStart = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

export const monthEnd = (first: string) => {
  const d = new Date(`${first}T00:00:00`);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
};
