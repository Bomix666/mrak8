"""
Payment abstraction layer.

The rest of the codebase (checkout view, webhook view, admin actions)
never talks to a payment provider directly — it talks to `PaymentService`,
which delegates to whichever `PaymentProvider` is configured via the
PAYMENT_PROVIDER env var. This means swapping providers, or adding a
second one, never touches checkout/order code.

    PaymentService
    ├── create_payment(order)      -> opens a payment, returns where to send the shopper
    ├── verify_payment(payment)    -> asks the provider for the current status (polling path)
    ├── handle_webhook(request)    -> verifies + applies a provider webhook (push path)
    └── refund_payment(payment)    -> issues a refund

TO GO LIVE WITH A REAL PROVIDER:
  1. Implement a new PaymentProvider subclass below (see YooKassaProvider /
     TBankProvider stubs — they show exactly which three methods to fill in
     and where credentials come from).
  2. Set PAYMENT_PROVIDER=yookassa (or tbank) and the provider's credential
     vars in .env — see .env.example.
  3. Nothing else changes: checkout, webhook URL, admin, and stock logic
     are all provider-agnostic already.
"""

import logging
from abc import ABC, abstractmethod

from django.conf import settings
from django.db import transaction
from django.db.models import F

from apps.catalog.models import Inventory
from apps.customers.notifications import send_payment_confirmed

from .models import Payment

logger = logging.getLogger('apps.payments')


class PaymentProvider(ABC):
    name = 'base'

    @abstractmethod
    def create_payment(self, order) -> dict:
        """Open a payment for `order`. Returns a dict with at least
        `payment_url` (where the shopper is sent to pay) and
        `provider_payment_id`. Must create a Payment row with status
        PENDING."""

    @abstractmethod
    def verify_payment(self, payment: Payment) -> str:
        """Ask the provider for the current status of `payment` and
        return one of PAYMENT_STATUS_CHOICES. Used for manual/admin
        verification and as a fallback if a webhook is missed."""

    @abstractmethod
    def handle_webhook(self, request) -> Payment:
        """Verify the authenticity of an incoming webhook request (always
        check a signature — never trust the payload alone) and update the
        matching Payment. Returns the updated Payment."""

    def refund_payment(self, payment: Payment) -> Payment:
        raise NotImplementedError(f'{self.name} does not support refunds yet.')


class ManualTestProvider(PaymentProvider):
    """
    Development/demo provider — no external service involved. Creates a
    PENDING payment and exposes a same-origin "confirm" endpoint
    (POST /api/payments/test-confirm/<payment_id>/) that only works when
    DEBUG=True, so a developer can exercise the full PAID flow locally
    without real payment credentials. This must never be enabled in
    production — see the DEBUG guard in views.py.
    """

    name = 'manual_test'

    def create_payment(self, order) -> dict:
        payment = Payment.objects.create(
            order=order,
            provider=self.name,
            amount=order.total,
            currency=order.currency,
            status='PENDING',
        )
        return {
            'provider': self.name,
            'payment_id': payment.id,
            'payment_url': None,
            'test_confirm_endpoint': f'/api/payments/test-confirm/{payment.id}/' if settings.DEBUG else None,
        }

    def verify_payment(self, payment: Payment) -> str:
        return payment.status

    def handle_webhook(self, request) -> Payment:
        raise NotImplementedError('The manual test provider has no webhook — use test-confirm instead.')


class YooKassaProvider(PaymentProvider):
    """
    STUB — fill in with the real YooKassa SDK/API calls when ready.
    Credentials come from settings.PAYMENT_PROVIDER_CONFIG['yookassa'],
    which is populated from YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY in
    .env. Never hardcode credentials here.
    """

    name = 'yookassa'

    def __init__(self):
        self.config = settings.PAYMENT_PROVIDER_CONFIG['yookassa']

    def create_payment(self, order) -> dict:
        # TODO(production): call the YooKassa "create payment" API with
        # self.config['shop_id'] / self.config['secret_key'], store the
        # returned confirmation_url and provider_payment_id.
        raise NotImplementedError('Wire up the YooKassa SDK here before setting PAYMENT_PROVIDER=yookassa.')

    def verify_payment(self, payment: Payment) -> str:
        raise NotImplementedError('Wire up the YooKassa "get payment" API here.')

    def handle_webhook(self, request) -> Payment:
        # TODO(production): verify the notification's authenticity per
        # YooKassa's docs (IP allowlist + payload shape at minimum),
        # then look up the Payment by provider_payment_id and apply it.
        raise NotImplementedError('Wire up YooKassa webhook verification here.')


class TBankProvider(PaymentProvider):
    """STUB — same shape as YooKassaProvider, for T-Bank (Tinkoff) Acquiring."""

    name = 'tbank'

    def __init__(self):
        self.config = settings.PAYMENT_PROVIDER_CONFIG['tbank']

    def create_payment(self, order) -> dict:
        raise NotImplementedError('Wire up the T-Bank Acquiring API here before setting PAYMENT_PROVIDER=tbank.')

    def verify_payment(self, payment: Payment) -> str:
        raise NotImplementedError('Wire up T-Bank payment status check here.')

    def handle_webhook(self, request) -> Payment:
        raise NotImplementedError('Wire up T-Bank webhook (Notification URL) signature verification here.')


_PROVIDERS = {
    'manual_test': ManualTestProvider,
    'yookassa': YooKassaProvider,
    'tbank': TBankProvider,
}


class PaymentService:
    @staticmethod
    def get_provider() -> PaymentProvider:
        key = settings.PAYMENT_PROVIDER
        provider_cls = _PROVIDERS.get(key)
        if not provider_cls:
            raise ValueError(f'Unknown PAYMENT_PROVIDER "{key}". Valid: {list(_PROVIDERS)}')
        return provider_cls()

    @staticmethod
    @transaction.atomic
    def confirm_payment(payment: Payment):
        """
        The ONLY place stock is decremented. Called after a webhook or an
        admin/manual verification confirms payment — never on the
        frontend's say-so, and never twice (guarded by the order's status).
        """
        order = payment.order
        if order.is_paid:
            logger.info('Payment for %s already applied — ignoring duplicate confirmation.', order.order_number)
            return payment

        payment.status = 'CONFIRMED'
        payment.save(update_fields=['status', 'updated_at'])

        locked_items = list(order.items.select_for_update().select_related('product'))
        for item in locked_items:
            updated = Inventory.objects.filter(
                product_id=item.product_id, size=item.size, quantity__gte=item.quantity
            ).update(quantity=F('quantity') - item.quantity)
            if not updated:
                # Stock disappeared between order creation and payment
                # confirmation (e.g. two guests raced for the last unit
                # and the other one paid first). Flag for manual review
                # rather than silently over-selling or losing the payment.
                logger.error(
                    'Insufficient stock confirming %s for order %s — flagged for manual review.',
                    item.product_name, order.order_number,
                )
                order.notes += f'\n[STOCK CONFLICT] {item.product_name} ({item.size}) x{item.quantity} — review manually.'

        order.status = 'PAID'
        order.save(update_fields=['status', 'notes'])

        send_payment_confirmed(order)
        return payment

    @staticmethod
    def mark_failed(payment: Payment):
        payment.status = 'FAILED'
        payment.save(update_fields=['status', 'updated_at'])
