/* =====================================================================
   app.js — Arma la página desde data.json y actualiza la meta en vivo
   leyendo meta.json. No hace falta editar este archivo para cambiar el
   contenido: usá el panel de carga (admin.html) o editá los .json.
   ===================================================================== */
(function () {
  "use strict";

  const CONFIG = {
    dataSource: "data.json", // contenido (mejoras, textos, donación)
    metaSource: "meta.json", // meta en vivo (recaudado, donantes, objetivo)
    pollSeconds: 20          // cada cuánto se recarga la meta
  };

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const pesos = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");

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

  /* ---------- Contenido (desde data.json) ---------- */
  function renderStatic(D) {
    // Hero
    $("#hero-eyebrow").textContent = D.hero.eyebrow || "";
    $("#hero-title").textContent = D.hero.titulo || "";
    $("#hero-lead").textContent = D.hero.bajada || "";

    // Por qué
    $("#porque-grid").innerHTML = (D.porQue || [])
      .map(
        (p) => `
        <article class="pq">
          <div class="pq__icon">${esc(p.icono)}</div>
          <h3>${esc(p.titulo)}</h3>
          <p>${esc(p.texto)}</p>
        </article>`
      )
      .join("");

    // Mejoras / ítems
    $("#mejoras-grid").innerHTML = (D.mejoras || [])
      .map((m) => {
        const media = m.foto
          ? `<div class="card__media"><img src="${esc(m.foto)}" alt="${esc(m.titulo)}" loading="lazy" /></div>`
          : `<div class="card__media card__media--empty"><span>${esc(m.icono || "🏉")}</span></div>`;
        const badge = m.recurrente ? `<span class="card__tag">Mensual</span>` : "";
        const costo = m.recurrente
          ? `<div class="card__cost"><small>Abono ${esc(m.periodo || "mes")}</small>${pesos(m.costo)} <span class="per">/ ${esc(m.periodo || "mes")}</span></div>`
          : `<div class="card__cost"><small>Costo estimado</small>${pesos(m.costo)}</div>`;
        return `
        <article class="card">
          ${media}
          <div class="card__body">
            <div class="card__head">${badge}<h3>${esc(m.titulo)}</h3></div>
            <p>${esc(m.mejora)}</p>
            ${costo}
          </div>
        </article>`;
      })
      .join("");

    // Totales: por única vez + mensual
    const items = D.mejoras || [];
    const unaVez = items.filter((m) => !m.recurrente).reduce((a, m) => a + (Number(m.costo) || 0), 0);
    const mensual = items.filter((m) => m.recurrente).reduce((a, m) => a + (Number(m.costo) || 0), 0);
    let totalHTML = `<div class="mejoras__total-row"><span>Equipamiento (por única vez)</span><b>${pesos(unaVez)}</b></div>`;
    if (mensual > 0) {
      totalHTML += `<div class="mejoras__total-row mejoras__total-row--sub"><span>Gastos mensuales</span><b>${pesos(mensual)} <em>/ mes</em></b></div>`;
    }
    $("#mejoras-total").innerHTML = totalHTML;

    // Cómo donar
    renderDonar(D.donar || {});

    // Transparencia
    $("#transparencia-list").innerHTML = (D.transparencia || [])
      .map((t) => `<li>${esc(t)}</li>`)
      .join("");

    // Footer
    $("#footer-club").textContent = D.club.nombre || "";
    $("#footer-club-long").textContent = D.club.nombreLargo || "";
    const soc = [];
    if (D.club.instagram) soc.push(`<a href="${esc(D.club.instagram)}" target="_blank" rel="noopener">📷 Instagram</a>`);
    if (D.club.facebook) soc.push(`<a href="${esc(D.club.facebook)}" target="_blank" rel="noopener">👍 Facebook</a>`);
    if (D.club.canalYoutube) soc.push(`<a href="${esc(D.club.canalYoutube)}" target="_blank" rel="noopener">▶️ Ver el streaming</a>`);
    $("#footer-social").innerHTML = soc.join("");
  }

  function renderDonar(d) {
    const cards = [];
    if (d.mercadopago && d.mercadopago.activo) {
      const mp = d.mercadopago;
      cards.push(`
        <article class="dcard">
          <div class="dcard__badge">💳</div>
          <h3>${esc(mp.titulo)}</h3>
          <p>${esc(mp.descripcion)}</p>
          <a href="${esc(mp.url)}" target="_blank" rel="noopener" class="btn btn--gold btn--block">Donar con MercadoPago</a>
        </article>`);
    }
    if (d.transferencia && d.transferencia.activo) {
      const tr = d.transferencia;
      cards.push(`
        <article class="dcard">
          <div class="dcard__badge">🏦</div>
          <h3>${esc(tr.titulo)}</h3>
          <p>${esc(tr.descripcion)}</p>
          <div class="field">
            <div>
              <div class="field__label">Alias</div>
              <div class="field__value">${esc(tr.alias)}</div>
            </div>
            <button class="copy" data-copy="${esc(tr.alias)}">Copiar</button>
          </div>
          <div class="field">
            <div>
              <div class="field__label">CBU / CVU</div>
              <div class="field__value">${esc(tr.cbu)}</div>
            </div>
            <button class="copy" data-copy="${esc(tr.cbu)}">Copiar</button>
          </div>
          <p class="dcard__titular">Titular: ${esc(tr.titular)}</p>
        </article>`);
    }
    $("#donar-grid").innerHTML = cards.join("");

    document.querySelectorAll(".copy").forEach((btn) => {
      btn.addEventListener("click", () => copiar(btn.getAttribute("data-copy"), btn));
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
    $("#meta-updated").textContent = meta.actualizado ? "Actualizado " + haceCuanto(meta.actualizado) : "";

    requestAnimationFrame(() => {
      $("#bar-fill").style.width = pct + "%";
      $("#bar").setAttribute("aria-valuenow", String(Math.round(pct)));
    });
  }

  async function cargarJSON(url) {
    const res = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function cargarMeta() {
    try {
      pintarMeta(await cargarJSON(CONFIG.metaSource));
    } catch (e) {
      $("#meta-updated").textContent = "No se pudo leer la meta";
    }
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      renderStatic(await cargarJSON(CONFIG.dataSource));
    } catch (e) {
      console.error("No se pudo cargar data.json:", e);
      const grid = $("#mejoras-grid");
      if (grid) grid.innerHTML = "<p style='text-align:center;color:#c00'>No se pudo cargar el contenido. Si estás abriendo el archivo directamente, usá un servidor (ver README).</p>";
    }
    cargarMeta();
    const seg = Math.max(5, Number(CONFIG.pollSeconds) || 20);
    setInterval(cargarMeta, seg * 1000);
  });
})();
