import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui';
export const returnTone = {
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
export function ReturnStatusBadge({ row }) {
    const { t } = useTranslation();
    const label = row.source === 'Crm' && row.crmStatus !== null && crmStatusNames.has(row.crmStatus) ? t(`operations.return.crmStatus.${row.crmStatus}`) : t(`operations.return.status.${row.status}`);
    return _jsx(Badge, { tone: returnTone[row.status], children: label });
}
