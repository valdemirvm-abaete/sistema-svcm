import { config } from '../config.js';

export function checkAuth() {
    const token = localStorage.getItem('authToken');
    const loadingContainer = document.getElementById('loading-container');
    
    if (!token && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
    if (token && window.location.pathname.includes('vereador.html')) {
        loadingContainer.style.display = 'none';
    }

    setTimeout(function() {
        if (!token && !window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
        if (token && window.location.pathname.includes('vereador.html')) {
            loadingContainer.style.display = 'none';
        }
    }
    , 2000);
}

export function checkAdminAuth() {
    const token = localStorage.getItem('authToken');
    const userLevel = localStorage.getItem('userLevel');
    const loadingContainer = document.getElementById('loading-container');
    const conteudoPrincipal = document.getElementById('content');

    if (!token || !userLevel || userLevel !== 'administrador') {
        window.location.href = 'login.html';
    }else{
        loadingContainer.style.display = 'none';
        conteudoPrincipal.classList.remove('conteudo-principal-escondido');
    }

    setTimeout(function() {
        if (!token || !userLevel || userLevel !== 'administrador') {
            window.location.href = 'login.html';
        }else{
            loadingContainer.style.display = 'none';
            conteudoPrincipal.classList.remove('conteudo-principal-escondido');
        }
    }
    , 2000);
}

export function login(password) {
    const formData = new FormData();
    formData.append('password', password);

    return fetch(`${config.apiBaseUrl}/login.php`, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.token && data.user) {
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userLevel', data.user.nivel);
                localStorage.setItem('userId', data.user.id);

                if (data.user.nivel === 'administrador') {
                    window.location.href = 'admin.html';
                } else if (data.user.nivel === 'vereador') {
                    window.location.href = 'vereador.html';
                } else {
                    console.warn('User level not recognized:', data.user.nivel);
                    window.location.href = 'login.html';
                }
            } else {
                const errorMessage = data.error || 'Login failed: Invalid response from server.';
                console.error('Login Error:', errorMessage, 'Data received:', data);
                throw new Error(errorMessage);
            }
        })
        .catch(error => {
            console.error('Login fetch/parse error:', error);
            throw new Error('Erro - Verifique sua Senha.');
        });
}

export function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userLevel');
    window.location.href = 'login.html';
}