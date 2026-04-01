import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ReactMarkdown from "react-markdown";
import { useEffect, useState } from 'react'

import Navbar from '../components/NavBar.tsx'
import Footer from '../components/Footer.tsx'

import Home from './Home.tsx'
import Projects from './Projects.tsx'
import Settings from './Settings.tsx'
import Socials from './Socials.tsx'

function App() {

  const [termsMd, setTermsMd] = useState('');
  const [privacyMd, setPrivacyMd] = useState('');

  useEffect(() => {
    fetch('/terms.md')
      .then(res => res.text())
      .then(setTermsMd);

    fetch('/privacy.md')
      .then(res => res.text())
      .then(setPrivacyMd);
  }, []);

  return (
    <BrowserRouter>
      <Navbar />
    
      <main className='main-content'>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/socials" element={<Socials />} />

          <Route path="/terms" element={<div className="markdown"><ReactMarkdown>{termsMd}</ReactMarkdown></div>} />
          <Route path="/privacy" element={<div className="markdown"><ReactMarkdown>{privacyMd}</ReactMarkdown></div>} />

          <Route path="/projects/legobot" element={<Projects />} />
          <Route path="/projects/legogpt" element={<Projects />} />
          <Route path="/projects/welcomer" element={<Projects />} />
        </Routes>
      </main>
      
      <Footer />
    </BrowserRouter>
  )
}

export default App