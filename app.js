/* =========================================================================
   Bolsillo — App de gastos personales (PWA)
   Fase 1: guarda todo en el propio celular (localStorage).
   El "almacén de datos" (DB) está aislado para que en la Fase 2
   podamos cambiarlo por tu Google Sheet sin tocar el resto.
   ========================================================================= */

/* ---------- Utilidades ---------- */
const $ = (sel) => document.querySelector(sel);
const fmt = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const mesKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

/* ---------- Tipos de movimiento (basados en tu hoja 50/30/20) ----------
   grupo: define en qué barra 50/30/20 cae cada gasto.
     necesidades (50%) | gustos (30%) | ahorro (20%)
   Los ingresos no cuentan como gasto, solo suman al presupuesto.        */
const TIPOS = {
  ingreso: { label: "Ingreso", ico: "💵", color: "var(--ingreso)", grupo: null },
  factura: { label: "Factura", ico: "🧾", color: "var(--factura)", grupo: "necesidades" },
  gasto:   { label: "Gasto",   ico: "🛒", color: "var(--gasto)",   grupo: "gustos" },
  ahorro:  { label: "Ahorro",  ico: "🐷", color: "var(--ahorro)",  grupo: "ahorro" },
  deuda:   { label: "Deuda",   ico: "💳", color: "var(--deuda)",   grupo: "ahorro" },
};

/* Categorías sugeridas por tipo (puedes editarlas en Ajustes) */
const CATS_DEFAULT = {
  ingreso: ["Sueldo", "Ventas", "Extra"],
  factura: ["Renta", "Luz", "Agua", "Internet", "Teléfono", "Colegiatura"],
  gasto:   ["Súper", "Comida", "Gasolina", "Transporte", "Salud", "Entretenimiento", "Ropa"],
  ahorro:  ["Fondo emergencia", "Ahorro general"],
  deuda:   ["Tarjeta", "Préstamo"],
};

/* =========================================================================
   DB — capa de datos. Hoy usa localStorage.
   En la Fase 2 solo cambiaremos el contenido de estas funciones.
   ========================================================================= */
const DB = {
  _key: "zoomfin_v1",
  _cache: null,

  _load() {
    if (this._cache) return this._cache;
    const raw = localStorage.getItem(this._key);
    this._cache = raw ? JSON.parse(raw) : {
      movimientos: [],
      categorias: JSON.parse(JSON.stringify(CATS_DEFAULT)),
      presupuestos: {},          // { "necesidades": 0, "gustos": 0, "ahorro": 0 } — se calcula del ingreso
      ingresoEsperado: 0,        // ingreso mensual esperado para el 50/30/20
      metas: [                   // metas de ahorro
        { id: uid(), nombre: "Fondo de emergencia", objetivo: 30000, actual: 0 },
      ],
    };
    return this._cache;
  },
  _save() { localStorage.setItem(this._key, JSON.stringify(this._cache)); },

  todo() { return this._load(); },

  agregarMov(mov) {
    const db = this._load();
    db.movimientos.push(mov);
    // Si es ahorro, súmalo a la meta si coincide el nombre
    if (mov.tipo === "ahorro") {
      const meta = db.metas.find((m) => m.nombre === mov.categoria);
      if (meta) meta.actual += mov.monto;
    }
    this._save();
  },
  actualizarMov(id, cambios) {
    const db = this._load();
    const i = db.movimientos.findIndex((m) => m.id === id);
    if (i >= 0) { db.movimientos[i] = { ...db.movimientos[i], ...cambios }; this._save(); }
  },
  borrarMov(id) {
    const db = this._load();
    db.movimientos = db.movimientos.filter((m) => m.id !== id);
    this._save();
  },
  movimientosDelMes(mkey) {
    return this._load().movimientos
      .filter((m) => m.fecha.slice(0, 7) === mkey)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  },
  guardarConfig(cambios) {
    Object.assign(this._load(), cambios);
    this._save();
  },
};

/* =========================================================================
   Estado de la interfaz
   ========================================================================= */
const state = {
  fecha: new Date(),      // mes que se está viendo
  tab: "inicio",
};

/* =========================================================================
   Render principal
   ========================================================================= */
