
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { LegalDocument } from '../types';
import { Loader2, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '../components/Button';
import 'react-quill-new/dist/quill.snow.css';

export const LegalPage: React.FC = () => {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      if (!docId) return;
      setIsLoading(true);
      try {
        const data = await apiService.settings.getLegalDocument(docId);
        if (data) {
          setDocument(data as LegalDocument);
        }
      } catch (error) {
        console.error("Error fetching legal document:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoc();
  }, [docId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-haven-cream flex items-center justify-center">
        <Loader2 className="animate-spin text-haven-navy" size={48} />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-haven-cream flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-heading font-bold text-haven-navy mb-4">Document non trouvé</h1>
        <p className="text-haven-stone mb-8">Désolé, ce document n'existe pas encore ou a été déplacé.</p>
        <Button onClick={() => navigate('/')}>Retour à l'accueil</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-haven-cream pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-haven-stone hover:text-haven-navy font-bold mb-8 transition-colors"
        >
          <ArrowLeft size={20} /> Retour
        </button>

        <div className="bg-white rounded-[2.5rem] shadow-premium p-8 md:p-16 border border-gray-100 animate-fade-in-up">
          <div className="mb-12 border-b border-gray-100 pb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-haven-navy mb-4">{document.title}</h1>
            <div className="flex items-center gap-2 text-haven-stone text-sm font-medium">
              <Clock size={16} />
              Dernière mise à jour le {new Date(document.lastUpdated).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="prose prose-slate max-w-none 
            prose-headings:font-heading prose-headings:text-haven-navy prose-headings:font-bold
            prose-p:text-haven-stone prose-p:leading-relaxed prose-p:mb-4 prose-p:mt-0
            prose-li:text-haven-stone prose-li:marker:text-haven-navy prose-li:my-1
            prose-strong:text-haven-navy prose-strong:font-bold
            prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-6 prose-ul:mt-2
            prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-6 prose-ol:mt-2
            prose-a:text-haven-red prose-a:font-bold prose-a:no-underline hover:prose-a:underline
            break-words overflow-hidden"
            dangerouslySetInnerHTML={{ __html: document.content }} 
          />
        </div>
      </div>
    </div>
  );
};
