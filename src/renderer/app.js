// State
let currentGeneration = null;
let generationCounts = {};
let selectedPokemonForPurchase = null;

// DOM Elements
const navButtons = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');
const generationPage = document.getElementById('generation-page');
const genTitle = document.getElementById('gen-title');
const pokemonList = document.getElementById('pokemon-list');
const loading = document.getElementById('loading');
const remainingCountEl = document.getElementById('remaining-count');
let currentPokemonData = [];

// Marketplace
const marketPage = document.getElementById('market-page');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const addPurchaseBtn = document.getElementById('add-purchase-btn');
const purchaseModal = document.getElementById('purchase-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalSearchInput = document.getElementById('modal-search-input');
const modalSearchBtn = document.getElementById('modal-search-btn');
const modalSearchResults = document.getElementById('modal-search-results');
const selectedPokemonDiv = document.getElementById('selected-pokemon');
const savePurchaseBtn = document.getElementById('save-purchase');
const sortPurchasesSelect = document.getElementById('sort-purchases');
const purchasesList = document.getElementById('purchases-list');

// URL
let urlModal;
let closeUrlModalBtn;
let saveUrlBtn;
let skipUrlBtn;
let pokemonUrlInput;
let currentPokemonForUrl = null;

// Finances
const financePage = document.getElementById('finance-page');
const financeTabBtns = document.querySelectorAll('.finance-tab-btn');
const financeTabContents = document.querySelectorAll('.finance-tab-content');
const addTransactionBtn = document.getElementById('add-transaction-btn');
const transactionModal = document.getElementById('transaction-modal');
const closeTransactionModalBtn = document.getElementById('close-transaction-modal');
const saveTransactionBtn = document.getElementById('save-transaction');
const transactionTypeSelect = document.getElementById('transaction-type');
const transactionCategorySelect = document.getElementById('transaction-category');

let currentBudgetSettings = {
    monthlyBudget: 1500,
    percentages: { fisse: 40, variabili: 30, svago: 15, risparmi: 15 }
};
let currentFinancialStats = null;

let spendingInsights = null;

// Budget
let weeklyBudget = 20;
let monthlyBudget = 80;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Pokemon Collection Manager avviato');

    setupNavigation();
    setupSearch();
    setupMarket();
    setupFinance();
    setupEventDelegation();
    initializeUrlModal();
    loadDashboardStats();

    await initializeFinanceData();

    showGeneration(1);
});

function setupEventDelegation() {
    // Event delegation per price inputs
    document.addEventListener('keypress', (e) => {
        if (e.target.classList.contains('price-input')) {
            if (e.key === 'Enter') {
                const pokemonId = parseInt(e.target.getAttribute('data-pokemon-id'));
                let price = 0;

                if (e.target.value && e.target.value.trim() !== '') {
                    price = parseFloat(e.target.value);
                    if (isNaN(price)) {
                        price = 0;
                    }
                }

                savePokemonPrice(pokemonId, price);
                e.target.blur();
            }
        }
    });

    // Event delegation per blur su price inputs
    document.addEventListener('blur', (e) => {
        if (e.target.classList.contains('price-input')) {
            const pokemonId = parseInt(e.target.getAttribute('data-pokemon-id'));
            let price = 0;

            if (e.target.value && e.target.value.trim() !== '') {
                price = parseFloat(e.target.value);
                if (isNaN(price)) {
                    price = 0;
                }
            }

            savePokemonPrice(pokemonId, price);
        }
    }, true); // true per catturare l'evento blur

    // Event delegation per checkbox
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('collect-checkbox')) {
            const pokemonId = parseInt(e.target.getAttribute('data-pokemon-id'));
            const collected = e.target.checked;
            toggleCollected(pokemonId, collected);
        }
    });
}

// Navigation Setup
function setupNavigation() {
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const gen = btn.getAttribute('data-gen');

            // Update active button
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            showGeneration(parseInt(gen));
        });

        const sortPokemonSelect = document.getElementById('sort-pokemon');
        if (sortPokemonSelect) {
            sortPokemonSelect.addEventListener('change', () => {
                if (currentPokemonData.length > 0) {
                    const sortedData = sortPokemonData(currentPokemonData, sortPokemonSelect.value);
                    displayPokemonList(sortedData);
                }
            });
        }
    });

    const mainNavBtns = document.querySelectorAll('.main-nav-btn');
    mainNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');

            // Update active button
            mainNavBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Switch pages
            if (page === 'collection') {
                showCollectionPage();
            } else if (page === 'market') {
                showMarketPage();
            } else if (page === 'finance') {
                showFinancePage();
            }
        });
    });
}

function showCollectionPage() {
    pages.forEach(page => page.classList.remove('active'));
    generationPage.classList.add('active');

    // Mostra header e nav delle generazioni
    document.querySelector('.nav').style.display = 'flex';
    document.querySelector('.header').style.display = 'flex';

    // Se non c'è una generazione selezionata, mostra la prima
    if (!currentGeneration) {
        showGeneration(1);
    }
}

function showMarketPage() {
    pages.forEach(page => page.classList.remove('active'));
    marketPage.classList.add('active');

    // Nascondi nav delle generazioni ma mantieni header
    document.querySelector('.nav').style.display = 'none';
    document.querySelector('.header').style.display = 'none';

    // Load purchases when opening market
    loadPurchases();
}

// Search Setup
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

// Search Function
async function performSearch() {
    const query = document.getElementById('search-input').value.trim();

    if (!query) {
        return;
    }

    // Show loading
    loading.style.display = 'block';
    pokemonList.style.display = 'none';
    genTitle.textContent = `Risultati ricerca: "${query}"`;

    // Switch to generation page for results
    pages.forEach(page => page.classList.remove('active'));
    generationPage.classList.add('active');

    // Update nav buttons (remove active from all)
    navButtons.forEach(b => b.classList.remove('active'));

    try {
        if (window.electronAPI) {
            const results = await window.electronAPI.searchPokemon(query);

            // Hide loading, show results
            loading.style.display = 'none';
            pokemonList.style.display = 'block';

            if (results.length === 0) {
                pokemonList.innerHTML = '<p style="text-align: center; grid-column: 1 / -1; color: #666;">Nessun Pokemon trovato</p>';
                currentPokemonData = [];
            } else {
                currentPokemonData = results;
                const sortValue = document.getElementById('sort-pokemon')?.value || 'pokedex';
                const sortedData = sortPokemonData(currentPokemonData, sortValue);
                displayPokemonList(sortedData);
                console.log(`Trovati ${results.length} Pokemon per "${query}"`);
            }
        }
    } catch (error) {
        console.error('Errore ricerca:', error);
        loading.style.display = 'none';
        pokemonList.innerHTML = '<p style="text-align: center; grid-column: 1 / -1; color: #dc3545;">Errore durante la ricerca</p>';
        currentPokemonData = [];
    }
}

function sortPokemonData(pokemonArray, sortBy) {
    const sortedArray = [...pokemonArray]; // Crea una copia per non modificare l'originale

    switch (sortBy) {
        case 'name':
            return sortedArray.sort((a, b) => a.name.localeCompare(b.name));

        case 'name-desc':
            return sortedArray.sort((a, b) => b.name.localeCompare(a.name));

        case 'price-asc':
            return sortedArray.sort((a, b) => {
                const priceA = parseFloat(a.price) || 0;
                const priceB = parseFloat(b.price) || 0;
                return priceA - priceB;
            });

        case 'price-desc':
            return sortedArray.sort((a, b) => {
                const priceA = parseFloat(a.price) || 0;
                const priceB = parseFloat(b.price) || 0;
                return priceB - priceA;
            });

        case 'pokedex':
        default:
            return sortedArray.sort((a, b) => a.id - b.id);
    }
}

// Show Generation
async function showGeneration(generation) {
    currentGeneration = generation;

    // Update UI
    pages.forEach(page => page.classList.remove('active'));
    generationPage.classList.add('active');

    document.querySelector('.nav').style.display = 'flex';
    document.querySelector('.header').style.display = 'flex';

    const genNames = {
        1: 'Generazione 1 - Kanto',
        2: 'Generazione 2 - Johto',
        3: 'Generazione 3 - Hoenn',
        4: 'Generazione 4 - Sinnoh',
        5: 'Generazione 5 - Unova',
        6: 'Generazione 6 - Kalos',
        7: 'Generazione 7 - Alola',
        8: 'Generazione 8 - Galar',
        9: 'Generazione 9 - Paldea'
    };

    genTitle.textContent = genNames[generation] || `Generazione ${generation}`;

    // Reset sort select to default
    const sortSelect = document.getElementById('sort-pokemon');
    if (sortSelect) {
        sortSelect.value = 'pokedex';
    }

    // Show loading
    loading.style.display = 'block';
    pokemonList.style.display = 'none';

    // Load Pokemon
    await loadPokemonByGeneration(generation);
}

