import {
  appState,
  currentLesson,
  persist,
  notifyStateChange,
  updateReview,
  resetLeechStatus,
  updateTermSimplified,
  getSrsStatusText,
  dueTerms,
  masteryPercent,
  latestStreak,
  deleteCurrentTerm
} from "./state-manager.js";
import {
  dom,
  checkedLessonIds,
  switchView,
  renderAll,
  showToast,
  showLoading,
  hideLoading,
  escapeHtml,
  clamp,
  shuffle
} from "./ui-shared.js";
import { simplifyTerm } from "./api.js";

export function initFlashcards() {
  if (dom.flashcard) {
    dom.flashcard.addEventListener("click", event => {
      // Don't flip when clicking buttons inside the back face
      if (event.target.closest("button") || event.target.closest("a")) return;
      appState.cardFlipped = !appState.cardFlipped;
      renderAll();
    });
  }

  if (dom.prevCard) dom.prevCard.addEventListener("click", () => moveCard(-1));
  if (dom.nextCard) dom.nextCard.addEventListener("click", () => moveCard(1));
  if (dom.shuffleCards) dom.shuffleCards.addEventListener("click", shuffleCards);
  
  if (dom.learnedCard) {
    // Flipped to rate
    dom.learnedCard.addEventListener("click", () => {
      appState.cardFlipped = true;
      renderAll();
    });
  }

  // Rate buttons click events
  const rateAgainBtn = document.getElementById("rate-again-btn");
  const rateGoodBtn = document.getElementById("rate-good-btn");
  const rateEasyBtn = document.getElementById("rate-easy-btn");

  if (rateAgainBtn) {
    rateAgainBtn.addEventListener("click", () => {
      const term = getCurrentStudyTerm();
      if (term) {
        updateReview(term.id, false, "again");
        // Append card again to the end of current session queue
        if (appState.studyTerms) {
          appState.studyTerms.push(term);
        }
        showToast(`Mistake! The word "${term.word}" will appear again later.`, "info");
        appState.cardFlipped = false;
        
        // Move to next card
        const termsCount = appState.studyTerms ? appState.studyTerms.length : 0;
        if (appState.state.activeIndex < termsCount - 1) {
          appState.state.activeIndex += 1;
        }
        persist();
        renderAll();
      }
    });
  }

  if (rateGoodBtn) {
    rateGoodBtn.addEventListener("click", () => {
      const term = getCurrentStudyTerm();
      if (term) {
        updateReview(term.id, true, "good");
        showToast("Word successfully marked as learned.", "success");
        appState.cardFlipped = false;
        
        // Move to next card
        const termsCount = appState.studyTerms ? appState.studyTerms.length : 0;
        if (appState.state.activeIndex < termsCount - 1) {
          appState.state.activeIndex += 1;
        } else {
          showToast("Well done! You have completed all words in this session.", "success");
        }
        persist();
        renderAll();
      }
    });
  }

  if (rateEasyBtn) {
    rateEasyBtn.addEventListener("click", () => {
      const term = getCurrentStudyTerm();
      if (term) {
        updateReview(term.id, true, "easy");
        showToast("Word scheduled for easy review (longer interval).", "success");
        appState.cardFlipped = false;
        
        // Move to next card
        const termsCount = appState.studyTerms ? appState.studyTerms.length : 0;
        if (appState.state.activeIndex < termsCount - 1) {
          appState.state.activeIndex += 1;
        } else {
          showToast("Well done! You have completed all words in this session.", "success");
        }
        persist();
        renderAll();
      }
    });
  }

  if (dom.deleteCard) {
    dom.deleteCard.addEventListener("click", () => {
      const term = getCurrentStudyTerm();
      if (term && confirm(`Are you sure you want to delete "${term.word}"?`)) {
        // Remove from session queue
        if (appState.studyTerms) {
          appState.studyTerms.splice(appState.state.activeIndex, 1);
        }
        deleteCurrentTerm();
        showToast("Card deleted.", "info");
      }
    });
  }

  if (dom.speakCard) {
    dom.speakCard.addEventListener("click", speakCurrentWord);
  }

  // Leech controls event listeners
  const resetLeechBtn = document.getElementById("reset-leech-btn");
  const simplifyAiBtn = document.getElementById("simplify-ai-btn");

  if (resetLeechBtn) {
    resetLeechBtn.addEventListener("click", () => {
      const term = getCurrentStudyTerm();
      if (term) {
        resetLeechStatus(term.id);
        // Sync item in session queue
        const sessionTerm = appState.studyTerms?.find(t => t.id === term.id);
        if (sessionTerm) {
          sessionTerm.isLeech = false;
          sessionTerm.mistakeCount = 0;
        }
        showToast("Word mistakes reset and removed from hard words.", "success");
        renderAll();
      }
    });
  }

  if (simplifyAiBtn) {
    simplifyAiBtn.addEventListener("click", () => {
      const term = getCurrentStudyTerm();
      if (term) {
        const isAi = (appState.state?.settings?.engineMode || "ai") === "ai";
        if (!isAi) {
          showToast("AI simplification requires AI Engine to be active. Enable it in Settings.", "error");
          return;
        }
        showLoading("Simplifying Word with AI", "Calling Gemini to simplify definition, example, and generate mnemonic...");
        simplifyTerm(term)
          .then(data => {
            updateTermSimplified(term.id, data);
            
            // Sync item in session queue
            const sessionTerm = appState.studyTerms?.find(t => t.id === term.id);
            if (sessionTerm) {
              sessionTerm.definition = data.definition;
              sessionTerm.example = data.example;
              sessionTerm.mnemonic = data.mnemonic;
            }
            
            hideLoading();
            showToast("Word successfully simplified by AI!", "success");
            renderAll();
          })
          .catch(err => {
            hideLoading();
            showToast(err.message, "error");
          });
      }
    });
  }

  // Event listener for mixed flashcard trigger
  if (dom.startMixedFlashcardsBtn) {
    dom.startMixedFlashcardsBtn.addEventListener("click", triggerMixedFlashcards);
  }
}

