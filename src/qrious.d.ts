declare module 'qrious' {
  interface QRiousOptions {
    background?: string;
    backgroundAlpha?: number;
    element?: HTMLElement | null;
    foreground?: string;
    foregroundAlpha?: number;
    level?: 'L' | 'M' | 'Q' | 'H';
    mime?: string;
    padding?: number;
    size?: number;
    value?: string;
  }

  export default class QRious {
    constructor(options?: QRiousOptions);
    background: string;
    backgroundAlpha: number;
    element: HTMLElement;
    foreground: string;
    foregroundAlpha: number;
    level: 'L' | 'M' | 'Q' | 'H';
    mime: string;
    padding: number;
    size: number;
    value: string;
    toDataURL(mime?: string): string;
  }
}