// Load Dashboard Stats
async function loadDashboardStats() {
    try {
        if (window.electronAPI) {
            const stats = await window.electronAPI.getDatabaseStats();

            const remainingCountEl = document.getElementById('remaining-count');
            remainingCountEl.textContent = stats.remainingPokemon;

            await loadGenerationCounts();
        }
    } catch (error) {
        console.error('Errore caricamento stats:', error);
    }
}

// Toggle Pokemon collected status
async function toggleCollected(pokemonId, collected) {
    try {
        if (window.electronAPI) {
            const success = await window.electronAPI.updatePokemonCollected(pokemonId, collected);

            if (success) {
                const row = document.querySelector(`[data-pokemon-id="${pokemonId}"]`);
                const imageContainer = row.querySelector('.pokemon-image-small');
                const priceContainer = row.querySelector('.price-container');
                const priceInput = row.querySelector('.price-input');

                // Ottieni il prezzo corrente prima di modificare l'UI
                const currentPrice = priceInput ? parseFloat(priceInput.value) || 0 : 0;

                if (collected) {
                    row.classList.add('collected-row');
                    imageContainer.classList.remove('not-collected');
                    imageContainer.classList.add('collected');
                    priceContainer.innerHTML = '';
                } else {
                    row.classList.remove('collected-row');
                    imageContainer.classList.remove('collected');
                    imageContainer.classList.add('not-collected');
                    priceContainer.innerHTML = `<input type="number" 
                                      class="price-input" 
                                      placeholder="0.00"
                                      value="${currentPrice}"
                                      step="0.01"
                                      min="0"
                                      data-pokemon-id="${pokemonId}">`;
                }

                // Aggiorna il conteggio rimanente
                await updateRemainingCount();

                // Aggiorna il prezzo totale considerando la collezione/decollazione
                updateTotalPriceAfterCollection();

                console.log(`Pokemon ${pokemonId} ${collected ? 'raccolto' : 'non raccolto'}`);
            } else {
                const checkbox = document.querySelector(`[data-pokemon-id="${pokemonId}"] .collect-checkbox`);
                checkbox.checked = !collected;
                alert('Errore durante l\'aggiornamento');
            }
        }
    } catch (error) {
        console.error('Errore toggle collected:', error);
        const checkbox = document.querySelector(`[data-pokemon-id="${pokemonId}"] .collect-checkbox`);
        checkbox.checked = !collected;
    }
}

function initializeUrlModal() {
    urlModal = document.getElementById('url-modal');
    closeUrlModalBtn = document.getElementById('close-url-modal');
    saveUrlBtn = document.getElementById('save-url-btn');
    skipUrlBtn = document.getElementById('skip-url-btn');
    pokemonUrlInput = document.getElementById('pokemon-url-input');

    // Event listeners per il modal URL
    if (closeUrlModalBtn) {
        closeUrlModalBtn.addEventListener('click', closeUrlModal);
    }

    if (urlModal) {
        urlModal.addEventListener('click', (e) => {
            if (e.target === urlModal) {
                closeUrlModal();
            }
        });
    }

    if (saveUrlBtn) {
        saveUrlBtn.addEventListener('click', saveUrlAndClose);
    }

    if (skipUrlBtn) {
        skipUrlBtn.addEventListener('click', closeUrlModal);
    }

    // Enter key nel campo URL
    if (pokemonUrlInput) {
        pokemonUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveUrlAndClose();
            }
        });
    }
}

function updateTotalPriceAfterCollection() {
    // Raccoglie tutti i Pokemon NON collezionati con i loro prezzi dalla vista corrente
    const uncollectedPokemon = Array.from(document.querySelectorAll('.pokemon-row:not(.collected-row)')).map(row => {
        const priceInput = row.querySelector('.price-input');
        return {
            price: priceInput ? parseFloat(priceInput.value) || 0 : 0
        };
    });

    updateTotalPriceDisplay(uncollectedPokemon);
}

// Update remaining count
async function updateRemainingCount() {
    try {
        if (window.electronAPI) {
            const stats = await window.electronAPI.getDatabaseStats();
            const remainingCountEl = document.getElementById('remaining-count');
            remainingCountEl.textContent = stats.remainingPokemon;
        }
    } catch (error) {
        console.error('Errore aggiornamento contatore:', error);
    }
}

// Load Generation Counts
async function loadGenerationCounts() {
    try {
        for (let gen = 1; gen <= 9; gen++) {
            if (window.electronAPI) {
                const pokemon = await window.electronAPI.getPokemonByGeneration(gen);
                generationCounts[gen] = pokemon.length;
            }
        }
    } catch (error) {
        console.error('Errore caricamento conteggi generazioni:', error);
    }
}

function displayPokemonList(pokemon) {
    if (!pokemon || pokemon.length === 0) {
        pokemonList.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">Nessun Pokemon trovato</p>';

        const totalPriceEl = document.getElementById('total-price');
        if (totalPriceEl) {
            totalPriceEl.textContent = '€0.00';
        }

        return;
    }

    const header = `
        <div class="pokemon-header">
            <div>Sprite</div>
            <div>Nome</div>
            <div>Prezzo (€)</div>
            <div># Pokédex</div>
            <div># Pagina</div>
            <div>Collezionato</div>
        </div>
    `;

    const rows = pokemon.map((p, index) => createPokemonRow(p, index)).join('');

    pokemonList.innerHTML = header + rows;

    setTimeout(() => applyInitialBorderColors(), 100);

    updateTotalPriceAfterCollection();
}

// Make functions global for onclick handlers
window.toggleCollected = toggleCollected;

// Load Pokemon by Generation
async function loadPokemonByGeneration(generation) {
    try {
        if (window.electronAPI) {
            const pokemon = await window.electronAPI.getPokemonByGeneration(generation);

            // Hide loading, show list
            loading.style.display = 'none';
            pokemonList.style.display = 'block';

            if (pokemon.length === 0) {
                pokemonList.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Nessun Pokemon trovato per questa generazione</p>';
                currentPokemonData = [];
                return;
            }

            // Salva i dati e applica ordinamento
            currentPokemonData = pokemon;
            const sortValue = document.getElementById('sort-pokemon')?.value || 'pokedex';
            const sortedData = sortPokemonData(currentPokemonData, sortValue);

            // Display Pokemon
            displayPokemonList(pokemon);

            console.log(`Caricati ${pokemon.length} Pokemon per Generazione ${generation}`);
        }
    } catch (error) {
        console.error('Errore caricamento Pokemon:', error);
        loading.textContent = 'Errore nel caricamento Pokemon';
        pokemonList.style.display = 'none';
        currentPokemonData = [];
    }
}

function openUrlModal(pokemonId, pokemonName) {
    currentPokemonForUrl = { id: pokemonId, name: pokemonName };

    // Aggiorna il nome del Pokemon nel modal
    const pokemonNameSpan = document.getElementById('url-pokemon-name');
    if (pokemonNameSpan) {
        pokemonNameSpan.textContent = pokemonName;
    }

    // Reset del campo URL
    if (pokemonUrlInput) {
        pokemonUrlInput.value = '';
    }

    // Mostra il modal
    if (urlModal) {
        urlModal.classList.remove('hidden');
        pokemonUrlInput.focus();
    }
}

function closeUrlModal() {
    if (urlModal) {
        urlModal.classList.add('hidden');
    }
    currentPokemonForUrl = null;

    if (pokemonUrlInput) {
        pokemonUrlInput.value = '';
    }
}

