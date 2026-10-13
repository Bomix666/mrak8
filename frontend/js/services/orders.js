import { apiFetch } from './apiClient.js';

export async function createOrder(payload) {
  // payload: { email, phone, first_name, last_name, shipping: {...}, items: [{product_id, size, quantity}], notes }
  // The backend re-validates and re-prices everything — this call cannot
  // change what gets charged even if the request body is edited by hand.
  return apiFetch('/orders/', { method: 'POST', body: payload });
}

export async function getOrderStatus(orderNumber, email) {
  return apiFetch(`/orders/${encodeURIComponent(orderNumber)}/`, { params: { email } });
}
