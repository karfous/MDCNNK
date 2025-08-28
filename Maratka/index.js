// Last-clicked card persistence
const LAST_CARD_KEY = "fc_lastCardId";

/*=======================
      2) Helpers
    =======================*/
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function uniqueTopics(data) {
  return Array.from(new Set(data.flatMap((q) => q.topics))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function buildTopicChips(topics) {
  const box = document.getElementById("topicChips");
  box.innerHTML = "";
  topics.forEach((t) => {
    const id = `t_${t.replace(/[^a-z0-9]/gi, "_")}`;
    const chip = document.createElement("label");
    chip.className = "chip";
    chip.innerHTML = `<input type="checkbox" id="${id}" value="${t}" aria-label="${t}"><span>${t}</span>`;
    box.appendChild(chip);
  });
  if (topics.length) {
    const helper = document.createElement("span");
    helper.className = "pill muted";
    helper.style.marginLeft = "4px";
    helper.textContent = "Filter by topic";
    box.prepend(helper);
  }
}

function cardTemplate(q) {
  const topicsHTML = q.topics
    .map((t) => `<span class="topic">${t}</span>`)
    .join("");
  const answersHTML = q.answers
    .map((a, i) => `<li data-correct="${i === q.correctIndex}">${a}</li>`)
    .join("");
  return `<article class="card" role="listitem" tabindex="0" data-id="${q.id}">
        <div class="topicRow">${topicsHTML}</div>
        <div class="q">${q.question}</div>
        <ol class="answers" type="A">${answersHTML}</ol>
        <div class="footer"><span class="muted">Tap to reveal the correct answer</span><span>#${q.id}</span></div>
      </article>`;
}

function render(data) {
  const grid = document.getElementById("grid");
  if (!data.length) {
    grid.innerHTML = "";
    document.getElementById("empty").hidden = false;
  } else {
    document.getElementById("empty").hidden = true;
    grid.innerHTML = data.map(cardTemplate).join("");
  }
  document.getElementById("count").textContent = `${data.length} question${
    data.length !== 1 ? "s" : ""
  }`;
}

function getActiveFilters() {
  const topicVals = $$("#topicChips input:checked").map((i) => i.value);
  const q = $("#search").value.trim().toLowerCase();
  const onlyIncorrect =
    document.getElementById("onlyIncorrect")?.checked || false; // <— add this
  return { topicVals, q, onlyIncorrect }; // <— include the flag
}

function applyFilters() {
  const { topicVals, q, onlyIncorrect } = getActiveFilters(); // <— include onlyIncorrect
  const incorrect = getIncorrectSet(); // <— read current set

  const filtered = QUESTIONS.filter((item) => {
    const topicOk =
      !topicVals.length || item.topics.some((t) => topicVals.includes(t));
    const textOk = !q || item.question.toLowerCase().includes(q);
    const wrongOk = !onlyIncorrect || incorrect.has(item.id); // <— gate by incorrect set
    return topicOk && textOk && wrongOk;
  });

  render(filtered);
}

/*=======================
      3) Interactions
    =======================*/
function delegate(parent, selector, type, handler) {
  parent.addEventListener(type, (e) => {
    const t = e.target.closest(selector);
    if (t && parent.contains(t)) handler(e, t);
  });
}

function setupCardReveal() {
  const grid = document.getElementById("grid");
  const toggleReveal = (el) => {
    if (el.classList.contains("revealed")) {
      el.classList.remove("revealed");
    } else {
      el.classList.add("revealed");
    }
  };
  delegate(grid, ".card", "click", (e, card) => {
    toggleReveal(card);
    setLastCardId(card.dataset.id);
  });
}

function setupFilters() {
  document
    .getElementById("topicChips")
    .addEventListener("change", applyFilters);
  document.getElementById("search").addEventListener("input", applyFilters);
  document.getElementById("clearFilters").addEventListener("click", () => {
    $$("#topicChips input").forEach((i) => (i.checked = false));
    $("#search").value = "";
    applyFilters();
  });
  document
    .getElementById("onlyIncorrect")
    ?.addEventListener("change", applyFilters);
}

/* Theme toggle */
function setTheme(mode) {
  document.documentElement.setAttribute(
    "data-theme",
    mode === "dark" ? "dark" : "light"
  );
  localStorage.setItem("fc_theme", mode);
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.textContent = mode === "dark" ? "Light mode" : "Dark side";
  }
}
function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  setTheme(current === "dark" ? "light" : "dark");
}

