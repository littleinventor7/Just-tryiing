import { appState } from "./state-manager.js";

function getHeaders() {
  const headers = {
    "Content-Type": "application/json"
  };
  const settings = appState?.state?.settings || {};
  const isAi = (settings.engineMode || "ai") === "ai";

  if (isAi) {
    let key = localStorage.getItem("hackclub-api-key") || 
              localStorage.getItem("hackclub_api_key") || 
              localStorage.getItem("gemini-api-key") || 
              localStorage.getItem("gemini_api_key");
    if (key) {
      // Strip hidden RTL marks and any non-ASCII characters to prevent fetch crashes
      key = String(key).replace(/[^\x20-\x7E]/g, "").trim();
      if (key) {
        headers["x-api-key"] = key;
      }
    }
  }

  if (settings.apiBaseUrl) {
    headers["x-api-base-url"] = settings.apiBaseUrl;
  }
  if (settings.apiModel) {
    headers["x-api-model"] = settings.apiModel;
  }
  headers["x-engine-mode"] = settings.engineMode || "ai";

  return headers;
}

export async function processVocabulary({ text, difficulty, maxTerms, perWord, quizFocus, subject, focusType, examText, media, blueprintMedia, userInstructions }) {
  const response = await fetch("/api/process", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ text, difficulty, maxTerms, perWord, quizFocus, subject, focusType, examText, media, blueprintMedia, userInstructions })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to process this study material.");
  }
  return payload;
}

export async function regenerateQuiz(terms, perWord = 2, quizFocus = "mixed", examText = "") {
  const response = await fetch("/api/quiz", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ terms, perWord, quizFocus, examText })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to build quiz questions.");
  }
  return payload;
}

export async function extractPdfFile({ fileName, mimeType, data, ocr = true }) {
  const response = await fetch("/api/extract-file", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ fileName, mimeType, data, ocr })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to extract text from this PDF.");
  }
  return payload;
}

export async function generateWithGemini({ examText, terms, quizFocus = "mixed", subject, focusType, perWord = 2, media, blueprintMedia, sourceText, userInstructions }) {
  const response = await fetch("/api/generate-ai", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ examText, terms, quizFocus, subject, focusType, perWord, media, blueprintMedia, sourceText, userInstructions })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to generate quiz via AI.");
  }
  return payload;
}

export async function detectSubject(text) {
  const response = await fetch("/api/detect-subject", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ text })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to detect subject.");
  }
  return payload;
}

export async function extractWordsFromImageWithGemini(media) {
  const response = await fetch("/api/extract-image", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ media })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to extract words from image.");
  }
  return payload;
}

export async function simplifyTerm(term) {
  const response = await fetch("/api/simplify", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ term })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to simplify this term.");
  }
  return payload;
}

export async function askLessonAssistant({ terms, question, history }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ terms, question, history })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to get a response from the AI Lesson Assistant.");
  }
  return payload;
}

export async function extractFileContentAi(media, userInstructions = "") {
  const response = await fetch("/api/extract-file-content", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ media, userInstructions })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to extract content from file via AI.");
  }
  return payload;
}
