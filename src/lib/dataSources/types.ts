export type DataSourceType = "rest" | "csv";

/** Full config, including secrets — lives only on the server (data/sources.json). */
export interface DataSourceConfig {
  id: string;
  name: string;
  type: DataSourceType;
  /** Absolute URL, or an app-relative path like "/api/demo/sales" (resolved against the request origin). */
  url: string;
  method?: "GET" | "POST";
  /** Optional header used for auth, e.g. { name: "Authorization", value: "Bearer ..." }. */
  authHeader?: { name: string; value: string };
  /** Optional dot-path into the JSON response to the array/object to tabulate, e.g. "data.items". */
  jsonPath?: string;
  /** How many rows to collect in total. When a response signals a next page (a Link header, a
   *  "next" URL, a cursor, or a page/offset param already in the URL), pages are followed until
   *  this many rows are in hand. 0 means "just the first response"; undefined means DEFAULT_MAX_ROWS. */
  maxRows?: number;
  refreshSec: number;
  createdAt: string;
}

/** What the browser sees — the auth header value is masked. */
export interface PublicDataSource extends Omit<DataSourceConfig, "authHeader"> {
  authHeader?: { name: string; value: string; masked: true };
}

export type CellValue = string | number | boolean | null;

export interface TableColumn {
  /** Flattened key, e.g. "customer.name". */
  key: string;
  /** Human-readable label, e.g. "customer › name". */
  label: string;
  numeric: boolean;
}

export interface TableData {
  columns: TableColumn[];
  rows: CellValue[][];
  fetchedAt: string;
  /** How many HTTP requests produced this table — 1 unless pages were followed. */
  pageCount?: number;
  /** True when collecting stopped at a limit while the source still had more pages, so these
   *  rows are only part of the data. Surfaced in the UI: a silent partial table is worse than a
   *  small one the user knows is partial. */
  truncated?: boolean;
}

export interface SourceFetchError {
  error: string;
}
