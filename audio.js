// Audio Manager for Spyfall Game
class AudioManager {
    constructor() {
        this.sounds = {};
        this.audioContext = null;
        this.isEnabled = true;
        this.volume = 0.3;

        // Initialize Web Audio API
        this.initAudioContext();

        // Create audio elements for different sounds
        this.createSounds();
    }

    async initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.log('Web Audio API not supported');
        }
    }

    createSounds() {
        // Create synthetic sounds using Web Audio API
        this.createButtonSound();
        this.createNotificationSound();
        this.createSuccessSound();
        this.createErrorSound();
        this.createTimerSound();
        this.createGameStartSound();
        this.createVoteSound();
        this.createChatSound();
    }

    // Create button click sound
    createButtonSound() {
        this.sounds.button = () => {
            if (!this.audioContext || !this.isEnabled) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        };
    }

    // Create notification sound
    createNotificationSound() {
        this.sounds.notification = () => {
            if (!this.audioContext || !this.isEnabled) return;

            const oscillator1 = this.audioContext.createOscillator();
            const oscillator2 = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator1.connect(gainNode);
            oscillator2.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator1.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
            oscillator2.frequency.setValueAtTime(659.25, this.audioContext.currentTime); // E5

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, this.audioContext.currentTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);

            oscillator1.start(this.audioContext.currentTime);
            oscillator2.start(this.audioContext.currentTime);
            oscillator1.stop(this.audioContext.currentTime + 0.3);
            oscillator2.stop(this.audioContext.currentTime + 0.3);
        };
    }

    // Create success sound
    createSuccessSound() {
        this.sounds.success = () => {
            if (!this.audioContext || !this.isEnabled) return;

            const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
            notes.forEach((freq, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime + index * 0.15);

                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + index * 0.15);
                gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + index * 0.15 + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + index * 0.15 + 0.2);

                oscillator.start(this.audioContext.currentTime + index * 0.15);
                oscillator.stop(this.audioContext.currentTime + index * 0.15 + 0.2);
            });
        };
    }

    // Create error sound
    createErrorSound() {
        this.sounds.error = () => {
            if (!this.audioContext || !this.isEnabled) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
            oscillator.frequency.linearRampToValueAtTime(150, this.audioContext.currentTime + 0.3);

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, this.audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);

            oscillator.type = 'sawtooth';
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        };
    }

    // Create timer tick sound
    createTimerSound() {
        this.sounds.timer = () => {
            if (!this.audioContext || !this.isEnabled) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume * 0.1, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.05);
        };
    }

    // Create game start fanfare
    createGameStartSound() {
        this.sounds.gameStart = () => {
            if (!this.audioContext || !this.isEnabled) return;

            const melody = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            melody.forEach((freq, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime + index * 0.2);

                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + index * 0.2);
                gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, this.audioContext.currentTime + index * 0.2 + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + index * 0.2 + 0.3);

                oscillator.start(this.audioContext.currentTime + index * 0.2);
                oscillator.stop(this.audioContext.currentTime + index * 0.2 + 0.3);
            });
        };
    }

    // Create vote sound
    createVoteSound() {
        this.sounds.vote = () => {
            if (!this.audioContext || !this.isEnabled) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.2);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.2);
        };
    }

    // Create chat sound
    createChatSound() {
        this.sounds.chat = () => {
            if (!this.audioContext || !this.isEnabled) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.05);

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume * 0.15, this.audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        };
    }

    // Play a sound by name
    play(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }

    // Enable/disable audio
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    // Set volume (0-1)
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    // Resume audio context (needed for Chrome autoplay policy)
    async resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
}

// Create global audio manager instance
window.audioManager = new AudioManager();