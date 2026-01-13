import { config } from '../config.js';

let activeInterval;
let previousVotes = {};
let previousSessionId = null;
let participatingVereadoresMap = new Map(); // Use a Map for easier lookup/update <id, vereadorData>

function formatName(fullName) {
    if (!fullName) return '';
    const names = fullName.trim().split(' ');
    if (names.length === 0) return ''; // Handle empty string case
    if (names.length <= 2) return names.join(' ');

    // Ensure names[0] and names[1] exist before trying to access them
    const firstName = names[0] || '';
    const secondName = names[1] || '';

    const initials = names.slice(2)
                          .map(n => n && n.length > 0 ? n[0].toUpperCase() + '.' : '')
                          .filter(initial => initial !== '') // Remove empty initials if any name part was empty
                          .join(' ');
    return `${firstName} ${secondName} ${initials}`.trim();
}


// Function to create or update a single vereador card in the grid
function createOrUpdateVereadorCard(grid, vereador, voteType) {
    const vereadorIdStr = String(vereador.id);
    let card = document.getElementById(`vereador-${vereadorIdStr}`);
    let voteClass = voteType ? `vote-${voteType}` : '';
    const formattedName = formatName(vereador.nome);

    if (card) {
        // Card exists, update its class if necessary
        const currentVoteClass = card.className.match(/vote-\w+/)?.[0];
        if (voteClass !== currentVoteClass) {
            // console.log(`AoVivo: Updating card class for vereador ${vereadorIdStr}, old: ${currentVoteClass}, new: ${voteClass}`);
            card.classList.remove('vote-favorable', 'vote-contrary', 'vote-abstention');
            if (voteClass) {
                card.classList.add(voteClass);
            }
        }
        // Ensure name/partido are up-to-date in case they change (though unlikely mid-session)
        const nameElement = card.querySelector('.nome');
        if (nameElement && nameElement.textContent !== formattedName) {
            nameElement.textContent = formattedName;
            nameElement.title = vereador.nome; // Update tooltip too
        }
        const partidoElement = card.querySelector('.partido');
        if (partidoElement && partidoElement.textContent !== (vereador.partido || 'S.Part.')) {
             partidoElement.textContent = vereador.partido || 'S.Part.';
        }
        const imgElement = card.querySelector('img');
        const expectedSrc = vereador.foto || 'img/avatar.jpg';
        if (imgElement && imgElement.src.endsWith(expectedSrc) === false && !imgElement.src.endsWith('img/avatar.jpg')) { // Avoid reloading if already default
            imgElement.src = expectedSrc;
        }


    } else {
        // Card doesn't exist, create and append it
        // console.log(`AoVivo: Creating card for vereador ${vereadorIdStr}, vote: ${voteType}`);
        card = document.createElement('div');
        card.className = `vereador-mini-card ${voteClass}`;
        card.id = `vereador-${vereadorIdStr}`;
        card.innerHTML = `
            <img src="${vereador.foto || 'img/avatar.jpg'}" alt="${vereador.nome}" onerror="this.onerror=null; this.src='img/avatar.jpg';">
            <p class="nome" title="${vereador.nome}">${formattedName}</p>
            <p class="partido">${vereador.partido || 'S.Part.'}</p>
        `;
        // Append to grid, but check if grid exists first
        if (grid) {
            grid.appendChild(card);
        } else {
            console.error("AoVivo: Grid element not found when trying to append card.");
        }
    }
}

