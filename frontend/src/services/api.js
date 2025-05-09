import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const saveBlocks = async (blocks) => {
  try {
    const response = await axios.post(`${API_URL}/blocks`, { blocks });
    return response.data;
  } catch (error) {
    console.error('Error saving blocks:', error);
    throw error;
  }
};