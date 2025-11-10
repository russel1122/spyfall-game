const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(__dirname));

// Game locations database
const LOCATIONS = [
    'Beach', 'Hospital', 'Restaurant', 'School', 'Airport', 'Bank',
    'Casino', 'Circus', 'Hotel', 'Movie Theater', 'Museum', 'Library',
    'Park', 'Police Station', 'Shopping Mall', 'Subway', 'Theater',
    'University', 'Zoo', 'Space Station', 'Pirate Ship', 'Embassy',
    'Train Station', 'Art Gallery', 'Cathedral', 'Corporate Party',
    'Cruise Ship', 'Day Spa', 'Factory', 'Gas Station', 'Grocery Store',
    'Military Base', 'Night Club', 'Office', 'Passenger Plane',
    'Polar Station', 'Prison', 'Retirement Home', 'Stadium', 'Vineyard'
];

// Game state
const games = new Map(); // roomCode -> game object
const players = new Map(); // socketId -> player object

// Generate random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Shuffle array utility
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get random location
function getRandomLocation() {
    return LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
}

// Create new game
function createGame(roomCode, hostId) {
    return {
        roomCode,
        hostId,
        players: new Map(),
        status: 'lobby', // lobby, playing, voting, ended
        location: null,
        spyId: null,
        timer: 480, // 8 minutes in seconds
        timerInterval: null,
        votes: new Map(),
        voteCalled: false,
        startTime: null
    };
}

// Add player to game
function addPlayerToGame(game, playerId, playerName, socketId) {
    const player = {
        id: playerId,
        name: playerName,
        socketId: socketId,
        role: null,
        isHost: playerId === game.hostId,
        hasVoted: false,
        votedFor: null
    };

    game.players.set(playerId, player);
    players.set(socketId, { ...player, roomCode: game.roomCode });

    return player;
}

// Remove player from game
function removePlayerFromGame(game, playerId) {
    const player = game.players.get(playerId);
    if (player) {
        game.players.delete(playerId);
        players.delete(player.socketId);

        // If host left, assign new host
        if (playerId === game.hostId && game.players.size > 0) {
            const newHost = game.players.values().next().value;
            game.hostId = newHost.id;
            newHost.isHost = true;
        }
    }

    // Clean up empty games
    if (game.players.size === 0) {
        if (game.timerInterval) {
            clearInterval(game.timerInterval);
        }
        games.delete(game.roomCode);
    }

    return player;
}

// Start game logic
function startGame(game) {
    if (game.players.size < 4 || game.players.size > 15) {
        return { success: false, error: 'Game needs 4-15 players' };
    }

    // Assign roles
    const playerIds = Array.from(game.players.keys());
    const spyIndex = Math.floor(Math.random() * playerIds.length);
    game.spyId = playerIds[spyIndex];
    game.location = getRandomLocation();

    // Set roles for all players
    game.players.forEach((player, playerId) => {
        if (playerId === game.spyId) {
            player.role = 'spy';
        } else {
            player.role = 'non-spy';
        }
    });

    game.status = 'playing';
    game.startTime = Date.now();

    // Send welcome message to chat
    const welcomeMessage = {
        id: Date.now(),
        playerId: 'system',
        playerName: 'System',
        text: `Game started! You have ${Math.floor(game.timer / 60)} minutes to find the spy. Ask questions, discuss, and stay alert!`,
        timestamp: new Date().toISOString(),
        type: 'system'
    };
    io.to(game.roomCode).emit('chatMessage', welcomeMessage);

    // Start timer
    game.timerInterval = setInterval(() => {
        game.timer--;
        io.to(game.roomCode).emit('timerUpdate', game.timer);

        if (game.timer <= 0) {
            clearInterval(game.timerInterval);
            endGame(game, 'timeout');
        }
    }, 1000);

    return { success: true };
}

// End game logic
function endGame(game, reason, winner = null) {
    if (game.timerInterval) {
        clearInterval(game.timerInterval);
        game.timerInterval = null;
    }

    game.status = 'ended';

    let result = {
        reason,
        winner,
        spy: game.players.get(game.spyId),
        location: game.location,
        players: Array.from(game.players.values())
    };

    io.to(game.roomCode).emit('gameEnded', result);
}

