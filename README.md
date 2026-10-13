# MRAK8 — цифровой шоурум, магазин и журнал

Один Django-проект отдаёт и API, и сам сайт. Каталог, остатки, цены, заказы и
журнал живут в базе и редактируются в админке; браузеру сервер не доверяет ни
цену, ни наличие.

---

## 1. Запуск

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

copy .env.example .env            # и задайте DJANGO_SECRET_KEY
python manage.py migrate
python manage.py seed_catalog     # только на пустой базе: стартовые товары
python manage.py seed_mrak8       # реальные фото, вырезки для рейла, журнал
python manage.py createsuperuser
python manage.py runserver
```

Сайт — `http://127.0.0.1:8000/`, админка — `http://127.0.0.1:8000/admin/`.
Отдельный сервер для фронтенда не нужен.

Тесты: `python manage.py test` (20 тестов: оформление заказа, журнал, HTML-оболочка).

## 2. Структура

```
mrak88/
├── *.JPG, *.jpg, *.mp4          исходные материалы — только читаются, не изменяются
├── tools/build_media.py         сборка веб-версий медиа из исходников
├── backend/                     Django
│   ├── apps/catalog/            товары, фото, остатки по размерам, вырезки для рейла
│   ├── apps/orders/             заказы, адрес доставки, API оформления
│   ├── apps/payments/           платежи, абстракция провайдера, webhook
│   ├── apps/customers/          покупатели, e-mail-уведомления
│   ├── apps/journal/            JOURNAL: материалы и блоки (CMS)
│   ├── apps/storefront/         HTML-оболочка сайта: title, Open Graph, 404
│   ├── apps/dashboard/          /admin/dashboard/
│   └── seed_media/              подготовленные файлы для seed_mrak8
└── frontend/                    сайт: ES-модули без сборки
    ├── index.html               оболочка (Django-шаблон)
    ├── assets/media/            фиксированные сцены главной и About
    ├── css/                     base · chrome · home · shop · journal
    └── js/
        ├── router.js, app.js    маршруты на History API
        ├── data/                products.js, journal.js — единственные точки обращения к API
        ├── state/cart.js        корзина (localStorage + сверка с каталогом)
        ├── components/          rail (шоурум), header, cartDrawer, productCard, sizeSelector…
        ├── pages/               home, shop, product, journal, journalEntry, about, checkout…
        └── utils/               scroll.js (появление и скролл-сцены), media.js, format.js
```

## 3. Как управлять контентом (без кода)

**Товары** — Admin → Products.

- Фото: inline «Product images». Первое фото — карточка в каталоге, второе
  показывается по наведению. Для каждого фото сервер сам делает уменьшенные
  WebP-версии (640 / 1280 / 2000 px), сайт выбирает подходящую.
- Цена: `Price`; скидка — `Sale price` (старая цена показывается зачёркнутой).
- Остатки: inline «Inventory», строка на каждый размер. Размер с нулём на сайте
  неактивен, а на рейле на его месте висит пустая вешалка.
- **Шоурум на главной** — блок «Showroom rail»: `Cutout front` / `Cutout back`,
  вещь на прозрачном фоне (PNG или WebP). Товар с вырезкой появляется на рейле.
  Пока таких товаров один-два, рейл показывает их размерный ряд; когда больше —
  по вешалке на товар.
- `Is featured` — блок SHOP на главной.

**Журнал** — Admin → Journal → Entries.

- Материал: заголовок, тип (Film / Shoot / People / Object / Note), обложка
  (картинка и, по желанию, короткий немой ролик MP4/WebM до 40 МБ).
- Страница собирается из блоков: Text, Quote, Image, Video. Порядок — поле
  `Order`. Раскладка медиа: `Wide`, `Full bleed`, `Half` (соседние встают в
  коллаж по два), `Strip` (соседние листаются лентой).
- `Status`: Draft / Published. Черновик виден только вошедшему в админку
  («View on site»), в списке журнала его нет.
- `Is featured` — фильм в сцене на главной. Материал типа People — панорама
  внизу главной. `Products` — блок «Вещи в кадре» со ссылками в магазин.

**Заказы и оплата** — как раньше: Admin → Orders / Payments, `/admin/dashboard/`.

**Валюта** — `SHOP_CURRENCY` в `.env` (например `RUB`).

**Тексты «Доставка и возврат», «Контакты»** — `frontend/js/pages/simple.js`.

