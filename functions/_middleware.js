export async function onRequest({next}) {
  const response=await next();
  const secured=new Response(response.body,response);
  secured.headers.set("x-content-type-options","nosniff");
  secured.headers.set("referrer-policy","same-origin");
  secured.headers.set("permissions-policy","camera=(), microphone=(), geolocation=()");
  secured.headers.set("content-security-policy","default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return secured;
}
