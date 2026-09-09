import { NumberFormat } from "@/lib/cellFormat";

export type Locale = "th" | "en";

export const LOCALES: Locale[] = ["th", "en"];
export const DEFAULT_LOCALE: Locale = "th";

export type CategoryKey = "math" | "stats" | "logic" | "text" | "date" | "lookup";

export interface FormulaMessage {
  name: string;
  description: string;
  example: string;
  params: Record<string, { label: string; placeholder?: string }>;
  /** For a param rendered as a <select> (e.g. VLOOKUP's exact/approximate match toggle):
   *  paramKey -> optionValue -> display label. */
  options?: Record<string, Record<string, string>>;
}

export interface Messages {
  app: {
    brand: string;
    /** Shows the *other* language's name — clicking it switches to that language. */
    languageToggleLabel: string;
  };
  toolbar: {
    importExcel: string;
    exportExcel: string;
    exportPdf: string;
    undoTitle: string;
    redoTitle: string;
    addRow: string;
    addColumn: string;
    autosaveTitle: string;
    autosaveLabel: string;
    formulas: string;
    askAi: string;
  };
  formatBar: {
    label: string;
    boldTitle: string;
    alignTitle: { left: string; center: string; right: string };
    colorTitle: string;
    sortAscTitle: string;
    sortDescTitle: string;
  };
  numberFormats: Record<NumberFormat, string>;
  formulaBar: {
    placeholder: string;
  };
  sheetTabs: {
    confirmDelete: (name: string) => string;
    deleteTitle: string;
    addTitle: string;
  };
  filterPopover: {
    selectAll: string;
    clearAll: string;
    blank: string;
    noData: string;
    clearFilter: string;
    ok: string;
  };
  grid: {
    filterColumnTitle: string;
    insertRowAbove: string;
    deleteRow: string;
    insertColumnLeft: string;
    deleteColumn: string;
  };
  palette: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    notFound: string;
    allCategory: string;
  };
  categories: Record<CategoryKey, string>;
  paramPanel: {
    insertingAt: string;
    noParams: string;
    pickingHint: string;
    applyToLabel: string;
    scopeCell: string;
    scopeRow: string;
    scopeColumn: string;
    scopeSelection: string;
    previewLabel: string;
    cancel: string;
    insert: string;
    pickRangeTitle: string;
  };
  ai: {
    title: string;
    subtitle: string;
    selectionLabel: string;
    textareaPlaceholder: string;
    askButton: string;
    heuristicNote: string;
    connectionError: string;
    examples: string[];
    insertAt: (address: string) => string;
  };
  store: {
    busyImporting: string;
    busyExportingXlsx: string;
    importError: string;
  };
  /** Explanations for the keyword-based fallback AI suggester (used when no
   *  ANTHROPIC_API_KEY is configured), keyed by rule id. */
  aiHeuristic: {
    rules: Record<string, string>;
    fallback: string;
  };
  formulas: Record<string, FormulaMessage>;
}
