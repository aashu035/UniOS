import React from 'react';
import {
  AlarmClock, ArrowLeftRight, ArrowRight, Bell, BellRing, BookOpen, BookPlus, Boxes, CalendarClock, CalendarDays,
  Check, CheckCheck, ChevronLeft, ChevronRight, CircleCheckBig, CircleSlash, CodeXml, Coffee, Cpu, Database,
  Ellipsis, FilePenLine, FilePlus, FileText, FlaskConical, GraduationCap, HardDriveDownload, House, Image as ImageIcon,
  Info, LayoutGrid, Link, ListPlus, MapPin, Moon, Network, NotebookPen, PartyPopper, Plus, RefreshCw, RotateCcw,
  ScanLine, Search, Settings2, Sigma, SlidersHorizontal, Sparkles, StickyNote, TestTubeDiagonal, TriangleAlert,
  Upload, User, Users, X, BookMarked, Calendar, Trash2,
} from 'lucide-react-native';

const ICONS = {
  'alarm-clock': AlarmClock, 'arrow-left-right': ArrowLeftRight, 'arrow-right': ArrowRight, bell: Bell,
  'bell-ring': BellRing, 'book-open': BookOpen, 'book-plus': BookPlus, 'book-marked': BookMarked, boxes: Boxes,
  calendar: Calendar, 'calendar-clock': CalendarClock, 'calendar-days': CalendarDays, check: Check, 'check-check': CheckCheck,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, 'circle-check-big': CircleCheckBig,
  'circle-slash': CircleSlash, 'code-xml': CodeXml, coffee: Coffee, cpu: Cpu, database: Database, ellipsis: Ellipsis,
  'file-pen-line': FilePenLine, 'file-plus': FilePlus, 'file-text': FileText, 'flask-conical': FlaskConical,
  'graduation-cap': GraduationCap, 'hard-drive-download': HardDriveDownload, house: House, image: ImageIcon, info: Info,
  'layout-grid': LayoutGrid, link: Link, 'list-plus': ListPlus, 'map-pin': MapPin, moon: Moon, network: Network,
  'notebook-pen': NotebookPen, 'party-popper': PartyPopper, plus: Plus, 'refresh-cw': RefreshCw, 'rotate-ccw': RotateCcw,
  'scan-line': ScanLine, search: Search, 'settings-2': Settings2, sigma: Sigma, 'sliders-horizontal': SlidersHorizontal,
  sparkles: Sparkles, 'sticky-note': StickyNote, 'test-tube-diagonal': TestTubeDiagonal, 'trash-2': Trash2,
  'triangle-alert': TriangleAlert, upload: Upload, user: User, users: Users, x: X,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color, width = 2 }: { name: IconName; size?: number; color: string; width?: number }) {
  const C = ICONS[name] ?? Info;
  return <C size={size} color={color} strokeWidth={width} />;
}

/**
 * Courses store a free-form `icon` id. Map the ones the app knows to the design's
 * subject glyphs; anything else gets a generic book.
 */
export function courseIcon(id: string | null | undefined, name = ''): IconName {
  const key = `${id ?? ''} ${name}`.toLowerCase();
  if (/(operating|\bos\b|cpu|processor|embedded)/.test(key)) return 'cpu';
  if (/(dbms|database|sql)/.test(key)) return 'database';
  if (/(network|\bcn\b|cyber|security)/.test(key)) return 'network';
  if (/(math|discrete|sigma|statistic|calculus|automata)/.test(key)) return 'sigma';
  if (/(software|engineering|boxes|design)/.test(key)) return 'boxes';
  if (/(data struct|\bds\b|code|program|python|java|algorithm)/.test(key)) return 'code-xml';
  if (/(lab|flask|chem|physics)/.test(key)) return 'flask-conical';
  return 'book-open';
}