export function getCurrentStudyTerm() {
  if (!appState.studyTerms) {
    appState.studyTerms = (appState.isMixedStudyMode && appState.mixedTerms)
      ? [...appState.mixedTerms]
      : (currentLesson() ? [...(currentLesson().terms || [])] : []);
  }
  return appState.studyTerms[appState.state.activeIndex] || null;
}

export function renderFlashcard() {
  const term = getCurrentStudyTerm();
  const total = appState.studyTerms ? appState.studyTerms.length : 0;
  const position = total ? appState.state.activeIndex + 1 : 0;

  if (dom.flashcard) {
    dom.flashcard.classList.toggle("flipped", appState.cardFlipped);
  }
  if (dom.cardPosition) {
    dom.cardPosition.textContent = `${position} of ${total}`;
  }
  if (dom.cardProgressBar) {
    dom.cardProgressBar.style.width = total ? `${(position / total) * 100}%` : "0%";
  }

  // Setup rating buttons visibility
  const ratingBtnContainer = document.getElementById("rating-buttons-container");
  if (ratingBtnContainer && dom.learnedCard) {
    if (appState.cardFlipped && term) {
      ratingBtnContainer.classList.remove("hidden");
      dom.learnedCard.classList.add("hidden");
    } else {
      ratingBtnContainer.classList.add("hidden");
      dom.learnedCard.classList.remove("hidden");
    }
  }

  const innerCard = dom.flashcard?.querySelector(".flashcard-inner");
  const srsBadge = document.getElementById("card-srs-status");

  if (!term) {
    if (dom.cardDifficulty) dom.cardDifficulty.textContent = "Ready";
    if (dom.cardWord) {
      dom.cardWord.textContent = "No words yet";
      dom.cardWord.classList.remove("phrase-word");
    }
    if (dom.cardPos) dom.cardPos.textContent = "part of speech";
    if (dom.cardDefinition) dom.cardDefinition.textContent = "Generate a study set to begin.";
    if (dom.cardExample) dom.cardExample.textContent = "";
    if (dom.cardArabic) {
      dom.cardArabic.textContent = "";
      dom.cardArabic.classList.add("hidden");
    }
    if (dom.cardBreakdown) {
      dom.cardBreakdown.innerHTML = "";
      dom.cardBreakdown.classList.add("hidden");
    }
    if (dom.cardRelated) dom.cardRelated.innerHTML = "";
    if (dom.learnedCard) dom.learnedCard.textContent = "Rate Card";
    if (dom.deleteCard) dom.deleteCard.disabled = true;
    if (dom.masteryPercent) dom.masteryPercent.textContent = "0%";
    if (dom.currentStreak) dom.currentStreak.textContent = "0";
    if (dom.reviewQueue) dom.reviewQueue.textContent = "0";
    
    if (innerCard) {
      innerCard.classList.remove("border-red-500", "ring-2", "ring-red-500/50");
    }
    const leechBadge = document.getElementById("card-leech-badge");
    if (leechBadge) leechBadge.remove();

    // Hide Leech controls
    const leechControls = document.getElementById("leech-controls-container");
    if (leechControls) leechControls.classList.add("hidden");
    const mnemonicContainer = document.getElementById("card-mnemonic-container");
    if (mnemonicContainer) mnemonicContainer.classList.add("hidden");
    return;
  }

  if (dom.cardDifficulty) dom.cardDifficulty.textContent = term.difficulty;
  
  // Show 🔥 icon if Leech
  if (dom.cardWord) {
    const fireMarkup = term.isLeech ? ' <span class="text-red-500 animate-pulse" title="Word is a Leech! 🔥">🔥</span>' : '';
    dom.cardWord.innerHTML = escapeHtml(term.word) + fireMarkup;
    dom.cardWord.classList.toggle("phrase-word", term.word.length > 24 || term.word.split(/\s+/).length > 3);
  }
  
  if (dom.cardPos) dom.cardPos.textContent = term.partOfSpeech;
  
  const cardArticleContainer = document.getElementById("card-article-container");
  const cardArticle = document.getElementById("card-article");
  if (cardArticle && cardArticleContainer) {
    if (term.article) {
      cardArticle.textContent = term.article;
      cardArticleContainer.classList.remove("hidden");
    } else {
      cardArticleContainer.classList.add("hidden");
    }
  }

  if (dom.cardDefinition) dom.cardDefinition.textContent = term.definition;
  if (dom.cardExample) dom.cardExample.textContent = term.example;
  
  if (dom.cardArabic) {
    dom.cardArabic.textContent = term.arabic || "";
    if (term.arabic) {
      dom.cardArabic.classList.remove("hidden");
    } else {
      dom.cardArabic.classList.add("hidden");
    }
  }

  if (dom.cardBreakdown) {
    dom.cardBreakdown.innerHTML = renderBreakdown(term.breakdown);
    if (term.breakdown?.length) {
      dom.cardBreakdown.classList.remove("hidden");
    } else {
      dom.cardBreakdown.classList.add("hidden");
    }
  }
  
  if (dom.cardRelated) dom.cardRelated.innerHTML = relatedChips(term);
  if (dom.deleteCard) dom.deleteCard.disabled = false;

  // Render Spaced Repetition Badge on Flashcard (front & back)
  const srsBadgeBack = document.getElementById("card-srs-status-back");
  if (srsBadge) {
    const srs = getSrsStatusText(term);
    srsBadge.textContent = srs.text;
    srsBadge.className = `px-2 py-0.5 text-xs font-semibold rounded-full ${srs.style}`;
  }
  if (srsBadgeBack) {
    const srs = getSrsStatusText(term);
    srsBadgeBack.textContent = srs.text;
    srsBadgeBack.className = `px-2 py-0.5 text-xs font-semibold rounded-full ${srs.style}`;
  }

  // Leech Visual Warning Styling (red border/ring and badge)
  if (innerCard) {
    if (term.isLeech) {
      innerCard.classList.add("border-red-500", "ring-2", "ring-red-500/50");
      
      // Append leech badge next to srs badge on front
      if (srsBadge && !document.getElementById("card-leech-badge-front")) {
        const leechBadge = document.createElement("span");
        leechBadge.id = "card-leech-badge-front";
        leechBadge.className = "px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-955/40 dark:text-red-400 animate-pulse";
        leechBadge.innerHTML = "⚠️ Leech";
        srsBadge.insertAdjacentElement("beforebegin", leechBadge);
      }

      // Append leech badge next to srs badge on back
      if (srsBadgeBack && !document.getElementById("card-leech-badge-back")) {
        const leechBadge = document.createElement("span");
        leechBadge.id = "card-leech-badge-back";
        leechBadge.className = "px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-955/40 dark:text-red-400 animate-pulse";
        leechBadge.innerHTML = "⚠️ Leech";
        srsBadgeBack.insertAdjacentElement("beforebegin", leechBadge);
      }
    } else {
      innerCard.classList.remove("border-red-500", "ring-2", "ring-red-500/50");
      const leechBadgeFront = document.getElementById("card-leech-badge-front");
      if (leechBadgeFront) leechBadgeFront.remove();
      const leechBadgeBack = document.getElementById("card-leech-badge-back");
      if (leechBadgeBack) leechBadgeBack.remove();
      const oldLeechBadge = document.getElementById("card-leech-badge");
      if (oldLeechBadge) oldLeechBadge.remove();
    }
  }

  // Leech controls and Mnemonic displaying on back card face
  const leechControls = document.getElementById("leech-controls-container");
  if (leechControls) {
    if (term.isLeech) {
      leechControls.classList.remove("hidden");
    } else {
      leechControls.classList.add("hidden");
    }
  }

  const mnemonicContainer = document.getElementById("card-mnemonic-container");
  const mnemonicTxt = document.getElementById("card-mnemonic");
  if (mnemonicContainer && mnemonicTxt) {
    if (term.mnemonic) {
      mnemonicTxt.textContent = term.mnemonic;
      mnemonicContainer.classList.remove("hidden");
    } else {
      mnemonicContainer.classList.add("hidden");
    }
  }

  const mastery = masteryPercent();
  if (dom.masteryPercent) dom.masteryPercent.textContent = `${mastery}%`;
  if (dom.currentStreak) dom.currentStreak.textContent = latestStreak();
  if (dom.reviewQueue) dom.reviewQueue.textContent = dueTerms().length;
}

