const fs = require('fs');
const path = require('path');
const SPREADSHEET_ID = '1Lr7WAqefrjq_KwlmSWWRcaqKFH_BfDmKLqQtM2NEBwU';
const GID = '1346516126';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r\n|\n|\r/);
  for (let line of lines) {
    if (line === '') continue;
    const values = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(cur); cur = '';
      } else cur += ch;
    }
    values.push(cur);
    rows.push(values);
  }
  return rows;
}

function normalizeHeader(h){
  return String(h||'').trim().toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
}

function escapeHtml(s){ if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function main(){
  console.log('Descargando CSV...', CSV_URL);
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  const rows = parseCSV(text);
  if (rows.length < 2) {
    console.log('No hay datos suficientes en la hoja');
    return;
  }
  const headers = rows[0].map(h => normalizeHeader(h));
  const data = rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((k,i) => obj[k] = r[i] || '');
    return obj;
  });

  // Generar HTML de tarjetas (puedes adaptar el markup a tu estilo)
  const cardsHtml = data.map(d => {
    const nombre = escapeHtml(d.prototipo || d.nombre || 'Sin nombre');
    const descripcion = escapeHtml(d.descripcion || 'Sin descripción');
    const portada = d.portada || '';
    let imagen = 'https://placehold.co/600x400/4a5568/ffffff?text=Sin+Imagen';
    if (portada) {
      if (portada.startsWith('http')) imagen = portada;
      else {
        const m = portada.match(/\/file\/d\/([^\/]+)\//);
        if (m) imagen = `https://drive.google.com/uc?export=view&id=${m[1]}`;
        else imagen = portada;
      }
    }
    const precio = d.precio ? `$${escapeHtml(d.precio)}` : 'Precio no disponible';
    const url = d.prototipo ? `https://www.appsheet.com/start/BROWSER/${encodeURIComponent(d.prototipo)}` : '#';
    return `
      <article class="project-card">
        <div class="card-image" style="background-image:url('${escapeHtml(imagen)}')"></div>
        <div class="card-content">
          <h3 class="project-title">${nombre}</h3>
          <p class="project-desc">${descripcion}</p>
          <div class="project-tags"><span class="tag">${precio}</span></div>
          <a class="project-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">Ver Aplicación ↗</a>
        </div>
      </article>
    `;
  }).join('\n');

  // Leer plantilla
  const tplPath = path.join(__dirname, '..', 'index-template.html');
  const tpl = fs.readFileSync(tplPath, 'utf8');
  const out = tpl.replace('<!--PROJECTS-->', cardsHtml);
  // Escribir a docs/index.html
  const outPath = path.join(__dirname, '..', 'docs', 'index.html');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out, 'utf8');
  console.log('Generado docs/index.html con', data.length, 'proyectos');
}

main().catch(err => { console.error(err); process.exit(1); });
