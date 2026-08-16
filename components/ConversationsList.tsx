
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MessageSquare, 
  User as UserIcon, 
  ChevronRight, 
  Loader2,
  Clock,
  Home,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Message, User, Booking, Listing } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface Conversation {
  bookingId: string;
  latestMessage: Message;
  otherUserId: string;
  unreadCount: number;
  otherUser?: User;
  booking?: Booking;
  listing?: Listing;
}

export const ConversationsList: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = apiService.messages.listenToConversations(currentUser.id, async (convs) => {
      try {
        const enrichedConvs = await Promise.all(convs.map(async (c) => {
          const [otherUser, booking] = await Promise.all([
            apiService.users.getById(c.otherUserId),
            apiService.bookings.getById(c.bookingId)
          ]);
          
          let listing;
          if (booking) {
            listing = await apiService.listings.getById(booking.listingId);
          }

          return {
            ...c,
            otherUser,
            booking,
            listing
          };
        }));
        
        setConversations(enrichedConvs);
        setIsLoading(false);
      } catch (error) {
        console.error("Error enriching conversations:", error);
        setConversations(convs);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const filteredConversations = conversations.filter(conv => {
    const matchesFilter = activeFilter === 'ALL' || (activeFilter === 'UNREAD' && conv.unreadCount > 0);
    const matchesSearch = !searchTerm || 
      conv.otherUser?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.otherUser?.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.listing?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.latestMessage.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-haven-navy animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-grow max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-haven-navy/5 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveFilter('ALL')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${activeFilter === 'ALL' ? 'bg-haven-navy text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            Tous
          </button>
          <button 
            onClick={() => setActiveFilter('UNREAD')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${activeFilter === 'UNREAD' ? 'bg-haven-red text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            Non lus
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredConversations.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border-2 border-dashed border-gray-100 rounded-[2rem]"
            >
              <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">Aucune conversation trouvée.</p>
            </motion.div>
          ) : (
            filteredConversations.map((conv) => (
              <motion.div
                key={conv.bookingId}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                layout
                onClick={() => navigate(`/messages/${conv.bookingId}`)}
                className="group flex items-center gap-4 p-4 rounded-3xl bg-white border border-gray-100 hover:border-haven-navy/20 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
              >
                {conv.unreadCount > 0 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-haven-red" />}
                
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-sm">
                    {conv.otherUser?.avatarUrl ? (
                      <img src={conv.otherUser.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><UserIcon className="text-gray-300" size={24} /></div>
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-haven-red text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>

                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm font-bold truncate ${conv.unreadCount > 0 ? 'text-haven-navy' : 'text-gray-700'}`}>
                      {conv.otherUser?.firstName} {conv.otherUser?.lastName}
                    </h4>
                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap ml-2">
                      {new Date(conv.latestMessage.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-haven-navy font-bold' : 'text-gray-500'}`}>
                    {conv.latestMessage.senderId === currentUser?.id && <span className="text-gray-400">Vous: </span>}
                    {conv.latestMessage.content}
                  </p>
                  {conv.listing && (
                    <div className="flex items-center gap-1.5 mt-2 opacity-60">
                      <Home size={10} className="text-haven-navy" />
                      <span className="text-[9px] font-black uppercase tracking-wider text-haven-navy truncate">
                        {conv.listing.title}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={18} className="text-haven-navy" />
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
