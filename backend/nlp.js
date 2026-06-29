import {
  ACADEMIC_SIGNALS,
  BASIC_WORDS,
  LEXICON,
  POS_SUFFIXES,
  ROOT_HINTS,
  STOP_WORDS
} from "./lexicon.js";

const DEFAULT_MAX_TERMS = 120;
const MIN_WORD_LENGTH = 3;
const TOKEN_PATTERN = /[A-Za-z][A-Za-z'-]{2,}/g;

export function analyzeText(rawText, options = {}) {
  const text = normalizeText(rawText);
  const sentences = splitSentences(text);
  const lineBoosts = extractLineCandidates(text);
  const counts = countTokens(text);
  const candidates = [];
  const maxTerms = clamp(Number(options.maxTerms || DEFAULT_MAX_TERMS), 12, 1000);
  const difficultyFilter = normalizeDifficulty(options.difficulty);

  for (const [word, frequency] of counts.entries()) {
    if (!isCandidate(word)) continue;

    const lineBoost = lineBoosts.get(word) || 0;
    const context = findBestSentence(sentences, word);
    const score = scoreWord(word, frequency, lineBoost, context);
    const term = buildTerm(word, frequency, score, context);

    if (difficultyFilter !== "all" && term.difficulty !== difficultyFilter) continue;
    candidates.push(term);
  }

  const terms = candidates
    .sort((a, b) => b.importance - a.importance || a.word.localeCompare(b.word))
    .slice(0, maxTerms)
    .map((term, index) => ({
      ...term,
      rank: index + 1
    }));

  return {
    terms,
    stats: {
      totalWords: text.match(TOKEN_PATTERN)?.length || 0,
      uniqueCandidates: counts.size,
      extracted: terms.length,
      difficulty: summarizeDifficulty(terms),
      sourceCharacters: text.length
    }
  };
}

export function normalizeText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countTokens(text) {
  const counts = new Map();
  const matches = text.match(TOKEN_PATTERN) || [];

  for (const token of matches) {
    const word = canonicalize(token);
    if (!word) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return counts;
}

function canonicalize(token) {
  let word = String(token || "")
    .toLowerCase()
    .replace(/^'+|'+$/g, "")
    .replace(/'s$/g, "")
    .replace(/[^a-z'-]/g, "");

  if (word.length < MIN_WORD_LENGTH) return "";
  if (word.includes("--")) return "";

  if (word.endsWith("ies") && word.length > 5) {
    word = `${word.slice(0, -3)}y`;
  } else if (word.endsWith("ing") && word.length > 6) {
    word = removeDoubledFinal(word.slice(0, -3));
  } else if (word.endsWith("ed") && word.length > 5) {
    word = removeDoubledFinal(word.slice(0, -2));
  } else if (word.endsWith("es") && word.length > 5 && !/(ses|xes|zes|ches|shes)$/.test(word)) {
    word = word.slice(0, -2);
  } else if (word.endsWith("s") && word.length > 5 && !/(ss|us|is)$/.test(word)) {
    word = word.slice(0, -1);
  }

  return word;
}

function removeDoubledFinal(word) {
  if (word.length < 4) return word;
  const last = word.at(-1);
  const previous = word.at(-2);
  return last === previous ? word.slice(0, -1) : word;
}

function isCandidate(word) {
  if (!word || word.length < MIN_WORD_LENGTH) return false;
  if (STOP_WORDS.has(word)) return false;
  if (/^[a-z]$/.test(word)) return false;
  if (/^(http|https|www|com|org|net|pdf|docx|txt)$/.test(word)) return false;
  if (/^(january|february|march|april|june|july|august|september|october|november|december)$/.test(word)) {
    return false;
  }
  return true;
}

function splitSentences(text) {
  return text
    .replace(/\n+/g, ". ")
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 12 && sentence.length <= 240)
    .slice(0, 2400);
}

function extractLineCandidates(text) {
  const boosts = new Map();
  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 6000);

  for (const line of lines) {
    const tokens = line.match(TOKEN_PATTERN) || [];
    const listLike = tokens.length <= 4 || /^[A-Za-z][A-Za-z'-]{2,}\s*[-:]/.test(line);
    if (!listLike) continue;

    const first = canonicalize(tokens[0]);
    if (isCandidate(first)) {
      boosts.set(first, (boosts.get(first) || 0) + 2);
    }
  }

  return boosts;
}

function findBestSentence(sentences, word) {
  const pattern = new RegExp(`\\b${escapeRegExp(word)}(?:s|ed|ing)?\\b`, "i");
  const exact = sentences.find(sentence => pattern.test(sentence));
  if (exact) return cleanSentence(exact);
  return "";
}

function scoreWord(word, frequency, lineBoost, context) {
  const lexiconBoost = LEXICON[word] ? 6 : 0;
  const academicBoost = ACADEMIC_SIGNALS.has(word) ? 3.5 : 0;
  const rarityWeight = BASIC_WORDS.has(word) ? 0.45 : 1.35;
  const lengthBonus = Math.min(Math.max(word.length - 4, 0) * 0.32, 3.2);
  const morphologyBonus = POS_SUFFIXES.some(({ suffix }) => word.endsWith(suffix)) ? 1.2 : 0;
  const contextBonus = context ? 0.8 : 0;

  return round(
    frequency * rarityWeight +
      lineBoost * 4 +
      lexiconBoost +
      academicBoost +
      lengthBonus +
      morphologyBonus +
      contextBonus,
    3
  );
}

function buildTerm(word, frequency, importance, context) {
  const lexiconEntry = LEXICON[word];
  const partOfSpeech = lexiconEntry?.partOfSpeech || inferPartOfSpeech(word, context);
  const difficulty = classifyDifficulty(word, frequency, importance);
  const definition = lexiconEntry?.definition || synthesizeDefinition(word, partOfSpeech, context, difficulty);
  const example = lexiconEntry?.example || synthesizeExample(word, context, partOfSpeech);
  const synonyms = lexiconEntry?.synonyms || synthesizeSynonyms(word, partOfSpeech);
  const antonyms = lexiconEntry?.antonyms || synthesizeAntonyms(word);

  return {
    id: stableId(word),
    word,
    definition,
    partOfSpeech,
    example,
    synonyms,
    antonyms,
    frequency,
    difficulty,
    importance,
    context: context || example,
    review: {
      intervalDays: 1,
      ease: 2.4,
      dueAt: Date.now()
    }
  };
}

function inferPartOfSpeech(word, context) {
  for (const rule of POS_SUFFIXES) {
    if (word.endsWith(rule.suffix)) return rule.partOfSpeech;
  }

  if (context) {
    const lower = context.toLowerCase();
    if (new RegExp(`\\b(to|will|can|could|should|may|might) ${escapeRegExp(word)}\\b`).test(lower)) {
      return "verb";
    }
    if (new RegExp(`\\b(a|an|the|this|that|these|those) ${escapeRegExp(word)}\\b`).test(lower)) {
      return "noun";
    }
    if (new RegExp(`\\b${escapeRegExp(word)} (person|idea|method|result|system|word|process|question)\\b`).test(lower)) {
      return "adjective";
    }
  }

  return word.length > 8 ? "noun" : "vocabulary word";
}

function classifyDifficulty(word, frequency, importance) {
  if (BASIC_WORDS.has(word) && word.length <= 7) return "basic";
  if (LEXICON[word] || ACADEMIC_SIGNALS.has(word)) return word.length >= 9 ? "advanced" : "intermediate";
  if (word.length >= 11 || importance >= 10.5 || POS_SUFFIXES.some(({ suffix }) => word.endsWith(suffix))) return "advanced";
  if (word.length <= 5 && frequency >= 3) return "basic";
  return "intermediate";
}

function synthesizeDefinition(word, partOfSpeech, context, difficulty) {
  const root = ROOT_HINTS.find(entry => entry.pattern.test(word));
  const theme = root ? root.theme : "a specific idea from the source text";
  const posText = partOfSpeech === "vocabulary word" ? "term" : partOfSpeech;
  const level = difficulty === "advanced" ? "more specialized" : difficulty;

  if (context) {
    return `A ${level} ${posText} connected to ${theme}; in the source, it appears in a context that helps clarify its use.`;
  }

  return `A ${level} ${posText} connected to ${theme}.`;
}

function synthesizeExample(word, context, partOfSpeech) {
  if (context && context.length <= 180) return ensureSentence(context);

  const article = /^[aeiou]/.test(word) ? "an" : "a";
  if (partOfSpeech === "verb") {
    return `Writers often ${word} ideas by using clear evidence and context.`;
  }
  if (partOfSpeech === "adjective") {
    return `The teacher chose ${article} ${word} example to make the lesson easier to remember.`;
  }
  if (partOfSpeech === "adverb") {
    return `The student answered ${word} after reviewing the example sentence.`;
  }
  return `The word ${word} appeared in the reading as an important term to remember.`;
}

function synthesizeSynonyms(word, partOfSpeech) {
  if (partOfSpeech === "verb") return ["use", "apply", "express"];
  if (partOfSpeech === "adjective") return ["clear", "notable", "specific"];
  if (partOfSpeech === "adverb") return ["clearly", "carefully", "steadily"];
  if (word.endsWith("tion") || word.endsWith("ment")) return ["process", "result", "concept"];
  return ["idea", "term", "concept"];
}

function synthesizeAntonyms(word) {
  if (word.startsWith("un")) return [word.slice(2), "opposite"];
  if (word.startsWith("in")) return [word.slice(2), "opposite"];
  if (word.endsWith("less")) return [`${word.slice(0, -4)}ful`, "opposite"];
  return ["opposite", "contrast"];
}

function summarizeDifficulty(terms) {
  return terms.reduce(
    (summary, term) => {
      summary[term.difficulty] += 1;
      return summary;
    },
    { basic: 0, intermediate: 0, advanced: 0 }
  );
}

function normalizeDifficulty(value) {
  return ["basic", "intermediate", "advanced"].includes(value) ? value : "all";
}

function stableId(word) {
  let hash = 0;
  for (let index = 0; index < word.length; index += 1) {
    hash = (hash << 5) - hash + word.charCodeAt(index);
    hash |= 0;
  }
  return `term-${word}-${Math.abs(hash).toString(36)}`;
}

function cleanSentence(sentence) {
  return ensureSentence(
    sentence
      .replace(/\s+/g, " ")
      .replace(/^[^\w]+/, "")
      .trim()
  );
}

function ensureSentence(sentence) {
  const value = String(sentence || "").trim();
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
