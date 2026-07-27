/* =====================================================================
   app.js — Web pública. Lee el contenido y la meta desde Firebase
   (Firestore) EN VIVO. Si Firebase no está disponible, usa los
   archivos JSON como respaldo, así la web nunca queda vacía.
   ===================================================================== */
(function () {
  "use strict";

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

  async function getJSON(url) {
    const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  let _json = null;
  async function jsonData() {
    if (!_json) { try { _json = await getJSON("data.json"); } catch (e) { _json = {}; } }
    return _json;
  }

  /* ---------- Render: contenido ---------- */
  function renderContenido(D) {
    D = D || {};
    const hero = D.hero || {}, club = D.club || {};
    $("#hero-eyebrow").textContent = hero.eyebrow || "";
    $("#hero-title").textContent = hero.titulo || "";
    $("#hero-lead").textContent = hero.bajada || "";

    $("#porque-grid").innerHTML = (D.porQue || [])
      .map((p) => `
        <article class="pq">
          <div class="pq__icon">${esc(p.icono)}</div>
          <h3>${esc(p.titulo)}</h3>
          <p>${esc(p.texto)}</p>
        </article>`).join("");

    renderDonar(D.donar || {});

    $("#transparencia-list").innerHTML = (D.transparencia || [])
      .map((t) => `<li>${esc(t)}</li>`).join("");

    $("#footer-club").textContent = club.nombre || "";
    $("#footer-club-long").textContent = club.nombreLargo || "";
    const soc = [];
    if (club.instagram) soc.push(`<a href="${esc(club.instagram)}" target="_blank" rel="noopener">📷 Instagram</a>`);
    if (club.facebook) soc.push(`<a href="${esc(club.facebook)}" target="_blank" rel="noopener">👍 Facebook</a>`);
    if (club.canalYoutube) soc.push(`<a href="${esc(club.canalYoutube)}" target="_blank" rel="noopener">▶️ Ver el streaming</a>`);
    $("#footer-social").innerHTML = soc.join("");
  }

  /* ---------- Render: mejoras ---------- */
  function renderMejoras(items) {
    items = items || [];
    $("#mejoras-grid").innerHTML = items.map((m) => {
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
    }).join("");

    const unaVez = items.filter((m) => !m.recurrente).reduce((a, m) => a + (Number(m.costo) || 0), 0);
    const mensual = items.filter((m) => m.recurrente).reduce((a, m) => a + (Number(m.costo) || 0), 0);
    let html = `<div class="mejoras__total-row"><span>Equipamiento (por única vez)</span><b>${pesos(unaVez)}</b></div>`;
    if (mensual > 0) {
      html += `<div class="mejoras__total-row mejoras__total-row--sub"><span>Gastos mensuales</span><b>${pesos(mensual)} <em>/ mes</em></b></div>`;
    }
    $("#mejoras-total").innerHTML = html;
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
            <div><div class="field__label">Alias</div><div class="field__value">${esc(tr.alias)}</div></div>
            <button class="copy" data-copy="${esc(tr.alias)}">Copiar</button>
          </div>
          <div class="field">
            <div><div class="field__label">CBU / CVU</div><div class="field__value">${esc(tr.cbu)}</div></div>
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
    } else { fallbackCopy(txt, done); }
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
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
  }

  /* ---------- Meta ---------- */
  function pintarMeta(meta) {
    meta = meta || {};
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

  /* ---------- Respaldo por JSON ---------- */
  async function fallbackTodo() {
    const d = await jsonData();
    renderContenido(d);
    renderMejoras(d.mejoras || []);
    try { pintarMeta(await getJSON("meta.json")); } catch (e) {}
  }

  /* ---------- Meta derivada (base + donaciones confirmadas) ---------- */
  let metaBase = null;
  let confSum = 0, confCount = 0, lastConf = "";
  function recomputeMeta() {
    if (!metaBase) return;
    pintarMeta({
      objetivo: metaBase.objetivo,
      recaudado: (Number(metaBase.recaudado) || 0) + confSum,
      donantes: (Number(metaBase.donantes) || 0) + confCount,
      actualizado: lastConf || metaBase.actualizado
    });
  }

  /* ---------- Muro de donantes ---------- */
  function tsMillis(v) {
    if (!v) return 0;
    if (typeof v.toMillis === "function") return v.toMillis();
    const t = new Date(v).getTime(); return isNaN(t) ? 0 : t;
  }
  function renderMuro(donaciones) {
    const sec = $("#muro");
    if (!donaciones.length) { sec.hidden = true; return; }
    sec.hidden = false;
    $("#muro-list").innerHTML = donaciones.map((d) => {
      const monto = Number(d.monto) > 0 ? `<span class="donor__amount">${pesos(d.monto)}</span>` : "";
      const msg = d.mensaje ? `<div class="donor__msg">“${esc(d.mensaje)}”</div>` : "";
      return `<div class="donor"><div class="donor__top"><span class="donor__name">${esc(d.nombre)}</span>${monto}</div>${msg}</div>`;
    }).join("");
  }

  /* ---------- Firebase (cacheado) ---------- */
  let FB = null;
  async function fb() { if (!FB) FB = await window.fbLoad(false); return FB; }

  /* ---------- Formulario "dejá tu saludo" ---------- */
  function bindDonForm() {
    const form = $("#don-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = ($("#don-nombre").value || "").trim();
      const mensaje = ($("#don-mensaje").value || "").trim();
      const monto = Math.max(0, Math.round(Number($("#don-monto").value) || 0));
      const metodo = $("#don-metodo").value || "otro";
      const msg = $("#don-msg");
      if (!nombre) { msg.className = "donform__msg err"; msg.textContent = "Poné tu nombre 🙂"; return; }
      const btn = $("#don-send"); btn.disabled = true; const prev = btn.textContent; btn.textContent = "Enviando…";
      try {
        const { db, fs } = await fb();
        await fs.addDoc(fs.collection(db, "donaciones"), {
          nombre: nombre.slice(0, 40), mensaje: mensaje.slice(0, 200), monto: monto,
          metodo: metodo, estado: "pendiente", creadoEn: fs.serverTimestamp()
        });
        form.reset();
        msg.className = "donform__msg ok";
        msg.textContent = "¡Gracias! Tu saludo aparecerá cuando confirmemos tu aporte. 💛";
      } catch (err) {
        console.error(err);
        msg.className = "donform__msg err";
        msg.textContent = "No se pudo enviar. Probá de nuevo en un momento.";
      } finally { btn.disabled = false; btn.textContent = prev; }
    });
  }

  /* ---------- Init ----------
     1) Pinta al instante desde los JSON (respaldo): la web nunca queda en blanco.
     2) Conecta a Firebase para datos EN VIVO; si llega, reemplaza. */
  document.addEventListener("DOMContentLoaded", async () => {
    bindDonForm();
    await fallbackTodo();
    conectarEnVivo();
  });

  async function conectarEnVivo() {
    try {
      const { db, fs } = await fb();
      fs.onSnapshot(fs.doc(db, "config", "meta"),
        (snap) => { if (snap.exists()) { metaBase = snap.data(); recomputeMeta(); } }, () => {});
      fs.onSnapshot(fs.doc(db, "config", "contenido"),
        (snap) => { if (snap.exists()) renderContenido(snap.data()); }, () => {});
      fs.onSnapshot(fs.query(fs.collection(db, "mejoras"), fs.orderBy("orden")),
        (qs) => { if (!qs.empty) renderMejoras(qs.docs.map((d) => d.data())); }, () => {});
      // Donaciones confirmadas -> muro + meta en vivo
      fs.onSnapshot(fs.query(fs.collection(db, "donaciones"), fs.where("estado", "==", "confirmada")),
        (qs) => {
          const arr = qs.docs.map((d) => d.data());
          arr.sort((a, b) => tsMillis(b.confirmadaEn || b.creadoEn) - tsMillis(a.confirmadaEn || a.creadoEn));
          confSum = arr.reduce((s, d) => s + (Number(d.monto) || 0), 0);
          confCount = arr.length;
          const nv = arr[0] && (arr[0].confirmadaEn || arr[0].creadoEn);
          lastConf = nv && typeof nv.toDate === "function" ? nv.toDate().toISOString() : lastConf;
          renderMuro(arr);
          recomputeMeta();
        }, () => {});
    } catch (e) {
      console.warn("Firebase no disponible; queda el respaldo por JSON.", e);
    }
  }
})();
