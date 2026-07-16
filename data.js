/* =====================================================================
   DATOS DE LA CAMPAÑA — Editá este archivo para cambiar el contenido.
   No hace falta saber programar: cambiá los textos y números entre comillas.
   ===================================================================== */

window.CONFIG = {
  // De dónde se leen los valores de la meta en vivo (recaudado, donantes...).
  // Por ahora es un archivo local. Más adelante se puede apuntar a una
  // planilla de Google, Supabase o un webhook de MercadoPago.
  metaSource: "meta.json",

  // Cada cuántos segundos se vuelve a mirar la meta (para el "tiempo real").
  pollSeconds: 20,

  // Valores de respaldo por si no se puede leer meta.json (ej: abriendo el
  // archivo desde la compu sin servidor). Idealmente coinciden con meta.json.
  metaFallback: {
    objetivo: 1100000,
    recaudado: 415000,
    donantes: 63,
    actualizado: "2026-07-16T12:00:00-03:00"
  }
};

window.DATA = {
  club: {
    nombre: "CEC Liceo Militar",
    nombreLargo: "Centro de Ex Cadetes — Liceo Militar Gral. San Martín",
    canalYoutube: "https://www.youtube.com/@CecLiceoMilitarStream",
    instagram: "https://www.instagram.com/cecliceomilitar",
    facebook: "https://www.facebook.com/CECLICEOMILITAR"
  },

  hero: {
    eyebrow: "Streaming del club · Rugby",
    titulo: "Ayudanos a mejorar la transmisión de los partidos",
    bajada:
      "Transmitimos en vivo los partidos del Liceo para que la familia rugbier los pueda ver esté donde esté. " +
      "Con tu aporte mejoramos la imagen, el sonido y la estabilidad de la señal."
  },

  // Por qué mejorar (3 puntos)
  porQue: [
    { icono: "📺", titulo: "Mejor imagen", texto: "Cámara y captura en HD para ver cada jugada nítida, sin pixelado." },
    { icono: "🎙️", titulo: "Mejor sonido", texto: "Relato claro y el aliento de la cancha que se escucha de verdad." },
    { icono: "📶", titulo: "Sin cortes", texto: "Conexión estable para transmitir los 80 minutos sin cortes ni trabas." }
  ],

  // Las mejoras que se necesitan. El costo es en pesos (ARS).
  // ⚠️ Estos son valores DE EJEMPLO — reemplazá por los reales.
  mejoras: [
    { icono: "📹", titulo: "Cámara Full HD",            mejora: "Imagen nítida de todo el partido, sin pixelado.",        costo: 220000 },
    { icono: "🎬", titulo: "Capturadora de video",       mejora: "Conecta la cámara a la notebook en calidad profesional.", costo: 95000 },
    { icono: "🎙️", titulo: "Kit de micrófonos",          mejora: "Relato y sonido de cancha que se escuchan bien.",         costo: 80000 },
    { icono: "📶", titulo: "Router 4G / mejor internet",  mejora: "Transmisión estable, sin cortes en pleno vivo.",          costo: 120000 },
    { icono: "💻", titulo: "Notebook para transmitir",    mejora: "Corre el software de streaming sin trabarse.",            costo: 520000 },
    { icono: "🎥", titulo: "Trípode + estabilizador",     mejora: "Tomas firmes y prolijas durante todo el encuentro.",      costo: 65000 }
  ],

  // Métodos de donación. ⚠️ Reemplazá por tus datos reales.
  donar: {
    mercadopago: {
      activo: true,
      titulo: "MercadoPago",
      descripcion: "Con tarjeta, débito o dinero en cuenta. Es la forma más rápida.",
      // 👉 Pegá acá tu link de MercadoPago (ej: https://link.mercadopago.com.ar/tuclub)
      url: "https://link.mercadopago.com.ar/REEMPLAZAR"
    },
    transferencia: {
      activo: true,
      titulo: "Transferencia bancaria",
      descripcion: "Sin comisiones. Copiá el alias y transferí desde tu banco o billetera.",
      alias: "LICEO.STREAM.CEC",              // 👉 tu alias real
      cbu: "0000000000000000000000",          // 👉 tu CBU/CVU real
      titular: "CEC Liceo Militar — Streaming" // 👉 titular de la cuenta
    }
  },

  // En qué se usa la plata / qué ya se logró (transparencia).
  transparencia: [
    "El 100% de lo recaudado se usa exclusivamente para el equipamiento del streaming.",
    "Vamos a publicar acá cada compra que se haga con lo donado.",
    "Cualquier duda, escribinos por Instagram y te contamos en qué anda la campaña."
  ]
};
