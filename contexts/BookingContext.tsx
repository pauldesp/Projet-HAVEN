import React, { createContext, useContext, useState, useEffect } from 'react';
import { Booking, User } from '../types';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

interface BookingWithTenant extends Booking {
  tenant?: User;
}

interface BookingContextType {
  bookings: BookingWithTenant[];
  loading: boolean;
  createBooking: (booking: Booking) => Promise<Booking>;
  getBookingsByListing: (listingId: string) => BookingWithTenant[];
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookings, setBookings] = useState<BookingWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const bookingsById = new Map<string, Booking>();
    const queries = currentUser.role === 'ADMIN'
      ? [query(collection(db, 'bookings'))]
      : [
          query(collection(db, 'bookings'), where('tenantId', '==', currentUser.id)),
          query(collection(db, 'bookings'), where('ownerId', '==', currentUser.id)),
        ];

    const hydrateBookings = async () => {
      const bookingsData = Array.from(bookingsById.values());
      
      // Fetch tenant info for each booking (for the calendar)
      // Note: In a production app, we'd optimize this with a cache or by denormalizing
      const bookingsWithTenants = await Promise.all(bookingsData.map(async (b) => {
        try {
          const tenant = await apiService.users.getById(b.tenantId);
          return { ...b, tenant };
        } catch (e) {
          console.warn(`Impossible de charger les infos du locataire ${b.tenantId}`, e);
          return { ...b };
        }
      }));
      
      setBookings(bookingsWithTenants);
      setLoading(false);
    };

    const unsubscribes = queries.map(q => onSnapshot(q, async (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') bookingsById.delete(change.doc.id);
        else bookingsById.set(change.doc.id, change.doc.data() as Booking);
      });
      await hydrateBookings();
    }, (error) => {
      const errInfo = {
        error: error.message,
        operationType: 'list',
        path: 'bookings',
        authInfo: {
          userId: currentUser?.id,
          email: currentUser?.email,
          role: currentUser?.role
        }
      };
      console.error("Error listening to bookings:", JSON.stringify(errInfo));
      setLoading(false);
    }));

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [currentUser]);

  const createBooking = async (booking: Booking) => {
    return await apiService.bookings.create(booking);
  };

  const getBookingsByListing = (listingId: string) => {
    return bookings.filter(b => b.listingId === listingId);
  };

  return (
    <BookingContext.Provider value={{ bookings, loading, createBooking, getBookingsByListing }}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBookings = () => {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBookings must be used within a BookingProvider');
  }
  return context;
};
