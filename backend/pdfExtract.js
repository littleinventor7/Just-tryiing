import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, "pdf_extract.py");
const pythonTimeoutMs = 120000;

export async function extractPdfFromBuffer(buffer, options = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "smart-flashcards-pdf-"));
  const pdfPath = path.join(tempDir, "upload.pdf");

  try {
    await writeFile(pdfPath, buffer);
    return await runPdfExtractor(pdfPath, options);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runPdfExtractor(pdfPath, options) {
  return new Promise((resolve, reject) => {
    const pythonPath = resolvePythonPath();
    const args = [
      scriptPath,
      pdfPath,
      "--max-pages",
      String(options.maxPages || 400),
      "--max-ocr-pages",
      String(options.maxOcrPages || 24)
    ];

    if (options.ocr !== false) args.push("--ocr");

    const child = spawn(pythonPath.command, pythonPath.args.concat(args), {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("PDF extraction timed out. Try a smaller file or paste the text directly."));
    }, pythonTimeoutMs);

    child.stdout.on("data", chunk => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", error => {
      clearTimeout(timer);
      reject(new Error(`Could not start the local PDF extractor: ${error.message}`));
    });

    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || "The PDF extractor could not read this file."));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("The PDF extractor returned an unreadable response."));
      }
    });
  });
}

function resolvePythonPath() {
  const platform = os.platform();
  const candidates = [
    globalThis.process?.env?.SMART_FLASHCARDS_PYTHON,
    path.join(
      os.homedir(),
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "python",
      platform === "win32" ? "python.exe" : "bin/python"
    )
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return { command: candidate, args: [] };
  }

  return { command: platform === "win32" ? "python" : "python3", args: [] };
}
