// HackClub AI API (OpenAI-compatible)
const HACKCLUB_BASE_URL = "https://ai.hackclub.com/proxy/v1";
const DEFAULT_MODEL = "openai/gpt-5.5";
const REQUEST_TIMEOUT_MS = 120_000;

async function safeParseResponse(response, baseUrl) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new GeminiError(`The AI API at "${baseUrl}" returned HTML/text instead of JSON. Please verify that your API Base URL is correct (e.g. check for missing "/v1"). Preview: ${text.slice(0, 150)}`);
  }
  try {
    return await response.json();
  } catch (err) {
    throw new GeminiError(`Failed to parse JSON response from the AI API. Error: ${err.message}`);
  }
}

function buildSystemPrompt(perWord, subject = "English", focusType = "Mixed", contentType = "both", userInstructions = "") {
  const instructions = {
    "English": {
      "Vocabulary": "Focus on word meanings, synonyms, antonyms, and usage of words in different contexts.",
      "Grammar": "Focus on grammatical rules, tenses, syntactic structures, and error correction.",
      "Mixed": "Generate a balanced mix of vocabulary and grammar questions."
    },
    "German": {
      "Vocabulary": "Focus on word meanings, articles (der/die/das), plural forms, and usage in context.",
      "Grammar": "Focus on grammatical rules, case declensions (Nominative/Accusative/Dative/Genitive), sentence structure, and tenses.",
      "Mixed": "Generate a balanced mix of vocabulary, article practice, and grammar questions."
    },
    "Chemistry": {
      "Concepts": "Focus on chemical concepts, molecular structures, periodic table trends, properties of elements, and reaction types.",
      "Equations & Formulas": "Focus on writing and balancing chemical equations, stoichiometry calculations, molar mass, chemical formulas, and reactions.",
      "Mixed": "Generate a balanced mix of conceptual chemistry and stoichiometry/balancing equation problems."
    },
    "French": {
      "Vocabulary": "Focus on word meanings, noun genders (masculine/feminine), and everyday usage.",
      "Grammar": "Focus on verb conjugations, grammatical agreements, tenses, and sentence structure.",
      "Mixed": "Generate a balanced mix of vocabulary, verb conjugation, and grammar questions."
    },
    "Physics": {
      "Concepts": "Focus on understanding theories and physical laws without going deep into mathematical calculations; explain physical phenomena.",
      "Laws & Problems": "Focus on practical application of physical laws, solving math problems, deriving units, and calculating unknown values from given data.",
      "Mixed": "Generate a balanced mix of conceptual understanding and computational physics problems."
    },
    "Biology": {
      "Definitions": "Focus on defining scientific terms, biological structures, organ/cell functions, and characteristics of living organisms.",
      "Processes": "Focus on explaining biological processes (such as photosynthesis, cellular respiration, cell division), life cycles, and interactions within ecosystems.",
      "Mixed": "Generate a balanced mix of scientific terms and biological process explanations."
    },
    "Math": {
      "Concepts": "Focus on mathematical theories, definitions, proofs, functions, properties, and geometric concepts.",
      "Equations & Problems": "Focus on algebraic equations, solving equations, word problems, calculus, and calculating numerical values.",
      "Mixed": "Generate a balanced mix of mathematical concepts and problem-solving exercises."
    },
    "Mechanics": {
      "Concepts": "Focus on concepts of forces, moments, equilibrium, velocity, acceleration, friction, and Newton's laws of motion.",
      "Laws & Problems": "Focus on solving computational problems, calculations of velocity/acceleration, truss analysis, resolving force vectors, and work/energy equations.",
      "Mixed": "Generate a balanced mix of mechanics concepts and numerical engineering problems."
    }
  };

  const subjKey = subject || "English";
  const focusKey = focusType || "Mixed";
  const subObj = instructions[subjKey] || instructions["English"];
  const specificInstruction = subObj[focusKey] || subObj["Mixed"] || "";

  const customIntro = `You are an educational expert specializing in the **${subjKey}** curriculum.
Task: Analyze the attached text and generate professional exam questions.
Required Focus: **${focusKey}**.

**Special Guidelines for this focus:**
- ${specificInstruction}
`;

  let contentTypeInstruction = "";
  if (contentType === "flashcards") {
    contentTypeInstruction = `\nCRITICAL OUTPUT CONTENT RULE: The user has selected "Flashcards only". You MUST NOT generate any quiz questions. The "quiz" array in your JSON output MUST be completely empty: "quiz": []. Focus purely on generating the flashcards and the summary.`;
  } else if (contentType === "questions") {
    contentTypeInstruction = `\nCRITICAL OUTPUT CONTENT RULE: The user has selected "Quizzes/Questions only". You MUST focus on generating the quiz questions. Do not generate extra AI-created flashcards (only mirror the provided target words in "flashcards" if necessary, but keep the focus on quiz questions).`;
  } else {
    contentTypeInstruction = `\nCRITICAL OUTPUT CONTENT RULE: Generate both high-quality flashcards and matching quiz questions.`;
  }

  let basePrompt = `${customIntro}

You are an AI Exam Generator. You will receive two inputs:
1. [LEARNED_EXAM]: A text extracted from a real past exam provided by the user. Analyze its style, formatting, difficulty, sentence complexity, and how distractors are chosen.
2. [TARGET_WORDS]: A list of new words the student needs to practice (some may have provided definitions or Arabic meanings).

Your Task:
1. Generate a completely new quiz and flashcards based ON the [TARGET_WORDS]. You MUST generate exactly ${perWord} quiz question(s) for EVERY SINGLE word provided in the [TARGET_WORDS] list. Do not skip any words. If the [TARGET_WORDS] list is empty, you MUST thoroughly extract ALL vocabulary terms, grammar rules, key concepts, definitions, and important information from the provided [STUDY_MATERIAL_TEXT] (or from the study material image/PDF if provided). Do NOT limit yourself to a small number — extract EVERY word, phrase, rule, and concept found in the material. Create flashcards for ALL of them (including Arabic translations for vocabulary), and then generate ${perWord} quiz question(s) for each extracted term/concept. For grammar rules, create flashcards that explain each rule and generate questions testing the student's understanding of those rules.
${contentTypeInstruction}
2. The questions MUST strictly mimic and clone the style, phrasing, and trickiness found in the [LEARNED_EXAM] (or the past exam style blueprint image if provided).
3. Identify:
   - The language being studied/tested (e.g. English, French, Spanish, German, etc.).
   - Any unit identifier/name mentioned in the exam/words text (e.g. "Unit 1", "Unit 2", "الوحـدة الأولى").
   - Any lesson identifier/name mentioned in the exam/words text (e.g. "Lesson A", "Lesson 3", "الدرس الأول").
4. CRITICAL RULE FOR SYNONYM/ANTONYM QUESTIONS: When writing a synonym or antonym question that references a word inside a sentence, you MUST visually mark the target word using HTML underline tags: <u>word</u>. For example: "Many organizations are working to bring resources to <u>underdeveloped</u> regions. The antonym of the underlined word is ............". The <u> tag is mandatory — never say 'the underlined word' without actually underlining it using <u></u>. Only use blanks or dots (e.g. ".........") for context completion questions where the student must choose the correct word to fill the blank.
5. CRITICAL RULE FOR TARGET_WORDS DEFINITIONS AND ARABIC MEANINGS: If a target word has an English definition or Arabic meaning provided in the [TARGET_WORDS] list, you MUST use that exact definition and Arabic meaning in the generated flashcards. Do not generate a different definition or meaning. Only generate definitions, translations, synonyms, antonyms, etc. for fields that are missing or empty.
6. CRITICAL RULE FOR QUESTION STEMS: The question stem (the prompt) MUST NEVER contain the correct answer or target word in parentheses or as text (except inside the underlined sentence in synonym/antonym questions). For example, do NOT write "Choose the correct option for (boast): ........." or append "(Target word: boast)". The student must infer the correct word solely from the sentence context or definition.
7. DIVERSITY OF QUESTIONS: Mimic the exact variety of question types found in [LEARNED_EXAM]. If the exam contains fill-in-the-blanks, synonym searches, grammatical usage, or reading comprehension style questions, generate a balanced distribution of these types. Do not use direct, simplistic definitions if the exam prefers complex context-based testing.

Focus Instruction:
The user selected the subject "${subject}" and focus "${focusType}". Adjust the type of questions accordingly.
- ${specificInstruction}

Output Format:
Return ONLY a valid JSON object matching this exact schema.
CRITICAL INSTRUCTION:
- يجب إرجاع الرد بصيغة JSON فقط، وبدون أي نصوص مقدمة أو خاتمة، وبدون استخدام علامات الماركداون الكودية (مثل \`\`\`json ... \`\`\`).
- You MUST return raw JSON only. Do NOT wrap the JSON in markdown code blocks or code fences. Do NOT include any introductory or concluding text, explanations, or commentary. The response must contain only the raw parseable JSON object itself.

{
  "detectedLanguage": "string or null — e.g. English, French, Spanish, German, etc.",
  "detectedUnit": "string or null — e.g. Unit 1, Unit 2",
  "detectedLesson": "string or null — e.g. Lesson A, Lesson 3",
  "summary": "string — a concise, high-quality Markdown summary of the uploaded study material and key concepts. Organize it with clear headings, bullet points, and bold key terms. This summary must always be generated.",
  "flashcards": [
    {
      "word": "string",
      "part_of_speech": "string",
      "definition": "string",
      "arabic": "string — translation or explanation in Arabic",
      "example": "string",
      "synonyms": ["string"],
      "antonyms": ["string"]
    }
  ],
  "quiz": [
    {
      "target_word": "string — the exact target vocabulary word from [TARGET_WORDS] that this question is testing",
      "question_type": "string — one of: context, synonym, antonym, definition, grammar, collocation, inference, usage",
      "question": "string",
      "options": ["CorrectAnswer", "Distractor1", "Distractor2", "Distractor3"],
      "correct_answer": "string — must exactly match one of the options",
      "explanation": "string"
    }
  ]
}`;

  if (userInstructions) {
    basePrompt += `\n\n### CRITICAL USER OVERRIDE INSTRUCTIONS\nThe following instructions were written by the student and are **MANDATORY**. They override ANY conflicting rules, defaults, question counts, styles, or behaviors specified above. You MUST prioritize these instructions above all else. If the student asks for a specific number of questions, specific topics, specific question types, or any other custom behavior — follow their instructions exactly, even if they contradict the default rules above.\n\n"""\n${userInstructions}\n"""\n\nRemember: The student's instructions above take absolute priority. Comply fully.`;
  }

  return basePrompt;
}

