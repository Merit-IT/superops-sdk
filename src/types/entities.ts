export type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

/**
 * `client` (on `ClientContract`) is schema-typed as an opaque scalar — the field takes no
 * GraphQL subselection — but empirically always resolves to this shape.
 */
export interface ClientRef {
  accountId?: string;
  name: string;
}

/**
 * `chargeItem` (on `BillableContract`) is schema-typed as an opaque scalar for the same
 * reason as `ClientRef`, but empirically always resolves to this shape.
 */
export interface ChargeItemRef {
  itemId: string | number;
  name?: string;
  description?: string;
}

/**
 * `requester` (on `Ticket`) is schema-typed as an opaque scalar for the same reason as
 * `ClientRef`, but empirically always resolves to this shape.
 */
export interface PersonRef {
  userId?: string;
  name?: string;
}

export interface BusinessHour {
  day?: string;
  end?: string;
  start?: string;
}

export interface ClientSite {
  id: string;
  name?: string;
  businessHour?: BusinessHour[];
  holidayList?: { id?: string; name?: string }[];
  timezoneCode?: string;
  working24x7?: boolean;
  line1?: string;
  line2?: string;
  line3?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  stateCode?: string;
  contactNumber?: string;
  client?: Json;
  hq?: boolean;
  [extra: string]: unknown;
}

export interface CustomFieldValue {
  name: string;
  value: Json;
}

export interface Client {
  accountId: string;
  name: string;
  stage?: string;
  status?: string;
  emailDomains?: string[];
  accountManager?: Json;
  primaryContact?: Json;
  secondaryContact?: Json;
  hqSite?: Json;
  technicianGroups?: Json;
  customFields?: Record<string, Json>;
  createdTime?: string;
  updatedTime?: string;
}

export interface ClientUser {
  userId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  contactNumber?: string;
  reportingManager?: Json;
  /** Confirmed JSON scalar — not an enum, despite the name. */
  role?: Json;
  site?: Json;
  client?: Json;
  customFields?: Record<string, Json>;
  createdTime?: string;
  updatedTime?: string;
}

export interface CustomField {
  id: string;
  columnName: string;
  label: string;
  description?: string;
  fieldType?: string;
  options?: string[];
  showToClient?: boolean;
  isMandatory?: boolean;
}

export interface Technician {
  userId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  contactNumber?: string;
  emailSignature?: string;
  designation?: Json;
  businessFunction?: Json;
  team?: Json;
  reportingManager?: Json;
  role?: Json;
  groups?: Json;
}

export interface Ticket {
  ticketId: string;
  displayId?: string;
  subject?: string;
  source?: string;
  client?: Json;
  site?: Json;
  requester?: PersonRef;
  additionalRequester?: Json;
  followers?: Json;
  techGroup?: Json;
  technician?: Json;
  status?: string;
  approvalStatus?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  category?: string;
  subcategory?: string;
  cause?: string;
  subcause?: string;
  resolutionCode?: string;
  sla?: Json;
  createdTime?: string;
  updatedTime?: string;
  firstResponseDueTime?: string;
  firstResponseTime?: string;
  firstResponseViolated?: boolean;
  resolutionDueTime?: string;
  resolutionTime?: string;
  resolutionViolated?: boolean;
  customFields?: Record<string, Json>;
  requestType?: string;
  worklogTimespent?: string;
}

export interface Attachment {
  fileName: string;
  originalFileName: string;
  fileSize: string;
}

export type NotePrivacyType = 'PUBLIC' | 'PRIVATE';


export interface Note {
  noteId: string;
  addedBy?: Json;
  addedOn?: string;
  content?: string;
  attachments?: Attachment[];
  privacyType?: NotePrivacyType;
}

/** `workItem` is schema-typed as an opaque scalar (no GraphQL subselection), but empirically resolves to this shape. */
export interface WorkItemRef {
  workId?: string;
  displayId?: string;
  module?: string;
}

export interface WorklogEntry {
  itemId: string;
  status?: string;
  billDateTime?: string;
  workItem?: WorkItemRef;
  serviceItem?: Pick<SuperOpsServiceItem, 'itemId' | 'name'>;
  billable?: boolean;
  qty?: string;
  technician?: { userId: string; name?: string };
  notes?: string;
  unitPrice?: string;
  afterHours?: boolean;
}

