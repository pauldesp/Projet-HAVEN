
import { Listing, User, UserRole, Booking } from '../types';

// --- MOCK USERS DATABASE ---
export const MOCK_USERS_DB: User[] = [
  {
    id: 'user-fresh-123',
    firstName: 'Thomas',
    lastName: 'Dubois',
    email: 'thomas@example.com',
    password: 'password123', 
    avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    role: UserRole.TENANT,
    status: 'APPROVED',
    isVerified: true,
    bio: "Étudiant en quête de nouvelles aventures.",
    school: "HEC Paris"
  },
  {
    id: 'user-paul-456',
    firstName: 'Paul',
    lastName: 'Desplanques',
    email: 'paul.desplanques@gmail.com',
    password: 'P@uldesp1', 
    avatarUrl: 'https://ui-avatars.com/api/?name=Paul+Desplanques&background=1E293B&color=fff',
    role: UserRole.ADMIN,
    status: 'APPROVED',
    isVerified: true,
    bio: "Super-Administrateur HAVEN",
    school: "EPITECH"
  },
  {
    id: 'admin-1',
    firstName: 'Admin',
    lastName: 'System',
    email: 'admin@haven.com',
    password: 'admin', 
    avatarUrl: 'https://ui-avatars.com/api/?name=Admin+Haven&background=9A073C&color=fff',
    role: UserRole.ADMIN,
    status: 'APPROVED',
    isVerified: true
  },
  {
    id: 'user-sophie-789',
    firstName: 'Sophie',
    lastName: 'Martin',
    email: 'sophie@example.com',
    password: 'password123',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    role: UserRole.OWNER,
    status: 'APPROVED',
    isVerified: true,
    bio: "Passionnée d'architecture et de colocation.",
    school: "École Boulle"
  },
  {
    id: 'user-lucas-101',
    firstName: 'Lucas',
    lastName: 'Bernard',
    email: 'lucas@example.com',
    password: 'password123',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    role: UserRole.OWNER,
    status: 'APPROVED',
    isVerified: true,
    bio: "Propriétaire depuis 5 ans, j'aime partager mes bons plans.",
    school: "EM Lyon"
  }
];

export const MOCK_TENANTS = MOCK_USERS_DB.filter(u => u.role === UserRole.TENANT);
export const CURRENT_USER: User = MOCK_USERS_DB[0];

