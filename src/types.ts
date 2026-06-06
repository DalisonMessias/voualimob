// Shared type definitions for Vouali (Client & Driver Platforms)

// WhatsApp Integration Status
export interface WhatsAppConfig {
  phoneNumber?: string;
  status: "disconnected" | "connecting" | "connected";
  qrCode?: string; // Base64 QR code for connection
  messagesSent: number;
}

export interface WhatsAppLog {
  id: string;
  timestamp: string;
  to: string;
  type: "otp" | "notification";
  status: "success" | "error";
  message: string;
}

export type ModalidadeCorrida = "moto" | "moto_flash" | "carro" | "carro_flash";

export interface CategoryPricing {
  valorKm: number;
  taxaSaida: number;
  precoMinimo: number;
  raioAtendimento: number;
  ativo: boolean;
}

export type SupportTicketStatus = 'aberto' | 'em_análise' | 'respondido' | 'resolvido' | 'encerrado';
export type SupportCategory = 'duvida' | 'contestacao' | 'ajuda' | 'problema' | 'financeiro' | 'tecnico';

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userRole: 'client' | 'driver' | 'admin';
  category: SupportCategory;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  rideId?: string; // Optional linkage to a ride for disputes
  lastMessage?: string;
  unreadAdmin?: boolean;
  unreadUser?: boolean;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: 'client' | 'driver' | 'admin' | 'ai';
  text: string;
  timestamp: string;
  imageUrl?: string;
}

export interface BusinessHours {
  openingTime: string; // HH:mm
  closingTime: string; // HH:mm
  daysAvailable: number[]; // 0-6 (Sunday-Saturday)
  closedMessage: string;
  whatsappNumber: string;
}

export interface AIConfig {
  enabled: boolean;
  name: string;
  avatar: string;
  instructions: string;
  behavior: string;
  context: string;
  model: string; // e.g. "llama-3.3-70b-versatile"
}

export interface SupportSettings {
  businessHours: BusinessHours;
  aiConfig: AIConfig;
}

export interface SocialProviderConfig {
  active: boolean;
  configured: boolean;
  status: "ativo" | "desativado" | "configurado" | "erro_configuracao";
  clientId?: string;
  clientSecret?: string;
  appId?: string;
  redirectUrl?: string;
}

export interface SocialLoginSettings {
  google: SocialProviderConfig;
  facebook: SocialProviderConfig;
  instagram: SocialProviderConfig;
  apple?: SocialProviderConfig;
  tiktok?: SocialProviderConfig;
  twitter?: SocialProviderConfig;
}

export interface AppSettings {
  taxaSaida: number;      // Default starting rate
  valorKm: number;        // Default rate per kilometro value
  raioCobranca: number;   // Max matching radius limit
  apiKeyValue: string;    // OpenRouteService developer personal key
  
  // Platform Admin Configuration
  percentPlataforma: number;     // Platform percentage commission (e.g. 10%)
  taxaMinima: number;            // Minimum charging fee per ride (R$)
  taxaMaxima: number;            // Maximum charging fee per ride (R$)
  saldoMinimoOnline: number;      // Minimum credti balance required to be online
  descontosAtivos: boolean;      // Enable or disable commission automatic deductions
  regrasCobrancaDescricao: string; // Dynamic description of charge rules
  adminEmail?: string;           // Custom Admin access email (default: dalison.messias@outlook.com)
  adminPassword?: string;        // Custom Admin access password (default: 102192)

  // Waiting Time Configuration
  valorMinutoEspera: number;     // R$ per minute
  minutosGratisEspera: number;   // minutes free
  valorMinimoEspera: number;     // minimum waiting fee
  limiteEsperaMinutos: number;   // max waiting time allowed
  maxParadas: number;            // maximum intermediate stops allowed

  antiFraud?: AntiFraudSettings;

  supportSettings?: SupportSettings;

  socialLogin?: SocialLoginSettings;

  // Category specific pricing
  pricing?: {
    moto: CategoryPricing;
    moto_flash: CategoryPricing;
    carro: CategoryPricing;
    carro_flash: CategoryPricing;
  };

  // WhatsApp Config
  whatsappConfig?: WhatsAppConfig;

  // PIX Platform Settings
  pixSettings?: PixSettings;

  // Real-time Visual Customization / Branding Config
  branding?: BrandingConfig;
}

export interface PixSettings {
  chave: string;
  tipoChave: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  nomeRecebedor: string;
  cidade: string;
  banco: string;
  descricao: string;
  qrcodePadrao?: string; // Optional base64 or URL
  ativo: boolean;
}

