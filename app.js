/* =====================================================================
   app.js — Arma la página desde data.js y actualiza la meta en vivo.
   ===================================================================== */
(function () {
  "use strict";

  const D = window.DATA;
  const C = window.CONFIG;

  /* ---------- Helpers ---------- */
  const $ = (sel) => document.querySelector(sel);
  const pesos = (n) =>
    "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");

  function haceCuanto(iso) {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    const seg = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (seg < 60) return "recién";
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const hs = Math.floor(min / 60);
    if (hs < 24) return `hace ${hs} h`;
    const dias = Math.floor(hs / 24);
    return `hace ${dias} día${dias > 1 ? "s" : ""}`;
  }

  /* ---------- Contenido estático (desde data.js) ---------- */
  function renderStatic() {
    // Hero
    $("#hero-eyebrow").textContent = D.hero.eyebrow;
    $("#hero-title").textContent = D.hero.titulo;
    $("#hero-lead").textContent = D.hero.bajada;

    // Por qué
    $("#porque-grid").innerHTML = D.porQue
      .map(
        (p) => `
        <article class="pq">
          <div class="pq__icon">${p.icono}</div>
          <h3>${p.titulo}</h3>
          <p>${p.texto}</p>
        </article>`
      )
      .join("");

    // Mejoras
    $("#mejoras-grid").innerHTML = D.mejoras
      .map(
        (m) => `
        <article class="card">
          <div class="card__icon">${m.icono}</div>
          <h3>${m.titulo}</h3>
          <p>${m.mejora}</p>
          <div class="card__cost"><small>Costo estimado</small>${pesos(m.costo)}</div>
        </article>`
      )
      .join("");

    // Total de mejoras
    const total = D.mejoras.reduce((a, m) => a + (Number(m.costo) || 0), 0);
    $("#mejoras-total").textContent = pesos(total);

    // Cómo donar
    renderDonar();

    // Transparencia
    $("#transparencia-list").innerHTML = D.transparencia
      .map((t) => `<li>${t}</li>`)
      .join("");

    // Footer
    $("#footer-club").textContent = D.club.nombre;
    $("#footer-club-long").textContent = D.club.nombreLargo;
    const soc = [];
    if (D.club.instagram) soc.push(`<a href="${D.club.instagram}" target="_blank" rel="noopener">📷 Instagram</a>`);
    if (D.club.facebook) soc.push(`<a href="${D.club.facebook}" target="_blank" rel="noopener">👍 Facebook</a>`);
    if (D.club.canalYoutube) soc.push(`<a href="${D.club.canalYoutube}" target="_blank" rel="noopener">▶️ Ver el streaming</a>`);
    $("#footer-social").innerHTML = soc.join("");
  }

  function renderDonar() {
    const d = D.donar;
    const cards = [];

    if (d.mercadopago && d.mercadopago.activo) {
      const mp = d.mercadopago;
      cards.push(`
        <article class="dcard">
          <div class="dcard__badge">💳</div>
          <h3>${mp.titulo}</h3>
          <p>${mp.descripcion}</p>
          <a href="${mp.url}" target="_blank" rel="noopener" class="btn btn--gold btn--block">Donar con MercadoPago</a>
        </article>`);
    }

    if (d.transferencia && d.transferencia.activo) {
      const tr = d.transferencia;
      cards.push(`
        <article class="dcard">
          <div class="dcard__badge">🏦</div>
          <h3>${tr.titulo}</h3>
          <p>${tr.descripcion}</p>
          <div class="field">
            <div>
              <div class="field__label">Alias</div>
              <div class="field__value">${tr.alias}</div>
            </div>
            <button class="copy" data-copy="${tr.alias}">Copiar</button>
          </div>
          <div class="field">
            <div>
              <div class="field__label">CBU / CVU</div>
              <div class="field__value">${tr.cbu}</div>
            </div>
            <button class="copy" data-copy="${tr.cbu}">Copiar</button>
          </div>
          <p class="dcard__titular">Titular: ${tr.titular}</p>
        </article>`);
    }

    $("#donar-grid").innerHTML = cards.join("");

    // Botones de copiar
    document.querySelectorAll(".copy").forEach((btn) => {
      btn.addEventListener("click", () => {
        const txt = btn.getAttribute("data-copy");
        copiar(txt, btn);
      });
    });
  }

  function copiar(txt, btn) {
    const done = () => {
      toast("¡Copiado! 📋");
      const prev = btn.textContent;
      btn.textContent = "✓ Copiado";
      setTimeout(() => (btn.textContent = prev), 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
    } else {
      fallbackCopy(txt, done);
    }
  }
  function fallbackCopy(txt, done) {
    const ta = document.createElement("textarea");
    ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
  }

  /* ---------- META EN VIVO ---------- */
  function pintarMeta(meta) {
    const objetivo = Number(meta.objetivo) || 0;
    const recaudado = Number(meta.recaudado) || 0;
    const donantes = Number(meta.donantes) || 0;
    const pct = objetivo > 0 ? Math.min(100, (recaudado / objetivo) * 100) : 0;
    const falta = Math.max(0, objetivo - recaudado);

    $("#meta-raised").textContent = pesos(recaudado);
    $("#meta-goal").textContent = pesos(objetivo);
    $("#meta-percent").textContent = Math.round(pct) + "%";
    $("#meta-donors").textContent = donantes.toLocaleString("es-AR");
    $("#meta-remaining").textContent = pesos(falta);
    $("#meta-updated").textContent = meta.actualizado
      ? "Actualizado " + haceCuanto(meta.actualizado)
      : "";

    const bar = $("#bar");
    // pequeño delay para que se vea la animación de llenado
    requestAnimationFrame(() => {
      $("#bar-fill").style.width = pct + "%";
      bar.setAttribute("aria-valuenow", String(Math.round(pct)));
    });
  }

  async function cargarMeta() {
    try {
      const url = C.metaSource + "?t=" + Date.now(); // evita caché
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const meta = await res.json();
      pintarMeta(meta);
    } catch (e) {
      // Si no se puede leer meta.json (ej: abierto como archivo local), usa el respaldo.
      pintarMeta(C.metaFallback);
      $("#meta-updated").textContent = "Actualizado " + haceCuanto(C.metaFallback.actualizado);
    }
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    renderStatic();
    cargarMeta();
    // Poll para el "tiempo real": vuelve a leer la meta cada X segundos.
    const seg = Math.max(5, Number(C.pollSeconds) || 20);
    setInterval(cargarMeta, seg * 1000);
  });
})();
