import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui';
export const invoiceTone = { Draft: 'neutral', ProjectReview: 'warning', FinanceReview: 'warning', Returned: 'info', Issued: 'success' };
const kindTone = { Invoice: 'primary', CreditNote: 'danger', DebitNote: 'info' };
export function InvoiceStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(Badge, { tone: invoiceTone[status], children: t(`invoices.status.${status}`) });
}
export function InvoiceKindBadge({ kind }) {
    const { t } = useTranslation();
    return _jsx(Badge, { tone: kindTone[kind], children: t(`invoices.kind.${kind}`) });
}
/** A credit note lowers what the customer owes: its amounts read negative. */
export const signed = (kind, value) => (kind === 'CreditNote' ? -value : value);
