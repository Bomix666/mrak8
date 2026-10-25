import { getOrderStatus } from '../services/orders.js';
import { ApiError } from '../services/apiClient.js';
import { esc, formatDate } from '../utils/format.js';
import { slam } from '../utils/fx.js';

const META = { title: 'Досье — MRAK8', description: '' };

// Same words as the mini app's dossier (mrakapp shared ORDER_STATUS_LABEL).
const ORDER_STATUS = {
  NEW: 'Протокол составлен',
  PAYMENT_PENDING: 'Ожидает оплаты',
  PAID: 'Принят',
  PROCESSING: 'Принят',
  PACKED: 'Собран',
  SHIPPED: 'Этапирован',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменён',
  REFUNDED: 'Возврат оформлен',
};
const PAYMENT_STATUS = { PENDING: 'Ожидается', CONFIRMED: 'Подтверждена', FAILED: 'Не прошла', REFUNDED: 'Возвращена' };
// Four public steps, as in the bot; PROCESSING is still «принят» from outside.
const TIMELINE = ['PAID', 'PACKED', 'SHIPPED', 'DELIVERED'];
const STEP_OF = { PROCESSING: 'PAID' };

function money(amount, currency) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(Number(amount));
}

export async function render(view, { orderNumber, query }) {
  let order;
  try {
    order = await getOrderStatus(orderNumber, query.email || '');
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err; // router shows the retry screen
    view.innerHTML = `
      <section class="state" data-theme="paper">
        <p class="mono">Досье</p>
        <h1>Дело не найдено</h1>
        <p>Проверьте номер заказа и e-mail, указанный при оформлении.</p>
        <a class="link" href="/account/">Попробовать ещё раз</a>
      </section>`;
    return META;
  }

  const addr = order.shipping_address;
  const step = TIMELINE.indexOf(STEP_OF[order.status] || order.status);
  const label = ORDER_STATUS[order.status] || order.status;

  view.innerHTML = `
    <div data-theme="paper">
      <section class="order page-top">
        <p class="mono">Досье · форма № ${esc(order.order_number)} / ${formatDate(order.created_at)}</p>
        <div class="order-head" data-order-head>
          <h1 class="t-h2">${esc(label)}</h1>
        </div>

        ${step >= 0 ? `
        <ol class="order-timeline" aria-label="Этапы заказа">
          ${TIMELINE.map((key, i) => `
            <li class="${i <= step ? 'is-done' : ''}" ${i === step ? 'aria-current="step"' : ''}>
              <span class="mono">0${i + 1}</span>${ORDER_STATUS[key]}
            </li>`).join('')}
        </ol>` : ''}

        <dl class="order-facts">
          <div><dt class="mono">Оплата</dt><dd>${esc(PAYMENT_STATUS[order.payment_status] || order.payment_status)}</dd></div>
          <div><dt class="mono">Сумма</dt><dd>${money(order.total, order.currency)}</dd></div>
          ${addr ? `<div><dt class="mono">Доставка</dt><dd>${esc(addr.first_name)} ${esc(addr.last_name)}<br />${esc(addr.address_line)}<br />${esc(addr.city)}, ${esc(addr.postal_code)}<br />${esc(addr.country)}</dd></div>` : ''}
        </dl>

        <h2 class="mono order-items-title">Опись изъятого</h2>
        <ul class="order-items">
          ${order.items.map((item) => `
            <li>
              <span>${esc(item.product_name)}</span>
              <span class="mono">${item.size === 'OS' ? 'one size' : esc(item.size)} × ${item.quantity}</span>
              <span>${money(item.line_total, order.currency)}</span>
            </li>`).join('')}
        </ul>

        <a class="link" href="/shop/">К вещдокам</a>
      </section>
    </div>
  `;

  // The current status lands on the file as a stamp.
  if (step >= 0 || order.status === 'CANCELLED') {
    slam(view.querySelector('[data-order-head]'), label, { sub: `ФОРМА № ${order.order_number}`, rot: -7, cls: 'stamp--order' });
  }

  return { title: `Досье ${order.order_number} — MRAK8`, description: '' };
}
