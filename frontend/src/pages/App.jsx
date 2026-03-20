import { Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

import Navbar from '../components/specific/Navbar.jsx'

import Home from './Home.jsx'
import About from './About.jsx'
import Projects from './Projects.jsx'

import LegoBot from './projects/LegoBot/LegoBot.jsx'
import LegoBotDocs from './projects/LegoBot/Docs.jsx'
import LegoBotDashboard from './projects/LegoBot/Dashboard.jsx'

function Users() {
  return <h1>Users</h1>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function App() {
  console.log(
    '%c👾 WELCOME TO LLEGONETWORK.DEV 👾\n%cMade by Landon Lego',
    'color: #6090ff; font-size: 20px; font-weight: bold;',
    'color: #c3c8e6; font-size: 12px;'
  );
  
  return (
    <>
    <div>
      <Navbar />
      <ScrollToTop />
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/contact" element={<Users />} />

        <Route path="/projects/LegoBot" element={<LegoBot />} />
        <Route path="/projects/LegoBot/docs" element={<LegoBotDocs />} />
        <Route path="/projects/LegoBot/dashboard" element={<LegoBotDashboard />} />
      </Routes>
    </div>
    </>
  )
}

export default App
