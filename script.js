class DrumMachine {
    constructor() {
        this.config = {
            desktop: {
                steps: 16,
                tempo: 120
            },
            mobile: {
                steps: 8,
                tempo: 120,
                breakpoint: 768 // match with CSS media query
            }
        };

        this.isMobile = window.innerWidth <= this.config.mobile.breakpoint;
        this.steps = this.isMobile ? this.config.mobile.steps : this.config.desktop.steps;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.tracks = 9;
        this.currentStep = 0;
        this.isPlaying = false;
        this.tempo = this.isMobile ? this.config.mobile.tempo : this.config.desktop.tempo;
        this.grid = [];
        this.sounds = {};
        this.nextNoteTime = 0;
        this.scheduleAheadTime = 0.2;
        this.lookahead = 25.0;
        this.timerID = null;
        
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
        this.setupEventListeners();

        // Initialize audio context on user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext || this.audioContext.state === 'suspended') {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.audioContext.resume();
            }
        });

        // Pre-compile noise buffer
        this.noiseBuffer = this.createNoiseBuffer();

        // Add page visibility handling
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Add drum definitions
        this.drumDefinitions = {
            'kick': {
                setup: (context) => {
                    const osc = context.createOscillator();
                    const gain = context.createGain();
                    
                    const oscClick = context.createOscillator();
                    const gainClick = context.createGain();
                    
                    const oscBody = context.createOscillator();
                    const gainBody = context.createGain();
                    
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
                    
                    // Increased gain values for more consistent volume
                    gain.gain.setValueAtTime(3.0, context.currentTime);          // Increased from 2.0
                    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
                    
                    gainClick.gain.setValueAtTime(1.5, context.currentTime);     // Increased from 1.0
                    gainClick.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.05);
                    
                    gainBody.gain.setValueAtTime(1.5, context.currentTime);      // Increased from 1.0
                    gainBody.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
                    
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

        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);

        // Add Safari-specific setup
        this.setupSafariAudioContext();

        // Add tempo control setup
        this.setupTempoControl();

        this.isDragging = false;
        this.lastDraggedPad = null;
        this.dragStartState = false; // Whether we're adding or removing tiles

        // Add version for future compatibility
        this.version = '1.0.0';
        
        // Load saved settings
        // this.loadSavedSettings();
        
        // Auto-save when window closes
        // window.addEventListener('beforeunload', () => this.saveSettings());
    }

    setupSafariAudioContext() {
        const resumeAudioContext = () => {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            // Create and play a silent buffer to unlock audio on iOS/Safari
            const buffer = this.audioContext.createBuffer(1, 1, 22050);
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start(0);
            
            document.removeEventListener('touchstart', resumeAudioContext);
            document.removeEventListener('click', resumeAudioContext);
        };
        
        document.addEventListener('touchstart', resumeAudioContext);
        document.addEventListener('click', resumeAudioContext);
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= this.config.mobile.breakpoint;

        if (wasMobile !== this.isMobile) {
            this.steps = this.isMobile ? this.config.mobile.steps : this.config.desktop.steps;
            this.rebuildGrid(true);
        }
    }

    rebuildGrid(preservePattern = false) {
        const wasPlaying = this.isPlaying;
        
        if (this.isPlaying) {
            this.togglePlay(); // Stop temporarily
        }

        const currentPattern = this.grid.map(row => 
            row.map(pad => Array.from(pad.classList))
        );

        const gridContainer = document.querySelector('.grid-container');
        gridContainer.innerHTML = '';
        this.grid = [];

        this.initializeGrid();

        if (preservePattern) {
            for (let row = 0; row < this.tracks; row++) {
                for (let col = 0; col < this.steps; col++) {
                    const oldCol = Math.floor(col * (currentPattern[0].length / this.steps));
                    if (currentPattern[row] && currentPattern[row][oldCol]) {
                        const classes = currentPattern[row][oldCol];
                        classes.forEach(cls => {
                            if (cls !== 'pad') {
                                this.grid[row][col].classList.add(cls);
                            }
                        });
                    }
                }
            }
        }

        // Resume playback if it was playing before
        if (wasPlaying) {
            this.togglePlay();
        }
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
            setup.gain.connect(this.audioContext.destination);

            // Start oscillators and noise sources
            if (setup.osc) {
                setup.osc.start(startTime);
                setup.osc.stop(startTime + 0.2);
            }
            if (setup.noise) {
                setup.noise.start(startTime);
                setup.noise.stop(startTime + 0.2);
            }
            if (setup.extraNodes) {
                setup.extraNodes.forEach(node => {
                    if (node.osc) {
                        node.osc.start(startTime);
                        node.osc.stop(startTime + 0.2);
                    }
                });
            }

            // Cleanup
            const cleanupTime = (startTime - this.audioContext.currentTime + 0.3) * 1000;
            setTimeout(() => {
                setup.gain.disconnect();
                if (setup.extraNodes) {
                    setup.extraNodes.forEach(node => node.gain?.disconnect());
                }
            }, Math.max(0, cleanupTime));

        } catch (error) {
            console.error('Error playing drum sound:', error);
        }
    }

    initializeGrid() {
        const gridContainer = document.querySelector('.grid-container');
        gridContainer.style.gridTemplateColumns = `repeat(${this.steps}, 40px)`;
        
        for (let row = 0; row < this.tracks; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.steps; col++) {
                const pad = document.createElement('div');
                pad.className = 'pad';
                pad.dataset.row = row;
                pad.dataset.col = col;
                
                pad.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent text selection while dragging
                    this.isDragging = true;
                    const activeClass = `active-${this.drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                    this.dragStartState = !pad.classList.contains(activeClass);
                    this.togglePad(pad);
                });

                pad.addEventListener('mouseover', () => {
                    if (this.isDragging && pad !== this.lastDraggedPad) {
                        this.lastDraggedPad = pad;
                        const activeClass = `active-${this.drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                        
                        // Match the drag start state
                        if (this.dragStartState && !pad.classList.contains(activeClass)) {
                            this.togglePad(pad);
                        } else if (!this.dragStartState && pad.classList.contains(activeClass)) {
                            this.togglePad(pad);
                        }
                    }
                });

                gridContainer.appendChild(pad);
                this.grid[row][col] = pad;
            }
        }

        gridContainer.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.lastDraggedPad = null;
        });

        gridContainer.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.lastDraggedPad = null;
        });
    }

    togglePad(pad) {
        const row = parseInt(pad.dataset.row);
        const activeClass = `active-${this.drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        
        if (pad.classList.contains(activeClass)) {
            pad.classList.remove(activeClass);
        } else {
            pad.classList.add(activeClass);
            pad.classList.add('playing');
            setTimeout(() => {
                pad.classList.remove('playing');
            }, 100);
            this.playDrumSound(row);
        }
    }

    setupEventListeners() {
        document.querySelector('.play').addEventListener('click', () => this.togglePlay());
        
        // Add pattern control buttons
        const saveButton = document.querySelector('.save-pattern');
        const loadButton = document.querySelector('.load-pattern');
        const clearButton = document.querySelector('.clear-pattern');
        
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                const patternName = prompt('Name your pattern:', 'Pattern 1');
                if (patternName) {
                    this.savePattern(patternName);
                    this.showToast(`Pattern "${patternName}" saved!`);
                }
            });
        }
        
        if (loadButton) {
            loadButton.addEventListener('click', () => {
                const patterns = this.getStoredPatterns();
                if (Object.keys(patterns).length === 0) {
                    this.showToast('No saved patterns found', 'warning');
                    return;
                }
                
                const menu = this.createPatternMenu(patterns);
                document.body.appendChild(menu);
            });
        }

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear the pattern?')) {
                    this.clearPattern();
                }
            });
        }

        // Add steps control
        const decreaseBtn = document.querySelector('.decrease-steps');
        const increaseBtn = document.querySelector('.increase-steps');
        const stepsDisplay = document.querySelector('.steps-display');

        if (decreaseBtn && increaseBtn) {
            decreaseBtn.addEventListener('click', () => {
                const minSteps = this.isMobile ? 4 : 4;
                const increment = this.isMobile ? 2 : 4;
                
                if (this.steps > minSteps) {
                    this.steps -= increment;
                    stepsDisplay.textContent = `${this.steps} Steps`;
                    this.rebuildGrid(true);
                }
            });

            increaseBtn.addEventListener('click', () => {
                const maxSteps = this.isMobile ? 16 : 32;
                const increment = this.isMobile ? 2 : 4;
                
                if (this.steps < maxSteps) {
                    this.steps += increment;
                    stepsDisplay.textContent = `${this.steps} Steps`;
                    this.rebuildGrid(true);
                }
            });
        }

        // Fix space bar control
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat && 
                !(e.target.matches('input') || e.target.matches('textarea'))) {
                e.preventDefault(); // Prevent page scroll
                this.togglePlay();
            }
        });
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after 2 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    createPatternMenu(patterns) {
        const menu = document.createElement('div');
        menu.className = 'pattern-menu';
        
        const title = document.createElement('h3');
        title.textContent = 'Load Pattern';
        menu.appendChild(title);
        
        Object.entries(patterns).forEach(([name, pattern]) => {
            const row = document.createElement('div');
            row.className = 'pattern-row';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            
            const loadBtn = document.createElement('button');
            loadBtn.textContent = 'Load';
            loadBtn.onclick = () => {
                this.loadPattern(pattern);
                menu.remove();
                this.showToast(`Pattern "${name}" loaded!`);
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '×';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete pattern "${name}"?`)) {
                    this.deletePattern(name);
                    row.remove();
                    if (menu.querySelectorAll('.pattern-row').length === 0) {
                        menu.remove();
                    }
                    this.showToast(`Pattern "${name}" deleted`);
                }
            };
            
            row.appendChild(nameSpan);
            row.appendChild(loadBtn);
            row.appendChild(deleteBtn);
            menu.appendChild(row);
        });
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => menu.remove();
        menu.appendChild(closeBtn);
        
        return menu;
    }

    savePattern(name) {
        const patterns = this.getStoredPatterns();
        patterns[name] = {
            version: this.version,
            tempo: this.tempo,
            pattern: this.grid.map((row, rowIndex) => {
                const instrumentName = this.drumTypes[rowIndex];
                return {
                    instrument: instrumentName,
                    pattern: row.map(pad => {
                        const activeClass = Array.from(pad.classList)
                            .find(cls => cls.startsWith('active-'));
                        return activeClass ? 1 : 0;
                    })
                };
            })
        };
        localStorage.setItem('drumMachinePatterns', JSON.stringify(patterns));
    }

    getStoredPatterns() {
        try {
            return JSON.parse(localStorage.getItem('drumMachinePatterns')) || {};
        } catch {
            return {};
        }
    }

    deletePattern(name) {
        const patterns = this.getStoredPatterns();
        delete patterns[name];
        localStorage.setItem('drumMachinePatterns', JSON.stringify(patterns));
    }

    clearPattern() {
        // Clear all active pads
        this.grid.forEach(row => {
            row.forEach(pad => {
                const classes = Array.from(pad.classList);
                classes.forEach(className => {
                    if (className.startsWith('active-')) {
                        pad.classList.remove(className);
                    }
                });
            });
        });

        // Clear step indicators
        document.querySelectorAll('.step-indicator').forEach(indicator => {
            indicator.classList.remove('active');
        });
        
        // Reset current step
        this.currentStep = 0;
    }

    togglePlay() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            document.querySelector('.play').textContent = 'Stop';
            this.currentStep = 0;
            this.play(); // Start playing immediately
        } else {
            document.querySelector('.play').textContent = 'Play';
            if (this.timerID) {
                clearTimeout(this.timerID);
                this.timerID = null;
            }
        }
    }

    play() {
        if (!this.isPlaying) return;

        const secondsPerBeat = 60.0 / this.tempo;
        const secondsPerStep = secondsPerBeat / 4;

        // Play active pads in current step
        for (let row = 0; row < this.tracks; row++) {
            const drumType = this.drumTypes[row];
            const activeClass = `active-${drumType.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            const currentPad = this.grid[row][this.currentStep];
            
            if (currentPad.classList.contains(activeClass)) {
                this.playDrumSound(row);
                currentPad.classList.add('playing');
                setTimeout(() => {
                    currentPad.classList.remove('playing');
                }, 100);
            }
        }

        // Move to next step
        this.currentStep = (this.currentStep + 1) % this.steps;

        // Schedule next step
        this.timerID = setTimeout(() => {
            requestAnimationFrame(() => this.play());
        }, secondsPerStep * 1000);
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
        window.removeEventListener('resize', this.handleResize);
        if (this.timerID) {
            clearTimeout(this.timerID);
        }
    }

    setupTempoControl() {
        const slider = document.querySelector('.tempo-slider');
        const display = document.querySelector('.tempo-display');

        slider.addEventListener('input', (e) => {
            this.tempo = parseInt(e.target.value);
            display.textContent = `${this.tempo} BPM`;
        });

        // Initialize display
        display.textContent = `${this.tempo} BPM`;
        slider.value = this.tempo;
    }

    loadPattern(pattern) {
        try {
            // Clear existing pattern first
            this.clearPattern();
            
            // Set tempo if it exists in the saved pattern
            if (pattern.tempo) {
                this.tempo = pattern.tempo;
                this.setupTempoControl(); // Update the tempo display and slider
            }

            // Load the pattern
            pattern.pattern.forEach((track) => {
                const rowIndex = this.drumTypes.indexOf(track.instrument);
                if (rowIndex !== -1 && track.pattern.length === this.steps) {
                    track.pattern.forEach((cell, colIndex) => {
                        if (cell === 1) {
                            const pad = this.grid[rowIndex][colIndex];
                            const activeClass = `active-${track.instrument.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                            pad.classList.add(activeClass);
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Error loading pattern:', error);
            this.showToast('Error loading pattern', 'warning');
        }
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const drumMachine = new DrumMachine();
}); 