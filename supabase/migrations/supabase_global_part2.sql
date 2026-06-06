-- supabase/migrations/supabase_global_part2.sql
-- Estrutura de corridas e rastreamento em tempo real do Vouali

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
    movement_logs JSONB DEFAULT '[]'::jsonb
);

-- 5. Tabela de Rastreamento de Localizações dos Motoristas
CREATE TABLE IF NOT EXISTS drivers_locations (
    driver_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    online BOOLEAN DEFAULT false NOT NULL,
    coords JSONB DEFAULT '[0,0]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices úteis para filtragem rápida de corridas
CREATE INDEX IF NOT EXISTS idx_rides_client ON rides(client_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
