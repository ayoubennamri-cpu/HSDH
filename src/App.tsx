import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Droplets, 
  Ruler, 
  Activity,
  ChevronRight,
  Info,
  Download,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tank, Pigment, PigmentResult } from './types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const INITIAL_TANKS: Tank[] = [
  { id: '1', name: 'BC01', capacityL: 300, densityGcm3: 1.2, circuitVolumeL: 86.45, conicalVolumeL: 50 },
  { id: '2', name: 'BC02', capacityL: 300, densityGcm3: 1.22, circuitVolumeL: 86.45, conicalVolumeL: 50 },
  { id: '3', name: 'BC2', capacityL: 300, densityGcm3: 0.975, circuitVolumeL: 115.98, conicalVolumeL: 50 },
  { id: '4', name: 'BC3', capacityL: 300, densityGcm3: 0.96, circuitVolumeL: 115.98, conicalVolumeL: 50 },
  { id: '5', name: 'BC4', capacityL: 300, densityGcm3: 0.96, circuitVolumeL: 115.98, conicalVolumeL: 50 },
  { id: '6', name: 'BC5', capacityL: 300, densityGcm3: 0.972, circuitVolumeL: 115.98, conicalVolumeL: 50 },
  { id: '7', name: 'FD4', capacityL: 100, densityGcm3: 0.97, circuitVolumeL: 118.31, conicalVolumeL: 20 },
  { id: '8', name: 'FD3', capacityL: 100, densityGcm3: 0.94, circuitVolumeL: 118.31, conicalVolumeL: 20 },
  { id: '9', name: 'FD2', capacityL: 100, densityGcm3: 0.94, circuitVolumeL: 118.31, conicalVolumeL: 20 },
  { id: '10', name: 'CC2', capacityL: 300, densityGcm3: 0.98, circuitVolumeL: 136.63, conicalVolumeL: 50 },
  { id: '11', name: 'CC3', capacityL: 300, densityGcm3: 0.98, circuitVolumeL: 136.63, conicalVolumeL: 50 },
];

