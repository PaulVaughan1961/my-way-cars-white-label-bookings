import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zzgiukguwqdzayrnizvl.supabase.co";
const supabaseKey = "sb_publishable_xEikXLLatUld4VEB07vsbQ_zMK8FXdP";

export const supabase = createClient(supabaseUrl, supabaseKey);