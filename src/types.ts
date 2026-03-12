export interface Tank {
  id: string;
  name: string;
  capacityL: number;
  densityGcm3: number;
  circuitVolumeL: number;
  conicalVolumeL?: number;
}

export interface Pigment {
  id: string;
  name: string;
  percentage: number;
}

export interface PigmentResult {
  pigment: Pigment;
  weightG: number;
}

export interface CalculationResult {
  tankVolumeL: number;
  tankMassKg: number;
  circuitVolumeL: number;
  circuitMassKg: number;
  totalVolumeL: number;
  totalMassKg: number;
  pureProductKg: number;
  pigmentResults: PigmentResult[];
}
