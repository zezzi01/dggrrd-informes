/*
 * Minimal DOCX builder for DGGRRD. Does not rely on CDN libraries or external
 * conversion services. Produces a standards-based ZIP/OOXML .docx in the browser.
 */
const enc = new TextEncoder();
const xmlEsc = value => String(value ?? "").replace(/[&<>"']/g, character =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[character])
);
const textBytes = value => enc.encode(value);
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function writeZip(entries) {
  const chunks = [], directory = [];
  let offset = 0, centralSize = 0;
  for (const [filename, payload] of entries) {
    const name = textBytes(filename);
    const data = typeof payload === "string" ? textBytes(payload) : payload;
    const crc = crc32(data);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    chunks.push(header, data);
    const cd = new Uint8Array(46 + name.length);
    const c = new DataView(cd.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    cd.set(name, 46);
    directory.push(cd);
    offset += header.length + data.length;
    centralSize += cd.length;
  }
  if (entries.length > 65535 || offset + centralSize > 0xFFFFFFFF) {
    throw new Error("El informe excede el tamaño permitido para este exportador.");
  }
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}
function run(value, {bold=false, color="243B38", size=21}={}) {
  const rpr = '<w:rPr>'+(bold ? '<w:b/>' : '')+
    '<w:color w:val="'+color+'"/><w:sz w:val="'+size+'"/></w:rPr>';
  const t = xmlEsc(value).split(/\r?\n/).map(s=>'<w:t xml:space="preserve">'+s+'</w:t>').join('<w:br/>');
  return '<w:r>'+rpr+t+'</w:r>';
}
function para(value, {center=false,bold=false,size=21,color="243B38",before=0,after=140}={}) {
  return '<w:p><w:pPr>'+(center?'<w:jc w:val="center"/>':'')+
    '<w:spacing w:before="'+before+'" w:after="'+after+'"/></w:pPr>'+
    run(value,{bold,size,color})+'</w:p>';
}
function h2(value) { return para(value,{bold:true,size:26,color:"5A3334",before:260,after:125}); }
function cell(value, head=false) {
  const fill = head ? '<w:tcPr><w:shd w:fill="E8EFE8"/></w:tcPr>' : "";
  return '<w:tc>'+fill+para(value,{bold:head,size:18,after:30})+'</w:tc>';
}
function table(headers, rows) {
  const borders = ['top','left','bottom','right','insideH','insideV'].map(x =>
    '<w:'+x+' w:val="single" w:sz="4" w:color="A4B6AA"/>').join('');
  const row = (values,head=false) => '<w:tr>'+values.map(x=>cell(x,head)).join('')+'</w:tr>';
  const validRows = rows.length ? rows : [headers.map((_,i)=>i===0?'Sin registros':'—')];
  return '<w:tbl><w:tblPr><w:tblW w:type="pct" w:w="5000"/><w:tblBorders>'+
    borders+'</w:tblBorders></w:tblPr>'+row(headers,true)+validRows.map(r=>row(r)).join('')+'</w:tbl>';
}
function logoRun(pixelWidth,pixelHeight) {
  const widthEmu = 250 * 9525;
  const heightEmu = Math.round(widthEmu * pixelHeight / pixelWidth);
  return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'+
    '<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+widthEmu+'" cy="'+heightEmu+'"/>'+
    '<wp:docPr id="1" name="Escudo municipal"/>'+
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'+
    '<pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Escudo de Asunción"/><pic:cNvPicPr/></pic:nvPicPr>'+
    '<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'+
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+widthEmu+'" cy="'+heightEmu+'"/></a:xfrm>'+
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'+
    '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}
async function fetchMunicipalLogo(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length<24 || bytes[0]!==137 || bytes[1]!==80 || bytes[2]!==78 || bytes[3]!==71) return null;
    const v = new DataView(bytes.buffer);
    return {bytes,width:v.getUint32(16,false),height:v.getUint32(20,false)};
  } catch { return null; }
}
export async function makeInstitutionalWord(model,{logoUrl}={}) {
  const logo = logoUrl ? await fetchMunicipalLogo(logoUrl) : null;
  const sections = [];
  if(logo?.width && logo?.height) sections.push(logoRun(logo.width,logo.height));
  else sections.push(para("MUNICIPALIDAD DE ASUNCIÓN",{bold:true,size:28,color:"812E35",center:true}));
  sections.push(
    para("DIRECCIÓN GENERAL DE GESTIÓN Y REDUCCIÓN DE RIESGO DE DESASTRES",{bold:true,size:19,color:"713138",center:true}),
    para("INFORME DE ACTIVIDADES DE LA DGGRRD",{bold:true,size:29,color:"1E3837",center:true,before:260}),
    para("PERÍODO: "+model.period,{bold:true,size:21,center:true,after:240}),
    h2("1. Objeto y alcance"),
    para("El presente informe consolida las actividades registradas por la DGGRRD durante el período seleccionado, según los datos de Survey123 y ArcGIS Online. Los resultados deben validarse por el área responsable."),
    h2("2. Síntesis ejecutiva"),
    table(["Indicador","Resultado"],[
      ["Jornadas registradas",String(model.jornadas)],
      ["Intervenciones",String(model.intervenciones)],
      ["Barrios identificados",String(model.barrios)],
      ["Residuos gestionados (kg)",String(model.residuos)]
    ]),
    h2("3. Intervenciones por categoría"),
    table(["Categoría","Cantidad"],model.categorias),
    h2("4. Estados de ejecución"),
    table(["Estado","Cantidad"],model.estados),
    h2("5. Detalle de intervenciones"),
    table(["Fecha","Categoría","Barrio","Estado","Lugar","Descripción"],model.detalle),
    h2("6. Gestión de residuos"),
    para(model.notaResiduos),
    h2("7. Conclusiones y observaciones"),
    para(model.conclusiones || "Pendiente de validación por el área responsable."),
    para("Fuente: DGGRRD / Survey123 / ArcGIS Online. Generado: "+new Date().toLocaleDateString("es-PY"),{size:16,color:"6E807A",before:350})
  );
  const documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '+
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '+
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '+
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '+
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'+
    '<w:body>'+sections.join('')+
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'+
    '<w:pgMar w:top="1120" w:right="900" w:bottom="1120" w:left="900"/></w:sectPr>'+
    '</w:body></w:document>';
  const manifest='<?xml version="1.0" encoding="UTF-8"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    (logo?'<Default Extension="png" ContentType="image/png"/>':'')+
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
    '</Types>';
  const rootRels='<?xml version="1.0" encoding="UTF-8"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'+
    '</Relationships>';
  const imageRels='<?xml version="1.0" encoding="UTF-8"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    (logo?'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/municipal.png"/>':'')+
    '</Relationships>';
  const entries=[
    ["[Content_Types].xml",manifest],
    ["_rels/.rels",rootRels],
    ["word/document.xml",documentXml],
    ["word/_rels/document.xml.rels",imageRels]
  ];
  if(logo)entries.push(["word/media/municipal.png",logo.bytes]);
  return writeZip(entries);
}
