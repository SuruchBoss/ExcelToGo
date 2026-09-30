// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { FormatChoice } from "@/lib/cellFormat";
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
    /** Beside the logo when the browser refused the last save (storage full or blocked). */
    autosaveFailed: string;
    formulas: string;
    askAi: string;
    data: string;
    /** The cloud tab's name where there is only room for one short word. */
    cloudShort: string;
  };
  data: {
    /** A row or column inserted or deleted inside a live block (#46), and what deleting its first one does. */
    blockStructure: string;
    blockUnlinked: (at: string) => string;
    /** A source that answered with an empty list (#65). */
    noRows: string;
    title: string;
    subtitle: string;
    addSource: string;
    /** The way to the in-app guide at /guide. */
    guideLink: string;
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
    /** Why a table cut for size is partial: it met the most one refresh sends to the browser, in MB. */
    partialSizeHint: (megabytes: number) => string;
    /** A source fetched by this browser (#110): the form, and what it says when a fetch fails. */
    browser: {
      add: string;
      badge: string;
      newTitle: string;
      editTitle: string;
      intro: string;
      name: string;
      namePlaceholder: string;
      type: string;
      typeJson: string;
      typeCsv: string;
      url: string;
      urlPlaceholder: string;
      header: string;
      headerHint: string;
      headerName: string;
      headerValue: string;
      headerValueKeep: string;
      badHeaderName: string;
      badHeaderValue: string;
      secretInQuery: string;
      jsonPath: string;
      jsonPathHint: string;
      maxRows: string;
      refresh: string;
      seconds: string;
      rows: string;
      test: string;
      testing: string;
      testAndAllow: string;
      testOk: (rows: number, cols: number) => string;
      preview: string;
      save: string;
      saveAndAllow: string;
      cancel: string;
      reloadNotice: (host: string) => string;
      reloading: (host: string) => string;
      reloadBlocked: string;
      reloadNow: string;
      enterSecret: string;
      invalidUrl: string;
      insecureHttp: string;
      auth: (status: number) => string;
      http: (status: number, url: string) => string;
      notTable: string;
      keysFound: (keys: string) => string;
      needsSecret: string;
      needsReload: (host: string) => string;
      /** The card's label while a source waits on the person, not on the API (#115). */
      waitingSecret: string;
      waitingReload: string;
      networkTitle: string;
      networkChecks: (appOrigin: string, headers: string) => string[];
      copyForIt: string;
      copied: string;
      itNote: (appOrigin: string, apiUrl: string, headers: string) => string;
    };
    /** Three APIs this site serves, to try the browser path on before connecting a real one. */
    samples: {
      title: string;
      lead: string;
      tryIt: string;
      added: string;
      items: Record<"sales" | "summary" | "orders", { name: string; hint: string }>;
    };
    /** Shown instead of a raw "HTTP 429" when a source asks to be called less often. */
    rateLimited: string;
    retryIn: (seconds: number) => string;
    /** A refresh stopped on purpose — shown instead of the server's code for it. */
    tooLarge: (megabytes: number) => string;
    timedOut: (seconds: number) => string;
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
    /** The AI promise's limit, beside the promise (#125): no key means a keyword guess. */
    aiNote: string;
    ctaNote: string;
    /** Three answers a first visit is looking for — free? private? on my phone? — under the buttons. */
    benefits: string[];
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
    painLabels: { problem: string; who: string; cost: string; solvedBy: string; outcome: string; details: string };
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
    /** The contact block beside the closing call to action. The addresses themselves are not
     *  translated — they live in the landing page — only the words around them are. */
    contact: {
      title: string;
      lead: string;
      emailLabel: string;
      linkedinLabel: string;
      copy: string;
      copied: string;
      copyFailed: string;
    };
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
    /** Announced when the sample opens. */
    opened: string;
  };
  /** Shown on a workbook with nothing in it yet — the way in for somebody who wants to try first. */
  startNotice: {
    text: string;
    openSample: string;
  };
  /** Asked before a sort that would give formulas another row's numbers (#48). */
  sortWarning: {
    title: string;
    body: (formulas: number) => string;
    sortAnyway: string;
    cancel: string;
  };
  /** One tab edits the workbook at a time (#47): the question a second tab asks, and what a tab
   *  that is only looking says about itself. */
  otherTab: {
    title: string;
    body: string;
    useHere: string;
    viewOnly: string;
    viewing: string;
    handedOff: string;
    refused: string;
    /** The editing tab closed or left, and this one edits now with its latest save (#146). */
    freed: string;
    dismiss: string;
  };
  /** "New file": one empty sheet in place of the workbook, asked first when there is work. */
  /** "Convert to dates" (#82): text dates that need to be told the order and the calendar. */
  convertDates: {
    button: string;
    /** The cell menu's entry: the button's words and an ellipsis, since it opens a dialog. */
    menu: string;
    hint: string;
    title: string;
    body: string;
    order: string;
    orders: { dmy: string; mdy: string; ymd: string };
    calendar: string;
    calendars: { be: string; ce: string };
    preview: string;
    before: string;
    after: string;
    counts: (changed: number, unreadable: number) => string;
    nothing: string;
    confirm: (changed: number) => string;
    cancel: string;
  };
  newFile: {
    button: string;
    hint: string;
    title: string;
    body: (sheets: number) => string;
    exportFirst: string;
    confirm: string;
    cancel: string;
    started: string;
  };
  storageNotice: {
    /** Shown once inside the app: work lives in this browser only. The README saying so is no
     *  help to someone who has already typed an afternoon's work into the grid. */
    text: string;
    /** The one line shown in the visit of the first edit (#129). The whole of `text` is one press
     *  away, behind the save status on the top bar. */
    short: string;
    /** The save status's popover: its heading, and its note until a copy has been exported. */
    title: string;
    noCopyYet: string;
    dismiss: string;
  };
  saveFailed: {
    /** Shown while autosave cannot reach the browser's storage because the workbook is bigger
     *  than the quota. The work is intact in this tab; it is the reload that would lose it. */
    full: string;
    /** The same, when storage refused for another reason (private mode, a policy). */
    blocked: string;
  };
  /**
   * /guide — how to connect your own API or database, written for the person who will set it up.
   * Code blocks live here too: their comments are in the reader's language, the commands are not.
   */
  guide: {
    eyebrow: string;
    title: string;
    lead: string;
    /** Connecting from the browser (#110): the way that works on this site, first. */
    browserTitle: string;
    browserBody: string[];
    browserSteps: string[];
    /** What to ask the people who run the API. */
    itTitle: string;
    itLead: string;
    itItems: string[];
    /** From here on: the server-side sources, for a self-hosted deployment. */
    serverTitle: string;
    serverLead: string;
    typesTitle: string;
    typesLead: string;
    typesHead: { type: string; needs: string; example: string };
    types: { name: string; needs: string; example: string }[];
    kitTitle: string;
    kitLead: string;
    steps: { title: string; body: string; code?: string; note?: string }[];
    safetyTitle: string;
    safety: { title: string; body: string }[];
    cloudTitle: string;
    cloudBody: string[];
    cloudCode: string;
    moreTitle: string;
    moreReadme: string;
    moreSecurity: string;
    openApp: string;
    copy: string;
    copied: string;
    copyFailed: string;
    codeLabel: string;
  };
  /** The question asked before a file is opened over work, and the notice after it. */
  importChoice: {
    title: string;
    body: (sheets: number) => string;
    append: string;
    appendHint: string;
    replace: string;
    replaceHint: (sheets: number) => string;
    cancel: string;
    doneAppend: (sheets: number) => string;
    doneReplace: (sheets: number) => string;
    undo: string;
    dismiss: string;
  };
  /** The copy / paste / fill row shown where the pointer is a finger. */
  touchBar: { label: string; copy: string; cut: string; paste: string; fillDown: string; clear: string };
  /** The phone's tab bar and the menu sheet its last tab opens. */
  menu: {
    navLabel: string;
    open: string;
    title: string;
    connect: string;
    connectApi: string;
    connectApiHint: string;
    cloudHint: string;
    guide: string;
    guideHint: string;
    file: string;
    table: string;
    addRow: string;
    addColumn: string;
  };
  formatBar: {
    /** The brush that folds the formatting row away and back: one name whichever way it is, with
     *  `aria-pressed` saying which (PO, #129 — it stands in for the design's "Aa" on short screens). */
    toggle: string;
    label: string;
    boldTitle: string;
    italicTitle: string;
    underlineTitle: string;
    alignTitle: { left: string; center: string; right: string };
    colorTitle: string;
    /** The paint bucket: background colour of the selection, as a few swatches. */
    fillTitle: string;
    fillShort: string;
    fillNone: string;
    fillColors: Record<"yellow" | "green" | "blue" | "orange" | "red" | "purple" | "grey", string>;
    sortAscTitle: string;
    sortDescTitle: string;
    numberFormatTitle: string;
    /** Below 640px: the button that raises the rest of the row as a sheet, and that sheet's name. */
    tools: string;
    toolsTitle: string;
    /** Words for the two sort buttons, which the wide row shows as icons only. */
    sortAscShort: string;
    sortDescShort: string;
    /** Headings inside the phone sheet. */
    groups: { cells: string; sort: string; rules: string; summarise: string };
  };
  numberFormats: Record<FormatChoice, string>;
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
    /** "Convert to dates" (#82): how many changed, and how many were left because they could not be read. */
    datesConverted: (changed: number, unreadable: number) => string;
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
    cellMenu: string;
    insertRowAbove: string;
    deleteRow: string;
    insertColumnLeft: string;
    deleteColumn: string;
    /** The touch grip that pulls a selection out to a range. */
    extendSelection: string;
    /** The cell's own editor, named for a screen reader: "Edit B2". */
    editorLabel: (address: string) => string;
    /** The chip that brings a selection scrolled off screen back into view, e.g. "Back to B2:B9". */
    backToSelection: (address: string) => string;
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
    /** The everyday handful — SUM, AVERAGE, IF, SUMIF, VLOOKUP — that the list now starts with. */
    commonCategory: string;
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
    /** The picking hint on a touch screen, where there is no clicking. */
    pickingHintTouch: string;
    /** The bar the form folds into while a range is picked on a phone (#138). */
    pickingBarLabel: string;
    pickUse: (address: string) => string;
    pickBack: string;
    /** In the bar's chip before anything is picked. */
    pickNothing: string;
  };
  /** The pointing bar above the keyboard while a formula is typed on a phone (#99). */
  pointing: {
    label: string;
    hint: string;
    added: (address: string) => string;
    done: string;
    cancel: string;
    keys: { open: string; close: string; comma: string; colon: string; plus: string; minus: string };
  };
  ai: {
    title: string;
    subtitle: string;
    selectionLabel: string;
    textareaPlaceholder: string;
    askButton: string;
    heuristicNote: string;
    /** On a keyword guess, above the formula. */
    guessBadge: string;
    /** Under a suggestion when the cell it would go in already holds something. */
    overwriteWarning: (address: string) => string;
    /** The answer reads the only cell it could go into, so it is not offered (#64). */
    selfReference: (address: string) => string;
    /** Opens the palette form a declined answer points at (#62). */
    openForm: (name: string) => string;
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
    /** A sheet that goes further down than an import opens: its name, the file's last row, and the rows opened. */
    importClipped: (sheet: string, rowsInFile: number, rowsOpened: number) => string;
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
    /** Why it will not guess, each with the palette form it points at instead (#62–#64). */
    declined: {
      conditional: (form: string | null) => string;
      needsRange: (form: string) => string;
      textColumns: (form: string) => string;
      lookup: string;
      ifDetail: string;
      subtract: string;
      dates: string;
    };
    /** The two outcomes the IF suggestion writes into the cell — in the formula, so in the sheet. */
    ifOutcomes: [pass: string, fail: string];
  };
  formulas: Record<string, FormulaMessage>;
}
