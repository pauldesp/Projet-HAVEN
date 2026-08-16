
import React, { useState, useEffect } from 'react';
import { runAuthTests, runListingTests, runTranslationTests, TestSuite } from '../services/unitTests';
import { CheckCircle, XCircle, Beaker, RefreshCcw, ShieldCheck, Database, Languages, Database as DbIcon, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { seedListings } from '../services/seedData';
import { useAuth } from '../contexts/AuthContext';
import { useListings } from '../contexts/ListingContext';

export const TestDashboard: React.FC = () => {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const { currentUser } = useAuth();
  const { refreshListings } = useListings();

  const runAllTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results = [
        runAuthTests(),
        runListingTests(),
        runTranslationTests()
      ];
      setSuites(results);
      setIsRunning(false);
    }, 1000);
  };

  const handleSeedData = async () => {
    if (!currentUser) {
      alert("Veuillez vous connecter pour générer des données de test.");
      return;
    }
    
    setIsSeeding(true);
    try {
      await seedListings(currentUser.id);
      await refreshListings();
      alert("20 annonces de test ont été générées avec succès !");
    } catch (error) {
      console.error("Erreur lors du seeding:", error);
      alert("Une erreur est survenue lors de la génération des données.");
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    runAllTests();
  }, []);

  const totalTests = suites.reduce((acc, s) => acc + s.results.length, 0);
  const passedTests = suites.reduce((acc, s) => acc + s.results.filter(r => r.status === 'PASS').length, 0);
  const failedTests = totalTests - passedTests;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-12 border-b border-white/10 pb-8">
          <div>
            <div className="flex items-center gap-3 text-haven-red mb-2">
              <Beaker size={32} />
              <h1 className="text-3xl font-bold tracking-tighter">HAVEN UNIT TESTS</h1>
            </div>
            <p className="text-gray-500">Suite de tests automatisée pour le moteur de colocation.</p>
          </div>
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              className="border-white/10 text-white hover:bg-white/5"
              onClick={handleSeedData}
              disabled={isSeeding}
            >
              {isSeeding ? <Loader2 size={18} className="mr-2 animate-spin" /> : <DbIcon size={18} className="mr-2" />}
              Seed Data (20 Listings)
            </Button>
            <Button 
              variant="outline" 
              className="border-white/10 text-white hover:bg-white/5"
              onClick={runAllTests}
              disabled={isRunning}
            >
              <RefreshCcw size={18} className={`mr-2 ${isRunning ? 'animate-spin' : ''}`} />
              Relancer les tests
            </Button>
          </div>
        </div>

        {/* Resume Card */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="bg-[#111] p-6 rounded-2xl border border-white/5">
            <div className="text-gray-500 text-xs uppercase mb-2">Total Tests</div>
            <div className="text-4xl font-bold">{totalTests}</div>
          </div>
          <div className="bg-[#111] p-6 rounded-2xl border border-white/5">
            <div className="text-green-500 text-xs uppercase mb-2">Passed</div>
            <div className="text-4xl font-bold text-green-500">{passedTests}</div>
          </div>
          <div className="bg-[#111] p-6 rounded-2xl border border-white/5">
            <div className="text-red-500 text-xs uppercase mb-2">Failed</div>
            <div className="text-4xl font-bold text-red-500">{failedTests}</div>
          </div>
        </div>

        {/* Test Suites */}
        <div className="space-y-8">
          {suites.map((suite, idx) => (
            <div key={idx} className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex items-center gap-3">
                {suite.name.includes('Auth') && <ShieldCheck size={20} className="text-blue-400"/>}
                {suite.name.includes('Moteur') && <Database size={20} className="text-purple-400"/>}
                {suite.name.includes('Système') && <Languages size={20} className="text-pink-400"/>}
                <h2 className="font-bold text-lg">{suite.name}</h2>
              </div>
              <div className="divide-y divide-white/5">
                {suite.results.map((result, rIdx) => (
                  <div key={rIdx} className="px-6 py-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                    {result.status === 'PASS' ? (
                      <CheckCircle size={18} className="text-green-500 mt-1 flex-shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-500 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${result.status === 'PASS' ? 'text-gray-300' : 'text-red-400'}`}>
                        {result.name}
                      </div>
                      {result.error && (
                        <div className="text-xs text-red-500/70 mt-1 bg-red-500/10 p-2 rounded border border-red-500/20 italic">
                          Error: {result.error}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-600 font-bold uppercase mt-1">
                      {result.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-gray-700 text-[10px] uppercase tracking-widest pb-12">
          End of Test Suite — Haven Engineering Dept.
        </div>
      </div>
    </div>
  );
};
