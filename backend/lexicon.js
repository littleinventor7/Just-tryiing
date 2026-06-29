export const STOP_WORDS = new Set(
  `a about above after again against all almost along already also although always am among an and
  another any anyone anything are around as at away back be because been before being below between
  both but by came can cannot could did do does doing done down during each either enough every
  everyone everything few for from further gave get gets getting give given go goes going had has
  have having he her here hers herself him himself his how however i if in into is it its itself
  just keep kept kind know known large last later least less let like likely made make makes many
  may me might more most much must my myself near need neither never new no nor not now of off often
  old on once one only or other our ours ourselves out over own part perhaps place put rather really
  right said same saw say says see seem seemed seems seen several she should since so some someone
  something still such take taken than that the their theirs them themselves then there these they
  thing things this those through to too toward under until up upon us use used using very was way
  we well were what when where whether which while who whom whose why will with within without would
  yes yet you your yours yourself yourselves`.split(/\s+/)
);

export const BASIC_WORDS = new Set(
  `able across add afraid age agree air answer ask bad beautiful begin best better big black blue book
  boy bring brother build bus call car carry change child city clean close cold come common country
  day different dog door easy end family far fast father feel find fire food friend game girl good
  great green group hand happy hard hear help high home house idea important job keep language late
  learn left life light line little live long look love man money morning mother move name night open
  people person play point problem question read room school short small sound start story student
  table talk teacher tell thought time together try turn walk want water week white woman word work
  world write young`.split(/\s+/)
);

export const ACADEMIC_SIGNALS = new Set(
  `analysis approach assessment authority concept context data define derive distribute economy environment
  establish evidence factor function identify indicate individual interpret issue labor method occur policy
  principle process require research respond role section significant similar source structure theory vary`
    .split(/\s+/)
);

export const POS_SUFFIXES = [
  { suffix: "tion", partOfSpeech: "noun" },
  { suffix: "sion", partOfSpeech: "noun" },
  { suffix: "ment", partOfSpeech: "noun" },
  { suffix: "ness", partOfSpeech: "noun" },
  { suffix: "ity", partOfSpeech: "noun" },
  { suffix: "ism", partOfSpeech: "noun" },
  { suffix: "ist", partOfSpeech: "noun" },
  { suffix: "ize", partOfSpeech: "verb" },
  { suffix: "ise", partOfSpeech: "verb" },
  { suffix: "ify", partOfSpeech: "verb" },
  { suffix: "ate", partOfSpeech: "verb" },
  { suffix: "ous", partOfSpeech: "adjective" },
  { suffix: "ive", partOfSpeech: "adjective" },
  { suffix: "able", partOfSpeech: "adjective" },
  { suffix: "ible", partOfSpeech: "adjective" },
  { suffix: "al", partOfSpeech: "adjective" },
  { suffix: "ic", partOfSpeech: "adjective" },
  { suffix: "less", partOfSpeech: "adjective" },
  { suffix: "ful", partOfSpeech: "adjective" },
  { suffix: "ly", partOfSpeech: "adverb" }
];

export const ROOT_HINTS = [
  { pattern: /(bio|vita)/, theme: "life or living systems" },
  { pattern: /(geo|terr)/, theme: "earth, place, or land" },
  { pattern: /(graph|scrib|script)/, theme: "writing, recording, or description" },
  { pattern: /(phon|aud)/, theme: "sound, hearing, or speech" },
  { pattern: /(photo|lum|luc)/, theme: "light or visibility" },
  { pattern: /(dict|verbal|voc)/, theme: "speaking or words" },
  { pattern: /(struct|form)/, theme: "building, shape, or organization" },
  { pattern: /(spect|vis)/, theme: "seeing, observing, or inspecting" },
  { pattern: /(port|duct|fer)/, theme: "carrying, moving, or leading" },
  { pattern: /(chron|temp)/, theme: "time or sequence" },
  { pattern: /(psych|ment|cogn)/, theme: "thought, mind, or understanding" },
  { pattern: /(micro|mini)/, theme: "small scale or fine detail" },
  { pattern: /(macro|mega)/, theme: "large scale or broad scope" }
];

