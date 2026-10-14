import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const headers={'Access-Control-Allow-Origin':Deno.env.get('ALLOWED_ORIGIN')||'http://localhost:5173','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const send=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const val=(x:unknown,max=500)=>typeof x==='string'?x.trim().slice(0,max):'';
const list=(x:unknown,allowed?:string[])=>Array.isArray(x)?x.filter(y=>typeof y==='string'&&(!allowed||allowed.includes(y))).slice(0,20):[];
const time=/^([01]\d|2[0-3]):[0-5]\d$/;
const date=/^\d{4}-\d{2}-\d{2}$/;
const validDay=(x:string)=>date.test(x)&&x>='2026-10-25'&&x<='2026-11-24'&&!Number.isNaN(new Date(x+'T12:00:00Z').valueOf());
const allowedTeams=['Broadcasting team','Communication (comms) team','Service team','Facilitating team','Feedback (follow up) team','Prashadam/Bhoga cooking team','Ghee-wicks/Gift-wraps making team','Posting/Handing Gift/Host packs'];
serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return send(405,{error:'Method not allowed'});
 try{
  const payload=await req.json();
  if(val(payload.website))return send(400,{error:'Invalid submission'});
  const secret=Deno.env.get('TURNSTILE_SECRET_KEY');
  if(!secret)return send(503,{error:'Anti-spam protection has not been configured'});
  const token=val(payload.turnstileToken,3000);
  if(!token)return send(400,{error:'Complete the anti-spam check'});
  const remoteIp=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'';
  const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret,response:token,remoteip:remoteIp})});
  const verdict=await verify.json();if(!verdict.success)return send(400,{error:'Anti-spam validation failed'});
  const name=val(payload.name,160),email=val(payload.email,254),mobile=val(payload.mobile,35),city=val(payload.city,100),country=val(payload.country,100),type=val(payload.type,20);
  const preferredDate=val(payload.preferredDate,12),preferredTime=val(payload.preferredTime,8),alternateDate=val(payload.alternateDate,12),alternateTime=val(payload.alternateTime,8);
  const participation=list(payload.participation,['in_person','online']);
  const address=val(payload.address,500),postcode=val(payload.postcode,20),venueLandmark=val(payload.venueLandmark,500);
  if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||mobile.replace(/\D/g,'').length<10||!city||!country)return send(422,{error:'Invalid contact details'});
  if(!['Home','Hall','Street','Other'].includes(type)||!validDay(preferredDate)||!time.test(preferredTime))return send(422,{error:'Invalid programme type, date or time'});
  if(alternateDate&&(!validDay(alternateDate)||!time.test(alternateTime)))return send(422,{error:'Invalid alternative date or time'});
  if(type==='Home'&&!participation.length)return send(422,{error:'Select at least one participation mode'});
  if((type!=='Home'||participation.includes('in_person'))&&(!address||!postcode))return send(422,{error:'Address and postcode are required for in-person programmes'});
  if(type!=='Home'&&!venueLandmark)return send(422,{error:'Enter venue / landmark'});
  if(payload.consentOperations!==true)return send(422,{error:'Programme privacy acknowledgement required'});
  const guests=payload.estimatedGuests===''||payload.estimatedGuests==null?null:Number(payload.estimatedGuests);
  if(guests!==null&&(!Number.isInteger(guests)||guests<1||guests>20000))return send(422,{error:'Invalid guest count'});
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:campaign,error:campaignError}=await db.from('campaigns').select('id').eq('active',true).single();
  if(campaignError||!campaign)return send(503,{error:'Registration is not open'});
  const {data,error}=await db.from('registrations').insert({campaign_id:campaign.id,host_name:name,email,mobile,city,country,program_type:type,preferred_date:preferredDate,preferred_time:preferredTime,alternate_date:alternateDate||null,alternate_time:alternateTime||null,participation,address:address||null,postcode:postcode||null,venue_landmark:venueLandmark||null,estimated_guests:guests,outdoor_interests:list(payload.outdoorInterests,['high_street','hall']),seva_interests:list(payload.sevaInterests,allowedTeams),seva_other:val(payload.sevaOther,300),notes:val(payload.notes,3000),acknowledged_privacy:true,consent_future:payload.consentFuture===true}).select('reference').single();
  if(error){console.error('Registration insert failed',error.code);return send(500,{error:'Unable to record request. Please contact the temple team.'})}
  return send(200,{reference:data.reference});
 }catch(e){console.error('Submit error',e);return send(400,{error:'Invalid request'});}
});