export type InvoiceStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID'
  | 'PAYMENT_IN_PROGRESS'
  | 'PARTIALLY_PAID';


export interface Invoice {
  invoiceId: string;
  displayId?: string;
  client?: Json;
  site?: Json;
  billTo?: Json;
  shipTo?: Json;
  invoiceDate?: string;
  dueDate?: string;
  statusEnum?: InvoiceStatus | string;
  sentToClient?: boolean;
  items?: InvoiceItem[];
  taxes?: InvoiceTaxItem[];
  discountAmount?: string;
  additionalDiscount?: string;
  additionalDiscountRate?: string;
  totalAmount?: string;
  notes?: string;
  paymentDate?: string;
  paymentMethod?: Json;
  paymentReference?: string;
  invoicePaymentTerm?: Json;
  paymentLink?: string;
  amountDue?: string;
  transactions?: Json;
}

export interface InvoiceItem {
  itemId: string;
  billedDate?: string;
  details?: string;
  quantity?: string;
  unitPrice?: string;
  discountAmount?: string;
  discountRate?: string;
  amount?: string;
  taxable?: boolean;
  tax?: Json;
  /** `itemId` is returned by the API alongside `name`/`quantityType` even though earlier SDK
   * versions didn't type it — confirmed against SuperOps' own documented invoice-item shape.
   * Use it to look up the full catalog entry (`client.getServiceCatalogItem(itemId)`) for
   * `itemType` ('PRODUCT' vs 'SERVICE') or `category` when you need to distinguish hardware/
   * product line items from recurring service billing. */
  serviceItem?: Pick<SuperOpsServiceItem, 'itemId' | 'name' | 'quantityType'>;
  taxAmount?: string;
  totalAmount?: string;
  /** Only present on `iterateInvoiceItems`/`GET_INVOICE_ITEM_LIST` — omitted from `Invoice.items` to avoid a circular selection. */
  invoice?: Pick<Invoice, 'invoiceId' | 'displayId' | 'client' | 'statusEnum' | 'invoiceDate' | 'dueDate' | 'totalAmount' | 'paymentDate'>;
}

export interface InvoiceTaxItem {
  id: string;
  tax?: Json;
  taxRate?: string;
  taxableAmount?: string;
  taxAmount?: string;
  rate?: Json;
}

export type ClientContractStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type ContractType = 'SERVICE' | 'USAGE' | 'ONE_TIME' | 'TIME_AND_MATERIAL';
export type RecurringMode = 'ARREAR' | 'UPFRONT' | 'ADVANCE';
export type FrequencyDurationUnit = 'MONTH' | 'DAY' | 'WEEK' | 'YEAR';
export type BillableContractQuantityChangeOperation = 'INCREASE' | 'DECREASE' | 'BASELINE';
export type RedeemableBundleApplicableType = 'ALL_ITEMS' | 'INCLUDED_ITEMS';
export type RedeemableBundleApplicableHours = 'BUSINESS_HOURS' | 'AFTER_HOURS' | 'ALL_HOURS';

export interface BillableContractQuantityChange {
  changeId: string;
  effectiveDate?: string;
  endDate?: string;
  quantity?: string;
  quantityChangeOperation?: BillableContractQuantityChangeOperation;
}

export interface RecurringContract {
  contractId: string;
  recurringMode?: RecurringMode;
  frequencyDurationUnit?: FrequencyDurationUnit;
  frequencyInterval?: number;
  billingOffset?: number;
  nextBillDate?: string;
}


export interface RedeemableContract {
  contractId: string;
  applicableType?: RedeemableBundleApplicableType;
  applicableHours?: RedeemableBundleApplicableHours;
  carryForwardRemainingQuantity?: boolean;
}


export interface PerpetualContract {
  contractId: string;
  autoRenew?: boolean;
}


export interface BlockItemInfo {
  blockItemId?: string;
  balance?: string;
}


