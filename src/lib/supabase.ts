// src/lib/supabase.ts
// Inicialização do cliente Supabase e utilitários de banco de dados
// Conforme as regras, as chaves são mantidas diretamente neste arquivo ou carregadas de forma segura

import { createClient } from "@supabase/supabase-js";

// Configurações padrão do Supabase (Placeholders)
// O usuário pode substituir estas chaves diretamente aqui para produção
const SUPABASE_URL = "https://gilvajtantebgthllaiu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpbHZhanRhbnRlYmd0aGxsYWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzMwODUsImV4cCI6MjA5NTMwOTA4NX0.LCw8b6FR8qRmgUVXEfYnoCuOiu15UyFgxkO4jxjXDXYyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-key";

// Criação do cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false, // Desativado para usar a sessão gerenciada pelo Firebase Auth
    autoRefreshToken: false,
  },
});

/**
 * Função auxiliar para tratar erros do Supabase de forma padronizada
 */
export function handleSupabaseError(error: any, table: string, operation: string): never {
  const errorMessage = error?.message || String(error);
  console.error(`Erro no Supabase [Tabela: ${table}, Operação: ${operation}]:`, errorMessage);
  throw new Error(`Falha no banco de dados (${table} - ${operation}): ${errorMessage}`);
}

/**
 * Upload de arquivos para o Supabase Storage
 */
export async function uploadToSupabaseStorage(
  bucketName: string,
  filePath: string,
  file: File
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        upsert: true,
        cacheControl: "3600",
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`Erro ao fazer upload no bucket ${bucketName}:`, err);
    throw err;
  }
}
