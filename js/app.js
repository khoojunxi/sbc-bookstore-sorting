let activeBook = null;
let filteredBooksList = [];
let pendingBarcode = '';

const scanner = new BarcodeScanner('video-preview', handleScannedISBN);

// DOM Elements
const sectionScan = document.getElementById('section-scan');
const sectionStationeryStocktake = document.getElementById('section-stationery-stocktake');
const sectionNewBook = document.getElementById('section-new-book');
const sectionNewStationery = document.getElementById('section-new-stationery');
const sectionInventory = document.getElementById('section-inventory');
const modalItemType = document.getElementById('modal-item-type');
const modalExisting = document.getElementById('modal-existing-book');
const manualIsbnInput = document.getElementById('manual-isbn');

// Navigation Switches
document.getElementById('nav-scan').addEventListener('click', () => showSection('scan'));
document.getElementById('nav-stationery').addEventListener('click', async () => {
  showSection('stationery-stocktake');
  await prepareStationeryStocktake();
});
document.getElementById('nav-inventory').addEventListener('click', () => {
  showSection('inventory');
  loadInventory();
});

function showSection(name) {
  sectionScan.classList.add('hidden');
  sectionStationeryStocktake.classList.add('hidden');
  sectionNewBook.classList.add('hidden');
  sectionNewStationery.classList.add('hidden');
  sectionInventory.classList.add('hidden');
  modalExisting.classList.add('hidden');
  modalItemType.classList.add('hidden');

  document.getElementById('nav-scan').classList.remove('active');
  document.getElementById('nav-stationery').classList.remove('active');
  document.getElementById('nav-inventory').classList.remove('active');

  if (name === 'scan') {
    sectionScan.classList.remove('hidden');
    document.getElementById('nav-scan').classList.add('active');
  } else if (name === 'stationery-stocktake') {
    sectionStationeryStocktake.classList.remove('hidden');
    document.getElementById('nav-stationery').classList.add('active');
    scanner.stop();
  } else if (name === 'inventory') {
    sectionInventory.classList.remove('hidden');
    document.getElementById('nav-inventory').classList.add('active');
    scanner.stop();
  } else if (name === 'new-book') {
    sectionNewBook.classList.remove('hidden');
    scanner.stop();
  } else if (name === 'new-stationery') {
    sectionNewStationery.classList.remove('hidden');
    scanner.stop();
  }
}

// Start Camera Scanning
document.getElementById('btn-start-scan').addEventListener('click', () => {
  scanner.start();
});

// Manual Barcode / ISBN Search
document.getElementById('btn-manual-submit').addEventListener('click', () => {
  const isbn = manualIsbnInput.value.trim();
  if (isbn) {
    handleScannedISBN(isbn);
  } else {
    alert('Please enter an ISBN, barcode, or SBC stationery code');
  }
});

