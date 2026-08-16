import React, { createContext, useContext, useState, useEffect } from 'react';
import { Booking, UserRole } from '../types';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

interface BookingContextType {
  bookings: Booking[];
  loading: boolean;
  createBooking: (booking: Booking) => Promise<Booking>;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handleError = (error: Error) => {
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
    };

    if (currentUser.role === UserRole.ADMIN) {
      return onSnapshot(query(collection(db, 'bookings')), snapshot => {
        setBookings(snapshot.docs.map(item => item.data() as Booking));
        setLoading(false);
      }, handleError);
    }

    const results = new Map<string, Booking>();
    const publish = () => {
      setBookings(Array.from(results.values()));
      setLoading(false);
    };
    const subscribe = (field: 'tenantId' | 'ownerId') => onSnapshot(
      query(collection(db, 'bookings'), where(field, '==', currentUser.id)),
      snapshot => {
        snapshot.docChanges().forEach(change => {
          const booking = change.doc.data() as Booking;
          if (change.type === 'removed') results.delete(booking.id);
          else results.set(booking.id, booking);
        });
        publish();
      },
      handleError
    );
    const unsubscribeTenant = subscribe('tenantId');
    const unsubscribeOwner = subscribe('ownerId');

    return () => {
      unsubscribeTenant();
      unsubscribeOwner();
    };
  }, [currentUser?.id, currentUser?.role]);

  const createBooking = async (booking: Booking) => {
    return await apiService.bookings.create(booking);
  };

  return (
    <BookingContext.Provider value={{ bookings, loading, createBooking }}>
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
