/* =====================================================================
   overlay.js — Overlay para OBS. Lee las donaciones CONFIRMADAS de
   Firebase en tiempo real y muestra, según ?modo=:
     ?modo=alerta  -> pop-up animado al entrar una donación nueva
     ?modo=muro    -> lista de quienes bancan el streaming
     ?modo=ticker  -> franja inferior que va pasando los nombres
     ?modo=todo    -> los tres juntos (para previsualizar)
   Fondo transparente: agregalo en OBS como "Browser Source".
   ===================================================================== */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const modo = (params.get("modo") || "alerta").toLowerCase();
  const LIMIT = Math.max(1, Math.min(30, Number(params.get("limit")) || 8));
  document.body.classList.add("modo-" + (["alerta", "muro", "ticker", "todo"].indexOf(modo) >= 0 ? modo : "alerta"));

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pesos = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
  const tsMillis = (v) => (v && typeof v.toMillis === "function") ? v.toMillis() : (v ? (new Date(v).getTime() || 0) : 0);

  /* ---------- Alertas (cola) ---------- */
  let queue = [], showing = false;
  function enqueue(d) { queue.push(d); if (!showing) next(); }
  function next() {
    if (!queue.length) { showing = false; return; }
    showing = true;
    const d = queue.shift();
    const el = $("#alerta");
    const monto = Number(d.monto) > 0 ? `<div class="alert-amount">${pesos(d.monto)}</div>` : "";
    const msg = d.mensaje ? `<div class="alert-msg">“${esc(d.mensaje)}”</div>` : "";
    el.innerHTML = `<div class="alert-card">
        <img class="alert-logo" src="assets/escudo.png" alt="" />
        <div><div class="alert-title">¡Gracias ${esc(d.nombre)}! 💛</div>${monto}${msg}</div>
      </div>`;
    // reflow para reiniciar la animación
    void el.offsetWidth;
    el.classList.add("show");
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(next, 700);
    }, 7000);
  }

  /* ---------- Muro ---------- */
  function renderMuro(arr) {
    const cont = $("#muro-body");
    if (!cont) return;
    if (!arr.length) { cont.innerHTML = ""; return; }
    cont.innerHTML = arr.slice(0, LIMIT).map((d) => {
      const amt = Number(d.monto) > 0 ? `<span class="muro-row__amount">${pesos(d.monto)}</span>` : "";
      const msg = d.mensaje ? `<div class="muro-row__msg">“${esc(d.mensaje)}”</div>` : "";
      return `<div class="muro-row"><div class="muro-row__top"><span class="muro-row__name">${esc(d.nombre)}</span>${amt}</div>${msg}</div>`;
    }).join("");
  }

  /* ---------- Ticker ---------- */
  function renderTicker(arr) {
    const track = $("#ticker-track");
    if (!track) return;
    if (!arr.length) { track.innerHTML = ""; return; }
    const one = arr.map((d) => {
      const amt = Number(d.monto) > 0 ? `<span class="amt">${pesos(d.monto)}</span>` : "";
      const msg = d.mensaje ? `: “${esc(d.mensaje)}”` : "";
      return `<span class="tk"><b>${esc(d.nombre)}</b> ${amt}${msg}</span>`;
    }).join("");
    // duplicado para loop continuo
    track.innerHTML = one + one;
  }

  /* ---------- Conexión ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const { db, fs } = await window.fbLoad(false);
      let primera = true;
      fs.onSnapshot(fs.query(fs.collection(db, "donaciones"), fs.where("estado", "==", "confirmada")),
        (qs) => {
          // Alertas: donaciones que ENTRAN como confirmadas (no en la primera carga)
          if (!primera && (modo === "alerta" || modo === "todo")) {
            qs.docChanges().forEach((ch) => { if (ch.type === "added") enqueue(ch.doc.data()); });
          }
          primera = false;
          // Muro y ticker: snapshot completo, más nuevas primero
          const arr = qs.docs.map((d) => d.data());
          arr.sort((a, b) => tsMillis(b.confirmadaEn || b.creadoEn) - tsMillis(a.confirmadaEn || a.creadoEn));
          renderMuro(arr);
          renderTicker(arr.slice(0, 20));
        }, (e) => { console.error("overlay:", e); });
    } catch (e) {
      console.error("No se pudo conectar el overlay a Firebase:", e);
    }
  });
})();
