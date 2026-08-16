from flask import Flask, Response, jsonify, render_template, request
import hashlib
import os
import re
import requests

app = Flask(__name__)

# compose поднимает контейнер с ENV=DEV и монтирует исходники томом.
# Без этого Flask отдаёт стили с полусуточным кешем, и правки не доходят.
if os.environ.get("ENV") == "DEV":
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

# Четыре соли — четыре независимых существа от одного имени.
# Первая оставлена из исходной версии, чтобы старые ссылки давали то же самое.
SALTS = ("UNIQUE_SALT", "SECOND_SALT", "THIRD_SALT", "FOURTH_SALT")

DEFAULT_NAME = "Joe Bloggs"
# В compose существ рисует соседний контейнер; вне compose адрес можно подменить.
MONSTER_URL = os.environ.get("DNMONSTER_URL", "http://dnmonster:8080").rstrip("/") + "/monster/"
HASH_PATTERN = re.compile(r"[0-9a-fA-F]{4,64}")
MIN_SIZE, MAX_SIZE, DEFAULT_SIZE = 32, 512, 240


def variants(name):
    """Один и тот же ник всегда даёт одни и те же четыре хеша."""
    result = []
    for salt in SALTS:
        digest = hashlib.sha256((salt + name).encode()).hexdigest()
        # Первые четыре знака хеша — опознавательный код существа.
        # Порядок вариантов ничего не значит, а вот код уникален.
        result.append({"hash": digest, "code": digest[:4].upper()})
    return result


@app.route("/")
def index():
    return render_template("index.html", default_name=DEFAULT_NAME)


@app.route("/api/creatures")
def creatures():
    name = (request.args.get("name") or "").strip() or DEFAULT_NAME
    return jsonify({"name": name, "variants": variants(name)})


@app.route("/monster/<name>")
def get_monster(name):
    # Только шестнадцатеричные строки: имя уходит в чужой URL,
    # и точки со слешами увели бы запрос не на тот хост.
    if not HASH_PATTERN.fullmatch(name):
        return Response("unknown creature", status=404, mimetype="text/plain")

    try:
        size = int(request.args.get("size", DEFAULT_SIZE))
    except ValueError:
        size = DEFAULT_SIZE
    size = max(MIN_SIZE, min(MAX_SIZE, size))

    try:
        answer = requests.get(MONSTER_URL + name, params={"size": size}, timeout=5)
    except requests.RequestException:
        return Response("creature service unreachable", status=502, mimetype="text/plain")

    if answer.status_code != 200:
        return Response("creature service failed", status=502, mimetype="text/plain")

    return Response(
        answer.content,
        mimetype="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
