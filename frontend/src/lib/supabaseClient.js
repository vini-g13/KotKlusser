// Cleanup sprint 5 (2026-07, kotklusser-cleanup-plan.md sectie 6.1): de frontend
// praat voortaan rechtstreeks met Supabase Auth voor login/registratie/sessiebeheer
// (signUp/signInWithPassword/signOut/token-refresh), i.p.v. de vroegere custom
// JWT/refresh-token-routes op de eigen backend. supabase-js beheert de sessie zelf
// (opslag + automatisch verversen) — er is dus geen handmatige refresh_token-logica
// meer nodig in App.js.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loud in dev/build i.p.v. een cryptische runtime-fout verderop in de app.
  // eslint-disable-next-line no-console
  console.error(
    'REACT_APP_SUPABASE_URL en/of REACT_APP_SUPABASE_ANON_KEY ontbreken. ' +
    'Zet deze in frontend/.env (lokaal) of in de Railway/Vercel service-variabelen.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
