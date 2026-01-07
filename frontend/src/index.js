import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { StoreProvider } from './store/StoreContext';
import './styles/index.css';
import App from './App';
import './lib/firebase'; // Initialize Firebase

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* */}
    <BrowserRouter>
      {/* */}
      <AuthProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
