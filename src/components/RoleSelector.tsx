// src/components/RoleSelector.tsx
// Seletor de Perfil, Autenticação de Usuários e Registro no Supabase
// UTF-8 Brasil

import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { ClientProfile, MototaxistaProfile, ModalidadeCorrida, AppSettings } from "../types";
import { 
  User, 
  Bike, 
  Check, 
  UserPlus, 
  Sparkles, 
  Mail, 
  Lock, 
  Phone, 
  Chrome, 
  FileText, 
  Camera, 
  Loader2, 
  AlertCircle,
  Shield,
  Zap,
  MapPin,
  Star,
  Award,
  DollarSign,
  Clock,
  ArrowRight,
  ChevronDown,
  MessageSquare,
  Navigation
} from "lucide-react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPhoneNumber, 
  RecaptchaVerifier,
  signOut
} from "firebase/auth";
import { Facebook, Instagram } from "lucide-react";
import { supabase, uploadToSupabaseStorage, handleSupabaseError } from "../lib/supabase";
import { auth } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";

interface RoleSelectorProps {
  currentRole: "client" | "driver" | null;
  onSelectRole: (role: "client" | "driver") => void;
  activeClient: ClientProfile | null;
  activeDriver: MototaxistaProfile | null;
  onUpdateClient: (client: ClientProfile) => void;
  onUpdateDriver: (driver: MototaxistaProfile) => void;
  settings: AppSettings;
}

