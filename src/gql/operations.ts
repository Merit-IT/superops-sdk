/**
 * Field selections here are general for what we needed at time. For anything narrower/wider
 * than you need, use SuperOpsClient#query with your own selection rather than editing these
 * shared strings.
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
        createdTime
        updatedTime
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
      createdTime
      updatedTime
    }
  }
`;

const CLIENT_CONTRACT_FIELDS = /* GraphQL */ `
  contractId
  client
  startDate
  endDate
  contractStatus
  contract {
    contractId
    name
    description
    contractType
    billableContract {
      contractId
      chargeItem
      quantityCalculationType
      sellingPriceCalculationType
      provisionRule
      sellingPriceOverridden
      sellingPrice {
        model
        details {
          value
          afterHoursValue
        }
      }
      discountRate
      frequencyType
      includedItems
      billableSiteType
      sites
      recurringContract {
        contractId
        recurringMode
        frequencyDurationUnit
        frequencyInterval
        billingOffset
        nextBillDate
      }
      redeemableContract {
        contractId
        applicableType
        applicableHours
        carryForwardRemainingQuantity
      }
      perpetualContract {
        contractId
        autoRenew
      }
      changes {
        changeId
        effectiveDate
        endDate
        quantity
        quantityChangeOperation
      }
      project
      blockItemsInfo {
        blockItemId
        balance
      }
    }
  }
`;

