import React from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
// import icon from '../assets/icon.svg';
import './App.global.css';
import PageOne from './PageOne';

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={PageOne} />
      </Switch>
    </Router>
  );
}
