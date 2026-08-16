
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, User as UserIcon, ArrowLeft, Loader2, Home, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Message, Booking, User, Listing } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

import ReactMarkdown from 'react-markdown';

export const ChatPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!bookingId || !currentUser) return;

    const fetchData = async () => {
      try {
        const bookingData = await apiService.bookings.getById(bookingId);
        if (!bookingData) {
          navigate('/dashboard');
          return;
        }

        // Check if user is part of this booking
        const listingData = await apiService.listings.getById(bookingData.listingId);
        if (!listingData) return;

        const isTenant = bookingData.tenantId === currentUser.id;
        const isOwner = listingData.ownerId === currentUser.id;

        if (!isTenant && !isOwner) {
          navigate('/dashboard');
          return;
        }

        setBooking(bookingData);
        setListing(listingData);

        const otherUserId = isTenant ? listingData.ownerId : bookingData.tenantId;
        const otherUserData = await apiService.users.getById(otherUserId);
        if (otherUserData) setOtherUser(otherUserData);

        // Real-time messages - fetch all conversations of this user and filter by bookingId locally
        // to minimize index requirements in dev environments
        const q = query(
          collection(db, 'messages'),
          where('participants', 'array-contains', currentUser.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const allMsgs = snapshot.docs.map(doc => doc.data() as Message);
          // Filter by bookingId locally
          const bookingMsgs = allMsgs.filter(m => m.bookingId === bookingId);
          // Sort manually in client to avoid requiring composite indexes in dev environment
          const sortedMsgs = bookingMsgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setMessages(sortedMsgs);
          setIsLoading(false);

          // Mark as read - only messages where I am the receiver
          apiService.messages.markAsRead(bookingId, currentUser.id);
        }, (error) => {
          console.error('Error listening to messages:', error);
          setIsLoading(false);
          toast.error("Impossible de charger les messages en temps réel.");
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching chat data:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [bookingId, currentUser, navigate]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !booking || !otherUser || isSending) return;

    setIsSending(true);
    try {
      const message: Message = {
        id: crypto.randomUUID(),
        senderId: currentUser.id,
        receiverId: otherUser.id,
        bookingId: booking.id,
        content: newMessage.trim(),
        timestamp: new Date().toISOString(),
        isRead: false,
        participants: [currentUser.id, otherUser.id]
      };

      await apiService.messages.create(message);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-haven-navy animate-spin" />
      </div>
    );
  }

  if (!booking || !otherUser || !listing) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 h-[calc(100vh-160px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-3xl shadow-sm border border-haven-navy/5">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-haven-navy" />
        </button>
        
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border-2 border-haven-red/20">
          {otherUser.avatarUrl ? (
            <img src={otherUser.avatarUrl} alt={otherUser.firstName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>

        <div className="flex-grow">
          <h2 className="font-bold text-haven-navy">{otherUser.firstName} {otherUser.lastName}</h2>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Home className="w-3 h-3" />
              {listing.title}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto mb-6 space-y-4 pr-2 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-haven-cream rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-haven-navy/30" />
            </div>
            <p className="text-gray-500">Aucun message pour le moment.<br />Commencez la conversation !</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${
                  isMe 
                    ? 'bg-haven-navy text-white rounded-tr-none' 
                    : 'bg-white text-haven-navy border border-haven-navy/5 rounded-tl-none'
                }`}>
                  <div className={`text-sm leading-relaxed prose prose-sm ${isMe ? 'prose-invert' : ''} max-w-none`}>
                    <ReactMarkdown>{msg.content.replace(/\n/g, '  \n')}</ReactMarkdown>
                  </div>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="bg-white p-4 rounded-3xl shadow-lg border border-haven-navy/5 flex gap-3">
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Votre message..."
          className="flex-grow px-6 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-haven-red/20 focus:border-haven-red transition-all"
        />
        <button 
          type="submit"
          disabled={!newMessage.trim() || isSending}
          className="w-12 h-12 bg-haven-red text-white rounded-2xl flex items-center justify-center hover:bg-haven-red/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-haven-red/20"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
};

const MessageSquare = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
