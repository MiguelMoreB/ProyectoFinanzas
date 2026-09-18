# Bolsillo 💰

App de gastos personales mes con mes (PWA). Inspirada en el método **50/30/20**
de tu hoja de cálculo, pero pensada para capturar gastos rápido desde el celular.

---

## ¿Qué hace hoy (Fase 1)?

- ➕ Registrar movimientos en 2 toques: **Ingreso, Factura, Gasto, Ahorro, Deuda**.
- 🏠 **Inicio**: cuánto te queda del mes + barras 50/30/20 (verde/amarillo/rojo).
- 📊 **Historial**: gasto por categoría, navegable mes con mes (flechas ‹ ›).
- 🎯 **Metas** de ahorro con barra de progreso (los ahorros se suman solos).
- ⚙️ **Ajustes**: tu ingreso esperado, y respaldar/importar tus datos.
- 📴 Funciona **sin internet** y se puede instalar como app.

Por ahora todo se guarda **solo en tu teléfono**. La conexión con tu Google
Sheet es la Fase 2 (ver más abajo).

---

## Cómo probarla en la computadora

1. Abre una terminal en esta carpeta.
2. Levanta un servidor local:
   ```bash
   python -m http.server 8777
   ```
3. Abre en el navegador: http://127.0.0.1:8777/index.html

> Si editas archivos y no ves los cambios, es la caché: abre las herramientas
> del navegador (F12) → pestaña *Application* → *Service Workers* → *Unregister*,
> y recarga.

---

## Cómo instalarla en tu celular (gratis, sin tiendas)

La forma más fácil es subirla a **GitHub Pages**:

1. Crea un repositorio en GitHub y sube estos archivos.
2. En el repo: **Settings → Pages → Source: main → carpeta /root → Save**.
3. En 1–2 minutos te da una liga tipo `https://tu-usuario.github.io/tu-repo/`.
4. Abre esa liga en tu celular (Chrome en Android, Safari en iPhone).
5. Menú del navegador → **"Agregar a pantalla de inicio"**. ¡Listo, Bolsillo ya es una app!

(Si prefieres, dime y te guío paso a paso cuando quieras hacer esto.)

---

## Archivos del proyecto

| Archivo         | Qué es                                                    |
|-----------------|-----------------------------------------------------------|
| `index.html`    | La estructura de la pantalla                              |
| `styles.css`    | Los colores y el diseño                                   |
| `app.js`        | Toda la lógica (aquí está la capa de datos `DB`)          |
| `manifest.json` | Datos para que sea "instalable" como app                 |
| `sw.js`         | Service worker: permite usarla sin internet              |
| `icon.svg`      | Ícono de la app                                           |

---

## Fase 2 — Conectar con tu Google Sheet (siguiente paso)

La idea: sin servidores ni costos.

```
Celular (app) → Google Apps Script → Tu Google Sheet
```

1. En tu hoja creamos una pestaña nueva **"Movimientos"** (una fila por gasto).
   El dashboard 50/30/20 que ya tienes se alimenta de ahí con fórmulas.
2. Pegas un código de **Apps Script** (Extensiones → Apps Script) que recibe los
   gastos y los escribe en la hoja.
3. En `app.js`, la capa `DB` está aislada a propósito: solo cambiamos esas
   funciones para que hablen con tu hoja, sin tocar el resto de la app.

Cuando quieras, dime "vamos a la Fase 2" y lo armamos.

## Fase 3 — Ideas para pulir
- 🔔 Recordatorio de facturas antes de que venzan.
- ❄️ Estrategia "bola de nieve" para pagar deudas (como en tu hoja).
- 📈 Gráfica de tendencia de gastos por mes.
