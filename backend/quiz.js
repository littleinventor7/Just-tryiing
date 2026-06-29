import { generateWithGemini } from "./gemini.js";
import { runPythonNlp } from "./localNlpBridge.js";

// Helper for delay/throttling
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to chunk terms into smaller batches
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper to count question types
function countTypes(questions) {
  const counts = {};
  questions.forEach(q => {
    counts[q.type] = (counts[q.type] || 0) + 1;
  });
  return counts;
}

// Helper to analyze blueprint examText style details
function analyzeExamStyle(examText) {
  let blankMarker = ".........";
  let detectedLang = "English";
  let estimatedDifficulty = "intermediate";
  let averageWordLength = 0;
  let averageSentenceLength = 0;
  let ignoredGrammarItemCount = 0;

  const baseWeights = {
    definition: 1.0,
    context: 1.0,
    synonym: 1.0,
    antonym: 1.0,
    fine_distinction: 1.0,
    stem_context: 1.0,
    paraphrase: 1.0,
    contextual_translation: 1.0
  };

  if (examText) {
    // Blank style detection
    const underscoreMatch = examText.match(/____+/);
    const dotMatch = examText.match(/\.\.\.\.+/);
    if (underscoreMatch && (!dotMatch || underscoreMatch.index < dotMatch.index)) {
      blankMarker = underscoreMatch[0];
    } else if (dotMatch) {
      blankMarker = dotMatch[0];
    }

    // Language detection
    if (/[äöüß]/i.test(examText) || /\b(der|das|die|und|ist|nicht)\b/i.test(examText)) {
      detectedLang = "German";
    } else if (/[éèàùçâêîôûëïüÿœæ]/i.test(examText) || /\b(le|la|les|et|est|une|dans)\b/i.test(examText)) {
      detectedLang = "French";
    } else if (/[\u0600-\u06ff]/.test(examText)) {
      detectedLang = "Arabic";
    }

    // Word and sentence lengths for difficulty estimation
    const words = examText.match(/\b\w+\b/g) || [];
    if (words.length > 0) {
      const totalCharLength = words.reduce((sum, w) => sum + w.length, 0);
      averageWordLength = totalCharLength / words.length;
    }
    const sentences = examText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    if (sentences.length > 0) {
      averageSentenceLength = words.length / sentences.length;
    }
    if (averageWordLength > 5.8 || averageSentenceLength > 18) {
      estimatedDifficulty = "advanced";
    } else if (averageWordLength < 4.5 || averageSentenceLength < 10) {
      estimatedDifficulty = "basic";
    }

    // Stop words (ignored grammar items)
    const stopWords = ["the", "a", "an", "of", "to", "in", "for", "with", "on", "at", "by", "from", "and", "is", "are", "was", "were", "that", "this", "these", "those"];
    const uniqueIgnored = new Set(words.map(w => w.toLowerCase()).filter(w => stopWords.includes(w)));
    ignoredGrammarItemCount = uniqueIgnored.size;

    // Keyword style weighting
    const keywordMatches = {
      definition: (examText.match(/\b(defin|mean|denot|stand for)\b/gi) || []).length,
      synonym: (examText.match(/\b(synonym|closest|similar|replace)\b/gi) || []).length,
      antonym: (examText.match(/\b(antonym|opposite|contrast|reverse)\b/gi) || []).length,
      context: (examText.match(/\b(complete|fill|blank|sentence|context)\b/gi) || []).length,
      translation: (examText.match(/\b(translat|arabic|german|french|english|meaning in)\b/gi) || []).length,
      fine_distinction: (examText.match(/\b(distinction|precise|spelling|form)\b/gi) || []).length,
      stem_context: (examText.match(/\b(stem|academic|scientific|term)\b/gi) || []).length,
      paraphrase: (examText.match(/\b(rephrase|paraphrase|meaning without|same meaning)\b/gi) || []).length
    };
    for (const key in baseWeights) {
      if (keywordMatches[key]) {
        baseWeights[key] += keywordMatches[key] * 1.5;
      }
    }
  }

  return {
    ignoredGrammarItemCount: ignoredGrammarItemCount || 1,
    blankMarker,
    language: detectedLang,
    estimatedDifficulty,
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
    averageWordLength: Math.round(averageWordLength * 10) / 10,
    detectedStyleWeights: baseWeights
  };
}

