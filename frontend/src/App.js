import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Galleries from './pages/Galleries';
import Contracts from './pages/Contracts';
import Invoices from './pages/Invoices';
import Shoots from './pages/Shoots';
import AIEditing from './pages/AIEditing';
import SocialMedia from './pages/SocialMedia';
import Packages from './pages/Packages';
import Equipment from './pages/Equipment';
import Expenses from './pages/Expenses';
import Portfolio from './pages/Portfolio';
import Workflows from './pages/Workflows';
import EmailTemplates from './pages/EmailTemplates';
import Analytics from './pages/Analytics';
import Testimonials from './pages/Testimonials';
import Mileage from './pages/Mileage';
import Bookings from './pages/Bookings';
import Tasks from './pages/Tasks';
import Layout from './components/Layout';
import './styles/App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

  const handleLogin = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <ToastContainer position="bottom-right" theme="dark" />
      </>
    );
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard token={token} />} />
          <Route path="/clients" element={<Clients token={token} />} />
          <Route path="/galleries" element={<Galleries token={token} />} />
          <Route path="/contracts" element={<Contracts token={token} />} />
          <Route path="/invoices" element={<Invoices token={token} />} />
          <Route path="/shoots" element={<Shoots token={token} />} />
          <Route path="/ai-editing" element={<AIEditing token={token} />} />
          <Route path="/social-media" element={<SocialMedia token={token} />} />
          <Route path="/packages" element={<Packages token={token} />} />
          <Route path="/equipment" element={<Equipment token={token} />} />
          <Route path="/expenses" element={<Expenses token={token} />} />
          <Route path="/portfolio" element={<Portfolio token={token} />} />
          <Route path="/workflows" element={<Workflows token={token} />} />
          <Route path="/email-templates" element={<EmailTemplates token={token} />} />
          <Route path="/analytics" element={<Analytics token={token} />} />
          <Route path="/testimonials" element={<Testimonials token={token} />} />
          <Route path="/mileage" element={<Mileage token={token} />} />
          <Route path="/bookings" element={<Bookings token={token} />} />
          <Route path="/tasks" element={<Tasks token={token} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
      <ToastContainer position="bottom-right" theme="dark" />
    </Router>
  );
}

export default App;
