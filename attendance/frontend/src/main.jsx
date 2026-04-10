import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App.jsx';
import { store } from './store.js';

const theme = createTheme({
  palette: {
    primary: { main: '#0b2c66' },
    secondary: { main: '#1e64b7' }
  }
});

const rootEl = document.getElementById('root');
const root = createRoot(rootEl);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