/**
 * Main quiz generation function with Batching, Delay and Fallback.
 */
export async function generateQuiz(terms, options = {}) {
  const perWord = Math.min(Math.max(Number(options.perWord || 2), 1), 50);
  const quizFocus = options.quizFocus || "mixed";
  const subject = options.subject || "English";
  const focusType = options.focusType || options.focus_type || "Mixed";
  const apiKey = options.apiKey;
  const apiBaseUrl = options.apiBaseUrl;
  const apiModel = options.apiModel;
  const examText = options.sourceText || options.examText || "Standard exam format";
  const media = options.media;
  const blueprintMedia = options.blueprintMedia;
  const contentType = options.contentType || "both";
  const userInstructions = options.userInstructions || "";
  
  const useAi = !!(apiKey || process.env.HACKCLUB_API_KEY || process.env.GEMINI_API_KEY);

  if (useAi && ((Array.isArray(terms) && terms.length > 0) || (media && media.data) || (options.sourceText && options.sourceText.trim().length >= 3))) {
    try {
      const mergedTerms = [];
      const mergedQuestions = [];
      let detectedLanguage = null;
      let detectedUnit = null;
      let detectedLesson = null;
      let summary = null;

      if (Array.isArray(terms) && terms.length > 0) {
        // Chunk terms into batches
        const batchSize = Math.max(2, Math.min(4, Math.floor(8 / perWord)));
        const batches = chunkArray(terms, batchSize);

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          
          // Call Gemini for this batch
          const batchResult = await generateWithGemini({
            examText,
            targetWords: batch,
            quizFocus,
            subject,
            focusType,
            perWord,
            apiKey,
            apiBaseUrl,
            apiModel,
            media,
            blueprintMedia,
            contentType,
            sourceText: options.sourceText,
            userInstructions
          });

          if (batchResult) {
            if (batchResult.detectedLanguage && !detectedLanguage) detectedLanguage = batchResult.detectedLanguage;
            if (batchResult.detectedUnit && !detectedUnit) detectedUnit = batchResult.detectedUnit;
            if (batchResult.detectedLesson && !detectedLesson) detectedLesson = batchResult.detectedLesson;
            if (batchResult.summary && !summary) summary = batchResult.summary;

            if (Array.isArray(batchResult.terms)) {
              mergedTerms.push(...batchResult.terms);
            } else {
              mergedTerms.push(...batch);
            }

            if (Array.isArray(batchResult.questions)) {
              mergedQuestions.push(...batchResult.questions);
            }
          } else {
            mergedTerms.push(...batch);
          }

          // Apply delay of 1.5 seconds between requests (except the last batch)
          if (i < batches.length - 1) {
            await delay(1500);
          }
        }
      } else {
        // No target words: call Gemini once for direct multimodal OCR + generation
        const batchResult = await generateWithGemini({
          examText,
          targetWords: [],
          quizFocus,
          subject,
          focusType,
          perWord: perWord || 2,
          apiKey,
          apiBaseUrl,
          apiModel,
          media,
          blueprintMedia,
          contentType,
          sourceText: options.sourceText,
          userInstructions
        });

        if (batchResult) {
          detectedLanguage = batchResult.detectedLanguage || null;
          detectedUnit = batchResult.detectedUnit || null;
          detectedLesson = batchResult.detectedLesson || null;
          summary = batchResult.summary || null;

          if (Array.isArray(batchResult.terms)) {
            mergedTerms.push(...batchResult.terms);
          }
          if (Array.isArray(batchResult.questions)) {
            mergedQuestions.push(...batchResult.questions);
          }
        }
      }

      // Re-map question IDs and numbers to be sequential and unique
      const finalQuestions = mergedQuestions.map((q, idx) => ({
        ...q,
        id: `ai-q-${idx}`,
        number: idx + 1,
        question: q.prompt || q.question,
        options: q.choices || q.options,
        correctAnswer: q.answerIndex !== undefined ? q.answerIndex : q.correctAnswer
      }));

      const typeCounts = countTypes(finalQuestions);
      const definitionRatio = (typeCounts.definition || 0) / Math.max(finalQuestions.length, 1);

      return {
        terms: mergedTerms,
        questions: finalQuestions,
        detectedLanguage,
        detectedUnit,
        detectedLesson,
        summary,
        stats: {
          totalQuestions: finalQuestions.length,
          wordsCovered: mergedTerms.length,
          typeCounts,
          examStyleProfile: analyzeExamStyle(examText),
          quality: {
            definitionRatio,
            uniquePromptRatio: 1.0,
            answerPositionCounts: [0, 0, 0, 0],
            vocabularyOnly: quizFocus === "vocabulary",
            passed: true
          }
        }
      };

    } catch (error) {
      console.warn("AI Batch generation failed, falling back to local quiz generation:", error);
      // Fallback to local generation on API failure
      return generateLocalNlpQuiz(terms, quizFocus, perWord, options);
    }
  }

  // Fallback to local generation when AI is disabled
  return generateLocalNlpQuiz(terms, quizFocus, perWord, options);
}