/**
 * Call HackClub AI API (OpenAI-compatible) to generate AI-powered flashcards
 * and quiz questions that mimic the style of an uploaded exam.
 *
 * @param {object} params
 * @param {string} params.examText — extracted text from a real exam PDF
 * @param {Array} params.targetWords — list of term objects {word, definition, ...}
 * @param {string} params.quizFocus — "vocabulary" | "grammar" | "mixed"
 * @param {string} params.subject — study subject e.g. English, Physics...
 * @param {string} params.focusType — focus area within the subject
 * @param {number} params.perWord - number of questions per word to generate
 * @param {string} params.apiKey — HackClub API key
 * @returns {Promise<{terms: Array, questions: Array}>}
 */
export async function generateWithGemini({ examText, targetWords, quizFocus = "mixed", subject = "English", focusType = "Mixed", perWord = 2, apiKey, apiBaseUrl, apiModel, media, blueprintMedia, contentType = "both", sourceText, userInstructions }) {
  const finalApiKey = apiKey || process.env.HACKCLUB_API_KEY || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new GeminiError("No API key provided. Please save a HackClub API key in the settings panel.");
  }

  const finalBaseUrl = apiBaseUrl || HACKCLUB_BASE_URL;
  const finalModel = apiModel || DEFAULT_MODEL;

  const wordList = targetWords
    .map(term => {
      const parts = [];
      if (term.definition) parts.push(`definition: ${term.definition}`);
      if (term.arabic) parts.push(`Arabic meaning: ${term.arabic}`);
      return `- ${term.word}${parts.length ? ` (${parts.join(", ")})` : ""}`;
    })
    .join("\n");

  let userPrompt = `[LEARNED_EXAM]:\n${examText}\n\n[TARGET_WORDS]:\n${wordList}\n\n[QUIZ_FOCUS]: ${quizFocus}`;
  if (sourceText) {
    userPrompt += `\n\n[STUDY_MATERIAL_TEXT]:\n${sourceText}`;
  }

  let userContent;
  const hasMedia = (media && media.data) || (blueprintMedia && blueprintMedia.data);

  if (hasMedia) {
    userContent = [
      {
        type: "text",
        text: userPrompt
      }
    ];

    const isHackClub = finalBaseUrl.includes("hackclub.com");

    if (media && media.data) {
      if (media.mimeType === "application/pdf") {
        if (!isHackClub) {
          throw new GeminiError("Direct PDF processing is only supported when using the default AI Engine (HackClub API). Please convert your PDF pages to images (PNG/JPG) to use custom API providers.");
        }
        userContent.push({
          type: "file",
          file: {
            filename: media.filename || "document.pdf",
            file_data: `data:${media.mimeType};base64,${media.data}`
          }
        });
      } else {
        userContent.push({
          type: "image_url",
          image_url: {
            url: `data:${media.mimeType || 'image/jpeg'};base64,${media.data}`
          }
        });
      }
    }

    if (blueprintMedia && blueprintMedia.data) {
      if (blueprintMedia.mimeType === "application/pdf") {
        if (!isHackClub) {
          throw new GeminiError("Direct PDF exam style blueprints are only supported when using the default AI Engine (HackClub API). Please convert your blueprint pages to images (PNG/JPG) to use custom API providers.");
        }
        userContent.push({
          type: "file",
          file: {
            filename: blueprintMedia.filename || "blueprint.pdf",
            file_data: `data:${blueprintMedia.mimeType};base64,${blueprintMedia.data}`
          }
        });
      } else {
        userContent.push({
          type: "image_url",
          image_url: {
            url: `data:${blueprintMedia.mimeType || 'image/jpeg'};base64,${blueprintMedia.data}`
          }
        });
      }
    }
  } else {
    userContent = userPrompt;
  }

  let baseUrl = finalBaseUrl.trim();
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: finalModel,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(perWord, subject, focusType, contentType, userInstructions)
      },
      {
        role: "user",
        content: userContent
      }
    ],
    temperature: 0.7,
    max_tokens: 16384,
    response_format: { type: "json_object" }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalApiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      throw new GeminiError("AI API request timed out after 2 minutes.");
    }
    throw new GeminiError(`Network error reaching AI API: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GeminiError(`AI API returned status ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const result = await safeParseResponse(response, baseUrl);
  const textContent = result?.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new GeminiError("AI API returned an empty or unreadable response.");
  }

  return parseGeminiResponse(textContent, targetWords);
}

