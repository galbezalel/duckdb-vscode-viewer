# DuckDB VS Code Viewer

Open CSV or Parquet files with a DuckDB-backed split view. The top pane lets you edit and run SQL; the bottom pane renders query results as a table.

## Features
- Left-click any `*.csv` or `*.parquet` file to open a DuckDB custom editor.
- Default query pre-populates with a `read_csv_auto` or `read_parquet` statement.
- Run SQL with the `Run` button or `Ctrl/Cmd + Enter`.
- Results table supports copy-to-clipboard via the button in the corner.

## Development
1. Install dependencies: `npm install`
2. Build once: `npm run compile` (or `npm run watch` during development).
3. Press `F5` in VS Code to launch an Extension Development Host.

## Notes
- DuckDB runs in the webview via `@duckdb/duckdb-wasm` loaded from a CDN. The extension does not ship the WASM binary; the user needs internet access on first run to fetch it.
- For large datasets, limit your queries; only the first 100 rows are shown by default when opening a file.