export default function App() {
  const [tanks, setTanks] = useState<Tank[]>(() => {
    const saved = localStorage.getItem('paint-master-tanks');
    return saved ? JSON.parse(saved) : INITIAL_TANKS;
  });
  
  const [selectedTankId, setSelectedTankId] = useState<string>(tanks[0]?.id || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTank, setEditingTank] = useState<Tank | null>(null);

  // Calculation Inputs
  const [inputMode, setInputMode] = useState<'percentage' | 'liters' | 'dimensions'>('percentage');
  const [levelPercentage, setLevelPercentage] = useState<number>(50);
  const [levelLiters, setLevelLiters] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [diameter, setDiameter] = useState<number>(0);
  const [dilutionRate, setDilutionRate] = useState<number>(10);
  const [customDensity, setCustomDensity] = useState<number | null>(null);
  const [customCapacity, setCustomCapacity] = useState<number | null>(null);
  const [customCircuitVolume, setCustomCircuitVolume] = useState<number | null>(null);
  const [pigments, setPigments] = useState<Pigment[]>([]);
  const [newPigmentName, setNewPigmentName] = useState('');
  const [newPigmentPercentage, setNewPigmentPercentage] = useState<number>(0);

  // Conical Volume State
  const [conicalVolumeL, setConicalVolumeL] = useState<number>(0);

  // Reduction Calculator State
  const [reductionPigmentName, setReductionPigmentName] = useState('');
  const [reductionInitialPercentage, setReductionInitialPercentage] = useState<number>(0);
  const [reductionAddedMass, setReductionAddedMass] = useState<number>(0);
  const [reductionTargetPercentage, setReductionTargetPercentage] = useState<number>(0);
  const [reductionMode, setReductionMode] = useState<'result' | 'target'>('result');

  useEffect(() => {
    localStorage.setItem('paint-master-tanks', JSON.stringify(tanks));
  }, [tanks]);

  const selectedTank = useMemo(() => 
    tanks.find(t => t.id === selectedTankId) || tanks[0], 
  [tanks, selectedTankId]);

  // Reset custom density, capacity, circuit and conical volume when tank changes
  useEffect(() => {
    if (selectedTank) {
      setCustomDensity(selectedTank.densityGcm3);
      setCustomCapacity(selectedTank.capacityL);
      setCustomCircuitVolume(selectedTank.circuitVolumeL);
      setConicalVolumeL(selectedTank.conicalVolumeL || 0);
    }
  }, [selectedTankId]);

  // Derived Calculations
  const results = useMemo(() => {
    if (!selectedTank) return null;

    const effectiveDensity = customDensity ?? selectedTank.densityGcm3;
    const effectiveCapacity = customCapacity ?? selectedTank.capacityL;
    const effectiveCircuitVolume = customCircuitVolume ?? selectedTank.circuitVolumeL;

    let currentTankVolL = 0;
    if (inputMode === 'percentage') {
      // Measurable capacity is total capacity minus the conical part not seen by sensor
      const measurableCapacity = effectiveCapacity - conicalVolumeL;
      currentTankVolL = (levelPercentage / 100) * measurableCapacity + conicalVolumeL;
    } else if (inputMode === 'liters') {
      currentTankVolL = levelLiters;
    } else {
      const radius = diameter / 2;
      const volumeCm3 = Math.PI * Math.pow(radius, 2) * height;
      currentTankVolL = (volumeCm3 / 1000) + conicalVolumeL;
    }

    const totalVolL = currentTankVolL + effectiveCircuitVolume;
    const tankMassKg = currentTankVolL * effectiveDensity;
    const circuitMassKg = effectiveCircuitVolume * effectiveDensity;
    const totalMassKg = totalVolL * effectiveDensity;
    
    // Formula: Mass Total (KG) - Taux de Dilution (%)
    // Pure Product (KG) = Total Mass (KG) * (1 - DilutionRate/100)
    const pureProductKg = totalMassKg * (1 - (dilutionRate / 100));
    
    // Calculate weight for each pigment
    const pigmentResults: PigmentResult[] = pigments.map(p => ({
      pigment: p,
      weightG: pureProductKg * (p.percentage / 100) * 1000
    }));

    // Reduction Calculation
    let reductionResult = 0;
    let reductionNeededMass = 0;

    if (reductionMode === 'result') {
      // P_final = (M_initial * P_initial) / (M_initial + M_added)
      reductionResult = (totalMassKg * reductionInitialPercentage) / (totalMassKg + reductionAddedMass);
    } else {
      // M_added = M_initial * (P_initial / P_target - 1)
      if (reductionTargetPercentage > 0 && reductionTargetPercentage < reductionInitialPercentage) {
        reductionNeededMass = totalMassKg * (reductionInitialPercentage / reductionTargetPercentage - 1);
      }
    }

    return {
      tankVolumeL: currentTankVolL,
      tankMassKg,
      circuitMassKg,
      totalVolumeL: totalVolL,
      totalMassKg,
      pureProductKg,
      pigmentResults,
      reductionResult,
      reductionNeededMass,
      conicalVolumeL,
      circuitVolumeL: effectiveCircuitVolume
    };
  }, [selectedTank, inputMode, levelPercentage, levelLiters, height, diameter, dilutionRate, pigments, customDensity, customCapacity, customCircuitVolume, reductionInitialPercentage, reductionAddedMass, reductionTargetPercentage, reductionMode, conicalVolumeL]);

  const addPigment = () => {
    if (!newPigmentName) return;
    const pigment: Pigment = {
      id: Date.now().toString(),
      name: newPigmentName,
      percentage: newPigmentPercentage
    };
    setPigments([...pigments, pigment]);
    setNewPigmentName('');
    setNewPigmentPercentage(0);
  };

  const removePigment = (id: string) => {
    setPigments(pigments.filter(p => p.id !== id));
  };

  const downloadPDF = () => {
    if (!results || !selectedTank) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(0, 0, 0); // Black Header
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('PAINT MASTER', 20, 28);
    
    // Axalta Logo Representation
    doc.setTextColor(200, 16, 46); // Red for AXALTA
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AXALTA', pageWidth - 20, 24, { align: 'right' });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('COATING SYSTEMS', pageWidth - 20, 31, { align: 'right' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('RAPPORT TECHNIQUE DE CORRECTION', 20, 37);
    
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    doc.setFontSize(9);
    doc.text(`Émis le: ${dateStr}`, pageWidth - 20, 40, { align: 'right' });

    // Tank Info Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Configuration: ${selectedTank.name}`, 20, 60);
    
    doc.setDrawColor(200, 16, 46); // Red line
    doc.setLineWidth(0.5);
    doc.line(20, 63, 100, 63);

    // Results Table
    autoTable(doc, {
      startY: 70,
      head: [['Paramètre', 'Valeur', 'Unité']],
      body: [
        ['Volume Cuve', results.tankVolumeL.toFixed(2), 'L'],
        ['Masse Cuve', results.tankMassKg.toFixed(2), 'KG'],
        ['Volume Circuit', results.circuitVolumeL.toFixed(2), 'L'],
        ['Masse Circuit', results.circuitMassKg.toFixed(2), 'KG'],
        ['Volume Total', results.totalVolumeL.toFixed(2), 'L'],
        ['Masse Totale', results.totalMassKg.toFixed(2), 'KG'],
        ['Produit Pur Estimé', results.pureProductKg.toFixed(2), 'KG'],
        ['Taux de Dilution', dilutionRate.toFixed(1), '%'],
        ['Capacité Appliquée', (customCapacity ?? selectedTank.capacityL).toFixed(1), 'L'],
        ['Circuit Appliqué', (customCircuitVolume ?? selectedTank.circuitVolumeL).toFixed(1), 'L'],
        ['Densité Appliquée', (customDensity ?? selectedTank.densityGcm3).toFixed(3), 'g/cm³']
      ],
      theme: 'striped',
      headStyles: { fillColor: [200, 16, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    });

    // Pigments Section
    let currentY = (doc as any).lastAutoTable.finalY + 12;
    
    if (results.pigmentResults.length > 0) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Corrections Pigmentaires', 20, currentY);
      
      autoTable(doc, {
        startY: currentY + 4,
        head: [['Pigment', 'Correction (%)', 'Poids à Ajouter']],
        body: results.pigmentResults.map(pr => [
          pr.pigment.name,
          `${pr.pigment.percentage.toFixed(2)} %`,
          `${pr.weightG.toFixed(1)} g`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 3 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // Reduction Section (if used)
    if (reductionInitialPercentage > 0) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Réduction de Pigment (Dilution)', 20, currentY);
      
      const reductionBody = reductionMode === 'result' 
        ? [
            ['Pourcentage Initial', `${reductionInitialPercentage.toFixed(2)} %`],
            ['Masse Ajoutée (Frais)', `${reductionAddedMass.toFixed(2)} KG`],
            ['Nouveau Pourcentage', `${results.reductionResult.toFixed(3)} %`]
          ]
        : [
            ['Pourcentage Initial', `${reductionInitialPercentage.toFixed(2)} %`],
            ['Pourcentage Cible', `${reductionTargetPercentage.toFixed(2)} %`],
            ['Masse à Ajouter (Frais)', `${results.reductionNeededMass.toFixed(2)} KG`]
          ];

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Paramètre de Dilution', 'Valeur']],
        body: reductionBody,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 3 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Signature Section
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);
    doc.line(20, currentY, pageWidth - 20, currentY);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Signature Responsable:', 20, currentY + 10);
    
    doc.setDrawColor(200, 16, 46); // Red signature line
    doc.line(20, currentY + 13, 80, currentY + 13);
    
    doc.setTextColor(0, 0, 0);
    doc.text('ENNAMRI Ayoub', 20, currentY + 22);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Chef de Site', 20, currentY + 28);

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('DOCUMENT TECHNIQUE CONFIDENTIEL - AXALTA COATING SYSTEMS', pageWidth / 2, footerY, { align: 'center' });
    doc.text('Généré par Paint Master System - Précision Industrielle', pageWidth / 2, footerY + 5, { align: 'center' });

    doc.save(`PaintMaster_Report_${selectedTank.name}_${Date.now()}.pdf`);
  };

  const handleSaveTank = (tank: Tank) => {
    if (tanks.find(t => t.id === tank.id)) {
      setTanks(tanks.map(t => t.id === tank.id ? tank : t));
    } else {
      setTanks([...tanks, tank]);
    }
    setEditingTank(null);
  };

  const handleDeleteTank = (id: string) => {
    if (tanks.length <= 1) return;
    setTanks(tanks.filter(t => t.id !== id));
    if (selectedTankId === id) setSelectedTankId(tanks.find(t => t.id !== id)?.id || '');
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-bottom border-zinc-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Calculator className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Paint Master</h1>
            <p className="text-xs text-zinc-500 font-medium">Concentration & Correction System</p>
          </div>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          title="Tank Settings"
        >
          <Settings className="w-5 h-5 text-zinc-600" />
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Selection & Inputs */}
        <div className="lg:col-span-4 space-y-6">
          {/* Tank Selection */}
          <section className="glass-card p-5">
            <label className="label-text">Select Tank (Cuve)</label>
            <select 
              value={selectedTankId}
              onChange={(e) => setSelectedTankId(e.target.value)}
              className="input-field text-lg font-semibold"
            >
              {tanks.map(tank => (
                <option key={tank.id} value={tank.id}>{tank.name}</option>
              ))}
            </select>
            
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="bg-zinc-50 p-2 rounded-lg">
                <span className="block text-[10px] text-zinc-400 uppercase">Capacity</span>
                <span className="font-mono font-bold text-zinc-700">{selectedTank?.capacityL}L</span>
              </div>
              <div className="bg-zinc-50 p-2 rounded-lg">
                <span className="block text-[10px] text-zinc-400 uppercase">Density</span>
                <span className="font-mono font-bold text-zinc-700">{selectedTank?.densityGcm3}</span>
              </div>
              <div className="bg-zinc-50 p-2 rounded-lg">
                <span className="block text-[10px] text-zinc-400 uppercase">Circuit</span>
                <span className="font-mono font-bold text-zinc-700">{selectedTank?.circuitVolumeL}L</span>
              </div>
            </div>
          </section>

          {/* Level Input */}
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="label-text mb-0">Tank Level Input</label>
              <div className="flex bg-zinc-100 p-1 rounded-lg">
                <button 
                  onClick={() => setInputMode('percentage')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${inputMode === 'percentage' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500'}`}
                >
                  %
                </button>
                <button 
                  onClick={() => setInputMode('liters')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${inputMode === 'liters' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500'}`}
                >
                  L
                </button>
                <button 
                  onClick={() => setInputMode('dimensions')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${inputMode === 'dimensions' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500'}`}
                >
                  DIM
                </button>
              </div>
            </div>

            {inputMode === 'percentage' && (
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-3xl font-mono font-bold text-indigo-600">{levelPercentage}%</span>
                  <div className="text-right">
                    <span className="block text-[10px] text-zinc-400 uppercase">Capacité Mesurable</span>
                    <span className="text-xs font-bold text-zinc-500">{( (customCapacity ?? selectedTank.capacityL) - conicalVolumeL).toFixed(1)} L</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={levelPercentage}
                  onChange={(e) => setLevelPercentage(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                
                <div className="pt-2 border-t border-zinc-100">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2 mb-2">
                    <Info className="w-3 h-3" />
                    Volume Conique (Non détecté par capteur)
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={conicalVolumeL || ''}
                      onChange={(e) => setConicalVolumeL(Number(e.target.value))}
                      className="input-field pr-12 text-sm"
                      placeholder="Volume de la partie conique (L)"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold text-xs">L</span>
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-1 italic">
                    Ce volume sera ajouté au calcul du pourcentage (Offset bas).
                  </p>
                </div>
              </div>
            )}

            {inputMode === 'liters' && (
              <div className="space-y-2">
                <div className="relative">
                  <input 
                    type="number" 
                    value={levelLiters}
                    onChange={(e) => setLevelLiters(Number(e.target.value))}
                    className="input-field pr-12"
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">L</span>
                </div>
              </div>
            )}

            {inputMode === 'dimensions' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Height (cm)</label>
                  <input 
                    type="number" 
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="input-field"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Diameter (cm)</label>
                  <input 
                    type="number" 
                    value={diameter}
                    onChange={(e) => setDiameter(Number(e.target.value))}
                    className="input-field"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Parameters */}
          <section className="glass-card p-5 space-y-4">
            <div className="space-y-2">
              <label className="label-text flex items-center gap-2">
                <Droplets className="w-3 h-3" />
                Capacité Cuve (L)
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  value={customCapacity ?? ''}
                  onChange={(e) => setCustomCapacity(e.target.value ? Number(e.target.value) : null)}
                  className="input-field pr-12"
                  placeholder={selectedTank?.capacityL.toString()}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">L</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="label-text flex items-center gap-2">
                <Ruler className="w-3 h-3" />
                Masse Volumique (g/cm³)
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  value={customDensity ?? ''}
                  onChange={(e) => setCustomDensity(e.target.value ? Number(e.target.value) : null)}
                  className="input-field pr-12"
                  step="0.001"
                  placeholder={selectedTank?.densityGcm3.toString()}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">ρ</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="label-text flex items-center gap-2">
                <Droplets className="w-3 h-3" />
                Current Dilution Rate (%)
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  value={dilutionRate}
                  onChange={(e) => setDilutionRate(Number(e.target.value))}
                  className="input-field pr-12"
                  step="0.1"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="label-text flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  Volume Circuit (L)
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={customCircuitVolume ?? ''}
                    onChange={(e) => setCustomCircuitVolume(e.target.value ? Number(e.target.value) : null)}
                    className="input-field pr-12"
                    placeholder={selectedTank?.circuitVolumeL.toString()}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">L</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="label-text flex items-center gap-2">
                  <Droplets className="w-3 h-3" />
                  Volume Conique (L)
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={conicalVolumeL || ''}
                    onChange={(e) => setConicalVolumeL(Number(e.target.value))}
                    className="input-field pr-12"
                    placeholder={selectedTank?.conicalVolumeL?.toString()}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">L</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="label-text flex items-center gap-2">
                <Activity className="w-3 h-3" />
                Ajouter un Pigment
              </label>
              <div className="space-y-3 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <input 
                  type="text" 
                  value={newPigmentName}
                  onChange={(e) => setNewPigmentName(e.target.value)}
                  className="input-field"
                  placeholder="Nom du pigment (ex: Noir)"
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      value={newPigmentPercentage || ''}
                      onChange={(e) => setNewPigmentPercentage(Number(e.target.value))}
                      className="input-field pr-12"
                      step="0.01"
                      placeholder="%"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">%</span>
                  </div>
                  <button 
                    onClick={addPigment}
                    className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={downloadPDF}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20"
            >
              <Download className="w-5 h-5" /> Télécharger Rapport PDF
            </button>
          </section>

          {/* Reduction Calculator Section */}
          <section className="glass-card p-5 space-y-4 border-t-4 border-t-zinc-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-900" />
                Réduction de Pigment (Dilution)
              </h3>
              <div className="flex bg-zinc-100 p-1 rounded-lg">
                <button 
                  onClick={() => setReductionMode('result')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${reductionMode === 'result' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                >
                  RÉSULTAT
                </button>
                <button 
                  onClick={() => setReductionMode('target')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${reductionMode === 'target' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                >
                  CIBLE
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Pourcentage Actuel (%)</label>
                  <input 
                    type="number" 
                    value={reductionInitialPercentage || ''}
                    onChange={(e) => setReductionInitialPercentage(Number(e.target.value))}
                    className="input-field"
                    placeholder="ex: 15.5"
                  />
                </div>
                {reductionMode === 'result' ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Masse à Ajouter (KG)</label>
                    <input 
                      type="number" 
                      value={reductionAddedMass || ''}
                      onChange={(e) => setReductionAddedMass(Number(e.target.value))}
                      className="input-field"
                      placeholder="ex: 50"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Pourcentage Cible (%)</label>
                    <input 
                      type="number" 
                      value={reductionTargetPercentage || ''}
                      onChange={(e) => setReductionTargetPercentage(Number(e.target.value))}
                      className="input-field"
                      placeholder="ex: 12.0"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-900 text-white rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">
                    {reductionMode === 'result' ? 'Nouveau Pourcentage Estimé' : 'Masse de Produit Frais à Ajouter'}
                  </span>
                  <Info className="w-3 h-3 text-zinc-500" />
                </div>
                <div className="text-2xl font-mono font-bold">
                  {reductionMode === 'result' ? (
                    <span className="text-emerald-400">
                      {results?.reductionResult.toFixed(3)} %
                    </span>
                  ) : (
                    <span className="text-indigo-400">
                      {results?.reductionNeededMass.toFixed(2)} KG
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 italic">
                  * Basé sur une masse totale actuelle de {results?.totalMassKg.toFixed(2)} KG
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pigment Results List */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Corrections Pigmentaires
                </h3>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">
                  {results?.pigmentResults.length} PIGMENTS
                </span>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {results?.pigmentResults.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400">
                    <Droplets className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs italic">Aucun pigment ajouté</p>
                  </div>
                ) : (
                  results?.pigmentResults.map((pr) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={pr.pigment.id}
                      className="flex items-center justify-between p-3 bg-white border border-zinc-100 rounded-xl hover:border-indigo-200 transition-colors"
                    >
                      <div>
                        <span className="block text-sm font-bold text-zinc-900">{pr.pigment.name}</span>
                        <span className="text-[10px] text-zinc-400 font-mono uppercase">{pr.pigment.percentage}% de correction</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="block text-lg font-mono font-black text-indigo-600">
                            {pr.weightG.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Grammes</span>
                        </div>
                        <button 
                          onClick={() => removePigment(pr.pigment.id)}
                          className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Volume Breakdown */}
            <div className="glass-card p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-sm font-medium text-zinc-600">Masse Cuve (KG)</span>
                  </div>
                  <span className="font-mono font-bold text-zinc-900">{results?.tankMassKg.toFixed(2)} KG</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-sm font-medium text-zinc-600">Volume Total (L)</span>
                  </div>
                  <span className="font-mono font-bold text-zinc-900">{results?.totalVolumeL.toFixed(2)} L</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-zinc-600">Masse Totale (KG)</span>
                  </div>
                  <span className="font-mono font-bold text-zinc-900">{results?.totalMassKg.toFixed(2)} KG</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-zinc-900" />
                    <span className="text-sm font-bold text-zinc-900 uppercase">Produit Pur (KG)</span>
                  </div>
                  <span className="font-mono font-black text-zinc-900 text-xl">{results?.pureProductKg.toFixed(2)} KG</span>
                </div>
              </div>

              <div className="mt-6 bg-indigo-50 rounded-xl p-4 flex items-center gap-4 border border-indigo-100">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Activity className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400 font-bold uppercase">Base de Calcul (Produit Pur)</span>
                  <span className="font-mono font-black text-indigo-600 text-lg">{results?.pureProductKg.toFixed(2)} KG</span>
                </div>
              </div>
            </div>
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
            .custom-scrollbar::-webkit-scrollbar {
              width: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: #f4f4f5;
              border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #e4e4e7;
              border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #d4d4d8;
            }
          `}} />

          {/* Detailed Table View */}
          <section className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">System Summary: {selectedTank?.name}</h3>
              <span className="text-[10px] font-bold bg-white px-2 py-1 rounded border border-zinc-200 text-zinc-500">REAL-TIME DATA</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50">
                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase">Parameter</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase">Value</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase">Unit</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">Volume Cuve</td>
                    <td className="px-6 py-4 font-mono font-bold">{results?.tankVolumeL.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">L</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 italic">Volume actuel dans la cuve (incluant partie conique)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">Masse Cuve</td>
                    <td className="px-6 py-4 font-mono font-bold">{results?.tankMassKg.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">KG</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 italic">Masse du produit dans la cuve uniquement</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">Volume Circuit</td>
                    <td className="px-6 py-4 font-mono font-bold">{results?.circuitVolumeL.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">L</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 italic">Volume du circuit technique</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">Masse Circuit</td>
                    <td className="px-6 py-4 font-mono font-bold">{results?.circuitMassKg.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">KG</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 italic">Masse du produit dans le circuit uniquement</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">Total Mass</td>
                    <td className="px-6 py-4 font-mono font-bold">{results?.totalMassKg.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">KG</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 italic">Masse totale du système (Cuve + Circuit)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">Density</td>
                    <td className="px-6 py-4 font-mono font-bold">{selectedTank?.densityGcm3}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">g/cm³</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 italic">Masse volumique du produit</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">Dilution</td>
                    <td className="px-6 py-4 font-mono font-bold">{dilutionRate}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">%</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 italic">Taux de dilution actuel</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">Produit Pur</td>
                    <td className="px-6 py-4 font-mono font-bold">{results?.pureProductKg.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">KG</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 italic">Masse du produit concentré (Masse Totale - Dilution)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-600">Correction Vol</td>
                    <td className="px-6 py-4 font-mono font-bold">
                      {results?.pigmentResults.length > 0 
                        ? (results.pigmentResults.reduce((acc, curr) => acc + curr.weightG, 0) / ((customDensity ?? selectedTank.densityGcm3) * 1000)).toFixed(3)
                        : '0.000'
                      }
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400">L</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 italic">Volume total de correction (somme des pigments)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-zinc-900">Tank Configuration</h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {editingTank ? (
                  <div className="max-w-md mx-auto space-y-6 py-4">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                      {editingTank.id === 'new' ? 'Add New Tank' : `Edit Tank: ${editingTank.name}`}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="label-text">Tank Name</label>
                        <input 
                          type="text" 
                          value={editingTank.name}
                          onChange={(e) => setEditingTank({...editingTank, name: e.target.value})}
                          className="input-field"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label-text">Capacity (L)</label>
                          <input 
                            type="number" 
                            value={editingTank.capacityL}
                            onChange={(e) => setEditingTank({...editingTank, capacityL: Number(e.target.value)})}
                            className="input-field"
                          />
                        </div>
                        <div>
                          <label className="label-text">Density (g/cm³)</label>
                          <input 
                            type="number" 
                            value={editingTank.densityGcm3}
                            onChange={(e) => setEditingTank({...editingTank, densityGcm3: Number(e.target.value)})}
                            className="input-field"
                            step="0.001"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label-text">Circuit Volume (L)</label>
                          <input 
                            type="number" 
                            value={editingTank.circuitVolumeL}
                            onChange={(e) => setEditingTank({...editingTank, circuitVolumeL: Number(e.target.value)})}
                            className="input-field"
                          />
                        </div>
                        <div>
                          <label className="label-text">Conical Volume (L)</label>
                          <input 
                            type="number" 
                            value={editingTank.conicalVolumeL || 0}
                            onChange={(e) => setEditingTank({...editingTank, conicalVolumeL: Number(e.target.value)})}
                            className="input-field"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => handleSaveTank(editingTank)}
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" /> Save Changes
                      </button>
                      <button 
                        onClick={() => setEditingTank(null)}
                        className="flex-1 bg-zinc-100 text-zinc-600 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm text-zinc-500">Manage your tanks and their technical specifications.</p>
                      <button 
                        onClick={() => setEditingTank({ id: Date.now().toString(), name: '', capacityL: 0, densityGcm3: 1, circuitVolumeL: 0, conicalVolumeL: 0 })}
                        className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-indigo-100 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Add Tank
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tanks.map(tank => (
                        <div key={tank.id} className="border border-zinc-100 rounded-2xl p-4 flex items-center justify-between hover:border-indigo-200 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                              <Droplets className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-zinc-900">{tank.name}</h4>
                              <p className="text-[10px] text-zinc-400 font-mono uppercase">
                                {tank.capacityL}L • {tank.densityGcm3} g/cm³ • {tank.circuitVolumeL}L Circuit {tank.conicalVolumeL ? `• ${tank.conicalVolumeL}L Conique` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => setEditingTank(tank)}
                              className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteTank(tank.id)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
