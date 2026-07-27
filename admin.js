/* =====================================================================
   admin.js — Panel de carga. Edita el contenido y la meta, y exporta
   data.json / meta.json para subir al repo. Guarda un borrador local.
   ===================================================================== */
(function () {
  "use strict";

  const DRAFT_KEY = "cec_admin_draft";
  const AUTH_SOURCE = "auth.json";
  const SESSION_KEY = "cec_admin_ok";
  // Hash de respaldo (contraseña por defecto) por si no se puede leer auth.json.
  const DEFAULT_HASH = "1699edf374ff61c522deba2f1fe61482ab65b8f1047e29b1e92c99f3fe14fbc7";

  /* ---------- SHA-256 (para no guardar la contraseña en texto plano) ---------- */
  function sha256(ascii) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow, maxWord = mathPow(2, 32), L = "length";
    var i, j, result = "", words = [];
    var asciiBitLength = ascii[L] * 8;
    var hash = sha256.h = sha256.h || [];
    var k = sha256.k = sha256.k || [];
    var primeCounter = k[L];
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += "\x80";
    while (ascii[L] % 64 - 56) ascii += "\x00";
    for (i = 0; i < ascii[L]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return;
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[L]] = ((asciiBitLength / maxWord) | 0);
    words[words[L]] = (asciiBitLength);
    for (j = 0; j < words[L];) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) { hash[i] = (hash[i] + oldHash[i]) | 0; }
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : "") + b.toString(16);
      }
    }
    return result;
  }
  function hashPassword(pw) { return sha256(unescape(encodeURIComponent(String(pw)))); }

  // Respaldo por si no se pueden leer los .json (ej: abierto sin servidor)
  const DEFAULTS = {
    data: {
      club: { nombre: "CEC Liceo Militar", nombreLargo: "Centro de Ex Cadetes — Liceo Militar Gral. San Martín",
        canalYoutube: "", instagram: "", facebook: "" },
      hero: { eyebrow: "Streaming del club · Rugby", titulo: "Ayudanos a mejorar la transmisión de los partidos", bajada: "" },
      porQue: [],
      mejoras: [],
      donar: {
        mercadopago: { activo: true, titulo: "MercadoPago", descripcion: "Con tarjeta, débito o dinero en cuenta. Es la forma más rápida.", url: "" },
        transferencia: { activo: true, titulo: "Transferencia bancaria", descripcion: "Sin comisiones. Copiá el alias y transferí desde tu banco o billetera.", alias: "", cbu: "", titular: "" }
      },
      transparencia: []
    },
    meta: { objetivo: 0, recaudado: 0, donantes: 0, actualizado: "" }
  };

  let state = { data: null, meta: null };

  /* ---------- Helpers ---------- */
  const $ = (s) => document.querySelector(s);
  const attr = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const num = (v) => Math.max(0, Math.round(Number(v) || 0));
  const pesos = (n) => "$" + num(n).toLocaleString("es-AR");

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1900);
  }

  async function tryFetch(url, fallback) {
    try {
      const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw 0;
      return await r.json();
    } catch (e) { return JSON.parse(JSON.stringify(fallback)); }
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      $("#draft-status").textContent = "Borrador guardado ✓";
    } catch (e) {}
    actualizarPreviewMeta();
  }

  /* ---------- Carga inicial ---------- */
  async function load() {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        state = JSON.parse(draft);
        if (state && state.data && state.meta) return;
      } catch (e) {}
    }
    state = {
      data: await tryFetch("data.json", DEFAULTS.data),
      meta: await tryFetch("meta.json", DEFAULTS.meta)
    };
    // asegura estructura mínima
    state.data.mejoras = state.data.mejoras || [];
    state.data.transparencia = state.data.transparencia || [];
    state.data.donar = state.data.donar || DEFAULTS.data.donar;
  }

  /* ---------- Rellenar formularios ---------- */
  function fillForm() {
    const d = state.data, m = state.meta;
    $("#m-objetivo").value = m.objetivo || 0;
    $("#m-recaudado").value = m.recaudado || 0;
    $("#m-donantes").value = m.donantes || 0;

    $("#mp-activo").checked = !!(d.donar.mercadopago && d.donar.mercadopago.activo);
    $("#mp-url").value = (d.donar.mercadopago && d.donar.mercadopago.url) || "";
    $("#tr-activo").checked = !!(d.donar.transferencia && d.donar.transferencia.activo);
    $("#tr-alias").value = (d.donar.transferencia && d.donar.transferencia.alias) || "";
    $("#tr-cbu").value = (d.donar.transferencia && d.donar.transferencia.cbu) || "";
    $("#tr-titular").value = (d.donar.transferencia && d.donar.transferencia.titular) || "";

    $("#h-titulo").value = d.hero.titulo || "";
    $("#h-bajada").value = d.hero.bajada || "";
    $("#h-eyebrow").value = d.hero.eyebrow || "";
    $("#c-ig").value = d.club.instagram || "";
    $("#c-fb").value = d.club.facebook || "";
    $("#c-yt").value = d.club.canalYoutube || "";

    renderItems();
    renderTransp();
    actualizarPreviewMeta();
  }

  function actualizarPreviewMeta() {
    const m = state.meta;
    const pct = num(m.objetivo) > 0 ? Math.min(100, (num(m.recaudado) / num(m.objetivo)) * 100) : 0;
    $("#metaprev").textContent = `Vista previa: ${pesos(m.recaudado)} de ${pesos(m.objetivo)} · ${Math.round(pct)}% · ${num(m.donantes)} donantes`;
  }

  /* ---------- Ítems ---------- */
  function renderItems() {
    const cont = $("#items");
    cont.innerHTML = state.data.mejoras.map((m, i) => {
      const thumb = m.foto
        ? `<img src="${attr(m.foto)}" alt="" />`
        : `<span>${attr(m.icono || "🏉")}</span>`;
      return `
      <div class="item">
        <div class="item__top">
          <div class="thumb">${thumb}</div>
          <div class="item__fields">
            <label>Nombre del ítem</label>
            <input type="text" data-i="${i}" data-k="titulo" value="${attr(m.titulo)}" placeholder="Ej: Cámara Full HD" />
            <label>Qué mejora / descripción</label>
            <textarea data-i="${i}" data-k="mejora" placeholder="Ej: Imagen nítida de todo el partido.">${attr(m.mejora)}</textarea>
            <div class="row row--3">
              <div>
                <label>Costo ($)</label>
                <input type="number" data-i="${i}" data-k="costo" min="0" step="1000" value="${num(m.costo)}" />
              </div>
              <div>
                <label>Emoji (si no hay foto)</label>
                <input type="text" data-i="${i}" data-k="icono" value="${attr(m.icono)}" maxlength="4" />
              </div>
              <div>
                <label>Período</label>
                <input type="text" data-i="${i}" data-k="periodo" value="${attr(m.periodo || "mes")}" placeholder="mes" />
              </div>
            </div>
          </div>
        </div>
        <div class="item__actions">
          <label class="chk"><input type="checkbox" data-i="${i}" data-k="recurrente" ${m.recurrente ? "checked" : ""} /> Abono mensual (gasto que se paga todos los meses)</label>
          <span style="flex:1"></span>
          <label class="btn btn--ghost btn--sm filepick">📷 Foto
            <input type="file" accept="image/*" data-i="${i}" />
          </label>
          ${m.foto ? `<button class="btn btn--ghost btn--sm" data-act="rmfoto" data-i="${i}">Quitar foto</button>` : ""}
          <button class="btn btn--ghost btn--sm" data-act="up" data-i="${i}" title="Subir">▲</button>
          <button class="btn btn--ghost btn--sm" data-act="down" data-i="${i}" title="Bajar">▼</button>
          <button class="btn btn--danger btn--sm" data-act="del" data-i="${i}">Eliminar</button>
        </div>
      </div>`;
    }).join("");
  }

  function bindItems() {
    const cont = $("#items");
    cont.addEventListener("input", (e) => {
      const el = e.target;
      const i = el.getAttribute("data-i"), k = el.getAttribute("data-k");
      if (i == null || k == null) return;
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (k === "costo") v = num(v);
      state.data.mejoras[+i][k] = v;
      saveDraft();
    });
    cont.addEventListener("change", (e) => {
      const el = e.target;
      if (el.matches('input[type=file]')) {
        const i = +el.getAttribute("data-i");
        const file = el.files && el.files[0];
        if (file) handlePhoto(i, file);
        el.value = "";
      }
    });
    cont.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const i = +b.getAttribute("data-i"), act = b.getAttribute("data-act");
      const arr = state.data.mejoras;
      if (act === "del") { if (confirm("¿Eliminar este ítem?")) arr.splice(i, 1); }
      else if (act === "up" && i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; }
      else if (act === "down" && i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; }
      else if (act === "rmfoto") { arr[i].foto = ""; }
      renderItems(); saveDraft();
    });
    $("#add-item").addEventListener("click", () => {
      state.data.mejoras.push({ icono: "🏉", foto: "", titulo: "", mejora: "", costo: 0, recurrente: false, periodo: "mes" });
      renderItems(); saveDraft();
      $("#items").lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handlePhoto(i, file) {
    toast("Procesando foto…");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1000;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        try {
          state.data.mejoras[i].foto = canvas.toDataURL("image/jpeg", 0.82);
          renderItems(); saveDraft();
          toast("Foto cargada ✓");
        } catch (e) { toast("No se pudo procesar la foto"); }
      };
      img.onerror = () => toast("Archivo de imagen inválido");
      img.src = reader.result;
    };
    reader.onerror = () => toast("No se pudo leer el archivo");
    reader.readAsDataURL(file);
  }

  /* ---------- Transparencia ---------- */
  function renderTransp() {
    $("#transp").innerHTML = state.data.transparencia.map((t, i) => `
      <div style="display:flex;gap:.5rem;margin-bottom:.5rem">
        <input type="text" data-i="${i}" value="${attr(t)}" style="flex:1" />
        <button class="btn btn--danger btn--sm" data-act="del" data-i="${i}">✕</button>
      </div>`).join("");
  }
  function bindTransp() {
    const cont = $("#transp");
    cont.addEventListener("input", (e) => {
      const i = e.target.getAttribute("data-i");
      if (i == null) return;
      state.data.transparencia[+i] = e.target.value;
      saveDraft();
    });
    cont.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act=del]");
      if (!b) return;
      state.data.transparencia.splice(+b.getAttribute("data-i"), 1);
      renderTransp(); saveDraft();
    });
    $("#add-transp").addEventListener("click", () => {
      state.data.transparencia.push("");
      renderTransp(); saveDraft();
    });
  }

  /* ---------- Campos estáticos (meta, donar, textos) ---------- */
  function bindStatic() {
    const on = (id, fn) => $(id).addEventListener("input", (e) => { fn(e.target); saveDraft(); });

    on("#m-objetivo", (el) => state.meta.objetivo = num(el.value));
    on("#m-recaudado", (el) => state.meta.recaudado = num(el.value));
    on("#m-donantes", (el) => state.meta.donantes = num(el.value));

    on("#mp-activo", (el) => state.data.donar.mercadopago.activo = el.checked);
    on("#mp-url", (el) => state.data.donar.mercadopago.url = el.value);
    on("#tr-activo", (el) => state.data.donar.transferencia.activo = el.checked);
    on("#tr-alias", (el) => state.data.donar.transferencia.alias = el.value);
    on("#tr-cbu", (el) => state.data.donar.transferencia.cbu = el.value);
    on("#tr-titular", (el) => state.data.donar.transferencia.titular = el.value);

    on("#h-titulo", (el) => state.data.hero.titulo = el.value);
    on("#h-bajada", (el) => state.data.hero.bajada = el.value);
    on("#h-eyebrow", (el) => state.data.hero.eyebrow = el.value);
    on("#c-ig", (el) => state.data.club.instagram = el.value);
    on("#c-fb", (el) => state.data.club.facebook = el.value);
    on("#c-yt", (el) => state.data.club.canalYoutube = el.value);
  }

  /* ---------- Exportar ---------- */
  function download(filename, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy(text) {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      else throw 0;
      toast("Copiado al portapapeles ✓");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Copiado ✓"); } catch (e2) { toast("No se pudo copiar"); }
      ta.remove();
    }
  }
  function metaJSON() {
    // fecha/hora actual (sirve para el "actualizado hace X")
    state.meta.actualizado = new Date().toISOString();
    return JSON.stringify({
      objetivo: num(state.meta.objetivo),
      recaudado: num(state.meta.recaudado),
      donantes: num(state.meta.donantes),
      actualizado: state.meta.actualizado
    }, null, 2) + "\n";
  }
  function dataJSON() {
    return JSON.stringify(state.data, null, 2) + "\n";
  }

  function bindExport() {
    $("#dl-meta").addEventListener("click", () => { download("meta.json", metaJSON()); saveDraft(); toast("meta.json descargado ⬇️"); });
    $("#copy-meta").addEventListener("click", () => copy(metaJSON()));
    $("#dl-data").addEventListener("click", () => { download("data.json", dataJSON()); toast("data.json descargado ⬇️"); });
    $("#copy-data").addEventListener("click", () => copy(dataJSON()));
    $("#reset").addEventListener("click", () => {
      if (confirm("Esto borra el borrador guardado en este navegador y vuelve a los datos publicados. ¿Seguir?")) {
        localStorage.removeItem(DRAFT_KEY);
        location.reload();
      }
    });
  }

  /* ---------- Contraseña / candado ---------- */
  let currentHash = DEFAULT_HASH;
  let appReady = false;

  async function loadAuthHash() {
    try {
      const r = await fetch(AUTH_SOURCE + "?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && j.hash) currentHash = String(j.hash).toLowerCase();
      }
    } catch (e) { /* usa DEFAULT_HASH */ }
  }

  async function initApp() {
    if (appReady) return;
    appReady = true;
    await load();
    fillForm();
    bindStatic();
    bindItems();
    bindTransp();
    bindExport();
  }

  function unlock() {
    document.body.classList.remove("locked");
    initApp();
  }

  function setupGate() {
    // ¿Ya se validó en esta pestaña?
    if (sessionStorage.getItem(SESSION_KEY) === currentHash) {
      unlock();
      return;
    }
    const form = $("#gate-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = $("#gate-pass").value || "";
      if (hashPassword(val) === currentHash) {
        try { sessionStorage.setItem(SESSION_KEY, currentHash); } catch (e2) {}
        $("#gate-err").textContent = "";
        unlock();
      } else {
        $("#gate-err").textContent = "Contraseña incorrecta.";
        $("#gate-pass").select();
      }
    });
  }

  // Cambiar contraseña: genera el nuevo auth.json para subir al repo
  function bindChangePassword() {
    $("#btn-pass").addEventListener("click", () => {
      const nueva = prompt("Escribí la nueva contraseña para el panel:");
      if (nueva == null) return;
      if (nueva.length < 6) { alert("Poné una contraseña de al menos 6 caracteres."); return; }
      const nueva2 = prompt("Repetí la nueva contraseña:");
      if (nueva2 == null) return;
      if (nueva !== nueva2) { alert("No coinciden. Probá de nuevo."); return; }
      const hash = hashPassword(nueva);
      const json = JSON.stringify({ hash: hash }, null, 2) + "\n";
      download("auth.json", json);
      // Actualiza la sesión actual para no quedar afuera
      currentHash = hash;
      try { sessionStorage.setItem(SESSION_KEY, hash); } catch (e) {}
      toast("Descargué auth.json ⬇️");
      alert("Listo. Descargué el archivo 'auth.json' con la nueva contraseña.\n\nSubilo al repositorio (reemplazando el que está) o pasámelo, y desde ese momento la nueva contraseña queda activa para todos.");
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    await loadAuthHash();
    setupGate();
    bindChangePassword();
  });
})();
