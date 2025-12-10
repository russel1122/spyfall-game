const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Game Configuration Constants
const GAME_TIMER_SECONDS = 480; // 8 minutes
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 15;
const CHAT_COOLDOWN_MS = 3000;
const VOTE_COOLDOWN_MS = 5000;
const MAX_CHAT_LENGTH = 200;
const MAX_NAME_LENGTH = 20;

// Security Configuration
// 1. Helmet - Sets security headers to protect against common attacks
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Socket.IO
            connectSrc: ["'self'", "ws:", "wss:"],
            styleSrc: ["'self'", "'unsafe-inline'"], // For inline styles
            imgSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'"]
        }
    }
}));

// 2. CORS - Control which websites can access your server
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean);
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? (allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : ['https://spyfall-game-production.up.railway.app']) // Use env var or fallback
        : true, // Allow all origins in development
    credentials: true
};
app.use(cors(corsOptions));

// Initialize Socket.IO with CORS configuration
const io = socketIo(server, {
    cors: corsOptions
});

// 3. Rate Limiting - Prevent spam and abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Chat rate limiting (more restrictive)
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // Limit to 20 chat messages per minute
    skipSuccessfulRequests: true,
});

// Serve static files
app.use(express.static(__dirname));

// Enhanced location database with categories
const LOCATION_CATEGORIES = {
    'Public Places': [
        'Beach', 'Park', 'Shopping Mall', 'Library', 'Zoo', 'Museum',
        'Art Gallery', 'Cathedral', 'Stadium', 'Farmers Market', 'Fountain Square',
        'Memorial', 'Playground', 'Botanical Garden', 'Observatory'
    ],
    'Transportation': [
        'Airport', 'Train Station', 'Subway', 'Bus Stop', 'Taxi',
        'Passenger Plane', 'Cruise Ship', 'Ferry', 'Helicopter Pad',
        'Car Dealership', 'Gas Station', 'Parking Garage'
    ],
    'Entertainment': [
        'Movie Theater', 'Theater', 'Casino', 'Circus', 'Night Club',
        'Bowling Alley', 'Arcade', 'Comedy Club', 'Concert Hall',
        'Amusement Park', 'Mini Golf', 'Escape Room', 'Karaoke Bar'
    ],
    'Food & Dining': [
        'Restaurant', 'Cafe', 'Fast Food', 'Food Truck', 'Bakery',
        'Ice Cream Shop', 'Pizza Place', 'Sushi Bar', 'Buffet',
        'Drive-Through', 'Food Court', 'Wine Tasting', 'Vineyard'
    ],
    'Healthcare': [
        'Hospital', 'Doctors Office', 'Dentist', 'Pharmacy', 'Veterinary Clinic',
        'Physical Therapy', 'Day Spa', 'Massage Parlor', 'Yoga Studio',
        'Gym', 'Blood Bank', 'Mental Health Clinic'
    ],
    'Education': [
        'School', 'University', 'Kindergarten', 'Driving School', 'Language School',
        'Art School', 'Cooking Class', 'Dance Studio', 'Music School',
        'Tutoring Center', 'Laboratory', 'Lecture Hall'
    ],
    'Business': [
        'Bank', 'Office', 'Corporate Party', 'Meeting Room', 'Coworking Space',
        'Law Firm', 'Accounting Office', 'Real Estate Agency', 'Insurance Office',
        'Post Office', 'Print Shop', 'Copy Center'
    ],
    'Services': [
        'Police Station', 'Fire Station', 'Embassy', 'City Hall', 'Courthouse',
        'DMV', 'Passport Office', 'Social Security Office', 'Tax Office',
        'Hair Salon', 'Barbershop', 'Laundromat', 'Dry Cleaner'
    ],
    'Accommodation': [
        'Hotel', 'Motel', 'Hostel', 'Bed & Breakfast', 'Resort',
        'Camping Ground', 'RV Park', 'Guest House', 'Vacation Rental'
    ],
    'Retail': [
        'Grocery Store', 'Department Store', 'Clothing Store', 'Electronics Store',
        'Bookstore', 'Toy Store', 'Pet Store', 'Jewelry Store', 'Furniture Store',
        'Hardware Store', 'Thrift Shop', 'Antique Shop'
    ],
    'Unique Locations': [
        'Space Station', 'Pirate Ship', 'Polar Station', 'Military Base',
        'Prison', 'Retirement Home', 'Factory', 'Construction Site',
        'Oil Rig', 'Lighthouse', 'Nuclear Plant'
    ],
    'Outdoor Adventures': [
        'Mountain Cabin', 'Lake House', 'Fishing Pier', 'Hiking Trail',
        'Ski Resort', 'Beach Resort', 'National Park', 'Safari',
        'Desert Camp', 'Forest Lodge', 'River Rapids', 'Cave Exploration'
    ]
};

// Flatten all locations for backward compatibility
const LOCATIONS = Object.values(LOCATION_CATEGORIES).flat();

// Game state
const games = new Map(); // roomCode -> game object
const players = new Map(); // socketId -> player object