export interface BillableContract {
  contractId: string;
  chargeItem?: ChargeItemRef;
  quantityCalculationType?: string;
  sellingPriceCalculationType?: string;
  provisionRule?: Json;
  sellingPriceOverridden?: boolean;
  sellingPrice?: Pricing;
  discountRate?: string;
  frequencyType?: string;
  includedItems?: Json[];
  billableSiteType?: string;
  sites?: Json[];
  recurringContract?: RecurringContract;
  redeemableContract?: RedeemableContract;
  perpetualContract?: PerpetualContract;
  changes?: BillableContractQuantityChange[];
  project?: Json;
  blockItemsInfo?: BlockItemInfo[];
}


export interface Contract {
  contractId: string;
  name?: string;
  description?: string;
  contractType?: ContractType | string;
  billableContract?: BillableContract;
}


export interface ClientContract {
  contractId: string;
  client?: ClientRef;
  contract?: Contract;
  startDate?: string;
  endDate?: string;
  contractStatus?: ClientContractStatus | string;
}


export interface BillableContractQuantityChangeInput {
  changeId?: string;
  effectiveDate?: string;
  quantity?: string;
  quantityChangeOperation?: BillableContractQuantityChangeOperation;
}


export interface UpdateBillableContractInput {
  sellingPriceOverridden?: boolean;
  sellingPrice?: Pricing;
  change?: BillableContractQuantityChangeInput;
}


export interface UpdateContractInput {
  contractId: string;
  billableContract?: UpdateBillableContractInput;
}

export interface UpdateClientContractInput {
  contract: UpdateContractInput;
  endDate?: string;
}

export interface SuperOpsServiceItem {
  itemId: string;
  name?: string;
  quantityType?: string;
}

export type PricingModelType = 'PER_UNIT';


export interface PricingDetail {
  value: string;
  afterHoursValue?: string;
}


export interface Pricing {
  model?: PricingModelType | string;
  details?: PricingDetail[];
}

export type ServiceTypeItemOfferingType = 'QUANTITY' | 'HOURS' | 'BLOCK_HOUR' | 'BLOCK_MONEY' | 'SERVICE_BUNDLE';


export interface HourlyServiceTypeItem {
  itemId: string;
  roundUpValue: number;
  defaultItem: boolean;
}


export interface RedeemableServiceBundle {
  itemId: string;
  applicableType?: RedeemableBundleApplicableType;
  applicableHours?: RedeemableBundleApplicableHours;
  redeemableQuantity?: string;
}


export interface ServiceTypeItem {
  itemId: string;
  offeringType?: ServiceTypeItemOfferingType | string;
  bundledItems?: Pick<ServiceCatalogItem, 'itemId' | 'name'>[];
  hourlyServiceTypeItem?: HourlyServiceTypeItem;
  redeemableServiceBundle?: RedeemableServiceBundle;
}


export interface ServiceCatalogItem {
  itemId: string;
  name?: string;
  description?: string;
  category?: ServiceCategory;
  itemType?: 'PRODUCT' | 'SERVICE' | string;
  offerAsWorklogItem?: boolean;
  status?: 'ACTIVE' | 'INACTIVE' | string;
  taxable?: boolean;
  taxCategory?: Json;
  sellingPrice?: Pricing;
  costPrice?: Pricing;
  serviceTypeItem?: ServiceTypeItem;
}


export interface ServiceCategory {
  categoryId: string;
  name?: string;
}


export interface TaxRate {
  rateId: string;
  name?: string;
  rateValue?: string;
}


export interface Tax {
  taxId: string;
  name?: string;
  rates?: TaxRate[];
  totalRate?: string;
}

export type WorkState = 'PLANNED' | 'PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | 'DELETED';


export interface WorkStatus {
  statusId: string;
  name?: string;
  state?: WorkState;
}


export interface Urgency {
  id: string;
  name?: string;
}


export interface SubCategory {
  id: string;
  name?: string;
}


export interface Category {
  id: string;
  name?: string;
  subCategories?: SubCategory[];
}


export interface SLA {
  id: string;
  name?: string;
}


export interface Task {
  taskId: string;
  displayId?: string;
  title?: string;
  description?: string;
  status?: string;
  estimatedTime?: number;
  scheduledStartDate?: string;
  dueDate?: string;
  overdue?: boolean;
  actualStartDate?: string;
  actualEndDate?: string;
  technician?: Json;
  techGroup?: Json;
  workItem?: Json;
  ticket?: Json;
  taskOrder?: number;
  priority?: string;
}

