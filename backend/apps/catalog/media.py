"""
Responsive image variants for anything uploaded through the admin.

A photographer's 12 MB original should never be what a product card
downloads. Every uploaded image gets downscaled WebP siblings written next
to it (`photo.jpg` -> `photo.w640.webp`, `photo.w1280.webp`, ...), and the
API hands the frontend a ready `srcset` so the browser picks the smallest
one that fits.

Which variants exist is derived from the stored pixel width, so building a
srcset never touches the storage backend.
"""

from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

VARIANT_WIDTHS = (640, 1280, 2000)


def _variant_name(name, width):
    return f'{name.rsplit(".", 1)[0]}.w{width}.webp'


def build_variants(field_file):
    """Create any missing variants for an Image/FileField value. Safe to call
    on every save — existing variants are left alone."""
    if not field_file:
        return
    storage = field_file.storage
    try:
        with storage.open(field_file.name, 'rb') as fh:
            image = ImageOps.exif_transpose(Image.open(fh))
            image.load()
    except (OSError, ValueError):
        return  # not a readable image — nothing to derive
    if image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGBA' if 'A' in image.getbands() or image.mode == 'P' else 'RGB')

    for width in VARIANT_WIDTHS:
        if width >= image.width:
            continue
        name = _variant_name(field_file.name, width)
        if storage.exists(name):
            continue
        resized = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
        buffer = BytesIO()
        resized.save(buffer, 'WEBP', quality=80, method=4)
        storage.save(name, ContentFile(buffer.getvalue()))


def image_payload(field_file, width, height, request=None):
    """`{url, width, height, srcset}` for the API, or None when empty."""
    if not field_file:
        return None

    def absolute(url):
        return request.build_absolute_uri(url) if request else url

    storage = field_file.storage
    candidates = [
        f'{absolute(storage.url(_variant_name(field_file.name, w)))} {w}w'
        for w in VARIANT_WIDTHS
        if width and w < width
    ]
    # The original only joins the srcset when it is not larger than the
    # biggest variant — otherwise the variants already cover every screen.
    if width and width <= VARIANT_WIDTHS[-1]:
        candidates.append(f'{absolute(field_file.url)} {width}w')
    return {
        'url': absolute(field_file.url),
        'width': width,
        'height': height,
        'srcset': ', '.join(candidates),
    }