export const GET_CLIENT_CONTRACT_LIST = /* GraphQL */ `
  query GetClientContractList($input: ListInfoInput) {
    getClientContractList(input: $input) {
      clientContracts {
        ${CLIENT_CONTRACT_FIELDS}
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

export const GET_CLIENT_CONTRACT = /* GraphQL */ `
  query GetClientContract($input: ContractIdentifierInput!) {
    getClientContract(input: $input) {
      ${CLIENT_CONTRACT_FIELDS}
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

/** `serviceTypeItem.bundledItems` is kept shallow to avoid an unbounded circular selection. */
export const GET_SERVICE_CATALOG_ITEM_LIST = /* GraphQL */ `
  query GetServiceCatalogItemList($input: ListInfoInput) {
    getServiceCatalogItemList(input: $input) {
      items {
        itemId
        name
        description
        category {
          categoryId
          name
        }
        itemType
        offerAsWorklogItem
        status
        taxable
        taxCategory
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
        serviceTypeItem {
          itemId
          offeringType
          bundledItems {
            itemId
            name
          }
          hourlyServiceTypeItem {
            itemId
            roundUpValue
            defaultItem
          }
          redeemableServiceBundle {
            itemId
            applicableType
            applicableHours
            redeemableQuantity
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
      categoryId
      name
    }
  }
`;

export const GET_INVOICE_LIST = /* GraphQL */ `
  query GetInvoiceList($input: ListInfoInput) {
    getInvoiceList(input: $input) {
      invoices {
        invoiceId
        displayId
        client
        site
        invoiceDate
        dueDate
        statusEnum
        sentToClient
        discountAmount
        additionalDiscount
        additionalDiscountRate
        totalAmount
        notes
        paymentDate
        paymentReference
        paymentLink
        amountDue
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
      invoiceId
      displayId
      client
      site
      invoiceDate
      dueDate
      statusEnum
      sentToClient
      discountAmount
      additionalDiscount
      additionalDiscountRate
      totalAmount
      notes
      paymentDate
      paymentReference
      paymentLink
      amountDue
    }
  }
`;

export const GET_CLIENT_CUSTOM_FIELD_LIST = /* GraphQL */ `
  query GetClientCustomFieldList {
    getClientCustomFieldList {
      id
      columnName
      label
      description
      fieldType
      options
      showToClient
      isMandatory
    }
  }
`;

export const GET_CLIENT_CUSTOM_FIELD = /* GraphQL */ `
  query GetClientCustomField($input: CustomFieldIdentifierInput!) {
    getClientCustomField(input: $input) {
      id
      columnName
      label
      description
      fieldType
      options
      showToClient
      isMandatory
    }
  }
`;

export const GET_CLIENT_USER_LIST = /* GraphQL */ `
  query GetClientUserList($input: GetClientUserListInput) {
    getClientUserList(input: $input) {
      userList {
        userId
        firstName
        lastName
        name
        email
        contactNumber
        customFields
        createdTime
        updatedTime
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

export const GET_CLIENT_USER = /* GraphQL */ `
  query GetClientUser($input: ClientUserIdentifierInput!) {
    getClientUser(input: $input) {
      userId
      firstName
      lastName
      name
      email
      contactNumber
      customFields
      createdTime
      updatedTime
    }
  }
`;


export const GET_CLIENT_SITE = /* GraphQL */ `
  query GetClientSite($input: ClientSiteIdentifierInput!) {
    getClientSite(input: $input) {
      id
      name
      timezoneCode
      working24x7
      line1
      line2
      line3
      city
      postalCode
      countryCode
      stateCode
      contactNumber
      hq
    }
  }
`;


export const UPDATE_CLIENT_CONTRACT = /* GraphQL */ `
  mutation UpdateClientContract($input: UpdateClientContractInput!) {
    updateClientContract(input: $input)
  }
`;

export const CREATE_SERVICE_CATALOG_ITEM = /* GraphQL */ `
  mutation CreateServiceCatalogItem($input: CreateServiceCatalogItemInput!) {
    createServiceCatalogItem(input: $input) {
      itemId
      name
      status
      category {
        categoryId
        name
      }
    }
  }
`;

export const CREATE_INVOICE = /* GraphQL */ `
  mutation CreateInvoice($input: CreateInvoiceInput!) {
    createInvoice(input: $input) {
      invoiceId
      displayId
      statusEnum
      totalAmount
    }
  }
`;

export const GET_TICKET_LIST = /* GraphQL */ `
  query GetTicketList($input: ListInfoInput) {
    getTicketList(input: $input) {
      tickets {
        ticketId
        displayId
        subject
        source
        client
        site
        requester
        techGroup
        technician
        status
        approvalStatus
        priority
        impact
        urgency
        category
        subcategory
        cause
        subcause
        resolutionCode
        createdTime
        updatedTime
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

/** Bare array for one ticket, no `listInfo` wrapper — fetch with `paginated: false`. */
export const GET_TICKET_NOTE_LIST = /* GraphQL */ `
  query GetTicketNoteList($input: TicketIdentifierInput!) {
    getTicketNoteList(input: $input) {
      noteId
      addedBy
      addedOn
      content
      attachments {
        fileName
        originalFileName
        fileSize
      }
      privacyType
    }
  }
`;

export const GET_TECHNICIAN_LIST = /* GraphQL */ `
  query GetTechnicianList($input: ListInfoInput) {
    getTechnicianList(input: $input) {
      userList {
        userId
        firstName
        lastName
        name
        email
        contactNumber
        emailSignature
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

/** `invoice` (a back-reference to the parent Invoice) is omitted to avoid a circular selection. */
export const GET_INVOICE_ITEM_LIST = /* GraphQL */ `
  query GetInvoiceItemList($input: ListInfoInput) {
    getInvoiceItemList(input: $input) {
      items {
        itemId
        billedDate
        details
        quantity
        unitPrice
        discountAmount
        discountRate
        amount
        taxable
        tax
        serviceItem
        taxAmount
        totalAmount
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
export const GET_WORK_STATUS_LIST = /* GraphQL */ `
  query GetWorkStatusList {
    getWorkStatusList {
      statusId
      name
      state
    }
  }
`;

/** No `input` argument, no pagination wrapper — returns a bare array. Fetch with `paginated: false`. */
export const GET_URGENCY_LIST = /* GraphQL */ `
  query GetUrgencyList {
    getUrgencyList {
      id
      name
    }
  }
`;

export const GET_TAX_LIST = /* GraphQL */ `
  query GetTaxList($input: ListInfoInput) {
    getTaxList(input: $input) {
      taxes {
        taxId
        name
        rates {
          rateId
          name
          rateValue
        }
        totalRate
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

export const GET_TAX = /* GraphQL */ `
  query GetTax($input: TaxIdentifierInput!) {
    getTax(input: $input) {
      taxId
      name
      rates {
        rateId
        name
        rateValue
      }
      totalRate
    }
  }
`;

/** No `input` argument, no pagination wrapper — returns a bare array. Fetch with `paginated: false`. */
export const GET_CATEGORY_LIST = /* GraphQL */ `
  query GetCategoryList {
    getCategoryList {
      id
      name
      subCategories {
        id
        name
      }
    }
  }
`;

/** No `input` argument, no pagination wrapper — returns a bare array. Fetch with `paginated: false`. */
export const GET_SLA_LIST = /* GraphQL */ `
  query GetSLAList {
    getSLAList {
      id
      name
    }
  }
`;

export const GET_OFFERED_ITEMS = /* GraphQL */ `
  query GetOfferedItems($input: ListInfoInput) {
    getOfferedItems(input: $input) {
      items {
        itemId
        type
        billDate
        status
        serviceItem
        client
        site
        workItem
        technician
        afterHours
        unitPrice
        qty
        discountRate
        amount
        revisedUnitPrice
        revisedQuantity
        revisedDiscountRate
        revisedAmount
        adjustedBlockMoney
        adjustedBlockHour
        notes
        createdTime
        updatedTime
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

export const GET_TASK_LIST = /* GraphQL */ `
  query GetTaskList($input: GetTaskListInput) {
    getTaskList(input: $input) {
      tasks {
        taskId
        displayId
        title
        description
        status
        estimatedTime
        scheduledStartDate
        dueDate
        overdue
        actualStartDate
        actualEndDate
        technician
        techGroup
        workItem
        taskOrder
        priority
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

export const GET_SERVICE_ITEM_LIST = /* GraphQL */ `
  query GetServiceItemList($input: ListInfoInput!) {
    getServiceItemList(input: $input) {
      items {
        itemId
        name
        description
        quantityType
        category {
          categoryId
          name
        }
        useAsWorklogItem
        unitPrice
        businessHoursUnitPrice
        afterHoursUnitPrice
        salesTaxEnabled
        salesTax {
          taxId
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


export const GET_SERVICE_ITEM = /* GraphQL */ `
  query GetServiceItem($input: ServiceItemIdentifierInput!) {
    getServiceItem(input: $input) {
      itemId
      name
      description
      quantityType
      category {
        categoryId
        name
      }
      useAsWorklogItem
      unitPrice
      businessHoursUnitPrice
      afterHoursUnitPrice
      roundUpValue
      quantity
      amount
      adjustBlockItemAgainstAllItems
      blockItemUsedIn
      salesTaxEnabled
      salesTax {
        taxId
        name
        totalRate
      }
    }
  }
`;

/**
 * Bare array, no pagination wrapper. `user` is a bare scalar; `toUsers`/`ccUsers`/`bccUsers` are each a list of objects
 * with a nested `user` field, not bare scalars.
 */
export const GET_TICKET_CONVERSATION_LIST = /* GraphQL */ `
  query GetTicketConversationList($input: TicketIdentifierInput!) {
    getTicketConversationList(input: $input) {
      conversationId
      content
      time
      user
      toUsers {
        user
      }
      ccUsers {
        user
      }
      bccUsers {
        user
      }
      attachments {
        fileName
        originalFileName
        fileSize
      }
      type
    }
  }
`;