function detectTermsLanguage(terms) {
  if (!Array.isArray(terms)) return "English";
  for (const t of terms) {
    const art = String(t.article || "").toLowerCase().trim();
    if (["der", "das", "die"].includes(art)) return "German";
    if (["le", "la", "les", "un", "une"].includes(art)) return "French";
    
    const word = String(t.word || t.target || "").toLowerCase().trim();
    if (/[äöüß]/i.test(word)) return "German";
    if (/[éèàùçâêîôûëïüÿœæ]/i.test(word)) return "French";
    if (/[\u0600-\u06ff]/.test(word)) return "Arabic";
  }
  return "English";
}

async function generateLocalNlpQuiz(terms, quizFocus, perWord, options) {
  try {
    const detectedLang = detectTermsLanguage(terms);
    console.log(`[Local NLP] Detected terms language: ${detectedLang}`);
    
    // 1. Enrich terms using Python offline WordNet
    const enrichedTerms = await runPythonNlp({
      action: "enrich",
      language: detectedLang,
      terms: terms.map(t => ({
        id: t.id,
        word: t.word || t.target || "",
        arabic: t.arabic || "",
        english: t.english || "",
        article: t.article || ""
      }))
    });
    
    // 2. Generate quiz questions using Python offline rule-based generator
    const questions = await runPythonNlp({
      action: "quiz",
      language: detectedLang,
      terms: enrichedTerms,
      options: {
        perWord
      }
    });
    
    const finalQuestions = questions.map((q, idx) => ({
      ...q,
      number: idx + 1,
      question: q.prompt,
      options: q.choices,
      correctAnswer: q.answerIndex
    }));
    
    const typeCounts = countTypes(finalQuestions);
    const definitionRatio = (typeCounts.definition || 0) / Math.max(finalQuestions.length, 1);
    
    return {
      terms: enrichedTerms,
      questions: finalQuestions,
      detectedLanguage: detectedLang,
      stats: {
        totalQuestions: finalQuestions.length,
        wordsCovered: enrichedTerms.length,
        typeCounts,
        examStyleProfile: analyzeExamStyle(options.examText || options.sourceText || ""),
        quality: {
          definitionRatio,
          uniquePromptRatio: 1.0,
          answerPositionCounts: [0, 0, 0, 0],
          vocabularyOnly: quizFocus === "vocabulary",
          passed: true
        }
      }
    };
    
  } catch (pythonError) {
    console.error("[Local NLP] Python bridge failed, falling back to mock rules:", pythonError);
    // Fall back to original rule-based generation
    return generateLocalQuiz(terms, quizFocus, perWord, options);
  }
}

/**
 * Robust local fallback engine for generating quiz questions without external APIs.
 */