async function saveUrlAndClose() {
    if (!currentPokemonForUrl) {
        closeUrlModal();
        return;
    }

    const url = pokemonUrlInput.value.trim();

    try {
        if (window.electronAPI) {
            const success = await window.electronAPI.updatePokemonUrl(currentPokemonForUrl.id, url);

            if (success) {
                console.log(`URL aggiornato per Pokemon ${currentPokemonForUrl.id}: ${url}`);

                // Aggiorna l'UI per mostrare che il Pokemon ha un URL
                updatePokemonNameWithUrl(currentPokemonForUrl.id, url);

                closeUrlModal();
            } else {
                alert('Errore durante il salvataggio dell\'URL');
            }
        }
    } catch (error) {
        console.error('Errore salvataggio URL:', error);
        alert('Errore durante il salvataggio dell\'URL');
    }
}

// Funzione per aggiornare l'aspetto del nome Pokemon quando ha un URL
function updatePokemonNameWithUrl(pokemonId, url) {
    const row = document.querySelector(`[data-pokemon-id="${pokemonId}"]`);
    if (row) {
        const nameElement = row.querySelector('.pokemon-name');

        if (nameElement && url) {
            // Aggiungi classe e onclick per aprire URL
            nameElement.classList.add('has-url');
            nameElement.setAttribute('data-url', url);
            nameElement.style.cursor = 'pointer';
        }
    }
}

// Funzione per aprire URL esterno
async function openPokemonUrl(pokemonId) {
    const nameElement = document.querySelector(`[data-pokemon-id="${pokemonId}"] .pokemon-name`);
    if (nameElement && nameElement.hasAttribute('data-url')) {
        const url = nameElement.getAttribute('data-url');
        if (url) {
            console.log(`Tentativo di aprire URL: ${url}`);

            try {
                if (window.electronAPI && window.electronAPI.openExternal) {
                    const success = await window.electronAPI.openExternal(url);
                    if (success) {
                        console.log(`URL aperto con successo: ${url}`);
                    } else {
                        console.error(`Errore nell'apertura dell'URL: ${url}`);
                        window.open(url, '_blank');
                    }
                } else {
                    console.log('electronAPI non disponibile, usando fallback browser');
                    window.open(url, '_blank');
                }
            } catch (error) {
                console.error('Errore apertura URL:', error);
                window.open(url, '_blank');
            }
        }
    }
}

// Create Pokemon Row HTML
function createPokemonRow(pokemon, index) {
    const pageNumber = index + 1;
    const isCollected = pokemon.collected || false;
    const imageClass = isCollected ? 'collected' : 'not-collected';
    const price = pokemon.price || '';
    const hasUrl = pokemon.url && pokemon.url.trim() !== '';
    const urlClass = hasUrl ? 'has-url' : '';
    const urlAttributes = hasUrl ? `data-url="${pokemon.url}" onclick="openPokemonUrl(${pokemon.id})"` : '';

    return `
        <div class="pokemon-row ${isCollected ? 'collected-row' : ''}" data-pokemon-id="${pokemon.id}">
            <div class="pokemon-image-small ${imageClass}">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png" 
                     alt="${pokemon.name}"
                     onerror="this.style.display='none'; this.parentNode.innerHTML='❓'">
            </div>
            <div class="pokemon-name-container">
                <div class="pokemon-name ${urlClass}" ${urlAttributes} style="${hasUrl ? 'cursor: pointer;' : ''}">
                    ${pokemon.name}
                </div>
            </div>
            <div class="price-container">
                ${!isCollected ?
            `<input type="number" 
                            class="price-input" 
                            placeholder="0.00"
                            value="${price}"
                            step="0.01"
                            min="0"
                            data-pokemon-id="${pokemon.id}">` :
            ''
        }
            </div>
            <div class="pokemon-pokedex-num">#${pokemon.id.toString().padStart(3, '0')}</div>
            <div class="pokemon-page-num">${pageNumber}</div>
            <div class="pokemon-actions">
                <label class="checkbox-container">
                    <input type="checkbox" 
                           class="collect-checkbox" 
                           data-pokemon-id="${pokemon.id}"
                           ${isCollected ? 'checked' : ''}>
                    <div class="checkbox-custom"></div>
                </label>
            </div>
        </div>
    `;
}

// Apply initial border colors after loading Pokemon
function applyInitialBorderColors() {
    const priceInputs = document.querySelectorAll('.price-input');
    priceInputs.forEach(input => {
        const price = parseFloat(input.value) || 0;
        updateInputBorderColor(input, price);
    });
}

// Save Pokemon price to database
async function savePokemonPrice(pokemonId, price) {
    if (isNaN(price) || price < 0) {
        return;
    }

    try {
        if (window.electronAPI) {
            const success = await window.electronAPI.updatePokemonPrice(pokemonId, price);

            if (success) {
                console.log(`Prezzo aggiornato per Pokemon ${pokemonId}: €${price.toFixed(2)}`);

                // Applica il colore del bordo in base al prezzo
                const input = document.querySelector(`[data-pokemon-id="${pokemonId}"] .price-input`);
                if (input) {  // Controlla se l'input esiste prima di aggiornare
                    updateInputBorderColor(input, price);
                }

                // Aggiorno il prezzo nel DOM per il calcolo del totale
                const row = document.querySelector(`[data-pokemon-id="${pokemonId}"]`);
                if (row) {
                    updateTotalPriceAfterCollection();
                }

                if (price > 0) {
                    const pokemonNameElement = row.querySelector('.pokemon-name');
                    const pokemonName = pokemonNameElement ? pokemonNameElement.textContent : `Pokemon #${pokemonId}`;
                    openUrlModal(pokemonId, pokemonName);
                }

            } else {
                alert('Errore durante il salvataggio del prezzo');
            }
        }
    } catch (error) {
        console.error('Errore salvataggio prezzo:', error);
        alert('Errore durante il salvataggio del prezzo');
    }
}

// Update input border color based on price
function updateInputBorderColor(input, price) {
    input.style.transition = 'border-color 0.3s ease';

    if (price === 0 || price === '') {
        input.style.borderColor = '#adadad';
    }
    if (price < 5 && price > 0) {
        input.style.borderColor = '#17a2b8'; // Celeste
    } else if (price < 15 && price >= 5) {
        input.style.borderColor = 'var(--primary-color)'; // Primary color (giallo)
    } else if (price < 30 && price >= 15) {
        input.style.borderColor = '#fd7e14'; // Arancione
    } else if (price >= 30) {
        input.style.borderColor = '#dc3545'; // Rosso
    }

    // Breve feedback di successo
    setTimeout(() => {
        input.style.borderColor = input.style.borderColor; // Mantieni il colore del prezzo
    }, 500);
}

function calculateTotalPrice(pokemon) {
    const total = pokemon.reduce((sum, p) => {
        const price = parseFloat(p.price) || 0;
        return sum + price;
    }, 0);

    return total;
}

function updateTotalPriceDisplay(pokemon) {
    const totalPrice = calculateTotalPrice(pokemon);
    const totalPriceEl = document.getElementById('total-price');
    if (totalPriceEl) {
        totalPriceEl.textContent = `€${totalPrice.toFixed(2)}`;
    }
}

// Market Setup
function setupMarket() {
    // Delete all purchases
    const deleteAllPurchasesBtn = document.getElementById('delete-all-purchases-btn');
    deleteAllPurchasesBtn.addEventListener('click', deleteAllPurchases);

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Modal
    addPurchaseBtn.addEventListener('click', openPurchaseModal);
    closeModalBtn.addEventListener('click', closePurchaseModal);
    purchaseModal.addEventListener('click', (e) => {
        if (e.target === purchaseModal) {
            closePurchaseModal();
        }
    });

    // Search in modal
    modalSearchBtn.addEventListener('click', performModalSearch);
    modalSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performModalSearch();
        }
    });

    // Save purchase
    savePurchaseBtn.addEventListener('click', savePurchase);

    // Sort purchases
    sortPurchasesSelect.addEventListener('change', loadPurchases);

    // Set current month as default
    const currentDate = new Date();
    const currentMonth = currentDate.getFullYear() + '-' + (currentDate.getMonth() + 1).toString().padStart(2, '0');
    document.getElementById('purchase-month').value = currentMonth;
}

// Switch Tabs
function switchTab(tabName) {
    // Update tab buttons
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Load content based on tab
    if (tabName === 'purchases') {
        loadPurchases();
    } else if (tabName === 'budget') {
        loadBudgetData();
    }
}

// Modal functions
function openPurchaseModal() {
    purchaseModal.classList.remove('hidden');
    resetModal();
    modalSearchInput.focus();
}

function closePurchaseModal() {
    purchaseModal.classList.add('hidden');
}

