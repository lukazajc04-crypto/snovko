import { useState } from 'react';

export default function QuizCard({ questions, onFinish }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  function choose(optionIndex) {
    if (selected !== null) return;
    setSelected(optionIndex);
    setAnswered(a => a + 1);
    if (optionIndex === question.pravilni_index) setCorrect(c => c + 1);
  }

  function next() {
    if (isLast) {
      setFinished(true);
      onFinish(correct, questions.length);
      return;
    }
    setIndex(i => i + 1);
    setSelected(null);
  }

  function restart() {
    setIndex(0);
    setSelected(null);
    setCorrect(0);
    setAnswered(0);
    setFinished(false);
  }

  if (finished) {
    const perfect = correct === questions.length;
    return (
      <div className="quiz">
        <div className="note-head">
          <h2>Kviz</h2>
        </div>
        <p className="quiz-final">
          pravilnih: {correct} / {questions.length}
        </p>
        <p className="quiz-verdict">
          {perfect ? 'Odlično, vse pravilno!' : correct >= questions.length / 2 ? 'Dobro! Še malo ponovi.' : 'Poglej kartončke in poskusi znova.'}
        </p>
        <button type="button" className="btn" onClick={restart}>
          Reši znova
        </button>
      </div>
    );
  }

  const isRight = selected === question.pravilni_index;

  return (
    <div className="quiz">
      <div className="note-head">
        <h2>Kviz</h2>
        <span className="note-counter">
          pravilnih: {correct} / {answered}
        </span>
      </div>

      <p className="quiz-step">
        vprašanje {index + 1} od {questions.length}
      </p>
      <p className="quiz-question">{question.vprasanje}</p>

      <ul className="quiz-options">
        {question.opcije.map((option, i) => {
          let state = '';
          if (selected !== null) {
            if (i === question.pravilni_index) state = 'is-correct';
            else if (i === selected) state = 'is-wrong';
          }
          return (
            <li key={i}>
              <button
                type="button"
                className={`quiz-option ${state}`}
                onClick={() => choose(i)}
                disabled={selected !== null}
                aria-pressed={selected === i}
              >
                <span className="quiz-letter" aria-hidden="true">{String.fromCharCode(97 + i)}</span>
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {selected !== null && (
        <div className="quiz-feedback" role="status">
          <p className={`quiz-explanation ${isRight ? 'is-correct' : 'is-wrong'}`}>
            {isRight ? 'Pravilno! ' : 'Ne čisto. '}
            {question.razlaga}
          </p>
          <button type="button" className="btn btn-primary" onClick={next}>
            {isLast ? 'Poglej rezultat' : 'Naslednje vprašanje →'}
          </button>
        </div>
      )}
    </div>
  );
}
