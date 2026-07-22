import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// El modo `https` existe para la Fase 2: la camara y el giroscopio del celular
// solo funcionan sobre HTTPS, incluso en la red local.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: {
    port: 5173,
  },
}));