// Function to synchronize the grid display with the current participants and votes
function syncVereadoresGrid(currentParticipants, votes) {
    // console.log('AoVivo: Synchronizing vereadores grid...');
    const grid = document.getElementById('vereadoresGrid');
    if (!grid) {
        console.error("AoVivo: Vereadores grid container not found!");
        return; // Exit if grid doesn't exist
    }

    const currentParticipantIds = new Set(currentParticipants.map(v => String(v.id)));
    const displayedVereadorIds = new Set();

    // 1. Remove cards for vereadores no longer participating
    const existingCards = grid.querySelectorAll('.vereador-mini-card');
    existingCards.forEach(card => {
        const cardId = card.id.split('-')[1];
        if (!currentParticipantIds.has(cardId)) {
            // console.log(`AoVivo: Removing card for non-participant vereador ${cardId}`);
            card.remove();
        } else {
            displayedVereadorIds.add(cardId);
        }
    });

    // 2. Update existing or add new cards for current participants
    const newParticipatingVereadoresMap = new Map();
    currentParticipants.forEach(vereador => {
        const vereadorIdStr = String(vereador.id);
        newParticipatingVereadoresMap.set(vereadorIdStr, vereador); // Update map
        const voteType = votes[vereadorIdStr];
        createOrUpdateVereadorCard(grid, vereador, voteType);
    });

    // Update the global map
    participatingVereadoresMap = newParticipatingVereadoresMap;

    // 3. Handle empty grid state / loading message
    const placeholder = grid.querySelector('.text-muted.col-12'); // Specific selector
    if (participatingVereadoresMap.size === 0) {
        if (!placeholder) { // Add message only if it doesn't exist
            grid.innerHTML = '<p class="text-muted col-12">Nenhum vereador habilitado para esta votação no momento.</p>';
        }
    } else {
        if (placeholder) { // Remove message if participants exist
             placeholder.remove();
        }
    }

    // console.log('AoVivo: Vereadores grid synchronized.');
    
    // Adjust cards to fit screen after synchronization
    setTimeout(() => adjustCardsToFitScreen(), 100);
}

