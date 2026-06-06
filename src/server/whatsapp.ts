import { 
  makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import fs from "fs";
import { WhatsAppConfig, WhatsAppLog } from "../types";

export class WhatsAppManager {
  private sock: WASocket | null = null;
  private config: WhatsAppConfig = {
    status: "disconnected",
    messagesSent: 0
  };
  private qrCode: string | null = null;
  private logs: WhatsAppLog[] = [];
  private authStatePath = path.join(process.cwd(), "wa_auth");

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authStatePath);
      let version: any;
      try {
        const latest = await fetchLatestBaileysVersion();
        version = latest.version;
      } catch (err) {
        console.warn("[WhatsApp] Failed to fetch latest version, using fallback", err);
        version = [2, 3000, 1015901307]; // Realistic fallback version
      }

      this.sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: "silent" }) as any
      });

    this.sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        this.qrCode = qr;
        this.config.status = "connecting";
      }

      if (connection === "close") {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.config.status = "disconnected";
        this.qrCode = null;
        if (shouldReconnect) {
          this.init();
        }
      } else if (connection === "open") {
        this.config.status = "connected";
        this.config.phoneNumber = this.sock?.user?.id.split(":")[0];
        this.qrCode = null;
        console.log("WhatsApp connected!");
      }
    });

      this.sock.ev.on("creds.update", saveCreds);
    } catch (err) {
      console.error("[WhatsApp] CRITICAL: Failed to initialize WhatsApp:", err);
      this.config.status = "disconnected";
    }
  }

  async sendOTP(phone: string, code: string) {
    if (this.config.status !== "connected" || !this.sock) {
      throw new Error("WhatsApp não conectado. Vá ao painel administrativo e conecte o bot.");
    }

    let cleanPhone = phone.replace(/\D/g, "");
    
    // Brazilian number JID logic
    if (cleanPhone.startsWith("55") && cleanPhone.length === 13) {
      // Numbers with DDD > 30 and 13 digits (55 + DDD + 9 + number) 
      // sometimes don't have the "9" in WhatsApp JID if they are older accounts.
      // However, Baileys standard is just to send.
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;
    const message = `*Vouali*\n\nSeu código de verificação é: *${code}*\n\nEste código expira em 5 minutos.\n\n_Não compartilhe este código com ninguém._`;

    console.log(`[WhatsApp] Verificando existência de WhatsApp para: ${cleanPhone}`);

    try {
      const [result] = await this.sock.onWhatsApp(cleanPhone);
      
      if (!result || !result.exists) {
        throw new Error(`O número ${phone} não está registrado no WhatsApp.`);
      }

      console.log(`[WhatsApp] Enviando para JID verificado: ${result.jid}`);
      await this.sock.sendMessage(result.jid, { text: message });
      
      this.config.messagesSent++;
      this.addLog(phone, "otp", "success", `OTP ${code} enviado para ${result.jid}`);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Erro ao enviar mensagem para ${phone}:`, error);
      this.addLog(phone, "otp", "error", error.message);
      throw error;
    }
  }

  private addLog(to: string, type: "otp" | "notification", status: "success" | "error", message: string) {
    const log: WhatsAppLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      to,
      type,
      status,
      message
    };
    this.logs.unshift(log);
    if (this.logs.length > 100) this.logs.pop();
  }

  getConfig(): WhatsAppConfig & { qrCodeDataUrl?: string } {
    return {
      ...this.config,
      qrCode: this.qrCode || undefined
    };
  }

  getLogs() {
    return this.logs;
  }

  async reconnect() {
    try {
      if (fs.existsSync(this.authStatePath)) {
        fs.rmSync(this.authStatePath, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn("[WhatsApp] Error clearing auth state folder:", err);
    }
    await this.init();
  }

  async disconnect() {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock = null;
      }
      if (fs.existsSync(this.authStatePath)) {
        fs.rmSync(this.authStatePath, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn("[WhatsApp] Error during disconnect:", err);
    }
    this.config.status = "disconnected";
    this.config.phoneNumber = undefined;
    this.qrCode = null;
    await this.init();
  }
}

export const waManager = new WhatsAppManager();
