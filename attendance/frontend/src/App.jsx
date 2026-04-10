import React from 'react';
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { increment } from './store.js';

export default function App() {
  const count = useSelector((s) => s.demo.count);
  const dispatch = useDispatch();
  return (
    <Box>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>スマートE勤怠 React</Typography>
          <Button color="inherit" onClick={() => location.href='/ui/portal'}>ポータル</Button>
        </Toolbar>
      </AppBar>
      <Container sx={{ mt: 3 }}>
        <Typography variant="h5" gutterBottom>Material-UI + Redux + Vite</Typography>
        <Typography variant="body1">カウント: {count}</Typography>
        <Button variant="contained" sx={{ mt: 1 }} onClick={() => dispatch(increment())}>+1</Button>
      </Container>
    </Box>
  );
}
