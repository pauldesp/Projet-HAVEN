
import { MOCK_USERS_DB, MOCK_LISTINGS } from './mockData';
import { translations } from './translations';

// --- MINI TEST FRAMEWORK ---
export interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
}

export interface TestSuite {
  name: string;
  results: TestResult[];
}

class Expect {
  constructor(private actual: any) {}

  toBe(expected: any) {
    if (this.actual !== expected) {
      throw new Error(`Attendu: ${expected}, Reçu: ${this.actual}`);
    }
  }

  toBeTruthy() {
    if (!this.actual) {
      throw new Error(`Attendu: truthy, Reçu: ${this.actual}`);
    }
  }

  toBeGreaterThan(limit: number) {
    if (this.actual <= limit) {
      throw new Error(`Attendu: > ${limit}, Reçu: ${this.actual}`);
    }
  }

  toContain(item: any) {
    if (!Array.isArray(this.actual) || !this.actual.includes(item)) {
      throw new Error(`L'array ne contient pas l'élément attendu`);
    }
  }
}

const expect = (actual: any) => new Expect(actual);

// --- TEST SUITES ---

export const runAuthTests = (): TestSuite => {
  const results: TestResult[] = [];
  
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, status: 'PASS' });
    } catch (e: any) {
      results.push({ name, status: 'FAIL', error: e.message });
    }
  };

  test('Vérification des identifiants mockés par défaut', () => {
    const thomas = MOCK_USERS_DB.find(u => u.email === 'thomas@example.com');
    expect(thomas).toBeTruthy();
    expect(thomas?.password).toBe('password123');
  });

  test('L\'admin doit avoir le rôle ADMIN', () => {
    const admin = MOCK_USERS_DB.find(u => u.email === 'admin@haven.com');
    expect(admin?.role).toBe('ADMIN');
  });

  return { name: 'Logic d\'Authentification', results };
};

export const runListingTests = (): TestSuite => {
  const results: TestResult[] = [];
  
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, status: 'PASS' });
    } catch (e: any) {
      results.push({ name, status: 'FAIL', error: e.message });
    }
  };

  test('La base de données mockée contient des logements', () => {
    expect(MOCK_LISTINGS.length).toBeGreaterThan(0);
  });

  test('Chaque logement doit avoir au moins une chambre', () => {
    MOCK_LISTINGS.forEach(listing => {
      expect(listing.rooms.length).toBeGreaterThan(0);
    });
  });

  test('Tous les logements initiaux sont en statut APPROVED', () => {
    MOCK_LISTINGS.forEach(listing => {
      expect(listing.status).toBe('APPROVED');
    });
  });

  return { name: 'Moteur de Logements', results };
};

export const runTranslationTests = (): TestSuite => {
  const results: TestResult[] = [];
  
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, status: 'PASS' });
    } catch (e: any) {
      results.push({ name, status: 'FAIL', error: e.message });
    }
  };

  test('Le dictionnaire FR doit contenir la clé hero.title', () => {
    expect(translations.fr).toBeTruthy();
    expect(typeof translations.fr['hero.title']).toBe('string');
  });

  test('Le dictionnaire EN doit avoir le même nombre de clés que le FR', () => {
    const frKeys = Object.keys(translations.fr).length;
    const enKeys = Object.keys(translations.en).length;
    expect(frKeys).toBe(enKeys);
  });

  return { name: 'Système International (i18n)', results };
};
