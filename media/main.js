const vscode = acquireVsCodeApi();

const statusEl = document.getElementById("status");
const fileNameEl = document.getElementById("fileName");
const sqlEditor = document.getElementById("sql");
const tableEl = document.getElementById("table");
const copyBtn = document.getElementById("copy");
const runBtn = document.getElementById("run");
const refreshBtn = document.getElementById("refresh");

let db = null;
let conn = null;
let currentFile = { name: "", extension: "csv", virtualName: "" };
let lastRows = [];
let lastColumns = [];

const setStatus = (text, variant = "info") => {
  statusEl.textContent = text;
  statusEl.className = `status ${variant}`;
};

const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const ensureConnection = async () => {
  if (conn) {
    return conn;
  }

  setStatus("Loading DuckDB (web)...", "info");
  const duckdb = await import(
    "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm"
  );

  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  const worker = new Worker(bundle.mainWorker, { type: "module" });
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
  setStatus("DuckDB ready", "info");
  return conn;
};

const renderTable = (columns, rows) => {
  lastColumns = columns;
  lastRows = rows;
  if (!columns.length) {
    tableEl.innerHTML = `<div class="muted">Query executed. No columns returned.</div>`;
    return;
  }

  const header = columns.map((c) => `<th>${c}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((col) => `<td>${row[col] ?? ""}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  tableEl.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
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

const defaultQueryForFile = (virtualName, extension) => {
  if (extension.toLowerCase() === "parquet") {
    return `SELECT * FROM read_parquet('${virtualName}') LIMIT 100;`;
  }
  return `SELECT * FROM read_csv_auto('${virtualName}') LIMIT 100;`;
};

const runSql = async () => {
  const sql = sqlEditor.value.trim();
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
  sqlEditor.value = defaultQueryForFile(currentFile.virtualName, extension);
  renderTable([], []);

  try {
    const connection = await ensureConnection();
    const buffer = base64ToBytes(data);
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

sqlEditor.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    runSql();
  }
});

setStatus("Initializing...", "info");
vscode.postMessage({ type: "ready" });