/**
 * Parse and validate the AI JSON response, converting it to our internal format.
 */
function parseGeminiResponse(rawText, targetWords) {
  let parsed;
  let cleaned = rawText.trim();

  // Try direct parse first
  try {
    parsed = JSON.parse(cleaned);
  } catch (directError) {
    try {
      // 1. Remove markdown fences (even if there is extra text before/after them)
      const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
      const match = cleaned.match(markdownRegex);
      if (match && match[1]) {
        cleaned = match[1].trim();
      } else {
        // 2. Extract content between the first '{' and the last '}'
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
      }
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("JSON parsing failed. Length of raw text:", rawText.length);
      console.error("Last 200 characters of raw text:", rawText.slice(-200));
      throw new GeminiError(`AI returned invalid or incomplete JSON. Error: ${parseError.message}`);
    }
  }

  const flashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
  const quiz = Array.isArray(parsed.quiz) ? parsed.quiz : [];

  if (!flashcards.length && !quiz.length) {
    throw new GeminiError("AI returned empty flashcards and quiz. Falling back to local engine.");
  }

  // Create a map of AI flashcards by word (lowercase)
  const aiCardsMap = new Map();
  for (const card of flashcards) {
    if (card && card.word) {
      aiCardsMap.set(card.word.toLowerCase().trim(), card);
    }
  }

  const processedWords = new Set();
  const finalTerms = [];

  // 1. Process all original target words. This ensures 100% of uploaded words are kept.
  for (const orig of targetWords) {
    const wordLower = orig.word.toLowerCase().trim();
    processedWords.add(wordLower);

    const aiCard = aiCardsMap.get(wordLower);
    if (aiCard) {
      finalTerms.push({
        ...orig,
        partOfSpeech: aiCard.part_of_speech || orig.partOfSpeech || "unknown",
        definition: orig.definition || aiCard.definition || "",
        arabic: orig.arabic || aiCard.arabic || "",
        example: aiCard.example || orig.example || "",
        synonyms: Array.isArray(aiCard.synonyms) ? aiCard.synonyms : (orig.synonyms || []),
        antonyms: Array.isArray(aiCard.antonyms) ? aiCard.antonyms : (orig.antonyms || []),
        difficulty: orig.difficulty || "ai-generated"
      });
    } else {
      finalTerms.push(orig);
    }
  }

  // 2. Add any additional terms generated by AI that were not in targetWords.
  for (const card of flashcards) {
    if (!card || !card.word) continue;
    const wordLower = card.word.toLowerCase().trim();
    if (!processedWords.has(wordLower)) {
      processedWords.add(wordLower);
      finalTerms.push({
        id: `ai-${stableId(card.word)}`,
        word: card.word,
        partOfSpeech: card.part_of_speech || "unknown",
        definition: card.definition || "",
        example: card.example || "",
        synonyms: Array.isArray(card.synonyms) ? card.synonyms : [],
        antonyms: Array.isArray(card.antonyms) ? card.antonyms : [],
        difficulty: "ai-generated",
        frequency: 1,
        importance: 1,
        arabic: card.arabic || "",
        breakdown: [],
        review: { intervalDays: 1, ease: 2.4, dueAt: Date.now() }
      });
    }
  }

  const questions = quiz.map((q, index) => {
    const options = Array.isArray(q.options) ? q.options : [];
    const correctAnswer = q.correct_answer || options[0] || "";
    const answerIndex = options.findIndex(opt => opt === correctAnswer);

    return {
      id: `ai-q-${index}`,
      termId: matchTermId(q, finalTerms, targetWords),
      word: extractWord(q, finalTerms),
      type: q.question_type || "context",
      typeLabel: formatTypeLabel(q.question_type || "context"),
      prompt: q.question || "",
      choices: options,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: q.explanation || "",
      metadata: { targetLanguage: "en", vocabularyOnly: false, distractorStrategy: "ai", aiGenerated: true }
    };
  });

  return {
    terms: finalTerms,
    questions,
    summary: parsed.summary || parsed.Summary || null,
    detectedLanguage: parsed.detectedLanguage || parsed.detected_language || null,
    detectedUnit: parsed.detectedUnit || parsed.detected_unit || null,
    detectedLesson: parsed.detectedLesson || parsed.detected_lesson || null
  };
}

