import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { translations, Language } from '../services/translations';
import { translateUiText } from '../services/uiTranslations';

interface LanguageContextType {
  language: Language;
  locale: string;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['fr']) => string;
  tr: (text: string) => string;
}
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    try { const saved = localStorage.getItem('haven-language'); return saved === 'en' || saved === 'es' ? saved : 'fr'; } catch { return 'fr'; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('haven-language', language); } catch { /* Language switching also works without storage. */ }
  }, [language]);
  return <LanguageContext.Provider value={{
    language, setLanguage,
    locale: language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'fr-FR',
    t: key => translations[language][key] || translations.fr[key] || key,
    tr: text => translateUiText(text, language)
  }}>{children}</LanguageContext.Provider>;
};
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};
