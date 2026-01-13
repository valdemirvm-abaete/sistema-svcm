import { config } from './config.js';
import { checkAuth } from './js/auth.js';

let activeSession = null;
let currentUserStatus = null; // Store user status including can_vote
let updateInterval;

async function getUserStatus() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.warn('No auth token found for getUserStatus');
        setTimeout(() => {
            window.location.reload();
            console.log('Reloading page due to error loading sessions');
        }
        , 100); 
        return null; // Not logged in or token expired
    }
    try {
        const response = await fetch(`${config.apiBaseUrl}/get_user_status.php`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
             if (response.status === 401) { // Handle unauthorized specifically
                 console.warn('User unauthorized, logging out.');
                 logout(); // Use the existing logout function
                 return null;
             }
             throw new Error(`Failed to fetch user status: ${response.status}`);
        }
        const status = await response.json();
        console.log('User status fetched:', status);

        // Inserção da mensagem de boas-vindas com as três primeiras palavras do nome (ignorando preposições na contagem, mas incluindo no resultado)
        const nomeVereador = status?.nome; // Assuming the response has a 'nome' property
        const vereadorPode = status?.can_vote; // Assuming the response has a 'nome' property
        if (nomeVereador) {
            const palavrasNome = nomeVereador.split(' '); // Divide o nome em palavras
            const preposicoes = ['de', 'da', 'do', 'das', 'dos', 'a', 'e', 'o', 'as', 'os', 'em', 'na', 'no', 'nas', 'nos', 'para', 'com', 'sem', 'sob', 'ante', 'perante']; // Lista de preposições a serem ignoradas

            let palavrasSignificativas = 0;
            let palavrasExibidas = [];

            for (let palavra of palavrasNome) {
                palavrasExibidas.push(palavra);
                if (!preposicoes.includes(palavra.toLowerCase())) {
                    palavrasSignificativas++;
                }
                if (palavrasSignificativas >= 3) {
                    break;
                }
            }

            let primeirasPalavras = palavrasExibidas.join(' ');

            // Verifica se a última palavra é uma preposição e ajusta se necessário
            const palavras = primeirasPalavras.split(' ');
            if (preposicoes.includes(palavras[palavras.length - 1].toLowerCase()) && palavrasNome.length > palavrasExibidas.length) {
                palavrasExibidas.push(palavrasNome[palavrasExibidas.length]); // Adiciona a próxima palavra
                primeirasPalavras = palavrasExibidas.join(' ');
                // Remove a ultima palavra caso seja uma preposição.
                const palavras4 = primeirasPalavras.split(' ');
                if (preposicoes.includes(palavras4[palavras4.length - 1].toLowerCase())) {
                    palavras4.pop();
                    primeirasPalavras = palavras4.join(" ");
                }
            }

            const vereadNomeSpan = document.getElementById('veread_nome');
            if (vereadNomeSpan) {
                if(!vereadorPode){
                    vereadNomeSpan.textContent = `${primeirasPalavras} - Não Habilitado`;
                }else{
                    vereadNomeSpan.textContent = `${primeirasPalavras}`;
                }
               
            }
        }

        return status;

    } catch (error) {
        console.error('Error fetching user status:', error);
        // Optional: Handle specific errors, e.g., redirect to login on 401
        setTimeout(() => {
            window.location.reload();
            console.log('Reloading page due to error loading sessions');
        }
        , 100);
        return null; // Indicate error or unknown status
    }
}


async function loadActiveSession() {
    console.log('Loading active session and user status...');
    let sessionData = null;
    let userStatus = null;
    let errorOccurred = false;

    try {
        // Fetch session and user status concurrently
        [sessionData, userStatus] = await Promise.all([
            fetch(`${config.apiBaseUrl}/get_active_session.php`).then(res => {
                if (!res.ok) throw new Error(`Session fetch failed: ${res.status}`);
                return res.json();
            }),
            getUserStatus() // Fetches current user's status including can_vote
        ]);

        console.log('Session data:', sessionData);
        currentUserStatus = userStatus; // Update global user status

    } catch (error) {
        console.error('Error loading session or user status:', error);
        errorOccurred = true;
        // Decide how to handle partial failures if needed
    }

    const sessionInfoCard = document.querySelector('.card:not(.mt-3)'); // Target the first card
    const buttons = document.querySelectorAll('.btn-lg');
    const userId = localStorage.getItem('userId'); // Used for highlighting vote

    if (!errorOccurred && sessionData?.active_session) {
        activeSession = sessionData.active_session;
        const userCanVote = currentUserStatus?.can_vote === true || currentUserStatus?.can_vote === 1 || currentUserStatus?.can_vote === "1";
        const isSessionActive = activeSession.is_active == 1;

        console.log(`Session Active: ${isSessionActive}, User Can Vote: ${userCanVote}`);

        // Update session info display
        sessionInfoCard.style.display = 'block';
        document.querySelector('.card-title').textContent = 'Resultado Parcial:';
        document.querySelector('.sessao_date').textContent =
            `Sessão - ${new Date(activeSession.session_datetime).toLocaleString()}`;
        sessionInfoCard.querySelector('.fw-bold').textContent = activeSession.title;
        sessionInfoCard.querySelector('p:not(.fw-bold)').textContent =
            activeSession.description || 'Sem descrição.';

        // Enable/disable voting buttons based on session status AND user's can_vote status
        const userVote = userId ? activeSession.votes[userId] : null;

        buttons.forEach(btn => {
             // Enable ONLY if session is active AND user is allowed to vote
            btn.disabled = !(isSessionActive && userCanVote);
            btn.classList.remove('active');

            // Highlight the button corresponding to the user's vote, if any
            if (userVote) {
                if ((btn.classList.contains('btn-success') && userVote === 'favorable') ||
                    (btn.classList.contains('btn-danger') && userVote === 'contrary') ||
                    (btn.classList.contains('btn-warning') && userVote === 'abstention')) {
                    btn.classList.add('active');
                }
            }
        });

        // Update progress bars (results are public, unaffected by user status)
        updateVoteCounts(activeSession);

    } else {
        // Handle inactive session or errors
        activeSession = null;
        sessionInfoCard.style.display = 'none'; // Hide session details
        buttons.forEach(btn => {
            btn.disabled = true; // Disable buttons if no active session or error
            btn.classList.remove('active');
        });

        // Display appropriate message (could be more specific based on error type)
        if (errorOccurred) {
             alert('Erro ao carregar dados da sessão ou status do usuário.');
        } else {
             // Find a place to show this message if the card is hidden
             console.log('Nenhuma votação ativa no momento ou usuário não habilitado.');
             // Maybe show a message in the results card?
             // document.querySelector('.card.mt-3 .card-body').insertAdjacentHTML('afterbegin', '<p id="status-message" class="text-info">Nenhuma votação ativa no momento.</p>');
        }
         // Reset progress bars if needed, though get_active_session might return old counts if polled after session ends
         updateVoteCounts({ favorable_votes: 0, contrary_votes: 0, abstention_votes: 0 });
    }
}