export type TransactionStatus = 'pendente' | 'confirmado' | 'cancelado' | 'estornado';
export type TransactionType = 'recharge_driver' | 'recharge_client' | 'platform_payment' | 'withdrawal' | 'transfer_to_credits' | 'ride_earning' | 'platform_fee';

export interface FinancialTransaction {
  id: string;
  userId: string;
  userName: string;
  userRole: 'driver' | 'client';
  amount: number;
  timestamp: string;
  type: TransactionType;
  status: TransactionStatus;
  pixPayload?: string;
  comprovanteUrl?: string;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface WithdrawalRequest {
  id: string;
  driverId: string;
  driverName: string;
  amount: number;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'pago';
  timestamp: string;
  processedAt?: string;
  pixChave: string;
  pixTipoChave: string;
  receiptUrl?: string; // Comprovante de pagamento
}

export interface BrandingLog {
  id: string;
  timestamp: string;
  changedBy: string;
  description: string;
  previousColors?: string;
}

export interface BrandingConfig {
  logoUrl?: string; // Main Logo URL
  logoDarkUrl?: string; // Dark Logo URL
  logoLightUrl?: string; // Light Logo URL
  faviconUrl?: string; // Favicon Icon URL
  splashUrl?: string; // Splash screen URL
  institutionalImgUrl?: string; // Institutional visual Asset URL
  colorPrimary?: string; // Hex code (e.g. #f59e0b)
  colorSecondary?: string; // Hex code
  colorAccent?: string; // Hex code
  colorButton?: string; // Hex code
  colorNavbar?: string; // Hex code
  colorCard?: string; // Hex code
  colorDarkThemeHex?: string; // Hex code background
  colorPremium?: string; // Hex code
  themeMode?: "dark" | "light" | "auto";
  slogan?: string;
  title?: string;
  history?: BrandingLog[];
}

export type StatusCorrida = 
  | "procurando"      // Searching for driver
  | "aceito"          // Driver accepted, heading to origin
  | "a_caminho"       // Driver has arrived at origin (Cheguei)
  | "em_andamento"    // In transit to destination (Iniciar corrida)
  | "finalizado"      // Finished successfully
  | "cancelado";      // Cancelled by client or driver

// Fraud Monitoring Types
export interface FraudLog {
  id: string;
  rideId: string;
  driverId: string;
  type: "cancellation_near_destination" | "suspicious_movement" | "repeat_pattern" | "timeout_exceeded";
  severity: "low" | "medium" | "high";
  timestamp: string;
  description: string;
  gpsCoords?: [number, number];
}

export interface AntiFraudSettings {
  nivelAntifraude: "baixo" | "medio" | "alto";
  bloqueioAutomatico: boolean;
  tempoLimiteInicio: number; // minutes after "arrived" to start the ride
  raioCancelamentoSuspeito: number; // meters from destination to consider suspicious
}

// Credit Transaction Log schema
export interface CreditTransaction {
  id: string;
  timestamp: string;
  type: "recharge" | "deduction" | "recharge_pix" | "recharge_card" | "ride_payment" | "cashback" | "bonus" | "referral" | "platform_reservation" | "reservation_adjustment";
  amount: number;
  balanceAfter: number;
  rideId?: string;
  description: string;
}

export interface Contract {
  id: string;
  version: number;
  content: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ContractAcceptance {
  id: string;
  userId: string;
  contractVersion: number;
  acceptedAt: string;
  ip: string;
  userAgent?: string;
}

// Driver schema definitions
export interface MototaxistaProfile {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  valorKm: number;
  taxaSaida: number;
  raioMaximo: number; // in KM
  modalidades: ModalidadeCorrida[];
  online: boolean;
  currentCoords: [number, number]; // [lng, lat]
  rating: number;
  
  // Vehicle details
  veiculoPlaca: string;
  veiculoModelo: string;
  veiculoCor?: string;
  veiculoTipo: "moto" | "carro";
  capacidadePassageiros?: number;
  capacidadeCargaKg?: number;
  
  // Custom prices per category (optional override)
  customPricing?: Partial<Record<ModalidadeCorrida, { valorKm: number; taxaSaida: number }>>;

  // New Admin Approvals & Document URLs fields
  approved?: "pendente" | "aprovado" | "recusado";
  cnhUrl?: string;
  motoDocUrl?: string; // documento da moto
  selfieUrl?: string;  // selfie com documento
  docRejectionReason?: string;

