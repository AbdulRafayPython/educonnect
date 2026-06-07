// One-shot script: uploads the AI Masterclass promo banner to the public
// `branding` bucket, so it can be hot-linked from emails / shared elsewhere.
// The join page already serves the same image statically from /public, so this
// is OPTIONAL — only run it if you want the image hosted on Supabase too.
//
// Run with: node upload_masterclass.mjs
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment
// (the anon key will be rejected by RLS).

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

const filePath = join(__dirname, 'public', 'ai-masterclass-banner.png');
const bytes = readFileSync(filePath);

const objectPath = 'ai-masterclass-banner.png';
const { error } = await supabase.storage
  .from('branding')
  .upload(objectPath, bytes, {
    contentType: 'image/png',
    cacheControl: '31536000',
    upsert: true,
  });

if (error) {
  console.error('Upload failed:', error);
  process.exit(1);
}

const { data } = supabase.storage.from('branding').getPublicUrl(objectPath);
console.log('Uploaded. Public URL:');
console.log(data.publicUrl);
console.log('\nTo use it instead of the local asset, set the join page <img> src to this URL.');
