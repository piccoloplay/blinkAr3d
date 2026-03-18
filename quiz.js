// ══════════════════════════════════════
//  QUANTUM AR — quiz.js
//  True/False quiz engine, reads from JSON
// ══════════════════════════════════════

class Quiz {
  /**
   * @param {Object}   config
   * @param {Object}   config.data        – quiz section from level JSON
   * @param {string}   config.container   – CSS selector for quiz mount point
   * @param {Function} config.onPass      – callback when user passes
   * @param {Function} config.onFail      – callback when user fails
   */
  constructor({ data, container, onPass, onFail }) {
    this.questions = data.questions;
    this.threshold = data.pass_threshold;
    this.container = document.querySelector(container);
    this.onPass = onPass || (() => {});
    this.onFail = onFail || (() => {});
    this.answers = {};
    this.score = 0;
    this.answered = 0;
  }

  render() {
    if (!this.container) return;

    let html = '';

    this.questions.forEach((q, i) => {
      html += `
        <div class="quiz-card fade-in-up stagger-${Math.min(i + 1, 4)}" id="quiz-${q.id}">
          <p class="quiz-question">
            <span style="color:var(--neon-cyan);font-family:'Orbitron',sans-serif;font-size:0.8rem;margin-right:8px;">
              ${String(i + 1).padStart(2, '0')}
            </span>
            ${q.text}
          </p>
          <div class="quiz-buttons">
            <button class="quiz-btn quiz-btn-true" data-qid="${q.id}" data-answer="true">✓ Vero</button>
            <button class="quiz-btn quiz-btn-false" data-qid="${q.id}" data-answer="false">✗ Falso</button>
          </div>
          <div class="quiz-explanation" id="exp-${q.id}">
            ${q.explanation}
          </div>
        </div>
      `;
    });

    html += `
      <div class="quiz-result" id="quiz-result">
        <div class="quiz-score" id="quiz-score-text"></div>
        <p class="quiz-message" id="quiz-message"></p>
        <div id="quiz-result-actions"></div>
      </div>
    `;

    this.container.innerHTML = html;
    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.quiz-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleAnswer(e));
    });
  }

  handleAnswer(e) {
    const btn = e.currentTarget;
    const qid = btn.dataset.qid;
    const userAnswer = btn.dataset.answer === 'true';

    // Prevent double-answer
    if (this.answers[qid] !== undefined) return;

    const question = this.questions.find(q => q.id === qid);
    const isCorrect = userAnswer === question.answer;

    this.answers[qid] = userAnswer;
    this.answered++;
    if (isCorrect) this.score++;

    // Disable buttons for this question
    const card = document.getElementById(`quiz-${qid}`);
    card.querySelectorAll('.quiz-btn').forEach(b => b.disabled = true);

    // Highlight selected button
    btn.style.transform = 'scale(0.95)';
    if (isCorrect) {
      btn.style.background = 'rgba(0, 255, 136, 0.25)';
      btn.style.borderColor = 'var(--neon-green)';
      btn.style.boxShadow = '0 0 20px rgba(0,255,136,0.3)';
    } else {
      btn.style.background = 'rgba(255, 51, 102, 0.25)';
      btn.style.borderColor = 'var(--neon-red)';
      btn.style.boxShadow = '0 0 20px rgba(255,51,102,0.3)';
    }

    // Show explanation
    const exp = document.getElementById(`exp-${qid}`);
    exp.classList.add('visible', isCorrect ? 'quiz-correct' : 'quiz-wrong');

    // Check if all answered
    if (this.answered === this.questions.length) {
      setTimeout(() => this.showResult(), 600);
    }
  }

  showResult() {
    const passed = this.score >= this.threshold;
    const result = document.getElementById('quiz-result');
    const scoreText = document.getElementById('quiz-score-text');
    const message = document.getElementById('quiz-message');
    const actions = document.getElementById('quiz-result-actions');

    scoreText.textContent = `${this.score} / ${this.questions.length}`;
    scoreText.classList.add(passed ? 'pass' : 'fail');

    if (passed) {
      message.textContent = 'Ottimo! Hai sbloccato l\'esperienza AR.';
      actions.innerHTML = `
        <button class="btn btn-primary" id="quiz-start-ar">
          🔬 Avvia Esperienza AR
        </button>
      `;
      actions.querySelector('#quiz-start-ar').addEventListener('click', () => this.onPass());
    } else {
      message.textContent = `Servono almeno ${this.threshold} risposte corrette. Rileggi la spiegazione e riprova!`;
      actions.innerHTML = `
        <button class="btn btn-secondary" id="quiz-retry">
          ↻ Riprova il Quiz
        </button>
      `;
      actions.querySelector('#quiz-retry').addEventListener('click', () => this.retry());
      this.onFail();
    }

    result.classList.add('visible');
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  retry() {
    this.answers = {};
    this.score = 0;
    this.answered = 0;
    this.render();
    this.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
