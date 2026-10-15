// Admin-only account provisioning. Deploy with JWT verification enabled.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

Deno.serve(async (req) => {
  const origin = Deno.env.get('ALLOWED_ORIGIN') || ''
  const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json' }
  const response = (status: number, data: object) => new Response(JSON.stringify(data), { status, headers })
  if (req.headers.get('Origin') !== origin) return response(403, { error: 'Origin not permitted' })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return response(405, { error: 'Method not allowed' })
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  if (!jwt) return response(401, { error: 'Authentication required' })
  const caller = createClient(url, anon, { auth: { persistSession: false } })
  const { data: authData, error: authError } = await caller.auth.getUser(jwt)
  if (authError || !authData.user) return response(401, { error: 'Invalid authentication' })
  const admin = createClient(url, secret, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('role,active').eq('id', authData.user.id).single()
  if (profile?.role !== 'admin' || !profile.active) return response(403, { error: 'Administrator access required' })
  let body: { name?: string; email?: string; password?: string }
  try { body = await req.json() } catch { return response(400, { error: 'Invalid JSON' }) }
  const name = (body.name || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''
  if (name.length < 2 || name.length > 160 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || password.length > 128) return response(400, { error: 'Enter a name, valid email and a password of 12–128 characters' })
  // Admin provisions vetted facilitators only. Password is passed directly to Auth, never written to profile/logs.
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (createError || !created.user) return response(400, { error: createError?.message || 'Account creation failed' })
  const { error: profileError } = await admin.from('profiles').insert({ id: created.user.id, full_name: name, role: 'facilitator', active: true })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return response(500, { error: 'Profile creation failed; account rollback attempted. Check Auth and profiles before retrying.' })
  }
  await admin.from('audit_log').insert({ actor_id: authData.user.id, entity_type: 'facilitator', entity_id: created.user.id, action: 'created' })
  return response(201, { id: created.user.id, success: true })
})