export type OfferedItemType = 'CONTRACT' | 'WORK';
export type OfferedItemAuditStatus = 'PENDING' | 'APPROVED' | 'IGNORED' | 'INVOICED' | 'UNDER_CONTRACT';


export interface OfferedItem {
  itemId: string;
  type?: OfferedItemType | string;
  billDate?: string;
  status?: OfferedItemAuditStatus | string;
  serviceItem?: Json;
  client?: Json;
  site?: Json;
  workItem?: Json;
  technician?: Json;
  afterHours?: boolean;
  unitPrice?: string;
  qty?: string;
  discountRate?: string;
  amount?: string;
  revisedUnitPrice?: string;
  revisedQuantity?: string;
  revisedDiscountRate?: string;
  revisedAmount?: string;
  adjustedBlockMoney?: string;
  adjustedBlockHour?: string;
  notes?: string;
  createdTime?: string;
  updatedTime?: string;
}


export interface CreateInvoiceLineItem {
  billedDate: string;
  serviceItem: { itemId: string };
  details?: string;
  quantity: string;
  unitPrice: string;
  discountRate?: string;
  discountAmount?: string;
  taxable?: boolean;
  tax?: { taxId: string };
}


export interface CreateInvoiceInput {
  client: { accountId: string };
  site?: { id: string };
  billTo?: { id: string };
  shipTo?: { id: string };
  statusEnum: InvoiceStatus | string;
  invoiceDate: string;
  dueDate?: string;
  addItems: CreateInvoiceLineItem[];
  additionalDiscount?: string;
  additionalDiscountRate?: string;
  memo?: string;
  title?: string;
  footer?: string;
  paymentTerm?: { paymentTermId: string };
}


export interface CreateServiceCatalogItemInput {
  name: string;
  description?: string;
  category?: { categoryId: string };
  itemType: string;
  offerAsWorklogItem?: boolean;
  taxable: boolean;
  salesTax?: { taxId: string };
  taxCategory?: { taxCategoryId: string };
  sellingPrice?: Pricing;
  costPrice?: Pricing;
}

export interface ServiceItem {
  itemId: string;
  name?: string;
  description?: string;
  quantityType?: string;
  category?: ServiceCategory;
  useAsWorklogItem?: boolean;
  unitPrice?: string;
  businessHoursUnitPrice?: string;
  afterHoursUnitPrice?: string;
  roundUpValue?: number;
  quantity?: string;
  amount?: string;
  adjustBlockItemAgainstAllItems?: boolean;
  blockItemAdjustedItems?: Pick<ServiceItem, 'itemId' | 'name'>[];
  blockItemUsedIn?: string;
  salesTaxEnabled?: boolean;
  salesTax?: Tax;
}


export interface TicketConversationRecipient {
  user?: unknown;
}


export interface TicketConversation {
  conversationId: string;
  content?: string;
  time?: string;
  user?: unknown;
  toUsers?: TicketConversationRecipient[];
  ccUsers?: TicketConversationRecipient[];
  bccUsers?: TicketConversationRecipient[];
  attachments?: Attachment[];
  type?: string;
}

// ---- Create/update mutation inputs -----------------------------------------

export interface CreateBusinessHourInput {
  day: string;
  start: string;
  end: string;
}

/** Also used as the nested `hqSite` shape when creating a client via `CreateClientInputV2`. */
export interface CreateClientSiteInput {
  name: string;
  working24x7: boolean;
  businessHour?: CreateBusinessHourInput[];
  holidayList?: { id: string };
  timezoneCode: string;
  line1?: string;
  line2?: string;
  line3?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  stateCode?: string;
  client?: { accountId: string };
}

export interface UpdateClientSiteInput {
  id: string;
  name?: string;
  timezoneCode?: string;
  working24x7?: boolean;
  businessHour?: CreateBusinessHourInput[];
  holidayList?: { id: string };
  line1?: string;
  line2?: string;
  line3?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  stateCode?: string;
  contactNumber?: string;
}

/** `createClient`/`CreateClientInput` are deprecated by SuperOps in favor of this input. */
export interface CreateClientInputV2 {
  name: string;
  stage?: string;
  status?: string;
  emailDomains?: string[];
  accountManager?: { userId: string };
  addTechnicianGroups?: { groupId: string }[];
  customFields?: Record<string, Json>;
  hqSite: CreateClientSiteInput;
}

