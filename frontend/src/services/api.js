import axios from 'axios';

// Get backend URL from environment variable (configured in .env file)
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

export const streamService = {
  // Start streaming
  startStream: async (rtspUrl) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/stream/start`, { rtspUrl });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to start stream');
    }
  },

  // Stop streaming
  stopStream: async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/stream/stop`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to stop stream');
    }
  },

  // Get stream status
  getStatus: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/stream/status`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to get status');
    }
  }
};

export const analysisService = {
  // Get analyzed frames
  getFrames: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis/frames`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to get frames');
    }
  },

  // Get a specific frame
  getFrame: async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis/frames/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to get frame');
    }
  }
};
