import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oteulgvqjsdrlkhisvqc.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90ZXVsZ3ZxanNkcmxraGlzdnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Njg2NTUsImV4cCI6MjA5NTI0NDY1NX0.l_D5NCDyj3zmp4zAUfwNd3apexNpTjd86qVAXCrHNj0';

export const supabase = createClient(supabaseUrl, supabaseKey);
