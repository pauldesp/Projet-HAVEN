
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, LegalDocument } from '../types';

import { apiService } from '../services/api';

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [legalDocs, setLegalDocs] = useState<LegalDocument[]>([]);

  useEffect(() => {
    console.log("Footer: listening to legal docs...");
    const unsubscribe = apiService.settings.listenToAllLegalDocuments((docs) => {
      console.log("Footer: received legal docs:", docs);
      setLegalDocs(docs as LegalDocument[]);
    });
    return () => unsubscribe();
  }, []);

  const handlePublishClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else if (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.ADMIN) {
      // If logged in but not an owner, we redirect to login to "re-authenticate" or switch
      // In a real app we might have a "Become a host" flow, but the user asked for "connexion en mode hote"
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else {
      navigate('/owner/publish');
    }
  };

  return (
    <footer className="bg-white py-12 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
               <Logo className="h-10 w-auto" />
            </div>
            <p className="text-gray-500 text-sm">
              {t('footer.desc')}
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-haven-navy mb-4">{t('footer.platform')}</h4>
            <ul className="space-y-2.5 text-sm text-gray-500">
              <li>
                <button 
                  onClick={handlePublishClick}
                  className="hover:text-haven-navy transition-colors text-left cursor-pointer"
                >
                  {t('footer.publish')}
                </button>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-haven-navy transition-colors">
                  {t('footer.how_it_works')}
                </Link>
              </li>
              <li>
                <Link to="/partners" className="hover:text-haven-navy transition-colors">
                  {t('footer.partners')}
                </Link>
              </li>
              <li>
                <Link to="/become-owner" className="hover:text-haven-navy transition-colors">
                  {t('footer.become_owner')}
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-haven-navy transition-colors">
                  {t('footer.faq')}
                </Link>
              </li>
              <li>
                <Link to="/trust-and-safety" className="hover:text-haven-navy transition-colors">
                  {t('footer.trust')}
                </Link>
              </li>
              <li>
                <Link to="/admin/login" className="hover:text-haven-navy transition-colors">
                  {t('footer.admin')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-haven-navy mb-4">{t('footer.support')}</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <Link to="/help" className="hover:text-haven-navy transition-colors">
                  {t('footer.help')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-haven-navy transition-colors">
                  {t('footer.contact')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-haven-navy mb-4">{t('footer.legal')}</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              {legalDocs.map((doc) => (
                <li key={doc.id}>
                  <Link to={`/legal/${doc.id}`} className="hover:text-haven-navy transition-colors">
                    {doc.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/cookies" className="hover:text-haven-navy transition-colors">
                  Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-gray-100 text-center text-sm text-gray-400">
          © 2024 HAVEN. {t('footer.rights')}
        </div>
      </div>
    </footer>
  );
};
