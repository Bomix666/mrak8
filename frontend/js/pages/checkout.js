import { getCart, clearCart, syncCart } from '../state/cart.js';
import { createOrder } from '../services/orders.js';
import { confirmTestPayment } from '../services/payments.js';
import { ApiError } from '../services/apiClient.js';
import { navigate } from '../router.js';
import { formatPrice, esc } from '../utils/format.js';
import { STATIC_MODE } from '../config.js';
import { buzz, drawPath, printLines, sealSVG, shake, signPath, slam } from '../utils/fx.js';

const META = { title: 'Протокол — MRAK8', description: '' };
const toCents = (decimal) => Math.round(parseFloat(decimal) * 100);

// name -> [label, input attributes]. `shipping.*` fields are nested in the
// payload the same way the API expects them. Patterns mirror the server's
// validators; browsers compile them with the regex `v` flag, which is why
// the brackets inside the character class are escaped.
const FIELDS = {
  email: ['E-mail', 'type="email" autocomplete="email" inputmode="email" required'],
  phone: ['Телефон', 'type="tel" autocomplete="tel" inputmode="tel" placeholder="+7 900 000-00-00" required pattern="\\+?[0-9\\(\\)\\-\\s]{7,20}"'],
  first_name: ['Имя', 'type="text" autocomplete="given-name" maxlength="60" required'],
  last_name: ['Фамилия', 'type="text" autocomplete="family-name" maxlength="60" required'],
  city: ['Город', 'type="text" autocomplete="address-level2" maxlength="80" required'],
  address_line: ['Адрес', 'type="text" autocomplete="street-address" maxlength="200" placeholder="Улица, дом, квартира" required'],
  postal_code: ['Индекс', 'type="text" autocomplete="postal-code" inputmode="numeric" maxlength="12" required pattern="[A-Za-z0-9\\-\\s]{3,12}"'],
  country: ['Страна', 'type="text" autocomplete="country-name" maxlength="60" value="Россия" required'],
};
const SHIPPING_FIELDS = ['city', 'address_line', 'postal_code', 'country'];

