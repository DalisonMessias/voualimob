import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { 
  Users, 
  Bike, 
  MapPin, 
  DollarSign, 
  CheckCircle, 
  CheckCircle2,
  XCircle, 
  ShieldAlert, 
  Sliders, 
  Search, 
  Activity, 
  TrendingUp, 
  Clock, 
  Lock, 
  Unlock, 
  Trash2, 
  Edit3, 
  Save, 
  Plus, 
  Download,
  ChevronRight, 
  AlertTriangle,
  FileText,
  User,
  Map,
  BadgeAlert,
  HelpCircle,
  PiggyBank,
  MessageSquare,
  Package,
  Navigation,
  Paintbrush,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  Eye,
  RefreshCw,
  Moon,
  Sun,
  Layout,
  UploadCloud,
  History as HistoryIcon,
  HelpCircle as HelpIcon,
  Laptop,
  Wallet,
  QrCode,
  CreditCard,
  Receipt,
  Headset,
  Chrome,
  Facebook,
  Instagram
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from "recharts";
import { supabase, uploadToSupabaseStorage } from "../lib/supabase";
import { triggerDemoPush } from "../utils/push";
import { AppSettings, ClientProfile, MototaxistaProfile, RideRequestItem, CreditTransaction, ModalidadeCorrida, Contract, ContractAcceptance, FinancialTransaction, WithdrawalRequest, PixSettings, SocialProviderConfig } from "../types";
import SupportAdminManager from "./SupportAdminManager";

interface AdminDashboardProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onSignout: () => void;
  currentUser: any;
}