function render() {
  $("#monthLabel").textContent = `${MESES[state.fecha.getMonth()]} ${state.fecha.getFullYear()}`;
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === state.tab)
  );
  const view = $("#view");
  if (state.tab === "inicio") view.innerHTML = renderInicio();
  else if (state.tab === "historial") view.innerHTML = renderHistorial();
  else if (state.tab === "metas") view.innerHTML = renderMetas();
  else if (state.tab === "ajustes") { view.innerHTML = renderAjustes(); enlazarAjustes(); }
  $("#fab").style.display = state.tab === "inicio" || state.tab === "historial" ? "grid" : "none";
}

/* ---------- Cálculos del mes ---------- */
function resumenMes(mkey) {
  const movs = DB.movimientosDelMes(mkey);
  const r = { ingresos: 0, necesidades: 0, gustos: 0, ahorro: 0, gastoTotal: 0 };
  movs.forEach((m) => {
    if (m.tipo === "ingreso") r.ingresos += m.monto;
    else {
      const g = TIPOS[m.tipo].grupo;
      r[g] += m.monto;
      r.gastoTotal += m.monto;
    }
  });
  return { movs, ...r };
}

/* ---------- Pestaña: Inicio ---------- */
function renderInicio() {
  const mkey = mesKey(state.fecha);
  const r = resumenMes(mkey);
  const db = DB.todo();
  const base = db.ingresoEsperado || r.ingresos || 0;   // sobre qué calculamos el 50/30/20
  const disponible = r.ingresos - r.gastoTotal;

  const barras = [
    { label: "Necesidades", pct: 50, gastado: r.necesidades, limite: base * 0.5, color: "var(--factura)" },
    { label: "Gustos",      pct: 30, gastado: r.gustos,      limite: base * 0.3, color: "var(--gasto)" },
    { label: "Ahorro",      pct: 20, gastado: r.ahorro,      limite: base * 0.2, color: "var(--ahorro)" },
  ];

  const barrasHtml = barras.map((b) => {
    const ratio = b.limite > 0 ? b.gastado / b.limite : 0;
    const w = Math.min(ratio * 100, 100);
    const color = ratio > 1 ? "var(--red)" : ratio > 0.85 ? "var(--yellow)" : b.color;
    return `
      <div class="bar-row">
        <div class="bar-head">
          <span>${b.label} <span class="pct">${b.pct}%</span></span>
          <span>${fmt(b.gastado)} / ${fmt(b.limite)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div>
      </div>`;
  }).join("");

  const movsHtml = r.movs.length
    ? r.movs.slice(0, 8).map(movHtml).join("")
    : `<div class="empty">Aún no hay movimientos este mes.<br>Toca el botón <b>+</b> para agregar el primero.</div>`;

  return `
    <div class="card">
      <div class="balance">
        <div>
          <div class="card-title">Disponible este mes</div>
          <div class="big" style="color:${disponible < 0 ? "var(--red)" : "var(--text)"}">${fmt(disponible)}</div>
        </div>
        <div class="sub">Ingresos ${fmt(r.ingresos)}<br>Gastos ${fmt(r.gastoTotal)}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Regla 50 / 30 / 20</div>
      ${barrasHtml}
      ${base === 0 ? `<div class="hint" style="margin-top:12px">Define tu ingreso mensual esperado en <b>Ajustes</b> para calcular los límites.</div>` : ""}
    </div>

    <div class="card">
      <div class="card-title">Movimientos recientes</div>
      <div class="mov-list">${movsHtml}</div>
    </div>`;
}