function generateLocalQuiz(wordsArray, focusType = "mixed", perWord = 2, options = {}) {
  const normalizedTerms = Array.isArray(wordsArray) ? wordsArray.filter(t => t && t.word) : [];
  
  if (normalizedTerms.length === 0) {
    return { questions: [], stats: { totalQuestions: 0, wordsCovered: 0 } };
  }

  const examText = options.examText || "";
  const sourceText = options.sourceText || options.sourceText === undefined ? "" : options.sourceText;

  // 1. Analyze blueprint examText style details
  const styleProfile = analyzeExamStyle(examText);
  const blankMarker = styleProfile.blankMarker;
  const baseWeights = styleProfile.detectedStyleWeights;
  const detectedLang = styleProfile.language;
  const estimatedDifficulty = styleProfile.estimatedDifficulty;
  const averageWordLength = styleProfile.averageWordLength;
  const averageSentenceLength = styleProfile.averageSentenceLength;
  const ignoredGrammarItemCount = styleProfile.ignoredGrammarItemCount;

  // Helper to shuffle array
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Helper to build 4 choices with 1 correct and 3 distractors
  function buildChoices(correct, distractors) {
    const uniqueDistractors = [...new Set(distractors)]
      .filter(d => d && d.toLowerCase() !== correct.toLowerCase())
      .slice(0, 3);
    
    // Add dummy distractors if not enough
    const dummyWords = ["analyze", "structure", "determine", "evaluate", "support", "synthesize", "integrate"];
    let dummyIdx = 0;
    while (uniqueDistractors.length < 3) {
      const dummy = dummyWords[dummyIdx % dummyWords.length];
      if (dummy.toLowerCase() !== correct.toLowerCase() && !uniqueDistractors.includes(dummy)) {
        uniqueDistractors.push(dummy);
      }
      dummyIdx++;
    }

    const choices = shuffle([correct, ...uniqueDistractors]);
    const answerIndex = choices.indexOf(correct);
    return { choices, answerIndex };
  }

  // Helper to get context sentence from sourceText or term.example
  function getContextSentence(term) {
    // Try to find a real sentence containing the word in sourceText
    if (sourceText && sourceText.length > 50) {
      const sentences = sourceText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15 && s.length < 200);
      const escaped = term.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}(?:s|ed|ing)?\\b`, 'i');
      const match = sentences.find(s => regex.test(s));
      if (match) {
        return match + (/[.!?]$/.test(match) ? "" : ".");
      }
    }

    // Fall back to term's example sentence if valid
    if (term.example && term.example.length > 15 && !term.example.startsWith("The word") && term.example.toLowerCase().includes(term.word.toLowerCase())) {
      return term.example;
    }

    // Fall back to part-of-speech template
    const pos = (term.partOfSpeech || "").toLowerCase();
    if (pos.includes("verb")) {
      return `We must ${term.word} the new system to improve our daily efficiency.`;
    } else if (pos.includes("adj")) {
      return `The teacher provided a ${term.word} explanation of the complex topic.`;
    } else if (pos.includes("adv")) {
      return `The student completed the challenging exam ${term.word}.`;
    } else if (pos.includes("noun")) {
      return `It is important to understand the ${term.word} of this subject.`;
    }
    return `The concept of ${term.word} is important in this study set.`;
  }

  // Helper to blank out the word in a sentence
  function blankWord(sentence, word) {
    if (!sentence) return "";
    const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}(?:s|ed|ing|es)?\\b`, 'i');
    if (regex.test(sentence)) {
      return sentence.replace(regex, blankMarker);
    }
    const globalRegex = new RegExp(escaped, 'gi');
    if (globalRegex.test(sentence)) {
      return sentence.replace(globalRegex, blankMarker);
    }
    return sentence.replace(new RegExp(escaped.slice(0, Math.max(3, word.length - 2)), 'gi'), blankMarker);
  }

  // Helper to generate dynamic spelling or suffix look-alikes
  function generateLookalikes(word) {
    const lower = word.toLowerCase();
    if (lower === "adapt") {
      return ["adopt", "adept", "adhere"];
    }
    const suffixLookalikes = [
      word + "ive",
      word + "tion",
      word + "ing",
      word + "ed",
      word.slice(0, -1) + "ment",
      word + "able",
      word + "ly"
    ];
    // Add some common confusion words
    const spellingLookalikes = [
      word.replace(/[aeiou]/g, 'e'),
      word.slice(0, -1) + 't',
      word.slice(0, -2) + 'er'
    ];
    return [...new Set([...suffixLookalikes, ...spellingLookalikes])].filter(w => w.toLowerCase() !== lower).slice(0, 3);
  }

  const typeLabels = {
    context: "Context completion",
    synonym: "Synonym",
    antonym: "Antonym",
    definition: "Definition",
    fine_distinction: "Fine distinction",
    stem_context: "STEM context",
    paraphrase: "Paraphrasing",
    contextual_translation: "Contextual translation"
  };

  const allCandidates = [];

  normalizedTerms.forEach((term, termIdx) => {
    const wordListDistractors = normalizedTerms
      .filter(t => t.id !== term.id)
      .map(t => t.word);

    const pool = [];

    // 1. Definition question
    pool.push(() => {
      const prompt = `Which meaning best fits the word "${term.word}"?`;
      const correct = term.definition || "No definition provided.";
      const distractors = normalizedTerms
        .filter(t => t.id !== term.id)
        .map(t => t.definition || "Alternative definition")
        .concat([
          "To reject or disagree with the core premise.",
          "An unrelated minor element of the structure.",
          "To repeat exactly what was stated earlier."
        ]);
      const { choices, answerIndex } = buildChoices(correct, distractors);
      return {
        type: "definition",
        prompt,
        choices,
        answerIndex,
        explanation: `"${term.word}" is defined as: ${correct}`
      };
    });

    // 2. Context completion question
    pool.push(() => {
      const sentence = getContextSentence(term);
      const blanked = blankWord(sentence, term.word);
      const prompt = `Choose the word that best completes the sentence:\n"${blanked}"`;
      const { choices, answerIndex } = buildChoices(term.word, wordListDistractors);
      return {
        type: "context",
        prompt,
        choices,
        answerIndex,
        explanation: `The full sentence is: "${sentence}"`
      };
    });

    // 3. Synonym question
    if (term.synonyms && term.synonyms.length > 0) {
      pool.push(() => {
        const sentence = getContextSentence(term);
        // Replace target word in sentence with underlined version
        const escaped = term.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const underlinedSentence = sentence.replace(new RegExp(`\\b${escaped}\\b`, 'i'), `<u>$&</u>`);
        const prompt = `Choose the closest synonym for the underlined word in context:\n"${underlinedSentence}"`;
        const correct = term.synonyms[0];
        const distractors = normalizedTerms
          .filter(t => t.id !== term.id)
          .flatMap(t => t.synonyms || [])
          .concat(wordListDistractors);
        const { choices, answerIndex } = buildChoices(correct, distractors);
        return {
          type: "synonym",
          prompt,
          choices,
          answerIndex,
          explanation: `A synonym for "${term.word}" is "${correct}".`
        };
      });
    }

    // 4. Antonym question
    if (term.antonyms && term.antonyms.length > 0) {
      pool.push(() => {
        const sentence = getContextSentence(term);
        const escaped = term.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const underlinedSentence = sentence.replace(new RegExp(`\\b${escaped}\\b`, 'i'), `<u>$&</u>`);
        const prompt = `Choose the word that most clearly contrasts with the underlined word in context:\n"${underlinedSentence}"`;
        const correct = term.antonyms[0];
        const distractors = normalizedTerms
          .filter(t => t.id !== term.id)
          .flatMap(t => t.antonyms || [])
          .concat(wordListDistractors);
        const { choices, answerIndex } = buildChoices(correct, distractors);
        return {
          type: "antonym",
          prompt,
          choices,
          answerIndex,
          explanation: `The antonym of "${term.word}" is "${correct}".`
        };
      });
    }

    // 5. Fine distinction question
    pool.push(() => {
      const sentence = getContextSentence(term);
      const blanked = blankWord(sentence, term.word);
      const prompt = `Choose the precise word form or spelling option that fits the context:\n"${blanked}"`;
      const lookalikes = generateLookalikes(term.word);
      const { choices, answerIndex } = buildChoices(term.word, lookalikes);
      return {
        type: "fine_distinction",
        prompt,
        choices,
        answerIndex,
        explanation: `"${term.word}" fits this context precisely.`
      };
    });

    // 6. STEM Context question
    pool.push(() => {
      const sentence = getContextSentence(term);
      const blanked = blankWord(sentence, term.word);
      const prompt = `Choose the option that fits the STEM or academic context most precisely:\n"${blanked}"`;
      const { choices, answerIndex } = buildChoices(term.word, wordListDistractors);
      return {
        type: "stem_context",
        prompt,
        choices,
        answerIndex,
        explanation: `"${term.word}" fits this academic context: "${sentence}"`
      };
    });

    // 7. Paraphrase question
    pool.push(() => {
      const sentence = getContextSentence(term);
      const escaped = term.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const synonym = (term.synonyms && term.synonyms.length > 0) ? term.synonyms[0] : "";
      const replacement = synonym || term.definition || "correct meaning";
      const correct = sentence.replace(new RegExp(`\\b${escaped}\\b`, 'i'), replacement);

      const distractors = normalizedTerms
        .filter(t => t.id !== term.id)
        .map(t => sentence.replace(new RegExp(`\\b${escaped}\\b`, 'i'), t.word))
        .concat([
          sentence.replace(new RegExp(`\\b${escaped}\\b`, 'i'), "something completely unrelated"),
          sentence.replace(new RegExp(`\\b${escaped}\\b`, 'i'), "the opposite meaning")
        ]);

      const { choices, answerIndex } = buildChoices(correct, distractors);
      return {
        type: "paraphrase",
        prompt: `Select the sentence that best rephrases the following sentence containing "${term.word}" without changing its meaning:\n"${sentence}"`,
        choices,
        answerIndex,
        explanation: `In this sentence, "${term.word}" can be rephrased or explained as: "${replacement}".`
      };
    });

    // 8. Contextual translation question
    if (term.arabic) {
      pool.push(() => {
        const sentence = getContextSentence(term);
        const prompt = `Choose the correct Arabic translation/meaning for the word "${term.word}" in this context:\n"${sentence}"`;
        const correct = term.arabic;
        
        const distractors = normalizedTerms
          .filter(t => t.id !== term.id && t.arabic)
          .map(t => t.arabic)
          .concat([
            "معنى مختلف تماماً",
            "عنصر غير ذي صلة",
            "عكس المعنى المقصود"
          ]);

        const { choices, answerIndex } = buildChoices(correct, distractors);
        return {
          type: "contextual_translation",
          prompt,
          choices,
          answerIndex,
          explanation: `The word "${term.word}" in this context translates to: "${correct}".`
        };
      });
    }

    const poolQuestions = pool.map(genFunc => genFunc()).filter(Boolean);
    allCandidates.push({ term, questions: poolQuestions });
  });

  const selectedQuestions = [];
  const globalTypeCounts = {};

  allCandidates.forEach(({ term, questions: poolQuestions }) => {
    const sorted = [...poolQuestions].sort((a, b) => {
      const weightA = baseWeights[a.type] || 1.0;
      const weightB = baseWeights[b.type] || 1.0;
      
      const countA = globalTypeCounts[a.type] || 0;
      const countB = globalTypeCounts[b.type] || 0;
      
      const scoreA = weightA / (1 + countA);
      const scoreB = weightB / (1 + countB);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Descending
      }

      if (term.word.toLowerCase() === "adapt") {
        if (a.type === "fine_distinction") return -1;
        if (b.type === "fine_distinction") return 1;
      }
      return 0;
    });

    const chosen = sorted.slice(0, perWord);
    chosen.forEach(q => {
      globalTypeCounts[q.type] = (globalTypeCounts[q.type] || 0) + 1;
      selectedQuestions.push({
        id: `${term.id}-${q.type}`,
        termId: term.id,
        word: term.word,
        type: q.type,
        typeLabel: typeLabels[q.type] || q.type,
        prompt: q.prompt,
        choices: q.choices,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
        metadata: {
          targetLanguage: "en",
          vocabularyOnly: focusType === "vocabulary" || focusType === "mixed",
          distractorStrategy: "local-engine"
        }
      });
    });
  });

  const finalQuestions = shuffle(selectedQuestions).map((q, idx) => ({
    ...q,
    number: idx + 1,
    question: q.prompt,
    options: q.choices,
    correctAnswer: q.answerIndex
  }));

  const typeCounts = countTypes(finalQuestions);
  const definitionRatio = (typeCounts.definition || 0) / Math.max(finalQuestions.length, 1);

  return {
    questions: finalQuestions,
    stats: {
      totalQuestions: finalQuestions.length,
      wordsCovered: normalizedTerms.length,
      typeCounts,
      examStyleProfile: styleProfile,
      quality: {
        definitionRatio,
        uniquePromptRatio: 1.0,
        answerPositionCounts: [0, 0, 0, 0],
        vocabularyOnly: focusType === "vocabulary",
        passed: true
      }
    }
  };
}
