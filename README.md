# Cheburchek Sentinel

Telegram-бот для мониторинга блокировок доменов через публичный API [Cheburcheck](https://cheburcheck.ru/). Отдельный проект: сервер Cheburcheck и его базы не требуются.

## Возможности

- `/add example.com 1h` — добавить домен (по умолчанию 1 час)
- `/remove example.com` — удалить домен
- `/interval example.com 30m` — изменить периодичность
- `/list` — список подписок
- `/status example.com` — последняя проверка

Интервалы: `m` (минуты), `h` (часы), `d` (дни), от 5 минут до 7 дней. Подписки изолированы по Telegram-чату. Первая проверка выполняется после добавления домена; сообщения приходят при первом обнаружении блокировки, её появлении после чистого результата и восстановлении. При сбое API состояние не меняется.

Проверка использует `/api/v1/check` для списков и `/api/v1/probe/{id}` для сетевых проб. Сообщение различает попадание в реестр, диапазон CDN и результаты проб. Попадание IP в CDN-диапазон само по себе не доказывает недоступность сайта. При отсутствии сетевых проб бот сообщает о блокировке только если есть совпадение по спискам.

## Docker

Создать бота через BotFather, скопировать `.env.example` в `.env` и указать его токен в `TELEGRAM_BOT_TOKEN`. Для публичного API Cheburcheck ключ не нужен.

```sh
cp .env.example .env
```

```sh
docker compose -f .docker/docker-compose.local.yml up --build -d
```

Production с локальной сборкой:

```sh
docker compose -f .docker/docker-compose.production.base.yml -f .docker/docker-compose.production.build.yml up --build -d
```

Production с готовым образом: задать `APP_IMAGE` (например, `ghcr.io/owner/cheburchek-sentinel:v1`) и использовать `.docker/docker-compose.production.base.yml` вместе с `.docker/docker-compose.production.image.yml`. Публикация образа в registry настраивается отдельно. SQLite сохраняется в Docker volume `sentinel-data`. Открывать входящие порты не требуется: бот использует long polling.

Публичный Cheburcheck ограничивает вызовы `/probe` по IP. Планировщик выполняет не более одной проверки в 15 секунд на экземпляр. Запускать следует один экземпляр бота на один токен и одну БД.

## Разработка

```sh
bun install --frozen-lockfile
bun run typecheck
```

Токен и база данных не попадают в Git. Если API или Telegram недоступны, бот повторит проверку в следующий плановый интервал.