function updateVoteCounts(session) {
    const fav = parseInt(session.favorable_votes || 0);
    const con = parseInt(session.contrary_votes || 0);
    const abs = parseInt(session.abstention_votes || 0);
    const total = fav + con + abs;

    const favBar = document.querySelector('.progress-bar.bg-success');
    const conBar = document.querySelector('.progress-bar.bg-danger');
    const absBar = document.querySelector('.progress-bar.bg-warning');

    if (total > 0) {
        const favorableWidth = (fav / total) * 100;
        const contraryWidth = (con / total) * 100;
        const abstentionWidth = (abs / total) * 100;

        favBar.style.width = `${favorableWidth}%`;
        conBar.style.width = `${contraryWidth}%`;
        absBar.style.width = `${abstentionWidth}%`;

        favBar.textContent = `${fav} Favoráveis`;
        conBar.textContent = `${con} Contrários`;
        absBar.textContent = `${abs} Abstenções`;
    } else {
        // Reset bars if total is 0
        favBar.style.width = `0%`;
        conBar.style.width = `0%`;
        absBar.style.width = `0%`;
        favBar.textContent = `0 Favoráveis`;
        conBar.textContent = `0 Contrários`;
        absBar.textContent = `0 Abstenções`;
    }
}

async function submitVote(voteType) {
    // Re-check conditions just before submitting
    const userCanVote = currentUserStatus?.can_vote === true || currentUserStatus?.can_vote === 1 || currentUserStatus?.can_vote === "1";
    const isSessionActive = activeSession && activeSession.is_active == 1;

    if (!isSessionActive) {
        alert('Nenhuma votação ativa no momento.');
        return;
    }
    if (!userCanVote) {
         alert('Você não está habilitado para votar nesta sessão.');
         return;
     }

    console.log(`Submitting vote: ${voteType}`);
    const buttons = document.querySelectorAll('.btn-lg');
    buttons.forEach(btn => btn.disabled = true); // Disable buttons during submission

    try {
        const formData = new FormData();
        formData.append('vote', voteType);

        const response = await fetch(`${config.apiBaseUrl}/vote.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Falha ao registrar voto. Resposta inválida.' }));
            throw new Error(errorData.error || 'Falha ao registrar voto');
        }

        // Vote submitted successfully, reload data immediately to reflect changes
        await loadActiveSession();
        console.log('Vote submitted, session reloaded.');

    } catch (error) {
        console.error('Error submitting vote:', error);
        alert(`Erro ao registrar voto: ${error.message}`);
        // Re-enable buttons after error, potentially based on reloaded state
         buttons.forEach(btn => {
            // Re-enable ONLY if session is still active AND user can still vote
             const stillCanVote = currentUserStatus?.can_vote === true || currentUserStatus?.can_vote === 1 || currentUserStatus?.can_vote === "1";
             const sessionStillActive = activeSession && activeSession.is_active == 1;
             btn.disabled = !(sessionStillActive && stillCanVote);
         });
    }
}

// Add event listeners to vote buttons
document.addEventListener('DOMContentLoaded', () => {
    checkAuth(); // Ensures user is logged in, redirects if not

    document.querySelectorAll('.btn-lg').forEach(button => {
        button.addEventListener('click', () => {
            // Determine vote type from button class
            let voteType;
            if (button.classList.contains('btn-success')) voteType = 'favorable';
            else if (button.classList.contains('btn-danger')) voteType = 'contrary';
            else if (button.classList.contains('btn-warning')) voteType = 'abstention'; // Corrected class check

            if (voteType) {
                submitVote(voteType);
            } else {
                console.error('Could not determine vote type from button:', button);
            }
        });
    });

    // Initial load and start polling
    loadActiveSession();
    if (updateInterval) clearInterval(updateInterval); // Clear any existing interval
    updateInterval = setInterval(loadActiveSession, config.refreshInterval);
    console.log(`Update interval set to ${config.refreshInterval}ms`);
});

// Cleanup on page unload
window.addEventListener('unload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
        console.log('Update interval cleared on page unload.');
    }
});