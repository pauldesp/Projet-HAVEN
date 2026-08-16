
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  Building, 
  MapPin, 
  ArrowRight, 
  ArrowLeft, 
  Wifi, 
  Wind, 
  Trash2, 
  Plus, 
  Minus,
  Upload, 
  Info,
  Maximize2,
  XCircle,
  CheckCircle,
  Loader2,
  RotateCcw,
  ChevronDown,
  Cloud,
  Zap,
  Mic,
  Lock,
  Trees,
  Bike,
  Car,
  Archive,
  Waves,
  Sun,
  Camera,
  Bath,
  Armchair,
  Eye,
  ListChecks,
  Check,
  Star,
  Users,
  Sparkles,
  FileText,
  Shield
} from 'lucide-react';
import { Button } from '../components/Button';
import { CityAutocomplete, PlaceData } from '../components/CityAutocomplete';
import { useListings } from '../contexts/ListingContext';
import { useAuth } from '../contexts/AuthContext';
import { aiService } from '../services/ai';
import { Listing, Room, LegalDocument } from '../types';
import { toast } from 'sonner';
import { apiService } from '../services/api';

type Step = 'TYPE' | 'LOCATION' | 'ADDRESS_CONFIRM' | 'DETAILS' | 'DESCRIPTION' | 'AMENITIES' | 'ROOMS' | 'PHOTOS' | 'REVIEW' | 'LEGAL' | 'SUCCESS';

const STEPS: { id: Step; label: string }[] = [
  { id: 'TYPE', label: 'Type' },
  { id: 'LOCATION', label: 'Emplacement' },
  { id: 'ADDRESS_CONFIRM', label: 'Confirmation' },
  { id: 'DETAILS', label: 'Détails' },
  { id: 'AMENITIES', label: 'Équipements' },
  { id: 'DESCRIPTION', label: 'Description' },
  { id: 'ROOMS', label: 'Chambres' },
  { id: 'PHOTOS', label: 'Photos' },
  { id: 'REVIEW', label: 'Récapitulatif' },
  { id: 'LEGAL', label: 'Validation Légale' }
];

const AMENITIES_LIST = [
  { id: 'Wifi Fibre', icon: <Wifi size={20} /> },
  { id: 'Lave-vaisselle', icon: <Waves size={20} /> },
  { id: 'Lave-linge', icon: <Wind size={20} /> },
  { id: 'Sèche-linge', icon: <Sun size={20} /> },
  { id: 'Fer à repasser', icon: <Zap size={20} /> },
  { id: 'Rangements indépendants', icon: <Archive size={20} /> },
  { id: 'Climatisation', icon: <Wind size={20} /> },
  { id: 'Interphone', icon: <Mic size={20} /> },
  { id: 'Digicode', icon: <Lock size={20} /> },
  { id: 'Balcon / terrasse / jardin', icon: <Trees size={20} /> },
  { id: 'Local vélo', icon: <Bike size={20} /> },
  { id: 'Parking', icon: <Car size={20} /> },
];

const STORAGE_KEY = 'haven_draft_listing';

import { AccountStatusOverlay } from '../components/AccountStatusOverlay';

import ReactMarkdown from 'react-markdown';

