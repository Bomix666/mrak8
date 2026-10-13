import { navigate } from '../router.js';

// Service pages. The shipping and contact terms are the store's existing
// policy, carried over as written — change the wording here if the policy
// changes.
const CONTENT = {
  account: {
    label: 'Статус заказа',
    title: 'Мой заказ',
    description: 'Статус заказа MRAK8 по номеру и e-mail.',
    body: `<p>Аккаунт для покупки не нужен. Чтобы посмотреть заказ, введите его номер и e-mail, указанный при оформлении.</p>
           <form data-order-lookup class="lookup-form" novalidate>
             <label class="field"><span>Номер заказа</span>
               <input type="text" name="orderNumber" placeholder="MRAK8-XXXXXX" autocomplete="off" autocapitalize="characters" required /></label>
             <label class="field"><span>E-mail</span>
               <input type="email" name="email" autocomplete="email" inputmode="email" required /></label>
             <p class="form-error" data-lookup-error role="alert"></p>
             <button type="submit" class="btn">Показать заказ</button>
           </form>`,
  },
  shipping: {
    label: 'Покупателю',
    title: 'Доставка и возврат',
    description: 'Условия доставки и возврата заказов MRAK8.',
    body: `<p>Заказы отправляются в течение 3–5 дней после закрытия дропа, из одной точки. Ускоренной отправки нет: заказы уходят в том порядке, в котором были оформлены.</p>
           <p>После отправки трек-номер приходит на e-mail, указанный при оформлении. Статус заказа в любой момент можно проверить на странице <a href="/account/">«Мой заказ»</a>.</p>
           <p>Продажа финальная: без рестока и обмена.</p>`,
  },
  contact: {
    label: 'Связь',
    title: 'Контакты',
    description: 'Связь с MRAK8 по вопросам заказов.',
    body: `<p>По вопросам заказа пишите на <a href="mailto:intake@mrak8.com">intake@mrak8.com</a> — укажите номер заказа в теме письма.</p>
           <p>Остальные письма читаем, но отвечаем не на все.</p>`,
  },
};

export function makeSimplePage(key) {
  return async function render(view) {
    const data = CONTENT[key];
    view.innerHTML = `
      <section class="simple page-top" data-theme="paper">
        <p class="mono">${data.label}</p>
        <h1 class="t-h2">${data.title}</h1>
        <div class="simple-body">${data.body}</div>
      </section>
    `;

    const form = view.querySelector('[data-order-lookup]');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const orderNumber = form.elements.orderNumber.value.trim().toUpperCase();
      const email = form.elements.email.value.trim();
      if (!orderNumber || !form.elements.email.validity.valid || !email) {
        view.querySelector('[data-lookup-error]').textContent = 'Введите номер заказа и корректный e-mail.';
        return;
      }
      navigate(`/order/${encodeURIComponent(orderNumber)}/?email=${encodeURIComponent(email)}`);
    });

    return { title: `${data.title} — MRAK8`, description: data.description };
  };
}
