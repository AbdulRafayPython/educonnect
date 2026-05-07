// One-shot script: uploads frontend/public/hat.png to the public `branding`
// bucket so transactional emails (e.g. recovery.html) can hot-link it.
//
// Run with: node upload_branding.mjs
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment
// (do NOT use the anon key — RLS will reject the upload).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const filePath = join(__dirname, 'public', 'hat.png');
const bytes = readFileSync(filePath);

const { error } = await supabase.storage
  .from('branding')
  .upload('hat.png', bytes, {
    contentType: 'image/png',
    cacheControl: '31536000',
    upsert: true,
  });

if (error) {
  console.error('Upload failed:', error);
  process.exit(1);
}

const { data } = supabase.storage.from('branding').getPublicUrl('hat.png');
console.log('Uploaded. Public URL:');
console.log(data.publicUrl);