// Handle voting logic
function processVotes(game) {
    const totalPlayers = game.players.size;
    const votesSubmitted = Array.from(game.players.values()).filter(p => p.hasVoted).length;

    if (votesSubmitted === totalPlayers) {
        // Count votes
        const voteCounts = new Map();
        game.players.forEach(player => {
            if (player.votedFor) {
                const currentCount = voteCounts.get(player.votedFor) || 0;
                voteCounts.set(player.votedFor, currentCount + 1);
            }
        });

        // Find player with most votes
        let maxVotes = 0;
        let accusedPlayerId = null;

        voteCounts.forEach((count, playerId) => {
            if (count > maxVotes) {
                maxVotes = count;
                accusedPlayerId = playerId;
            }
        });

        // Check if accused player is the spy
        if (accusedPlayerId === game.spyId) {
            endGame(game, 'spy_caught', 'non-spies');
        } else {
            endGame(game, 'innocent_accused', 'spy');
        }
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Create room
    socket.on('createRoom', (playerName) => {
        const roomCode = generateRoomCode();
        const playerId = socket.id;

        const game = createGame(roomCode, playerId);
        games.set(roomCode, game);

        const player = addPlayerToGame(game, playerId, playerName, socket.id);

        socket.join(roomCode);
        socket.emit('roomCreated', {
            roomCode,
            player,
            players: Array.from(game.players.values())
        });
    });

    // Join room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const game = games.get(roomCode);

        if (!game) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (game.status !== 'lobby') {
            socket.emit('error', 'Game already in progress');
            return;
        }

        if (game.players.size >= 15) {
            socket.emit('error', 'Room is full');
            return;
        }

        // Check if name is already taken
        const nameExists = Array.from(game.players.values()).some(p => p.name === playerName);
        if (nameExists) {
            socket.emit('error', 'Name already taken');
            return;
        }

        const playerId = socket.id;
        const player = addPlayerToGame(game, playerId, playerName, socket.id);

        socket.join(roomCode);

        // Notify new player
        socket.emit('roomJoined', {
            roomCode,
            player,
            players: Array.from(game.players.values())
        });

        // Notify all players in room
        socket.to(roomCode).emit('playerJoined', {
            player,
            players: Array.from(game.players.values())
        });
    });

    // Start game
    socket.on('startGame', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const game = games.get(player.roomCode);
        if (!game || player.id !== game.hostId) {
            socket.emit('error', 'Only host can start the game');
            return;
        }

        const result = startGame(game);
        if (result.success) {
            // Send game start event to all players
            game.players.forEach((gamePlayer, playerId) => {
                const playerSocket = io.sockets.sockets.get(gamePlayer.socketId);
                if (playerSocket) {
                    playerSocket.emit('gameStarted', {
                        role: gamePlayer.role,
                        location: gamePlayer.role === 'spy' ? null : game.location,
                        players: Array.from(game.players.values()).map(p => ({
                            id: p.id,
                            name: p.name,
                            isHost: p.isHost
                        })),
                        timer: game.timer,
                        locations: LOCATIONS.sort()
                    });
                }
            });
        } else {
            socket.emit('error', result.error);
        }
    });

    // Call vote
    socket.on('callVote', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const game = games.get(player.roomCode);
        if (!game || game.status !== 'playing') return;

        if (game.voteCalled) {
            socket.emit('error', 'Vote already called');
            return;
        }

        game.status = 'voting';
        game.voteCalled = true;

        if (game.timerInterval) {
            clearInterval(game.timerInterval);
        }

        io.to(game.roomCode).emit('voteStarted', {
            players: Array.from(game.players.values()).map(p => ({
                id: p.id,
                name: p.name
            }))
        });
    });

    // Submit vote
    socket.on('submitVote', (accusedPlayerId) => {
        const player = players.get(socket.id);
        if (!player) return;

        const game = games.get(player.roomCode);
        if (!game || game.status !== 'voting') return;

        const gamePlayer = game.players.get(player.id);
        if (gamePlayer.hasVoted) return;

        gamePlayer.hasVoted = true;
        gamePlayer.votedFor = accusedPlayerId;

        // Update all players on vote status
        const votesSubmitted = Array.from(game.players.values()).filter(p => p.hasVoted).length;
        io.to(game.roomCode).emit('voteUpdate', {
            votesSubmitted,
            totalPlayers: game.players.size
        });

        // Check if all votes are in
        processVotes(game);
    });

    // Spy guess location
    socket.on('spyGuess', (guessedLocation) => {
        const player = players.get(socket.id);
        if (!player) return;

        const game = games.get(player.roomCode);
        if (!game || game.status !== 'playing') return;

        const gamePlayer = game.players.get(player.id);
        if (gamePlayer.role !== 'spy') {
            socket.emit('error', 'Only spy can guess location');
            return;
        }

        if (guessedLocation === game.location) {
            endGame(game, 'spy_guessed', 'spy');
        } else {
            endGame(game, 'spy_wrong_guess', 'non-spies');
        }
    });

    // Send chat message
    socket.on('sendMessage', (messageText) => {
        const player = players.get(socket.id);
        if (!player) return;

        const game = games.get(player.roomCode);
        if (!game || game.status !== 'playing') return;

        const gamePlayer = game.players.get(player.id);
        if (!gamePlayer) return;

        // Sanitize message
        const sanitizedMessage = messageText.trim().substring(0, 200);
        if (!sanitizedMessage) return;

        // Create message object
        const message = {
            id: Date.now() + Math.random(), // Simple unique ID
            playerId: player.id,
            playerName: gamePlayer.name,
            text: sanitizedMessage,
            timestamp: new Date().toISOString(),
            type: 'player' // player, system
        };

        // Send message to all players in the room
        io.to(game.roomCode).emit('chatMessage', message);
    });

    // Leave room
    socket.on('leaveRoom', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const game = games.get(player.roomCode);
        if (!game) return;

        socket.leave(player.roomCode);
        const removedPlayer = removePlayerFromGame(game, player.id);

        if (game.players.size > 0) {
            socket.to(player.roomCode).emit('playerLeft', {
                player: removedPlayer,
                players: Array.from(game.players.values()),
                newHost: game.hostId
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        const player = players.get(socket.id);
        if (player) {
            const game = games.get(player.roomCode);
            if (game) {
                const removedPlayer = removePlayerFromGame(game, player.id);

                if (game.players.size > 0) {
                    socket.to(player.roomCode).emit('playerLeft', {
                        player: removedPlayer,
                        players: Array.from(game.players.values()),
                        newHost: game.hostId
                    });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Spyfall server running on port ${PORT}`);
    console.log(`Game available at: http://localhost:${PORT}`);
});

module.exports = { app, server, io };