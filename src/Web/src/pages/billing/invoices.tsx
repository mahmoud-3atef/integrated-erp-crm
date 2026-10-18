import { useTranslation } from 'react-i18next';
import type { InvoiceKind, InvoiceStatus } from '../../api/billing';
import { Badge, type Tone } from '../../components/ui';

export const invoiceTone: Record<InvoiceStatus, Tone> = { Draft: 'neutral', ProjectReview: 'warning', FinanceReview: 'warning', Returned: 'info', Issued: 'success' };
const kindTone: Record<InvoiceKind, Tone> = { Invoice: 'primary', CreditNote: 'danger', DebitNote: 'info' };

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  return <Badge tone={invoiceTone[status]}>{t(`invoices.status.${status}`)}</Badge>;
}

export function InvoiceKindBadge({ kind }: { kind: InvoiceKind }) {
  const { t } = useTranslation();
  return <Badge tone={kindTone[kind]}>{t(`invoices.kind.${kind}`)}</Badge>;
}

/** A credit note lowers what the customer owes: its amounts read negative. */
export const signed = (kind: InvoiceKind, value: number) => (kind === 'CreditNote' ? -value : value);
