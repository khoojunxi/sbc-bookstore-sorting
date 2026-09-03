let activeBook = null;
let filteredBooksList = [];
let pendingBarcode = '';

const scanner = new BarcodeScanner('video-preview', handleScannedISBN);

// DOM Elements
const sectionScan = document.getElementById('section-scan');
const sectionNewBook = document.getElementById('section-new-book');
const sectionNewStationery = document.getElementById('section-new-stationery');
const sectionStationeryDirect = document.getElementById('section-stationery-direct');
const sectionInventory = document.getElementById('section-inventory');
const modalItemType = document.getElementById('modal-item-type');
const modalExisting = document.getElementById('modal-existing-book');
const manualIsbnInput = document.getElementById('manual-isbn');

// Navigation Switches
document.getElementById('nav-scan').addEventListener('click', () => showSection('scan'));
document.getElementById('nav-stationery-direct').addEventListener('click', () => showSection('stationery-direct'));
document.getElementById('nav-inventory').addEventListener('click', () => {
  showSection('inventory');
  loadInventory();
});

function showSection(name) {
  sectionScan.classList.add('hidden');
  sectionNewBook.classList.add('hidden');
  sectionNewStationery.classList.add('hidden');
  sectionStationeryDirect.classList.add('hidden');
  sectionInventory.classList.add('hidden');
  modalExisting.classList.add('hidden');
  modalItemType.classList.add('hidden');

  document.getElementById('nav-scan').classList.remove('active');
  document.getElementById('nav-stationery-direct').classList.remove('active');
  document.getElementById('nav-inventory').classList.remove('active');

  if (name === 'scan') {
    sectionScan.classList.remove('hidden');
    document.getElementById('nav-scan').classList.add('active');
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
  } else if (name === 'stationery-direct') {
    sectionStationeryDirect.classList.remove('hidden');
    document.getElementById('nav-stationery-direct').classList.add('active');
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
    // If entered blank manually, allow directly adding non-barcoded item
    pendingBarcode = '';
    modalItemType.classList.remove('hidden');
  }
});

async function handleScannedISBN(rawISBN) {
  const isbn = cleanISBN(rawISBN);
  if (!isbn) {
    alert('Invalid Barcode / ISBN');
    return;
  }

  manualIsbnInput.value = '';

  try {
    const localMatches = await StorageManager.getBooksByBarcode(isbn);

    if (localMatches.length === 1) {
      showExistingModal(localMatches[0]);
    } else if (localMatches.length > 1) {
      let optionsList = localMatches.map((item, idx) => 
        `${idx + 1}. [${item.itemType || 'Book'}] ${item.title} (Rack: ${item.rackLocation}, Qty: ${item.quantity})`
      ).join('\n');

      let choice = prompt(
        `Multiple items found with barcode ${isbn}:\n\n${optionsList}\n\nEnter number (1-${localMatches.length}) to restock an existing item, OR leave blank and press OK to create a NEW product with this barcode:`,
        "1"
      );

      if (choice === null) return; // Cancelled

      let selectedIndex = parseInt(choice, 10) - 1;
      if (!isNaN(selectedIndex) && localMatches[selectedIndex]) {
        showExistingModal(localMatches[selectedIndex]);
      } else {
        pendingBarcode = isbn;
        modalItemType.classList.remove('hidden');
      }
    } else {
      pendingBarcode = isbn;
      modalItemType.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Workflow Error:', err);
    alert('Error processing barcode: ' + err.message);
  }
}

function showExistingModal(item) {
  activeBook = item;
  document.getElementById('ext-type').textContent = item.itemType || 'Book';
  document.getElementById('ext-title').textContent = item.title;
  document.getElementById('ext-publisher').textContent = item.publisher || 'N/A';
  document.getElementById('ext-rack').textContent = item.rackLocation;
  document.getElementById('ext-category').textContent = item.bookCategory;
  document.getElementById('ext-price').textContent = item.sellingPrice.toFixed(2);
  document.getElementById('ext-qty').textContent = item.quantity;
  document.getElementById('add-qty-input').value = 1;
  
  modalExisting.classList.remove('hidden');
}

// Dynamic Publisher/Supplier suggestions populate
async function updatePublisherSuggestions() {
  const allBooks = await StorageManager.getAllBooks();
  const publishers = [...new Set(allBooks.map(b => b.publisher).filter(Boolean))].sort();
  
  const datalist = document.getElementById('publisher-suggestions');
  if (datalist) {
    datalist.innerHTML = publishers.map(pub => `<option value="${pub}">`).join('');
  }
}

// Item Type Selection Handlers
document.getElementById('btn-type-book').addEventListener('click', async () => {
  modalItemType.classList.add('hidden');
  await updatePublisherSuggestions();

  let meta = { title: '', publisher: '' };
  if (pendingBarcode) {
    meta = await MetadataFetcher.fetchBookInfo(pendingBarcode);
  }
  
  document.getElementById('nb-isbn').value = pendingBarcode;
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

  document.getElementById('ns-barcode').value = pendingBarcode;
  document.getElementById('ns-name').value = '';
  document.getElementById('ns-supplier').value = '';
  document.getElementById('ns-rack').value = StorageManager.getLastRack();
  document.getElementById('ns-price').value = '';
  document.getElementById('ns-qty').value = 1;

  showSection('new-stationery');
});

function cleanISBN(isbn) {
  return isbn ? isbn.replace(/[^0-9Xa-zA-Z]/gi, '') : '';
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
  showSection('scan');
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
    isbn: document.getElementById('nb-isbn').value.trim(),
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
    isbn: document.getElementById('ns-barcode').value.trim(),
    title: document.getElementById('ns-name').value.trim(),
    publisher: document.getElementById('ns-supplier').value.trim(),
    rackLocation: rack,
    bookCategory: 'Stationery',
    sellingPrice: parseFloat(document.getElementById('ns-price').value),
    quantity: parseInt(document.getElementById('ns-qty').value, 10)
  };

  await StorageManager.saveBook(stationery);
  StorageManager.setLastRack(rack);

  alert('Stationery item saved successfully!');
  showSection('scan');
});

