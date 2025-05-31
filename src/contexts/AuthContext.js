import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

    // Configure axios defaults
    axios.defaults.baseURL = config.API_BASE_URL;
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Add response interceptor for token refresh
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // Если это запрос на обновление токена, не пытаемся обновить его снова
                if (originalRequest.url === '/token/refresh') {
                    return Promise.reject(error);
                }

                // Если ошибка 401 и мы еще не пытались обновить токен
                if (error.response?.status === 401 && !originalRequest._retry && token) {
                    originalRequest._retry = true;

                    try {
                        // Пытаемся обновить токен
                        const response = await axios.post('/token/refresh', {}, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        
                        const newToken = response.data.access_token;
                        localStorage.setItem('token', newToken);
                        setToken(newToken);
                        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                        
                        // Повторяем оригинальный запрос
                        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                        return axios(originalRequest);
                    } catch (refreshError) {
                        console.error('Token refresh failed:', refreshError);
                        // Очищаем недействительный токен
                        localStorage.removeItem('token');
                        setToken(null);
                        setUser(null);
                        setIsAuthenticated(false);
                        delete axios.defaults.headers.common['Authorization'];
                        
                        // Показываем ошибку только если пользователь был аутентифицирован
                        if (isAuthenticated) {
                            setError('Session expired. Please login again.');
                        }
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, [token, isAuthenticated]);

    // Проверяем аутентификацию при загрузке
    useEffect(() => {
        const checkAuth = async () => {
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const response = await axios.get('/users/me/');
                setUser(response.data);
                setIsAuthenticated(true);
                setError(null);
            } catch (error) {
                console.error('Auth check error:', error);
                if (error.response?.status === 401) {
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                    setIsAuthenticated(false);
                    delete axios.defaults.headers.common['Authorization'];
                }
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [token]);

    const register = async (email, password, username) => {
        try {
            setError(null);

            // Debug logging
            console.log('Registration attempt:');
            console.log('Email:', email);
            console.log('Username:', username);
            console.log('Password length:', password.length);

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Please enter a valid email address');
            }

            // Validate username
            if (username.length < 3 || username.length > 32) {
                throw new Error('Username must be between 3 and 32 characters long');
            }

            // Register user
            console.log('Sending registration request...');
            const response = await axios.post('/users/', {
                email,
                password,
                username
            });
            console.log('Registration response:', response.data);

            // Auto login after successful registration
            await login(email, password);
            return true;
        } catch (error) {
            console.error('Registration error:', error);
            const errorMessage = error.response?.data?.detail || error.message;
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const login = async (email, password) => {
        try {
            setError(null);

            // Debug logging
            console.log('Login attempt:');
            console.log('Email:', email);
            console.log('Password length:', password.length);

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Please enter a valid email address');
            }

            // Create form data
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            // Login user
            console.log('Sending login request...');
            const response = await axios.post('/token', formData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            });
            console.log('Login response:', response.data);

            // Store token
            const token = response.data.access_token;
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            // Get user data
            const userResponse = await axios.get('/users/me');
            console.log('User data:', userResponse.data);

            // Update auth state
            setUser(userResponse.data);
            setToken(token);
            setIsAuthenticated(true);

            return { success: true, user: userResponse.data };
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = error.response?.data?.detail || error.message;
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setError(null);
        setIsAuthenticated(false);
        delete axios.defaults.headers.common['Authorization'];
    };

    const value = {
        user,
        token,
        setToken,
        loading,
        error,
        isAuthenticated,
        login,
        logout,
        register,
        setError
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 