function movHtml(m) {
  const t = TIPOS[m.tipo];
  const esIngreso = m.tipo === "ingreso";
  const fechaTxt = new Date(m.fecha + "T00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `
    <div class="mov" onclick="abrirModal('${m.id}')">
      <div class="mov-ico" style="background:${t.color}22;color:${t.color}">${t.ico}</div>
      <div class="mov-mid">
        <div class="mov-cat">${m.categoria}</div>
        <div class="mov-note">${fechaTxt}${m.nota ? " · " + m.nota : ""}</div>
      </div>
      <div class="mov-amt ${esIngreso ? "plus" : ""}">${esIngreso ? "+" : "−"}${fmt(m.monto)}</div>
    </div>`;
}

/* ---------- Pestaña: Historial (Presupuesto vs Real por categoría) ---------- */
function renderHistorial() {
  const mkey = mesKey(state.fecha);
  const r = resumenMes(mkey);

  // Agrupar gastos por categoría
  const porCat = {};
  r.movs.forEach((m) => {
    if (m.tipo === "ingreso") return;
    porCat[m.categoria] = (porCat[m.categoria] || 0) + m.monto;
  });
  const filas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const maxVal = filas.length ? filas[0][1] : 1;

  const filasHtml = filas.length
    ? filas.map(([cat, monto]) => `
        <div class="hist-row">
          <div style="flex:1">
            <div class="cat-name">${cat}</div>
            <div class="progress-mini"><div style="width:${(monto / maxVal) * 100}%;background:var(--brand)"></div></div>
          </div>
          <div class="hist-nums" style="margin-left:14px">
            <div class="real">${fmt(monto)}</div>
          </div>
        </div>`).join("")
    : `<div class="empty">Sin gastos registrados este mes.</div>`;

  return `
    <div class="card">
      <div class="card-title">Resumen del mes</div>
      <div class="mini-stats">
        <div class="mini-stat"><div class="label">Ingresos</div><div class="val" style="color:var(--green)">${fmt(r.ingresos)}</div></div>
        <div class="mini-stat"><div class="label">Gastos</div><div class="val">${fmt(r.gastoTotal)}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Gasto por categoría</div>
      ${filasHtml}
    </div>`;
}

/* ---------- Pestaña: Metas de ahorro ---------- */
function renderMetas() {
  const db = DB.todo();
  const metasHtml = db.metas.map((g) => {
    const pct = g.objetivo > 0 ? Math.min((g.actual / g.objetivo) * 100, 100) : 0;
    return `
      <div class="card">
        <div class="goal">
          <div class="goal-head"><span>${g.nombre}</span><span>${Math.round(pct)}%</span></div>
          <div class="goal-track"><div class="goal-fill" style="width:${pct}%"></div></div>
          <div class="goal-sub">${fmt(g.actual)} de ${fmt(g.objetivo)} · faltan ${fmt(Math.max(g.objetivo - g.actual, 0))}</div>
        </div>
      </div>`;
  }).join("");

  return `
    ${metasHtml || `<div class="empty">Aún no tienes metas.</div>`}
    <button class="link-btn" onclick="nuevaMeta()">+ Nueva meta de ahorro</button>
    <div class="hint" style="margin-top:8px">Cuando registres un movimiento de tipo <b>Ahorro</b> con el mismo nombre de una meta, se suma solo. ✨</div>`;
}

/* ---------- Pestaña: Ajustes ---------- */
function renderAjustes() {
  const db = DB.todo();
  return `
    <div class="card">
      <div class="card-title">Ingreso mensual esperado</div>
      <div class="hint" style="margin-bottom:10px">Se usa para calcular los límites de la regla 50/30/20.</div>
      <div class="setting-row">
        <span>Ingreso esperado</span>
        <input type="number" id="ingresoEsperado" value="${db.ingresoEsperado || ""}" placeholder="0" inputmode="numeric" />
      </div>
    </div>
    <div class="card">
      <div class="card-title">Tus datos</div>
    <div class="card">
      <div class="card-title">Importar estado de cuenta</div>
      <div class="hint" style="margin-bottom:10px">Descarga tus movimientos del banco como <b>CSV</b> y súbelos aquí. Bolsillo saca los ingresos y gastos por ti.</div>
      <button class="link-btn" onclick="$('#estadoFile').click()">📄 Elegir archivo CSV…</button>
      <input type="file" id="estadoFile" accept=".csv,text/csv" hidden onchange="importarEstado(event)" />
    </div>
      </div>
    <div class="card">
      <div class="card-title">Próximamente</div>
      <div class="hint">Fase 2: conectar con tu Google Sheet para verlo también en la compu.</div>
    </div>`;
}
function enlazarAjustes() {
  const inp = $("#ingresoEsperado");
  if (inp) inp.addEventListener("change", () => {
    DB.guardarConfig({ ingresoEsperado: Number(inp.value) || 0 });
  });
}

/* =========================================================================
   Modal de agregar / editar movimiento
   ========================================================================= */
let modalState = null;

function abrirModal(id = null) {
  const db = DB.todo();
  const existente = id ? db.movimientos.find((m) => m.id === id) : null;
  modalState = existente
    ? { ...existente }
    : { id: null, tipo: "gasto", categoria: "", monto: "", fecha: new Date().toISOString().slice(0, 10), nota: "" };
  pintarModal();
  $("#modalBg").hidden = false;
}
function cerrarModal() { $("#modalBg").hidden = true; modalState = null; }

function pintarModal() {
  const db = DB.todo();
  const s = modalState;
  const tiposHtml = Object.entries(TIPOS).map(([k, t]) => `
    <button class="type-btn ${s.tipo === k ? "sel" : ""}" onclick="setTipo('${k}')">
      <span class="t-ico">${t.ico}</span>${t.label}
    </button>`).join("");

  const cats = db.categorias[s.tipo] || [];
  const chipsHtml = cats.map((c) => `
    <button class="chip ${s.categoria === c ? "sel" : ""}" onclick="setCat('${c.replace(/'/g, "\\'")}')">${c}</button>`
  ).join("") + `<button class="chip" onclick="catNueva()">+ otra</button>`;

  $("#modal").innerHTML = `
    <h2>${s.id ? "Editar" : "Nuevo"} movimiento</h2>
    <div class="type-grid">${tiposHtml}</div>
    <input class="amount-input" id="mMonto" type="number" inputmode="decimal" placeholder="$0" value="${s.monto || ""}" />
    <div style="margin-bottom:14px">
      <span style="display:block;color:var(--muted);font-size:13px;margin-bottom:6px">Categoría</span>
      <div class="cat-chips">${chipsHtml}</div>
    </div>
    <label class="field"><span>Fecha</span><input type="date" id="mFecha" value="${s.fecha}" /></label>
    <label class="field"><span>Nota (opcional)</span><input type="text" id="mNota" value="${s.nota || ""}" placeholder="Ej. Súper de la semana" /></label>
    <div class="modal-actions">
      ${s.id ? `<button class="btn btn-danger" onclick="eliminar()">Eliminar</button>` : ""}
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardar()">Guardar</button>
    </div>`;
  setTimeout(() => $("#mMonto") && $("#mMonto").focus(), 100);
}

