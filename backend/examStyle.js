const GRAMMAR_CUES = [
  "tense",
  "passive",
  "reported speech",
  "condition",
  "conditional",
  "rewrite",
  "correct form",
  "grammar",
  "structure",
  "pronoun",
  "preposition",
  "conjunction",
  "although",
  "despite",
  "because",
  "relative clause"
];

const FUNCTION_WORDS = new Set(
  `a an the and or but if because although despite due to for from in into on at by with of
  their theirs them he she it we you they his her our who whom whose which that than as
  although because despite while when where since until first second`.split(/\s+/)
);

const DEFAULT_DISTRIBUTION = {
  stem_context: 0.14,
  fine_distinction: 0.14,
  context: 0.19,
  collocation: 0.14,
  inference: 0.11,
  usage: 0.1,
  semantic_distinction: 0.09,
  synonym: 0.08,
  antonym: 0.05,
  expression: 0.05,
  definition: 0.01
};

export function createExamStyleProfile(sourceText = "") {
  const text = normalizeText(sourceText);
  const items = extractMultipleChoiceItems(text);
  const vocabularyItems = items.filter(isVocabularyItem);
  const patternCounts = countPatterns(vocabularyItems);
  const avgPromptWords = average(vocabularyItems.map(item => wordCount(item.prompt)));
  const avgOptionLength = average(vocabularyItems.flatMap(item => item.options).map(option => wordCount(option)));

  return {
    sourceItemCount: items.length,
    vocabularyItemCount: vocabularyItems.length,
    ignoredGrammarItemCount: Math.max(0, items.length - vocabularyItems.length),
    language: detectLanguage(text),
    difficulty: inferDifficulty(vocabularyItems, avgPromptWords, avgOptionLength),
    blankMarker: detectBlankMarker(text),
    averagePromptWords: Math.round(avgPromptWords),
    averageOptionWords: round(avgOptionLength, 2),
    patterns: patternCounts,
    typeDistribution: buildDistribution(patternCounts),
    sampleStems: vocabularyItems.slice(0, 8).map(item => item.prompt)
  };
}

function extractMultipleChoiceItems(text) {
  if (!text) return [];
  const compact = text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ");
  const chunks = compact.split(/(?=\n?\s*\d{1,3}\s*[-.)])/g);

  return chunks
    .map(chunk => chunk.trim())
    .map(chunk => {
      const firstOptionIndex = chunk.search(/\ba\)\s*/i);
      if (firstOptionIndex < 0) return null;
      const prompt = cleanPrompt(firstOptionIndex >= 0 ? chunk.slice(0, firstOptionIndex) : chunk);
      const optionBlock = chunk.slice(firstOptionIndex);
      const labelMatches = [...optionBlock.matchAll(/\b([a-d])\)\s*/gi)];
      if (labelMatches.length < 3) return null;
      const options = labelMatches
        .map((match, index) => {
          const start = match.index + match[0].length;
          const end = labelMatches[index + 1]?.index ?? optionBlock.length;
          return optionBlock.slice(start, end).replace(/\s+/g, " ").trim();
        })
        .filter(Boolean);
      return { prompt, options };
    })
    .filter(Boolean)
    .filter(item => item.prompt.length > 8);
}

function isVocabularyItem(item) {
  const prompt = item.prompt.toLowerCase();
  const options = item.options.map(option => normalizeOption(option));
  const grammarCue = GRAMMAR_CUES.some(cue => prompt.includes(cue));
  const allFunctionOptions = options.every(option => {
    const words = option.split(/\s+/).filter(Boolean);
    return words.length <= 3 && words.every(word => FUNCTION_WORDS.has(word));
  });
  const grammarOptionSet = looksLikePossessivePronounSet(options) || looksLikeWordFamilyFormSet(options);
  const hasLexicalOptions = options.some(option => {
    const words = option.split(/\s+/).filter(Boolean);
    return words.some(word => word.length >= 5 && !FUNCTION_WORDS.has(word));
  });
  const explicitVocabulary =
    /synonym|antonym|meaning|underlined|called|idiom|expression|collocation|word|phrase/.test(prompt);
  const clozeVocabulary = /…|\.{3,}|_{3,}|blank/.test(prompt) && hasLexicalOptions;

  return !grammarCue && !allFunctionOptions && !grammarOptionSet && (explicitVocabulary || clozeVocabulary || hasLexicalOptions);
}

function looksLikePossessivePronounSet(options) {
  const joined = options.join(" ");
  const pronounHits = countMatches(joined, /\b(their|theirs|them|they|his|her|hers|our|ours|my|mine)\b/gi);
  const repeatedContent = mostCommonContentStem(options) >= 2;
  return pronounHits >= 2 && repeatedContent;
}