function matchTermId(question, aiTerms, originalTerms) {
  const targetWord = (question.target_word || "").trim().toLowerCase();
  if (targetWord) {
    const aiTerm = aiTerms.find(t => t.word.toLowerCase() === targetWord);
    if (aiTerm) return aiTerm.id;

    const origTerm = originalTerms.find(t => (t.word || "").toLowerCase() === targetWord);
    if (origTerm) return `ai-${stableId(origTerm.word)}`;
  }

  // Fallback to checking literal word presence in the question text
  const qText = (question.question || "").toLowerCase();
  for (const term of aiTerms) {
    if (qText.includes(term.word.toLowerCase())) return term.id;
  }
  for (const term of originalTerms) {
    if (qText.includes((term.word || "").toLowerCase())) return `ai-${stableId(term.word)}`;
  }
  return aiTerms[0]?.id || "ai-unknown";
}

function extractWord(question, terms) {
  const targetWord = (question.target_word || "").trim().toLowerCase();
  if (targetWord) {
    const term = terms.find(t => t.word.toLowerCase() === targetWord);
    if (term) return term.word;
  }

  // Fallback to checking literal word presence in the question text
  const qText = (question.question || "").toLowerCase();
  for (const term of terms) {
    if (qText.includes(term.word.toLowerCase())) return term.word;
  }
  return terms[0]?.word || "";
}

