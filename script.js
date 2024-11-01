class DrumMachine {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.tracks = 9;
        this.steps = 16;
        this.currentStep = 0;
        this.isPlaying = false;
        this.tempo = 120;
        this.grid = [];
        this.sounds = {};
        this.nextNoteTime = 0;
        this.scheduleAheadTime = 0.1;
        this.lookahead = 25.0;
        
        this.drumTypes = [
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

        // Add page visibility handling
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Add drum definitions
        this.drumDefinitions = {
            'kick': {
                setup: (context) => {
                    // Main sub oscillator
                    const osc = context.createOscillator();
                    const gain = context.createGain();
                    
                    // Click/attack oscillator
                    const oscClick = context.createOscillator();
                    const gainClick = context.createGain();
                    
                    // Body oscillator for mid frequencies
                    const oscBody = context.createOscillator();
                    const gainBody = context.createGain();
                    
                    // Compressor for glue and punch
                    const compressor = context.createDynamicsCompressor();
                    compressor.threshold.setValueAtTime(-12, context.currentTime);
                    compressor.knee.setValueAtTime(6, context.currentTime);
                    compressor.ratio.setValueAtTime(4, context.currentTime);
                    compressor.attack.setValueAtTime(0.001, context.currentTime);
                    compressor.release.setValueAtTime(0.1, context.currentTime);
                    
                    // Main sub frequencies
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(60, context.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(30, context.currentTime + 0.2);
                    
                    // Click for attack
                    oscClick.type = 'triangle';
                    oscClick.frequency.setValueAtTime(200, context.currentTime);
                    oscClick.frequency.exponentialRampToValueAtTime(40, context.currentTime + 0.02);
                    
                    // Body tone
                    oscBody.type = 'sine';
                    oscBody.frequency.setValueAtTime(120, context.currentTime);
                    oscBody.frequency.exponentialRampToValueAtTime(50, context.currentTime + 0.1);
                    
                    // Main gain envelope (sub)
                    gain.gain.setValueAtTime(2.0, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
                    
                    // Click gain envelope
                    gainClick.gain.setValueAtTime(1.0, context.currentTime);
                    gainClick.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.05);
                    
                    // Body gain envelope
                    gainBody.gain.setValueAtTime(1.0, context.currentTime);
                    gainBody.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
                    
                    // Connect everything through the compressor
                    osc.connect(gain);
                    oscClick.connect(gainClick);
                    oscBody.connect(gainBody);
                    
                    gain.connect(compressor);
                    gainClick.connect(compressor);
                    gainBody.connect(compressor);
                    
                    return { 
                        osc: osc, 
                        gain: compressor,
                        extraNodes: [
                            { osc: oscClick, gain: gainClick },
                            { osc: oscBody, gain: gainBody }
                        ]
                    };
                }
            },
            'snare': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const noiseGain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    noise.buffer = this.noiseBuffer;
                    noiseGain.gain.setValueAtTime(0.7, context.currentTime);
                    noiseGain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
                    
                    filter.type = 'bandpass';
                    filter.frequency.value = 3000;
                    
                    noise.connect(filter);
                    filter.connect(noiseGain);
                    return { noise, gain: noiseGain };
                }
            },
            'clap': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const noiseGain = context.createGain();
                    
                    noise.buffer = this.noiseBuffer;
                    noiseGain.gain.setValueAtTime(0.8, context.currentTime);
                    noiseGain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
                    
                    noise.connect(noiseGain);
                    return { noise, gain: noiseGain };
                }
            },
            'hihatClosed': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    noise.buffer = this.noiseBuffer;
                    filter.type = 'highpass';
                    filter.frequency.value = 7000;
                    
                    gain.gain.setValueAtTime(0.3, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
                    
                    noise.connect(filter);
                    filter.connect(gain);
                    return { noise, gain };
                }
            },
            'hihatOpen': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    noise.buffer = this.noiseBuffer;
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
                    
                    noise.buffer = this.noiseBuffer;
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
                    
                    noise.buffer = this.noiseBuffer;
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
    }

    handleVisibilityChange() {
        if (document.hidden && this.isPlaying) {
            try {
                const stepsToSchedule = 32;
                const secondsPerBeat = 60.0 / this.tempo;
                const secondsPerStep = secondsPerBeat / 4;
                const currentTime = this.audioContext.currentTime;

                for (let i = 0; i < stepsToSchedule; i++) {
                    const stepTime = this.nextNoteTime + (i * secondsPerStep);
                    const step = (this.currentStep + i) % this.steps;
                    
                    for (let row = 0; row < this.tracks; row++) {
                        const activeClass = `active-${this.drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                        if (this.grid[row][step].classList.contains(activeClass)) {
                            this.playDrumSound(row, stepTime);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in visibility change handler:', error);
            }
        }
    }

    playDrumSound(row, time = null) {
        try {
            const drumType = this.drumTypes[row];
            if (!drumType || !this.drumDefinitions[drumType]) return;

            const setup = this.drumDefinitions[drumType].setup(this.audioContext);
            const startTime = time || this.audioContext.currentTime;
            
            // Connect to destination
            if (setup.gain) {
                setup.gain.connect(this.audioContext.destination);
                
                // Only set gain envelope if it's not the kick drum
                if (drumType !== 'kick') {
                    setup.gain.gain.cancelScheduledValues(startTime);
                    setup.gain.gain.setValueAtTime(1, startTime);
                    setup.gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
                }
            }
            if (setup.noiseGain) {
                setup.noiseGain.connect(this.audioContext.destination);
                setup.noiseGain.gain.cancelScheduledValues(startTime);
                setup.noiseGain.gain.setValueAtTime(0.8, startTime);
                setup.noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
            }

            // Start and stop sounds
            if (setup.osc) {
                setup.osc.start(startTime);
                setup.osc.stop(startTime + 0.5);
            }
            if (setup.noise) {
                setup.noise.start(startTime);
                setup.noise.stop(startTime + 0.5);
            }
            
            // Handle extra nodes (for kick drum)
            if (setup.extraNodes) {
                setup.extraNodes.forEach(node => {
                    if (node.osc) {
                        node.osc.start(startTime);
                        node.osc.stop(startTime + 0.5);
                    }
                });
            }

            // Clean up nodes
            setTimeout(() => {
                setup.gain?.disconnect();
                setup.noiseGain?.disconnect();
                if (setup.extraNodes) {
                    setup.extraNodes.forEach(node => {
                        node.gain?.disconnect();
                    });
                }
            }, (startTime - this.audioContext.currentTime + 0.6) * 1000);

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
        for (let i = 0; i < this.steps; i++) {
            const indicator = document.createElement('div');
            indicator.className = 'step-indicator';
            indicatorContainer.appendChild(indicator);
        }
    }

    togglePad(pad) {
        const row = parseInt(pad.dataset.row);
        const activeClass = `active-${this.drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        
        if (pad.classList.contains(activeClass)) {
            pad.classList.remove(activeClass);
        } else {
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
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            document.querySelector('.play').textContent = 'Stop';
            document.querySelector('.play-alt').textContent = 'Stop';
            this.currentStep = 0;
            this.nextNoteTime = this.audioContext.currentTime;
            this.play();
        } else {
            document.querySelector('.play').textContent = 'Play';
            document.querySelector('.play-alt').textContent = 'Play';
        }
    }

    play() {
        if (!this.isPlaying) return;

        const secondsPerBeat = 60.0 / this.tempo;
        const secondsPerStep = secondsPerBeat / 4;
        const scheduleAhead = document.hidden ? 2.0 : 0.1;

        while (this.nextNoteTime < this.audioContext.currentTime + scheduleAhead) {
            if (!document.hidden) {
                document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
                    indicator.classList.toggle('active', index === this.currentStep);
                });
            }

            for (let row = 0; row < this.tracks; row++) {
                const activeClass = `active-${this.drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                if (this.grid[row][this.currentStep].classList.contains(activeClass)) {
                    this.playDrumSound(row, this.nextNoteTime);
                }
            }

            this.nextNoteTime += secondsPerStep;
            this.currentStep = (this.currentStep + 1) % this.steps;
        }

        const nextUpdateTime = document.hidden ? 1000 : 25;
        this._timeoutId = setTimeout(() => this.play(), nextUpdateTime);
    }

    randomize() {
        for (let row = 0; row < this.tracks; row++) {
            for (let col = 0; col < this.steps; col++) {
                const pad = this.grid[row][col];
                pad.className = 'pad';
                if (Math.random() > 0.8) {
                    const activeClass = `active-${this.drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
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

    // Clean up when the drum machine is destroyed
    destroy() {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
        }
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const drumMachine = new DrumMachine();
}); 