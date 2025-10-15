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
        document.getElementById('addFilmBtn').addEventListener('click', () => this.showAddFilmModal());
        
        // Modal controls
        document.querySelector('.close').addEventListener('click', () => this.hideAddFilmModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideAddFilmModal());
        document.getElementById('confirmAddBtn').addEventListener('click', () => this.addFilm());
        
        // Auto-fill button
        document.getElementById('autoFillBtn').addEventListener('click', () => this.autoFillTitle());
        
        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => this.exportRankings());
        
        // Export as Image button
        document.getElementById('exportImageBtn').addEventListener('click', () => this.showExportSettingsModal());
        
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
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModals();
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
        const title = document.getElementById('filmTitle').value.trim();
        const link = document.getElementById('videoLink').value.trim();
        const customImage = document.getElementById('customImage').value.trim();

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
        this.comparisonQueue = [];
        this.comparisonHistory = []; // Reset comparison history for new film

        // Sort existing films by ELO descending (highest first)
        const sortedFilms = [...this.films].sort((a, b) => (b.eloRating || 1200) - (a.eloRating || 1200));

        // Add overall comparisons against each existing film in sorted order
        for (const existingFilm of sortedFilms) {
            this.comparisonQueue.push({
                newFilm: newFilm,
                existingFilm: existingFilm
            });
        }

        // Start the comparison process
        this.processNextComparison();
    }

    processNextComparison() {
        if (this.comparisonQueue.length === 0) {
            // All comparisons done
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
        const { comparison, newFilmState, existingFilmState } = lastState;
        
        console.log('Undoing comparison:', comparison.newFilm.title, 'vs', comparison.existingFilm.title);
        
        // Restore the film states
        comparison.newFilm.comparisons = newFilmState.comparisons;
        comparison.newFilm.wins = newFilmState.wins;
        comparison.existingFilm.comparisons = existingFilmState.comparisons;
        comparison.existingFilm.wins = existingFilmState.wins;
        
        // Put the comparison back at the front of the queue
        this.comparisonQueue.unshift(comparison);
        console.log('Restored to queue, new queue length:', this.comparisonQueue.length);
        
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
                comparisons: { ...newFilm.comparisons },
                wins: newFilm.wins
            },
            existingFilmState: {
                comparisons: { ...existingFilm.comparisons },
                wins: existingFilm.wins
            },
            choice: isBetter
        };
        this.comparisonHistory.push(undoState);
        
        // Initialize comparisons object if it doesn't exist
        if (!newFilm.comparisons) newFilm.comparisons = {};
        if (!existingFilm.comparisons) existingFilm.comparisons = {};
        
        if (isBetter) {
            // New film wins
            newFilm.comparisons[existingFilm.id] = 'win';
            existingFilm.comparisons[newFilm.id] = 'loss';
            newFilm.wins++;
        } else {
            // Existing film wins
            newFilm.comparisons[existingFilm.id] = 'loss';
            existingFilm.comparisons[newFilm.id] = 'win';
            existingFilm.wins++;
        }

        console.log('Comparison completed:', newFilm.title, isBetter ? 'wins' : 'loses', 'against', existingFilm.title);
        
        // Clear current comparison as it's now completed
        this.currentComparison = null;
        
        document.getElementById('comparisonModal').style.display = 'none';
        this.processNextComparison();
    }

    finishComparisons() {
        const newFilm = this.currentComparison?.newFilm;
        if (!newFilm) return;

        // Calculate rank based on wins - more wins = higher rank (lower rank number)
        newFilm.overallRank = this.films.length - newFilm.wins;

        this.films.push(newFilm);
        this.recalculateAllRanks();
        this.saveData();
        this.updateDisplay();
        this.showSuccessMessage(`Added "${newFilm.title}" to your rankings!`);
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
            // Remove the comparison from both films
            if (film.comparisons && film.comparisons[opponentId]) {
                // Adjust win count if removing a win
                if (film.comparisons[opponentId] === 'win' && film.wins > 0) {
                    film.wins--;
                }
                delete film.comparisons[opponentId];
            }
            
            if (opponent.comparisons && opponent.comparisons[filmId]) {
                // Adjust win count if removing a win
                if (opponent.comparisons[filmId] === 'win' && opponent.wins > 0) {
                    opponent.wins--;
                }
                delete opponent.comparisons[filmId];
            }
            
            // Recalculate rankings and ELO
            this.recalculateAllRanks();
            this.recalculateEloRatings();
            this.saveData();
            this.updateDisplay();
            this.showSuccessMessage(`Removed matchup between "${film.title}" and "${opponent.title}"`);
        }
    }

    flipMatchup(filmId, opponentId) {
        const film = this.films.find(f => f.id === filmId);
        const opponent = this.films.find(f => f.id === opponentId);
        
        if (!film || !opponent) return;
        
        // Ensure both films have comparison objects
        if (!film.comparisons) film.comparisons = {};
        if (!opponent.comparisons) opponent.comparisons = {};
        
        const currentResult = film.comparisons[opponentId];
        
        if (currentResult === 'win') {
            // Flip from win to loss
            film.comparisons[opponentId] = 'loss';
            opponent.comparisons[filmId] = 'win';
            
            // Adjust win counts
            if (film.wins > 0) film.wins--;
            opponent.wins++;
            
            this.showSuccessMessage(`Flipped result: "${opponent.title}" now beats "${film.title}"`);
        } else if (currentResult === 'loss') {
            // Flip from loss to win
            film.comparisons[opponentId] = 'win';
            opponent.comparisons[filmId] = 'loss';
            
            // Adjust win counts
            film.wins++;
            if (opponent.wins > 0) opponent.wins--;
            
            this.showSuccessMessage(`Flipped result: "${film.title}" now beats "${opponent.title}"`);
        } else {
            // No existing matchup, create a win for the current film
            film.comparisons[opponentId] = 'win';
            opponent.comparisons[filmId] = 'loss';
            film.wins++;
            
            this.showSuccessMessage(`Created new matchup: "${film.title}" beats "${opponent.title}"`);
        }
        
        // Recalculate rankings and ELO
        this.recalculateAllRanks();
        this.recalculateEloRatings();
        this.saveData();
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
        
        // Check if matchup already exists
        if (film.comparisons[opponentId]) {
            if (confirm(`A matchup between "${film.title}" and "${opponent.title}" already exists. Do you want to overwrite it?`)) {
                // Remove the old result from win counts
                if (film.comparisons[opponentId] === 'win' && film.wins > 0) {
                    film.wins--;
                }
                if (opponent.comparisons[filmId] === 'win' && opponent.wins > 0) {
                    opponent.wins--;
                }
            } else {
                return;
            }
        }
        
        // Add the new matchup
        if (result === 'win') {
            film.comparisons[opponentId] = 'win';
            opponent.comparisons[filmId] = 'loss';
            film.wins++;
            this.showSuccessMessage(`Added matchup: "${film.title}" beats "${opponent.title}"`);
        } else {
            film.comparisons[opponentId] = 'loss';
            opponent.comparisons[filmId] = 'win';
            opponent.wins++;
            this.showSuccessMessage(`Added matchup: "${opponent.title}" beats "${film.title}"`);
        }
        
        // Clear the selection
        const select = document.getElementById(`newMatchupOpponent-${filmId}`);
        if (select) select.value = '';
        
        // Recalculate rankings and ELO
        this.recalculateAllRanks();
        this.recalculateEloRatings();
        this.saveData();
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
                            winnerA: filmA,
                            loserB: filmB,
                            timestamp: Math.min(filmA.id, filmB.id) // Use lower ID for consistent ordering
                        });
                    } else if (result === 'loss') {
                        allComparisons.push({
                            winnerA: filmB,
                            loserB: filmA,
                            timestamp: Math.min(filmA.id, filmB.id) // Use lower ID for consistent ordering
                        });
                    }
                }
            });
        });

        // Sort comparisons by timestamp to replay them in order
        allComparisons.sort((a, b) => a.timestamp - b.timestamp);

        // Apply ELO calculations multiple times to ensure convergence
        // This helps with transitive relationships (A beats B, B beats C, etc.)
        for (let iteration = 0; iteration < 3; iteration++) {
            allComparisons.forEach(comparison => {
                const { winnerA, loserB } = comparison;
                const ratingA = winnerA.eloRating;
                const ratingB = loserB.eloRating;
                
                // Winner gets score 1, loser gets score 0
                const newRatingA = this.calculateEloRating(ratingA, ratingB, 1, 16); // Lower K-factor for stability
                const newRatingB = this.calculateEloRating(ratingB, ratingA, 0, 16);
                
                winnerA.eloRating = newRatingA;
                loserB.eloRating = newRatingB;
            });
        }
        
        // Final validation: ensure ELO roughly corresponds to win percentages
        this.films.forEach(film => {
            const winRate = this.calculateWinRate(film);
            // Adjust ELO slightly based on win rate to prevent major discrepancies
            if (winRate > 75 && film.eloRating < 1300) {
                film.eloRating = Math.max(film.eloRating, 1300);
            } else if (winRate < 25 && film.eloRating > 1100) {
                film.eloRating = Math.min(film.eloRating, 1100);
            }
        });
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

                    // Recalculate everything to ensure consistency
                    this.recalculateAllRanks();
                    this.recalculateEloRatings();
                    
                    this.saveData();
                    this.updateDisplay();
                    
                    this.showSuccessMessage(`Successfully imported ${this.films.length} films! Previous data backed up.`);
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
