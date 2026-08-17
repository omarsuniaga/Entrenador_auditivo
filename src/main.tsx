import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './presentation/components/ErrorBoundary.tsx';
import { ThemeProvider } from './presentation/context/ThemeContext.tsx';
import { AudioProfileProvider } from './presentation/context/AudioProfileContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AudioProfileProvider>
          <App />
        </AudioProfileProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);



