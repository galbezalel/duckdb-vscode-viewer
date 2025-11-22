# DuckDB Notebook
 
 Open CSV or Parquet files with a DuckDB-backed Notebook interface. Run multiple SQL queries in separate cells, view results in interactive tables, and export data.
 
 ## Features
 
 ### 1. Notebook View
 - **Interactive Cells**: Create multiple SQL query cells to explore your data step-by-step.
 - **Auto-Initialization**: Automatically creates a view for your file and runs a sample query (`SELECT * ... LIMIT 100`) when you open a file.
 - **Smart Execution**: Run cells with `Cmd+Enter` or `Shift+Enter` (runs and adds a new cell).
 - **Auto-Focus**: Automatically focuses on the next cell for a seamless workflow.
 
 ### 2. Export Options
 - **Export Results**: Easily export the results of any query cell to **CSV** or **Parquet**.
 - **One-Click Download**: Use the export buttons in the cell header to save your transformed data locally.
 
 ## Development
 1. Install dependencies: `npm install`
 2. Build once: `npm run compile` (or `npm run watch` during development).
 3. Press `F5` in VS Code to launch an Extension Development Host.
 
 ## Notes
 - DuckDB runs in the webview via `@duckdb/duckdb-wasm`, bundled locally in `media/duckdb` (no CDN required at runtime).
 - For large datasets, limit your queries; only the first 100 rows are shown by default when opening a file.