export interface UpdateClientInput {
  accountId: string;
  name?: string;
  stage?: string;
  status?: string;
  emailDomains?: string[];
  accountManager?: { userId: string };
  primaryContact?: { userId: string };
  secondaryContact?: { userId: string };
  hqSite?: { id: string };
  addTechnicianGroups?: { groupId: string }[];
  deleteTechnicianGroups?: { groupId: string }[];
  customFields?: Record<string, Json>;
}

export interface CreateClientUserAssociationInput {
  client: { accountId: string };
  site: { id: string };
  /** Optional when creating a brand-new client user. */
  user?: { userId: string };
}

export interface CreateClientUserInput {
  firstName: string;
  lastName?: string;
  email: string;
  contactNumber?: string;
  reportingManager?: { userId: string };
  role: { roleId: string };
  addAssociations?: CreateClientUserAssociationInput[];
  customFields?: Record<string, Json>;
}

export interface UpdateClientUserInput {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
  reportingManager?: { userId: string };
  site?: { id: string };
  role?: { roleId: string };
  customFields?: Record<string, Json>;
}

export interface RecurringContractInput {
  recurringMode: RecurringMode | string;
  frequencyDurationUnit: FrequencyDurationUnit | string;
  frequencyInterval: number;
  /** Required if `recurringMode` is `'ADVANCE'`. */
  billingOffset?: number;
}

export interface CreateBillableContractInput {
  chargeItem: { itemId: string };
  sellingPriceOverridden: boolean;
  sellingPrice?: Pricing;
  discountRate?: string;
  billableSiteType: string;
  /** Only used when `billableSiteType` is `'INCLUDED'`. */
  addSites?: { id: string }[];
  recurringContract: RecurringContractInput;
  change: BillableContractQuantityChangeInput;
}

export interface CreateContractInput {
  description?: string;
  billableContract: CreateBillableContractInput;
}

export interface CreateClientContractInput {
  client: { accountId: string };
  contract: CreateContractInput;
  startDate: string;
  endDate?: string;
}

export interface FieldOption {
  id?: string;
  value?: string;
  description?: string;
  order?: number;
}

/** Generic custom-field type returned by `createField`/`updateField` — spans multiple modules (TICKET, COMPANY_USER, ...). */
export interface Field {
  id: string;
  module?: string;
  columnName?: string;
  label?: string;
  description?: string;
  fieldType?: string;
  options?: FieldOption[];
  showToRequester?: boolean;
  fieldCategory?: string;
  mandatoryOnCreate?: boolean;
  mandatoryOnClosure?: boolean;
  parentField?: Pick<Field, 'id' | 'label'>;
}

export interface CreateFieldOptionInput {
  value: string;
  description?: string;
  order: number;
  parentOption?: { id: string };
}

export interface UpdateFieldOptionInput {
  id: string;
  value?: string;
  description?: string;
  order?: number;
}

/**
 * `createClientCustomField` is deprecated by SuperOps in favor of this generic `createField`
 * mutation — `module` (e.g. `'COMPANY_USER'` for client custom fields, `'TICKET'` for ticket
 * custom fields) is a free-form string per schema, not a closed enum.
 */
export interface CreateFieldInput {
  label: string;
  description?: string;
  fieldType: string;
  showToRequester?: boolean;
  module: string;
  mandatoryOnCreate?: boolean;
  mandatoryOnClosure?: boolean;
  addOptions?: CreateFieldOptionInput[];
  parentField?: { id: string };
}

export interface UpdateFieldInput {
  id: string;
  label?: string;
  description?: string;
  showToRequester?: boolean;
  mandatoryOnCreate?: boolean;
  mandatoryOnClosure?: boolean;
  addOptions?: CreateFieldOptionInput[];
  updateOptions?: UpdateFieldOptionInput[];
  deleteOptions?: { id: string }[];
}

export interface CreateAttachmentInput {
  fileName: string;
  originalFileName: string;
  fileSize: string;
}