export default function RoleSelector({
  currentRole,
  onSelectRole,
  activeClient,
  activeDriver,
  onUpdateClient,
  onUpdateDriver,
  settings,
}: RoleSelectorProps) {
  // Authentication local states
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [selectedRoleForAuth, setSelectedRoleForAuth] = useState<"client" | "driver" | null>(null);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappCode, setWhatsappCode] = useState("");
  const [smsCode, setSmsCode] = useState("");

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
  
  const [verificationId, setVerificationId] = useState<any>(null);
  const [whatsappStep, setWhatsappStep] = useState<"phone" | "code">("phone");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  // Profile creation states
  const [isRegistering, setIsRegistering] = useState<"client" | "driver" | null>(null);

  // Force registration view if role is defined but profile is missing
  useEffect(() => {
    if (auth.currentUser && currentRole && !isRegistering) {
      if (currentRole === "client" && !activeClient) {
        setIsRegistering("client");
      } else if (currentRole === "driver" && !activeDriver) {
        setIsRegistering("driver");
      }
    }
  }, [currentRole, activeClient, activeDriver, isRegistering]);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [vehicleType, setVehicleType] = useState<"moto" | "carro">("moto");
  const [categories, setCategories] = useState<ModalidadeCorrida[]>(["moto"]);
  const [passengers, setPassengers] = useState("1");
  const [cargo, setCargo] = useState("0");
  const [rate, setRate] = useState("2.50");
  const [base, setBase] = useState("5.50");

  // File Uploads state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Real-time online drivers synced for custom preview map
  const [liveDrivers, setLiveDrivers] = useState<MototaxistaProfile[]>([]);
  const heroMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkersRef = useRef<{ [id: string]: L.Marker }>({});

  // Active FAQ accordion state
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Dynamic Geolocation Detection on mount to center the landing page hero radar
  const [gpsCoords, setGpsCoords] = useState<[number, number] | null>(null);
  const [useGpsLabel, setUseGpsLabel] = useState<string>("Buscando sua localização...");
  const [detectedCity, setDetectedCity] = useState<string>("Sua Cidade");
  const [detectedRegion, setDetectedRegion] = useState<string>("Bahia");

  useEffect(() => {
    const locate = async () => {
      // Try HTML5 Geolocation first
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            setGpsCoords([latitude, longitude]);
            setUseGpsLabel("Mototaxistas Próximos a Você");
            
            // Try reverse geocoding to find city and state name using Nominatim
            try {
              const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`;
              const res = await fetch(reverseUrl, { headers: { "Accept-Language": "pt-BR" } });
              if (res.ok) {
                const data = await res.json();
                const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "Sua Cidade";
                const state = data.address?.state || "Bahia";
                setDetectedCity(city);
                setDetectedRegion(state);
                setUseGpsLabel(`Mototaxistas em ${city}`);
              }
            } catch (err) {
              console.warn("Reverse geocode failed:", err);
            }
          },
          async (err) => {
            console.warn("HTML5 Geolocation failed/declined. Trying IP Geolocation fallback...", err);
            await fetchIpLocation();
          },
          { timeout: 5000 }
        );
      } else {
        await fetchIpLocation();
      }
    };

    const fetchIpLocation = async () => {
      try {
        const ipRes = await fetch("https://freeipapi.com/api/json");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.latitude && ipData.longitude) {
            setGpsCoords([ipData.latitude, ipData.longitude]);
            const city = ipData.cityName || "Sua Cidade";
            const state = ipData.regionName || "Bahia";
            setDetectedCity(city);
            setDetectedRegion(state);
            setUseGpsLabel(`Mototaxistas em ${city}`);
            return;
          }
        }
      } catch (err) {
        console.warn("freeipapi.com failed, trying ipapi.co", err);
      }

      try {
        const ipRes2 = await fetch("https://ipapi.co/json/");
        if (ipRes2.ok) {
          const ipData2 = await ipRes2.json();
          if (ipData2.latitude && ipData2.longitude) {
            setGpsCoords([ipData2.latitude, ipData2.longitude]);
            const city = ipData2.city || "Sua Cidade";
            const state = ipData2.region || "Bahia";
            setDetectedCity(city);
            setDetectedRegion(state);
            setUseGpsLabel(`Mototaxistas em ${city}`);
            return;
          }
        }
      } catch (err2) {
        console.warn("ipapi.co failed too", err2);
      }

      setGpsCoords([-12.9714, -38.5014]); // Salvador BA coordinates
      setDetectedCity("Salvador");
      setDetectedRegion("Bahia");
      setUseGpsLabel("Mototaxistas em Sua Região");
    };

    locate();
  }, []);

  // Subscribe to real-time online drivers from Supabase
  useEffect(() => {
    // 1. Consulta inicial de motoristas online
    supabase
      .from('drivers')
      .select('*')
      .eq('online', true)
      .then(({ data, error }) => {
        if (error) {
          console.warn("Erro ao buscar motoristas online:", error.message);
        } else if (data) {
          const mapped = data.map(d => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            avatar: d.avatar_url,
            online: d.online,
            creditsBalance: d.credits_balance,
            currentCoords: d.current_coords,
            veiculoPlaca: d.veiculo_placa,
            veiculoModelo: d.veiculo_modelo,
            veiculoCor: d.veiculo_cor
          } as unknown as MototaxistaProfile));
          setLiveDrivers(mapped);
        }
      });

    // 2. Ouvinte realtime do Supabase
    const mapChannel = supabase.channel('live_drivers_preview')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers'
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const fresh = payload.new;
            if (fresh.online) {
              const mapped: MototaxistaProfile = {
                id: fresh.id,
                name: fresh.name,
                phone: fresh.phone,
                avatar: fresh.avatar_url,
                online: fresh.online,
                creditsBalance: fresh.credits_balance,
                currentCoords: fresh.current_coords,
                veiculoPlaca: fresh.veiculo_placa,
                veiculoModelo: fresh.veiculo_modelo,
                veiculoCor: fresh.veiculo_cor,
                valorKm: fresh.valor_km,
                taxaSaida: fresh.taxa_saida,
                rating: fresh.rating,
                approved: fresh.approved,
                veiculoTipo: fresh.veiculo_tipo,
                capacidadePassageiros: fresh.capacidade_passageiros
              } as unknown as MototaxistaProfile;
              setLiveDrivers(prev => {
                const filtered = prev.filter(d => d.id !== mapped.id);
                return [...filtered, mapped];
              });
            } else {
              setLiveDrivers(prev => prev.filter(d => d.id !== fresh.id));
            }
          } else if (payload.eventType === 'DELETE') {
            setLiveDrivers(prev => prev.filter(d => d.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(mapChannel);
    };
  }, []);

  // Render Leaflet City Grid on DOM mount
  useEffect(() => {
    if (!heroMapRef.current) return;

    const initialLat = gpsCoords ? gpsCoords[0] : -12.9714;
    const initialLng = gpsCoords ? gpsCoords[1] : -38.5014;

    if (!mapInstanceRef.current) {
      const map = L.map(heroMapRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false,
        dragging: false
      }).setView([initialLat, initialLng], 13);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
      }).addTo(map);

      mapInstanceRef.current = map;
    } else if (gpsCoords) {
      mapInstanceRef.current.setView(gpsCoords, 13);
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    Object.keys(driverMarkersRef.current).forEach((id) => {
      driverMarkersRef.current[id].remove();
    });
    driverMarkersRef.current = {};

    // Put current connected drivers markers on the homepage preview map
    liveDrivers.forEach((driver) => {
      if (!driver.currentCoords || driver.currentCoords.length !== 2) return;
      const driverLatCoords = [driver.currentCoords[1], driver.currentCoords[0]] as [number, number];
      
      const customIcon = L.divIcon({
        className: "preview-driver-ping",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-8 w-8 bg-amber-500/30 opacity-45 rounded-full animate-ping"></span>
            <div class="w-7 h-7 rounded-full bg-amber-500 border border-zinc-950 shadow-xl flex items-center justify-center text-zinc-950">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18.5" cy="17.5" r="2.5"/>
                <circle cx="5.5" cy="17.5" r="2.5"/>
                <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const mk = L.marker(driverLatCoords, { icon: customIcon }).addTo(map);
      driverMarkersRef.current[driver.id] = mk;
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

  }, [liveDrivers, gpsCoords]);

  // Initializing Recaptcha
  useEffect(() => {
    if (authMode && !recaptchaVerifier) {
      try {
        const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {
            console.log("Invisible Recaptcha Verified Successfully");
          },
        });
        setRecaptchaVerifier(verifier);
      } catch (err) {
        console.error("Invisible recaptcha init failed:", err);
      }
    }
  }, [authMode]);

  // Handle email/password signup
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !selectedRoleForAuth) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      
      // Criar entrada no Supabase na tabela users
      const { error: insertUserErr } = await supabase
        .from('users')
        .insert({
          id: cred.user.uid,
          role: selectedRoleForAuth,
          created_at: new Date().toISOString()
        });

      if (insertUserErr) throw insertUserErr;

      setIsRegistering(selectedRoleForAuth);
      setAuthMode(null);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Erro no cadastro de e-mail.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle email/password login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !selectedRoleForAuth) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setAuthMode(null);
    } catch (err: any) {
      console.error(err);
      setAuthError("Email ou senha inválidos. Verifique as credenciais.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Google Authentication trigger login
  const handleGoogleLogin = async () => {
    if (!selectedRoleForAuth) return;
    if (!settings.socialLogin?.google?.active) return;
    
    setAuthLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await handleSocialAuthResult(result.user, "google");
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Falha no login com Google.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    if (!selectedRoleForAuth) return;
    if (!settings.socialLogin?.facebook?.active) return;

    setAuthLoading(true);
    setAuthError(null);
    try {
      const provider = new FacebookAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await handleSocialAuthResult(result.user, "facebook");
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Falha no login com Facebook.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleInstagramLogin = async () => {
    setAuthError("Login via Instagram está sendo configurado. Utilize Google ou Facebook.");
  };

  const handleSocialAuthResult = async (user: any, providerName: string) => {
    if (!selectedRoleForAuth) return;
    
    // Verificar se usuário existe no Supabase
    const { data: userSnap, error: fetchErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.uid)
      .single();

    if (fetchErr || !userSnap) {
      // Registrar no Supabase
      const { error: insertErr } = await supabase
        .from('users')
        .insert({
          id: user.uid,
          role: selectedRoleForAuth,
          created_at: new Date().toISOString()
        });

      if (insertErr) throw insertErr;

      setIsRegistering(selectedRoleForAuth);
      if (user.displayName) setName(user.displayName);
      if (user.phoneNumber) setPhone(user.phoneNumber);
      if (user.photoURL) setAvatarPreview(user.photoURL);
    } else {
      const realRole = userSnap.role;
      onSelectRole(realRole);
    }
    setAuthMode(null);
  };

  // SMS Authentication OTP Sending triggers
  const handleSendSMS = async () => {
    if (!phoneNumber || !selectedRoleForAuth) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      let formatted = phoneNumber.trim();
      if (!formatted.startsWith("+")) {
        formatted = "+55" + formatted.replace(/\D/g, "");
      }
      const appVerifier = (window as any).recaptchaVerifier || recaptchaVerifier;
      if (!appVerifier) {
        throw new Error("Recaptcha do Firebase indisponível. Recarregue.");
      }
      const confirmation = await signInWithPhoneNumber(auth, formatted, appVerifier);
      setVerificationId(confirmation);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Erro ao conectar autenticação telefônica.");
    } finally {
      setAuthLoading(false);
    }
  };

  // WhatsApp Authentication OTP Sending
  const handleSendWhatsAppOTP = async () => {
    if (!phoneNumber || !selectedRoleForAuth) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      let formatted = phoneNumber.trim().replace(/\D/g, "");
      if (!formatted.startsWith("55") && formatted.length <= 11) {
        formatted = "55" + formatted;
      }
      
      const res = await fetch("/api/auth/whatsapp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar WhatsApp");
      
      setWhatsappStep("code");
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Erro ao conectar autenticação WhatsApp.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyWhatsAppOTP = async () => {
    if (!whatsappCode || !selectedRoleForAuth) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      let formatted = phoneNumber.trim().replace(/\D/g, "");
      if (!formatted.startsWith("55") && formatted.length <= 11) {
        formatted = "55" + formatted;
      }

      const res = await fetch("/api/auth/whatsapp/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted, code: whatsappCode })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Código inválido");

      const { customToken, fallbackEmail, fallbackPassword } = data;
      
      let user;
      if (customToken && !customToken.startsWith("simulated_token_")) {
        const { signInWithCustomToken } = await import("firebase/auth");
        const result = await signInWithCustomToken(auth, customToken);
        user = result.user;
      } else if (fallbackEmail && fallbackPassword) {
        try {
          const result = await signInWithEmailAndPassword(auth, fallbackEmail, fallbackPassword);
          user = result.user;
        } catch (e: any) {
          console.warn("Tentando com criar conta", e);
          try {
            const result = await createUserWithEmailAndPassword(auth, fallbackEmail, fallbackPassword);
            user = result.user;
          } catch (signupErr: any) {
            if (signupErr.code === "auth/email-already-in-use") {
              const result = await signInWithEmailAndPassword(auth, fallbackEmail, fallbackPassword);
              user = result.user;
            } else { throw signupErr; }
          }
        }
      } else {
        throw new Error("Falha ao processar autenticação do servidor.");
      }

      if (!user) throw new Error("Usuário não autenticado");

      // Verificar ou criar no Supabase
      const { data: userSnap, error: fetchErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.uid)
        .single();

      if (fetchErr || !userSnap) {
        const { error: insertErr } = await supabase
          .from('users')
          .insert({
            id: user.uid,
            role: selectedRoleForAuth,
            created_at: new Date().toISOString()
          });

        if (insertErr) throw insertErr;

        setIsRegistering(selectedRoleForAuth);
        setPhone(formatted);
      } else {
        const realRole = userSnap.role;
        onSelectRole(realRole);
      }
      setAuthMode(null);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Código WhatsApp inválido ou erro de servidor.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!smsCode || !verificationId || !selectedRoleForAuth) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await verificationId.confirm(smsCode);
      const user = result.user;

      // Verificar ou criar no Supabase
      const { data: userSnap, error: fetchErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.uid)
        .single();

      if (fetchErr || !userSnap) {
        const { error: insertErr } = await supabase
          .from('users')
          .insert({
            id: user.uid,
            role: selectedRoleForAuth,
            created_at: new Date().toISOString()
          });

        if (insertErr) throw insertErr;

        setIsRegistering(selectedRoleForAuth);
        if (user.phoneNumber) setPhone(user.phoneNumber);
      } else {
        const realRole = userSnap.role;
        onSelectRole(realRole);
      }
      setAuthMode(null);
    } catch (err: any) {
      console.error(err);
      setAuthError("Código SMS inválido. Tente novamente.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || !name || !phone) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      let avatarUrl = avatarPreview || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
      
      // Upload para Supabase Storage
      if (avatarFile) {
        if (avatarFile.size > 2 * 1024 * 1024) {
          throw new Error("A imagem de perfil é muito grande. Escolha uma foto menor que 2MB.");
        }
        avatarUrl = await uploadToSupabaseStorage("profiles", `${currentUser.uid}_avatar`, avatarFile);
      }

      const clientData: ClientProfile = {
        id: currentUser.uid,
        name,
        phone,
        avatar: avatarUrl,
        provider: currentUser.providerData[0]?.providerId || "email",
        favoritos: [
          { id: "fav_1", label: "Farol da Barra", address: "Farol da Barra, Salvador - BA", coords: [-38.5323, -13.0112] },
          { id: "fav_2", label: "Trabalho", address: "Av. Tancredo Neves, 3133 - Caminho das Árvores, Salvador", coords: [-38.4502, -12.9812] }
        ]
      };

      // 1. Atualizar/Inserir na tabela users do Supabase
      const { error: userErr } = await supabase
        .from('users')
        .upsert({
          id: currentUser.uid,
          role: "client"
        });

      if (userErr) throw userErr;

      // 2. Inserir na tabela clients do Supabase
      const { error: clientErr } = await supabase
        .from('clients')
        .upsert({
          id: currentUser.uid,
          name,
          phone,
          email: currentUser.email || "",
          avatar_url: avatarUrl
        });

      if (clientErr) throw clientErr;

      onUpdateClient(clientData);
      onSelectRole("client");
      setIsRegistering(null);
      resetForm();
    } catch (err: any) {
      console.error("Erro no registro de cliente:", err);
      setAuthError(err.message || "Erro ao salvar perfil no Supabase.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || !name || !phone || !model || !plate) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      let avatarUrl = avatarPreview || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
      
      // Upload para Supabase Storage
      if (avatarFile) {
        if (avatarFile.size > 2 * 1024 * 1024) {
          throw new Error("A foto é muito grande. Use uma imagem menor que 2MB.");
        }
        avatarUrl = await uploadToSupabaseStorage("profiles", `${currentUser.uid}_avatar`, avatarFile);
      }

      const driverData: MototaxistaProfile = {
        id: currentUser.uid,
        name,
        phone,
        avatar: avatarUrl,
        valorKm: parseFloat(rate) || 2.20,
        taxaSaida: parseFloat(base) || 5.50,
        raioMaximo: 6.0,
        modalidades: categories,
        online: false,
        currentCoords: gpsCoords ? [gpsCoords[1], gpsCoords[0]] : [-38.5014, -12.9714],
        rating: 5.0,
        veiculoPlaca: plate.toUpperCase(),
        veiculoModelo: model,
        veiculoCor: color,
        veiculoTipo: vehicleType,
        capacidadePassageiros: parseInt(passengers) || (vehicleType === "moto" ? 1 : 4),
        capacidadeCargaKg: parseFloat(cargo) || 0,
        pixChave: phone,
        pixTipoChave: "PHONE",
        pixNomeRecebedor: name,
        pixCidadeRecebedor: detectedCity.toUpperCase() || "SALVADOR",
        provider: currentUser.providerData[0]?.providerId || "email",
        approved: "pendente",
        creditsBalance: 50.00,
        cnhUrl: "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=500&auto=format&fit=crop",
        motoDocUrl: "https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=500&auto=format&fit=crop",
        selfieUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop"
      };

      // 1. Atualizar/Inserir na tabela users do Supabase
      const { error: userErr } = await supabase
        .from('users')
        .upsert({
          id: currentUser.uid,
          role: "driver"
        });

      if (userErr) throw userErr;

      // 2. Inserir na tabela drivers do Supabase
      const { error: driverErr } = await supabase
        .from('drivers')
        .upsert({
          id: currentUser.uid,
          name,
          phone,
          email: currentUser.email || "",
          avatar_url: avatarUrl,
          veiculo_modelo: model,
          veiculo_placa: plate.toUpperCase(),
          veiculo_cor: color,
          online: false,
          credits_balance: 50.00,
          earnings_balance: 0.00,
          current_coords: gpsCoords ? [gpsCoords[1], gpsCoords[0]] : [-38.5014, -12.9714]
        });

      if (driverErr) throw driverErr;

      onUpdateDriver(driverData);
      onSelectRole("driver");
      setIsRegistering(null);
      resetForm();
    } catch (err: any) {
      console.error("Erro no registro de condutor:", err);
      setAuthError(err.message || "Erro ao salvar credenciamento no Supabase.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setName("");
    setPhone("");
    setModel("");
    setPlate("");
    setRate("2.50");
    setBase("5.50");
    setAvatarFile(null);
    setAvatarPreview(null);
    setVerificationId(null);
    setSmsCode("");
  };

  const faqData = [
    { q: `Quais cidades o ${settings.branding?.title || "Vouali"} atende?`, a: `Atualmente, atendemos com máxima intensidade Salvador-BA com planos imediatos de expansão para outras regiões metropolitanas do Nordeste.` },
    { q: "Como funciona a segurança no transporte de passageiros?", a: "Todos os nossos condutores parceiros passam por checagem rigorosa de antecedentes criminais, verificação ativa de documentação e placa da motocicleta, além do suporte ao vivo via chat monitorado." },
    { q: "O pagamento por PIX é repassado instantaneamente?", a: "Sim. Nossos servidores criam o payload Pix integrado dinamicamente e os fundos são transferidos de imediato para a carteira cadastrada do parceiro, sem tempo de retenção." },
    { q: `O que é a modalidade ${settings.branding?.title || "Vouali"} Flash?`, a: "É o nosso serviço expresso focado na entrega rápida de pacotes, documentos, cartões ou pequenos volumes com tarifas super acessíveis, acompanhado de acompanhamento no mapa." }
  ];

  return (
    <div className="space-y-16 pb-20 w-full text-zinc-100 bg-zinc-950 select-none overflow-hidden font-sans">
      <div id="recaptcha-container" className="hidden"></div>

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900/60 z-[1001] px-4">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings.branding?.logoUrl ? (
              <img src={settings.branding.logoUrl} className="h-8" alt="Logo" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <Navigation className="w-4.5 h-4.5 text-zinc-950 stroke-[2.5] -rotate-45" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-black uppercase tracking-tight text-white leading-none">
                {settings.branding?.title ? settings.branding.title.toUpperCase() : "VOUALI"}
              </span>
              <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">
                {settings.branding?.slogan || "E chego bem"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] text-emerald-400 font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {liveDrivers.length + 3} Condutores Ativos Próximos
            </span>
            <button 
              onClick={() => {
                setSelectedRoleForAuth("client");
                setAuthMode("login");
              }}
              className="text-xs font-black uppercase tracking-wider text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-850 px-4 py-2 border border-zinc-850 hover:border-zinc-800 rounded-xl transition cursor-pointer"
            >
              Entrar
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-24 pb-12 md:py-32 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center px-4">
        <div className="lg:col-span-7 space-y-6 md:space-y-8 text-left relative z-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500 text-[10px] font-black font-mono tracking-widest uppercase mb-4"
          >
            <Sparkles className="w-3 h-3 fill-amber-500" />
            {settings.branding?.slogan ? settings.branding.slogan.toUpperCase() : "VOUALI E CHEGO BEM — MOBILIDADE PREMIUM"}
          </motion.div>

          <h1 className="text-5xl md:text-6xl xl:text-8xl font-black uppercase tracking-tighter text-white leading-[0.9]">
            {settings.branding?.title ? settings.branding.title.toUpperCase() + "." : "VOUALI."}<br />
            <span className="text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">{settings.branding?.slogan ? settings.branding.slogan.toUpperCase() : "E CHEGO BEM"}</span>.
          </h1>

          <p className="text-zinc-400 text-sm md:text-lg max-w-xl leading-relaxed font-medium">
            A forma mais moderna, segura e confiável de se locomover. Tecnologia de ponta integrada com Supabase para garantir que você chegue bem ao seu destino em {detectedCity}.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <button
              onClick={() => {
                setSelectedRoleForAuth("client");
                setAuthMode("login");
              }}
              className="px-6 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-wider text-xs md:text-sm shadow-xl shadow-amber-500/10 hover:shadow-amber-500/20 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 cursor-pointer"
            >
              <User className="w-4 h-4 stroke-[2.5]" />
              Pedir Moto Agora
            </button>
            
            <button
              onClick={() => {
                setSelectedRoleForAuth("client");
                setAuthMode("login");
              }}
              className="px-6 py-4 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 font-black uppercase tracking-wider text-xs hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              {settings.branding?.title || "Vouali"} Flash
            </button>

            <button
              onClick={() => {
                setSelectedRoleForAuth("driver");
                setAuthMode("signup");
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15 text-[10px] tracking-wide uppercase font-black transition text-center cursor-pointer"
            >
              Seja um Condutor parceiro
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-md pt-4 border-t border-zinc-900">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">Tarifa Base</span>
              <p className="text-sm font-black text-white">R$ 5,50</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">Preço/KM</span>
              <p className="text-sm font-black text-amber-500">R$ 2,50/km</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">Tempo Médio</span>
              <p className="text-sm font-black text-white">3 minutos</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 relative w-full h-[320px] md:h-[450px]">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-transparent blur-3xl z-0 pointer-events-none rounded-full"></div>
          <div className="relative w-full h-full rounded-3xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-2xl p-2 z-10">
            <div className="absolute top-4 left-4 z-[999] bg-zinc-950/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-zinc-800 flex items-center gap-2.5 shadow-lg max-w-[210px]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse relative">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75"></span>
              </span>
              <div>
                <p className="text-[9px] text-emerald-400 uppercase font-black tracking-widest font-mono">Radar Ao Vivo</p>
                <p className="text-[10px] text-zinc-300 font-bold tracking-tight">{useGpsLabel}</p>
              </div>
            </div>
            <div ref={heroMapRef} className="w-full h-full rounded-2xl bg-zinc-900 border border-zinc-900 overflow-hidden" />
          </div>
        </div>
      </section>

      {/* BENTO GRID CARDS */}
      <section className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="text-center md:text-left space-y-1 max-w-xl">
          <span className="text-[9px] text-amber-500 font-black tracking-widest uppercase block font-mono">ESTRATÉGIA E SOLICITUDE</span>
          <h2 className="text-xl md:text-3xl font-black uppercase text-zinc-50 tracking-tight">CUSTO-BENEFÍCIO COMPLETO SOBRE DUAS RODAS</h2>
          <p className="text-xs text-zinc-400 leading-normal">Escolha a rota que melhor se adapta às suas necessidades diárias.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CARD 1 */}
          <div className="group relative overflow-hidden bg-zinc-900 border border-zinc-850 hover:border-amber-500/30 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 shadow-xl min-h-[220px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all"></div>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Bike className="w-5 h-5 stroke-[2]" />
              </div>
              <h3 className="text-base font-black uppercase text-zinc-100 flex items-center gap-1.5">
                Vouali Passageiro <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition" />
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Segurança e rapidez para você chegar bem. Mobilidade premium em {detectedCity} com os melhores condutores da região.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
               <button
                onClick={() => {
                  setSelectedRoleForAuth("client");
                  setAuthMode("signup");
                }}
                className="text-[10px] uppercase font-black tracking-widest text-amber-500 group-hover:text-amber-400 cursor-pointer flex items-center gap-1 border-0 bg-transparent"
              >
                Chamar Agora
              </button>
              <span className="text-[9px] text-zinc-600 font-bold uppercase">#VoualiEChegoBem</span>
            </div>
          </div>

          {/* CARD 2 */}
          <div className="group relative overflow-hidden bg-zinc-900 border border-zinc-850 hover:border-amber-500/30 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 shadow-xl min-h-[220px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all"></div>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Zap className="w-5 h-5 stroke-[2]" />
              </div>
              <h3 className="text-base font-black uppercase text-zinc-100 flex items-center gap-1.5">
                Vouali Flash <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition" />
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Sua entrega chega bem e no prazo. Logística premium para encomendas instantâneas com rastreio total Vouali.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedRoleForAuth("client");
                  setAuthMode("signup");
                }}
                className="text-[10px] uppercase font-black tracking-widest text-amber-500 group-hover:text-amber-400 cursor-pointer flex items-center gap-1 border-0 bg-transparent"
              >
                Enviar Encomenda
              </button>
              <span className="text-[9px] text-zinc-600 font-bold uppercase">Moderno & Rápido</span>
            </div>
          </div>

          {/* CARD 3 */}
          <div className="group relative overflow-hidden bg-zinc-900 border border-zinc-850 hover:border-emerald-500/30 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 shadow-xl min-h-[220px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-5 h-5 stroke-[2]" />
              </div>
              <h3 className="text-base font-black uppercase text-zinc-100 flex items-center gap-1.5">
                Trabalhe Conosco <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition" />
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Faça o seu próprio horário de trabalho. Receba pagamentos via Pix direto dos passageiros sem retenções e aproveite as melhores taxas de repasse do mercado.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedRoleForAuth("driver");
                setAuthMode("signup");
              }}
              className="mt-6 text-[10px] uppercase font-black tracking-widest text-emerald-400 group-hover:text-emerald-350 cursor-pointer flex items-center gap-1 border-0 bg-transparent text-left"
            >
              Iniciar Cadastro de Condutor
            </button>
          </div>
        </div>
      </section>

      {/* METRICS SECTION */}
      <section className="bg-zinc-900/40 border-y border-zinc-900 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="space-y-1">
            <p className="text-3xl md:text-4xl font-black text-amber-500 font-mono">18.5k+</p>
            <p className="text-[10px] text-zinc-400 font-black tracking-widest uppercase">Corridas Finalizadas</p>
          </div>
          <div className="space-y-1">
            <p className="text-3xl md:text-4xl font-black text-white font-mono">15s</p>
            <p className="text-[10px] text-zinc-400 font-black tracking-widest uppercase font-mono">Matching Instantâneo</p>
          </div>
          <div className="space-y-1">
            <p className="text-3xl md:text-4xl font-black text-amber-500 font-mono">0%</p>
            <p className="text-[10px] text-zinc-400 font-black tracking-widest uppercase">Taxas Abusivas Pro</p>
          </div>
          <div className="space-y-1">
            <p className="text-3xl md:text-4xl font-black text-white font-mono">⭐ 4.9</p>
            <p className="text-[10px] text-zinc-400 font-black tracking-widest uppercase">Satisfação {detectedCity}</p>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-500 border border-amber-500/25">
            <Shield className="w-6 h-6 stroke-[2]" />
          </div>
          <span className="text-[10px] text-amber-500 font-mono font-black tracking-widest block uppercase">SEGURANÇA INVIOLÁVEL</span>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white leading-tight">
            SUA SESSÃO E SUAS CORRIDAS MONITORADAS EM TEMPO REAL
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
            Nossa plataforma é integrada diretamente com mecanismos seguros do Google Firebase para a autenticação híbrida. Cada corrida ativa inicia um listener seguro de dados no Supabase. Compartilhe sua rota ativa com parentes e amigos ou utilize nosso chat criptografado.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <p className="text-xs text-zinc-300 font-medium">Histórico transparente no banco de dados Cloud PostgreSQL do Supabase</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <p className="text-xs text-zinc-300 font-medium">Contas de condutores verificadas manualmente por painel administrativo</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <p className="text-xs text-zinc-300 font-medium">Pulsos de geolocalização do condutor reportados em canais em tempo real</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-start gap-4 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 font-black">
              M
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-zinc-100">Mateus Arruda</h4>
                <div className="flex items-center text-amber-500 gap-0.5 text-xs">
                  <Star className="w-3 h-3 fill-amber-500" />
                  <Star className="w-3 h-3 fill-amber-500" />
                  <Star className="w-3 h-3 fill-amber-500" />
                  <Star className="w-3 h-3 fill-amber-500" />
                  <Star className="w-3 h-3 fill-amber-500" />
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-normal">
                "Uso para ir ao trabalho saindo do Caminho das Árvores. O app calcula rápido as tarifas reais, e o mototaxista chega em menos de 4 minutos."
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-start gap-4 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black">
              S
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-zinc-100">Sandro Neves (Parceiro)</h4>
                <div className="flex items-center text-emerald-400 gap-0.5 text-xs">
                  <Star className="w-3 h-3 fill-emerald-400" />
                  <Star className="w-3 h-3 fill-emerald-400" />
                  <Star className="w-3 h-3 fill-emerald-400" />
                  <Star className="w-3 h-3 fill-emerald-400" />
                  <Star className="w-3 h-3 fill-emerald-400" />
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-normal">
                "Faturar dinheiro de verdade no meu celular com repasse por PIX no mesmo segundo foi um divisor de águas. O Vouali valoriza o condutor."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-[9px] text-amber-500 font-black tracking-widest uppercase block font-mono">TIRE SUAS DÚVIDAS</span>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">PERGUNTAS FREQUENTES</h2>
          <p className="text-xs text-zinc-400">Esclareça os detalhes operacionais do nosso sistema de mototáxi eletrônico.</p>
        </div>

        <div className="space-y-3">
          {faqData.map((faq, idx) => (
            <div key={idx} className="border border-zinc-900 rounded-2xl bg-zinc-900/40 overflow-hidden">
              <button
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full px-5 py-4 flex items-center justify-between font-bold text-left text-zinc-200 hover:text-white transition cursor-pointer border-0 bg-transparent"
              >
                <span className="text-xs md:text-sm">{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${activeFaq === idx ? "rotate-180 text-amber-500" : ""}`} />
              </button>
              
              <AnimatePresence initial={false}>
                {activeFaq === idx && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 text-xs text-zinc-400 leading-relaxed border-t border-zinc-950/20 pt-2 bg-zinc-950/10">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* AUTHENTICATION OVERLAY */}
      <AnimatePresence>
        {authMode !== null && (
          <div className="fixed inset-0 z-[2024] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setAuthMode(null); setAuthError(null); }}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl z-10 overflow-hidden space-y-6"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-600"></div>

              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-1.5">
                    {authMode === "login" ? "Entrar na Conta" : "Criar Nova Conta"}
                  </h3>
                  <span className={`inline-block mt-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                    selectedRoleForAuth === "client" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/11 text-emerald-400"
                  }`}>
                    {selectedRoleForAuth === "client" ? "Acesso Passageiro / Vouali Flash" : "Acesso de Condutor Oficial"}
                  </span>
                </div>
                
                <button
                  onClick={() => { setAuthMode(null); setAuthError(null); }}
                  className="p-1 px-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all text-xs cursor-pointer font-bold uppercase"
                >
                  X
                </button>
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={authMode === "login" ? handleEmailLogin : handleEmailSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Endereço de E-mail</label>
                  <div className="relative">
                    <Mail className="absolute top-2.5 left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      placeholder="seu_email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 placeholder-zinc-700 rounded-xl py-2.5 pl-9 pr-3 text-xs outline-none focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 font-sans">
                  <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Senha de Acesso</label>
                  <div className="relative">
                    <Lock className="absolute top-2.5 left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 placeholder-zinc-700 rounded-xl py-2.5 pl-9 pr-3 text-xs outline-none focus:border-amber-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-zinc-950 font-black uppercase py-3 rounded-xl transition text-xs tracking-wider cursor-pointer flex items-center justify-center gap-1.5 h-11 shadow-lg"
                >
                  {authLoading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : (authMode === "login" ? "Conectar E-mail" : "Cadastrar E-mail")}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-zinc-800" />
                <span className="flex-shrink mx-3 text-[8px] text-zinc-500 font-black uppercase tracking-widest font-mono">OU AUTENTIQUE VIA</span>
                <div className="flex-grow border-t border-zinc-800" />
              </div>

              <div className="space-y-3 font-sans">
                {settings.socialLogin?.google?.active && (
                  <button
                    onClick={handleGoogleLogin}
                    disabled={authLoading}
                    className="w-full bg-zinc-950 hover:bg-zinc-850 text-white font-black border border-zinc-850 hover:border-zinc-800 tracking-wider uppercase py-2.5 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-2 h-11 relative overflow-hidden group active:scale-[0.98]"
                  >
                    <Chrome className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" /> 
                    <span>Conectar com Google</span>
                    {authLoading && (
                      <div className="absolute inset-0 bg-zinc-950/50 flex items-center justify-center backdrop-blur-[1px]">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      </div>
                    )}
                  </button>
                )}

                {settings.socialLogin?.facebook?.active && (
                  <button
                    onClick={handleFacebookLogin}
                    disabled={authLoading}
                    className="w-full bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] font-black border border-[#1877F2]/30 hover:border-[#1877F2]/50 tracking-wider uppercase py-2.5 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-2 h-11 relative overflow-hidden group active:scale-[0.98]"
                  >
                    <Facebook className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Conectar com Facebook</span>
                    {authLoading && (
                      <div className="absolute inset-0 bg-[#1877F2]/10 flex items-center justify-center backdrop-blur-[1px]">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      </div>
                    )}
                  </button>
                )}

                {settings.socialLogin?.instagram?.active && (
                  <button
                    onClick={handleInstagramLogin}
                    disabled={authLoading}
                    className="w-full bg-gradient-to-tr from-[#f09433]/15 via-[#dc2743]/15 to-[#bc1888]/15 hover:from-[#f09433]/25 hover:via-[#dc2743]/25 hover:to-[#bc1888]/25 text-pink-500 font-black border border-pink-500/30 hover:border-pink-500/50 tracking-wider uppercase py-2.5 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-2 h-11 relative overflow-hidden group active:scale-[0.98]"
                  >
                    <Instagram className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Conectar com Instagram</span>
                    {authLoading && (
                      <div className="absolute inset-0 bg-zinc-950/10 flex items-center justify-center backdrop-blur-[1px]">
                        <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                      </div>
                    )}
                  </button>
                )}

                <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-3.5 space-y-2">
                  <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider block flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" /> Login via WhatsApp (OTP)
                  </span>
                  
                  {whatsappStep === "phone" ? (
                    <div className="flex gap-2.5 font-sans">
                      <div className="relative flex-1">
                        <Phone className="absolute top-2 left-2.5 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="(XX) XXXXX-XXXX"
                        value={phoneNumber}
                        onChange={(e) => handlePhoneMask(e.target.value, setPhoneNumber)}
                        className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 placeholder-zinc-700 rounded-lg py-1.5 pl-8 pr-2 text-xs outline-none focus:border-emerald-500 transition-all font-mono font-medium"
                      />
                      </div>
                      <button
                        onClick={handleSendWhatsAppOTP}
                        disabled={authLoading || !phoneNumber}
                        className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-50 transition cursor-pointer"
                      >
                        Enviar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5 animate-fade-in font-sans">
                      <p className="text-[9px] text-emerald-400 font-bold tracking-wider">✓ Código enviado ao WhatsApp! Informe:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="CÓDIGO 6-DÍGITOS"
                          maxLength={6}
                          value={whatsappCode}
                          onChange={(e) => setWhatsappCode(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-zinc-850 text-zinc-100 text-center rounded-lg py-1.5 text-xs outline-none focus:border-amber-500 transition-all font-mono tracking-widest font-bold"
                        />
                        <button
                          onClick={handleVerifyWhatsAppOTP}
                          disabled={authLoading || whatsappCode.length < 6}
                          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                      <button 
                        onClick={() => { setWhatsappStep("phone"); setVerificationId(null); }}
                        className="text-[8px] text-zinc-500 uppercase font-black hover:text-zinc-400 cursor-pointer text-left"
                      >
                        Alterar número
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login");
                    setAuthError(null);
                  }}
                  className="text-[10px] uppercase font-black tracking-widest text-zinc-400 hover:text-amber-500 underline decoration-dotted transition border-0 bg-transparent cursor-pointer"
                >
                  {authMode === "login" ? "Ainda não possui conta? Cadastre-se" : "Já tem registro cadastrado? Conectar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILED PROFILE CREATION */}
      <AnimatePresence>
        {isRegistering !== null && (
          <div className="fixed inset-0 z-[2025] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="pb-3 border-b border-zinc-800">
                <h3 className="text-sm font-black uppercase text-zinc-100 flex items-center gap-2">
                  {isRegistering === "client" ? (
                    <>
                      <User className="w-5 h-5 text-amber-500" /> Perfil de Passageiro Vouali
                    </>
                  ) : (
                    <>
                      <Bike className="w-5 h-5 text-emerald-400" /> Credenciamento de Condutor
                    </>
                  )}
                </h3>
                <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                  Preencha os dados abaixo com precisão real. Suas localizações e rotas serão integradas.
                </p>
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={isRegistering === "client" ? handleRegisterClient : handleRegisterDriver} className="space-y-4">
                
                {/* PHOTO PREVIEW */}
                <div className="flex items-center gap-3.5 bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-850">
                  <div className="relative w-12 h-12 bg-zinc-900 rounded-full border border-zinc-850 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-4.5 h-4.5 text-zinc-500" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block font-mono">Foto de Identificação</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      className="block text-[8px] text-zinc-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[8px] file:font-black file:bg-zinc-800 file:text-zinc-200 file:cursor-pointer hover:file:bg-zinc-700"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Pedro Henrique"
                    className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 focus:border-amber-500 rounded-xl py-2.5 px-3 text-xs outline-none transition font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono">Contato (WhatsApp)</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => handlePhoneMask(e.target.value, setPhone)}
                    placeholder="Ex: (71) 98888-2222"
                    className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 focus:border-amber-500 rounded-xl py-2.5 px-3 text-xs outline-none transition font-medium"
                  />
                </div>

                {isRegistering === "driver" && (
                  <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono">Tipo do Veículo</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setVehicleType("moto");
                            setCategories(["moto"]);
                            setPassengers("1");
                          }}
                          className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition flex items-center justify-center gap-2 cursor-pointer ${
                            vehicleType === "moto" 
                              ? "bg-amber-500/10 border-amber-500 text-amber-500" 
                              : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:border-zinc-700"
                          }`}
                        >
                          <Bike className="w-3.5 h-3.5" /> Moto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVehicleType("carro");
                            setCategories(["carro"]);
                            setPassengers("4");
                          }}
                          className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition flex items-center justify-center gap-2 cursor-pointer ${
                            vehicleType === "carro" 
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                              : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:border-zinc-700"
                          }`}
                        >
                          <Navigation className="w-3.5 h-3.5" /> Carro
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono">Categorias Aceitas</label>
                      <div className="grid grid-cols-2 gap-2">
                        {vehicleType === "moto" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const newCats = categories.includes("moto") 
                                  ? categories.filter(c => c !== "moto") 
                                  : [...categories, "moto" as ModalidadeCorrida];
                                setCategories(newCats);
                              }}
                              className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition cursor-pointer ${
                                categories.includes("moto") 
                                  ? "bg-amber-500/10 border-amber-500 text-amber-500" 
                                  : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:border-zinc-700"
                              }`}
                            >
                              Moto
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newCats = categories.includes("moto_flash") 
                                  ? categories.filter(c => c !== "moto_flash") 
                                  : [...categories, "moto_flash" as ModalidadeCorrida];
                                setCategories(newCats);
                              }}
                              className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition cursor-pointer ${
                                categories.includes("moto_flash") 
                                  ? "bg-amber-500/10 border-amber-500 text-amber-500" 
                                  : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:border-zinc-700"
                              }`}
                            >
                              Moto Flash
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const newCats = categories.includes("carro") 
                                  ? categories.filter(c => c !== "carro") 
                                  : [...categories, "carro" as ModalidadeCorrida];
                                setCategories(newCats);
                              }}
                              className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition cursor-pointer ${
                                categories.includes("carro") 
                                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                                  : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:border-zinc-700"
                              }`}
                            >
                              Carro
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newCats = categories.includes("carro_flash") 
                                  ? categories.filter(c => c !== "carro_flash") 
                                  : [...categories, "carro_flash" as ModalidadeCorrida];
                                setCategories(newCats);
                              }}
                              className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition cursor-pointer ${
                                categories.includes("carro_flash") 
                                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                                  : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:border-zinc-700"
                              }`}
                            >
                              Carro Flash
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono">Modelo do Veículo</label>
                        <input
                          type="text"
                          required
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          placeholder="Ex: Honda Titan 160"
                          className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 focus:border-amber-500 rounded-xl py-2 px-3 text-xs outline-none transition font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono">Placa do Veículo</label>
                        <input
                          type="text"
                          required
                          maxLength={8}
                          value={plate}
                          onChange={(e) => setPlate(e.target.value)}
                          placeholder="ABC1D23"
                          className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 focus:border-amber-500 rounded-xl py-2 px-3 text-xs outline-none uppercase transition font-medium font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono">Cor do Veículo</label>
                        <input
                          type="text"
                          required
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          placeholder="Ex: Preto"
                          className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 focus:border-amber-500 rounded-xl py-2 px-3 text-xs outline-none transition font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono">Capacidade</label>
                        
                        {/* Select Personalizado estilizado */}
                        <select
                          value={passengers}
                          onChange={(e) => setPassengers(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 focus:border-amber-500 rounded-xl py-2 px-3 text-xs outline-none transition font-medium cursor-pointer"
                        >
                          {vehicleType === "moto" ? (
                            <option value="1">1 Passageiro</option>
                          ) : (
                            <>
                              <option value="1">1 Passageiro</option>
                              <option value="2">2 Passageiros</option>
                              <option value="3">3 Passageiros</option>
                              <option value="4">4 Passageiros</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 font-sans">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono font-bold">Cobrança/KM (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={rate}
                          onChange={(e) => setRate(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 focus:border-amber-500 rounded-xl py-2 px-3 text-xs outline-none transition font-medium font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block font-mono font-sans font-bold">Taxa de Saída (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={base}
                          onChange={(e) => setBase(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-850 text-zinc-100 focus:border-amber-500 rounded-xl py-2 px-3 text-xs outline-none transition font-medium font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-zinc-950 font-black uppercase py-3.5 rounded-xl transition text-xs tracking-wider cursor-pointer flex items-center justify-center gap-1.5 h-11 shadow-lg"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" /> Salvando Perfil...
                    </>
                  ) : "Finalizar Cadastro"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
