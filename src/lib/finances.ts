// src/lib/finances.ts
// Módulo de processamento financeiro e transações utilizando Supabase
// UTF-8 Brasil

import { supabase, handleSupabaseError } from "./supabase";
import { triggerDemoPush } from "../utils/push";
import { 
  RideRequestItem, 
  AppSettings, 
  TransactionType, 
  FinancialTransaction 
} from "../types";

/**
 * Processa a parte financeira de uma corrida finalizada no Supabase.
 */
export async function processRideFinancials(
  ride: RideRequestItem, 
  settings: AppSettings,
  driverId: string
) {
  try {
    // Calcular a comissão/taxa da plataforma
    const percentage = settings.percentPlataforma || 10;
    let platformFee = (ride.totalCost * percentage) / 100;

    // Aplicar limites mínimo e máximo da taxa
    if (settings.taxaMinima && platformFee < settings.taxaMinima) platformFee = settings.taxaMinima;
    if (settings.taxaMaxima && platformFee > settings.taxaMaxima) platformFee = settings.taxaMaxima;

    platformFee = parseFloat(platformFee.toFixed(2));
    const driverNetEarning = parseFloat((ride.totalCost - platformFee).toFixed(2));

    const isInternalPayment = ride.formaPagamento === "Saldo Vouali" || (ride.formaPagamento === "PIX" && ride.pixPayload);

    // 1. Buscar motorista atual para atualizar saldos
    const { data: driverData, error: fetchError } = await supabase
      .from("drivers")
      .select("credits_balance, earnings_balance")
      .eq("id", driverId)
      .single();

    if (fetchError) throw fetchError;

    const currentCredits = Number(driverData.credits_balance || 0);
    const currentEarnings = Number(driverData.earnings_balance || 0);

    let newCredits = currentCredits;
    let newEarnings = currentEarnings;

    if (isInternalPayment) {
      // Pagamento interno: Taxa fica na plataforma, motorista recebe o líquido na carteira de ganhos
      newEarnings = parseFloat((currentEarnings + driverNetEarning).toFixed(2));
    } else {
      // Pagamento externo: Motorista recebeu tudo fora, desconta a taxa da carteira de créditos dele
      newCredits = parseFloat((currentCredits - platformFee).toFixed(2));
    }

    // 2. Atualizar saldos do motorista
    const { error: updateDriverError } = await supabase
      .from("drivers")
      .update({
        credits_balance: newCredits,
        earnings_balance: newEarnings
      })
      .eq("id", driverId);

    if (updateDriverError) throw updateDriverError;

    // 3. Atualizar status financeiro da corrida
    const { error: updateRideError } = await supabase
      .from("rides")
      .update({
        platformFee,
        driverNetEarning,
        financiallyProcessed: true
      })
      .eq("id", ride.id);

    if (updateRideError) throw updateRideError;

    // 4. Inserir a transação da taxa da plataforma
    const feeTxId = "tx_fee_" + Date.now();
    const { error: insertFeeTxError } = await supabase
      .from("financial_transactions")
      .insert({
        id: feeTxId,
        driver_id: driverId,
        type: "platform_fee",
        amount: platformFee,
        balance_after: newCredits,
        ride_id: ride.id,
        description: `Taxa da plataforma (${percentage}%) Corrida #${ride.id.substring(0, 6)}`
      });

    if (insertFeeTxError) throw insertFeeTxError;

    // 5. Se for pagamento interno, inserir a transação de ganho da corrida
    if (isInternalPayment) {
      const earningTxId = "tx_earn_" + (Date.now() + 1);
      const { error: insertEarnTxError } = await supabase
        .from("financial_transactions")
        .insert({
          id: earningTxId,
          driver_id: driverId,
          type: "ride_earning",
          amount: driverNetEarning,
          balance_after: newEarnings,
          ride_id: ride.id,
          description: `Ganho líquido da Corrida #${ride.id.substring(0, 6)}`
        });

      if (insertEarnTxError) throw insertEarnTxError;
    }

    // 6. Notificar o motorista por push
    await triggerDemoPush(
      driverId,
      "Corrida Finalizada! 🏁",
      `Ganhos: R$ ${driverNetEarning.toFixed(2)} | Taxa: R$ ${platformFee.toFixed(2)}`,
      1
    );

  } catch (err) {
    handleSupabaseError(err, "drivers/rides/transactions", "processRideFinancials");
  }
}

