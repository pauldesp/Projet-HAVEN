
// Définition des rôles utilisateurs
export enum UserRole {
  TENANT = 'TENANT',
  OWNER = 'OWNER',
  PROVIDER = 'PROVIDER',
  ADMIN = 'ADMIN'
}

export type ListingStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Interface Utilisateur
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  marketingOptIn?: boolean;
  legalAccepted?: boolean;
  avatarUrl: string;
  role: UserRole;
  status?: UserStatus;
  rejectionReason?: string;
  isVerified?: boolean;
  city?: string;
  bio?: string;
  school?: string;
  job?: string;
  idDocumentUrl?: string;
  idVerifiedAt?: string;
  createdAt?: string;
  rating?: number;
  reviewsCount?: number;
  favorites?: string[]; // Array of listing IDs
  /** Consentement explicite pour apparaître auprès des futurs colocataires. */
  shareProfileWithHousemates?: boolean;
  documents?: {
    idCard?: string;
    proofOfIncome?: string;
    studentCard?: string;
  };
}

// Type de chambre
export interface Room {
  id: string;
  name: string;
  /** Tarif par nuit en euros. Nom historique conservé pour les annonces existantes. */
  pricePerDay: number;
  size: number; // m2
  hasPrivateBath: boolean;
  bedSize: 'Single' | 'Double' | 'Queen' | 'King';
  isAvailable: boolean;
  photoUrl: string;
  hasDesk?: boolean;
  hasLock?: boolean;
  hasWardrobe?: boolean;
  roomPhotos?: string[]; // Une photo spécifique à la chambre au maximum
  blockedDates?: string[]; // ISO date strings
}

// Coordonnées GPS
export interface Coordinates {
  lat: number;
  lng: number;
}

// Type de logement
export interface Listing {
  id: string;
  title: string;
  description: string;
  city: string;
  address: string;
  coordinates: Coordinates;
  type: 'HOUSE' | 'APARTMENT';
  status: ListingStatus;
  rejectionReason?: string;
  totalRooms: number;
  availableRooms: number;
  surface: number;
  amenities: string[];
  ownerId: string;
  mainPhotoUrl: string;
  galleryUrls: string[]; // Cinq photos de logement au maximum, photo principale comprise
  rooms: Room[];
  rating: number;
  reviewsCount: number;
  bathrooms: number;
  minStay: number; // Minimum number of nights; default 4, owner-configurable (>= 1).
  cleaningFee: number; // Fixed cleaning fee for the listing
  bookingMode?: 'INSTANT' | 'MANUAL'; // Mode de réservation (Instantannée ou Manuelle)
  /** Horaires locaux définis par le propriétaire pour les états des lieux. */
  checkInTime?: string;
  checkOutTime?: string;
  blockedDates?: string[]; // ISO date strings (blocked for entire house)
  views?: number;
  occupants?: {
    id: string;
    firstName: string;
    avatarUrl: string;
    school?: string;
  }[];
}

// Type de réservation
export interface Booking {
  id: string;
  listingId: string;
  roomId: string;
  tenantId: string;
  ownerId: string; // Added to facilitate owner dashboard queries
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  basePrice: number; // Price for the duration without fees
  cleaningFee: number; // Cleaning fee charged
  platformFee: number; // Platform fee charged (15%)
  totalPrice: number; // Sum of all
  checkInReportId?: string;
  checkOutReportId?: string;
  createdAt: string;
  listing?: {
    title: string;
    city: string;
    mainPhotoUrl: string;
  };
  roomName?: string;
  paymentStatus?: 'PENDING' | 'PAID';
  bookingMode?: 'INSTANT' | 'MANUAL';
  approvedAt?: string;
}

// Public calendar record. It intentionally contains no user or payment data.
export interface BookingAvailability {
  id: string;
  bookingId: string;
  listingId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  status: Booking['status'];
  updatedAt: string;
}

/** Safe public subset shown to a logged-in future housemate. */
export interface HousematePreview {
  id: string;
  firstName: string;
  avatarUrl: string;
  age?: number;
  activity?: string;
  startDate: string;
  endDate: string;
  overlapStart: string;
  overlapEnd: string;
}

// Type État des Lieux
export interface InventoryItem {
  name: string;
  category: 'COMMON' | 'PRIVATE';
  isPresent: boolean;
  isFunctional: boolean;
  comment?: string;
  photoUrl?: string;
}

export interface InventoryReport {
  id: string;
  bookingId: string;
  tenantId: string;
  ownerId: string;
  type: 'IN' | 'OUT';
  date: string;
  identityValidated: boolean;
  items: InventoryItem[];
  roomRating: number; // 1-5
  houseRating: number; // 1-5
  cleanlinessRating: number; // 1-5 (juger le sortant)
  comments: string;
  signature: string; // Signature data
  status: 'DRAFT' | 'COMPLETED';
  isEarlyDeparture?: boolean;
  earlyDepartureReason?: string;
  scheduledDepartureAt?: string;
}

// Type Message
export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  bookingId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  participants: string[];
}

// Type Demande de Contact
export interface ContactRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  timestamp: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
}

// Type Signalement (Report)
export type ReportTargetType = 'LISTING' | 'USER' | 'MESSAGE' | 'TECHNICAL' | 'OTHER';
export type ReportReason = 'OFFENSIVE' | 'SPAM' | 'INACCURATE' | 'FRAUD' | 'TECHNICAL_ISSUE' | 'OTHER';
export type ReportStatus = 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface Report {
  id: string;
  reporterId: string;
  targetId: string;
  targetType: ReportTargetType;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  timestamp: string;
  adminNotes?: string;
}

// Type Sinistre / Incident
export interface Incident {
  id: string;
  listingId: string;
  bookingId: string;
  reporterId: string;
  ownerId: string; // Added to facilitate dashboard queries
  title: string;
  description: string;
  status: 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  photos?: string[];
  adminNotes?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Type Paiement / Transaction
export interface Payment {
  id: string;
  bookingId: string;
  listingId: string;
  ownerId: string;
  tenantId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  createdAt: string;
  type: 'RENT' | 'DEPOSIT' | 'REFUND';
}

// Type Avis / Review
export interface Review {
  id: string;
  authorId: string;
  targetId: string; // listingId or userId (roommate)
  targetType: 'LISTING' | 'USER';
  rating: number;
  comment: string;
  createdAt: string;
  authorName?: string;
  authorAvatarUrl?: string;
}

// Type Document Légal (CGR, Privacy, etc.)
export interface LegalDocument {
  id: string; // 'cgr', 'privacy', etc.
  title: string;
  content: string; // Markdown
  lastUpdated: string;
  updatedBy?: string;
}

// Type Document Application (EDL, Quittance, Bail)
export interface AppDocument {
  id: string;
  userId: string;
  bookingId: string;
  title: string;
  type: 'INVENTORY_IN' | 'INVENTORY_OUT' | 'RENT_RECEIPT' | 'LEASE' | 'OTHER';
  url: string;
  createdAt: string;
  listingTitle?: string;
}
