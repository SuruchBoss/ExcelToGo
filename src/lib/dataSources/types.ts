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
}

export interface SourceFetchError {
  error: string;
}
