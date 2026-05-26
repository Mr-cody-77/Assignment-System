import { createSlice } from '@reduxjs/toolkit';

const nodeSlice = createSlice({
  name: 'nodes',
  initialState: { list: [], loading: false, lastUpdated: null },
  reducers: {
    setNodes(state, action) {
      state.list = action.payload;
      state.lastUpdated = Date.now();
    },
    setLoading(state, action) { state.loading = action.payload; },
    updateNodeLoad(state, action) {
      const { node_id, cpu_load, memory_load, active_workers, inflight_tasks } = action.payload;
      const node = state.list.find(n => n.node_id === node_id);
      if (node) {
        node.cpu_load = cpu_load;
        node.memory_load = memory_load;
        node.active_workers = active_workers;
        node.inflight_tasks = inflight_tasks;
      }
    },
  },
});

export const { setNodes, setLoading, updateNodeLoad } = nodeSlice.actions;
export const selectNodes = (s) => s.nodes.list;
export default nodeSlice.reducer;
