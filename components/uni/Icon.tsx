import React from 'react';
import {
  AlarmClock, ArrowLeftRight, ArrowRight, Bell, BellRing, BookOpen, BookPlus, Boxes, CalendarClock, CalendarDays,
  Check, CheckCheck, ChevronLeft, ChevronRight, CircleCheckBig, CircleSlash, CodeXml, Coffee, Cpu, Database,
  Ellipsis, FilePenLine, FilePlus, FileText, FlaskConical, GraduationCap, HardDriveDownload, House, Image as ImageIcon,
  Info, LayoutGrid, Link, ListPlus, MapPin, Moon, Network, NotebookPen, PartyPopper, Plus, RefreshCw, RotateCcw,
  ScanLine, Search, Settings2, Sigma, SlidersHorizontal, Sparkles, StickyNote, TestTubeDiagonal, TriangleAlert,
  Upload, User, Users, X, BookMarked, Calendar, Trash2, Plane, Ban, BriefcaseMedical, History, CircleDashed, Clock3, Target,
  CircleAlert, CircleQuestionMark, CircleDot, ClockAlert, CircleCheck, Paperclip, Camera, Images, FolderOpen, Pencil, Copy,
  Share2, ExternalLink, Eye, EyeOff, ClipboardPaste, KeyRound, WifiOff, Lock, Minus, UserRound, SearchX, CalendarRange,
  CalendarCog, Globe, Smartphone, HardDrive, Hourglass, ImageOff, Play, Pause, RotateCw, Maximize, Minimize, Bookmark,
  Volume2, TextWrap, List, Zap, ZapOff, Undo2, FolderInput, Presentation, Sheet, FileSpreadsheet, FileArchive, FileCode,
  FileImage, FileVideoCamera, FileMusic, FileQuestionMark, Headphones, Rewind, FastForward, Sun, Code,
  Heading, Bold, Italic, ListOrdered, Quote, SquareCheckBig, Download, School, Hash, Layers, ShieldCheck, LoaderCircle, Circle, ShieldX, Gauge, ChevronDown, CloudCheck, EllipsisVertical, SquareArrowOutUpRight, CameraOff, Clipboard as ClipboardIcon, File as FileIcon, AudioLines,
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
  'triangle-alert': TriangleAlert, upload: Upload, plane: Plane, ban: Ban, 'briefcase-medical': BriefcaseMedical, history: History, 'circle-dashed': CircleDashed, 'clock-3': Clock3, target: Target, user: User, users: Users, x: X,
  'circle-alert': CircleAlert, 'circle-help': CircleQuestionMark, 'circle-dot': CircleDot, 'clock-alert': ClockAlert,
  'circle-check': CircleCheck, paperclip: Paperclip, camera: Camera, images: Images, 'folder-open': FolderOpen, pencil: Pencil,
  copy: Copy, 'share-2': Share2, 'external-link': ExternalLink, eye: Eye, 'eye-off': EyeOff, 'clipboard-paste': ClipboardPaste,
  'key-round': KeyRound, 'wifi-off': WifiOff, lock: Lock, minus: Minus, 'user-round': UserRound, 'search-x': SearchX,
  'calendar-range': CalendarRange, 'calendar-cog': CalendarCog, globe: Globe, smartphone: Smartphone, 'hard-drive': HardDrive,
  hourglass: Hourglass, 'image-off': ImageOff, play: Play, pause: Pause, 'rotate-cw': RotateCw, maximize: Maximize,
  minimize: Minimize, bookmark: Bookmark, 'volume-2': Volume2, 'text-wrap': TextWrap, list: List, zap: Zap, 'zap-off': ZapOff,
  'undo-2': Undo2, 'folder-input': FolderInput, presentation: Presentation, sheet: Sheet, 'file-spreadsheet': FileSpreadsheet,
  'file-archive': FileArchive, 'file-code': FileCode, 'file-image': FileImage, 'file-video': FileVideoCamera, 'file-music': FileMusic,
  'file-question': FileQuestionMark, headphones: Headphones, rewind: Rewind, 'fast-forward': FastForward, sun: Sun, code: Code,
  heading: Heading, bold: Bold, italic: Italic, 'list-ordered': ListOrdered, quote: Quote, 'square-check-big': SquareCheckBig,
  download: Download, school: School, hash: Hash, layers: Layers, 'shield-check': ShieldCheck, loader: LoaderCircle, circle: Circle, 'shield-x': ShieldX, gauge: Gauge, 'chevron-down': ChevronDown, 'cloud-check': CloudCheck, 'ellipsis-vertical': EllipsisVertical, 'square-arrow-out-up-right': SquareArrowOutUpRight, 'camera-off': CameraOff, clipboard: ClipboardIcon, file: FileIcon, 'audio-lines': AudioLines,
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
