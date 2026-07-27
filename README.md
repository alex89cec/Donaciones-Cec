# 💛💙 Donaciones · Streaming CEC Liceo Militar

Web simple para juntar donaciones y mejorar la **transmisión en vivo** de los
partidos de rugby del CEC Liceo Militar. Muestra qué se necesita, cuánto sale,
cómo donar y una **barra de meta que se actualiza casi en tiempo real**.

No usa frameworks ni backend: son archivos estáticos (HTML/CSS/JS), así que se
puede publicar gratis en **GitHub Pages**.

---

## 🗂️ Archivos

| Archivo        | Para qué sirve |
|----------------|----------------|
| `index.html`   | La página. Normalmente no hace falta tocarla. |
| `styles.css`   | Los estilos y colores. |
| `app.js`       | Arma la página y actualiza la meta. No hace falta tocarlo. |
| **`admin.html`** | **Panel de carga:** editás todo desde el navegador y descargás los archivos. |
| **`data.json`**| **El contenido:** mejoras, fotos, costos, textos y datos para donar. |
| **`meta.json`**| **La meta en vivo:** cuánto se recaudó, donantes y objetivo. |
| `assets/`      | El escudo del club. |

> Los datos que vienen cargados son **de ejemplo**. Reemplazalos por los reales.

---

## ✏️ Cómo editar el contenido (recomendado: el panel)

Abrí **`admin.html`** en el navegador (en la web publicada es `.../admin.html`).
Desde ahí, sin tocar código, podés:

- **Actualizar la meta** (recaudado, donantes, objetivo).
- **Agregar / editar / ordenar ítems**, con su **costo** y **foto** (se sube desde
  el celu y queda guardada dentro del archivo, no hace falta subirla aparte).
- Marcar un ítem como **abono mensual** (ej: internet), que se muestra como `$X / mes`.
- Cambiar el **link de MercadoPago**, el **alias / CBU** y los textos.

Cuando terminás, tocás **“Descargar data.json”** y/o **“Descargar meta.json”** y
reemplazás esos archivos en el repo (o me los pasás y los subo yo). Tus cambios
quedan como borrador en el navegador por si cerrás sin querer.

> ¿Preferís editar a mano? También podés abrir `data.json` y `meta.json` con un
> editor de texto y cambiar los valores directamente.

## 🔴 Cómo actualizar la meta "en vivo"

Editá **`meta.json`**:

```json
{
  "objetivo": 1100000,
  "recaudado": 415000,
  "donantes": 63,
  "actualizado": "2026-07-16T12:00:00-03:00"
}
```

- `recaudado`: total juntado hasta ahora.
- `donantes`: cuánta gente donó.
- `actualizado`: fecha/hora del último cambio (formato ISO).

Cada vez que subís un cambio a `meta.json`, la barra sube **sola** para todas
las personas que estén mirando la página (se refresca cada 20 segundos, sin que
tengan que recargar).

---

## 🚀 Cómo publicarlo gratis (GitHub Pages)

1. Subí este repo a GitHub.
2. Andá a **Settings → Pages**.
3. En *Source* elegí la rama (ej: `main`) y la carpeta `/root`.
4. Guardá. En un ratito queda online en `https://TU-USUARIO.github.io/...`.

Para probarlo en tu compu, desde esta carpeta corré:

```bash
python3 -m http.server 8080
```

y abrí `http://localhost:8080`.

---

## 🔮 Próximos niveles (opcionales)

- **Panel / planilla:** en vez de editar `meta.json` a mano, conectarlo a una
  planilla de Google o a Supabase para cargar donaciones desde el celular.
- **Automático con MercadoPago:** que cada donación sume sola a la meta usando
  un *webhook* de MercadoPago. Requiere cuenta de MercadoPago y un mini backend.

Ambos se enchufan cambiando `metaSource` en `data.js`. El resto de la web queda igual.

---

Campaña solidaria de la comunidad del Liceo. Colores y escudo del club.
