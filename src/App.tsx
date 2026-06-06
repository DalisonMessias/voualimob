import { useState, useEffect } from "react";
import { AppSettings, ClientProfile, MototaxistaProfile, RideRequestItem, StatusCorrida, CreditTransaction } from "./types";
import RoleSelector from "./components/RoleSelector";
import ClientDashboard from "./components/ClientDashboard";
import DriverDashboard from "./components/DriverDashboard";
import AdminDashboard from "./components/AdminDashboard";
import PushNotificationManager from "./components/PushNotificationManager";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { Analytics } from "@vercel/analytics/react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bike, 
  User, 
  HelpCircle, 
  Sparkles, 
  LogOut, 
  RefreshCw,
  Clock,
  ShieldCheck,
  Navigation
} from "lucide-react";
import { generateNearbyDrivers } from "./utils/simulation";
import { processRideFinancials } from "./lib/finances";

// Firebase Auth & Supabase Client
import { auth } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { supabase } from "./lib/supabase";

const DEFAULT_SETTINGS: AppSettings = {
  taxaSaida: 5.0,        // Base starting fee (R$)
  valorKm: 2.0,          // Distance rate (R$)
  raioCobranca: 3.5,     // Delivery radius limit (KM)
  apiKeyValue: "",       // OpenRouteService developer personal key
  percentPlataforma: 10,  // Platform fee commission percent (10%)
  taxaMinima: 1.0,       // Minimum platform commission deduction (R$ 1.00)
  taxaMaxima: 10.0,      // Maximum platform commission deduction (R$ 10.00)
  saldoMinimoOnline: 5.0, // Minimum credits balance required to be online (R$ 5.00)
  descontosAtivos: true,  // Automatically discount fee upon ride completion
  regrasCobrancaDescricao: "Cobrança de 10% por corrida concluída. Mínimo de R$ 1,00 e máximo de R$ 10,00 descontados automaticamente da carteira de créditos do motorista.",
  adminEmail: "dalison.messias@outlook.com",
  adminPassword: "102192",
  valorMinutoEspera: 0.5,
  minutosGratisEspera: 5,
  valorMinimoEspera: 2.0,
  limiteEsperaMinutos: 30,
  maxParadas: 3,
  pixSettings: {
    chave: "financeiro@vouali.com",
    tipoChave: "EMAIL",
    nomeRecebedor: "VOUALI TECH",
    cidade: "SALVADOR",
    banco: "INTER",
    descricao: "RECARGA SALDO VOUALI",
    ativo: true
  },
  branding: {
    logoUrl: "",
    logoDarkUrl: "",
    logoLightUrl: "",
    faviconUrl: "",
    splashUrl: "",
    institutionalImgUrl: "",
    colorPrimary: "#f59e0b",
    colorSecondary: "#d97706",
    colorAccent: "#10b981",
    colorButton: "#f59e0b",
    colorNavbar: "#09090b",
    colorCard: "#181c24",
    colorDarkThemeHex: "#09090b",
    colorPremium: "#f59e0b",
    themeMode: "dark",
    title: "Vouali",
    slogan: "Vouali e chego bem",
    history: []
  },
  socialLogin: {
    google: { active: false, configured: false, status: "desativado" },
    facebook: { active: false, configured: false, status: "desativado" },
    instagram: { active: false, configured: false, status: "desativado" }
  }
};