// Function to calculate available height and adjust card sizes to fit all cards on screen
function adjustCardsToFitScreen() {
    const grid = document.getElementById('vereadoresGrid');
    if (!grid) return;
    
    const cards = grid.querySelectorAll('.vereador-mini-card');
    if (cards.length === 0) return;
    
    // Calculate available height by measuring actual used space
    const windowHeight = window.innerHeight;
    
    // Get all fixed elements that take space
    const navbar = document.getElementById('content0');
    const voteCountsRow = document.querySelector('.row.pe-3.ps-3.pb-2');
    const partialResults = document.getElementById('partialResults');
    const noActiveSession = document.getElementById('noActiveSession');
    
    let usedHeight = 0;
    
    // Measure navbar
    if (navbar) {
        const navbarRect = navbar.getBoundingClientRect();
        usedHeight += navbarRect.height;
    }
    
    // Measure partial results bar if visible
    if (partialResults && partialResults.style.display !== 'none') {
        usedHeight += partialResults.offsetHeight;
    }
    
    // Measure vote counts row
    if (voteCountsRow) {
        usedHeight += voteCountsRow.offsetHeight;
    }
    
    // Measure noActiveSession if visible
    if (noActiveSession && noActiveSession.style.display === 'block') {
        usedHeight += noActiveSession.offsetHeight;
    }
    
    // Reserve space for padding/margins and footer
    const reservedSpace = 50;
    const availableHeight = windowHeight - usedHeight - reservedSpace;
    
    // Get grid container
    const gridContainer = grid.closest('.card-body');
    const gridStyle = window.getComputedStyle(grid);
    const gridPadding = parseFloat(gridStyle.paddingTop) + parseFloat(gridStyle.paddingBottom);
    const availableGridHeight = availableHeight - gridPadding;
    
    if (availableGridHeight <= 0) {
        console.warn('AoVivo: Available height is too small, skipping adjustment');
        return;
    }
    
    // Calculate number of columns from grid computed style
    // Get the grid template columns value
    const gridTemplateColumns = gridStyle.gridTemplateColumns;
    let columns = 1;
    
    // Try to parse columns from CSS grid
    if (gridTemplateColumns && gridTemplateColumns !== 'none') {
        // Count the number of column definitions
        columns = gridTemplateColumns.split(' ').length;
    } else {
        // Fallback: calculate from first card width
        const firstCard = cards[0];
        if (firstCard) {
            const cardWidth = firstCard.offsetWidth;
            const gridWidth = grid.offsetWidth;
            const gridGap = parseFloat(gridStyle.gap) || 15;
            columns = Math.max(1, Math.floor((gridWidth + gridGap) / (cardWidth + gridGap)));
        }
    }
    
    // Calculate number of rows needed
    const totalCards = cards.length;
    const rows = Math.ceil(totalCards / columns);
    
    // Calculate maximum card height to fit all rows
    const rowGap = parseFloat(gridStyle.rowGap) || parseFloat(gridStyle.gap) || 15;
    const totalGapHeight = Math.max(0, (rows - 1) * rowGap);
    const maxCardHeight = (availableGridHeight - totalGapHeight) / rows;
    
    // Set minimum and maximum constraints for card height
    const minCardHeight = 70; // Minimum acceptable height
    const maxCardHeightLimit = 250; // Maximum card height (for very large screens)
    
    let targetCardHeight = Math.max(minCardHeight, Math.min(maxCardHeight, maxCardHeightLimit));
    
    // Apply the calculated height to all cards
    cards.forEach(card => {
        card.style.height = `${targetCardHeight}px`;
        card.style.minHeight = `${targetCardHeight}px`;
        card.style.maxHeight = `${targetCardHeight}px`;
    });
    
    // Adjust font sizes and image sizes proportionally based on card height
    const scaleFactor = targetCardHeight / 120; // Base height is 120px
    
    cards.forEach(card => {
        const img = card.querySelector('img');
        const nome = card.querySelector('.nome');
        const partido = card.querySelector('.partido');
        
        if (img) {
            const baseImgSize = 80;
            const imgSize = Math.max(45, Math.min(130, baseImgSize * scaleFactor));
            img.style.width = `${imgSize}px`;
            img.style.height = `${imgSize}px`;
            img.style.marginRight = `${Math.max(10, 15 * scaleFactor)}px`;
        }
        
        if (nome) {
            const baseFontSize = 18;
            const fontSize = Math.max(11, Math.min(26, baseFontSize * scaleFactor));
            nome.style.fontSize = `${fontSize}px`;
            nome.style.lineHeight = '1.2';
        }
        
        if (partido) {
            const baseFontSize = 14;
            const fontSize = Math.max(9, Math.min(20, baseFontSize * scaleFactor));
            partido.style.fontSize = `${fontSize}px`;
        }
        
        // Adjust padding proportionally
        const basePadding = 15;
        const padding = Math.max(8, Math.min(25, basePadding * scaleFactor));
        card.style.padding = `${padding}px`;
    });
    
    console.log(`AoVivo: Adjusted ${totalCards} cards (${columns} columns, ${rows} rows) to fit screen. Card Height: ${targetCardHeight.toFixed(1)}px, Available Height: ${availableGridHeight.toFixed(1)}px`);
}

// Function to update the partial results progress bar
function updatePartialResultsBar(favorable, contrary, abstention) {
    const totalVotes = favorable + contrary + abstention;
    const favorablePercent = totalVotes > 0 ? (favorable / totalVotes) * 100 : 0;
    const contraryPercent = totalVotes > 0 ? (contrary / totalVotes) * 100 : 0;
    const abstentionPercent = totalVotes > 0 ? (abstention / totalVotes) * 100 : 0;

    const favorableBar = document.getElementById('favorableBar');
    const contraryBar = document.getElementById('contraryBar');
    const abstentionBar = document.getElementById('abstentionBar');
    const partialResultsDiv = document.getElementById('partialResults');

    if (partialResultsDiv) {
        partialResultsDiv.style.display = totalVotes > 0 ? 'block' : 'none';
    }

    if (favorableBar) {
        favorableBar.style.width = `${favorablePercent}%`;
        //favorableBar.textContent = `${favorable} `; //Favoráveis
    }
    if (contraryBar) {
        contraryBar.style.width = `${contraryPercent}%`;
        //contraryBar.textContent = `${contrary} `; //Contrários
    }
    if (abstentionBar) {
        abstentionBar.style.width = `${abstentionPercent}%`;
        //abstentionBar.textContent = `${abstention} `; //Abstenções
    }
}