function resetModal() {
    modalSearchInput.value = '';
    modalSearchResults.innerHTML = '';
    selectedPokemonDiv.classList.add('hidden');
    selectedPokemonForPurchase = null;
    document.getElementById('final-price').value = '';

    // Ripristina placeholder
    document.getElementById('selected-pokemon-placeholder').style.display = 'flex';
    document.getElementById('selected-pokemon-img').style.display = 'none';

    // Reset completo dei dettagli Pokemon
    document.getElementById('selected-pokemon-img').src = '';
    document.getElementById('selected-pokemon-name').textContent = '';
    document.getElementById('selected-pokemon-id').textContent = '';
    document.getElementById('base-price').textContent = '€0.00';
}

// Modal search
async function performModalSearch() {
    const query = modalSearchInput.value.trim();

    if (!query) {
        return;
    }

    try {
        if (window.electronAPI) {
            const results = await window.electronAPI.searchPokemon(query);
            displayModalSearchResults(results);
        }
    } catch (error) {
        console.error('Errore ricerca modal:', error);
        modalSearchResults.innerHTML = '<p style="color: #dc3545; padding: 10px;">Errore durante la ricerca</p>';
    }
}

// Display search results in modal
async function displayModalSearchResults(results) {
    if (!results || results.length === 0) {
        modalSearchResults.innerHTML = '<p style="color: #ccc; padding: 10px;">Nessun Pokemon trovato</p>';
        return;
    }

    try {
        // Ottieni tutti gli acquisti per controllare quali Pokémon sono già stati acquistati
        const purchases = window.electronAPI ? await window.electronAPI.getPurchases() : [];
        const purchasedPokemonIds = new Set(purchases.map(p => p.pokemonId));

        const resultsHtml = results.map(pokemon => {
            const isAlreadyPurchased = purchasedPokemonIds.has(pokemon.id);
            const clickHandler = isAlreadyPurchased ? '' : `onclick="selectPokemonForPurchase(${pokemon.id}, '${pokemon.name}', ${pokemon.price || 0})"`;
            const itemClass = isAlreadyPurchased ? 'search-result-item purchased-item' : 'search-result-item';
            const statusText = isAlreadyPurchased ? ' - ✅ GIÀ ACQUISTATO' : '';

            return `
                <div class="${itemClass}" ${clickHandler}>
                    <div class="search-result-img ${isAlreadyPurchased ? 'purchased-img' : ''}">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png" 
                             alt="${pokemon.name}"
                             onerror="this.parentNode.innerHTML='❓'">
                    </div>
                    <div class="search-result-info">
                        <strong>${pokemon.name}</strong> - #${pokemon.id.toString().padStart(3, '0')}
                        ${pokemon.price ? ` - €${pokemon.price}` : ' - Nessun prezzo'}
                        <span class="purchase-status">${statusText}</span>
                    </div>
                </div>
            `;
        }).join('');

        modalSearchResults.innerHTML = resultsHtml;
    } catch (error) {
        console.error('Errore nel controllare acquisti esistenti:', error);
        // Fallback: mostra i risultati normalmente senza controllo acquisti
        const resultsHtml = results.map(pokemon => `
            <div class="search-result-item" onclick="selectPokemonForPurchase(${pokemon.id}, '${pokemon.name}', ${pokemon.price || 0})">
                <div class="search-result-img">
                    <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png" 
                         alt="${pokemon.name}"
                         onerror="this.parentNode.innerHTML='❓'">
                </div>
                <div class="search-result-info">
                    <strong>${pokemon.name}</strong> - #${pokemon.id.toString().padStart(3, '0')}
                    ${pokemon.price ? ` - €${pokemon.price}` : ' - Nessun prezzo'}
                </div>
            </div>
        `).join('');

        modalSearchResults.innerHTML = resultsHtml;
    }
}

// Select Pokemon for purchase
async function selectPokemonForPurchase(pokemonId, pokemonName, basePrice) {
    try {
        // Controllo di sicurezza: verifica che il Pokémon non sia già stato acquistato
        if (window.electronAPI) {
            const purchases = await window.electronAPI.getPurchases();
            const isAlreadyPurchased = purchases.some(p => p.pokemonId === pokemonId);

            if (isAlreadyPurchased) {
                alert(`${pokemonName} è già stato acquistato!`);
                return;
            }
        }
    } catch (error) {
        console.error('Errore nel verificare acquisti esistenti:', error);
    }

    // ... resto della funzione rimane uguale
    selectedPokemonForPurchase = { id: pokemonId, name: pokemonName, price: basePrice };

    // Nascondi placeholder e mostra immagine
    document.getElementById('selected-pokemon-placeholder').style.display = 'none';
    document.getElementById('selected-pokemon-img').style.display = 'block';

    // Update UI
    document.getElementById('selected-pokemon-img').src =
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
    document.getElementById('selected-pokemon-name').textContent = pokemonName;
    document.getElementById('selected-pokemon-id').textContent = `#${pokemonId.toString().padStart(3, '0')}`;
    document.getElementById('base-price').textContent = `€${basePrice.toFixed(2)}`;
    document.getElementById('final-price').value = basePrice.toFixed(2);

    selectedPokemonDiv.classList.remove('hidden');
    modalSearchResults.innerHTML = '';
    modalSearchInput.value = '';
}

// Save purchase
async function savePurchase() {
    if (!selectedPokemonForPurchase) {
        return;
    }

    const finalPrice = parseFloat(document.getElementById('final-price').value);
    const month = document.getElementById('purchase-month').value;

    if (isNaN(finalPrice) || finalPrice < 0) {
        return;
    }

    if (!month) {
        return;
    }

    try {
        if (window.electronAPI) {
            const success = await window.electronAPI.addPurchase(
                selectedPokemonForPurchase.id,
                selectedPokemonForPurchase.name,
                finalPrice,
                month
            );

            if (success) {
                closePurchaseModal();
                loadPurchases(); // Refresh the list
            } else {
                alert('Errore durante il salvataggio dell\'acquisto');
            }
        }
    } catch (error) {
        console.error('Errore salvataggio acquisto:', error);
        alert('Errore durante il salvataggio dell\'acquisto');
    }
}

// Load purchases
async function loadPurchases() {
    const sortBy = sortPurchasesSelect.value;

    try {
        if (window.electronAPI) {
            const purchases = await window.electronAPI.getPurchases(sortBy);
            displayPurchases(purchases);
        }
    } catch (error) {
        console.error('Errore caricamento acquisti:', error);
        purchasesList.innerHTML = '<p style="color: #dc3545; padding: 20px;">Errore durante il caricamento degli acquisti</p>';
    }
}

// Display purchases
function displayPurchases(purchases) {
    if (!purchases || purchases.length === 0) {
        purchasesList.innerHTML = '<p style="color: #ccc; padding: 20px; text-align: center;">Nessun acquisto registrato</p>';
        return;
    }

    const purchasesHtml = purchases.map(purchase => `
        <div class="purchase-item">
            <div class="purchase-pokemon-img">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${purchase.pokemonId}.png" 
                     alt="${purchase.pokemonName}"
                     onerror="this.parentNode.innerHTML='❓'">
            </div>
            <div style="color: white; background: transparent; text-transform: capitalize;">${purchase.pokemonName}</div>
            <div style="color: white; background: transparent;">#${purchase.pokemonId.toString().padStart(3, '0')}</div>
            <div style="color: var(--primary-color); background: transparent; font-weight: bold;">€${purchase.finalPrice.toFixed(2)}</div>
            <div style="color: #ccc; background: transparent;">${purchase.month}</div>
            <button class="purchase-delete-btn" onclick="deletePurchase('${purchase._id}')">🗑️</button>
        </div>
    `).join('');

    purchasesList.innerHTML = purchasesHtml;
}

// Delete purchase
async function deletePurchase(purchaseId) {
    try {
        if (window.electronAPI) {
            const success = await window.electronAPI.deletePurchase(purchaseId);

            if (success) {
                loadPurchases(); // Refresh the list
            } else {
                alert('Errore durante l\'eliminazione dell\'acquisto');
            }
        }
    } catch (error) {
        console.error('Errore eliminazione acquisto:', error);
        alert('Errore durante l\'eliminazione dell\'acquisto');
    }
}

