const db = {
    dbName: 'aegis_db',
    version: 1,
    storeName: 'reports',
    db: null,

    init: function () {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB initialized');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    },

    getReports: function () {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                // Sort by timestamp desc to match original behavior (unshift adds to top)
                // But getAll returns by key (id). 
                // We will let app.js handle sorting if needed, or sort here.
                // Original app.js used unshift to add to top of array, implying newest first.
                // getAll() returns in key order (id = Date.now(), so oldest first).
                // We should probably reverse it or let app.js sort it.
                // app.js renderMyReports iterates the array. 
                // Let's return as is and let app.js handle state.
                // Actually, app.js: "this.state.reports.unshift(report); // Add to top"
                // So app.js expects element 0 to be newest.
                // getAll() returns oldest first (id asc).
                // So we should reverse it here or in app.js.
                // Let's reverse it here for convenience.
                const res = request.result || [];
                res.reverse();
                resolve(res);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    addReport: function (report) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(report);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    updateReport: function (report) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(report);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }
};
