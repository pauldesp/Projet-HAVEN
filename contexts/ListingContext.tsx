
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Listing, ListingStatus } from '../types';
import { apiService } from '../services/api';
import { userFacingErrorMessage } from '../services/errorHandling';

interface ListingContextType {
  listings: Listing[];
  isLoading: boolean;
  error: string | null;
  addListing: (listing: Listing) => Promise<void>;
  updateListing: (listing: Listing) => Promise<void>;
  updateListingStatus: (id: string, status: ListingStatus, rejectionReason?: string) => Promise<void>;
  getListingById: (id: string) => Listing | undefined;
  /** Blocks dates for the listing ('LISTING') or one room, and updates the local copy. */
  saveBlockedDates: (listingId: string, target: string, dates: string[]) => Promise<void>;
  refreshListings: () => Promise<void>;
}

const ListingContext = createContext<ListingContextType | undefined>(undefined);

export const ListingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.listings.getAll();
      setListings(data);
    } catch (e) {
      setError(userFacingErrorMessage(e));
      console.error("Erreur fetch listings", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const addListing = async (newListing: Listing) => {
    setError(null);
    try {
      const createdListing = await apiService.listings.create(newListing);
      setListings(prev => [createdListing, ...prev]);
    } catch (e: unknown) {
      setError(userFacingErrorMessage(e));
      throw e;
    }
  };

  const updateListing = async (updatedListing: Listing) => {
    setError(null);
    try {
      const savedListing = await apiService.listings.update(updatedListing);
      setListings(prev => prev.map(l => l.id === savedListing.id ? savedListing : l));
    } catch (e: unknown) {
      setError(userFacingErrorMessage(e));
      throw e;
    }
  };

  const updateListingStatus = async (id: string, status: ListingStatus, rejectionReason?: string) => {
    try {
      await apiService.listings.updateStatus(id, status, rejectionReason);
      setListings(prev => prev.map(l => l.id === id ? { ...l, status, rejectionReason: status === 'APPROVED' ? undefined : rejectionReason } : l));
    } catch (e: any) {
      setError(userFacingErrorMessage(e));
      throw e;
    }
  };

  const getListingById = (id: string) => {
    return listings.find(l => l.id === id);
  };

  const saveBlockedDates = async (listingId: string, target: string, dates: string[]) => {
    const saved = await apiService.listings.saveBlockedDates(listingId, target, dates);
    setListings(prev => prev.map(listing => listing.id !== listingId ? listing : saved.target === 'LISTING'
      ? { ...listing, blockedDates: saved.dates }
      : { ...listing, rooms: listing.rooms.map(room => room.id === saved.target ? { ...room, blockedDates: saved.dates } : room) }));
  };

  return (
    <ListingContext.Provider value={{ 
      listings, 
      isLoading, 
      error, 
      addListing, 
      updateListing,
      updateListingStatus, 
      getListingById,
      saveBlockedDates,
      refreshListings: fetchListings
    }}>
      {children}
    </ListingContext.Provider>
  );
};

export const useListings = () => {
  const context = useContext(ListingContext);
  if (!context) throw new Error('useListings must be used within a ListingProvider');
  return context;
};
