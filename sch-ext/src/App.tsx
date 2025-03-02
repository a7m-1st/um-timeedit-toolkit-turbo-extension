import React, { useEffect, useRef, useState } from 'react';
import {
  HashRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import './App.css';
import Settings from './pages/Settings';
import Home from './pages/Home/Home';

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path='/' element={<Home/>}/>
          <Route path='/settings' element={<Settings/>}/>
        </Routes>
      </Router>
    </div>
    
  );
}

export default App;