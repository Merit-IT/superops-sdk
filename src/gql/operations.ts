/**
 * Field selections here are general from what we have used in the past (Merit).
 * For anything narrower/wider than you need, use SuperOpsClient#query with your own selection
 * rather than editing these shared strings
 */

export const GET_CLIENT_LIST = /* GraphQL */ `
  query GetClientList($input: ListInfoInput) {
    getClientList(input: $input) {
      clients {
        accountId
        name
        stage
        status
        emailDomains
        accountManager
        primaryContact
        secondaryContact
        hqSite
        technicianGroups
        customFields
      }
      listInfo {
        totalCount
        page
        pageSize
        hasMore
      }
    }
  }
`;

export const GET_CLIENT = /* GraphQL */ `
  query GetClient($input: ClientIdentifierInput!) {
    getClient(input: $input) {
      accountId
      name
      stage
      status
      emailDomains
      accountManager
      primaryContact
      secondaryContact
      hqSite
      technicianGroups
      customFields
    }
  }
`;

export const GET_CLIENT_CONTRACT_LIST = /* GraphQL */ `
  query GetClientContractList($input: ListInfoInput) {
    getClientContractList(input: $input) {
      contracts {
        id
        name
        contractType
        changes {
          type
          quantity
          effectiveDate
          endDate
        }
      }
      listInfo {
        totalCount
        page
        pageSize
        hasMore
      }
    }
  }
`;

export const GET_WORKLOG_ENTRIES = /* GraphQL */ `
  query GetWorklogEntries($input: ListInfoInput) {
    getWorklogEntries(input: $input) {
      items {
        itemId
        status
        billDateTime
        workItem
        serviceItem {
          itemId
          name
        }
        billable
        qty
        technician {
          id
          name
        }
      }
      listInfo {
        totalCount
        page
        pageSize
        hasMore
      }
    }
  }
`;

export const GET_SERVICE_CATALOG_ITEM_LIST = /* GraphQL */ `
  query GetServiceCatalogItemList($input: ListInfoInput) {
    getServiceCatalogItemList(input: $input) {
      items {
        itemId
        name
        status
        category
        sellingPrice {
          model
          details {
            value
            afterHoursValue
          }
        }
        costPrice {
          model
          details {
            value
            afterHoursValue
          }
        }
      }
      listInfo {
        totalCount
        page
        pageSize
        hasMore
      }
    }
  }
`;

/** No `input` argument, no pagination wrapper — returns a bare array. Fetch with `paginated: false`. */
export const GET_SERVICE_CATEGORY_LIST = /* GraphQL */ `
  query GetServiceCategoryList {
    getServiceCategoryList {
      id
      name
    }
  }
`;

export const GET_INVOICE_LIST = /* GraphQL */ `
  query GetInvoiceList($input: ListInfoInput) {
    getInvoiceList(input: $input) {
      invoices {
        id
        invoiceNumber
        status
        client {
          accountId
          name
        }
        billDate
        dueDate
        total
      }
      listInfo {
        totalCount
        page
        pageSize
        hasMore
      }
    }
  }
`;

export const GET_INVOICE = /* GraphQL */ `
  query GetInvoice($input: InvoiceIdentifierInput!) {
    getInvoice(input: $input) {
      id
      invoiceNumber
      status
      client {
        accountId
        name
      }
      billDate
      dueDate
      total
    }
  }
`;

export const UPDATE_CLIENT_CONTRACT = /* GraphQL */ `
  mutation UpdateClientContract($input: UpdateClientContractInput!) {
    updateClientContract(input: $input) {
      id
      name
      contractType
      changes {
        type
        quantity
        effectiveDate
        endDate
      }
    }
  }
`;

export const CREATE_SERVICE_CATALOG_ITEM = /* GraphQL */ `
  mutation CreateServiceCatalogItem($input: CreateServiceCatalogItemInput!) {
    createServiceCatalogItem(input: $input) {
      itemId
      name
      status
      category
    }
  }
`;

export const CREATE_INVOICE = /* GraphQL */ `
  mutation CreateInvoice($input: CreateInvoiceInput!) {
    createInvoice(input: $input) {
      id
      status
    }
  }
`;
