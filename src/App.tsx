import { useState, useMemo } from 'react';
import { TSAChart } from '@/components/TSAChart';
import { exampleDataSets } from '@/data';
import { calculateTSA } from '@/lib/statistics';

function App() {
  const [selectedDatasetIndex, setSelectedDatasetIndex] = useState(0);
  const dataset = exampleDataSets[selectedDatasetIndex];
  
  const results = useMemo(() => {
    return calculateTSA(dataset.studies, dataset.params);
  }, [dataset]);

  return (
    <div className="min-h-screen bg-[#080d19] text-slate-300 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-100">Trial Sequential Analysis</h1>
          <p className="text-slate-400">Interactive visualization of cumulative meta-analysis monitoring boundaries</p>
        </header>

        <div className="flex gap-4 items-center bg-[#0c1425] p-4 rounded-lg border border-slate-800">
          <label className="text-sm font-medium text-slate-400">Select Dataset:</label>
          <select 
            aria-label="Select Dataset"
            value={selectedDatasetIndex}
            onChange={(e) => setSelectedDatasetIndex(Number(e.target.value))}
            className="bg-[#1e2d44] border border-slate-700 text-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#06b6d4]"
          >
            {exampleDataSets.map((ds, i) => (
              <option key={i} value={i}>{ds.name}</option>
            ))}
          </select>
          <div className="ml-auto text-sm text-slate-500">
            {dataset.studies.length} studies included
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0c1425] rounded-xl border border-slate-800 p-6 shadow-lg">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-medium text-slate-200">Sequential Analysis Chart</h2>
                {results && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    results.interpretation.type.includes('conclusive') ? 'bg-emerald-500/10 text-emerald-400' :
                    results.interpretation.type === 'futility' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-slate-700/50 text-slate-400'
                  }`}>
                    {results.interpretation.title}
                  </span>
                )}
              </div>
              
              {results ? (
                <TSAChart results={results} params={dataset.params} />
              ) : (
                <div className="h-[500px] flex items-center justify-center text-slate-500">
                  Insufficient data for analysis
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#0c1425] rounded-xl border border-slate-800 p-6 shadow-lg">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Analysis Parameters</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Type I Error (α)</span>
                  <span className="text-slate-200">{dataset.params.alpha}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type II Error (β)</span>
                  <span className="text-slate-200">{dataset.params.beta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Control Event Rate</span>
                  <span className="text-slate-200">{(dataset.params.controlRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">RRR / Effect Size</span>
                  <span className="text-slate-200">{dataset.params.effectSize}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Heterogeneity Correction</span>
                  <span className="text-slate-200">{dataset.params.heterogeneityCorrection}x</span>
                </div>
              </div>
            </div>

            {results && (
              <div className="bg-[#0c1425] rounded-xl border border-slate-800 p-6 shadow-lg">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Results Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Required Info Size</span>
                    <span className="text-slate-200">{results.ris.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Accrued Patients</span>
                    <span className="text-slate-200">{results.totalPatients.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Information Fraction</span>
                    <span className="text-slate-200">{(results.informationFraction * 100).toFixed(1)}%</span>
                  </div>
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-500">Z-Score</span>
                      <span className="text-[#06b6d4] font-mono">{results.finalZ.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pooled OR</span>
                      <span className="text-slate-200">{results.pooledOR.toFixed(2)} [{results.ci95Lower.toFixed(2)}, {results.ci95Upper.toFixed(2)}]</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Heterogeneity (I²)</span>
                      <span className="text-slate-200">{results.heterogeneity.i2.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
