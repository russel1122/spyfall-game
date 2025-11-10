// Client-side game logic for Spyfall
class SpyfallGame {
    constructor() {
        this.socket = io();
        this.currentScreen = 'main-menu';
        this.gameState = {
            roomCode: null,
            playerName: null,
            players: [],
            role: null,
            location: null,
            timer: 480,
            locations: [],
            isHost: false
        };

        this.initializeEventListeners();
        this.setupSocketListeners();
    }

    // Initialize DOM event listeners
    initializeEventListeners() {
        // Main menu events
        document.getElementById('create-room-btn').addEventListener('click', () => {
            this.showPlayerNameInput('create');
        });

        document.getElementById('join-room-btn').addEventListener('click', () => {
            this.showPlayerNameInput('join');
        });

        document.getElementById('confirm-action-btn').addEventListener('click', () => {
            this.handleConfirmAction();
        });

        // Lobby events
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('leave-room-btn').addEventListener('click', () => {
            this.leaveRoom();
        });

        // Game events
        document.getElementById('call-vote-btn').addEventListener('click', () => {
            this.playSound('vote');
            this.callVote();
        });

        document.getElementById('submit-guess-btn').addEventListener('click', () => {
            this.playSound('button');
            this.submitSpyGuess();
        });

        // Chat events
        document.getElementById('send-message-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Add button click sounds to all buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn') && !e.target.disabled) {
                this.playSound('button');
                // Resume audio context on first user interaction
                if (window.audioManager) {
                    window.audioManager.resumeAudioContext();
                }
            }
        });

        // Results events
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.newGame();
        });

        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            this.backToMenu();
        });

        // Input validation
        document.getElementById('player-name').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9 ]/g, '');
        });

        document.getElementById('room-code').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });

        // Enter key handlers
        document.getElementById('player-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('confirm-action-btn').click();
            }
        });

        document.getElementById('room-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('confirm-action-btn').click();
            }
        });

        // Sound toggle
        document.getElementById('sound-toggle').addEventListener('change', (e) => {
            if (window.audioManager) {
                window.audioManager.setEnabled(e.target.checked);
                // Play test sound when enabling
                if (e.target.checked) {
                    window.audioManager.play('notification');
                }
            }
        });
    }

    // Setup Socket.io event listeners
    setupSocketListeners() {
        // Room creation/joining
        this.socket.on('roomCreated', (data) => {
            this.gameState.roomCode = data.roomCode;
            this.gameState.players = data.players;
            this.gameState.isHost = true;
            this.showLobby();
        });

        this.socket.on('roomJoined', (data) => {
            this.gameState.roomCode = data.roomCode;
            this.gameState.players = data.players;
            this.gameState.isHost = data.player.isHost;
            this.showLobby();
        });

        this.socket.on('playerJoined', (data) => {
            this.gameState.players = data.players;
            this.updatePlayersDisplay();
        });

        this.socket.on('playerLeft', (data) => {
            this.gameState.players = data.players;
            if (data.newHost === this.socket.id) {
                this.gameState.isHost = true;
            }
            this.updatePlayersDisplay();
        });

        // Game events
        this.socket.on('gameStarted', (data) => {
            this.gameState.role = data.role;
            this.gameState.location = data.location;
            this.gameState.players = data.players;
            this.gameState.timer = data.timer;
            this.gameState.locations = data.locations;
            this.playSound('gameStart');
            this.showGame();
        });

        this.socket.on('timerUpdate', (timer) => {
            this.gameState.timer = timer;
            this.updateTimer();
            // Play timer tick sound for last 10 seconds
            if (timer <= 10 && timer > 0) {
                this.playSound('timer');
            }
        });

        // Voting events
        this.socket.on('voteStarted', (data) => {
            this.playSound('notification');
            this.showVoting(data.players);
        });

        this.socket.on('voteUpdate', (data) => {
            this.playSound('vote');
            this.updateVotingStatus(data.votesSubmitted, data.totalPlayers);
        });

        // Game end
        this.socket.on('gameEnded', (result) => {
            // Play win/lose sound based on result
            const isWin = this.determineWinStatus(result);
            this.playSound(isWin ? 'success' : 'error');
            this.showResults(result);
        });

        // Chat events
        this.socket.on('chatMessage', (message) => {
            // Only play chat sound for other players' messages
            if (message.playerId !== this.socket.id && message.type !== 'system') {
                this.playSound('chat');
            }
            this.addChatMessage(message);
        });

        // Error handling
        this.socket.on('error', (message) => {
            this.showError(message);
        });
    }

    // Show player name input based on action
    showPlayerNameInput(action) {
        this.currentAction = action;

        document.getElementById('player-name-section').classList.remove('hidden');
        document.getElementById('confirm-action-btn').classList.remove('hidden');

        if (action === 'join') {
            document.getElementById('room-code-section').classList.remove('hidden');
        }

        document.getElementById('player-name').focus();
    }

    // Handle confirm action (create or join room)
    handleConfirmAction() {
        const playerName = document.getElementById('player-name').value.trim();

        if (!playerName || playerName.length < 2) {
            this.showError('Please enter a name (at least 2 characters)');
            return;
        }

        this.gameState.playerName = playerName;

        if (this.currentAction === 'create') {
            this.socket.emit('createRoom', playerName);
        } else if (this.currentAction === 'join') {
            const roomCode = document.getElementById('room-code').value.trim();

            if (!roomCode || roomCode.length !== 4) {
                this.showError('Please enter a 4-character room code');
                return;
            }

            this.socket.emit('joinRoom', { roomCode, playerName });
        }
    }

    // Show lobby screen
    showLobby() {
        this.switchScreen('lobby');
        document.getElementById('lobby-room-code').textContent = this.gameState.roomCode;
        this.updatePlayersDisplay();

        // Update start game button
        const startBtn = document.getElementById('start-game-btn');
        if (this.gameState.isHost) {
            startBtn.disabled = this.gameState.players.length < 4;
        } else {
            startBtn.style.display = 'none';
        }
    }

    // Update players display in lobby
    updatePlayersDisplay() {
        const playersContainer = document.getElementById('players-list');
        const playerCount = document.getElementById('player-count');

        playerCount.textContent = this.gameState.players.length;

        playersContainer.innerHTML = '';
        this.gameState.players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';

            const nameElement = document.createElement('span');
            nameElement.className = 'player-name';
            nameElement.textContent = player.name;

            const statusElement = document.createElement('span');
            statusElement.className = 'player-status';

            if (player.isHost) {
                const hostBadge = document.createElement('span');
                hostBadge.className = 'host-badge';
                hostBadge.textContent = 'HOST';
                statusElement.appendChild(hostBadge);
            }

            playerElement.appendChild(nameElement);
            playerElement.appendChild(statusElement);
            playersContainer.appendChild(playerElement);
        });

        // Update start button if host
        if (this.gameState.isHost) {
            const startBtn = document.getElementById('start-game-btn');
            startBtn.disabled = this.gameState.players.length < 4 || this.gameState.players.length > 15;
        }
    }

    // Start the game
    startGame() {
        if (this.gameState.isHost) {
            this.socket.emit('startGame');
        }
    }

    // Show game screen
    showGame() {
        this.switchScreen('game');

        // Update room code
        document.getElementById('game-room-code').textContent = this.gameState.roomCode;

        // Update role card
        const roleCard = document.getElementById('role-card');
        const roleDisplay = document.getElementById('role-display');
        const locationDisplay = document.getElementById('location-display');

        if (this.gameState.role === 'spy') {
            roleCard.className = 'role-card role-spy';
            roleDisplay.textContent = '🕵️ You are the SPY';
            locationDisplay.innerHTML = '<div class="location-info">Find out the location!</div>';

            // Show spy guess section
            document.getElementById('spy-guess-section').classList.remove('hidden');
            this.populateLocationSelect();
        } else {
            roleCard.className = 'role-card role-nonspy';
            roleDisplay.textContent = '🔍 You are a NON-SPY';
            locationDisplay.innerHTML = `<div class="location-info">Location: ${this.gameState.location}</div>`;
        }

        // Update players list
        this.updateGamePlayersList();

        // Initialize chat
        this.initializeChat();

        // Start timer
        this.updateTimer();
    }

    // Populate location select for spy
    populateLocationSelect() {
        const select = document.getElementById('location-guess');
        select.innerHTML = '<option value="">Select location...</option>';

        this.gameState.locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            select.appendChild(option);
        });
    }

    // Update game players list
    updateGamePlayersList() {
        const playersContainer = document.getElementById('game-players-list');
        playersContainer.innerHTML = '';

        this.gameState.players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';

            const nameElement = document.createElement('span');
            nameElement.className = 'player-name';
            nameElement.textContent = player.name;

            const statusElement = document.createElement('span');
            statusElement.className = 'player-status';
            if (player.isHost) {
                statusElement.textContent = 'HOST';
            }

            playerElement.appendChild(nameElement);
            playerElement.appendChild(statusElement);
            playersContainer.appendChild(playerElement);
        });
    }

    // Update timer display
    updateTimer() {
        const timerElement = document.getElementById('game-timer');
        const minutes = Math.floor(this.gameState.timer / 60);
        const seconds = this.gameState.timer % 60;

        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Change color based on time remaining
        if (this.gameState.timer <= 60) {
            timerElement.style.color = '#f44336'; // Red
        } else if (this.gameState.timer <= 120) {
            timerElement.style.color = '#FF9800'; // Orange
        } else {
            timerElement.style.color = '#FF9800'; // Default orange
        }
    }

    // Call for vote
    callVote() {
        this.socket.emit('callVote');
    }

    // Submit spy guess
    submitSpyGuess() {
        const select = document.getElementById('location-guess');
        const guessedLocation = select.value;

        if (!guessedLocation) {
            this.showError('Please select a location');
            return;
        }

        this.socket.emit('spyGuess', guessedLocation);
    }

    // Show voting screen
    showVoting(players) {
        this.switchScreen('voting');

        const votingContainer = document.getElementById('voting-players-list');
        const totalPlayersSpan = document.getElementById('total-players');

        totalPlayersSpan.textContent = players.length;
        votingContainer.innerHTML = '';

        players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'vote-player';
            playerElement.dataset.playerId = player.id;

            const nameElement = document.createElement('div');
            nameElement.className = 'vote-player-name';
            nameElement.textContent = player.name;

            playerElement.appendChild(nameElement);

            playerElement.addEventListener('click', () => {
                // Remove previous vote highlight
                document.querySelectorAll('.vote-player').forEach(el => {
                    el.classList.remove('voted');
                });

                // Highlight selected player
                playerElement.classList.add('voted');

                // Submit vote
                this.socket.emit('submitVote', player.id);
            });

            votingContainer.appendChild(playerElement);
        });
    }

    // Update voting status
    updateVotingStatus(votesSubmitted, totalPlayers) {
        document.getElementById('votes-cast').textContent = votesSubmitted;
        document.getElementById('total-players').textContent = totalPlayers;
    }

    // Show results screen
    showResults(result) {
        this.switchScreen('results');

        const titleElement = document.getElementById('game-result-title');
        const detailsElement = document.getElementById('game-result-details');
        const locationElement = document.getElementById('reveal-location');
        const spyElement = document.getElementById('reveal-spy');

        // Set location and spy info
        locationElement.textContent = result.location;
        spyElement.textContent = result.spy.name;

        // Determine result based on reason and current player's role
        let title = '';
        let details = '';
        let isWin = false;

        switch (result.reason) {
            case 'spy_caught':
                if (this.gameState.role === 'spy') {
                    title = '😞 You Lost!';
                    details = 'You were caught! The non-spies identified you correctly.';
                } else {
                    title = '🎉 You Won!';
                    details = 'Great work! You successfully identified the spy.';
                    isWin = true;
                }
                break;

            case 'spy_guessed':
                if (this.gameState.role === 'spy') {
                    title = '🎉 You Won!';
                    details = 'Excellent! You correctly guessed the location.';
                    isWin = true;
                } else {
                    title = '😞 You Lost!';
                    details = 'The spy correctly guessed your location.';
                }
                break;

            case 'innocent_accused':
                if (this.gameState.role === 'spy') {
                    title = '🎉 You Won!';
                    details = 'The non-spies accused an innocent player. You remain hidden!';
                    isWin = true;
                } else {
                    title = '😞 You Lost!';
                    details = 'You accused an innocent player. The spy wins!';
                }
                break;

            case 'spy_wrong_guess':
                if (this.gameState.role === 'spy') {
                    title = '😞 You Lost!';
                    details = 'Your location guess was incorrect.';
                } else {
                    title = '🎉 You Won!';
                    details = 'The spy guessed the wrong location!';
                    isWin = true;
                }
                break;

            case 'timeout':
                title = '⏰ Time\'s Up!';
                details = 'The game ended because time ran out. No one wins!';
                break;
        }

        titleElement.textContent = title;
        titleElement.className = isWin ? 'win-title' : 'lose-title';
        detailsElement.textContent = details;
    }

    // Start a new game (return to lobby)
    newGame() {
        if (this.gameState.isHost) {
            this.showLobby();
        } else {
            this.showError('Only the host can start a new game');
        }
    }

    // Leave room and return to menu
    leaveRoom() {
        this.socket.emit('leaveRoom');
        this.backToMenu();
    }

    // Return to main menu
    backToMenu() {
        this.gameState = {
            roomCode: null,
            playerName: null,
            players: [],
            role: null,
            location: null,
            timer: 480,
            locations: [],
            isHost: false
        };

        // Reset form
        document.getElementById('player-name').value = '';
        document.getElementById('room-code').value = '';
        document.getElementById('player-name-section').classList.add('hidden');
        document.getElementById('room-code-section').classList.add('hidden');
        document.getElementById('confirm-action-btn').classList.add('hidden');

        this.switchScreen('main-menu');
    }

    // Switch between screens
    switchScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        document.getElementById(screenName).classList.add('active');
        this.currentScreen = screenName;
    }

    // Send chat message
    sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) {
            return;
        }

        if (message.length > 200) {
            this.showError('Message too long (max 200 characters)');
            return;
        }

        // Send to server
        this.socket.emit('sendMessage', message);

        // Clear input
        input.value = '';
    }

    // Add chat message to display
    addChatMessage(message) {
        const messagesContainer = document.getElementById('chat-messages');

        // Remove empty state if it exists
        const emptyState = messagesContainer.querySelector('.chat-empty');
        if (emptyState) {
            emptyState.remove();
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = message.type === 'system' ? 'chat-message chat-system' : 'chat-message';

        // Add own message styling if it's from this player
        if (message.playerId === this.socket.id) {
            messageElement.classList.add('own-message');
        }

        // Create message content
        if (message.type === 'system') {
            messageElement.innerHTML = `
                <div class="chat-text">${this.escapeHtml(message.text)}</div>
            `;
        } else {
            const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            messageElement.innerHTML = `
                <div class="chat-sender">${this.escapeHtml(message.playerName)}</div>
                <div class="chat-text">${this.escapeHtml(message.text)}</div>
                <div class="chat-timestamp">${timestamp}</div>
            `;
        }

        // Add to container
        messagesContainer.appendChild(messageElement);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Limit message history to prevent memory issues
        const messages = messagesContainer.children;
        if (messages.length > 100) {
            messages[0].remove();
        }
    }

    // Initialize chat when game starts
    initializeChat() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="chat-empty">
                Start the conversation! Ask questions about the location.
            </div>
        `;
    }

    // HTML escape utility
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Play sound effect
    playSound(soundName) {
        if (window.audioManager) {
            window.audioManager.play(soundName);
        }
    }

    // Determine if player won based on game result
    determineWinStatus(result) {
        switch (result.reason) {
            case 'spy_caught':
                return this.gameState.role !== 'spy';
            case 'spy_guessed':
                return this.gameState.role === 'spy';
            case 'innocent_accused':
                return this.gameState.role === 'spy';
            case 'spy_wrong_guess':
                return this.gameState.role !== 'spy';
            case 'timeout':
                return false; // No one wins on timeout
            default:
                return false;
        }
    }

    // Show error message
    showError(message) {
        this.playSound('error');
        // Simple alert for now - could be enhanced with a nice modal
        alert(message);
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.spyfallGame = new SpyfallGame();
});