export function moveCard(step) {
  const terms = appState.studyTerms || [];
  if (!terms.length) return;
  appState.state.activeIndex = clamp(appState.state.activeIndex + step, 0, terms.length - 1);
  appState.cardFlipped = false;
  persist();
  renderAll();
}

export function shuffleCards() {
  if (appState.studyTerms) {
    appState.studyTerms = shuffle(appState.studyTerms);
  }
  appState.state.activeIndex = 0;
  appState.cardFlipped = false;
  persist();
  renderAll();
}

function speakCurrentWord() {
  const term = getCurrentStudyTerm();
  if (!term || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(term.word);
  const nav = appState.state.currentNavigation;
  if (nav.languageId) {
    const lang = appState.state.languages.find(l => l.id === nav.languageId);
    if (lang) {
      const name = lang.name.toLowerCase();
      if (name.includes("french")) utterance.lang = "fr-FR";
      else if (name.includes("german")) utterance.lang = "de-DE";
      else if (name.includes("spanish")) utterance.lang = "es-ES";
      else if (name.includes("arabic")) utterance.lang = "ar-SA";
      else utterance.lang = "en-US";
    }
  }
  window.speechSynthesis.speak(utterance);
}

export function triggerMixedFlashcards() {
  if (!checkedLessonIds.length) {
    showToast("Please select at least one lesson first.", "error");
    return;
  }
  const mixed = [];
  appState.state.languages.forEach(l => {
    l.units.forEach(u => {
      u.lessons.forEach(ls => {
        if (checkedLessonIds.includes(ls.id)) {
          mixed.push(...(ls.terms || []));
        }
      });
    });
  });
  
  if (!mixed.length) {
    showToast("Selected lessons have no terms.", "error");
    return;
  }
  
  appState.isMixedStudyMode = true;
  appState.mixedTerms = shuffle(mixed);
  appState.state.activeIndex = 0;
  appState.cardFlipped = false;
  appState.studyTerms = null; // force reload studyTerms
  persist();
  switchView("flashcards");
  renderAll();
}

export function triggerMixedQuiz() {
  if (!checkedLessonIds.length) {
    showToast("Please select at least one lesson first.", "error");
    return;
  }
  
  import("./quiz-engine.js").then(quizEngine => {
    if (quizEngine.quizSession) {
      quizEngine.quizSession.isMixed = true;
      quizEngine.quizSession.lessonIds = [...checkedLessonIds];
    }
    quizEngine.startMixedQuiz(checkedLessonIds, "all", {})
      .then(() => {
        switchView("quiz");
      })
      .catch(err => {
        showToast(err.message, "error");
      });
  });
}

function relatedChips(term) {
  const chips = [];
  for (const synonym of term.synonyms || []) chips.push(`Synonym: ${synonym}`);
  for (const antonym of term.antonyms || []) chips.push(`Antonym: ${antonym}`);
  return chips.slice(0, 5).map(value => `<span class="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-medium text-zinc-550 dark:text-zinc-400">${escapeHtml(value)}</span>`).join("");
}

function renderBreakdown(breakdown = []) {
  return breakdown
    .map(
      item =>
        `<div class="text-xs text-zinc-700 dark:text-zinc-300"><strong class="brand-font">${escapeHtml(item.morpheme || item.root)}</strong>: ${escapeHtml(item.meaning || item.definition)}</div>`
    )
    .join("");
}
