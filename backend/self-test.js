import { analyzeText } from "./nlp.js";
import { generateQuiz } from "./quiz.js";
import { buildTermsFromRows } from "../public/js/tableTerms.js";

const sample = `
abundant - more than enough
ambiguous: unclear or having more than one meaning
Students analyze complex passages and infer subtle meanings from context.
Daily practice can enhance memory, refine understanding, and build resilient habits.
`;

const result = analyzeText(sample, { maxTerms: 20 });
const quiz = await generateQuiz(result.terms, { quizFocus: "mixed", perWord: 2 });
const examStyleText = `
1- The road is said to be ........ due to flooding.
a) stoppable b) impassable c) remarkable d) bearable
2- These crops require fertile lands. The antonym of the underlined word is ........ .
a) inventive b) rich c) sterile d) good
3- Our company's profit is more than ........ .
a) their company b) their company's c) them d) their
`;
const advancedTerms = [
  {
    id: "x1",
    word: "impassable",
    definition: "impossible to travel through or cross",
    partOfSpeech: "adjective",
    difficulty: "advanced",
    example: "The road was impassable due to flooding.",
    synonyms: ["blocked", "inaccessible"],
    antonyms: ["passable"]
  },
  {
    id: "x2",
    word: "fertile",
    definition: "able to produce strong growth or good results",
    partOfSpeech: "adjective",
    difficulty: "advanced",
    example: "The crops require fertile lands.",
    synonyms: ["productive", "rich"],
    antonyms: ["sterile"]
  },
  {
    id: "x3",
    word: "lucrative",
    definition: "producing a lot of money or profit",
    partOfSpeech: "adjective",
    difficulty: "advanced",
    example: "The online business became lucrative.",
    synonyms: ["profitable", "rewarding"],
    antonyms: ["unprofitable"]
  },
  {
    id: "x4",
    word: "dispel",
    definition: "to make a belief, feeling, or doubt disappear",
    partOfSpeech: "verb",
    difficulty: "advanced",
    example: "The evidence did not dispel the suspicion.",
    synonyms: ["dismiss", "scatter"],
    antonyms: ["confirm"]
  }
];
const styledQuiz = await generateQuiz(advancedTerms, { quizFocus: "mixed", perWord: 2 });
const fineDistinctionQuiz = await generateQuiz(
  [
    {
      id: "adapt-term",
      word: "adapt",
      definition: "to adjust to changing conditions",
      partOfSpeech: "verb",
      difficulty: "advanced",
      example: "Organisms must adapt to shifting environmental variables.",
      synonyms: ["adjust", "modify"],
      antonyms: ["resist"]
    },
    {
      id: "burnout-term",
      word: "burnout",
      definition: "chronic exhaustion caused by prolonged stress without recovery",
      partOfSpeech: "noun",
      difficulty: "advanced",
      example: "Prolonged workplace stress can lead to severe burnout.",
      synonyms: ["exhaustion", "fatigue"],
      antonyms: ["recovery"]
    },
    ...advancedTerms.slice(0, 2)
  ],
  { quizFocus: "mixed", perWord: 2 }
);
const rowTerms = buildTermsFromRows([
  {
    target: "infer subtle meanings from context",
    english: "Understand hidden or indirect meanings by using clues around the sentence.",
    arabic: "استنتاج المعاني الدقيقة من السياق"
  }
]);

assert(result.terms.length >= 6, "Expected at least six extracted vocabulary terms.");
assert(new Set(result.terms.map(term => term.word)).size === result.terms.length, "Terms should be unique.");
console.log("Generated question types:", quiz.questions.map(q => q.type));
assert(quiz.questions.length >= result.terms.length, "Quiz should include questions for terms.");
assert(new Set(quiz.questions.map(question => question.type)).size >= 3, "Quiz should use varied question types.");
assert(quiz.questions.every(question => question.choices[question.answerIndex]), "Every question needs a valid answer.");
assert(styledQuiz.stats.totalQuestions >= advancedTerms.length, "Styled quiz should cover words.");
assert(
  fineDistinctionQuiz.questions.some(question => question.type === "fine_distinction"),
  "Generator should include fine-distinction questions."
);
assert(
  fineDistinctionQuiz.questions.some(question => question.word === "adapt" && question.options.includes("adopt")),
  "Target-specific look-alike distractors should be integrated."
);
assert(rowTerms.length === 1, "Expected one table-based flashcard term.");
assert(rowTerms[0].word === "infer subtle meanings from context", "Table terms should keep the left cell intact.");
assert(rowTerms[0].breakdown.length >= 5, "Phrase cards should include a word-by-word breakdown.");
assert(rowTerms[0].arabic, "Table terms should preserve Arabic explanations.");

// Test quizFocus parameters
const focusTerms = [
  {
    id: "f1",
    word: "tense",
    definition: "a grammatical form showing time of action",
    partOfSpeech: "noun",
    difficulty: "basic",
    example: "The present tense is used here.",
    synonyms: [],
    antonyms: []
  }
];
const vocabFocusQuiz = await generateQuiz(focusTerms, { quizFocus: "vocabulary", perWord: 1 });
const mixedFocusQuiz = await generateQuiz(focusTerms, { quizFocus: "mixed", perWord: 1 });

assert(vocabFocusQuiz.questions.length > 0, "Vocabulary focus quiz should generate questions.");
assert(mixedFocusQuiz.questions.length > 0, "Mixed focus quiz should generate questions.");

console.log("Backend NLP and quiz generation checks passed.");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
