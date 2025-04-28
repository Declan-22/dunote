import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { generateRandomString } from '$lib/utils';


export async function POST({ request }) {
  const { clientNodeId } = await request.json();
  
  // Generate a unique token
  const token = generateRandomString(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
  
  // Store in database
  const { data, error } = await supabase
    .from('share_tokens')
    .insert([{
      token,
      client_node_id: clientNodeId,
      expires_at: expiresAt.toISOString()
    }])
    .select()
    .single();
    
  if (error) {
    return json({ error: error.message }, { status: 500 });
  }
  
  return json({ token });
}