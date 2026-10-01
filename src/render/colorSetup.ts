import { ColorManagement } from 'three';

/**
 * Paridad visual con el prototipo (Three r128): sin gestión de color y salida lineal, así los
 * colores hex y las texturas se ven igual que antes. Tiene que importarse antes que cualquier
 * módulo que cree colores o materiales. En la fase 4 se pasa a un pipeline sRGB con postproceso.
 */
ColorManagement.enabled = false;
