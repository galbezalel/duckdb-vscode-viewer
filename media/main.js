import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap } from '@codemirror/commands';
import { basicSetup } from 'codemirror';

const vscode = acquireVsCodeApi();

const statusEl = document.getElementById("status");
const fileNameEl = document.getElementById("fileName");
const sqlEditorEl = document.getElementById("sql-editor");
const tableEl = document.getElementById("table");
const copyBtn = document.getElementById("copy");
const runBtn = document.getElementById("run");
const refreshBtn = document.getElementById("refresh");

let db = null;
let conn = null;
let currentFile = { name: "", extension: "csv", virtualName: "" };
let lastRows = [];
let lastColumns = [];
let sqlEditor = null; // CodeMirror editor instance

const setStatus = (text, variant = "info") => {
  statusEl.textContent = text;
  statusEl.className = `status ${variant}`;
};

// Initialize CodeMirror editor
const initEditor = () => {
  sqlEditor = new EditorView({
    state: EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
        sql(),
        oneDark,
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              runSql();
              return true;
            }
          }
        ]),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" }
        })
      ]
    }),
    parent: sqlEditorEl
  });
};

const ensureConnection = async () => {
  if (conn) {
    return conn;
  }

  try {
    setStatus("Loading DuckDB (local wasm)...", "info");

    // Get paths injected by the extension host
    const paths = window.__duckdbPaths;
    if (!paths?.worker || !paths?.wasm) {
      throw new Error("DuckDB paths not provided by extension");
    }

    const duckdb = await import('@duckdb/duckdb-wasm');

    const bundle = {
      mainModule: paths.wasm,
      mainWorker: paths.worker,
      pthreadWorker: null,
    };

    // Create worker using blob URL to avoid CORS issues
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}"); `], { type: 'text/javascript' })
    );
    const worker = new Worker(workerUrl);
    URL.revokeObjectURL(workerUrl);

    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    setStatus("DuckDB ready", "success");
    conn = await db.connect();
    return conn;
  } catch (err) {
    console.error("DuckDB init failed", err);
    setStatus(
      `DuckDB init failed: ${err?.message ?? "Unknown error"} `,
      "error",
    );
    throw err;
  }
};

const renderTable = (columns, rows) => {
  lastColumns = columns;
  lastRows = rows;
  if (!columns.length) {
    tableEl.innerHTML = `\u003cdiv class="muted"\u003eQuery executed. No columns returned.\u003c/div\u003e`;
    return;
  }

  const header = columns.map((c) => `\u003cth\u003e${c}\u003c/th\u003e`).join("");
  const body = rows
    .map(
      (row) =>
        `\u003ctr\u003e${columns
          .map((col) => `\u003ctd title="${row[col] ?? ""}"\u003e${row[col] ?? ""}\u003c/td\u003e`)
          .join("")
        }\u003c/tr\u003e`,
    )
    .join("");

  tableEl.innerHTML = `\u003ctable\u003e\u003cthead\u003e\u003ctr\u003e${header}\u003c/tr\u003e\u003c/thead\u003e\u003ctbody\u003e${body}\u003c/tbody\u003e\u003c/table\u003e`;

  // Add column resizing
  setupColumnResizing();
};

