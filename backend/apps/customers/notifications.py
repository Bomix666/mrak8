"""
Notification service layer.

Nothing here requires a live email provider to run — DEBUG mode uses
Django's console backend (settings.EMAIL_BACKEND), so notifications print
to the terminal during development. To go live, set DJANGO_EMAIL_BACKEND
in .env to a real backend (SMTP, SendGrid, Postmark, etc.) and these calls
start sending real email with zero code changes elsewhere in the app.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger('apps.orders')


def _send(subject, message, to_email):
    if not to_email:
        logger.warning('Notification skipped — no recipient email. Subject: %s', subject)
        return
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [to_email], fail_silently=True)


def send_order_confirmation(order):
    _send(
        subject=f'MRAK8 — Order {order.order_number} received',
        message=(
            f'Order {order.order_number} has been logged.\n'
            f'Total: {order.currency} {order.total}\n'
            'You will receive a separate notice once payment is confirmed.'
        ),
        to_email=order.contact_email,
    )


def send_payment_confirmed(order):
    _send(
        subject=f'MRAK8 — Payment confirmed for {order.order_number}',
        message=f'Payment for order {order.order_number} is confirmed. Your order is now processing.',
        to_email=order.contact_email,
    )


def send_order_shipped(order):
    _send(
        subject=f'MRAK8 — Order {order.order_number} shipped',
        message=f'Order {order.order_number} has shipped.',
        to_email=order.contact_email,
    )


def send_order_delivered(order):
    _send(
        subject=f'MRAK8 — Order {order.order_number} delivered',
        message=f'Order {order.order_number} was marked delivered.',
        to_email=order.contact_email,
    )
