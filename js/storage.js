const DB_NAME = 'BookstoreInventoryDB';
const DB_VERSION = 2; // Incremented version to update store schema
const STORE_NAME = 'books';
const LAST_RACK_KEY = 'last_used_rack';
const LAST_SUPPLIER_KEY = 'last_used_supplier';
class StorageManager {
  static createBookStore(db) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    store.createIndex('isbn', 'isbn', { unique: false });
    store.createIndex('title', 'title', { unique: false });
    store.createIndex('rackLocation', 'rackLocation', { unique: false });
    store.createIndex('bookCategory', 'bookCategory', { unique: false });
    store.createIndex('publisher', 'publisher', { unique: false });
    return store;
  }

  static openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
          const oldStore = event.target.transaction.objectStore(STORE_NAME);
          const getAllRequest = oldStore.getAll();

          getAllRequest.onsuccess = () => {
            const existingBooks = getAllRequest.result || [];
            db.deleteObjectStore(STORE_NAME);
            const store = this.createBookStore(db);

            existingBooks.forEach((book) => {
              const migratedBook = { ...book };
              delete migratedBook.id;
              store.add(migratedBook);
            });
          };

          getAllRequest.onerror = () => reject(getAllRequest.error);
          return;
        }

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          this.createBookStore(db);
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  static async saveBook(book) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(book);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // Gets ALL items that match a specific barcode/ISBN
  static async getBooksByBarcode(isbn) {
    if (!isbn) return [];
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('isbn');
      const request = index.getAll(isbn);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  static async getBook(isbn) {
    const books = await this.getBooksByBarcode(isbn);
    return books[0] || null;
  }

  static async getBookById(id) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error('Invalid item ID');
    }

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(numericId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  static async getAllBooks() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  static async deleteBook(id) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error('Invalid item ID');
    }

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(numericId);

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  static async clearAllBooks() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  static getLastRack() {
    return localStorage.getItem(LAST_RACK_KEY) || '';
  }

  static setLastRack(rack) {
    if (rack) {
      localStorage.setItem(LAST_RACK_KEY, rack);
    }
  }

  static getLastSupplier() {
    return localStorage.getItem(LAST_SUPPLIER_KEY) || '';
  }

  static setLastSupplier(supplier) {
    if (supplier) {
      localStorage.setItem(LAST_SUPPLIER_KEY, supplier);
    }
  }
}