// Memory cleanup configuration
const GAME_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
const MAX_GAME_AGE = 2 * 60 * 60 * 1000; // 2 hours
const CONNECTION_LIMITS = new Map(); // IP -> connection count

// Input sanitization functions
function sanitizePlayerName(name) {
    if (typeof name !== 'string') return '';
    return name.trim()
        .replace(/[<>'"&]/g, '') // Remove potential XSS characters
        .replace(/[^a-zA-Z0-9 ]/g, '') // Only allow alphanumeric and spaces
        .substring(0, MAX_NAME_LENGTH);
}

function sanitizeChatMessage(message) {
    if (typeof message !== 'string') return '';
    return message.trim()
        .replace(/[<>'"&]/g, '') // Remove potential XSS characters
        .substring(0, MAX_CHAT_LENGTH);
}

// Generate cryptographically secure room code
function generateRoomCode() {
    return crypto.randomBytes(2).toString('hex').toUpperCase();
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

// Memory cleanup functions
function cleanupAbandonedGames() {
    const now = Date.now();
    let cleanedCount = 0;

    games.forEach((game, roomCode) => {
        const gameAge = now - (game.createdAt || now);
        const isEmpty = game.players.size === 0;
        const isOld = gameAge > MAX_GAME_AGE;

        if (isEmpty || isOld) {
            // Clean up timer if exists
            if (game.timerInterval) {
                clearInterval(game.timerInterval);
            }

            // Remove all players from this game
            game.players.forEach(player => {
                players.delete(player.socketId);
            });

            games.delete(roomCode);
            cleanedCount++;
        }
    });

    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} abandoned games`);
    }
}

// Connection throttling functions
function checkConnectionLimit(ip) {
    const currentConnections = CONNECTION_LIMITS.get(ip) || 0;
    return currentConnections < 10; // Max 10 connections per IP
}

function addConnection(ip) {
    const current = CONNECTION_LIMITS.get(ip) || 0;
    CONNECTION_LIMITS.set(ip, current + 1);
}

function removeConnection(ip) {
    const current = CONNECTION_LIMITS.get(ip) || 0;
    if (current <= 1) {
        CONNECTION_LIMITS.delete(ip);
    } else {
        CONNECTION_LIMITS.set(ip, current - 1);
    }
}

// Start cleanup interval
setInterval(cleanupAbandonedGames, GAME_CLEANUP_INTERVAL);
console.log('🔒 Memory cleanup system initialized');

// Create new game
function createGame(roomCode, hostId) {
    return {
        roomCode,
        hostId,
        players: new Map(),
        status: 'lobby', // lobby, playing, voting, ended
        location: null,
        spyId: null,
        timer: GAME_TIMER_SECONDS,
        timerInterval: null,
        votes: new Map(),
        voteCalled: false,
        startTime: null,
        createdAt: Date.now() // For cleanup tracking
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
        votedFor: null,
        hasGuessed: false
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
    if (game.players.size < MIN_PLAYERS || game.players.size > MAX_PLAYERS) {
        return { success: false, error: `Game needs ${MIN_PLAYERS}-${MAX_PLAYERS} players` };
    }

    // Guard against starting already active game (check and set atomically)
    if (game.status !== 'lobby') {
        return { success: false, error: 'Game already in progress' };
    }

    // Immediately set status to prevent race condition
    game.status = 'playing';

    // Clear any existing timer interval
    if (game.timerInterval) {
        clearInterval(game.timerInterval);
        game.timerInterval = null;
    }

    // Reset game state for new round
    game.timer = GAME_TIMER_SECONDS;
    game.voteCalled = false;
    game.votes = new Map();

    // Assign roles
    const playerIds = Array.from(game.players.keys());
    const spyIndex = Math.floor(Math.random() * playerIds.length);
    game.spyId = playerIds[spyIndex];
    game.location = getRandomLocation();

    // Set roles for all players and reset voting/guessing states
    game.players.forEach((player, playerId) => {
        if (playerId === game.spyId) {
            player.role = 'spy';
        } else {
            player.role = 'non-spy';
        }
        // Reset voting and guessing state for each player
        player.hasVoted = false;
        player.votedFor = null;
        player.hasGuessed = false;
    });

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

        // Find player(s) with most votes
        let maxVotes = 0;
        let accusedPlayerId = null;
        let playersWithMaxVotes = [];

        // First pass: find the maximum vote count
        voteCounts.forEach((count) => {
            if (count > maxVotes) {
                maxVotes = count;
            }
        });

        // Second pass: collect all players with maximum votes
        voteCounts.forEach((count, playerId) => {
            if (count === maxVotes) {
                playersWithMaxVotes.push(playerId);
            }
        });

        // Handle tie vs clear winner
        if (playersWithMaxVotes.length > 1) {
            // Tie detected - no one gets accused, spy wins
            endGame(game, 'vote_tie', 'spy');
        } else {
            // Clear winner - proceed with normal logic
            accusedPlayerId = playersWithMaxVotes[0];

            if (accusedPlayerId === game.spyId) {
                endGame(game, 'spy_caught', 'non-spies');
            } else {
                endGame(game, 'innocent_accused', 'spy');
            }
        }
    }
}

// Helper function to get client IP (proxy-aware)
function getClientIP(socket) {
    return socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || socket.request.connection.remoteAddress
        || 'unknown';
}

// Socket.io connection handling
io.on('connection', (socket) => {
    const clientIP = getClientIP(socket);

    // Add global error handler for this socket
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
        socket.disconnect();
    });

    // Check connection limits
    if (!checkConnectionLimit(clientIP)) {
        console.log(`🚫 Connection rejected - IP limit exceeded: ${clientIP}`);
        socket.emit('error', 'Too many connections from your location. Please try again later.');
        socket.disconnect();
        return;
    }

    // Add connection to tracking
    addConnection(clientIP);
    console.log(`✅ User connected: ${socket.id} from ${clientIP}`);

    // Create room
    socket.on('createRoom', (playerName) => {
        const sanitizedName = sanitizePlayerName(playerName);
        if (!sanitizedName || sanitizedName.length < 2) {
            socket.emit('error', 'Player name must be at least 2 characters');
            return;
        }

        const roomCode = generateRoomCode();
        const playerId = socket.id;

        const game = createGame(roomCode, playerId);
        games.set(roomCode, game);

        const player = addPlayerToGame(game, playerId, sanitizedName, socket.id);

        socket.join(roomCode);
        socket.emit('roomCreated', {
            roomCode,
            player,
            players: Array.from(game.players.values())
        });
    });

    // Join room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const sanitizedName = sanitizePlayerName(playerName);
        if (!sanitizedName || sanitizedName.length < 2) {
            socket.emit('error', 'Player name must be at least 2 characters');
            return;
        }

        // Validate room code format
        if (!roomCode || typeof roomCode !== 'string' || roomCode.length !== 4) {
            socket.emit('error', 'Invalid room code format');
            return;
        }

        const normalizedRoomCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (normalizedRoomCode.length !== 4) {
            socket.emit('error', 'Invalid room code');
            return;
        }

        const game = games.get(normalizedRoomCode);

        if (!game) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (game.status !== 'lobby') {
            socket.emit('error', 'Game already in progress');
            return;
        }

        if (game.players.size >= MAX_PLAYERS) {
            socket.emit('error', 'Room is full');
            return;
        }

        // Check if name is already taken
        const nameExists = Array.from(game.players.values()).some(p => p.name === sanitizedName);
        if (nameExists) {
            socket.emit('error', 'Name already taken');
            return;
        }

        const playerId = socket.id;
        const player = addPlayerToGame(game, playerId, sanitizedName, socket.id);

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
        // Rate limiting for vote calls
        if (socket.lastVoteCall && Date.now() - socket.lastVoteCall < VOTE_COOLDOWN_MS) {
            socket.emit('error', 'Please wait before calling another vote');
            return;
        }
        socket.lastVoteCall = Date.now();

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

        // Validate vote target exists in game
        if (!game.players.has(accusedPlayerId)) {
            socket.emit('error', 'Invalid vote target');
            return;
        }

        // Prevent self-voting
        if (accusedPlayerId === player.id) {
            socket.emit('error', 'You cannot vote for yourself');
            return;
        }

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

        // Validate guessed location is in the location list
        if (!LOCATIONS.includes(guessedLocation)) {
            socket.emit('error', 'Invalid location');
            return;
        }

        // Prevent multiple guesses
        if (gamePlayer.hasGuessed) {
            socket.emit('error', 'Already guessed');
            return;
        }
        gamePlayer.hasGuessed = true;

        if (guessedLocation === game.location) {
            endGame(game, 'spy_guessed', 'spy');
        } else {
            endGame(game, 'spy_wrong_guess', 'non-spies');
        }
    });

    // Send chat message (with rate limiting)
    socket.on('sendMessage', (messageText) => {
        // Apply rate limiting
        const now = Date.now();

        // Simple rate limiting: track last message times per socket
        if (!socket.lastMessageTime) socket.lastMessageTime = 0;
        if (now - socket.lastMessageTime < CHAT_COOLDOWN_MS) {
            socket.emit('error', 'Please wait before sending another message');
            return;
        }
        socket.lastMessageTime = now;

        const player = players.get(socket.id);
        if (!player) return;

        const game = games.get(player.roomCode);
        if (!game || game.status !== 'playing') return;

        const gamePlayer = game.players.get(player.id);
        if (!gamePlayer) return;

        // Sanitize message
        const sanitizedMessage = sanitizeChatMessage(messageText);
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
        const clientIP = getClientIP(socket);

        // Remove connection from tracking
        removeConnection(clientIP);

        console.log(`❌ User disconnected: ${socket.id} from ${clientIP}`);

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
    console.log(`🎯 Spyfall server running on port ${PORT} - Azure deployment test`);
    console.log(`Game available at: http://localhost:${PORT}`);
});

module.exports = { app, server, io };