async function handleScannedISBN(rawISBN) {
  const code = cleanLookupCode(rawISBN);
  if (!code) {
    alert('Invalid code');
    return;
  }

  manualIsbnInput.value = '';

  try {
    const localMatches = await StorageManager.getBooksByBarcode(code);
    const localBook = localMatches[0] || null;

    if (localBook) {
      activeBook = localBook;
      document.getElementById('ext-type').textContent = localBook.itemType || 'Book';
      document.getElementById('ext-title').textContent = localBook.title;
      document.getElementById('ext-publisher').textContent = localBook.publisher || 'N/A';
      document.getElementById('ext-rack').textContent = localBook.rackLocation;
      document.getElementById('ext-category').textContent = localBook.bookCategory;
      document.getElementById('ext-price').textContent = formatPrice(localBook.sellingPrice);
      document.getElementById('ext-qty').textContent = localBook.quantity;
      document.getElementById('add-qty-input').value = 1;
      
      modalExisting.classList.remove('hidden');
    } else {
      pendingBarcode = code;
      modalItemType.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Workflow Error:', err);
    alert('Error processing barcode: ' + err.message);
  }
}

// Dynamic Publisher/Supplier suggestions populate
async function updatePublisherSuggestions() {
  const allBooks = await StorageManager.getAllBooks();
  const publishers = [...new Set(allBooks.map(b => b.publisher).filter(Boolean))].sort();
  
  const datalist = document.getElementById('publisher-suggestions');
  if (datalist) {
    datalist.innerHTML = publishers.map(pub => `<option value="${escapeHTML(pub)}">`).join('');
  }
}

// Item Type Selection Handlers
document.getElementById('btn-type-book').addEventListener('click', async () => {
  modalItemType.classList.add('hidden');
  await updatePublisherSuggestions();

  const bookIsbn = cleanISBN(pendingBarcode);
  if (!bookIsbn) {
    alert('Please enter a valid ISBN for book lookup.');
    showSection('scan');
    return;
  }

  const meta = await MetadataFetcher.fetchBookInfo(bookIsbn);

  document.getElementById('nb-isbn').value = bookIsbn;
  document.getElementById('nb-title').value = meta.title || '';
  document.getElementById('nb-publisher').value = meta.publisher || '';
  document.getElementById('nb-rack').value = StorageManager.getLastRack();
  document.getElementById('nb-category').value = '';
  document.getElementById('nb-price').value = '';
  document.getElementById('nb-qty').value = 1;

  showSection('new-book');
});

document.getElementById('btn-type-stationery').addEventListener('click', async () => {
  modalItemType.classList.add('hidden');
  await updatePublisherSuggestions();

  document.getElementById('st-code').value = pendingBarcode;
  document.getElementById('st-supplier').value = StorageManager.getLastSupplier();
  document.getElementById('st-name').value = '';
  document.getElementById('st-rack').value = StorageManager.getLastRack();
  document.getElementById('st-qty').value = 1;
  document.getElementById('st-price').value = '';
  document.getElementById('st-status').textContent = '';

  showSection('stationery-stocktake');
  await prepareStationeryStocktake();
});

function cleanLookupCode(value) {
  return asText(value).trim().replace(/\s+/g, '').replace(/[^0-9A-Za-z-]/g, '').toUpperCase();
}

function cleanISBN(isbn) {
  return asText(isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
}

function asText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function escapeHTML(value) {
  return asText(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function formatPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) ? price.toFixed(2) : '0.00';
}

function isStationeryItem(item) {
  return item.itemType === 'Stationery' || item.bookCategory === 'Stationery';
}

function csvCell(value) {
  return `"${asText(value).replace(/"/g, '""')}"`;
}

// Google Search Helper
document.getElementById('btn-search-google').addEventListener('click', () => {
  const isbn = document.getElementById('nb-isbn').value;
  if (!isbn) {
    alert('No ISBN found to search.');
    return;
  }
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(isbn + ' site:my OR popular OR mph')}`;
  window.open(searchUrl, '_blank');
});

// Existing Quantity increment
document.getElementById('btn-confirm-add').addEventListener('click', async () => {
  const addQty = parseInt(document.getElementById('add-qty-input').value, 10);
  if (isNaN(addQty) || addQty < 1) {
    alert('Please enter a valid quantity');
    return;
  }

  activeBook.quantity += addQty;
  await StorageManager.saveBook(activeBook);
  modalExisting.classList.add('hidden');
  alert(`Quantity updated! Total: ${activeBook.quantity}`);
  if (isStationeryItem(activeBook)) {
    showSection('stationery-stocktake');
    await prepareStationeryStocktake();
  } else {
    showSection('scan');
  }
});

document.getElementById('btn-cancel-add').addEventListener('click', () => {
  modalExisting.classList.add('hidden');
});

// Save Book
document.getElementById('form-new-book').addEventListener('submit', async (e) => {
  e.preventDefault();

  const rack = document.getElementById('nb-rack').value.trim();
  const book = {
    itemType: 'Book',
    isbn: document.getElementById('nb-isbn').value,
    title: document.getElementById('nb-title').value.trim(),
    publisher: document.getElementById('nb-publisher').value.trim(),
    rackLocation: rack,
    bookCategory: document.getElementById('nb-category').value,
    sellingPrice: parseFloat(document.getElementById('nb-price').value),
    quantity: parseInt(document.getElementById('nb-qty').value, 10)
  };

  await StorageManager.saveBook(book);
  StorageManager.setLastRack(rack);

  alert('Book saved successfully!');
  showSection('scan');
});

document.getElementById('btn-cancel-new-book').addEventListener('click', () => {
  showSection('scan');
});

// Save Stationery
document.getElementById('form-new-stationery').addEventListener('submit', async (e) => {
  e.preventDefault();

  const rack = document.getElementById('ns-rack').value.trim();
  const stationery = {
    itemType: 'Stationery',
    isbn: document.getElementById('ns-barcode').value,
    title: document.getElementById('ns-name').value.trim(),
    publisher: document.getElementById('ns-supplier').value.trim(),
    rackLocation: rack,
    bookCategory: 'Stationery',
    sellingPrice: parseFloat(document.getElementById('ns-price').value),
    quantity: parseInt(document.getElementById('ns-qty').value, 10),
    updatedAt: Date.now()
  };

  await StorageManager.saveBook(stationery);
  StorageManager.setLastRack(rack);
  StorageManager.setLastSupplier(stationery.publisher);

  alert('Stationery item saved successfully!');
  showSection('stationery-stocktake');
  await prepareStationeryStocktake();
});

document.getElementById('btn-cancel-new-stat').addEventListener('click', () => {
  showSection('stationery-stocktake');
  prepareStationeryStocktake();
});

// Dedicated stationery stocktake workflow
async function prepareStationeryStocktake() {
  await updatePublisherSuggestions();

  if (!document.getElementById('st-supplier').value) {
    document.getElementById('st-supplier').value = StorageManager.getLastSupplier();
  }
  if (!document.getElementById('st-rack').value) {
    document.getElementById('st-rack').value = StorageManager.getLastRack();
  }

  await updateStationerySupplierSummary();
  await updateRecentStationeryList();
  document.getElementById('st-code').focus();
}

async function findStationeryStocktakeMatch(code, supplier) {
  const matches = await StorageManager.getBooksByBarcode(code);
  const normalizedSupplier = asText(supplier).trim().toLowerCase();

  return matches.find(item =>
    isStationeryItem(item) &&
    asText(item.publisher).trim().toLowerCase() === normalizedSupplier
  ) || null;
}

async function prefillStocktakeFromExisting() {
  const code = cleanLookupCode(document.getElementById('st-code').value);
  const supplier = document.getElementById('st-supplier').value.trim();
  if (!code) return;

  const matches = await StorageManager.getBooksByBarcode(code);
  const stationeryMatches = matches.filter(isStationeryItem);
  if (!stationeryMatches.length) {
    document.getElementById('st-status').textContent = '';
    return;
  }

  const exactMatch = supplier
    ? stationeryMatches.find(item => asText(item.publisher).trim().toLowerCase() === supplier.toLowerCase())
    : null;
  if (supplier && !exactMatch) {
    document.getElementById('st-status').textContent = `Code ${code} exists under another supplier. Fill the item details to save it under ${supplier}.`;
    return;
  }

  const item = exactMatch || stationeryMatches[0];

  if (!document.getElementById('st-supplier').value) {
    document.getElementById('st-supplier').value = item.publisher || '';
  }
  document.getElementById('st-name').value = item.title || '';
  document.getElementById('st-rack').value = item.rackLocation || StorageManager.getLastRack();
  document.getElementById('st-qty').value = item.quantity || 0;
  document.getElementById('st-price').value = item.sellingPrice || '';
  document.getElementById('st-status').textContent = `Loaded existing stationery item ${code}. Update the counted quantity and save.`;
}

function clearStocktakeLine() {
  document.getElementById('st-code').value = '';
  document.getElementById('st-name').value = '';
  document.getElementById('st-qty').value = 1;
  document.getElementById('st-price').value = '';
}

async function updateStationerySupplierSummary() {
  const allBooks = await StorageManager.getAllBooks();
  const supplierSummary = allBooks
    .filter(isStationeryItem)
    .reduce((acc, item) => {
      const supplier = item.publisher || 'No Supplier';
      if (!acc[supplier]) {
        acc[supplier] = { items: 0, qty: 0, total: 0 };
      }
      acc[supplier].items += 1;
      acc[supplier].qty += Number(item.quantity) || 0;
      return acc;
    }, {});

  const container = document.getElementById('stationery-supplier-summary');
  const rows = Object.entries(supplierSummary).sort(([a], [b]) => a.localeCompare(b));

  if (!rows.length) {
    container.innerHTML = '<p class="empty-state">No stationery counted yet.</p>';
    return;
  }

  container.innerHTML = rows.map(([supplier, summary]) => `
    <div class="supplier-row">
      <strong>${escapeHTML(supplier)}</strong>
      <span>${summary.items} items</span>
      <span>${summary.qty} qty</span>
    </div>
  `).join('');
}

async function updateRecentStationeryList() {
  const allBooks = await StorageManager.getAllBooks();
  const recentItems = allBooks
    .filter(isStationeryItem)
    .sort((a, b) => (Number(b.updatedAt) || Number(b.id) || 0) - (Number(a.updatedAt) || Number(a.id) || 0))
    .slice(0, 6);

  const container = document.getElementById('stationery-recent-list');
  if (!recentItems.length) {
    container.innerHTML = '<p class="empty-state">No stationery saved yet.</p>';
    return;
  }

  container.innerHTML = recentItems.map(item => `
    <div class="recent-row">
      <strong>${escapeHTML(item.isbn)} - ${escapeHTML(item.title)}</strong>
      <span>${escapeHTML(item.publisher || '-')}</span>
      <span>Rack ${escapeHTML(item.rackLocation || '-')}</span>
      <span>Qty ${escapeHTML(item.quantity)}</span>
    </div>
  `).join('');
}

['st-code', 'st-supplier'].forEach(id => {
  document.getElementById(id).addEventListener('change', prefillStocktakeFromExisting);
});

document.getElementById('btn-stocktake-view').addEventListener('click', () => {
  showSection('inventory');
  document.getElementById('filter-category').value = 'Stationery';
  loadInventory();
});

document.getElementById('form-stationery-stocktake').addEventListener('submit', async (e) => {
  e.preventDefault();

  const code = cleanLookupCode(document.getElementById('st-code').value);
  const supplier = document.getElementById('st-supplier').value.trim();
  const name = document.getElementById('st-name').value.trim();
  const rack = document.getElementById('st-rack').value.trim();
  const qty = parseInt(document.getElementById('st-qty').value, 10);
  const price = parseFloat(document.getElementById('st-price').value);

  if (!code || !supplier || !name || !rack) {
    alert('SBC code, supplier, item name, and location are required.');
    return;
  }

  if (!Number.isInteger(qty) || qty < 0) {
    alert('Please enter a valid counted quantity.');
    return;
  }

  if (!Number.isFinite(price) || price < 0) {
    alert('Please enter a valid selling price.');
    return;
  }

  const existing = await findStationeryStocktakeMatch(code, supplier);
  const stationery = existing || {
    itemType: 'Stationery',
    isbn: code,
    bookCategory: 'Stationery'
  };

  stationery.isbn = code;
  stationery.title = name;
  stationery.publisher = supplier;
  stationery.rackLocation = rack;
  stationery.sellingPrice = price;
  stationery.quantity = qty;
  stationery.updatedAt = Date.now();

  await StorageManager.saveBook(stationery);
  StorageManager.setLastRack(rack);
  StorageManager.setLastSupplier(supplier);

  document.getElementById('st-status').textContent = `${existing ? 'Updated' : 'Saved'} ${code} - ${name}.`;
  clearStocktakeLine();
  await updatePublisherSuggestions();
  await updateStationerySupplierSummary();
  await updateRecentStationeryList();
  document.getElementById('st-code').focus();
});

// Inventory Table and Filters
async function loadInventory() {
  const allBooks = await StorageManager.getAllBooks();
  populateDropdowns(allBooks);
  filterAndRender(allBooks);
}

function populateDropdowns(books) {
  const rackSelect = document.getElementById('filter-rack');
  const pubSelect = document.getElementById('filter-publisher');

  const racks = [...new Set(books.map(b => b.rackLocation).filter(Boolean))].sort();
  const pubs = [...new Set(books.map(b => b.publisher).filter(Boolean))].sort();

  rackSelect.innerHTML = '<option value="">All Racks</option>' + racks.map(r => `<option value="${escapeHTML(r)}">${escapeHTML(r)}</option>`).join('');
  pubSelect.innerHTML = '<option value="">All Publishers/Suppliers</option>' + pubs.map(p => `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`).join('');
}

['inv-search', 'filter-rack', 'filter-publisher', 'filter-category'].forEach(id => {
  document.getElementById(id).addEventListener('input', async () => {
    const allBooks = await StorageManager.getAllBooks();
    filterAndRender(allBooks);
  });
});

function filterAndRender(books) {
  const query = document.getElementById('inv-search').value.toLowerCase();
  const rackFilter = document.getElementById('filter-rack').value;
  const pubFilter = document.getElementById('filter-publisher').value;
  const catFilter = document.getElementById('filter-category').value;

  filteredBooksList = books.filter(b => {
    const matchesSearch = asText(b.isbn).toLowerCase().includes(query) ||
                          asText(b.title).toLowerCase().includes(query) ||
                          asText(b.publisher).toLowerCase().includes(query) ||
                          asText(b.rackLocation).toLowerCase().includes(query) ||
                          asText(b.bookCategory).toLowerCase().includes(query);

    const matchesRack = !rackFilter || b.rackLocation === rackFilter;
    const matchesPub = !pubFilter || b.publisher === pubFilter;
    const matchesCat = !catFilter || b.bookCategory === catFilter;

    return matchesSearch && matchesRack && matchesPub && matchesCat;
  });

  filteredBooksList.sort((a, b) => {
    if (asText(a.bookCategory) !== asText(b.bookCategory)) {
      return asText(a.bookCategory).localeCompare(asText(b.bookCategory));
    }
    if (asText(a.rackLocation) !== asText(b.rackLocation)) {
      return asText(a.rackLocation).localeCompare(asText(b.rackLocation));
    }
    return asText(a.title).localeCompare(asText(b.title));
  });

  renderTable(filteredBooksList);
  updateSummaryCards(filteredBooksList);
}

function renderTable(books) {
  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = books.map(b => `
    <tr>
      <td>${escapeHTML(b.rackLocation)}</td>
      <td>${escapeHTML(b.bookCategory)}</td>
      <td>${escapeHTML(b.publisher || '-')}</td>
      <td>${escapeHTML(b.isbn)}</td>
      <td>${escapeHTML(b.title)}</td>
      <td>${escapeHTML(b.quantity)}</td>
      <td>${formatPrice(b.sellingPrice)}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-tertiary" data-action="edit" data-id="${escapeHTML(b.id)}">Edit</button>
          <button class="btn btn-danger" data-action="delete" data-id="${escapeHTML(b.id)}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

document.getElementById('inventory-tbody').addEventListener('click', async (event) => {
  const target = event.target;
  const button = target.closest ? target.closest('button[data-action]') : null;
  if (!button) return;

  if (button.dataset.action === 'edit') {
    await window.editBook(button.dataset.id);
  } else if (button.dataset.action === 'delete') {
    await window.deleteBook(button.dataset.id);
  }
});
function updateSummaryCards(books) {
  document.getElementById('stat-titles').textContent = books.length;
  document.getElementById('stat-stock').textContent = books.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0);
  document.getElementById('stat-edu').textContent = books.filter(b => b.bookCategory === 'Educational Books').length;
  document.getElementById('stat-comics').textContent = books.filter(b => b.bookCategory === 'Novel / Comic' || b.bookCategory === 'Comics').length;
  document.getElementById('stat-stationery').textContent = books.filter(b => b.bookCategory === 'Stationery').length;
}

// Edit Item
window.editBook = async (id) => {
  const book = await StorageManager.getBookById(id);
  if (!book) return;

  const isStat = book.bookCategory === 'Stationery';
  const labelTitle = isStat ? 'Edit Item Name:' : 'Edit Book Title:';
  const labelPub = isStat ? 'Edit Supplier:' : 'Edit Publisher:';

  const newTitle = prompt(labelTitle, book.title);
  if (newTitle === null) return;

  const newPublisher = prompt(labelPub, book.publisher || '');
  if (newPublisher === null) return;

  const newRack = prompt('Edit Rack Location:', book.rackLocation);
  if (newRack === null) return;

  const newPrice = prompt('Edit Selling Price (RM):', book.sellingPrice);
  if (newPrice === null) return;

  const newQty = prompt('Edit Quantity:', book.quantity);
  if (newQty === null) return;

  const parsedPrice = parseFloat(newPrice);
  const parsedQty = parseInt(newQty, 10);
  const trimmedTitle = newTitle.trim();
  const trimmedRack = newRack.trim();

  if (!trimmedTitle || !trimmedRack) {
    alert('Title/name and rack location cannot be empty.');
    return;
  }

  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    alert('Please enter a valid selling price.');
    return;
  }

  if (!Number.isInteger(parsedQty) || parsedQty < 0) {
    alert('Please enter a valid quantity.');
    return;
  }

  book.title = trimmedTitle;
  book.publisher = newPublisher.trim();
  book.rackLocation = trimmedRack;
  book.sellingPrice = parsedPrice;
  book.quantity = parsedQty;

  await StorageManager.saveBook(book);
  StorageManager.setLastRack(trimmedRack);
  if (isStat) {
    StorageManager.setLastSupplier(book.publisher);
  }
  loadInventory();
};

// Delete Item
window.deleteBook = async (id) => {
  const book = await StorageManager.getBookById(id);
  if (!book) return;

  const confirmed = confirm(`Are you sure you want to delete "${book.title}" (Barcode: ${book.isbn}) from inventory?`);
  if (confirmed) {
    await StorageManager.deleteBook(book.id);
    alert('Item deleted successfully.');
    loadInventory();
  }
};

document.getElementById('btn-delete-all').addEventListener('click', async () => {
  const allBooks = await StorageManager.getAllBooks();
  if (!allBooks.length) {
    alert('Inventory is already empty.');
    return;
  }

  const confirmed = confirm(`Delete ALL ${allBooks.length} inventory items? This cannot be undone.`);
  if (!confirmed) return;

  await StorageManager.clearAllBooks();
  filteredBooksList = [];
  alert('All inventory items deleted.');
  loadInventory();
  updateStationerySupplierSummary();
  updateRecentStationeryList();
});

// CSV Export
document.getElementById('btn-export-all').addEventListener('click', async () => {
  const allBooks = await StorageManager.getAllBooks();
  allBooks.sort((a, b) => asText(a.bookCategory).localeCompare(asText(b.bookCategory)));
  exportCSV(allBooks, 'entire_inventory.csv');
});
document.getElementById('btn-export-filtered').addEventListener('click', () => {
  exportCSV(filteredBooksList, 'filtered_inventory.csv');
});

document.getElementById('btn-export-stationery-suppliers').addEventListener('click', async () => {
  const allBooks = await StorageManager.getAllBooks();
  const selectedSupplier = document.getElementById('filter-publisher').value;

  if (!selectedSupplier) {
    alert('Please select one supplier first, then export.');
    return;
  }

  const supplierItems = getStationeryItemsForSupplier(allBooks, selectedSupplier);

  if (!supplierItems.length) {
    alert(`No stationery items found for ${selectedSupplier}.`);
    return;
  }

  exportCSV(supplierItems, `stationery_${safeFilename(selectedSupplier)}.csv`);
});

document.getElementById('btn-print-stationery-suppliers').addEventListener('click', async () => {
  const allBooks = await StorageManager.getAllBooks();
  const selectedSupplier = document.getElementById('filter-publisher').value;
  const sourceItems = selectedSupplier
    ? getStationeryItemsForSupplier(allBooks, selectedSupplier)
    : allBooks;
  const groups = groupStationeryBySupplier(sourceItems);

  if (!groups.length) {
    alert('No stationery items to print.');
    return;
  }

  openSupplierPrintSheets(groups);
});

function exportCSV(books, filename) {
  const headers = ['Rack Location', 'Category', 'Publisher / Supplier', 'SBC Code / ISBN', 'Title / Item Name', 'Qty Available', 'Selling Price (RM)'];
  const rows = books.map(b => [
    csvCell(b.rackLocation),
    csvCell(b.bookCategory),
    csvCell(b.publisher || ''),
    csvCell(b.isbn),
    csvCell(b.title),
    csvCell(b.quantity),
    csvCell(formatPrice(b.sellingPrice))
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function groupStationeryBySupplier(books) {
  const groups = books
    .filter(isStationeryItem)
    .reduce((acc, item) => {
      const supplier = item.publisher || 'No Supplier';
      if (!acc[supplier]) acc[supplier] = [];
      acc[supplier].push(item);
      return acc;
    }, {});

  return Object.entries(groups)
    .map(([supplier, items]) => [
      supplier,
      items.sort((a, b) => asText(a.isbn).localeCompare(asText(b.isbn), undefined, { numeric: true }))
    ])
    .sort(([a], [b]) => a.localeCompare(b));
}

function normalizeSupplierName(value) {
  return asText(value).trim().toLowerCase();
}

function getStationeryItemsForSupplier(books, supplier) {
  const normalizedSupplier = normalizeSupplierName(supplier);

  return books
    .filter(item =>
      isStationeryItem(item) &&
      normalizeSupplierName(item.publisher) === normalizedSupplier
    )
    .sort((a, b) => asText(a.isbn).localeCompare(asText(b.isbn), undefined, { numeric: true }));
}

function safeFilename(value) {
  return asText(value).trim().replace(/[^0-9A-Za-z_-]+/g, '_') || 'no_supplier';
}

function openSupplierPrintSheets(groups) {
  const generatedDate = new Date().toLocaleDateString();
  const sheets = groups.map(([supplier, items]) => {
    const rows = items.map(item => `
      <tr>
        <td>${escapeHTML(item.rackLocation)}</td>
        <td>${escapeHTML(item.title)}</td>
        <td>${escapeHTML(item.publisher || '')}</td>
        <td>${escapeHTML(item.isbn)}</td>
        <td>${escapeHTML(item.quantity)}</td>
        <td>${formatPrice(item.sellingPrice)}</td>
      </tr>
    `).join('');

    return `
      <section class="supplier-sheet">
        <header>
          <div>
            <strong>Supplier</strong>
            <h1>${escapeHTML(supplier)}</h1>
          </div>
          <div>
            <strong>Date</strong>
            <p>${escapeHTML(generatedDate)}</p>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Item</th>
              <th>Supplier</th>
              <th>Stationery Code</th>
              <th>Qty</th>
              <th>Selling Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Unable to open print window. Please allow pop-ups for this page.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Stationery Supplier Sheets</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
        header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
        h1 { margin: 4px 0 0; font-size: 22px; }
        p { margin: 4px 0 0; }
        strong { font-size: 11px; text-transform: uppercase; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #9ca3af; padding: 6px; text-align: left; }
        th { background: #f3f4f6; }
        tfoot td { font-weight: 700; }
        .supplier-sheet { page-break-after: always; }
        .supplier-sheet:last-child { page-break-after: auto; }
        @media print { body { margin: 10mm; } }
      </style>
    </head>
    <body>${sheets}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
