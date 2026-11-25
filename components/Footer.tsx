import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, LegalDocument } from '../types';
import { apiService } from '../services/api';

type FooterLink = { label: string; to?: string; href?: string; onClick?: (event: React.MouseEvent) => void };

const linkClass = 'inline-flex min-h-9 items-center py-1 text-[15px] leading-snug text-white/65 transition-colors hover:text-white focus-visible:text-white';

function FooterGroup({ title, links }: { title: string; links: FooterLink[] }) {
  return <nav aria-label={title}>
    <h2 className="font-body text-sm font-semibold tracking-normal text-white">{title}</h2>
    <ul className="mt-3 space-y-0.5">
      {links.map(link => <li key={link.label}>
        {link.onClick ? <button type="button" onClick={link.onClick} className={`${linkClass} text-left`}>{link.label}</button>
          : link.href ? <a href={link.href} className={linkClass}>{link.label}</a>
          : <Link to={link.to!} className={linkClass}>{link.label}</Link>}
      </li>)}
    </ul>
  </nav>;
}

/** Site footer: brand and two actions, links grouped by audience, legal links on one discreet line. */
export const Footer: React.FC = () => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [legalDocs, setLegalDocs] = useState<LegalDocument[]>([]);

  useEffect(() => apiService.settings.listenToAllLegalDocuments(docs => setLegalDocs(docs as LegalDocument[])), []);

  const handlePublishClick = (event: React.MouseEvent) => {
    event.preventDefault();
    // Publishing needs an owner account: others sign in (or switch) as an owner first.
    if (!currentUser || (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.ADMIN)) navigate('/login?redirect=/owner/publish&role=OWNER');
    else navigate('/owner/publish');
  };

  // The owners' house standards belong with the owners; the other legal documents go on the bottom line.
  const isOwnerStandards = (doc: LegalDocument) => /cahier/i.test(`${doc.id} ${doc.title}`);
  const ownerStandards = legalDocs.find(isOwnerStandards);
  const shortLegalTitle = (doc: LegalDocument) => {
    const title = doc.title.toLocaleLowerCase('fr');
    if (title.includes('réservation')) return 'Conditions de réservation';
    if (title.includes('propriétaire')) return 'Conditions propriétaires';
    if (title.includes('confidentialité')) return 'Confidentialité';
    if (title.includes('mentions')) return 'Mentions légales';
    if (title.includes('conditions générales')) return 'Conditions générales';
    return doc.title;
  };
  const legalLinks = legalDocs.filter(doc => !isOwnerStandards(doc));

  return (
    <footer className="haven-footer bg-haven-navy text-white">
      <div className="mx-auto max-w-7xl px-5 pb-8 pt-12 sm:px-6 md:pt-16 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-8">
          <div>
            <Logo white className="h-9" />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:contents">
            <FooterGroup title="Locataires" links={[
              { label: t('footer.how_it_works'), to: '/how-it-works' },
              { label: 'Réservation récurrente', to: '/reservation-recurrente' },
              { label: t('footer.trust'), to: '/trust-and-safety' },
              { label: t('footer.help'), to: '/help' },
            ]} />
            <FooterGroup title="Propriétaires" links={[
              { label: t('footer.become_owner'), to: '/become-owner' },
              { label: t('footer.publish'), onClick: handlePublishClick },
              ...(ownerStandards ? [{ label: 'Cahier des charges', to: `/legal/${ownerStandards.id}` }] : []),
            ]} />
            <FooterGroup title="Haven" links={[
              // Real pages rendered by the server (crawlable), not routes of the application.
              { label: 'Articles et conseils', href: '/articles' },
              { label: t('footer.partners'), to: '/partners' },
              { label: t('footer.contact'), to: '/contact' },
            ]} />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-white/50 md:flex-row md:items-center md:justify-between">
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5 gap-y-2">
            {legalLinks.map(doc => <Link key={doc.id} to={`/legal/${doc.id}`} className="hover:text-white">{shortLegalTitle(doc)}</Link>)}
            <Link to="/cookies" className="hover:text-white">Cookies</Link>
          </nav>
          <div className="flex items-center justify-between gap-6 md:justify-end">
            <span>© {new Date().getFullYear()} Haven</span>
            <Link to="/admin/login" className="inline-flex items-center gap-1 text-white/40 hover:text-white">{t('footer.admin')}<ArrowRight size={13} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