document.getElementById('btn-cancel-new-stat').addEventListener('click', () => {
  showSection('scan');
});

// Save Direct Stationery Stocktake
document.getElementById('form-stationery-direct').addEventListener('submit', async (e) => {
  e.preventDefault();

  const rack = document.getElementById('sd-rack').value.trim();
  const supplier = document.getElementById('sd-supplier').value.trim();
  const name = document.getElementById('sd-name').value.trim();
  const barcode = document.getElementById('sd-barcode').value.trim();
  const qty = parseInt(document.getElementById('sd-qty').value, 10);
  const price = parseFloat(document.getElementById('sd-price').value);

  if (!supplier || !name || !rack || Number.isNaN(qty) || qty < 1 || Number.isNaN(price)) {
    alert('Please complete all required stationery stocktake fields with valid values.');
    return;
  }

  const stationery = {
    itemType: 'Stationery',
    isbn: barcode,
    title: name,
    publisher: supplier,
    rackLocation: rack,
    bookCategory: 'Stationery',
    sellingPrice: price,
    quantity: qty
  };

  await StorageManager.saveBook(stationery);
  StorageManager.setLastRack(rack);

  document.getElementById('form-stationery-direct').reset();
  document.getElementById('sd-qty').value = 1;
  alert('Stationery stock count saved successfully!');
  document.getElementById('sd-barcode').focus();
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

  const racks = [...new Set(books.map(b => b.rackLocation))].sort();
  const pubs = [...new Set(books.map(b => b.publisher).filter(Boolean))].sort();

  rackSelect.innerHTML = '<option value="">All Racks</option>' + racks.map(r => `<option value="${r}">${r}</option>`).join('');
  pubSelect.innerHTML = '<option value="">All Publishers/Suppliers</option>' + pubs.map(p => `<option value="${p}">${p}</option>`).join('');
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
    const matchesSearch = (b.isbn && b.isbn.toLowerCase().includes(query)) ||
                          b.title.toLowerCase().includes(query) ||
                          (b.publisher && b.publisher.toLowerCase().includes(query)) ||
                          b.rackLocation.toLowerCase().includes(query) ||
                          b.bookCategory.toLowerCase().includes(query);

    const matchesRack = !rackFilter || b.rackLocation === rackFilter;
    const matchesPub = !pubFilter || b.publisher === pubFilter;
    const matchesCat = !catFilter || b.bookCategory === catFilter;

    return matchesSearch && matchesRack && matchesPub && matchesCat;
  });

  filteredBooksList.sort((a, b) => {
    if (a.bookCategory !== b.bookCategory) {
      return a.bookCategory.localeCompare(b.bookCategory);
    }
    if (a.rackLocation !== b.rackLocation) {
      return a.rackLocation.localeCompare(b.rackLocation);
    }
    return a.title.localeCompare(b.title);
  });

  renderTable(filteredBooksList);
  updateSummaryCards(filteredBooksList);
}