export default function AdminDashboard({ settings, onUpdateSettings, onSignout, currentUser }: AdminDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "approvals" | "clients" | "drivers" | "configs" | "whatsapp" | "branding" | "contracts" | "finance" | "support" | "antifraud" | "social">("dashboard");

  // Custom modal states to replace browser defaults
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (text: string) => void | Promise<void>;
  } | null>(null);

  // Dynamic Visual Branding State
  const [logoPrincipalFile, setLogoPrincipalFile] = useState<File | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoLightFile, setLogoLightFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [splashFile, setSplashFile] = useState<File | null>(null);
  const [institutionalFile, setInstitutionalFile] = useState<File | null>(null);

  const [colorPrimary, setColorPrimary] = useState(settings.branding?.colorPrimary || "#f59e0b");
  const [colorSecondary, setColorSecondary] = useState(settings.branding?.colorSecondary || "#d97706");
  const [colorAccent, setColorAccent] = useState(settings.branding?.colorAccent || "#10b981");
  const [colorButton, setColorButton] = useState(settings.branding?.colorButton || "#f59e0b");
  const [colorNavbar, setColorNavbar] = useState(settings.branding?.colorNavbar || "#09090b");
  const [colorCard, setColorCard] = useState(settings.branding?.colorCard || "#181c24");
  const [colorDarkThemeHex, setColorDarkThemeHex] = useState(settings.branding?.colorDarkThemeHex || "#09090b");
  const [colorPremium, setColorPremium] = useState(settings.branding?.colorPremium || "#f59e0b");
  const [themeMode, setThemeMode] = useState<"dark" | "light" | "auto">(settings.branding?.themeMode || "dark");
  const [brandingTitle, setBrandingTitle] = useState(settings.branding?.title || "Vouali");
  const [brandingSlogan, setBrandingSlogan] = useState(settings.branding?.slogan || "Vouali e chego bem");

  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [brandingSuccess, setBrandingSuccess] = useState(false);
  const [brandingPreviewTab, setBrandingPreviewTab] = useState<"passenger" | "driver" | "landing">("passenger");
  
  // Storage paths/URLs
  const [currentLogoUrl, setCurrentLogoUrl] = useState(settings.branding?.logoUrl || "");
  const [currentLogoDarkUrl, setCurrentLogoDarkUrl] = useState(settings.branding?.logoDarkUrl || "");
  const [currentLogoLightUrl, setCurrentLogoLightUrl] = useState(settings.branding?.logoLightUrl || "");
  const [currentFaviconUrl, setCurrentFaviconUrl] = useState(settings.branding?.faviconUrl || "");
  const [currentSplashUrl, setCurrentSplashUrl] = useState(settings.branding?.splashUrl || "");
  const [currentInstitutionalImgUrl, setCurrentInstitutionalImgUrl] = useState(settings.branding?.institutionalImgUrl || "");

  // WhatsApp states
  const [waConfig, setWaConfig] = useState<any>(null);
  const [waLogs, setWaLogs] = useState<any[]>([]);
  const [waLoading, setWaLoading] = useState(false);

  // Subscribed collections data from Firestore
  const [clients, setClients] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<MototaxistaProfile[]>([]);
  const [rides, setRides] = useState<RideRequestItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [acceptances, setAcceptances] = useState<ContractAcceptance[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  // PIX Admin Settings States
  const [pixKey, setPixKey] = useState(settings.pixSettings?.chave || "");
  const [pixKeyType, setPixKeyType] = useState<PixSettings["tipoChave"]>(settings.pixSettings?.tipoChave || "CPF");
  const [pixReceiverName, setPixReceiverName] = useState(settings.pixSettings?.nomeRecebedor || "");
  const [pixCity, setPixCity] = useState(settings.pixSettings?.cidade || "");
  const [pixBank, setPixBank] = useState(settings.pixSettings?.banco || "");
  const [pixDescription, setPixDescription] = useState(settings.pixSettings?.descricao || "");
  const [pixActive, setPixActive] = useState(settings.pixSettings?.ativo ?? true);

  // Search & Filters inputs
  const [searchQuery, setSearchQuery] = useState("");
  const [driverApprovalFilter, setDriverApprovalFilter] = useState<"all" | "pendente" | "aprovado" | "recusado">("all");

  // Modals / Editing objects states
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editingDriver, setEditingDriver] = useState<MototaxistaProfile | null>(null);
  const [approvingDriver, setApprovingDriver] = useState<MototaxistaProfile | null>(null);
  const [updatingCreditsDriver, setUpdatingCreditsDriver] = useState<MototaxistaProfile | null>(null);
  
  // Contract management editing states
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [newContractContent, setNewContractContent] = useState("");
  const [isCreatingContract, setIsCreatingContract] = useState(false);

  const [updatingCreditsClient, setUpdatingCreditsClient] = useState<ClientProfile | null>(null);
  const [adminComments, setAdminComments] = useState("");
  const [creditsAmountInput, setCreditsAmountInput] = useState("");
  const [creditsOpType, setCreditsOpType] = useState<"add" | "sub">("add");

  // Admin Config settings inputs state
  const [percentPlataforma, setPercentPlataforma] = useState(settings.percentPlataforma);
  const [taxaMinima, setTaxaMinima] = useState(settings.taxaMinima);
  const [taxaMaxima, setTaxaMaxima] = useState(settings.taxaMaxima);
  const [saldoMinimoOnline, setSaldoMinimoOnline] = useState(settings.saldoMinimoOnline);
  const [descontosAtivos, setDescontosAtivos] = useState(settings.descontosAtivos);
  const [regrasCobrancaDescricao, setRegrasCobrancaDescricao] = useState(settings.regrasCobrancaDescricao);
  const [valorMinutoEspera, setValorMinutoEspera] = useState(settings.valorMinutoEspera || 0.5);
  const [minutosGratisEspera, setMinutosGratisEspera] = useState(settings.minutosGratisEspera || 5);
  const [valorMinimoEspera, setValorMinimoEspera] = useState(settings.valorMinimoEspera || 2.0);
  const [limiteEsperaMinutos, setLimiteEsperaMinutos] = useState(settings.limiteEsperaMinutos || 30);
  const [maxParadas, setMaxParadas] = useState(settings.maxParadas || 3);
  const [adminEmail, setAdminEmail] = useState(settings.adminEmail || "dalison.messias@outlook.com");
  const [adminPassword, setAdminPassword] = useState(settings.adminPassword || "102192");
  const [configSuccess, setConfigSuccess] = useState(false);

  // New Category pricing states
  const [catPricing, setCatPricing] = useState(settings.pricing || {
    moto: { valorKm: 2.5, taxaSaida: 5.5, precoMinimo: 7.0, raioAtendimento: 6.0, ativo: true },
    moto_flash: { valorKm: 2.2, taxaSaida: 5.0, precoMinimo: 6.0, raioAtendimento: 8.0, ativo: true },
    carro: { valorKm: 3.5, taxaSaida: 8.5, precoMinimo: 10.0, raioAtendimento: 10.0, ativo: true },
    carro_flash: { valorKm: 3.2, taxaSaida: 8.0, precoMinimo: 9.0, raioAtendimento: 12.0, ativo: true },
  });

  // Social Login States
  const [socialGoogle, setSocialGoogle] = useState<SocialProviderConfig>(settings.socialLogin?.google || { active: false, configured: false, status: "desativado" });
  const [socialFacebook, setSocialFacebook] = useState<SocialProviderConfig>(settings.socialLogin?.facebook || { active: false, configured: false, status: "desativado" });
  const [socialInstagram, setSocialInstagram] = useState<SocialProviderConfig>(settings.socialLogin?.instagram || { active: false, configured: false, status: "desativado" });

  const handlePhoneMask = (val: string, setter: (v: string) => void) => {
    let value = val.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    let formatted = value;
    if (value.length > 2) {
      formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 6) {
      if (value.length <= 10) {
        formatted = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
      } else {
        formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
      }
    }
    setter(formatted);
  };

  // Administrative stats
  const totalClients = clients.length;
  const totalDrivers = drivers.length;
  const onlineDrivers = drivers.filter(d => d.online).length;
  const pendingApprovals = drivers.filter(d => d.approved === "pendente");
  const approvedDrivers = drivers.filter(d => d.approved === "aprovado");

  // Map element handles
  const adminMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkersRef = useRef<{ [id: string]: L.Marker }>({});

  const [adminGpsCoords, setAdminGpsCoords] = useState<[number, number] | null>(null);
  const [adminGpsLabel, setAdminGpsLabel] = useState<string>("Buscando sua localização...");

  useEffect(() => {
    const locateAdmin = async () => {
      // Try HTML5 Geolocation first
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            setAdminGpsCoords([latitude, longitude]);
            
            // Try Nominatim reverse lookup for dynamic admin label
            try {
              const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`;
              const res = await fetch(reverseUrl, { headers: { "Accept-Language": "pt-BR" } });
              if (res.ok) {
                const data = await res.json();
                const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "Sua Cidade";
                setAdminGpsLabel(`Painel Monitorizado: ${city}`);
              } else {
                setAdminGpsLabel("Sua Localização de Acesso");
              }
            } catch (err) {
              setAdminGpsLabel("Sua Localização de Acesso");
            }
          },
          async (err) => {
            console.warn("HTML5 Geolocation failed for admin. Trying IP Fallback...", err);
            await fetchIpLocationForAdmin();
          },
          { timeout: 5000 }
        );
      } else {
        await fetchIpLocationForAdmin();
      }
    };

    const fetchIpLocationForAdmin = async () => {
      try {
        const ipRes = await fetch("https://freeipapi.com/api/json");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.latitude && ipData.longitude) {
            setAdminGpsCoords([ipData.latitude, ipData.longitude]);
            const city = ipData.cityName || "Sua Cidade";
            setAdminGpsLabel(`Painel Monitorizado: ${city}`);
            return;
          }
        }
      } catch (err) {
        console.warn("freeipapi failed in admin dashboard", err);
      }

      try {
        const ipRes2 = await fetch("https://ipapi.co/json/");
        if (ipRes2.ok) {
          const ipData2 = await ipRes2.json();
          if (ipData2.latitude && ipData2.longitude) {
            setAdminGpsCoords([ipData2.latitude, ipData2.longitude]);
            const city = ipData2.city || "Sua Cidade";
            setAdminGpsLabel(`Painel Monitorizado: ${city}`);
            return;
          }
        }
      } catch (err2) {
        console.warn("ipapi.co also failed in admin dashboard", err2);
      }

      setAdminGpsCoords([-12.9714, -38.5014]); // Fallback Salvador
      setAdminGpsLabel("Sua Região Ativa");
    };

    locateAdmin();
  }, []);

  // WhatsApp status polling
  useEffect(() => {
    if (activeTab !== "whatsapp") return;

    const fetchWaData = async () => {
      try {
        const [statusRes, logsRes] = await Promise.all([
          fetch("/api/admin/whatsapp/status"),
          fetch("/api/admin/whatsapp/logs")
        ]);
        if (statusRes.ok) setWaConfig(await statusRes.json());
        if (logsRes.ok) setWaLogs(await logsRes.json());
      } catch (err) {
        console.error("Error fetching WhatsApp admin data:", err);
      }
    };

    fetchWaData();
    const interval = setInterval(fetchWaData, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleWaAction = async (action: "reconnect" | "disconnect") => {
    setWaLoading(true);
    try {
      await fetch(`/api/admin/whatsapp/${action}`, { method: "POST" });
    } catch (err) {
      console.error(`Error performing WhatsApp ${action}:`, err);
    } finally {
      setWaLoading(false);
    }
  };

  // Global Sync data subscription from Supabase
  useEffect(() => {
    if (!currentUser) return;

    const fetchClients = async () => {
      const { data, error } = await supabase.from("clients").select("*");
      if (error) console.error(error);
      else setClients((data || []).map(c => ({ 
        ...c, 
        creditsBalance: Number(c.credits_balance || 0), 
        creditTransactions: c.credit_transactions || [] 
      })));
    };

    const fetchContracts = async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("version", { ascending: false });
      if (error) console.error(error);
      else setContracts(data || []);
    };

    const fetchAcceptances = async () => {
      const { data, error } = await supabase.from("contract_acceptances").select("*").order("accepted_at", { ascending: false });
      if (error) console.error(error);
      else {
        setAcceptances((data || []).map(a => ({
          id: String(a.id),
          acceptedAt: a.accepted_at,
          contractVersion: Number(a.contract_version),
          userId: a.user_id,
          ip: a.ip,
          userAgent: a.user_agent
        })));
      }
    };

    const fetchDrivers = async () => {
      const { data, error } = await supabase.from("drivers").select("*");
      if (error) console.error(error);
      else {
        setDrivers((data || []).map(d => ({
          id: d.id,
          name: d.name,
          phone: d.phone,
          email: d.email,
          avatar: d.avatar_url,
          online: d.online,
          creditsBalance: Number(d.credits_balance || 0),
          earningsBalance: Number(d.earnings_balance || 0),
          creditTransactions: d.credit_transactions || [],
          currentCoords: d.current_coords || [0, 0],
          contractAcceptedVersion: d.contract_accepted_version ? Number(d.contract_accepted_version) : undefined,
          contractAcceptedAt: d.contract_accepted_at,
          veiculoModelo: d.veiculo_modelo,
          veiculoPlaca: d.veiculo_placa,
          veiculoCor: d.veiculo_cor,
          docRejectionReason: d.doc_rejection_reason,
          veiculoTipo: (d.veiculo_tipo || "moto") as "moto" | "carro",
          capacidadePassageiros: d.capacidade_passageiros,
          capacidadeCargaKg: d.capacidade_carga_kg,
          valorKm: Number(d.valor_km || 2.00),
          taxaSaida: Number(d.taxa_saida || 5.00),
          rating: Number(d.rating || 5.0),
          approved: d.approved as any,
          raioMaximo: Number(d.raio_maximo || 5.0),
          modalidades: d.modalidades || ["moto"],
          pixChave: d.pix_chave,
          pixTipoChave: d.pix_tipo_chave as any,
          pixNomeRecebedor: d.pix_nome_recebedor,
          pixCidadeRecebedor: d.pix_cidade_recebedor,
          acceptsPix: d.accepts_pix,
          acceptsCash: d.accepts_cash,
          acceptsCard: d.accepts_card,
          hasMachine: d.has_machine,
          usesTapToPay: d.uses_tap_to_pay,
          tapToPayApp: d.tap_to_pay_app,
          hasNfcHardware: d.has_nfc_hardware,
          cnhUrl: d.cnh_url,
          motoDocUrl: d.moto_doc_url,
          selfieUrl: d.selfie_url,
          blocked: d.blocked
        })));
      }
    };

    const fetchRides = async () => {
      const { data, error } = await supabase.from("rides").select("*").order("timestamp", { ascending: false });
      if (error) console.error(error);
      else {
        setRides((data || []).map(r => ({
          id: r.id,
          timestamp: r.timestamp,
          clientName: r.client_name,
          clientPhone: r.client_phone,
          clientId: r.client_id,
          driverId: r.driver_id,
          driverName: r.driver_name,
          driverPhone: r.driver_phone,
          veiculoModelo: r.veiculo_modelo,
          veiculoPlaca: r.veiculo_placa,
          startAddress: r.origem_label,
          endAddress: r.destino_label,
          startCoords: r.start_coords,
          endCoords: r.end_coords,
          driverCoords: r.driver_coords,
          geometry: r.geometry,
          status: r.status as any,
          statusPagamento: r.status_pagamento as any,
          totalCost: Number(r.total_cost || 0),
          originalTotalCost: Number(r.valor_calculado || 0),
          waitingTimeCost: Number(r.waiting_time_cost || 0),
          distance: Number(r.distance || 0),
          duration: Number(r.duration || 0),
          formaPagamento: r.payment_method as any,
          arrivedAtOriginAt: r.arrived_at_origin_at,
          arrivedAtOriginCoords: r.arrived_at_origin_coords,
          startedAt: r.started_at,
          startedCoords: r.started_coords,
          reservedFee: Number(r.reserved_fee || 0),
          fraudSuspected: r.fraud_suspected,
          fraudType: r.fraud_type as any,
          movementLogs: r.movement_logs,
          waitingLogs: r.waiting_logs || [],
          isWaiting: false,
          stops: r.stops || []
        })));
      }
    };

    const fetchFinance = async () => {
      const { data, error } = await supabase.from("financial_transactions").select("*").order("timestamp", { ascending: false });
      if (error) console.error(error);
      else {
        setFinancialTransactions((data || []).map(f => ({
          id: f.id,
          userId: f.user_id,
          userName: f.user_name,
          userRole: f.user_role as any,
          amount: Number(f.amount || 0),
          timestamp: f.timestamp,
          type: f.type as any,
          status: f.status as any,
          confirmedAt: f.confirmed_at,
          confirmedBy: f.confirmed_by
        })));
      }
    };

    const fetchWithdrawals = async () => {
      const { data, error } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false });
      if (error) console.error(error);
      else {
        setWithdrawals((data || []).map(w => ({
          id: w.id,
          driverId: w.driver_id,
          amount: Number(w.amount || 0),
          status: w.status as any,
          timestamp: w.created_at,
          processedAt: w.processed_at,
          pixChave: w.pix_key,
          pixTipoChave: w.pix_key_type,
          driverName: w.driver_name,
          processedBy: w.processed_by,
          adminNotes: w.admin_notes
        })));
      }
    };

    fetchClients();
    fetchContracts();
    fetchAcceptances();
    fetchDrivers();
    fetchRides();
    fetchFinance();
    fetchWithdrawals();

    // Sincronização em tempo real via canais do Supabase
    const syncChannel = supabase.channel("public_tables_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, fetchClients)
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts" }, fetchContracts)
      .on("postgres_changes", { event: "*", schema: "public", table: "contract_acceptances" }, fetchAcceptances)
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, fetchDrivers)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, fetchRides)
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_transactions" }, fetchFinance)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, fetchWithdrawals)
      .subscribe();

    setAuditLogs([
      { id: "log_1", timestamp: new Date(Date.now() - 3600000).toISOString(), action: "Acesso Administrativo", desc: "Painel gerenciador inicializado com segurança via Supabase." },
      { id: "log_2", timestamp: new Date(Date.now() - 10800000).toISOString(), action: "Controle Monetário", desc: "Regras de descontos automatizados ativas." }
    ]);

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [currentUser]);

  // Sync settings when props change
  useEffect(() => {
    setPercentPlataforma(settings.percentPlataforma);
    setTaxaMinima(settings.taxaMinima);
    setTaxaMaxima(settings.taxaMaxima);
    setSaldoMinimoOnline(settings.saldoMinimoOnline);
    setDescontosAtivos(settings.descontosAtivos);
    setRegrasCobrancaDescricao(settings.regrasCobrancaDescricao);
    setAdminEmail(settings.adminEmail || "dalison.messias@outlook.com");
    setAdminPassword(settings.adminPassword || "102192");

    if (settings.branding) {
      setColorPrimary(settings.branding.colorPrimary || "#f59e0b");
      setColorSecondary(settings.branding.colorSecondary || "#d97706");
      setColorAccent(settings.branding.colorAccent || "#10b981");
      setColorButton(settings.branding.colorButton || "#f59e0b");
      setColorNavbar(settings.branding.colorNavbar || "#09090b");
      setColorCard(settings.branding.colorCard || "#181c24");
      setColorDarkThemeHex(settings.branding.colorDarkThemeHex || "#09090b");
      setColorPremium(settings.branding.colorPremium || "#f59e0b");
      setThemeMode(settings.branding.themeMode || "dark");
      setBrandingTitle(settings.branding.title || "Vouali");
      setBrandingSlogan(settings.branding.slogan || "Vouali e chego bem");

      setCurrentLogoUrl(settings.branding.logoUrl || "");
      setCurrentLogoDarkUrl(settings.branding.logoDarkUrl || "");
      setCurrentLogoLightUrl(settings.branding.logoLightUrl || "");
      setCurrentFaviconUrl(settings.branding.faviconUrl || "");
      setCurrentSplashUrl(settings.branding.splashUrl || "");
      setCurrentInstitutionalImgUrl(settings.branding.institutionalImgUrl || "");
    }

    if (settings.pixSettings) {
      setPixKey(settings.pixSettings.chave || "");
      setPixKeyType(settings.pixSettings.tipoChave || "CPF");
      setPixReceiverName(settings.pixSettings.nomeRecebedor || "");
      setPixCity(settings.pixSettings.cidade || "");
      setPixBank(settings.pixSettings.banco || "");
      setPixDescription(settings.pixSettings.descricao || "");
      setPixActive(settings.pixSettings.ativo ?? true);
    }

    if (settings.socialLogin) {
      setSocialGoogle(settings.socialLogin.google);
      setSocialFacebook(settings.socialLogin.facebook);
      setSocialInstagram(settings.socialLogin.instagram);
    }
  }, [settings]);

  // Leaflet Live Map Integration for Admin Monitor view (Dynamic focus)
  useEffect(() => {
    if (activeTab !== "dashboard" || !adminMapRef.current) return;

    const initialLat = adminGpsCoords ? adminGpsCoords[0] : -12.9714;
    const initialLng = adminGpsCoords ? adminGpsCoords[1] : -38.5014;

    if (!mapInstanceRef.current) {
      const map = L.map(adminMapRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([initialLat, initialLng], 12);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 20
      }).addTo(map);

      mapInstanceRef.current = map;
    } else if (adminGpsCoords) {
      mapInstanceRef.current.setView(adminGpsCoords, 12);
    }

    const map = mapInstanceRef.current;

    // Remove stale markers safely
    Object.keys(driverMarkersRef.current).forEach((id) => {
      driverMarkersRef.current[id].remove();
    });
    driverMarkersRef.current = {};

    // Pop real-time online drivers geolocated on administrative terminal
    drivers.forEach((driver) => {
      if (!driver.online) return;

      const positionLat: [number, number] = [driver.currentCoords[1], driver.currentCoords[0]];
      const isApproved = driver.approved === "aprovado";
      const hasSufficientCredits = driver.creditsBalance >= settings.saldoMinimoOnline;

      const customDivIcon = L.divIcon({
        className: "admin-live-map-ping",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-9 w-9 ${isApproved ? (hasSufficientCredits ? 'bg-emerald-500/20' : 'bg-amber-500/20') : 'bg-red-500/20'} opacity-50 rounded-full animate-ping"></span>
            <div class="w-8 h-8 rounded-full ${isApproved ? (hasSufficientCredits ? 'bg-zinc-900 text-emerald-400 border-2 border-emerald-500' : 'bg-zinc-900 text-amber-500 border-2 border-amber-500') : 'bg-zinc-900 text-red-500 border-2 border-red-500'} flex items-center justify-center shadow-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18.5" cy="17.5" r="2.5"/>
                <circle cx="5.5" cy="17.5" r="2.5"/>
                <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
              </svg>
            </div>
            <div class="absolute -top-6 bg-zinc-950/80 px-1 py-0.5 rounded border border-zinc-800 text-[8px] font-black uppercase text-zinc-100 max-w-[80px] truncate">
              ${driver.name.split(" ")[0]}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const mk = L.marker(positionLat, { icon: customDivIcon }).addTo(map);
      
      // Bind descriptive popup metadata
      mk.bindPopup(`
        <div class="bg-zinc-950 text-xs p-2 text-zinc-200 border border-zinc-800 rounded-lg space-y-1 font-sans">
          <p class="font-extrabold text-amber-500 text-sm uppercase">${driver.name}</p>
          <p><strong>Placa:</strong> ${driver.veiculoPlaca}</p>
          <p><strong>Saldo na Carteira:</strong> <span class="${driver.creditsBalance >= settings.saldoMinimoOnline ? 'text-emerald-400' : 'text-red-400'} font-bold">R$ ${driver.creditsBalance.toFixed(2)}</span></p>
          <p><strong>Avaliação (Rating):</strong> ⭐ ${driver.rating.toFixed(1)}</p>
          <p><strong>Status Aprovação:</strong> <span class="capitalize font-bold">${driver.approved}</span></p>
          <p><strong>Modalidade Ativa:</strong> ${driver.modalidades?.join(", ") || "Nenhuma"}</p>
        </div>
      `, {
        closeButton: false,
        className: "custom-leaflet-admin-popup"
      });

      driverMarkersRef.current[driver.id] = mk;
    });

// Invalidate map layout size for smooth CSS transitions
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

  }, [activeTab, drivers, settings.saldoMinimoOnline, adminGpsCoords]);

  // Handle saving of configuration changes persistent to Supabase Settings table
  const handleSaveConfigs = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AppSettings = {
      ...settings,
      percentPlataforma: Number(percentPlataforma) || 10,
      taxaMinima: Number(taxaMinima) || 1.0,
      taxaMaxima: Number(taxaMaxima) || 10.0,
      saldoMinimoOnline: Number(saldoMinimoOnline) || 5.0,
      descontosAtivos,
      regrasCobrancaDescricao,
      valorMinutoEspera: Number(valorMinutoEspera) || 0.5,
      minutosGratisEspera: Number(minutosGratisEspera) || 5,
      valorMinimoEspera: Number(valorMinimoEspera) || 2.0,
      limiteEsperaMinutos: Number(limiteEsperaMinutos) || 30,
      maxParadas: Number(maxParadas) || 3,
      adminEmail: adminEmail || "dalison.messias@outlook.com",
      adminPassword: adminPassword || "102192",
      pricing: catPricing as any
    };

    try {
      await supabase.from("settings").upsert({ id: "global", data: updated });
      onUpdateSettings(updated);
      setConfigSuccess(true);
      
      // Post system action audit log
      writeSystemLog("Configuração de Tarifas", "Configuração geral do Vouali alterada pelo administrador.");

      setTimeout(() => setConfigSuccess(false), 2500);
    } catch (err) {
      console.error("Error updating global admin settings in Supabase:", err);
    }
  };

  const handleSaveSocialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSocial = {
      google: socialGoogle,
      facebook: socialFacebook,
      instagram: socialInstagram
    };

    const updatedSettings: AppSettings = {
      ...settings,
      socialLogin: updatedSocial as any
    };

    try {
      await supabase.from("settings").upsert({ id: "global", data: updatedSettings });
      onUpdateSettings(updatedSettings);
      setConfigSuccess(true);
      writeSystemLog("Configuração Login Social", "Parâmetros de autenticação social atualizados.");
      setTimeout(() => setConfigSuccess(false), 2500);
    } catch (err) {
      console.error("Error updating social login settings in Supabase:", err);
    }
  };

  // Handle saving visual customizations to Supabase Settings & Storage
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingLoading(true);
    setBrandingError(null);
    setBrandingSuccess(false);

    try {
      let logoUrl = currentLogoUrl;
      let logoDarkUrl = currentLogoDarkUrl;
      let logoLightUrl = currentLogoLightUrl;
      let faviconUrl = currentFaviconUrl;
      let splashUrl = currentSplashUrl;
      let institutionalImgUrl = currentInstitutionalImgUrl;

      // Helper function to upload files safely to Supabase Storage
      const uploadFile = async (file: File, pathSegment: string): Promise<string> => {
        const filePath = `branding/${Date.now()}_${pathSegment}`;
        return await uploadToSupabaseStorage("assets", filePath, file);
      };

      if (logoPrincipalFile) {
        logoUrl = await uploadFile(logoPrincipalFile, "logo_principal");
        setCurrentLogoUrl(logoUrl);
      }
      if (logoDarkFile) {
        logoDarkUrl = await uploadFile(logoDarkFile, "logo_dark");
        setCurrentLogoDarkUrl(logoDarkUrl);
      }
      if (logoLightFile) {
        logoLightUrl = await uploadFile(logoLightFile, "logo_light");
        setCurrentLogoLightUrl(logoLightUrl);
      }
      if (faviconFile) {
        faviconUrl = await uploadFile(faviconFile, "favicon");
        setCurrentFaviconUrl(faviconUrl);
      }
      if (splashFile) {
        splashUrl = await uploadFile(splashFile, "splash");
        setCurrentSplashUrl(splashUrl);
      }
      if (institutionalFile) {
        institutionalImgUrl = await uploadFile(institutionalFile, "institutional");
        setCurrentInstitutionalImgUrl(institutionalImgUrl);
      }

      const previousHistory = settings.branding?.history || [];
      const newHistoryLog = {
        id: "brand_log_" + Date.now(),
        timestamp: new Date().toISOString(),
        changedBy: settings.adminEmail || "dalison.messias@outlook.com",
        description: `Branding alterado. Tema: ${themeMode}, Cor: ${colorPrimary}, Titulo: ${brandingTitle}`,
        previousColors: `Primária: ${settings.branding?.colorPrimary || "#f59e0b"}, Secundária: ${settings.branding?.colorSecondary || "#d97706"}`
      };

      const updatedBranding = {
        logoUrl,
        logoDarkUrl,
        logoLightUrl,
        faviconUrl,
        splashUrl,
        institutionalImgUrl,
        colorPrimary,
        colorSecondary,
        colorAccent,
        colorButton,
        colorNavbar,
        colorCard,
        colorDarkThemeHex,
        colorPremium,
        themeMode,
        title: brandingTitle,
        slogan: brandingSlogan,
        history: [newHistoryLog, ...previousHistory]
      };

      const updatedSettings = {
        ...settings,
        branding: updatedBranding
      };

      await supabase.from("settings").upsert({ id: "global", data: updatedSettings });
      onUpdateSettings(updatedSettings);
      setBrandingSuccess(true);
      writeSystemLog("Customização Visual", "Identidade Visual do Vouali modificada com sucesso.");
      
      // Clear file uploads cache after success
      setLogoPrincipalFile(null);
      setLogoDarkFile(null);
      setLogoLightFile(null);
      setFaviconFile(null);
      setSplashFile(null);
      setInstitutionalFile(null);

      setTimeout(() => setBrandingSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error updates branding customization:", err);
      setBrandingError(err.message || "Não foi possível carregar as configurações visuais.");
    } finally {
      setBrandingLoading(false);
    }
  };

  const applyPresetTheme = (presetName: string) => {
    switch (presetName) {
      case "vouali_amber":
        setColorPrimary("#f59e0b");
        setColorSecondary("#d97706");
        setColorAccent("#10b981");
        setColorButton("#f59e0b");
        setColorNavbar("#09090b");
        setColorCard("#181c24");
        setColorDarkThemeHex("#09090b");
        setColorPremium("#f59e0b");
        setThemeMode("dark");
        break;
      case "royal_gold":
        setColorPrimary("#d4af37");
        setColorSecondary("#aa7c11");
        setColorAccent("#4169e1");
        setColorButton("#d4af37");
        setColorNavbar("#0a0a0f");
        setColorCard("#13131f");
        setColorDarkThemeHex("#050508");
        setColorPremium("#d4af37");
        setThemeMode("dark");
        break;
      case "cyber_neon":
        setColorPrimary("#ec4899");
        setColorSecondary("#a855f7");
        setColorAccent("#06b6d4");
        setColorButton("#ec4899");
        setColorNavbar("#0c0a0f");
        setColorCard("#16121e");
        setColorDarkThemeHex("#040306");
        setColorPremium("#ec4899");
        setThemeMode("dark");
        break;
      case "ocean_breeze":
        setColorPrimary("#0ea5e9");
        setColorSecondary("#0369a1");
        setColorAccent("#10b981");
        setColorButton("#0ea5e9");
        setColorNavbar("#0f172a");
        setColorCard("#1e293b");
        setColorDarkThemeHex("#0b0f19");
        setColorPremium("#0ea5e9");
        setThemeMode("dark");
        break;
      default:
        break;
    }
  };

  const handleSavePixSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPix: PixSettings = {
      chave: pixKey,
      tipoChave: pixKeyType,
      nomeRecebedor: pixReceiverName,
      cidade: pixCity,
      banco: pixBank,
      descricao: pixDescription,
      ativo: pixActive
    };

    const updatedSettings: AppSettings = {
      ...settings,
      pixSettings: updatedPix
    };

    try {
      await supabase.from("settings").upsert({ id: "global", data: updatedSettings });
      onUpdateSettings(updatedSettings);
      setConfigSuccess(true);
      writeSystemLog("Configuração PIX", "Dados bancários da plataforma atualizados.");
      setTimeout(() => setConfigSuccess(false), 2500);
    } catch (err) {
      console.error("Error updating PIX settings:", err);
    }
  };

  const handleApproveTransaction = async (tx: FinancialTransaction) => {
    setConfirmModal({
      isOpen: true,
      title: "Confirmar Transação",
      message: `Confirmar recebimento deste pagamento no valor de R$ ${tx.amount.toFixed(2)} e adicionar saldo ao usuário ${tx.userName}?`,
      onConfirm: async () => {
        try {
          await supabase.from("financial_transactions").update({
            status: "confirmado",
            confirmed_at: new Date().toISOString(),
            confirmed_by: currentUser?.uid || "admin"
          }).eq("id", tx.id);

          const collectionName = tx.userRole === "driver" ? "drivers" : "clients";
          const { data: userData, error: userError } = await supabase.from(collectionName).select("*").eq("id", tx.userId).single();
          
          if (userData) {
            const currentBalance = Number(userData.credits_balance || 0);
            const newBalance = currentBalance + tx.amount;
            
            const txLog: CreditTransaction = {
              id: "tx_pix_" + Date.now(),
              timestamp: new Date().toISOString(),
              type: "recharge_pix",
              amount: tx.amount,
              balanceAfter: newBalance,
              description: `Recarga PIX aprovada (ID: ${tx.id.slice(-6).toUpperCase()})`
            };

            const existingTx = userData.credit_transactions || [];
            await supabase.from(collectionName).update({
              credits_balance: newBalance,
              credit_transactions: [txLog, ...existingTx]
            }).eq("id", tx.userId);

            writeSystemLog("Recarga Confirmada", `Pagamento de R$ ${tx.amount.toFixed(2)} confirmado para ${tx.userName}.`);
          }
        } catch (err) {
          console.error("Error approving transaction:", err);
        }
      }
    });
  };

  const handleCancelTransaction = async (tx: FinancialTransaction) => {
    setConfirmModal({
      isOpen: true,
      title: "Cancelar Recarga",
      message: `Deseja realmente CANCELAR esta solicitação de recarga de R$ ${tx.amount.toFixed(2)} para ${tx.userName}?`,
      onConfirm: async () => {
        try {
          await supabase.from("financial_transactions").update({
            status: "cancelado"
          }).eq("id", tx.id);
          writeSystemLog("Recarga Cancelada", `Solicitação de R$ ${tx.amount.toFixed(2)} de ${tx.userName} cancelada.`);
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleRollbackBranding = async (historicalLog: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Restaurar Visual",
      message: "Deseja reverter as alterações visuais para este estado histórico?",
      onConfirm: async () => {
        setBrandingLoading(true);
        try {
          if (historicalLog.previousColors) {
            const parts = historicalLog.previousColors.split(", ");
            const primaryHex = parts[0]?.split(": ")[1];
            const secondaryHex = parts[1]?.split(": ")[1];
            if (primaryHex) setColorPrimary(primaryHex);
            if (secondaryHex) setColorSecondary(secondaryHex);
          }
          
          const previousHistory = settings.branding?.history || [];
          const newHistoryLog = {
            id: "brand_log_" + Date.now(),
            timestamp: new Date().toISOString(),
            changedBy: settings.adminEmail || "dalison.messias@outlook.com",
            description: `Rollback executado para a versão de ${new Date(historicalLog.timestamp).toLocaleDateString()}`
          };

          const updatedBranding = {
            ...settings.branding,
            colorPrimary,
            colorSecondary,
            history: [newHistoryLog, ...previousHistory]
          };

          const updatedSettings = {
            ...settings,
            branding: updatedBranding
          };

          await supabase.from("settings").upsert({ id: "global", data: updatedSettings });
          onUpdateSettings(updatedSettings);
          setBrandingSuccess(true);
          writeSystemLog("Rollback Visual", "Restaurado com sucesso um snapshot visual anterior.");
          setTimeout(() => setBrandingSuccess(false), 3000);
        } catch (e: any) {
          setBrandingError(e.message || "Falha no processo de rollback.");
        } finally {
          setBrandingLoading(false);
        }
      }
    });
  };

  const handleApproveWithdrawal = async (withdraw: WithdrawalRequest) => {
    setConfirmModal({
      isOpen: true,
      title: "Aprovar Saque",
      message: `Confirmar o PAGAMENTO de R$ ${withdraw.amount.toFixed(2)} para ${withdraw.driverName}?`,
      onConfirm: async () => {
        try {
          await supabase.from("withdrawals").update({
            status: "aprovado",
            processed_at: new Date().toISOString(),
            processed_by: currentUser?.uid || "admin"
          }).eq("id", withdraw.id);

          writeSystemLog(
            "Saque Aprovado", 
            `Pagamento de R$ ${withdraw.amount.toFixed(2)} concluído para o condutor ${withdraw.driverName}.`
          );

          await triggerDemoPush(
            withdraw.driverId,
            "Saque Aprovado! ✅",
            `Seu saque de R$ ${withdraw.amount.toFixed(2)} foi processado com sucesso.`,
            1
          );
        } catch (err) {
          console.error("Erro ao aprovar saque:", err);
        }
      }
    });
  };

  const handleRejectWithdrawal = async (withdraw: WithdrawalRequest) => {
    setPromptModal({
      isOpen: true,
      title: "Rejeitar Saque",
      message: `Informe o motivo da rejeição do saque de R$ ${withdraw.amount.toFixed(2)} para ${withdraw.driverName}:`,
      onConfirm: async (reason) => {
        if (!reason || reason.trim() === "") return;
        try {
          const { data: drvData } = await supabase.from("drivers").select("*").eq("id", withdraw.driverId).single();
          
          if (drvData) {
            const restoredBalance = Number(drvData.earnings_balance || 0) + withdraw.amount;
            
            await supabase.from("drivers").update({
              earnings_balance: restoredBalance
            }).eq("id", withdraw.driverId);

            await supabase.from("withdrawals").update({
              status: "rejeitado",
              processed_at: new Date().toISOString(),
              processed_by: currentUser?.uid || "admin",
              admin_notes: reason
            }).eq("id", withdraw.id);

            writeSystemLog(
              "Saque Rejeitado", 
              `Solicitação de ${withdraw.driverName} rejeitada. Saldo de R$ ${withdraw.amount.toFixed(2)} estornado.`
            );

            await triggerDemoPush(
              withdraw.driverId,
              "Saque Rejeitado ❌",
              `Seu pedido de saque foi recusado: ${reason}`,
              1
            );
          }
        } catch (err) {
          console.error("Erro ao rejeitar saque:", err);
        }
      }
    });
  };

  // Helper dynamic actions tracking logs
  const writeSystemLog = (action: string, desc: string) => {
    const newLog = {
      id: "log_" + Date.now(),
      timestamp: new Date().toISOString(),
      action,
      desc
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Driver Approval Workflow: Approve, Reject
  const handleDriverApprovalChange = async (drv: MototaxistaProfile, approvalStatus: "aprovado" | "recusado") => {
    try {
      const updates: any = {
        approved: approvalStatus,
        doc_rejection_reason: approvalStatus === "recusado" ? adminComments : ""
      };

      // Se aprovado, dar saldo inicial de créditos de R$ 20.00 se estiver zerado, para ajudá-lo a testar
      if (approvalStatus === "aprovado" && drv.creditsBalance === undefined) {
        updates.credits_balance = 20.00;
      }

      await supabase.from("drivers").update(updates).eq("id", drv.id);
      
      writeSystemLog(
        `Cadastro ${approvalStatus === "aprovado" ? "Aprovado" : "Recusado"}`, 
        `O motorista ${drv.name} foi ${approvalStatus === "aprovado" ? "aprovado" : "recusado"} no credenciamento manual.`
      );

      setApprovingDriver(null);
      setAdminComments("");
    } catch (err) {
      console.error("Error setting driver approval status:", err);
    }
  };

  // Adjusting driver wallet credits budget manually
  const handleUpdateDriverCredits = async () => {
    if (!updatingCreditsDriver || !creditsAmountInput) return;
    const amount = parseFloat(creditsAmountInput);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const currentBalance = updatingCreditsDriver.creditsBalance || 0;
      const calculatedNewBalance = creditsOpType === "add" 
        ? currentBalance + amount 
        : Math.max(0, currentBalance - amount);

      const tx: CreditTransaction = {
        id: "tx_" + Date.now(),
        timestamp: new Date().toISOString(),
        type: creditsOpType === "add" ? "recharge" : "deduction",
        amount: amount,
        balanceAfter: calculatedNewBalance,
        description: creditsOpType === "add" 
          ? `Depósito manual administrativo (Saldo: R$ ${amount.toFixed(2)})` 
          : `Retirada manual administrativa (Saldo: R$ ${amount.toFixed(2)})`
      };

      const existingTxList = updatingCreditsDriver.creditTransactions || [];

      await supabase.from("drivers").update({
        credits_balance: calculatedNewBalance,
        credit_transactions: [tx, ...existingTxList]
      }).eq("id", updatingCreditsDriver.id);

      writeSystemLog(
        "Ajuste Financeiro Condutor", 
        `Crédito de ${updatingCreditsDriver.name} ajustado de R$ ${currentBalance.toFixed(2)} para R$ ${calculatedNewBalance.toFixed(2)}`
      );

      setUpdatingCreditsDriver(null);
      setCreditsAmountInput("");
    } catch (err) {
      console.error("Error updating driver credits:", err);
    }
  };

  // Adjusting client wallet credits budget manually (REQUISITO: CARTEIRA DIGITAL CLIENTE)
  const handleUpdateClientCredits = async () => {
    if (!updatingCreditsClient || !creditsAmountInput) return;
    const amount = parseFloat(creditsAmountInput);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const currentBalance = updatingCreditsClient.creditsBalance || 0;
      const calculatedNewBalance = creditsOpType === "add" 
        ? currentBalance + amount 
        : Math.max(0, currentBalance - amount);

      const tx: CreditTransaction = {
        id: "tx_cli_" + Date.now(),
        timestamp: new Date().toISOString(),
        type: creditsOpType === "add" ? "bonus" : "deduction",
        amount: amount,
        balanceAfter: calculatedNewBalance,
        description: creditsOpType === "add" 
          ? `Bônus/Crédito manual via Administrativo (Vouali Wallet)` 
          : `Débito/Correção manual via Administrativo (Vouali Wallet)`
      };

      const existingTxList = updatingCreditsClient.creditTransactions || [];

      await supabase.from("clients").update({
        credits_balance: calculatedNewBalance,
        credit_transactions: [tx, ...existingTxList]
      }).eq("id", updatingCreditsClient.id);

      writeSystemLog(
        "Ajuste Financeiro Cliente", 
        `Saldo de ${updatingCreditsClient.name} ajustado para R$ ${calculatedNewBalance.toFixed(2)}`
      );

      setUpdatingCreditsClient(null);
      setCreditsAmountInput("");
    } catch (err) {
      console.error("Error updating client credits:", err);
    }
  };

  // Block/Unblock users profiles (soft lock toggles)
  const handleToggleBlockClient = async (client: any) => {
    const nextBlockState = !client.blocked;
    try {
      await supabase.from("clients").update({ blocked: nextBlockState }).eq("id", client.id);
      writeSystemLog(
        nextBlockState ? "Cliente Bloqueado" : "Cliente Desbloqueado", 
        `Conta do passageiro ${client.name} foi ${nextBlockState ? "bloqueada" : "desbloqueada"}.`
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBlockDriver = async (drv: MototaxistaProfile) => {
    const nextBlockState = !(drv as any).blocked;
    try {
      await supabase.from("drivers").update({ blocked: nextBlockState }).eq("id", drv.id);
      writeSystemLog(
        nextBlockState ? "Condutor Bloqueado" : "Condutor Desbloqueado", 
        `Conta do condutor parceiro ${drv.name} foi ${nextBlockState ? "bloqueada" : "desbloqueada"}.`
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Delete accounts permanently
  const handleDeleteClient = async (clientId: string, clientName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Passageiro",
      message: `Deseja realmente EXCLUIR permanentemente a conta de ${clientName}? Esta ação é irreversível.`,
      onConfirm: async () => {
        try {
          await supabase.from("clients").delete().eq("id", clientId);
          await supabase.from("users").delete().eq("id", clientId);
          writeSystemLog("Exclusão de Conta", `Conta do passageiro ${clientName} removida permanetemente.`);
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleDeleteDriver = async (driverId: string, driverName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Condutor",
      message: `Deseja realmente EXCLUIR permanentemente o credenciamento de ${driverName}? Esta ação é irreversível.`,
      onConfirm: async () => {
        try {
          await supabase.from("drivers").delete().eq("id", driverId);
          await supabase.from("users").delete().eq("id", driverId);
          writeSystemLog("Exclusão de Condutor", `Credenciamento de condutor ${driverName} removido permanentemente.`);
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  // Save modified user details directly
  const handleSaveClientEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
      await supabase.from("clients").update({
        name: editingClient.name,
        phone: editingClient.phone
      }).eq("id", editingClient.id);
      writeSystemLog("Edição Cadastral", `Dados cadastrais de ${editingClient.name} atualizados.`);
      setEditingClient(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveDriverEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    try {
      await supabase.from("drivers").update({
        name: editingDriver.name,
        phone: editingDriver.phone,
        veiculo_placa: editingDriver.veiculoPlaca.toUpperCase(),
        veiculo_modelo: editingDriver.veiculoModelo,
        veiculo_cor: editingDriver.veiculoCor,
        veiculo_tipo: editingDriver.veiculoTipo,
        capacidade_passageiros: Number(editingDriver.capacidadePassageiros) || 0,
        capacidade_carga_kg: Number(editingDriver.capacidadeCargaKg) || 0,
        valor_km: Number(editingDriver.valorKm) || 2.0,
        taxa_saida: Number(editingDriver.taxaSaida) || 5.0
      }).eq("id", editingDriver.id);
      writeSystemLog("Edição Cadastral", `Dados profissionais do condutor ${editingDriver.name} atualizados.`);
      setEditingDriver(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateNewContract = async () => {
    if (!newContractContent) return;
    const latestVersion = contracts.length > 0 ? contracts[0].version : 0;
    const nextVersion = latestVersion + 1;

    try {
      const contractId = `v${nextVersion}_${Date.now()}`;

      // Set all other contracts to inactive
      for (const c of contracts) {
        if (c.active) {
          await supabase.from("contracts").update({ active: false }).eq("id", c.id);
        }
      }

      await supabase.from("contracts").insert({
        id: contractId,
        version: nextVersion,
        content: newContractContent,
        active: true,
        created_by: settings.adminEmail || "admin"
      });
      writeSystemLog("Novo Contrato Digital", `Publicada versão ${nextVersion} do contrato da plataforma.`);
      setIsCreatingContract(false);
      setNewContractContent("");
    } catch (err) {
      console.error("Error creating contract:", err);
    }
  };

  const handleToggleContractStatus = async (contract: Contract) => {
    try {
      await supabase.from("contracts").update({
        active: !contract.active
      }).eq("id", contract.id);
      writeSystemLog("Alteração de Contrato", `Status da versão ${contract.version} alterado para ${!contract.active ? 'Ativo' : 'Inativo'}.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Sum total Platform commission earnings from completed rides
  const completedRidesList = rides.filter(r => r.status === "finalizado");
  
  // Platform profits calculation: we can iterate and sum all driver deduction transactions or simulate commission
  // Platform earnings = 10% (or percentPlataforma%) per ride with min/max caps!
  const calculatePlatformRevenue = (): number => {
    let accumulated = 0;
    completedRidesList.forEach((r) => {
      let rawFee = (r.totalCost * settings.percentPlataforma) / 100;
      if (rawFee < settings.taxaMinima) rawFee = settings.taxaMinima;
      if (rawFee > settings.taxaMaxima) rawFee = settings.taxaMaxima;
      accumulated += rawFee;
    });
    return accumulated;
  };

  const platformTotalRevenue = calculatePlatformRevenue();

  // Generate charting data structure of last 7 mock days for the Recharts visualization
  const getCommissionDataLast7Days = () => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    // Build real/mock entries relative to the rides dataset
    return days.map((day, idx) => {
      // Scale faturamento logically
      const factor = idx * 14.50 + 20.00;
      return {
        name: day,
        Faturamento: parseFloat((platformTotalRevenue * 0.12 + factor).toFixed(2)),
        Corridas: Math.round(completedRidesList.length * 0.15 + idx + 1)
      };
    });
  };

  const chartData = getCommissionDataLast7Days();

  // Search filter implementations
  const filteredClients = clients.filter(c => {
    const norm = (c.name || "").toLowerCase() + (c.phone || "") + (c.email || "").toLowerCase();
    return norm.includes(searchQuery.toLowerCase());
  });

  const filteredDrivers = drivers.filter(d => {
    const norm = (d.name || "").toLowerCase() + (d.phone || "") + (d.veiculoPlaca || "").toLowerCase() + (d.veiculoModelo || "").toLowerCase();
    const searchMatch = norm.includes(searchQuery.toLowerCase());
    
    if (driverApprovalFilter === "all") return searchMatch;
    return searchMatch && d.approved === driverApprovalFilter;
  });

  return (
    <div className="space-y-6 pt-4 pb-12 animate-fade-in text-zinc-100 font-sans">
      
      {/* ADMIN TITLE BANNER */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 rounded-xl text-zinc-950 font-black">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] bg-amber-500/10 text-amber-500 font-mono font-black uppercase tracking-widest border border-amber-500/25 px-2 py-0.5 rounded">
                Portal Corretor
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            <h2 className="text-xl font-black uppercase text-zinc-100 tracking-tight">Painel da Administração Central</h2>
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Vouali e chego bem</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="hidden lg:block text-right font-mono text-[10px] text-zinc-500">
            Faturamento Estimado: <span className="text-emerald-400 font-bold block text-xs">R$ {platformTotalRevenue.toFixed(2)}</span>
          </div>
          <button
            onClick={onSignout}
            className="w-full md:w-auto py-2.5 px-4 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-bold uppercase text-[10px] tracking-wider transition cursor-pointer"
          >
            Sair do Admin
          </button>
        </div>
      </div>

      {/* CORE CONTROL HUD TABS */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-900 pb-3">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "dashboard" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <Map className="w-4 h-4" /> Geral & Mapa
        </button>
        
        <button
          onClick={() => setActiveTab("approvals")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer relative shrink-0 ${
            activeTab === "approvals" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <CheckCircle className="w-4 h-4" /> Aprovações
          {pendingApprovals.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[9px] animate-bounce">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("clients")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "clients" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <Users className="w-4 h-4" /> Gestão Clientes
        </button>

        <button
          onClick={() => setActiveTab("drivers")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "drivers" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <Bike className="w-4 h-4" /> Gestão Condutores
        </button>

        <button
          onClick={() => setActiveTab("configs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "configs" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <Sliders className="w-4 h-4" /> Tarifas & Regras
        </button>

        <button
          onClick={() => setActiveTab("whatsapp")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "whatsapp" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <MessageSquare className="w-4 h-4" /> WhatsApp
        </button>

        <button
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "branding" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <Paintbrush className="w-4 h-4" /> Personalização Visual
        </button>

        <button
          onClick={() => setActiveTab("contracts")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "contracts" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Contrato Digital
        </button>

        <button
          onClick={() => setActiveTab("finance")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "finance" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <Wallet className="w-4 h-4" /> Finanças & PIX
        </button>

        <button
          onClick={() => setActiveTab("social")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "social" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <Chrome className="w-4 h-4" /> Login Social
        </button>

        <button
          onClick={() => setActiveTab("support")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "support" ? "bg-amber-500 text-zinc-950 font-black" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
          }`}
        >
          <Headset className="w-4 h-4" /> Suporte IA
        </button>

        <button
          onClick={() => setActiveTab("antifraud")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0 ${
            activeTab === "antifraud" ? "bg-red-600 text-white font-black" : "bg-zinc-900 hover:bg-zinc-850 text-red-500/70"
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Anti-Fraude
        </button>
      </div>

      {/**************** TAB 1: GENERAL DASHBOARD ENGINE ****************/}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* STATS BENTO CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Total de Usuários</span>
              <h3 className="text-2xl font-black font-mono text-zinc-100">{totalClients + totalDrivers}</h3>
              <p className="text-[9px] text-zinc-400">{totalClients} Clientes / {totalDrivers} Motos</p>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Motoristas Conectados</span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <h3 className="text-2xl font-black font-mono text-emerald-400">{onlineDrivers}</h3>
              </div>
              <p className="text-[9px] text-zinc-400">{approvedDrivers.length} Condutores Credenciados</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Corridas Plataforma</span>
              <h3 className="text-2xl font-black font-mono text-zinc-100">{rides.length}</h3>
              <p className="text-[9px] text-emerald-400 font-bold font-mono">{completedRidesList.length} Finalizadas</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Ganhos de Taxa</span>
              <div className="flex items-baseline gap-1">
                <h3 className="text-2xl font-black font-mono text-emerald-400">R$ {platformTotalRevenue.toFixed(2)}</h3>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-[9px] text-zinc-400">Comissão de {settings.percentPlataforma}%</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-1 col-span-2 lg:col-span-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Aprovações Pendentes</span>
              <h3 className={`text-2xl font-black font-mono ${pendingApprovals.length > 0 ? "text-amber-500" : "text-zinc-400"}`}>{pendingApprovals.length}</h3>
              <p className="text-[9px] text-zinc-405 text-zinc-500 font-semibold uppercase">{pendingApprovals.length > 0 ? "Exige Verificação!" : "Tudo Verificado"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LIVE ADMN MAP FOR REALTIME TRACKING */}
            <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-3.5 shadow-xl relative space-y-3">
              <div className="flex justify-between items-center px-2">
                <div>
                  <h4 className="text-xs font-black uppercase text-zinc-200">Radar Geográfico do Administrador</h4>
                  <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider">{adminGpsLabel}</p>
                </div>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  ● {onlineDrivers} Online
                </span>
              </div>
              
              <div className="h-[360px] rounded-2xl overflow-hidden border border-zinc-800 relative bg-zinc-950">
                <div ref={adminMapRef} className="w-full h-full z-10" />
              </div>
            </div>

            {/* PLATFROM CONVERT PROFIT CHARTS */}
            <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase text-zinc-200">Métricas de Faturamento e Fluxo</h4>
                <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider">Ganhos acumulados com base nas corridas</p>
              </div>

              <div className="h-[210px] w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorPlat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "10px" }} />
                    <Area type="monotone" dataKey="Faturamento" stroke="#f59e0b" fillOpacity={1} fill="url(#colorPlat)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* QUICK RECENT LOGS */}
              <div className="space-y-2 pt-2 border-t border-zinc-850">
                <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest block font-mono">Logs de Audit do Sistema</span>
                <div className="space-y-1.5 max-h-[85px] overflow-y-auto pr-1">
                  {auditLogs.map((lg) => (
                    <div key={lg.id} className="text-[9.5px] bg-zinc-950 rounded-lg p-2 border border-zinc-850 flex justify-between gap-2">
                      <div>
                        <strong className="text-amber-500 font-bold pr-1">[{lg.action}]:</strong>
                        <span className="text-zinc-400">{lg.desc}</span>
                      </div>
                      <span className="text-zinc-650 font-mono text-zinc-500 shrink-0">{new Date(lg.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/**************** TAB 2: DRIVER APPROVAL ENGINE ****************/}
      {activeTab === "approvals" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-1.5">
                <BadgeAlert className="w-4 h-4 text-amber-500" /> Fila de Credenciamento Condutores
              </h3>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                Verifique os documentos dos novos mototaxistas para liberá-los na plataforma
              </p>
            </div>
            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/35 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold animate-pulse">
              {pendingApprovals.length} Pedidos de Entrada
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 space-y-2.5">
              <CheckCircle className="w-12 h-12 text-zinc-700 mx-auto" />
              <h4 className="text-zinc-400 font-bold uppercase tracking-wider text-xs">Nenhum Mototaxista Aguardando</h4>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
                Todos os condutores que se cadastraram no Vouali já foram analisados e suas respectivas permissões de atendimento estão ativas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pendingApprovals.map((drv) => (
                <div key={drv.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={drv.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${drv.name}`} 
                        className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-800 shrink-0" 
                        alt="avatar" 
                      />
                      <div>
                        <h4 className="text-xs font-black uppercase text-zinc-100">{drv.name}</h4>
                        <span className="text-[9px] text-zinc-500 font-mono">Contato direct: {drv.phone}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-zinc-900 border border-zinc-850 p-2.5 rounded-xl text-[11px] font-mono">
                      <div>
                        <span className="text-zinc-500 block text-[9px] uppercase font-sans">Modelo Veículo</span>
                        <span className="text-zinc-300 font-bold">{drv.veiculoModelo}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[9px] uppercase font-sans">Placa Mercosul</span>
                        <span className="text-amber-500 font-black tracking-wider">{drv.veiculoPlaca}</span>
                      </div>
                    </div>

                    {/* RENDER DOCUMENTS INSPECTOR PLATFORM */}
                    <div className="space-y-2">
                      <span className="text-[9px] text-zinc-500 font-extrabold uppercase font-mono tracking-wider block">Anexos de Identificação cadastrados</span>
                      <div className="grid grid-cols-3 gap-2">
                        {/* 1. Selfie */}
                        <div className="space-y-1 text-center">
                          <span className="text-[8px] text-zinc-500 uppercase block font-bold font-sans">Selfie Perfil</span>
                          <img 
                            src={drv.selfieUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60"} 
                            alt="selfie" 
                            className="w-full h-16 rounded-lg object-cover border border-zinc-800 hover:scale-105 transition"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        {/* 2. CNH */}
                        <div className="space-y-1 text-center">
                          <span className="text-[8px] text-zinc-500 uppercase block font-bold font-sans">CNH</span>
                          <img 
                            src={drv.cnhUrl || "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=500&auto=format&fit=crop&q=60"} 
                            alt="cnh" 
                            className="w-full h-16 rounded-lg object-cover border border-zinc-800 hover:scale-105 transition"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        {/* 3. CRLV Document */}
                        <div className="space-y-1 text-center font-sans">
                          <span className="text-[8px] text-zinc-500 uppercase block font-bold font-sans">Documento Moto</span>
                          <img 
                            src={drv.motoDocUrl || "https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=500&auto=format&fit=crop&q=60"} 
                            alt="crlv_doc" 
                            className="w-full h-16 rounded-lg object-cover border border-zinc-800 hover:scale-105 transition"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-900 space-y-2.5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setApprovingDriver(drv);
                          setAdminComments("Documentos aprovados com sucesso pelo administrador.");
                          handleDriverApprovalChange(drv, "aprovado");
                        }}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                      >
                        Aprovar Cadastro
                      </button>
                      <button
                        onClick={() => {
                          setApprovingDriver(drv);
                          setAdminComments("");
                        }}
                        className="px-3 bg-zinc-900 hover:bg-zinc-850 hover:text-red-500 border border-zinc-800 rounded-xl text-xs transition cursor-pointer"
                        title="Recusar cadastro ou solicitar ajustes"
                      >
                        Recusar
                      </button>
                    </div>

                    {approvingDriver?.id === drv.id && (
                      <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 space-y-2 animate-fade-in">
                        <span className="text-[9px] text-red-500 font-black uppercase tracking-wider block font-mono">Motivo de Recusa / Observações</span>
                        <textarea
                          placeholder="Informe por que o cadastro foi recusado..."
                          value={adminComments}
                          onChange={(e) => setAdminComments(e.target.value)}
                          className="w-full bg-zinc-950 text-xs text-zinc-300 placeholder-zinc-700 outline-none p-2 border border-zinc-800 focus:border-red-500 rounded-lg min-h-[60px]"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => { setApprovingDriver(null); setAdminComments(""); }}
                            className="px-3 py-1 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded text-[10px] uppercase font-bold text-zinc-400 cursor-pointer"
                          >
                            Voltar
                          </button>
                          <button
                            onClick={() => handleDriverApprovalChange(drv, "recusado")}
                            disabled={!adminComments.trim()}
                            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] uppercase font-black cursor-pointer"
                          >
                            Confirmar Recusa
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/**************** TAB 3: CLIENTS DIRECTORY PANEL ****************/}
      {activeTab === "clients" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" /> Diretório Geral de Clientes ({totalClients})
              </h3>
              <p className="text-zinc-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Pesquise, edite, bloqueie ou exclua contas de passageiros</p>
            </div>
            
            <div className="relative w-full sm:w-64 font-sans">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-650 text-zinc-500" />
              <input
                type="text"
                placeholder="Nome, celular ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-amber-500 transition text-zinc-300 placeholder-zinc-700"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-zinc-300 text-xs text-left font-sans">
              <thead>
                <tr className="border-b border-zinc-800 uppercase tracking-wider text-[10px] text-zinc-500">
                  <th className="py-3 px-2">Cliente</th>
                  <th className="py-3 px-2">WhatsApp / Contato</th>
                  <th className="py-3 px-2">Histórico</th>
                  <th className="py-3 px-2 text-emerald-500 font-black">Carteira</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredClients.map((client) => {
                  const clientRidesCount = rides.filter(r => r.clientId === client.id).length;
                  return (
                    <tr key={client.id} className="hover:bg-zinc-950/40 transition">
                      <td className="py-3.5 px-2 font-semibold">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src={client.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${client.name}`} 
                            className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-850" 
                            alt="avatar" 
                          />
                          <div>
                            <span className="text-zinc-100 uppercase block font-black">{client.name}</span>
                            <span className="text-[9px] text-zinc-500 font-mono block max-w-[120px] truncate">{client.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 font-mono text-zinc-400">{client.phone}</td>
                      <td className="py-3.5 px-2 font-mono text-zinc-450">{clientRidesCount} {clientRidesCount === 1 ? 'corrida' : 'corridas'}</td>
                      <td className="py-3.5 px-2 font-mono">
                        <div 
                          className="flex items-center gap-1.5 cursor-pointer hover:bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-zinc-900 hover:border-emerald-500/30 transition-all group" 
                          onClick={() => setUpdatingCreditsClient(client)}
                          title="Gerenciar saldo do passageiro"
                        >
                          <PiggyBank className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition" />
                          <span className="text-zinc-100 font-extrabold uppercase tracking-tighter">R$ {(client.creditsBalance || 0).toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider font-mono ${
                          client.blocked 
                            ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {client.blocked ? "⛔ BLOQUEADO" : "✓ ATIVO"}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditingClient(client)}
                            className="p-1.5 bg-zinc-950 hover:bg-zinc-800 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-amber-500 cursor-pointer transition"
                            title="Editar informações cadastrais"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleBlockClient(client)}
                            className={`p-1.5 rounded border transition cursor-pointer ${
                              client.blocked 
                                ? "bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-400 border-emerald-500/25" 
                                : "bg-red-500/10 hover:bg-red-650 hover:text-white text-red-500 border-red-500/25"
                            }`}
                            title={client.blocked ? "Liberar acesso passageiro" : "Suspender acesso às chamadas"}
                          >
                            {client.blocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleDeleteClient(client.id, client.name)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded border border-red-500/20 hover:border-transparent transition cursor-pointer"
                            title="Excluir conta permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MODAL: ADJUST CLIENT CREDITS (REQUISITO: CARTEIRA DIGITAL CLIENTE) */}
          {updatingCreditsClient && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                      <PiggyBank className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-zinc-100 tracking-tight">Carteira de {updatingCreditsClient.name.split(" ")[0]}</h3>
                      <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider">Ajuste de Créditos / Vouali Wallet</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setUpdatingCreditsClient(null); setCreditsAmountInput(""); }}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                  >
                    <XCircle className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>

                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 flex justify-between items-end">
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest block mb-1">Saldo Atualizado</span>
                    <span className="text-xl font-black font-mono text-zinc-100">R$ {(updatingCreditsClient.creditsBalance || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-[9px] text-zinc-500 font-mono text-right">
                    ID: {updatingCreditsClient.id.substring(0,8)}...
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCreditsOpType("add")}
                      className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                        creditsOpType === "add" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/5" : "bg-zinc-950 border-zinc-800 text-zinc-600"
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[9px] font-black uppercase">Adicionar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreditsOpType("sub")}
                      className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                        creditsOpType === "sub" ? "bg-red-500/10 border-red-500 text-red-400 shadow-lg shadow-red-500/5" : "bg-zinc-950 border-zinc-800 text-zinc-600"
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-[9px] font-black uppercase">Retirar</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Valor do Ajuste (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={creditsAmountInput}
                      onChange={(e) => setCreditsAmountInput(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-3.5 px-4 text-zinc-100 text-lg font-black outline-none transition"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleUpdateClientCredits}
                    disabled={!creditsAmountInput || parseFloat(creditsAmountInput) <= 0}
                    className="w-full bg-amber-500 disabled:opacity-30 hover:bg-amber-400 text-zinc-950 font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition shadow-xl shadow-amber-500/10 cursor-pointer active:scale-95"
                  >
                    Confirmar Ajuste de Saldo
                  </button>
                </div>
              </div>
            </div>
          )}

          {editingClient && (
            <div className="fixed inset-0 z-[2030] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setEditingClient(null)}></div>
              <div className="relative bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl z-10">
                <div className="border-b border-zinc-800 pb-2">
                  <h4 className="text-xs font-black uppercase text-zinc-100">Editar Detalhes do Cliente</h4>
                  <p className="text-[10px] text-zinc-500 uppercase font-mono">ID: {editingClient.id}</p>
                </div>
                <form onSubmit={handleSaveClientEdits} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Nome Completo</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200"
                      value={editingClient.name}
                      onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 font-sans">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">WhatsApp No.</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200 font-mono"
                      value={editingClient.phone}
                      onChange={(e) => handlePhoneMask(e.target.value, (v) => setEditingClient({ ...editingClient, phone: v }))}
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingClient(null)}
                      className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 rounded-lg text-xs uppercase font-bold text-zinc-400 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-xs uppercase font-black cursor-pointer"
                    >
                      Salvar Cadastro
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/**************** TAB 4: DRIVERS DIRECTORY PANEL ****************/}
      {activeTab === "drivers" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                <Bike className="w-5 h-5 text-amber-500" /> Diretório Geral de Condutores ({totalDrivers})
              </h3>
              <p className="text-zinc-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Credenciamentos, rebalanceamentos de crédito, regras online e dados profissionais</p>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full lg:w-auto font-sans">
              <select
                value={driverApprovalFilter}
                onChange={(e) => setDriverApprovalFilter(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-400"
              >
                <option value="all">Filtro Permissão (Todos)</option>
                <option value="aprovado">Aprovados</option>
                <option value="pendente">Pendente Avaliação</option>
                <option value="recusado">Recusados</option>
              </select>

              <div className="relative w-full sm:w-56 font-sans">
                <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Pesquise por nome, placa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-1.5 pl-9 pr-3 text-xs outline-none focus:border-amber-500 transition text-zinc-300 placeholder-zinc-700"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-zinc-300 text-xs text-left font-sans">
              <thead>
                <tr className="border-b border-zinc-800 uppercase tracking-wider text-[10px] text-zinc-500">
                  <th className="py-3 px-2">Mototaxista</th>
                  <th className="py-3 px-2">Veículo / Placa</th>
                  <th className="py-3 px-2 text-center">Permissão</th>
                  <th className="py-3 px-2 text-right">Carteira Crédito</th>
                  <th className="py-3 px-2 text-center">Atendimento</th>
                  <th className="py-3 px-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredDrivers.map((driver) => {
                  const isBlocked = (driver as any).blocked;
                  return (
                    <tr key={driver.id} className="hover:bg-zinc-950/40 transition">
                      <td className="py-3.5 px-2 font-semibold">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src={driver.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${driver.name}`} 
                            className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-850" 
                            alt="avatar" 
                          />
                          <div>
                            <span className="text-zinc-100 uppercase block font-black">{driver.name}</span>
                            <span className="text-[9px] text-zinc-500 font-mono block">Fone: {driver.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <div className="font-mono">
                          <span className="text-zinc-400 block">{driver.veiculoModelo}</span>
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded tracking-wide font-black uppercase inline-block">{driver.veiculoPlaca}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          driver.approved === "aprovado" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : driver.approved === "recusado"
                            ? "bg-red-500/10 text-red-500 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse"
                        }`}>
                          {driver.approved}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono text-zinc-100">
                        <span className={`text-[13px] font-extrabold ${driver.creditsBalance >= settings.saldoMinimoOnline ? 'text-emerald-400' : 'text-red-500'}`}>
                          R$ {(driver.creditsBalance || 0).toFixed(2)}
                        </span>
                        <p className="text-[8px] text-zinc-500 uppercase font-sans">Minimo: R$ {settings.saldoMinimoOnline.toFixed(2)}</p>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wide ${
                          driver.online 
                            ? "bg-emerald-500 text-zinc-950 font-black animate-pulse" 
                            : "bg-zinc-850 text-zinc-500 border border-zinc-800"
                        }`}>
                          {driver.online ? "● Conectado" : "Offline"}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Wallet budget setup buttons */}
                          <button
                            onClick={() => {
                              setUpdatingCreditsDriver(driver);
                              setCreditsOpType("add");
                            }}
                            className="p-1.5 bg-zinc-950 hover:bg-zinc-800 rounded border border-zinc-800 hover:border-zinc-700 text-emerald-400 hover:scale-105 transition cursor-pointer"
                            title="Lançamentos de Créditos (PIX)"
                          >
                            <PiggyBank className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setEditingDriver(driver)}
                            className="p-1.5 bg-zinc-950 hover:bg-zinc-800 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-amber-500 cursor-pointer transition"
                            title="Editar tarifas e dados"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleBlockDriver(driver)}
                            className={`p-1.5 rounded border transition cursor-pointer ${
                              isBlocked 
                                ? "bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-400 border-emerald-500/25" 
                                : "bg-red-500/10 hover:bg-red-650 hover:text-white text-red-500 border-red-500/25"
                            }`}
                            title={isBlocked ? "Liberar acesso condutor" : "Suspender acesso profissional"}
                          >
                            {isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleDeleteDriver(driver.id, driver.name)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded border border-red-500/20 hover:border-transparent transition cursor-pointer"
                            title="Remover credenciamento Vouali"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BUDGET WALLET DEPOSITS/RETRIEVAL ENGINE MODAL */}
          {updatingCreditsDriver && (
            <div className="fixed inset-0 z-[2031] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setUpdatingCreditsDriver(null)}></div>
              <div className="relative bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl z-10 font-sans">
                <div className="border-b border-zinc-800 pb-2 flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-black uppercase text-zinc-100">Conciliação de Créditos manual</h4>
                    <p className="text-[10px] text-zinc-450 text-zinc-500 block uppercase font-mono">Motorista: {updatingCreditsDriver.name}</p>
                  </div>
                  <span className="text-[11px] font-mono font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded">
                    R$ {(updatingCreditsDriver.creditsBalance || 0).toFixed(2)}
                  </span>
                </div>

                <div className="space-y-4 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Modalidade da Operação</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCreditsOpType("add")}
                        className={`py-2 rounded-xl text-xs font-extrabold transition cursor-pointer uppercase ${
                          creditsOpType === "add" ? "bg-emerald-500 text-zinc-950" : "bg-zinc-950 border border-zinc-800 text-zinc-500"
                        }`}
                      >
                        ✓ Adicionar (PIX)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreditsOpType("sub")}
                        className={`py-2 rounded-xl text-xs font-extrabold transition cursor-pointer uppercase ${
                          creditsOpType === "sub" ? "bg-red-500 text-zinc-950" : "bg-zinc-950 border border-zinc-800 text-zinc-500"
                        }`}
                      >
                        ✗ Debitar (Taxa)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 font-mono">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase font-sans tracking-wider block">Valor Monetário (R$)</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      step="1"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-zinc-200 outline-none text-center font-bold text-base"
                      value={creditsAmountInput}
                      onChange={(e) => setCreditsAmountInput(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setUpdatingCreditsDriver(null)}
                      className="px-3 py-2 bg-zinc-950 hover:bg-zinc-850 rounded-xl text-xs uppercase font-bold text-zinc-400 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateDriverCredits}
                      disabled={!creditsAmountInput || isNaN(parseFloat(creditsAmountInput))}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-xs uppercase font-black cursor-pointer"
                    >
                      Processar Lançamento
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROFILE EDIT MODE INTERFACE */}
          {editingDriver && (
            <div className="fixed inset-0 z-[2030] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setEditingDriver(null)}></div>
              <div className="relative bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl z-10 font-sans">
                <div className="border-b border-zinc-800 pb-2">
                  <h4 className="text-xs font-black uppercase text-zinc-100">Editar Detalhes Profissionais</h4>
                  <p className="text-[10px] text-zinc-500 uppercase font-mono">Condutor ID: {editingDriver.name}</p>
                </div>
                <form onSubmit={handleSaveDriverEdits} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Nome Completo</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200 font-sans"
                      value={editingDriver.name}
                      onChange={(e) => setEditingDriver({ ...editingDriver, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">WhatsApp No.</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200 font-mono"
                      value={editingDriver.phone}
                      onChange={(e) => handlePhoneMask(e.target.value, (v) => setEditingDriver({ ...editingDriver, phone: v }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">Veículo Modelo</label>
                      <input
                        type="text"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200"
                        value={editingDriver.veiculoModelo}
                        onChange={(e) => setEditingDriver({ ...editingDriver, veiculoModelo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">Placa Mercosul</label>
                      <input
                        type="text"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200 uppercase font-mono"
                        value={editingDriver.veiculoPlaca}
                        onChange={(e) => setEditingDriver({ ...editingDriver, veiculoPlaca: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">Cor Veículo</label>
                      <input
                        type="text"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200"
                        value={editingDriver.veiculoCor || ""}
                        onChange={(e) => setEditingDriver({ ...editingDriver, veiculoCor: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">Tipo</label>
                      <select
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200 font-mono"
                        value={editingDriver.veiculoTipo}
                        onChange={(e) => setEditingDriver({ ...editingDriver, veiculoTipo: e.target.value as any })}
                      >
                        <option value="moto">Moto</option>
                        <option value="carro">Carro</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">Passageiros (Cap.)</label>
                      <input
                        type="number"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200 font-mono"
                        value={editingDriver.capacidadePassageiros || 0}
                        onChange={(e) => setEditingDriver({ ...editingDriver, capacidadePassageiros: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">Carga (Kg)</label>
                      <input
                        type="number"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200 font-mono"
                        value={editingDriver.capacidadeCargaKg || 0}
                        onChange={(e) => setEditingDriver({ ...editingDriver, capacidadeCargaKg: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">R$ por KM</label>
                      <input
                        type="number"
                        step="0.10"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200 font-mono"
                        value={editingDriver.valorKm}
                        onChange={(e) => setEditingDriver({ ...editingDriver, valorKm: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">R$ Base</label>
                      <input
                        type="number"
                        step="0.50"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs outline-none focus:border-amber-500 text-zinc-200 font-mono"
                        value={editingDriver.taxaSaida}
                        onChange={(e) => setEditingDriver({ ...editingDriver, taxaSaida: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingDriver(null)}
                      className="px-3 py-2 bg-zinc-950 hover:bg-zinc-850 rounded-lg text-xs uppercase font-bold text-zinc-400 cursor-pointer font-sans"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-xs uppercase font-black cursor-pointer font-sans"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/**************** TAB 5: COMMISSION PLATFORM CONFIGS ****************/}
      {activeTab === "configs" && (
        <div className="space-y-6">
          {/* Gestão De Categorias (Nova Funcionalidade) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-5">
            <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-1.5">
                  <Sliders className="w-5 h-5 text-amber-500" /> Categorias & Tarifas Base por Modalidade
                </h3>
                <p className="text-zinc-[10px] text-zinc-500 uppercase tracking-wide font-black font-mono">Defina os valores de mercado para cada serviço Vouali</p>
              </div>
              <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-black uppercase">
                Multi-Categoria Ativo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.keys(catPricing) as ModalidadeCorrida[]).map((catId) => {
                const config = catPricing[catId]!;
                const isCar = catId.includes("carro");
                
                return (
                  <div key={catId} className={`p-4 rounded-2xl border transition-all ${config.ativo ? "bg-zinc-950 border-zinc-805" : "bg-zinc-950/40 border-zinc-900 opacity-60"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isCar ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                          {catId.includes("flash") ? <Package className="w-4.5 h-4.5" /> : (isCar ? <Navigation className="w-4.5 h-4.5" /> : <Bike className="w-4.5 h-4.5" />)}
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase text-zinc-100 tracking-tight">{catId.replace("_", " ")}</h4>
                          <button 
                            onClick={() => setCatPricing(prev => ({
                              ...prev,
                              [catId]: { ...prev[catId]!, ativo: !prev[catId]!.ativo }
                            }))}
                            className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded cursor-pointer ${config.ativo ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}
                          >
                            {config.ativo ? "Pausar" : "Ativar"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block">Taxa de Saída</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-700 font-mono">R$</span>
                          <input 
                            type="number" 
                            step="0.10"
                            value={config.taxaSaida}
                            onChange={(e) => setCatPricing(prev => ({
                              ...prev,
                              [catId]: { ...prev[catId]!, taxaSaida: Number(e.target.value) }
                            }))}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg py-1.5 pl-7 text-[11px] font-mono outline-none focus:border-amber-500/40"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block">Valor por KM</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-700 font-mono">R$</span>
                          <input 
                            type="number" 
                            step="0.05"
                            value={config.valorKm}
                            onChange={(e) => setCatPricing(prev => ({
                              ...prev,
                              [catId]: { ...prev[catId]!, valorKm: Number(e.target.value) }
                            }))}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg py-1.5 pl-7 text-[11px] font-mono outline-none focus:border-amber-500/40"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block">Corrida Mínima</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-700 font-mono">R$</span>
                          <input 
                            type="number" 
                            step="0.10"
                            value={config.precoMinimo}
                            onChange={(e) => setCatPricing(prev => ({
                              ...prev,
                              [catId]: { ...prev[catId]!, precoMinimo: Number(e.target.value) }
                            }))}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg py-1.5 pl-7 text-[11px] font-mono outline-none focus:border-amber-500/40"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
            {/* CONTROL BOX (ORIGINAL CONFIGS) */}
            <div className="lg:col-span-6 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl">
              <div className="border-b border-zinc-800 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-500" /> Configurações de Faturamento & Regras
                  </h3>
                  <p className="text-zinc-[10px] text-zinc-500 uppercase tracking-wide font-black font-mono">Dedução e conciliação de faturamento</p>
                </div>
              </div>

              <form onSubmit={handleSaveConfigs} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1 leading-none">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Comissão Plataforma (%)</label>
                  <p className="text-[9px] text-zinc-500 pb-1">Porcentagem descontada do saldo do motorista por corrida</p>
                  <input
                    type="number"
                    required
                    value={percentPlataforma}
                    onChange={(e) => setPercentPlataforma(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-200 text-sm font-bold font-mono outline-none"
                  />
                </div>

                <div className="space-y-1 font-sans">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Saldo Mínimo Online (R$)</label>
                  <p className="text-[9px] text-zinc-500 pb-1">Saldo mínimo exigido na carteira de crédito para o motorista receber corridas</p>
                  <input
                    type="number"
                    required
                    value={saldoMinimoOnline}
                    onChange={(e) => setSaldoMinimoOnline(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-200 text-sm font-bold font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1 font-mono">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-sans tracking-wider block">Taxa Mínima por Corrida (R$)</label>
                  <p className="text-[9px] text-zinc-500 font-sans pb-1">Limite mínimo de comissão descontado por corrida</p>
                  <input
                    type="number"
                    step="0.10"
                    required
                    value={taxaMinima}
                    onChange={(e) => setTaxaMinima(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-100 font-bold"
                  />
                </div>

                <div className="space-y-1 font-mono">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-sans tracking-wider block">Taxa Máxima por Corrida (R$)</label>
                  <p className="text-[9px] text-zinc-500 font-sans pb-1">Limite máximo de comissão descontado por corrida</p>
                  <input
                    type="number"
                    step="0.50"
                    required
                    value={taxaMaxima}
                    onChange={(e) => setTaxaMaxima(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-100 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-zinc-805">
                <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                  <div>
                    <h5 className="font-bold text-zinc-200">Descontos Automáticos de Carteira</h5>
                    <p className="text-[9.5px] text-zinc-500 leading-normal">Se ativo, desconta as comissões automaticamente da carteira de crédito ao finalizar cada trajeto.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={descontosAtivos}
                    onChange={(e) => setDescontosAtivos(e.target.checked)}
                    className="w-5 h-5 accent-amber-500 cursor-pointer shrink-0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Políticas e Descrição de Cobrança</label>
                <textarea
                  value={regrasCobrancaDescricao}
                  onChange={(e) => setRegrasCobrancaDescricao(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl text-xs text-zinc-350 outline-none p-3 min-h-[90px] leading-relaxed"
                />
              </div>

              <div className="space-y-4 pt-2 border-t border-zinc-805">
                <h4 className="text-[11px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Configurações de Espera e Paradas
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">R$ por Minuto de Espera</label>
                    <input
                      type="number"
                      step="0.10"
                      value={valorMinutoEspera}
                      onChange={(e) => setValorMinutoEspera(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-200 text-xs font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Minutos Iniciais Grátis</label>
                    <input
                      type="number"
                      value={minutosGratisEspera}
                      onChange={(e) => setMinutosGratisEspera(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-200 text-xs font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Tarifa Mínima Espera (R$)</label>
                    <input
                      type="number"
                      step="0.50"
                      value={valorMinimoEspera}
                      onChange={(e) => setValorMinimoEspera(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-200 text-xs font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Limite de Espera (Minutos)</label>
                    <input
                      type="number"
                      value={limiteEsperaMinutos}
                      onChange={(e) => setLimiteEsperaMinutos(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-200 text-xs font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Máximo de Paradas</label>
                    <input
                      type="number"
                      value={maxParadas}
                      onChange={(e) => setMaxParadas(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-200 text-xs font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* CREDENTIALS UPDATER BLOCK */}
              <div className="pt-4 border-t border-zinc-800 space-y-3">
                <h4 className="text-[11px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                  🛡️ Credenciais de Acesso Administrativo
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">E-mail de Login Admin</label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-200 text-xs font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Senha de Login Admin</label>
                    <input
                      type="text"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-2 px-3 text-zinc-200 text-xs font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black py-3 rounded-xl uppercase tracking-wider text-xs transition cursor-pointer shadow-lg shadow-amber-500/10"
              >
                Salvar Configurações Globais
              </button>

              {configSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-2 rounded-xl text-center font-bold animate-pulse">
                  Regras e tarifas atualizadas com sucesso!
                </div>
              )}
            </form>
          </div>

          {/* AUDIT LOG REPORT CARD & RECHARGES STATEMENT */}
          <div className="lg:col-span-6 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between gap-4">
            <div>
              <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-1.5 pb-2 border-b border-zinc-800">
                <FileText className="w-4 h-4 text-amber-500" /> Relatório Financeiro e Auditoria de Tarifas
              </h3>
              
              <div className="space-y-4 pt-3 text-xs leading-normal">
                <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-2xl flex items-center gap-3">
                  <PiggyBank className="w-8 h-8 text-emerald-400" />
                  <div>
                    <h5 className="font-extrabold uppercase text-[10px] text-zinc-300">Como funciona o lucro da plataforma?</h5>
                    <p className="text-zinc-[11px] text-zinc-400 text-zinc-500 leading-relaxed mt-1">
                      O Vouali não retém o faturamento pago pelo passageiro à vista.
                      O motorista recebe 100% da tarifa direto em Pix, Cartão ou Dinheiro.
                      Para prestar serviços, o motorista faz recargas pré-pagas via Pix direto para a conta central do Vouali.
                      A cada corrida concluída, o nosso motorista tem descontado de sua carteira o percentual da plataforma (ex: 10%), respeitando as taxas limites parametrizadas ao lado.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest block font-mono">Últimas 10 Corridas Concluídas</span>
                  <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                    {completedRidesList.length === 0 ? (
                      <p className="text-zinc-600 italic text-[10px]">Nenhuma corrida faturada ainda no banco de dados.</p>
                    ) : (
                      completedRidesList.slice(0, 10).map((r) => {
                        let finalCommission = (r.totalCost * percentPlataforma) / 100;
                        if (finalCommission < taxaMinima) finalCommission = taxaMinima;
                        if (finalCommission > taxaMaxima) finalCommission = taxaMaxima;
                        return (
                          <div key={r.id} className="bg-zinc-950 border border-zinc-850 rounded-xl p-2.5 flex justify-between items-center text-[10.5px]">
                            <div>
                              <strong className="text-zinc-200 block">Condutor: {r.driverName}</strong>
                              <span className="text-zinc-500 font-mono">Corrida: R$ {r.totalCost.toFixed(2)} | {new Date(r.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div className="text-right font-mono">
                              <span className="text-emerald-400 font-extrabold font-bold block">Taxado R$ {finalCommission.toFixed(2)}</span>
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded font-sans uppercase">Descontado</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-850 pt-3 text-center">
              <span className="text-[9px] text-zinc-500 block uppercase font-mono font-bold">Vouali Plataforma de Tecnologia de Mobilidade Limitada</span>
            </div>
          </div>
        </div>
      </div>
    )}

      {/**************** TAB 7: BRANDING & VISUAL IDENTITY ****************/}
      {activeTab === "branding" && (
        <div className="space-y-6 pb-20">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: CONTROLS */}
            <div className="xl:col-span-8 space-y-6">
              
              {/* ASSETS & LOGOS */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
                <div className="border-b border-zinc-800 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-500" /> Identidade Visual & Logos
                    </h3>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Substitua os ativos gráficos da plataforma</p>
                  </div>
                  <Sparkles className="w-5 h-5 text-emerald-500/30" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Logo Principal */}
                  <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">Logo Principal</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center p-2 overflow-hidden shadow-inner">
                        {logoPrincipalFile ? (
                          <img src={URL.createObjectURL(logoPrincipalFile)} className="max-w-full max-h-full object-contain" alt="Logo Preview" />
                        ) : currentLogoUrl ? (
                          <img src={currentLogoUrl} className="max-w-full max-h-full object-contain" alt="Current Logo" />
                        ) : (
                          <Layout className="w-8 h-8 text-zinc-800" />
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="cursor-pointer bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[9px] font-black uppercase py-2 px-3 rounded-lg block text-center transition text-zinc-300">
                          Alterar Logo
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setLogoPrincipalFile(e.target.files[0])} />
                        </label>
                        <p className="text-[8px] text-zinc-600 mt-1 uppercase text-center">PNG/SVG - Fundo Transparente</p>
                      </div>
                    </div>
                  </div>

                  {/* Logo Dark/Light variants */}
                  <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">Variante Dark/Light</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="cursor-pointer group">
                        <div className="h-12 bg-white rounded-lg flex items-center justify-center border border-zinc-200 overflow-hidden mb-1">
                           {logoDarkFile ? <img src={URL.createObjectURL(logoDarkFile)} className="max-h-full" alt="Dark Preview" /> : currentLogoDarkUrl ? <img src={currentLogoDarkUrl} className="max-h-full" alt="Current Dark" /> : <div className="text-[8px] text-black/20 font-black uppercase">Escura</div>}
                        </div>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase block text-center">Logo Escura</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setLogoDarkFile(e.target.files[0])} />
                      </label>
                      <label className="cursor-pointer group">
                        <div className="h-12 bg-black rounded-lg flex items-center justify-center border border-zinc-800 overflow-hidden mb-1 shadow-inner shadow-white/5">
                           {logoLightFile ? <img src={URL.createObjectURL(logoLightFile)} className="max-h-full" alt="Light Preview" /> : currentLogoLightUrl ? <img src={currentLogoLightUrl} className="max-h-full opacity-80" alt="Current Light" /> : <div className="text-[8px] text-white/20 font-black uppercase">Clara</div>}
                        </div>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase block text-center">Logo Clara</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setLogoLightFile(e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {/* Favicon & Splash */}
                  <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">Favicon & PWA Splash</label>
                    <div className="flex gap-4">
                      <label className="flex-1 cursor-pointer">
                        <div className="h-10 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center mb-1">
                          {faviconFile ? <img src={URL.createObjectURL(faviconFile)} className="w-5 h-5" alt="Favicon Preview" /> : currentFaviconUrl ? <img src={currentFaviconUrl} className="w-5 h-5" alt="Current Favicon" /> : <Sparkles className="w-4 h-4 text-zinc-700" />}
                        </div>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase block text-center">Favicon (ICO)</span>
                        <input type="file" className="hidden" accept=".ico,.png" onChange={(e) => e.target.files && setFaviconFile(e.target.files[0])} />
                      </label>
                      <label className="flex-1 cursor-pointer">
                        <div className="h-10 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center mb-1">
                          {splashFile ? <img src={URL.createObjectURL(splashFile)} className="max-h-full" alt="Splash Preview" /> : currentSplashUrl ? <img src={currentSplashUrl} className="max-h-full" alt="Current Splash" /> : <RotateCcw className="w-4 h-4 text-zinc-700" />}
                        </div>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase block text-center">Splash PWA</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setSplashFile(e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {/* Institutional */}
                  <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">Imagem Institucional (Login)</label>
                    <label className="cursor-pointer block">
                      <div className="h-10 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center mb-1 overflow-hidden">
                        {institutionalFile ? <img src={URL.createObjectURL(institutionalFile)} className="w-full h-full object-cover" alt="Institutional Preview" /> : currentInstitutionalImgUrl ? <img src={currentInstitutionalImgUrl} className="w-full h-full object-cover" alt="Current Institutional" /> : <ImageIcon className="w-4 h-4 text-zinc-700" />}
                      </div>
                      <span className="text-[8px] text-zinc-500 font-bold uppercase block text-center">Imagem de Banner / Auth</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setInstitutionalFile(e.target.files[0])} />
                    </label>
                  </div>
                </div>
              </div>

              {/* COLORS & THEME */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
                <div className="border-b border-zinc-800 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                      <Paintbrush className="w-4 h-4 text-emerald-500" /> Esquema de Cores & Temas
                    </h3>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Defina a paleta cromática global</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => applyPresetTheme("vouali_amber")} className="w-5 h-5 rounded-full bg-[#f59e0b] border border-white/20 shadow-lg" title="Amber Default"></button>
                    <button onClick={() => applyPresetTheme("royal_gold")} className="w-5 h-5 rounded-full bg-[#d4af37] border border-white/20 shadow-lg" title="Royal Gold"></button>
                    <button onClick={() => applyPresetTheme("cyber_neon")} className="w-5 h-5 rounded-full bg-[#ec4899] border border-white/20 shadow-lg" title="Cyber Neon"></button>
                    <button onClick={() => applyPresetTheme("ocean_breeze")} className="w-5 h-5 rounded-full bg-[#0ea5e9] border border-white/20 shadow-lg" title="Ocean Breeze"></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block">Cor Primária</label>
                    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-850">
                      <input type="color" value={colorPrimary} onChange={(e) => setColorPrimary(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border-none" />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">{colorPrimary}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block">Cor Destaque</label>
                    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-850">
                      <input type="color" value={colorAccent} onChange={(e) => setColorAccent(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border-none" />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">{colorAccent}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block">Cor Botões</label>
                    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-850">
                      <input type="color" value={colorButton} onChange={(e) => setColorButton(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border-none" />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">{colorButton}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block">Navbar / Header</label>
                    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-850">
                      <input type="color" value={colorNavbar} onChange={(e) => setColorNavbar(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border-none" />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">{colorNavbar}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                   <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">Título da Plataforma</label>
                        <input value={brandingTitle} onChange={(e) => setBrandingTitle(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-2xl text-xs outline-none focus:border-emerald-500 font-bold text-zinc-100" placeholder="Ex: Vouali" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">Slogan / Footer Text</label>
                        <input value={brandingSlogan} onChange={(e) => setBrandingSlogan(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-2xl text-xs outline-none focus:border-emerald-500 font-bold text-zinc-100" placeholder="Ex: Mobilidade Inteligente" />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">Modo de Exibição Padrão</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "dark", label: "Dark", icon: Moon },
                            { id: "light", label: "Light", icon: Sun },
                            { id: "auto", label: "Sistema", icon: Laptop }
                          ].map((m) => (
                            <button key={m.id} type="button" onClick={() => setThemeMode(m.id as any)} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition ${themeMode === m.id ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500" : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:border-zinc-700"}`}>
                              <m.icon className="w-4 h-4" />
                              <span className="text-[8px] font-black uppercase tracking-widest">{m.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                   </div>
                </div>
              </div>

              {/* SAVE ACTION */}
              <div className="flex gap-4 items-center">
                 <button onClick={handleSaveBranding} disabled={brandingLoading} className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition cursor-pointer shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2">
                   {brandingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                   {brandingLoading ? "Salvando Identidade..." : "Publicar Identidade Visual"}
                 </button>
              </div>

              {brandingError && <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-2xl text-[10px] font-bold uppercase">{brandingError}</div>}
              {brandingSuccess && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-2xl text-[10px] font-bold uppercase animate-pulse">Identidade Visual Salva com Sucesso! Replicando para clientes e motoristas...</div>}
            </div>

            {/* RIGHT COLUMN: PREVIEW */}
            <div className="xl:col-span-4 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6 h-full flex flex-col min-h-[600px]">
                <div className="border-b border-zinc-800 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-emerald-500" /> Preview App (Simulação)
                    </h3>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Visualização em tempo real</p>
                  </div>
                  <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-850">
                     <button type="button" onClick={() => setBrandingPreviewTab("passenger")} className={`p-1.5 rounded-md transition ${brandingPreviewTab === "passenger" ? "bg-zinc-800 text-emerald-500" : "text-zinc-600"}`}><User className="w-3.5 h-3.5" /></button>
                     <button type="button" onClick={() => setBrandingPreviewTab("driver")} className={`p-1.5 rounded-md transition ${brandingPreviewTab === "driver" ? "bg-zinc-800 text-emerald-500" : "text-zinc-600"}`}><Bike className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* MOCKUP CONTAINER */}
                <div className="flex-1 bg-zinc-950 border border-zinc-850 rounded-3xl overflow-hidden relative shadow-2xl">
                   <div className="w-full h-full p-4 flex flex-col font-sans transition-all duration-700" style={{ backgroundColor: themeMode === 'light' ? '#fff' : colorDarkThemeHex, color: themeMode === 'light' ? '#09090b' : '#fff' }}>
                      {/* MINI NAVBAR */}
                      <div className="h-10 rounded-xl mb-4 flex items-center px-3 justify-between border border-white/5 shadow-lg" style={{ backgroundColor: colorNavbar }}>
                         <div className="flex items-center gap-2">
                            {logoPrincipalFile ? (
                              <img src={URL.createObjectURL(logoPrincipalFile)} className="h-5" alt="Preview Logo" />
                            ) : currentLogoUrl ? (
                              <img src={currentLogoUrl} className="h-5" alt="Current Logo" />
                            ) : (
                               <div className="w-4 h-4 rounded bg-white/20 animate-pulse"></div>
                            )}
                            <span className="text-[10px] font-black uppercase tracking-tighter text-white">{brandingTitle}</span>
                         </div>
                         <div className="flex gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-white/10"></div>
                            <div className="w-5 h-5 rounded-full bg-white/10"></div>
                         </div>
                      </div>

                      {brandingPreviewTab === "passenger" ? (
                        <div className="space-y-4">
                           <div className="bg-white/5 rounded-2xl p-4 shadow-xl border border-white/5" style={{ backgroundColor: themeMode === 'light' ? '#f4f4f5' : colorCard }}>
                              <h5 className="text-[11px] font-black uppercase mb-3">Solicitar Corrida</h5>
                              <div className="space-y-2">
                                <div className="h-8 bg-zinc-900/40 rounded-lg border border-zinc-800 flex items-center px-3 gap-2">
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                   <div className="flex-1 h-2 bg-zinc-800 rounded-full w-20"></div>
                                </div>
                                <div className="h-8 bg-zinc-900/40 rounded-lg border border-zinc-800 flex items-center px-3 gap-2">
                                   <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorPrimary }}></div>
                                   <div className="flex-1 h-2 bg-zinc-800 rounded-full w-24"></div>
                                </div>
                              </div>
                           </div>

                           <div className="grid grid-cols-3 gap-2">
                              {['Flash', 'Comfort', 'Pop'].map((cat) => (
                                <div key={cat} className="p-2 rounded-xl border border-zinc-800/50 text-center transition-all duration-500" style={{ backgroundColor: cat === 'Pop' ? colorPrimary : (themeMode === 'light' ? '#f4f4f5' : colorCard), color: cat === 'Pop' ? (themeMode === 'light' ? '#fff' : '#000') : 'inherit' }}>
                                   <div className="w-5 h-5 bg-black/10 rounded mx-auto mb-1 flex items-center justify-center">
                                      <Package className="w-3 h-3" />
                                   </div>
                                   <span className="text-[8px] font-black uppercase">{cat}</span>
                                </div>
                              ))}
                           </div>

                           <button type="button" className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all duration-500" style={{ backgroundColor: colorButton, color: themeMode === 'light' ? '#fff' : '#000' }}>
                              Confirmar Vouali
                           </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <div>
                                 <span className="text-[8px] text-zinc-500 uppercase font-black block">Seus Ganhos</span>
                                 <p className="text-xl font-black font-mono transition-all duration-500" style={{ color: colorPrimary }}>R$ 1.250,55</p>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                 <Layout className="w-5 h-5 text-zinc-500" />
                              </div>
                           </div>

                           <div className="h-32 bg-zinc-800/30 border-2 border-dashed border-zinc-700 rounded-2xl flex items-center justify-center text-zinc-600">
                             <div className="text-center font-black uppercase text-[10px]">Mapa do Condutor</div>
                           </div>

                           <div className="p-3 rounded-2xl" style={{ backgroundColor: themeMode === 'light' ? '#f4f4f5' : colorCard, border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div className="flex justify-between items-center mb-2">
                                 <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center"><CheckCircle className="w-3 h-3 text-emerald-500" /></div>
                                    <span className="text-[9px] font-black uppercase">Online</span>
                                 </div>
                                 <div className="w-8 h-4 rounded-full bg-emerald-500 relative shadow-[0_0_8px_rgba(16,185,129,0.4)]"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full"></div></div>
                              </div>
                           </div>
                        </div>
                      )}

                      <div className="mt-auto pt-6 text-center border-t border-white/5">
                         <span className="text-[8px] opacity-40 font-black uppercase tracking-[0.2em]">{brandingSlogan}</span>
                      </div>
                   </div>
                </div>

                {/* HISTORICAL LOGS */}
                <div className="mt-4 pt-4 border-t border-zinc-850 space-y-3">
                   <h6 className="text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5"><HistoryIcon className="w-3 h-3" /> Snapshot Histórico</h6>
                   <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                      {settings.branding?.history?.length ? settings.branding.history.map((log) => (
                        <div key={log.id} className="bg-zinc-950 p-2 rounded-xl border border-zinc-900 group flex justify-between items-center transition hover:border-zinc-800">
                           <div className="flex-1">
                              <span className="text-[9px] text-zinc-300 font-bold block">{new Date(log.timestamp).toLocaleDateString()}</span>
                              <span className="text-[8px] text-zinc-600 block truncate w-40">{log.description}</span>
                           </div>
                           <button type="button" onClick={() => handleRollbackBranding(log)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-zinc-900 rounded-lg text-[8px] text-zinc-400 font-black uppercase hover:text-emerald-500 transition border border-zinc-850">Rollback</button>
                        </div>
                      )) : <p className="text-[8px] text-zinc-700 italic uppercase text-center py-4">Sem registros históricos</p>}
                   </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/**************** TAB 6: WHATSAPP ENGINE ****************/}
      {activeTab === "whatsapp" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Status & QR Code */}
            <div className="lg:col-span-12 xl:col-span-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" /> Status do Servidor WhatsApp
                </h3>
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Gerencie a conexão do bot de envios</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-850 flex flex-col items-center justify-center text-center space-y-4">
                {waConfig?.status === "connected" ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                      <CheckCircle className="w-10 h-10 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-emerald-500 font-black uppercase text-xs">Conectado</p>
                      <p className="text-zinc-400 text-[10px] font-mono">Número: {waConfig.phoneNumber || "Desconhecido"}</p>
                    </div>
                    <button
                      onClick={() => handleWaAction("disconnect")}
                      disabled={waLoading}
                      className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                    >
                      Desconectar Sessão
                    </button>
                  </>
                ) : waConfig?.status === "connecting" && waConfig.qrCode ? (
                  <>
                    <div className="bg-white p-3 rounded-2xl shadow-inner shadow-black">
                      <div className="bg-white p-1">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(waConfig.qrCode)}`} 
                          alt="WhatsApp QR Code"
                          className="w-48 h-48"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-amber-500 font-black uppercase text-xs animate-pulse">Aguardando Escaneamento</p>
                      <p className="text-zinc-400 text-[10px] max-w-[200px]">Abra o WhatsApp no seu celular {'>'} Aparelhos Conectados {'>'} Conectar um Aparelho</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-900 shadow-xl shadow-black/40">
                      <XCircle className="w-10 h-10 text-zinc-800" />
                    </div>
                    <div>
                      <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Bot Desconectado</p>
                      <p className="text-zinc-650 text-[10px] uppercase font-bold tracking-tight">O sistema não pode enviar códigos OTP no momento</p>
                    </div>
                    <button
                      onClick={() => handleWaAction("reconnect")}
                      disabled={waLoading}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer shadow-lg shadow-amber-500/20"
                    >
                      {waLoading ? "Gerando QR..." : "Gerar Conexão WhatsApp"}
                    </button>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-850">
                  <span className="text-zinc-500 text-[9px] uppercase font-black tracking-widest block">Total Enviado</span>
                  <p className="text-lg font-black text-white font-mono">{waConfig?.messagesSent || 0}</p>
                </div>
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-850">
                  <span className="text-zinc-500 text-[9px] uppercase font-black tracking-widest block">Canal Ativo</span>
                  <p className="text-lg font-black text-amber-500 font-mono">OTP-V3</p>
                </div>
              </div>
            </div>

            {/* Logs Section */}
            <div className="lg:col-span-12 xl:col-span-8 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-zinc-400" /> Histórico de Comunicação
                  </h3>
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Monitoramento em tempo real de logs do Baileys</p>
                </div>
                <button
                  onClick={() => setWaLogs([])}
                  className="text-[9px] font-bold uppercase text-zinc-700 hover:text-zinc-500 transition"
                >
                  Limpar Logs Locais
                </button>
              </div>

              <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-inner shadow-black/40">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-[10px] text-left border-collapse">
                    <thead className="bg-zinc-900/80 sticky top-0 backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Timestamp</th>
                        <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Telefone</th>
                        <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Evento</th>
                        <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Status</th>
                        <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Metadata</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {waLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-16 text-center text-zinc-700 uppercase font-black tracking-[0.2em]">
                            Aguardando Tráfego de Mensagens...
                          </td>
                        </tr>
                      ) : (
                        waLogs.map((log) => (
                          <tr key={log.id} className="border-b border-zinc-900 relative group">
                            <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                            </td>
                            <td className="px-4 py-3 text-zinc-200 font-bold">{log.to}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase ${
                                log.type === "otp" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-400"
                              }`}>
                                {log.type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${log.status === "success" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`}></div>
                                <span className={`font-black uppercase tracking-tighter ${log.status === "success" ? "text-emerald-500" : "text-red-500"}`}>
                                  {log.status === "success" ? "SENT" : "FAIL"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-zinc-600 truncate max-w-[200px]" title={log.message}>
                              {log.message}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/**************** TAB 8: DIGITAL CONTRACTS MANAGEMENT ****************/}
      {activeTab === "contracts" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* LEFT: Existing Contracts List */}
            <div className="xl:col-span-4 space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                       <FileText className="w-4 h-4 text-amber-500" /> Versões do Contrato
                    </h3>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Histórico de termos vigentes</p>
                  </div>
                  <button 
                    onClick={() => setIsCreatingContract(true)}
                    className="p-2 bg-amber-500 text-zinc-950 rounded-xl hover:bg-amber-400 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {contracts.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600 uppercase font-black text-[10px] tracking-widest border-2 border-dashed border-zinc-800 rounded-2xl">
                      Nenhum contrato criado
                    </div>
                  ) : (
                    contracts.map((c) => (
                      <div 
                        key={c.id} 
                        className={`p-4 rounded-2xl border transition-all ${
                          c.active ? "bg-amber-500/5 border-amber-500/40" : "bg-zinc-950 border-zinc-900 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Versão {c.version}.0</span>
                          <div className="flex items-center gap-2">
                            {c.active && (
                              <span className="text-[8px] bg-emerald-500 text-zinc-950 font-black px-1.5 py-0.5 rounded uppercase">Ativo</span>
                            )}
                            <button 
                              onClick={() => handleToggleContractStatus(c)}
                              className="p-1.5 bg-zinc-900 text-zinc-400 rounded-lg hover:text-white transition"
                            >
                              {c.active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 mb-3 truncate">{c.content.substring(0, 50)}...</p>
                        <div className="flex items-center justify-between text-[8px] font-mono text-zinc-600 uppercase">
                          <span>📅 {new Date(c.createdAt).toLocaleDateString()}</span>
                          <span>👤 {c.createdBy === "admin" ? "SISTEMA" : "DIRETORIA"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Acceptance Logs & Creation Form */}
            <div className="xl:col-span-8 space-y-6">
              
              {isCreatingContract ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5 animate-slide-up">
                  <div className="flex items-center justify-between border-b border-zinc-805 pb-4">
                    <div>
                      <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2 font-mono">
                        <Edit3 className="w-4 h-4 text-amber-500" /> Publicar Nova Versão (V.{contracts.length + 1}.0)
                      </h3>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Atenção: A publicação bloqueará motoristas até novo aceite.</p>
                    </div>
                    <button 
                      onClick={() => setIsCreatingContract(false)}
                      className="text-zinc-500 hover:text-zinc-300 transition"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-2">Conteúdo do Contrato (Markdown Suportado)</label>
                      <textarea
                        value={newContractContent}
                        onChange={(e) => setNewContractContent(e.target.value)}
                        placeholder="Insira as cláusulas do contrato aqui..."
                        className="w-full h-[300px] bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-300 outline-none focus:border-amber-500 transition-all font-mono resize-none"
                      />
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => setIsCreatingContract(false)}
                        className="flex-1 py-3.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 font-bold uppercase text-[10px] tracking-wider rounded-2xl transition"
                      >
                        Descartar Edição
                      </button>
                      <button
                        onClick={handleCreateNewContract}
                        className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase text-[10px] tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" /> Publicar e Aplicar Agora
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-500" /> Auditoria de Aceites Digitais
                      </h3>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Histórico de assinaturas digitais por motorista</p>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-mono text-zinc-500 uppercase">
                      Total: {acceptances.length} registros
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-inner shadow-black/40">
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-[10px] text-left border-collapse">
                        <thead className="bg-zinc-900/80 sticky top-0 backdrop-blur-sm">
                          <tr>
                            <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Timestamp</th>
                            <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Motorista</th>
                            <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Versão</th>
                            <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">IP Local</th>
                            <th className="px-4 py-3 text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Validação</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {acceptances.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-16 text-center text-zinc-700 uppercase font-black tracking-[0.2em]">
                                Nenhum aceite registrado ainda...
                              </td>
                            </tr>
                          ) : (
                            acceptances.map((acc) => {
                              const drv = drivers.find(d => d.id === acc.userId);
                              return (
                                <tr key={acc.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition">
                                  <td className="px-4 py-3 text-zinc-500">
                                    {new Date(acc.acceptedAt).toLocaleString("pt-BR")}
                                  </td>
                                  <td className="px-4 py-3 text-zinc-100 font-bold uppercase truncate max-w-[150px]">
                                    {drv?.name || "ID: " + acc.userId.substring(0, 8)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="bg-zinc-900 text-amber-500 px-2 py-0.5 rounded border border-zinc-800 font-black">
                                      V.{acc.contractVersion}.0
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-500">{acc.ip}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-emerald-500 font-black uppercase">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span className="text-[8px]">Verificado</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/**************** TAB 9: FINANCE & PIX CENTRAL ****************/}
      {activeTab === "finance" && (
        <div className="space-y-6 animate-fade-in">
          {/* Statistics summary row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Recargas Pendentes</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                <h3 className="text-2xl font-black font-mono text-zinc-100">
                  R$ {financialTransactions.filter(t => t.status === "pendente").reduce((acc, t) => acc + t.amount, 0).toFixed(2)}
                </h3>
              </div>
              <p className="text-[9px] text-zinc-500">{financialTransactions.filter(t => t.status === "pendente").length} solicitações aguardando</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Total Confirmado</span>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-2xl font-black font-mono text-emerald-400">
                  R$ {financialTransactions.filter(t => t.status === "confirmado").reduce((acc, t) => acc + t.amount, 0).toFixed(2)}
                </h3>
              </div>
              <p className="text-[9px] text-zinc-500">Volume total de entrada PIX</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Saldo Motoristas</span>
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-amber-500 text-opacity-50" />
                <h3 className="text-2xl font-black font-mono text-zinc-100">
                  R$ {drivers.reduce((acc, d) => acc + (d.creditsBalance || 0), 0).toFixed(2)}
                </h3>
              </div>
              <p className="text-[9px] text-zinc-500">Créditos em posse dos condutores</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Saldo Passageiros</span>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-500 text-opacity-50" />
                <h3 className="text-2xl font-black font-mono text-zinc-100">
                  R$ {clients.reduce((acc, c) => acc + (c.creditsBalance || 0), 0).toFixed(2)}
                </h3>
              </div>
              <p className="text-[9px] text-zinc-500">Carteira digital dos clientes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: PIX CONFIG & STATISTICS */}
            <div className="lg:col-span-4 space-y-6">
              {/* WALLET SUMMARY */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400" /> Balanços de Motoristas
                </h3>
                
                <div className="space-y-3">
                  <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-850 flex justify-between items-center">
                    <span className="text-[10px] font-black text-zinc-500 uppercase">Total em Créditos</span>
                    <span className="text-sm font-black text-amber-500 font-mono">R$ {drivers.reduce((acc, d) => acc + (d.creditsBalance || 0), 0).toFixed(2)}</span>
                  </div>
                  <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-850 flex justify-between items-center">
                    <span className="text-[10px] font-black text-zinc-500 uppercase">Total Ganhos Sacaíveis</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">R$ {drivers.reduce((acc, d) => acc + (d.earningsBalance || 0), 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* PIX CONFIGURATION CARD */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <QrCode className="w-24 h-24 text-amber-500" />
                </div>
                
                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-amber-500" /> Configuração PIX Central
                  </h3>
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Defina os dados de recebimento do Vouali</p>
                </div>

                <form onSubmit={handleSavePixSettings} className="space-y-4 relative z-10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 px-2 tracking-widest">Tipo de Chave</label>
                      <select 
                        value={pixKeyType}
                        onChange={(e) => setPixKeyType(e.target.value as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-300 outline-none focus:border-amber-500 transition-all font-bold uppercase"
                      >
                        <option value="CPF">CPF</option>
                        <option value="CNPJ">CNPJ</option>
                        <option value="EMAIL">Email</option>
                        <option value="PHONE">Telefone</option>
                        <option value="EVP">Chave Aleatória</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <label className="text-[10px] font-black uppercase text-zinc-500 px-2 tracking-widest">Status</label>
                      <button
                        type="button"
                        onClick={() => setPixActive(!pixActive)}
                        className={`w-full py-2.5 rounded-xl border font-black uppercase text-[10px] transition-all flex items-center justify-center gap-2 ${
                          pixActive 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                            : "bg-red-500/10 border-red-500/30 text-red-400"
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${pixActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                        {pixActive ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-500 px-2 tracking-widest">Chave PIX</label>
                    <input 
                      type="text"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder="Identificador da chave"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-500 px-2 tracking-widest">Nome do Recebedor (Plataforma)</label>
                    <input 
                      type="text"
                      value={pixReceiverName}
                      onChange={(e) => setPixReceiverName(e.target.value)}
                      placeholder="Nome oficial da conta"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all font-bold uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 px-2 tracking-widest">Cidade</label>
                      <input 
                        type="text"
                        value={pixCity}
                        onChange={(e) => setPixCity(e.target.value)}
                        placeholder="Ex: Salvador"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 px-2 tracking-widest">Banco</label>
                      <input 
                        type="text"
                        value={pixBank}
                        onChange={(e) => setPixBank(e.target.value)}
                        placeholder="Nome da Instituição"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-500 px-2 tracking-widest">Descrição das Recargas</label>
                    <input 
                      type="text"
                      value={pixDescription}
                      onChange={(e) => setPixDescription(e.target.value)}
                      placeholder="Mensagem no extrato"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all uppercase"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase text-[10px] tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 mt-2"
                  >
                    <Save className="w-4 h-4" /> Salvar Configuração PIX
                  </button>

                  {configSuccess && (
                    <div className="flex items-center justify-center gap-2 text-emerald-400 text-[10px] font-black uppercase animate-bounce pt-2">
                       <CheckCircle2 className="w-3.5 h-3.5" /> Atualizado com Sucesso!
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* TRANSACTIONS AUDIT TABLE */}
            <div className="lg:col-span-8 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-500" /> Fluxo de Transações PIX
                  </h3>
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Histórico de solicitações de recarga e depósitos</p>
                </div>
                <div className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-850 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                   <span className="text-[9px] font-mono font-black text-amber-500 uppercase">{financialTransactions.filter(t => t.status === 'pendente').length} Pendentes</span>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-900/80 sticky top-0 backdrop-blur-sm z-30">
                      <tr>
                        <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Usuário / Data</th>
                        <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Destino</th>
                        <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Valor</th>
                        <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850 text-center">Status</th>
                        <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850 text-right">Gerência</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-[10px]">
                      {financialTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-24 text-center text-zinc-700 uppercase font-black tracking-[0.34em] italic opacity-40">
                            Nenhuma movimentação financeira detectada...
                          </td>
                        </tr>
                      ) : (
                        financialTransactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-zinc-900 group hover:bg-zinc-900/30 transition shadow-inner">
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="text-zinc-100 font-black uppercase tracking-tight text-[11px] truncate max-w-[150px]">{tx.userName}</span>
                                <span className="text-zinc-500 text-[8px]">{new Date(tx.timestamp).toLocaleString("pt-BR")}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-1">
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded w-fit border ${
                                  tx.userRole === "driver" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                }`}>
                                  {tx.userRole === "driver" ? "Motorista" : "Passageiro"}
                                </span>
                                <span className="text-zinc-650 text-[8px] font-mono text-zinc-600">TX: {tx.id.slice(-8).toUpperCase()}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-zinc-100 font-black text-xs">R$ {tx.amount.toFixed(2)}</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex justify-center">
                                <span className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase border leading-none ${
                                  tx.status === "confirmado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                  tx.status === "pendente" ? "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]" :
                                  "bg-zinc-800/50 text-zinc-600 border-zinc-700/30"
                                }`}>
                                  {tx.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              {tx.status === "pendente" ? (
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleCancelTransaction(tx)}
                                    className="p-2.5 bg-zinc-900 hover:bg-red-500/20 text-zinc-600 hover:text-red-400 border border-zinc-800 rounded-xl transition-all"
                                    title="Cancelar Transação"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleApproveTransaction(tx)}
                                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black uppercase text-[10px] rounded-xl transition shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                                  >
                                    <CheckCircle2 className="w-4 h-4" /> Confirmar
                                  </button>
                                </div>
                              ) : tx.status === "confirmado" ? (
                                <div className="flex flex-col items-end gap-0.5 pointer-events-none select-none">
                                  <div className="flex items-center gap-1.5 text-emerald-500/60 font-black uppercase text-[9px]">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Compensado</span>
                                  </div>
                                  <span className="text-[7px] text-zinc-650 font-mono text-zinc-600">CONF: {tx.confirmedBy?.substring(0,6)}</span>
                                </div>
                              ) : (
                                <span className="text-[9px] text-zinc-700 font-black uppercase italic tracking-widest select-none">Cancelado</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* WITHDRAWAL REQUESTS SECTION */}
              <div className="pt-6 border-t border-zinc-800 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" /> Solicitações de Saque (Drivers)
                    </h3>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Aprovação de pagamentos via PIX para motoristas</p>
                  </div>
                  <div className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-850 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-mono font-black text-emerald-500 uppercase">{withdrawals.filter(w => w.status === 'pendente').length} Pendentes</span>
                  </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-zinc-900/80 sticky top-0 backdrop-blur-sm z-30">
                        <tr>
                          <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Motorista / Data</th>
                          <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Chave PIX</th>
                          <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850">Valor</th>
                          <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850 text-center">Status</th>
                          <th className="px-5 py-4 text-[9px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-850 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-[10px]">
                        {withdrawals.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-16 text-center text-zinc-700 uppercase font-black tracking-widest italic opacity-40">
                              Nenhuma solicitação de saque...
                            </td>
                          </tr>
                        ) : (
                          withdrawals.map((w) => (
                            <tr key={w.id} className="border-b border-zinc-900 hover:bg-zinc-900/30 transition">
                              <td className="px-5 py-4 text-zinc-100">
                                <div className="flex flex-col">
                                  <span className="font-black uppercase">{w.driverName}</span>
                                  <span className="text-zinc-500 text-[8px]">{new Date(w.timestamp).toLocaleString("pt-BR")}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-zinc-300">
                                <div className="flex flex-col">
                                  <span className="truncate max-w-[120px]">{w.pixChave}</span>
                                  <span className="text-[7px] text-zinc-650 opacity-50 uppercase">{w.pixTipoChave}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 font-black">R$ {w.amount.toFixed(2)}</td>
                              <td className="px-5 py-4 text-center">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                  w.status === "aprovado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                  w.status === "rejeitado" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                  "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse"
                                }`}>
                                  {w.status}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right">
                                {w.status === "pendente" && (
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => handleRejectWithdrawal(w)}
                                      className="p-2 border border-zinc-800 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-500 transition-all"
                                      title="Rejeitar Saque"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleApproveWithdrawal(w)}
                                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black uppercase text-[9px] rounded-lg shadow-lg shadow-emerald-500/10 transition-all"
                                    >
                                      Pagar
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/**************** TAB 10: SUPPORT & AI MANAGEMENT ****************/}
      {activeTab === "support" && (
        <div className="flex-1 min-h-[600px] flex flex-col p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="relative">
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-12 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
              <h2 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4 uppercase">
                <Headset className="w-10 h-10 text-amber-500" />
                Central de Suporte
              </h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-black mt-2">Inteligência Artificial • Gestão de Incidentes • Vouali Assist</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0">
            <SupportAdminManager currentUser={currentUser} />
          </div>
        </div>
      )}

      {/**************** TAB: ANTI-FRAUD MONITORING ****************/}
      {activeTab === "antifraud" && (
        <div className="space-y-6 animate-fade-in p-2 md:p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* FRAUD SETTINGS */}
            <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Sliders className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-black uppercase text-zinc-100">Regras de Proteção</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nível de Rigor</label>
                  <select 
                    value={settings.antiFraud?.nivelAntifraude || "medio"}
                    onChange={(e) => onUpdateSettings({ ...settings, antiFraud: { ...(settings.antiFraud || { nivelAntifraude: "medio", bloqueioAutomatico: false, tempoLimiteInicio: 10, raioCancelamentoSuspeito: 500 }), nivelAntifraude: e.target.value as any } })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 outline-none focus:border-red-500 transition"
                  >
                    <option value="baixo">Rigor Baixo (Sugestão)</option>
                    <option value="medio">Rigor Médio (Alerta)</option>
                    <option value="alto">Rigor Alto (Bloqueio)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tempo Limite Início (Minutos)</label>
                  <input 
                    type="number"
                    value={settings.antiFraud?.tempoLimiteInicio || 10}
                    onChange={(e) => onUpdateSettings({ ...settings, antiFraud: { ...(settings.antiFraud || { nivelAntifraude: "medio", bloqueioAutomatico: false, tempoLimiteInicio: 10, raioCancelamentoSuspeito: 500 }), tempoLimiteInicio: parseInt(e.target.value) } })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 outline-none focus:border-red-500 transition"
                  />
                  <p className="text-[9px] text-zinc-500 italic">Tempo após "Cheguei" para cancelar por timeout.</p>
                </div>

                <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Bloqueio Automático</span>
                  <input 
                    type="checkbox"
                    checked={settings.antiFraud?.bloqueioAutomatico || false}
                    onChange={(e) => onUpdateSettings({ ...settings, antiFraud: { ...(settings.antiFraud || { nivelAntifraude: "medio", bloqueioAutomatico: false, tempoLimiteInicio: 10, raioCancelamentoSuspeito: 500 }), bloqueioAutomatico: e.target.checked } })}
                    className="accent-red-500 h-4 w-4 cursor-pointer"
                  />
                </div>

                <button 
                  onClick={() => { setConfigSuccess(true); setTimeout(() => setConfigSuccess(false), 2000); }}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-red-600/20 cursor-pointer"
                >
                  Salvar Regras
                </button>
              </div>
            </div>

            {/* SUSPICIOUS RIDES */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <h3 className="text-sm font-black uppercase text-zinc-100">Ocorrências Suspeitas</h3>
                </div>
                <span className="text-[9px] font-black font-mono text-red-500">{rides.filter(r => r.fraudSuspected).length} Incidentes</span>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                 <table className="w-full text-zinc-300 text-[11px] text-left">
                   <thead>
                     <tr className="text-zinc-500 border-b border-zinc-800 uppercase font-black tracking-widest text-[8px]">
                       <th className="pb-2 px-1">Ride</th>
                       <th className="pb-2 px-1">Motorista</th>
                       <th className="pb-2 px-1 text-center">Tipo</th>
                       <th className="pb-2 px-1 text-right">Ver</th>
                     </tr>
                   </thead>
                   <tbody>
                     {rides.filter(r => r.fraudSuspected).map(ride => (
                       <tr key={ride.id} className="border-b border-zinc-900 hover:bg-red-500/5 transition">
                         <td className="py-3 px-1">
                           <span className="block font-black">#{ride.id.substring(0,4)}</span>
                           <span className="text-[8px] text-zinc-600">{new Date(ride.timestamp).toLocaleDateString()}</span>
                         </td>
                         <td className="py-3 px-1">
                           <span className="block font-bold">{ride.driverName}</span>
                           <span className="text-[8px] text-zinc-600">R$ {drivers.find(d => d.id === ride.driverId)?.creditsBalance?.toFixed(2)}</span>
                         </td>
                         <td className="py-3 px-1 text-center">
                            <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-1 py-0.5 rounded text-[8px] font-black uppercase">
                              {ride.fraudType}
                            </span>
                         </td>
                         <td className="py-3 px-1 text-right">
                            <button className="p-1 px-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 rounded-lg cursor-pointer">
                               <MapPin className="w-3 h-3" />
                            </button>
                         </td>
                       </tr>
                     ))}
                     {rides.filter(r => r.fraudSuspected).length === 0 && (
                       <tr>
                         <td colSpan={4} className="py-12 text-center text-zinc-700 italic font-mono uppercase tracking-widest opacity-40">Nenhuma irregularidade detectada</td>
                       </tr>
                     )}
                   </tbody>
                 </table>
              </div>
            </div>
          </div>

          {/* FINANCIAL PROTECTIONS BOXES */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4">
             <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
               <Wallet className="w-5 h-5 text-emerald-500" />
               <h3 className="text-sm font-black uppercase text-zinc-100">Reservas Ativas (Garantia PIX)</h3>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {rides.filter(r => r.status === "em_andamento" && r.reservedFee).map(ride => (
                  <div key={ride.id} className="bg-zinc-950 border border-zinc-800 p-3 rounded-2xl relative">
                     <span className="text-[8px] text-zinc-600 font-black block uppercase">Ride #{ride.id.substring(0,4)}</span>
                     <span className="text-emerald-400 font-mono font-black text-xs">R$ {ride.reservedFee?.toFixed(2)}</span>
                     <div className="mt-1 text-[8px] text-zinc-500 truncate">{ride.driverName}</div>
                  </div>
                ))}
                {rides.filter(r => r.status === "em_andamento" && r.reservedFee).length === 0 && (
                   <div className="col-span-full py-6 text-center text-zinc-700 text-[10px] font-bold uppercase opacity-30 italic">Nenhum saldo retido no radar financeiro.</div>
                )}
             </div>
          </div>
        </div>
      )}

      {/**************** TAB: SOCIAL LOGIN CONFIGURATION ****************/}
      {activeTab === "social" && (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-805 pb-5">
              <div>
                <h3 className="text-lg font-black uppercase text-zinc-100 flex items-center gap-2">
                  <Chrome className="w-6 h-6 text-amber-500" /> Gerenciamento de Login Social
                </h3>
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Configure as APIs de autenticação externa para seus usuários</p>
              </div>
              {configSuccess && (
                <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase animate-bounce">
                  <CheckCircle2 className="w-4 h-4" /> Configurações Salvas!
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSocialLogin} className="space-y-8">
              {/* GOOGLE CONFIG */}
              <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-850 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                      <Chrome className="w-5 h-5 text-zinc-100" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-zinc-100">Google Cloud Console</h4>
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${socialGoogle.active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">{socialGoogle.status}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSocialGoogle({ ...socialGoogle, active: !socialGoogle.active, status: !socialGoogle.active ? "ativo" : "desativado" })}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      socialGoogle.active ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                    }`}
                  >
                    {socialGoogle.active ? "Habilitado" : "Desabilitado"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Client ID</label>
                    <input
                      type="text"
                      value={socialGoogle.clientId || ""}
                      onChange={(e) => setSocialGoogle({ ...socialGoogle, clientId: e.target.value, configured: !!e.target.value })}
                      placeholder="000000000000-xxxx.apps.googleusercontent.com"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Client Secret</label>
                    <input
                      type="password"
                      value={socialGoogle.clientSecret || ""}
                      onChange={(e) => setSocialGoogle({ ...socialGoogle, clientSecret: e.target.value })}
                      placeholder="••••••••••••••••"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* FACEBOOK CONFIG */}
              <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-850 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/10 rounded-xl border border-blue-600/20">
                      <Facebook className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-zinc-100">Meta for Developers (Facebook)</h4>
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${socialFacebook.active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">{socialFacebook.status}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSocialFacebook({ ...socialFacebook, active: !socialFacebook.active, status: !socialFacebook.active ? "ativo" : "desativado" })}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      socialFacebook.active ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                    }`}
                  >
                    {socialFacebook.active ? "Habilitado" : "Desabilitado"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">App ID</label>
                    <input
                      type="text"
                      value={socialFacebook.appId || ""}
                      onChange={(e) => setSocialFacebook({ ...socialFacebook, appId: e.target.value, configured: !!e.target.value })}
                      placeholder="123456789012345"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">App Secret</label>
                    <input
                      type="password"
                      value={socialFacebook.clientSecret || ""}
                      onChange={(e) => setSocialFacebook({ ...socialFacebook, clientSecret: e.target.value })}
                      placeholder="••••••••••••••••"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* INSTAGRAM CONFIG */}
              <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-850 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-600/10 rounded-xl border border-pink-600/20">
                      <Instagram className="w-5 h-5 text-pink-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-zinc-100">Instagram API</h4>
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${socialInstagram.active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">{socialInstagram.status}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSocialInstagram({ ...socialInstagram, active: !socialInstagram.active, status: !socialInstagram.active ? "ativo" : "desativado" })}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      socialInstagram.active ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                    }`}
                  >
                    {socialInstagram.active ? "Habilitado" : "Desabilitado"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Client ID</label>
                    <input
                      type="text"
                      value={socialInstagram.clientId || ""}
                      onChange={(e) => setSocialInstagram({ ...socialInstagram, clientId: e.target.value, configured: !!e.target.value })}
                      placeholder="IG-xxxx-xxxx"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Redirect URL</label>
                    <input
                      type="text"
                      value={socialInstagram.redirectUrl || ""}
                      onChange={(e) => setSocialInstagram({ ...socialInstagram, redirectUrl: e.target.value })}
                      placeholder="https://vouali.app/auth/instagram"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase text-xs tracking-[0.2em] rounded-3xl transition shadow-2xl shadow-amber-500/20 active:scale-[0.98]"
              >
                Salvar Configurações de Login Social
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Customizado de Confirmação */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <h3 className="text-sm font-black uppercase text-zinc-100 tracking-tight">{confirmModal.title}</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 font-bold rounded-xl text-[10px] uppercase tracking-widest transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl text-[10px] uppercase tracking-widest transition cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Customizado de Prompt */}
      {promptModal && promptModal.isOpen && (
        <PromptModalInner promptModal={promptModal} onClose={() => setPromptModal(null)} />
      )}
    </div>
  );
}

// Componente Auxiliar para o Prompt Customizado (Substituto para o prompt nativo)
const PromptModalInner = ({ promptModal, onClose }: { promptModal: any, onClose: () => void }) => {
  const [val, setVal] = useState("");
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <h3 className="text-sm font-black uppercase text-zinc-100 tracking-tight text-center">{promptModal.title}</h3>
        <p className="text-[11px] text-zinc-400 text-center leading-relaxed">{promptModal.message}</p>
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Digite o motivo..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-xs text-zinc-100 outline-none focus:border-amber-500 transition-all placeholder:text-zinc-600"
        />
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 font-bold rounded-xl text-[10px] uppercase tracking-widest transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (val.trim() !== "") {
                await promptModal.onConfirm(val);
                onClose();
              }
            }}
            disabled={!val.trim()}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black rounded-xl text-[10px] uppercase tracking-widest transition cursor-pointer"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