export interface CreateTicketInput {
  subject: string;
  description?: string;
  descriptionAttachments?: CreateAttachmentInput[];
  client: { accountId: string };
  site?: { id: string };
  requester?: { userId: string };
  techGroup?: { groupId: string };
  technician?: { userId: string };
  status?: string;
  requestType?: string;
  source: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  category?: string;
  subcategory?: string;
  cause?: string;
  subcause?: string;
  sla?: { id: string };
  resolutionCode?: string;
  customFields?: Record<string, Json>;
  addAdditionalRequester?: { userId: string }[];
  addFollowers?: { userId: string }[];
  createdTime?: string;
  updatedTime?: string;
  subSource?: string;
  sourceReferenceId?: string;
  addAssets?: { assetId: string }[];
  suppressCloseNotification?: boolean;
  firstResponseTime?: string;
  resolutionTime?: string;
}

export interface UpdateTicketInput {
  ticketId: string;
  subject?: string;
  client?: { accountId: string };
  site?: { id: string };
  requester?: { userId: string };
  techGroup?: { groupId: string };
  technician?: { userId: string };
  status?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  category?: string;
  subcategory?: string;
  cause?: string;
  subcause?: string;
  resolutionCode?: string;
  requestType?: string;
  source?: string;
  customFields?: Record<string, Json>;
  addAdditionalRequester?: { userId: string }[];
  deleteAdditionalRequester?: { userId: string }[];
  addFollowers?: { userId: string }[];
  deleteFollowers?: { userId: string }[];
  suppressCloseNotification?: boolean;
  firstResponseTime?: string;
  resolutionTime?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status: string;
  estimatedTime?: number;
  scheduledStartDate?: string;
  dueDate?: string;
  technician?: { userId: string };
  techGroup?: { groupId: string };
  module: string;
  /** Required if `module` is `'TICKET'`. */
  ticket?: { ticketId: string };
}

export interface CreateWorklogEntryInput {
  serviceItem?: { itemId: string };
  billable?: boolean;
  afterHours?: boolean;
  qty: string;
  unitPrice?: string;
  billDateTime: string;
  notes?: string;
  workItem: { workId: string; module: string };
  technician?: { userId: string };
}

export interface UpdateWorklogEntryInput {
  itemId: string;
  serviceItem?: { itemId: string };
  billable?: boolean;
  afterHours?: boolean;
  qty?: string;
  unitPrice?: string;
  billDateTime?: string;
  notes?: string;
}

export interface CreateServiceItemInput {
  name: string;
  description?: string;
  quantityType: string;
  category?: { categoryId: string };
  useAsWorklogItem?: boolean;
  unitPrice?: string;
  businessHoursUnitPrice?: string;
  afterHoursUnitPrice?: string;
  roundUpValue?: number;
  quantity?: string;
  amount?: string;
  adjustBlockItemAgainstAllItems?: boolean;
  addBlockItemAdjustedItems?: { itemId: string }[];
  blockItemUsedIn?: string;
  salesTaxEnabled?: boolean;
  salesTax?: { taxId: string };
}

export interface CreateTaxRateInput {
  name: string;
  rateValue: string;
}

export interface CreateTaxInput {
  name: string;
  addRates: CreateTaxRateInput[];
}

export interface UpdateServiceTypeItemInput {
  addBundledItems?: { itemId: string }[];
  deleteBundledItems?: { itemId: string }[];
  hourlyServiceTypeItem?: { roundUpValue?: number };
  redeemableServiceBundle?: {
    applicableType?: RedeemableBundleApplicableType;
    applicableHours?: RedeemableBundleApplicableHours;
    redeemableQuantity?: string;
  };
}

export interface UpdateServiceCatalogItemInput {
  itemId: string;
  name?: string;
  description?: string;
  category?: { categoryId: string };
  offerAsWorklogItem?: boolean;
  taxable?: boolean;
  salesTax?: { taxId: string };
  costPrice?: Pricing;
  sellingPrice?: Pricing;
  serviceTypeItem?: UpdateServiceTypeItemInput;
}

export interface UpdateInvoiceInput {
  invoiceId: string;
  statusEnum?: InvoiceStatus | string;
  invoiceDate?: string;
  dueDate?: string;
  paymentDate?: string;
  paymentMethod?: { paymentMethodId: string };
  paymentReference?: string;
  invoicePaymentTerm?: { paymentTermId: string };
}
