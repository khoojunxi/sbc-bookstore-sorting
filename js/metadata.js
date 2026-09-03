class MetadataFetcher {
  static async fetchBookInfo(isbn) {
    let title = '';
    let publisher = '';

    const fetchWithTimeout = (url, timeoutMs = 2000) => {
      return Promise.race([
        fetch(url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), timeoutMs)
        )
      ]);
    };

    const googlePromise = fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.totalItems > 0 && data.items && data.items[0].volumeInfo) {
          const info = data.items[0].volumeInfo;
          return { title: info.title || '', publisher: info.publisher || '' };
        }
        return null;
      })
      .catch(() => null);

    const openLibraryPromise = fetchWithTimeout(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)
      .then(res => res.json())
      .then(data => {
        const key = `ISBN:${isbn}`;
        if (data && data[key]) {
          const info = data[key];
          return {
            title: info.title || '',
            publisher: info.publishers && info.publishers.length > 0 ? info.publishers[0].name : ''
          };
        }
        return null;
      })
      .catch(() => null);

    try {
      const results = await Promise.all([googlePromise, openLibraryPromise]);
      const googleRes = results[0];
      const olRes = results[1];

      title = (googleRes && googleRes.title) || (olRes && olRes.title) || '';
      publisher = (googleRes && googleRes.publisher) || (olRes && olRes.publisher) || '';
    } catch (e) {
      console.warn('Metadata lookup timed out or failed:', e);
    }

    return { title, publisher };
  }
}
