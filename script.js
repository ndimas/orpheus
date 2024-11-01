class DrumMachine {
    constructor() {
        this.tracks = 9;
        this.steps = 16;
        this.currentStep = 0;
        this.isPlaying = false;
        this.tempo = 120;
        this.grid = [];
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        
        // Define drum sounds with their frequencies and types
        this.drumDefinitions = {
            'kick': {
                setup: (context) => {
                    const osc = context.createOscillator();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    osc.frequency.setValueAtTime(150, context.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
                    
                    gain.gain.setValueAtTime(1, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
                    
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(3000, context.currentTime);
                    
                    osc.connect(filter);
                    filter.connect(gain);
                    return { osc, gain };
                }
            },
            'snare': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const noiseGain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    // Create noise
                    const bufferSize = context.sampleRate * 0.2;
                    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }
                    
                    noise.buffer = buffer;
                    noiseGain.gain.setValueAtTime(0.7, context.currentTime);
                    noiseGain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
                    
                    filter.type = 'bandpass';
                    filter.frequency.value = 3000;
                    filter.Q.value = 0.5;
                    
                    noise.connect(filter);
                    filter.connect(noiseGain);
                    return { noise, gain: noiseGain };
                }
            },
            'hihatClosed': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    const bufferSize = context.sampleRate * 0.1;
                    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }
                    
                    noise.buffer = buffer;
                    filter.type = 'highpass';
                    filter.frequency.value = 7000;
                    
                    gain.gain.setValueAtTime(0.3, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
                    
                    noise.connect(filter);
                    filter.connect(gain);
                    return { noise, gain };
                }
            },
            'clap': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const noiseGain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    const bufferSize = context.sampleRate * 0.1;
                    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }
                    
                    noise.buffer = buffer;
                    noiseGain.gain.setValueAtTime(0.8, context.currentTime);
                    noiseGain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
                    
                    filter.type = 'bandpass';
                    filter.frequency.value = 2000;
                    filter.Q.value = 1.0;
                    
                    noise.connect(filter);
                    filter.connect(noiseGain);
                    return { noise, gain: noiseGain };
                }
            },
            'hihatOpen': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    const bufferSize = context.sampleRate * 0.3; // Longer duration
                    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }
                    
                    noise.buffer = buffer;
                    filter.type = 'highpass';
                    filter.frequency.value = 7000;
                    
                    gain.gain.setValueAtTime(0.3, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
                    
                    noise.connect(filter);
                    filter.connect(gain);
                    return { noise, gain };
                }
            },
            'tomHigh': {
                setup: (context) => {
                    const osc = context.createOscillator();
                    const gain = context.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(200, context.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(100, context.currentTime + 0.1);
                    
                    gain.gain.setValueAtTime(0.8, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
                    
                    osc.connect(gain);
                    return { osc, gain };
                }
            },
            'tomLow': {
                setup: (context) => {
                    const osc = context.createOscillator();
                    const gain = context.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(100, context.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(50, context.currentTime + 0.15);
                    
                    gain.gain.setValueAtTime(0.8, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
                    
                    osc.connect(gain);
                    return { osc, gain };
                }
            },
            'crash': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    const bufferSize = context.sampleRate * 1.0; // Long duration
                    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }
                    
                    noise.buffer = buffer;
                    filter.type = 'highpass';
                    filter.frequency.value = 5000;
                    
                    gain.gain.setValueAtTime(0.5, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1.0);
                    
                    noise.connect(filter);
                    filter.connect(gain);
                    return { noise, gain };
                }
            },
            'ride': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    const highpass = context.createBiquadFilter();
                    
                    const bufferSize = context.sampleRate * 0.8;
                    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }
                    
                    noise.buffer = buffer;
                    filter.type = 'bandpass';
                    filter.frequency.value = 8000;
                    filter.Q.value = 1.0;
                    
                    highpass.type = 'highpass';
                    highpass.frequency.value = 6000;
                    
                    gain.gain.setValueAtTime(0.3, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.8);
                    
                    noise.connect(filter);
                    filter.connect(highpass);
                    highpass.connect(gain);
                    return { noise, gain };
                }
            }
        };

        this.initializeGrid();
        this.createStepIndicators();
        this.setupEventListeners();

        // Initialize audio context on user interaction
        document.addEventListener('click', () => {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }, { once: true });

        // Pre-compile noise buffer
        this.noiseBuffer = this.createNoiseBuffer();
    }

    playDrumSound(row) {
        try {
            const drumTypes = [
                'kick',
                'snare',
                'clap',
                'hihatClosed',
                'hihatOpen',
                'tomHigh',
                'tomLow',
                'crash',
                'ride'
            ];

            const drumType = drumTypes[row];
            if (!drumType || !this.drumDefinitions[drumType]) return;

            const setup = this.drumDefinitions[drumType].setup(this.audioContext);
            const currentTime = this.audioContext.currentTime;
            
            // Connect to destination and start immediately
            if (setup.gain) {
                setup.gain.connect(this.audioContext.destination);
            }
            if (setup.noiseGain) {
                setup.noiseGain.connect(this.audioContext.destination);
            }

            // Start all sound sources
            if (setup.osc) {
                setup.osc.start(currentTime);
                setup.osc.stop(currentTime + 0.5);
            }
            if (setup.noise) {
                setup.noise.start(currentTime);
                setup.noise.stop(currentTime + 0.5);
            }

        } catch (error) {
            console.error('Error playing drum sound:', error);
        }
    }

    initializeGrid() {
        const gridContainer = document.querySelector('.grid-container');
        
        for (let row = 0; row < this.tracks; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.steps; col++) {
                const pad = document.createElement('div');
                pad.className = 'pad';
                pad.dataset.row = row;
                pad.dataset.col = col;
                
                pad.addEventListener('click', () => this.togglePad(pad));
                gridContainer.appendChild(pad);
                this.grid[row][col] = pad;
            }
        }
    }

    createStepIndicators() {
        const indicatorContainer = document.querySelector('.step-indicators');
        for (let i = 0; i < 16; i++) {
            const indicator = document.createElement('div');
            indicator.className = 'step-indicator';
            indicatorContainer.appendChild(indicator);
        }
    }

    togglePad(pad) {
        const row = parseInt(pad.dataset.row);
        const drumTypes = [
            'kick',
            'snare',
            'clap',
            'hihatClosed',
            'hihatOpen',
            'tomHigh',
            'tomLow',
            'crash',
            'ride'
        ];
        
        const activeClass = `active-${drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        
        // If pad already has the active class, remove it (unclick)
        if (pad.classList.contains(activeClass)) {
            pad.classList.remove(activeClass);
        } else {
            // Otherwise, add the active class and play the sound
            pad.classList.add(activeClass);
            this.playDrumSound(row);
        }
    }

    setupEventListeners() {
        document.querySelector('.play').addEventListener('click', () => this.togglePlay());
        document.querySelector('.play-alt').addEventListener('click', () => this.togglePlay());
        document.querySelector('.loop').addEventListener('click', () => this.toggleLoop());
    }

    togglePlay() {
        // Resume audio context when play is clicked
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            document.querySelector('.play').textContent = 'Stop';
            document.querySelector('.play-alt').textContent = 'Stop';
            this.currentStep = 0; // Reset step counter when starting
            this.play();
        } else {
            document.querySelector('.play').textContent = 'Play';
            document.querySelector('.play-alt').textContent = 'Play';
        }
    }

    play() {
        if (!this.isPlaying) return;

        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
        }

        // Update step indicators
        document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
            indicator.classList.toggle('active', index === this.currentStep);
        });

        // Updated to check for all instrument-specific active classes
        const drumTypes = [
            'kick',
            'snare',
            'clap',
            'hihatClosed',
            'hihatOpen',
            'tomHigh',
            'tomLow',
            'crash',
            'ride'
        ];

        // Trigger sounds for active pads in current step
        for (let row = 0; row < this.tracks; row++) {
            const activeClass = `active-${drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            if (this.grid[row][this.currentStep].classList.contains(activeClass)) {
                this.playDrumSound(row);
            }
        }

        this.currentStep = (this.currentStep + 1) % this.steps;
        this._timeoutId = setTimeout(() => this.play(), (60000 / this.tempo) / 4);
    }

    randomize() {
        const drumTypes = [
            'kick',
            'snare',
            'clap',
            'hihatClosed',
            'hihatOpen',
            'tomHigh',
            'tomLow',
            'crash',
            'ride'
        ];

        for (let row = 0; row < this.tracks; row++) {
            for (let col = 0; col < this.steps; col++) {
                const pad = this.grid[row][col];
                pad.className = 'pad';
                if (Math.random() > 0.8) {
                    const activeClass = `active-${drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                    pad.classList.add(activeClass);
                }
            }
        }
    }

    reverse() {
        for (let row = 0; row < this.tracks; row++) {
            const rowPads = [...this.grid[row]];
            for (let col = 0; col < this.steps; col++) {
                const classes = rowPads[col].className;
                this.grid[row][this.steps - 1 - col].className = classes;
            }
        }
    }

    createNoiseBuffer() {
        const bufferSize = this.audioContext.sampleRate * 0.5;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const drumMachine = new DrumMachine();
}); 