/*=======================
      4) Init
    =======================*/
(function init() {
  // Theme: saved preference or system default
  const saved = localStorage.getItem("fc_theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(saved || (prefersDark ? "dark" : "light"));
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  buildTopicChips(uniqueTopics(QUESTIONS));
  setupFilters();
  setupCardReveal();
  setupAnswerTracking();
  setupGoToLast();

  render(QUESTIONS);
})();

/*=======================
      5) Optional JSON import helper (commented)
    =======================*/
// window.loadQuestionsFromJSON = function(json){
//   try{
//     const data = JSON.parse(json);
//     if(!Array.isArray(data)) throw new Error('Expected an array');
//     data.forEach((q,i)=>{
//       if(!q.question || !Array.isArray(q.answers) || typeof q.correctIndex !== 'number'){
//         throw new Error(`Invalid item at index ${i}`);
//       }
//       q.topics = Array.isArray(q.topics) ? q.topics : [];
//     });
//     QUESTIONS.splice(0, QUESTIONS.length, ...data);
//     buildTopicChips(uniqueTopics(QUESTIONS));
//     applyFilters();
//   }catch(err){
//     alert('Import failed: ' + err.message);
//   }
// }
const toTopBtn = document.getElementById("toTop");
window.addEventListener("scroll", () => {
  if (
    document.body.scrollTop > 200 ||
    document.documentElement.scrollTop > 200
  ) {
    toTopBtn.style.display = "block";
  } else {
    toTopBtn.style.display = "none";
  }
});
toTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// --- Incorrect-tracking store (localStorage) ---
const INCORRECT_KEY = "fc_incorrectIds";

function getIncorrectSet() {
  try {
    const arr = JSON.parse(localStorage.getItem(INCORRECT_KEY) || "[]");
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveIncorrectSet(set) {
  localStorage.setItem(INCORRECT_KEY, JSON.stringify([...set]));
}

function addIncorrect(id) {
  const s = getIncorrectSet();
  s.add(id);
  saveIncorrectSet(s);
}

function removeIncorrect(id) {
  const s = getIncorrectSet();
  if (s.delete(id)) saveIncorrectSet(s);
}

function isIncorrect(id) {
  return getIncorrectSet().has(id);
}

// When a user taps an answer, record correct/incorrect and reveal the card
function setupAnswerTracking() {
  const grid = document.getElementById("grid");
  delegate(grid, ".answers li", "click", (e, li) => {
    const card = li.closest(".card");
    const id = Number(card.dataset.id);
    const correct = li.getAttribute("data-correct") === "true";

    if (correct) {
      removeIncorrect(id);
    } else {
      addIncorrect(id);
    }

    // Reveal for UX consistency
    card.classList.add("revealed");
    setLastCardId(card.dataset.id);
    // Re-apply filters in case "Only incorrect" is on
    // BUG applyFilters causing double revealing the card when clicking an answer
    //applyFilters();
  });
}

function setLastCardId(id) {
  localStorage.setItem(LAST_CARD_KEY, String(id));
  updateToLastVisibility();
}

function getLastCardId() {
  return localStorage.getItem(LAST_CARD_KEY);
}

function updateToLastVisibility() {
  const b = document.getElementById("toLast");
  if (!b) return;
  b.style.display = getLastCardId() ? "block" : "none";
}

function setupGoToLast() {
  const btn = document.getElementById("toLast");
  if (!btn) return;

  updateToLastVisibility(); // show/hide based on saved state

  btn.addEventListener("click", () => {
    const id = getLastCardId();
    if (!id) return;

    const q = (s) => document.querySelector(s);
    const findCard = () =>
      q(`.card[data-id="${window.CSS && CSS.escape ? CSS.escape(id) : id}"]`);

    let el = findCard();

    // If the card isn't rendered (filtered out), clear filters then re-render
    if (!el) {
      // Clear topic filters
      Array.from(document.querySelectorAll("#topicChips input")).forEach(
        (i) => (i.checked = false)
      );
      // Clear search
      const search = q("#search");
      if (search) search.value = "";
      // Clear "only incorrect" if present
      const onlyInc = q("#onlyIncorrect");
      if (onlyInc) onlyInc.checked = false;
      // Re-apply
      if (typeof applyFilters === "function") applyFilters();
      el = findCard();
    }

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1200);
      if (el.focus) el.focus();
    }
  });
}