## 4. Медиа

`backend\.venv\Scripts\python.exe tools\build_media.py` (нужен ffmpeg в PATH)
пересобирает из исходников:

- вырезки худи на прозрачном фоне для рейла;
- адаптивные WebP для сцен главной и About;
- немые H.264-петли 720p с poster-кадрами (исходные клипы — папки
  `..\mrak 13100` и `..\Mrak 1310`; если их нет, петли пропускаются);
- фильмы для журнала из финальных монтажей (концовка с логотипом Instagram
  обрезана, звук убран).

Исходники не перезаписываются. Готовые видео повторно не кодируются — чтобы
пересобрать клип, удалите его `.mp4`.

## 4a. Витрина на GitHub Pages

Pages отдаёт только файлы, поэтому туда уходит статическая копия без заказов:
страницы, товары и журнал — как в базе на момент сборки.

```bash
cd backend
python manage.py build_pages --out ../../mrak8-pages --base /mrak8 --origin https://bomix666.github.io
```

Содержимое папки публикуется в ветку `gh-pages`. После правок в админке
сборку и публикацию нужно повторить. Корзина там работает, оформление — нет.

## 5. Дизайн-система

Токены — `frontend/css/base.css`.

- **Цвет** взят с вещи: молочная ткань `--bone`, красный принт `--signal`,
  чёрный фон съёмки `--ink`; светлая поверхность каталога `--paper`.
  Секция выбирает тему атрибутом `data-theme="dark | paper | bone"`.
- **Шрифты**: Sofia Sans Extra Condensed 900 — заголовки (как принт),
  Inter Tight — текст и логотип, JetBrains Mono — подписи и индексы.
- **Сетка**: 12 колонок, поля `--edge`, шкала отступов `--s-1 … --s-10`.
- **Без скруглений, теней и декоративных градиентов.** Навигация — ярлыки:
  логотип повторяет вышивку на капюшоне, ссылки — тёмные бирки, поэтому читаются
  на любом фоне.
- **Движение**: `[data-reveal]` — появление один раз; `[data-progress]` — число
  `--p` (0→1) для скролл-сцен, остальное делает CSS. Один пассивный обработчик
  скролла. При `prefers-reduced-motion` сцены стоят в финальной композиции,
  фоновые ролики не загружаются.

## 6. API

| Метод | Путь | |
|---|---|---|
| GET | `/api/products/` | `?category=`, `?collection=`, `?featured=true`, `?new=true` |
| GET | `/api/products/<slug>/` | + описание, детали, посадка, доставка |
| GET | `/api/products/<slug>/related/` | |
| GET | `/api/categories/`, `/api/collections/` | |
| GET | `/api/journal/` | опубликованные; `?featured=true`, `?product=<slug>` |
| GET | `/api/journal/<slug>/` | материал с блоками и товарами |
| POST | `/api/orders/` | принимает только `product_id`, `size`, `quantity`; цену и остаток читает сервер |
| GET | `/api/orders/<номер>/?email=` | статус заказа: нужен и номер, и e-mail |
| POST | `/api/payments/webhook/` | уведомления провайдера |
| POST | `/api/payments/test-confirm/<id>/` | только при `DEBUG=True` |

В ответах товаров добавились поля `currency`, `inventory` (и в списке),
`cutout_front`, `cutout_back`, у изображений — `width`, `height`, `srcset`.
Ничего не переименовано и не удалено.

## 7. Перед продакшеном

- `DJANGO_DEBUG=False`, настоящий `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`.
- `python manage.py collectstatic`; `/static/` и `/media/` должен отдавать
  веб-сервер (nginx или аналог). Встроенный сервер Django не поддерживает
  HTTP Range — без этого видео не играет в Safari/iOS.
- PostgreSQL (`POSTGRES_*` в `.env`).
- Платёжный провайдер: реализовать три метода в `apps/payments/services.py`
  (заготовки YooKassa и T-Bank), задать `PAYMENT_PROVIDER`.
- Почта: `DJANGO_EMAIL_BACKEND`. Сейчас письма печатаются в консоль; первое
  письмо после запуска сервера на Windows может идти ~10 секунд (определение
  имени хоста), это задерживает первый заказ в dev-режиме.
- Шрифты грузятся с Google Fonts; для независимости от него положите файлы
  локально и замените `<link>` в `frontend/index.html`.
