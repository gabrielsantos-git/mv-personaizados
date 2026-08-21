// Cliente Supabase compartilhado — usado direto no navegador, sem build step.
// Importa o SDK via CDN (esm.sh) e exporta uma instância única do client.
//
// A "publishable key" (antiga "anon key") é pública por design: ela só permite
// o que as políticas de Row Level Security do banco autorizarem. Não é segredo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://jaaaihczqiqainhdoned.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_s75LBJVysGN-wrqMJLLEqQ_zIRrFxD0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