// --- MOCK LISTINGS ---
export const MOCK_LISTINGS: Listing[] = [
  {
    id: 'l-jouy-99',
    title: 'La Villa Horizon - HEC Campus',
    description: 'Maison d\'architecte avec vue imprenable sur la vallée. Jardin partagé, potager bio et salon cinéma. À 5 min du campus HEC.',
    city: 'Jouy-en-Josas',
    address: '18 Rue de la Mairie',
    coordinates: { lat: 48.7667, lng: 2.1667 },
    type: 'HOUSE',
    status: 'APPROVED',
    totalRooms: 4,
    availableRooms: 1,
    surface: 140,
    amenities: ['Wifi Fibre', 'Netflix', 'Jardin', 'Vélos électriques'],
    ownerId: 'user-paul-456', 
    mainPhotoUrl: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    galleryUrls: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3'],
    reviewsCount: 0,
    rating: 0,
    isMixed: true,
    bathrooms: 2,
    minStay: 2,
    cleaningFee: 15,
    views: 450,
    rooms: [
      { id: 'r99-1', name: 'La Canopée (Suite)', pricePerDay: 46, size: 22, hasPrivateBath: true, bedSize: 'King', isAvailable: false, photoUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf' },
      { id: 'r99-2', name: 'Chambre Zen', pricePerDay: 37, size: 15, hasPrivateBath: false, bedSize: 'Double', isAvailable: true, photoUrl: 'https://images.unsplash.com/photo-1505693416388-b0346ef4143d' }
    ]
  },
  {
    id: 'l1',
    title: 'Loft d\'artiste Marais',
    description: 'Au coeur de Paris, loft atypique avec grande hauteur sous plafond. Colocation internationale (ESSEC, Sciences Po).',
    city: 'Paris',
    address: '15 Rue des Archives',
    coordinates: { lat: 48.8584, lng: 2.3538 },
    type: 'APARTMENT',
    status: 'APPROVED',
    totalRooms: 4,
    availableRooms: 1,
    surface: 110,
    amenities: ['Wifi Fibre', 'Ménage', 'Netflix', 'Piano'],
    ownerId: 'user-paul-456', 
    mainPhotoUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    galleryUrls: ['https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?ixlib=rb-4.0.3'],
    rating: 0,
    reviewsCount: 0,
    isMixed: true,
    bathrooms: 1,
    minStay: 3,
    cleaningFee: 25,
    views: 340,
    rooms: [
      { id: 'r1-1', name: 'Chambre Atelier', pricePerDay: 36, size: 16, hasPrivateBath: false, bedSize: 'Double', isAvailable: true, photoUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf' },
      { id: 'r1-2', name: 'Chambre Mezzanine', pricePerDay: 40, size: 18, hasPrivateBath: true, bedSize: 'Queen', isAvailable: false, photoUrl: 'https://images.unsplash.com/photo-1505693416388-b0346ef4143d' }
    ]
  },
  {
    id: 'l-lyon-1',
    title: 'Le Cocon des Canuts - Croix-Rousse',
    description: 'Appartement typique lyonnais avec pierres apparentes et mezzanine. Proche du métro et des commerces.',
    city: 'Lyon',
    address: '12 Rue de Belfort',
    coordinates: { lat: 45.7742, lng: 4.8317 },
    type: 'APARTMENT',
    status: 'APPROVED',
    totalRooms: 3,
    availableRooms: 2,
    surface: 85,
    amenities: ['Wifi Fibre', 'Lave-linge', 'Cuisine équipée'],
    ownerId: 'user-lucas-101',
    mainPhotoUrl: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    galleryUrls: ['https://images.unsplash.com/photo-1560448204-603b3fc33ddc?ixlib=rb-4.0.3'],
    rating: 0,
    reviewsCount: 0,
    isMixed: true,
    bathrooms: 1,
    minStay: 2,
    cleaningFee: 15,
    views: 210,
    rooms: [
      { id: 'r-lyon-1-1', name: 'Chambre Bellecour', pricePerDay: 26, size: 12, hasPrivateBath: false, bedSize: 'Double', isAvailable: true, photoUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af' },
      { id: 'r-lyon-1-2', name: 'Chambre Fourvière', pricePerDay: 28, size: 14, hasPrivateBath: false, bedSize: 'Double', isAvailable: true, photoUrl: 'https://images.unsplash.com/photo-1540518614846-7eded433c457' }
    ]
  },
  {
    id: 'l-bordeaux-1',
    title: 'Bordeaux Vintage Loft',
    description: 'Loft spacieux dans un ancien chai. Décoration vintage et terrasse ensoleillée. Idéal pour étudiants.',
    city: 'Bordeaux',
    address: '45 Quai des Chartrons',
    coordinates: { lat: 44.8547, lng: -0.5667 },
    type: 'APARTMENT',
    status: 'APPROVED',
    totalRooms: 2,
    availableRooms: 1,
    surface: 75,
    amenities: ['Wifi Fibre', 'Terrasse', 'Climatisation'],
    ownerId: 'user-sophie-789',
    mainPhotoUrl: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    galleryUrls: ['https://images.unsplash.com/photo-1524758631624-e2822e304c36?ixlib=rb-4.0.3'],
    rating: 0,
    reviewsCount: 0,
    isMixed: false,
    bathrooms: 1,
    minStay: 2,
    cleaningFee: 20,
    views: 185,
    rooms: [
      { id: 'r-bdx-1-1', name: 'Chambre Merlot', pricePerDay: 30, size: 15, hasPrivateBath: true, bedSize: 'Queen', isAvailable: true, photoUrl: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a' },
      { id: 'r-bdx-1-2', name: 'Chambre Cabernet', pricePerDay: 27, size: 13, hasPrivateBath: false, bedSize: 'Double', isAvailable: false, photoUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf' }
    ]
  },
  {
    id: 'l-marseille-1',
    title: 'Appartement Vue Mer - Vieux Port',
    description: 'Réveillez-vous avec la vue sur le Vieux Port. Appartement lumineux et moderne.',
    city: 'Marseille',
    address: '2 Rue de la République',
    coordinates: { lat: 43.2965, lng: 5.3698 },
    type: 'APARTMENT',
    status: 'APPROVED',
    totalRooms: 3,
    availableRooms: 1,
    surface: 90,
    amenities: ['Wifi Fibre', 'Vue Mer', 'Ascenseur'],
    ownerId: 'user-lucas-101',
    mainPhotoUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    galleryUrls: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?ixlib=rb-4.0.3'],
    rating: 0,
    reviewsCount: 0,
    isMixed: true,
    bathrooms: 2,
    minStay: 4,
    cleaningFee: 30,
    views: 520,
    rooms: [
      { id: 'r-mrs-1-1', name: 'Suite Azur', pricePerDay: 34, size: 20, hasPrivateBath: true, bedSize: 'King', isAvailable: true, photoUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf' }
    ]
  },
  {
    id: 'l-lille-1',
    title: 'Maison de Maître - Vieux Lille',
    description: 'Magnifique maison bourgeoise avec jardin privé. Charme de l\'ancien et confort moderne.',
    city: 'Lille',
    address: '10 Rue de la Monnaie',
    coordinates: { lat: 50.6333, lng: 3.0667 },
    type: 'HOUSE',
    status: 'APPROVED',
    totalRooms: 5,
    availableRooms: 3,
    surface: 200,
    amenities: ['Wifi Fibre', 'Jardin', 'Cheminée', 'Parking'],
    ownerId: 'user-sophie-789',
    mainPhotoUrl: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    galleryUrls: ['https://images.unsplash.com/photo-1513584684374-8bdb74838a0f?ixlib=rb-4.0.3'],
    rating: 0,
    reviewsCount: 0,
    isMixed: true,
    bathrooms: 3,
    minStay: 2,
    cleaningFee: 40,
    views: 310,
    rooms: [
      { id: 'r-lille-1-1', name: 'Chambre Flamande', pricePerDay: 23, size: 14, hasPrivateBath: false, bedSize: 'Double', isAvailable: true, photoUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af' },
      { id: 'r-lille-1-2', name: 'Chambre Beffroi', pricePerDay: 25, size: 16, hasPrivateBath: true, bedSize: 'Double', isAvailable: true, photoUrl: 'https://images.unsplash.com/photo-1540518614846-7eded433c457' },
      { id: 'r-lille-1-3', name: 'Chambre Nord', pricePerDay: 21, size: 12, hasPrivateBath: false, bedSize: 'Single', isAvailable: true, photoUrl: 'https://images.unsplash.com/photo-1505693416388-b0346ef4143d' }
    ]
  }
];

// --- SEED BOOKINGS ---
export const SEED_BOOKINGS: Booking[] = [
  {
    id: 'b-thomas-canopee',
    listingId: 'l-jouy-99',
    roomId: 'r99-1',
    tenantId: 'user-fresh-123', // Thomas
    ownerId: 'user-paul-456',
    startDate: '2026-04-01',
    endDate: '2026-10-15',
    status: 'CONFIRMED',
    basePrice: 8000,
    cleaningFee: 15,
    platformFee: 1200,
    totalPrice: 9215,
    createdAt: '2026-03-15T10:00:00Z'
  },
  {
    id: 'b-test-1',
    listingId: 'l-lyon-1',
    roomId: 'r-lyon-1-1',
    tenantId: 'user-fresh-123',
    ownerId: 'user-lucas-101',
    startDate: '2026-04-20',
    endDate: '2026-04-21',
    status: 'CONFIRMED',
    basePrice: 52,
    cleaningFee: 15,
    platformFee: 7.8,
    totalPrice: 74.8,
    createdAt: '2026-04-10T14:30:00Z'
  },
  {
    id: 'b-test-2',
    listingId: 'l-bordeaux-1',
    roomId: 'r-bdx-1-2',
    tenantId: 'user-fresh-123',
    ownerId: 'user-sophie-789',
    startDate: '2026-05-10',
    endDate: '2026-05-17',
    status: 'PENDING',
    basePrice: 210,
    cleaningFee: 20,
    platformFee: 31.5,
    totalPrice: 261.5,
    createdAt: '2026-04-05T09:15:00Z'
  }
];

export interface BookingWithDetails extends Booking {
  tenant: User;
  listing: Listing;
  roomName: string;
}

export const MOCK_BOOKINGS: BookingWithDetails[] = SEED_BOOKINGS.map(sb => ({
  ...sb,
  tenant: MOCK_USERS_DB[0],
  listing: MOCK_LISTINGS.find(l => l.id === sb.listingId)!,
  roomName: 'La Canopée (Suite)'
}));
