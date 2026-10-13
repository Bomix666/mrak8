"""
MRAK8 — media pipeline.

Builds every web-ready derivative used by the site from the ORIGINAL
materials. Originals are only ever read; nothing here writes next to them.

    backend\\.venv\\Scripts\\python.exe tools\\build_media.py

Outputs
    frontend/assets/media/   fixed brand scenes (home / about), served as static
    backend/seed_media/      files `manage.py seed_mrak8` imports into the CMS
                             (product photos, rail cut-outs, journal media)

Needs Pillow (already a backend dependency) and ffmpeg on PATH.
Raw clips for the long loops are read from the two shoot folders that sit
next to the project; if they are missing those loops are skipped with a note.
"""

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / 'frontend' / 'assets' / 'media'
SEED = ROOT / 'backend' / 'seed_media'
RAW_PARK = ROOT.parent / 'mrak 13100'   # b*.MOV — night park takes
RAW_MEET = ROOT.parent / 'Mrak 1310'    # ner*.MOV — handshake / embroidery takes

Image.MAX_IMAGE_PIXELS = None


def load(name):
    return ImageOps.exif_transpose(Image.open(ROOT / name)).convert('RGB')


def save_webp(img, path, quality=80):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'WEBP', quality=quality, method=6)
    print(f'  {path.relative_to(ROOT)}  {img.width}x{img.height}  {path.stat().st_size // 1024} KB')


def responsive(img, out_dir, name, widths, quality=80):
    for w in widths:
        if w > img.width:
            w = img.width
        h = round(img.height * w / img.width)
        save_webp(img.resize((w, h), Image.LANCZOS), out_dir / f'{name}-{w}.webp', quality)


def cutout(src_name, out_path, size=1400, threshold=30):
    """Garment-on-black -> transparent WebP.

    Background = dark pixels connected to the image border (flood fill), so
    dark folds *inside* the garment survive. The mask is eroded a touch to
    drop the dark fringe, then feathered.
    """
    img = load(src_name)
    img.thumbnail((size, size), Image.LANCZOS)
    r, g, b = img.split()
    value = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mask = value.point(lambda v: 255 if v > threshold else 0)
    # 1px black frame guarantees every corner seed touches the background.
    framed = ImageOps.expand(mask, border=1, fill=0)
    ImageDraw.floodfill(framed, (0, 0), 128)
    alpha = framed.crop((1, 1, framed.width - 1, framed.height - 1)).point(lambda v: 0 if v == 128 else 255)
    alpha = alpha.filter(ImageFilter.MedianFilter(5))   # drop stray specks
    alpha = alpha.filter(ImageFilter.MinFilter(5))      # erode the fringe
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.2))
    out = img.convert('RGBA')
    out.putalpha(alpha)
    out = out.crop(alpha.point(lambda v: 255 if v > 8 else 0).getbbox())
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path, 'WEBP', quality=88, method=6)
    print(f'  {out_path.relative_to(ROOT)}  {out.width}x{out.height}  {out_path.stat().st_size // 1024} KB')


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *map(str, args)], check=True)


def video(src, out_dir, name, start=None, duration=None, width=720, crf=28, slow=1.0):
    """Muted, web-ready H.264 clip and a poster frame.

    H.264 only: VP9 came out larger than x264 on this noisy night footage,
    so a second format would cost bytes without buying anything.
    """
    src = Path(src)
    mp4 = out_dir / f'{name}.mp4'
    if mp4.exists():
        print(f'  keep {mp4.relative_to(ROOT)} (delete it to re-encode)')
        return
    if not src.exists():
        print(f'  SKIP {name}: source not found ({src})')
        return
    out_dir.mkdir(parents=True, exist_ok=True)
    cut = []
    if start is not None:
        cut += ['-ss', start]
    if duration is not None:
        cut += ['-t', duration]
    # Light temporal denoise: phone night footage compresses badly otherwise.
    vf = f'scale={width}:-2,fps=30,hqdn3d=2:1.5:6:6'
    if slow != 1.0:
        vf = f'setpts={slow}*PTS,' + vf
    ffmpeg(*cut, '-i', src, '-an', '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', crf,
           '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4)
    poster = out_dir / f'{name}.jpg'
    ffmpeg('-i', mp4, '-frames:v', '1', '-q:v', '4', poster)
    print(f'  {mp4.relative_to(ROOT)}  {mp4.stat().st_size // 1024} KB  + {poster.name}')


def main():
    print('Flat-lays (garment on black)')
    front = load('photo_2026-10-01_14-44-00.jpg')
    back = load('photo_2026-10-01_14-43-58.jpg')
    responsive(front, STATIC, 'flat-front', [800, 1600])
    responsive(back, STATIC, 'flat-back', [800, 1600])
    save_webp(front.resize((1800, 1800), Image.LANCZOS), SEED / 'product' / 'flat-front.webp', 84)
    save_webp(back.resize((1800, 1800), Image.LANCZOS), SEED / 'product' / 'flat-back.webp', 84)

    print('Rail cut-outs')
    cutout('photo_2026-10-01_14-44-00.jpg', SEED / 'product' / 'cutout-front.webp')
    cutout('photo_2026-10-01_14-43-58.jpg', SEED / 'product' / 'cutout-back.webp')

    print('Studio')
    studio_a = load('photo_2026-09-21_09-36-14 (2).jpg')   # with the framed portrait
    studio_b = load('photo_2026-09-21_09-36-14.jpg')       # hood up
    for img, name in ((studio_a, 'studio-frame'), (studio_b, 'studio-hood')):
        save_webp(img, STATIC / f'{name}.webp', 86)
        save_webp(img, SEED / 'product' / f'{name}.webp', 88)

    print('Night group')
    # Portrait frames (4284x5712 after EXIF rotation); the three people sit
    # in the lower-middle, roughly x 470..3740, y 2540..5712.
    group = load('IMG_6537.JPG')
    alt = load('IMG_6540.JPG')
    crops = {
        'group-wide': (group, (0, 2480, 4284, 4420), [1400, 2400]),         # heads-to-waist band
        'group-full': (group, (300, 2450, 3830, 5712), [900, 1600]),
        'group-alt': (alt, (300, 2450, 3830, 5712), [900, 1600]),
        'group-detail-print': (group, (2480, 2950, 3720, 4500), [1000]),    # chest print + crossed arm
        'group-detail-hood': (group, (520, 2700, 1760, 4250), [1000]),      # hand on the hood
    }
    for name, (src, box, widths) in crops.items():
        img = src.crop(box)
        w = widths[-1]
        save_webp(img.resize((w, round(img.height * w / img.width)), Image.LANCZOS), SEED / 'journal' / f'{name}.webp', 80)
    # The one group frame the site itself references: the default link-preview image.
    responsive(group.crop(crops['group-wide'][1]), STATIC, 'group-wide', [1400], 78)

    print('Films (final edits, end card trimmed, muted)')
    video(ROOT / 'montazh_v3.mp4', SEED / 'journal', 'film-park', duration=11.0, crf=27)
    video(ROOT / 'Mrak8_edit_v3.mp4', SEED / 'journal', 'film-meet', crf=27)

    print('Scene loops (raw takes)')
    video(RAW_PARK / 'b4.MOV', STATIC, 'loop-walk', start=0.5, duration=8.5)
    video(RAW_MEET / 'ner5.MOV', STATIC, 'loop-hood', duration=4.4)
    video(RAW_MEET / 'ner.MOV', STATIC, 'loop-stitch', slow=2.0)


if __name__ == '__main__':
    sys.exit(main())
