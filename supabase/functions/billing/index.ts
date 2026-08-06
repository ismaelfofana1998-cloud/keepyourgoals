import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function envKey(name:string,legacy:string){const raw=Deno.env.get(name);if(raw){try{const keys=JSON.parse(raw);return keys.default||Object.values(keys)[0] as string}catch{}}return Deno.env.get(legacy)||""}
const publishable=()=>envKey("SUPABASE_PUBLISHABLE_KEYS","SUPABASE_ANON_KEY");
const secret=()=>envKey("SUPABASE_SECRET_KEYS","SUPABASE_SERVICE_ROLE_KEY");
async function stripe(path:string,params:Record<string,string>){const body=new URLSearchParams(params);const r=await fetch(`https://api.stripe.com/v1/${path}`,{method:"POST",headers:{Authorization:`Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,"Content-Type":"application/x-www-form-urlencoded"},body});const json=await r.json();if(!r.ok)throw new Error(json?.error?.message||"Erreur Stripe");return json;}
function priceId(plan:string){return Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}`)||""}

serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization")||"";if(!auth.startsWith("Bearer "))return Response.json({error:"Non authentifié"},{status:401,headers:cors});
  const userClient=createClient(Deno.env.get("SUPABASE_URL")!,publishable(),{global:{headers:{Authorization:auth}}});
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,secret());
  const {data:{user}}=await userClient.auth.getUser();if(!user)return Response.json({error:"Session invalide"},{status:401,headers:cors});
  const body=await req.json();const {action,tenant_id,plan_code}=body;
  const {data:member}=await userClient.from("tenant_members").select("role").eq("tenant_id",tenant_id).eq("user_id",user.id).maybeSingle();
  if(!member||!["owner","admin"].includes(member.role))return Response.json({error:"Accès refusé"},{status:403,headers:cors});
  const appUrl=Deno.env.get("APP_URL")||body.return_url;if(!appUrl)throw new Error("APP_URL absente des secrets");
  const {data:sub}=await admin.from("tenant_subscriptions").select("*").eq("tenant_id",tenant_id).maybeSingle();
  let customer=sub?.stripe_customer_id;
  if(!customer){const c=await stripe("customers",{email:user.email||"","metadata[tenant_id]":tenant_id});customer=c.id;await admin.from("tenant_subscriptions").upsert({tenant_id,plan_code:"free",status:"active",stripe_customer_id:customer});}
  if(action==="checkout"){
   const price=priceId(plan_code);if(!price)throw new Error(`Prix Stripe non configuré pour ${plan_code}`);
   const session=await stripe("checkout/sessions",{mode:"subscription",customer,"line_items[0][price]":price,"line_items[0][quantity]":"1",success_url:`${appUrl}${appUrl.includes('?')?'&':'?'}billing=success`,cancel_url:`${appUrl}${appUrl.includes('?')?'&':'?'}billing=cancel`,client_reference_id:tenant_id,"metadata[tenant_id]":tenant_id,"metadata[plan_code]":plan_code,"subscription_data[metadata][tenant_id]":tenant_id,"subscription_data[metadata][plan_code]":plan_code,allow_promotion_codes:"true"});
   return Response.json({url:session.url},{headers:cors});
  }
  if(action==="portal"){
   const session=await stripe("billing_portal/sessions",{customer,return_url:appUrl});return Response.json({url:session.url},{headers:cors});
  }
  return Response.json({error:"Action inconnue"},{status:400,headers:cors});
 }catch(e){console.error(e);return Response.json({error:e.message||"Erreur interne"},{status:500,headers:cors});}
});