function setTipo(t) { leerCampos(); modalState.tipo = t; modalState.categoria = ""; pintarModal(); }
function setCat(c) { leerCampos(); modalState.categoria = c; pintarModal(); }
function catNueva() {
  const nombre = prompt("Nombre de la nueva categoría:");
  if (!nombre) return;
  const db = DB.todo();
  db.categorias[modalState.tipo].push(nombre);
  DB.guardarConfig({ categorias: db.categorias });
  leerCampos();
  modalState.categoria = nombre;
  pintarModal();
}
function leerCampos() {
  if ($("#mMonto")) modalState.monto = $("#mMonto").value;
  if ($("#mFecha")) modalState.fecha = $("#mFecha").value;
  if ($("#mNota")) modalState.nota = $("#mNota").value;
}
function guardar() {
  leerCampos();
  const monto = Number(modalState.monto);
  if (!monto || monto <= 0) { alert("Escribe un monto válido."); return; }
  if (!modalState.categoria) { alert("Elige una categoría."); return; }
  const mov = {
    id: modalState.id || uid(),
    tipo: modalState.tipo,
    categoria: modalState.categoria,
    monto,
    fecha: modalState.fecha,
    nota: modalState.nota || "",
  };
  if (modalState.id) DB.actualizarMov(mov.id, mov);
  else DB.agregarMov(mov);
  cerrarModal();
  render();
}
function eliminar() {
  if (confirm("¿Eliminar este movimiento?")) { DB.borrarMov(modalState.id); cerrarModal(); render(); }
}

/* =========================================================================
   Metas, respaldo y borrado
   ========================================================================= */
