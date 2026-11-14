export type ConnectionMode = 'simulator' | 'ccapi';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ActiveTab = 'connect' | 'tether' | 'compare' | 'gallery';

export interface PhotoExif {
  iso: string;
  aperture: string;
  shutterSpeed: string;
  focalLength: string;
  lens: string;
  whiteBalance: string;
}

export interface TetherPhoto {
  id: string;
  filename: string;
  url: string;
  fullUrl?: string;
  timestamp: number;
  exif: PhotoExif;
  isFastPreview: boolean;
  isOriginal: boolean;
  source: 'simulator' | 'ccapi' | 'local';
  sizeLabel: string;
}

export interface CcapiDeviceInfo {
  manufacturer?: string;
  productname?: string;
  serialnumber?: string;
  firmwareversion?: string;
}

export interface SavedCameraEndpoint {
  ip: string;
  port: string;
  cameraName?: string;
  lastUsedAt: number;
}