export const PublishListing: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { addListing } = useListings();

  const [currentStep, setCurrentStep] = useState<Step>('TYPE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [legalDocs, setLegalDocs] = useState<LegalDocument[]>([]);
  const [activeLegalDoc, setActiveLegalDoc] = useState<{ id: 'specifications' | 'terms', title: string, content: string } | null>(null);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalReadStatus, setLegalReadStatus] = useState({
    specifications: { opened: false, scrolled: false, validated: false },
    terms: { opened: false, scrolled: false, validated: false }
  });
  const specificationsRef = useRef<HTMLDivElement>(null);
  const termsRef = useRef<HTMLDivElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchLegal = async () => {
      try {
        const docs = await apiService.settings.getAllLegalDocuments();
        setLegalDocs(docs);
      } catch (e) {
        console.error("Error fetching legal docs", e);
      }
    };
    fetchLegal();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>, type: 'specifications' | 'terms') => {
    const target = e.currentTarget;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50;
    
    if (isAtBottom) {
      setLegalReadStatus(prev => ({
        ...prev,
        [type]: { ...prev[type], scrolled: true }
      }));
    }
  };

  const openLegalModal = (type: 'specifications' | 'terms') => {
    const doc = type === 'specifications' 
      ? legalDocs.find(d => d.title.toLowerCase().includes('cahier') || d.id === 'specifications')
      : legalDocs.find(d => d.title.toLowerCase().includes('condition') || d.id === 'cgr' || d.id === 'cgu');
    
    if (doc) {
      setActiveLegalDoc({ id: type, title: doc.title, content: doc.content });
      setIsLegalModalOpen(true);
      setLegalReadStatus(prev => ({
        ...prev,
        [type]: { ...prev[type], opened: true }
      }));
    }
  };

  const closeLegalModal = () => {
    setIsLegalModalOpen(false);
    setActiveLegalDoc(null);
  };

  const validateLegalDoc = (type: 'specifications' | 'terms') => {
    setLegalReadStatus(prev => ({
      ...prev,
      [type]: { ...prev[type], validated: true }
    }));
    closeLegalModal();
  };
  
  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else if (!isAuthLoading && currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'ADMIN') {
      // If logged in as TENANT, redirect to login to switch or show host login
      navigate('/login?redirect=/owner/publish&role=OWNER');
    }
  }, [currentUser, isAuthLoading, navigate]);

  const isApproved = currentUser?.status === 'APPROVED' || currentUser?.role === 'ADMIN';

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-haven-cream flex items-center justify-center">
        <Loader2 className="animate-spin text-haven-navy" size={48} />
      </div>
    );
  }

  if (!currentUser || (currentUser.role !== 'OWNER' && currentUser.role !== 'ADMIN')) {
    return null; // Will redirect via useEffect
  }

  if (currentUser && !isApproved) {
    return (
      <div className="min-h-screen bg-haven-cream flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full animate-fade-in-up">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-red-100/50">
            <Lock className="text-haven-red" size={48} />
          </div>
          <h1 className="text-4xl font-heading font-bold text-haven-navy mb-4">Vérification requise</h1>
          <p className="text-haven-stone text-lg mb-10 leading-relaxed">
            Vous devez faire vérifier votre identité avant de pouvoir publier une annonce sur HAVEN. 
            Cette étape garantit la sécurité et le sérieux de notre plateforme.
          </p>
          <div className="space-y-4">
            <Button fullWidth size="lg" onClick={() => setIsVerificationModalOpen(true)}>
              {currentUser.status === 'PENDING' ? 'Vérification en cours...' : 'Faire vérifier mon identité'}
            </Button>
            <Button fullWidth variant="ghost" onClick={() => navigate('/owner/dashboard')}>
              Retour au tableau de bord
            </Button>
          </div>
          <AccountStatusOverlay 
            isOpen={isVerificationModalOpen} 
            onClose={() => setIsVerificationModalOpen(false)} 
          />
        </div>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    type: 'APARTMENT' as 'APARTMENT' | 'HOUSE',
    title: '',
    description: '',
    country: 'France',
    city: '',
    address: '',
    addressComplement: '',
    buildingName: '',
    zipCode: '',
    showPreciseLocation: true,
    surface: 50,
    totalRooms: 1,
    bathrooms: 1,
    cleaningFee: 15,
    amenities: [] as string[],
    isMixed: true,
    bookingMode: 'INSTANT' as 'INSTANT' | 'MANUAL',
    galleryUrls: [] as string[],
      rooms: [
        { id: 'temp-1', name: 'Chambre 1', pricePerDay: 40, size: 12, hasPrivateBath: false, bedSize: 'Double' as any, isAvailable: true, photoUrl: '', hasDesk: true, hasLock: true, hasWardrobe: true, roomPhotos: [] }
      ] as Room[]
  });

  const [highlightFields, setHighlightFields] = useState(false);

  // Sync rooms when totalRooms changes
  const handleTotalRoomsChange = (count: number) => {
    setFormData(prev => {
      const newRooms = [...prev.rooms];
      if (count > newRooms.length) {
        for (let i = newRooms.length; i < count; i++) {
            newRooms.push({
              id: `temp-${Date.now()}-${i}`,
              name: `Chambre ${i + 1}`,
              pricePerDay: 40,
              size: 10,
              hasPrivateBath: false,
              bedSize: 'Double',
              isAvailable: true,
              photoUrl: '',
              hasDesk: true,
              hasLock: true,
              hasWardrobe: true,
              roomPhotos: []
            });
        }
      } else if (count < newRooms.length && count > 0) {
        newRooms.splice(count);
      }
      return { ...prev, totalRooms: count, rooms: newRooms };
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.currentStep !== 'SUCCESS' && parsed.currentStep !== 'TYPE') {
          setShowResumePrompt(true);
        }
      } catch (e) {
        console.error("Erreur lecture brouillon", e);
      }
    }
  }, []);

  useEffect(() => {
    if (currentStep === 'SUCCESS') {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    setIsSaving(true);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ formData, currentStep }));
    
    saveTimeoutRef.current = window.setTimeout(() => {
      setIsSaving(false);
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [formData, currentStep]);

  const handleResume = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { formData: savedData, currentStep: savedStep } = JSON.parse(saved);
      setFormData(savedData);
      setCurrentStep(savedStep);
    }
    setShowResumePrompt(false);
  };

  const handleRestart = () => {
    if (window.confirm("Voulez-vous vraiment effacer ce brouillon et recommencer ?")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const handleNext = () => {
    // Magic fix for address parsing if it failed in CityAutocomplete selection
    if (currentStep === 'LOCATION') {
      const fullAddress = formData.address;
      const parts = fullAddress.split(',').map(p => p.trim());
      
      let newCity = formData.city;
      let newZip = formData.zipCode;
      let newAddress = formData.address;

      // Try to find zip and city in the parts if they are missing
      if (!newCity || !newZip) {
        for (const part of parts) {
          const zipMatch = part.match(/(\d{5})/);
          if (zipMatch) {
            if (!newZip) newZip = zipMatch[1];
            if (!newCity) {
              const cityCandidate = part.replace(zipMatch[1], '').trim();
              if (cityCandidate) newCity = cityCandidate;
            }
          }
        }

        // If city is still missing, look at the part before the country
        if (!newCity && parts.length >= 2) {
          const candidate = parts[parts.length - 2];
          const cityOnly = candidate.replace(/\d+/g, '').trim();
          if (cityOnly) newCity = cityOnly;
        }
      }

      // If the address contains commas, it's likely a full address that needs cleaning
      if (fullAddress.includes(',')) {
        const firstPart = parts[0];
        // If it contains a number, it's likely the street address
        if (/\d/.test(firstPart)) {
          newAddress = firstPart;
        }
      }

      if (newCity !== formData.city || newZip !== formData.zipCode || newAddress !== formData.address) {
        setFormData(prev => ({
          ...prev,
          city: newCity || prev.city,
          zipCode: newZip || prev.zipCode,
          address: newAddress || prev.address
        }));
        setHighlightFields(true);
        setTimeout(() => setHighlightFields(false), 2000);
      }
    }

    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
      window.scrollTo(0, 0);
    }
  };

  const handlePlaceSelect = React.useCallback((place: PlaceData) => {
    setFormData(prev => ({
      ...prev,
      address: place.fullAddress, // Use full address for Step 2 display
      city: place.city,
      zipCode: place.zipCode,
      country: place.country
    }));
    setHighlightFields(true);
    setTimeout(() => setHighlightFields(false), 2000);
  }, []);

  const handleGenerateDescription = async () => {
    setIsGenerating(true);
    try {
      const generated = await aiService.generateListingDescription(formData);
      if (generated) {
        setFormData(prev => ({ ...prev, description: generated }));
      }
    } catch (e) {
      console.error("Erreur génération AI", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddressChange = React.useCallback((val: string) => {
    setFormData(prev => ({ ...prev, address: val }));
  }, []);

  const toggleAmenity = (id: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(id) 
        ? prev.amenities.filter(a => a !== id) 
        : [...prev.amenities, id]
    }));
  };

  const toggleGalleryPhoto = (index: number) => {
    if (formData.galleryUrls[index]) {
      setFormData(prev => {
        const newGallery = [...prev.galleryUrls];
        newGallery.splice(index, 1);
        return { ...prev, galleryUrls: newGallery.filter(Boolean) };
      });
      return;
    }

    const mockPhotos = [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1513584684374-8bdb74838a0f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80'
    ];

    const useCustom = window.confirm("Souhaitez-vous téléverser votre propre photo réelle pour les parties communes ?\n\n(Cliquez sur 'Annuler' pour insérer instantanément une magnifique photo de démonstration HAVEN)");

    if (useCustom) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (!target.files || target.files.length === 0) return;
        const file = target.files[0];
        if (file.size > 1.2 * 1024 * 1024) {
          toast.error("L'image est trop volumineuse (max 1.2 Mo).");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          setFormData(prev => {
            const newGallery = [...prev.galleryUrls];
            newGallery[index] = reader.result as string;
            return { ...prev, galleryUrls: newGallery };
          });
          toast.success("Votre photo a bien été téléversée !");
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      setFormData(prev => {
        const newGallery = [...prev.galleryUrls];
        newGallery[index] = mockPhotos[index % mockPhotos.length];
        return { ...prev, galleryUrls: newGallery.filter(Boolean) };
      });
      toast.success("Photo de démonstration HAVEN sélectionnée !");
    }
  };

  const toggleRoomPhoto = (roomId: string, photoIndex: number) => {
    const mockRoomPhotos = [
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=800&q=80'
    ];

    // Check if photo at photoIndex already exists for this room
    let photoExists = false;
    setFormData(prev => {
      const room = prev.rooms.find(r => r.id === roomId);
      if (room && room.roomPhotos && room.roomPhotos[photoIndex]) {
        photoExists = true;
      }
      return prev;
    });

    if (photoExists) {
      setFormData(prev => ({
        ...prev,
        rooms: prev.rooms.map(r => {
          if (r.id === roomId) {
            const newPhotos = [...(r.roomPhotos || [])];
            newPhotos.splice(photoIndex, 1);
            return { ...r, roomPhotos: newPhotos.filter(Boolean), photoUrl: newPhotos[0] || '' };
          }
          return r;
        })
      }));
      return;
    }

    const useCustom = window.confirm("Souhaitez-vous téléverser votre propre photo réelle pour cette chambre ?\n\n(Cliquez sur 'Annuler' pour insérer une magnifique photo de démonstration de chambre)");

    if (useCustom) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (!target.files || target.files.length === 0) return;
        const file = target.files[0];
        if (file.size > 1.2 * 1024 * 1024) {
          toast.error("L'image de la chambre est trop volumineuse (max 1.2 Mo).");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          setFormData(prev => ({
            ...prev,
            rooms: prev.rooms.map(r => {
              if (r.id === roomId) {
                const newPhotos = [...(r.roomPhotos || [])];
                newPhotos[photoIndex] = reader.result as string;
                return { ...r, roomPhotos: newPhotos.filter(Boolean), photoUrl: newPhotos[0] || '' };
              }
              return r;
            })
          }));
          toast.success("Photo de la chambre ajoutée !");
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      setFormData(prev => ({
        ...prev,
        rooms: prev.rooms.map(r => {
          if (r.id === roomId) {
            const newPhotos = [...(r.roomPhotos || [])];
            newPhotos[photoIndex] = mockRoomPhotos[photoIndex % mockRoomPhotos.length];
            return { ...r, roomPhotos: newPhotos.filter(Boolean), photoUrl: newPhotos[0] || '' };
          }
          return r;
        })
      }));
      toast.success("Photo de démonstration sélectionnée !");
    }
  };

  const handleSuggestRoomNames = () => {
    const themes = [
      ['Chambre Zen', 'Chambre Bohème', 'Chambre Loft', 'Chambre Scandinave'],
      ['Suite Royale', 'Chambre Cosy', 'Chambre Design', 'Chambre Vintage'],
      ['Chambre Horizon', 'Chambre Azur', 'Chambre Émeraude', 'Chambre Rubis'],
      ['Chambre Parisienne', 'Chambre Londonienne', 'Chambre Berlinoise', 'Chambre Madrilène']
    ];
    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];
    
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((r, i) => ({
        ...r,
        name: selectedTheme[i % selectedTheme.length] || `Chambre ${i + 1}`
      }))
    }));
  };

  const updateRoom = (id: string, updates: Partial<Room>) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    
    // Tentative de géocodage de la ville pour la recherche de proximité
    let coords = { lat: 48.8566, lng: 2.3522 }; // Default Paris
    try {
      const aiCoords = await aiService.getCityCoordinates(formData.city);
      if (aiCoords) coords = aiCoords;
    } catch (e) {
      console.error("Erreur geocoding lors de la publication", e);
    }

    const newListing: Listing = {
      id: `l-${Date.now()}`,
      title: formData.title || "Nouveau logement",
      description: formData.description,
      city: formData.city,
      address: `${formData.address}${formData.addressComplement ? ', ' + formData.addressComplement : ''}`,
      coordinates: coords,
      type: formData.type,
      status: 'PENDING',
      totalRooms: formData.totalRooms,
      availableRooms: formData.rooms.length,
      surface: formData.surface,
      minStay: 2, // Default to 2 days
      amenities: formData.amenities,
      ownerId: currentUser.id,
      mainPhotoUrl: formData.galleryUrls[0] || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
      rating: 0,
      reviewsCount: 0,
      isMixed: formData.isMixed,
      bathrooms: formData.bathrooms,
      cleaningFee: formData.cleaningFee,
      rooms: formData.rooms,
      galleryUrls: formData.galleryUrls
    };
    await addListing(newListing);
    setIsSubmitting(false);
    setCurrentStep('SUCCESS');
    localStorage.removeItem(STORAGE_KEY);
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 'TYPE': return true;
      case 'LOCATION': return (formData.address || '').length >= 2; 
      case 'ADDRESS_CONFIRM': return (formData.city || '').length >= 2 && (formData.address || '').length >= 2 && (formData.zipCode || '').length >= 4;
      case 'DETAILS': return formData.title.length > 5 && formData.surface > 0 && formData.totalRooms > 0;
      case 'DESCRIPTION': return formData.description.length > 10;
      case 'AMENITIES': return true;
      case 'ROOMS': return formData.rooms.every(r => r.pricePerDay > 0 && r.size > 0);
      case 'PHOTOS': return formData.galleryUrls.length >= 3;
      case 'REVIEW': return true;
      case 'LEGAL': return legalReadStatus.specifications.validated && legalReadStatus.terms.validated;
      default: return false;
    }
  };

  const minPrice = Math.min(...formData.rooms.map(r => r.pricePerDay));

  if (showResumePrompt) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-haven-navy/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-[2.5rem] shadow-premium max-w-lg w-full p-10 text-center space-y-8 animate-fade-in-up">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><RotateCcw size={36} /></div>
          <div className="space-y-3">
            <h1 className="text-3xl font-heading font-bold text-haven-navy">Reprendre là où vous vous étiez arrêté ?</h1>
            <p className="text-haven-stone leading-relaxed">Nous avons retrouvé une annonce en cours de création. Voulez-vous continuer ou recommencer à zéro ?</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button size="lg" fullWidth onClick={handleResume}>Continuer mon annonce</Button>
            <button onClick={() => setShowResumePrompt(false)} className="py-4 text-sm font-bold text-haven-stone hover:text-haven-red transition-colors">Recommencer une nouvelle annonce</button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-haven-cream flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full animate-fade-in-up">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-100/50"><CheckCircle className="text-green-600" size={48} /></div>
          <h1 className="text-4xl font-heading font-bold text-haven-navy mb-4">Annonce envoyée !</h1>
          <p className="text-haven-stone text-lg mb-10 leading-relaxed">Votre logement est maintenant en cours de vérification par notre équipe. Il sera visible sur HAVEN d'ici 24h.</p>
          <div className="space-y-4">
            <Button fullWidth size="lg" onClick={() => navigate('/owner/dashboard')}>Aller au tableau de bord</Button>
            <Button fullWidth variant="ghost" onClick={() => navigate('/')}>Retour à l'accueil</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-haven-cream font-body flex flex-col">
      {/* Header Sticky Progress */}
      <div className="sticky top-24 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/owner/dashboard')} className="text-haven-stone hover:text-haven-navy transition-colors"><XCircle size={24} /></button>
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex flex-col">
            <span className="font-heading font-bold text-sm md:text-lg text-haven-navy leading-tight">Publier mon logement</span>
            <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-opacity duration-500 ${isSaving ? 'text-blue-500' : 'text-green-500 opacity-60'}`}>
              <Cloud size={12} /> {isSaving ? 'Sauvegarde...' : 'Brouillon enregistré'}
            </div>
          </div>
        </div>
        <div className="hidden md:flex gap-2">
          {STEPS.map((step, idx) => (
            <div key={step.id} className={`h-2 w-8 rounded-full transition-all duration-500 ${STEPS.findIndex(s => s.id === currentStep) >= idx ? 'bg-haven-navy' : 'bg-gray-200'}`} />
          ))}
        </div>
        <button onClick={handleRestart} className="text-[10px] font-black uppercase tracking-widest text-haven-stone hover:text-haven-red flex items-center gap-1.5 transition-colors"><RotateCcw size={12} /> Recommencer</button>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 pb-32">
        {currentStep === 'TYPE' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="space-y-2 text-center md:text-left">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Quel type de logement proposez-vous ?</h1>
              <p className="text-haven-stone">Sélectionnez la catégorie qui correspond le mieux à votre bien.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div onClick={() => setFormData({...formData, type: 'APARTMENT'})} className={`p-8 border-2 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col gap-4 ${formData.type === 'APARTMENT' ? 'border-haven-navy bg-haven-navy/5 shadow-premium' : 'border-gray-100 bg-white hover:border-gray-200 shadow-soft'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${formData.type === 'APARTMENT' ? 'bg-haven-navy text-white' : 'bg-gray-50 text-haven-stone'}`}><Building size={28} /></div>
                <div><h3 className="font-bold text-xl text-haven-navy">Appartement</h3><p className="text-sm text-haven-stone">Logement situé dans un immeuble partagé.</p></div>
              </div>
              <div onClick={() => setFormData({...formData, type: 'HOUSE'})} className={`p-8 border-2 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col gap-4 ${formData.type === 'HOUSE' ? 'border-haven-navy bg-haven-navy/5 shadow-premium' : 'border-gray-100 bg-white hover:border-gray-200 shadow-soft'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${formData.type === 'HOUSE' ? 'bg-haven-navy text-white' : 'bg-gray-50 text-haven-stone'}`}><Home size={28} /></div>
                <div><h3 className="font-bold text-xl text-haven-navy">Maison</h3><p className="text-sm text-haven-stone">Propriété individuelle avec ou sans extérieur.</p></div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'LOCATION' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="space-y-2">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Où est situé votre logement ?</h1>
              <p className="text-haven-stone">Saisissez l'adresse précise pour garantir une mise en relation efficace.</p>
            </div>
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-soft">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest mb-4">Recherchez votre adresse exacte</label>
                <CityAutocomplete 
                  value={formData.address} 
                  onChange={handleAddressChange}
                  onSelect={handlePlaceSelect}
                  placeholder="Ex: 4 Rue Jeanne d'Arc, Niort"
                  isAddressMode={true}
                />
                <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                  <Info size={18} className="text-blue-500 mt-0.5" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <strong>Conseil HAVEN :</strong> Utilisez l'autocomplétion pour sélectionner l'adresse suggérée. Cela permet de remplir automatiquement la ville et le code postal, garantissant ainsi l'exactitude des données.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'ADDRESS_CONFIRM' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="space-y-2">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Confirmez votre adresse</h1>
            </div>
            <div className="bg-white rounded-2xl border border-gray-300 overflow-hidden shadow-soft">
              <div className="px-4 py-3 border-b border-gray-200 bg-white">
                <label className="block text-[11px] font-medium text-haven-stone">Pays/région</label>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-haven-navy font-medium text-sm">{formData.country}</span>
                  <ChevronDown size={18} className="text-haven-stone" />
                </div>
              </div>
              <div className="px-4 py-3 border-b border-gray-200 focus-within:bg-gray-50 transition-colors">
                <label className="block text-[11px] font-medium text-haven-stone">Numéro et libellé de voie</label>
                <input type="text" value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} className={`w-full bg-white outline-none text-haven-navy font-medium text-sm transition-all ${highlightFields ? 'bg-blue-50/50' : ''}`} />
              </div>
              <div className="px-4 py-3 border-b border-gray-200 focus-within:bg-gray-50 transition-colors">
                <label className="block text-[11px] font-medium text-haven-stone">Code postal</label>
                <input type="text" value={formData.zipCode || ''} onChange={(e) => setFormData({...formData, zipCode: e.target.value})} className={`w-full bg-white outline-none text-haven-navy font-medium text-sm transition-all ${highlightFields ? 'bg-blue-50/50' : ''}`} />
              </div>
              <div className="px-4 py-3 focus-within:bg-gray-50 transition-colors">
                <label className="block text-[11px] font-medium text-haven-stone">Commune</label>
                <input type="text" value={formData.city || ''} onChange={(e) => setFormData({...formData, city: e.target.value})} className={`w-full bg-white outline-none text-haven-navy font-medium text-sm transition-all ${highlightFields ? 'bg-blue-50/50' : ''}`} />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'DETAILS' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="space-y-2">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Les caractéristiques du bien</h1>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-soft space-y-4">
              <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest">Nom de la colocation</label>
              <input 
                type="text" 
                value={formData.title || ''} 
                onChange={(e) => setFormData({...formData, title: e.target.value})} 
                placeholder="Exemple : Coloc Jeanne d'Arc" 
                className="w-full text-2xl font-bold text-haven-navy placeholder-gray-300 outline-none bg-white" 
              />
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest mb-4">Surface (m²)</label>
                <input type="number" value={formData.surface || 0} onChange={(e) => setFormData({...formData, surface: parseInt(e.target.value) || 0})} className="text-2xl font-bold text-haven-navy outline-none w-full bg-white" />
              </div>
              
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest mb-4">Nombre de chambres</label>
                <div className="flex items-center gap-4 mt-2">
                  <button 
                    onClick={() => handleTotalRoomsChange(Math.max(1, formData.totalRooms - 1))}
                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-haven-navy hover:bg-gray-100 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-2xl font-bold text-haven-navy min-w-[1.5rem] text-center">{formData.totalRooms}</span>
                  <button 
                    onClick={() => handleTotalRoomsChange(formData.totalRooms + 1)}
                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-haven-navy hover:bg-gray-100 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest mb-4">Salles de bain</label>
                <div className="flex items-center gap-4 mt-2">
                  <button 
                    onClick={() => setFormData(prev => ({ ...prev, bathrooms: Math.max(1, prev.bathrooms - 1) }))}
                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-haven-navy hover:bg-gray-100 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-2xl font-bold text-haven-navy min-w-[1.5rem] text-center">{formData.bathrooms}</span>
                  <button 
                    onClick={() => setFormData(prev => ({ ...prev, bathrooms: prev.bathrooms + 1 }))}
                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-haven-navy hover:bg-gray-100 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest mb-4">Frais de ménage (€ par location)</label>
                <div className="flex items-center gap-4 mt-2">
                  <button 
                    onClick={() => setFormData(prev => ({ ...prev, cleaningFee: Math.max(0, prev.cleaningFee - 5) }))}
                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-haven-navy hover:bg-gray-100 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-2xl font-bold text-haven-navy min-w-[1.5rem] text-center">{formData.cleaningFee}</span>
                  <button 
                    onClick={() => setFormData(prev => ({ ...prev, cleaningFee: prev.cleaningFee + 5 }))}
                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-haven-navy hover:bg-gray-100 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft flex flex-col justify-center gap-4">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest">Mixité</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFormData({...formData, isMixed: !formData.isMixed})} className={`w-10 h-5 rounded-full p-1 transition-all ${formData.isMixed ? 'bg-haven-navy' : 'bg-gray-200'}`}><div className={`w-3 h-3 bg-white rounded-full transition-transform ${formData.isMixed ? 'translate-x-5' : ''}`} /></button>
                  <span className="font-bold text-xs text-haven-navy">{formData.isMixed ? 'Mixte' : 'Non-mixte'}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft flex flex-col justify-center gap-4 col-span-full">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest">Processus de réservation</label>
                <div className="grid md:grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, bookingMode: 'INSTANT'})} 
                    className={`p-5 rounded-2xl border text-left transition-all flex flex-col h-full justify-between ${formData.bookingMode === 'INSTANT' ? 'border-haven-navy bg-haven-navy/5 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}
                  >
                    <div>
                      <p className="font-bold text-base text-haven-navy">Validation instantanée</p>
                      <p className="text-[11px] text-haven-stone mt-1.5 leading-relaxed">Le locataire réserve et paye directement. Sa chambre est confirmée instantanément.</p>
                    </div>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, bookingMode: 'MANUAL'})} 
                    className={`p-5 rounded-2xl border text-left transition-all flex flex-col h-full justify-between ${formData.bookingMode === 'MANUAL' ? 'border-haven-navy bg-haven-navy/5 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}
                  >
                    <div>
                      <p className="font-bold text-base text-haven-navy">Validation manuelle</p>
                      <p className="text-[11px] text-haven-stone mt-1.5 leading-relaxed">Le locataire fait une demande. Vous avez 48h pour l'accepter, puis il aura 72h pour payer.</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'DESCRIPTION' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Décrivez l'expérience HAVEN</h1>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleGenerateDescription}
                disabled={isGenerating}
                className="text-haven-red hover:bg-haven-red/5 gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Sparkles size={18} />
                )}
                Rédiger avec l'IA
              </Button>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-premium relative">
              <textarea 
                rows={10} 
                value={formData.description || ''} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                placeholder="Racontez l'histoire de ce lieu..." 
                className="w-full outline-none text-haven-navy text-lg leading-relaxed bg-white" 
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] rounded-[2.5rem] flex items-center justify-center">
                  <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-premium border border-gray-100">
                    <Loader2 className="animate-spin text-haven-red" size={20} />
                    <span className="font-bold text-haven-navy">Gemini rédige votre annonce...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 'AMENITIES' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="space-y-2">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Équipements et services</h1>
              <div className="bg-blue-50 p-4 rounded-2xl flex items-center gap-3 border border-blue-100">
                <Info size={18} className="text-blue-500" />
                <p className="text-xs text-blue-800">Cuisine équipée et ménage inclus d'office.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {AMENITIES_LIST.map(amenity => (
                <div key={amenity.id} onClick={() => toggleAmenity(amenity.id)} className={`p-6 border-2 rounded-3xl cursor-pointer transition-all flex flex-col gap-4 ${formData.amenities.includes(amenity.id) ? 'border-haven-navy bg-haven-navy/5' : 'border-gray-100 bg-white shadow-soft'}`}>
                  <div className={formData.amenities.includes(amenity.id) ? 'text-haven-navy' : 'text-haven-stone'}>{amenity.icon}</div>
                  <span className="font-bold text-xs text-haven-navy">{amenity.id}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'ROOMS' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Configurez vos chambres</h1>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSuggestRoomNames}
                className="text-haven-red hover:bg-haven-red/5 gap-2"
              >
                <Sparkles size={18} />
                Suggérer des noms originaux
              </Button>
            </div>
            <div className="space-y-12">
              {formData.rooms.map((room, index) => (
                <div key={room.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-premium overflow-hidden flex flex-col lg:flex-row">
                  {/* Form Part */}
                  <div className="flex-1 p-8 md:p-10 space-y-10 border-r border-gray-50">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-haven-stone uppercase tracking-widest">Nom de la chambre</label>
                        <input type="text" value={room.name || ''} onChange={(e) => updateRoom(room.id, { name: e.target.value })} className="block w-full text-2xl font-bold text-haven-navy bg-white outline-none" />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-haven-stone uppercase tracking-widest block mb-1">Prix / Jour</span>
                        <div className="flex items-center gap-1">
                          <input type="number" value={room.pricePerDay || 0} onChange={(e) => updateRoom(room.id, { pricePerDay: parseInt(e.target.value) || 0 })} className="w-20 text-2xl font-bold text-haven-navy text-right bg-white outline-none" />
                          <span className="text-xl font-bold text-haven-navy">€</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Dimension */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-haven-stone uppercase tracking-widest">Surface (m²)</label>
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                          <Maximize2 size={18} className="text-gray-300"/>
                          <input type="number" value={room.size || 0} onChange={(e) => updateRoom(room.id, { size: parseInt(e.target.value) || 0 })} className="w-full text-lg font-bold text-haven-navy bg-white outline-none" />
                        </div>
                      </div>

                      {/* Type de lit */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-haven-stone uppercase tracking-widest">Type de lit</label>
                        <div className="flex bg-gray-50 p-1 rounded-xl">
                          <button onClick={() => updateRoom(room.id, { bedSize: 'Single' })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${room.bedSize === 'Single' ? 'bg-white text-haven-navy shadow-sm' : 'text-haven-stone hover:text-haven-navy'}`}>Simple</button>
                          <button onClick={() => updateRoom(room.id, { bedSize: 'Double' })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${room.bedSize === 'Double' ? 'bg-white text-haven-navy shadow-sm' : 'text-haven-stone hover:text-haven-navy'}`}>Double</button>
                        </div>
                      </div>
                    </div>

                    {/* Toggles grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <button onClick={() => updateRoom(room.id, { hasPrivateBath: !room.hasPrivateBath })} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${room.hasPrivateBath ? 'border-haven-navy bg-haven-navy/5 text-haven-navy' : 'border-gray-50 text-haven-stone'}`}>
                        <Bath size={20} />
                        <span className="text-[10px] font-black uppercase text-center">SDB Privée</span>
                      </button>
                      <button onClick={() => updateRoom(room.id, { hasDesk: !room.hasDesk })} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${room.hasDesk ? 'border-haven-navy bg-haven-navy/5 text-haven-navy' : 'border-gray-50 text-haven-stone'}`}>
                        <Maximize2 size={20} />
                        <span className="text-[10px] font-black uppercase text-center">Bureau</span>
                      </button>
                      <button onClick={() => updateRoom(room.id, { hasLock: !room.hasLock })} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${room.hasLock ? 'border-haven-navy bg-haven-navy/5 text-haven-navy' : 'border-gray-50 text-haven-stone'}`}>
                        <Lock size={20} />
                        <span className="text-[10px] font-black uppercase text-center">Verrou</span>
                      </button>
                      <button onClick={() => updateRoom(room.id, { hasWardrobe: !room.hasWardrobe })} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${room.hasWardrobe ? 'border-haven-navy bg-haven-navy/5 text-haven-navy' : 'border-gray-50 text-haven-stone'}`}>
                        <Armchair size={20} />
                        <span className="text-[10px] font-black uppercase text-center">Armoire</span>
                      </button>
                    </div>
                  </div>

                  {/* Photos Part */}
                  <div className="w-full lg:w-72 bg-gray-50/50 p-8 flex flex-col gap-4">
                    <label className="text-[10px] font-black text-haven-stone uppercase tracking-widest mb-1 flex items-center gap-2">
                      <Camera size={14}/> Photos (max 3)
                    </label>
                    <div className="grid grid-cols-3 lg:grid-cols-1 gap-4">
                      {[0, 1, 2].map((i) => (
                        <div 
                          key={i} 
                          onClick={() => toggleRoomPhoto(room.id, i)}
                          className="aspect-square bg-white border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-haven-navy transition-all group overflow-hidden relative"
                        >
                          {room.roomPhotos?.[i] ? (
                            <>
                              <img src={room.roomPhotos[i]} className="w-full h-full object-cover" alt="" />
                              <div className="absolute inset-0 bg-haven-navy/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Trash2 className="text-white" size={20} />
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload size={20} className="text-gray-300 group-hover:text-haven-navy" />
                              <span className="text-[9px] font-bold text-gray-400 mt-2 uppercase">Slot {i+1}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'PHOTOS' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="space-y-2 text-center">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Mise en lumière globale</h1>
              <p className="text-haven-stone">Ajoutez entre 3 et 8 photos des parties communes (salon, cuisine, terrasse...).</p>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest ${formData.galleryUrls.length >= 3 ? 'bg-green-50 text-green-600' : 'bg-haven-red/5 text-haven-red'}`}>
                {formData.galleryUrls.length < 3 ? (
                  <><Info size={14}/> Encore {3 - formData.galleryUrls.length} photo{3 - formData.galleryUrls.length > 1 ? 's' : ''} minimum</>
                ) : (
                  <><CheckCircle size={14}/> {formData.galleryUrls.length} photo{formData.galleryUrls.length > 1 ? 's' : ''} ajoutée{formData.galleryUrls.length > 1 ? 's' : ''}</>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div 
                  key={i} 
                  onClick={() => toggleGalleryPhoto(i)}
                  className={`aspect-[4/3] bg-white border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden relative ${formData.galleryUrls[i] ? 'border-haven-navy shadow-premium' : 'border-gray-100 hover:border-haven-navy hover:bg-gray-50'}`}
                >
                  {formData.galleryUrls[i] ? (
                    <>
                      <img src={formData.galleryUrls[i]} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-haven-navy/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Trash2 className="text-white" size={24} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 group-hover:text-haven-navy group-hover:bg-white transition-all">
                        <Upload size={20} />
                      </div>
                      <span className="text-[10px] font-black text-gray-400 mt-3 uppercase tracking-widest">Photo {i+1}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'REVIEW' && (
          <div className="space-y-10 animate-fade-in-up">
            <div className="space-y-2">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Récapitulatif de votre annonce</h1>
              <p className="text-haven-stone">Vérifiez les détails avant de mettre votre bien en ligne.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">
              {/* Technical Recap (Left Column) */}
              <div className="lg:col-span-2 space-y-8">
                {/* General Infos */}
                <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-soft space-y-6">
                  <div className="flex items-center gap-3 text-haven-navy">
                    <Info size={24} className="text-haven-red" />
                    <h3 className="font-heading font-bold text-xl">Informations Générales</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-y-4 gap-x-12">
                    <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Titre de l'annonce</span><span className="font-bold text-haven-navy">{formData.title}</span></div>
                    <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Type de bien</span><span className="font-bold text-haven-navy">{formData.type === 'APARTMENT' ? 'Appartement' : 'Maison'}</span></div>
                    <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Adresse</span><span className="font-bold text-haven-navy">{formData.address}, {formData.city}</span></div>
                    <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Surface Totale</span><span className="font-bold text-haven-navy">{formData.surface}m²</span></div>
                    <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Salles de bain</span><span className="font-bold text-haven-navy">{formData.bathrooms}</span></div>
                  </div>
                </div>

                {/* Rooms List */}
                <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-soft space-y-6">
                  <div className="flex items-center gap-3 text-haven-navy">
                    <ListChecks size={24} className="text-haven-red" />
                    <h3 className="font-heading font-bold text-xl">Détail des chambres ({formData.rooms.length})</h3>
                  </div>
                  <div className="space-y-4">
                    {formData.rooms.map((room, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl border border-gray-200 flex items-center justify-center font-bold text-haven-navy shadow-sm overflow-hidden">
                            {room.roomPhotos?.[0] ? (
                              <img src={room.roomPhotos[0]} className="w-full h-full object-cover" alt="" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-haven-navy">{room.name}</p>
                            <p className="text-xs text-haven-stone">{room.size}m² • Lit {room.bedSize} {room.hasPrivateBath ? '• SDB Privée' : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-haven-navy">{room.pricePerDay}€</span>
                          <span className="text-[10px] text-gray-400 uppercase block">/ jour</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Description Preview */}
                <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-soft space-y-4">
                  <h3 className="font-heading font-bold text-xl text-haven-navy">Description</h3>
                  <div className="prose prose-sm prose-slate max-w-none 
                  prose-p:text-haven-stone prose-p:leading-relaxed prose-p:mb-4 prose-p:mt-0
                  prose-li:text-haven-stone prose-li:my-0.5
                  prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-4
                  prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-4
                  prose-strong:text-haven-navy prose-strong:font-bold
                  break-words">
                  <ReactMarkdown>{formData.description.replace(/\n/g, '  \n')}</ReactMarkdown>
                </div>
                </div>

                {/* Gallery Preview */}
                <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-soft space-y-6">
                  <div className="flex items-center gap-3 text-haven-navy">
                    <Camera size={24} className="text-haven-red" />
                    <h3 className="font-heading font-bold text-xl">Photos des parties communes ({formData.galleryUrls.length})</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {formData.galleryUrls.map((url, idx) => (
                      <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-gray-100">
                        <img src={url} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visual Simulation (Right Column) */}
              <div className="space-y-6 lg:sticky lg:top-40">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={20} className="text-haven-red" />
                  <span className="text-sm font-bold text-haven-navy uppercase tracking-widest">Aperçu du résultat</span>
                </div>
                
                {/* Simulated Listing Card */}
                <div className="bg-white rounded-[2.5rem] shadow-premium overflow-hidden border border-gray-100 group transition-all p-3 hover:shadow-2xl hover:-translate-y-1">
                  <div className="relative aspect-[16/10] bg-gray-200 overflow-hidden rounded-2xl">
                    <img src={formData.galleryUrls[0] || "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80"} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                    <div className="absolute top-4 left-4 bg-white/95 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-haven-navy shadow-sm">{formData.type === 'HOUSE' ? 'Maison' : 'Appartement'}</div>
                    {formData.isMixed && <div className="absolute top-4 right-4 bg-haven-navy/80 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white">Mixte</div>}
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <h3 className="font-heading font-bold text-xl text-haven-navy group-hover:text-haven-red transition-colors">{formData.title || "Titre de l'annonce"}</h3>
                      <div className="flex items-center gap-1 font-bold text-sm"><Star size={14} className="fill-haven-red text-haven-red"/> 0.0</div>
                    </div>
                    <div className="flex items-center gap-2 text-haven-stone text-sm"><MapPin size={16}/> {formData.city}</div>
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400 pt-2">
                      <span className="flex items-center gap-1"><Users size={14}/> {formData.rooms.length} ch.</span>
                      <span className="flex items-center gap-1"><Bath size={14}/> {formData.bathrooms} sdb.</span>
                      <span className="flex items-center gap-1"><Maximize2 size={14}/> {formData.surface}m²</span>
                    </div>
                    <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                       <div>
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">À partir de</span>
                         <span className="font-heading font-bold text-2xl text-haven-navy">{minPrice}€</span>
                         <span className="text-gray-400 text-xs font-bold"> / jour</span>
                       </div>
                       <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-haven-navy group-hover:bg-haven-red group-hover:text-white transition-all duration-300">
                         <ArrowRight size={18} />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="bg-haven-red/5 p-6 rounded-[2rem] border border-haven-red/10">
                   <p className="text-xs text-haven-red font-medium leading-relaxed">
                     <strong>Note</strong> : Votre annonce sera soumise à une vérification manuelle par nos équipes avant d'être publiée officiellement sur la plateforme.
                   </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'LEGAL' && (
          <div className="space-y-10 animate-fade-in-up">
            <div className="space-y-4">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Validation Légale</h1>
              <p className="text-haven-stone text-lg max-w-2xl">
                Pour garantir la sécurité et la qualité de la plateforme, nous vous demandons de prendre connaissance et d'accepter les documents suivants.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Cahier des charges Card */}
              <div className={`relative bg-white rounded-[2.5rem] p-10 border transition-all duration-500 flex flex-col h-full ${
                legalReadStatus.specifications.validated 
                  ? 'border-green-200 shadow-sm' 
                  : 'border-gray-100 shadow-premium hover:shadow-2xl hover:-translate-y-1'
              }`}>
                <div className="flex items-start justify-between mb-8">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-colors ${
                    legalReadStatus.specifications.validated ? 'bg-green-100 text-green-600' : 'bg-haven-red/10 text-haven-red'
                  }`}>
                    <FileText size={32} />
                  </div>
                  {legalReadStatus.specifications.validated && (
                    <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Check size={14} /> Validé
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-10 flex-grow">
                  <h3 className="font-heading font-bold text-2xl text-haven-navy">Cahier des charges</h3>
                  <p className="text-haven-stone leading-relaxed">
                    Standards de qualité, engagements de service et règles de vie pour les logements HAVEN.
                  </p>
                </div>

                <Button 
                  fullWidth 
                  variant={legalReadStatus.specifications.validated ? "outline" : "primary"}
                  onClick={() => openLegalModal('specifications')}
                  className="rounded-2xl py-5 text-base font-bold group"
                >
                  {legalReadStatus.specifications.validated ? "Consulter à nouveau" : "Lire et accepter"}
                  {!legalReadStatus.specifications.validated && <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />}
                </Button>
              </div>

              {/* Conditions Générales Card */}
              <div className={`relative bg-white rounded-[2.5rem] p-10 border transition-all duration-500 flex flex-col h-full ${
                legalReadStatus.terms.validated 
                  ? 'border-green-200 shadow-sm' 
                  : 'border-gray-100 shadow-premium hover:shadow-2xl hover:-translate-y-1'
              }`}>
                <div className="flex items-start justify-between mb-8">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-colors ${
                    legalReadStatus.terms.validated ? 'bg-green-100 text-green-600' : 'bg-haven-red/10 text-haven-red'
                  }`}>
                    <Shield size={32} />
                  </div>
                  {legalReadStatus.terms.validated && (
                    <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Check size={14} /> Validé
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-10 flex-grow">
                  <h3 className="font-heading font-bold text-2xl text-haven-navy">Conditions Générales</h3>
                  <p className="text-haven-stone leading-relaxed">
                    Cadre contractuel, responsabilités juridiques et conditions d'utilisation de la plateforme.
                  </p>
                </div>

                <Button 
                  fullWidth 
                  variant={legalReadStatus.terms.validated ? "outline" : "primary"}
                  onClick={() => openLegalModal('terms')}
                  className="rounded-2xl py-5 text-base font-bold group"
                >
                  {legalReadStatus.terms.validated ? "Consulter à nouveau" : "Lire et accepter"}
                  {!legalReadStatus.terms.validated && <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />}
                </Button>
              </div>
            </div>

            <div className="bg-haven-navy/5 p-8 rounded-[2.5rem] border border-haven-navy/10 flex items-start gap-4">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-haven-navy shadow-sm shrink-0">
                <Info size={20} />
              </div>
              <p className="text-sm text-haven-navy/70 leading-relaxed">
                En publiant votre annonce, vous vous engagez à respecter ces documents. HAVEN se réserve le droit de suspendre toute annonce ne respectant pas ces standards de qualité.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legal Modal */}
      {isLegalModalOpen && activeLegalDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8">
          <div className="absolute inset-0 bg-haven-navy/80 backdrop-blur-md animate-fade-in" onClick={closeLegalModal} />
          <div className="relative bg-white w-full max-w-5xl h-full md:h-[90vh] md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-haven-red/10 rounded-2xl flex items-center justify-center text-haven-red">
                  {activeLegalDoc.id === 'specifications' ? <FileText size={24} /> : <Shield size={24} />}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xl text-haven-navy leading-none mb-1">{activeLegalDoc.title}</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Document officiel HAVEN</p>
                </div>
              </div>
              <button 
                onClick={closeLegalModal}
                className="w-12 h-12 rounded-2xl hover:bg-gray-100 flex items-center justify-center text-haven-stone transition-all hover:rotate-90"
              >
                <XCircle size={28} />
              </button>
            </div>

            {/* Modal Content */}
            <div 
              ref={modalScrollRef}
              onScroll={(e) => handleScroll(e, activeLegalDoc.id)}
              className="flex-grow overflow-y-auto p-8 md:p-16 bg-white scroll-smooth"
            >
              <div className="max-w-3xl mx-auto">
                <div className="prose prose-slate max-w-none 
                  prose-headings:font-heading prose-headings:text-haven-navy prose-headings:font-bold
                  prose-h1:text-4xl prose-h1:mb-8
                  prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6
                  prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4
                  prose-p:text-haven-stone prose-p:text-lg prose-p:leading-relaxed prose-p:mb-6
                  prose-li:text-haven-stone prose-li:text-lg prose-li:mb-2
                  prose-strong:text-haven-navy prose-strong:font-bold
                  prose-ul:my-6
                  prose-ol:my-6
                ">
                  {/* Robust rendering: if it looks like HTML, use dangerouslySetInnerHTML */}
                  {/<\/?[a-z][\s\S]*>/i.test(activeLegalDoc.content) ? (
                    <div 
                      className="legal-content-html"
                      dangerouslySetInnerHTML={{ 
                        __html: activeLegalDoc.content
                          .replace(/&nbsp;/g, ' ')
                          .replace(/<p><\/p>/g, '') // Remove empty paragraphs
                      }} 
                    />
                  ) : (
                    <ReactMarkdown>{activeLegalDoc.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-8 border-t border-gray-100 bg-gray-50/50 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col gap-1">
                {!legalReadStatus[activeLegalDoc.id].scrolled ? (
                  <div className="flex items-center gap-3 text-haven-red font-bold text-sm animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-haven-red/10 flex items-center justify-center">
                      <ArrowRight size={16} className="rotate-90" />
                    </div>
                    Veuillez faire défiler jusqu'en bas pour activer la validation
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-green-600 font-bold text-sm">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle size={16} />
                    </div>
                    Lecture terminée, vous pouvez maintenant accepter
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 w-full md:w-auto">
                <Button variant="ghost" onClick={closeLegalModal} className="px-8 py-4 font-bold">
                  Fermer
                </Button>
                <Button 
                  disabled={!legalReadStatus[activeLegalDoc.id].scrolled}
                  onClick={() => validateLegalDoc(activeLegalDoc.id)}
                  className="px-12 py-4 font-bold min-w-[240px] shadow-xl shadow-haven-red/20"
                >
                  J'accepte et je valide
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-8 py-6 z-40">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <button onClick={handleBack} className={`flex items-center gap-2 font-bold text-haven-stone hover:text-haven-navy transition-colors ${currentStep === 'TYPE' ? 'invisible' : ''}`}><ArrowLeft size={20} /> Retour</button>
          {currentStep === 'LEGAL' ? (
            <Button variant="secondary" size="lg" onClick={handleSubmit} disabled={isSubmitting || !isStepValid()} className="px-12 py-4 text-lg shadow-xl shadow-haven-red/20">
              {isSubmitting ? (<><Loader2 className="animate-spin mr-2" size={20} /> Publication...</>) : ("Finaliser et Publier")}
            </Button>
          ) : (
            <Button size="lg" onClick={handleNext} disabled={!isStepValid()} className="px-12 py-4 text-lg gap-2">
              Suivant <ArrowRight size={20} />
            </Button>
          )}
        </div>
      </div>
      <AccountStatusOverlay 
        isOpen={isVerificationModalOpen} 
        onClose={() => setIsVerificationModalOpen(false)} 
      />
    </div>
  );
};
