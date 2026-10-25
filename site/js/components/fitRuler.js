import { buzz } from '../utils/fx.js';

// The mini app's height chart becomes a tape measure for one-size beanies:
// nothing to choose, just the beanie's own measurements against the
// subject's head. Only real numbers from the admin are shown — no promise
// about how far the knit stretches until the owner gives one.

const FROM = 40;
const TO = 64;
const STORE = 'mrak8:head-cm';

function remembered() {
  try {
    const v = Number(localStorage.getItem(STORE));
    return v >= FROM && v <= TO ? v : null;
  } catch {
    return null;
  }
}

function remember(v) {
  try {
    localStorage.setItem(STORE, String(v));
  } catch {
    /* private mode — the ruler still works for this visit */
  }
}

const frac = (cm) => (cm - FROM) / (TO - FROM);
const at = (cm) => `${frac(cm) * 100}%`;
// The range thumb is 44px wide, so its centre travels 22px in from each end.
const onTrack = (cm) => `calc(22px + (100% - 44px) * ${frac(cm)})`;

export function mountFitRuler(container, { circumference_cm: hat, height_cm: height }) {
  let head = remembered() ?? 56;
  const labels = [];
  for (let cm = FROM; cm <= TO; cm += 4) labels.push(`<span style="left:${at(cm)}">${cm}</span>`);

  container.innerHTML = `
    <section class="fit" aria-labelledby="fit-title">
      <p class="fit-kicker mono" id="fit-title">Посадка · обхват головы</p>
      <div class="fit-tape">
        <div class="fit-ticks" aria-hidden="true">${labels.join('')}</div>
        <span class="fit-hat" style="left:${onTrack(hat)}" aria-hidden="true"><i></i>Шапка ${hat}</span>
        <input class="fit-range" type="range" min="${FROM}" max="${TO}" step="1" value="${head}"
          aria-label="Ваш обхват головы, сантиметров" aria-describedby="fit-read" />
      </div>
      <p class="fit-read mono" id="fit-read" aria-live="polite"></p>
      <p class="fit-note">
        One size. В разложенном виде окружность ${hat} см${height ? `, высота ${height} см` : ''}.
        Измерьте голову лентой по лбу и затылку и отметьте на линейке.
      </p>
    </section>`;

  const range = container.querySelector('.fit-range');
  const read = container.querySelector('#fit-read');

  function paint() {
    const diff = head - hat;
    read.textContent = `Ваш обхват: ${head} см · ${diff >= 0 ? '+' : '−'}${Math.abs(diff)} см к окружности шапки без растяжения`;
  }

  range.addEventListener('input', () => {
    head = Number(range.value);
    buzz(4); // the marker clicks onto each centimetre
    paint();
  });
  range.addEventListener('change', () => remember(head));
  paint();
}
