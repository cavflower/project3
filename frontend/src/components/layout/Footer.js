import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <p>
        &copy; <Link to="/login/admin" style={{ color: 'inherit', textDecoration: 'none' }}>2025 餐飲平台. 版權所有.</Link>
      </p>
    </footer>
  );
};

export default Footer;