// Delete all purchases
async function deleteAllPurchases() {
    try {
        if (window.electronAPI) {
            // Prima controlla se ci sono acquisti
            const purchases = await window.electronAPI.getPurchases();

            if (!purchases || purchases.length === 0) {
                return;
            }

            if (!confirm(`Sei sicuro di voler eliminare TUTTI i ${purchases.length} acquisti? Questa operazione non può essere annullata.`)) {
                return;
            }

            const success = await window.electronAPI.deleteAllPurchases();

            if (success) {
                loadPurchases(); // Refresh the list
            } else {
                alert('Errore durante l\'eliminazione di tutti gli acquisti');
            }
        }
    } catch (error) {
        console.error('Errore eliminazione tutti acquisti:', error);
        alert('Errore durante l\'eliminazione di tutti gli acquisti');
    }
}

// Load budget data
async function loadBudgetData() {
    console.log('Caricamento dati budget...');

    // Carica dati del mese corrente
    await loadCurrentMonthData();

    // Carica cronologia mensile
    await loadMonthlyHistory();

    // Crea grafico settimanale
    createWeeklyChart();
}

async function loadBudgetSettings() {
    try {
        if (window.electronAPI) {
            currentBudgetSettings = await window.electronAPI.getBudgetSettings();
            console.log('Budget settings loaded:', currentBudgetSettings);
        }
    } catch (error) {
        console.error('Errore caricamento impostazioni budget:', error);
    }
}

function saveBudgetSettings() {
    weeklyBudget = parseFloat(document.getElementById('weekly-budget').value);
    monthlyBudget = parseFloat(document.getElementById('monthly-budget').value);

    console.log(`Budget aggiornati: €${weeklyBudget}/settimana, €${monthlyBudget}/mese`);

    // Ricarica i dati con i nuovi budget
    loadCurrentMonthData();
    createWeeklyChart();
}

async function loadCurrentMonthData() {
    try {
        if (window.electronAPI) {
            const purchases = await window.electronAPI.getPurchases();

            const now = new Date();
            const currentMonth = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0');

            // Filtra acquisti del mese corrente
            const currentMonthPurchases = purchases.filter(p => p.month === currentMonth);

            // Calcola spesa mensile
            const monthlySpent = currentMonthPurchases.reduce((sum, p) => sum + p.finalPrice, 0);

            // Calcola spesa settimanale corrente
            const weeklySpent = calculateCurrentWeekSpent(currentMonthPurchases);

            // Aggiorna UI
            updateCurrentMonthUI(monthlySpent, weeklySpent, currentMonth);
        }
    } catch (error) {
        console.error('Errore caricamento dati mese corrente:', error);
    }
}

function calculateCurrentWeekSpent(purchases) {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const currentWeekEnd = getWeekEnd(now);

    return purchases
        .filter(p => {
            const purchaseDate = new Date(p.date);
            return purchaseDate >= currentWeekStart && purchaseDate <= currentWeekEnd;
        })
        .reduce((sum, p) => sum + p.finalPrice, 0);
}

function updateCurrentMonthUI(monthlySpent, weeklySpent, currentMonth) {
    // Aggiorna titolo mese
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const [year, month] = currentMonth.split('-');
    document.getElementById('current-month-title').textContent =
        `${monthNames[parseInt(month) - 1]} ${year}`;

    // Aggiorna valori
    document.getElementById('month-spent').textContent = `€${monthlySpent.toFixed(2)}`;
    document.getElementById('week-spent').textContent = `€${weeklySpent.toFixed(2)}`;
    document.getElementById('remaining-monthly').textContent = `€${(monthlyBudget - monthlySpent).toFixed(2)}`;
    document.getElementById('remaining-weekly').textContent = `€${(weeklyBudget - weeklySpent).toFixed(2)}`;

    // Aggiorna status
    updateStatusIndicators(monthlySpent, weeklySpent);
}

function updateStatusIndicators(monthlySpent, weeklySpent) {
    const monthStatus = document.getElementById('month-status');
    const weekStatus = document.getElementById('week-status');

    // Status mensile
    if (monthlySpent < monthlyBudget) {
        monthStatus.textContent = 'Entro budget';
        monthStatus.className = 'card-status status-good';
    } else if (monthlySpent === monthlyBudget) {
        monthStatus.textContent = 'Al limite';
        monthStatus.className = 'card-status status-warning';
    } else {
        monthStatus.textContent = 'Budget superato';
        monthStatus.className = 'card-status status-danger';
    }

    // Status settimanale
    if (weeklySpent < weeklyBudget) {
        weekStatus.textContent = 'Entro budget';
        weekStatus.className = 'card-status status-good';
    } else if (weeklySpent === weeklyBudget) {
        weekStatus.textContent = 'Al limite';
        weekStatus.className = 'card-status status-warning';
    } else {
        weekStatus.textContent = 'Budget superato';
        weekStatus.className = 'card-status status-danger';
    }
}

async function loadMonthlyHistory() {
    try {
        if (window.electronAPI) {
            const purchases = await window.electronAPI.getPurchases();

            // Raggruppa per mese
            const monthlyData = {};
            purchases.forEach(purchase => {
                const month = purchase.month;
                if (!monthlyData[month]) {
                    monthlyData[month] = {
                        total: 0,
                        count: 0,
                        purchases: []
                    };
                }
                monthlyData[month].total += purchase.finalPrice;
                monthlyData[month].count++;
                monthlyData[month].purchases.push(purchase);
            });

            // Crea tabella cronologia
            updateHistoryTable(monthlyData);
        }
    } catch (error) {
        console.error('Errore caricamento cronologia:', error);
    }
}

