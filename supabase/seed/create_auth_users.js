#!/usr/bin/env node
/**
 * create_auth_users.js
 *
 * Creates Supabase auth.users rows matching the UUIDs used by the seed SQL.
 * Run this BEFORE `001_seed.sql` so the FKs resolve.
 *
 * Requirements:
 *   - Supabase service-role key (NOT the anon key)
 *   - Set env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node supabase/seed/create_auth_users.js
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const users = [
  { id: '11111111-1111-1111-1111-111111111001', email: 'todd@mitra9.example',   password: 'demo-password-todd' },
  { id: '11111111-1111-1111-1111-111111111002', email: 'albert@mitra9.example', password: 'demo-password-albert' },
  { id: '11111111-1111-1111-1111-111111111003', email: 'evan@mitra9.example',   password: 'demo-password-evan' },
  { id: '11111111-1111-1111-1111-111111111004', email: 'alissa@mitra9.example', password: 'demo-password-alissa' },
  { id: '11111111-1111-1111-1111-111111111005', email: 'noah@mitra9.example',   password: 'demo-password-noah' },
  { id: '11111111-1111-1111-1111-111111111006', email: 'joe@mitra9.example',    password: 'demo-password-joe' },
  { id: '11111111-1111-1111-1111-111111111007', email: 'jr@mitra9.example',     password: 'demo-password-jr' },
  { id: '11111111-1111-1111-1111-111111111008', email: 'nick@mitra9.example',   password: 'demo-password-nick' },
  { id: '11111111-1111-1111-1111-111111111009', email: 'emily@mitra9.example',  password: 'demo-password-emily' },
  { id: '11111111-1111-1111-1111-11111111100a', email: 'luis@mitra9.example',   password: 'demo-password-luis' },
]

for (const u of users) {
  const { error } = await admin.auth.admin.createUser({
    id: u.id,
    email: u.email,
    password: u.password,
    email_confirm: true,
  })
  if (error && !/already registered/i.test(error.message)) {
    console.error(`Failed for ${u.email}:`, error.message)
  } else {
    console.log(`OK: ${u.email}`)
  }
}

console.log('Done. You can now run 001_seed.sql.')
