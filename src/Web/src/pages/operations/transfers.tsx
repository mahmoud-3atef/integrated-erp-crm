import { useTranslation } from 'react-i18next';
import type { TransferStatus } from '../../api/operations';
import { Badge, type Tone } from '../../components/ui';

export const transferTone: Record<TransferStatus, Tone> = {
  UnderPreparation: 'neutral',
  SentToOperationsManager: 'warning',
  InApproval: 'warning',
  Returned: 'info',
  Rejected: 'danger',
  Transferred: 'success',
  Canceled: 'neutral',
};

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const { t } = useTranslation();
  return <Badge tone={transferTone[status]}>{t(`operations.transfer.status.${status}`)}</Badge>;
}
