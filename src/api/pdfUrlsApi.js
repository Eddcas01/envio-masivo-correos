// Usa la misma instancia de axios (token y modo demo incluidos)
import api from './api';

export const pdfUrlsApi = {
    getAll: async () => {
        const response = await api.get('/plantillasurlpdf');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/plantillasurlpdf/${id}`);
        return response.data;
    },

    create: async (data) => {
        const response = await api.post('/plantillasurlpdf', data);
        return response.data;
    },

    update: async (id, data) => {
        const response = await api.put(`/plantillasurlpdf/${id}`, data);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/plantillasurlpdf/${id}`);
        return response.data;
    }
};
