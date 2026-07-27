/* =====================================================================
   admin.js — Panel de carga con LOGIN REAL (Firebase Auth) y guardado
   directo en Firestore. Ya no hace falta bajar/subir archivos.
   ===================================================================== */
(function () {
  "use strict";

  // Piezas de Firebase (se cargan en init)
  let db = null, fs = null, auth = null, authMod = null;

  // Estado en memoria del formulario
  let state = { data: null, meta: null };
  let loadedMejoraIds = new Set(); // ids de mejoras que existen en Firestore
  let dirty = false;

  const DEFAULTS = {
    data: {
      club: { nombre: "CEC Liceo Militar", nombreLargo: "", canalYoutube: "", instagram: "", facebook: "" },
      hero: { eyebrow: "Streaming del club", titulo: "", bajada: "" },
      textos: {},
      porQue: [],
      mejoras: [],
      donar: {
        mercadopago: { activo: true, titulo: "MercadoPago", descripcion: "Con tarjeta, débito o dinero en cuenta. Es la forma más rápida.", url: "" },
        transferencia: { activo: true, titulo: "Transferencia bancaria", descripcion: "Sin comisiones. Copiá el alias y transferí desde tu banco o billetera.", alias: "", cbu: "", titular: "" }
      },
      transparencia: []
    },
    meta: { objetivo: 0, recaudado: 0, donantes: 0, actualizado: "", moneda: "ARS", objetivoModo: "manual" }
  };

  /* ---------- Helpers ---------- */
  const $ = (s) => document.querySelector(s);
  const attr = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const num = (v) => Math.max(0, Math.round(Number(v) || 0));
  const pesos = (n) => ((state.meta && state.meta.moneda === "USD") ? "US$ " : "$") + num(n).toLocaleString("es-AR");
  let RATE = 0;
  const conv = (n, from, to) => { n = num(n); if (!RATE || from === to) return n; return from === "USD" ? n * RATE : n / RATE; };
  function autoObjetivo() {
    const cur = (state.meta && state.meta.moneda === "USD") ? "USD" : "ARS";
    return Math.round((state.data && state.data.mejoras || []).reduce((a, m) => a + conv(m.costo, m.moneda === "USD" ? "USD" : "ARS", cur), 0));
  }
  const esAuto = () => !!(state.meta && state.meta.objetivoModo === "auto");
  const objetivoActual = () => esAuto() ? autoObjetivo() : num(state.meta && state.meta.objetivo);
  function refreshObjetivo() {
    const inp = $("#m-objetivo");
    if (!inp) return;
    if (esAuto()) { inp.value = autoObjetivo(); inp.disabled = true; } else { inp.disabled = false; }
  }
  const tsMillis = (v) => (v && typeof v.toMillis === "function") ? v.toMillis() : (v ? (new Date(v).getTime() || 0) : 0);

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function markDirty() {
    dirty = true;
    $("#draft-status").textContent = "Cambios sin guardar";
    $("#draft-status").style.background = "rgba(245,180,30,.25)";
    refreshObjetivo();
    actualizarPreviewMeta();
  }
  function markClean() {
    dirty = false;
    $("#draft-status").textContent = "Todo guardado ✓";
    $("#draft-status").style.background = "rgba(22,163,74,.3)";
  }

  async function getJSON(url) {
    const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  function withTimeout(promise, ms, msg) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(msg || "timeout")), ms))
    ]);
  }

  /* ---------- Cargar datos (Firestore, con semilla de los JSON) ---------- */
  async function loadData() {
    let seed = {}, seedMeta = {};
    try { seed = await getJSON("data.json"); } catch (e) {}
    try { seedMeta = await getJSON("meta.json"); } catch (e) {}

    state = { data: JSON.parse(JSON.stringify(DEFAULTS.data)), meta: JSON.parse(JSON.stringify(DEFAULTS.meta)) };

    // meta
    const mSnap = await fs.getDoc(fs.doc(db, "config", "meta"));
    state.meta = mSnap.exists() ? mSnap.data() : (seedMeta.objetivo != null ? seedMeta : DEFAULTS.meta);
    state.meta.moneda = state.meta.moneda === "USD" ? "USD" : "ARS";
    state.meta.objetivoModo = state.meta.objetivoModo === "auto" ? "auto" : "manual";

    // contenido
    const cSnap = await fs.getDoc(fs.doc(db, "config", "contenido"));
    const c = cSnap.exists() ? cSnap.data() : seed;
    state.data.club = c.club || seed.club || DEFAULTS.data.club;
    state.data.hero = c.hero || seed.hero || DEFAULTS.data.hero;
    state.data.porQue = c.porQue || seed.porQue || [];
    state.data.donar = c.donar || seed.donar || DEFAULTS.data.donar;
    state.data.transparencia = c.transparencia || seed.transparencia || [];
    state.data.textos = c.textos || seed.textos || {};

    // mejoras (colección; un doc por ítem para no chocar con el límite de tamaño)
    loadedMejoraIds = new Set();
    const qs = await fs.getDocs(fs.query(fs.collection(db, "mejoras"), fs.orderBy("orden")));
    if (!qs.empty) {
      state.data.mejoras = qs.docs.map((d) => { loadedMejoraIds.add(d.id); return Object.assign({ _id: d.id }, d.data()); });
    } else {
      state.data.mejoras = (seed.mejoras || []).map((m) => Object.assign({}, m)); // sin _id -> se crean al guardar
    }
  }

  /* ---------- Guardar (Firestore) ---------- */
  async function saveMeta() {
    state.meta.actualizado = new Date().toISOString();
    const modo = esAuto() ? "auto" : "manual";
    await fs.setDoc(fs.doc(db, "config", "meta"), {
      objetivo: modo === "auto" ? autoObjetivo() : num(state.meta.objetivo),
      recaudado: num(state.meta.recaudado),
      donantes: num(state.meta.donantes),
      actualizado: state.meta.actualizado,
      moneda: state.meta.moneda === "USD" ? "USD" : "ARS",
      objetivoModo: modo
    });
  }
  async function saveContenido() {
    await fs.setDoc(fs.doc(db, "config", "contenido"), {
      club: state.data.club,
      hero: state.data.hero,
      porQue: state.data.porQue,
      donar: state.data.donar,
      transparencia: state.data.transparencia,
      textos: state.data.textos || {}
    });
  }
  async function saveMejoras() {
    const items = state.data.mejoras;
    const keep = new Set();
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const payload = {
        orden: i, icono: m.icono || "", foto: m.foto || "", titulo: m.titulo || "",
        mejora: m.mejora || "", costo: num(m.costo), recurrente: !!m.recurrente, periodo: m.periodo || "mes",
        link: m.link || "", logrado: !!m.logrado, moneda: m.moneda === "USD" ? "USD" : "ARS"
      };
      if (m._id) { await fs.setDoc(fs.doc(db, "mejoras", m._id), payload); keep.add(m._id); }
      else { const ref = await fs.addDoc(fs.collection(db, "mejoras"), payload); m._id = ref.id; keep.add(ref.id); }
    }
    for (const id of loadedMejoraIds) { if (!keep.has(id)) await fs.deleteDoc(fs.doc(db, "mejoras", id)); }
    loadedMejoraIds = keep;
  }

  async function guardarTodo() {
    const btn = $("#dl-data");
    btn.disabled = true; const prev = btn.textContent; btn.textContent = "Guardando…";
    try {
      await saveMeta();
      await saveContenido();
      await saveMejoras();
      markClean();
      toast("Guardado ✓ Ya se ve en la web");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar: " + (e && e.message ? e.message : e) + "\n\nRevisá tu conexión y que las reglas de Firestore estén cargadas.");
    } finally { btn.disabled = false; btn.textContent = prev; }
  }
  async function guardarSoloMeta() {
    const btn = $("#dl-meta");
    btn.disabled = true; const prev = btn.textContent; btn.textContent = "Guardando…";
    try { await saveMeta(); markClean(); toast("Meta actualizada ✓ En vivo"); }
    catch (e) { alert("No se pudo guardar la meta: " + (e && e.message ? e.message : e)); }
    finally { btn.disabled = false; btn.textContent = prev; }
  }

  /* ---------- Rellenar formularios ---------- */
  function fillForm() {
    const d = state.data, m = state.meta;
    $("#m-objetivo").value = m.objetivo || 0;
    $("#m-recaudado").value = m.recaudado || 0;
    $("#m-donantes").value = m.donantes || 0;
    setMonedaUI(m.moneda);
    setMetaModoUI(m.objetivoModo);
    refreshObjetivo();

    $("#mp-activo").checked = !!(d.donar.mercadopago && d.donar.mercadopago.activo);
    $("#mp-url").value = (d.donar.mercadopago && d.donar.mercadopago.url) || "";
    $("#tr-activo").checked = !!(d.donar.transferencia && d.donar.transferencia.activo);
    $("#tr-alias").value = (d.donar.transferencia && d.donar.transferencia.alias) || "";
    $("#tr-cbu").value = (d.donar.transferencia && d.donar.transferencia.cbu) || "";
    $("#tr-titular").value = (d.donar.transferencia && d.donar.transferencia.titular) || "";

    $("#h-titulo").value = d.hero.titulo || "";
    $("#h-bajada").value = d.hero.bajada || "";
    $("#h-eyebrow").value = d.hero.eyebrow || "";

    // Textos de secciones
    const t = d.textos || {};
    const sv = (id, v) => { const el = $(id); if (el) el.value = v || ""; };
    sv("#t-porqueTitulo", t.porqueTitulo); sv("#t-porqueSub", t.porqueSub);
    sv("#t-mejorasTitulo", t.mejorasTitulo); sv("#t-mejorasSub", t.mejorasSub);
    sv("#t-donarTitulo", t.donarTitulo); sv("#t-donarSub", t.donarSub);
    sv("#t-saludoTitulo", t.saludoTitulo); sv("#t-saludoTexto", t.saludoTexto);
    sv("#t-muroTitulo", t.muroTitulo); sv("#t-muroSub", t.muroSub);
    sv("#t-saludosTitulo", t.saludosTitulo);
    sv("#t-transparenciaTitulo", t.transparenciaTitulo);
    sv("#t-footerNota", t.footerNota);
    // Textos de los métodos de donación
    sv("#mp-titulo", d.donar.mercadopago && d.donar.mercadopago.titulo);
    sv("#mp-desc", d.donar.mercadopago && d.donar.mercadopago.descripcion);
    sv("#tr-titulo", d.donar.transferencia && d.donar.transferencia.titulo);
    sv("#tr-desc", d.donar.transferencia && d.donar.transferencia.descripcion);
    // Club
    sv("#c-nombre", d.club.nombre); sv("#c-nombreLargo", d.club.nombreLargo);
    sv("#c-ig", d.club.instagram); sv("#c-fb", d.club.facebook); sv("#c-yt", d.club.canalYoutube);

    renderItems();
    renderTransp();
    renderPorque();
    actualizarPreviewMeta();
  }

  /* ---------- "Por qué" (3 puntos) ---------- */
  function renderPorque() {
    const cont = $("#porque-items");
    if (!cont) return;
    cont.innerHTML = state.data.porQue.map((p, i) => `
      <div class="row row--3" style="margin-bottom:.4rem">
        <div><label>Punto ${i + 1} · emoji</label><input type="text" data-pi="${i}" data-pk="icono" value="${attr(p.icono)}" maxlength="4" /></div>
        <div><label>Título</label><input type="text" data-pi="${i}" data-pk="titulo" value="${attr(p.titulo)}" /></div>
        <div><label>Texto</label><input type="text" data-pi="${i}" data-pk="texto" value="${attr(p.texto)}" /></div>
      </div>`).join("");
  }
  function bindPorque() {
    const cont = $("#porque-items");
    if (!cont) return;
    cont.addEventListener("input", (e) => {
      const i = e.target.getAttribute("data-pi"), k = e.target.getAttribute("data-pk");
      if (i == null || k == null) return;
      state.data.porQue[+i][k] = e.target.value; markDirty();
    });
  }

  function actualizarPreviewMeta() {
    const m = state.meta;
    const obj = objetivoActual();
    const pct = obj > 0 ? Math.min(100, (num(m.recaudado) / obj) * 100) : 0;
    $("#metaprev").textContent = `Vista previa: ${pesos(m.recaudado)} de ${pesos(obj)} · ${Math.round(pct)}% · ${num(m.donantes)} donantes${esAuto() ? " · (meta automática)" : ""}`;
  }

  /* ---------- Moneda ---------- */
  function setMonedaUI(m) {
    const cur = m === "USD" ? "USD" : "ARS";
    document.querySelectorAll("#moneda-seg .seg__opt").forEach((o) => o.classList.toggle("is-active", o.getAttribute("data-m") === cur));
  }
  function bindMoneda() {
    const seg = $("#moneda-seg");
    if (!seg) return;
    seg.addEventListener("click", (e) => {
      const b = e.target.closest(".seg__opt"); if (!b) return;
      const m = b.getAttribute("data-m") === "USD" ? "USD" : "ARS";
      if (state.meta) state.meta.moneda = m;
      setMonedaUI(m);
      markDirty();
      renderItems(); renderDonaciones(); actualizarPreviewMeta();
    });
  }

  /* ---------- Modo de meta (manual / automática) ---------- */
  function setMetaModoUI(modo) {
    const cur = modo === "auto" ? "auto" : "manual";
    document.querySelectorAll("#meta-modo-seg .seg__opt").forEach((o) => o.classList.toggle("is-active", o.getAttribute("data-mo") === cur));
  }
  function bindMetaModo() {
    const seg = $("#meta-modo-seg");
    if (!seg) return;
    seg.addEventListener("click", (e) => {
      const b = e.target.closest(".seg__opt"); if (!b) return;
      const modo = b.getAttribute("data-mo") === "auto" ? "auto" : "manual";
      if (state.meta) state.meta.objetivoModo = modo;
      setMetaModoUI(modo);
      refreshObjetivo();
      markDirty();
    });
  }

  /* ---------- Ítems ---------- */
  function renderItems() {
    $("#items").innerHTML = state.data.mejoras.map((m, i) => {
      const thumb = m.foto ? `<img src="${attr(m.foto)}" alt="" />` : `<span>${attr(m.icono || "🏉")}</span>`;
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
              <div><label>Costo</label>
                <div style="display:flex;gap:.35rem">
                  <select data-i="${i}" data-k="moneda" style="width:auto;flex:0 0 auto">
                    <option value="ARS"${m.moneda === "USD" ? "" : " selected"}>$ ARS</option>
                    <option value="USD"${m.moneda === "USD" ? " selected" : ""}>US$ USD</option>
                  </select>
                  <input type="number" data-i="${i}" data-k="costo" min="0" step="1000" value="${num(m.costo)}" style="flex:1;min-width:0" />
                </div>
              </div>
              <div><label>Emoji (si no hay foto)</label><input type="text" data-i="${i}" data-k="icono" value="${attr(m.icono)}" maxlength="4" /></div>
              <div><label>Período</label><input type="text" data-i="${i}" data-k="periodo" value="${attr(m.periodo || "mes")}" placeholder="mes" /></div>
            </div>
            <label>Link del producto (opcional)</label>
            <input type="url" data-i="${i}" data-k="link" value="${attr(m.link)}" placeholder="https://... (para que vean el producto y su precio)" />
          </div>
        </div>
        <div class="item__actions">
          <label class="chk"><input type="checkbox" data-i="${i}" data-k="recurrente" ${m.recurrente ? "checked" : ""} /> Abono mensual</label>
          <label class="chk"><input type="checkbox" data-i="${i}" data-k="logrado" ${m.logrado ? "checked" : ""} /> ✅ Ya conseguido</label>
          <span style="flex:1"></span>
          <label class="btn btn--ghost btn--sm filepick">📷 Foto<input type="file" accept="image/*" data-i="${i}" /></label>
          ${m.foto ? `<button class="btn btn--ghost btn--sm" data-act="recrop" data-i="${i}">Reencuadrar</button>` : ""}
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
      const el = e.target, i = el.getAttribute("data-i"), k = el.getAttribute("data-k");
      if (i == null || k == null) return;
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (k === "costo") v = num(v);
      state.data.mejoras[+i][k] = v;
      markDirty();
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
      else if (act === "recrop") { if (arr[i].foto) openCropper(arr[i].foto, (out) => { arr[i].foto = out; renderItems(); markDirty(); }); return; }
      renderItems(); markDirty();
    });
    $("#add-item").addEventListener("click", () => {
      state.data.mejoras.push({ icono: "🏉", foto: "", titulo: "", mejora: "", costo: 0, recurrente: false, periodo: "mes", link: "", logrado: false, moneda: (state.meta && state.meta.moneda === "USD") ? "USD" : "ARS" });
      renderItems(); markDirty();
      $("#items").lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handlePhoto(i, file) {
    const reader = new FileReader();
    reader.onload = () => openCropper(reader.result, (out) => {
      state.data.mejoras[i].foto = out; renderItems(); markDirty(); toast("Foto lista ✓");
    });
    reader.onerror = () => toast("No se pudo leer el archivo");
    reader.readAsDataURL(file);
  }

  /* ---------- Recorte / zoom de foto ---------- */
  let cropState = null;
  function openCropper(dataURL, cb) {
    const img = new Image();
    img.onload = () => {
      const overlay = $("#cropper");
      overlay.hidden = false; overlay.classList.add("show");
      const r = $("#crop-frame").getBoundingClientRect();
      const fw = r.width, fh = r.height;
      const cover = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
      cropState = { img, nw: img.naturalWidth, nh: img.naturalHeight, cover, z: 1, ox: 0, oy: 0, fw, fh, cb };
      $("#crop-img").src = dataURL;
      $("#crop-zoom").value = 1;
      layoutCrop(true);
    };
    img.onerror = () => toast("Imagen inválida");
    img.src = dataURL;
  }
  function layoutCrop(center) {
    const s = cropState; if (!s) return;
    const scale = s.cover * s.z;
    const iw = s.nw * scale, ih = s.nh * scale;
    if (center) { s.ox = (s.fw - iw) / 2; s.oy = (s.fh - ih) / 2; }
    s.ox = Math.min(0, Math.max(s.fw - iw, s.ox));
    s.oy = Math.min(0, Math.max(s.fh - ih, s.oy));
    const el = $("#crop-img");
    el.style.width = iw + "px"; el.style.height = ih + "px";
    el.style.transform = "translate(" + s.ox + "px," + s.oy + "px)";
  }
  function setZoom(nz) {
    const s = cropState; if (!s) return;
    nz = Math.min(4, Math.max(1, nz));
    const oldScale = s.cover * s.z, newScale = s.cover * nz;
    const cx = (s.fw / 2 - s.ox) / oldScale, cy = (s.fh / 2 - s.oy) / oldScale;
    s.z = nz;
    s.ox = s.fw / 2 - cx * newScale; s.oy = s.fh / 2 - cy * newScale;
    layoutCrop(false);
  }
  function exportCrop() {
    const s = cropState; if (!s) return null;
    const scale = s.cover * s.z;
    const sx = -s.ox / scale, sy = -s.oy / scale, sw = s.fw / scale, sh = s.fh / scale;
    const outW = 960, outH = 600;
    const canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    canvas.getContext("2d").drawImage(s.img, sx, sy, sw, sh, 0, 0, outW, outH);
    return canvas.toDataURL("image/jpeg", 0.82);
  }
  function closeCropper() { const o = $("#cropper"); o.classList.remove("show"); o.hidden = true; cropState = null; }
  function bindCropper() {
    const frame = $("#crop-frame");
    if (!frame) return;
    let drag = false, lx = 0, ly = 0;
    frame.addEventListener("pointerdown", (e) => { drag = true; lx = e.clientX; ly = e.clientY; try { frame.setPointerCapture(e.pointerId); } catch (x) {} });
    frame.addEventListener("pointermove", (e) => {
      if (!drag || !cropState) return;
      cropState.ox += e.clientX - lx; cropState.oy += e.clientY - ly;
      lx = e.clientX; ly = e.clientY; layoutCrop(false);
    });
    const end = () => { drag = false; };
    frame.addEventListener("pointerup", end);
    frame.addEventListener("pointercancel", end);
    frame.addEventListener("wheel", (e) => {
      if (!cropState) return;
      e.preventDefault();
      const nz = cropState.z * (e.deltaY < 0 ? 1.08 : 0.92);
      $("#crop-zoom").value = Math.min(4, Math.max(1, nz)); setZoom(nz);
    }, { passive: false });
    $("#crop-zoom").addEventListener("input", (e) => setZoom(+e.target.value));
    $("#crop-ok").addEventListener("click", () => { const out = exportCrop(); const cb = cropState && cropState.cb; closeCropper(); if (cb && out) cb(out); });
    $("#crop-cancel").addEventListener("click", closeCropper);
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
      state.data.transparencia[+i] = e.target.value; markDirty();
    });
    cont.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act=del]");
      if (!b) return;
      state.data.transparencia.splice(+b.getAttribute("data-i"), 1);
      renderTransp(); markDirty();
    });
    $("#add-transp").addEventListener("click", () => {
      state.data.transparencia.push(""); renderTransp(); markDirty();
    });
  }

  /* ---------- Campos estáticos ---------- */
  function bindStatic() {
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("input", (e) => { fn(e.target); markDirty(); }); };
    const tx = (id, key) => on(id, (el) => { (state.data.textos = state.data.textos || {})[key] = el.value; });

    on("#m-objetivo", (el) => state.meta.objetivo = num(el.value));
    on("#m-recaudado", (el) => state.meta.recaudado = num(el.value));
    on("#m-donantes", (el) => state.meta.donantes = num(el.value));

    on("#mp-activo", (el) => state.data.donar.mercadopago.activo = el.checked);
    on("#mp-url", (el) => state.data.donar.mercadopago.url = el.value);
    on("#mp-titulo", (el) => state.data.donar.mercadopago.titulo = el.value);
    on("#mp-desc", (el) => state.data.donar.mercadopago.descripcion = el.value);
    on("#tr-activo", (el) => state.data.donar.transferencia.activo = el.checked);
    on("#tr-alias", (el) => state.data.donar.transferencia.alias = el.value);
    on("#tr-cbu", (el) => state.data.donar.transferencia.cbu = el.value);
    on("#tr-titular", (el) => state.data.donar.transferencia.titular = el.value);
    on("#tr-titulo", (el) => state.data.donar.transferencia.titulo = el.value);
    on("#tr-desc", (el) => state.data.donar.transferencia.descripcion = el.value);

    on("#h-titulo", (el) => state.data.hero.titulo = el.value);
    on("#h-bajada", (el) => state.data.hero.bajada = el.value);
    on("#h-eyebrow", (el) => state.data.hero.eyebrow = el.value);

    tx("#t-porqueTitulo", "porqueTitulo"); tx("#t-porqueSub", "porqueSub");
    tx("#t-mejorasTitulo", "mejorasTitulo"); tx("#t-mejorasSub", "mejorasSub");
    tx("#t-donarTitulo", "donarTitulo"); tx("#t-donarSub", "donarSub");
    tx("#t-saludoTitulo", "saludoTitulo"); tx("#t-saludoTexto", "saludoTexto");
    tx("#t-muroTitulo", "muroTitulo"); tx("#t-muroSub", "muroSub");
    tx("#t-saludosTitulo", "saludosTitulo");
    tx("#t-transparenciaTitulo", "transparenciaTitulo");
    tx("#t-footerNota", "footerNota");

    on("#c-nombre", (el) => state.data.club.nombre = el.value);
    on("#c-nombreLargo", (el) => state.data.club.nombreLargo = el.value);
    on("#c-ig", (el) => state.data.club.instagram = el.value);
    on("#c-fb", (el) => state.data.club.facebook = el.value);
    on("#c-yt", (el) => state.data.club.canalYoutube = el.value);
  }

  function bindButtons() {
    $("#dl-data").addEventListener("click", guardarTodo);
    $("#dl-meta").addEventListener("click", guardarSoloMeta);
    $("#copy-data") && $("#copy-data").remove();
    $("#copy-meta") && $("#copy-meta").remove();
    $("#reset") && $("#reset").addEventListener("click", () => {
      if (confirm("Descartar los cambios sin guardar y recargar desde el servidor?")) location.reload();
    });
    $("#btn-logout").addEventListener("click", async () => {
      if (dirty && !confirm("Tenés cambios sin guardar. ¿Cerrar sesión igual?")) return;
      try { await authMod.signOut(auth); } catch (e) {}
    });
    $("#btn-pass").addEventListener("click", cambiarPassword);
    window.addEventListener("beforeunload", (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  async function cambiarPassword() {
    if (!auth || !auth.currentUser) return;
    const nueva = prompt("Nueva contraseña (mínimo 6 caracteres):");
    if (nueva == null) return;
    if (nueva.length < 6) { alert("Mínimo 6 caracteres."); return; }
    if (prompt("Repetí la nueva contraseña:") !== nueva) { alert("No coinciden."); return; }
    try {
      await authMod.updatePassword(auth.currentUser, nueva);
      toast("Contraseña cambiada ✓");
    } catch (e) {
      alert("No se pudo cambiar: " + (e && e.message ? e.message : e) + "\n\n(Puede que tengas que cerrar sesión y volver a entrar antes de cambiarla.)");
    }
  }

  /* ---------- Donaciones (moderación) ---------- */
  let donaciones = [], donFilter = "pendiente", donUnsub = null;

  function subscribeDonaciones() {
    if (donUnsub) return;
    donUnsub = fs.onSnapshot(fs.collection(db, "donaciones"), (qs) => {
      donaciones = qs.docs.map((d) => Object.assign({ _id: d.id }, d.data()));
      donaciones.sort((a, b) => tsMillis(b.creadoEn) - tsMillis(a.creadoEn));
      renderDonaciones();
    }, (e) => { console.error("donaciones:", e); });
  }

  function renderDonaciones() {
    const pend = donaciones.filter((d) => (d.estado || "pendiente") === "pendiente").length;
    const badge = $("#don-badge");
    if (pend > 0) { badge.hidden = false; badge.textContent = pend + " pendiente" + (pend > 1 ? "s" : ""); }
    else { badge.hidden = true; }

    const list = donaciones.filter((d) => (d.estado || "pendiente") === donFilter);
    const cont = $("#donaciones-list");
    if (!list.length) {
      const t = donFilter === "pendiente" ? "pendientes" : (donFilter === "confirmada" ? "confirmadas" : "ocultas");
      cont.innerHTML = `<div class="don-empty">No hay donaciones ${t}.</div>`;
      return;
    }
    cont.innerHTML = list.map((d) => {
      const monto = num(d.monto) > 0 ? `<span class="don-item__amount">${pesos(d.monto)}</span>` : "";
      const fecha = (d.creadoEn && d.creadoEn.toDate) ? d.creadoEn.toDate().toLocaleString("es-AR") : "";
      const msg = d.mensaje ? `<div class="don-item__msg">“${attr(d.mensaje)}”</div>` : "";
      let acc;
      if (d.estado === "confirmada") {
        acc = `<button class="btn btn--ghost btn--sm" data-act="ocultar" data-id="${d._id}">Ocultar</button>
               <button class="btn btn--danger btn--sm" data-act="eliminar" data-id="${d._id}">Eliminar</button>`;
      } else if (d.estado === "oculta") {
        acc = `<button class="btn btn--ok btn--sm" data-act="confirmar" data-id="${d._id}">✅ Confirmar</button>
               <button class="btn btn--danger btn--sm" data-act="eliminar" data-id="${d._id}">Eliminar</button>`;
      } else {
        acc = `<button class="btn btn--ok btn--sm" data-act="confirmar" data-id="${d._id}">✅ Confirmar</button>
               <button class="btn btn--ghost btn--sm" data-act="ocultar" data-id="${d._id}">Ocultar</button>
               <button class="btn btn--danger btn--sm" data-act="eliminar" data-id="${d._id}">Eliminar</button>`;
      }
      return `<div class="don-item">
        <div class="don-item__top"><span class="don-item__name">${attr(d.nombre)}</span>${monto}<span class="don-item__meta">${attr(d.metodo || "")} · ${attr(fecha)}</span></div>
        ${msg}
        <div class="don-item__actions">${acc}</div>
      </div>`;
    }).join("");
  }

  function bindDonacionesUI() {
    document.querySelectorAll(".don-tab").forEach((t) => {
      t.addEventListener("click", () => {
        donFilter = t.getAttribute("data-f");
        document.querySelectorAll(".don-tab").forEach((x) => x.classList.toggle("is-active", x === t));
        renderDonaciones();
      });
    });
    $("#donaciones-list").addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
      try {
        if (act === "confirmar") { await fs.updateDoc(fs.doc(db, "donaciones", id), { estado: "confirmada", confirmadaEn: fs.serverTimestamp() }); toast("Confirmada ✓ Ya está en el muro y el overlay"); }
        else if (act === "ocultar") await fs.updateDoc(fs.doc(db, "donaciones", id), { estado: "oculta" });
        else if (act === "eliminar") { if (confirm("¿Borrar esta donación para siempre?")) await fs.deleteDoc(fs.doc(db, "donaciones", id)); }
      } catch (err) { alert("No se pudo: " + (err && err.message ? err.message : err)); }
    });
  }

  /* ---------- Login ---------- */
  function bindLogin() {
    $("#gate-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = ($("#gate-email").value || "").trim();
      const pass = $("#gate-pass").value || "";
      $("#gate-err").textContent = "";
      const btn = $("#gate-form button[type=submit]");
      btn.disabled = true; const prev = btn.textContent; btn.textContent = "Entrando…";
      try {
        await authMod.signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged se encarga de abrir
      } catch (err) {
        const code = err && err.code ? err.code : "";
        let msg = "Email o contraseña incorrectos. Fijate que el usuario exista en Firebase → Authentication → Users y que uses ESA contraseña (no la vieja).";
        if (code.indexOf("operation-not-allowed") >= 0) msg = "Falta habilitar Email/Password en Firebase → Authentication → Sign-in method.";
        else if (code.indexOf("invalid-email") >= 0) msg = "El email no tiene un formato válido.";
        else if (code.indexOf("too-many-requests") >= 0) msg = "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
        else if (code.indexOf("network") >= 0) msg = "Sin conexión. Revisá tu internet.";
        $("#gate-err").textContent = msg;
      } finally { btn.disabled = false; btn.textContent = prev; }
    });
  }

  async function afterLogin(user) {
    $("#who").textContent = user.email || "";
    try {
      await loadData();
      fillForm();
      markClean();
      document.body.classList.remove("locked");
      subscribeDonaciones();
    } catch (e) {
      console.error(e);
      alert("Entraste, pero no se pudieron leer los datos: " + (e && e.message ? e.message : e) +
        "\n\nRevisá que hayas creado la base de datos Firestore y cargado las reglas.");
    }
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    bindStatic(); bindItems(); bindTransp(); bindButtons(); bindDonacionesUI(); bindPorque(); bindCropper(); bindMoneda(); bindMetaModo();
    try { const c = await getJSON("cotizacion.json"); RATE = Number(c.usd) || 0; } catch (e) {}
    try {
      const fb = await withTimeout(window.fbLoad(true), 12000, "No se pudo conectar con Firebase");
      db = fb.db; fs = fb.fs; auth = fb.auth; authMod = fb.authMod;
      bindLogin();
      authMod.onAuthStateChanged(auth, (user) => {
        if (user) afterLogin(user);
        else { document.body.classList.add("locked"); $("#gate-pass").value = ""; }
      });
    } catch (e) {
      console.error(e);
      $("#gate-err").textContent = "No se pudo conectar con el servidor. Revisá tu internet y recargá.";
    }
  });
})();
