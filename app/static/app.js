/*
 * Четыре отпечатка проявляются по очереди: паспарту всплывает, полоса засветки
 * проходит по окну сверху вниз, а код под ним собирается из случайных цифр в
 * свои настоящие четыре знака. Всё остальное на странице держится тихо.
 */

const CARD_SIZE = 240;
const FILE_SIZE = 512;
const STAGGER = 90;
const HEX = "0123456789ABCDEF";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const form = document.getElementById("form");
const input = document.getElementById("name");
const tray = document.getElementById("tray");
const pickState = document.getElementById("pickState");
const generateButton = document.getElementById("generate");
const downloadButton = document.getElementById("download");

let current = null;
let picked = null;

/** Код существа собирается из мусора в своё значение, как на счётчике. */
function settleCode(node, target, delay) {
    if (reduceMotion) {
        node.textContent = target;
        return;
    }

    node.textContent = "".padEnd(target.length, "0");

    window.setTimeout(() => {
        const total = 12;
        let frame = 0;
        const timer = window.setInterval(() => {
            frame += 1;
            const fixed = Math.round((target.length * frame) / total);
            let text = target.slice(0, fixed);
            for (let i = fixed; i < target.length; i += 1) {
                text += HEX[Math.floor(Math.random() * HEX.length)];
            }
            node.textContent = text;

            if (frame >= total) {
                window.clearInterval(timer);
                node.textContent = target;
            }
        }, 42);
    }, delay);
}

function choose(variant) {
    picked = variant;
    downloadButton.disabled = false;
    renderPick();
}

function renderPick() {
    pickState.replaceChildren();

    if (!picked) {
        pickState.textContent = "Pick a creature to download.";
        return;
    }

    const code = document.createElement("span");
    code.className = "pick__code";
    code.textContent = picked.code;

    pickState.append("Selected ", code, " · " + picked.hash.slice(0, 20) + "…");
}

function buildPlate(variant, index) {
    const plate = document.createElement("label");
    plate.className = "plate";
    plate.style.setProperty("--i", index);

    // Вкладка, открытая в фоне, анимации не проигрывает: там проявку
    // пропускаем целиком, иначе кювета так и останется пустой.
    const animate = !reduceMotion && document.visibilityState === "visible";
    if (animate) plate.classList.add("is-entering");

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "pick";
    radio.className = "sr-only";
    radio.value = variant.hash;
    radio.addEventListener("change", () => choose(variant));

    const well = document.createElement("span");
    well.className = "plate__well";

    const image = document.createElement("img");
    image.className = "plate__img";
    image.width = CARD_SIZE;
    image.height = CARD_SIZE;
    // Имя варианту даёт его код, поэтому картинка для чтения с экрана пустая
    image.alt = "";
    image.addEventListener("load", () => plate.classList.add("is-ready"));
    image.addEventListener("error", () => {
        plate.classList.add("is-failed");
        radio.disabled = true;
        const failure = document.createElement("span");
        failure.className = "plate__fail";
        failure.textContent = "no answer from the creature service";
        well.replaceChildren(failure);
    });

    // Подписка стоит раньше src: у картинки из кеша load успел бы пройти мимо
    image.src = "/monster/" + variant.hash + "?size=" + CARD_SIZE;
    if (image.complete && image.naturalWidth) {
        // Кадр отсрочки нужен, чтобы браузер успел отрисовать скрытое
        // состояние — иначе у картинки из кеша проявка не запустится
        if (animate) {
            requestAnimationFrame(() => requestAnimationFrame(() => plate.classList.add("is-ready")));
        } else {
            plate.classList.add("is-ready");
        }
    }

    const scan = document.createElement("span");
    scan.className = "plate__scan";
    scan.setAttribute("aria-hidden", "true");
    well.append(image, scan);

    const strip = document.createElement("span");
    strip.className = "plate__code";

    const spoken = document.createElement("span");
    spoken.className = "sr-only";
    spoken.textContent = "Creature ";

    const hex = document.createElement("span");

    const tick = document.createElement("span");
    tick.className = "plate__tick";
    tick.setAttribute("aria-hidden", "true");

    strip.append(spoken, hex, tick);
    plate.append(radio, well, strip);

    settleCode(hex, variant.code, index * STAGGER + 140);
    return plate;
}

function showTrayError() {
    const box = document.createElement("div");
    box.className = "tray__error";

    const title = document.createElement("h2");
    title.textContent = "No creatures came back";

    const line = document.createElement("p");
    line.textContent = "The service did not answer. Press Generate to try again.";

    box.append(title, line);
    tray.replaceChildren(box);
}

async function generate(name) {
    generateButton.disabled = true;

    try {
        const answer = await fetch("/api/creatures?name=" + encodeURIComponent(name));
        if (!answer.ok) throw new Error("request failed");

        current = await answer.json();
        picked = null;
        downloadButton.disabled = true;
        renderPick();

        tray.replaceChildren(...current.variants.map(buildPlate));
    } catch {
        current = null;
        picked = null;
        downloadButton.disabled = true;
        showTrayError();
    } finally {
        generateButton.disabled = !input.value.trim();
    }
}

function fileName(name, code) {
    const stem = name
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
    return "pictogram-" + (stem || "creature") + "-" + code + ".png";
}

downloadButton.addEventListener("click", async () => {
    if (!picked) return;

    downloadButton.disabled = true;
    try {
        // Файл берём крупнее того, что показано в кювете
        const answer = await fetch("/monster/" + picked.hash + "?size=" + FILE_SIZE);
        if (!answer.ok) throw new Error("request failed");

        const url = URL.createObjectURL(await answer.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName(current ? current.name : "", picked.code);
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    } catch {
        pickState.textContent = "The download failed. Press Generate and pick again.";
    } finally {
        downloadButton.disabled = !picked;
    }
});

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (name) generate(name);
});

input.addEventListener("input", () => {
    generateButton.disabled = !input.value.trim();
});

generate(input.value.trim());
