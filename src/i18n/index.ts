import { useState } from 'react';
import { translations, Language } from './translations';

export function useI18n() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('vapor_lang') as Language) || 'ru';
  });

  const setLanguage = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('vapor_lang', newLang);
  };

  const t = (key: string, defaultVal?: string): string => {
    const keys = key.split('.');

    // Check in current language
    let val: any = translations[lang];
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        val = undefined;
        break;
      }
    }
    if (typeof val === 'string') return val;

    // Check in English fallback
    let enVal: any = translations['en'];
    for (const k of keys) {
      if (enVal && typeof enVal === 'object' && k in enVal) {
        enVal = enVal[k];
      } else {
        enVal = undefined;
        break;
      }
    }
    if (typeof enVal === 'string') return enVal;

    // Direct key lookup
    const directRu = (translations[lang] as any)?.[key];
    if (typeof directRu === 'string') return directRu;

    const directEn = (translations['en'] as any)?.[key];
    if (typeof directEn === 'string') return directEn;

    return defaultVal || key;
  };

  return { lang, setLanguage, t };
}
