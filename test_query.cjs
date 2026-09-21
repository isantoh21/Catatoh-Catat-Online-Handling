const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lzvrhtaewonmpsaiezai.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dnJodGFld29ubXBzYWllemFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MDE5NDQsImV4cCI6MjEwMzM3Nzk0NH0.UfWotWAZQjaqTTjoa5GKS5dq1Zda3V6wQlaCpHRNGI8';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase.from('payment_verifications').select('*');
  console.log('Error:', error?.message);
  console.log('Count in Supabase:', data ? data.length : 0);
  if (data && data.length > 0) {
    console.log('First item:', JSON.stringify(data[0], null, 2));
  }
}

main();
