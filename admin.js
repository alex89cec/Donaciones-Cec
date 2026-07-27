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
      hero: { eyebrow: "Streaming del club · Rugby", titulo: "", bajada: "" },
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
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function markDirty() {
    dirty = true;
    $("#draft-status").textContent = "Cambios sin guardar";
    $("#draft-status").style.background = "rgba(245,180,30,.25)";
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

    // contenido
    const cSnap = await fs.getDoc(fs.doc(db, "config", "contenido"));
    const c = cSnap.exists() ? cSnap.data() : seed;
    state.data.club = c.club || seed.club || DEFAULTS.data.club;
    state.data.hero = c.hero || seed.hero || DEFAULTS.data.hero;
    state.data.porQue = c.porQue || seed.porQue || [];
    state.data.donar = c.donar || seed.donar || DEFAULTS.data.donar;
    state.data.transparencia = c.transparencia || seed.transparencia || [];

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
    await fs.setDoc(fs.doc(db, "config", "meta"), {
      objetivo: num(state.meta.objetivo),
      recaudado: num(state.meta.recaudado),
      donantes: num(state.meta.donantes),
      actualizado: state.meta.actualizado
    });
  }
  async function saveContenido() {
    await fs.setDoc(fs.doc(db, "config", "contenido"), {
      club: state.data.club,
      hero: state.data.hero,
      porQue: state.data.porQue,
      donar: state.data.donar,
      transparencia: state.data.transparencia
    });
  }
  async function saveMejoras() {
    const items = state.data.mejoras;
    const keep = new Set();
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const payload = {
        orden: i, icono: m.icono || "", foto: m.foto || "", titulo: m.titulo || "",
        mejora: m.mejora || "", costo: num(m.costo), recurrente: !!m.recurrente, periodo: m.periodo || "mes"
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
              <div><label>Costo ($)</label><input type="number" data-i="${i}" data-k="costo" min="0" step="1000" value="${num(m.costo)}" /></div>
              <div><label>Emoji (si no hay foto)</label><input type="text" data-i="${i}" data-k="icono" value="${attr(m.icono)}" maxlength="4" /></div>
              <div><label>Período</label><input type="text" data-i="${i}" data-k="periodo" value="${attr(m.periodo || "mes")}" placeholder="mes" /></div>
            </div>
          </div>
        </div>
        <div class="item__actions">
          <label class="chk"><input type="checkbox" data-i="${i}" data-k="recurrente" ${m.recurrente ? "checked" : ""} /> Abono mensual (gasto que se paga todos los meses)</label>
          <span style="flex:1"></span>
          <label class="btn btn--ghost btn--sm filepick">📷 Foto<input type="file" accept="image/*" data-i="${i}" /></label>
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
      renderItems(); markDirty();
    });
    $("#add-item").addEventListener("click", () => {
      state.data.mejoras.push({ icono: "🏉", foto: "", titulo: "", mejora: "", costo: 0, recurrente: false, periodo: "mes" });
      renderItems(); markDirty();
      $("#items").lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handlePhoto(i, file) {
    toast("Procesando foto…");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1000, scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        try {
          state.data.mejoras[i].foto = canvas.toDataURL("image/jpeg", 0.82);
          renderItems(); markDirty(); toast("Foto cargada ✓");
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
    const on = (id, fn) => $(id).addEventListener("input", (e) => { fn(e.target); markDirty(); });
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
        let msg = "No se pudo entrar. Revisá el email y la contraseña.";
        if (code.indexOf("too-many-requests") >= 0) msg = "Demasiados intentos. Esperá un momento y probá de nuevo.";
        if (code.indexOf("network") >= 0) msg = "Sin conexión. Revisá tu internet.";
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
    } catch (e) {
      console.error(e);
      alert("Entraste, pero no se pudieron leer los datos: " + (e && e.message ? e.message : e) +
        "\n\nRevisá que hayas creado la base de datos Firestore y cargado las reglas.");
    }
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    bindStatic(); bindItems(); bindTransp(); bindButtons();
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