function formatTypeLabel(type) {
  return String(type || "context")
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function stableId(word) {
  let hash = 0;
  const str = String(word).toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `${str.replace(/[^a-z0-9]/g, "-").slice(0, 24)}-${Math.abs(hash).toString(36)}`;
}

export async function extractFileContentWithGemini({ media, apiKey, apiBaseUrl, apiModel, userInstructions }) {
  const finalApiKey = apiKey || process.env.HACKCLUB_API_KEY || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new GeminiError("No API key provided. Please save a HackClub API key in the settings panel.");
  }

  if (!media || !media.data) {
    throw new GeminiError("No media payload provided for content extraction.");
  }

  const finalBaseUrl = apiBaseUrl || HACKCLUB_BASE_URL;
  const finalModel = apiModel || DEFAULT_MODEL;

  let systemPrompt = `You are a highly precise document transcription and information extraction assistant.
Your task is to transcribe and extract ALL textual content, headings, lists, tables, mathematical equations, chemical formulas, and notes from the uploaded document.
Maintain the logical layout and structure of the document in your transcription. Do not omit, summarize, or skip any content.
Extract the complete information and classify or organize it cleanly.If a line contains multiple words separated by commas (e.g., 'word1, word2, word3'), you MUST treat each word as a SEPARATE term. Never group them into a single entry.


Return the extracted text in a valid JSON object matching this exact schema:
{
  "extractedText": "string - the complete, detailed transcription and text/table/formula extraction of the document content"
}

CRITICAL RULES:
1. Parse the document systematically from top to bottom.
2. Translate or write formulas/equations cleanly (e.g., using standard notation or text).
3. Do not omit any details. The output must be as comprehensive as possible.
4. Return ONLY the raw parseable JSON object itself. Do not wrap the JSON in markdown code blocks.`;

  if (userInstructions) {
    systemPrompt += `\n\nIMPORTANT — STUDENT INSTRUCTIONS:\nThe student has provided the following specific instructions for how to extract and process this document. You MUST follow these instructions carefully while still extracting all content:\n"${userInstructions}"`;
  }

  let userContent = [
    {
      type: "text",
      text: userInstructions
        ? `Please extract information from this document following the student's instructions: "${userInstructions}". Make sure to extract ALL content comprehensively.`
        : "Please extract ALL information and text from this document. Do not summarize or skip anything."
    }
  ];

  const isHackClub = finalBaseUrl.includes("hackclub.com");
  if (media.mimeType === "application/pdf") {
    if (!isHackClub) {
      throw new GeminiError("Direct PDF processing is only supported when using the default AI Engine (HackClub API). Please convert your PDF pages to images (PNG/JPG) to use custom API providers.");
    }
    userContent.push({
      type: "file",
      file: {
        filename: media.filename || "document.pdf",
        file_data: `data:${media.mimeType};base64,${media.data}`
      }
    });
  } else {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${media.mimeType || 'image/jpeg'};base64,${media.data}`
      }
    });
  }

  let baseUrl = finalBaseUrl.trim();
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: finalModel,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userContent
      }
    ],
    temperature: 0.3,
    max_tokens: 16384,
    response_format: { type: "json_object" }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalApiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      throw new GeminiError("AI content extraction timed out.");
    }
    throw new GeminiError(`Network error reaching AI API: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GeminiError(`AI API returned status ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const result = await safeParseResponse(response, baseUrl);
  const textContent = result?.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new GeminiError("AI API returned an empty response.");
  }

  let parsed;
  let cleaned = textContent.trim();
  try {
    parsed = JSON.parse(cleaned);
  } catch (directError) {
    try {
      const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
      const match = cleaned.match(markdownRegex);
      if (match && match[1]) {
        cleaned = match[1].trim();
      } else {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
      }
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      throw new GeminiError(`AI returned invalid JSON: ${parseError.message}`);
    }
  }

  return {
    extractedText: parsed.extractedText || parsed.text || ""
  };
}

export async function extractWordsFromImageWithGemini({ media, apiKey, apiBaseUrl, apiModel }) {
  const finalApiKey = apiKey || process.env.HACKCLUB_API_KEY || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new GeminiError("No API key provided. Please save a HackClub API key in the settings panel.");
  }

  if (!media || !media.data) {
    throw new GeminiError("No media payload provided for OCR extraction.");
  }

  const finalBaseUrl = apiBaseUrl || HACKCLUB_BASE_URL;
  const finalModel = apiModel || DEFAULT_MODEL;

  const systemPrompt = `You are a highly precise and exhaustive vocabulary extraction assistant.
The provided image contains highly dense text, often arranged in multiple columns (e.g., 3 columns) containing up to 100+ words.
Your absolute priority is to extract EVERY SINGLE vocabulary word found in the image without missing any.

You must also analyze the document to identify:
- The language of the vocabulary words (e.g. English, French, Spanish, German, Arabic, etc.).
- Any mention of a Unit (e.g. "Unit 1", "Unit 2", "الوحـدة الأولى").
- Any mention of a Lesson (e.g. "Lesson 3", "Lesson A", "الدرس الأول").

Return the extracted words in a valid JSON object matching this exact schema:
{
  "detectedLanguage": "string or null - Name of the language detected (e.g. English, Spanish, French)",
  "detectedUnit": "string or null - Unit identifier or name if found in the text",
  "detectedLesson": "string or null - Lesson identifier or name if found in the text",
  "terms": [
    {
      "word": "string",
      "definition": "string - English definition or explanation (optional, if found)",
      "arabic": "string - Arabic translation or explanation (optional, if found)"
    }
  ]
}

CRITICAL RULES:
1. Read the document systematically: column by column, from top to bottom, left to right.
2. DO NOT STOP, summarize, or truncate the list. If there are 100 words in the image, your JSON array MUST contain 100 objects.
3. Overcome "AI laziness": You must parse every single row in every single column.
4. Return ONLY the raw parseable JSON object itself. Do not include markdown code blocks (such as \`\`\`json ... \`\`\`), no introductory or concluding text.`;

  let userContent = [
    {
      type: "text",
      text: "Please meticulously extract ALL vocabulary words and their definitions from this document. Read every single column from top to bottom. Do not skip any words. I expect a very long list."
    }
  ];

  const isHackClub = finalBaseUrl.includes("hackclub.com");
  if (media.mimeType === "application/pdf") {
    if (!isHackClub) {
      throw new GeminiError("Direct PDF OCR processing is only supported when using the default AI Engine (HackClub API). Please convert your PDF pages to images (PNG/JPG) to use custom API providers.");
    }
    userContent.push({
      type: "file",
      file: {
        filename: media.filename || "document.pdf",
        file_data: `data:${media.mimeType};base64,${media.data}`
      }
    });
  } else {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${media.mimeType || 'image/jpeg'};base64,${media.data}`
      }
    });
  }

  let baseUrl = finalBaseUrl.trim();
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: finalModel,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userContent
      }
    ],
    temperature: 0.3,
    max_tokens: 4096,
    response_format: { type: "json_object" }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalApiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      throw new GeminiError("AI OCR request timed out.");
    }
    throw new GeminiError(`Network error reaching AI API: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GeminiError(`AI API returned status ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const result = await safeParseResponse(response, baseUrl);
  const textContent = result?.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new GeminiError("AI API returned an empty response.");
  }

  let parsed;
  let cleaned = textContent.trim();
  try {
    parsed = JSON.parse(cleaned);
  } catch (directError) {
    try {
      const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
      const match = cleaned.match(markdownRegex);
      if (match && match[1]) {
        cleaned = match[1].trim();
      } else {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
      }
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      throw new GeminiError(`AI returned invalid JSON: ${parseError.message}`);
    }
  }

  return {
    terms: Array.isArray(parsed.terms) ? parsed.terms : [],
    detectedLanguage: parsed.detectedLanguage || parsed.detected_language || null,
    detectedUnit: parsed.detectedUnit || parsed.detected_unit || null,
    detectedLesson: parsed.detectedLesson || parsed.detected_lesson || null
  };
}


export class GeminiError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeminiError";
  }
}

export async function simplifyTermWithGemini(term, apiKey, apiBaseUrl, apiModel) {
  const finalApiKey = apiKey || process.env.HACKCLUB_API_KEY || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new GeminiError("No API key provided. Please save a HackClub API key in the settings panel.");
  }

  const finalBaseUrl = apiBaseUrl || HACKCLUB_BASE_URL;
  const finalModel = apiModel || DEFAULT_MODEL;

  const systemPrompt = `You are a helpful language learning tutor assistant.
Your task is to simplify a vocabulary term that a student is struggling with.
You will receive a vocabulary term object with its current word, part of speech, definition, and example sentence.

Your job is to provide:
1. A much simpler, easier-to-understand English definition (using simple vocabulary, e.g. for CEFR A1/A2 level).
2. A very simple, short example sentence that clearly shows the word's meaning in a common daily context.
3. A Mnemonic link or association phrase (جملة ربط ذهني لتسهيل الحفظ) in Arabic to help the student memorize the word.

Return ONLY a valid JSON object matching this exact schema. Do not write any markdown code fences (like \`\`\`json) or introductory/concluding text.

Schema:
{
  "definition": "simpler definition string",
  "example": "simpler example sentence string",
  "mnemonic": "mnemonic association string in Arabic"
}
`;

  const userPrompt = `Term to simplify:
Word: "${term.word}"
Part of Speech: "${term.partOfSpeech || ''}"
Current Definition: "${term.definition}"
Current Example: "${term.example || ''}"
Arabic: "${term.arabic || ''}"`;

  let baseUrl = finalBaseUrl.trim();
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: finalModel,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    temperature: 0.7,
    max_tokens: 1024,
    response_format: { type: "json_object" }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalApiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      throw new GeminiError("AI API request timed out after 2 minutes.");
    }
    throw new GeminiError(`Network error reaching AI API: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GeminiError(`AI API returned status ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const result = await safeParseResponse(response, baseUrl);
  const textContent = result?.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new GeminiError("AI API returned an empty or unreadable response.");
  }

  let cleaned = textContent.trim();
  try {
    const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = cleaned.match(markdownRegex);
    if (match && match[1]) {
      cleaned = match[1].trim();
    } else {
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    }
    return JSON.parse(cleaned);
  } catch (parseError) {
    throw new GeminiError(`AI returned invalid JSON: ${parseError.message} - raw: ${textContent}`);
  }
}

/**
 * Chat with the Gemini assistant about the active lesson's vocabulary terms.
 * Supports session-scoped history.
 *
 * @param {object} params
 * @param {Array} params.terms - list of active lesson vocabulary terms
 * @param {string} params.question - user's message
 * @param {Array} params.history - conversation history
 * @param {string} params.apiKey
 * @param {string} params.apiBaseUrl
 * @param {string} params.apiModel
 * @returns {Promise<{content: string}>}
 */
export async function chatWithGemini({ terms, question, history = [], apiKey, apiBaseUrl, apiModel }) {
  const finalApiKey = apiKey || process.env.HACKCLUB_API_KEY || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new GeminiError("No API key provided. Please save a HackClub API key in the settings panel.");
  }

  const finalBaseUrl = apiBaseUrl || HACKCLUB_BASE_URL;
  const finalModel = apiModel || DEFAULT_MODEL;

  const formattedTerms = terms
    .map(t => `- ${t.word}: ${t.definition || ''} ${t.arabic ? `(${t.arabic})` : ''}`)
    .join("\n");

  const systemPrompt = `You are an expert English teacher who explains simply and uses only the words in the current lesson in their examples.
Your persona is: "مدرس لغة إنجليزية خبير يشرح بتبسيط ويستخدم الكلمات الموجودة في الدرس فقط في أمثلته".

Here are the vocabulary terms in the current lesson:
${formattedTerms}

Instructions:
1. Explain simply and clearly in Arabic (or English if the user asks in English).
2. In your explanations and examples, ONLY use vocabulary words from the provided target words list.
3. Keep answers relatively concise and highly relevant to the lesson words.
4. Support markdown formatting in your responses (like bold text or lists) to make the text clean and readable.
5. Answer in the language the user is chatting in.`;

  const messages = [
    { role: "system", content: systemPrompt }
  ];

  for (const msg of history) {
    if (msg.role && msg.content) {
      messages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
      });
    }
  }

  messages.push({
    role: "user",
    content: question
  });

  let baseUrl = finalBaseUrl.trim();
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: finalModel,
    messages,
    temperature: 0.7,
    max_tokens: 2048
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalApiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      throw new GeminiError("AI API request timed out after 2 minutes.");
    }
    throw new GeminiError(`Network error reaching AI API: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GeminiError(`AI API returned status ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const result = await safeParseResponse(response, baseUrl);
  const textContent = result?.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new GeminiError("AI API returned an empty or unreadable response.");
  }

  return { content: textContent };
}

export async function detectSubjectWithGemini(textSample, apiKey, apiBaseUrl, apiModel) {
  const finalApiKey = apiKey || process.env.HACKCLUB_API_KEY || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new GeminiError("No API key provided. Please save a HackClub API key in the settings panel.");
  }

  const finalBaseUrl = apiBaseUrl || HACKCLUB_BASE_URL;
  const finalModel = apiModel || DEFAULT_MODEL;

  const systemPrompt = `You are an educational assistant that classifies texts into subject areas.
Your task is to analyze the user's text and identify the most likely subject area it belongs to.
Classify the text into one of these exact categories: English, German, Chemistry, French, Physics, Biology, Math, Mechanics.
Answer with exactly one word (the name of the subject). Do not include any punctuation, markdown, explanation, or extra characters.`;

  const userPrompt = `Analyze the following text and identify the most likely subject area it belongs to. Answer with exactly one word from the choices (English, German, Chemistry, French, Physics, Biology, Math, Mechanics).
Text:
${textSample}`;

  let baseUrl = finalBaseUrl.trim();
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: finalModel,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    temperature: 0.1,
    max_tokens: 10
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalApiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      throw new GeminiError("AI API request timed out after 2 minutes.");
    }
    throw new GeminiError(`Network error reaching AI API: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GeminiError(`AI API returned status ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const result = await safeParseResponse(response, baseUrl);
  const textContent = result?.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new GeminiError("AI API returned an empty or unreadable response.");
  }

  return textContent.trim().replace(/[^a-zA-Z]/g, "");
}

