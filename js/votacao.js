import { config } from '../config.js';

// Check for redirect status periodically
async function checkRedirectStatus() {
    try {
        const response = await fetch(`${config.apiBaseUrl}/get_redirect_status.php`);
        if (!response.ok) return;

        const data = await response.json();

        // If redirect status is 'to_live', go back to live page
        if (data.redirect_status === 'to_live') {
            window.location.href = 'aovivo.html';
        }
    } catch (error) {
        console.error('Error checking redirect status:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('id');

    if (!sessionId) {
        document.getElementById('loadingMessage').textContent = 'ID da votação não especificado.';
        return;
    }

    try {
        // Fetching session data no longer depends on active status, just the ID
        const session = await fetchSessionData(sessionId);
        displaySessionData(session);
    } catch (error) {
        console.error('Erro ao carregar dados da votação:', error);
        document.getElementById('loadingMessage').textContent = `Erro ao carregar dados da votação: ${error.message}`;
    }

    setInterval(checkRedirectStatus, config.refreshInterval);
});

async function fetchSessionData(sessionId) {
    const url = `${config.apiBaseUrl}/get_session_results.php?id=${sessionId}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Erro HTTP ${response.status}` }));
        throw new Error(errorData.error || `Erro ao buscar dados da sessão: ${response.status}`);
    }
    return await response.json();
}

function displaySessionData(session) {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('resultContainer').style.display = 'block';

    document.getElementById('sessionTitle').textContent = session.title;
    document.getElementById('sessionDateTime').textContent = `Data e Hora: ${new Date(session.session_datetime).toLocaleString()}`;
    
    // Tratamento da descrição por limite de palavras
    let descricao = session.description || 'Sem descrição.';
    const palavras = descricao.split(' '); // Transforma o texto em uma lista de palavras
    const limite = 50;

    if (palavras.length > limite) {
        descricao = palavras.slice(0, limite).join(' ') + '...';
    }

    document.getElementById('sessionDescription').textContent = descricao;

    const favVotes = parseInt(session.favorable_votes || 0);
    const conVotes = parseInt(session.contrary_votes || 0);
    const absVotes = parseInt(session.abstention_votes || 0);

    document.getElementById('favorableVotes').textContent = favVotes;
    document.getElementById('contraryVotes').textContent = conVotes;
    document.getElementById('abstentionVotes').textContent = absVotes;

    // Calculate total votes and percentages
    const favorable = parseInt(session.favorable_votes) || 0;
    const contrary = parseInt(session.contrary_votes) || 0;
    const abstention = parseInt(session.abstention_votes) || 0;
    const totalVotes = favorable + contrary + abstention;

    const favorablePercentage = totalVotes > 0 ? (favorable / totalVotes) * 100 : 0;
    const contraryPercentage = totalVotes > 0 ? (contrary / totalVotes) * 100 : 0;
    const abstentionPercentage = totalVotes > 0 ? (abstention / totalVotes) * 100 : 0;

    // Generate Pie Chart
    generatePieChart(favorablePercentage, contraryPercentage, abstentionPercentage);

    const participantsContainer = document.getElementById('participantsContainer');
    participantsContainer.innerHTML = ''; // Clear existing content

    if (session.participants && session.participants.length > 0) {
        session.participants.forEach(participant => {
            const participantDiv = document.createElement('div');
            participantDiv.classList.add('participant-item');

            const img = document.createElement('img');
            img.src = participant.foto || 'img/avatar.jpg';
            img.alt = participant.nome;
            img.classList.add('participant-photo');
            img.onerror = function () { this.src = 'img/avatar.jpg'; };

            const detailsDiv = document.createElement('div'); // Container for icon and name
            detailsDiv.classList.add('participant-details');

            const voteIcon = document.createElement('i');
            voteIcon.classList.add('vote-icon', 'bi'); // Base classes

            let voteIconClass = '';
            let voteIconColorClass = '';

            switch (participant.vote_type) {
                case 'favorable':
                    voteIconClass = 'bi-check-lg';
                    voteIconColorClass = 'favorable';
                    break;
                case 'contrary':
                    voteIconClass = 'bi-x-lg';
                    voteIconColorClass = 'contrary';
                    break;
                case 'abstention':
                    voteIconClass = 'bi-dash-lg';
                    voteIconColorClass = 'abstention';
                    break;
                default:
                    // Optionally handle cases where vote_type might be null or unexpected
                    // For now, we won't add an icon if vote_type is missing
                    break;
            }

            if (voteIconClass) {
                voteIcon.classList.add(voteIconClass, voteIconColorClass);
                detailsDiv.appendChild(voteIcon); // Add icon only if vote exists
            }

            const nameSpan = document.createElement('span');
            nameSpan.textContent = participant.nome + ' - ' + participant.partido;
            nameSpan.classList.add('participant-name');

            detailsDiv.appendChild(nameSpan); // Add name after icon

            participantDiv.appendChild(img);
            participantDiv.appendChild(detailsDiv);
            participantsContainer.appendChild(participantDiv);
        });
    } else {
        participantsContainer.innerHTML = '<p class="text-muted">Nenhum voto registrado para esta sessão.</p>';
    }

}

// Simple SVG Pie Chart Generator
function generatePieChart(favorable, contrary, abstention) {
    const svg = document.querySelector('.pie-chart');
    const percentageDiv = document.querySelector('.pie-percentage');
    svg.innerHTML = ''; // Clear previous chart

    const radius = 70;
    const center = 75;
    const total = favorable + contrary + abstention;

    let startAngle = 0;

    if (total === 0) {
        percentageDiv.textContent = 'Sem votos';
        return;
    }

    const segments = [
        { percentage: favorable, color: 'var(--success-color)' },
        { percentage: contrary, color: 'var(--danger-color)' },
        { percentage: abstention, color: 'var(--warning-color)' }
    ];

    segments.forEach(segment => {
        const angle = (segment.percentage / 100) * 360;
        const endAngle = startAngle + angle;

        // Calculate path
        const x1 = center + radius * Math.cos(Math.PI * startAngle / 180);
        const y1 = center + radius * Math.sin(Math.PI * startAngle / 180);
        const x2 = center + radius * Math.cos(Math.PI * endAngle / 180);
        const y2 = center + radius * Math.sin(Math.PI * endAngle / 180);

        const largeArcFlag = angle > 180 ? 1 : 0;

        const pathData = [
            `M ${center} ${center}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', segment.color);
        path.setAttribute('class', 'pie-segment');
        svg.appendChild(path);

        startAngle = endAngle;
    });

    // Display total percentage
    const totalPercentage = Math.round(total);
    percentageDiv.textContent = ''; //`${totalPercentage}%`
}