function renderTable(books) {
  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = books.map(b => `
    <tr>
      <td>${b.rackLocation}</td>
      <td>${b.bookCategory}</td>
      <td>${b.publisher || '-'}</td>
      <td>${b.isbn ? b.isbn : '<em style="color:#888;">[BLANK]</em>'}</td>
      <td>${b.title}</td>
      <td>${b.quantity}</td>
      <td>${b.sellingPrice.toFixed(2)}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-tertiary" onclick="editBook(${b.id})">Edit</button>
          <button class="btn btn-danger" onclick="deleteBook(${b.id}, '${b.title.replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updateSummaryCards(books) {
  document.getElementById('stat-titles').textContent = books.length;
  document.getElementById('stat-stock').textContent = books.reduce((acc, b) => acc + b.quantity, 0);
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

  const newBarcode = prompt('Edit Barcode/ISBN (Leave empty if none):', book.isbn || '');
  if (newBarcode === null) return;

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

  book.isbn = newBarcode.trim();
  book.title = newTitle.trim();
  book.publisher = newPublisher.trim();
  book.rackLocation = newRack.trim();
  book.sellingPrice = parseFloat(newPrice);
  book.quantity = parseInt(newQty, 10);

  await StorageManager.saveBook(book);
  loadInventory();
};

// Delete Item
window.deleteBook = async (id, title) => {
  const confirmed = confirm(`Are you sure you want to delete "${title}" from inventory?`);
  if (confirmed) {
    await StorageManager.deleteBook(id);
    alert('Item deleted successfully.');
    loadInventory();
  }
};

// Supplier Sheet Print Handler (Grouped by Supplier according to filtered rack)
document.getElementById('btn-print-supplier-sheets').addEventListener('click', () => {
  const rackFilter = document.getElementById('filter-rack').value;
  
  if (!rackFilter) {
    const proceed = confirm("No specific rack is selected in the filter. Do you want to print supplier sheets across ALL racks?");
    if (!proceed) return;
  }

  const itemsToPrint = filteredBooksList.length > 0 ? filteredBooksList : [];

  if (itemsToPrint.length === 0) {
    alert("No items found for the selected rack/filters to print.");
    return;
  }

  // Group items by Supplier/Publisher
  const supplierGroups = {};
  itemsToPrint.forEach(item => {
    const supplier = (item.publisher && item.publisher.trim()) ? item.publisher.trim() : 'Unknown / Unassigned Supplier';
    if (!supplierGroups[supplier]) {
      supplierGroups[supplier] = [];
    }
    supplierGroups[supplier].push(item);
  });

  const printContainer = document.getElementById('print-container');
  printContainer.innerHTML = '';

  const targetRackLabel = rackFilter ? `Rack Location: ${rackFilter}` : `All Racks`;
  const currentDate = new Date().toLocaleDateString();

  // Create a separate printable page per supplier
  Object.keys(supplierGroups).sort().forEach(supplierName => {
    const items = supplierGroups[supplierName];
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

    const sheet = document.createElement('div');
    sheet.className = 'supplier-sheet-page';

    const rowsHtml = items.map((item, idx) => `
      <tr>
        <td style="text-align: center; width: 40px;">${idx + 1}</td>
        <td>${item.isbn || '[BLANK]'}</td>
        <td><strong>${item.title}</strong></td>
        <td style="text-align: center;">${item.rackLocation}</td>
        <td style="text-align: center;">${item.bookCategory}</td>
        <td style="text-align: right;">${item.sellingPrice.toFixed(2)}</td>
        <td style="text-align: center; font-weight: bold;">${item.quantity}</td>
        <td style="width: 80px;"></td> <!-- Blank space for recorded Cost Price -->
      </tr>
    `).join('');

    sheet.innerHTML = `
      <div class="supplier-sheet-header">
        <h2>Supplier Inventory Sheet: ${supplierName}</h2>
        <p><strong>Scope:</strong> ${targetRackLabel} | <strong>Date:</strong> ${currentDate} | <strong>Total Units:</strong> ${totalQty}</p>
      </div>
      <table class="supplier-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Barcode / ISBN</th>
            <th>Item Name / Title</th>
            <th>Rack</th>
            <th>Category</th>
            <th>Price (RM)</th>
            <th>Qty</th>
            <th>Cost Price</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    printContainer.appendChild(sheet);
  });

  window.print();
});