export const LEXICON = {
  abundant: {
    partOfSpeech: "adjective",
    definition: "present in a large amount; more than enough",
    example: "The valley had abundant water after the spring rains.",
    synonyms: ["plentiful", "ample", "copious"],
    antonyms: ["scarce", "limited"]
  },
  accurate: {
    partOfSpeech: "adjective",
    definition: "correct, exact, and free from mistakes",
    example: "The scientist needed accurate measurements before drawing a conclusion.",
    synonyms: ["precise", "correct", "exact"],
    antonyms: ["inaccurate", "wrong"]
  },
  adapt: {
    partOfSpeech: "verb",
    definition: "to change in order to fit a new situation",
    example: "Students quickly adapt when a course uses a new learning tool.",
    synonyms: ["adjust", "modify", "acclimate"],
    antonyms: ["resist", "remain"]
  },
  ambiguous: {
    partOfSpeech: "adjective",
    definition: "having more than one possible meaning; unclear",
    example: "The ambiguous instructions caused several teams to solve the task differently.",
    synonyms: ["unclear", "vague", "equivocal"],
    antonyms: ["clear", "definite"]
  },
  analyze: {
    partOfSpeech: "verb",
    definition: "to examine something carefully by separating it into parts",
    example: "The class will analyze the article before writing a response.",
    synonyms: ["examine", "study", "inspect"],
    antonyms: ["ignore", "combine"]
  },
  anticipate: {
    partOfSpeech: "verb",
    definition: "to expect or prepare for something before it happens",
    example: "The organizer tried to anticipate every question from the audience.",
    synonyms: ["expect", "foresee", "predict"],
    antonyms: ["doubt", "disregard"]
  },
  articulate: {
    partOfSpeech: "verb",
    definition: "to express an idea clearly in words",
    example: "She could articulate complex ideas in a calm, simple way.",
    synonyms: ["express", "state", "explain"],
    antonyms: ["mumble", "obscure"]
  },
  assess: {
    partOfSpeech: "verb",
    definition: "to judge or estimate the quality, value, or importance of something",
    example: "The teacher used a short quiz to assess vocabulary growth.",
    synonyms: ["evaluate", "judge", "appraise"],
    antonyms: ["ignore", "guess"]
  },
  coherent: {
    partOfSpeech: "adjective",
    definition: "logical, clear, and easy to understand",
    example: "A coherent essay connects every paragraph to the main claim.",
    synonyms: ["logical", "consistent", "clear"],
    antonyms: ["confusing", "disjointed"]
  },
  collaborate: {
    partOfSpeech: "verb",
    definition: "to work together with others toward a shared goal",
    example: "The two departments collaborate on research projects.",
    synonyms: ["cooperate", "partner", "team up"],
    antonyms: ["compete", "separate"]
  },
  concise: {
    partOfSpeech: "adjective",
    definition: "short and clear, with no unnecessary words",
    example: "A concise summary helps readers understand the report quickly.",
    synonyms: ["brief", "compact", "succinct"],
    antonyms: ["wordy", "lengthy"]
  },
  consequence: {
    partOfSpeech: "noun",
    definition: "a result or effect of an action or event",
    example: "Missing the deadline had a serious consequence for the project.",
    synonyms: ["result", "outcome", "effect"],
    antonyms: ["cause", "source"]
  },
  contradict: {
    partOfSpeech: "verb",
    definition: "to say or show that something is opposite or untrue",
    example: "The new evidence seemed to contradict the original theory.",
    synonyms: ["oppose", "deny", "disprove"],
    antonyms: ["confirm", "support"]
  },
  crucial: {
    partOfSpeech: "adjective",
    definition: "extremely important or necessary",
    example: "Clear feedback is crucial when students practice new words.",
    synonyms: ["essential", "vital", "critical"],
    antonyms: ["minor", "optional"]
  },
  demonstrate: {
    partOfSpeech: "verb",
    definition: "to show clearly by giving proof, examples, or action",
    example: "The experiment will demonstrate how temperature affects pressure.",
    synonyms: ["show", "prove", "illustrate"],
    antonyms: ["hide", "disprove"]
  },
  diminish: {
    partOfSpeech: "verb",
    definition: "to become or make something smaller, weaker, or less important",
    example: "The noise began to diminish after the crowd left.",
    synonyms: ["reduce", "lessen", "decrease"],
    antonyms: ["increase", "expand"]
  },
  diverse: {
    partOfSpeech: "adjective",
    definition: "including many different types or forms",
    example: "The quiz used diverse question styles to keep practice engaging.",
    synonyms: ["varied", "mixed", "assorted"],
    antonyms: ["uniform", "similar"]
  },
  efficient: {
    partOfSpeech: "adjective",
    definition: "working well without wasting time, effort, or resources",
    example: "An efficient review plan focuses on the words you miss most often.",
    synonyms: ["effective", "productive", "streamlined"],
    antonyms: ["wasteful", "slow"]
  },
  elaborate: {
    partOfSpeech: "verb",
    definition: "to explain or develop something with more detail",
    example: "The speaker paused to elaborate on the most difficult point.",
    synonyms: ["explain", "expand", "detail"],
    antonyms: ["summarize", "shorten"]
  },
  emerge: {
    partOfSpeech: "verb",
    definition: "to appear, become known, or come out",
    example: "A pattern began to emerge after the team reviewed the results.",
    synonyms: ["appear", "surface", "arise"],
    antonyms: ["vanish", "disappear"]
  },
  emphasize: {
    partOfSpeech: "verb",
    definition: "to give special importance or attention to something",
    example: "The coach emphasized steady practice over last-minute memorizing.",
    synonyms: ["stress", "highlight", "underline"],
    antonyms: ["downplay", "ignore"]
  },
  enhance: {
    partOfSpeech: "verb",
    definition: "to improve the quality, value, or strength of something",
    example: "Examples enhance a definition by showing how a word is used.",
    synonyms: ["improve", "strengthen", "upgrade"],
    antonyms: ["weaken", "reduce"]
  },
  evaluate: {
    partOfSpeech: "verb",
    definition: "to judge the quality, importance, or worth of something",
    example: "Students evaluate each answer before moving to the next question.",
    synonyms: ["assess", "judge", "review"],
    antonyms: ["neglect", "accept"]
  },
  evident: {
    partOfSpeech: "adjective",
    definition: "easy to see, notice, or understand",
    example: "Her progress was evident after a week of daily practice.",
    synonyms: ["clear", "obvious", "apparent"],
    antonyms: ["hidden", "unclear"]
  },
  expand: {
    partOfSpeech: "verb",
    definition: "to become larger or make something larger",
    example: "Reading regularly can expand a student's vocabulary.",
    synonyms: ["increase", "extend", "broaden"],
    antonyms: ["shrink", "reduce"]
  },
  formulate: {
    partOfSpeech: "verb",
    definition: "to create or express something carefully and systematically",
    example: "The group worked together to formulate a fair policy.",
    synonyms: ["develop", "compose", "design"],
    antonyms: ["improvise", "abandon"]
  },
  fundamental: {
    partOfSpeech: "adjective",
    definition: "basic, central, and necessary",
    example: "Understanding context is fundamental to learning vocabulary.",
    synonyms: ["basic", "essential", "primary"],
    antonyms: ["secondary", "minor"]
  },
  illustrate: {
    partOfSpeech: "verb",
    definition: "to explain or make clear by using examples, pictures, or details",
    example: "The teacher used a story to illustrate the meaning of the word.",
    synonyms: ["explain", "demonstrate", "clarify"],
    antonyms: ["confuse", "obscure"]
  },
  imply: {
    partOfSpeech: "verb",
    definition: "to suggest something without saying it directly",
    example: "The ending may imply that the character has changed.",
    synonyms: ["suggest", "hint", "indicate"],
    antonyms: ["state", "declare"]
  },
  inconsistent: {
    partOfSpeech: "adjective",
    definition: "not staying the same in behavior, quality, or logic",
    example: "Inconsistent practice made the quiz scores rise and fall.",
    synonyms: ["uneven", "contradictory", "irregular"],
    antonyms: ["consistent", "steady"]
  },
  infer: {
    partOfSpeech: "verb",
    definition: "to reach a conclusion using evidence and reasoning",
    example: "Readers can infer the word's meaning from nearby clues.",
    synonyms: ["deduce", "conclude", "reason"],
    antonyms: ["misread", "guess"]
  },
  innovation: {
    partOfSpeech: "noun",
    definition: "a new idea, method, or product",
    example: "The app was an innovation in the way students reviewed vocabulary.",
    synonyms: ["invention", "advance", "breakthrough"],
    antonyms: ["tradition", "routine"]
  },
  integrate: {
    partOfSpeech: "verb",
    definition: "to combine parts so they work together as a whole",
    example: "The platform integrates flashcards, quizzes, and progress tracking.",
    synonyms: ["combine", "merge", "unify"],
    antonyms: ["separate", "divide"]
  },
  interpret: {
    partOfSpeech: "verb",
    definition: "to explain the meaning of something",
    example: "Students interpret unfamiliar words by studying the sentence around them.",
    synonyms: ["explain", "understand", "translate"],
    antonyms: ["misunderstand", "confuse"]
  },
  justify: {
    partOfSpeech: "verb",
    definition: "to give good reasons or evidence for an action or belief",
    example: "A strong answer can justify its choice with details from the text.",
    synonyms: ["defend", "support", "explain"],
    antonyms: ["contradict", "disprove"]
  },
  nuance: {
    partOfSpeech: "noun",
    definition: "a small, subtle difference in meaning, feeling, or expression",
    example: "Synonym questions help learners notice nuance between similar words.",
    synonyms: ["subtlety", "shade", "distinction"],
    antonyms: ["obviousness", "simplicity"]
  },
  objective: {
    partOfSpeech: "adjective",
    definition: "based on facts rather than personal feelings",
    example: "The rubric gave students an objective way to judge their answers.",
    synonyms: ["fair", "impartial", "factual"],
    antonyms: ["biased", "subjective"]
  },
  persist: {
    partOfSpeech: "verb",
    definition: "to continue firmly despite difficulty or delay",
    example: "Learners who persist often remember difficult words longer.",
    synonyms: ["continue", "endure", "persevere"],
    antonyms: ["quit", "stop"]
  },
  precise: {
    partOfSpeech: "adjective",
    definition: "exact and carefully stated",
    example: "A precise definition prevents confusion during a quiz.",
    synonyms: ["exact", "specific", "accurate"],
    antonyms: ["vague", "rough"]
  },
  prominent: {
    partOfSpeech: "adjective",
    definition: "important, noticeable, or well known",
    example: "Several prominent themes appeared throughout the chapter.",
    synonyms: ["noticeable", "major", "leading"],
    antonyms: ["minor", "hidden"]
  },
  refine: {
    partOfSpeech: "verb",
    definition: "to improve something by making small careful changes",
    example: "The student revised the sentence to refine its meaning.",
    synonyms: ["improve", "polish", "adjust"],
    antonyms: ["damage", "worsen"]
  },
  relevant: {
    partOfSpeech: "adjective",
    definition: "closely connected to the topic or situation",
    example: "The most relevant example came from the student's own experience.",
    synonyms: ["related", "applicable", "connected"],
    antonyms: ["irrelevant", "unrelated"]
  },
  resilient: {
    partOfSpeech: "adjective",
    definition: "able to recover quickly from difficulty or change",
    example: "A resilient learner treats mistakes as useful feedback.",
    synonyms: ["strong", "flexible", "tough"],
    antonyms: ["fragile", "weak"]
  },
  significant: {
    partOfSpeech: "adjective",
    definition: "important enough to be noticed or have an effect",
    example: "Daily review made a significant difference in retention.",
    synonyms: ["important", "meaningful", "notable"],
    antonyms: ["minor", "trivial"]
  },
  subtle: {
    partOfSpeech: "adjective",
    definition: "not obvious; difficult to notice or understand",
    example: "The two words have a subtle difference in tone.",
    synonyms: ["slight", "delicate", "faint"],
    antonyms: ["obvious", "clear"]
  },
  synthesize: {
    partOfSpeech: "verb",
    definition: "to combine ideas or information into a new whole",
    example: "The final essay asked students to synthesize evidence from three sources.",
    synonyms: ["combine", "blend", "integrate"],
    antonyms: ["separate", "divide"]
  },
  valid: {
    partOfSpeech: "adjective",
    definition: "reasonable, logical, or legally acceptable",
    example: "A valid explanation must match the evidence in the text.",
    synonyms: ["sound", "reasonable", "acceptable"],
    antonyms: ["invalid", "flawed"]
  },
  verify: {
    partOfSpeech: "verb",
    definition: "to check or prove that something is true or accurate",
    example: "The learner used the example sentence to verify the meaning.",
    synonyms: ["confirm", "check", "prove"],
    antonyms: ["disprove", "question"]
  }
};
