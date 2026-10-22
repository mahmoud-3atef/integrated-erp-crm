import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui';
export const deliveryTone = {
    UnderPreparation: 'neutral',
    SentToOperationsManager: 'warning',
    InApproval: 'warning',
    Returned: 'info',
    Rejected: 'danger',
    Delivered: 'success',
    NotDelivered: 'danger',
    Canceled: 'neutral',
    CanceledAfterApproval: 'danger',
};
/** Old system statuses with their own names (sent to the delivery officer, the sales coordinator…). */
const crmStatusNames = new Set([279640002, 279640006, 279640007, 279640009, 279640010]);
/** The order's status; an order of the old system shows the old status name while it waits. */
export function DeliveryStatusBadge({ row }) {
    const { t } = useTranslation();
    const label = row.source === 'Crm' && row.crmStatus !== null && crmStatusNames.has(row.crmStatus) ? t(`operations.crmStatus.${row.crmStatus}`) : t(`operations.status.${row.status}`);
    return _jsx(Badge, { tone: deliveryTone[row.status], children: label });
}
export const sar = (value) => value === null || value === undefined ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const isoToday = () => new Date().toISOString().slice(0, 10);