function field(name) {
  const [label, attrs] = FIELDS[name];
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" ${attrs} aria-describedby="err-${name}" />
      <span class="field-error" id="err-${name}" data-error-for="${name}"></span>
    </label>`;
}

function localMessage(input) {
  const { validity } = input;
  if (validity.valueMissing) return 'Обязательно.';
  if (validity.typeMismatch) return 'Проверьте адрес e-mail.';
  if (validity.patternMismatch) return input.name === 'phone' ? 'Введите номер в формате +7 900 000-00-00.' : 'Проверьте значение.';
  return '';
}

function summary(cart) {
  return `
    <aside class="checkout-summary" aria-label="Опись изъятого">
      <h2 class="t-h3">Опись изъятого</h2>
      ${cart.notice ? `<p class="cart-notice" role="status">${esc(cart.notice)}</p>` : ''}
      <ul class="checkout-items">
        ${cart.items.map((item) => `
          <li class="checkout-item">
            <span class="checkout-item-media">${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy" />` : ''}</span>
            <span class="checkout-item-info">
              <span>${esc(item.name)}</span>
              <span class="mono">${esc(item.color)} / ${esc(item.size)} × ${item.qty}</span>
            </span>
            <span>${formatPrice(item.price * item.qty)}</span>
          </li>`).join('')}
      </ul>
      <dl class="checkout-totals">
        <div><dt>Товары</dt><dd>${formatPrice(cart.total)}</dd></div>
        <div><dt>Доставка</dt><dd>рассчитывается при отправке</dd></div>
        <div class="checkout-total"><dt>Итого</dt><dd>${formatPrice(cart.total)}</dd></div>
      </dl>
      <p class="mono">Цена и наличие проверяются сервером в момент оформления.</p>
    </aside>`;
}

export async function render(view) {
  if (STATIC_MODE) {
    view.innerHTML = `
      <section class="state" data-theme="paper">
        <p class="mono">Оформление заказа</p>
        <h1>Это витрина</h1>
        <p>Здесь можно посмотреть вещи и собрать корзину. Оформление заказа на этой версии сайта отключено.</p>
        <a class="link" href="/shop/">В магазин</a>
      </section>`;
    return META;
  }

  await syncCart(); // show current prices and stock, not what a stale tab remembered
  const cart = getCart();

  if (cart.items.length === 0) {
    view.innerHTML = `
      <section class="state" data-theme="paper">
        <p class="mono">Оформление заказа</p>
        <h1>Изъятых вещей нет</h1>
        <p>Протокол составлять не на что. Подозрительно.</p>
        ${cart.notice ? `<p>${esc(cart.notice)}</p>` : ''}
        <a class="link" href="/shop/">В магазин</a>
      </section>`;
    return META;
  }

  view.innerHTML = `
    <div data-theme="paper">
      <section class="checkout page-top">
        <div class="checkout-main">
          <p class="mono protocol-no">Форма № — присваивается при оформлении</p>
          <h1 class="t-h2">Протокол</h1>

          <form data-checkout-form novalidate>
            <fieldset>
              <legend class="mono">01 / Субъект</legend>
              ${field('email')}
              ${field('phone')}
            </fieldset>

            <fieldset>
              <legend class="mono">02 / Доставка</legend>
              <div class="field-row">${field('first_name')}${field('last_name')}</div>
              ${field('city')}
              ${field('address_line')}
              <div class="field-row">${field('postal_code')}${field('country')}</div>
            </fieldset>

            <div class="sign" aria-hidden="true">
              <div class="sign-box">
                <svg viewBox="0 0 240 62" preserveAspectRatio="none"><path data-sign d="" /></svg>
              </div>
              <div class="sign-label mono"><span>Подпись субъекта</span><span data-sign-name>—</span></div>
              <span class="sign-mp mono">М.П.</span>
            </div>

            <p class="form-error" data-form-error role="alert"></p>
            <button type="submit" class="btn btn--block" data-submit>Подписать и оформить</button>
            <p class="mono checkout-note">Оплата — на следующем шаге. До её подтверждения ничего не списывается.</p>
          </form>
        </div>
        ${summary(cart)}
      </section>
    </div>
  `;

  const form = view.querySelector('[data-checkout-form]');
  const formError = view.querySelector('[data-form-error]');
  const submitBtn = view.querySelector('[data-submit]');

  function setError(name, message) {
    const input = form.elements[name];
    const slot = form.querySelector(`[data-error-for="${name}"]`);
    if (!input || !slot) return false;
    slot.textContent = message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    return true;
  }

  // The signature draws itself once the subject has given a full name.
  const signEl = form.querySelector('[data-sign]');
  const signName = form.querySelector('[data-sign-name]');
  let signedAs = '';
  function sign() {
    const name = `${form.elements.first_name.value.trim()} ${form.elements.last_name.value.trim()}`.trim();
    if (!form.elements.first_name.value.trim() || !form.elements.last_name.value.trim() || name === signedAs) return;
    signedAs = name;
    signName.textContent = name;
    signEl.setAttribute('d', signPath(name));
    drawPath(signEl);
  }
  ['first_name', 'last_name'].forEach((name) => form.elements[name].addEventListener('change', sign));

  Object.keys(FIELDS).forEach((name) => {
    const input = form.elements[name];
    input.addEventListener('blur', () => setError(name, localMessage(input)));
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') setError(name, localMessage(input));
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';

    const invalid = Object.keys(FIELDS).filter((name) => {
      const message = localMessage(form.elements[name]);
      setError(name, message);
      return message;
    });
    if (invalid.length) {
      formError.textContent = 'Протокол не заполнен.';
      shake(form, 6);
      buzz([10, 40, 10]);
      form.elements[invalid[0]].focus();
      return;
    }

    const value = (name) => form.elements[name].value.trim();
    const payload = {
      email: value('email'),
      phone: value('phone'),
      first_name: value('first_name'),
      last_name: value('last_name'),
      shipping: {
        first_name: value('first_name'),
        last_name: value('last_name'),
        phone: value('phone'),
        ...Object.fromEntries(SHIPPING_FIELDS.map((name) => [name, value(name)])),
      },
      // Identity and quantity only — the server decides the price.
      items: getCart().items.map((item) => ({ product_id: item.id, size: item.size, quantity: item.qty })),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Оформляем…';
    sign(); // no signature drawn yet if the name came from autofill

    try {
      const result = await createOrder(payload);
      clearCart();
      renderPaymentStep(view, result, payload.email);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Подписать и оформить';
      showServerErrors(err);
    }
  });

  function showServerErrors(err) {
    const data = err instanceof ApiError ? err.payload : null;
    if (!data || typeof data !== 'object') {
      formError.textContent = err.message || 'Не удалось оформить заказ. Попробуйте ещё раз.';
      return;
    }

    // Field errors go next to their fields; everything else (stock, cart)
    // is shown above the button.
    const general = [];
    const firstOf = (messages) => (Array.isArray(messages) ? messages.join(' ') : String(messages));
    Object.entries({ ...data, ...(data.shipping || {}) }).forEach(([name, messages]) => {
      if (name === 'shipping') return;
      if (!setError(name, firstOf(messages))) general.push(firstOf(messages));
    });
    if (data.items) syncCart(); // stock changed under us — bring the cart in step
    formError.textContent = general.join(' ');
    form.querySelector('[aria-invalid="true"]')?.focus();
  }

  return META;
}

function renderPaymentStep(view, result, email) {
  const { order, payment } = result;
  const statusPath = `/order/${encodeURIComponent(order.order_number)}/?email=${encodeURIComponent(email)}`;

  if (payment.payment_url) {
    // Real provider — send the shopper to the hosted payment page.
    window.location.href = payment.payment_url;
    return;
  }

  // No hosted payment page. The "confirm" control below exists only when
  // the backend runs its development provider with DEBUG on (it sends
  // test_confirm_endpoint then, and 404s the endpoint otherwise).
  const canTestConfirm = Boolean(payment.test_confirm_endpoint);

  const date = new Date(order.created_at || Date.now()).toLocaleString('ru-RU');
  const count = order.items.reduce((n, item) => n + item.quantity, 0);

  view.innerHTML = `
    <section class="state booked" data-theme="paper">
      <div class="booked-form" data-booked>
        <p class="mono">Форма № ${esc(order.order_number)}</p>
        <h1>Протокол составлен</h1>
        <p>Номер и e-mail понадобятся, чтобы открыть досье заказа.</p>
        <div class="booked-mp mono"><span>М.П.</span><div class="booked-seal">${sealSVG('MRAK8 ✶ CENTRAL BOOKING & INTAKE CENTER ✶ ', 'ДЕЖУРНЫЙ')}</div></div>
      </div>

      <div class="receipt" aria-label="Квитанция">
        <p class="receipt-head">Квитанция об изъятии</p>
        <p><span>Форма №</span><b>${esc(order.order_number)}</b></p>
        <p><span>Дата</span><b>${esc(date)}</b></p>
        ${order.items.map((item) => `<p><span>${esc(item.product_name)} · ${item.size === 'OS' ? 'one size' : esc(item.size)} × ${item.quantity}</span><b>${formatPrice(toCents(item.line_total))}</b></p>`).join('')}
        <p><span>Предметов</span><b>${count}</b></p>
        <p class="receipt-total"><span>Итого</span><b>${formatPrice(toCents(order.total))}</b></p>
        <p><span>Статус</span><b>Ожидает оплаты</b></p>
      </div>

      ${canTestConfirm ? `
        <p class="mono">Режим разработки: платёжный провайдер не подключён.</p>
        <button class="btn" data-test-confirm>Подтвердить тестовую оплату</button>
        <p class="form-error" data-payment-error role="alert"></p>` : ''}
      <a class="link" href="${esc(statusPath)}">Досье заказа</a>
    </section>
  `;
  window.scrollTo(0, 0);

  // The stamp lands on «М.П.», then the receipt prints line by line.
  slam(view.querySelector('[data-booked]'), 'Принят', { sub: `ФОРМА № ${order.order_number}`, rot: -11, cls: 'stamp--mp' })
    .then(() => printLines([...view.querySelectorAll('.receipt > *')]));

  view.querySelector('[data-test-confirm]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Подтверждаем…';
    try {
      await confirmTestPayment(payment.payment_id);
      navigate(statusPath);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Подтвердить тестовую оплату';
      view.querySelector('[data-payment-error]').textContent = 'Не удалось подтвердить оплату. Попробуйте ещё раз.';
    }
  });
}
