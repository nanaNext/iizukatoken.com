import { configureStore, createSlice } from '@reduxjs/toolkit';

const demoSlice = createSlice({
  name: 'demo',
  initialState: { count: 0 },
  reducers: {
    increment(state) { state.count += 1; }
  }
});

export const { increment } = demoSlice.actions;

export const store = configureStore({
  reducer: {
    demo: demoSlice.reducer
  }
});
