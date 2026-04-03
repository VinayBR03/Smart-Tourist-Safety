// src/App.tsx

import { useState, useCallback } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router }         from './app/router';
import { SplashScreen }   from './components/common/SplashScreen';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const handleDone = useCallback(() => setShowSplash(false), []);

  return (
    <>
      {showSplash && <SplashScreen onDone={handleDone} />}
      <RouterProvider router={router} />
    </>
  );
}