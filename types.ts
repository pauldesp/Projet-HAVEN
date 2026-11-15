import type { VerificationException } from './services/verificationException';

// Définition des rôles utilisateurs
export enum UserRole {
  TENANT = 'TENANT',
  OWNER = 'OWNER',
  PROVIDER = 'PROVIDER',
  ADMIN = 'ADMIN'
}

export type ListingStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BANNED';
export type AdminLevel = 'PRIMARY' | 'STANDARD';

/** Entrée immuable décrivant une opération effectuée dans le back-office. */
export interface AdminAuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  category: 'ACCOUNT' | 'LISTING' | 'BOOKING' | 'INCIDENT' | 'LEGAL' | 'REPORT' | 'CONTACT' | 'ADMINISTRATION';
  targetType: string;
  targetId: string;
  summary: string;
  targetLabel?: string;
  targetDescription?: string;
  beforeStatus?: string;
  afterStatus?: string;
  createdAt: string;
}

// Interface Utilisateur
export interface User {
  verificationException?: VerificationException | null;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  residenceProvided?: boolean;
  residenceVerified?: boolean;
  marketingOptIn?: boolean;
  legalAccepted?: boolean;
  avatarUrl: string;
  role: UserRole;
  /** Le titulaire principal supervise les administrateurs standard. */
  adminLevel?: AdminLevel;
  /** Compte administrateur ayant accordé l'accès, pour la chaîne de responsabilité. */
  adminCreatedBy?: string;
  adminCreatedAt?: string;
  status?: UserStatus;
  rejectionReason?: string;
  isVerified?: boolean;
  /** Vérifications indépendantes du compte, renseignées par des flux de confiance. */
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  identityVerified?: boolean;
  /** Date à laquelle le dossier complet a été transmis pour contrôle manuel. */
  verificationSubmittedAt?: string | null;
  city?: string;
  bio?: string;
  activity?: import('./services/publicProfile').Activity;
  interests?: string[];
  age?: number;
  activityLabel?: string;
  school?: string;
  job?: string;
  idDocumentUrl?: string;
  idVerifiedAt?: string;
  createdAt?: string;
  rating?: number;
  reviewsCount?: number;
  favorites?: string[]; // Array of listing IDs
  documents?: {
    idCard?: string;
    proofOfAddress?: string;
    proofOfOwnership?: string;
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
  verificationException?: VerificationException | null;
  id: string;
  title: string;
  description: string;
  city: string;
  address: string;
  /** Secteur public, sans adresse précise. */
  neighborhood?: string;
  arrivalMethod?: 'SELF_CHECK_IN' | 'HOST_WELCOME' | 'TO_COORDINATE';
  postalCode?: string;
  country?: string;
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
  /** Accept shorter stays that exactly fill a gap between two occupations of a room (default: yes). */
  allowGapStays?: boolean;
  /** Taken offline by Haven (status REJECTED until restored). */
  suspendedByHaven?: boolean;
  cleaningFee: number; // Fixed contribution per booking, not per week
  cleaningPolicyVersion?: string;
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

export interface BookingCancellation {
  cancelledAt: string;
  /** HAVEN: cancelled by the Haven team (exceptional case, always fully refunded). */
  cancelledBy: 'TENANT' | 'OWNER' | 'HAVEN';
  reason: string;
  refundPercent: number;
  refundAmount: number;
  refundStatus: 'NOT_REQUIRED' | 'SIMULATED' | 'COMPLETED' | 'PENDING' | 'FAILED';
  refundId?: string;
}

// Type de réservation
export interface Booking {
  listingTitle?: string;
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
  /** Fuseau horaire du logement, figé à la réservation. */
  timeZone?: string;
  checkInReportId?: string;
  checkOutReportId?: string;
  checkInTime?: string;
  checkOutTime?: string;
  createdAt: string;
  listing?: {
    title: string;
    city: string;
    mainPhotoUrl: string;
  };
  roomName?: string;
  cleaningPolicyVersion?: string;
  cleaningPolicyAcceptedAt?: string;
  paymentStatus?: 'PENDING' | 'PAID';
  stripeSessionId?: string;
  checkoutSessionId?: string;
  checkoutExpiresAt?: string;
  paymentProvider?: 'SIMULATION' | 'STRIPE';
  paymentIsTest?: boolean;
  paidAt?: string;
  bookingMode?: 'INSTANT' | 'MANUAL';
  approvedAt?: string;
  completedAt?: string;
  cancellation?: BookingCancellation;
  /** Recurring series: every stay is a booking priced and held at creation. */
  seriesId?: string;
  seriesIndex?: number;
  seriesCount?: number;
  /** Day the stay is charged (YYYY-MM-DD): at booking for the first stay, then one month before arrival. */
  installmentDueDate?: string;
  /** Set once the first stay is paid; later stays are then held until their installment deadline. */
  seriesActivatedAt?: string;
  /** Lets the owner see reserved stays that will be charged later. */
  seriesScheduled?: boolean;
  installmentAttempts?: number;
  nextInstallmentAttemptAt?: string;
  installmentLastError?: string;
  /** Haven was warned that the owner payout account was not ready when this stay was charged. */
  ownerPayoutAlertAt?: string;
  installmentLeaseUntil?: string;
  unpaidCancelledAt?: string;
  /** Refunds decided by Haven without cancelling the stay (goodwill gestures, settled disputes). */
  havenRefunds?: HavenRefund[];
  /** Caution : accord du locataire pour un prélèvement plafonné en cas de dégradation validée par Haven. */
  depositConsent?: { version: string; text: string; amountCents: number; acceptedAt: string };
}

/** Déclaration de dégradation d'un propriétaire après un séjour (collection serveur `damage_claims`, id = réservation). */
export interface DamageClaim {
  id: string;
  bookingId: string;
  listingId: string;
  listingTitle: string;
  ownerId: string;
  tenantId: string;
  stayEndDate: string;
  requestedCents: number;
  description: string;
  photos: string[];
  createdAt: string;
  status: 'SUBMITTED' | 'REJECTED' | 'CHARGING' | 'CHARGED' | 'CHARGE_FAILED';
  tenantResponse?: { text: string; at: string };
  decision?: { amountCents: number; note: string; at: string; adminId: string; adminName: string };
  charge?: { provider: 'STRIPE' | 'SIMULATION'; paymentIntentId?: string; attempts: number; error?: string; at: string; isTest: boolean };
  transfer?: { status: 'DONE' | 'WAITING_ACCOUNT' | 'FAILED' | 'SIMULATED'; transferId?: string; error?: string; at: string };
  /** Opened by Haven for the owner, for example after the next tenant's report. */
  declaredBy?: { adminId: string; adminName: string; reportId?: string };
}

export interface HavenRefund { id: string; amountCents: number; reason: string; at: string; adminId: string; adminName: string; status: 'COMPLETED' | 'PENDING' | 'SIMULATED' }

export interface BookingSeries {
  id: string;
  tenantId: string;
  ownerId: string;
  listingId: string;
  listingTitle: string;
  bookingIds: string[];
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED';
  paymentProvider: 'SIMULATION' | 'STRIPE';
  createdAt: string;
  activatedAt?: string;
  stripeCustomerId?: string;
  paymentMethodId?: string;
  cardBrand?: string;
  cardLast4?: string;
  /** Proof of the tenant's explicit authorization of the automatic charges. */
  autoChargeConsent?: { version: string; text: string; acceptedAt: string };
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

/** Minimal public subset shown to a signed-in prospective housemate. */
export interface HousematePreview {
  id: string;
  firstName: string;
  avatarUrl: string;
  age?: number;
  activity?: string;
  interests?: string[];
  coverage: 'FULL' | 'PARTIAL';
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
  stay?: { listingTitle: string; roomName: string; startDate: string; endDate: string; tenantName: string; timeZone: string };
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
export type ReportStatus = 'NEW' | 'INVESTIGATING' | 'WAITING_OWNER' | 'RESOLVED' | 'DISMISSED';

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
  ownerMessage?: string;
  ownerReviewDate?: string | null;
  waitingOwnerSince?: string;
  updatedAt?: string;
  supportCategory?: string;
  incidentId?: string;
  bookingId?: string;
  listingId?: string;
  ownerId?: string;
  photos?: string[];
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
  ownerNotes?: string;
  updatedAt?: string;
  resolvedAt?: string;
  takenInChargeAt?: string;
  escalatedAt?: string;
  escalationReportId?: string;
  havenFollowUp?: { status: ReportStatus; note: string; reviewDate: string | null; updatedAt: string };
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Type Paiement / Transaction
/** Authoritative bank payout recorded by the server/payment provider, separate from tenant payments. */
export interface OwnerPayout {
  id: string;
  ownerId: string;
  amountCents: number; // Net amount sent to the owner's bank account, excluding Haven fees.
  currency: 'EUR';
  provider: 'STRIPE' | 'SIMULATION';
  isTest: boolean;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REVERSED';
  createdAt: string;
  paidAt?: string;
  expectedArrivalAt?: string;
  providerPayoutId?: string;
}

export interface Payment {
  provider?: 'SIMULATION' | 'STRIPE';
  isTest?: boolean;
  currency?: string;
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
  bookingId?: string;
  authorId: string;
  targetId: string; // listingId or userId (roommate)
  targetType: 'LISTING' | 'USER';
  rating: number;
  comment: string;
  createdAt: string;
  authorName?: string;
  authorAvatarUrl?: string;
  isAutomatic?: boolean;
  /** Hidden by Haven moderation (kept for the record, excluded from ratings). */
  hiddenByHaven?: boolean;
  hiddenReason?: string;
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
  receiptId?: string;
  reportId?: string;
  id: string;
  userId: string;
  bookingId: string;
  title: string;
  type: 'INVENTORY_IN' | 'INVENTORY_OUT' | 'RENT_RECEIPT' | 'LEASE' | 'OTHER';
  url: string;
  createdAt: string;
  listingTitle?: string;
}
