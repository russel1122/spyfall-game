# Spyfall - Multiplayer Social Deduction Game

A browser-based multiplayer social deduction game inspired by Spyfall. One player is secretly assigned as the Spy while all other players are Non-Spies who know the secret location. The goal is for Non-Spies to identify the Spy, while the Spy tries to guess the location without being detected.

## Features

### Core Gameplay
- **4-15 players** per game
- **Random role assignment** (exactly 1 Spy per game)
- **Private role display** for each player
- **Shared round timer** (8 minutes)
- **Voting system** for accusations
- **Location database** with 39+ different locations

### Game Flow
1. Players join lobby using room codes
2. Host starts the game when ready (4+ players)
3. Roles are randomly assigned and privately displayed
4. Timer starts - players discuss and ask questions
5. Any player can call for a vote to accuse someone
6. Spy can guess the location at any time
7. Game ends with win/lose results and role reveal

### Win Conditions
- **Non-Spies win** if they correctly vote out the Spy
- **Spy wins** if they correctly guess the location
- **Spy wins** if Non-Spies vote out an innocent player

## Technical Details

### Frontend
- **HTML/CSS/JavaScript** with responsive design
- **Socket.io client** for real-time communication
- **Mobile-friendly interface** with clean, minimal design
- **Multiple game screens**: Menu, Lobby, Game, Voting, Results

### Backend
- **Node.js** with Express server
- **Socket.io** for WebSocket communication
- **Real-time multiplayer** support
- **Room management** with unique room codes
- **Player connection tracking**

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Quick Start

1. **Clone/Download** the game files to your computer

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open your browser** and go to:
   ```
   http://localhost:3000
   ```

5. **Share the link** with friends to play together!

### Custom Port
If port 3000 is already in use, you can specify a different port:

```bash
PORT=3001 npm start
```

Then access the game at `http://localhost:3001`

## How to Play

### Setting Up a Game
1. One player creates a room and gets a 4-character room code
2. Other players join using the room code
3. Host starts the game when 4-15 players have joined

### During the Game
1. **Check your role** - You're either a Spy or Non-Spy
2. **Non-Spies** see the secret location (e.g., "Beach", "Hospital")
3. **Spy** sees no location and must figure it out
4. **Ask questions** about the location to find suspicious answers
5. **Stay alert** - the Spy will try to blend in without knowing the location

### Voting Phase
- Any player can call for a vote at any time
- All players vote for who they think is the Spy
- Player with the most votes is accused

### Spy's Secret Weapon
- The Spy can guess the location at any time during the game
- If the Spy guesses correctly, they win immediately!

## Game Locations

The game includes 39+ diverse locations:
- **Public Places**: Beach, Park, Shopping Mall, Airport
- **Workplaces**: Hospital, School, Office, Factory
- **Entertainment**: Casino, Movie Theater, Circus, Night Club
- **Unique Settings**: Space Station, Pirate Ship, Polar Station
- And many more!

## Tips for Success

### For Non-Spies
- Ask specific questions about the location
- Listen for vague or evasive answers
- Don't make the location too obvious for the Spy
- Pay attention to who's asking vs. answering questions

### For the Spy
- Listen carefully to learn about the location
- Ask general questions that could apply anywhere
- Agree with others' descriptions when possible
- Guess the location when you're confident, but not too early!

## Browser Compatibility

The game works on:
- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Android Chrome
- **Tablets**: All modern browsers

## Development

### File Structure
```
spyfall/
├── index.html          # Main game interface
├── styles.css          # Game styling and responsive design
├── game.js            # Client-side game logic
├── server.js          # Node.js server and Socket.io handling
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

### Key Technologies
- **Express.js**: Web server framework
- **Socket.io**: Real-time bidirectional communication
- **Vanilla JavaScript**: Client-side game logic
- **CSS Grid/Flexbox**: Responsive layout

## Troubleshooting

### Common Issues

**"Address already in use" error:**
- Try using a different port: `PORT=3001 npm start`
- Or stop other processes using port 3000

**Players can't connect:**
- Make sure all players use the same server address
- Check that the server is running and accessible

**Game feels laggy:**
- Check internet connection for all players
- Ensure server has sufficient resources

## Contributing

Feel free to enhance the game with:
- Additional locations
- New game modes
- UI improvements
- Bug fixes

## License

This project is open source and available under the MIT License.