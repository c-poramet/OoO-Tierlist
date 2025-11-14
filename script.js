class FilmRankingApp {
    constructor() {
        this.films = [];
        this.currentComparison = null;
        this.comparisonQueue = [];
        this.comparisonHistory = []; // Track comparison history for undo
        this.currentView = 'list'; // 'list', 'tree', 'grid', 'elo', 'detail'
        this.currentDetailIndex = 0; // For detail view navigation
        this.detailSectionsHidden = false; // Track if detail sections are collapsed
        
        this.loadData();
        this.setupEventListeners();
        this.updateDisplay();
        
        // Check QR code library availability
        this.checkQRCodeLibrary();
    }
    
    checkQRCodeLibrary() {
        // Add a small delay to ensure libraries are loaded
        setTimeout(() => {
            if (typeof window.QRCode === 'undefined') {
                console.warn('QRCode library not available from window.QRCode');
                // Check if it's available as a global
                if (typeof QRCode === 'undefined') {
                    console.warn('QRCode library not available globally either');
                } else {
                    console.log('QRCode library found globally');
                }
            } else {
                console.log('QRCode library loaded successfully on window');
            }
        }, 500); // Increased delay
    }

    setupEventListeners() {
        // Add item button
        document.getElementById('addFilmBtn').addEventListener('click', () => {
            console.log('Add Film button clicked');
            this.showAddFilmModal();
        });
        
        // Modal controls
        document.querySelector('.close').addEventListener('click', () => this.hideAddFilmModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideAddFilmModal());
        document.getElementById('confirmAddBtn').addEventListener('click', () => {
            console.log('Confirm Add button clicked');
            this.addFilm();
        });
        
        // Auto-fill button
        document.getElementById('autoFillBtn').addEventListener('click', () => this.autoFillTitle());
        
        // Recheck comparisons button
        document.getElementById('recheckBtn').addEventListener('click', () => this.recheckComparisons());
        
        // Validate all comparisons button (hidden by default, shown in dev mode)
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.handleValidateAll());
        }
        
        // Recalculate ELO button
        document.getElementById('recalculateEloBtn').addEventListener('click', () => this.handleRecalculateElo());
        
        // Export dropdown toggle
        document.getElementById('exportDropdownBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExportDropdown();
        });
        
        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.hideExportDropdown();
            this.exportRankings();
        });
        
        // Export as Image button
        document.getElementById('exportImageBtn').addEventListener('click', () => {
            this.hideExportDropdown();
            this.showExportSettingsModal();
        });
        
        // Export Links button
        document.getElementById('exportLinksBtn').addEventListener('click', () => {
            this.hideExportDropdown();
            this.exportLinks();
        });
        
        // Export Tierlist button
        document.getElementById('exportTierlistBtn').addEventListener('click', () => {
            this.hideExportDropdown();
            this.exportTierlist();
        });
        
        // Export settings modal events
        document.getElementById('cancelExportBtn').addEventListener('click', () => this.hideExportSettingsModal());
        document.getElementById('confirmExportBtn').addEventListener('click', () => this.handleExportConfirm());
        
        // Import button and file input
        document.getElementById('importBtn').addEventListener('click', () => this.showImportDialog());
        document.getElementById('importFile').addEventListener('change', (e) => this.importRankings(e));
        
        // Floating add button
        document.getElementById('floatingAddBtn').addEventListener('click', () => this.showAddFilmModal());
        
        // Custom image preview
        document.getElementById('customImage').addEventListener('input', (e) => this.updateThumbnailPreview(e.target.value));
        document.getElementById('videoLink').addEventListener('input', (e) => this.handleVideoLinkChange(e.target.value));
        
        // Undo comparison button
        document.getElementById('undoComparisonBtn').addEventListener('click', () => this.undoLastComparison());
        
        // View mode buttons
        document.getElementById('listViewBtn').addEventListener('click', () => this.setViewMode('list'));
        document.getElementById('treeViewBtn').addEventListener('click', () => this.setViewMode('tree'));
        document.getElementById('gridViewBtn').addEventListener('click', () => this.setViewMode('grid'));
        document.getElementById('eloViewBtn').addEventListener('click', () => this.setViewMode('elo'));
        document.getElementById('detailViewBtn').addEventListener('click', () => this.setViewMode('detail'));
        
        // Close modals and dropdown when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModals();
            }
            // Close export dropdown if clicking outside
            const dropdown = document.getElementById('exportDropdownMenu');
            const dropdownBtn = document.getElementById('exportDropdownBtn');
            if (dropdown && dropdown.classList.contains('show') && 
                !dropdown.contains(e.target) && e.target !== dropdownBtn) {
                this.hideExportDropdown();
            }
        });
        
        // Keyboard shortcuts for comparison modal and detail view
        window.addEventListener('keydown', (e) => {
            if (document.getElementById('comparisonModal').style.display === 'block') {
                if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this.undoLastComparison();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.hideModals();
                }
            } else if (this.currentView === 'detail') {
                // Detail view keyboard navigation
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigateDetail(-1);
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigateDetail(1);
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    this.navigateToFirst();
                } else if (e.key === 'End') {
                    e.preventDefault();
                    this.navigateToLast();
                }
            }
        });
    }

    showAddFilmModal() {
        console.log('showAddFilmModal called');
        document.getElementById('addFilmModal').style.display = 'block';
        document.getElementById('filmTitle').focus();
    }

    hideAddFilmModal() {
        document.getElementById('addFilmModal').style.display = 'none';
        document.getElementById('filmTitle').value = '';
        document.getElementById('videoLink').value = '';
        document.getElementById('customImage').value = '';
        this.clearThumbnailPreview();
        this.resetModalState();
    }

    resetModalState() {
        // Reset modal to "add" mode
        document.querySelector('#addFilmModal .modal-header h2').textContent = 'Add New Item';
        document.getElementById('confirmAddBtn').textContent = 'Add Item';
        this.editingFilmId = null;
        this.clearThumbnailPreview();
    }

    updateThumbnailPreview(imageUrl) {
        const preview = document.getElementById('thumbnailPreview');
        const placeholder = preview.querySelector('.preview-placeholder');
        
        if (!imageUrl.trim()) {
            this.clearThumbnailPreview();
            return;
        }

        // Test if the image loads
        const img = new Image();
        img.onload = () => {
            preview.style.backgroundImage = `url(${imageUrl})`;
            preview.classList.add('has-image');
            preview.classList.remove('thumbnail-error');
            if (placeholder) placeholder.textContent = 'Custom thumbnail loaded';
        };
        
        img.onerror = () => {
            preview.classList.add('thumbnail-error');
            preview.classList.remove('has-image');
            preview.style.backgroundImage = 'none';
            if (placeholder) placeholder.textContent = 'Failed to load image. Please check the URL.';
        };
        
        img.src = imageUrl;
    }

    clearThumbnailPreview() {
        const preview = document.getElementById('thumbnailPreview');
        const placeholder = preview.querySelector('.preview-placeholder');
        
        preview.style.backgroundImage = 'none';
        preview.classList.remove('has-image', 'thumbnail-error');
        if (placeholder) placeholder.textContent = 'Thumbnail preview will appear here';
    }

    async handleVideoLinkChange(videoUrl) {
        if (!videoUrl.trim()) {
            this.clearThumbnailPreview();
            return;
        }

        // Only update preview if no custom image is set
        const customImage = document.getElementById('customImage').value.trim();
        if (customImage) return;

        try {
            const thumbnailUrls = this.extractThumbnailUrl(videoUrl);
            if (thumbnailUrls) {
                let finalThumbnail;
                if (Array.isArray(thumbnailUrls)) {
                    finalThumbnail = await this.getBestThumbnail(thumbnailUrls);
                } else {
                    finalThumbnail = thumbnailUrls;
                }
                
                if (finalThumbnail) {
                    this.updateThumbnailPreview(finalThumbnail);
                }
            }
        } catch (error) {
            console.log('Could not extract thumbnail from video URL');
        }
    }

    hideModals() {
        document.getElementById('addFilmModal').style.display = 'none';
        document.getElementById('comparisonModal').style.display = 'none';
        // Hide undo button when closing modals
        document.getElementById('undoComparisonBtn').style.display = 'none';
    }

    toggleExportDropdown() {
        const dropdown = document.getElementById('exportDropdownMenu');
        dropdown.classList.toggle('show');
    }

    hideExportDropdown() {
        const dropdown = document.getElementById('exportDropdownMenu');
        dropdown.classList.remove('show');
    }

    async autoFillTitle() {
        const link = document.getElementById('videoLink').value.trim();
        const titleInput = document.getElementById('filmTitle');
        const autoFillBtn = document.getElementById('autoFillBtn');
        
        if (!link) {
            alert('Please enter a media link first');
            return;
        }

        // Show loading state
        autoFillBtn.textContent = 'Loading...';
        autoFillBtn.disabled = true;

        try {
            const title = await this.extractTitleFromUrl(link);
            titleInput.value = title;
        } catch (error) {
            console.error('Error fetching title:', error);
            alert('Could not fetch media title. Please enter it manually.');
        } finally {
            // Reset button state
            autoFillBtn.textContent = 'Auto-fill from Link';
            autoFillBtn.disabled = false;
        }
    }

    async extractTitleFromUrl(url) {
        try {
            if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
                return await this.getYouTubeTitle(url);
            } else if (url.includes('vimeo.com')) {
                return await this.getVimeoTitle(url);
            } else {
                // For other URLs, try to fetch the page title
                return await this.getGenericTitle(url);
            }
        } catch (e) {
            console.error('Error extracting title:', e);
            throw new Error('Could not extract title from URL');
        }
    }

    async getYouTubeTitle(url) {
        let videoId;
        if (url.includes('youtube.com/watch')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        }

        // Use YouTube oEmbed API to get video title
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        
        try {
            const response = await fetch(oembedUrl);
            if (!response.ok) throw new Error('Failed to fetch YouTube data');
            
            const data = await response.json();
            return data.title || `YouTube Video ${videoId.substring(0, 8)}`;
        } catch (error) {
            console.error('YouTube API error:', error);
            // Fallback: try to get title from page scraping
            return await this.getGenericTitle(url) || `YouTube Video ${videoId.substring(0, 8)}`;
        }
    }

    async getVimeoTitle(url) {
        const videoId = url.split('vimeo.com/')[1].split('/')[0];
        
        // Use Vimeo oEmbed API
        const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`;
        
        try {
            const response = await fetch(oembedUrl);
            if (!response.ok) throw new Error('Failed to fetch Vimeo data');
            
            const data = await response.json();
            return data.title || `Vimeo Video ${videoId}`;
        } catch (error) {
            console.error('Vimeo API error:', error);
            return await this.getGenericTitle(url) || `Vimeo Video ${videoId}`;
        }
    }

    async getGenericTitle(url) {
        // For generic URLs, we can't easily get the title due to CORS
        // So we'll create a meaningful fallback
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return `Video from ${domain}`;
        } catch (e) {
            return 'Unknown Film';
        }
    }

    extractThumbnailUrl(url) {
        try {
            if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
                let videoId;
                if (url.includes('youtube.com/watch')) {
                    videoId = url.split('v=')[1].split('&')[0];
                } else {
                    videoId = url.split('youtu.be/')[1].split('?')[0];
                }
                // Try multiple YouTube thumbnail qualities
                return [
                    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                    `https://img.youtube.com/vi/${videoId}/default.jpg`
                ];
            } else if (url.includes('vimeo.com')) {
                const videoId = url.split('vimeo.com/')[1].split('/')[0];
                return `https://vumbnail.com/${videoId}.jpg`;
            } else if (url.includes('dailymotion.com')) {
                const videoId = url.split('dailymotion.com/video/')[1];
                if (videoId) {
                    return `https://www.dailymotion.com/thumbnail/video/${videoId}`;
                }
            }
        } catch (e) {
            console.error('Error extracting thumbnail:', e);
            return null;
        }
        return null;
    }

    async getBestThumbnail(urls) {
        if (!Array.isArray(urls)) return urls;
        
        // Test each URL and return the first one that works
        for (const url of urls) {
            try {
                const response = await fetch(url, { method: 'HEAD' });
                if (response.ok) {
                    return url;
                }
            } catch (e) {
                continue;
            }
        }
        return urls[urls.length - 1]; // Return the last (lowest quality) as fallback
    }

    async addFilm() {
        console.log('addFilm method called');
        const title = document.getElementById('filmTitle').value.trim();
        const link = document.getElementById('videoLink').value.trim();
        const customImage = document.getElementById('customImage').value.trim();
        
        console.log('Form values:', { title, link, customImage });

        if (!title && !link) {
            alert('Please enter either a title or a media link');
            return;
        }

        let finalTitle = title;
        if (!title && link) {
            try {
                finalTitle = await this.extractTitleFromUrl(link);
            } catch (error) {
                finalTitle = 'Unknown Item';
            }
        }

        // Determine thumbnail URL with priority: custom image > media thumbnail > null
        let thumbnailUrl = null;
        if (customImage) {
            thumbnailUrl = customImage;
        } else if (link) {
            const extractedThumbnail = this.extractThumbnailUrl(link);
            if (Array.isArray(extractedThumbnail)) {
                thumbnailUrl = await this.getBestThumbnail(extractedThumbnail);
            } else {
                thumbnailUrl = extractedThumbnail;
            }
        }

        // Check if we're editing an existing item
        if (this.editingFilmId) {
            const filmIndex = this.films.findIndex(f => f.id === this.editingFilmId);
            if (filmIndex !== -1) {
                // Update existing item
                this.films[filmIndex].title = finalTitle;
                this.films[filmIndex].link = link || null;
                this.films[filmIndex].thumbnailUrl = thumbnailUrl;
                this.films[filmIndex].customThumbnail = customImage || null;
                
                this.hideAddFilmModal();
                this.resetModalState();
                this.saveData();
                this.updateDisplay();
                this.showSuccessMessage(`Updated "${finalTitle}"!`);
                return;
            }
        }

        // Add new item
        const filmData = {
            id: Date.now(), // Simple ID generation
            title: finalTitle,
            link: link || null,
            thumbnailUrl: thumbnailUrl,
            customThumbnail: customImage || null,
            overallRank: this.films.length,
            wins: 0, // Track number of wins against other items
            comparisons: {}, // Track head-to-head results: {itemId: 'win'/'loss'}
            eloRating: 1200 // Standard starting ELO rating
        };

        this.hideAddFilmModal();
        this.resetModalState();

        if (this.films.length > 0) {
            await this.startComparisons(filmData);
        } else {
            // First item, no comparisons needed
            this.films.push(filmData);
            this.saveData();
            this.updateDisplay();
            this.showSuccessMessage(`Added "${filmData.title}" to your rankings!`);
        }
    }

    async startComparisons(newFilm) {
        console.log('startComparisons called for:', newFilm.title);
        this.comparisonQueue = [];
        this.comparisonHistory = []; // Reset comparison history for new film

        // Sort existing films by ELO descending (highest first)
        const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || 1200) - (a.eloRating || 1200));
        console.log('Existing films to compare against:', sortedFilms.length);

        // Add overall comparisons against each existing film in sorted order
        for (const existingFilm of sortedFilms) {
            this.comparisonQueue.push({
                newFilm: newFilm,
                existingFilm: existingFilm
            });
        }

        console.log('Comparison queue length:', this.comparisonQueue.length);
        // Start the comparison process
        this.processNextComparison();
    }

    processNextComparison() {
        console.log('processNextComparison called, queue length:', this.comparisonQueue.length);
        if (this.comparisonQueue.length === 0) {
            // All comparisons done
            console.log('All comparisons done, calling finishComparisons');
            this.finishComparisons();
            return;
        }

        this.currentComparison = this.comparisonQueue.shift();
        console.log('Processing comparison:', this.currentComparison.newFilm.title, 'vs', this.currentComparison.existingFilm.title, 'Queue length:', this.comparisonQueue.length);
        this.showComparisonModal(this.currentComparison);
    }

    undoLastComparison() {
        if (this.comparisonHistory.length === 0) {
            return; // Nothing to undo
        }

        const lastState = this.comparisonHistory.pop();
        const { comparison, newFilmState, existingFilmState, queueSnapshot } = lastState;
        
        console.log('Undoing comparison:', comparison.newFilm.title, 'vs', comparison.existingFilm.title);
        console.log('Current queue before undo:', this.comparisonQueue.map(c => `${c.newFilm.title} vs ${c.existingFilm.title}`));
        console.log('Restoring queue to:', queueSnapshot.map(c => `${c.newFilm.title} vs ${c.existingFilm.title}`));
        
        // Restore the film states
        // Restore comparisons by clearing and reapplying to keep both sides consistent
        const restoredNewComparisons = JSON.parse(JSON.stringify(newFilmState.comparisons || {}));
        const restoredExistingComparisons = JSON.parse(JSON.stringify(existingFilmState.comparisons || {}));

        // Clear current comparisons for both
        comparison.newFilm.comparisons = {};
        comparison.existingFilm.comparisons = {};

        // Reapply restored comparisons
        Object.keys(restoredNewComparisons).forEach(opId => {
            const res = restoredNewComparisons[opId];
            const other = this.films.find(f => f.id == opId);
            if (other) this.setHeadToHead(comparison.newFilm, other, res === 'win' ? 'win' : 'loss');
        });

        Object.keys(restoredExistingComparisons).forEach(opId => {
            const res = restoredExistingComparisons[opId];
            const other = this.films.find(f => f.id == opId);
            if (other) this.setHeadToHead(comparison.existingFilm, other, res === 'win' ? 'win' : 'loss');
        });

        // Recalculate wins from comparisons (recalculateAllRanks will be called later)
        comparison.newFilm.wins = newFilmState.wins;
        comparison.existingFilm.wins = existingFilmState.wins;
        
        // Restore the entire queue state and put the undone comparison back at front
        this.comparisonQueue = [comparison, ...queueSnapshot];
        console.log('Restored queue, new queue length:', this.comparisonQueue.length);
        
        // Process the restored comparison (this will set currentComparison properly)
        this.processNextComparison();
        
        // Show feedback to user
        this.showUndoMessage('Last comparison undone');
    }

    showComparisonModal(comparison) {
        const modal = document.getElementById('comparisonModal');
        const newFilmTitle = document.getElementById('newFilmTitle');
        const existingFilmTitle = document.getElementById('existingFilmTitle');
        const newFilmThumbnail = document.getElementById('newFilmThumbnail');
        const existingFilmThumbnail = document.getElementById('existingFilmThumbnail');
        const newFilmCard = document.getElementById('newFilmCard');
        const existingFilmCard = document.getElementById('existingFilmCard');
        const undoBtn = document.getElementById('undoComparisonBtn');

        newFilmTitle.textContent = comparison.newFilm.title;
        existingFilmTitle.textContent = comparison.existingFilm.title;

        // Set thumbnails
        if (comparison.newFilm.thumbnailUrl) {
            newFilmThumbnail.style.backgroundImage = `url(${comparison.newFilm.thumbnailUrl})`;
        } else {
            newFilmThumbnail.style.backgroundImage = 'none';
        }

        if (comparison.existingFilm.thumbnailUrl) {
            existingFilmThumbnail.style.backgroundImage = `url(${comparison.existingFilm.thumbnailUrl})`;
        } else {
            existingFilmThumbnail.style.backgroundImage = 'none';
        }

        // Show/hide undo button based on comparison history
        if (this.comparisonHistory.length > 0) {
            undoBtn.style.display = 'inline-block';
        } else {
            undoBtn.style.display = 'none';
        }

        // Add click event listeners to the cards
        newFilmCard.onclick = () => this.handleComparison(true);
        existingFilmCard.onclick = () => this.handleComparison(false);

        modal.style.display = 'block';
    }

    handleComparison(isBetter) {
        if (!this.currentComparison) return;

        const comparison = this.currentComparison;
        const newFilm = comparison.newFilm;
        const existingFilm = comparison.existingFilm;
        
        // Save the current state for undo (before making changes)
        const undoState = {
            comparison: comparison,
            newFilmState: {
                comparisons: JSON.parse(JSON.stringify(newFilm.comparisons || {})),
                wins: newFilm.wins
            },
            existingFilmState: {
                comparisons: JSON.parse(JSON.stringify(existingFilm.comparisons || {})),
                wins: existingFilm.wins
            },
            choice: isBetter,
            // Save the current queue state so we can restore it properly
            queueSnapshot: [...this.comparisonQueue]
        };
        console.log('Saving undo state for:', comparison.newFilm.title, 'vs', comparison.existingFilm.title, 'Queue has', this.comparisonQueue.length, 'items');
        this.comparisonHistory.push(undoState);
        
        // Initialize comparisons object if it doesn't exist
        if (!newFilm.comparisons) newFilm.comparisons = {};
        if (!existingFilm.comparisons) existingFilm.comparisons = {};
        
        // Use centralized setter to ensure consistency
        if (isBetter) {
            this.setHeadToHead(newFilm, existingFilm, 'win');
        } else {
            this.setHeadToHead(newFilm, existingFilm, 'loss');
        }

        console.log('Comparison completed:', newFilm.title, isBetter ? 'wins' : 'loses', 'against', existingFilm.title);
        
        document.getElementById('comparisonModal').style.display = 'none';
        this.processNextComparison();
    }

    finishComparisons() {
        console.log('finishComparisons called');
        const newFilm = this.currentComparison?.newFilm;
        if (!newFilm) {
            console.log('No newFilm found in currentComparison');
            return;
        }

        console.log('Finishing comparisons for:', newFilm.title, 'Wins:', newFilm.wins);
        
        // Check if this is a recheck (film already exists) or new film addition
        const isRecheck = this.films.some(f => f.id === newFilm.id);
        
        if (!isRecheck) {
            // This is a new film being added
            // Calculate rank based on wins - more wins = higher rank (lower rank number)
            newFilm.overallRank = this.films.length - newFilm.wins;
            console.log('Calculated rank:', newFilm.overallRank);

            this.films.push(newFilm);
            console.log('Films array length after push:', this.films.length);
            this.showSuccessMessage(`Added "${newFilm.title}" to your rankings!`);
        } else {
            // This is a recheck - films already exist
            console.log('Recheck comparisons completed');
            this.showSuccessMessage('✅ Missing comparisons completed!');
        }
        
        // Clear current comparison now that we're done with it
        this.currentComparison = null;
        
        this.recalculateAllRanks();
        this.saveData();
        this.updateDisplay();
    }

    deleteFilm(filmId) {
        const film = this.films.find(f => f.id === filmId);
        if (!film) return;

        if (confirm(`Are you sure you want to delete "${film.title}"?\n\nThis action cannot be undone.`)) {
            this.films = this.films.filter(f => f.id !== filmId);
            this.recalculateAllRanks();
            this.saveData();
            this.updateDisplay();
            this.showSuccessMessage(`"${film.title}" has been deleted.`);
        }
    }

    recalculateAllRanks() {
        // Ensure all films have comparisons object and correct win counts
        this.films.forEach(film => {
            if (!film.comparisons) film.comparisons = {};
            
            // Recalculate wins based on comparisons
            film.wins = 0;
            Object.values(film.comparisons).forEach(result => {
                if (result === 'win') film.wins++;
            });
        });
        
        // Sort by wins (descending) to group films with same win counts
        const sortedFilms = [...this.films].sort((a, b) => (b.wins || 0) - (a.wins || 0));
        
        let currentRank = 0;
        let currentWins = null;
        let filmsAtSameRank = 0;
        
        sortedFilms.forEach((film, index) => {
            const filmWins = film.wins || 0;
            
            if (filmWins !== currentWins) {
                // New win count, advance rank by number of films at previous rank
                currentRank += filmsAtSameRank;
                currentWins = filmWins;
                filmsAtSameRank = 1;
            } else {
                // Same win count, increment count of films at this rank
                filmsAtSameRank++;
            }
            
            film.overallRank = currentRank;
            film.isTied = filmsAtSameRank > 1 || this.checkForTiesAtRank(sortedFilms, currentRank, filmWins);
        });
        
        // Detect and mark cycles
        this.detectAndMarkCycles();
    }

    checkForTiesAtRank(sortedFilms, rank, wins) {
        return sortedFilms.filter(f => (f.wins || 0) === wins).length > 1;
    }

    detectAndMarkCycles() {
        // Simple cycle detection: if films have same win count, check for potential cycles
        const winGroups = {};
        
        this.films.forEach(film => {
            const wins = film.wins || 0;
            if (!winGroups[wins]) winGroups[wins] = [];
            winGroups[wins].push(film);
        });
        
        // Mark films that might be in cycles (same win count with multiple films)
        Object.values(winGroups).forEach(group => {
            if (group.length > 1) {
                group.forEach(film => {
                    film.isTied = true;
                    film.cycleNote = `Tied with ${group.length - 1} other film(s)`;
                });
            }
        });
    }

    // Helper to set a head-to-head result between two films.
    // result: 'win' means filmA beats filmB, 'loss' means filmA loses to filmB.
    // This method ensures both sides of the comparison are updated consistently.
    setHeadToHead(filmA, filmB, result) {
        if (!filmA || !filmB) return;
        if (!filmA.comparisons) filmA.comparisons = {};
        if (!filmB.comparisons) filmB.comparisons = {};

        if (result === 'win') {
            filmA.comparisons[filmB.id] = 'win';
            filmB.comparisons[filmA.id] = 'loss';
        } else if (result === 'loss') {
            filmA.comparisons[filmB.id] = 'loss';
            filmB.comparisons[filmA.id] = 'win';
        } else {
            // Treat any other value as removal
            delete filmA.comparisons[filmB.id];
            delete filmB.comparisons[filmA.id];
        }

        // Keep wins/losses consistent by recalculating from comparisons
        this.recalculateAllRanks();
    }

    // Helper to remove a head-to-head comparison between two films
    removeHeadToHead(filmA, filmB) {
        if (!filmA || !filmB) return;
        if (filmA.comparisons && filmA.comparisons[filmB.id]) delete filmA.comparisons[filmB.id];
        if (filmB.comparisons && filmB.comparisons[filmA.id]) delete filmB.comparisons[filmA.id];
        this.recalculateAllRanks();
    }

    // Validate and fix all comparison reciprocity and consistency
    validateAndFixComparisons() {
        let fixedCount = 0;
        let removedCount = 0;
        
        console.log('=== Starting Comparison Validation ===');
        
        // First pass: fix one-sided comparisons
        this.films.forEach(filmA => {
            if (!filmA.comparisons) {
                filmA.comparisons = {};
                return;
            }
            
            Object.keys(filmA.comparisons).forEach(opponentId => {
                const filmB = this.films.find(f => f.id == opponentId);
                
                if (!filmB) {
                    // Opponent doesn't exist, remove this comparison
                    console.log(`Removing orphaned comparison: ${filmA.title} vs non-existent film ${opponentId}`);
                    delete filmA.comparisons[opponentId];
                    removedCount++;
                    return;
                }
                
                if (!filmB.comparisons) filmB.comparisons = {};
                
                const aResult = filmA.comparisons[opponentId];
                const bResult = filmB.comparisons[filmA.id];
                
                // Check reciprocity
                if (!bResult) {
                    // filmB is missing reciprocal entry
                    const reciprocal = aResult === 'win' ? 'loss' : 'win';
                    filmB.comparisons[filmA.id] = reciprocal;
                    console.log(`Fixed missing reciprocal: ${filmB.title} now has ${reciprocal} vs ${filmA.title}`);
                    fixedCount++;
                } else if ((aResult === 'win' && bResult !== 'loss') || (aResult === 'loss' && bResult !== 'win')) {
                    // Inconsistent results
                    const reciprocal = aResult === 'win' ? 'loss' : 'win';
                    console.log(`Fixed inconsistent comparison: ${filmA.title} has ${aResult} vs ${filmB.title}, changed ${filmB.title} from ${bResult} to ${reciprocal}`);
                    filmB.comparisons[filmA.id] = reciprocal;
                    fixedCount++;
                }
            });
        });
        
        console.log(`=== Validation Complete: Fixed ${fixedCount}, Removed ${removedCount} ===`);
        
        // Recalculate everything after fixes
        if (fixedCount > 0 || removedCount > 0) {
            this.recalculateAllRanks();
            this.recalculateEloRatings();
        }
        
        return { fixedCount, removedCount };
    }

    createFilmHTML(film, displayRank) {
        const thumbnailStyle = film.thumbnailUrl ? 
            `background-image: url(${film.thumbnailUrl}); background-size: cover; background-position: center;` : 
            'background: #f8f9fa;';
        
        const winsText = film.wins !== undefined ? `Wins: ${film.wins}` : '';
        
        // Handle tied rankings
        let rankDisplay = `#${displayRank}`;
        let rankClass = 'film-rank';
        let tieInfo = '';
        
        if (film.isTied) {
            rankDisplay = `T${displayRank}`;
            rankClass = 'film-rank tied-rank';
            tieInfo = film.cycleNote ? ` (${film.cycleNote})` : ' (Tied)';
        }
        
        return `
            <div class="film-item ${film.isTied ? 'tied-item' : ''}">
                <div class="${rankClass}">${rankDisplay}</div>
                <div class="film-thumbnail clickable-thumbnail" style="${thumbnailStyle}" onclick="app.jumpToFilmDetail(${film.id})" title="Click to view details"></div>
                <div class="film-info">
                    <div class="film-title">${film.title}</div>
                    <div class="film-details">${winsText}${tieInfo}</div>
                </div>
                <div class="film-actions">
                    <button class="btn btn-danger" onclick="app.deleteFilm(${film.id})">Delete</button>
                    <button class="btn btn-secondary" onclick="app.editFilm(${film.id})">Edit</button>
                    ${film.link ? `<button class="btn btn-primary" onclick="window.open('${film.link}', '_blank')">Play</button>` : ''}
                </div>
            </div>
        `;
    }

    viewThumbnail(url) {
        window.open(url, '_blank');
    }

    editFilm(filmId) {
        const film = this.films.find(f => f.id === filmId);
        if (!film) return;

        // Pre-fill the modal with existing film data
        document.getElementById('filmTitle').value = film.title;
        document.getElementById('videoLink').value = film.link || '';
        document.getElementById('customImage').value = film.customThumbnail || '';
        
        // Update thumbnail preview
        if (film.customThumbnail) {
            this.updateThumbnailPreview(film.customThumbnail);
        } else if (film.thumbnailUrl) {
            this.updateThumbnailPreview(film.thumbnailUrl);
        }
        
        // Show the modal
        this.showAddFilmModal();
        
        // Change the modal title and button text
        document.querySelector('#addFilmModal .modal-header h2').textContent = 'Edit Film';
        document.getElementById('confirmAddBtn').textContent = 'Update Film';
        
        // Store the film ID for updating
        this.editingFilmId = filmId;
    }

    updateDisplay() {
        console.log('updateDisplay called, films count:', this.films.length, 'currentView:', this.currentView);
        switch (this.currentView) {
            case 'tree':
                this.showTreeView();
                break;
            case 'grid':
                this.showGridView();
                break;
            case 'elo':
                this.showEloView();
                break;
            case 'detail':
                this.showDetailView();
                break;
            default:
                this.showListView();
                break;
        }
    }

    setViewMode(mode, resetDetailIndex = true) {
        this.currentView = mode;
        
        // Reset detail index when switching to detail view (unless explicitly told not to)
        if (mode === 'detail' && resetDetailIndex) {
            this.currentDetailIndex = 0;
        }
        
        // Update button states
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.classList.remove('active-view');
        });
        document.getElementById(`${mode}ViewBtn`).classList.add('active-view');
        
        // Save view mode to localStorage
        localStorage.setItem('filmRankingsViewMode', mode);
        
        this.updateDisplay();
    }

    showListView() {
        const container = document.getElementById('rankingsContainer');
        const sortedFilms = [...this.films].sort((a, b) => {
            // First sort by rank, then by wins for tie-breaking display
            if (a.overallRank !== b.overallRank) {
                return a.overallRank - b.overallRank;
            }
            return (b.wins || 0) - (a.wins || 0);
        });
        
        let html = '<h2>Film Rankings</h2>';
        
        // Check if there are any ties to show explanation
        const hasTies = sortedFilms.some(film => film.isTied);
        if (hasTies) {
            html += '<p class="tie-explanation">🔗 Rankings marked with "T" indicate ties or potential ranking cycles</p>';
        }
        
        html += '<div id="filmsList" class="films-list">';
        
        if (sortedFilms.length === 0) {
            html += '<p class="empty-state">No films added yet. Click "Add New Film" to get started!</p>';
        } else {
            // Calculate display ranks properly accounting for ties
            let currentDisplayRank = 1;
            let previousRank = null;
            let filmsAtPreviousRank = 0;
            
            sortedFilms.forEach((film, index) => {
                if (previousRank !== null && film.overallRank !== previousRank) {
                    currentDisplayRank += filmsAtPreviousRank;
                    filmsAtPreviousRank = 0;
                }
                
                html += this.createFilmHTML(film, currentDisplayRank);
                
                previousRank = film.overallRank;
                filmsAtPreviousRank++;
            });
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    showTreeView() {
        const container = document.getElementById('rankingsContainer');
        const sortedFilms = [...this.films].sort((a, b) => {
            if (a.overallRank !== b.overallRank) {
                return a.overallRank - b.overallRank;
            }
            return (b.wins || 0) - (a.wins || 0);
        });
        
        let html = '<h2>🏆 Tournament Tree View</h2>';
        
        if (sortedFilms.length === 0) {
            html += '<p class="empty-state">No films added yet. Click "Add New Film" to get started!</p>';
            container.innerHTML = html;
            return;
        }
        
        html += '<div class="tree-view">';
        
        // Group films by rank
        const rankGroups = {};
        sortedFilms.forEach(film => {
            if (!rankGroups[film.overallRank]) {
                rankGroups[film.overallRank] = [];
            }
            rankGroups[film.overallRank].push(film);
        });
        
        // Display each rank level
        Object.keys(rankGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(rank => {
            const films = rankGroups[rank];
            const isWinner = parseInt(rank) === 0;
            const isTied = films.length > 1;
            
            html += '<div class="tree-level">';
            films.forEach(film => {
                html += this.createTreeNodeHTML(film, isWinner, isTied);
            });
            html += '</div>';
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    showGridView() {
        const container = document.getElementById('rankingsContainer');
        const sortedFilms = [...this.films].sort((a, b) => {
            if (a.overallRank !== b.overallRank) {
                return a.overallRank - b.overallRank;
            }
            return (b.wins || 0) - (a.wins || 0);
        });
        
        let html = '<h2>📱 Grid View</h2>';
        
        if (sortedFilms.length === 0) {
            html += '<p class="empty-state">No films added yet. Click "Add New Film" to get started!</p>';
            container.innerHTML = html;
            return;
        }
        
        html += '<div class="grid-view">';
        
        // Calculate display ranks
        let currentDisplayRank = 1;
        let previousRank = null;
        let filmsAtPreviousRank = 0;
        
        sortedFilms.forEach((film, index) => {
            if (previousRank !== null && film.overallRank !== previousRank) {
                currentDisplayRank += filmsAtPreviousRank;
                filmsAtPreviousRank = 0;
            }
            
            html += this.createGridItemHTML(film, currentDisplayRank);
            
            previousRank = film.overallRank;
            filmsAtPreviousRank++;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    showEloView() {
        const container = document.getElementById('rankingsContainer');
        
        // Recalculate ELO ratings based on all comparisons
        this.recalculateEloRatings();
        
        const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || 1200) - (a.eloRating || 1200));
        
        let html = '<h2>🧮 ELO Ratings</h2>';
        html += '<p class="elo-explanation">📊 ELO ratings calculated from all pairwise comparisons (higher = better)</p>';
        
        if (sortedFilms.length === 0) {
            html += '<p class="empty-state">No films added yet. Click "Add New Film" to get started!</p>';
            container.innerHTML = html;
            return;
        }
        
        html += '<div id="filmsList" class="films-list">';
        
        let currentRank = 1;
        let prevElo = null;
        
        sortedFilms.forEach((film, index) => {
            const currentElo = film.eloRating || 1200;
            
            // Only increment rank if ELO is different from previous film
            if (prevElo !== null && Math.abs(currentElo - prevElo) > 1e-6) {
                currentRank = index + 1;
            }
            
            html += this.createEloFilmHTML(film, currentRank);
            prevElo = currentElo;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    showDetailView() {
        const container = document.getElementById('rankingsContainer');
        
        if (this.films.length === 0) {
            container.innerHTML = `
                <h2>🔍 Detail View</h2>
                <p class="empty-state">No films added yet. Click "Add New Film" to get started!</p>
            `;
            return;
        }

        // Sort films by ELO rating (descending) for detail view
        // IMPORTANT: This sorting MUST match the sorting used in jumpToFilmDetail() and navigateToLast()
        // to ensure consistent navigation between view modes
        const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || b.elo || 1200) - (a.eloRating || a.elo || 1200));

        // Ensure currentDetailIndex is within bounds
        if (this.currentDetailIndex >= sortedFilms.length) {
            this.currentDetailIndex = 0;
        } else if (this.currentDetailIndex < 0) {
            this.currentDetailIndex = sortedFilms.length - 1;
        }

        const currentFilm = sortedFilms[this.currentDetailIndex];
        const currentDisplayRank = this.calculateDisplayRank(currentFilm, sortedFilms);
        
        let html = '<h2>🔍 Detail View</h2>';
        
        html += '<div class="detail-view">';
        
        // Navigation controls
        html += `
            <div class="detail-navigation">
                <button class="nav-btn nav-btn-first" onclick="app.navigateToFirst()" ${this.currentDetailIndex === 0 ? 'disabled' : ''} title="Go to first film">
                    ⏮ First
                </button>
                <button class="nav-btn" onclick="app.navigateDetail(-1)" ${this.currentDetailIndex === 0 ? 'disabled' : ''} title="Previous film">
                    ◀ Previous
                </button>
                <div class="film-counter">
                    ${this.currentDetailIndex + 1} of ${sortedFilms.length}
                </div>
                <button class="nav-btn" onclick="app.navigateDetail(1)" ${this.currentDetailIndex === sortedFilms.length - 1 ? 'disabled' : ''} title="Next film">
                    Next ▶
                </button>
                <button class="nav-btn nav-btn-last" onclick="app.navigateToLast()" ${this.currentDetailIndex === sortedFilms.length - 1 ? 'disabled' : ''} title="Go to last film">
                    Last ⏭
                </button>
            </div>
        `;

        // Film detail card
        html += this.createDetailCardHTML(currentFilm, currentDisplayRank);
        
        html += '</div>';
        container.innerHTML = html;
    }

    calculateEloRating(ratingA, ratingB, scoreA, kFactor = 32) {
        // Standard ELO calculation
        const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
        const newRatingA = ratingA + kFactor * (scoreA - expectedA);
        return Math.round(newRatingA);
    }

    calculateDisplayRank(film, sortedFilms) {
        // Always return the 1-based index in the sorted ELO list as the rank
        for (let i = 0; i < sortedFilms.length; i++) {
            if (sortedFilms[i].id === film.id) {
                return i + 1;
            }
        }
        return 1;
    }

    createDetailCardHTML(film, displayRank) {
        const thumbnailStyle = film.thumbnailUrl ? 
            `background-image: url(${film.thumbnailUrl}); background-size: cover; background-position: center;` : 
            'background: #f8f9fa;';
        
        const eloRating = Math.round(film.eloRating || 1200);
        const eloClass = this.getEloRatingClass(eloRating);
        const winLossRecord = this.getWinLossRecord(film);
        
        let rankDisplay = `#${displayRank}`;
        let rankClass = 'detail-rank';
        
        if (film.isTied) {
            rankDisplay = `T${displayRank}`;
            rankClass = 'detail-rank tied-rank';
        }

        const { wins, losses } = this.getDetailedMatchups(film);
        
        return `
            <div class="detail-card">
                <div class="detail-header">
                    <div class="${rankClass}">${rankDisplay}</div>
                    <div class="detail-title">${film.title}</div>
                </div>
                
                <div class="detail-thumbnail ${film.link ? 'clickable-film-thumbnail' : ''}" style="${thumbnailStyle}" ${film.link ? `onclick="window.open('${film.link}', '_blank')" title="Click to watch film"` : ''}></div>
                
                <div class="detail-stats">
                    <div class="stat-item">
                        <div class="stat-label">Total Wins</div>
                        <div class="stat-value">${film.wins || 0}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Win Rate</div>
                        <div class="stat-value">${this.calculateWinRate(film)}%</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Record</div>
                        <div class="stat-value">${winLossRecord}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">ELO Rating</div>
                        <div class="stat-value elo-rating ${eloClass}">${eloRating}</div>
                    </div>
                </div>

                <div class="detail-toggle-section">
                    <button id="detailToggleBtn" class="btn btn-secondary detail-toggle-btn" onclick="app.toggleDetailSections()">
                        <span id="toggleIcon">${this.detailSectionsHidden ? '▶' : '▼'}</span> ${this.detailSectionsHidden ? 'Show' : 'Hide'} Details
                    </button>
                </div>

                <div id="detailSections" class="detail-sections" style="${this.detailSectionsHidden ? 'display: none;' : ''}">
                <div class="matchups-section">
                    <div class="matchups-title">Head-to-Head Record</div>
                    <div class="matchups-grid">
                        <div class="matchup-category wins">
                            <div class="matchup-header wins">
                                ✅ Defeats (${wins.length})
                            </div>
                            ${wins.length > 0 ? this.createMatchupListHTML(wins, film.id, true) : '<div class="empty-matchups">No victories yet</div>'}
                        </div>
                        <div class="matchup-category losses">
                            <div class="matchup-header losses">
                                ❌ Defeated By (${losses.length})
                            </div>
                            ${losses.length > 0 ? this.createMatchupListHTML(losses, film.id, false) : '<div class="empty-matchups">Undefeated!</div>'}
                        </div>
                    </div>
                </div>

                <div class="add-matchup-section">
                    <div class="matchups-title">Add New Matchup</div>
                    <div class="add-matchup-controls">
                        <select id="newMatchupOpponent-${film.id}" class="matchup-select">
                            <option value="">Select a film to compare with...</option>
                            ${this.getAvailableOpponents(film).map(opponent => 
                                `<option value="${opponent.id}">${opponent.title}</option>`
                            ).join('')}
                        </select>
                        <div class="matchup-result-buttons">
                            <button class="btn btn-success btn-small" onclick="app.addMatchup(${film.id}, document.getElementById('newMatchupOpponent-${film.id}').value, 'win')" title="${film.title} wins">
                                ${film.title} Wins
                            </button>
                            <button class="btn btn-danger btn-small" onclick="app.addMatchup(${film.id}, document.getElementById('newMatchupOpponent-${film.id}').value, 'loss')" title="${film.title} loses">
                                ${film.title} Loses
                            </button>
                        </div>
                    </div>
                </div>

                <div class="detail-actions">
                    <button class="btn btn-secondary" onclick="app.editFilm(${film.id})">Edit Film</button>
                    <button class="btn btn-danger" onclick="app.deleteFilm(${film.id})">Delete Film</button>
                    ${film.link ? `<button class="btn btn-primary" onclick="window.open('${film.link}', '_blank')">Watch Film</button>` : ''}
                </div>
                </div>
            </div>
        `;
    }

    getDetailedMatchups(film) {
        const wins = [];
        const losses = [];
        
        if (!film.comparisons) return { wins, losses };
        
        Object.keys(film.comparisons).forEach(opponentId => {
            const opponent = this.films.find(f => f.id == opponentId);
            if (!opponent) return;
            
            const result = film.comparisons[opponentId];
            if (result === 'win') {
                wins.push(opponent);
            } else if (result === 'loss') {
                losses.push(opponent);
            }
        });
        
        // Sort by opponent ranking
        wins.sort((a, b) => a.overallRank - b.overallRank);
        losses.sort((a, b) => a.overallRank - b.overallRank);
        
        return { wins, losses };
    }

    createMatchupListHTML(films, currentFilmId, isWins) {
        return `
            <ul class="matchup-list">
                ${films.map(film => `
                    <li class="matchup-item">
                        <div class="matchup-thumbnail" style="${film.thumbnailUrl ? `background-image: url(${film.thumbnailUrl}); background-size: cover; background-position: center;` : 'background: #dee2e6;'}"></div>
                        <div class="matchup-name">${film.title}</div>
                        <div class="matchup-actions">
                            <button class="btn-small btn-danger" onclick="app.removeMatchup(${currentFilmId}, ${film.id})" title="Remove this matchup">✕</button>
                            <button class="btn-small btn-secondary" onclick="app.flipMatchup(${currentFilmId}, ${film.id})" title="Flip result (${isWins ? 'make this a loss' : 'make this a win'})">${isWins ? '⇅' : '⇅'}</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    calculateWinRate(film) {
        if (!film.comparisons || Object.keys(film.comparisons).length === 0) {
            return 0;
        }
        
        const totalMatches = Object.keys(film.comparisons).length;
        const wins = film.wins || 0;
        
        return Math.round((wins / totalMatches) * 100);
    }

    navigateDetail(direction) {
        this.currentDetailIndex += direction;
        this.updateDisplay();
    }

    navigateToFirst() {
        this.currentDetailIndex = 0;
        this.updateDisplay();
    }

    navigateToLast() {
        // Use the same sorting as showDetailView to ensure consistency
        // Sort films by ELO rating (descending) for detail view
        const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || b.elo || 1200) - (a.eloRating || a.elo || 1200));
        
        this.currentDetailIndex = sortedFilms.length - 1;
        this.updateDisplay();
    }

    toggleDetailSections() {
        const sectionsElement = document.getElementById('detailSections');
        const toggleBtn = document.getElementById('detailToggleBtn');
        
        // Toggle the state
        this.detailSectionsHidden = !this.detailSectionsHidden;
        
        if (this.detailSectionsHidden) {
            // Hide sections
            sectionsElement.style.display = 'none';
            toggleBtn.innerHTML = '<span id="toggleIcon">▶</span> Show Details';
        } else {
            // Show sections
            sectionsElement.style.display = 'block';
            toggleBtn.innerHTML = '<span id="toggleIcon">▼</span> Hide Details';
        }
    }

    jumpToFilmDetail(filmId) {
        // Use the same sorting as showDetailView to ensure consistency
        // Sort films by ELO rating (descending) for detail view
        const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || b.elo || 1200) - (a.eloRating || a.elo || 1200));
        
        // Find the index of the film in sorted order
        const filmIndex = sortedFilms.findIndex(film => film.id === filmId);
        
        if (filmIndex !== -1) {
            this.currentDetailIndex = filmIndex;
            this.setViewMode('detail', false); // Don't reset the index
        }
    }

    removeMatchup(filmId, opponentId) {
        const film = this.films.find(f => f.id === filmId);
        const opponent = this.films.find(f => f.id === opponentId);
        
        if (!film || !opponent) return;
        
        if (confirm(`Remove the matchup between "${film.title}" and "${opponent.title}"?\n\nThis will delete their head-to-head record.`)) {
            // Save the current film ID if in detail view to restore position later
            const wasInDetailView = this.currentView === 'detail';
            const currentFilmId = wasInDetailView ? filmId : null;
            
            // Remove the head-to-head consistently
            this.removeHeadToHead(film, opponent);
            
            // Recalculate rankings and ELO
            this.recalculateAllRanks();
            this.recalculateEloRatings();
            this.saveData();
            
            // If we were in detail view, restore the position to the same film
            if (wasInDetailView && currentFilmId) {
                const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || b.elo || 1200) - (a.eloRating || a.elo || 1200));
                const newIndex = sortedFilms.findIndex(f => f.id === currentFilmId);
                if (newIndex !== -1) {
                    this.currentDetailIndex = newIndex;
                }
            }
            
            this.updateDisplay();
            this.showSuccessMessage(`Removed matchup between "${film.title}" and "${opponent.title}"`);
        }
    }

    flipMatchup(filmId, opponentId) {
        const film = this.films.find(f => f.id === filmId);
        const opponent = this.films.find(f => f.id === opponentId);
        
        if (!film || !opponent) return;
        
        // Save the current film ID if in detail view to restore position later
        const wasInDetailView = this.currentView === 'detail';
        const currentFilmId = wasInDetailView ? filmId : null;
        
        // Ensure both films have comparison objects
        if (!film.comparisons) film.comparisons = {};
        if (!opponent.comparisons) opponent.comparisons = {};
        
        const currentResult = film.comparisons ? film.comparisons[opponentId] : undefined;

        if (currentResult === 'win') {
            // Flip from win to loss
            this.setHeadToHead(film, opponent, 'loss');
            this.showSuccessMessage(`Flipped result: "${opponent.title}" now beats "${film.title}"`);
        } else if (currentResult === 'loss') {
            // Flip from loss to win
            this.setHeadToHead(film, opponent, 'win');
            this.showSuccessMessage(`Flipped result: "${film.title}" now beats "${opponent.title}"`);
        } else {
            // No existing matchup, create a win for the current film
            this.setHeadToHead(film, opponent, 'win');
            this.showSuccessMessage(`Created new matchup: "${film.title}" beats "${opponent.title}"`);
        }
        
        // Recalculate rankings and ELO
        this.recalculateAllRanks();
        this.recalculateEloRatings();
        this.saveData();
        
        // If we were in detail view, restore the position to the same film
        if (wasInDetailView && currentFilmId) {
            // Sort films same way as detail view to find new index
            const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || b.elo || 1200) - (a.eloRating || a.elo || 1200));
            const newIndex = sortedFilms.findIndex(f => f.id === currentFilmId);
            if (newIndex !== -1) {
                this.currentDetailIndex = newIndex;
            }
        }
        
        this.updateDisplay();
    }

    getAvailableOpponents(currentFilm) {
        // Return all films except the current one
        return this.films.filter(film => film.id !== currentFilm.id);
    }

    addMatchup(filmId, opponentId, result) {
        if (!opponentId) {
            alert('Please select a film to compare with.');
            return;
        }
        
        const film = this.films.find(f => f.id === filmId);
        const opponent = this.films.find(f => f.id === parseInt(opponentId));
        
        if (!film || !opponent) return;
        
        // Ensure both films have comparison objects
        if (!film.comparisons) film.comparisons = {};
        if (!opponent.comparisons) opponent.comparisons = {};
        
        // If matchup exists and user doesn't want to overwrite, bail
        if (film.comparisons[opponentId]) {
            if (!confirm(`A matchup between "${film.title}" and "${opponent.title}" already exists. Do you want to overwrite it?`)) {
                return;
            }
        }

        // Save the current film ID if in detail view to restore position later
        const wasInDetailView = this.currentView === 'detail';
        const currentFilmId = wasInDetailView ? filmId : null;
        
        // Use centralized setter
        if (result === 'win') {
            this.setHeadToHead(film, opponent, 'win');
            this.showSuccessMessage(`Added matchup: "${film.title}" beats "${opponent.title}"`);
        } else {
            this.setHeadToHead(film, opponent, 'loss');
            this.showSuccessMessage(`Added matchup: "${opponent.title}" beats "${film.title}"`);
        }
        
        // Clear the selection
        const select = document.getElementById(`newMatchupOpponent-${filmId}`);
        if (select) select.value = '';
        
        // Recalculate rankings and ELO
        this.recalculateAllRanks();
        this.recalculateEloRatings();
        this.saveData();
        
        // If we were in detail view, restore the position to the same film
        if (wasInDetailView && currentFilmId) {
            const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || b.elo || 1200) - (a.eloRating || a.elo || 1200));
            const newIndex = sortedFilms.findIndex(f => f.id === currentFilmId);
            if (newIndex !== -1) {
                this.currentDetailIndex = newIndex;
            }
        }
        
        this.updateDisplay();
    }

    recalculateEloRatings() {
        // Reset all ratings to starting value
        this.films.forEach(film => {
            if (film.eloRating === undefined) film.eloRating = 1200;
            film.eloRating = 1200; // Reset for recalculation
        });

        // Collect all comparisons - ensure we have all unique matchups
        const allComparisons = [];
        const processedPairs = new Set();
        
        this.films.forEach(filmA => {
            if (!filmA.comparisons) return;
            
            Object.keys(filmA.comparisons).forEach(filmBId => {
                const filmB = this.films.find(f => f.id == filmBId);
                if (!filmB) return;
                
                // Create a unique pair identifier (always use smaller ID first)
                const pairId = `${Math.min(filmA.id, filmB.id)}-${Math.max(filmA.id, filmB.id)}`;
                
                if (!processedPairs.has(pairId)) {
                    processedPairs.add(pairId);
                    
                    const result = filmA.comparisons[filmBId];
                    if (result === 'win') {
                        allComparisons.push({
                            winner: filmA,
                            loser: filmB
                        });
                    } else if (result === 'loss') {
                        allComparisons.push({
                            winner: filmB,
                            loser: filmA
                        });
                    }
                }
            });
        });

        // Use a limited iteration approach with diminishing K-factor
        // but keep deterministic order for consistent results
        const maxIterations = 10;
        const initialKFactor = 32;
        
        // Sort comparisons deterministically by film IDs for consistent results
        const sortedComparisons = [...allComparisons].sort((a, b) => {
            const aKey = a.winner.id * 1000000 + a.loser.id;
            const bKey = b.winner.id * 1000000 + b.loser.id;
            return aKey - bKey;
        });
        
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // Use diminishing K-factor to prevent extreme rating collapse
            const kFactor = initialKFactor * Math.pow(0.7, iteration);
            
            sortedComparisons.forEach(comparison => {
                const { winner, loser } = comparison;
                const ratingWinner = winner.eloRating;
                const ratingLoser = loser.eloRating;
                
                // Winner gets score 1, loser gets score 0
                const newRatingWinner = this.calculateEloRating(ratingWinner, ratingLoser, 1, kFactor);
                const newRatingLoser = this.calculateEloRating(ratingLoser, ratingWinner, 0, kFactor);
                
                winner.eloRating = newRatingWinner;
                loser.eloRating = newRatingLoser;
            });
        }
        
        console.log(`ELO ratings calculated using ${maxIterations} iterations with diminishing K-factor (deterministic order)`);
    }

    handleRecalculateElo() {
        if (this.films.length === 0) {
            alert('No films to recalculate ELO for. Add some items first!');
            return;
        }

        if (confirm('Recalculate all ELO ratings based on comparison history?\n\nThis will produce consistent, deterministic results each time.')) {
            console.log('Recalculating ELO ratings...');
            this.recalculateEloRatings();
            this.saveData();
            this.updateDisplay();
            this.showSuccessMessage('✅ ELO ratings recalculated successfully!');
            
            // If in ELO view, refresh it
            if (this.currentView === 'elo') {
                this.showEloView();
            }
        }
    }

    handleValidateAll() {
        if (this.films.length === 0) {
            alert('No films to validate. Add some items first!');
            return;
        }

        console.log('Running comprehensive validation...');
        const result = this.validateAndFixComparisons();
        
        let message = '✅ Validation Complete!\n\n';
        
        if (result.fixedCount === 0 && result.removedCount === 0) {
            message += 'No issues found. All comparisons are valid and reciprocal!';
        } else {
            if (result.fixedCount > 0) {
                message += `Fixed ${result.fixedCount} broken or one-sided comparison${result.fixedCount > 1 ? 's' : ''}.\n`;
            }
            if (result.removedCount > 0) {
                message += `Removed ${result.removedCount} orphaned comparison${result.removedCount > 1 ? 's' : ''}.\n`;
            }
            message += '\nData has been updated and saved.';
        }
        
        alert(message);
        this.saveData();
        this.updateDisplay();
    }

    recheckComparisons() {
        if (this.films.length < 2) {
            alert('You need at least 2 films to compare!');
            return;
        }

        // Find all missing AND broken comparisons
        const missingComparisons = [];
        const brokenComparisons = [];
        
        for (let i = 0; i < this.films.length; i++) {
            for (let j = i + 1; j < this.films.length; j++) {
                const filmA = this.films[i];
                const filmB = this.films[j];
                
                const aHasB = filmA.comparisons && filmA.comparisons[filmB.id];
                const bHasA = filmB.comparisons && filmB.comparisons[filmA.id];
                
                // Check if BOTH sides exist (reciprocal comparison)
                if (!aHasB && !bHasA) {
                    // Completely missing comparison
                    missingComparisons.push({ filmA, filmB });
                } else if (!aHasB || !bHasA) {
                    // One-sided comparison (broken reciprocity)
                    brokenComparisons.push({ filmA, filmB, aHasB, bHasA });
                } else {
                    // Both exist - verify they are reciprocal (win vs loss)
                    const aResult = filmA.comparisons[filmB.id];
                    const bResult = filmB.comparisons[filmA.id];
                    
                    const isReciprocal = (aResult === 'win' && bResult === 'loss') || 
                                        (aResult === 'loss' && bResult === 'win');
                    
                    if (!isReciprocal) {
                        brokenComparisons.push({ 
                            filmA, 
                            filmB, 
                            aHasB: true, 
                            bHasA: true,
                            aResult,
                            bResult,
                            inconsistent: true
                        });
                    }
                }
            }
        }

        const totalIssues = missingComparisons.length + brokenComparisons.length;
        
        if (totalIssues === 0) {
            alert('✅ All films have been compared!\n\nNo missing or broken comparisons found.');
            return;
        }

        // Show detailed report
        const totalPairs = (this.films.length * (this.films.length - 1)) / 2;
        const completedPairs = totalPairs - totalIssues;
        
        let message = `Found ${totalIssues} issue${totalIssues > 1 ? 's' : ''}:\n\n`;
        
        if (missingComparisons.length > 0) {
            message += `❌ ${missingComparisons.length} missing comparison${missingComparisons.length > 1 ? 's' : ''}\n`;
        }
        
        if (brokenComparisons.length > 0) {
            message += `⚠️ ${brokenComparisons.length} broken/one-sided comparison${brokenComparisons.length > 1 ? 's' : ''}\n`;
        }
        
        message += `\nProgress: ${completedPairs}/${totalPairs} pairs valid (${Math.round(completedPairs/totalPairs*100)}%)\n\n`;
        message += `Do you want to fix these issues now?`;
        
        if (confirm(message)) {
            // Queue up all issues for comparison
            // For broken comparisons, we'll re-compare them to fix the reciprocity
            const allIssues = [
                ...missingComparisons.map(pair => ({
                    newFilm: pair.filmA,
                    existingFilm: pair.filmB
                })),
                ...brokenComparisons.map(pair => ({
                    newFilm: pair.filmA,
                    existingFilm: pair.filmB
                }))
            ];
            
            this.comparisonQueue = allIssues;
            
            console.log(`Queued ${this.comparisonQueue.length} comparisons to fix (${missingComparisons.length} missing + ${brokenComparisons.length} broken)`);
            this.comparisonHistory = []; // Clear undo history for this session
            this.processNextComparison();
        }
    }

    createEloFilmHTML(film, rank) {
        const thumbnailStyle = film.thumbnailUrl ? 
            `background-image: url(${film.thumbnailUrl}); background-size: cover; background-position: center;` : 
            'background: #f8f9fa;';
        
        const eloRating = Math.round(film.eloRating || 1200);
        const eloClass = this.getEloRatingClass(eloRating);
        
        return `
            <div class="film-item elo-item">
                <div class="film-rank elo-rank ${eloClass}">#${rank}</div>
                <div class="film-thumbnail clickable-thumbnail" style="${thumbnailStyle}" onclick="app.jumpToFilmDetail(${film.id})" title="Click to view details"></div>
                <div class="film-info">
                    <div class="film-title">${film.title}</div>
                    <div class="film-details">
                        ELO: <span class="elo-rating ${eloClass}">${eloRating}</span> | 
                        Wins: ${film.wins || 0} | 
                        Record: ${this.getWinLossRecord(film)}
                    </div>
                </div>
                <div class="film-actions">
                    <button class="btn btn-danger" onclick="app.deleteFilm(${film.id})">Delete</button>
                    <button class="btn btn-secondary" onclick="app.editFilm(${film.id})">Edit</button>
                    ${film.link ? `<button class="btn btn-primary" onclick="window.open('${film.link}', '_blank')">Play</button>` : ''}
                </div>
            </div>
        `;
    }

    getEloRatingClass(rating) {
        if (rating >= 1600) return 'elo-master';
        if (rating >= 1400) return 'elo-expert';
        if (rating >= 1200) return 'elo-intermediate';
        return 'elo-beginner';
    }

    getWinLossRecord(film) {
        if (!film.comparisons) return '0-0';
        
        let wins = 0;
        let losses = 0;
        
        Object.values(film.comparisons).forEach(result => {
            if (result === 'win') wins++;
            else if (result === 'loss') losses++;
        });
        
        return `${wins}-${losses}`;
    }

    createTreeNodeHTML(film, isWinner, isTied) {
        const thumbnailStyle = film.thumbnailUrl ? 
            `background-image: url(${film.thumbnailUrl}); background-size: cover; background-position: center;` : 
            'background: #f8f9fa;';
        
        let nodeClass = 'tree-node';
        if (isWinner) nodeClass += ' winner';
        else if (isTied) nodeClass += ' tied';
        
        let rankDisplay = `#${film.overallRank + 1}`;
        if (film.isTied) rankDisplay = `T${film.overallRank + 1}`;
        
        return `
            <div class="${nodeClass}">
                <div class="node-rank">${rankDisplay}</div>
                <div class="node-thumbnail clickable-thumbnail" style="${thumbnailStyle}" onclick="app.jumpToFilmDetail(${film.id})" title="Click to view details"></div>
                <div class="node-title">${film.title}</div>
                <div class="node-wins">Wins: ${film.wins || 0}</div>
            </div>
        `;
    }

    createGridItemHTML(film, displayRank) {
        const thumbnailStyle = film.thumbnailUrl ? 
            `background-image: url(${film.thumbnailUrl}); background-size: cover; background-position: center;` : 
            'background: #f8f9fa;';
        
        let rankDisplay = `#${displayRank}`;
        let rankClass = 'grid-rank';
        let itemClass = 'grid-item';
        
        if (film.isTied) {
            rankDisplay = `T${displayRank}`;
            rankClass = 'grid-rank tied-grid-rank';
            itemClass = 'grid-item tied-grid-item';
        }
        
        return `
            <div class="${itemClass}">
                <div class="grid-thumbnail clickable-thumbnail" style="${thumbnailStyle}" onclick="app.jumpToFilmDetail(${film.id})" title="Click to view details">
                    <div class="${rankClass}">${rankDisplay}</div>
                </div>
                <div class="grid-info">
                    <div class="grid-title">${film.title}</div>
                    <div class="grid-wins">Wins: ${film.wins || 0}</div>
                </div>
                <div class="grid-actions">
                    <button class="btn btn-danger" onclick="app.deleteFilm(${film.id})">Del</button>
                    <button class="btn btn-secondary" onclick="app.editFilm(${film.id})">Edit</button>
                    ${film.link ? `<button class="btn btn-primary" onclick="window.open('${film.link}', '_blank')">Play</button>` : ''}
                </div>
            </div>
        `;
    }

    exportRankings() {
        const data = {
            films: this.films,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `film-rankings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSuccessMessage('Rankings exported successfully!');
    }

    calculateTiers() {
        if (this.films.length === 0) {
            return [];
        }

        // Make sure ELO ratings are updated
        this.recalculateEloRatings();
        
        // Sort films by ELO rating (highest to lowest)
        const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || 1200) - (a.eloRating || 1200));
        
        // Tier thresholds based on statistical distribution
        // S: Top 5%
        // A: Next 10%
        // B: Next 20%
        // C: Next 30%
        // D: Next 20%
        // F: Bottom 15%
        
        const thresholds = [
            { tier: 'S', percentile: 0.05, color: '#FF7F7F' },  // Red
            { tier: 'A', percentile: 0.15, color: '#FFBF7F' },  // Orange
            { tier: 'B', percentile: 0.35, color: '#FFFF7F' },  // Yellow
            { tier: 'C', percentile: 0.65, color: '#7FFF7F' },  // Green
            { tier: 'D', percentile: 0.85, color: '#7F7FFF' },  // Blue
            { tier: 'F', percentile: 1.00, color: '#BF7FBF' }   // Purple
        ];
        
        const totalFilms = sortedFilms.length;
        const tieredFilms = [];
        
        // Assign tiers based on percentile thresholds
        for (let i = 0; i < sortedFilms.length; i++) {
            const film = sortedFilms[i];
            const percentile = (i + 1) / totalFilms;
            
            // Find the appropriate tier
            const tierInfo = thresholds.find(t => percentile <= t.percentile);
            
            tieredFilms.push({
                ...film,
                tier: tierInfo.tier,
                tierColor: tierInfo.color
            });
        }
        
        return tieredFilms;
    }
    
    async exportTierlist() {
        if (this.films.length === 0) {
            alert('No films to export. Please add some films first.');
            return;
        }
        
        // Show loading message
        this.showSuccessMessage('Generating tierlist...', 10000);
        
        // Calculate tiers for all films
        const tieredFilms = this.calculateTiers();
        
        // Create a temporary container for the tierlist
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 1400px;
            background: #1a1a1a;
            padding: 20px;
            font-family: 'Arial', sans-serif;
        `;
        document.body.appendChild(tempContainer);
        
        try {
            // Create the header
            const header = document.createElement('div');
            header.style.cssText = `
                text-align: center;
                margin-bottom: 20px;
            `;
            
            const title = document.createElement('h1');
            title.style.cssText = `
                font-size: 28px;
                margin: 0;
                color: #ffffff;
            `;
            title.textContent = 'Film Tierlist';
            
            const subtitle = document.createElement('p');
            subtitle.style.cssText = `
                font-size: 14px;
                margin: 5px 0 0;
                color: #b0b0b0;
            `;
            subtitle.textContent = `Generated on ${new Date().toLocaleDateString()} - ${this.films.length} films`;
            
            header.appendChild(title);
            header.appendChild(subtitle);
            tempContainer.appendChild(header);
            
            // Group films by tier
            const tierGroups = {};
            const tiers = ['S', 'A', 'B', 'C', 'D', 'F'];
            
            tiers.forEach(tier => {
                tierGroups[tier] = tieredFilms.filter(film => film.tier === tier);
            });
            
            // Create the tierlist
            const tierlist = document.createElement('div');
            tierlist.style.cssText = `
                border: 1px solid #404040;
                border-radius: 8px;
                overflow: hidden;
                background: #2d2d2d;
            `;
            
            // Add each tier
            tiers.forEach(tier => {
                const films = tierGroups[tier];
                if (films.length === 0) return;
                
                // Get the tier color from the first film
                const tierColor = films[0].tierColor;
                
                const tierRow = document.createElement('div');
                tierRow.style.cssText = `
                    display: flex;
                    border-bottom: 1px solid #404040;
                    min-height: 90px;
                    background: #333333;
                `;
                
                // Tier label
                const tierLabel = document.createElement('div');
                tierLabel.style.cssText = `
                    width: 80px;
                    background-color: ${tierColor};
                    color: #000;
                    font-size: 32px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    border-right: 1px solid #404040;
                `;
                tierLabel.textContent = tier;
                
                // Films container
                const filmsContainer = document.createElement('div');
                filmsContainer.style.cssText = `
                    display: flex;
                    flex-wrap: wrap;
                    padding: 10px;
                    gap: 10px;
                    flex: 1;
                `;
                
                // Add films to the container
                films.forEach(film => {
                    const filmItem = document.createElement('div');
                    filmItem.style.cssText = `
                        width: 160px;
                        height: 90px;
                        background-color: #1a1a1a;
                        border: 1px solid #555555;
                        border-radius: 4px;
                        overflow: hidden;
                        position: relative;
                        ${film.thumbnailUrl ? `
                            background-image: url(${film.thumbnailUrl});
                            background-size: cover;
                            background-position: center;
                        ` : ''}
                    `;
                    
                    if (!film.thumbnailUrl) {
                        const noThumbnail = document.createElement('div');
                        noThumbnail.style.cssText = `
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #888888;
                            font-size: 10px;
                        `;
                        noThumbnail.textContent = 'No Image';
                        filmItem.appendChild(noThumbnail);
                    }
                    
                    // Film title overlay
                    const titleOverlay = document.createElement('div');
                    titleOverlay.style.cssText = `
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: rgba(0, 0, 0, 0.8);
                        color: #fff;
                        padding: 4px 6px;
                        font-size: 10px;
                        text-align: center;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    `;
                    titleOverlay.textContent = film.title;
                    filmItem.appendChild(titleOverlay);
                    
                    filmsContainer.appendChild(filmItem);
                });
                
                tierRow.appendChild(tierLabel);
                tierRow.appendChild(filmsContainer);
                
                tierlist.appendChild(tierRow);
            });
            
            // Remove border from the last tier row
            const tierRows = tierlist.querySelectorAll('div[style*="border-bottom"]');
            if (tierRows.length > 0) {
                tierRows[tierRows.length - 1].style.borderBottom = 'none';
            }
            
            tempContainer.appendChild(tierlist);
            
            // Add a small delay to allow images to load
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Create footer with legend
            const footer = document.createElement('div');
            footer.style.cssText = `
                margin-top: 20px;
                display: flex;
                justify-content: space-between;
                color: #888888;
                font-size: 12px;
            `;
            
            const legend = document.createElement('div');
            legend.style.cssText = `
                display: flex;
                gap: 10px;
                align-items: center;
            `;
            
            const tierLegend = document.createElement('span');
            tierLegend.textContent = 'Tiers: S (Top 5%), A (Next 10%), B (Next 20%), C (Next 30%), D (Next 20%), F (Bottom 15%)';
            
            legend.appendChild(tierLegend);
            footer.appendChild(legend);
            
            const credit = document.createElement('div');
            credit.style.cssText = `
                color: #888888;
            `;
            credit.textContent = 'Generated by OoO Tierlist';
            footer.appendChild(credit);
            
            tempContainer.appendChild(footer);
            
            // Convert to image and download
            html2canvas(tempContainer, {
                backgroundColor: '#1a1a1a',
                scale: 2, // Higher resolution
                useCORS: true, // Allow cross-origin images
                allowTaint: true // Allow potentially tainted images
            }).then(canvas => {
                const url = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = url;
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                a.download = `film-tierlist-${timestamp}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.showSuccessMessage('Tierlist exported as image!');
            });
        } catch (error) {
            console.error('Export error:', error);
            alert('Error generating tierlist image. Please try again.');
        } finally {
            // Clean up
            document.body.removeChild(tempContainer);
        }
    }
    
    exportLinks() {
        if (this.films.length === 0) {
            alert('No films to export. Please add some films first.');
            return;
        }

        // Sort films by rank (lower rank number = higher position)
        const sortedFilms = [...this.films].sort((a, b) => a.overallRank - b.overallRank);
        
        // Create text content with each film's link on a separate line
        const linksText = sortedFilms
            .filter(film => film.videoLink || film.link) // Only include films that have links
            .map(film => film.videoLink || film.link) // Get the link from either property
            .join('\n');
        
        if (linksText.trim() === '') {
            alert('No films with video links found to export.');
            return;
        }
        
        // Create and download the .txt file
        const blob = new Blob([linksText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `film-links-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSuccessMessage('Film links exported successfully!');
    }

    showExportSettingsModal() {
        if (this.films.length === 0) {
            alert('No films to export. Please add some films first.');
            return;
        }

        const modal = document.getElementById('exportSettingsModal');
        const topNInput = document.getElementById('topNInput');
        const maxFilmsHint = document.getElementById('maxFilmsHint');
        
        // Set up the form
        topNInput.max = this.films.length;
        topNInput.value = Math.min(10, this.films.length);
        maxFilmsHint.textContent = this.films.length;
        
        modal.style.display = 'block';
        
        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.hideExportSettingsModal();
            }
        };
        
        // Close modal with X button
        modal.querySelector('.close').onclick = () => this.hideExportSettingsModal();
    }

    hideExportSettingsModal() {
        document.getElementById('exportSettingsModal').style.display = 'none';
    }

    handleExportConfirm() {
        const topNInput = document.getElementById('topNInput');
        const gridColumnsInput = document.getElementById('gridColumnsInput');
        const includeQRCodes = document.getElementById('includeQRCodes').checked;
        
        const n = parseInt(topNInput.value);
        const columns = parseInt(gridColumnsInput.value);
        
        // Validation
        if (isNaN(n) || n < 1 || n > this.films.length) {
            alert(`Please enter a valid number of films between 1 and ${this.films.length}.`);
            return;
        }
        
        if (isNaN(columns) || columns < 1) {
            alert('Please enter a valid number of columns (minimum 1).');
            return;
        }
        
        this.hideExportSettingsModal();
        this.generateTopNImage(n, columns, includeQRCodes);
    }

    exportAsImage() {
        // This method is now replaced by showExportSettingsModal
        this.showExportSettingsModal();
    }

    async generateTopNImage(n, columns = 2, includeQRCodes = false) {
        // Recalculate ELO to ensure we have the latest rankings
        this.recalculateEloRatings();
        
        // Sort films by ELO rating (descending) to get top N
        const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || 1200) - (a.eloRating || 1200));
        const topFilms = sortedFilms.slice(0, n);

        // Create a temporary container for rendering
        const tempContainer = document.createElement('div');
        const cardWidth = 280; // Fixed card width
        const containerWidth = Math.max(600, columns * cardWidth + (columns - 1) * 20 + 40); // Dynamic width based on columns
        tempContainer.style.cssText = `
            position: absolute;
            top: -10000px;
            left: -10000px;
            width: ${containerWidth}px;
            background: #f8f9fa;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Add title
        const title = document.createElement('div');
        title.style.cssText = `
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #212529;
        `;
        title.textContent = `Top ${n} OoO Rankings`;
        tempContainer.appendChild(title);

        // Create grid container for films
        const gridContainer = document.createElement('div');
        gridContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${columns}, ${cardWidth}px);
            gap: 20px;
            margin-bottom: 20px;
            justify-content: center;
        `;
        tempContainer.appendChild(gridContainer);

        // Generate cards for each film in grid layout
        for (let i = 0; i < topFilms.length; i++) {
            const film = topFilms[i];
            const rank = i + 1;
            
            const card = await this.createImageDetailCard(film, rank);
            gridContainer.appendChild(card);
        }

        // Add QR codes section if requested
        if (includeQRCodes) {
            // Add a delay to ensure QR library is fully loaded
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.addQRCodesSection(tempContainer, topFilms);
        }

        document.body.appendChild(tempContainer);

        try {
            // Use html2canvas to convert to image
            const canvas = await html2canvas(tempContainer, {
                backgroundColor: '#f8f9fa',
                scale: 2, // Higher resolution
                useCORS: true,
                allowTaint: true
            });

            // Create download link
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const timestamp = new Date().toISOString().split('T')[0];
                const qrSuffix = includeQRCodes ? '-with-qr' : '';
                a.download = `top-${n}-ooo-rankings-${columns}col${qrSuffix}-${timestamp}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.showSuccessMessage(`Top ${n} rankings exported as image!`);
            });
        } catch (error) {
            console.error('Export error:', error);
            alert('Error generating image. Please try again or try with fewer films.');
        } finally {
            // Clean up
            document.body.removeChild(tempContainer);
        }
    }

    async addQRCodesSection(container, films) {
        // Filter films that have video links
        const filmsWithLinks = films.filter(film => film.videoLink || film.link);
        
        if (filmsWithLinks.length === 0) {
            // Add a message if no films have links
            const noLinksMessage = document.createElement('div');
            noLinksMessage.style.cssText = `
                text-align: center;
                font-size: 16px;
                color: #6c757d;
                margin: 30px 0 20px 0;
                padding: 20px;
                border-top: 2px solid #dee2e6;
            `;
            noLinksMessage.textContent = 'No films with video links available for QR codes';
            container.appendChild(noLinksMessage);
            return;
        }

        // Add section title
        const qrTitle = document.createElement('div');
        qrTitle.style.cssText = `
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin: 30px 0 20px 0;
            color: #212529;
            border-top: 2px solid #dee2e6;
            padding-top: 20px;
        `;
        qrTitle.textContent = 'Video Links (QR Codes)';
        container.appendChild(qrTitle);

        // Create QR codes grid
        const qrGrid = document.createElement('div');
        qrGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        `;
        container.appendChild(qrGrid);

        // Add QR codes for films with links
        for (let i = 0; i < films.length; i++) {
            const film = films[i];
            // Check both possible property names for the video link
            const videoLink = film.videoLink || film.link;
            if (videoLink) {
                console.log(`Generating QR code for film: ${film.title}, Link: ${videoLink}`);
                const qrCard = await this.createQRCard(film, i + 1);
                qrGrid.appendChild(qrCard);
            }
        }
    }

    async createQRCard(film, rank) {
        const qrCard = document.createElement('div');
        qrCard.style.cssText = `
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 15px;
            text-align: center;
            border: 1px solid #dee2e6;
        `;

        // Get the video link from either property
        const videoLink = film.videoLink || film.link;

        if (!videoLink) {
            // No video link available
            const noLinkDiv = document.createElement('div');
            noLinkDiv.style.cssText = `
                width: 120px;
                height: 120px;
                background: #f8f9fa;
                border: 2px dashed #dee2e6;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: #6c757d;
                margin: 0 auto;
            `;
            noLinkDiv.textContent = 'No Link';
            qrCard.appendChild(noLinkDiv);
        } else {
            // Try to create QR code
            const qrContainer = document.createElement('div');
            qrContainer.style.cssText = `
                width: 120px;
                height: 120px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            try {
                // Check for QRCode library in multiple ways
                let QRCodeLib = null;
                if (typeof window.QRCode !== 'undefined') {
                    QRCodeLib = window.QRCode;
                } else if (typeof QRCode !== 'undefined') {
                    QRCodeLib = QRCode;
                } else {
                    // Fallback: Use QR Server API
                    const qrImage = document.createElement('img');
                    qrImage.style.cssText = `
                        width: 120px;
                        height: 120px;
                        border: 1px solid #dee2e6;
                    `;
                    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(videoLink)}`;
                    qrImage.alt = 'QR Code';
                    
                    // Handle image load errors
                    qrImage.onerror = () => {
                        qrImage.style.display = 'none';
                        const fallbackDiv = document.createElement('div');
                        fallbackDiv.style.cssText = `
                            width: 120px;
                            height: 120px;
                            background: #fff3cd;
                            border: 2px dashed #ffc107;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 10px;
                            color: #856404;
                            text-align: center;
                        `;
                        fallbackDiv.textContent = 'QR Failed';
                        qrContainer.appendChild(fallbackDiv);
                    };
                    
                    qrContainer.appendChild(qrImage);
                    qrCard.appendChild(qrContainer);
                    
                    // Add film title and rank
                    const qrLabel = document.createElement('div');
                    qrLabel.style.cssText = `
                        margin-top: 10px;
                        font-size: 12px;
                        font-weight: bold;
                        color: #212529;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        max-width: 150px;
                        margin-left: auto;
                        margin-right: auto;
                    `;
                    qrLabel.textContent = `#${rank} ${film.title}`;
                    qrCard.appendChild(qrLabel);
                    
                    return qrCard;
                }

                // Wait a bit more to ensure the library is fully loaded
                await new Promise(resolve => setTimeout(resolve, 100));

                // Create canvas for QR code
                const qrCanvas = document.createElement('canvas');
                
                // Use the QR code library
                await new Promise((resolve, reject) => {
                    QRCodeLib.toCanvas(qrCanvas, videoLink, {
                        width: 120,
                        height: 120,
                        margin: 1,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        },
                        errorCorrectionLevel: 'M'
                    }, (error) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });

                qrContainer.appendChild(qrCanvas);
                
            } catch (error) {
                console.error('QR Code generation error for film:', film.title, 'Error:', error);
                
                // Create error placeholder with more specific error info
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    width: 120px;
                    height: 120px;
                    background: #fff3cd;
                    border: 2px dashed #ffc107;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    color: #856404;
                    text-align: center;
                    padding: 5px;
                `;
                
                // Show different messages based on error type
                if (error.message.includes('QRCode library not found')) {
                    errorDiv.innerHTML = `<div>Library</div><div>Loading...</div>`;
                } else {
                    errorDiv.innerHTML = `<div>QR Error</div><div>${error.message?.slice(0, 15) || 'Unknown'}</div>`;
                }
                
                qrContainer.appendChild(errorDiv);
            }

            qrCard.appendChild(qrContainer);
        }

        // Add film title and rank
        const qrLabel = document.createElement('div');
        qrLabel.style.cssText = `
            margin-top: 10px;
            font-size: 12px;
            font-weight: bold;
            color: #212529;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-width: 150px;
            margin-left: auto;
            margin-right: auto;
        `;
        qrLabel.textContent = `#${rank} ${film.title}`;
        qrCard.appendChild(qrLabel);

        return qrCard;
    }

    async createImageDetailCard(film, rank) {
        const eloRating = Math.round(film.eloRating || 1200);
        const eloClass = this.getEloRatingClass(eloRating);
        const winLossRecord = this.getWinLossRecord(film);
        
        const card = document.createElement('div');
        card.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            overflow: hidden;
            border: 1px solid #dee2e6;
            width: 280px;
            height: 400px;
            display: flex;
            flex-direction: column;
        `;

        // Card header - fixed height
        const header = document.createElement('div');
        header.style.cssText = `
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 15px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 70px;
            flex-shrink: 0;
        `;

        const rankElement = document.createElement('div');
        rankElement.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            background: rgba(255,255,255,0.2);
            padding: 8px 12px;
            border-radius: 8px;
            min-width: 60px;
            text-align: center;
        `;
        rankElement.textContent = `#${rank}`;

        const titleElement = document.createElement('div');
        titleElement.style.cssText = `
            font-size: 16px;
            font-weight: 600;
            flex: 1;
            margin-left: 15px;
            text-align: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;
        titleElement.textContent = film.title;

        header.appendChild(rankElement);
        header.appendChild(titleElement);
        card.appendChild(header);

        // Thumbnail - fixed height
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.style.cssText = `
            height: 160px;
            background-color: #f8f9fa;
            flex-shrink: 0;
            ${film.thumbnailUrl ? `
                background-image: url(${film.thumbnailUrl});
                background-size: cover;
                background-position: center;
            ` : `
                display: flex;
                align-items: center;
                justify-content: center;
                color: #6c757d;
                font-size: 14px;
            `}
        `;
        
        if (!film.thumbnailUrl) {
            thumbnailContainer.textContent = 'No Thumbnail';
        }
        
        card.appendChild(thumbnailContainer);

        // Stats section - remaining space
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = `
            padding: 15px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            flex: 1;
            align-items: start;
        `;

        const stats = [
            { label: 'Total Wins', value: film.wins || 0 },
            { label: 'Win Rate', value: `${this.calculateWinRate(film)}%` },
            { label: 'Record', value: winLossRecord },
            { label: 'ELO Rating', value: eloRating, class: eloClass }
        ];

        stats.forEach(stat => {
            const statElement = document.createElement('div');
            statElement.style.cssText = `
                text-align: center;
                padding: 8px;
                background: #f8f9fa;
                border-radius: 6px;
                border: 1px solid #dee2e6;
                height: 50px;
                display: flex;
                flex-direction: column;
                justify-content: center;
            `;

            const label = document.createElement('div');
            label.style.cssText = `
                font-size: 10px;
                color: #6c757d;
                margin-bottom: 2px;
                font-weight: 500;
            `;
            label.textContent = stat.label;

            const value = document.createElement('div');
            value.style.cssText = `
                font-size: 14px;
                font-weight: bold;
                color: #212529;
            `;
            
            // Apply ELO color if applicable
            if (stat.class) {
                const eloColors = {
                    'elo-master': '#dc3545',     // Red/Gold
                    'elo-expert': '#ffc107',     // Yellow
                    'elo-intermediate': '#28a745', // Green
                    'elo-beginner': '#6c757d'    // Gray
                };
                value.style.color = eloColors[stat.class] || '#212529';
            }
            
            value.textContent = stat.value;

            statElement.appendChild(label);
            statElement.appendChild(value);
            statsContainer.appendChild(statElement);
        });

        card.appendChild(statsContainer);
        
        return card;
    }

    showImportDialog() {
        document.getElementById('importFile').click();
    }

    importRankings(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.films || !Array.isArray(data.films)) {
                    throw new Error('Invalid file format: missing films array');
                }

                // Confirm import action
                const confirmMessage = `This will replace your current rankings with ${data.films.length} film(s) from the imported file.\n\nExport Date: ${data.exportDate ? new Date(data.exportDate).toLocaleDateString() : 'Unknown'}\n\nAre you sure you want to continue?`;
                
                if (confirm(confirmMessage)) {
                    // Backup current data in case user wants to undo
                    const backupData = {
                        films: [...this.films],
                        backupDate: new Date().toISOString()
                    };
                    localStorage.setItem('filmRankingsBackup', JSON.stringify(backupData));

                    // Import the new data
                    this.films = data.films.map(film => ({
                        ...film,
                        // Ensure all required fields exist
                        id: film.id || Date.now() + Math.random(),
                        comparisons: film.comparisons || {},
                        wins: film.wins !== undefined ? film.wins : 0,
                        eloRating: film.eloRating || 1200,
                        overallRank: film.overallRank || 0
                    }));

                    // Validate and fix any comparison inconsistencies after import
                    console.log('Validating imported comparisons...');
                    const validationResult = this.validateAndFixComparisons();
                    
                    // Recalculate everything to ensure consistency
                    this.recalculateAllRanks();
                    this.recalculateEloRatings();
                    
                    this.saveData();
                    this.updateDisplay();
                    
                    let message = `Successfully imported ${this.films.length} films!`;
                    if (validationResult.fixedCount > 0 || validationResult.removedCount > 0) {
                        message += `\n\nFixed ${validationResult.fixedCount} comparison inconsistencies.`;
                        if (validationResult.removedCount > 0) {
                            message += `\nRemoved ${validationResult.removedCount} orphaned comparisons.`;
                        }
                    }
                    message += '\n\nPrevious data backed up.';
                    
                    this.showSuccessMessage(message);
                }
            } catch (error) {
                console.error('Import error:', error);
                alert(`Error importing file: ${error.message}\n\nPlease ensure you're importing a valid film rankings export file.`);
            }
            
            // Reset file input
            event.target.value = '';
        };

        reader.readAsText(file);
    }

    saveData() {
        const data = {
            films: this.films
        };
        localStorage.setItem('filmRankings', JSON.stringify(data));
    }

    loadData() {
        try {
            const saved = localStorage.getItem('filmRankings');
            if (saved) {
                const data = JSON.parse(saved);
                this.films = data.films || [];
                
                // Ensure all loaded films have the comparisons structure
                this.films.forEach(film => {
                    if (!film.comparisons) film.comparisons = {};
                    if (film.wins === undefined) film.wins = 0;
                    if (film.eloRating === undefined) film.eloRating = 1200;
                    if (film.customThumbnail === undefined) film.customThumbnail = null;
                });
                
                // Validate and fix any comparison inconsistencies
                console.log('Validating comparisons on load...');
                this.validateAndFixComparisons();
                
                // Recalculate everything to ensure consistency
                this.recalculateAllRanks();
            }
            
            // Load and restore view mode
            const savedViewMode = localStorage.getItem('filmRankingsViewMode');
            if (savedViewMode) {
                this.currentView = savedViewMode;
                // Update button states
                document.querySelectorAll('.btn-view').forEach(btn => {
                    btn.classList.remove('active-view');
                });
                document.getElementById(`${savedViewMode}ViewBtn`).classList.add('active-view');
            }
        } catch (e) {
            console.error('Error loading saved data:', e);
        }
    }

    showSuccessMessage(message) {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    showUndoMessage(message) {
        // Create an undo-specific toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ffc107;
            color: #212529;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 2000);
    }
}

// Add CSS for toast animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize the app
const app = new FilmRankingApp();