async function loadActiveSession() {
    // console.log('AoVivo: Loading active session data...');
    let sessionData = null;
    let allVereadores = [];
    let fetchError = null;

    try {
        // Fetch session data first
        const sessionResponse = await fetch(`${config.apiBaseUrl}/get_active_session.php`);
        if (!sessionResponse.ok) {
            throw new Error(`Failed to fetch session: ${sessionResponse.status}`);
        }
        sessionData = await sessionResponse.json();
        // console.log('AoVivo: Active session data received:', sessionData);

        // Check for redirect status from active session
        if (sessionData.active_session?.redirect_status === 'to_results') {
            // Get session ID for redirection
            const sessionId = sessionData.active_session.id;
            // Redirect to results page
            window.location.href = `votacao.html?id=${sessionId}`;
            return; // Stop further execution
        }
        
        // If no active session, check redirect status from finalized sessions
        if (!sessionData.active_session) {
            try {
                const redirectResponse = await fetch(`${config.apiBaseUrl}/get_redirect_status.php`);
                if (redirectResponse.ok) {
                    const redirectData = await redirectResponse.json();
                    if (redirectData.redirect_status === 'to_results' && redirectData.session_id) {
                        // Redirect to results page of finalized session
                        window.location.href = `votacao.html?id=${redirectData.session_id}`;
                        return; // Stop further execution
                    }
                }
            } catch (error) {
                console.error('Error checking redirect status:', error);
            }
        }

        // Fetch vereadores regardless of session status to handle transitions smoothly
        const vereadoresResponse = await fetch(`${config.apiBaseUrl}/list_vereadores.php`);
        if (!vereadoresResponse.ok) {
            console.error(`AoVivo: Failed to fetch vereadores: ${vereadoresResponse.status}`);
            fetchError = 'Erro ao buscar lista de vereadores.'; // Non-critical error for now
        } else {
             allVereadores = await vereadoresResponse.json();
            //  console.log('AoVivo: All vereadores fetched:', allVereadores.length);
        }

    } catch (error) {
        console.error('AoVivo: Error during fetch:', error);
        fetchError = `Erro crítico ao carregar dados: ${error.message}`;
        // Reset state if fetch failed critically
        sessionData = null;
        allVereadores = []; // Ensure vereadores list is empty on critical failure
    }

    // --- UI Update Logic ---

    const sessionInfoDiv = document.getElementById('sessionInfo');
    const noActiveSessionDiv = document.getElementById('noActiveSession');
    const grid = document.getElementById('vereadoresGrid');
    // const vereadoresCardDiv = grid ? grid.parentElement.parentElement : null; // The card containing the grid

    const currentSession = sessionData?.active_session;
    const currentSessionId = currentSession ? currentSession.id : null;
    const isActive = currentSession && currentSession.is_active == 1; // Explicit check for active

    // Update vote counts in the navbar regardless of session status (show 0 if inactive)
    const favCount = isActive ? (currentSession.favorable_votes || 0) : 0;
    const conCount = isActive ? (currentSession.contrary_votes || 0) : 0;
    const absCount = isActive ? (currentSession.abstention_votes || 0) : 0;

    document.getElementById('navFavorableCount').textContent = favCount;
    document.getElementById('navContraryCount').textContent = conCount;
    document.getElementById('navAbstentionCount').textContent = absCount;


    if (isActive) {
        // console.log(`AoVivo: Active session found: ${currentSessionId}`);
        const newVotes = currentSession.votes || {};

        // Filter current participants based on the LATEST vereadores fetch
        const currentParticipants = allVereadores.filter(v =>
            v.can_vote === true || v.can_vote === 1 || v.can_vote === "1"
        );
        // console.log('AoVivo: Filtered participating vereadores:', currentParticipants.length);

        // Update UI elements for active session
        if (sessionInfoDiv) sessionInfoDiv.style.display = 'block';
        if (noActiveSessionDiv) noActiveSessionDiv.style.display = 'none';
        // if (vereadoresCardDiv) vereadoresCardDiv.style.display = 'block'; // Card is always visible now

        document.getElementById('sessionDateTime').textContent = `Sessão: ${new Date(currentSession.session_datetime).toLocaleString()}`;
        document.getElementById('votingTitle').textContent = currentSession.title;
        document.getElementById('votingDescription').textContent = currentSession.description || '';
        const activeStatusBadge = document.getElementById('activeStatus');
        if (activeStatusBadge) activeStatusBadge.style.display = 'inline-block';

        // Update partial results bar
        updatePartialResultsBar(favCount, conCount, absCount);

        // Synchronize the grid with current participants and votes
        // Pass only participants who *can* vote for this session
        syncVereadoresGrid(currentParticipants, newVotes);

        // Store state for next comparison
        previousVotes = newVotes;
        previousSessionId = currentSessionId;

    } else {
        // Handle inactive session or fetch error
        // console.log('AoVivo: No active session or fetch error occurred.');
        if (sessionInfoDiv) sessionInfoDiv.style.display = 'none';
        // if (vereadoresCardDiv) vereadoresCardDiv.style.display = 'block'; // Card is always visible
        const activeStatusBadge = document.getElementById('activeStatus');
        if (activeStatusBadge) activeStatusBadge.style.display = 'none';
        if (noActiveSessionDiv) noActiveSessionDiv.style.display = 'block';

        // Determine message for inactive/error state
        let message = '';
        if (fetchError) {
            message = `<div class="alert alert-danger mb-0">${fetchError}</div>`;
        } else if (previousSessionId !== null) { // Was previously active
             message = '<div class="alert alert-info mb-0">Votação encerrada. Aguardando próxima sessão...</div>';
        } else { // Was never active or initial load
            message = '<div class="alert alert-info mb-0">Aguardando início da votação...</div>';
        }
        if (noActiveSessionDiv) noActiveSessionDiv.innerHTML = message;


        // Still show participants if available, but without vote highlights
        // Filter based on `can_vote` from the fetched list, even if session inactive
        const potentialParticipants = allVereadores.filter(v =>
             v.can_vote === true || v.can_vote === 1 || v.can_vote === "1"
        );
        // console.log('AoVivo: Displaying potential participants (inactive session):', potentialParticipants.length);
        syncVereadoresGrid(potentialParticipants, {}); // Pass empty votes object

        // Reset state tracking
        previousSessionId = null;
        previousVotes = {};
        // Keep participatingVereadoresMap as syncVereadoresGrid updates it based on potential participants
    }
}

// Resize handler with debounce
let resizeTimeout;
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        adjustCardsToFitScreen();
    }, 250);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('AoVivo: DOM fully loaded and parsed.');
    loadActiveSession(); // Initial load
    if (activeInterval) clearInterval(activeInterval);
    activeInterval = setInterval(loadActiveSession, config.refreshInterval);
    console.log(`AoVivo: Refresh interval set to ${config.refreshInterval}ms.`);
    
    // Add resize listener to adjust cards when window size changes
    window.addEventListener('resize', handleResize);
});

window.addEventListener('unload', () => {
    if (activeInterval) {
        clearInterval(activeInterval);
        console.log('AoVivo: Refresh interval cleared.');
    }
    window.removeEventListener('resize', handleResize);
});