/**
 * Canonical entity shapes. Fields marked "verified" were confirmed against live SuperOps
 * responses in at least one consumer project during the SDK's initial audit; others reflect
 * the union of fields referenced across consumers and may need broadening per-caller via the
 * generic `query`/`paginate` escape hatch in SuperOpsClient.
 */

export interface ClientSite {
  id: string;
  name?: string;
}

export interface CustomFieldValue {
  name: string;
  value: unknown;
}

/** Union of every field referenced for the SuperOps "client" (company) entity across consumers. */
export interface Client {
  accountId: string;
  name: string;
  stage?: string;
  status?: string;
  emailDomains?: string[];
  accountManager?: string;
  primaryContact?: string;
  secondaryContact?: string;
  /** Documented as a JSON scalar on the wire (not sub-selectable), despite having this shape. */
  hqSite?: ClientSite;
  technicianGroups?: string[];
  customFields?: Record<string, unknown>;
}

export interface ClientUser {
  id: string;
  name?: string;
  email?: string;
  clientId?: string;
}

export interface Technician {
  id: string;
  name?: string;
  email?: string;
}

export interface Ticket {
  id: string;
  subject?: string;
  status?: string;
  urgency?: string;
  client?: Pick<Client, 'accountId' | 'name'>;
  [extra: string]: unknown;
}

export interface WorklogEntry {
  itemId: string;
  status?: string;
  billDateTime?: string;
  workItem?: string;
  serviceItem?: Pick<SuperOpsServiceItem, 'itemId' | 'name'>;
  billable?: boolean;
  qty?: number;
  technician?: Pick<Technician, 'id' | 'name'>;
}

/**
 * Best-effort shape — unlike Client/ClientContract/WorklogEntry/ServiceCatalogItem, invoice
 * fields weren't confirmed against a live SuperOps response during the SDK audit. Verify
 * against the live schema (or override via `query`) before relying on fields beyond `id`/`status`.
 */
export interface Invoice {
  id: string;
  invoiceNumber?: string;
  status?: InvoiceStatus | string;
  client?: Pick<Client, 'accountId' | 'name'>;
  billDate?: string;
  dueDate?: string;
  total?: number;
  [extra: string]: unknown;
}

export interface InvoiceItem {
  id: string;
  invoiceId?: string;
  [extra: string]: unknown;
}

export type ContractChangeType = 'BASELINE' | 'INCREASE' | 'DECREASE';

export interface ContractChange {
  type: ContractChangeType;
  quantity: number;
  effectiveDate?: string;
  endDate?: string;
}

export interface ClientContract {
  id: string;
  name?: string;
  contractType?: string;
  changes?: ContractChange[];
  [extra: string]: unknown;
}

/**
 * Raw SuperOps "service item" API entity (worklog line item), e.g. `{itemId, name, quantityType}`.
 * NOT the same concept as a per-product business enum of service categories — name your own
 * domain enum separately and map into/out of this type at the edge, the way software-audit does.
 */
export interface SuperOpsServiceItem {
  itemId: string;
  name?: string;
  quantityType?: string;
}

export interface PricingDetail {
  value: number;
  afterHoursValue?: number;
}

export interface Pricing {
  model?: string;
  details?: PricingDetail[];
}

export interface ServiceCatalogItem {
  itemId: string;
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  category?: string;
  sellingPrice?: Pricing;
  costPrice?: Pricing;
}

export interface ServiceCategory {
  id: string;
  name?: string;
}

export interface Tax {
  id: string;
  name?: string;
  rate?: number;
}

export interface Task {
  id: string;
  [extra: string]: unknown;
}

export interface OfferedItem {
  id: string;
  type?: 'CONTRACT' | 'HOURS' | string;
  status?: 'INVOICED' | 'DRAFT' | string;
  quantityType?: string;
  [extra: string]: unknown;
}

export type InvoiceStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID'
  | 'PAYMENT_IN_PROGRESS'
  | 'PARTIALLY_PAID';

export interface CreateInvoiceLineItem {
  itemId: string;
  quantity: number;
  [extra: string]: unknown;
}

export interface CreateInvoiceInput {
  client: { accountId: string };
  site?: { id: string };
  addItems: CreateInvoiceLineItem[];
  [extra: string]: unknown;
}

export interface CreateServiceCatalogItemInput {
  name: string;
  category?: string;
  sellingPrice?: Pricing;
  costPrice?: Pricing;
  [extra: string]: unknown;
}
