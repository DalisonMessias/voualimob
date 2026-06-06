-- supabase/migrations/supabase_global_part3.sql
-- Estruturas de suporte, financeiro, saques, termos legais, chaves e configurações

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

-- Alterações na tabela de corridas (Rides)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS waiting_logs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS waiting_time_cost NUMERIC(10, 2) DEFAULT 0.00;

-- Índices úteis adicionais
CREATE INDEX IF NOT EXISTS idx_ride_messages_ride ON ride_messages(ride_id);


-- Índices úteis para suporte e transações financeiras
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

