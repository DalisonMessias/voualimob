-- supabase/migrations/supabase_global_part1.sql
-- Estrutura de usuários, clientes e motoristas para o sistema Vouali

-- 1. Tabela de Usuários Gerais
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- ID correspondente ao Firebase UID
    role TEXT NOT NULL CHECK (role IN ('client', 'driver', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Passageiros/Clientes
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Motoristas/Pilotos
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    veiculo_modelo TEXT,
    veiculo_placa TEXT,
    veiculo_cor TEXT,
    cnh TEXT,
    documento_veiculo TEXT,
    online BOOLEAN DEFAULT false NOT NULL,
    credits_balance NUMERIC(10, 2) DEFAULT 50.00 NOT NULL,
    earnings_balance NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    credit_transactions JSONB DEFAULT '[]'::jsonb,
    current_coords JSONB DEFAULT '[0, 0]'::jsonb,
    contract_accepted_version TEXT,
    contract_accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para melhoria de desempenho de buscas de motoristas online
CREATE INDEX IF NOT EXISTS idx_drivers_online ON drivers(online) WHERE online = true;
