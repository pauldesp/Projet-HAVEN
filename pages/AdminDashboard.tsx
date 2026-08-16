
import React, { useState, useEffect } from 'react';
import { MOCK_TENANTS } from '../services/mockData';
import { 
  Listing, 
  ListingStatus, 
  UserRole, 
  ContactRequest, 
  Report, 
  ReportStatus,
  User,
  UserStatus,
  LegalDocument,
  Booking,
  Incident
} from '../types';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db, seedFirestore } from '../firebase';
import { 
  Users, 
  Home, 
  AlertTriangle, 
  TrendingUp, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Shield, 
  Eye, 
  FileText, 
  MessageSquare,
  UserCheck,
  UserX,
  AlertCircle,
  Database,
  Mail,
  Flag,
  Filter,
  Search,
  MoreVertical,
  Ban,
  Plus,
  Loader2,
  Calendar,
  Camera,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useListings } from '../contexts/ListingContext';
import { apiService } from '../services/api';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

export const AdminDashboard: React.FC = () => {
  const { currentUser, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'LISTINGS' | 'USERS' | 'OVERVIEW' | 'STAFF' | 'CONTACTS' | 'REPORTS' | 'LEGAL' | 'INCIDENTS'>('LISTINGS');
  const { listings, updateListingStatus, isLoading: listingsLoading } = useListings();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [isIncidentsLoading, setIsIncidentsLoading] = useState(false);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [listingFilters, setListingFilters] = useState({
    title: '',
    city: '',
    totalRooms: '',
    ownerName: '',
    status: 'ALL' as ListingStatus | 'ALL'
  });
  const [userFilters, setUserFilters] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    role: 'ALL' as UserRole | 'ALL',
    status: 'ALL' as UserStatus | 'ALL'
  });
  const [reportFilter, setReportFilter] = useState<ReportStatus | 'ALL'>('NEW');

  // Sorting
  const [listingSort, setListingSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [userSort, setUserSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'firstName', direction: 'asc' });
  
  // Staff Management State
  const [newAdmin, setNewAdmin] = useState({ email: '', firstName: '', lastName: '' });
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  
  // Legal Management State
  const [legalDocs, setLegalDocs] = useState<LegalDocument[]>([]);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocument | null>(null);
  const [isEditingLegal, setIsEditingLegal] = useState(false);
  const [legalEditForm, setLegalEditForm] = useState({ title: '', content: '' });
  const [isSavingLegal, setIsSavingLegal] = useState(false);

  // User Detail Modal State
  const [userDetailModal, setUserDetailModal] = useState<{
    isOpen: boolean;
    userId: string | null;
    user: User | null;
    listings: Listing[];
    bookings: Booking[];
    ownerBookings: Booking[];
    isLoading: boolean;
  }>({
    isOpen: false,
    userId: null,
    user: null,
    listings: [],
    bookings: [],
    ownerBookings: [],
    isLoading: false
  });

  // Document Preview Lightbox State
  const [docPreviewModal, setDocPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
  }>({
    isOpen: false,
    title: '',
    url: ''
  });

  console.log("AdminDashboard rendering", { activeTab, isEditingLegal });

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };
  
  // Rejection Modal State
  const [rejectionModal, setRejectionModal] = useState<{
    isOpen: boolean;
    type: 'LISTING' | 'USER';
    id: string;
    reason: string;
    error?: string;
  }>({
    isOpen: false,
    type: 'LISTING',
    id: '',
    reason: '',
    error: ''
  });

  const fetchUsers = () => {
    setIsUsersLoading(true);
    setError(null);
    
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => doc.data() as User);
      setUsers(allUsers);
      setIsUsersLoading(false);
    }, (e: any) => {
      console.error("Error fetching users", e);
      setError("Impossible de charger la liste des utilisateurs.");
      setIsUsersLoading(false);
    });

    return unsubscribe;
  };

  const fetchContactRequests = () => {
    setIsContactsLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'contact_requests'), (snapshot) => {
      const allRequests = snapshot.docs.map(doc => doc.data() as ContactRequest);
      setContactRequests(allRequests.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setIsContactsLoading(false);
    }, (e: any) => {
      console.error("Error fetching contact requests", e);
      setIsContactsLoading(false);
    });

    return unsubscribe;
  };

  const fetchReports = () => {
    setIsReportsLoading(true);
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allReports = snapshot.docs.map(doc => doc.data() as Report);
      setReports(allReports);
      setIsReportsLoading(false);
    }, (e: any) => {
      console.error("Error fetching reports", e);
      setIsReportsLoading(false);
    });

    return unsubscribe;
  };

  const fetchIncidents = () => {
    setIsIncidentsLoading(true);
    const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allIncidents = snapshot.docs.map(doc => doc.data() as Incident);
      setIncidents(allIncidents);
      setIsIncidentsLoading(false);
    }, (e: any) => {
      console.error("Error fetching incidents", e);
      setIsIncidentsLoading(false);
    });

    return unsubscribe;
  };

  const fetchLegalDocs = () => {
    const unsubscribe = onSnapshot(collection(db, 'settings'), (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data() as LegalDocument);
      setLegalDocs(docs);
    });
    return unsubscribe;
  };

  const fetchBookings = () => {
    setIsBookingsLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const allBookings = snapshot.docs.map(doc => doc.data() as Booking);
      setBookings(allBookings);
      setIsBookingsLoading(false);
    }, (e: any) => {
      console.error("Error fetching bookings snapshot", e);
      setIsBookingsLoading(false);
    });
    return unsubscribe;
  };

  useEffect(() => {
    let unsubscribeUsers: (() => void) | null = null;
    let unsubscribeContacts: (() => void) | null = null;
    let unsubscribeReports: (() => void) | null = null;
    let unsubscribeIncidents: (() => void) | null = null;
    let unsubscribeLegal: (() => void) | null = null;
    let unsubscribeBookings: (() => void) | null = null;

    if (!authLoading) {
      if (!currentUser) {
        navigate('/admin/login');
      } else if (currentUser.role !== UserRole.ADMIN) {
        navigate('/');
      }
    }
    
    if (currentUser?.role === UserRole.ADMIN) {
      unsubscribeUsers = fetchUsers();
      unsubscribeContacts = fetchContactRequests();
      unsubscribeReports = fetchReports();
      unsubscribeIncidents = fetchIncidents();
      unsubscribeLegal = fetchLegalDocs();
      unsubscribeBookings = fetchBookings();
    }

    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeContacts) unsubscribeContacts();
      if (unsubscribeReports) unsubscribeReports();
      if (unsubscribeIncidents) unsubscribeIncidents();
      if (unsubscribeLegal) unsubscribeLegal();
      if (unsubscribeBookings) unsubscribeBookings();
    };
  }, [currentUser, authLoading, navigate]);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Inconnu';
  };

  const pendingListings = listings.filter(l => l.status === 'PENDING');
  const pendingUsers = users.filter(u => !u.status || u.status === 'PENDING');
  const pendingContacts = contactRequests.filter(c => c.status === 'NEW');
  const pendingIncidents = incidents.filter(i => i.status === 'NEW');

  // Sorting logic for listings
  const sortedListings = [...listings]
    .filter(l => {
      const matchesStatus = listingFilters.status === 'ALL' || l.status === listingFilters.status;
      const matchesCity = l.city.toLowerCase().includes(listingFilters.city.toLowerCase());
      const matchesTitle = l.title.toLowerCase().includes(listingFilters.title.toLowerCase());
      const matchesRooms = !listingFilters.totalRooms || l.totalRooms.toString().includes(listingFilters.totalRooms);
      const matchesOwner = getUserName(l.ownerId).toLowerCase().includes(listingFilters.ownerName.toLowerCase());
      return matchesStatus && matchesCity && matchesTitle && matchesRooms && matchesOwner;
    })
    .sort((a: any, b: any) => {
      let aValue = a[listingSort.key];
      let bValue = b[listingSort.key];

      if (listingSort.key === 'ownerName') {
        aValue = getUserName(a.ownerId);
        bValue = getUserName(b.ownerId);
      }
      
      if (aValue < bValue) return listingSort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return listingSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

  // Sorting logic for users
  const sortedUsers = [...users]
    .filter(u => {
      const matchesStatus = userFilters.status === 'ALL' || (u.status || 'PENDING') === userFilters.status;
      const matchesRole = userFilters.role === 'ALL' || u.role === userFilters.role;
      const matchesFirstName = u.firstName.toLowerCase().includes(userFilters.firstName.toLowerCase());
      const matchesLastName = u.lastName.toLowerCase().includes(userFilters.lastName.toLowerCase());
      const matchesEmail = u.email.toLowerCase().includes(userFilters.email.toLowerCase());
      const matchesPhone = (u.phone || '').toLowerCase().includes(userFilters.phone.toLowerCase());
      const matchesCity = (u.city || '').toLowerCase().includes(userFilters.city.toLowerCase());
      return matchesStatus && matchesRole && matchesFirstName && matchesLastName && matchesEmail && matchesPhone && matchesCity;
    })
    .sort((a: any, b: any) => {
      const aValue = a[userSort.key] || '';
      const bValue = b[userSort.key] || '';
      
      if (aValue < bValue) return userSort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return userSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleListingSort = (key: string) => {
    setListingSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleUserSort = (key: string) => {
    setUserSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ sortKey, currentSort }: { sortKey: string; currentSort: { key: string; direction: 'asc' | 'desc' } }) => {
    if (currentSort.key !== sortKey) return <ArrowUpDown size={14} className="text-gray-300" />;
    return currentSort.direction === 'asc' ? <ChevronUp size={14} className="text-haven-red" /> : <ChevronDown size={14} className="text-haven-red" />;
  };
  
  const handleUpdateStatus = async (id: string, newStatus: ListingStatus, reason?: string) => {
    setProcessingId(id);
    setError(null);
    try {
      await updateListingStatus(id, newStatus, reason);
      setRejectionModal({ ...rejectionModal, isOpen: false, error: '' });
    } catch (e: any) {
      console.error("Error updating status", e);
      const msg = "Erreur lors de la mise à jour du logement. Vérifiez vos permissions.";
      setError(msg);
      if (rejectionModal.isOpen) {
        setRejectionModal(prev => ({ ...prev, error: msg }));
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateUserStatus = async (id: string, newStatus: UserStatus, reason?: string) => {
    setProcessingId(id);
    setError(null);
    try {
      await apiService.users.updateStatus(id, newStatus, reason);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus, rejectionReason: newStatus === 'APPROVED' ? undefined : reason } : u));
      
      // Update modal state if open for this user
      if (userDetailModal.isOpen && userDetailModal.userId === id && userDetailModal.user) {
        setUserDetailModal(prev => ({
          ...prev,
          user: prev.user ? { ...prev.user, status: newStatus, rejectionReason: newStatus === 'APPROVED' ? undefined : reason } : null
        }));
      }

      setRejectionModal({ ...rejectionModal, isOpen: false, error: '' });
    } catch (e: any) {
      console.error("Error updating user status", e);
      const msg = "Erreur lors de la mise à jour de l'utilisateur. Vérifiez vos permissions.";
      setError(msg);
      if (rejectionModal.isOpen) {
        setRejectionModal(prev => ({ ...prev, error: msg }));
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateContactStatus = async (id: string, newStatus: ContactRequest['status']) => {
    setProcessingId(id);
    try {
      await apiService.contactRequests.updateStatus(id, newStatus);
    } catch (e) {
      console.error("Error updating contact status", e);
      setError("Erreur lors de la mise à jour de la demande de contact.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateReportStatus = async (id: string, newStatus: ReportStatus, notes?: string) => {
    setProcessingId(id);
    try {
      await apiService.reports.updateStatus(id, newStatus, notes);
    } catch (e) {
      console.error("Error updating report status", e);
      setError("Erreur lors de la mise à jour du signalement.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir bannir cet utilisateur ?")) return;
    setProcessingId(id);
    try {
      await apiService.users.delete(id);
      alert("Utilisateur banni avec succès.");
    } catch (e) {
      console.error("Error deleting user", e);
      setError("Erreur lors du bannissement de l'utilisateur.");
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectionModal = (type: 'LISTING' | 'USER', id: string) => {
    setRejectionModal({
      isOpen: true,
      type,
      id,
      reason: '',
      error: ''
    });
  };

  const confirmRejection = () => {
    if (!rejectionModal.reason.trim()) {
      setRejectionModal(prev => ({ ...prev, error: "Veuillez saisir une justification pour le refus." }));
      return;
    }
    
    if (rejectionModal.type === 'LISTING') {
      handleUpdateStatus(rejectionModal.id, 'REJECTED', rejectionModal.reason);
    } else {
      handleUpdateUserStatus(rejectionModal.id, 'REJECTED', rejectionModal.reason);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.email || !newAdmin.firstName) return;
    
    setIsAddingAdmin(true);
    try {
      // We create a placeholder user in Firestore. 
      // When they login/register with this email, AuthContext will pick up the role.
      const tempId = `admin-pending-${Date.now()}`;
      const adminUser: User = {
        id: tempId,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        email: newAdmin.email.toLowerCase(),
        role: UserRole.ADMIN,
        status: 'APPROVED',
        isVerified: true,
        avatarUrl: `https://ui-avatars.com/api/?name=${newAdmin.firstName}+${newAdmin.lastName}&background=1E293B&color=fff`
      };
      
      await apiService.users.updateProfile(adminUser);
      setUsers(prev => [...prev, adminUser]);
      setNewAdmin({ email: '', firstName: '', lastName: '' });
      toast.success(`L'accès administrateur a été préparé pour ${newAdmin.email}.`);
    } catch (e) {
      console.error("Error adding admin", e);
      toast.error("Erreur lors de l'ajout de l'administrateur.");
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleSaveLegalDoc = async () => {
    if (!selectedLegalDoc || !currentUser) return;
    setIsSavingLegal(true);
    try {
      let finalId = selectedLegalDoc.id;
      
      // Save HTML directly to support rich formatting (highlighting, sizes, etc.)
      const contentToSave = legalEditForm.content;

      // If it's a new document (temp ID), generate a real one from title
      if (finalId.startsWith('new-')) {
        if (!legalEditForm.title) {
          toast.error("Veuillez donner un titre au document.");
          setIsSavingLegal(false);
          return;
        }
        finalId = slugify(legalEditForm.title);
        
        // Check for duplicates
        if (legalDocs.some(d => d.id === finalId)) {
          finalId = `${finalId}-${Date.now().toString().slice(-4)}`;
        }
      }

      console.log("Saving legal doc:", { finalId, title: legalEditForm.title, content: contentToSave });
      await apiService.settings.updateLegalDocument(
        finalId,
        legalEditForm.title,
        contentToSave,
        currentUser.id
      );
      setIsEditingLegal(false);
      toast.success("Document enregistré avec succès !");
      
      // Refresh list
      const updatedDocs = await apiService.settings.getAllLegalDocuments();
      setLegalDocs(updatedDocs);
    } catch (e) {
      console.error("Error saving legal doc", e);
      toast.error("Erreur lors de l'enregistrement du document.");
    } finally {
      setIsSavingLegal(false);
    }
  };

  const startEditingLegal = (doc: LegalDocument) => {
    setSelectedLegalDoc(doc);
    // Content is now stored as HTML directly
    setLegalEditForm({ title: doc.title, content: doc.content });
    setIsEditingLegal(true);
  };

  const openUserDetailModal = async (userId: string) => {
    setUserDetailModal(prev => ({ ...prev, isOpen: true, userId, isLoading: true, user: null, listings: [], bookings: [], ownerBookings: [] }));
    try {
      const userData = await apiService.users.getById(userId);
      if (userData) {
        const [userListings, userBookings, ownerBookings] = await Promise.all([
          apiService.listings.getAll().then(all => all.filter(l => l.ownerId === userId)),
          apiService.bookings.getByUserId(userId),
          apiService.bookings.getByOwnerId(userId)
        ]);
        setUserDetailModal(prev => ({
          ...prev,
          user: userData,
          listings: userListings,
          bookings: userBookings,
          ownerBookings: ownerBookings,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error("Error fetching user details", error);
      toast.error("Erreur lors du chargement des détails de l'utilisateur.");
      setUserDetailModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }
  };

  if (authLoading || (currentUser && currentUser.role !== UserRole.ADMIN)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-haven-red"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      <div className="bg-gray-900 pt-12 pb-32 px-4 sm:px-6 lg:px-8 border-b-4 border-haven-red">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link to="/">
              <Logo className="h-10 w-auto opacity-80 hover:opacity-100 transition-opacity" white />
            </Link>
            <div className="h-10 w-px bg-white/10 hidden md:block"></div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-1.5 bg-haven-red rounded shadow-lg shadow-haven-red/50">
                  <Shield className="text-white" size={18} />
                </div>
                <h1 className="font-heading font-bold text-2xl text-white tracking-tight">Back-Office Admin</h1>
              </div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Console de Pilotage HAVEN</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20">
        
        <div className="flex space-x-1 bg-white shadow-xl shadow-black/5 p-1 rounded-xl mb-8 w-fit border border-gray-100 overflow-x-auto max-w-full">
           {[
             { id: 'LISTINGS', label: 'Annonces', icon: CheckCircle, count: pendingListings.length },
             { id: 'USERS', label: 'Utilisateurs', icon: Users, count: pendingUsers.length },
             { id: 'INCIDENTS', label: 'Incidents', icon: AlertTriangle, count: pendingIncidents.length },
             { id: 'REPORTS', label: 'Signalements', icon: Flag, count: reports.filter(r => r.status === 'NEW').length },
             { id: 'CONTACTS', label: 'Contacts', icon: Mail, count: pendingContacts.length },
             { id: 'LEGAL', label: 'Légal', icon: FileText },
             { id: 'STAFF', label: 'Équipe HAVEN', icon: Shield },
             { id: 'OVERVIEW', label: 'Stats', icon: TrendingUp }
           ].map((tab) => (
             <button
               key={tab.id}
                onClick={() => {
                  console.log(`Switching to tab: ${tab.id}`);
                  setActiveTab(tab.id as any);
                }}
               className={`px-6 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                 activeTab === tab.id 
                 ? 'bg-gray-900 text-white shadow-md' 
                 : 'text-gray-500 hover:bg-gray-100'
               }`}
             >
               <tab.icon size={16} />
               {tab.label}
               {tab.count !== undefined && tab.count > 0 && (
                 <span className="bg-haven-red text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{tab.count}</span>
               )}
             </button>
           ))}
        </div>

        <div className="space-y-8 animate-fade-in-up">
          
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center gap-3 animate-shake">
              <AlertCircle size={20} />
              <p className="text-sm font-bold">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <XCircle size={16} />
              </button>
            </div>
          )}

          {activeTab === 'LISTINGS' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <h2 className="font-heading font-bold text-2xl text-haven-navy mb-1">Gestion des annonces</h2>
                    <p className="text-gray-500 text-sm">Visualisez et gérez l'ensemble du catalogue.</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                      {(['ALL', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => setListingFilters(prev => ({ ...prev, status }))}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            listingFilters.status === status 
                            ? 'bg-white text-haven-navy shadow-sm border border-gray-100' 
                            : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {status === 'ALL' ? 'Toutes' : status === 'DRAFT' ? 'Brouillons' : status === 'PENDING' ? 'En attente' : status === 'APPROVED' ? 'Validées' : 'Refusées'}
                        </button>
                      ))}
                    </div>
                    <div className="text-right min-w-[100px]">
                      <span className="text-3xl font-bold text-haven-navy">{listings.length}</span>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Annonces totales</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Aperçu</th>
                        <th className="p-6">
                          <div 
                            className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors flex items-center gap-2 mb-2"
                            onClick={() => handleListingSort('title')}
                          >
                            Nom de la coloc <SortIcon sortKey="title" currentSort={listingSort} />
                          </div>
                          <input 
                            type="text"
                            placeholder="Filtrer..."
                            value={listingFilters.title || ''}
                            onChange={(e) => setListingFilters(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-haven-red transition-all"
                          />
                        </th>
                        <th className="p-6">
                          <div 
                            className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors flex items-center gap-2 mb-2"
                            onClick={() => handleListingSort('city')}
                          >
                            Ville <SortIcon sortKey="city" currentSort={listingSort} />
                          </div>
                          <input 
                            type="text"
                            placeholder="Filtrer..."
                            value={listingFilters.city || ''}
                            onChange={(e) => setListingFilters(prev => ({ ...prev, city: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-haven-red transition-all"
                          />
                        </th>
                        <th className="p-6">
                          <div 
                            className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors flex items-center gap-2 mb-2"
                            onClick={() => handleListingSort('totalRooms')}
                          >
                            Chambres <SortIcon sortKey="totalRooms" currentSort={listingSort} />
                          </div>
                          <input 
                            type="text"
                            placeholder="Filtrer..."
                            value={listingFilters.totalRooms || ''}
                            onChange={(e) => setListingFilters(prev => ({ ...prev, totalRooms: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-haven-red transition-all"
                          />
                        </th>
                        <th className="p-6">
                          <div 
                            className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors flex items-center gap-2 mb-2"
                            onClick={() => handleListingSort('ownerName')}
                          >
                            Propriétaire <SortIcon sortKey="ownerName" currentSort={listingSort} />
                          </div>
                          <input 
                            type="text"
                            placeholder="Filtrer..."
                            value={listingFilters.ownerName || ''}
                            onChange={(e) => setListingFilters(prev => ({ ...prev, ownerName: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-haven-red transition-all"
                          />
                        </th>
                        <th 
                          className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors"
                          onClick={() => handleListingSort('status')}
                        >
                          <div className="flex items-center gap-2">Statut <SortIcon sortKey="status" currentSort={listingSort} /></div>
                        </th>
                        <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedListings.length > 0 ? sortedListings.map(listing => (
                        <tr key={listing.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="p-6">
                            <div className="relative w-20 h-14 rounded-lg overflow-hidden shadow-sm">
                              <img src={listing.mainPhotoUrl} className="w-full h-full object-cover" alt=""/>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="font-bold text-haven-navy text-sm">{listing.title}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{listing.type === 'APARTMENT' ? 'Appartement' : 'Maison'}</div>
                          </td>
                          <td className="p-6">
                            <div className="text-sm text-gray-600 font-medium">{listing.city}</div>
                          </td>
                          <td className="p-6">
                            <div className="text-sm text-haven-navy font-bold">{listing.totalRooms}</div>
                          </td>
                          <td className="p-6">
                            <div className="text-sm text-gray-600 font-medium">{getUserName(listing.ownerId)}</div>
                          </td>
                          <td className="p-6">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              listing.status === 'DRAFT' ? 'bg-gray-50 text-gray-600 border-gray-100' :
                              listing.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              listing.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-100' :
                              'bg-red-50 text-red-600 border-red-100'
                            }`}>
                              {listing.status === 'DRAFT' ? 'Brouillon' : listing.status === 'PENDING' ? 'En attente' : listing.status === 'APPROVED' ? 'Validée' : 'Refusée'}
                            </span>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => window.open(`/#/listing/${listing.id}`, '_blank')}
                                className="p-2 text-gray-400 hover:text-haven-navy hover:bg-gray-100 rounded-lg transition-all"
                                title="Voir l'annonce"
                              >
                                <Eye size={16} />
                              </button>
                              {listing.status !== 'APPROVED' && (
                                <button 
                                  onClick={() => handleUpdateStatus(listing.id, 'APPROVED')}
                                  disabled={processingId === listing.id}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all disabled:opacity-50"
                                  title="Approuver"
                                >
                                  {processingId === listing.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                </button>
                              )}
                              {listing.status !== 'REJECTED' && (
                                <button 
                                  onClick={() => openRejectionModal('LISTING', listing.id)}
                                  disabled={processingId === listing.id}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                                  title="Refuser"
                                >
                                  <XCircle size={16} />
                                </button>
                              )}
                              <button 
                                onClick={() => navigate(`/owner/publish?edit=${listing.id}`)}
                                className="p-2 text-gray-400 hover:text-haven-navy hover:bg-gray-100 rounded-lg transition-all"
                                title="Modifier"
                              >
                                <FileText size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7} className="p-20 text-center">
                            <Home size={48} className="text-gray-200 mx-auto mb-4"/>
                            <p className="text-gray-500 font-medium">Aucune annonce ne correspond à vos critères.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'USERS' && (
             <div className="space-y-6">
               <div className="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden">
                 <div className="p-8 border-b border-gray-100 flex flex-wrap items-center justify-between gap-6">
                    <div>
                      <h2 className="font-heading font-bold text-2xl text-haven-navy mb-1">Gestion des utilisateurs</h2>
                      <p className="text-gray-500 text-sm">Gérez les comptes et les accès à la plateforme.</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(status => (
                            <button
                              key={status}
                              onClick={() => setUserFilters(prev => ({ ...prev, status }))}
                              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                userFilters.status === status 
                                ? 'bg-white text-haven-navy shadow-sm border border-gray-100' 
                                : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              {status === 'ALL' ? 'Tous' : status === 'PENDING' ? 'En attente' : status === 'APPROVED' ? 'Approuvés' : 'Bannis/Refusés'}
                            </button>
                          ))}
                        </div>
                        <select 
                          value={userFilters.role}
                          onChange={(e) => setUserFilters(prev => ({ ...prev, role: e.target.value as any }))}
                          className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-haven-navy outline-none focus:border-haven-red transition-all"
                        >
                          <option value="ALL">Tous les rôles</option>
                          <option value={UserRole.TENANT}>Locataires</option>
                          <option value={UserRole.OWNER}>Propriétaires</option>
                          <option value={UserRole.ADMIN}>Administrateurs</option>
                        </select>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <span className="text-3xl font-bold text-haven-navy">{users.length}</span>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inscrits totaux</p>
                      </div>
                    </div>
                 </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Profil</th>
                          <th className="p-6">
                            <div 
                              className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors flex items-center gap-2 mb-2"
                              onClick={() => handleUserSort('firstName')}
                            >
                              Prénom <SortIcon sortKey="firstName" currentSort={userSort} />
                            </div>
                            <input 
                              type="text"
                              placeholder="Filtrer..."
                              value={userFilters.firstName || ''}
                              onChange={(e) => setUserFilters(prev => ({ ...prev, firstName: e.target.value }))}
                              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-haven-red transition-all"
                            />
                          </th>
                          <th className="p-6">
                            <div 
                              className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors flex items-center gap-2 mb-2"
                              onClick={() => handleUserSort('lastName')}
                            >
                              Nom <SortIcon sortKey="lastName" currentSort={userSort} />
                            </div>
                            <input 
                              type="text"
                              placeholder="Filtrer..."
                              value={userFilters.lastName || ''}
                              onChange={(e) => setUserFilters(prev => ({ ...prev, lastName: e.target.value }))}
                              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-haven-red transition-all"
                            />
                          </th>
                          <th className="p-6">
                            <div 
                              className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors flex items-center gap-2 mb-2"
                              onClick={() => handleUserSort('email')}
                            >
                              Email <SortIcon sortKey="email" currentSort={userSort} />
                            </div>
                            <input 
                              type="text"
                              placeholder="Filtrer..."
                              value={userFilters.email || ''}
                              onChange={(e) => setUserFilters(prev => ({ ...prev, email: e.target.value }))}
                              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-haven-red transition-all"
                            />
                          </th>
                          <th className="p-6">
                            <div 
                              className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors flex items-center gap-2 mb-2"
                              onClick={() => handleUserSort('phone')}
                            >
                              Téléphone <SortIcon sortKey="phone" currentSort={userSort} />
                            </div>
                            <input 
                              type="text"
                              placeholder="Filtrer..."
                              value={userFilters.phone || ''}
                              onChange={(e) => setUserFilters(prev => ({ ...prev, phone: e.target.value }))}
                              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-haven-red transition-all"
                            />
                          </th>
                          <th className="p-6">
                            <div 
                              className="text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors flex items-center gap-2 mb-2"
                              onClick={() => handleUserSort('city')}
                            >
                              Ville <SortIcon sortKey="city" currentSort={userSort} />
                            </div>
                            <input 
                              type="text"
                              placeholder="Filtrer..."
                              value={userFilters.city || ''}
                              onChange={(e) => setUserFilters(prev => ({ ...prev, city: e.target.value }))}
                              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-haven-red transition-all"
                            />
                          </th>
                          <th 
                            className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors"
                            onClick={() => handleUserSort('role')}
                          >
                            <div className="flex items-center gap-2">Rôle <SortIcon sortKey="role" currentSort={userSort} /></div>
                          </th>
                          <th 
                            className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-haven-navy transition-colors"
                            onClick={() => handleUserSort('status')}
                          >
                            <div className="flex items-center gap-2">Statut <SortIcon sortKey="status" currentSort={userSort} /></div>
                          </th>
                          <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedUsers.length > 0 ? sortedUsers.map(user => (
                          <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="p-6">
                              <img src={user.avatarUrl} className="w-10 h-10 rounded-full object-cover border border-gray-100" alt=""/>
                            </td>
                            <td className="p-6">
                              <div className="font-bold text-haven-navy text-sm">{user.firstName}</div>
                            </td>
                            <td className="p-6">
                              <div className="font-bold text-haven-navy text-sm">{user.lastName}</div>
                            </td>
                            <td className="p-6">
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </td>
                            <td className="p-6">
                              <div className="text-sm text-gray-500">{user.phone || '-'}</div>
                            </td>
                            <td className="p-6">
                              <div className="text-sm text-gray-500">{user.city || '-'}</div>
                            </td>
                            <td className="p-6">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                user.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                user.role === UserRole.OWNER ? 'bg-haven-red/5 text-haven-red border-haven-red/10' : 
                                'bg-blue-50 text-blue-600 border-blue-100'
                              }`}>
                                {user.role === UserRole.ADMIN ? 'Admin' : user.role === UserRole.OWNER ? 'Propriétaire' : 'Locataire'}
                              </span>
                            </td>
                            <td className="p-6">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                (user.status || 'PENDING') === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-100' :
                                (user.status || 'PENDING') === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                'bg-red-50 text-red-600 border-red-100'
                              }`}>
                                {user.status || 'PENDING'}
                              </span>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => openUserDetailModal(user.id)}
                                  className="p-2 text-gray-400 hover:text-haven-navy hover:bg-gray-100 rounded-lg transition-all"
                                  title="Détails"
                                >
                                  <Eye size={16} />
                                </button>
                                {(user.status || 'PENDING') !== 'APPROVED' && (
                                  <button 
                                    onClick={() => handleUpdateUserStatus(user.id, 'APPROVED')}
                                    disabled={processingId === user.id}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all disabled:opacity-50"
                                    title="Approuver"
                                  >
                                    {processingId === user.id ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                                  </button>
                                )}
                                {(user.status || 'PENDING') !== 'REJECTED' && (
                                  <button 
                                    onClick={() => openRejectionModal('USER', user.id)}
                                    disabled={processingId === user.id}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                                    title="Bannir"
                                  >
                                    <Ban size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={9} className="p-20 text-center">
                              <Users size={48} className="text-gray-200 mx-auto mb-4"/>
                              <p className="text-gray-500 font-medium">Aucun utilisateur trouvé.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
             </div>
          )}

          {activeTab === 'REPORTS' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-card border border-gray-100 p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                  {(['ALL', 'NEW', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setReportFilter(status)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        reportFilter === status 
                        ? 'bg-white text-haven-navy shadow-sm border border-gray-100' 
                        : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {status === 'ALL' ? 'Tous' : status === 'NEW' ? 'Nouveaux' : status === 'INVESTIGATING' ? 'En cours' : status === 'RESOLVED' ? 'Résolus' : 'Classés'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100">
                  <h2 className="font-heading font-bold text-2xl text-haven-navy mb-1">Signalements & Modération</h2>
                  <p className="text-gray-500 text-sm">Gérez les signalements effectués par les utilisateurs.</p>
                </div>

                {reports.filter(r => reportFilter === 'ALL' || r.status === reportFilter).length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {reports.filter(r => reportFilter === 'ALL' || r.status === reportFilter).map(report => (
                      <div key={report.id} className="p-8 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col lg:flex-row gap-8">
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                  report.targetType === 'USER' ? 'bg-blue-50 text-blue-600' :
                                  report.targetType === 'LISTING' ? 'bg-haven-red/5 text-haven-red' :
                                  'bg-amber-50 text-amber-600'
                                }`}>
                                  {report.targetType === 'USER' ? <Users size={20}/> : 
                                   report.targetType === 'LISTING' ? <Home size={20}/> : 
                                   <AlertTriangle size={20}/>}
                                </div>
                                <div>
                                  <h3 className="font-bold text-lg text-haven-navy">
                                    Signalement {report.targetType === 'USER' ? 'Utilisateur' : 
                                               report.targetType === 'LISTING' ? 'Annonce' : 
                                               report.targetType === 'MESSAGE' ? 'Message' : 'Technique'}
                                  </h3>
                                  <p className="text-xs text-gray-400">
                                    Raison: <span className="font-bold text-gray-600 uppercase tracking-tighter">{report.reason}</span> • {new Date(report.timestamp).toLocaleString('fr-FR')}
                                  </p>
                                </div>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                report.status === 'NEW' ? 'bg-red-50 text-red-600 border-red-100' :
                                report.status === 'INVESTIGATING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                'bg-green-50 text-green-600 border-green-100'
                              }`}>
                                {report.status === 'NEW' ? 'Nouveau' : report.status === 'INVESTIGATING' ? 'En cours' : report.status === 'RESOLVED' ? 'Résolu' : 'Classé'}
                              </span>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
                              <p className="text-sm text-gray-600 italic">"{report.description}"</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span>Reporter ID: <span className="font-mono">{report.reporterId}</span></span>
                              <span>Target ID: <span className="font-mono">{report.targetId}</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 lg:w-48">
                            {report.status === 'NEW' && (
                              <Button 
                                size="sm" 
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                onClick={() => handleUpdateReportStatus(report.id, 'INVESTIGATING')}
                                disabled={processingId === report.id}
                              >
                                Enquêter
                              </Button>
                            )}
                            {report.status !== 'RESOLVED' && report.status !== 'DISMISSED' && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleUpdateReportStatus(report.id, 'RESOLVED')}
                                  disabled={processingId === report.id}
                                >
                                  Marquer Résolu
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-gray-500"
                                  onClick={() => handleUpdateReportStatus(report.id, 'DISMISSED')}
                                  disabled={processingId === report.id}
                                >
                                  Classer sans suite
                                </Button>
                              </>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                if (report.targetType === 'LISTING') navigate(`/listing/${report.targetId}`);
                                else if (report.targetType === 'USER') navigate(`/profile/${report.targetId}`);
                              }}
                            >
                              <Eye size={14} className="mr-2"/> Voir la cible
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-20 text-center flex flex-col items-center">
                    <Flag size={64} className="text-gray-200 mb-6"/>
                    <h3 className="font-bold text-xl text-gray-800">Aucun signalement à traiter.</h3>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'CONTACTS' && (
            <div className="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-100">
                <h2 className="font-heading font-bold text-2xl text-haven-navy mb-2">Demandes de contact</h2>
                <p className="text-gray-500 text-sm">Gérez les messages envoyés via le formulaire de contact.</p>
              </div>

              {contactRequests.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {contactRequests.map(request => (
                    <div key={request.id} className="p-8 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col lg:flex-row gap-8">
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-bold text-xl text-haven-navy">{request.subject}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                  request.status === 'NEW' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                  request.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  'bg-green-50 text-green-600 border-green-100'
                                }`}>
                                  {request.status === 'NEW' ? 'Nouveau' : request.status === 'IN_PROGRESS' ? 'En cours' : 'Résolu'}
                                </span>
                              </div>
                              <p className="text-gray-500 text-sm flex items-center gap-2">
                                <span className="font-bold text-haven-navy">{request.name}</span>
                                <span>•</span>
                                <span>{request.email}</span>
                                <span>•</span>
                                <span>{request.phone}</span>
                              </p>
                            </div>
                            <p className="text-xs text-gray-400">
                              {new Date(request.timestamp).toLocaleString('fr-FR')}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-gray-700 whitespace-pre-wrap italic">
                            "{request.message}"
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 shrink-0 lg:w-48">
                          {request.status === 'NEW' && (
                            <Button 
                              size="sm" 
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => handleUpdateContactStatus(request.id, 'IN_PROGRESS')}
                              disabled={processingId === request.id}
                            >
                              Prendre en charge
                            </Button>
                          )}
                          {request.status !== 'RESOLVED' && (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleUpdateContactStatus(request.id, 'RESOLVED')}
                              disabled={processingId === request.id}
                            >
                              Marquer comme résolu
                            </Button>
                          )}
                          {request.status === 'RESOLVED' && (
                            <div className="flex items-center justify-center gap-2 text-green-600 font-bold text-sm py-2">
                              <CheckCircle size={16} />
                              Traité
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-20 text-center flex flex-col items-center">
                  <Mail size={64} className="text-gray-200 mb-6"/>
                  <h3 className="font-bold text-xl text-gray-800">Aucune demande de contact.</h3>
                </div>
              )}
            </div>
          )}

          {activeTab === 'INCIDENTS' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-card border border-gray-100 p-8">
                <h2 className="font-heading font-bold text-2xl text-haven-navy mb-1">Gestion des incidents</h2>
                <p className="text-gray-500 text-sm mb-6">Suivez les problèmes techniques signalés par les locataires.</p>
                
                {incidents.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6">
                    {incidents.map(incident => (
                      <div key={incident.id} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden flex flex-col md:flex-row">
                        <div className="md:w-64 h-48 md:h-auto bg-gray-200">
                          {incident.photos && incident.photos.length > 0 ? (
                            <img src={incident.photos[0]} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Camera size={48} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-6 flex flex-col">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${incident.status === 'NEW' ? 'bg-haven-red text-white' : 'bg-green-100 text-green-700'}`}>
                                  {incident.status === 'NEW' ? 'Nouveau' : 'Résolu'}
                                </span>
                                <span className="text-xs font-bold text-gray-400">#INC-{incident.id.slice(0, 5)}</span>
                              </div>
                              <h3 className="font-bold text-lg text-haven-navy">{incident.title}</h3>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-haven-navy">Signalé par : {getUserName(incident.reporterId)}</p>
                              <p className="text-xs text-gray-400">{new Date(incident.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-6 flex-1 italic">"{incident.description}"</p>
                          <div className="flex flex-wrap gap-4 mt-auto">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => navigate(`/listing/${incident.listingId}`)}
                            >
                              <Home size={14} className="mr-2" /> Voir le logement
                            </Button>
                            {incident.status === 'NEW' ? (
                              <Button 
                                size="sm" 
                                className="bg-haven-navy text-white"
                                onClick={async () => {
                                  setProcessingId(incident.id);
                                  await apiService.incidents.updateStatus(incident.id, 'RESOLVED');
                                  setProcessingId(null);
                                  toast.success("Incident marqué comme résolu.");
                                }}
                                disabled={processingId === incident.id}
                              >
                                Marquer comme résolu
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2 text-green-600 font-bold text-sm px-4 py-2 bg-green-50 rounded-xl">
                                <CheckCircle size={16} /> Incident Traité
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-20 text-center flex flex-col items-center">
                    <CheckCircle size={64} className="text-green-100 mb-6"/>
                    <h3 className="font-bold text-xl text-gray-800">Aucun incident à déplorer !</h3>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'STAFF' && (
            <div className="space-y-8">
              <div className="bg-white rounded-3xl shadow-card border border-gray-100 p-8">
                <h2 className="font-heading font-bold text-2xl text-haven-navy mb-6">Ajouter un collaborateur</h2>
                <form onSubmit={handleAddAdmin} className="grid md:grid-cols-3 gap-6 items-end">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prénom</label>
                    <input 
                      type="text"
                      required
                      value={newAdmin.firstName || ''}
                      onChange={(e) => setNewAdmin({ ...newAdmin, firstName: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-haven-red transition-all"
                      placeholder="Jean"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Professionnel</label>
                    <input 
                      type="email"
                      required
                      value={newAdmin.email || ''}
                      onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-haven-red transition-all"
                      placeholder="jean@haven.fr"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-haven-navy text-white h-[46px]"
                    disabled={isAddingAdmin}
                  >
                    {isAddingAdmin ? <Loader2 className="animate-spin" size={18}/> : "Créer l'accès Admin"}
                  </Button>
                </form>
              </div>

              <div className="bg-white rounded-3xl shadow-card border border-gray-100 p-8">
                <h3 className="font-heading font-bold text-xl text-haven-navy mb-6">Équipe HAVEN ({users.filter(u => u.role === UserRole.ADMIN).length})</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {users.filter(u => u.role === UserRole.ADMIN).map(admin => (
                    <div key={admin.id} className="flex items-center gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                      <img src={admin.avatarUrl} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" alt=""/>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-haven-navy truncate">{admin.firstName} {admin.lastName}</p>
                        <p className="text-xs text-gray-400 truncate">{admin.email}</p>
                        <div className="mt-1 flex items-center gap-1 text-[9px] font-black text-haven-red uppercase tracking-widest">
                          <Shield size={10} /> Administrateur
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'LEGAL' && (
            <div className="space-y-8">
              <div className="bg-white rounded-3xl shadow-card border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="font-heading font-bold text-2xl text-haven-navy mb-1">Documents Légaux</h2>
                    <p className="text-gray-500 text-sm">Gérez les conditions générales et politiques de confidentialité.</p>
                  </div>
                  <Button 
                    onClick={() => {
                      console.log("Nouveau Document button clicked - simple flow");
                      startEditingLegal({
                        id: `new-${Date.now()}`,
                        title: '',
                        content: '',
                        lastUpdated: new Date().toISOString()
                      });
                    }}
                    className="bg-haven-red text-white px-8 py-4 text-sm"
                    size="md"
                  >
                    <Plus size={20} className="mr-2" /> Nouveau Document
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {legalDocs.length > 0 ? legalDocs.map(doc => (
                    <div key={doc.id} className="bg-gray-50 rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm text-haven-navy">
                          <FileText size={24} />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white px-2 py-1 rounded-md border border-gray-100">
                          ID: {doc.id}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-haven-navy mb-2">{doc.title}</h3>
                      <p className="text-xs text-gray-400 mb-6">
                        Mis à jour le {new Date(doc.lastUpdated).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          fullWidth
                          onClick={() => startEditingLegal(doc)}
                        >
                          Modifier
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(`/#/legal/${doc.id}`, '_blank')}
                        >
                          <Eye size={16} />
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center text-gray-400 italic bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                      Aucun document légal configuré.
                    </div>
                  )}
                </div>
              </div>

              {isEditingLegal && (
                <div className="bg-white rounded-3xl shadow-card border border-gray-100 p-8 animate-fade-in-up">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-heading font-bold text-xl text-haven-navy">
                      {selectedLegalDoc?.id.startsWith('new-') ? "Nouveau Document" : `Édition : ${selectedLegalDoc?.title || selectedLegalDoc?.id}`}
                    </h3>
                    <div className="flex gap-3">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingLegal(false)}>Annuler</Button>
                      <Button 
                        className="bg-haven-navy text-white" 
                        size="sm" 
                        onClick={handleSaveLegalDoc}
                        disabled={isSavingLegal}
                      >
                        {isSavingLegal ? <Loader2 className="animate-spin" size={16}/> : "Enregistrer"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Titre du document</label>
                      <input 
                        type="text"
                        value={legalEditForm.title || ''}
                        onChange={(e) => setLegalEditForm({ ...legalEditForm, title: e.target.value })}
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-haven-red transition-all text-xl font-bold text-haven-navy"
                        placeholder="Ex: Conditions Générales de Vente"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contenu du document</label>
                      <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 focus-within:border-haven-red transition-all">
                        <style>{`
                          .quill-editor .ql-container {
                            font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif !important;
                            font-size: 16px;
                          }
                          .quill-editor .ql-editor {
                            min-height: 500px;
                          }
                          /* Hide font selection if it somehow appears */
                          .ql-font { display: none !important; }
                        `}</style>
                        <ReactQuill 
                          theme="snow"
                          value={legalEditForm.content}
                          onChange={(content) => setLegalEditForm({ ...legalEditForm, content })}
                          className="quill-editor bg-white"
                          modules={{
                            toolbar: [
                              ['bold', 'italic'],
                              [{ 'size': ['small', false, 'large', 'huge'] }],
                              [{ 'background': [] }], // Surlignage
                              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                              ['link'],
                              ['clean'] // User didn't ask for it but it's very useful to reset formatting
                            ],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'OVERVIEW' && (() => {
            // Stats Calculations
            const nonCancelledBookings = bookings.filter(b => b.status !== 'CANCELLED');
            const totalProcessed = nonCancelledBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
            const platformCommissions = nonCancelledBookings.reduce((sum, b) => sum + (b.platformFee || 0), 0);
            
            const totalRoomsCount = listings
              .filter(l => l.status === 'APPROVED')
              .reduce((sum, l) => sum + (l.rooms?.length || 0), 0);
              
            const occupiedRooms = bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED').length;
            const occupancyRate = totalRoomsCount > 0 
              ? Math.round((occupiedRooms / totalRoomsCount) * 100) 
              : 0;

            const pendingCount = bookings.filter(b => b.status === 'PENDING').length;
            const confirmedCount = bookings.filter(b => b.status === 'CONFIRMED').length;
            const completedCount = bookings.filter(b => b.status === 'COMPLETED').length;
            const cancelledCount = bookings.filter(b => b.status === 'CANCELLED').length;
            
            const cityMap: Record<string, number> = {};
            listings.forEach(l => {
              const bCount = bookings.filter(b => b.listingId === l.id && b.status !== 'CANCELLED').length;
              if (bCount > 0) {
                cityMap[l.city] = (cityMap[l.city] || 0) + bCount;
              }
            });
            
            const cityStats = Object.entries(cityMap)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5);

            const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
            const monthlyStatsMap: Record<string, number> = {};
            
            const dStr = new Date();
            for (let i = 5; i >= 0; i--) {
              const mIdx = (dStr.getMonth() - i + 12) % 12;
              monthlyStatsMap[monthNames[mIdx]] = 0;
            }
            
            nonCancelledBookings.forEach(b => {
              if (b.createdAt) {
                const bDate = new Date(b.createdAt);
                const bMonth = monthNames[bDate.getMonth()];
                if (bMonth in monthlyStatsMap) {
                  monthlyStatsMap[bMonth] += b.platformFee || 0;
                }
              }
            });

            const monthlyRevenueData = Object.entries(monthlyStatsMap).map(([month, amount]) => ({
              month,
              amount: Math.round(amount)
            }));

            const maxMonthlyAmount = Math.max(...monthlyRevenueData.map(v => v.amount), 100);

            return (
              <div className="space-y-10 animate-fade-in">
                {/* 1. Bento Grid - Quantitative Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                  {/* Card 1: Users */}
                  <div className="bg-white p-6 rounded-3xl shadow-card border border-gray-100 lg:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                        <Users size={20} />
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilisateurs</span>
                    </div>
                    <div className="text-4xl font-heading font-black text-haven-navy">{users.length}</div>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-haven-stone">
                      <span className="font-bold text-green-600">{users.filter(u => u.status === 'APPROVED').length} active</span> • {users.filter(u => u.status === 'PENDING' || !u.status).length} en attente
                    </div>
                  </div>

                  {/* Card 2: Listings */}
                  <div className="bg-white p-6 rounded-3xl shadow-card border border-gray-100 lg:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-haven-red/5 text-haven-red rounded-2xl">
                        <Home size={20} />
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chambres en Coloc</span>
                    </div>
                    <div className="text-4xl font-heading font-black text-haven-navy">{totalRoomsCount}</div>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-haven-stone">
                      <span className="font-bold text-haven-red">{listings.length} propriétés</span> dans {new Set(listings.map(l => l.city)).size} villes
                    </div>
                  </div>

                  {/* Card 3: Bookings */}
                  <div className="bg-white p-6 rounded-3xl shadow-card border border-gray-100 lg:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <Calendar size={20} />
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Réservations</span>
                    </div>
                    <div className="text-4xl font-heading font-black text-haven-navy">{bookings.length}</div>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-haven-stone">
                      <span className="font-bold text-green-600">{confirmedCount + completedCount} confirmées</span> • {pendingCount} en attente
                    </div>
                  </div>

                  {/* Card 4: Occ Rate */}
                  <div className="bg-white p-6 rounded-3xl shadow-card border border-gray-100 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
                          <CheckCircle size={20} />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Taux d'occupation</span>
                      </div>
                      <span className="font-heading font-bold text-lg text-teal-600">{occupancyRate}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mb-2">
                      <div className="bg-teal-600 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${occupancyRate}%` }}></div>
                    </div>
                    <p className="text-xs text-haven-stone">{occupiedRooms} chambres occupées / {totalRoomsCount} au total</p>
                  </div>

                  {/* Card 5: Finance Volume */}
                  <div className="bg-white p-6 rounded-3xl shadow-card border border-gray-100 lg:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                        <TrendingUp size={20} />
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Volume Financier</span>
                    </div>
                    <div className="text-4xl font-heading font-black text-haven-navy">{totalProcessed.toLocaleString('fr-FR')} €</div>
                    <p className="text-xs text-haven-stone mt-2">Transit sécurisé Stripe (cartes + comptes)</p>
                  </div>

                  {/* Card 6: Commission Revenues */}
                  <div className="bg-white p-6 rounded-3xl shadow-card border border-gray-100 lg:col-span-2 bg-gradient-to-tr from-green-50 to-emerald-50/50 border-green-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-green-600 text-white rounded-2xl shadow-md shadow-green-600/10">
                        <TrendingUp size={20} />
                      </div>
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Revenus commissions (15%)</span>
                    </div>
                    <div className="text-4xl font-heading font-black text-emerald-950">{platformCommissions.toLocaleString('fr-FR')} €</div>
                    <p className="text-xs text-emerald-700 mt-2 font-bold mb-1">Marge brute accumulée HAVEN</p>
                  </div>
                </div>

                {/* 2. Visual Graphs & Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Graph: Commissions evolution */}
                  <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-premium lg:col-span-7 flex flex-col justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-2xl text-haven-navy leading-none mb-1">Marges brutes récoltées (15%)</h3>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Évolution mensuelle des commissions</p>
                    </div>

                    <div className="flex items-end justify-between h-64 px-4 pt-6 pb-2 border-b border-gray-100">
                      {monthlyRevenueData.map((data, idx) => {
                        const heightPercent = Math.max(8, Math.round((data.amount / maxMonthlyAmount) * 100));
                        return (
                          <div key={idx} className="flex flex-col items-center flex-1 group relative">
                            {/* Hover Tooltip */}
                            <div className="absolute -top-12 bg-gray-900 text-white text-[10px] px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-20">
                              <span className="font-bold">{data.amount.toLocaleString('fr-FR')} €</span> de frais
                            </div>
                            {/* Bar styling */}
                            <div 
                              className="w-12 bg-haven-navy rounded-t-xl group-hover:bg-haven-red transition-all cursor-pointer relative shadow-inner overflow-hidden"
                              style={{ height: `${heightPercent}%` }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                            </div>
                            <span className="text-xs text-haven-stone font-bold mt-4">{data.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Graphics: Distribution & Active regions */}
                  <div className="lg:col-span-5 space-y-8">
                    {/* Progress distribution */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-premium space-y-6">
                      <div>
                        <h4 className="font-heading font-bold text-xl text-haven-navy leading-none mb-1">États des Réservations</h4>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Répartition sectorielle globale</p>
                      </div>

                      <div className="space-y-4 pt-2">
                        {[
                          { label: 'Confirmées', count: confirmedCount, color: 'bg-green-600', text: 'text-green-600' },
                          { label: 'Terminées', count: completedCount, color: 'bg-blue-600', text: 'text-blue-600' },
                          { label: 'En attente', count: pendingCount, color: 'bg-amber-500', text: 'text-amber-500' },
                          { label: 'Annulées', count: cancelledCount, color: 'bg-red-500', text: 'text-red-500' }
                        ].map((item, idx) => {
                          const percent = bookings.length > 0 ? Math.round((item.count / bookings.length) * 100) : 0;
                          return (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-haven-navy">
                                <span>{item.label}</span>
                                <span className={item.text}>{item.count} ({percent}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className={`${item.color} h-2 rounded-full`} style={{ width: `${percent}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active cities */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-premium space-y-6">
                      <div>
                        <h4 className="font-heading font-bold text-xl text-haven-navy leading-none mb-1">Top villes</h4>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activité locative par ville</p>
                      </div>

                      <div className="space-y-4">
                        {cityStats.length > 0 ? (
                          cityStats.map((city, idx) => {
                            const totalCleanBookings = bookings.filter(b => b.status !== 'CANCELLED').length;
                            const share = totalCleanBookings > 0 ? Math.round((city.count / totalCleanBookings) * 100) : 0;
                            return (
                              <div key={idx} className="flex justify-between items-center text-xs pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                                <span className="font-bold text-haven-navy">{city.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 font-medium">{city.count} réservation(s)</span>
                                  <span className="bg-teal-50 text-teal-700 px-2 py-0.5 font-black uppercase text-[9px] rounded">{share}%</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-6 text-xs text-gray-400 font-bold">
                            Aucune réservation active pour le moment
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Session Debug block */}
                <div className="bg-gray-950 rounded-[2.5rem] p-10 text-white shadow-premium relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-10">
                    <Shield size={200} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="font-heading font-bold text-2xl mb-8 flex items-center gap-3">
                      <Shield className="text-haven-red" /> Informations Administrateur & Mode Réservations
                    </h3>
                    <div className="grid md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center py-3 border-b border-white/10 text-sm">
                          <span className="text-gray-400">UID Super-Admin</span>
                          <span className="font-mono text-xs">{currentUser?.id}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-white/10 text-sm">
                          <span className="text-gray-400">Rôle de Session</span>
                          <span className="bg-haven-red px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{currentUser?.role}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-white/10 text-sm">
                          <span className="text-gray-400">Email</span>
                          <span className="text-sm">{currentUser?.email}</span>
                        </div>
                      </div>
                      <div className="space-y-6 text-sm">
                        <div className="flex justify-between items-center py-3 border-b border-white/10">
                          <span className="text-gray-400">Session Firebase</span>
                          <span className="text-green-400 font-bold">ACTIVE (TEMPS RÉEL)</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-white/10">
                          <span className="text-gray-400">Règles Firestore</span>
                          <span className="text-green-400 font-bold">SÉCURISÉES (ABAC)</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-white/10">
                          <span className="text-gray-400">Horloge du serveur</span>
                          <span>{new Date().toLocaleTimeString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectionModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-haven-navy/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-8 border-b border-gray-100 bg-gray-50">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-heading font-bold text-haven-navy mb-2">Justifier le refus</h3>
              <p className="text-gray-500 text-sm">
                Veuillez expliquer pourquoi vous refusez {rejectionModal.type === 'LISTING' ? "cette annonce" : "ce compte"}. Ce message sera visible par l'utilisateur.
              </p>
            </div>
            <div className="p-8 space-y-6">
              {rejectionModal.error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={14} />
                  {rejectionModal.error}
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">Motif du refus</label>
                <textarea 
                  value={rejectionModal.reason || ''}
                  onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
                  placeholder="Ex: Photos de mauvaise qualité, informations manquantes, profil incomplet..."
                  className="w-full px-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-haven-red h-32 resize-none transition-all"
                />
              </div>
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  fullWidth 
                  onClick={() => setRejectionModal({ ...rejectionModal, isOpen: false })}
                >
                  Annuler
                </Button>
                <Button 
                  className="bg-haven-red hover:bg-red-700 text-white" 
                  fullWidth
                  onClick={confirmRejection}
                  disabled={processingId !== '' && processingId !== null}
                >
                  {processingId ? <Loader2 className="animate-spin" size={18}/> : "Confirmer le refus"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {userDetailModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-haven-navy/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-haven-navy text-white rounded-2xl">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-heading font-bold text-haven-navy">Fiche Utilisateur</h3>
                  <p className="text-gray-500 text-sm">Détails complets, locations et demandes.</p>
                </div>
              </div>
              <button 
                onClick={() => setUserDetailModal({ ...userDetailModal, isOpen: false })}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <XCircle size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {userDetailModal.isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="animate-spin text-haven-red mb-4" size={48} />
                  <p className="text-gray-500 font-medium">Chargement des données...</p>
                </div>
              ) : userDetailModal.user ? (
                <div className="space-y-10">
                  {/* Basic Info */}
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-3xl border border-gray-100">
                      <img 
                        src={userDetailModal.user.avatarUrl} 
                        alt="" 
                        className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg mb-4"
                      />
                      <h4 className="font-bold text-xl text-haven-navy mb-1">
                        {userDetailModal.user.firstName} {userDetailModal.user.lastName}
                      </h4>
                      <p className="text-sm text-gray-500 mb-4">{userDetailModal.user.email}</p>
                      <div className="flex flex-wrap justify-center gap-2 mb-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${userDetailModal.user.role === UserRole.OWNER ? 'bg-haven-red/5 text-haven-red border-haven-red/10' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                          {userDetailModal.user.role === UserRole.OWNER ? 'Propriétaire' : 'Locataire'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          (userDetailModal.user.status || 'PENDING') === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-100' :
                          (userDetailModal.user.status || 'PENDING') === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-red-50 text-red-600 border-red-100'
                        }`}>
                          {userDetailModal.user.status || 'PENDING'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 w-full">
                        {(userDetailModal.user.status || 'PENDING') !== 'APPROVED' && (
                          <Button 
                            className="bg-green-600 hover:bg-green-700 text-white text-xs py-2"
                            onClick={() => handleUpdateUserStatus(userDetailModal.user!.id, 'APPROVED')}
                            disabled={processingId === userDetailModal.user.id}
                          >
                            {processingId === userDetailModal.user.id ? <Loader2 className="animate-spin" size={14}/> : <UserCheck size={14} className="mr-2"/>}
                            Approuver
                          </Button>
                        )}
                        {(userDetailModal.user.status || 'PENDING') !== 'REJECTED' && (
                          <Button 
                            variant="outline"
                            className="text-red-600 border-red-100 text-xs py-2"
                            onClick={() => openRejectionModal('USER', userDetailModal.user!.id)}
                            disabled={processingId === userDetailModal.user.id}
                          >
                            <Ban size={14} className="mr-2"/> Bannir
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Membre depuis</span>
                          <span className="font-bold text-haven-navy">
                            {userDetailModal.user.createdAt ? new Date(userDetailModal.user.createdAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Vérifié</span>
                          <span className={`font-bold ${userDetailModal.user.isVerified ? 'text-green-600' : 'text-amber-600'}`}>
                            {userDetailModal.user.isVerified ? 'OUI' : 'NON'}
                          </span>
                        </div>
                      </div>
                      <div className="p-6 bg-white border border-gray-100 rounded-2xl">
                        <h5 className="font-bold text-haven-navy mb-2">Bio</h5>
                        <p className="text-sm text-gray-600 italic">
                          {userDetailModal.user.bio || "Aucune bio renseignée."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Documents Section */}
                  <div className="space-y-4">
                    <h4 className="font-heading font-bold text-xl text-haven-navy flex items-center gap-2">
                      <Shield size={20} className="text-haven-red" /> Documents justificatifs
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { key: 'idCard', label: 'Pièce d\'identité' },
                        { key: 'proofOfIncome', label: 'Justificatif revenus' },
                        { key: 'studentCard', label: 'Carte étudiant' }
                      ].map(doc => {
                        const url = userDetailModal.user?.documents?.[doc.key as keyof typeof userDetailModal.user.documents];
                        return (
                          <div key={doc.key} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
                            <FileText size={24} className={url ? "text-haven-navy mb-2" : "text-gray-300 mb-2"} />
                            <p className="text-xs font-bold text-haven-navy mb-2">{doc.label}</p>
                            {url ? (
                              <Button variant="outline" size="sm" onClick={() => setDocPreviewModal({ isOpen: true, title: doc.label, url })}>
                                Voir
                              </Button>
                            ) : (
                              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest italic">Non fourni</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Listings (if owner) */}
                  {userDetailModal.user.role === UserRole.OWNER && (
                    <div className="space-y-4">
                      <h4 className="font-heading font-bold text-xl text-haven-navy flex items-center gap-2">
                        <Home size={20} className="text-haven-red" /> Annonces ({userDetailModal.listings.length})
                      </h4>
                      {userDetailModal.listings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {userDetailModal.listings.map(listing => (
                            <div key={listing.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <img src={listing.mainPhotoUrl} className="w-16 h-16 rounded-xl object-cover" alt=""/>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-haven-navy truncate text-sm">{listing.title}</p>
                                <p className="text-xs text-gray-400">{listing.city} • {listing.rooms[0]?.pricePerDay || 0}€/jour</p>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => window.open(`/#/listing/${listing.id}`, '_blank')}>
                                <Eye size={14} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Aucune annonce créée.</p>
                      )}
                    </div>
                  )}

                  {/* Bookings as Tenant */}
                  <div className="space-y-4">
                    <h4 className="font-heading font-bold text-xl text-haven-navy flex items-center gap-2">
                      <Calendar size={20} className="text-haven-red" /> Demandes de location ({userDetailModal.bookings.length})
                    </h4>
                    {userDetailModal.bookings.length > 0 ? (
                      <div className="space-y-3">
                        {userDetailModal.bookings.map(booking => (
                          <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-white rounded-lg shadow-sm">
                                <FileText size={18} className="text-haven-navy" />
                              </div>
                              <div>
                                <p className="font-bold text-haven-navy text-sm">Réservation #{booking.id.slice(-6)}</p>
                                <p className="text-xs text-gray-400">Du {new Date(booking.startDate).toLocaleDateString()} au {new Date(booking.endDate).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              booking.status === 'CONFIRMED' ? 'bg-green-50 text-green-600 border-green-100' :
                              booking.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              'bg-red-50 text-red-600 border-red-100'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Aucune demande effectuée.</p>
                    )}
                  </div>

                  {/* Received Bookings (if owner) */}
                  {userDetailModal.user.role === UserRole.OWNER && (
                    <div className="space-y-4">
                      <h4 className="font-heading font-bold text-xl text-haven-navy flex items-center gap-2">
                        <MessageSquare size={20} className="text-haven-red" /> Demandes reçues ({userDetailModal.ownerBookings.length})
                      </h4>
                      {userDetailModal.ownerBookings.length > 0 ? (
                        <div className="space-y-3">
                          {userDetailModal.ownerBookings.map(booking => (
                            <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                  <UserCheck size={18} className="text-haven-navy" />
                                </div>
                                <div>
                                  <p className="font-bold text-haven-navy text-sm">Tenant ID: {booking.tenantId.slice(-6)}</p>
                                  <p className="text-xs text-gray-400">Total: {booking.totalPrice}€</p>
                                </div>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                booking.status === 'CONFIRMED' ? 'bg-green-50 text-green-600 border-green-100' :
                                booking.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                'bg-red-50 text-red-600 border-red-100'
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Aucune demande reçue.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 text-gray-400 italic">
                  Utilisateur introuvable.
                </div>
              )}
            </div>
            
            <div className="p-8 border-t border-gray-100 bg-gray-50 shrink-0">
              <Button 
                variant="primary" 
                fullWidth 
                onClick={() => setUserDetailModal({ ...userDetailModal, isOpen: false })}
              >
                Fermer la fiche
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Lightbox */}
      {docPreviewModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-haven-navy/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in border border-white/10">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-haven-navy text-white rounded-xl">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold text-haven-navy">{docPreviewModal.title}</h3>
                  <p className="text-gray-400 text-xs">Aperçu du justificatif</p>
                </div>
              </div>
              <button 
                onClick={() => setDocPreviewModal({ isOpen: false, title: '', url: '' })}
                className="p-1.5 hover:bg-gray-200 rounded-full transition-colors flex items-center justify-center"
              >
                <XCircle size={20} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-haven-navy/[0.02] flex items-center justify-center min-h-[300px]">
              {docPreviewModal.url.startsWith('data:image/') || docPreviewModal.url.includes('unsplash.com') || docPreviewModal.url.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                <img 
                  src={docPreviewModal.url} 
                  className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-md border border-gray-100" 
                  alt="" 
                />
              ) : docPreviewModal.url.startsWith('data:application/pdf') ? (
                <iframe 
                  src={docPreviewModal.url} 
                  className="w-full h-[60vh] rounded-2xl border border-gray-200 shadow-md"
                  title="PDF Viewer"
                />
              ) : (
                <div className="text-center p-8 space-y-4">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                    <FileText size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-haven-navy">Prévisualisation non disponible</p>
                    <p className="text-xs text-gray-500">Le document n'est pas au format image ou PDF standard de manière brute, vous pouvez le télécharger.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.open(docPreviewModal.url, '_blank')}>
                    Ouvrir dans un nouvel onglet
                  </Button>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = docPreviewModal.url;
                  link.setAttribute('download', `${docPreviewModal.title}.pdf`);
                  link.setAttribute('target', '_blank');
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Télécharger le fichier
              </Button>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => setDocPreviewModal({ isOpen: false, title: '', url: '' })}
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