const setupColumnResizing = () => {
  const table = tableEl.querySelector('table');
  if (!table) return;

  const headers = table.querySelectorAll('th');
  headers.forEach((th, index) => {
    let startX, startWidth;

    const onMouseMove = (e) => {
      const width = startWidth + (e.clientX - startX);
      th.style.width = Math.max(50, width) + 'px';

      // Update corresponding column cells
      const cells = table.querySelectorAll(`td: nth - child(${index + 1})`);
      cells.forEach(cell => {
        cell.style.width = Math.max(50, width) + 'px';
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    th.addEventListener('mousedown', (e) => {
      // Only resize if clicking near the right edge
      const rect = th.getBoundingClientRect();
      if (e.clientX > rect.right - 10) {
        startX = e.clientX;
        startWidth = th.offsetWidth;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      }
    });

    // Change cursor when hovering near edge
    th.addEventListener('mousemove', (e) => {
      const rect = th.getBoundingClientRect();
      th.style.cursor = e.clientX > rect.right - 10 ? 'col-resize' : 'default';
    });
  });
};

const copyCsv = () => {
  if (!lastColumns.length) {
    setStatus("Nothing to copy", "warn");
    return;
  }

  const escape = (value) => {
    if (value == null) {
      return "";
    }
    const str = String(value);
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [
    lastColumns.join(","),
    ...lastRows.map((row) => lastColumns.map((c) => escape(row[c])).join(",")),
  ];
  const csv = rows.join("\n");
  vscode.postMessage({ type: "copyToClipboard", value: csv });
  setStatus("Copied results as CSV", "info");
};

const defaultQueryForFile = (virtualName, extension, displayName) => {
  const source =
    extension.toLowerCase() === "parquet"
      ? `read_parquet('${virtualName}')`
      : `read_csv_auto('${virtualName}')`;
  return `-- Preview of ${displayName}\nSELECT * FROM ${source}\nLIMIT 100;`;
};

const runSql = async () => {
  if (!sqlEditor) {
    setStatus("SQL Editor not initialized", "error");
    return;
  }

  const sql = sqlEditor.state.doc.toString().trim();
  if (!sql) {
    setStatus("SQL is empty", "warn");
    return;
  }

  try {
    const connection = await ensureConnection();
    setStatus("Running query...", "info");
    const result = await connection.query(sql);
    const rows = result.toArray();
    const columns = result.schema.fields.map((f) => f.name);
    renderTable(columns, rows);
    setStatus(`Returned ${rows.length} row(s)`, "success");
  } catch (err) {
    console.error(err);
    setStatus(err?.message ?? "Query failed", "error");
  }
};

const loadData = async ({ data, name, extension }) => {
  currentFile = {
    name,
    extension,
    virtualName: `${name}-${Date.now()}`,
  };
  fileNameEl.textContent = name;

  // Set CodeMirror content
  const defaultQuery = defaultQueryForFile(
    currentFile.virtualName,
    extension,
    name,
  );
  sqlEditor.dispatch({
    changes: { from: 0, to: sqlEditor.state.doc.length, insert: defaultQuery }
  });

  renderTable([], []);

  try {
    const connection = await ensureConnection();
    const toBytes = (payload) => {
      if (payload instanceof ArrayBuffer) {
        return new Uint8Array(payload);
      }
      if (ArrayBuffer.isView(payload)) {
        return new Uint8Array(payload.buffer);
      }
      if (Array.isArray(payload)) {
        return Uint8Array.from(payload);
      }
      throw new Error("Unsupported data payload");
    };

    const buffer = toBytes(data);
    setStatus(`File received (${buffer.byteLength} bytes). Loading...`, "info");
    await db.registerFileBuffer(currentFile.virtualName, buffer);
    setStatus("File loaded into DuckDB", "success");
    await runSql();
  } catch (err) {
    console.error(err);
    setStatus(err?.message ?? "Failed to load file", "error");
  }
};

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "loadData") {
    loadData(message);
  }
});

runBtn.addEventListener("click", runSql);
refreshBtn.addEventListener("click", () => {
  setStatus("Reloading file...", "info");
  vscode.postMessage({ type: "requestRefresh" });
});
copyBtn.addEventListener("click", copyCsv);

// Initialize CodeMirror editor
initEditor();

setStatus("Initializing...", "info");
vscode.postMessage({ type: "ready" });

window.addEventListener("error", (event) => {
  console.error("Unhandled error", event.error ?? event.message);
  setStatus(`Error: ${event.error?.message ?? event.message}`, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection", event.reason);
  setStatus(
    `Error: ${event.reason?.message ?? String(event.reason)}`,
    "error",
  );
});
