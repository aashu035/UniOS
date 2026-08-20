import React from 'react';
import { 
  Shield, 
  Network, 
  Code, 
  BrainCircuit, 
  HardHat, 
  Sigma, 
  Atom, 
  FlaskConical, 
  Database, 
  BookOpen 
} from 'lucide-react-native';

interface CourseIconProps {
  name: string;
  size?: number;
  color?: string;
}

export function CourseIcon({ name, size = 20, color = '#000' }: CourseIconProps) {
  switch (name) {
    case 'shield':
      return <Shield size={size} color={color} />;
    case 'network':
      return <Network size={size} color={color} />;
    case 'code':
      return <Code size={size} color={color} />;
    case 'brain':
      return <BrainCircuit size={size} color={color} />;
    case 'hard-hat':
      return <HardHat size={size} color={color} />;
    case 'sigma':
      return <Sigma size={size} color={color} />;
    case 'atom':
      return <Atom size={size} color={color} />;
    case 'flask-conical':
      return <FlaskConical size={size} color={color} />;
    case 'database':
      return <Database size={size} color={color} />;
    case 'book':
    default:
      return <BookOpen size={size} color={color} />;
  }
}
