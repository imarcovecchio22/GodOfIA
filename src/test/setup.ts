import { loadRapier } from '../physics/rapier';

// Rapier (WASM) se inicializa una vez antes de los tests de simulación.
await loadRapier();