/**
 * Transfere saldo da carteira de Ganhos (earnings) para a carteira de Créditos (credits).
 */
export async function transferToCredits(driverId: string, amount: number) {
  try {
    // 1. Buscar saldos atuais do motorista
    const { data: driverData, error: fetchError } = await supabase
      .from("drivers")
      .select("credits_balance, earnings_balance")
      .eq("id", driverId)
      .single();

    if (fetchError) throw fetchError;

    const currentCredits = Number(driverData.credits_balance || 0);
    const currentEarnings = Number(driverData.earnings_balance || 0);

    if (currentEarnings < amount) {
      throw new Error("Saldo de ganhos insuficiente.");
    }

    const newCredits = parseFloat((currentCredits + amount).toFixed(2));
    const newEarnings = parseFloat((currentEarnings - amount).toFixed(2));

    // 2. Atualizar saldos no banco
    const { error: updateError } = await supabase
      .from("drivers")
      .update({
        credits_balance: newCredits,
        earnings_balance: newEarnings
      })
      .eq("id", driverId);

    if (updateError) throw updateError;

    // 3. Registrar a transação financeira
    const txId = "tx_transf_" + Date.now();
    const { error: insertTxError } = await supabase
      .from("financial_transactions")
      .insert({
        id: txId,
        driver_id: driverId,
        type: "transfer_to_credits",
        amount: amount,
        balance_after: newCredits,
        description: "Transferência de Ganhos para Créditos"
      });

    if (insertTxError) throw insertTxError;

    // 4. Notificar por push
    await triggerDemoPush(
      driverId,
      "Transferência Concluída! 🔄",
      `R$ ${amount.toFixed(2)} movidos para sua carteira de créditos.`,
      1
    );

  } catch (err) {
    handleSupabaseError(err, "drivers/transactions", "transferToCredits");
  }
}

/**
 * Solicita um saque da carteira de Ganhos.
 */
export async function requestWithdrawal(params: {
  driverId: string;
  driverName: string;
  amount: number;
  pixChave: string;
  pixTipoChave: string;
}) {
  try {
    // 1. Buscar ganhos do motorista
    const { data: driverData, error: fetchError } = await supabase
      .from("drivers")
      .select("earnings_balance")
      .eq("id", params.driverId)
      .single();

    if (fetchError) throw fetchError;

    const currentEarnings = Number(driverData.earnings_balance || 0);

    if (currentEarnings < params.amount) {
      throw new Error("Saldo de ganhos insuficiente para saque.");
    }

    const newEarnings = parseFloat((currentEarnings - params.amount).toFixed(2));

    // 2. Reservar o valor debitando dos ganhos imediatamente
    const { error: updateError } = await supabase
      .from("drivers")
      .update({
        earnings_balance: newEarnings
      })
      .eq("id", params.driverId);

    if (updateError) throw updateError;

    // 3. Criar o registro de saque
    const withdrawalId = "wd_" + Date.now();
    const { error: insertWdError } = await supabase
      .from("withdrawals")
      .insert({
        id: withdrawalId,
        driver_id: params.driverId,
        amount: params.amount,
        status: "pendente",
        pix_key: params.pixChave,
        pix_key_type: params.pixTipoChave
      });

    if (insertWdError) throw insertWdError;

    // 4. Criar a transação financeira correspondente
    const txId = "tx_wd_" + Date.now();
    const { error: insertTxError } = await supabase
      .from("financial_transactions")
      .insert({
        id: txId,
        driver_id: params.driverId,
        type: "withdrawal",
        amount: params.amount,
        balance_after: newEarnings,
        description: `Saque solicitado para chave PIX (${params.pixTipoChave})`
      });

    if (insertTxError) throw insertTxError;

    // 5. Notificar motorista
    await triggerDemoPush(
      params.driverId,
      "Saque Solicitado! 💸",
      `Seu pedido de R$ ${params.amount.toFixed(2)} foi enviado para análise.`,
      1
    );

    return withdrawalId;

  } catch (err) {
    handleSupabaseError(err, "drivers/withdrawals/transactions", "requestWithdrawal");
  }
}
