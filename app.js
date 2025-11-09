
let PRODUCTS = [];
const cart = new Map();
let activeChip = ''; // frutas | verduras | salsas | otros | ''

// Toast helper
function toast({title='Listo', desc='', timeout=2200}={}){
  const host = document.getElementById('toaster');
  if(!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="icon">✅</div>
    <div><div class="title">${title}</div><div class="desc">${desc}</div></div>
    <button aria-label="Cerrar" onclick="this.parentElement.remove()">×</button>`;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity = 0; setTimeout(()=>el.remove(), 260); }, timeout);
}

function fmt(n){ return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0) }
function num(x){ const n = parseFloat(x); return isNaN(n)?0:n }

async function loadProducts(){
  const res = await fetch('./data/products.json');
  PRODUCTS = await res.json();
  initFilters();
  renderChips();
  renderProducts();
  renderQuote();
}

function deptOf(p){ return (p.department||'').toLowerCase(); }
function groupOf(p){
  const d = deptOf(p);
  const name = (p.name||'').toLowerCase();
  if(d.includes('frut') || name.includes('manzana') || name.includes('plátano') || name.includes('banana')) return 'frutas';
  if(d.includes('verdu') || name.includes('lechuga') || name.includes('zanahoria')) return 'verduras';
  if(d.includes('salsa') || name.includes('salsa')) return 'salsas';
  return 'otros';
}

function initFilters(){
  const deptSel = document.getElementById('dept');
  const depts = Array.from(new Set(PRODUCTS.map(p=>p.department).filter(Boolean))).sort();
  depts.forEach(d=>{ const o=document.createElement('option'); o.value=d; o.textContent=d; deptSel.appendChild(o); });
}

function renderChips(){
  const chips = document.getElementById('chips');
  const counts = {frutas:0, verduras:0, salsas:0, otros:0};
  PRODUCTS.forEach(p=>{ counts[groupOf(p)]++; });
  const items = [
    ['','Todos'],
    ['frutas', `Frutas (${counts.frutas})`],
    ['verduras', `Verduras (${counts.verduras})`],
    ['salsas', `Salsas (${counts.salsas})`],
    ['otros', `Otros (${counts.otros})`],
  ];
  chips.innerHTML = items.map(([k,label])=>`<span class="chip ${activeChip===k?'active':''}" onclick="toggleChip('${k}')">${label}</span>`).join('');
}

function toggleChip(k){
  activeChip = (activeChip===k) ? '' : k;
  renderChips();
  renderProducts();
}

function renderProducts(){
  const q = document.getElementById('search').value.trim().toLowerCase();
  const dept = document.getElementById('dept').value;
  const showCost = document.getElementById('showCost').checked;
  document.querySelectorAll('.cost-col').forEach(c=>c.style.display = showCost ? '' : 'none');

  const body = document.getElementById('prod-body');
  const rows = PRODUCTS.filter(p=>{
      const okQ = !q || p.name.toLowerCase().includes(q) || String(p.code||'').includes(q);
      const okD = !dept || p.department===dept;
      const okC = !activeChip || groupOf(p)===activeChip;
      return okQ && okD && okC;
    })
    .map(p=>{
      const venta = p.price ?? 0;
      const mayo = p.wholesale ?? 0;
      const costo = p.cost ?? 0;
      const stock = p.stock ?? 0;
      return `<tr>
        <td>${p.code||''}</td>
        <td>${p.name}</td>
        <td>${p.tipo||''}</td>
        <td class="right">${fmt(venta)}</td>
        <td class="right">${fmt(mayo)}</td>
        <td class="right cost-col" style="display:${showCost?'':'none'}">${fmt(costo)}</td>
        <td class="right">${stock}</td>
        <td>
          <div style="display:flex;gap:6px;align-items:center">
            <input type="number" min="1" value="1" id="qty-${p.code}" style="width:80px">
            <select id="ptype-${p.code}">
              <option value="venta" ${venta? 'selected':''}>Menudeo</option>
              <option value="mayoreo" ${mayo ? 'selected':''}>Mayoreo</option>
            </select>
            <button class="primary" onclick="addToQuote('${p.code}')">Agregar</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  body.innerHTML = rows || '<tr><td colspan="8"><small>No hay resultados…</small></td></tr>';
}

function addToQuote(code){
  const p = PRODUCTS.find(x=>String(x.code)===String(code));
  if(!p) return;
  const qty = num(document.getElementById('qty-'+code)?.value||1);
  const ptype = document.getElementById('ptype-'+code)?.value || 'venta';
  const unit = ptype==='mayoreo' && p.wholesale>0 ? p.wholesale : (p.price||0);
  const prev = cart.get(code) || {code:p.code,name:p.name,price:unit,ptype,qty:0};
  prev.ptype = ptype; prev.price = unit; prev.qty += qty;
  cart.set(code, prev);
  renderQuote();
  toast({title:'Producto agregado', desc:`${qty} × ${p.name}`});
}

function removeFromQuote(code){
  const item = cart.get(code);
  cart.delete(code); renderQuote();
  if(item){ toast({title:'Producto eliminado', desc:item.name}); }
}

function renderQuote(){
  const tbody = document.getElementById('quote-body');
  let subtotal = 0;
  const rows = [...cart.values()].map(it=>{
    const total = it.price * it.qty;
    subtotal += total;
    return `<tr>
      <td>${it.code}</td>
      <td>${it.name}</td>
      <td class="right">${fmt(it.price)}</td>
      <td>${it.ptype==='mayoreo'?'Mayoreo':'Menudeo'}</td>
      <td class="right">${it.qty}</td>
      <td class="right">${fmt(total)}</td>
      <td><button onclick="removeFromQuote('${it.code}')">✕</button></td>
    </tr>`
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="7"><small>Sin productos.</small></td></tr>';

  const discount = num(document.getElementById('discount').value||0);
  const afterDiscount = Math.max(subtotal - discount, 0);
  const tax = document.getElementById('iva').checked ? afterDiscount * 0.16 : 0;
  const total = afterDiscount + tax;
  document.getElementById('sum-sub').textContent = fmt(subtotal);
  document.getElementById('sum-tax').textContent = fmt(tax);
  document.getElementById('sum-total').textContent = fmt(total);
}

function exportPDF(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt', format:'a4'});
  const logo = document.getElementById('logo');
  if(logo){ doc.addImage(logo, 'PNG', 40, 32, 64, 64); }
  doc.setFontSize(16); doc.text('Cotización - Raíz y Rama', 120, 60);
  const fecha = new Date().toLocaleDateString('es-MX');
  doc.setFontSize(11); doc.text(`Fecha: ${fecha}`, 120, 82);

  let y = 140; doc.setFontSize(12); doc.text('Productos', 40, y); y+=10;
  doc.setFontSize(10);
  doc.text('Código', 40, y); doc.text('Descripción', 100, y);
  doc.text('Precio', 360, y); doc.text('Tipo', 440, y);
  doc.text('Cant.', 500, y); doc.text('Importe', 560, y);
  y+=8; doc.line(40,y,600,y); y+=12;

  let subtotal = 0;
  [...cart.values()].forEach(it=>{
    const imp = it.price*it.qty; subtotal += imp;
    doc.text(String(it.code), 40, y);
    doc.text(String(it.name), 100, y);
    doc.text(fmt(it.price), 360, y);
    doc.text(it.ptype==='mayoreo'?'Mayoreo':'Menudeo', 440, y);
    doc.text(String(it.qty), 500, y);
    doc.text(fmt(imp), 560, y);
    y += 16;
  });

  const discount = num(document.getElementById('discount').value||0);
  const afterDiscount = Math.max(subtotal - discount, 0);
  const tax = document.getElementById('iva').checked ? afterDiscount * 0.16 : 0;
  const total = afterDiscount + tax;
  y+=10; doc.line(360,y,600,y); y+=16;
  [['Subtotal:',fmt(subtotal)],['Descuento:',fmt(discount)],['IVA:',fmt(tax)],['Total:',fmt(total)]].forEach(([k,v])=>{ doc.text(k,380,y); doc.text(v,540,y,{align:'right'}); y+=16; });
  doc.save(`RaizRama-Cotizacion-${Date.now()}.pdf`);
}

window.addEventListener('DOMContentLoaded', ()=>{
  loadProducts();
  toast({title:'Notificaciones activas', desc:'Se mostrarán al agregar/eliminar.'});
  document.getElementById('search').addEventListener('input', renderProducts);
  document.getElementById('dept').addEventListener('change', renderProducts);
  document.getElementById('showCost').addEventListener('change', renderProducts);
  document.getElementById('discount').addEventListener('input', renderQuote);
  document.getElementById('iva').addEventListener('change', renderQuote);
  document.getElementById('export').addEventListener('click', exportPDF);
});
