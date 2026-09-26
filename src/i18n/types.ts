// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { NumberFormat } from "@/lib/cellFormat";
import { CfComparison, CfTest } from "@/lib/conditionalFormat";
import { ChartKind } from "@/lib/charts";

export type Locale = "th" | "en";

export const LOCALES: Locale[] = ["th", "en"];
export const DEFAULT_LOCALE: Locale = "th";

export type CategoryKey = "math" | "stats" | "logic" | "text" | "date" | "lookup" | "array";

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
    /** Closes the sidebar panel when it covers the screen on a phone. */
    close: string;
    brand: string;
    skipToContent: string;
    /** Shows the *other* language's name — clicking it switches to that language. */
    languageToggleLabel: string;
    languageToggleTitle: string;
  };
  toolbar: {
    importFile: string;
    importTitle: string;
    exportExcel: string;
    exportPdf: string;
    exportCsv: string;
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
    demoNote: string;
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
    /** The operator token that unlocks the data-source API. */
    tokenLabel: string;
    tokenHint: string;
    tokenPlaceholder: string;
    tokenRejected: string;
    unlock: string;
    lock: string;
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
      typePostgres: string;
      typeMysql: string;
      connection: string;
      connectionPlaceholder: string;
      connectionHint: string;
      query: string;
      queryPlaceholder: string;
      queryHint: string;
      queryProblem: Record<string, string>;
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
    /** Copy for the live, editable sheet in the hero. The figures live in the component — they are
     *  the same in every language — so only the labels a reader parses are here. */
    demo: {
      headers: string[];
      items: string[];
      totalLabel: string;
      emptyCell: string;
      hint: string;
      caption: string;
    };
    /** The three-column strip under the hero. It answers the first objection a visitor has —
     *  "Google Sheets and Office already do this" — which is true, so the page has to say where
     *  the difference actually is rather than talk past it. Every row must be a fact a reader can
     *  check, and `disclaimer` states plainly what the table is *not* claiming. */
    compare: {
      title: string;
      /** Column headers: this app first, then the two it is being measured against. */
      columns: [string, string, string];
      /** `values` is paired by index with `columns`; `good` marks which column the row favours. */
      rows: { label: string; values: [string, string, string]; good: boolean }[];
      disclaimer: string;
    };
    /**
     * The business case, told as the problems a team already pays for rather than as a list of
     * features.
     *
     * A feature list asks the reader to work out what each item is for. A problem they recognise —
     * in their own words, with what it is costing them — does that work for them, and then every
     * feature under it arrives already explained. One problem is usually solved by several
     * features together, which is the point: `solvedBy` is a short chain, read top to bottom, and
     * `outcome` is the line under the double rule, the way a ledger writes its total.
     *
     * Paired by index with the exhibits and anchors in the landing page component. Every figure in
     * this copy must be one `scripts/counts.mjs` can count, or no figure at all.
     */
    painTitle: string;
    painLead: string;
    /** The label for the index of problems at the top of the section, read by screen readers. */
    painIndexLabel: string;
    painLabels: { problem: string; who: string; cost: string; solvedBy: string; outcome: string };
    pains: {
      /** Short enough for the index: the problem in four or five words. */
      short: string;
      /** The problem in the customer's words, not ours. */
      title: string;
      who: string;
      /** What it costs today — in time, risk or money — without an invented statistic. */
      cost: string;
      solvedBy: { name: string; does: string }[];
      outcome: string;
      /** Alt text and caption for the exhibit: what the screenshot proves, not what it depicts. */
      alt: string;
    }[];
    statsTitle: string;
    stats: { value: string; label: string }[];
    /** The one thing the numbers above cannot say: what the test suite did not catch. */
    statsStory: { title: string; body: string[] };
    /** What the app cannot do, stated on the front page rather than buried in the README. */
    limitsTitle: string;
    limitsLead: string;
    limits: { title: string; body: string }[];
    limitsMoreText: string;
    limitsMoreCta: string;
    closingTitle: string;
    closingBody: string;
    footerNote: string;
    /** Author credit in the landing page footer. The licence only requires attribution in the
     *  source tree, so this is where a person actually using the app can find who made it. */
    builtBy: string;
    authorName: string;
    backToApp: string;
    home: string;
  };
  template: {
    /** Banner shown when the open sheet came from a protected .xlsx template. */
    title: string;
    fieldCount: (fields: number) => string;
    hint: string;
    lockedCell: string;
    unlock: string;
    confirmUnlock: string;
    unlocked: string;
    structureLocked: string;
    choosePlaceholder: string;
  };
  cloud: {
    /** The optional bring-your-own-backend cloud save panel. */
    title: string;
    subtitle: string;
    openTitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    sendLink: string;
    linkSent: string;
    signedInAs: (email: string) => string;
    signOut: string;
    nameLabel: string;
    namePlaceholder: string;
    saveNew: string;
    saveOver: (name: string) => string;
    saved: string;
    opened: string;
    myWorkbooks: (n: number) => string;
    empty: string;
    openWorkbook: string;
    removeWorkbook: string;
    confirmRemove: (name: string) => string;
    updatedAt: (when: string) => string;
    linkedTo: (name: string) => string;
    conflict: string;
    unreadable: string;
    working: string;
    privacy: string;
  };
  share: {
    /** Inviting other accounts to one saved workbook. */
    title: string;
    subtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    invite: string;
    invited: string;
    sharedWith: (n: number) => string;
    nobody: string;
    remove: string;
    confirmRemove: (email: string) => string;
    ownerOnly: string;
    sharedWithYou: string;
    needsWorkbook: string;
  };
  names: {
    /** Names people give to ranges, so a formula can say what it means. */
    title: string;
    short: string;
    openTitle: string;
    subtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    refersTo: (ref: string) => string;
    add: string;
    rename: string;
    remove: (name: string) => string;
    empty: string;
    defined: (name: string, range: string) => string;
    deleted: (name: string) => string;
    problem: {
      empty: string;
      looksLikeRef: string;
      badChars: string;
      reserved: string;
      tooLong: string;
      taken: string;
    };
    hint: string;
  };
  validation: {
    /** Rules the person set on what may go in a cell, and the refusals they cause. */
    title: string;
    /** The format-bar button's own label, which has a toolbar's worth of room rather than a heading's. */
    short: string;
    subtitle: string;
    openTitle: string;
    kindList: string;
    kindNumber: string;
    kindLength: string;
    listLabel: string;
    listPlaceholder: string;
    minLabel: string;
    maxLabel: string;
    lengthLabel: string;
    apply: string;
    clear: string;
    applied: (range: string) => string;
    cleared: (range: string) => string;
    noneHere: string;
    hasRule: (what: string) => string;
    refused: {
      notInList: (ref: string) => string;
      notANumber: (ref: string) => string;
      tooSmall: (ref: string) => string;
      tooLarge: (ref: string) => string;
      tooLong: (ref: string) => string;
    };
  };
  versions: {
    /** Earlier states of a cloud workbook, kept by the database. */
    title: string;
    subtitle: string;
    none: string;
    count: (n: number) => string;
    open: string;
    confirmOpen: (when: string) => string;
    opened: string;
    needsWorkbook: string;
    limit: string;
  };
  collab: {
    /** Live editing with other people in the same saved workbook. */
    title: string;
    subtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    someone: string;
    join: string;
    leave: string;
    joining: string;
    failed: string;
    needsWorkbook: string;
    alone: string;
    hereNow: (n: number) => string;
    at: (name: string, ref: string) => string;
    overwritten: (ref: string) => string;
    limits: string;
  };
  comments: {
    /** The note attached to one cell: its editor, its marker and its button. */
    title: string;
    titleFor: (ref: string) => string;
    openTitle: string;
    placeholder: string;
    save: string;
    remove: string;
    hint: string;
    selectCell: string;
  };
  charts: {
    /** Sidebar panel that draws charts from a range of the sheet. */
    title: string;
    subtitle: string;
    openTitle: string;
    fromRange: (range: string) => string;
    rangeHint: string;
    kinds: Record<ChartKind, string>;
    count: (n: number) => string;
    empty: string;
    remove: string;
    noNumbers: string;
    /** How a chart on the grid is moved and resized, said once in the panel. */
    onGrid: string;
    move: string;
    resize: string;
    /** A pie draws one series; this labels the picker for which. */
    pieSeries: string;
  };
  conditionalFormat: {
    /** Sidebar panel where value-driven styling rules are written and listed. */
    title: string;
    subtitle: string;
    openTitle: string;
    appliesTo: (range: string) => string;
    selectFirst: string;
    kindLabel: string;
    /** Accessible names for the two selects that have no visible label of their own — a screen
     *  reader otherwise announces "combo box" and nothing else. */
    operatorLabel: string;
    kinds: { compare: string; textContains: string; rank: string; colorScale: string; dataBar: string };
    operators: Record<CfComparison, string>;
    valueLabel: string;
    value2Label: string;
    textLabel: string;
    countLabel: string;
    topLabel: string;
    bottomLabel: string;
    scaleLabel: string;
    scales: { redGreen: string; greenRed: string; whiteBlue: string };
    styleLabel: string;
    styleNames: { red: string; amber: string; green: string; blue: string };
    add: string;
    ruleCount: (n: number) => string;
    empty: string;
    remove: string;
    clearAll: string;
    confirmClear: string;
    /** One-line plain-language summary of a rule, shown in the list. */
    describe: (test: CfTest) => string;
    orderNote: string;
  };
  /** Shown only while the workbook is still the untouched sample, so nobody mistakes the demo
   *  data for something they left behind. */
  sampleNotice: {
    text: string;
    /** The "try this" half, hidden below `sm` — on a phone the grid is what matters, and a
     *  four-line banner before the first row is the cost this avoids. */
    tip: string;
    startBlank: string;
  };
  storageNotice: {
    /** Shown once inside the app: work lives in this browser only. The README saying so is no
     *  help to someone who has already typed an afternoon's work into the grid. */
    text: string;
    dismiss: string;
  };
  saveFailed: {
    /** Shown while autosave cannot reach the browser's storage because the workbook is bigger
     *  than the quota. The work is intact in this tab; it is the reload that would lose it. */
    full: string;
    /** The same, when storage refused for another reason (private mode, a policy). */
    blocked: string;
  };
  formatBar: {
    /** Collapses the formatting row to give the grid back its vertical space. */
    hide: string;
    show: string;
    label: string;
    boldTitle: string;
    alignTitle: { left: string; center: string; right: string };
    colorTitle: string;
    sortAscTitle: string;
    sortDescTitle: string;
    numberFormatTitle: string;
  };
  numberFormats: Record<NumberFormat, string>;
  /** The pivot panel, and the sheet it writes. */
  pivot: {
    title: string;
    subtitle: string;
    sourceLabel: string;
    rowFields: string;
    colField: string;
    valueField: string;
    aggLabel: string;
    none: string;
    build: string;
    sourceChanged: string;
    sourceGone: string;
    refresh: string;
    sheetName: string;
    blank: string;
    grandTotal: string;
    /** e.g. ("Sum", "Price") -> "Sum of Price" */
    valueHeading: (agg: string, field: string) => string;
    aggNames: Record<"sum" | "count" | "average" | "min" | "max", string>;
    needRows: string;
    pickRowField: string;
  };
  formulaBar: {
    /** The ranges the selected formula reads, shown beside it and read out. */
    reads: string;
    readsElsewhere: string;
    readsTitle: string;
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
  /**
   * What the live region says. Everything here describes a change that happens *away from the
   * cursor* — moving the cursor is announced by focus landing on the cell and needs nothing here,
   * and saying it twice is worse than not saying it.
   */
  live: {
    /** Freezing is a band of the screen changing behaviour, none of it where the cursor is. */
    frozen: (rows: number, cols: number) => string;
    unfrozen: string;
    sorted: (column: string, ascending: boolean) => string;
    filtered: (column: string, visible: number, total: number) => string;
    filterCleared: (column: string) => string;
    allFiltersCleared: (total: number) => string;
    pasted: (rows: number, cols: number, at: string) => string;
    cleared: (range: string) => string;
    filled: (cells: number, range: string) => string;
    replacedOne: (at: string) => string;
    replacedAll: (cells: number) => string;
    copied: (range: string) => string;
    cut: (range: string) => string;
    rowAppended: (total: number) => string;
    columnAppended: (total: number) => string;
    rowInserted: (row: number) => string;
    rowDeleted: (row: number) => string;
    columnInserted: (column: string) => string;
    columnDeleted: (column: string) => string;
    merged: (range: string) => string;
    unmerged: (range: string) => string;
    formulaInserted: (formula: string, at: string) => string;
    imported: (sheets: number) => string;
    chartAdded: (kind: string, range: string) => string;
    chartRemoved: (remaining: number) => string;
    chartKindChanged: (kind: string) => string;
    chartMoved: (at: string) => string;
    pivotBuilt: (name: string, rows: number, cols: number) => string;
    pivotRefreshed: (rows: number, cols: number) => string;
    undone: string;
    redone: string;
  };
  find: {
    title: string;
    close: string;
    searchPlaceholder: string;
    replacePlaceholder: string;
    replace: string;
    replaceAll: string;
    matchCase: string;
    wholeCell: string;
    allSheets: string;
    next: string;
    previous: string;
    /** Says plainly that this searches what was typed, not what is displayed. */
    hint: string;
    noMatches: string;
    /** Before Find Next has been pressed there is no "current" match, so the index is left out
     *  entirely — "0 of 3" reads like a bug. */
    found: (total: number) => string;
    count: (index: number, total: number, at: string) => string;
  };
  shortcuts: {
    title: string;
    subtitle: string;
    /** The toolbar button, and the dialog's own row telling you how you got here. */
    open: string;
    close: string;
    /** Not a key: the wording for "start typing and the cell opens". */
    anyKey: string;
    groups: Record<string, string>;
    items: Record<string, string>;
  };
  freeze: {
    /** The pane split: rows and columns that stay put while the rest scrolls. */
    freeze: string;
    unfreeze: string;
    title: string;
  };
  grid: {
    filterColumnTitle: string;
    insertRowAbove: string;
    deleteRow: string;
    insertColumnLeft: string;
    deleteColumn: string;
    /** The touch grip that pulls a selection out to a range. */
    extendSelection: string;
    /** The mouse grip on the same corner, which continues the selection instead. */
    fillHandle: string;
    /** Names the grid itself. A `role="grid"` with no name is announced as "grid" and nothing else. */
    label: string;
    /** The blank corner above the row numbers, which is a column header with no text in it. */
    cornerHeader: string;
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
    /** Shown when the server refuses because this browser has asked too often. */
    rateLimited: (seconds: number) => string;
    examples: string[];
    insertAt: (address: string) => string;
    /** "Bring your own key": the visitor's own Anthropic key, held in this tab only, used to call
     *  Anthropic straight from the browser. See `src/lib/byok.ts` for why it works that way. */
    byok: {
      title: string;
      lead: string;
      placeholder: string;
      save: string;
      change: string;
      clear: string;
      /** Shown once a key is set, with the key masked — never the whole thing. */
      active: (masked: string) => string;
      invalid: string;
      privacyNote: string;
      /** The honest half of the privacy note: a key in the page can be read by anything in the
       *  page, so the advice is to bring one that can be thrown away. */
      keyAdviceNote: string;
      getKeyLink: string;
    };
  };
  merge: {
    title: string;
    split: string;
    join: string;
    confirmDiscard: string;
  };
  store: {
    busyImporting: string;
    busyExportingXlsx: string;
    busyExportingPdf: string;
    busyExportingCsv: string;
    importError: string;
    csvEmpty: string;
  };
  /** Explanations for the keyword-based fallback AI suggester (used when no
   *  ANTHROPIC_API_KEY is configured), keyed by rule id. */
  aiHeuristic: {
    rules: Record<string, string>;
    /** Shown when no rule matched. Named for what it says, because it no longer offers a formula:
     *  the old `fallback` handed back SUM for anything unrecognised, which is how "join these
     *  names" became a number nobody questioned. */
    noMatch: string;
  };
  formulas: Record<string, FormulaMessage>;
}
