const BASE = "https://services7.arcgis.com/rMjPnBdK2qv90f42/arcgis/rest/services/service_03acd09013ba4976b3cc79e87c6a6689/FeatureServer";
const $ = id => document.getElementById(id);
const app = { request:null, meta:[], data:[], report:[], period:null, fields:[] };
const candidates={fDate:["fecha_heredada","fecha_actividad","fecha"],fCategory:["categoria"],fNeighborhood:["barrio_heredado","barrio"],fState:["estado"],fSite:["sitio_heredado","sitio","lugar"],fDescription:["descripcion","detalle"],fWaste:["residuos_kg","kg_residuos","peso_kg"],fService:["tipo_servicio","servicio_residuos"]};
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=n=>new Intl.NumberFormat("es-PY",{maximumFractionDigits:2}).format(n||0);
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const at=r=>r?.attributes||{};
const val=(r,k)=>k?at(r)[k]:undefined;
const selected=k=>$(k).value;
const formatDate=v=>{const d=new Date(v);return Number.isFinite(d.valueOf())?d.toLocaleDateString("es-PY",{timeZone:"America/Asuncion"}):"—"};
const label=(r,k)=>{const v=val(r,k),f=app.fields.find(f=>f.name===k);return f?.domain?.codedValues?.find(o=>String(o.code)===String(v))?.name||String(v??"")};
function status(s,err=false){$("loginStatus").textContent=s;$("loginStatus").className="status "+(err?"error":"success")}
function loadSDK(){return new Promise((resolve,reject)=>{if(!window.require)return reject(Error("No se cargó ArcGIS Maps SDK."));window.require(["esri/identity/OAuthInfo","esri/identity/IdentityManager","esri/request"],(OAuthInfo,IdentityManager,request)=>resolve({OAuthInfo,IdentityManager,request}),reject)})}
async function connect(){
 const id=$("clientId").value.trim();if(!id)return status("Ingresá el Client ID de la aplicación OAuth.",true);
 $("connectBtn").disabled=true;
 try {
   const sdk=await loadSDK();
   sdk.IdentityManager.registerOAuthInfos([new sdk.OAuthInfo({appId:id,portalUrl:"https://www.arcgis.com",popup:false})]);
   await sdk.IdentityManager.getCredential("https://www.arcgis.com/sharing");
   app.request=sdk.request;
   app.meta=[];
   for(let i=0;i<2;i++){
     const response=await sdk.request(BASE+"/"+i,{query:{f:"json"},responseType:"json"});
     if(response.data.error)throw Error(response.data.error.message);
     app.meta.push(response.data);
   }
   app.fields=app.meta[1].fields||[];
   for(const [id,hints] of Object.entries(candidates)){
     const el=$(id);el.innerHTML='<option value="">— No seleccionado —</option>';
     app.fields.forEach(f=>{const o=document.createElement("option");o.value=f.name;o.textContent=(f.alias||f.name)+" ("+f.name+")";el.appendChild(o)});
     el.value=app.fields.find(f=>hints.some(x=>norm(x)===norm(f.name)))?.name||app.fields.find(f=>hints.some(x=>norm(f.alias).includes(norm(x))))?.name||"";
     el.disabled=false;el.addEventListener("change",render);
   }
   $("loadBtn").disabled=false;$("connectionBadge").textContent="ArcGIS conectado";$("connectionBadge").classList.add("ready");
   status("Conexión correcta. Elegí el período y consultá las actividades.");
 } catch(e){status("No se pudo conectar: "+e.message+". Revisá el Client ID, las URLs de retorno OAuth y los permisos.",true)}
 finally{$("connectBtn").disabled=false}
}
async function all(url,meta){
 const size=Math.min(meta.maxRecordCount||1000,1000),oid=meta.objectIdField||"OBJECTID";let offset=0,rows=[];
 for(let i=0;i<1000;i++){
   const r=await app.request(url+"/query",{query:{f:"json",where:"1=1",outFields:"*",returnGeometry:false,resultOffset:offset,resultRecordCount:size,orderByFields:oid+" ASC"},responseType:"json"});
   if(r.data.error)throw Error(r.data.error.message);
   const part=r.data.features||[];rows.push(...part);offset+=part.length;
   if(!part.length||part.length<size&&!r.data.exceededTransferLimit)break;
   if(i===999)throw Error("Se alcanzó el límite de resultados.");
 }
 return rows;
}
function period(){
 if(document.querySelector('input[name="mode"]:checked').value==="mensual"){
  const [y,m]=$("month").value.split("-").map(Number);if(!y||!m||m<1||m>12)throw Error("Seleccioná un mes válido.");
  return {a:new Date(y,m-1,1).getTime(),b:new Date(y,m,1).getTime(),name:new Intl.DateTimeFormat("es-PY",{month:"long",year:"numeric"}).format(new Date(y,m-1,1))};
 }
 const a=Date.parse($("start").value+"T00:00:00"),b=Date.parse($("end").value+"T00:00:00")+86400000;
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw Error("Revisá las fechas.");
 return {a,b,name:$("start").value+" a "+$("end").value};
}
function timestamp(v){if(typeof v==="number")return v;return new Date(v).getTime()}
function within(v,p){const t=timestamp(v);return Number.isFinite(t)&&t>=p.a&&t<p.b}
async function fetchData(){
 $("loadBtn").disabled=true;status("Consultando las capas de ArcGIS...");
 try{
  app.period=period();
  app.data=await Promise.all([0,1].map(i=>all(BASE+"/"+i,app.meta[i])));
  render();$("pdfBtn").disabled=false;$("wordBtn").disabled=false;
  status("Consulta finalizada; los indicadores y el informe están preparados.");
 }catch(e){status("Error de consulta: "+e.message,true)}
 finally{$("loadBtn").disabled=false}
}
function summary(){
 const p=app.period,k=selected("fDate"),cat=selected("fCategory"),bar=selected("fNeighborhood"),st=selected("fState"),kg=selected("fWaste");
 const rows=app.data[1].filter(r=>k&&within(val(r,k),p)),groups=new Map(),states=new Map(),barrios=new Set();let waste=0;
 for(const r of rows){
  const c=label(r,cat)||"Sin categoría",s=label(r,st)||"Sin estado",b=label(r,bar);
  groups.set(c,(groups.get(c)||0)+1);states.set(s,(states.get(s)||0)+1);
  if(b)barrios.add(norm(b));
  if(kg){const n=Number(val(r,kg));if(Number.isFinite(n)&&n>=0)waste+=n}
 }
 const parentField=app.meta[0].fields.find(f=>["fecha_actividad","fecha","fecha_inicio"].includes(norm(f.name)))?.name;
 const parents=parentField?app.data[0].filter(r=>within(val(r,parentField),p)):app.data[0].filter(r=>rows.some(ch=>norm(val(ch,"parentglobalid"))===norm(val(r,"globalid"))));
 return {rows,groups,states,barrios,waste,parents};
}
function render(){
 if(!app.period||!app.data.length)return;
 const s=summary();app.report=s;
 $("periodCaption").textContent=app.period.name;
 $("nJornadas").textContent=num(s.parents.length);$("nIntervenciones").textContent=num(s.rows.length);
 $("nBarrios").textContent=num(s.barrios.size);$("nResiduos").textContent=selected("fWaste")?num(s.waste):"N/D";
 $("totalCount").textContent=s.groups.size+" categorías";$("detailCount").textContent=s.rows.length+" registros";
 const groups=[...s.groups].sort((a,b)=>b[1]-a[1]),max=Math.max(1,...groups.map(g=>g[1]));
 $("categoryBars").classList.toggle("empty",!groups.length);
 $("categoryBars").innerHTML=groups.length?groups.map(([name,n])=>'<div class="bar"><div class="bar-label"><span>'+safe(name)+'</span><strong>'+num(n)+'</strong></div><div class="bar-track"><div class="bar-fill" style="width:'+100*n/max+'%"></div></div></div>').join(""):"No hay datos del período.";
 $("rows").innerHTML=s.rows.length?s.rows.slice(0,1000).map(r=>'<tr><td>'+safe(formatDate(val(r,selected("fDate"))))+'</td><td>'+safe(label(r,selected("fCategory")))+'</td><td>'+safe(label(r,selected("fNeighborhood")))+'</td><td>'+safe(label(r,selected("fState")))+'</td></tr>').join(""):'<tr><td colspan="4" class="empty-cell">Sin registros.</td></tr>';
}
function reportMarkup(){
 const s=summary(),table=(headers,data)=>'<table><thead><tr>'+headers.map(t=>'<th>'+safe(t)+'</th>').join("")+'</tr></thead><tbody>'+data.map(row=>'<tr>'+row.map(t=>'<td>'+safe(t)+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
 const details=s.rows.map(r=>[formatDate(val(r,selected("fDate"))),label(r,selected("fCategory")),label(r,selected("fNeighborhood")),label(r,selected("fState")),label(r,selected("fSite")),label(r,selected("fDescription"))]);
 return '<h1>Municipalidad de Asunción</h1><h4>DIRECCIÓN GENERAL DE GESTIÓN Y REDUCCIÓN DE RIESGO DE DESASTRES</h4><hr><h2>INFORME DE ACTIVIDADES DE LA DGGRRD</h2><p style="text-align:center">'+safe(app.period.name)+'</p><h3>1. Objeto y alcance</h3><p>Resumen de actividades registradas en ArcGIS Online para el período seleccionado, sujeto a validación institucional.</p><h3>2. Síntesis ejecutiva</h3>'+table(["Indicador","Total"],[["Jornadas",num(s.parents.length)],["Intervenciones",num(s.rows.length)],["Barrios identificados",num(s.barrios.size)],["Residuos gestionados (kg)",selected("fWaste")?num(s.waste):"No disponible"]])+'<h3>3. Intervenciones por categoría</h3>'+table(["Categoría","Total"],[...s.groups].map(([k,v])=>[k,num(v)]))+'<h3>4. Estados de ejecución</h3>'+table(["Estado","Total"],[...s.states].map(([k,v])=>[k,num(v)]))+'<h3>5. Detalle de intervenciones</h3>'+table(["Fecha","Categoría","Barrio","Estado","Lugar","Descripción"],details)+'<h3>6. Gestión de residuos</h3><p>'+(selected("fWaste")?"Cantidad registrada: "+num(s.waste)+" kg. Verificar unidad y comprobantes de pesaje.":"No se seleccionó un campo validado en kilogramos; no se calcula un total.")+'</p><h3>7. Conclusiones y observaciones</h3><p>'+safe($("conclusions").value||"Pendiente de validación por el responsable del informe.")+'</p><small>Fuente: Survey123 / ArcGIS Online · Fecha de generación: '+new Date().toLocaleDateString("es-PY")+'</small>';
}
function pdf(){
 try{
  const w=window.open("","_blank");if(!w)throw Error("Habilitá ventanas emergentes.");
  w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe DGGRRD</title><style>body{font:12px Georgia,serif;max-width:1000px;margin:auto;padding:30px;color:#161616}h1,h2,h4{text-align:center}h1{color:#8b2626}h3{margin-top:25px}table{border-collapse:collapse;width:100%;font-size:11px;margin:16px 0}td,th{border:1px solid #999;padding:7px;vertical-align:top}th{background:#eee}@media print{@page{size:A4;margin:16mm}body{padding:0}thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body>'+reportMarkup()+'<p>Para obtener el PDF: Imprimir → Guardar como PDF.</p></body></html>');w.document.close();
 }catch(e){status(e.message,true)}
}
async function word(){
 try{
  if(!window.docx)throw Error("No se pudo cargar la biblioteca Word.");
  const D=window.docx,s=summary(),P=t=>new D.Paragraph({text:String(t),spacing:{after:160}}),H=t=>new D.Paragraph({text:t,heading:D.HeadingLevel.HEADING_2});
  const T=(head,rows)=>new D.Table({rows:[new D.TableRow({children:head.map(t=>new D.TableCell({children:[P(t)]}))}),...rows.map(row=>new D.TableRow({children:row.map(t=>new D.TableCell({children:[P(t)]}))}))]});
  const body=[P("MUNICIPALIDAD DE ASUNCIÓN"),P("DIRECCIÓN GENERAL DE GESTIÓN Y REDUCCIÓN DE RIESGO DE DESASTRES"),P("INFORME DE ACTIVIDADES - "+app.period.name),H("1. Objeto y alcance"),P("Consolidado de registros de ArcGIS Online, sujeto a validación institucional."),H("2. Síntesis ejecutiva"),T(["Indicador","Cantidad"],[["Jornadas",num(s.parents.length)],["Intervenciones",num(s.rows.length)],["Barrios",num(s.barrios.size)],["Residuos (kg)",selected("fWaste")?num(s.waste):"No disponible"]]),H("3. Categorías"),T(["Categoría","Cantidad"],[...s.groups].map(([k,v])=>[k,num(v)])),H("4. Estados"),T(["Estado","Cantidad"],[...s.states].map(([k,v])=>[k,num(v)])),H("5. Detalle"),T(["Fecha","Categoría","Barrio","Estado"],s.rows.map(r=>[formatDate(val(r,selected("fDate"))),label(r,selected("fCategory")),label(r,selected("fNeighborhood")),label(r,selected("fState"))])),H("6. Gestión de residuos"),P(selected("fWaste")?num(s.waste)+" kg declarados, sujetos a validación.":"No hay campo kg seleccionado."),H("7. Conclusiones"),P($("conclusions").value||"Pendiente de revisión.")];
  const blob=await D.Packer.toBlob(new D.Document({sections:[{children:body}]}));const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="Informe_DGGRRD.docx";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }catch(e){status(e.message,true)}
}
document.querySelectorAll('input[name="mode"]').forEach(r=>r.addEventListener("change",()=>{const m=document.querySelector('input[name="mode"]:checked').value==="mensual";$("monthlyRange").hidden=!m;$("periodRange").hidden=m}));
$("connectBtn").addEventListener("click",connect);$("loadBtn").addEventListener("click",fetchData);$("pdfBtn").addEventListener("click",pdf);$("wordBtn").addEventListener("click",word);
const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js";document.head.appendChild(script);