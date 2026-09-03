const DB_NAME = 'BookstoreInventoryDB';
const DB_VERSION = 2;
const STORE_NAME = 'books';
const LAST_RACK_KEY = 'last_used_rack';
const LAST_SUPPLIER_KEY = 'last_used_supplier';

class StorageManager {
  static openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;

        let existingData = [];

        if (db.objectStoreNames.contains(STORE_NAME)) {
          const oldStore = transaction.objectStore(STORE_NAME);
          const getAllReq = oldStore.getAll();
          
          getAllReq.onsuccess = () => {
            existingData = getAllReq.result || [];
            
            db.deleteObjectStore(STORE_NAME);

            const newStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            newStore.createIndex('isbn', 'isbn', { unique: false });
            newStore.createIndex('title', 'title', { unique: false });
            newStore.createIndex('rackLocation', 'rackLocation', { unique: false });
            newStore.createIndex('bookCategory', 'bookCategory', { unique: false });
            newStore.createIndex('publisher', 'publisher', { unique: false });

            existingData.forEach(item => {
              newStore.add(item);
            });
          };
        } else {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('isbn', 'isbn', { unique: false });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('rackLocation', 'rackLocation', { unique: false });
          store.createIndex('bookCategory', 'bookCategory', { unique: false });
          store.createIndex('publisher', 'publisher', { unique: false });
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

  static async getBookById(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

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
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

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