function nuevaMeta() {
  const nombre = prompt("Nombre de la meta (ej. Vacaciones):");
  if (!nombre) return;
  const objetivo = Number(prompt("¿Cuánto quieres juntar? (solo número)"));
  if (!objetivo) return;
  const db = DB.todo();
  db.metas.push({ id: uid(), nombre, objetivo, actual: 0 });
  DB.guardarConfig({ metas: db.metas });
  render();
}
function exportar() {
  const blob = new Blob([JSON.stringify(DB.todo(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bolsillo-respaldo-${mesKey(new Date())}.json`;
  a.click();
}
function importar(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      localStorage.setItem(DB._key, JSON.stringify(data));
      DB._cache = null;
      render();
      alert("Respaldo importado ✅");
    } catch { alert("Archivo no válido."); }
  };
  reader.readAsText(file);
}
function borrarTodo() {
  if (confirm("¿Seguro? Se borrarán TODOS tus movimientos y no se puede deshacer.")) {
    localStorage.removeItem(DB._key);
    DB._cache = null;
    render();
  }
}

/* =========================================================================
   Importar estado de cuenta (CSV)
   Lee un archivo .csv del banco y saca los movimientos automáticamente.
   ========================================================================= */

// Aquí guardamos los movimientos detectados mientras tú los revisas
let importPendiente = [];

// (1) Se ejecuta cuando eliges el archivo
function importarEstado(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();          // el navegador sabe leer archivos
  reader.onload = () => {                    // cuando termine de leerlo...
    try {
      const filas = parseCSV(reader.result); // texto -> tabla
      const movs = analizarFilas(filas);     // tabla -> movimientos
      if (movs.length === 0) {
        alert("No encontré movimientos. Mándame los títulos de las columnas de tu CSV para ajustarlo.");
        return;
      }
      importPendiente = movs;
      mostrarRevisionImport();               // te muestro la lista para revisar
    } catch (err) {
      alert("No pude leer el archivo: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";                       // permite volver a elegir el mismo archivo
}

// (2) Convierte el texto del CSV en una tabla (filas y columnas)
function parseCSV(texto) {
  // Algunos bancos separan con coma "," y otros con punto y coma ";"
  const primera = texto.split(/\r?\n/)[0] || "";
  const sep = primera.split(";").length > primera.split(",").length ? ";" : ",";
  const filas = [];
  texto.split(/\r?\n/).forEach((linea) => {
    if (linea.trim() === "") return;         // saltar líneas vacías
    const celdas = [];
    let actual = "", enComillas = false;
    for (const c of linea) {                 // recorre letra por letra
      if (c === '"') enComillas = !enComillas;              // abre/cierra comillas
      else if (c === sep && !enComillas) { celdas.push(actual); actual = ""; }
      else actual += c;
    }
    celdas.push(actual);
    filas.push(celdas.map((s) => s.trim().replace(/^"|"$/g, "")));
  });
  return filas;
}

// (3) Interpreta la tabla y arma los movimientos
function analizarFilas(filas) {
  // Reconoce títulos en español O en inglés
  const tieneFecha = (t) => t.includes("fecha") || t.includes("date");
  const tieneMonto = (t) =>
    ["monto", "importe", "amount", "net", "cargo", "abono", "retiro", "deposito", "depósito"]
      .some((p) => t.includes(p));

  // El encabezado bueno es el que tiene FECHA y MONTO.
  // Así saltamos la tabla de resumen de arriba (que no trae fecha).
  let iEnc = -1;
  for (let i = 0; i < Math.min(filas.length, 25); i++) {
    const t = filas[i].join(" ").toLowerCase();
    if (tieneFecha(t) && tieneMonto(t)) { iEnc = i; break; }
  }
  if (iEnc === -1) return [];

  const enc = filas[iEnc].map((h) => h.toLowerCase());
  const col = (nombres) => enc.findIndex((h) => nombres.some((n) => h.includes(n)));
  const cFecha  = col(["fecha", "date"]);
  const cConcep = col(["concepto", "descrip", "detalle", "referencia", "type"]);
  const cMonto  = col(["monto", "importe", "amount", "net"]);
  const cCargo  = col(["cargo", "retiro"]);
  const cAbono  = col(["abono", "deposito", "depósito"]);

  const movs = [];
  for (let i = iEnc + 1; i < filas.length; i++) {
    const f = filas[i];
    const fecha = parseFecha(cFecha >= 0 ? f[cFecha] : "");
    if (!fecha) continue;                    // sin fecha válida, se salta

    let monto = 0, tipo = "gasto";
    if (cCargo >= 0 || cAbono >= 0) {
      const cargo = parseMonto(f[cCargo]);
      const abono = parseMonto(f[cAbono]);
      if (abono > 0) { monto = abono; tipo = "ingreso"; }
      else { monto = cargo; tipo = "gasto"; }
    } else if (cMonto >= 0) {
      const m = parseMonto(f[cMonto]);       // ej. 367.00 o -559.14
      monto = Math.abs(m);
      tipo = m >= 0 ? "ingreso" : "gasto";   // signo + = entró, - = salió
    }
    if (!monto) continue;

    movs.push({
      incluir: true,
      fecha,
      concepto: ((cConcep >= 0 ? f[cConcep] : "") || "Movimiento").slice(0, 60),
      monto,
      tipo,
    });
  }
  return movs;
}

// Convierte "$1,234.56" o "1.234,56" en el número 1234.56
function parseMonto(txt) {
  if (!txt) return 0;
  let s = String(txt).replace(/[^0-9.,-]/g, "");   // deja solo dígitos . , -
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Convierte 05/09/2026 o 2026-09-05 al formato que usa la app (2026-09-05)
function parseFecha(txt) {
  if (!txt) return "";
  txt = txt.trim();
  let m;
  if ((m = txt.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/))) {
    let d = m[1], mes = m[2], a = m[3];
    if (a.length === 2) a = "20" + a;
    return `${a}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

// (4) Pantalla de revisión: tú decides qué se guarda
function mostrarRevisionImport() {
  const filas = importPendiente.map((m, i) => `
    <label class="mov" style="cursor:pointer">
      <input type="checkbox" ${m.incluir ? "checked" : ""} onchange="toggleImport(${i}, this.checked)" style="width:20px;height:20px" />
      <div class="mov-mid">
        <div class="mov-cat">${m.concepto}</div>
        <div class="mov-note">${m.fecha} · ${m.tipo}</div>
      </div>
      <div class="mov-amt ${m.tipo === "ingreso" ? "plus" : ""}">${m.tipo === "ingreso" ? "+" : "−"}${fmt(m.monto)}</div>
    </label>`).join("");

  $("#modal").innerHTML = `
    <h2>Revisar ${importPendiente.length} movimientos</h2>
    <div class="hint" style="margin-bottom:12px">Desmarca los que no quieras. Después puedes cambiar su categoría tocándolos.</div>
    <div class="mov-list" style="max-height:50vh;overflow:auto">${filas}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarImportacion()">Agregar</button>
    </div>`;
  $("#modalBg").hidden = false;
}

// Marca/desmarca un movimiento de la lista de revisión
function toggleImport(i, val) { importPendiente[i].incluir = val; }

// (5) Guarda en la app los movimientos que dejaste marcados
function confirmarImportacion() {
  const elegidos = importPendiente.filter((m) => m.incluir);
  elegidos.forEach((m) => {
    DB.agregarMov({
      id: uid(),
      tipo: m.tipo,
      categoria: m.tipo === "ingreso" ? "Ventas" : "Sin categoría",
      monto: m.monto,
      fecha: m.fecha,
      nota: m.concepto,
    });
  });
  importPendiente = [];
  cerrarModal();
  render();
  alert(elegidos.length + " movimientos agregados ✅");
}

/* =========================================================================
   Eventos globales
   ========================================================================= */
document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => { state.tab = t.dataset.tab; render(); })
);
$("#fab").addEventListener("click", () => abrirModal());
$("#prevMonth").addEventListener("click", () => { state.fecha.setMonth(state.fecha.getMonth() - 1); render(); });
$("#nextMonth").addEventListener("click", () => { state.fecha.setMonth(state.fecha.getMonth() + 1); render(); });
$("#modalBg").addEventListener("click", (e) => { if (e.target.id === "modalBg") cerrarModal(); });

// Exponer funciones que se llaman desde el HTML (onclick)
Object.assign(window, {
  abrirModal, cerrarModal, setTipo, setCat, catNueva, guardar, eliminar,
  nuevaMeta, exportar, importar, borrarTodo,
  importarEstado, confirmarImportacion, toggleImport,   // NUEVO
});

/* Registrar service worker (para poder instalarla y usarla sin internet) */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* Arrancar */
render();
