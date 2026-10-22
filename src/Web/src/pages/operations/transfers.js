import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui';
export const transferTone = {
    UnderPreparation: 'neutral',
    SentToOperationsManager: 'warning',
    InApproval: 'warning',
    Returned: 'info',
    Rejected: 'danger',
    Transferred: 'success',
    Canceled: 'neutral',
    CanceledAfterApproval: 'danger',
};
export function TransferStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(Badge, { tone: transferTone[status], children: t(`operations.transfer.status.${status}`) });
}
