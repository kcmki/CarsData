"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface FormData {
    brands: string[];
    colors: string[];
    countries: string[];
    fuelTypes: string[];
    gearboxTypes: string[];
    cities: string[];
    models: string[];
}

interface FormDataContextType extends FormData {
    selectedCountry: string | null;
    selectedBrand: string | null;
    setSelectedCountry: (country: string) => void;
    setSelectedBrand: (brand: string) => void;
    loading: boolean;
    loadingModels: boolean;
    loadingCities: boolean;
}

const FormDataContext = createContext<FormDataContextType | undefined>(undefined);

export const FormdataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [data, setData] = useState<FormData>({
        brands: [],
        colors: [],
        countries: [],
        fuelTypes: [],
        gearboxTypes: [],
        cities: [],
        models: [],
    });

    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [loading, setLoading] = useState(true); // Initial loading
    const [loadingModels, setLoadingModels] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);

    // Load initial data
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/form-data');
                const initialData = await response.json();

                setData((prev) => ({
                    ...prev,
                    brands: initialData.brands || [],
                    colors: initialData.colors || [],
                    countries: initialData.countries || [],
                    fuelTypes: initialData.fuelTypes || [],
                    gearboxTypes: initialData.gearboxTypes || [],
                }));
            } catch (error) {
                console.error('Error loading initial data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    // Fetch models when brand changes
    useEffect(() => {
        if (!selectedBrand) {
            setData(prev => ({ ...prev, models: [] }));
            return;
        }

        const fetchModels = async () => {
            setLoadingModels(true);
            try {
                const response = await fetch(`/api/form-data?brand=${encodeURIComponent(selectedBrand)}`);
                const result = await response.json();
                setData((prev) => ({ ...prev, models: result.models || [] }));
            } catch (error) {
                console.error('Error fetching models:', error);
                setData((prev) => ({ ...prev, models: [] }));
            } finally {
                setLoadingModels(false);
            }
        };

        fetchModels();
    }, [selectedBrand]);

    // Fetch cities when country changes
    useEffect(() => {
        if (!selectedCountry) {
            setData(prev => ({ ...prev, cities: [] }));
            return;
        }

        const fetchCities = async () => {
            setLoadingCities(true);
            try {
                const response = await fetch(`/api/form-data?country=${encodeURIComponent(selectedCountry)}`);
                const result = await response.json();
                setData((prev) => ({ ...prev, cities: result.cities || [] }));
            } catch (error) {
                console.error('Error fetching cities:', error);
                setData((prev) => ({ ...prev, cities: [] }));
            } finally {
                setLoadingCities(false);
            }
        };

        fetchCities();
    }, [selectedCountry]);

    const value: FormDataContextType = {
        ...data,
        selectedCountry,
        selectedBrand,
        setSelectedCountry,
        setSelectedBrand,
        loading,
        loadingModels,
        loadingCities,
    };

    return <FormDataContext.Provider value={value}>{children}</FormDataContext.Provider>;
};

export const useFormData = () => {
    const context = useContext(FormDataContext);
    if (!context) {
        throw new Error('useFormData must be used within FormdataProvider');
    }
    return context;
};
