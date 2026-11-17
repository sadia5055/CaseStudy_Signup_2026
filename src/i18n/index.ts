import type { Copy, Lang } from './copy';
import { en } from './en';
import { fr } from './fr';

export type { Copy, ErrorCopy, Lang } from './copy';

export const copies: Record<Lang, Copy> = { en, fr };

export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'fr' : 'en');
