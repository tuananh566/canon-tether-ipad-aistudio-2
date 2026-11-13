export interface CanonCameraGroup {
  series: string;
  models: string[];
}

export const SUPPORTED_CANON_CAMERAS: CanonCameraGroup[] = [
  {
    series: 'EOS R System',
    models: [
      'EOS R1',
      'EOS R3',
      'EOS R5',
      'EOS R5 Mark II',
      'EOS R6',
      'EOS R6 Mark II',
      'EOS R6 Mark III',
      'EOS R6 V',
      'EOS R7',
      'EOS R8',
      'EOS RP',
      'EOS R10',
      'EOS R50',
      'EOS R50 V',
      'EOS R100',
    ],
  },
  {
    series: 'EOS M & DSLR',
    models: [
      'EOS M6 Mark II',
      'EOS M50 Mark II',
      'EOS M200',
      'EOS-1D X Mark III',
      'EOS 90D',
      'EOS 850D (Rebel T8i)',
      'EOS 250D (Rebel SL3 / 200D II)',
    ],
  },
  {
    series: 'PowerShot',
    models: [
      'PowerShot V10',
      'PowerShot G5 X Mark II',
      'PowerShot G7 X Mark III',
      'PowerShot SX70 HS',
    ],
  },
];

export const ALL_CANON_MODELS: string[] = SUPPORTED_CANON_CAMERAS.flatMap((g) => g.models);
