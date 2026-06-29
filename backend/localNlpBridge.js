import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes the python offline NLP script with JSON payload via stdin.
 * @param {Object} payload - { action: "enrich"|"quiz", language: string, terms: Array, options: Object }
 * @returns {Promise<any>} - Resolved array or object returned by Python.
 */
export function runPythonNlp(payload) {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const scriptPath = path.join(__dirname, "..", "multilingual_embedded_nlp_tutor.py");
    
    const child = spawn(pythonCmd, [scriptPath, "--json"], {
      cwd: path.join(__dirname, "..")
    });
    
    let stdout = "";
    let stderr = "";
    
    child.stdout.on("data", data => {
      stdout += data.toString();
    });
    
    child.stderr.on("data", data => {
      stderr += data.toString();
    });
    
    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Python NLP bridge exited with code ${code}. Stderr: ${stderr}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) {
          reject(new Error(`Python NLP error: ${parsed.error}`));
          return;
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse Python output. Error: ${err.message}. Raw output: ${stdout}`));
      }
    });
    
    child.on("error", err => {
      reject(new Error(`Failed to execute Python compiler/environment: ${err.message}`));
    });
    
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
