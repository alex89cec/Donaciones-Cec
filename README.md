# 💛💙 Donaciones · Streaming CEC Liceo Militar

Web para juntar donaciones y mejorar la **transmisión en vivo** de los partidos
de rugby del CEC Liceo Militar. Muestra qué se necesita, cuánto sale, cómo donar
y una **barra de meta que se actualiza en vivo**.

- **Hosting:** GitHub Pages (gratis), dominio propio `streamcec.com`.
- **Datos + login:** Firebase (Firestore + Authentication). El panel guarda
  directo y la meta se ve al instante para todos. Si Firebase no estuviera
  disponible, la web usa los archivos JSON como respaldo y sigue andando.

---

## 🗂️ Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La web pública. |
| `styles.css` | Estilos y colores. |
| `app.js` | Arma la web y muestra la meta en vivo (lee de Firebase). |
| `firebase-shared.js` | Conexión al proyecto de Firebase (datos públicos). |
| **`admin.html`** | **Panel de carga** (con login) para editar todo. |
| `admin.js` | Lógica del panel: login y guardado en Firebase. |
| `firestore.rules` | Reglas de seguridad para pegar en Firebase. |
| `data.json` / `meta.json` | Semilla inicial y **respaldo** por si Firebase falla. |
| `.github/workflows/` | Deploy automático a GitHub Pages en cada push a `main`. |
| `assets/` | El escudo del club. |

---

## ✏️ Cómo editar (panel con login)

Entrá a **`streamcec.com/admin.html`**, iniciá sesión con tu **email y contraseña**
(el usuario que está en Firebase → Authentication) y desde ahí, sin tocar código:

- **Actualizar la meta** (recaudado, donantes, objetivo) → botón **“Guardar meta”**.
- **Agregar / editar / ordenar ítems**, con su **costo** y **foto** (se sube desde
  el celu; se comprime sola).
- Marcar un ítem como **abono mensual** (ej: internet) → se muestra como `$X / mes`.
- Cambiar el **link de MercadoPago**, el **alias / CBU** y los textos.

Tocás **“Guardar”** y los cambios quedan en la nube y **se ven en la web al
instante**. No hay que bajar ni subir archivos.

### 🔒 Seguridad
- El panel tiene **login real** (Firebase Authentication).
- Las **reglas de Firestore** (`firestore.rules`) permiten que cualquiera **lea**
  (para mostrar la web) pero que **solo tu usuario escriba/edite**. Aunque alguien
  vea el código, no puede modificar nada.
- La `apiKey` de Firebase en `firebase-shared.js` es **pública por diseño**: no es
  un secreto, la protección la dan las reglas + el login.
- Cambiar tu contraseña: en el panel, botón **“🔑 Contraseña”**.

---

## 🔧 Configuración de Firebase (una vez)

1. Proyecto creado en [console.firebase.google.com](https://console.firebase.google.com).
2. **Firestore Database** creada (modo producción).
3. **Authentication → Email/Password** habilitado, con **un usuario** (tu email + contraseña).
4. **Reglas:** pegar el contenido de `firestore.rules` en *Firestore → Reglas*,
   reemplazando `TU-EMAIL-ADMIN@ejemplo.com` por tu email admin.
5. La config del proyecto está en `firebase-shared.js`.

**Estructura de datos en Firestore:**
- `config/meta` → `{ objetivo, recaudado, donantes, actualizado }`
- `config/contenido` → `{ club, hero, porQue, donar, transparencia }`
- `mejoras/{id}` → un documento por ítem (`{ orden, titulo, mejora, costo, foto, recurrente, periodo, icono }`)

La **primera vez**, el panel se abre con los datos de ejemplo (de `data.json` /
`meta.json`); al tocar **“Guardar todo”** quedan cargados en Firestore.

---

## 🚀 Publicación

Ya está online en **`streamcec.com`** vía GitHub Pages, con **deploy automático**:
cada push a `main` republica el sitio (workflow en `.github/workflows/`).

Para probarlo localmente:

```bash
python3 -m http.server 8080
```

y abrí `http://localhost:8080` (sin internet a Firebase, usa el respaldo JSON).

---

Campaña solidaria de la comunidad del Liceo. Colores y escudo del club.