function looksLikeWordFamilyFormSet(options) {
  const stems = options
    .map(option => option.replace(/[^a-z\u00c0-\u024f]/gi, "").toLowerCase())
    .filter(option => option.length >= 5)
    .map(option => option.slice(0, 5));
  if (stems.length < 3) return false;
  const counts = stems.reduce((summary, stem) => {
    summary[stem] = (summary[stem] || 0) + 1;
    return summary;
  }, {});
  return Math.max(...Object.values(counts)) >= 3;
}

function mostCommonContentStem(options) {
  const counts = {};
  for (const option of options) {
    for (const word of option.split(/\s+/)) {
      const normalized = word.replace(/[^a-z\u00c0-\u024f]/gi, "").toLowerCase();
      if (normalized.length < 4 || FUNCTION_WORDS.has(normalized)) continue;
      const stem = normalized.slice(0, 6);
      counts[stem] = (counts[stem] || 0) + 1;
    }
  }
  return Math.max(0, ...Object.values(counts));
}

function countPatterns(items) {
  const counts = {
    stem_context: 0,
    fine_distinction: 0,
    context: 0,
    synonym: 0,
    antonym: 0,
    collocation: 0,
    expression: 0,
    inference: 0,
    usage: 0,
    semantic_distinction: 0,
    definition: 0
  };

  for (const item of items) {
    const prompt = item.prompt.toLowerCase();
    if (/synonym/.test(prompt)) counts.synonym += 1;
    else if (/antonym|opposite/.test(prompt)) counts.antonym += 1;
    else if (/called|meaning|means/.test(prompt)) counts.definition += 1;
    else if (/stiff upper|by and|idiom|expression|phrase/.test(prompt)) counts.expression += 1;
    else if (/…|\.{3,}|_{3,}/.test(prompt)) counts.collocation += 1;
    else if (/context|infer|underlined/.test(prompt)) counts.inference += 1;
    else counts.context += 1;
  }

  return counts;
}

function buildDistribution(patternCounts) {
  const total = Object.values(patternCounts).reduce((sum, value) => sum + value, 0);
  if (!total) return DEFAULT_DISTRIBUTION;

  const distribution = { ...DEFAULT_DISTRIBUTION };
  for (const [type, count] of Object.entries(patternCounts)) {
    if (!distribution[type]) continue;
    distribution[type] = Math.max(distribution[type], count / total);
  }

  distribution.definition = Math.min(distribution.definition, 0.12);
  normalizeDistribution(distribution);
  return distribution;
}

function normalizeDistribution(distribution) {
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0) || 1;
  for (const key of Object.keys(distribution)) {
    distribution[key] = round(distribution[key] / total, 4);
  }
}

function inferDifficulty(items, avgPromptWords, avgOptionLength) {
  const advancedOptions = items
    .flatMap(item => item.options)
    .filter(option => /[a-z]{9,}/i.test(option) || option.split(/\s+/).length > 2).length;

  if (avgPromptWords >= 18 || avgOptionLength >= 1.6 || advancedOptions >= 8) return "advanced";
  if (avgPromptWords >= 11 || avgOptionLength >= 1.2) return "intermediate";
  return "mixed";
}

function detectLanguage(text) {
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  const scores = {
    en: countMatches(text, /\b(the|and|of|to|in|choose|answer|meaning|synonym|antonym)\b/gi),
    de: countMatches(text, /\b(der|die|das|und|nicht|wählen|bedeutet)\b/gi),
    fr: countMatches(text, /\b(le|la|les|des|choisissez|signifie)\b/gi),
    es: countMatches(text, /\b(el|la|los|las|elige|significa)\b/gi),
    it: countMatches(text, /\b(il|lo|gli|scegli|significa)\b/gi),
    tr: countMatches(text, /\b(bir|ve|seç|anlam|hangisi)\b/gi)
  };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "en";
}

function detectBlankMarker(text) {
  if (text.includes("…………")) return "…………";
  if (text.includes("……")) return "……";
  if (text.includes("____")) return "____";
  return "______";
}

function normalizeText(value) {
  return String(value || "").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function cleanPrompt(value) {
  return String(value || "")
    .replace(/^\s*\d{1,3}\s*[-.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOption(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z\u00c0-\u024f\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff\s'-]/gi, "")
    .trim();
}

function wordCount(value) {
  return String(value || "").split(/\s+/).filter(Boolean).length;
}

function countMatches(text, pattern) {
  return [...String(text || "").matchAll(pattern)].length;
}

function average(values) {
  const usable = values.filter(value => Number.isFinite(value));
  if (!usable.length) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
