import re

from rest_framework import serializers

PHONE_RE = re.compile(r'^\+?[0-9()\-\s]{7,20}$')
POSTAL_RE = re.compile(r'^[A-Za-z0-9\-\s]{3,12}$')


def validate_phone(value):
    if not PHONE_RE.match(value):
        raise serializers.ValidationError('Введите корректный номер телефона.')
    return value


def validate_postal_code(value):
    if not POSTAL_RE.match(value):
        raise serializers.ValidationError('Введите корректный почтовый индекс.')
    return value
