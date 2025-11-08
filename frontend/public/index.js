import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; 
import App from './App';
import { AuthProvider } from './store/AuthContext'; 



const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(

  <React.StrictMode>

    {/* 1. BrowserRouter 啟用路由

      2. AuthProvider 必須在 App 內部，才能使用 navigate

    */}

    <BrowserRouter>

      <AuthProvider>

        <App />

      </AuthProvider>

    </BrowserRouter>

  </React.StrictMode>

); 