export default function App() {
  const [socket, setSocket] = useState<any>(null);

  // Auth & Session States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Admin route / credentials auth state
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => {
    return sessionStorage.getItem("vouali_admin_authenticated") === "true";
  });
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // Global platforms views navigator: Client vs Driver
  const [currentRole, setCurrentRole] = useState<"client" | "driver" | "admin" | null>(null);

  // Active accounts profiles definition from Firestore
  const [activeClient, setActiveClient] = useState<ClientProfile | null>(null);
  const [activeDriver, setActiveDriver] = useState<MototaxistaProfile | null>(null);

  // Core settings configuration
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Trip histories and active booking operations in Firestore
  const [history, setHistory] = useState<RideRequestItem[]>([]);
  const [activeRequest, setActiveRequest] = useState<RideRequestItem | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);

  // Real Active Taxi Drivers online in the system
  const [staticDrivers, setStaticDrivers] = useState<MototaxistaProfile[]>([]);

  // Sound generator simulator using browser Audio API
  const playRingtone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const now = audioCtx.currentTime;
      playTone(587.33, now, 0.15); // D5
      playTone(659.25, now + 0.18, 0.15); // E5
      playTone(880, now + 0.36, 0.25); // A5
    } catch (err) {
      console.error("Audio block:", err);
    }
  };

  // 0. Synchronize General Application Settings from Supabase in Real-time
  useEffect(() => {
    // 1. Consulta inicial das configurações
    supabase
      .from('settings')
      .select('data')
      .eq('id', 'global')
      .single()
      .then(async ({ data, error }) => {
        if (data) {
          setSettings(data.data as AppSettings);
        } else {
          try {
            await supabase
              .from('settings')
              .upsert({ id: 'global', data: DEFAULT_SETTINGS });
            setSettings(DEFAULT_SETTINGS);
          } catch (e) {
            console.warn("Could not write default settings to Supabase:", e);
          }
        }
      });

    // 2. Ouvinte realtime do Supabase para alterações nas configurações
    const settingsChannel = supabase.channel('global_settings_sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
          filter: 'id=eq.global'
        },
        (payload) => {
          if (payload.new) {
            setSettings(payload.new.data as AppSettings);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  // Real-time Visual Branding Application Engine
  useEffect(() => {
    if (!settings.branding) return;

    const b = settings.branding;
    const root = document.documentElement;

    // Apply Colors to CSS Variables (matching the names defined in index.css)
    if (b.colorPrimary) {
      root.style.setProperty('--brand-primary', b.colorPrimary);
      // Derive dark/light variants or just assign them
      root.style.setProperty('--brand-primary-dark', b.colorSecondary || b.colorPrimary);
      root.style.setProperty('--brand-primary-light', b.colorPrimary + "33"); // 20% opacity
    }
    if (b.colorAccent) root.style.setProperty('--brand-accent', b.colorAccent);
    if (b.colorButton) root.style.setProperty('--brand-button', b.colorButton || b.colorPrimary);
    if (b.colorNavbar) root.style.setProperty('--brand-navbar', b.colorNavbar);
    if (b.colorCard) root.style.setProperty('--brand-card', b.colorCard);
    if (b.colorDarkThemeHex) root.style.setProperty('--brand-bg', b.colorDarkThemeHex);
    if (b.colorPremium) root.style.setProperty('--brand-premium', b.colorPremium || b.colorPrimary);

    // Apply Document Metadata & Identity
    if (b.title) {
      document.title = b.title;
    }
    
    // Dynamic Favicon Update
    if (b.faviconUrl) {
      const links = document.querySelectorAll("link[rel*='icon']");
      if (links.length > 0) {
        links.forEach(link => {
          (link as HTMLLinkElement).href = b.faviconUrl!;
        });
      } else {
        const link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = b.faviconUrl;
        document.getElementsByTagName('head')[0].appendChild(link);
      }
    }

    // Theme Mode handling (Adding/Removing .dark class for Tailwind)
    const handleThemeChange = (mode: string) => {
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.style.backgroundColor = b.colorDarkThemeHex || '#09090b';
      } else if (mode === 'light') {
        document.documentElement.classList.remove('dark');
        document.body.style.backgroundColor = '#ffffff';
      } else {
        // Auto detection based on system preference
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.body.style.backgroundColor = b.colorDarkThemeHex || '#09090b';
        } else {
          document.documentElement.classList.remove('dark');
          document.body.style.backgroundColor = '#ffffff';
        }
      }
    };
    handleThemeChange(b.themeMode || 'dark');

  }, [settings.branding]);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const checkRouteAndParams = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      const params = new URLSearchParams(search);

      // Deep link action handling (from PWA shortcuts or Push Notifications)
      const action = params.get("action");
      const rideId = params.get("rideId");

      if (action === "accept" && rideId) {
        console.log("[App] Deep-link Accept Ride:", rideId);
        // This will be handled once driver profile is loaded
      }

      if (action === "go_online") {
        console.log("[App] Deep-link Go Online");
      }

      const isParam = search.includes("admin") || search.includes("role=admin");
      const isPath = path === "/admin" || path.endsWith("/admin");
      const isHash = hash === "#/admin" || hash === "#admin" || hash.includes("admin");
      const yesAdmin = isPath || isHash || isParam;
      
      setIsAdminRoute(yesAdmin);
      if (yesAdmin) {
        const isAuth = sessionStorage.getItem("vouali_admin_authenticated") === "true";
        if (isAuth) {
          setCurrentRole("admin");
        }
      }
    };

    checkRouteAndParams();
    window.addEventListener("popstate", checkRouteAndParams);
    window.addEventListener("hashchange", checkRouteAndParams);
    return () => {
      window.removeEventListener("popstate", checkRouteAndParams);
      window.removeEventListener("hashchange", checkRouteAndParams);
    };
  }, []);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setLoadingProfile(true);
        try {
          // 1. Fetch user role configuration from Supabase
          const { data: userDoc, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.uid)
            .maybeSingle();

          // Hardcoded Admin Bypass (Auto-Role assignment)
          const isAdminEmail = user.email === "contato.ifomee@gmail.com" || user.email === "dalison.messias@outlook.com";

          if (userDoc) {
            const role = userDoc.role as "client" | "driver" | "admin";
            
            if (role === "client") {
              setCurrentRole("client");
              const { data: clientDoc } = await supabase
                .from("clients")
                .select("*")
                .eq("id", user.uid)
                .maybeSingle();
              if (clientDoc) {
                setActiveClient({
                  id: clientDoc.id,
                  name: clientDoc.name,
                  phone: clientDoc.phone,
                  email: clientDoc.email,
                  avatar: clientDoc.avatar_url,
                  blocked: clientDoc.blocked,
                  creditsBalance: Number(clientDoc.credits_balance || 0),
                  creditTransactions: clientDoc.credit_transactions || []
                });
              }
            } else if (role === "driver") {
              setCurrentRole("driver");
              const { data: driverDoc } = await supabase
                .from("drivers")
                .select("*")
                .eq("id", user.uid)
                .maybeSingle();
              if (driverDoc) {
                setActiveDriver({
                  id: driverDoc.id,
                  name: driverDoc.name,
                  phone: driverDoc.phone,
                  email: driverDoc.email,
                  avatar: driverDoc.avatar_url,
                  veiculoModelo: driverDoc.veiculo_modelo,
                  veiculoPlaca: driverDoc.veiculo_placa,
                  veiculoCor: driverDoc.veiculo_cor,
                  cnh: driverDoc.cnh,
                  documentoVeiculo: driverDoc.documento_veiculo,
                  online: driverDoc.online,
                  creditsBalance: Number(driverDoc.credits_balance ?? 50.00),
                  earningsBalance: Number(driverDoc.earnings_balance ?? 0.00),
                  creditTransactions: driverDoc.credit_transactions || [],
                  currentCoords: driverDoc.current_coords || [0, 0],
                  contractAcceptedVersion: driverDoc.contract_accepted_version,
                  contractAcceptedAt: driverDoc.contract_accepted_at,
                  blocked: driverDoc.blocked,
                  docRejectionReason: driverDoc.doc_rejection_reason,
                  veiculoTipo: driverDoc.veiculo_tipo,
                  capacidadePassageiros: driverDoc.capacidade_passageiros,
                  capacidadeCargaKg: driverDoc.capacidade_carga_kg,
                  valorKm: Number(driverDoc.valor_km ?? 2.00),
                  taxaSaida: Number(driverDoc.taxa_saida ?? 5.00),
                  rating: Number(driverDoc.rating ?? 5.00),
                  approved: driverDoc.approved,
                  raioMaximo: Number(driverDoc.raio_maximo ?? 5.00),
                  modalidades: driverDoc.modalidades,
                  pixChave: driverDoc.pix_chave,
                  pixTipoChave: driverDoc.pix_tipo_chave,
                  pixNomeRecebedor: driverDoc.pix_nome_recebedor,
                  pixCidadeRecebedor: driverDoc.pix_cidade_recebedor,
                  acceptsPix: driverDoc.accepts_pix,
                  acceptsCash: driverDoc.accepts_cash,
                  acceptsCard: driverDoc.accepts_card,
                  hasMachine: driverDoc.has_machine,
                  usesTapToPay: driverDoc.uses_tap_to_pay,
                  tapToPayApp: driverDoc.tap_to_pay_app,
                  hasNfcHardware: driverDoc.has_nfc_hardware,
                  cnhUrl: driverDoc.cnh_url,
                  motoDocUrl: driverDoc.moto_doc_url,
                  selfieUrl: driverDoc.selfie_url,
                  createdAt: driverDoc.created_at
                });
              }
            } else {
              setCurrentRole(role);
            }
          } else if (isAdminEmail) {
            // Auto-detect admin by email
            setCurrentRole("admin");
          } else {
            // No profile defined yet, reset roles to force choosing in RoleSelector
            setCurrentRole(null);
            setActiveClient(null);
            setActiveDriver(null);
          }
        } catch (e) {
          console.error("Error loading user from Supabase:", e);
        } finally {
          setLoadingProfile(false);
        }
      } else {
        setCurrentRole(null);
        setActiveClient(null);
        setActiveDriver(null);
        setLoadingProfile(false);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Request notification permissions for drivers
  useEffect(() => {
    if (currentRole === "driver" && "Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  }, [currentRole]);

  // 3. Keep active client / driver history synced from Supabase (Realtime Channel)
  useEffect(() => {
    if (!currentUser || !currentRole || currentRole === "admin") return;

    const loadHistory = async () => {
      const field = currentRole === "client" ? "client_id" : "driver_id";
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq(field, currentUser.uid)
        .order("timestamp", { ascending: false })
        .limit(20);

      if (error) {
        console.warn("Error loading history from Supabase:", error);
        return;
      }

      if (data) {
        const mappedHistory: RideRequestItem[] = data.map((ride: any) => ({
          id: ride.id,
          clientId: ride.client_id,
          clientName: ride.client_name,
          clientPhone: ride.client_phone,
          driverId: ride.driver_id,
          driverName: ride.driver_name,
          driverPhone: ride.driver_phone,
          veiculoModelo: ride.veiculo_modelo,
          veiculoPlaca: ride.veiculo_placa,
          origemLabel: ride.origem_label,
          destinoLabel: ride.destino_label,
          startCoords: ride.start_coords,
          endCoords: ride.end_coords,
          driverCoords: ride.driver_coords,
          geometry: ride.geometry,
          status: ride.status,
          statusPagamento: ride.status_pagamento,
          totalCost: Number(ride.total_cost),
          valorCalculado: Number(ride.valor_calculado),
          distance: Number(ride.distance),
          duration: Number(ride.duration),
          paymentMethod: ride.payment_method,
          timestamp: ride.timestamp,
          arrivedAtOriginAt: ride.arrived_at_origin_at,
          arrivedAtOriginCoords: ride.arrived_at_origin_coords,
          startedAt: ride.started_at,
          startedCoords: ride.started_coords,
          reservedFee: Number(ride.reserved_fee || 0),
          fraudSuspected: ride.fraud_suspected,
          fraudType: ride.fraud_type,
          movementLogs: ride.movement_logs || [],
          waitingLogs: ride.waiting_logs || [],
          waitingTimeCost: Number(ride.waiting_time_cost || 0)
        }));
        setHistory(mappedHistory);
      }
    };

    loadHistory();

    const field = currentRole === "client" ? "client_id" : "driver_id";
    const historyChannel = supabase.channel(`rides_history_${currentUser.uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
          filter: `${field}=eq.${currentUser.uid}`
        },
        () => {
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(historyChannel);
    };
  }, [currentUser, currentRole]);

  // 4. Synchronize Online Drivers list directly from Supabase
  useEffect(() => {
    if (!currentUser) return;

    const loadOnlineDrivers = async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("online", true);

      if (error) {
        console.warn("Error loading online drivers from Supabase:", error);
        return;
      }

      let list: MototaxistaProfile[] = [];
      if (data) {
        list = data.map((driverDoc: any) => ({
          id: driverDoc.id,
          name: driverDoc.name,
          phone: driverDoc.phone,
          email: driverDoc.email,
          avatar: driverDoc.avatar_url,
          veiculoModelo: driverDoc.veiculo_modelo,
          veiculoPlaca: driverDoc.veiculo_placa,
          veiculoCor: driverDoc.veiculo_cor,
          cnh: driverDoc.cnh,
          documentoVeiculo: driverDoc.documento_veiculo,
          online: driverDoc.online,
          creditsBalance: Number(driverDoc.credits_balance ?? 50.00),
          earningsBalance: Number(driverDoc.earnings_balance ?? 0.00),
          creditTransactions: driverDoc.credit_transactions || [],
          currentCoords: driverDoc.current_coords || [0, 0],
          contractAcceptedVersion: driverDoc.contract_accepted_version,
          contractAcceptedAt: driverDoc.contract_accepted_at,
          blocked: driverDoc.blocked,
          docRejectionReason: driverDoc.doc_rejection_reason,
          veiculoTipo: driverDoc.veiculo_tipo,
          capacidadePassageiros: driverDoc.capacidade_passageiros,
          capacidadeCargaKg: driverDoc.capacidade_carga_kg,
          valorKm: Number(driverDoc.valor_km ?? 2.00),
          taxaSaida: Number(driverDoc.taxa_saida ?? 5.00),
          rating: Number(driverDoc.rating ?? 5.00),
          approved: driverDoc.approved,
          raioMaximo: Number(driverDoc.raio_maximo ?? 5.00),
          modalidades: driverDoc.modalidades,
          pixChave: driverDoc.pix_chave,
          pixTipoChave: driverDoc.pix_tipo_chave,
          pixNomeRecebedor: driverDoc.pix_nome_recebedor,
          pixCidadeRecebedor: driverDoc.pix_cidade_recebedor,
          acceptsPix: driverDoc.accepts_pix,
          acceptsCash: driverDoc.accepts_cash,
          acceptsCard: driverDoc.accepts_card,
          hasMachine: driverDoc.has_machine,
          usesTapToPay: driverDoc.uses_tap_to_pay,
          tapToPayApp: driverDoc.tap_to_pay_app,
          hasNfcHardware: driverDoc.has_nfc_hardware,
          cnhUrl: driverDoc.cnh_url,
          motoDocUrl: driverDoc.moto_doc_url,
          selfieUrl: driverDoc.selfie_url,
          createdAt: driverDoc.created_at
        }));
      }

      if (list.length === 0) {
        console.log("Banco de dados vazio: gerando mototaxistas reais de teste no Supabase...");
        const seedDrivers = generateNearbyDrivers([-12.9714, -38.5014], 3);
        const insertedList: MototaxistaProfile[] = [];
        
        for (const drv of seedDrivers) {
          await supabase.from("users").upsert({
            id: drv.id,
            role: "driver"
          });

          await supabase.from("drivers").upsert({
            id: drv.id,
            name: drv.name,
            phone: drv.phone,
            email: drv.email,
            avatar_url: drv.avatar,
            veiculo_modelo: drv.veiculoModelo,
            veiculo_placa: drv.veiculoPlaca,
            veiculo_cor: drv.veiculoCor,
            cnh: drv.cnh,
            documento_veiculo: drv.documentoVeiculo,
            online: drv.online,
            credits_balance: drv.creditsBalance,
            earnings_balance: drv.earningsBalance,
            credit_transactions: drv.creditTransactions,
            current_coords: drv.currentCoords,
            veiculo_tipo: drv.veiculoTipo || "moto",
            capacidade_passageiros: drv.capacidadePassageiros || 1,
            capacidade_carga_kg: drv.capacidadeCargaKg || 0,
            valor_km: drv.valorKm || 2.00,
            taxa_saida: drv.taxaSaida || 5.00,
            rating: drv.rating || 5.00,
            approved: drv.approved || "aprovado",
            raio_maximo: drv.raioMaximo || 5.00,
            modalidades: drv.modalidades || ["moto"]
          });

          await supabase.from("drivers_locations").upsert({
            driver_id: drv.id,
            name: drv.name,
            online: drv.online,
            coords: drv.currentCoords,
            updated_at: new Date().toISOString()
          });

          insertedList.push(drv);
        }
        setStaticDrivers(insertedList);
      } else {
        setStaticDrivers(list);
      }
    };

    loadOnlineDrivers();

    const driversChannel = supabase.channel("online_drivers_sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drivers"
        },
        () => {
          loadOnlineDrivers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driversChannel);
    };
  }, [currentUser]);

  // 5. Active Ride real-time listener from Supabase
  useEffect(() => {
    if (!activeRideId) return;

    const loadActiveRide = async () => {
      const { data: ride, error } = await supabase
        .from("rides")
        .select("*")
        .eq("id", activeRideId)
        .maybeSingle();

      if (error) {
        console.warn("Error loading active ride from Supabase:", error);
        return;
      }

      if (ride) {
        const mappedRide: RideRequestItem = {
          id: ride.id,
          clientId: ride.client_id,
          clientName: ride.client_name,
          clientPhone: ride.client_phone,
          driverId: ride.driver_id,
          driverName: ride.driver_name,
          driverPhone: ride.driver_phone,
          veiculoModelo: ride.veiculo_modelo,
          veiculoPlaca: ride.veiculo_placa,
          origemLabel: ride.origem_label,
          destinoLabel: ride.destino_label,
          startCoords: ride.start_coords,
          endCoords: ride.end_coords,
          driverCoords: ride.driver_coords,
          geometry: ride.geometry,
          status: ride.status,
          statusPagamento: ride.status_pagamento,
          totalCost: Number(ride.total_cost),
          valorCalculado: Number(ride.valor_calculado),
          distance: Number(ride.distance),
          duration: Number(ride.duration),
          paymentMethod: ride.payment_method,
          timestamp: ride.timestamp,
          arrivedAtOriginAt: ride.arrived_at_origin_at,
          arrivedAtOriginCoords: ride.arrived_at_origin_coords,
          startedAt: ride.started_at,
          startedCoords: ride.started_coords,
          reservedFee: Number(ride.reserved_fee || 0),
          fraudSuspected: ride.fraud_suspected,
          fraudType: ride.fraud_type,
          movementLogs: ride.movement_logs || [],
          waitingLogs: ride.waiting_logs || [],
          waitingTimeCost: Number(ride.waiting_time_cost || 0)
        };
        
        setActiveRequest(mappedRide);

        if (ride.status === "cancelado") {
          setActiveRequest(null);
          setActiveRideId(null);
          localStorage.removeItem("vouali_active_ride_id");
        }
      } else {
        setActiveRequest(null);
        setActiveRideId(null);
        localStorage.removeItem("vouali_active_ride_id");
      }
    };

    loadActiveRide();

    const activeRideChannel = supabase.channel(`active_ride_${activeRideId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
          filter: `id=eq.${activeRideId}`
        },
        () => {
          loadActiveRide();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activeRideChannel);
    };
  }, [activeRideId]);

  // Auto-restore active ride ID from cache if page was refreshed
  useEffect(() => {
    const restoredRideId = localStorage.getItem("vouali_active_ride_id");
    if (restoredRideId) {
      setActiveRideId(restoredRideId);
    }
  }, []);

  // Sync active driver online coordinate updates into Supabase (drivers & drivers_locations)
  useEffect(() => {
    if (currentRole !== "driver" || !activeDriver || !activeDriver.online) return;

    const syncLocation = async () => {
      const timestamp = new Date().toISOString();
      
      await supabase
        .from("drivers")
        .update({
          current_coords: activeDriver.currentCoords
        })
        .eq("id", activeDriver.id);

      await supabase
        .from("drivers_locations")
        .upsert({
          driver_id: activeDriver.id,
          name: activeDriver.name,
          online: activeDriver.online,
          coords: activeDriver.currentCoords,
          updated_at: timestamp
        });
    };

    syncLocation().catch(e => console.error("Error writing live coordinate to Supabase:", e));

  }, [activeDriver?.currentCoords, activeDriver?.online, currentRole]);

  // Update client configuration in Supabase
  const handleUpdateClient = async (client: ClientProfile) => {
    setActiveClient(client);
    if (currentUser) {
      await supabase
        .from("clients")
        .upsert({
          id: currentUser.uid,
          name: client.name,
          phone: client.phone,
          email: client.email,
          avatar_url: client.avatar,
          blocked: client.blocked || false,
          credits_balance: client.creditsBalance || 0.00,
          credit_transactions: client.creditTransactions || []
        });
    }
  };

  // Update driver configuration in Supabase
  const handleUpdateDriver = async (driver: MototaxistaProfile) => {
    setActiveDriver(driver);
    if (currentUser) {
      await supabase
        .from("drivers")
        .upsert({
          id: currentUser.uid,
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
          avatar_url: driver.avatar,
          veiculo_modelo: driver.veiculoModelo,
          veiculo_placa: driver.veiculoPlaca,
          veiculo_cor: driver.veiculoCor,
          cnh: driver.cnh,
          documento_veiculo: driver.documentoVeiculo,
          online: driver.online,
          credits_balance: driver.creditsBalance ?? 50.00,
          earnings_balance: driver.earningsBalance ?? 0.00,
          credit_transactions: driver.creditTransactions || [],
          current_coords: driver.currentCoords || [0, 0],
          contract_accepted_version: driver.contractAcceptedVersion,
          contract_accepted_at: driver.contractAcceptedAt,
          blocked: driver.blocked || false,
          doc_rejection_reason: driver.docRejectionReason,
          veiculo_tipo: driver.veiculoTipo || "moto",
          capacidade_passageiros: driver.capacidadePassageiros || 1,
          capacidade_carga_kg: driver.capacidadeCargaKg || 0,
          valor_km: driver.valorKm ?? 2.00,
          taxa_saida: driver.taxaSaida ?? 5.00,
          rating: driver.rating ?? 5.00,
          approved: driver.approved || "pendente",
          raio_maximo: driver.raioMaximo ?? 5.00,
          modalidades: driver.modalidades || ["moto"],
          pix_chave: driver.pixChave,
          pix_tipo_chave: driver.pixTipoChave,
          pix_nome_recebedor: driver.pixNomeRecebedor,
          pix_cidade_recebedor: driver.pixCidadeRecebedor,
          accepts_pix: driver.acceptsPix ?? true,
          accepts_cash: driver.acceptsCash ?? true,
          accepts_card: driver.acceptsCard ?? false,
          has_machine: driver.hasMachine ?? false,
          uses_tap_to_pay: driver.usesTapToPay ?? false,
          tap_to_pay_app: driver.tapToPayApp,
          has_nfc_hardware: driver.hasNfcHardware ?? false,
          cnh_url: driver.cnhUrl,
          moto_doc_url: driver.motoDocUrl,
          selfie_url: driver.selfieUrl
        });
    }
  };

  // Merge nearby drivers
  const getOnlineDrivers = (): MototaxistaProfile[] => {
    const list = [...staticDrivers];
    if (activeDriver && activeDriver.online) {
      // Exclude self if present to prevent double listing
      const filtered = list.filter(d => d.id !== activeDriver.id);
      filtered.push(activeDriver);
      return filtered;
    }
    return list;
  };

  // Dispatch brand new requested ride to Supabase
  const handleRequestRide = async (request: RideRequestItem) => {
    setActiveRequest(request);
    setActiveRideId(request.id);
    localStorage.setItem("vouali_active_ride_id", request.id);

    try {
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from("rides")
        .insert({
          id: request.id,
          client_id: request.clientId,
          client_name: request.clientName,
          client_phone: request.clientPhone,
          driver_id: request.driverId,
          driver_name: request.driverName,
          driver_phone: request.driverPhone,
          veiculo_modelo: request.veiculoModelo,
          veiculo_placa: request.veiculoPlaca,
          origem_label: request.origemLabel,
          destino_label: request.destinoLabel,
          start_coords: request.startCoords,
          end_coords: request.endCoords,
          driver_coords: request.driverCoords,
          geometry: request.geometry,
          status: request.status,
          status_pagamento: request.statusPagamento || "pendente",
          total_cost: request.totalCost,
          valor_calculado: request.valorCalculado,
          distance: request.distance,
          duration: request.duration,
          payment_method: request.paymentMethod,
          timestamp: timestamp
        });

      if (error) throw error;

      playRingtone();

      // Simulated driver step triggers (if booked with a static simulated driver)
      if (request.driverId && request.driverId.startsWith("driver_sim_")) {
        setTimeout(async () => {
          await supabase
            .from("rides")
            .update({
              status: "aceito",
              driver_coords: request.driverCoords || [-38.5014, -12.9714]
            })
            .eq("id", request.id);
          playRingtone();
        }, 2200);
      }
    } catch (err) {
      console.error("Error writing ride into Supabase: ", err);
    }
  };

  // Transition request statuses in Supabase
  const handleProgressRequest = async (nextStatus: StatusCorrida) => {
    if (!activeRequest) return;

    try {
      const updates: any = {
        status: nextStatus,
        driver_coords: activeRequest.driverCoords
      };

      // REGISTRAR CHEGADA (CHEGUEI)
      if (nextStatus === "a_caminho") {
        updates.arrived_at_origin_at = new Date().toISOString();
        updates.arrived_at_origin_coords = activeDriver?.currentCoords || activeRequest.driverCoords;
      }

      // INICIAR CORRIDA (INICIAR CORRIDA) - RESERVA DE TAXA
      if (nextStatus === "em_andamento") {
        updates.started_at = new Date().toISOString();
        updates.started_coords = activeDriver?.currentCoords || activeRequest.driverCoords;
        
        // Calcular taxa estimada para reserva
        let estimatedFee = (activeRequest.totalCost * settings.percentPlataforma) / 100;
        estimatedFee = Math.min(settings.taxaMaxima, Math.max(settings.taxaMinima, estimatedFee));
        updates.reserved_fee = estimatedFee;

        // Reservar do saldo do motorista
        if (activeDriver && !activeDriver.id.startsWith("driver_sim_")) {
          const currentBalance = activeDriver.creditsBalance !== undefined ? activeDriver.creditsBalance : 50.00;
          const newBalance = Math.max(0, currentBalance - estimatedFee);

          const tx: CreditTransaction = {
            id: "tx_res_" + Date.now(),
            timestamp: new Date().toISOString(),
            type: "platform_reservation",
            amount: estimatedFee,
            balanceAfter: newBalance,
            rideId: activeRequest.id,
            description: `Reserva de taxa (${settings.percentPlataforma}%) Corrida #${activeRequest.id.substring(0, 6)}`
          };

          const newTransactions = [tx, ...(activeDriver.creditTransactions || [])];

          await supabase
            .from("drivers")
            .update({
              credits_balance: newBalance,
              credit_transactions: newTransactions
            })
            .eq("id", activeDriver.id);

          setActiveDriver({
            ...activeDriver,
            creditsBalance: newBalance,
            creditTransactions: newTransactions
          });
        }
      }

      // Se a corrida for finalizada, processar o sistema financeiro dual-wallet
      if (nextStatus === "finalizado") {
        await supabase
          .from("rides")
          .update(updates)
          .eq("id", activeRequest.id);

        const driverId = activeRequest.driverId;
        if (driverId && !driverId.startsWith("driver_sim_")) {
          try {
            // Re-fetch ride for final data
            const { data: finalRideData } = await supabase
              .from("rides")
              .select("*")
              .eq("id", activeRequest.id)
              .single();

            if (finalRideData) {
              const finalRide: RideRequestItem = {
                id: finalRideData.id,
                clientId: finalRideData.client_id,
                clientName: finalRideData.client_name,
                clientPhone: finalRideData.client_phone,
                driverId: finalRideData.driver_id,
                driverName: finalRideData.driver_name,
                driverPhone: finalRideData.driver_phone,
                veiculoModelo: finalRideData.veiculo_modelo,
                veiculoPlaca: finalRideData.veiculo_placa,
                origemLabel: finalRideData.origem_label,
                destinoLabel: finalRideData.destino_label,
                startCoords: finalRideData.start_coords,
                endCoords: finalRideData.end_coords,
                driverCoords: finalRideData.driver_coords,
                geometry: finalRideData.geometry,
                status: finalRideData.status,
                statusPagamento: finalRideData.status_pagamento,
                totalCost: Number(finalRideData.total_cost),
                valorCalculado: Number(finalRideData.valor_calculado),
                distance: Number(finalRideData.distance),
                duration: Number(finalRideData.duration),
                paymentMethod: finalRideData.payment_method,
                timestamp: finalRideData.timestamp,
                arrivedAtOriginAt: finalRideData.arrived_at_origin_at,
                arrivedAtOriginCoords: finalRideData.arrived_at_origin_coords,
                startedAt: finalRideData.started_at,
                startedCoords: finalRideData.started_coords,
                reservedFee: Number(finalRideData.reserved_fee || 0),
                fraudSuspected: finalRideData.fraud_suspected,
                fraudType: finalRideData.fraud_type,
                movementLogs: finalRideData.movement_logs || [],
                waitingLogs: finalRideData.waiting_logs || [],
                waitingTimeCost: Number(finalRideData.waiting_time_cost || 0)
              };

              await processRideFinancials(finalRide, settings, driverId);
              
              // Get updated driver data to sync local state
              const { data: updatedDrvData } = await supabase
                .from("drivers")
                .select("*")
                .eq("id", driverId)
                .single();

              if (updatedDrvData) {
                const drvData: MototaxistaProfile = {
                  id: updatedDrvData.id,
                  name: updatedDrvData.name,
                  phone: updatedDrvData.phone,
                  email: updatedDrvData.email,
                  avatar: updatedDrvData.avatar_url,
                  veiculoModelo: updatedDrvData.veiculo_modelo,
                  veiculoPlaca: updatedDrvData.veiculo_placa,
                  veiculoCor: updatedDrvData.veiculo_cor,
                  cnh: updatedDrvData.cnh,
                  documentoVeiculo: updatedDrvData.documento_veiculo,
                  online: updatedDrvData.online,
                  creditsBalance: Number(updatedDrvData.credits_balance ?? 50.00),
                  earningsBalance: Number(updatedDrvData.earnings_balance ?? 0.00),
                  creditTransactions: updatedDrvData.credit_transactions || [],
                  currentCoords: updatedDrvData.current_coords || [0, 0],
                  contractAcceptedVersion: updatedDrvData.contract_accepted_version,
                  contractAcceptedAt: updatedDrvData.contract_accepted_at,
                  blocked: updatedDrvData.blocked,
                  docRejectionReason: updatedDrvData.doc_rejection_reason,
                  veiculoTipo: updatedDrvData.veiculo_tipo,
                  capacidadePassageiros: updatedDrvData.capacidade_passageiros,
                  capacidadeCargaKg: updatedDrvData.capacidade_carga_kg,
                  valorKm: Number(updatedDrvData.valor_km ?? 2.00),
                  taxaSaida: Number(updatedDrvData.taxa_saida ?? 5.00),
                  rating: Number(updatedDrvData.rating ?? 5.00),
                  approved: updatedDrvData.approved,
                  raioMaximo: Number(updatedDrvData.raio_maximo ?? 5.00),
                  modalidades: updatedDrvData.modalidades,
                  pixChave: updatedDrvData.pix_chave,
                  pixTipoChave: updatedDrvData.pix_tipo_chave,
                  pixNomeRecebedor: updatedDrvData.pix_nome_recebedor,
                  pixCidadeRecebedor: updatedDrvData.pix_cidade_recebedor,
                  acceptsPix: updatedDrvData.accepts_pix,
                  acceptsCash: updatedDrvData.accepts_cash,
                  acceptsCard: updatedDrvData.accepts_card,
                  hasMachine: updatedDrvData.has_machine,
                  usesTapToPay: updatedDrvData.uses_tap_to_pay,
                  tapToPayApp: updatedDrvData.tap_to_pay_app,
                  hasNfcHardware: updatedDrvData.has_nfc_hardware,
                  cnhUrl: updatedDrvData.cnh_url,
                  motoDocUrl: updatedDrvData.moto_doc_url,
                  selfieUrl: updatedDrvData.selfie_url,
                  createdAt: updatedDrvData.created_at
                };

                if (activeDriver && activeDriver.id === driverId) {
                  setActiveDriver(drvData);
                }
              }
            }
          } catch (err) {
            console.error("Erro ao processar financeiro da corrida:", err);
          }
        }
      } else {
        await supabase
          .from("rides")
          .update(updates)
          .eq("id", activeRequest.id);
      }

      if (nextStatus === "cancelado") {
        if (activeRequest.status === "em_andamento" || activeRequest.status === "a_caminho") {
           await supabase
             .from("rides")
             .update({
               fraud_suspected: true,
               fraud_type: activeRequest.status === "em_andamento" ? "suspicious_movement" : "timeout_exceeded"
             })
             .eq("id", activeRequest.id);
        }

        setActiveRequest(null);
        setActiveRideId(null);
        localStorage.removeItem("vouali_active_ride_id");
      }
    } catch (err) {
      console.error("Error transitioning request status: ", err);
    }
  };

  // Accept incoming requested ride manually as Driver
  const handleAcceptRequest = async () => {
    if (!activeRequest || !activeDriver) return;

    try {
      const { error } = await supabase
        .from("rides")
        .update({
          status: "aceito",
          driver_id: activeDriver.id,
          driver_name: activeDriver.name,
          driver_phone: activeDriver.phone,
          driver_coords: activeDriver.currentCoords,
          veiculo_placa: activeDriver.veiculoPlaca,
          veiculo_modelo: activeDriver.veiculoModelo,
          status_pagamento: "pendente"
        })
        .eq("id", activeRequest.id);

      if (error) throw error;
      playRingtone();
    } catch (err) {
      console.error("Error accepting ride request in Supabase:", err);
    }
  };

  // Decline request bid
  const handleDeclineRequest = async () => {
    if (!activeRequest) return;
    try {
      const { error } = await supabase
        .from("rides")
        .update({
          status: "cancelado"
        })
        .eq("id", activeRequest.id);

      if (error) throw error;
      setActiveRequest(null);
      setActiveRideId(null);
      localStorage.removeItem("vouali_active_ride_id");
    } catch (e) {
      console.error(e);
    }
  };

  // Dismiss the active request from view cleanly (e.g. after ride and payment are finalized)
  const handleDismissRide = () => {
    setActiveRequest(null);
    setActiveRideId(null);
    localStorage.removeItem("vouali_active_ride_id");
  };

  // Handle ride cancelation
  const handleCancelRide = async () => {
    if (!activeRequest) return;
    try {
      const { error } = await supabase
        .from("rides")
        .update({
          status: "cancelado"
        })
        .eq("id", activeRequest.id);

      if (error) throw error;
      setActiveRequest(null);
      setActiveRideId(null);
      localStorage.removeItem("vouali_active_ride_id");
    } catch (e) {
      console.error(e);
    }
  };

  // Clear historic list
  const handleClearHistory = () => {
    setHistory([]);
  };

  // Real-time Visual Coordinates ticking on map (moves driver icon smoothly)
  useEffect(() => {
    if (!activeRequest || !activeRideId) return;

    let ticker: any = null;

    // 1. Driving towards passenger boarding origin point A
    if (activeRequest.status === "aceito") {
      ticker = setTimeout(async () => {
        await supabase
          .from("rides")
          .update({ status: "a_caminho" })
          .eq("id", activeRideId);
      }, 3000);
    }

    else if (activeRequest.status === "a_caminho") {
      const driverOrigin = activeRequest.driverCoords || [-38.5014, -12.9714];
      const clientStart = activeRequest.startCoords;
      let tickCount = 0;
      const ticksTarget = 6;

      ticker = setInterval(async () => {
        tickCount++;
        if (tickCount >= ticksTarget) {
          // Driver has arrived at destination point A!
          if (activeRequest.driverId && activeRequest.driverId.startsWith("driver_sim_")) {
            await supabase
              .from("rides")
              .update({ 
                status: "em_andamento",
                driver_coords: clientStart
              })
              .eq("id", activeRideId);
          } else {
            // If it is a real user driver, lock coords to passenger board, but wait for manual "embarcado" action!
            await supabase
              .from("rides")
              .update({ driver_coords: clientStart })
              .eq("id", activeRideId);
          }
          clearInterval(ticker);
        } else {
          const ratio = tickCount / ticksTarget;
          const currentLng = driverOrigin[0] + (clientStart[0] - driverOrigin[0]) * ratio;
          const currentLat = driverOrigin[1] + (clientStart[1] - driverOrigin[1]) * ratio;

          await supabase
            .from("rides")
            .update({ driver_coords: [currentLng, currentLat] })
            .eq("id", activeRideId);
        }
      }, 1500);
    }

    // 2. Headed towards final destination Point B
    else if (activeRequest.status === "em_andamento") {
      const pathPoints = activeRequest.geometry || [];
      
      if (pathPoints.length > 0) {
        let index = 0;
        ticker = setInterval(async () => {
          if (index >= pathPoints.length) {
            // Arrived at destination Point B!
            if (activeRequest.driverId && activeRequest.driverId.startsWith("driver_sim_")) {
              await supabase
                .from("rides")
                .update({ 
                  status: "finalizado",
                  driver_coords: pathPoints[pathPoints.length - 1]
                })
                .eq("id", activeRideId);
            } else {
              // Real driver, lock coords but let them hit "finalizar" button
              await supabase
                .from("rides")
                .update({ driver_coords: pathPoints[pathPoints.length - 1] })
                .eq("id", activeRideId);
            }
            clearInterval(ticker);
          } else {
            const nextCoords = pathPoints[index];
            await supabase
              .from("rides")
              .update({ driver_coords: nextCoords })
              .eq("id", activeRideId);
            index += Math.max(1, Math.floor(pathPoints.length / 8));
          }
        }, 1600);
      } else {
        const sPt = activeRequest.startCoords;
        const ePt = activeRequest.endCoords;
        let tick = 0;
        ticker = setInterval(async () => {
          tick++;
          if (tick >= 5) {
            if (activeRequest.driverId && activeRequest.driverId.startsWith("driver_sim_")) {
              await supabase
                .from("rides")
                .update({ 
                  status: "finalizado",
                  driver_coords: ePt
                })
                .eq("id", activeRideId);
            }
            clearInterval(ticker);
          } else {
            const ratio = tick / 5;
            const liveLng = sPt[0] + (ePt[0] - sPt[0]) * ratio;
            const liveLat = sPt[1] + (ePt[1] - sPt[1]) * ratio;
            await supabase
              .from("rides")
              .update({ driver_coords: [liveLng, liveLat] })
              .eq("id", activeRideId);
          }
        }, 1600);
      }
    }

    return () => {
      if (ticker) clearInterval(ticker);
    };
  }, [activeRequest?.status, activeRideId]);

  // ANTI-FRAUD: Movement Tracker & Timeout Monitor
  useEffect(() => {
    if (!activeRequest || !activeRideId || activeRequest.status === "finalizado" || activeRequest.status === "cancelado") return;

    const interval = setInterval(async () => {
      // 1. Record Movement Logs
      if (activeRequest.status === "em_andamento") {
        const currentCoords = activeDriver?.currentCoords || activeRequest.driverCoords;
        if (currentCoords) {
           const logs = activeRequest.movementLogs || [];
           if (logs.length < 50) {
             await supabase
               .from("rides")
               .update({
                 movement_logs: [...logs, { timestamp: new Date().toISOString(), coords: currentCoords }]
               })
               .eq("id", activeRideId);
           }
        }
      }

      // 2. Timeout Monitor (After arrived)
      if (activeRequest.status === "a_caminho" && activeRequest.arrivedAtOriginAt) {
        const arrivedAt = new Date(activeRequest.arrivedAtOriginAt).getTime();
        const now = new Date().getTime();
        const timeoutMinutes = settings.antiFraud?.tempoLimiteInicio || 10;
        
        if (now - arrivedAt > timeoutMinutes * 60 * 1000) {
          await handleProgressRequest("cancelado");
        }
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [activeRequest?.status, activeRideId, activeDriver?.currentCoords, settings.antiFraud]);

  const handleSignout = async () => {
    sessionStorage.removeItem("vouali_admin_authenticated");
    setAdminLoggedIn(false);
    setIsAdminRoute(false);
    window.location.hash = "";
    await signOut(auth);
    setCurrentRole(null);
    setActiveClient(null);
    setActiveDriver(null);
  };

  return (
    <div className="flex flex-col min-h-screen text-zinc-100 bg-zinc-950 font-sans selection:bg-amber-500 selection:text-black">
      
      {/* GLOBAL HEADER */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-[1010]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          
          <div 
            onClick={() => {}}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {settings.branding?.logoUrl ? (
              <img src={settings.branding.logoUrl} className="h-10 transform group-hover:scale-105 transition-all" alt="Logo" />
            ) : (
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 transform group-hover:scale-105 transition-all">
                <Navigation className="w-6 h-6 text-zinc-950 stroke-[2.5] -rotate-45" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <h1 className="text-sm font-black tracking-tight text-zinc-100 sm:text-lg uppercase">
                  {settings.branding?.title || "Vouali"}
                </h1>
                <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest font-mono font-extrabold flex items-center gap-1">
                  Premium
                </span>
              </div>
              <motion.p 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[9px] text-zinc-500 block uppercase tracking-wider font-semibold"
              >
                {settings.branding?.slogan || "Vouali e chego bem"}
              </motion.p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeRequest && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-500 font-mono font-bold">
                ▲ Corrida Ativa ({activeRequest.status})
              </span>
            )}

            {adminLoggedIn && (
              <button
                onClick={() => setCurrentRole(currentRole === "admin" ? (activeClient ? "client" : "driver") : "admin")}
                className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-amber-400 hover:text-zinc-950 hover:bg-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                🛡️ {currentRole === "admin" ? "Sair do Admin" : "Painel Administrador"}
              </button>
            )}

            {currentUser && (
              <button
                onClick={handleSignout}
                className="flex items-center gap-1 text-[10px] uppercase font-black tracking-wider text-zinc-400 hover:text-white bg-zinc-850 hover:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-800 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Desconectar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CORE FRAME FOR USER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8">
        {isAdminRoute && !adminLoggedIn ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-zinc-900 border border-zinc-800 p-8 sm:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl"></div>

              <div className="text-center">
                <div className="mx-auto mb-4 flex justify-center">
                  {settings.branding?.logoUrl ? (
                    <img src={settings.branding.logoUrl} className="h-16" alt="Admin Logo" />
                  ) : (
                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <ShieldCheck className="w-7 h-7 text-zinc-950 stroke-[2.5]" />
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-tight">
                  {settings.branding?.title || "Vouali"} Admin
                </h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-1.5 text-[9px] text-zinc-400 font-black uppercase tracking-[0.2em]"
                >
                  {settings.branding?.slogan || "Vouali e chego bem"}
                </motion.p>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  setAdminLoginError(null);
                  const expectedEmail = settings.adminEmail || "dalison.messias@outlook.com";
                  const expectedPass = settings.adminPassword || "102192";
                  
                  if (adminEmailInput.trim().toLowerCase() === expectedEmail.trim().toLowerCase() && adminPasswordInput === expectedPass) {
                    sessionStorage.setItem("vouali_admin_authenticated", "true");
                    setAdminLoggedIn(true);
                    setCurrentRole("admin");
                  } else {
                    setAdminLoginError("E-mail ou Senha administrativa incorreta.");
                  }
                }}
                className="mt-6 space-y-4"
              >
                {adminLoginError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs text-center font-bold animate-pulse">
                    ⚠️ {adminLoginError}
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="admin-email" className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                    E-mail Institucional
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    required
                    placeholder="exemplo@outlook.com"
                    value={adminEmailInput}
                    onChange={(e) => setAdminEmailInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-3 px-4 text-zinc-200 text-sm font-medium outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="admin-pass" className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                    Senha Administrativa
                  </label>
                  <input
                    id="admin-pass"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl py-3 px-4 text-zinc-200 text-sm outline-none transition"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black py-3 rounded-xl uppercase tracking-wider text-xs transition cursor-pointer shadow-lg shadow-amber-500/15"
                  >
                    Acessar Painel Monitor
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminRoute(false);
                      window.location.hash = "";
                    }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-400 font-extrabold uppercase tracking-widest cursor-pointer mt-2"
                  >
                    ← Voltar para Área de Usuários
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (loadingAuth || loadingProfile) ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full"></div>
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin relative z-10" />
            </div>
            <div className="text-center">
              <p className="text-xs text-zinc-400 font-black uppercase tracking-[0.2em] animate-pulse">
                {loadingAuth ? "Iniciando Vouali..." : "Sincronizando Perfil..."}
              </p>
              <p className="text-[10px] text-amber-500/60 font-medium uppercase tracking-widest mt-1">
                Vouali e chego bem
              </p>
            </div>
          </div>
        ) : (currentRole === null || (currentRole === "client" && !activeClient) || (currentRole === "driver" && !activeDriver)) ? (
          // AUTH FLOW: SELECT ROLE OR COMPLETE PROFILE
          <RoleSelector
            currentRole={currentRole as "client" | "driver" | null}
            onSelectRole={(role) => setCurrentRole(role)}
            activeClient={activeClient}
            activeDriver={activeDriver}
            onUpdateClient={handleUpdateClient}
            onUpdateDriver={handleUpdateDriver}
            settings={settings}
          />
        ) : currentRole === "client" ? (
          // CLIENT DASHBOARD APP VIEW
          activeClient ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3 font-sans">
                <div className="flex items-center gap-2">
                  <img 
                    src={activeClient.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeClient.name}`} 
                    className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20" 
                    alt="avatar"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <span className="text-[8px] text-amber-500 font-bold uppercase tracking-widest block font-mono">Modo Passageiro</span>
                    <h3 className="text-sm font-black text-zinc-100 uppercase">{activeClient.name}</h3>
                  </div>
                </div>
                
                <p className="text-[10px] text-zinc-500 max-w-[150px] truncate leading-tight font-mono text-right hidden sm:block">
                  WhatsApp: {activeClient.phone}
                </p>
              </div>

              <PushNotificationManager userId={currentUser.uid} role="client" />

              <ClientDashboard
                socket={socket}
                settings={settings}
                activeClient={activeClient}
                onlineDrivers={getOnlineDrivers()}
                activeRequest={activeRequest}
                onRequestRide={handleRequestRide}
                onCancelRide={handleCancelRide}
                onDismissRide={handleDismissRide}
                clientHistory={history}
                onClearHistory={handleClearHistory}
              />
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center gap-3 py-24">
               <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
               <p className="text-xs text-zinc-400 font-black uppercase tracking-wider">Carregando Dashboard Cliente...</p>
             </div>
          )
        ) : currentRole === "admin" ? (
          // ADMIN CENTRAL CONTROL PANEL VIEW
          <AdminDashboard
            settings={settings}
            onUpdateSettings={(updated) => setSettings(updated)}
            onSignout={handleSignout}
            currentUser={currentUser}
          />
        ) : currentRole === "driver" ? (
          // DRIVER DASHBOARD CONSOLE PANEL
          activeDriver ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3 font-sans">
                <div className="flex items-center gap-2">
                  <img 
                    src={activeDriver.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeDriver.name}`} 
                    className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20" 
                    alt="avatar"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-widest block font-mono">Console Condutor</span>
                    <h3 className="text-sm font-black text-zinc-100 uppercase">{activeDriver.name}</h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 font-mono hidden sm:block">
                    Placa: {activeDriver.veiculoPlaca}
                  </span>
                  <p className="text-[9px] text-zinc-400 font-mono italic">
                    {activeDriver.online 
                      ? "Tarifa Base: R$ " + activeDriver.valorKm.toFixed(2) + "/KM" 
                      : "Status: Offline"}
                  </p>
                </div>
              </div>

              <PushNotificationManager userId={currentUser.uid} role="driver" />

              <DriverDashboard
                socket={socket}
                settings={settings}
                activeDriver={activeDriver}
                onUpdateDriver={handleUpdateDriver}
                activeRequest={activeRequest}
                onAcceptRequest={handleAcceptRequest}
                onDeclineRequest={handleDeclineRequest}
                onProgressRequest={(st) => handleProgressRequest(st)}
                onDismissRide={handleDismissRide}
                driverHistory={history}
                onClearHistory={handleClearHistory}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
               <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
               <p className="text-xs text-zinc-400 font-black uppercase tracking-wider">Carregando Terminal Condutor...</p>
             </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <User className="w-8 h-8 text-zinc-800" />
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Acesso Negado ou Perfil Inválido</p>
          </div>
        )}
      </main>

      {/* DYNAMIC BRANDING FOOTER */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            {settings.branding?.logoUrl ? (
              <img src={settings.branding.logoUrl} className="h-6 opacity-70" alt="Footer Logo" />
            ) : (
              <span className="text-sm font-black uppercase tracking-tighter text-white">{settings.branding?.title || "Vouali"}</span>
            )}
            <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{settings.branding?.slogan || "Vouali e chego bem"}</span>
          </div>
          <div className="flex flex-col sm:flex-row justify-between w-full items-center gap-3 text-zinc-700 text-[9px] uppercase font-bold tracking-widest">
            <p>© {settings.branding?.title || "Vouali"} Platform — {new Date().getFullYear()}</p>
            <div className="flex gap-6">
              <span>Segurança & Confiança</span>
              <span>Mobilidade Premium</span>
            </div>
          </div>
        </div>
      </footer>
      
      {/* PWA Smart Installation System */}
      <PWAInstallPrompt />
      
      {/* Vercel Web Analytics */}
      <Analytics />
    </div>
  );
}

// Inline Loader Icon
function Loader2({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