  // Payments Credentials & Preferences Configuration
  pixChave?: string;
  pixTipoChave?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  pixNomeRecebedor?: string;
  pixCidadeRecebedor?: string;

  // Intelligent Payment Management
  acceptsPix?: boolean;
  acceptsCash?: boolean;
  acceptsCard?: boolean;
  hasMachine?: boolean;
  usesTapToPay?: boolean;
  tapToPayApp?: string; 
  hasNfcHardware?: boolean;

  // Digital Contract Tracking
  contractAcceptedVersion?: number;
  contractAcceptedAt?: string;

  creditsBalance?: number;
  earningsBalance?: number;
  creditTransactions?: CreditTransaction[];

  // Social Auth
  provider?: string;
  email?: string;
}

// Client schema definitions
export interface FavoritoItem {
  id: string;
  label: string;
  address: string;
  coords: [number, number];
}

export interface ClientProfile {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  favoritos: FavoritoItem[];
  
  // Digital Wallet Configuration
  creditsBalance?: number;
  creditTransactions?: CreditTransaction[];
  email?: string; // For receipt/security
  
  // Social Auth
  provider?: string;
}

export interface GeocodeResult {
  simulated: boolean;
  address: string;
  coordinates: [number, number]; // [lng, lat]
}

export interface RideRoute {
  simulated: boolean;
  distance: number;       // in KM
  duration: number;       // in Seconds
  geometry: [number, number][]; // array of [lng, lat] paths
  warning?: string;
  error?: string;
}

// Full Ride request matched session item
export interface RideStop {
  address: string;
  coords: [number, number]; // [lng, lat]
  arrivedAt?: string;
  finishedAt?: string;
  status: "pendente" | "chegou" | "finalizado";
}

export interface WaitingLog {
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  cost: number;
}

export interface RideRequestItem {
  id: string;
  timestamp: string;
  clientName: string;
  clientPhone: string;
  clientId: string;
  startAddress: string;
  endAddress: string;
  startCoords: [number, number]; // [lng, lat]
  endCoords: [number, number];   // [lng, lat]
  
  stops: RideStop[];
  
  distance: number;              // in KM
  duration: number;              // in seconds
  modalidade: ModalidadeCorrida;
  observacoes?: string;
  
  // Matching values
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverCoords?: [number, number];
  veiculoPlaca?: string;
  veiculoModelo?: string;

  totalCost: number;
  originalTotalCost: number;     // initial estimate without waiting/extra stops
  waitingTimeCost: number;
  
  waitingLogs: WaitingLog[];
  isWaiting: boolean;
  waitingStartedAt?: string;
  
  status: StatusCorrida;
  geometry?: [number, number][]; // array of [lng, lat] paths
  simulated: boolean;

  // Payments integration
  formaPagamento?: 'PIX' | 'Dinheiro' | 'Cartão' | 'Aproximação' | 'Saldo Vouali';
  statusPagamento?: 'pendente' | 'pago' | 'confirmado' | 'aguardando_pagamento' | 'pago_dinheiro' | 'pago_cartao' | 'cancelado';
  pixPayload?: string;

  // Intelligent Change Control
  precisaTroco?: boolean;
  trocoPara?: number;

  // Anti-fraud & Financial Guarantee
  arrivedAtOriginAt?: string;
  arrivedAtOriginCoords?: [number, number];
  startedAt?: string;
  startedCoords?: [number, number];
  reservedFee?: number; // Platform fee reserved when ride starts
  movementLogs?: { timestamp: string; coords: [number, number] }[];
  fraudSuspected?: boolean;
  fraudType?: FraudLog["type"];

  // Financial tracking
  platformFee?: number;
  driverNetEarning?: number;
  financiallyProcessed?: boolean;
}

export interface RideHistoryItem {
  id: string;
  timestamp: string;
  startAddress: string;
  endAddress: string;
  startCoords: [number, number];
  endCoords: [number, number];
  distance: number;
  duration: number;
  totalCost: number;
  modalidade: ModalidadeCorrida;
  driverName?: string;
  clientName?: string;
  status: StatusCorrida;
  simulated: boolean;
  geometry?: [number, number][];
  
  stops: RideStop[];
  waitingTimeCost: number;
  totalWaitingTimeSeconds: number;

  // Payments integration in history
  formaPagamento?: 'PIX' | 'Dinheiro' | 'Cartão' | 'Aproximação' | 'Saldo Vouali';
  statusPagamento?: 'pendente' | 'pago' | 'confirmado' | 'aguardando_pagamento' | 'pago_dinheiro' | 'pago_cartao' | 'cancelado';
}

