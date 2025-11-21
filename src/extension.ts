import * as path from "path";
import * as vscode from "vscode";

class DataDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) { }
  dispose(): void {
    // Nothing to clean up for now.
  }

  static async create(uri: vscode.Uri): Promise<DataDocument> {
    return new DataDocument(uri);
  }
}

class DuckDBViewerProvider
  implements vscode.CustomReadonlyEditorProvider<DataDocument> {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DuckDBViewerProvider(context);
    const retainContextWhenHidden = true;

    const csv = vscode.window.registerCustomEditorProvider(
      "duckdb.csvViewer",
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden,
        },
        supportsMultipleEditorsPerDocument: false,
      },
    );

    const parquet = vscode.window.registerCustomEditorProvider(
      "duckdb.parquetViewer",
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden,
        },
        supportsMultipleEditorsPerDocument: false,
      },
    );

    return vscode.Disposable.from(csv, parquet);
  }

  private readonly extensionUri: vscode.Uri;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.extensionUri = context.extensionUri;
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): Promise<DataDocument> {
    return DataDocument.create(uri);
  }

  async resolveCustomEditor(
    document: DataDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "out"),
        vscode.Uri.joinPath(this.extensionUri, "media"),
      ],
    };

    webview.html = this.getHtml(webview);

    const pushDataToWebview = async () => {
      try {
        const raw = await vscode.workspace.fs.readFile(document.uri);
        const fileExtension = path.extname(document.uri.fsPath).replace(".", "");
        // Create a standalone buffer for transfer; Buffer may have a larger underlying ArrayBuffer.
        const buffer = raw.buffer.slice(
          raw.byteOffset,
          raw.byteOffset + raw.byteLength,
        );
        webview.postMessage({
          type: "loadData",
          name: path.basename(document.uri.fsPath),
          extension: fileExtension || "csv",
          // Send raw bytes (ArrayBuffer) to avoid large base64 strings causing errors in the webview.
          data: buffer,
          byteLength: raw.byteLength,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to read file content.";
        vscode.window.showErrorMessage(message);
      }
    };

    webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "ready":
          await pushDataToWebview();
          break;
        case "requestRefresh":
          await pushDataToWebview();
          break;
        case "copyToClipboard":
          if (typeof message.value === "string") {
            await vscode.env.clipboard.writeText(message.value);
            vscode.window.showInformationMessage("Copied results to clipboard.");
          }
          break;
        default:
          break;
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "webview.js"),
    );
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "styles.css"),
    );
    const duckdbWorkerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "duckdb-browser-eh.worker.js"),
    );
    const duckdbWasmUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "duckdb-eh.wasm"),
    );
    const nonce = this.getNonce();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `script-src ${webview.cspSource} 'nonce-${nonce}' 'wasm-unsafe-eval'`,
      `connect-src ${webview.cspSource}`,
      `worker-src ${webview.cspSource} blob:`,
      "frame-src 'none'",
    ].join("; ");

    return /* html */ `\u003c!DOCTYPE html\u003e
\u003chtml lang="en"\u003e
  \u003chead\u003e
    \u003cmeta charset="UTF-8" /\u003e
    \u003cmeta http-equiv="Content-Security-Policy" content="${csp}" /\u003e
    \u003cmeta name="viewport" content="width=device-width, initial-scale=1.0" /\u003e
    \u003clink href="${stylesUri}" rel="stylesheet" nonce="${nonce}" /\u003e
    \u003ctitle\u003eDuckDB Viewer\u003c/title\u003e
  \u003c/head\u003e
  \u003cbody\u003e
    \u003cdiv class="toolbar"\u003e
      \u003cdiv\u003e
        \u003cstrong id="fileName"\u003eDuckDB\u003c/strong\u003e
        \u003cspan id="status" class="status"\u003eReady\u003c/span\u003e
      \u003c/div\u003e
      \u003cdiv class="actions"\u003e
        \u003cbutton id="refresh"\u003eReload File\u003c/button\u003e
        \u003cbutton id="run" class="primary"\u003eRun (Ctrl/Cmd+Enter)\u003c/button\u003e
      \u003c/div\u003e
    \u003c/div\u003e
    \u003cdiv class="pane-container"\u003e
      \u003csection class="pane editor"\u003e
        \u003ctextarea id="sql" spellcheck="false"\u003e\u003c/textarea\u003e
      \u003c/section\u003e
      \u003csection class="pane results"\u003e
        \u003cdiv class="results-header"\u003e
          \u003cdiv class="title"\u003eResults\u003c/div\u003e
          \u003cbutton id="copy"\u003eCopy CSV\u003c/button\u003e
        \u003c/div\u003e
        \u003cdiv id="table" class="table"\u003e\u003c/div\u003e
      \u003c/section\u003e
    \u003c/div\u003e
    \u003cscript nonce="${nonce}"\u003e
      window.__duckdbPaths = {
        worker: "${duckdbWorkerUri}",
        wasm: "${duckdbWasmUri}"
      };
    \u003c/script\u003e
    \u003cscript type="module" nonce="${nonce}" src="${scriptUri}"\u003e\u003c/script\u003e
  \u003c/body\u003e
\u003c/html\u003e`;
  }

  private getNonce(): string {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";
    for (let i = 0; i < 32; i++) {
      nonce += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return nonce;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(DuckDBViewerProvider.register(context));
}

export function deactivate(): void {
  // Nothing to do here.
}
