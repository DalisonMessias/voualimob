import { MototaxistaProfile, RideRequestItem } from "../types";

// Dynamic names generator
const FIRST_NAMES = ["Thiago", "Marcos", "Bruno", "Rodrigo", "Gabriel", "Ramon", "Alex", "Diego", "Lucas"];
const LAST_NAMES = ["Silva", "Oliveira", "Santos", "Souza", "Pereira", "Almeida", "Rodrigues", "Lima"];
const MOTORCYCLES = [
  { modelo: "Honda CG 160 Titan", cor: "Vermelha" },
  { modelo: "Yamaha YBR 150 Factor", cor: "Preta" },
  { modelo: "Honda CB 250F Twister", cor: "Azul" },
  { modelo: "Yamaha Fazer 250", cor: "Cinza Metálico" },
  { modelo: "Honda Biz 125", cor: "Branca" }
];

// Helper to generate a random plate standard BR
export function generatePlaca(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const num1 = Math.floor(Math.random() * 10);
  const letter = letters[Math.floor(Math.random() * letters.length)];
  const num23 = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `${prefix}-${num1}${letter}${num23}`;
}

// Generate realistic nearby drivers based on a center point [lat, lng]
export function generateNearbyDrivers(center: [number, number], count: number = 3): MototaxistaProfile[] {
  const drivers: MototaxistaProfile[] = [];
  const [centerLat, centerLng] = center;

  for (let i = 0; i < count; i++) {
    // Generate slight offset (approx 0.5 to 3.0 KM)
    // 0.01 degrees is roughly 1.1 KM
    const latOffset = (Math.random() - 0.5) * 0.025;
    const lngOffset = (Math.random() - 0.5) * 0.025;
    
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const moped = MOTORCYCLES[Math.floor(Math.random() * MOTORCYCLES.length)];
    
    const driverId = `driver_sim_${i + 1}`;

    drivers.push({
      id: driverId,
      name: `${firstName} ${lastName}`,
      phone: `(71) 99${Math.floor(Math.random() * 9)}` + Math.floor(Math.random() * 900000).toString().padStart(6, "0"),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${driverId}`,
      valorKm: parseFloat((1.5 + Math.random() * 1.5).toFixed(2)), // R$ 1.50 - R$ 3.00
      taxaSaida: parseFloat((4.0 + Math.random() * 3.0).toFixed(2)),  // R$ 4.00 - R$ 7.00
      raioMaximo: parseFloat((3.0 + Math.random() * 5.0).toFixed(1)),  // 3.0 - 8.0 KM
      modalidades: Math.random() > 0.4 ? ["moto", "moto_flash"] : ["moto"], // Accepted modes
      online: true,
      currentCoords: [centerLng + lngOffset, centerLat + latOffset], // [lng, lat] for leaflets/ORS standards
      rating: parseFloat((4.5 + Math.random() * 0.5).toFixed(1)),
      veiculoPlaca: generatePlaca(),
      veiculoModelo: `${moped.modelo} (${moped.cor})`,
      veiculoTipo: "moto",
      
      // Admin and Wallet properties for simulation sanity
      approved: "aprovado",
      creditsBalance: 150.00,
      cnhUrl: "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=500&auto=format&fit=crop",
      motoDocUrl: "https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=500&auto=format&fit=crop",
      selfieUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop"
    });
  }

  return drivers;
}

// Haversine formula to compute straight line distance in KM
export function haversineDistance(coords1: [number, number], coords2: [number, number]): number {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371; // Earth's Radius
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Generate animated driver steps list along a polyline geometry
export function getRouteSteps(geometry: [number, number][], interval: number = 3): [number, number][] {
  if (!geometry || geometry.length === 0) return [];
  
  // Return a subset of coordinates to make movement progression more visible/smoother
  const steps: [number, number][] = [];
  
  for (let i = 0; i < geometry.length; i += interval) {
    steps.push(geometry[i]);
  }
  
  // Ensure we include the absolute destination point
  if (geometry.length > 0) {
    const last = geometry[geometry.length - 1];
    if (steps.length === 0 || steps[steps.length - 1][0] !== last[0] || steps[steps.length - 1][1] !== last[1]) {
      steps.push(last);
    }
  }
  
  return steps;
}
