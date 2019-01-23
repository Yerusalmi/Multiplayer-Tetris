import React from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import Header from '../components/header/header';
import Landing from '../components/landing/landing';
import Footer from '../components/footer/footer';
import routerTester from '../components/testRouter';

const Router = () => (
  <BrowserRouter>
    <React.Fragment>
      <Header />
      <Switch>
        <Route path="/" exact component={Landing} />
        <Route Path="/test" component={routerTester} />
      </Switch>
      <Footer />
    </React.Fragment>
  </BrowserRouter>
);

export default Router;
