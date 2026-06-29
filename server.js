import http from "node:http";
import { readFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeText } from "./backend/nlp.js";
import { generateQuiz } from "./backend/quiz.js";
import { extractPdfFromBuffer } from "./backend/pdfExtract.js";
import { generateWithGemini, extractWordsFromImageWithGemini, extractFileContentWithGemini, simplifyTermWithGemini, chatWithGemini, detectSubjectWithGemini, summarizeLessonWithGemini, GeminiError } from "./backend/gemini.js";
import { registerUser, loginUser, saveUserState } from "./backend/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 5173);
const maxBodyBytes = 80 * 1024 * 1024;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"]
]);

const server = http.createServer(async (req, res) => {
  try {
    console.log(`[Request] ${req.method} ${req.url}`);
    if (req.url.startsWith("/api/")) {
      console.log(`[Headers] x-api-key: ${req.headers["x-api-key"] ? "present" : "absent"}, x-api-base-url: "${req.headers["x-api-base-url"] || ""}", x-api-model: "${req.headers["x-api-model"] || ""}"`);
    }

    if (req.method === "GET" && req.url === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        app: "Smart Flashcards & Quiz Generator",
        localNlp: true
      });
    }

    if (req.method === "POST" && req.url === "/api/process") {
      const body = await readJson(req);
      const text = typeof body.text === "string" ? body.text : "";
      const difficulty = typeof body.difficulty === "string" ? body.difficulty : "all";
      const perWord = clamp(Number(body.perWord || 2), 1, 50);
      const quizFocus = typeof body.quizFocus === "string" ? body.quizFocus : "mixed";
      const subject = typeof body.subject === "string" ? body.subject : "English";
      const focusType = typeof body.focusType === "string" ? body.focusType : (typeof body.focus_type === "string" ? body.focus_type : "Mixed");
      const examText = typeof body.examText === "string" ? body.examText : "";
      const media = body.media;
      const contentType = typeof body.contentType === "string" ? body.contentType : "both";
      const userInstructions = typeof body.userInstructions === "string" ? body.userInstructions : "";
      const engineMode = req.headers["x-engine-mode"] || "ai";
      const userApiKey = engineMode === "local" ? "" : (req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^bearer\s+/i, "") || "");
      const apiBaseUrl = req.headers["x-api-base-url"] || "";
      const apiModel = req.headers["x-api-model"] || "";

      if (text.trim().length < 3 && (!media || !media.data)) {
        return sendJson(res, 422, {
          error: "Add a file or paste text before generating a study set."
        });
      }

      let result = { terms: [], stats: {} };
      if (engineMode !== "ai" && text.trim().length >= 3) {
        result = analyzeText(text, {
          difficulty,
          maxTerms: clamp(Number(body.maxTerms || 120), 12, 1000)
        });
      }

      const quiz = await generateQuiz(result.terms, { 
        perWord, 
        sourceText: text, 
        quizFocus, 
        subject,
        focusType,
        examText, 
        media,
        blueprintMedia: body.blueprintMedia,
        apiKey: userApiKey,
        apiBaseUrl,
        apiModel,
        contentType,
        userInstructions
      });

      return sendJson(res, 200, {
        terms: quiz.terms || result.terms,
        questions: quiz.questions,
        quizStats: quiz.stats,
        summary: quiz.summary || null,
        detectedLanguage: quiz.detectedLanguage || null,
        detectedUnit: quiz.detectedUnit || null,
        detectedLesson: quiz.detectedLesson || null
      });
    }

    if (req.method === "POST" && req.url === "/api/extract-file") {
      const body = await readJson(req);
      const fileName = typeof body.fileName === "string" ? body.fileName : "upload";
      const extension = path.extname(fileName).toLowerCase();
      const base64 = typeof body.data === "string" ? body.data : "";

      if (!base64) {
        return sendJson(res, 422, { error: "No file data was received." });
      }

      const buffer = Buffer.from(base64, "base64");
      if (extension !== ".pdf" && body.mimeType !== "application/pdf") {
        return sendJson(res, 415, { error: "Only PDF extraction is handled by this endpoint." });
      }

      const result = await extractPdfFromBuffer(buffer, {
        ocr: body.ocr !== false
      });

      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && req.url === "/api/extract-image") {
      const body = await readJson(req);
      const media = body.media;
      const engineMode = req.headers["x-engine-mode"] || "ai";
      const userApiKey = engineMode === "local" ? "" : (req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^bearer\s+/i, "") || "");
      const apiBaseUrl = req.headers["x-api-base-url"] || "";
      const apiModel = req.headers["x-api-model"] || "";

      if (!media || !media.data) {
        return sendJson(res, 422, { error: "No media payload was received." });
      }

      try {
        const ocrResult = await extractWordsFromImageWithGemini({
          media,
          apiKey: userApiKey,
          apiBaseUrl,
          apiModel
        });
        return sendJson(res, 200, ocrResult);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && req.url === "/api/extract-file-content") {
      const body = await readJson(req);
      const media = body.media;
      const userInstructions = typeof body.userInstructions === "string" ? body.userInstructions : "";
      const engineMode = req.headers["x-engine-mode"] || "ai";
      const userApiKey = engineMode === "local" ? "" : (req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^bearer\s+/i, "") || "");
      const apiBaseUrl = req.headers["x-api-base-url"] || "";
      const apiModel = req.headers["x-api-model"] || "";

      if (!media || !media.data) {
        return sendJson(res, 422, { error: "No media payload was received." });
      }

      try {
        const textResult = await extractFileContentWithGemini({
          media,
          apiKey: userApiKey,
          apiBaseUrl,
          apiModel,
          userInstructions
        });
        return sendJson(res, 200, textResult);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && req.url === "/api/quiz") {
      const body = await readJson(req);
      const terms = Array.isArray(body.terms) ? body.terms : [];
      const perWord = clamp(Number(body.perWord || 2), 1, 50);
      const quizFocus = typeof body.quizFocus === "string" ? body.quizFocus : "mixed";
      const examText = typeof body.examText === "string" ? body.examText : "";
      const engineMode = req.headers["x-engine-mode"] || "ai";
      const userApiKey = engineMode === "local" ? "" : (req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^bearer\s+/i, "") || "");
      const apiBaseUrl = req.headers["x-api-base-url"] || "";
      const apiModel = req.headers["x-api-model"] || "";
      const quiz = await generateQuiz(terms, { perWord, quizFocus, examText, apiKey: userApiKey, apiBaseUrl, apiModel });
      return sendJson(res, 200, quiz);
    }

    if (req.method === "POST" && req.url === "/api/detect-subject") {
      const body = await readJson(req);
      const text = typeof body.text === "string" ? body.text : "";
      const engineMode = req.headers["x-engine-mode"] || "ai";
      const userApiKey = engineMode === "local" ? "" : (req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^bearer\s+/i, "") || "");
      const apiBaseUrl = req.headers["x-api-base-url"] || "";
      const apiModel = req.headers["x-api-model"] || "";

      if (!text.trim()) {
        return sendJson(res, 422, { error: "No text sample provided for subject detection." });
      }

      // Take first 500 words
      const words = text.trim().split(/\s+/).slice(0, 500).join(" ");

      try {
        const detected = await detectSubjectWithGemini(words, userApiKey, apiBaseUrl, apiModel);
        let normalized = "English";
        const clean = (detected || "").trim().toLowerCase();
        if (clean.includes("physics")) normalized = "Physics";
        else if (clean.includes("biology") || clean.includes("biolog")) normalized = "Biology";
        else if (clean.includes("german")) normalized = "German";
        else if (clean.includes("chemistry") || clean.includes("chemstry")) normalized = "Chemistry";
        else if (clean.includes("french") || clean.includes("frensh")) normalized = "French";
        else if (clean.includes("math")) normalized = "Math";
        else if (clean.includes("mechanics")) normalized = "Mechanics";
        else if (clean.includes("english")) normalized = "English";

        return sendJson(res, 200, { subject: normalized });
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && req.url === "/api/generate-ai") {
      const body = await readJson(req);
      const terms = Array.isArray(body.terms) ? body.terms : [];
      const quizFocus = typeof body.quizFocus === "string" ? body.quizFocus : "mixed";
      const subject = typeof body.subject === "string" ? body.subject : "English";
      const focusType = typeof body.focusType === "string" ? body.focusType : (typeof body.focus_type === "string" ? body.focus_type : "Mixed");
      const perWord = clamp(Number(body.perWord || 2), 1, 50);
      const rawExamText = typeof body.examText === "string" ? body.examText : "";
      const examText = rawExamText.trim() || "Standard exam format";
      const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
      const contentType = typeof body.contentType === "string" ? body.contentType : "both";
      const userInstructions = typeof body.userInstructions === "string" ? body.userInstructions : "";
      const engineMode = req.headers["x-engine-mode"] || "ai";
      const userApiKey = engineMode === "local" ? "" : (req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^bearer\s+/i, "") || "");
      const apiBaseUrl = req.headers["x-api-base-url"] || "";
      const apiModel = req.headers["x-api-model"] || "";
      const media = body.media;
      const blueprintMedia = body.blueprintMedia;

      if (!terms.length && (!media || !media.data) && !sourceText.trim() && !rawExamText.trim() && (!blueprintMedia || !blueprintMedia.data)) {
        return sendJson(res, 422, { error: "No target words, media, or text blueprint provided for AI generation." });
      }

      try {
        const quiz = await generateQuiz(terms, { 
          perWord, 
          quizFocus, 
          subject,
          focusType,
          apiKey: userApiKey, 
          apiBaseUrl,
          apiModel,
          sourceText,
          examText,
          media,
          blueprintMedia,
          contentType,
          userInstructions
        });
        return sendJson(res, 200, {
          terms: quiz.terms,
          questions: quiz.questions,
          summary: quiz.summary || null,
          aiGenerated: true,
          detectedLanguage: quiz.detectedLanguage || null,
          detectedUnit: quiz.detectedUnit || null,
          detectedLesson: quiz.detectedLesson || null
        });
      } catch (error) {
        const fallbackQuiz = await generateQuiz(terms, { perWord, quizFocus, subject, focusType, contentType });
        return sendJson(res, 200, {
          terms,
          ...fallbackQuiz,
          aiGenerated: false,
          aiFallbackReason: error.message
        });
      }
    }

    if (req.method === "POST" && req.url === "/api/simplify") {
      const body = await readJson(req);
      const term = body.term;
      const engineMode = req.headers["x-engine-mode"] || "ai";
      const userApiKey = engineMode === "local" ? "" : (req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^bearer\s+/i, "") || "");
      const apiBaseUrl = req.headers["x-api-base-url"] || "";
      const apiModel = req.headers["x-api-model"] || "";
      if (!term || !term.word) {
        return sendJson(res, 422, { error: "No term details were provided." });
      }
      try {
        const simplified = await simplifyTermWithGemini(term, userApiKey, apiBaseUrl, apiModel);
        return sendJson(res, 200, simplified);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && req.url === "/api/summarize-lesson") {
      const body = await readJson(req);
      const terms = Array.isArray(body.terms) ? body.terms : [];
      const subject = typeof body.subject === "string" ? body.subject : "English";
      const focusType = typeof body.focusType === "string" ? body.focusType : "Mixed";
      const engineMode = req.headers["x-engine-mode"] || "ai";
      const userApiKey = engineMode === "local" ? "" : (req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^bearer\s+/i, "") || "");
      const apiBaseUrl = req.headers["x-api-base-url"] || "";
      const apiModel = req.headers["x-api-model"] || "";

      if (!terms.length) {
        return sendJson(res, 422, { error: "No vocabulary terms provided to summarize." });
      }

      try {
        const summary = await summarizeLessonWithGemini(terms, subject, focusType, userApiKey, apiBaseUrl, apiModel);
        return sendJson(res, 200, { summary });
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && req.url === "/api/chat") {
      const body = await readJson(req);
      const terms = Array.isArray(body.terms) ? body.terms : [];
      const question = typeof body.question === "string" ? body.question : "";
      const history = Array.isArray(body.history) ? body.history : [];
      const engineMode = req.headers["x-engine-mode"] || "ai";
      const userApiKey = engineMode === "local" ? "" : (req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^bearer\s+/i, "") || "");
      const apiBaseUrl = req.headers["x-api-base-url"] || "";
      const apiModel = req.headers["x-api-model"] || "";

      if (!question.trim()) {
        return sendJson(res, 422, { error: "Please enter a message." });
      }

      try {
        const chatResponse = await chatWithGemini({
          terms,
          question,
          history,
          apiKey: userApiKey,
          apiBaseUrl,
          apiModel
        });
        return sendJson(res, 200, chatResponse);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    if (req.method === "POST" && req.url === "/api/log-error") {
      try {
        const body = await readJson(req);
        const logLine = `[${new Date().toISOString()}] ${JSON.stringify(body)}\n`;
        await appendFile(path.join(__dirname, "frontend-errors.log"), logLine, "utf8");
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    if (req.method === "POST" && req.url === "/api/register") {
      const body = await readJson(req);
      const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
      return sendJson(res, 200, { success: true, username });
    }

    if (req.method === "POST" && req.url === "/api/login") {
      const body = await readJson(req);
      const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
      return sendJson(res, 200, { success: true, username, state: {} });
    }

    if (req.method === "POST" && req.url === "/api/save-state") {
      return sendJson(res, 200, { success: true });
    }

    if (req.method === "GET") {
      return serveStatic(req, res);
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, {
      error: status === 500 ? "Something went wrong while processing the request." : error.message
    });
  }
});

if (!process.env.VERCEL) {
  server.listen(port, () => {
    console.log(`Smart Flashcards & Quiz Generator running at http://localhost:${port}`);
  });
}

export default server;

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const resolvedPath = path.normalize(path.join(publicDir, requestedPath));

  if (!resolvedPath.startsWith(publicDir)) {
    return sendText(res, 403, "Forbidden");
  }

  const filePath = existsSync(resolvedPath) ? resolvedPath : path.join(publicDir, "index.html");
  const ext = path.extname(filePath).toLowerCase();
  const body = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes.get(ext) || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;

    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > maxBodyBytes) {
        const error = new Error("The uploaded text is too large for this local demo server.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        const error = new Error("Request body must be valid JSON.");
        error.statusCode = 400;
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end(payload);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}
