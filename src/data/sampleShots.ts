import portraitStudioImg from '../assets/images/tether_portrait_studio_1794590359054.jpg';
import watchMacroImg from '../assets/images/tether_watch_macro_1794590359358.jpg';
import productCeramicImg from '../assets/images/tether_product_ceramic_1794590358861.jpg';
import editorialVerticalImg from '../assets/images/tether_editorial_vertical_1794590357759.jpg';
import type { TetherPhoto } from '../types/tether';

export const INITIAL_STUDIO_SHOTS: TetherPhoto[] = [
  {
    id: 'shot-rp-0039',
    filename: 'IMG_0039.JPG',
    url: editorialVerticalImg,
    fullUrl: editorialVerticalImg,
    timestamp: Date.now() - 1_240_000,
    exif: {
      iso: 'ISO 400',
      aperture: 'f/2.8',
      shutterSpeed: '1/250s',
      focalLength: '50mm',
      lens: 'RF 24-70mm F2.8L IS USM',
      whiteBalance: '5500K Studio',
    },
    isFastPreview: false,
    isOriginal: true,
    source: 'simulator',
    sizeLabel: '9.1 MB',
  },
  {
    id: 'shot-rp-0040',
    filename: 'IMG_0040.JPG',
    url: productCeramicImg,
    fullUrl: productCeramicImg,
    timestamp: Date.now() - 780_000,
    exif: {
      iso: 'ISO 160',
      aperture: 'f/4.0',
      shutterSpeed: '1/160s',
      focalLength: '50mm',
      lens: 'RF 50mm F1.2L USM',
      whiteBalance: '5200K Daylight',
    },
    isFastPreview: false,
    isOriginal: true,
    source: 'simulator',
    sizeLabel: '8.7 MB',
  },
  {
    id: 'shot-rp-0041',
    filename: 'IMG_0041.JPG',
    url: watchMacroImg,
    fullUrl: watchMacroImg,
    timestamp: Date.now() - 420_000,
    exif: {
      iso: 'ISO 100',
      aperture: 'f/8.0',
      shutterSpeed: '1/125s',
      focalLength: '100mm',
      lens: 'RF 100mm F2.8L MACRO IS USM',
      whiteBalance: '5600K Flash',
    },
    isFastPreview: false,
    isOriginal: true,
    source: 'simulator',
    sizeLabel: '10.8 MB',
  },
  {
    id: 'shot-rp-0042',
    filename: 'IMG_0042.JPG',
    url: portraitStudioImg,
    fullUrl: portraitStudioImg,
    timestamp: Date.now() - 180_000,
    exif: {
      iso: 'ISO 200',
      aperture: 'f/2.0',
      shutterSpeed: '1/200s',
      focalLength: '85mm',
      lens: 'RF 85mm F2 MACRO IS STM',
      whiteBalance: '5400K Studio',
    },
    isFastPreview: false,
    isOriginal: true,
    source: 'simulator',
    sizeLabel: '9.4 MB',
  },
];

export const SIMULATOR_ROTATION = [
  {
    url: portraitStudioImg,
    lens: 'RF 85mm F2 MACRO IS STM',
    focalLength: '85mm',
    sizeLabel: '9.6 MB',
  },
  {
    url: watchMacroImg,
    lens: 'RF 100mm F2.8L MACRO IS USM',
    focalLength: '100mm',
    sizeLabel: '10.4 MB',
  },
  {
    url: productCeramicImg,
    lens: 'RF 50mm F1.2L USM',
    focalLength: '50mm',
    sizeLabel: '8.9 MB',
  },
  {
    url: editorialVerticalImg,
    lens: 'RF 24-70mm F2.8L IS USM',
    focalLength: '50mm',
    sizeLabel: '9.2 MB',
  },
];
