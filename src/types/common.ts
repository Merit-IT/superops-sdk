export type StringOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'IN'
  | 'NOT_IN'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY';

export type NumberOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_THAN_OR_EQUALS'
  | 'LESS_THAN_OR_EQUALS'
  | 'IN'
  | 'NOT_IN';

export type DateTimeOperator =
  | 'ON'
  | 'BEFORE'
  | 'AFTER'
  | 'BETWEEN'
  | 'CONTAINS';

export type BooleanOperator = 'EQUALS';

export interface Operands {
  string?: string[];
  number?: number[];
  boolean?: boolean;
  dateTime?: string[];
}

/** A single filter condition against a SuperOps list query. */
export interface RuleConditionInput {
  attribute: string;
  operator: StringOperator | NumberOperator | DateTimeOperator | BooleanOperator;
  operands: Operands;
}

/** Relative-date value for `DateTimeOperator`s like `inNext`/`inLast` (e.g. "in the last 7 days"). */
export interface RelativeDateValue {
  unit: 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | 'HOUR' | 'MINUTE' | 'SECOND';
  quantity: string;
}

/** One leaf condition inside a `JoinedConditionInput` — value is a plain string, not the typed `Operands` bucket. */
export interface ConditionOperand {
  attribute: string;
  operator: string;
  /**
   * A bare string for most operators; an array for `includes`/`notIncludes`; a
   * `RelativeDateValue` for relative date/time operators like `inNext`/`inLast`
   * (all verified working).
   */
  value: string | string[] | number | boolean | RelativeDateValue;
}

/**
 * Multi-condition AND/OR filter shape. Some list queries (e.g. `getClientContractList`) take this
 * form instead of the single-attribute `RuleConditionInput` — the two are different GraphQL input
 * types per-endpoint, not variants of one shape, so check what the endpoint you're calling actually
 * expects before picking one.
 */
/** Operands can themselves be nested condition groups, not just flat leaf conditions. */
export interface JoinedConditionInput {
  joinOperator: 'AND' | 'OR';
  operands: (ConditionOperand | JoinedConditionInput)[];
}

export interface SortInput {
  attribute: string;
  order: 'ASC' | 'DESC';
}

/** Pagination input accepted by most (but not all — see README) SuperOps get*List queries. */
export interface ListInfoInput {
  page?: number;
  pageSize?: number;
  condition?: RuleConditionInput | JoinedConditionInput;
  /** A bare object and an array of objects are both verified working — GraphQL coerces a scalar into a single-element list for list-typed arguments. */
  sort?: SortInput | SortInput[];
}

/** Pagination metadata returned by most (but not all) SuperOps get*List queries. */
export interface ListInfo {
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Common identifier shape used by SuperOps `*IdentifierInput` types (e.g. ClientIdentifierInput). */
export interface Identifier {
  accountId?: string;
  itemId?: string;
  id?: string;
}
