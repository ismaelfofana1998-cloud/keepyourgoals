import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
function envKey(name:string,legacy:string){const raw=Deno.env.get(name);if(raw){try{const keys=JSON.parse(raw);return keys.default||Object.values(keys)[0] as string}catch{}}return Deno.env.get(legacy)||""}
function hex(buffer:ArrayBuffer){return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function verify(payload:string,header:string,secret:string){const parts=Object.fromEntries(header.split(",").map(x=>x.split("=")));const timestamp=parts.t,signature=parts.v1;if(!timestamp||!signature)return false;if(Math.abs(Date.now()/1000-Number(timestamp))>300)return false;const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const digest=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${timestamp}.${payload}`));return hex(digest)===signature;}

serve(async req=>{
 try{
  const payload=await req.text();const sig=req.headers.get("stripe-signature")||"";const webhookSecret=Deno.env.get("STRIPE_WEBHOOK_SECRET")||"";
  if(!webhookSecret||!await verify(payload,sig,webhookSecret))return new Response("Signature invalide",{status:400});
  const event=JSON.parse(payload);const obj=event.data?.object||{};
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,envKey("SUPABASE_SECRET_KEYS","SUPABASE_SERVICE_ROLE_KEY"));
  let tenantId=obj.metadata?.tenant_id,planCode=obj.metadata?.plan_code;
  if(event.type==="checkout.session.completed"){
   tenantId=obj.metadata?.tenant_id||obj.client_reference_id;planCode=obj.metadata?.plan_code||"starter";
   await provision(admin,tenantId,planCode,{stripe_customer_id:obj.customer,stripe_subscription_id:obj.subscription,status:"active"});
  }
  if(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type)){
   tenantId=obj.metadata?.tenant_id;planCode=obj.metadata?.plan_code||"free";
   const status=event.type==="customer.subscription.deleted"?"canceled":obj.status;
   await provision(admin,tenantId,planCode,{stripe_customer_id:obj.customer,stripe_subscription_id:obj.id,status,current_period_end:obj.current_period_end?new Date(obj.current_period_end*1000).toISOString():null,cancel_at_period_end:!!obj.cancel_at_period_end});
  }
  if(event.type==="invoice.payment_failed")await admin.from("tenant_subscriptions").update({status:"past_due"}).eq("stripe_customer_id",obj.customer);
  if(event.type==="invoice.paid")await admin.from("tenant_subscriptions").update({status:"active"}).eq("stripe_customer_id",obj.customer);
  return new Response("ok",{status:200});
 }catch(e){console.error(e);return new Response("Erreur webhook",{status:500});}
});

async function provision(admin:any,tenantId:string,planCode:string,subscription:any){if(!tenantId)return;const {data:plan}=await admin.from("subscription_plans").select("*").eq("code",planCode).single();if(!plan)return;await admin.from("tenant_subscriptions").upsert({tenant_id:tenantId,plan_code:planCode,...subscription,updated_at:new Date().toISOString()});await admin.from("tenants").update({plan_code:planCode,active_project_limit:plan.projects_limit,ai_monthly_request_limit:plan.ai_requests_limit,ai_enabled:plan.ai_requests_limit>0}).eq("id",tenantId);}
