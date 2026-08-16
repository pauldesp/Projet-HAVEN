
import { apiService } from './api';
import { Listing, UserRole, Room, Report } from '../types';

const CITIES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Nantes', 'Strasbourg', 'Montpellier'];
const TYPES: ('HOUSE' | 'APARTMENT')[] = ['HOUSE', 'APARTMENT'];
const AMENITIES = ['Wifi', 'Lave-linge', 'Lave-vaisselle', 'Cuisine équipée', 'Balcon', 'Terrasse', 'Jardin', 'Parking', 'Ascenseur', 'Climatisation', 'Proche métro', 'Espace de travail'];
const BED_SIZES: ('Single' | 'Double' | 'Queen' | 'King')[] = ['Single', 'Double', 'Queen', 'King'];

const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomAmenities = (): string[] => {
  const count = getRandomInt(3, 8);
  const shuffled = [...AMENITIES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const generateRooms = (count: number): Room[] => {
  const rooms: Room[] = [];
  for (let i = 1; i <= count; i++) {
    rooms.push({
      id: `room-${Math.random().toString(36).substr(2, 9)}`,
      name: `Chambre ${i}`,
      pricePerDay: getRandomInt(20, 45),
      size: getRandomInt(10, 20),
      hasPrivateBath: Math.random() > 0.7,
      bedSize: getRandomElement(BED_SIZES),
      isAvailable: true,
      photoUrl: `https://images.unsplash.com/photo-${getRandomInt(1500000000000, 1600000000000)}?q=80&w=1000&auto=format&fit=crop`,
      hasDesk: true,
      hasLock: true,
      hasWardrobe: true,
      roomPhotos: []
    });
  }
  return rooms;
};

export const seedListings = async (ownerId: string = 'seed-owner-id') => {
  const listings: Listing[] = [];
  
  for (let i = 1; i <= 20; i++) {
    const totalRooms = getRandomInt(2, 6);
    const rooms = generateRooms(totalRooms);
    const city = getRandomElement(CITIES);
    
    const listing: Listing = {
      id: `listing-seed-${i}-${Math.random().toString(36).substr(2, 5)}`,
      title: `${getRandomElement(['Magnifique', 'Superbe', 'Charmant', 'Moderne', 'Spacieux'])} ${getRandomElement(['Appartement', 'Maison', 'Loft'])} à ${city}`,
      description: `Découvrez cette colocation idéale pour étudiants et jeunes actifs. Située dans un quartier calme et dynamique de ${city}, cette propriété offre tout le confort nécessaire pour une expérience de vie partagée exceptionnelle. Proche des transports et des commerces.`,
      city: city,
      address: `${getRandomInt(1, 150)} Rue de la Paix, ${city}`,
      coordinates: {
        lat: 48.8566 + (Math.random() - 0.5) * 0.1,
        lng: 2.3522 + (Math.random() - 0.5) * 0.1
      },
      type: getRandomElement(TYPES),
      status: 'APPROVED',
      totalRooms: totalRooms,
      availableRooms: totalRooms,
      surface: getRandomInt(60, 150),
      minStay: getRandomInt(1, 4),
      amenities: getRandomAmenities(),
      ownerId: ownerId,
      mainPhotoUrl: `https://images.unsplash.com/photo-${getRandomInt(1500000000000, 1600000000000)}?q=80&w=1200&auto=format&fit=crop`,
      galleryUrls: [
        `https://images.unsplash.com/photo-${getRandomInt(1500000000000, 1600000000000)}?q=80&w=800&auto=format&fit=crop`,
        `https://images.unsplash.com/photo-${getRandomInt(1500000000000, 1600000000000)}?q=80&w=800&auto=format&fit=crop`,
        `https://images.unsplash.com/photo-${getRandomInt(1500000000000, 1600000000000)}?q=80&w=800&auto=format&fit=crop`
      ],
      rooms: rooms,
      rating: Number((Math.random() * 2 + 3).toFixed(1)),
      reviewsCount: getRandomInt(0, 50),
      isMixed: Math.random() > 0.3,
      bathrooms: getRandomInt(1, 3),
      cleaningFee: getRandomInt(10, 50),
      views: getRandomInt(100, 2000)
    };
    
    await apiService.listings.create(listing);
    listings.push(listing);
  }
  
  return listings;
};

export const seedReports = async () => {
  const reports: Report[] = [
    {
      id: 'rep-1',
      reporterId: 'user-fresh-123',
      targetId: 'l-jouy-99',
      targetType: 'LISTING',
      reason: 'INACCURATE',
      description: "Les photos ne correspondent pas à la réalité, la piscine est en travaux.",
      status: 'NEW',
      timestamp: new Date().toISOString()
    },
    {
      id: 'rep-2',
      reporterId: 'user-fresh-123',
      targetId: 'user-sophie-789',
      targetType: 'USER',
      reason: 'OFFENSIVE',
      description: "Le propriétaire a été très impoli lors de nos échanges par message.",
      status: 'NEW',
      timestamp: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'rep-3',
      reporterId: 'user-paul-456',
      targetId: 'none',
      targetType: 'TECHNICAL',
      reason: 'TECHNICAL_ISSUE',
      description: "Impossible de télécharger mon document d'identité sur mobile.",
      status: 'INVESTIGATING',
      timestamp: new Date(Date.now() - 172800000).toISOString()
    }
  ];

  for (const report of reports) {
    await apiService.reports.create(report);
  }
  console.log("Successfully seeded 3 reports.");
};
