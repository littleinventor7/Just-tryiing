const STOP_WORDS = new Set(
  "a an and are as at be but by for from in into is it of on or that the this to was were with".split(" ")
);

const WORD_HINTS = {
  ambiguous: "unclear or having more than one possible meaning",
  coherent: "logical, connected, and easy to understand",
  concise: "short and clear",
  crucial: "extremely important",
  diverse: "including different kinds",
  enhance: "to improve or make stronger",
  explanation: "a clear description of what something means",
  infer: "to understand by using clues",
  meaning: "the idea or message of a word or sentence",
  nuance: "a small difference in meaning or feeling",
  resilient: "able to recover after difficulty",
  sentence: "a group of words expressing a complete idea",
  subtle: "not obvious; hard to notice"
};

export function buildTermsFromRows(rows, options = {}) {
  const seen = new Set();
  const maxTerms = Math.max(1, Number(options.maxTerms || 120));

  return rows
    .map(normalizeRow)
    .filter(row => row.target && (row.english || row.arabic))
    .filter(row => {
      const key = row.target.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxTerms)
    .map((row, index) => buildTerm(row, index));
}

export function normalizeRow(row) {
  const target = cleanCell(row.target || row.word || row.left || "");
  let english = cleanCell(row.english || row.explanation || row.right || "");
  let arabic = cleanCell(row.arabic || "");

  if (!arabic && hasArabic(english)) {
    const split = splitArabic(english);
    english = split.english;
    arabic = split.arabic;
  }

  return { target, english, arabic, article: row.article || "" };
}

export function parseDelimitedRows(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => splitRowLine(line))
    .filter(cells => cells.length >= 2)
    .map(cells =>
      normalizeRow({
        target: cells[0],
        english: cells[1],
        arabic: cells.slice(2).join(" ")
      })
    )
    .filter(row => row.target && (row.english || row.arabic));
}

function buildTerm(row, index) {
  const targetWords = tokenize(row.target);
  const isPhrase = targetWords.length > 1;
  const definition = row.english || row.arabic || "Review this expression from the imported table.";

  return {
    id: stableId(`${row.target}-${index}`),
    word: row.target,
    definition,
    arabic: row.arabic,
    article: row.article || "",
    partOfSpeech: isPhrase ? "phrase / sentence" : inferPartOfSpeech(row.target),
    example: isPhrase ? row.target : buildExample(row.target, row.english),
    synonyms: [],
    antonyms: [],
    frequency: 1,
    difficulty: classifyDifficulty(row.target, definition),
    importance: 25 - index * 0.01,
    context: `${row.target} - ${definition}`,
    breakdown: buildBreakdown(row.target, row.english),
    review: {
      intervalDays: 1,
      ease: 2.4,
      dueAt: Date.now()
    },
    sourceType: "table"
  };
}

function buildBreakdown(target, explanation) {
  return tokenize(target).map(token => {
    const lower = token.toLowerCase();
    return {
      word: token,
      meaning: WORD_HINTS[lower] || inferTokenMeaning(lower, explanation)
    };
  });
}

function inferTokenMeaning(word, explanation) {
  if (STOP_WORDS.has(word)) return "grammar word that connects the sentence";
  if (word.endsWith("ing")) return "action or ongoing activity in the sentence";
  if (word.endsWith("ed")) return "past action or completed state";
  if (word.endsWith("ly")) return "describes how an action happens";
  if (word.endsWith("tion") || word.endsWith("ment")) return "idea, process, or result";

  const cleanExplanation = String(explanation || "").toLowerCase();
  if (cleanExplanation.includes(word)) return "key word repeated in the explanation";
  return "content word to review with the full row explanation";
}

function splitRowLine(line) {
  if (line.includes("\t")) return line.split("\t").map(cleanCell);
  if (line.includes("|")) return line.split("|").map(cleanCell);
  if (line.includes(" - ")) return line.split(/\s+-\s+/).map(cleanCell);
  if (line.includes(":")) return line.split(/\s*:\s+/).map(cleanCell);
  return [line];
}

function splitArabic(value) {
  if (!value) return { english: "", arabic: "" };
  const arabicBlocks = String(value).match(/[\u0600-\u06ff]+(?:\s+[\u0600-\u06ff]+)*/g) || [];
  const arabic = arabicBlocks.join(" ").trim();
  let english = String(value);
  for (const block of arabicBlocks) {
    english = english.replace(block, "");
  }
  english = english.replace(/\s+/g, " ").trim();
  return { english, arabic };
}

function hasArabic(value) {
  return /[\u0600-\u06ff]/.test(String(value || ""));
}

function tokenize(value) {
  return String(value || "").match(/[A-Za-z][A-Za-z'-]*/g) || [];
}

function inferPartOfSpeech(target) {
  const word = target.toLowerCase();
  if (word.endsWith("ly")) return "adverb";
  if (word.endsWith("ing") || word.endsWith("ed") || word.endsWith("ize")) return "verb";
  if (word.endsWith("ous") || word.endsWith("ive") || word.endsWith("able") || word.endsWith("ful")) {
    return "adjective";
  }
  return "vocabulary word";
}

function classifyDifficulty(target, definition) {
  const words = tokenize(target);
  const wordCount = words.length;
  const mainWord = words[0] || target;
  const totalLen = target.length;
  const defLen = String(definition || "").length;

  // Multi-word phrases: more words = harder
  if (wordCount >= 5 || totalLen + defLen > 200) return "advanced";
  if (wordCount >= 3 || totalLen > 18) return "intermediate";
  if (wordCount >= 2) {
    // 2-word phrase: check length of words
    return totalLen > 14 ? "intermediate" : "basic";
  }

  // Single word: classify by length (rough proxy for rarity/difficulty)
  if (mainWord.length <= 4) return "basic";
  if (mainWord.length <= 7) return "intermediate";
  return "advanced";
}

function buildExample(word, explanation) {
  if (explanation) return `${word}: ${explanation}`;
  return `The word ${word} appears in the imported vocabulary table.`;
}

function stableId(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `row-term-${Math.abs(hash).toString(36)}`;
}

function cleanCell(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
