import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oteulgvqjsdrlkhisvqc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.storage.getBucket('videos');
  console.log('Bucket:', data);
  console.log('Error:', error);
  if (data && !data.public) {
    console.log('Updating bucket to public...');
    const result = await supabase.storage.updateBucket('videos', { public: true });
    console.log('Update result:', result);
  }
}
main();
