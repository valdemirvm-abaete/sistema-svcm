import { config } from '../config.js';

let selectedVereadores = new Set();
let activeSessions = [];
let allVereadores = []; // Store all vereadores data for editing

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Starting initialization');
    await Promise.all([
        loadVereadores(),
        loadSessions(),
        loadParticipants()
    ]);
    console.log('Initialization completed');

    // Attach listener for edit modal save button
    const saveChangesBtn = document.getElementById('saveVereadorChangesBtn');
    if (saveChangesBtn) {
        saveChangesBtn.addEventListener('click', saveVereadorChanges);
    } else {
        console.error("Save changes button not found for edit modal.");
    }

    // Attach listener for file input change to show preview
    const editFotoInput = document.getElementById('editFoto');
    const editFotoPreview = document.getElementById('editFotoPreview');
    if (editFotoInput && editFotoPreview) {
        editFotoInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    editFotoPreview.src = e.target.result;
                }
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    // New session modal datetime setup
    const newSessionModalElement = document.getElementById('newSessionModal');
    if (newSessionModalElement) {
        new bootstrap.Modal(newSessionModalElement); // Initialize new session modal
        newSessionModalElement.addEventListener('show.bs.modal', function (event) {
            const now = new Date();
            const timezoneOffset = now.getTimezoneOffset() * 60000; // offset in milliseconds
            const localISOTime = (new Date(now - timezoneOffset)).toISOString().slice(0, 16);
            const dateTimeInput = newSessionModalElement.querySelector('input[name="session_datetime"]');
            if (dateTimeInput) {
                dateTimeInput.value = localISOTime;
            }
        });
    }

    // Initialize Edit Vereador Modal
    const editVereadorModalElement = document.getElementById('editVereadorModal');
    if (editVereadorModalElement) {
        new bootstrap.Modal(editVereadorModalElement);
    }

    // Attach other event listeners previously in the head script tag module
    document.getElementById('saveSessionBtn').addEventListener('click', async () => {
        console.log('Save session button clicked');
        const form = document.getElementById('newSessionForm');
        const formData = new FormData(form);

        try {
            const response = await fetch(`${config.apiBaseUrl}/create_session.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });

            const data = await response.json();
            console.log('Create session response:', data);

            if (!response.ok) throw new Error(data.error || 'Falha ao criar sessão');

            const modalElement = document.getElementById('newSessionModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
            form.reset();

            await loadSessions();
            showSuccess('sessionsError', 'Sessão criada com sucesso'); // Use existing success display

        } catch (error) {
            console.error('Error creating session:', error);
            showError('newSessionError', error.message);
            setTimeout(() => {
                window.location.reload();
                console.log('Reloading page due to error loading sessions');
            }
            , 100);
        }
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Register form submitted');

        const formData = new FormData();
        const nome = document.getElementById('nome').value;
        const partido = document.getElementById('partido').value;
        const senha = document.getElementById('senha').value;
        const fotoInput = document.getElementById('foto');

        if (!partido) {
            showError('registerError', 'Por favor, selecione um partido.');
            return;
        }

        formData.append('nome', nome);
        formData.append('partido', partido);
        formData.append('senha', senha);

        if (fotoInput.files.length > 0) {
            formData.append('foto', fotoInput.files[0]);
        }

        try {
            const response = await fetch(`${config.apiBaseUrl}/register_vereador.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    throw new Error(data.error || 'Erro ao cadastrar vereador');
                } else {
                    const textError = await response.text();
                    console.error("Server response (non-JSON):", textError);
                    throw new Error('Erro ao cadastrar vereador: Resposta inesperada do servidor.');
                }
            }

            const data = await response.json();
            console.log('Register response:', data);

            showSuccess('registerSuccess', 'Vereador cadastrado com sucesso');
            document.getElementById('registerForm').reset();
            document.getElementById('partido').selectedIndex = 0;
            await loadVereadores();

        } catch (error) {
            console.error('Error registering vereador:', error);
            showError('registerError', error.message);
            setTimeout(() => {
                window.location.reload();
                console.log('Reloading page due to error loading sessions');
            }
            , 100);
        }
    });

    document.getElementById('selectAllBtn').addEventListener('click', async () => {
        console.log('Select all button clicked');
        try {
            const response = await fetch(`${config.apiBaseUrl}/list_vereadores.php`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) throw new Error('Falha ao carregar vereadores');

            const vereadores = await response.json();

            const currentGridVereadores = allVereadores; // Use the globally stored list

            if (selectedVereadores.size === currentGridVereadores.length) {
                selectedVereadores.clear(); // Deselect all
            } else {
                selectedVereadores.clear(); // Clear first, then select all
                currentGridVereadores.forEach(v => selectedVereadores.add(v.id.toString()));
            }

            updateVereadoresGrid(currentGridVereadores); // Use the existing update function
            console.log('Selection updated:', selectedVereadores.size, 'vereadores selected');

        } catch (error) {
            console.error('Error in select all:', error);
            showError('participantsError', error.message);
            setTimeout(() => {
                window.location.reload();
                console.log('Reloading page due to error loading sessions');
            }
            , 100);
        }
    });

    document.getElementById('saveParticipantsBtn').addEventListener('click', async () => {
        console.log('Saving participants...');
        try {
            const formData = new FormData();
            Array.from(selectedVereadores).forEach(id => {
                formData.append('participants[]', id);
            });

            const response = await fetch(`${config.apiBaseUrl}/update_participants.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });

            const data = await response.json();
            console.log('Update participants response:', data);

            if (!response.ok) throw new Error(data.error || 'Falha ao atualizar participantes');

            showSuccess('participantsSuccess', 'Participantes atualizados com sucesso');

        } catch (error) {
            console.error('Error saving participants:', error);
            showError('participantsError', error.message);
        }
    });
});

// Session management
async function loadSessions() {
    console.log('Loading sessions...');
    try {
        const response = await fetch(`${config.apiBaseUrl}/list_sessions.php`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        console.log('Sessions response status:', response.status);

        if (!response.ok) throw new Error('Falha ao carregar sessões');

        const sessions = await response.json();
        console.log('Sessions data:', sessions);
        activeSessions = sessions;

        const tbody = document.getElementById('sessionsList');
        tbody.innerHTML = sessions.map(session => {
            const isActive = session.is_active == 1 || session.is_active === true;
            const isFinalized = session.is_finalized == 1 || session.is_finalized === true;
            
            // Determine status badge
            let statusBadgeClass, statusBadgeText;
            if (isActive) {
                statusBadgeClass = 'bg-success';
                statusBadgeText = 'ATIVA';
            } else if (isFinalized) {
                statusBadgeClass = 'bg-danger';
                statusBadgeText = 'FINALIZADA';
            } else {
                statusBadgeClass = 'bg-secondary';
                statusBadgeText = 'INATIVA';
            }
            
            // Determine buttons based on status
            let actionButtons = '';
            
            if (isActive) {
                // Active session: show Finalizar button and toggle redirect button
                actionButtons = `
                    <button class="btn btn-sm btn-warning"
                            onclick="finalizeSession(${session.id})"
                            title="Finalizar votação">
                        <i class="bi bi-stop-fill"></i> Finalizar
                    </button>
                    <button class="btn btn-sm btn-info" 
                            onclick="toggleRedirect(${session.id}, '${session.redirect_status === 'to_results' ? 'to_live' : 'to_results'}')"
                            title="Redirecionar usuários">
                        <i class="bi ${session.redirect_status === 'to_results' ? 'bi-arrow-return-left' : 'bi-box-arrow-right'}"></i>
                        ${session.redirect_status === 'to_results' ? 'Voltar ao Vivo' : 'Ver Resultado'}
                    </button>
                `;
            } else if (isFinalized) {
                // Finalized session: show Ver Resultado/Voltar ao Vivo toggle button (same as active sessions)
                actionButtons = `
                    <button class="btn btn-sm btn-info" 
                            onclick="toggleRedirect(${session.id}, '${session.redirect_status === 'to_results' ? 'to_live' : 'to_results'}')"
                            title="Redirecionar usuários">
                        <i class="bi ${session.redirect_status === 'to_results' ? 'bi-arrow-return-left' : 'bi-box-arrow-right'}"></i>
                        ${session.redirect_status === 'to_results' ? 'Voltar ao Vivo' : 'Ver Resultado'}
                    </button>
                `;
            } else {
                // Inactive but not finalized: show Iniciar button
                actionButtons = `
                    <button class="btn btn-sm btn-success"
                            onclick="startSession(${session.id})"
                            title="Iniciar votação">
                        <i class="bi bi-play-fill"></i> Iniciar
                    </button>
                `;
            }
            
            return `
            <tr>
                <td>${new Date(session.session_datetime).toLocaleString()}</td>
                <td>${session.title}</td>
                <td>
                    <span class="badge ${statusBadgeClass} status-badge">
                        ${statusBadgeText}
                    </span>
                </td>
                <td> 
                            <div class="vote-count-cell">
                            <span id="fav-${session.id}" class="vote-count-badge bg-success" title="Favoráveis">${session.favorable_votes || 0}</span>
                            <span id="con-${session.id}" class="vote-count-badge bg-danger" title="Contrários">${session.contrary_votes || 0}</span>
                            <span id="abs-${session.id}" class="vote-count-badge bg-warning" title="Abstenções">${session.abstention_votes || 0}</span>
                        </div>
                </td>
                <td class="session-actions">
                    ${actionButtons}
                    <button class="btn btn-sm btn-secondary" 
                            onclick="resetSessionVotes(${session.id})"
                            title="Zerar votos">
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSession(${session.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        }).join('');
        console.log('Sessions list populated');

        // Ensure admin real-time stream is running (start once)
        if (!window._adminStreamStarted) {
            setupAdminStream();
            window._adminStreamStarted = true;
        }

    } catch (error) {
        console.error('Error loading sessions:', error);
        showError('sessionsError', 'Erro ao carregar sessões');
    }
}

window.startSession = async (id) => {
    console.log('Starting session:', id);
    try {
        const formData = new FormData();
        formData.append('id', id);

        const response = await fetch(`${config.apiBaseUrl}/start_session.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Falha ao iniciar a votação');

        await loadSessions();
        showSuccess('sessionsError', data.message || 'Votação iniciada com sucesso');
        console.log('Session started successfully');
    } catch (error) {
        console.error('Error starting session:', error);
        showError('sessionsError', error.message);
        setTimeout(() => {
            window.location.reload();
            console.log('Reloading page due to error loading sessions');
        }
        , 100);
    }
};

window.finalizeSession = async (id) => {
    console.log('Finalizing session:', id);
    if (!confirm('Tem certeza que deseja finalizar esta votação? Uma vez finalizada, ela não poderá ser reativada exceto após zerar os votos.')) return;

    try {
        const formData = new FormData();
        formData.append('id', id);

        const response = await fetch(`${config.apiBaseUrl}/finalize_session.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Falha ao finalizar a votação');

        await loadSessions();
        showSuccess('sessionsError', data.message || 'Votação finalizada com sucesso');
        console.log('Session finalized successfully');
    } catch (error) {
        console.error('Error finalizing session:', error);
        showError('sessionsError', error.message);
        setTimeout(() => {
            window.location.reload();
            console.log('Reloading page due to error loading sessions');
        }
        , 100);
    }
};

window.deleteSession = async (id) => {
    console.log('Deleting session:', id);
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return;

    try {
        const response = await fetch(`${config.apiBaseUrl}/delete_session.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: id })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao excluir sessão');
        }

        await loadSessions();
        console.log('Session deleted successfully');
    } catch (error) {
        console.error('Error deleting session:', error);
        showError('sessionsError', error.message);
        setTimeout(() => {
            window.location.reload();
            console.log('Reloading page due to error loading sessions');
        }
        , 100);
    }
};

window.toggleRedirect = async (id, redirectStatus) => {
    console.log('Toggling redirect:', id, redirectStatus);
    try {
        const formData = new FormData();
        formData.append('id', id);
        formData.append('redirect_status', redirectStatus);

        const response = await fetch(`${config.apiBaseUrl}/toggle_redirect.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });

        if (!response.ok) throw new Error('Falha ao alterar redirecionamento');

        await loadSessions();
        console.log('Redirect toggled successfully');
    } catch (error) {
        console.error('Error toggling redirect:', error);
        showError('sessionsError', error.message);
        setTimeout(() => {
            window.location.reload();
            console.log('Reloading page due to error loading sessions');
        }
        , 100);
    }
};


window.resetSessionVotes = async (id) => {
    console.log('Resetting votes for session:', id);
    if (!confirm('Tem certeza que deseja zerar todos os votos desta sessão?')) return;

    try {
        const formData = new FormData();
        formData.append('id', id);

        const response = await fetch(`${config.apiBaseUrl}/reset_session_votes.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao zerar votos');
        }

        const data = await response.json();
        console.log('Reset response:', data);

        await loadSessions(); // Reload sessions to update the display
        showSuccess('sessionsError', 'Votos zerados com sucesso');

    } catch (error) {
        console.error('Error resetting votes:', error);
        showError('sessionsError', error.message);
        setTimeout(() => {
            window.location.reload();
            console.log('Reloading page due to error loading sessions');
        }
        , 100);
    }
};

// Vereadores management
async function loadVereadores() {
    console.log('Loading vereadores...');
    try {
        const response = await fetch(`${config.apiBaseUrl}/list_vereadores.php`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) throw new Error('Falha ao carregar vereadores');

        const vereadores = await response.json();
        allVereadores = vereadores; // Store for later use (editing)
        console.log('Vereadores loaded:', vereadores.length);

        const tbody = document.getElementById('vereadorList');
        tbody.innerHTML = vereadores.map(vereador => `
            <tr>
                <td><img src="${vereador.foto || 'img/avatar.jpg'}" width="40" height="40" class="rounded-circle" onerror="this.onerror=null; this.src='img/avatar.jpg';"></td>
                <td>${vereador.nome}</td>
                <td>${vereador.partido}</td>
                <td>
                    <div class="vereador-actions">
                        <button class="btn btn-sm btn-warning" onclick="editVereador(${vereador.id})" title="Editar">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteVereador(${vereador.id})" title="Excluir">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        updateVereadoresGrid(vereadores);
        console.log('Vereadores lists updated');

    } catch (error) {
        console.error('Error loading vereadores:', error);
        showError('vereadoresError', 'Erro ao carregar vereadores');
        setTimeout(() => {
            window.location.reload();
            console.log('Reloading page due to error loading sessions');
        }
        , 100);
    }
}

function updateVereadoresGrid(vereadores) {
    console.log('Updating vereadores grid');
    const grid = document.getElementById('vereadoresSelectGrid');
    if (!grid || !vereadores) return;

    grid.innerHTML = vereadores.map(vereador => `
        <div class="col">
            <div class="card vereador-select-card ${selectedVereadores.has(vereador.id.toString()) ? 'selected' : ''}"
                 onclick="toggleVereador(${vereador.id})">
                <div class="card-body text-center p-2">
                    <img src="${vereador.foto || 'img/avatar.jpg'}" class="rounded-circle mb-1" width="50" height="50" onerror="this.onerror=null; this.src='img/avatar.jpg';">
                    <h6 class="card-title mb-0" style="font-size: 0.8rem;">${vereador.nome}</h6>
                    <small class="text-muted">${vereador.partido}</small>
                </div>
            </div>
        </div>
    `).join('');
    console.log('Grid updated with', vereadores.length, 'vereadores');
}

window.editVereador = (id) => {
    console.log('Editing vereador:', id);
    const vereador = allVereadores.find(v => v.id === id);
    if (!vereador) {
        console.error('Vereador not found for editing:', id);
        showError('vereadoresError', 'Erro: Vereador não encontrado para edição.');
        return;
    }

    const modalElement = document.getElementById('editVereadorModal');
    const modal = bootstrap.Modal.getInstance(modalElement);

    document.getElementById('editVereadorId').value = vereador.id;
    document.getElementById('editNome').value = vereador.nome;
    document.getElementById('editPartido').value = vereador.partido;
    document.getElementById('editFotoPreview').src = vereador.foto || 'img/avatar.jpg';
    document.getElementById('editFoto').value = '';
    modal.show();
};

async function saveVereadorChanges() {
    console.log('Saving vereador changes...');
    const modalElement = document.getElementById('editVereadorModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    const saveButton = document.getElementById('saveVereadorChangesBtn');

    const vereadorId = document.getElementById('editVereadorId').value;
    const nome = document.getElementById('editNome').value;
    const partido = document.getElementById('editPartido').value;
    const fotoInput = document.getElementById('editFoto');
    const senhaInput = document.getElementById('editSenha');
    const novaSenha = senhaInput.value.trim();

    if (!nome || !partido) {
        showError('editError', 'Nome e Partido são obrigatórios.');
        return;
    }

    if (novaSenha && !/^[0-9]{6}$/.test(novaSenha)) {
        showError('editError', 'A nova senha deve ter exatamente 6 dígitos numéricos.');
        senhaInput.focus();
        return;
    }

    const formData = new FormData();
    formData.append('id', vereadorId);
    formData.append('nome', nome);
    formData.append('partido', partido);

    if (novaSenha) {
        formData.append('senha', novaSenha);
    }

    if (fotoInput.files.length > 0) {
        formData.append('foto', fotoInput.files[0]);
    }

    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
    hideError('editError');

    try {
        const response = await fetch(`${config.apiBaseUrl}/update_vereador.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({ error: 'Erro desconhecido ao salvar.' }));
            throw new Error(data.error || 'Falha ao salvar alterações.');
        }

        const data = await response.json();
        console.log('Update response:', data);

        modal.hide();
        const successMsg = novaSenha ? 'Vereador e senha atualizados com sucesso.' : 'Vereador atualizado com sucesso.';
        showSuccess('vereadoresError', successMsg);
        senhaInput.value = '';

        await loadVereadores();

    } catch (error) {
        console.error('Error saving vereador changes:', error);

        setTimeout(() => {  
            window.location.reload();
        }
        , 100);
        showError('editError', error.message);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar Alterações';
    }
}

// Participants selection
async function loadParticipants() {
    try {
        const response = await fetch(`${config.apiBaseUrl}/list_participants.php`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) throw new Error('Falha ao carregar participantes');

        const participants = await response.json();
        selectedVereadores.clear();
        participants.forEach(p => selectedVereadores.add(p.vereador_id.toString()));

        await loadVereadores();

    } catch (error) {
        showError('participantsError', error.message);
    }
}

// --- Real-time admin stream & helpers ---
let _adminEventSource = null;
let _adminPollInterval = null;

function updateSessionCountsById(sessionId, favorable, contrary, abstention) {
    const favEl = document.getElementById(`fav-${sessionId}`);
    const conEl = document.getElementById(`con-${sessionId}`);
    const absEl = document.getElementById(`abs-${sessionId}`);

    if (favEl) favEl.textContent = favorable;
    if (conEl) conEl.textContent = contrary;
    if (absEl) absEl.textContent = abstention;
}

async function fetchAndUpdateSessionCounts(sessionId) {
    try {
        const resp = await fetch(`${config.apiBaseUrl}/get_session_results.php?id=${sessionId}`);
        if (!resp.ok) return;
        const data = await resp.json();
        updateSessionCountsById(sessionId, data.favorable_votes || 0, data.contrary_votes || 0, data.abstention_votes || 0);
    } catch (err) {
        console.error('Admin: Error fetching session results:', err);
    }
}

function updatePublicViewButton(data) {
    const btn = document.getElementById('publicViewBtn');
    if (!btn) return;
    if (data.redirect_status === 'to_results' && data.session_id) {
        btn.textContent = 'RESULTADO';
        btn.href = `votacao.html?id=${data.session_id}`;
    } else {
        btn.textContent = 'AO VIVO';
        btn.href = 'aovivo.html';
    }
}

function handleAdminStreamData(data) {
    try {
        // If active session included, update that session's three counts
        if (data.active_session) {
            const s = data.active_session;
            updateSessionCountsById(s.id, s.favorable_votes || 0, s.contrary_votes || 0, s.abstention_votes || 0);
        }

        // If redirect points to results, fetch that session to ensure counts
        if (data.redirect_status === 'to_results' && data.session_id) {
            fetchAndUpdateSessionCounts(data.session_id);
        }

        // Update AO VIVO / RESULTADO button
        updatePublicViewButton(data);

    } catch (err) {
        console.error('Admin: Error handling stream data:', err);
    }
}

function startAdminPolling() {
    if (_adminPollInterval) clearInterval(_adminPollInterval);
    _adminPollInterval = setInterval(async () => {
        try {
            const [redirectResp, activeResp] = await Promise.all([
                fetch(`${config.apiBaseUrl}/get_redirect_status.php`),
                fetch(`${config.apiBaseUrl}/get_active_session.php`)
            ]);

            if (redirectResp.ok) {
                const rd = await redirectResp.json();
                handleAdminStreamData(rd);
            }

            if (activeResp.ok) {
                const as = await activeResp.json();
                // get_active_session returns object with active_session
                if (as.active_session) {
                    handleAdminStreamData({ active_session: as.active_session });
                }
            }
        } catch (err) {
            console.error('Admin polling error:', err);
        }
    }, config.refreshInterval);
}

function setupAdminStream() {
    if (typeof EventSource === 'undefined') {
        console.log('Admin: SSE not supported, using polling fallback.');
        startAdminPolling();
        return;
    }

    const srcUrl = `${config.apiBaseUrl}/redirect_stream.php`;

    try {
        _adminEventSource = new EventSource(srcUrl);
    } catch (err) {
        console.error('Admin: Failed to create EventSource:', err);
        startAdminPolling();
        return;
    }

    _adminEventSource.addEventListener('open', () => {
        console.log('Admin: Connected to redirect event stream.');
        if (_adminPollInterval) {
            clearInterval(_adminPollInterval);
            _adminPollInterval = null;
        }
    });

    _adminEventSource.addEventListener('redirect', (e) => {
        try {
            const data = JSON.parse(e.data);
            handleAdminStreamData(data);
        } catch (err) {
            console.error('Admin: Error parsing redirect event:', err);
        }
    });

    _adminEventSource.addEventListener('error', (e) => {
        console.error('Admin: EventSource error; falling back to polling.', e);
        if (_adminEventSource.readyState === EventSource.CLOSED) {
            console.log('Admin: EventSource closed; starting polling.');
            startAdminPolling();
        }
    });
}

window.toggleVereador = (id) => {
    console.log('Toggling vereador:', id);
    id = id.toString();
    if (selectedVereadores.has(id)) {
        selectedVereadores.delete(id);
    } else {
        selectedVereadores.add(id);
    }
    loadVereadores();
};

window.deleteVereador = async (id) => {
    console.log('Deleting vereador:', id);
    if (!confirm('Tem certeza que deseja excluir este vereador?')) return;

    try {
        const formData = new FormData();
        formData.append('id', id);

        const response = await fetch(`${config.apiBaseUrl}/delete_vereador.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });

        const data = await response.json();
        console.log('Delete response:', data);

        if (!response.ok) throw new Error(data.error || 'Falha ao excluir vereador');

        showSuccess('registerSuccess', 'Vereador excluído com sucesso');
        await loadVereadores();
        await loadParticipants();

    } catch (error) {
        console.error('Error deleting vereador:', error);
        showError('registerError', error.message);
        setTimeout(() => {
            window.location.reload();
            console.log('Reloading page due to error loading sessions');
        }
        , 100);
    }
};

// Utility functions
function showError(elementId, message) {
    console.log('Showing error:', elementId, message);
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Error element not found:', elementId);
        return;
    }
    element.textContent = message;
    element.classList.remove('d-none');
    if (!element.closest('.modal-body')) {
        setTimeout(() => element.classList.add('d-none'), 5000);
    }
}

function hideError(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('d-none');
        element.textContent = '';
    }
}

function showSuccess(elementId, message) {
    console.log('Showing success:', elementId, message);
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Success element not found:', elementId);
        return;
    }
    const targetElementId = elementId === 'editError' ? 'vereadoresError' : elementId;
    const targetElement = document.getElementById(targetElementId);
    if (!targetElement) return;

    targetElement.textContent = message;
    targetElement.classList.remove('d-none', 'alert-danger');
    targetElement.classList.add('alert-success');
    setTimeout(() => {
        targetElement.classList.add('d-none');
        targetElement.classList.remove('alert-success');
        if (targetElementId === 'vereadoresError') {
            targetElement.classList.add('alert-danger');
        }
    }, 5000);
}