export async function summarizeLessonWithGemini(terms, subject = "English", focusType = "Mixed", apiKey, apiBaseUrl, apiModel) {
  const finalApiKey = apiKey || process.env.HACKCLUB_API_KEY || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new GeminiError("No API key provided. Please save a HackClub API key in the settings panel.");
  }

  const finalBaseUrl = apiBaseUrl || HACKCLUB_BASE_URL;
  const finalModel = apiModel || DEFAULT_MODEL;

  const formattedTerms = terms
    .map(t => `- ${t.word}: ${t.definition || ''} ${t.arabic ? `(${t.arabic})` : ''}`)
    .join("\n");

  const systemPrompt = `You are an education assistant specializing in the **${subject}** curriculum.
Your task is to analyze the vocabulary terms and concepts below, and generate a concise, high-quality Markdown summary of the study material.
Organize the summary with clear headings, bullet points, and bold key terms. Keep it professional, educational, and easy to read.
The summary should be written in English.`;

  const userPrompt = `Please generate a Markdown summary for the following study material terms/concepts:
Subject: ${subject}
Focus: ${focusType}

Vocabulary Terms/Concepts:
${formattedTerms}`;

  let baseUrl = finalBaseUrl.trim();
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model: finalModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 2048
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalApiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      throw new GeminiError("AI API request timed out after 2 minutes.");
    }
    throw new GeminiError(`Network error reaching AI API: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GeminiError(`AI API returned status ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const result = await safeParseResponse(response, baseUrl);
  const textContent = result?.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new GeminiError("AI API returned an empty or unreadable response.");
  }

  return textContent.trim();
}


