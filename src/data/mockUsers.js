/**
 * Mock user + role directory for demo mode (when Supabase env is not set).
 * Matches the UUIDs in supabase/seed/001_seed.sql so a later switch to real
 * Supabase is seamless.
 */

export const MOCK_USERS = [
  { id: '11111111-1111-1111-1111-111111111001', full_name: 'Todd Allison',    role: 'manager', sales_channel: null,               sales_region: null,      email: 'todd@mitra9.example' },
  { id: '11111111-1111-1111-1111-111111111002', full_name: 'Albert Martinez', role: 'manager', sales_channel: null,               sales_region: null,      email: 'albert@mitra9.example' },
  { id: '11111111-1111-1111-1111-111111111003', full_name: 'Evan Beard',      role: 'rep',     sales_channel: 'New Distribution', sales_region: null,      email: 'evan@mitra9.example' },
  { id: '11111111-1111-1111-1111-111111111004', full_name: 'Alissa Shupperd', role: 'rep',     sales_channel: 'Inbound',          sales_region: null,      email: 'alissa@mitra9.example' },
  { id: '11111111-1111-1111-1111-111111111005', full_name: 'Noah Smith',      role: 'rep',     sales_channel: 'Wholesale',        sales_region: null,      email: 'noah@mitra9.example' },
  { id: '11111111-1111-1111-1111-111111111006', full_name: 'Joe Sanders',     role: 'rep',     sales_channel: 'Chains',           sales_region: null,      email: 'joe@mitra9.example' },
  { id: '11111111-1111-1111-1111-111111111007', full_name: 'JR Hernandez',    role: 'manager', sales_channel: null,               sales_region: null,      email: 'jr@mitra9.example' },
  { id: '11111111-1111-1111-1111-111111111008', full_name: 'Nick Kemper',     role: 'rep',     sales_channel: 'New Distribution', sales_region: null,      email: 'nick@mitra9.example' },
  { id: '11111111-1111-1111-1111-111111111009', full_name: 'Emily Hill',      role: 'viewer',  sales_channel: null,               sales_region: null,      email: 'emily@mitra9.example' },
  { id: '11111111-1111-1111-1111-11111111100a', full_name: 'Luis Escobar',    role: 'rep',     sales_channel: 'Conventional',     sales_region: 'Florida', email: 'luis@mitra9.example' },
]
