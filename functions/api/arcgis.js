const SERVICE = "https://services7.arcgis.com/rMjPnBdK2qv90f42/arcgis/rest/services/service_03acd09013ba4976b3cc79e87c6a6689/FeatureServer";
const PORTAL = "https://www.arcgis.com";
let cachedToken = null;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
});

function authenticatedEmail(request) {
  return request.headers.get("cf-access-authenticated-user-email") || "";
}

async function arcgisToken(env) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  let url, form;
  if (env.ARCGIS_CLIENT_ID && env.ARCGIS_CLIENT_SECRET) {
    url = PORTAL + "/sharing/rest/oauth2/token";
    form = new URLSearchParams({f:"json",grant_type:"client_credentials",client_id:env.ARCGIS_CLIENT_ID,client_secret:env.ARCGIS_CLIENT_SECRET,expiration:"120"});
  } else if (env.ARCGIS_USERNAME && env.ARCGIS_PASSWORD && env.ARCGIS_REFERER) {
    url = PORTAL + "/sharing/rest/generateToken";
    form = new URLSearchParams({f:"json",username:env.ARCGIS_USERNAME,password:env.ARCGIS_PASSWORD,client:"referer",referer:env.ARCGIS_REFERER,expiration:"120"});
  } else {
    throw new Error("Faltan los secretos de acceso a ArcGIS en el servidor.");
  }
  const response = await fetch(url,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form});
  const data = await response.json();
  if (!response.ok || data.error || !data.access_token && !data.token) throw new Error(data.error?.message || "ArcGIS rechazó las credenciales del servidor.");
  const value=data.access_token||data.token;
  const expiresAt=data.expires ? Number(data.expires) : Date.now()+(Number(data.expires_in)||7200)*1000;
  cachedToken={value,expiresAt};
  return value;
}

async function arcgisFetch(path, params, env) {
  const token=await arcgisToken(env);
  const url=new URL(SERVICE+path);
  Object.entries({...params,f:"json",token}).forEach(([key,value])=>url.searchParams.set(key,String(value)));
  const headers=env.ARCGIS_REFERER ? {referer:env.ARCGIS_REFERER} : {};
  const response=await fetch(url,{headers});
  const data=await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message || "Falló la consulta a ArcGIS.");
  return data;
}

export async function onRequestPost({request,env}) {
  const email=authenticatedEmail(request);
  if (!email) return json({error:"Acceso no autenticado. Ingresá nuevamente mediante el portal seguro."},401);
  try {
    const input=await request.json();
    if (input.operation==="session") return json({email});
    if (![0,1].includes(input.layer)) return json({error:"Capa no permitida."},400);
    if (input.operation==="metadata") return json(await arcgisFetch("/"+input.layer,{},env));
    if (input.operation==="query") {
      const count=Math.min(Math.max(Number(input.resultRecordCount)||1000,1),1000);
      const offset=Math.max(Number(input.resultOffset)||0,0);
      const meta=await arcgisFetch("/"+input.layer,{},env);
      const oid=meta.objectIdField||"OBJECTID";
      const order=input.orderByFields===oid+" ASC" ? input.orderByFields : oid+" ASC";
      return json(await arcgisFetch("/"+input.layer+"/query",{where:"1=1",outFields:"*",returnGeometry:"false",resultOffset:offset,resultRecordCount:count,orderByFields:order},env));
    }
    return json({error:"Operación no permitida."},400);
  } catch (error) {
    console.error("ArcGIS proxy error", error);
    return json({error:error.message||"Error interno."},502);
  }
}

export function onRequest() { return json({error:"Método no permitido."},405); }
