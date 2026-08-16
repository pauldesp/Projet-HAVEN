
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MessageSquare, 
  User as UserIcon, 
  ChevronRight, 
  Filter,
  Loader2,
  Clock,
  Home,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Message, User, Booking, Listing } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Conversation {
  bookingId: string;
  latestMessage: Message;
  otherUserId: string;
  unreadCount: number;
  otherUser?: User;
  booking?: Booking;
  listing?: Listing;
}

export const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = apiService.messages.listenToConversations(currentUser.id, async (convs) => {
      try {
        // Enrich conversations with user and booking data
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
    const matchesTab = activeTab === 'ALL' || (activeTab === 'UNREAD' && conv.unreadCount > 0);
    const matchesSearch = !searchTerm || 
      conv.otherUser?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.otherUser?.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.listing?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.latestMessage.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesTab && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-haven-navy animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-heading font-black text-haven-navy">Messages</h1>
          <p className="text-gray-500 mt-2">Gérez vos conversations avec les propriétaires et locataires.</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              activeTab === 'ALL' 
                ? 'bg-haven-navy text-white shadow-lg shadow-haven-navy/20' 
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Tous ({conversations.length})
          </button>
          <button 
            onClick={() => setActiveTab('UNREAD')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              activeTab === 'UNREAD' 
                ? 'bg-haven-red text-white shadow-lg shadow-haven-red/20' 
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Non lus ({conversations.filter(c => c.unreadCount > 0).length})
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="relative mb-8">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text"
          placeholder="Rechercher par nom, logement ou message..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-6 py-4 bg-white border border-haven-navy/5 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-haven-navy/5 shadow-premium transition-all text-haven-navy placeholder:text-gray-300"
        />
      </div>

      {/* Conversations List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredConversations.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-[2rem] p-16 text-center shadow-premium border border-haven-navy/5"
            >
              <div className="w-20 h-20 bg-haven-cream rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-haven-navy/20" />
              </div>
              <h3 className="text-xl font-bold text-haven-navy mb-2">Aucun message trouvé</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                {searchTerm 
                  ? "Ajustez vos filtres ou votre recherche pour trouver ce que vous cherchez." 
                  : "Commencez à explorer des logements pour débuter une conversation !"}
              </p>
            </motion.div>
          ) : (
            filteredConversations.map((conv) => (
              <motion.div
                key={conv.bookingId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
                onClick={() => navigate(`/messages/${conv.bookingId}`)}
                className="group bg-white hover:bg-gray-50 p-6 rounded-[2rem] shadow-premium border border-haven-navy/5 cursor-pointer transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-6">
                  {/* User Avatar */}
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md">
                      {conv.otherUser?.avatarUrl ? (
                        <img 
                          src={conv.otherUser.avatarUrl} 
                          alt={conv.otherUser.firstName} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserIcon className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-6 h-6 bg-haven-red text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-bold text-lg ${conv.unreadCount > 0 ? 'text-haven-navy' : 'text-gray-700'}`}>
                        {conv.otherUser?.firstName} {conv.otherUser?.lastName}
                      </h3>
                      <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-widest">
                        <Clock size={12} />
                        {new Date(conv.latestMessage.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <p className={`text-sm line-clamp-1 mb-3 ${conv.unreadCount > 0 ? 'font-bold text-haven-navy' : 'text-gray-500'}`}>
                      {conv.latestMessage.senderId === currentUser?.id && <span className="text-gray-400">Vous: </span>}
                      {conv.latestMessage.content}
                    </p>

                    <div className="flex items-center gap-4">
                      {conv.listing && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-haven-cream rounded-full">
                          <Home size={12} className="text-haven-navy/50" />
                          <span className="text-[10px] font-bold text-haven-navy/70 truncate max-w-[150px]">
                            {conv.listing.title}
                          </span>
                        </div>
                      )}
                      {conv.booking?.status === 'CONFIRMED' && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full">
                          <ShieldCheck size={12} className="text-green-600" />
                          <span className="text-[10px] font-bold text-green-600 uppercase">Confirmé</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-haven-navy group-hover:text-white transition-colors">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