function updateHistoryTable(monthlyData) {
    const tbody = document.getElementById('history-table-body');

    // Ordina mesi dal più recente
    const sortedMonths = Object.keys(monthlyData).sort().reverse();

    const rows = sortedMonths.map(month => {
        const data = monthlyData[month];
        const difference = data.total - monthlyBudget;
        const status = difference <= 0 ? 'Entro budget' : `+€${difference.toFixed(2)}`;
        const statusClass = difference <= 0 ? 'status-good' : 'status-danger';

        const [year, monthNum] = month.split('-');
        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
            'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        const monthDisplay = `${monthNames[parseInt(monthNum) - 1]} ${year}`;

        return `
            <tr>
                <td>${monthDisplay}</td>
                <td>€${data.total.toFixed(2)}</td>
                <td>€${monthlyBudget.toFixed(2)}</td>
                <td style="color: ${difference <= 0 ? '#28a745' : '#dc3545'}">
                    ${difference <= 0 ? '€' + (-difference).toFixed(2) : '+€' + difference.toFixed(2)}
                </td>
                <td>${data.count}</td>
                <td><span class="card-status ${statusClass}">${status}</span></td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
}

async function createWeeklyChart() {
    try {
        if (window.electronAPI) {
            const purchases = await window.electronAPI.getPurchases();

            const now = new Date();
            const currentMonth = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0');

            // Filtra acquisti del mese corrente
            const currentMonthPurchases = purchases.filter(p => p.month === currentMonth);

            // Calcola spese per settimana
            const weeklyData = calculateWeeklySpending(currentMonthPurchases, currentMonth);

            // Disegna il grafico
            drawWeeklyChart(weeklyData);
        }
    } catch (error) {
        console.error('Errore creazione grafico:', error);
    }
}

function calculateWeeklySpending(purchases, month) {
    const [year, monthNum] = month.split('-');
    const monthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);

    // Trova tutte le settimane del mese
    const weeks = [];
    const firstDay = new Date(monthDate);
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    // Crea le settimane (lunedì-domenica)
    let currentWeekStart = getWeekStart(firstDay);

    for (let weekNum = 1; weekNum <= 5; weekNum++) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);

        // Se la settimana è completamente fuori dal mese, fermati
        if (currentWeekStart > lastDay) break;

        const weekSpent = purchases
            .filter(p => {
                const purchaseDate = new Date(p.date);
                return purchaseDate >= currentWeekStart && purchaseDate <= weekEnd;
            })
            .reduce((sum, p) => sum + p.finalPrice, 0);

        weeks.push({
            weekNum: weekNum,
            start: new Date(currentWeekStart),
            end: new Date(weekEnd),
            spent: weekSpent,
            label: `Settimana ${weekNum}`,
            dateRange: `${currentWeekStart.getDate()}/${currentWeekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`
        });

        // Prossima settimana
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return weeks;
}

function drawWeeklyChart(weeklyData) {
    const canvas = document.getElementById('weekly-chart');
    const ctx = canvas.getContext('2d');

    // Pulisci canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Impostazioni grafico
    const padding = 80;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - (padding * 2);
    const maxValue = Math.max(weeklyBudget * 1.5, Math.max(...weeklyData.map(w => w.spent), 0));

    // Numero di settimane
    const weekCount = weeklyData.length;
    const barWidth = chartWidth / weekCount * 0.6;
    const barSpacing = chartWidth / weekCount;

    // Disegna griglia
    drawGrid(ctx, padding, chartWidth, chartHeight, maxValue);

    // Disegna linea budget
    const budgetY = padding + chartHeight - (weeklyBudget / maxValue * chartHeight);
    ctx.strokeStyle = '#dc3545';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, budgetY);
    ctx.lineTo(padding + chartWidth, budgetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Disegna barre
    weeklyData.forEach((week, index) => {
        const barHeight = (week.spent / maxValue) * chartHeight;
        const x = padding + (index * barSpacing) + (barSpacing - barWidth) / 2;
        const y = padding + chartHeight - barHeight;

        // Colore barra in base al budget
        let color;
        if (week.spent < weeklyBudget) {
            color = '#28a745'; // Verde - sotto budget
        } else if (week.spent >= weeklyBudget && week.spent <= weeklyBudget + 0.5) {
            color = '#F7BA14'; // Giallo - budget raggiunto (con tolleranza di 50 centesimi)
        } else {
            color = '#dc3545'; // Rosso - sopra budget
        }

        // Disegna barra
        ctx.fillStyle = color;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Aggiungi bordo
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);

        // Etichetta settimana
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(week.label, x + barWidth / 2, padding + chartHeight + 20);
        ctx.fillText(week.dateRange, x + barWidth / 2, padding + chartHeight + 35);

        // Valore spesa
        if (week.spent > 0) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px Arial';
            ctx.fillText(`€${week.spent.toFixed(2)}`, x + barWidth / 2, y - 5);
        }
    });

    // Etichette assi
    drawAxisLabels(ctx, padding, chartWidth, chartHeight, maxValue);
}

function drawGrid(ctx, padding, chartWidth, chartHeight, maxValue) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Linee orizzontali
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();
    }

    // Linee verticali (per le settimane)
    const weekCount = 4; // Assumiamo 4 settimane
    for (let i = 0; i <= weekCount; i++) {
        const x = padding + (chartWidth / weekCount) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, padding + chartHeight);
        ctx.stroke();
    }
}

function drawAxisLabels(ctx, padding, chartWidth, chartHeight, maxValue) {
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';

    // Etichette asse Y (valori euro)
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const value = (maxValue / gridLines) * (gridLines - i);
        const y = padding + (chartHeight / gridLines) * i;
        ctx.fillText(`€${value.toFixed(0)}`, padding - 15, y + 4);
    }

    // Etichetta asse X
    ctx.textAlign = 'center';
    ctx.fillText('Settimane', padding + chartWidth / 2, padding + chartHeight + 70);

    // Etichetta asse Y
    ctx.save();
    ctx.translate(15, padding + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Spesa (€)', 0, 0);
    ctx.restore();
}

// Utility functions
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
}

function getWeekEnd(date) {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekEnd;
}

function openMonthPicker() {
    const monthInput = document.getElementById('purchase-month');
    monthInput.showPicker();
}

function showFinancePage() {
    pages.forEach(page => page.classList.remove('active'));
    financePage.classList.add('active');

    // Nascondi nav delle generazioni e header
    document.querySelector('.nav').style.display = 'none';
    document.querySelector('.header').style.display = 'none';

    // Load default tab (transactions)
    switchFinanceTab('transactions');
}

async function initializeFinanceData() {
    try {
        // Load initial data when finance page is first accessed
        await loadBudgetSettings();
        await loadFinancialStats();
        console.log('Finance data initialized');
    } catch (error) {
        console.error('Error initializing finance data:', error);
    }
}

function setupFinanceNavigation() {
    // Finance tabs navigation
    financeTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchFinanceTab(tabName);
        });
    });

    // Transaction modal events
    addTransactionBtn.addEventListener('click', openTransactionModal);
    closeTransactionModalBtn.addEventListener('click', closeTransactionModal);
    transactionModal.addEventListener('click', (e) => {
        if (e.target === transactionModal) {
            closeTransactionModal();
        }
    });

    // Transaction type change
    transactionTypeSelect.addEventListener('change', updateCategoryOptions);

    // Save transaction
    saveTransactionBtn.addEventListener('click', saveTransaction);

    // Setup filters
    setupTransactionFilters();
}


// 4. Funzioni per la gestione delle tab Finance
function switchFinanceTab(tabName) {
    console.log('🔀 Switching to finance tab:', tabName);

    // Update tab buttons
    financeTabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    financeTabContents.forEach(content => {
        content.classList.remove('active');
    });

    // CAMBIATO: usa il mapping corretto degli ID
    let targetTabId;
    if (tabName === 'transactions') {
        targetTabId = 'transactions-tab';
    } else if (tabName === 'budget') {
        targetTabId = 'finance-budget-tab'; // NUOVO ID
    }

    const targetTab = document.getElementById(targetTabId);
    if (targetTab) {
        targetTab.classList.add('active');
        console.log('✅ Activated tab:', targetTab.id);
    } else {
        console.error('❌ Tab non trovata:', targetTabId);
        return;
    }

    // Load content based on tab
    if (tabName === 'transactions') {
        loadTransactions();
    } else if (tabName === 'budget') {
        console.log('📋 Loading finance budget tab...');
        setTimeout(async () => {
            // Reset dello stato
            spendingInsights = null;
            historicalData = {};

            // Ricarica tutto
            await loadBudgetOverview();
        }, 150);
    }
}

function debugFinanceTabs() {
    console.log('=== DEBUG FINANCE TABS ===');
    console.log('Finance tab buttons:', financeTabBtns.length);
    console.log('Finance tab contents:', financeTabContents.length);

    financeTabContents.forEach((content, index) => {
        console.log(`Tab ${index}:`, content.id, 'active:', content.classList.contains('active'));
    });

    const budgetTab = document.getElementById('budget-overview-tab');
    console.log('Budget tab found:', !!budgetTab);

    if (budgetTab) {
        const monthlyContent = budgetTab.querySelector('.monthly-analysis-content');
        console.log('Monthly analysis content found:', !!monthlyContent);
        console.log('Budget tab classes:', budgetTab.className);
    }
}

function resetBudgetTabContent() {
    const budgetTab = document.getElementById('budget-overview-tab');
    if (!budgetTab.querySelector('.monthly-analysis-content')) {
        // Se non c'è il nuovo contenuto, ricrea l'HTML
        console.log('Resetting budget tab content to new monthly analysis');
        // Il contenuto dovrebbe essere già presente nel HTML che hai aggiornato
    }
}


async function loadFinancialStats() {
    try {
        if (window.electronAPI) {
            const currentMonth = new Date().toISOString().substring(0, 7);
            currentFinancialStats = await window.electronAPI.getFinancialStats(currentMonth);
            console.log('Financial stats loaded:', currentFinancialStats);
        }
    } catch (error) {
        console.error('Errore caricamento statistiche finanziarie:', error);
    }
}

// 5. Funzioni per il modal delle transazioni
function openTransactionModal() {
    transactionModal.classList.remove('hidden');
    resetTransactionModal();
    document.getElementById('transaction-description').focus();
}

function closeTransactionModal() {
    transactionModal.classList.add('hidden');
}

function resetTransactionModal() {
    document.getElementById('transaction-type').value = 'expense';
    document.getElementById('transaction-category').value = 'fisse';
    document.getElementById('transaction-description').value = '';
    document.getElementById('transaction-amount').value = '';
    updateCategoryOptions();
}

function updateCategoryOptions() {
    const type = transactionTypeSelect.value;
    const categorySelect = transactionCategorySelect;

    categorySelect.innerHTML = '';

    if (type === 'expense') {
        categorySelect.innerHTML = `
            <option value="fisse">Spese Fisse</option>
            <option value="variabili">Spese Variabili</option>
            <option value="svago">Spese Svago</option>
            <option value="risparmi">Risparmi</option>
        `;
    } else {
        // Per le entrate, solo una categoria
        categorySelect.innerHTML = `
            <option value="income">Entrate</option>
        `;
        // Disabilita la select delle categorie per le entrate
        categorySelect.disabled = true;
    }

    // Riabilita la select per le uscite
    if (type === 'expense') {
        categorySelect.disabled = false;
    }
}

async function saveTransaction() {
    const type = document.getElementById('transaction-type').value;
    const category = document.getElementById('transaction-category').value;
    const description = document.getElementById('transaction-description').value.trim();
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const date = document.getElementById('transaction-date').value;

    // Validation
    if (!description) {
        alert('Inserisci una descrizione');
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        alert('Inserisci un importo valido');
        return;
    }

    if (!date) {
        alert('Seleziona una data');
        return;
    }

    try {
        if (window.electronAPI) {
            const success = await window.electronAPI.addTransaction({
                type,
                category,
                description,
                amount,
                date
            });

            if (success) {
                console.log('Transazione salvata con successo');
                closeTransactionModal();

                // Refresh data
                await loadTransactions();
                await loadFinancialStats();
                await loadBudgetOverview();
            } else {
                alert('Errore durante il salvataggio della transazione');
            }
        }
    } catch (error) {
        console.error('Errore salvataggio transazione:', error);
        alert('Errore durante il salvataggio della transazione');
    }
}

// ===================
// FINANCE SETUP
// ===================

function setupFinance() {
    setupFinanceNavigation();
    setupTransactionFilters();
    loadBudgetSettings();

    const currentDate = new Date().toISOString().split('T')[0];
    const transactionDateInput = document.getElementById('transaction-date');
    if (transactionDateInput) {
        transactionDateInput.value = currentDate;
    }

    // Debug per verificare che tutto sia ok
    setTimeout(debugFinanceTabs, 1000);

    console.log('Finance module initialized');
}

// 8. Funzioni placeholder per future implementazioni
async function loadTransactions() {
    try {
        if (window.electronAPI) {
            const filterCategory = document.getElementById('filter-category')?.value || 'all';
            const sortBy = document.getElementById('sort-transactions')?.value || 'date';

            const currentMonth = new Date().toISOString().substring(0, 7);

            const filters = {
                sortBy,
                category: filterCategory,
                month: currentMonth // Solo transazioni del mese corrente
            };

            const transactions = await window.electronAPI.getTransactions(filters);
            displayTransactions(transactions);
            updateBalanceSummary(transactions);
        }
    } catch (error) {
        console.error('Errore caricamento transazioni:', error);
        const transactionsList = document.getElementById('transactions-list');
        if (transactionsList) {
            transactionsList.innerHTML = '<p style="color: #dc3545; padding: 20px;">Errore durante il caricamento delle transazioni</p>';
        }
    }
}

function displayTransactions(transactions) {
    const transactionsList = document.getElementById('transactions-list');

    if (!transactions || transactions.length === 0) {
        transactionsList.innerHTML = '<p style="color: #ccc; padding: 20px; text-align: center;">Nessuna transazione trovata</p>';
        return;
    }

    const transactionsHtml = transactions.map(transaction => {
        const date = new Date(transaction.date).toLocaleDateString('it-IT');
        const amountClass = transaction.type === 'income' ? 'income' : 'expense';
        const amountPrefix = transaction.type === 'income' ? '+' : '-';

        // Per le entrate, mostra sempre "Entrate" come categoria
        const categoryToShow = transaction.type === 'income' ? 'income' : transaction.category;

        return `
            <div class="transaction-item">
                <div class="transaction-date">${date}</div>
                <div class="transaction-description">${transaction.description}</div>
                <div class="transaction-category ${categoryToShow}">${getCategoryDisplayName(categoryToShow)}</div>
                <div class="transaction-amount ${amountClass}">${amountPrefix}€${transaction.amount.toFixed(2)}</div>
                <button class="transaction-delete-btn" onclick="deleteTransaction('${transaction._id}')">🗑️</button>
            </div>
        `;
    }).join('');

    transactionsList.innerHTML = transactionsHtml;
}

function getCategoryDisplayName(category) {
    const categoryNames = {
        'fisse': 'Fisse',
        'variabili': 'Variabili',
        'svago': 'Svago',
        'risparmi': 'Risparmi',
        'income': 'Entrate'
    };
    return categoryNames[category] || category;
}


function updateBudgetDisplay() {
    if (!currentBudgetSettings || !currentFinancialStats) {
        console.log('Missing data for budget display');
        return;
    }

    // Update month title
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const [year, month] = currentFinancialStats.month.split('-');
    document.getElementById('current-budget-month-title').textContent =
        `Budget ${monthNames[parseInt(month) - 1]} ${year}`;

    // Update income/expenses overview
    document.getElementById('month-income').textContent = formatCurrency(currentFinancialStats.totalIncome);
    document.getElementById('month-expenses').textContent = formatCurrency(currentFinancialStats.totalExpenses);
    document.getElementById('month-available').textContent = formatCurrency(currentFinancialStats.netBalance);

    // Calculate budget allocations based on income
    const budgetAllocations = calculateBudgetPercentages(currentFinancialStats.totalIncome);

    // Update each category
    updateCategoryCard('fisse', budgetAllocations.fisse, currentFinancialStats.expensesByCategory.fisse);
    updateCategoryCard('variabili', budgetAllocations.variabili, currentFinancialStats.expensesByCategory.variabili);
    updateCategoryCard('svago', budgetAllocations.svago, currentFinancialStats.expensesByCategory.svago);
    updateCategoryCard('risparmi', budgetAllocations.risparmi, currentFinancialStats.expensesByCategory.risparmi);
}

function updateCategoryCard(category, budget, spent) {
    // Update budget amounts
    document.getElementById(`${category}-budget`).textContent = formatCurrency(budget);
    document.getElementById(`${category}-spent`).textContent = formatCurrency(spent);
    document.getElementById(`${category}-remaining`).textContent = formatCurrency(budget - spent);

    // Update progress bar
    updateProgressBar(category, spent, budget);
}

async function deleteTransaction(transactionId) {
    try {
        if (window.electronAPI) {
            const success = await window.electronAPI.deleteTransaction(transactionId);

            if (success) {
                console.log('Transazione eliminata con successo');
                await loadTransactions();
                await loadFinancialStats();
                await loadBudgetOverview();
            } else {
                alert('Errore durante l\'eliminazione della transazione');
            }
        }
    } catch (error) {
        console.error('Errore eliminazione transazione:', error);
        alert('Errore durante l\'eliminazione della transazione');
    }
}

function setupTransactionFilters() {
    const filterCategory = document.getElementById('filter-category');
    const sortTransactions = document.getElementById('sort-transactions');

    if (filterCategory) {
        filterCategory.addEventListener('change', loadTransactions);
    }

    if (sortTransactions) {
        sortTransactions.addEventListener('change', loadTransactions);
    }
}

// 10. Funzioni di utilità per calcoli budget
function calculateBudgetPercentages(totalIncome) {
    return {
        fisse: totalIncome * (currentBudgetSettings.percentages.fisse / 100),
        variabili: totalIncome * (currentBudgetSettings.percentages.variabili / 100),
        svago: totalIncome * (currentBudgetSettings.percentages.svago / 100),
        risparmi: totalIncome * (currentBudgetSettings.percentages.risparmi / 100)
    };
}

function getBudgetStatus(spent, budget) {
    const percentage = budget > 0 ? (spent / budget) * 100 : 0;

    if (percentage <= 80) {
        return { status: 'good', text: 'Entro Budget' };
    } else if (percentage <= 100) {
        return { status: 'warning', text: 'Attenzione' };
    } else {
        return { status: 'danger', text: 'Budget Superato' };
    }
}

// 11. Funzioni per aggiornare i colori delle progress bar
function updateProgressBar(category, spent, budget) {
    const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const progressBar = document.querySelector(`.${category}-progress`);
    const progressText = progressBar?.parentElement.querySelector('.progress-text');
    const statusElement = progressBar?.parentElement.parentElement.querySelector('.category-status');

    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }

    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}% utilizzato`;
    }

    if (statusElement) {
        const status = getBudgetStatus(spent, budget);
        statusElement.textContent = status.text;
        statusElement.className = `category-status status-${status.status}`;
    }
}

// 12. Funzione per formattare valori monetari
function formatCurrency(amount) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

// 13. Funzione per aggiornare il riepilogo del bilancio
function updateBalanceSummary(transactions) {
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const netBalance = income - expenses;

    document.getElementById('total-income').textContent = formatCurrency(income);
    document.getElementById('total-expenses').textContent = formatCurrency(expenses);
    document.getElementById('net-balance').textContent = formatCurrency(netBalance);

    // Update net balance color
    const netBalanceEl = document.getElementById('net-balance');
    if (netBalance > 0) {
        netBalanceEl.className = 'balance-value income';
    } else if (netBalance < 0) {
        netBalanceEl.className = 'balance-value expense';
    } else {
        netBalanceEl.className = 'balance-value net';
    }
}

async function loadBudgetOverview() {
    // Controlla se siamo nella tab corretta
    const budgetTab = document.getElementById('finance-budget-tab');
    if (!budgetTab || !budgetTab.classList.contains('active')) {
        console.log('❌ Finance budget tab non attiva, skip caricamento');
        return;
    }

    try {
        // Reset variables per sicurezza
        spendingInsights = null;
        historicalData = {};

        console.log('📊 1. Loading spending insights...');
        await loadSpendingInsights();
        console.log('✅ Spending insights loaded:', !!spendingInsights);

        console.log('⚙️ 3. Loading budget settings...');
        await loadBudgetSettings();
        console.log('✅ Budget settings loaded');

        console.log('💰 4. Loading financial stats...');
        await loadFinancialStats();
        console.log('✅ Financial stats loaded');

        // Aspetta un momento per assicurarsi che tutti i dati siano pronti
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update UI step by step con logging e gestione errori
        try {
            console.log('   - Updating monthly analysis...');
            updateMonthlyAnalysisDisplay();
        } catch (error) {
            console.error('❌ Error updating monthly analysis:', error);
        }

        try {
            console.log('   - Updating category analysis...');
            updateCategoryAnalysis();
        } catch (error) {
            console.error('❌ Error updating category analysis:', error);
        }

    } catch (error) {
        console.error('❌ Errore caricamento analisi mensile:', error);
        console.error('Riprova più tardi o controlla la console per dettagli');
    }
}

// ===================
// LOAD DATA FUNCTIONS
// ===================
async function loadSpendingInsights() {
    try {
        console.log('Loading spending insights...');
        if (window.electronAPI) {
            spendingInsights = await window.electronAPI.getSpendingInsights();
            console.log('Insights caricati:', spendingInsights);
        } else {
            console.warn('electronAPI non disponibile');
            spendingInsights = null;
        }
    } catch (error) {
        console.error('Errore caricamento insights:', error);
        spendingInsights = null;
    }
}

// ===================
// UPDATE DISPLAY FUNCTIONS
// ===================
function updateMonthlyAnalysisDisplay() {
    updateInsightsDisplay();
}

function updateInsightsDisplay() {
    const container = document.getElementById('insights-container');
    if (!container || !spendingInsights?.insights) return;

    const insightsHtml = spendingInsights.insights.map(insight => {
        const type = getInsightType(insight);
        return `<div class="insight-item ${type}">${insight}</div>`;
    }).join('');

    container.innerHTML = insightsHtml;
}

function getInsightType(insight) {
    if (insight.includes('💰') || insight.includes('🎯') || insight.includes('aumentate')) {
        return 'positive';
    } else if (insight.includes('⚠️') || insight.includes('Attenzione')) {
        return 'warning';
    } else if (insight.includes('🚨') || insight.includes('diminuite') || insight.includes('sforato')) {
        return 'negative';
    }
    return 'neutral';
}

// ===================
// CATEGORY ANALYSIS
// ===================
function updateCategoryAnalysis() {
    console.log('📊 Updating category analysis...');

    if (!spendingInsights) {
        console.log('⚠️ No spending insights for category analysis, using defaults');
        showDefaultCategoryAnalysis();
        return;
    }

    const { currentMonth, trends } = spendingInsights;
    const targetPercentages = { fisse: 40, variabili: 30, svago: 15, risparmi: 15 };

    console.log('📈 Current month data:', currentMonth);
    console.log('📈 Trends data:', trends);

    Object.keys(targetPercentages).forEach(category => {
        console.log(`🔄 Processing category: ${category}`);
        try {
            updateCategoryAnalysisCard(category, currentMonth, trends, targetPercentages[category]);
        } catch (error) {
            console.error(`❌ Error updating category ${category}:`, error);
        }
    });

    console.log('✅ Category analysis update completed');
}

function showDefaultCategoryAnalysis() {
    const categories = ['fisse', 'variabili', 'svago', 'risparmi'];

    categories.forEach(category => {
        // Update values with defaults
        const amountEl = document.getElementById(`${category}-amount`);
        const percentageEl = document.getElementById(`${category}-percentage`);
        const trendEl = document.getElementById(`${category}-trend`);
        const statusEl = document.getElementById(`${category}-status`);

        if (amountEl) amountEl.textContent = formatCurrency(0);
        if (percentageEl) percentageEl.textContent = '0%';

        if (trendEl) {
            trendEl.className = 'metric-trend neutral';
            trendEl.textContent = '≈0%';
        }

        if (statusEl) {
            statusEl.className = 'category-status good';
            statusEl.textContent = 'Nessun Dato';
        }
    });
}

function updateCategoryAnalysisCard(category, currentMonth, trends, targetPercentage) {
    console.log(`📊 Updating category analysis card for: ${category}`);

    // Per tutte le categorie (inclusi risparmi): prendiamo le spese effettive
    const amount = currentMonth.expensesByCategory[category] || 0;
    const actualPercentage = currentMonth.totalIncome > 0 ?
        (amount / currentMonth.totalIncome) * 100 : 0;
    const trend = trends.categoryTrends[category] || 0;

    // Lista di elementi da aggiornare
    const elementsToUpdate = [
        { id: `${category}-amount`, value: formatCurrency(amount) },
        { id: `${category}-percentage`, value: `${actualPercentage.toFixed(1)}%` }
    ];

    // Aggiorna gli elementi
    elementsToUpdate.forEach(({ id, value }) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });

    // Update trend
    const trendElement = document.getElementById(`${category}-trend`);
    if (trendElement) {
        if (Math.abs(trend) < 5) {
            trendElement.className = 'metric-trend neutral';
            trendElement.textContent = '≈0%';
        } else if (trend > 0) {
            trendElement.className = 'metric-trend positive';
            trendElement.textContent = `+${trend.toFixed(1)}%`;
        } else {
            trendElement.className = 'metric-trend negative';
            trendElement.textContent = `${trend.toFixed(1)}%`;
        }
    }

    // Update status con logica speciale SOLO per risparmi
    const statusElement = document.getElementById(`${category}-status`);
    if (statusElement) {
        let statusClass, statusText;

        if (category === 'risparmi') {
            // Per i risparmi: più alta è la percentuale spesa in risparmi, meglio è
            if (actualPercentage >= targetPercentage) {
                statusClass = 'good';
                statusText = 'Obiettivo Raggiunto';
            } else if (actualPercentage >= targetPercentage * 0.8) { // Almeno 80% del target
                statusClass = 'warning';
                statusText = 'Sotto Obiettivo';
            } else {
                statusClass = 'danger';
                statusText = 'Molto Sotto';
            }
        } else {
            // Per le altre categorie: meno spendi rispetto al target, meglio è
            if (actualPercentage <= targetPercentage) {
                statusClass = 'good';
                statusText = 'Entro Target';
            } else if (actualPercentage <= targetPercentage * 1.2) {
                statusClass = 'warning';
                statusText = 'Sopra Target';
            } else {
                statusClass = 'danger';
                statusText = 'Molto Sopra';
            }
        }

        statusElement.className = `category-status ${statusClass}`;
        statusElement.textContent = statusText;
    }
}

window.selectPokemonForPurchase = selectPokemonForPurchase;
window.deletePurchase = deletePurchase;
window.openMonthPicker = openMonthPicker;
window.deleteTransaction = deleteTransaction;
window.openTransactionModal = openTransactionModal;
window.closeTransactionModal = closeTransactionModal;
window.openPokemonUrl = openPokemonUrl;

// Error Handling
window.addEventListener('error', (event) => {
    console.error('Errore:', event.error);
});

// Debug
window.pokemonApp = {
    showGeneration,
    loadDashboardStats,
    currentGeneration,
    generationCounts
};