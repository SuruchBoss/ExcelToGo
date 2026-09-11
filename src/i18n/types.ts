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
    data: string;
  };
  data: {
    title: string;
    subtitle: string;
    addSource: string;
    empty: string;
    live: string;
    error: string;
    loading: string;
    updatedAgo: (seconds: number) => string;
    /** "5 รายการ · 6 คอลัมน์" for a multi-row source. */
    itemCount: (rows: number, cols: number) => string;
    /** "4 ค่า" for a single-row (KPI) source. */
    valueCount: (values: number) => string;
    use: string;
    options: string;
    refresh: string;
    edit: string;
    remove: string;
    confirmRemove: (name: string) => string;
    inSheet: string;
    inSheetEmpty: string;
    unlink: string;
    liveCellTitle: (source: string) => string;
    liveCellReadOnly: string;
    /** Shown wherever a paginated source's table is only part of the data. */
    partial: (rows: number) => string;
    partialHint: string;
    /** Shown instead of a raw "HTTP 429" when a source asks to be called less often. */
    rateLimited: string;
    retryIn: (seconds: number) => string;
    retryNow: string;
    pages: (pages: number) => string;
    aggregate: { first: string; sum: string; avg: string; count: string };
    picker: {
      subtitle: string;
      wholeTable: string;
      wholeTableHint: (rows: number, cols: number) => string;
      summaryValue: string;
      summaryValueHint: string;
      target: string;
      area: (rows: number, cols: number) => string;
      areaOverwrite: (rows: number, cols: number) => string;
      invalidCell: string;
      insert: string;
      cancel: string;
    };
    blockTool: {
      rows: (rows: number) => string;
      singleValue: string;
      every: (seconds: number) => string;
      refresh: string;
      change: string;
      remove: string;
    };
    setup: {
      newTitle: string;
      editTitle: string;
      intro: string;
      name: string;
      namePlaceholder: string;
      type: string;
      typeRest: string;
      typeCsv: string;
      typeDb: string;
      url: string;
      urlPlaceholder: string;
      method: string;
      auth: string;
      authHint: string;
      authName: string;
      authValue: string;
      jsonPath: string;
      jsonPathHint: string;
      maxRows: string;
      maxRowsUnit: string;
      maxRowsHint: string;
      refresh: string;
      refreshUnit: string;
      test: string;
      testing: string;
      testOk: (rows: number, cols: number) => string;
      testPages: (pages: number) => string;
      testTruncated: string;
      testFailed: string;
      save: string;
      saving: string;
      cancel: string;
    };
  };
  landing: {
    /** Small line above the headline. */
    eyebrow: string;
    headline: string;
    subheadline: string;
    ctaPrimary: string;
    ctaSecondary: string;
    ctaNote: string;
    screenshotAlt: string;
    problemTitle: string;
    problems: { title: string; body: string }[];
    featuresTitle: string;
    featuresSubtitle: string;
    /** Paired by index with the screenshots listed in the landing page component. */
    features: { title: string; body: string; alt: string; points: string[] }[];
    statsTitle: string;
    stats: { value: string; label: string }[];
    closingTitle: string;
    closingBody: string;
    footerNote: string;
    backToApp: string;
    home: string;
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
