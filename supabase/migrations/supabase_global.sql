-- supabase_global.sql
-- Esquema completo de banco de dados consolidado para o sistema Vouali
-- UTF-8 Brasil

-- ==========================================
-- PARTE 1: USUÁRIOS E PERFIS
-- ==========================================

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

-- Índices de Perfis
CREATE INDEX IF NOT EXISTS idx_drivers_online ON drivers(online) WHERE online = true;

-- ==========================================
-- PARTE 2: CORRIDAS E LOCALIZAÇÃO
-- ==========================================

-- 4. Tabela de Corridas (Rides)
CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    client_name TEXT,
    client_phone TEXT,
    driver_id TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    veiculo_modelo TEXT,
    veiculo_placa TEXT,
    origem_label TEXT,
    destino_label TEXT,
    start_coords JSONB, -- [lng, lat] em JS
    end_coords JSONB,   -- [lng, lat] em JS
    driver_coords JSONB, -- [lng, lat] em JS
    geometry JSONB,     -- Array de pontos de rota
    status TEXT NOT NULL CHECK (status IN ('pendente', 'aceito', 'a_caminho', 'chegou', 'em_andamento', 'finalizado', 'cancelado')),
    status_pagamento TEXT DEFAULT 'pendente' NOT NULL,
    total_cost NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    valor_calculado NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    distance NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    duration NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    payment_method TEXT DEFAULT 'PIX' NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    arrived_at_origin_at TIMESTAMP WITH TIME ZONE,
    arrived_at_origin_coords JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    started_coords JSONB,
    reserved_fee NUMERIC(10, 2) DEFAULT 0.00,
    fraud_suspected BOOLEAN DEFAULT false,
    fraud_type TEXT,
    movement_logs JSONB DEFAULT '[]'::jsonb,
    waiting_logs JSONB DEFAULT '[]'::jsonb,
    waiting_time_cost NUMERIC(10, 2) DEFAULT 0.00
);

-- 5. Tabela de Rastreamento de Localizações dos Motoristas
CREATE TABLE IF NOT EXISTS drivers_locations (
    driver_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    online BOOLEAN DEFAULT false NOT NULL,
    coords JSONB DEFAULT '[0,0]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de Corridas
CREATE INDEX IF NOT EXISTS idx_rides_client ON rides(client_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);

-- ==========================================
-- PARTE 3: SUPORTE, CONFIGURAÇÕES E LEGAIS
-- ==========================================

-- 6. Tabela de Chaves de API (Segurança do Usuário)
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    key_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Tabela de Configurações Gerais do Sistema
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY, -- ex: 'global'
    data JSONB NOT NULL, -- armazena o objeto AppSettings inteiro em JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Tabela de Chamados de Suporte
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_role TEXT,
    subject TEXT,
    category TEXT,
    description TEXT,
    status TEXT DEFAULT 'aberto' NOT NULL CHECK (status IN ('aberto', 'em_atendimento', 'respondido', 'fechado')),
    unread_user BOOLEAN DEFAULT false NOT NULL,
    unread_admin BOOLEAN DEFAULT false NOT NULL,
    last_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Tabela de Mensagens dos Chamados de Suporte
CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'driver', 'admin', 'ai')),
    text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Tabela de Transações Financeiras (Motorista)
CREATE TABLE IF NOT EXISTS financial_transactions (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    ride_id TEXT,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Tabela de Saques (Withdrawals)
CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pendente' NOT NULL CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    pix_key TEXT NOT NULL,
    pix_key_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Tabela de Termos Legais e Aceite de Contratos
CREATE TABLE IF NOT EXISTS contract_acceptances (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    contract_version TEXT NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ip TEXT,
    user_agent TEXT
);

-- 13. Tabela de Contratos Digitais (Legal)
CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    version INT NOT NULL,
    content TEXT NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by TEXT DEFAULT 'system' NOT NULL
);

-- 14. Tabela de Mensagens do Chat de Corrida
CREATE TABLE IF NOT EXISTS ride_messages (
    id TEXT PRIMARY KEY,
    ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('client', 'driver')),
    text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices úteis para contratos e mensagens de corrida
CREATE INDEX IF NOT EXISTS idx_ride_messages_ride ON ride_messages(ride_id);


-- Índices de Suporte e Financeiro
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_driver ON financial_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_driver ON withdrawals(driver_id);

-- ==========================================
-- ADIÇÕES ESTRUTURAIS DE COMPATIBILIDADE
-- ==========================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credits_balance NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_transactions JSONB DEFAULT '[]'::jsonb;

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS doc_rejection_reason TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS veiculo_tipo TEXT DEFAULT 'moto';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS capacidade_passageiros INT DEFAULT 1;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS capacidade_carga_kg INT DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS valor_km NUMERIC(10, 2) DEFAULT 2.00;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS taxa_saida NUMERIC(10, 2) DEFAULT 5.00;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 5.00;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS approved TEXT DEFAULT 'pendente' CHECK (approved IN ('pendente', 'aprovado', 'recusado'));
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS raio_maximo NUMERIC(10, 2) DEFAULT 5.00;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS modalidades JSONB DEFAULT '["moto"]'::jsonb;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pix_chave TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pix_tipo_chave TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pix_nome_recebedor TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pix_cidade_recebedor TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS accepts_pix BOOLEAN DEFAULT true;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS accepts_cash BOOLEAN DEFAULT true;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS accepts_card BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS has_machine BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS uses_tap_to_pay BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS tap_to_pay_app TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS has_nfc_hardware BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS cnh_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS moto_doc_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS selfie_url TEXT;

ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_by TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS driver_name TEXT;

ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS user_role TEXT CHECK (user_role IN ('client', 'driver', 'admin'));
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS user_name TEXT;

