import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Mobile web scanner for door staff (MVP). The native offline app is Phase 2.
export default defineConfig({
  plugins: [react()],
});
