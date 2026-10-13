import { apiFetch } from './apiClient.js';

/**
 * DEV/TEST ONLY. Calls the backend's manual-test payment provider, which
 * is hard-disabled outside DEBUG (see apps/payments/views.py). This is
 * not a fake "payment successful" — it's a real call that flips the
 * Payment and Order rows in the database via PaymentService, the same
 * code path a real webhook would use. When a real provider is wired in,
 * `payment.payment_url` will be present instead and the frontend should
 * redirect there rather than calling this.
 */
export async function confirmTestPayment(paymentId) {
  return apiFetch(`/payments/test-confirm/${paymentId}/`, { method: 'POST' });
}
